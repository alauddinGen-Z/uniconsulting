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
// Browser-Use Automation Service Management
// ============================================================================

let automationServiceProcess = null;
const AUTOMATION_SERVICE_PORT = 8765;

function getAutomationServicePath() {
    if (isDev) {
        return path.join(__dirname, 'automation-service');
    } else {
        return path.join(process.resourcesPath, 'automation-service');
    }
}

function getPythonPath() {
    if (isDev) {
        // In development, use system Python
        return 'python';
    } else {
        // In production, use bundled Python
        const bundledPython = path.join(process.resourcesPath, 'python-embedded', 'python.exe');
        const fs = require('fs');
        if (fs.existsSync(bundledPython)) {
            return bundledPython;
        }
        // Fallback to system Python if bundled not found
        return 'python';
    }
}

async function checkAutomationServiceInstalled() {
    const servicePath = getAutomationServicePath();
    const venvPath = path.join(servicePath, 'venv');
    const fs = require('fs');
    return fs.existsSync(venvPath);
}

async function installAutomationDependencies() {
    const servicePath = getAutomationServicePath();
    const pythonPath = getPythonPath();
    const fs = require('fs');

    log('Installing automation service dependencies...');

    // Update splash to show install progress
    updateSplashStatus('Installing automation engine...', true, 30);

    return new Promise((resolve, reject) => {
        const venvPath = path.join(servicePath, 'venv');

        // Create venv
        const createVenv = spawn(pythonPath, ['-m', 'venv', venvPath], { cwd: servicePath });

        createVenv.on('close', (code) => {
            if (code !== 0) {
                log('Failed to create venv');
                resolve(false);
                return;
            }

            updateSplashStatus('Installing dependencies...', true, 50);

            // Install requirements
            const pipPath = process.platform === 'win32'
                ? path.join(venvPath, 'Scripts', 'pip.exe')
                : path.join(venvPath, 'bin', 'pip');

            const requirementsPath = path.join(servicePath, 'requirements.txt');

            if (!fs.existsSync(requirementsPath)) {
                log('requirements.txt not found');
                resolve(false);
                return;
            }

            const installDeps = spawn(pipPath, ['install', '-r', requirementsPath], { cwd: servicePath });

            installDeps.stdout.on('data', (data) => {
                log(`[pip]: ${data.toString().trim()}`);
            });

            installDeps.stderr.on('data', (data) => {
                log(`[pip error]: ${data.toString().trim()}`);
            });

            installDeps.on('close', (code) => {
                if (code === 0) {
                    log('Dependencies installed successfully');
                    updateSplashStatus('Automation ready!', true, 100);
                    resolve(true);
                } else {
                    log('Failed to install dependencies');
                    resolve(false);
                }
            });
        });
    });
}

async function startAutomationService() {
    if (automationServiceProcess) {
        log('Automation service already running');
        return true;
    }

    const servicePath = getAutomationServicePath();
    const fs = require('fs');

    // Check if service files exist
    const mainPyPath = path.join(servicePath, 'main.py');
    if (!fs.existsSync(mainPyPath)) {
        log('Automation service main.py not found - skipping');
        return false;
    }

    // Check if dependencies are installed
    const isInstalled = await checkAutomationServiceInstalled();
    if (!isInstalled) {
        const installed = await installAutomationDependencies();
        if (!installed) {
            log('Failed to install automation dependencies');
            return false;
        }
    }

    const venvPath = path.join(servicePath, 'venv');
    const pythonExe = process.platform === 'win32'
        ? path.join(venvPath, 'Scripts', 'python.exe')
        : path.join(venvPath, 'bin', 'python');

    log(`Starting automation service at port ${AUTOMATION_SERVICE_PORT}...`);

    automationServiceProcess = spawn(pythonExe, [mainPyPath], {
        cwd: servicePath,
        env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
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
    await new Promise(resolve => setTimeout(resolve, 2000));

    log('Automation service started');
    return true;
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

    // Step 0.5: Start automation service (browser-use)
    try {
        await startAutomationService();
    } catch (err) {
        log('Automation service failed to start: ' + err.message);
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
    killEngine();
    stopAutomationService();
});

// Handle deep link from app startup (Windows)
const deepLinkArg = process.argv.find(arg => arg.startsWith(`${PROTOCOL_SCHEME}://`));
if (deepLinkArg) {
    log(`Deep link from startup: ${deepLinkArg}`);
    app.whenReady().then(() => handleDeepLink(deepLinkArg));
}
