/**
 * Electron Preload Script
 * 
 * Secure bridge between main process and renderer.
 * Exposes authentication and automation APIs.
 * 
 * @file desktop-app/preload.js
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to the website
contextBridge.exposeInMainWorld('electron', {
    // ============================================================================
    // Desktop Detection
    // ============================================================================

    isDesktop: true,

    // ============================================================================
    // Authentication API
    // ============================================================================

    /**
     * Get stored authentication token
     * @returns {Promise<{token: string, email: string}>}
     */
    getAuthToken: () => ipcRenderer.invoke('get-auth-token'),

    /**
     * Open browser for login (deep link flow)
     * After login, browser redirects to uniconsulting://auth?token=XYZ
     */
    loginWithBrowser: () => ipcRenderer.invoke('login-with-browser'),

    /**
     * Clear stored authentication tokens
     */
    logout: () => ipcRenderer.invoke('logout'),

    /**
     * Save auth token for persistent login
     * Call this after successful web login
     * @param {Object} data - { token, refreshToken, email }
     */
    saveAuthToken: (data) => ipcRenderer.invoke('save-auth-token', data),

    /**
     * Navigate to dashboard after login
     */
    navigateToDashboard: () => ipcRenderer.invoke('navigate-to-dashboard'),

    /**
     * Listen for successful authentication from deep link
     * @param {Function} callback - Called with {token, email}
     * @returns {Function} Cleanup function
     */
    onAuthSuccess: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('auth-success', handler);
        return () => ipcRenderer.removeListener('auth-success', handler);
    },

    /**
     * Listen for restored auth from stored token
     * @param {Function} callback - Called with {token, email}
     * @returns {Function} Cleanup function
     */
    onAuthRestored: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('auth-restored', handler);
        return () => ipcRenderer.removeListener('auth-restored', handler);
    },

    // ============================================================================
    // Automation API
    // ============================================================================

    /**
     * Run the Python automation engine
     * @param {Object} studentData - Student profile data
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    runAgent: (studentData) => ipcRenderer.invoke('run-agent', studentData),

    /**
     * Stop the running automation engine
     */
    stopAgent: () => ipcRenderer.invoke('stop-agent'),

    /**
     * Listen for engine log messages
     * @param {Function} callback - Called with {type, message}
     * @returns {Function} Cleanup function
     */
    onAgentLog: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('engine-log', handler);
        return () => ipcRenderer.removeListener('engine-log', handler);
    },

    // ============================================================================
    // Auto-Updater API
    // ============================================================================

    /**
     * Get app version
     */
    getVersion: () => ipcRenderer.invoke('get-version'),

    /**
     * Check for updates manually
     */
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

    /**
     * Download available update
     */
    downloadUpdate: () => ipcRenderer.invoke('download-update'),

    /**
     * Install downloaded update and restart
     */
    installUpdate: () => ipcRenderer.invoke('install-update'),

    /**
     * Listen for update available event
     */
    onUpdateAvailable: (callback) => {
        const handler = (event, info) => callback(info);
        ipcRenderer.on('update-available', handler);
        return () => ipcRenderer.removeListener('update-available', handler);
    },

    /**
     * Listen for download progress
     */
    onUpdateProgress: (callback) => {
        const handler = (event, progress) => callback(progress);
        ipcRenderer.on('download-progress', handler);
        return () => ipcRenderer.removeListener('download-progress', handler);
    },

    /**
     * Listen for update downloaded event
     */
    onUpdateDownloaded: (callback) => {
        const handler = (event, info) => callback(info);
        ipcRenderer.on('update-downloaded', handler);
        return () => ipcRenderer.removeListener('update-downloaded', handler);
    },

    /**
     * Open URL in external browser
     */
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
});

// Also expose as electronAPI for compatibility
contextBridge.exposeInMainWorld('electronAPI', {
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    onAuthSuccess: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('auth-success', handler);
        return () => ipcRenderer.removeListener('auth-success', handler);
    },
});

console.log('[Preload] UniConsulting Desktop bridge initialized');
