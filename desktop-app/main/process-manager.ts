/**
 * Python Process Manager - Lite Mode Architecture
 * 
 * Implements on-demand process spawning with auto-hibernate to optimize
 * memory usage on low-end hardware (Dual Core CPU, 4GB RAM).
 * 
 * Features:
 * - Lazy Start: Only spawns Python when automation is requested
 * - Auto-Hibernate: Kills process after 15 minutes of inactivity
 * - Re-Awaken: Automatically restarts on new requests
 * - Graceful Shutdown: SIGTERM with fallback to SIGKILL
 * 
 * @module main/process-manager
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

// ============================================================================
//                         CONFIGURATION
// ============================================================================

/** Hibernate timeout in milliseconds (15 minutes) */
const HIBERNATE_TIMEOUT_MS = 15 * 60 * 1000;

/** Grace period for SIGTERM before SIGKILL (5 seconds) */
const GRACEFUL_SHUTDOWN_MS = 5000;

/** Port for the automation FastAPI service */
const AUTOMATION_SERVICE_PORT = 8765;

/** Health check interval (30 seconds) */
const HEALTH_CHECK_INTERVAL_MS = 30 * 1000;

/** Max retries for service startup */
const MAX_START_RETRIES = 3;

// ============================================================================
//                         TYPES & INTERFACES
// ============================================================================

export type ProcessState = 'stopped' | 'starting' | 'running' | 'hibernating' | 'error';

export interface ProcessManagerEvents {
    'state-change': (state: ProcessState, previousState: ProcessState) => void;
    'log': (type: 'stdout' | 'stderr' | 'info', message: string) => void;
    'error': (error: Error) => void;
    'hibernate-warning': (secondsRemaining: number) => void;
}

export interface ProcessStats {
    state: ProcessState;
    pid: number | null;
    uptime: number; // milliseconds since start
    lastActivity: Date | null;
    hibernateIn: number | null; // milliseconds until hibernate, null if not running
    startCount: number;
    errorCount: number;
}

// ============================================================================
//                    PYTHON PROCESS MANAGER CLASS
// ============================================================================

/**
 * Manages the Python automation service lifecycle with lazy loading
 * and automatic hibernation for memory optimization.
 */
export class PythonProcessManager extends EventEmitter {
    private process: ChildProcess | null = null;
    private state: ProcessState = 'stopped';
    private hibernateTimer: NodeJS.Timeout | null = null;
    private healthCheckTimer: NodeJS.Timeout | null = null;
    private startTime: Date | null = null;
    private lastActivityTime: Date | null = null;
    private startCount: number = 0;
    private errorCount: number = 0;
    private isShuttingDown: boolean = false;

    // Environment configuration
    private readonly isDev: boolean;
    private readonly resourcesPath: string;
    private readonly automationServiceDir: string;

    constructor(options?: {
        isDev?: boolean;
        resourcesPath?: string;
        automationServiceDir?: string;
    }) {
        super();

        this.isDev = options?.isDev ?? process.env.ELECTRON_DEV === 'true';
        this.resourcesPath = options?.resourcesPath ?? process.resourcesPath ?? '';
        this.automationServiceDir = options?.automationServiceDir ??
            path.join(__dirname, '..', 'automation-service');
    }

    // ==========================================================================
    //                         PUBLIC API
    // ==========================================================================

    /**
     * Get current process statistics
     */
    getStats(): ProcessStats {
        const now = Date.now();
        const uptime = this.startTime ? now - this.startTime.getTime() : 0;
        const hibernateIn = this.lastActivityTime
            ? Math.max(0, HIBERNATE_TIMEOUT_MS - (now - this.lastActivityTime.getTime()))
            : null;

        return {
            state: this.state,
            pid: this.process?.pid ?? null,
            uptime,
            lastActivity: this.lastActivityTime,
            hibernateIn: this.state === 'running' ? hibernateIn : null,
            startCount: this.startCount,
            errorCount: this.errorCount,
        };
    }

    /**
     * Ensure the automation service is running.
     * Lazy-starts if stopped, resets hibernate timer if running.
     * 
     * @returns Promise that resolves when service is ready
     */
    async ensureRunning(): Promise<boolean> {
        this.recordActivity();

        if (this.state === 'running') {
            this.log('info', 'Service already running, resetting hibernate timer');
            this.resetHibernateTimer();
            return true;
        }

        if (this.state === 'starting') {
            this.log('info', 'Service is starting, waiting...');
            return this.waitForState('running', 30000);
        }

        return this.start();
    }

    /**
     * Start the Python automation service.
     * Called automatically by ensureRunning() - prefer that method.
     */
    async start(): Promise<boolean> {
        if (this.state === 'running' || this.state === 'starting') {
            return true;
        }

        this.setState('starting');
        this.startCount++;

        const command = this.getServiceCommand();
        if (!command) {
            this.setState('error');
            this.emit('error', new Error('Automation service executable not found'));
            return false;
        }

        this.log('info', `Starting automation service: ${command.command}`);

        try {
            this.process = spawn(command.command, command.args, {
                cwd: command.cwd,
                env: {
                    ...process.env,
                    PYTHONUNBUFFERED: '1',
                    PORT: String(AUTOMATION_SERVICE_PORT),
                },
                detached: false,
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            this.setupProcessHandlers();
            this.startTime = new Date();
            this.recordActivity();

            // Wait for service to be ready (health check)
            const isReady = await this.waitForHealthy(10000);

            if (isReady) {
                this.setState('running');
                this.startHealthCheck();
                this.resetHibernateTimer();
                return true;
            } else {
                throw new Error('Service failed to become healthy');
            }

        } catch (error: any) {
            this.errorCount++;
            this.log('stderr', `Failed to start: ${error.message}`);
            this.setState('error');
            this.emit('error', error);
            return false;
        }
    }

    /**
     * Stop the automation service gracefully.
     * Sends SIGTERM, falls back to SIGKILL after grace period.
     */
    async stop(): Promise<void> {
        if (!this.process || this.state === 'stopped') {
            return;
        }

        this.isShuttingDown = true;
        this.clearTimers();
        this.log('info', 'Stopping automation service...');

        return new Promise((resolve) => {
            const forceKillTimer = setTimeout(() => {
                if (this.process) {
                    this.log('info', 'Force killing process (SIGKILL)');
                    this.process.kill('SIGKILL');
                }
            }, GRACEFUL_SHUTDOWN_MS);

            this.process!.once('exit', () => {
                clearTimeout(forceKillTimer);
                this.cleanup();
                resolve();
            });

            // Send SIGTERM for graceful shutdown
            this.process!.kill('SIGTERM');
        });
    }

    /**
     * Hibernate the service (stop to free memory).
     * Called automatically after inactivity timeout.
     */
    async hibernate(): Promise<void> {
        if (this.state !== 'running') return;

        this.log('info', 'Hibernating automation service to free memory...');
        this.setState('hibernating');
        await this.stop();
        this.setState('stopped');
        this.log('info', 'Service hibernated. Will restart on next request.');
    }

    /**
     * Record activity to reset the hibernate timer.
     * Call this when automation tasks are performed.
     */
    recordActivity(): void {
        this.lastActivityTime = new Date();
        if (this.state === 'running') {
            this.resetHibernateTimer();
        }
    }

    /**
     * Check if the service is currently available.
     */
    isAvailable(): boolean {
        return this.state === 'running';
    }

    // ==========================================================================
    //                         PRIVATE METHODS
    // ==========================================================================

    private getServiceCommand(): { command: string; args: string[]; cwd: string } | null {
        if (this.isDev) {
            // Development: use Python script with venv
            const venvPython = path.join(this.automationServiceDir, 'venv', 'Scripts', 'python.exe');
            const mainPy = path.join(this.automationServiceDir, 'main.py');

            if (fs.existsSync(venvPython)) {
                return { command: venvPython, args: [mainPy], cwd: this.automationServiceDir };
            }
            // Fallback to system Python
            return { command: 'python', args: [mainPy], cwd: this.automationServiceDir };
        } else {
            // Production: use compiled PyInstaller executable
            const automationExe = path.join(this.resourcesPath, 'automation', 'automation.exe');
            const automationDir = path.join(this.resourcesPath, 'automation');

            if (fs.existsSync(automationExe)) {
                return { command: automationExe, args: [], cwd: automationDir };
            }

            this.log('stderr', 'Compiled automation.exe not found');
            return null;
        }
    }

    private setupProcessHandlers(): void {
        if (!this.process) return;

        this.process.stdout?.on('data', (data: Buffer) => {
            const message = data.toString().trim();
            if (message) {
                this.log('stdout', message);
            }
        });

        this.process.stderr?.on('data', (data: Buffer) => {
            const message = data.toString().trim();
            if (message) {
                this.log('stderr', message);
            }
        });

        this.process.on('exit', (code: number | null) => {
            if (!this.isShuttingDown) {
                this.log('info', `Process exited unexpectedly with code ${code}`);
                this.errorCount++;
                this.cleanup();
                this.setState('error');
            }
        });

        this.process.on('error', (error: Error) => {
            this.log('stderr', `Process error: ${error.message}`);
            this.errorCount++;
            this.emit('error', error);
        });
    }

    private async waitForHealthy(timeoutMs: number): Promise<boolean> {
        const startTime = Date.now();
        const checkInterval = 500;

        while (Date.now() - startTime < timeoutMs) {
            try {
                const response = await fetch(`http://localhost:${AUTOMATION_SERVICE_PORT}/health`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(2000),
                });

                if (response.ok) {
                    this.log('info', 'Service health check passed');
                    return true;
                }
            } catch {
                // Service not ready yet, continue waiting
            }

            await this.sleep(checkInterval);
        }

        return false;
    }

    private async waitForState(targetState: ProcessState, timeoutMs: number): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.state === targetState) {
                resolve(true);
                return;
            }

            const timeout = setTimeout(() => {
                this.removeListener('state-change', handler);
                resolve(false);
            }, timeoutMs);

            const handler = (state: ProcessState) => {
                if (state === targetState) {
                    clearTimeout(timeout);
                    this.removeListener('state-change', handler);
                    resolve(true);
                } else if (state === 'error') {
                    clearTimeout(timeout);
                    this.removeListener('state-change', handler);
                    resolve(false);
                }
            };

            this.on('state-change', handler);
        });
    }

    private resetHibernateTimer(): void {
        if (this.hibernateTimer) {
            clearTimeout(this.hibernateTimer);
        }

        // Emit warning 1 minute before hibernate
        const warningTimer = setTimeout(() => {
            if (this.state === 'running') {
                this.emit('hibernate-warning', 60);
            }
        }, HIBERNATE_TIMEOUT_MS - 60000);

        this.hibernateTimer = setTimeout(async () => {
            clearTimeout(warningTimer);
            await this.hibernate();
        }, HIBERNATE_TIMEOUT_MS);

        this.log('info', `Hibernate timer reset (${HIBERNATE_TIMEOUT_MS / 60000} minutes)`);
    }

    private startHealthCheck(): void {
        this.healthCheckTimer = setInterval(async () => {
            if (this.state !== 'running') {
                this.clearTimers();
                return;
            }

            try {
                const response = await fetch(`http://localhost:${AUTOMATION_SERVICE_PORT}/health`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000),
                });

                if (!response.ok) {
                    throw new Error(`Health check failed: ${response.status}`);
                }
            } catch (error: any) {
                this.log('stderr', `Health check failed: ${error.message}`);
                this.errorCount++;
                // Don't auto-restart, just log the error
            }
        }, HEALTH_CHECK_INTERVAL_MS);
    }

    private clearTimers(): void {
        if (this.hibernateTimer) {
            clearTimeout(this.hibernateTimer);
            this.hibernateTimer = null;
        }
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
    }

    private cleanup(): void {
        this.clearTimers();
        this.process = null;
        this.startTime = null;
        this.isShuttingDown = false;
    }

    private setState(newState: ProcessState): void {
        const previousState = this.state;
        this.state = newState;
        this.emit('state-change', newState, previousState);
    }

    private log(type: 'stdout' | 'stderr' | 'info', message: string): void {
        const timestamp = new Date().toISOString();
        console.log(`[ProcessManager][${type}] ${timestamp}: ${message}`);
        this.emit('log', type, message);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================================================
//                         SINGLETON EXPORT
// ============================================================================

let _instance: PythonProcessManager | null = null;

/**
 * Get the singleton PythonProcessManager instance.
 */
export function getProcessManager(): PythonProcessManager {
    if (!_instance) {
        _instance = new PythonProcessManager();
    }
    return _instance;
}

/**
 * Destroy the singleton instance (for cleanup on app exit).
 */
export async function destroyProcessManager(): Promise<void> {
    if (_instance) {
        await _instance.stop();
        _instance = null;
    }
}

export default PythonProcessManager;
