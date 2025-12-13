/**
 * Electron Preload Script - Secure Bridge
 * 
 * Exposes a RESTRICTED API to the remote website.
 * Only runAgent and log streaming are exposed.
 * 
 * SECURITY: This is the ONLY way the website can interact
 * with the local filesystem/Python engine.
 * 
 * @file desktop-app/preload.js
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose RESTRICTED API to the website
contextBridge.exposeInMainWorld('electron', {
    // ============================================================================
    // Desktop Detection
    // ============================================================================

    /**
     * Check if running in desktop app
     */
    isDesktop: true,

    // ============================================================================
    // Automation Engine API
    // ============================================================================

    /**
     * Run the Python automation engine
     * This is the ONLY way the website can trigger local automation
     * 
     * @param {Object} studentData - Student profile data
     * @returns {Promise<{success: boolean, error?: string, output?: string}>}
     */
    runAgent: (studentData) => {
        console.log('[Preload] runAgent called for:', studentData?.full_name);
        return ipcRenderer.invoke('run-agent', studentData);
    },

    /**
     * Stop the running engine
     * @returns {Promise<{success: boolean}>}
     */
    stopAgent: () => {
        console.log('[Preload] stopAgent called');
        return ipcRenderer.invoke('stop-agent');
    },

    /**
     * Listen for engine log messages
     * Streams stdout/stderr from Python engine to the UI
     * 
     * @param {Function} callback - Called with {type: 'stdout'|'stderr', message: string}
     * @returns {Function} Cleanup function to remove listener
     */
    onAgentLog: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('engine-log', handler);

        // Return cleanup function
        return () => {
            ipcRenderer.removeListener('engine-log', handler);
        };
    },
});

console.log('[Preload] UniConsulting Desktop bridge initialized (Thin Client)');
