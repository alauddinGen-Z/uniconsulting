/**
 * Supabase Client for Chrome Extension
 * 
 * Uses Chrome Storage for session persistence to enable
 * the "Token Handoff" pattern from the main web app.
 * 
 * @file extension/src/lib/supabase.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Environment variables (injected by Plasmo)
const SUPABASE_URL = process.env.PLASMO_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY || ''

// Extension ID for token handoff (will be populated after build)
export const EXTENSION_ID = chrome.runtime.id

/**
 * Chrome Storage adapter for Supabase session persistence
 */
const chromeStorageAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        try {
            const result = await chrome.storage.local.get(key)
            return result[key] || null
        } catch (error) {
            console.error('[Supabase] Failed to get item from storage:', error)
            return null
        }
    },
    setItem: async (key: string, value: string): Promise<void> => {
        try {
            await chrome.storage.local.set({ [key]: value })
        } catch (error) {
            console.error('[Supabase] Failed to set item in storage:', error)
        }
    },
    removeItem: async (key: string): Promise<void> => {
        try {
            await chrome.storage.local.remove(key)
        } catch (error) {
            console.error('[Supabase] Failed to remove item from storage:', error)
        }
    }
}

// Singleton Supabase client
let supabaseClient: SupabaseClient | null = null

/**
 * Get the Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient {
    if (!supabaseClient) {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.error('[Supabase] Missing environment variables!')
            console.error('URL:', SUPABASE_URL ? 'Set' : 'Not Set')
            console.error('Key:', SUPABASE_ANON_KEY ? 'Set' : 'Not Set')
            throw new Error('Supabase URL and Key are required. Check your .env file.')
        }

        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                storage: chromeStorageAdapter,
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false,
            },
        })

        console.log('[Supabase] Client initialized for extension')
    }

    return supabaseClient
}

/**
 * Token Handoff: Receive session from main web app
 * This is called when the user authenticates on the main website
 * and passes the session to the extension via chrome.runtime.sendMessage
 */
export async function receiveSessionFromWebApp(session: {
    access_token: string
    refresh_token: string
}): Promise<boolean> {
    try {
        const client = getSupabaseClient()
        const { data, error } = await client.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
        })

        if (error) {
            console.error('[Supabase] Failed to set session:', error)
            return false
        }

        console.log('[Supabase] Session received from web app:', data.user?.email)
        return true
    } catch (error) {
        console.error('[Supabase] Error receiving session:', error)
        return false
    }
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
    const client = getSupabaseClient()
    const { data: { user }, error } = await client.auth.getUser()

    if (error) {
        console.error('[Supabase] Error getting user:', error)
        return null
    }

    return user
}

/**
 * Get the current session
 */
export async function getSession() {
    const client = getSupabaseClient()
    const { data: { session }, error } = await client.auth.getSession()

    if (error) {
        console.error('[Supabase] Error getting session:', error)
        return null
    }

    return session
}

/**
 * Sign out the user
 */
export async function signOut() {
    const client = getSupabaseClient()
    await client.auth.signOut()
    console.log('[Supabase] User signed out')
}

/**
 * Listen for auth state changes
 */
export function onAuthStateChange(callback: (user: any) => void) {
    const client = getSupabaseClient()
    return client.auth.onAuthStateChange((event, session) => {
        console.log('[Supabase] Auth state changed:', event)
        callback(session?.user || null)
    })
}
