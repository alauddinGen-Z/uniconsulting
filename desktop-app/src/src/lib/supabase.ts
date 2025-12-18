/**
 * Supabase Client for Desktop App
 * 
 * CRITICAL FIX: Session Persistence via IPC Storage Adapter
 * 
 * Problem: localStorage is ephemeral in Electron - cleared on app exit
 * Solution: Custom storage adapter that uses IPC to persist to main process
 *           via electron-store (encrypted file storage in AppData)
 * 
 * NOTE: We can't use Node.js 'fs' module directly in renderer due to 
 *       context isolation. Instead, we use IPC through preload.js.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration - SAME AS WEB APP PRODUCTION
const supabaseUrl = 'https://ylwyuogdfwugjexyhtrq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlsd3l1b2dkZnd1Z2pleHlodHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NjExODEsImV4cCI6MjA4MDAzNzE4MX0.clEe8v_lzTXJrOQJsAUn18CCHx3JRHCcBficHqwP-1g';

// Type for electron IPC bridge
declare global {
    interface Window {
        electron?: {
            isDesktop: boolean;
            getAuthToken: () => Promise<{ token: string; refreshToken?: string; email: string }>;
            saveAuthToken: (data: { token: string; refreshToken?: string; email?: string }) => Promise<{ success: boolean }>;
            logout: () => Promise<{ success: boolean }>;
        };
    }
}

/**
 * IPC-Based Storage Adapter for Electron
 * 
 * Uses electron-store (encrypted) via IPC bridge instead of localStorage.
 * Falls back to localStorage for web/non-Electron environments.
 */
class ElectronIPCStorage {
    private memoryCache: Record<string, string> = {};
    private isElectron: boolean;

    constructor() {
        this.isElectron = typeof window !== 'undefined' && !!window.electron?.isDesktop;
        console.log('[ElectronIPCStorage] Initialized, isElectron:', this.isElectron);

        // Pre-load from IPC on init (async, non-blocking)
        if (this.isElectron) {
            this.syncFromIPC();
        }
    }

    /**
     * Sync session from IPC storage on app start
     */
    private async syncFromIPC(): Promise<void> {
        try {
            const stored = await window.electron!.getAuthToken();
            if (stored?.token) {
                // Reconstruct Supabase session format
                const sessionData = {
                    access_token: stored.token,
                    refresh_token: stored.refreshToken || '',
                    user: { email: stored.email }
                };
                this.memoryCache['sb-auth-token'] = JSON.stringify(sessionData);
                console.log('[ElectronIPCStorage] Restored session from IPC for:', stored.email);
            }
        } catch (error) {
            console.warn('[ElectronIPCStorage] Failed to sync from IPC:', error);
        }
    }

    async getItem(key: string): Promise<string | null> {
        // First check memory cache
        if (this.memoryCache[key]) {
            return this.memoryCache[key];
        }

        // Fallback to localStorage for non-auth keys or web environment
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem(key);
        }

        return null;
    }

    async setItem(key: string, value: string): Promise<void> {
        // Always update memory cache
        this.memoryCache[key] = value;

        // Persist to localStorage as fallback
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                window.localStorage.setItem(key, value);
            } catch (e) {
                console.warn('[ElectronIPCStorage] localStorage setItem failed:', e);
            }
        }

        // For auth token, also persist via IPC to main process (encrypted storage)
        if (this.isElectron && key.includes('auth-token')) {
            try {
                const parsed = JSON.parse(value);
                await window.electron!.saveAuthToken({
                    token: parsed.access_token || parsed.token,
                    refreshToken: parsed.refresh_token,
                    email: parsed.user?.email || ''
                });
                console.log('[ElectronIPCStorage] Session persisted to IPC storage');
            } catch (error) {
                console.error('[ElectronIPCStorage] Failed to persist to IPC:', error);
            }
        }
    }

    async removeItem(key: string): Promise<void> {
        delete this.memoryCache[key];

        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(key);
        }

        // Clear IPC storage for auth token
        if (this.isElectron && key.includes('auth-token')) {
            try {
                await window.electron!.logout();
                console.log('[ElectronIPCStorage] Session cleared from IPC storage');
            } catch (error) {
                console.error('[ElectronIPCStorage] Failed to clear IPC storage:', error);
            }
        }
    }
}

// Create storage adapter instance
const electronStorage = new ElectronIPCStorage();

// Initialize Supabase client with custom storage
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: electronStorage,
        storageKey: 'sb-auth-token',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // Disable for Desktop to prevent deep link conflicts
    }
});

console.log('[Supabase] Client initialized with ElectronIPCStorage adapter');

/**
 * CRITICAL: Restore session from IPC storage on app start
 * This function should be called when the app mounts to ensure
 * the session is restored from persistent storage
 */
export async function restoreSessionFromIPC(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.electron?.isDesktop) {
        console.log('[Supabase] Not in Electron, skipping IPC restore');
        return false;
    }

    try {
        // Timeout to prevent hanging
        const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('IPC timeout')), 3000)
        );

        const tokenPromise = window.electron.getAuthToken();
        const stored = await Promise.race([tokenPromise, timeoutPromise]);

        if (stored?.token && stored?.refreshToken) {
            console.log('[Supabase] Restoring session from IPC for:', stored.email);

            // Try to set session with stored tokens
            const { error } = await supabase.auth.setSession({
                access_token: stored.token,
                refresh_token: stored.refreshToken
            });

            if (error) {
                console.error('[Supabase] Failed to restore session:', error.message);

                // If token is expired/invalid, try to refresh using refresh token
                if (error.message.includes('expired') || error.message.includes('invalid')) {
                    console.log('[Supabase] Token expired, attempting refresh...');

                    const { error: refreshError } = await supabase.auth.refreshSession({
                        refresh_token: stored.refreshToken
                    });

                    if (refreshError) {
                        console.error('[Supabase] Refresh failed, clearing stored session:', refreshError.message);
                        // Clear the invalid session from storage
                        await window.electron.logout();
                        return false;
                    }

                    console.log('[Supabase] Session refreshed successfully');
                    return true;
                }

                // Clear invalid session
                await window.electron.logout();
                return false;
            }

            console.log('[Supabase] Session restored successfully for:', stored.email);
            return true;
        }
    } catch (error) {
        console.error('[Supabase] Session restoration error:', error);
        // Clear potentially corrupt session
        try {
            await window.electron?.logout();
        } catch { }
    }

    return false;
}

// Gemini API Key - should be set via UI settings (stored in localStorage)
// DO NOT HARDCODE API KEYS HERE
export const getGeminiApiKey = (): string => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('gemini_api_key') || '';
    }
    return '';
};

export default supabase;

