import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null;

export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.error("Supabase Environment Variables are missing!");
        throw new Error("Supabase URL and Key are required.");
    }

    if (client) {
        return client;
    }

    console.log("Initializing Supabase Client SINGLETON with URL:", url);
    client = createBrowserClient(url, key);
    return client;
}
