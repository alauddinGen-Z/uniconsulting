/**
 * Electron Main Process - Discord-Level UX
 * 
 * Features:
 * - Splash screen with branded animation
 * - Silent auto-update checking
 * - Background main window loading
 * - Seamless splash → main transition
 * - No default menu bar (clean window)
 * - Custom protocol deep linking (uniconsulting://)
 * - Single instance lock
 * - Secure token storage
 * 
 * @file desktop-app/main.js
 */

const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROTOCOL_SCHEME = 'uniconsulting';
const isDev = process.env.ELECTRON_DEV === 'true';
const BASE_URL = isDev
    ? 'http://localhost:3000'
    : 'https://uniconsulting.netlify.app';

const LOGIN_URL = `${BASE_URL}/login`;
const DASHBOARD_URL = `${BASE_URL}/teacher/home`;

// ============================================================================
// Auto-Updater Setup
// ============================================================================

let autoUpdater = null;
try {
    const { autoUpdater: updater } = require('electron-updater');
    autoUpdater = updater;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    log('Auto-updater initialized');
} catch (e) {
    log('electron-updater not available, skipping auto-update');
}

// ============================================================================
// Token Storage (using electron-store)
// ============================================================================

let Store;
let store;

try {
    Store = require('electron-store');
    store = new Store({
        encryptionKey: 'uniconsulting-secure-key-2024',
        schema: {
            authToken: { type: 'string', default: '' },
            refreshToken: { type: 'string', default: '' },
            userEmail: { type: 'string', default: '' },
        }
    });
} catch (e) {
    log('electron-store not available, using in-memory storage');
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

let splashWindow = null;
let mainWindow = null;
let engineProcess = null;
let isMainWindowReady = false;
let updateAvailable = false;

// ============================================================================
// Logging
// ============================================================================

function log(message) {
    console.log(`[Main] ${message}`);
}

// ============================================================================
// Custom Protocol Registration
// ============================================================================

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
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        log('Second instance detected');
        const deepLinkUrl = commandLine.find(arg => arg.startsWith(`${PROTOCOL_SCHEME}://`));
        if (deepLinkUrl) {
            log(`Deep link received: ${deepLinkUrl}`);
            handleDeepLink(deepLinkUrl);
        }
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

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
        if (parsedUrl.hostname === 'auth' || parsedUrl.pathname === '/auth') {
            const token = parsedUrl.searchParams.get('token');
            const refreshToken = parsedUrl.searchParams.get('refresh_token');
            const email = parsedUrl.searchParams.get('email');

            if (token) {
                log('Auth token received from deep link');
                store.set('authToken', token);
                if (refreshToken) store.set('refreshToken', refreshToken);
                if (email) store.set('userEmail', email);

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
// Splash Window (Discord-style)
// ============================================================================

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 400,
        height: 300,
        frame: false,
        transparent: false,
        resizable: false,
        movable: false,
        center: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        backgroundColor: '#0f172a',
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    splashWindow.loadFile(path.join(__dirname, 'splash.html'));

    splashWindow.once('ready-to-show', () => {
        splashWindow.show();
        // Send app version to splash
        splashWindow.webContents.send('app-version', app.getVersion());
    });

    splashWindow.on('closed', () => {
        splashWindow = null;
    });

    return splashWindow;
}

function updateSplashStatus(status, showProgress = false, progress = 0) {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-status', { status, showProgress, progress });
    }
}

// ============================================================================
// Main Window Creation
// ============================================================================

function createMainWindow() {
    Menu.setApplicationMenu(null);

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'UniConsulting',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        show: false, // Hidden until ready
        backgroundColor: '#0f172a',
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

    log(`Loading: ${startUrl} (logged in: ${!!storedToken})`);
    mainWindow.loadURL(startUrl);

    // CRITICAL: When main window is ready, transition from splash
    mainWindow.once('ready-to-show', () => {
        isMainWindowReady = true;
        log('Main window ready');

        // If no update is downloading, show main window immediately
        if (!updateAvailable) {
            transitionToMainWindow();
        }

        // If we have a stored token, notify the renderer
        if (storedToken) {
            log('Restoring stored auth session');
            mainWindow.webContents.send('auth-restored', {
                token: storedToken,
                email: store.get('userEmail')
            });
        }
    });

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

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

function transitionToMainWindow() {
    if (mainWindow && splashWindow) {
        log('Transitioning from splash to main window');
        mainWindow.show();

        // Small delay for smooth visual transition
        setTimeout(() => {
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.close();
            }
        }, 200);
    } else if (mainWindow) {
        mainWindow.show();
    }
}

// ============================================================================
// Auto-Update Flow
// ============================================================================

function setupAutoUpdater() {
    if (!autoUpdater) {
        updateSplashStatus('Loading...');
        createMainWindow();
        return;
    }

    updateSplashStatus('Checking for updates...');

    autoUpdater.on('checking-for-update', () => {
        log('Checking for updates...');
        updateSplashStatus('Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
        log(`Update available: ${info.version}`);
        updateAvailable = true;
        updateSplashStatus('Downloading update...', true, 0);
        autoUpdater.downloadUpdate();
    });

    autoUpdater.on('update-not-available', () => {
        log('No update available');
        updateSplashStatus('Starting...');
        createMainWindow();
    });

    autoUpdater.on('download-progress', (progress) => {
        const percent = Math.round(progress.percent);
        log(`Download progress: ${percent}%`);
        updateSplashStatus(`Downloading update... ${percent}%`, true, percent);
    });

    autoUpdater.on('update-downloaded', () => {
        log('Update downloaded, will install on restart');
        updateSplashStatus('Installing update...');

        // Install and restart
        setTimeout(() => {
            autoUpdater.quitAndInstall(false, true);
        }, 1000);
    });

    autoUpdater.on('error', (error) => {
        log(`Auto-updater error: ${error.message}`);
        updateSplashStatus('Starting...');
        createMainWindow();
    });

    // Start checking for updates
    autoUpdater.checkForUpdates().catch((err) => {
        log(`Update check failed: ${err.message}`);
        updateSplashStatus('Starting...');
        createMainWindow();
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

ipcMain.handle('get-version', () => app.getVersion());

ipcMain.handle('get-auth-token', () => ({
    token: store.get('authToken'),
    email: store.get('userEmail'),
}));

ipcMain.handle('login-with-browser', () => {
    log(`Opening login URL: ${LOGIN_URL}`);
    shell.openExternal(LOGIN_URL);
    return { success: true };
});

ipcMain.handle('save-auth-token', (event, { token, refreshToken, email }) => {
    log(`Saving auth token for: ${email}`);
    store.set('authToken', token);
    if (refreshToken) store.set('refreshToken', refreshToken);
    if (email) store.set('userEmail', email);
    return { success: true };
});

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

// Auto-updater IPC (for manual update checks)
ipcMain.handle('check-for-updates', async () => {
    if (!autoUpdater) return { available: false };
    try {
        const result = await autoUpdater.checkForUpdates();
        return { available: !!result?.updateInfo };
    } catch {
        return { available: false };
    }
});

ipcMain.handle('download-update', async () => {
    if (!autoUpdater) return { success: false };
    try {
        await autoUpdater.downloadUpdate();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('install-update', () => {
    if (autoUpdater) {
        autoUpdater.quitAndInstall(false, true);
    }
});

ipcMain.handle('open-external', async (event, url) => {
    await shell.openExternal(url);
});

// ============================================================================
// App Lifecycle - Discord-Style Startup
// ============================================================================

app.whenReady().then(() => {
    log('UniConsulting Desktop starting...');

    // Step 1: Show splash screen immediately
    createSplashWindow();

    // Step 2: Start auto-update check (this will create main window when done)
    setupAutoUpdater();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createSplashWindow();
            setupAutoUpdater();
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
