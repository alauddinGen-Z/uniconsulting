/**
 * Global Type Definitions
 * 
 * Extends the Window interface to include the Electron desktop bridge API.
 * This allows TypeScript to recognize window.electron when running in the desktop app.
 * 
 * IMPORTANT: This is the ONLY place where Window.electron should be declared.
 * Do not duplicate this declaration elsewhere to avoid TypeScript conflicts.
 * 
 * @file src/types/global.d.ts
 */

export interface ElectronAPI {
    /** Check if running in desktop app */
    isDesktop: boolean;

    /**
     * Run the Python automation engine
     * @param studentData - Student profile data to use for form filling
     * @param universityUrl - Optional URL to navigate to
     * @returns Promise with success status
     */
    runAgent: (studentData: any, universityUrl?: string) => Promise<{ success: boolean; error?: string; result?: string }>;

    /**
     * Stop the running automation engine
     */
    stopAgent: () => Promise<{ success: boolean; error?: string }>;

    /**
     * Listen for engine log messages
     * @param callback - Called with log data {type: 'stdout'|'stderr', message: string}
     * @returns Cleanup function to remove listener
     */
    onAgentLog: (callback: (data: { type: 'stdout' | 'stderr'; message: string }) => void) => () => void;

    /**
     * Get the desktop app version
     */
    getVersion: () => Promise<string>;

    // Auto-updater APIs
    onUpdateAvailable: (callback: (info: any) => void) => () => void;
    onUpdateProgress: (callback: (progress: any) => void) => () => void;
    onUpdateDownloaded: (callback: (info: any) => void) => () => void;
    downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
    installUpdate: () => void;

    /**
     * Open external URL in default browser
     */
    openExternal: (url: string) => Promise<void>;

    /**
     * Save auth token for persistent login
     */
    saveAuthToken?: (data: { token: string; refreshToken: string; email?: string }) => void;
}

declare global {
    interface Window {
        electron?: ElectronAPI;
    }
}

// Ensure this file is treated as a module
export { };
