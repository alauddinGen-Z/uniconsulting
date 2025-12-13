/**
 * Electron Main Process
 * 
 * Standalone desktop app that loads the Next.js static export locally
 * and provides Python automation via IPC.
 * 
 * Architecture: Discord-style (bundled frontend + sidecar process)
 * 
 * @file desktop-app/main.js
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');
const isDev = process.env.ELECTRON_DEV === 'true';

// Keep a global reference to prevent garbage collection
let mainWindow = null;
let agentProcess = null;

// ============================================================================
// Auto-Updater Configuration
// ============================================================================

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('checking-for-update', () => {
    log('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
    log(`Update available: ${info.version}`);
    // Notify renderer about available update
    if (mainWindow) {
        mainWindow.webContents.send('update-available', info);
    }
});

autoUpdater.on('update-not-available', () => {
    log('App is up to date');
});

autoUpdater.on('download-progress', (progress) => {
    log(`Download progress: ${Math.round(progress.percent)}%`);
    if (mainWindow) {
        mainWindow.webContents.send('update-progress', progress);
    }
});

autoUpdater.on('update-downloaded', (info) => {
    log('Update downloaded, will install on quit');
    if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', info);
    }
});

autoUpdater.on('error', (error) => {
    log(`Auto-updater error: ${error.message}`);
});

// ============================================================================
// Logging
// ============================================================================

function log(message) {
    console.log(`[Main] ${message}`);
}

// ============================================================================
// Window Management
// ============================================================================

function getAppPath() {
    if (isDev) {
        // In development, load from the parent's out folder (after next build)
        return path.join(__dirname, '..', 'out', 'index.html');
    } else {
        // In production, load from extraResources
        return path.join(process.resourcesPath, 'app', 'index.html');
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'UniConsulting',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        show: false,
        backgroundColor: '#0f172a', // Match app's dark theme
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: !isDev, // Disable in dev for local file loading
        },
    });

    // Load the app
    const appPath = getAppPath();
    log(`Loading app from: ${appPath}`);

    mainWindow.loadFile(appPath).catch((error) => {
        log(`Failed to load app: ${error.message}`);
        // Fallback to remote URL if local file fails
        log('Falling back to remote URL...');
        mainWindow.loadURL('https://uniconsulting.netlify.app');
    });

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();

        // Check for updates after window is shown (not in dev mode)
        if (!isDev) {
            autoUpdater.checkForUpdates().catch((error) => {
                log(`Update check failed: ${error.message}`);
            });
        }
    });

    // Open DevTools in development
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
        killAgent();
    });
}

// ============================================================================
// Python Agent Management
// ============================================================================

function getAgentPath() {
    if (isDev) {
        return {
            command: 'python',
            args: [path.join(__dirname, 'python', 'agent.py')],
        };
    } else {
        const agentExe = process.platform === 'win32' ? 'agent.exe' : 'agent';
        return {
            command: path.join(process.resourcesPath, 'agent', agentExe),
            args: [],
        };
    }
}

function killAgent() {
    if (agentProcess) {
        agentProcess.kill();
        agentProcess = null;
        log('Agent process killed');
    }
}

async function runAgent(studentProfile, universityUrl) {
    return new Promise((resolve, reject) => {
        if (agentProcess) {
            reject(new Error('Agent is already running'));
            return;
        }

        const { command, args } = getAgentPath();
        log(`Starting agent: ${command}`);

        agentProcess = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '',
            },
        });

        // Send input data
        const inputData = JSON.stringify({
            student: studentProfile,
            url: universityUrl
        });
        agentProcess.stdin.write(inputData);
        agentProcess.stdin.end();

        let output = '';
        let errorOutput = '';

        agentProcess.stdout.on('data', (data) => {
            const message = data.toString();
            output += message;
            log(`[Agent] ${message.trim()}`);

            if (mainWindow) {
                mainWindow.webContents.send('agent-log', {
                    type: 'stdout',
                    message: message.trim()
                });
            }
        });

        agentProcess.stderr.on('data', (data) => {
            const message = data.toString();
            errorOutput += message;
            log(`[Agent Error] ${message.trim()}`);

            if (mainWindow) {
                mainWindow.webContents.send('agent-log', {
                    type: 'stderr',
                    message: message.trim()
                });
            }
        });

        agentProcess.on('close', (code) => {
            log(`Agent exited with code: ${code}`);
            agentProcess = null;

            if (code === 0) {
                resolve({ success: true, output });
            } else {
                reject(new Error(`Agent failed with code ${code}: ${errorOutput}`));
            }
        });

        agentProcess.on('error', (error) => {
            log(`Agent spawn error: ${error.message}`);
            agentProcess = null;
            reject(error);
        });
    });
}

// ============================================================================
// IPC Handlers
// ============================================================================

// Check if running in desktop app
ipcMain.handle('is-desktop', () => true);

// Get app version
ipcMain.handle('get-version', () => app.getVersion());

// Run automation agent
ipcMain.handle('run-agent', async (event, { student, universityUrl }) => {
    try {
        log(`Running agent for student: ${student?.full_name}`);
        const result = await runAgent(student, universityUrl);
        return { success: true, ...result };
    } catch (error) {
        log(`Agent error: ${error.message}`);
        return { success: false, error: error.message };
    }
});

// Stop running agent
ipcMain.handle('stop-agent', () => {
    killAgent();
    return { success: true };
});

// Download and install update
ipcMain.handle('download-update', async () => {
    try {
        await autoUpdater.downloadUpdate();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Install update and restart
ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
});

// Open external URL
ipcMain.handle('open-external', (event, url) => {
    shell.openExternal(url);
});

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    killAgent();
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.protocol !== 'file:') {
            // Allow navigation to our web app
            if (!navigationUrl.includes('uniconsulting')) {
                event.preventDefault();
                shell.openExternal(navigationUrl);
            }
        }
    });
});

log('UniConsulting Desktop starting...');
