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
});

console.log('[Preload] UniConsulting Desktop bridge initialized');
