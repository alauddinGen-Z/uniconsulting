/**
 * Electron Preload Script
 * 
 * Exposes a secure API to the renderer process (website).
 * Uses contextBridge for security isolation.
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

    getVersion: () => ipcRenderer.invoke('get-version'),

    // ============================================================================
    // Automation Agent
    // ============================================================================

    /**
     * Run the Python automation agent
     * @param {Object} student - Student profile data
     * @param {string} universityUrl - Optional university URL to navigate to
     */
    runAgent: (student, universityUrl) => {
        return ipcRenderer.invoke('run-agent', { student, universityUrl });
    },

    /**
     * Stop the running agent
     */
    stopAgent: () => {
        return ipcRenderer.invoke('stop-agent');
    },

    /**
     * Listen for agent logs
     * @param {Function} callback - Called with { type: 'stdout'|'stderr', message: string }
     * @returns {Function} Cleanup function to remove listener
     */
    onAgentLog: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('agent-log', handler);
        return () => ipcRenderer.removeListener('agent-log', handler);
    },

    // ============================================================================
    // Auto-Updater
    // ============================================================================

    /**
     * Listen for update availability
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
        ipcRenderer.on('update-progress', handler);
        return () => ipcRenderer.removeListener('update-progress', handler);
    },

    /**
     * Listen for update downloaded
     */
    onUpdateDownloaded: (callback) => {
        const handler = (event, info) => callback(info);
        ipcRenderer.on('update-downloaded', handler);
        return () => ipcRenderer.removeListener('update-downloaded', handler);
    },

    /**
     * Download available update
     */
    downloadUpdate: () => {
        return ipcRenderer.invoke('download-update');
    },

    /**
     * Install downloaded update and restart
     */
    installUpdate: () => {
        return ipcRenderer.invoke('install-update');
    },

    // ============================================================================
    // Utilities
    // ============================================================================

    /**
     * Open URL in default browser
     */
    openExternal: (url) => {
        return ipcRenderer.invoke('open-external', url);
    },
});

console.log('[Preload] UniConsulting Desktop bridge initialized');
