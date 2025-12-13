/**
 * Electron Main Process - Production-Ready Boilerplate
 * 
 * Features:
 * - No default menu bar (clean window)
 * - Custom protocol deep linking (myapp://)
 * - Single instance lock
 * - Browser-based authentication flow
 * - Secure token storage
 * 
 * @file desktop-app/main.js
 */

const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// ============================================================================
// CONFIGURATION - Customize these values
// ============================================================================

// Custom protocol scheme (e.g., myapp://, uniconsulting://)
const PROTOCOL_SCHEME = 'uniconsulting';

// Your web app URLs
const isDev = process.env.ELECTRON_DEV === 'true';
const BASE_URL = isDev
    ? 'http://localhost:3000'
    : 'https://uniconsulting.netlify.app';

// Different pages
const LOGIN_URL = `${BASE_URL}/login`;
const DASHBOARD_URL = `${BASE_URL}/student-dashboard`;

// ============================================================================
// Token Storage (using electron-store)
// ============================================================================

let Store;
let store;

try {
    Store = require('electron-store');
    store = new Store({
        encryptionKey: 'uniconsulting-secure-key-2024', // Change this!
        schema: {
            authToken: { type: 'string', default: '' },
            refreshToken: { type: 'string', default: '' },
            userEmail: { type: 'string', default: '' },
        }
    });
} catch (e) {
    console.log('[Main] electron-store not available, using in-memory storage');
    // Fallback to in-memory storage if electron-store is not installed
    store = {
        _data: {},
        get: (key) => store._data[key] || '',
        set: (key, value) => { store._data[key] = value; },
        delete: (key) => { delete store._data[key]; },
    };
}

// ============================================================================
// Global References
// ============================================================================

let mainWindow = null;
let engineProcess = null;

// ============================================================================
// Logging
// ============================================================================

function log(message) {
    console.log(`[Main] ${message}`);
}

// ============================================================================
// Custom Protocol Registration
// ============================================================================

// Register the protocol scheme with Windows
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
}

log(`Registered protocol: ${PROTOCOL_SCHEME}://`);

// ============================================================================
// Single Instance Lock
// ============================================================================

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    log('Another instance is already running. Exiting...');
    app.quit();
} else {
    // Handle second instance (Windows/Linux)
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        log('Second instance detected');

        // Find the deep link URL in command line args
        const deepLinkUrl = commandLine.find(arg => arg.startsWith(`${PROTOCOL_SCHEME}://`));

        if (deepLinkUrl) {
            log(`Deep link received: ${deepLinkUrl}`);
            handleDeepLink(deepLinkUrl);
        }

        // Focus the existing window
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// Handle open-url event (macOS)
app.on('open-url', (event, url) => {
    event.preventDefault();
    log(`open-url received: ${url}`);
    handleDeepLink(url);
});

// ============================================================================
// Deep Link Handler
// ============================================================================

function handleDeepLink(url) {
    try {
        const parsedUrl = new URL(url);

        // Handle auth callback: uniconsulting://auth?token=XYZ
        if (parsedUrl.hostname === 'auth' || parsedUrl.pathname === '/auth') {
            const token = parsedUrl.searchParams.get('token');
            const refreshToken = parsedUrl.searchParams.get('refresh_token');
            const email = parsedUrl.searchParams.get('email');

            if (token) {
                log('Auth token received from deep link');

                // Store the tokens
                store.set('authToken', token);
                if (refreshToken) store.set('refreshToken', refreshToken);
                if (email) store.set('userEmail', email);

                // Notify the renderer
                if (mainWindow) {
                    mainWindow.webContents.send('auth-success', { token, email });
                    mainWindow.focus();
                }
            }
        }
    } catch (error) {
        log(`Error parsing deep link: ${error.message}`);
    }
}

// ============================================================================
// Window Creation
// ============================================================================

function createWindow() {
    // CRUCIAL: Remove the default menu bar
    Menu.setApplicationMenu(null);

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'UniConsulting',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        show: false,
        backgroundColor: '#0f172a',
        // Hide menu bar (alternative method)
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: !isDev,
        },
    });

    // Check if user is already logged in
    const storedToken = store.get('authToken');
    const startUrl = storedToken ? DASHBOARD_URL : LOGIN_URL;

    // Load the appropriate page
    log(`Loading: ${startUrl} (logged in: ${!!storedToken})`);
    mainWindow.loadURL(startUrl);

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();

        // If we have a stored token, notify the renderer
        if (storedToken) {
            log('Restoring stored auth session');
            mainWindow.webContents.send('auth-restored', {
                token: storedToken,
                email: store.get('userEmail')
            });
        }
    });

    // Open DevTools in development
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.includes('localhost') || url.includes('uniconsulting') || url.includes('supabase')) {
            return { action: 'allow' };
        }
        shell.openExternal(url);
        return { action: 'deny' };
    });

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
        return {
            command: 'python',
            args: [path.join(__dirname, 'python', 'engine.py')],
        };
    } else {
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
        log('Engine killed');
    }
}

async function runEngine(studentData) {
    return new Promise((resolve, reject) => {
        if (engineProcess) {
            reject(new Error('Engine already running'));
            return;
        }

        const { command, args } = getEnginePath();
        log(`Starting engine: ${command}`);

        engineProcess = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '',
            },
        });

        engineProcess.stdin.write(JSON.stringify(studentData));
        engineProcess.stdin.end();

        let output = '';

        engineProcess.stdout.on('data', (data) => {
            const msg = data.toString().trim();
            output += msg + '\n';
            if (mainWindow) {
                mainWindow.webContents.send('engine-log', { type: 'stdout', message: msg });
            }
        });

        engineProcess.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (mainWindow) {
                mainWindow.webContents.send('engine-log', { type: 'stderr', message: msg });
            }
        });

        engineProcess.on('close', (code) => {
            engineProcess = null;
            if (code === 0) {
                resolve({ success: true, output });
            } else {
                reject(new Error(`Engine failed with code ${code}`));
            }
        });

        engineProcess.on('error', (error) => {
            engineProcess = null;
            reject(error);
        });
    });
}

// ============================================================================
// IPC Handlers
// ============================================================================

ipcMain.handle('is-desktop', () => true);

ipcMain.handle('get-auth-token', () => ({
    token: store.get('authToken'),
    email: store.get('userEmail'),
}));

ipcMain.handle('login-with-browser', () => {
    log(`Opening login URL: ${LOGIN_URL}`);
    shell.openExternal(LOGIN_URL);
    return { success: true };
});

// Save auth token from web app (called after successful login)
ipcMain.handle('save-auth-token', (event, { token, refreshToken, email }) => {
    log(`Saving auth token for: ${email}`);
    store.set('authToken', token);
    if (refreshToken) store.set('refreshToken', refreshToken);
    if (email) store.set('userEmail', email);
    return { success: true };
});

// Navigate to dashboard after login
ipcMain.handle('navigate-to-dashboard', () => {
    log('Navigating to dashboard');
    if (mainWindow) {
        mainWindow.loadURL(DASHBOARD_URL);
    }
    return { success: true };
});

ipcMain.handle('logout', () => {
    store.delete('authToken');
    store.delete('refreshToken');
    store.delete('userEmail');
    log('User logged out');
    return { success: true };
});

ipcMain.handle('run-agent', async (event, studentData) => {
    try {
        const result = await runEngine(studentData);
        return { success: true, ...result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

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

// Handle deep link from app startup (Windows)
const deepLinkArg = process.argv.find(arg => arg.startsWith(`${PROTOCOL_SCHEME}://`));
if (deepLinkArg) {
    log(`Deep link from startup: ${deepLinkArg}`);
    app.whenReady().then(() => handleDeepLink(deepLinkArg));
}

log('UniConsulting Desktop starting...');
