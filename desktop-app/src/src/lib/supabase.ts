import { createClient } from '@supabase/supabase-js';

// Supabase configuration - SAME AS WEB APP PRODUCTION
const supabaseUrl = 'https://ylwyuogdfwugjexyhtrq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlsd3l1b2dkZnd1Z2pleHlodHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NjExODEsImV4cCI6MjA4MDAzNzE4MX0.clEe8v_lzTXJrOQJsAUn18CCHx3JRHCcBficHqwP-1g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // Electron doesn't use URL-based session
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    }
});

console.log('[Supabase] Client initialized with URL:', supabaseUrl);

export default supabase;
