/**
 * AIAutomationDashboard.tsx - AI Browser Automation Control Panel
 * 
 * Sophisticated UI for controlling the Python automation agent via the automation.ts bridge.
 * Features: Real-time log feed, engine status monitoring, preset actions, WebSocket updates.
 * 
 * @file desktop-app/src/src/components/AIAutomationDashboard.tsx
 */

import { useState, useEffect, useRef } from 'react';
import { Play, Square, Terminal, CheckCircle, Loader2, AlertCircle, Zap } from 'lucide-react';
import {
    startAutomation,
    isServiceRunning,
    connectToTaskUpdates,
    type TaskStatusResponse,
    type AutomationError,
} from '../lib/automation';

// =============================================================================
// TYPES
// =============================================================================

type EngineStatus = 'checking' | 'ready' | 'initializing' | 'error';
type TaskStatus = 'idle' | 'running' | 'completed' | 'error';

interface LogEntry {
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'system';
}

interface PresetAction {
    id: string;
    emoji: string;
    title: string;
    description: string;
    task: string;
}

// =============================================================================
// PRESET ACTIONS
// =============================================================================

const PRESET_ACTIONS: PresetAction[] = [
    {
        id: 'commonapp-login',
        emoji: '🚀',
        title: 'Login to CommonApp',
        description: 'Navigate to CommonApp and log in',
        task: 'Go to CommonApp website and navigate through the login process. Do not submit any forms.'
    },
    {
        id: 'check-status',
        emoji: '📄',
        title: 'Check Application Status',
        description: 'Review application progress',
        task: 'Check the current status of the university application and report any updates or required actions.'
    },
    {
        id: 'find-requirements',
        emoji: '🔍',
        title: 'Find University Requirements',
        description: 'Research admission criteria',
        task: 'Search for and compile the admission requirements for the specified university, including GPA, test scores, and documents needed.'
    },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AIAutomationDashboard() {
    // Engine status state
    const [engineStatus, setEngineStatus] = useState<EngineStatus>('checking');
    const [engineError, setEngineError] = useState<string>('');

    // Task execution state
    const [taskInput, setTaskInput] = useState<string>('');
    const [taskStatus, setTaskStatus] = useState<TaskStatus>('idle');
    const [, setCurrentTaskId] = useState<string>('');
    const [logs, setLogs] = useState<LogEntry[]>([]);

    // Refs
    const wsCleanupRef = useRef<(() => void) | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const isMounted = useRef(true);

    // =============================================================================
    // LIFECYCLE
    // =============================================================================

    useEffect(() => {
        isMounted.current = true;
        checkEngineStatus();

        // Check for pending task from Auto-Apply
        checkPendingTask();

        return () => {
            isMounted.current = false;
            // Clean up WebSocket connection
            if (wsCleanupRef.current) {
                wsCleanupRef.current();
            }
        };
    }, []);

    // Auto-scroll logs to bottom
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Check for pending task from Auto-Apply page
    const checkPendingTask = () => {
        const pendingTask = localStorage.getItem('pending_ai_task');
        const autoStart = localStorage.getItem('pending_ai_task_autostart');

        if (pendingTask) {
            console.log('[AIBrowser] Found pending task from Auto-Apply');
            setTaskInput(pendingTask);
            addLog('📋 Loaded application task from Auto-Apply', 'info');

            // Clear the pending task from localStorage
            localStorage.removeItem('pending_ai_task');
            localStorage.removeItem('pending_ai_task_autostart');

            // If autostart is set, wait for engine and start
            if (autoStart === 'true') {
                addLog('⏳ Waiting for engine to start automation...', 'system');
                // Will auto-start once engine is ready (handled in checkEngineStatus)
                waitForEngineAndStart(pendingTask);
            }
        }
    };

    // Wait for engine to be ready then auto-start
    const waitForEngineAndStart = async (task: string) => {
        // Wait a bit for engine status to be checked
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if engine is ready
        const running = await isServiceRunning();
        if (running && isMounted.current) {
            addLog('🚀 Auto-starting application automation...', 'success');
            // Trigger the run task with the pending task
            setTaskInput(task);
            setTimeout(() => {
                if (isMounted.current) {
                    handleRunTaskWithInput(task);
                }
            }, 500);
        } else {
            addLog('⚠️ Engine not ready - please click Run Task when ready', 'info');
        }
    };

    // Run task with specific input (for auto-start)
    const handleRunTaskWithInput = async (input: string) => {
        if (!input.trim()) {
            addLog('✗ No task to run', 'error');
            return;
        }

        if (engineStatus !== 'ready') {
            addLog('✗ Automation engine is not ready yet, please wait...', 'error');
            return;
        }

        setTaskStatus('running');
        clearLogs();
        addLog(`🚀 Starting task: ${input.substring(0, 100)}...`, 'system');

        try {
            const response = await startAutomation(input);
            setCurrentTaskId(response.task_id);

            addLog(`✓ Task started with ID: ${response.task_id}`, 'success');
            addLog('📡 Connecting to live feed...', 'info');

            const cleanup = connectToTaskUpdates(
                response.task_id,
                handleTaskUpdate,
                handleTaskError
            );

            wsCleanupRef.current = cleanup;

        } catch (error) {
            const automationError = error as AutomationError;

            if (!isMounted.current) return;

            setTaskStatus('error');
            addLog(`✗ Failed to start task: ${automationError.message || 'Unknown error'}`, 'error');
        }
    };

    // =============================================================================
    // ENGINE STATUS
    // =============================================================================

    const checkEngineStatus = async () => {
        setEngineStatus('checking');
        addLog('Checking automation engine status...', 'system');

        try {
            const running = await isServiceRunning();

            if (!isMounted.current) return;

            if (running) {
                setEngineStatus('ready');
                addLog('✓ Automation engine is ready!', 'success');
            } else {
                setEngineStatus('initializing');
                addLog('⏳ Automation engine is starting up...', 'info');

                // Retry after a few seconds
                setTimeout(() => {
                    if (isMounted.current) {
                        checkEngineStatus();
                    }
                }, 3000);
            }
        } catch (error) {
            if (!isMounted.current) return;

            setEngineStatus('error');
            setEngineError('Cannot connect to automation service');
            addLog('✗ Failed to connect to automation engine', 'error');
        }
    };

    // =============================================================================
    // LOG MANAGEMENT
    // =============================================================================

    const addLog = (message: string, type: LogEntry['type'] = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { timestamp, message, type }]);
    };

    const clearLogs = () => {
        setLogs([]);
    };

    // =============================================================================
    // TASK EXECUTION
    // =============================================================================

    const handleRunTask = async () => {
        if (!taskInput.trim()) {
            addLog('✗ Please enter a task description', 'error');
            return;
        }

        if (engineStatus !== 'ready') {
            addLog('✗ Automation engine is not ready', 'error');
            return;
        }

        setTaskStatus('running');
        clearLogs();
        addLog(`🚀 Starting task: ${taskInput.substring(0, 100)}...`, 'system');

        try {
            // Start the automation task
            const response = await startAutomation(taskInput);
            setCurrentTaskId(response.task_id);

            addLog(`✓ Task started with ID: ${response.task_id}`, 'success');
            addLog('📡 Connecting to live feed...', 'info');

            // Connect to WebSocket for real-time updates
            const cleanup = connectToTaskUpdates(
                response.task_id,
                handleTaskUpdate,
                handleTaskError
            );

            wsCleanupRef.current = cleanup;

        } catch (error) {
            const automationError = error as AutomationError;

            if (!isMounted.current) return;

            setTaskStatus('error');

            if (automationError.type === 'CONNECTION_FAILED') {
                addLog('✗ Cannot connect to automation service. Is the Python backend running?', 'error');
                setEngineStatus('error');
                setEngineError('Connection failed');
            } else if (automationError.type === 'TIMEOUT') {
                addLog('✗ Request timed out. The automation service may be busy.', 'error');
            } else {
                addLog(`✗ Error: ${automationError.message}`, 'error');
            }
        }
    };

    const handleTaskUpdate = (update: TaskStatusResponse) => {
        if (!isMounted.current) return;

        console.log('[Automation] Update:', update);

        // Add status message to logs
        if (update.message && update.message !== logs[logs.length - 1]?.message) {
            const logType = update.status === 'error' ? 'error' : 'info';
            addLog(`[${update.progress}%] ${update.message}`, logType);
        }

        // Check if task completed
        if (update.status === 'completed') {
            setTaskStatus('completed');
            addLog('✓ Task completed successfully!', 'success');

            // Clean up WebSocket
            if (wsCleanupRef.current) {
                wsCleanupRef.current();
                wsCleanupRef.current = null;
            }
        } else if (update.status === 'error') {
            setTaskStatus('error');

            // Clean up WebSocket
            if (wsCleanupRef.current) {
                wsCleanupRef.current();
                wsCleanupRef.current = null;
            }
        }

        // Display account credentials if created
        if (update.account_created) {
            addLog('🔑 Account credentials created:', 'success');
            addLog(`   Email: ${update.account_created.email}`, 'info');
            addLog(`   Password: ${update.account_created.password}`, 'info');
            addLog(`   University: ${update.account_created.university}`, 'info');
        }
    };

    const handleTaskError = (error: Error) => {
        if (!isMounted.current) return;

        setTaskStatus('error');
        addLog(`✗ WebSocket error: ${error.message}`, 'error');

        // Clean up
        if (wsCleanupRef.current) {
            wsCleanupRef.current();
            wsCleanupRef.current = null;
        }
    };

    const handleStopTask = () => {
        addLog('🛑 Stopping task...', 'system');
        setTaskStatus('idle');

        // Clean up WebSocket
        if (wsCleanupRef.current) {
            wsCleanupRef.current();
            wsCleanupRef.current = null;
        }

        addLog('✓ Task stopped', 'info');
    };

    // =============================================================================
    // PRESET ACTIONS
    // =============================================================================

    const handlePresetClick = (preset: PresetAction) => {
        setTaskInput(preset.task);
        addLog(`📋 Loaded preset: ${preset.title}`, 'info');
    };

    // =============================================================================
    // RENDER
    // =============================================================================

    const isRunning = taskStatus === 'running';

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                    <Terminal className="w-7 h-7 text-orange-500" />
                    AI Automation Dashboard
                </h1>
                <p className="text-slate-500 mt-1">
                    AI-powered browser automation for university applications
                </p>
            </div>

            {/* Engine Status Indicator */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                            <Terminal className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-900">
                                Automation Engine
                            </div>
                            <div className="text-xs text-slate-500">
                                Python FastAPI + Gemini AI
                            </div>
                        </div>
                    </div>

                    {/* Status Badge */}
                    {engineStatus === 'checking' && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
                            <Loader2 className="w-4 h-4 text-slate-600 animate-spin" />
                            <span className="text-sm font-medium text-slate-600">Checking...</span>
                        </div>
                    )}

                    {engineStatus === 'initializing' && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 rounded-full">
                            <Loader2 className="w-4 h-4 text-yellow-600 animate-spin" />
                            <span className="text-sm font-medium text-yellow-600">Initializing...</span>
                        </div>
                    )}

                    {engineStatus === 'ready' && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 rounded-full">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-600">Engine Ready</span>
                        </div>
                    )}

                    {engineStatus === 'error' && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 rounded-full">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <span className="text-sm font-medium text-red-600">{engineError}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions (Presets) */}
            <div>
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h2>
                <div className="grid grid-cols-3 gap-3">
                    {PRESET_ACTIONS.map(preset => (
                        <button
                            key={preset.id}
                            onClick={() => handlePresetClick(preset)}
                            disabled={isRunning}
                            className="bg-white rounded-xl p-4 border border-slate-200 hover:border-orange-300 hover:bg-orange-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group text-left"
                        >
                            <div className="text-2xl mb-2">{preset.emoji}</div>
                            <div className="text-sm font-semibold text-slate-900 mb-1">
                                {preset.title}
                            </div>
                            <div className="text-xs text-slate-500">
                                {preset.description}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Command Deck (Input Area) */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" />
                    Command Deck
                </h2>

                <textarea
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    disabled={isRunning}
                    placeholder="Describe your automation task in natural language...&#10;&#10;Example: 'Go to MIT admissions portal, create an account with student@example.com, and fill out the personal information section.'"
                    className="w-full h-32 px-4 py-3 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed font-mono text-sm"
                />

                <div className="flex items-center gap-3 mt-4">
                    {/* Run Button */}
                    {!isRunning ? (
                        <button
                            onClick={handleRunTask}
                            disabled={engineStatus !== 'ready' || !taskInput.trim()}
                            className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-orange-500"
                        >
                            <Play className="w-5 h-5" />
                            RUN AGENT
                        </button>
                    ) : (
                        <button
                            onClick={handleStopTask}
                            className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition"
                        >
                            <Square className="w-5 h-5" />
                            STOP
                        </button>
                    )}

                    {/* Clear Logs */}
                    <button
                        onClick={clearLogs}
                        disabled={logs.length === 0}
                        className="px-4 py-3 text-slate-600 font-medium rounded-xl hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Clear Logs
                    </button>

                    {/* Task Status */}
                    {isRunning && (
                        <div className="ml-auto flex items-center gap-2 text-sm text-slate-600">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Agent is running...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Live Agent Feed (Matrix View) */}
            <div className="bg-black rounded-2xl shadow-lg border border-slate-700 overflow-hidden">
                {/* Terminal Header */}
                <div className="bg-slate-800 px-4 py-2 flex items-center gap-2 border-b border-slate-700">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="ml-2 text-xs text-slate-400 font-mono">
                        automation-agent.log
                    </span>
                </div>

                {/* Terminal Content */}
                <div className="p-4 h-96 overflow-y-auto font-mono text-sm">
                    {logs.length === 0 ? (
                        <div className="text-green-400 opacity-50">
                            {'>'} Waiting for task execution...
                        </div>
                    ) : (
                        logs.map((log, index) => (
                            <div
                                key={index}
                                className={`mb-1 ${log.type === 'error'
                                    ? 'text-red-400'
                                    : log.type === 'success'
                                        ? 'text-green-400'
                                        : log.type === 'system'
                                            ? 'text-cyan-400'
                                            : 'text-green-300'
                                    }`}
                            >
                                <span className="text-slate-500 mr-2">[{log.timestamp}]</span>
                                {log.message}
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
}
