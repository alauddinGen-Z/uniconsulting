/**
 * Global Type Definitions
 * 
 * Extends the Window interface to include the Electron desktop bridge API.
 * This allows TypeScript to recognize window.electron when running in the desktop app.
 * 
 * @file src/types/global.d.ts
 */

interface Window {
    electron?: {
        /** Check if running in desktop app */
        isDesktop: boolean;

        /**
         * Run the Python automation engine
         * @param studentData - Student profile data to use for form filling
         * @returns Promise with success status
         */
        runAgent: (studentData: any) => Promise<{ success: boolean; error?: string; result?: string }>;

        /**
         * Stop the running automation engine
         */
        stopAgent: () => Promise<{ success: boolean }>;

        /**
         * Listen for engine log messages
         * @param callback - Called with log data {type: 'stdout'|'stderr', message: string}
         * @returns Cleanup function to remove listener
         */
        onAgentLog: (callback: (data: { type: 'stdout' | 'stderr'; message: string }) => void) => () => void;
    };
}
