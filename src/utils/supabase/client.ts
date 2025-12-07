import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.error("Supabase Environment Variables are missing!");
        console.error("URL:", url);
        console.error("Key:", key ? "Set" : "Not Set");
        throw new Error("Supabase URL and Key are required. Check your .env.local file.");
    }

    console.log("Initializing Supabase Client with URL:", url);

    return createBrowserClient(url, key)
}
