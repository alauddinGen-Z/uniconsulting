/**
 * Electron Main Process - Thin Client Architecture
 * 
 * Loads the remote Netlify web app and provides a secure bridge
 * to the local Python automation engine.
 * 
 * Architecture: Discord-style (remote URL + local sidecar)
 * 
 * @file desktop-app/main.js
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = process.env.ELECTRON_DEV === 'true';

// Remote app URL - loads from Netlify (always latest version)
const APP_URL = process.env.APP_URL || 'https://uniconsulting.netlify.app';

// Keep global references
let mainWindow = null;
let engineProcess = null;

// ============================================================================
// Logging
// ============================================================================

function log(message) {
    console.log(`[Main] ${message}`);
}

// ============================================================================
// Window Management
// ============================================================================

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'UniConsulting',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        show: false,
        backgroundColor: '#0f172a',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            // CRUCIAL SECURITY SETTINGS
            contextIsolation: true,      // Required for security
            nodeIntegration: false,      // Never allow for remote URLs
            sandbox: true,               // Extra isolation
            webSecurity: true,           // Enforce same-origin policy
            allowRunningInsecureContent: false,
        },
    });

    // Load the remote Netlify app
    log(`Loading remote app: ${APP_URL}`);
    mainWindow.loadURL(APP_URL);

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        log('Window ready');
    });

    // Open DevTools in development
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    // Handle external links - open in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        // Allow navigation within our app
        if (url.includes('uniconsulting') || url.includes('supabase')) {
            return { action: 'allow' };
        }
        // Open external links in default browser
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
        killEngine();
    });
}

// ============================================================================
// Python Engine Management
// ============================================================================

function getEnginePath() {
    if (isDev) {
        // Development: run Python script directly
        return {
            command: 'python',
            args: [path.join(__dirname, 'python', 'engine.py')],
        };
    } else {
        // Production: run bundled executable
        const engineExe = process.platform === 'win32' ? 'engine.exe' : 'engine';
        return {
            command: path.join(process.resourcesPath, 'engine', engineExe),
            args: [],
        };
    }
}

function killEngine() {
    if (engineProcess) {
        engineProcess.kill();
        engineProcess = null;
        log('Engine process killed');
    }
}

async function runEngine(studentData) {
    return new Promise((resolve, reject) => {
        if (engineProcess) {
            reject(new Error('Engine is already running'));
            return;
        }

        const { command, args } = getEnginePath();
        log(`Starting engine: ${command}`);

        engineProcess = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                // Pass API key to Python process
                GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '',
            },
        });

        // Send student data via stdin
        engineProcess.stdin.write(JSON.stringify(studentData));
        engineProcess.stdin.end();

        let output = '';
        let errorOutput = '';

        // Stream stdout to renderer
        engineProcess.stdout.on('data', (data) => {
            const message = data.toString().trim();
            output += message + '\n';
            log(`[Engine] ${message}`);

            if (mainWindow) {
                mainWindow.webContents.send('engine-log', {
                    type: 'stdout',
                    message
                });
            }
        });

        // Stream stderr to renderer
        engineProcess.stderr.on('data', (data) => {
            const message = data.toString().trim();
            errorOutput += message + '\n';
            log(`[Engine Error] ${message}`);

            if (mainWindow) {
                mainWindow.webContents.send('engine-log', {
                    type: 'stderr',
                    message
                });
            }
        });

        // Handle process exit
        engineProcess.on('close', (code) => {
            log(`Engine exited with code: ${code}`);
            engineProcess = null;

            if (code === 0) {
                resolve({ success: true, output });
            } else {
                reject(new Error(`Engine failed with code ${code}`));
            }
        });

        engineProcess.on('error', (error) => {
            log(`Engine spawn error: ${error.message}`);
            engineProcess = null;
            reject(error);
        });
    });
}

// ============================================================================
// IPC Handlers - Restricted API for website
// ============================================================================

// Check if running in desktop app
ipcMain.handle('is-desktop', () => true);

// Run the automation engine (ONLY exposed function for automation)
ipcMain.handle('run-agent', async (event, studentData) => {
    try {
        log(`Running engine for: ${studentData?.full_name || 'Unknown'}`);
        const result = await runEngine(studentData);
        return { success: true, ...result };
    } catch (error) {
        log(`Engine error: ${error.message}`);
        return { success: false, error: error.message };
    }
});

// Stop running engine
ipcMain.handle('stop-agent', () => {
    killEngine();
    return { success: true };
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
    killEngine();
});

// Security: Restrict navigation
app.on('web-contents-created', (event, contents) => {
    // Prevent navigation to untrusted URLs
    contents.on('will-navigate', (event, url) => {
        const allowed = ['uniconsulting', 'supabase', 'netlify'];
        const isAllowed = allowed.some(domain => url.includes(domain));

        if (!isAllowed && !url.startsWith('file:')) {
            log(`Blocked navigation to: ${url}`);
            event.preventDefault();
        }
    });
});

log('UniConsulting Desktop (Thin Client) starting...');
