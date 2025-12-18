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

const { app, BrowserWindow, ipcMain, shell, Menu, session, Tray, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROTOCOL_SCHEME = 'uniconsulting';
const isDev = process.env.ELECTRON_DEV === 'true';
const APP_MODE = process.env.APP_MODE || 'teacher'; // 'student' or 'teacher'

// Check if we have bundled frontend (standalone React app)
const hasBundledFrontend = require('fs').existsSync(path.join(__dirname, 'dist-react', 'index.html'));

// URLs for remote mode (fallback)
const BASE_URL = isDev
    ? 'http://localhost:3000'
    : 'https://uniconsulting.netlify.app';

// Local server port for bundled frontend
let LOCAL_SERVER_PORT = 3001;
let localServerUrl = `http://localhost:${LOCAL_SERVER_PORT}`;

// ============================================================================
// Local HTTP Server for Bundled Frontend
// ============================================================================

let localServer = null;

function startLocalServer() {
    if (!hasBundledFrontend || isDev) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const http = require('http');
        const fs = require('fs');
        const url = require('url');

        const frontendPath = path.join(__dirname, 'dist-react');

        // MIME types for static files
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.txt': 'text/plain',
        };

        localServer = http.createServer((req, res) => {
            let pathname = url.parse(req.url).pathname;

            // SPA routing: serve index.html for all non-asset routes
            if (pathname === '/') pathname = '/index.html';
            // Check if it's an asset request (has extension)
            const hasExt = path.extname(pathname) !== '';

            const filePath = path.join(frontendPath, pathname);
            const ext = path.extname(filePath).toLowerCase();
            const contentType = mimeTypes[ext] || 'application/octet-stream';

            fs.readFile(filePath, (err, content) => {
                if (err) {
                    // SPA fallback: if not an asset, serve index.html
                    if (!hasExt || pathname.endsWith('.html')) {
                        const indexPath = path.join(frontendPath, 'index.html');
                        fs.readFile(indexPath, (err2, content2) => {
                            if (err2) {
                                res.writeHead(404);
                                res.end('Not found');
                            } else {
                                res.writeHead(200, { 'Content-Type': 'text/html' });
                                res.end(content2);
                            }
                        });
                    } else {
                        res.writeHead(404);
                        res.end('Not found');
                    }
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content);
                }
            });
        });

        localServer.listen(LOCAL_SERVER_PORT, '127.0.0.1', () => {
            console.log(`[Main] Local server started at ${localServerUrl}`);
            resolve();
        });

        localServer.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                // Port in use, try next port
                LOCAL_SERVER_PORT++;
                localServerUrl = `http://localhost:${LOCAL_SERVER_PORT}`;
                localServer.listen(LOCAL_SERVER_PORT, '127.0.0.1');
            } else {
                console.error('[Main] Local server error:', err);
                reject(err);
            }
        });
    });
}

// Determine start URL based on mode and bundled frontend
function getStartUrl(isLoggedIn) {
    if (hasBundledFrontend && !isDev) {
        // Standalone SPA mode: React Router handles all routing 
        // Always load root, the app will redirect as needed
        return localServerUrl;
    }

    // Online mode: load from remote URL
    if (isLoggedIn) {
        return APP_MODE === 'student'
            ? `${BASE_URL}/student/home`
            : `${BASE_URL}/teacher/home`;
    }
    return `${BASE_URL}/login`;
}

const log = function (message) {
    console.log(`[Main] ${message}`);
};

log(`App Mode: ${APP_MODE}, Bundled Frontend: ${hasBundledFrontend}, Dev: ${isDev}`);

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
        log('Second instance detected - showing existing window');
        const deepLinkUrl = commandLine.find(arg => arg.startsWith(`${PROTOCOL_SCHEME}://`));
        if (deepLinkUrl) {
            log(`Deep link received: ${deepLinkUrl}`);
            handleDeepLink(deepLinkUrl);
        }
        if (mainWindow) {
            mainWindow.show(); // Show hidden window
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
            sandbox: false, // Disabled for external API access (Supabase)
            webSecurity: false, // Allow cross-origin requests to Supabase
        },
    });

    // Check if user is already logged in
    const storedToken = store.get('authToken');
    const startUrl = getStartUrl(!!storedToken);

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

    // Always enable DevTools for debugging (can be disabled later)
    // Press F12 or Ctrl+Shift+I to open
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
            mainWindow.webContents.toggleDevTools();
        }
    });

    // Auto-open DevTools for debugging login issue
    mainWindow.webContents.openDevTools();

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.includes('localhost') || url.includes('uniconsulting') || url.includes('supabase')) {
            return { action: 'allow' };
        }
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Minimize to tray on close (instead of quitting)
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
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
// Auto-Update Flow (with Safety Valve Timeout)
// ============================================================================

const UPDATER_TIMEOUT_MS = 10000; // 10 seconds - Safety valve to prevent infinite hang

function setupAutoUpdater() {
    if (!autoUpdater) {
        log('Auto-updater not available, skipping');
        updateSplashStatus('Loading...');
        createMainWindow();
        return;
    }

    updateSplashStatus('Checking for updates...');
    log('🔄 Starting update check with 10s timeout...');

    // Flag to prevent duplicate createMainWindow calls
    let isResolved = false;
    const resolveOnce = (reason) => {
        if (isResolved) return;
        isResolved = true;
        log(`Update check resolved: ${reason}`);
    };

    // Setup event listeners for update flow
    autoUpdater.on('checking-for-update', () => {
        log('Checking for updates...');
        updateSplashStatus('Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
        resolveOnce('update-found');
        log(`✅ Update available: ${info.version}`);
        updateAvailable = true;
        updateSplashStatus('Downloading update...', true, 0);
        autoUpdater.downloadUpdate();
    });

    autoUpdater.on('update-not-available', () => {
        resolveOnce('no-update');
        log('ℹ️ No update available');
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
        resolveOnce('error');
        log(`⚠️ Auto-updater error (continuing anyway): ${error.message}`);
        updateSplashStatus('Starting...');
        createMainWindow();
    });

    // Promise 1: The actual update check
    const updateCheckPromise = new Promise((resolve) => {
        autoUpdater.once('update-available', () => resolve('update-found'));
        autoUpdater.once('update-not-available', () => resolve('continue'));
        autoUpdater.once('error', () => resolve('continue'));

        // Trigger the check
        autoUpdater.checkForUpdates().catch((err) => {
            log(`Update check failed: ${err.message}`);
            resolve('continue');
        });
    });

    // Promise 2: The Safety Valve (10 second timeout)
    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
            log(`⏰ Updater timed out after ${UPDATER_TIMEOUT_MS}ms. Skipping update check.`);
            resolve('timeout');
        }, UPDATER_TIMEOUT_MS);
    });

    // RACE THEM - whichever resolves first wins
    Promise.race([updateCheckPromise, timeoutPromise]).then((result) => {
        if (result === 'timeout' && !isResolved) {
            resolveOnce('timeout');
            log('Update check timed out - proceeding to app');
            updateSplashStatus('Starting...');
            createMainWindow();
        }
        // If result is 'update-found', the download process handles it
        // If result is 'continue', the event handler already called createMainWindow
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
// Browser-Use Automation Service Management
// ============================================================================

let automationServiceProcess = null;
const AUTOMATION_SERVICE_PORT = 8765;
let chromiumInstalled = false;

/**
 * Check if Playwright Chromium is installed on the system
 * Playwright stores browsers in a cache directory
 */
function isPlaywrightChromiumInstalled() {
    const fs = require('fs');
    const os = require('os');

    // Playwright default browser cache locations
    const cacheLocations = [
        path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'),
        path.join(os.homedir(), '.cache', 'ms-playwright'),
    ];

    for (const loc of cacheLocations) {
        if (fs.existsSync(loc)) {
            const files = fs.readdirSync(loc);
            if (files.some(f => f.includes('chromium'))) {
                log(`Playwright Chromium found at: ${loc}`);
                return true;
            }
        }
    }
    return false;
}

/**
 * Download Playwright Chromium browser
 * Shows progress dialog to user
 */
async function ensurePlaywrightChromium() {
    if (chromiumInstalled || isPlaywrightChromiumInstalled()) {
        chromiumInstalled = true;
        return true;
    }

    log('Playwright Chromium not found - downloading...');

    // Show download dialog
    const { dialog } = require('electron');

    // Get the playwright command path from the bundled automation
    const fs = require('fs');
    const playwrightCmd = path.join(process.resourcesPath, 'automation', '_internal', 'playwright', 'driver', 'playwright.cmd');

    if (!fs.existsSync(playwrightCmd)) {
        log('Playwright driver not found in bundle');
        return false;
    }

    // Show a progress notification
    if (mainWindow) {
        mainWindow.webContents.send('automation-status', {
            type: 'downloading',
            message: 'Downloading browser for automation (first-time setup)...'
        });
    }

    return new Promise((resolve) => {
        log(`Running: ${playwrightCmd} install chromium`);

        const installProcess = spawn('cmd.exe', ['/c', playwrightCmd, 'install', 'chromium'], {
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        installProcess.stdout.on('data', (data) => {
            log(`[Playwright]: ${data.toString().trim()}`);
        });

        installProcess.stderr.on('data', (data) => {
            log(`[Playwright]: ${data.toString().trim()}`);
        });

        installProcess.on('close', (code) => {
            if (code === 0) {
                log('Playwright Chromium installed successfully');
                chromiumInstalled = true;
                if (mainWindow) {
                    mainWindow.webContents.send('automation-status', {
                        type: 'ready',
                        message: 'Browser downloaded! Automation ready.'
                    });
                }
                resolve(true);
            } else {
                log(`Playwright install failed with code ${code}`);
                if (mainWindow) {
                    mainWindow.webContents.send('automation-status', {
                        type: 'error',
                        message: 'Failed to download browser. Check internet connection.'
                    });
                }
                resolve(false);
            }
        });

        installProcess.on('error', (err) => {
            log(`Playwright install error: ${err.message}`);
            resolve(false);
        });
    });
}

/**
 * Get the path to the automation service
 * In production: uses compiled automation.exe from PyInstaller
 * In development: uses Python script directly
 */
function getAutomationServiceCommand() {
    const fs = require('fs');


    if (isDev) {
        // Development: use Python script with venv
        const venvPython = path.join(__dirname, 'automation-service', 'venv', 'Scripts', 'python.exe');
        const mainPy = path.join(__dirname, 'automation-service', 'main.py');

        if (fs.existsSync(venvPython)) {
            return { command: venvPython, args: [mainPy], cwd: path.join(__dirname, 'automation-service') };
        }
        // Fallback to system Python
        return { command: 'python', args: [mainPy], cwd: path.join(__dirname, 'automation-service') };
    } else {
        // Production: use compiled PyInstaller executable
        const automationExe = path.join(process.resourcesPath, 'automation', 'automation.exe');
        const automationDir = path.join(process.resourcesPath, 'automation');

        if (fs.existsSync(automationExe)) {
            log(`Found automation exe at: ${automationExe}`);
            return { command: automationExe, args: [], cwd: automationDir };
        }

        log('WARNING: Compiled automation.exe not found');
        return null;
    }
}

async function startAutomationService() {
    if (automationServiceProcess) {
        log('Automation service already running');
        return true;
    }

    // Ensure Playwright Chromium is installed (downloads on first run)
    if (!isDev) {
        const chromiumReady = await ensurePlaywrightChromium();
        if (!chromiumReady) {
            log('WARNING: Playwright Chromium not available - automation may fail');
        }
    }

    const serviceCmd = getAutomationServiceCommand();

    if (!serviceCmd) {
        log('Automation service not available - skipping');
        return false;
    }

    log(`Starting automation service at port ${AUTOMATION_SERVICE_PORT}...`);
    log(`Command: ${serviceCmd.command} ${serviceCmd.args.join(' ')}`);

    try {
        automationServiceProcess = spawn(serviceCmd.command, serviceCmd.args, {
            cwd: serviceCmd.cwd,
            env: {
                ...process.env,
                PYTHONUNBUFFERED: '1',
                PYTHONDONTWRITEBYTECODE: '1', // Prevent stale bytecode cache issues
            },
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        automationServiceProcess.stdout.on('data', (data) => {
            log(`[AutoService]: ${data.toString().trim()}`);
        });

        automationServiceProcess.stderr.on('data', (data) => {
            log(`[AutoService Error]: ${data.toString().trim()}`);
        });

        automationServiceProcess.on('close', (code) => {
            log(`Automation service exited with code ${code}`);
            automationServiceProcess = null;
        });

        automationServiceProcess.on('error', (err) => {
            log(`Automation service error: ${err.message}`);
            automationServiceProcess = null;
        });

        // Wait a moment for the service to start
        await new Promise(resolve => setTimeout(resolve, 3000));

        log('Automation service started successfully');
        return true;
    } catch (err) {
        log(`Failed to start automation service: ${err.message}`);
        return false;
    }
}

function stopAutomationService() {
    if (automationServiceProcess) {
        log('Stopping automation service...');
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', automationServiceProcess.pid, '/f', '/t']);
        } else {
            automationServiceProcess.kill('SIGTERM');
        }
        automationServiceProcess = null;
    }
}


// ============================================================================
// IPC Handlers
// ============================================================================

ipcMain.handle('is-desktop', () => true);

ipcMain.handle('get-version', () => app.getVersion());

ipcMain.handle('get-auth-token', () => ({
    token: store.get('authToken'),
    refreshToken: store.get('refreshToken'),
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

// System tray for "Show hidden icons"
let tray = null;

app.whenReady().then(async () => {
    log('UniConsulting Desktop starting...');

    // Enable CORS bypass for Supabase API
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        callback({ requestHeaders: { ...details.requestHeaders } });
    });
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Access-Control-Allow-Origin': ['*'],
                'Access-Control-Allow-Headers': ['*'],
                'Access-Control-Allow-Methods': ['*']
            }
        });
    });
    log('CORS bypass enabled for API requests');

    // Create system tray icon (appears in "Show hidden icons")
    try {
        const fs = require('fs');
        // Try multiple paths for the icon
        const iconPaths = [
            path.join(__dirname, 'assets', 'icon.ico'),
            path.join(__dirname, 'assets', 'icons', 'win', 'icon.ico'),
            path.join(__dirname, 'assets', 'icon.png'),
        ];

        let trayIcon = null;
        for (const iconPath of iconPaths) {
            if (fs.existsSync(iconPath)) {
                log(`Loading tray icon from: ${iconPath}`);
                trayIcon = nativeImage.createFromPath(iconPath);
                if (!trayIcon.isEmpty()) break;
            }
        }

        if (!trayIcon || trayIcon.isEmpty()) {
            log('No tray icon found, using default app icon');
            // Try to use the app exe icon as fallback
            trayIcon = app.getFileIcon ? app.getFileIcon(process.execPath) : null;
        }

        if (trayIcon && !trayIcon.isEmpty()) {
            tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
            tray.setToolTip('UniConsulting - Click to show');
            const trayMenu = Menu.buildFromTemplate([
                {
                    label: 'Show UniConsulting',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.show();
                            mainWindow.focus();
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    click: () => {
                        app.isQuitting = true;
                        app.quit();
                    }
                }
            ]);
            tray.setContextMenu(trayMenu);
            tray.on('click', () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            });
            tray.on('double-click', () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            });
            log('System tray icon created successfully');
        } else {
            log('Warning: Could not create tray icon - no valid icon found');
        }
    } catch (err) {
        console.error('[Main] Failed to create tray icon:', err);
    }

    // Step 0: Start local HTTP server for bundled frontend (before anything else)
    try {
        await startLocalServer();
        log(`Local server ready at ${localServerUrl}`);
    } catch (err) {
        log('Local server failed, falling back to remote URL');
    }

    // Step 0.5: Start automation service (browser-use) - ONLY FOR TEACHER MODE
    if (APP_MODE === 'teacher') {
        try {
            log('Starting automation service for teacher mode...');
            await startAutomationService();
            log('Automation service started automatically');
        } catch (err) {
            log('Automation service failed to start: ' + err.message);
        }
    } else {
        log('Skipping automation service for student mode');
    }

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
    log('Before quit - stopping services...');
    killEngine();
    stopAutomationService();
});

// Additional cleanup on will-quit (ensures zombie processes are killed)
app.on('will-quit', (event) => {
    log('Will quit - final cleanup...');
    if (automationServiceProcess) {
        log('Killing automation service process...');
        stopAutomationService();
    }
    if (engineProcess) {
        log('Killing engine process...');
        killEngine();
    }
});

// Handle deep link from app startup (Windows)
const deepLinkArg = process.argv.find(arg => arg.startsWith(`${PROTOCOL_SCHEME}://`));
if (deepLinkArg) {
    log(`Deep link from startup: ${deepLinkArg}`);
    app.whenReady().then(() => handleDeepLink(deepLinkArg));
}
