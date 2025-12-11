/**
 * AI Caching Service - Server Side Version
 * 
 * Provides a caching layer for AI API calls in API routes.
 * Uses SHA-256 hashing for content deduplication.
 * 
 * @file src/lib/ai-cache-server.ts
 */

import { createClient } from '@supabase/supabase-js';

// Query types that can be cached
export type AIQueryType = 'ocr' | 'essay_review' | 'university_match';

// Initialize Supabase client for server-side use
const getSupabaseClient = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
};

/**
 * Generate SHA-256 hash of input content
 * Works in Node.js environment
 */
export async function hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);

    // Use Web Crypto API
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
}

/**
 * Check cache for existing response
 */
async function getCachedResponse<T>(
    inputHash: string,
    queryType: AIQueryType
): Promise<T | null> {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('ai_query_cache')
            .select('response_json, expires_at')
            .eq('input_hash', inputHash)
            .eq('query_type', queryType)
            .single();

        if (error || !data) {
            return null;
        }

        // Check if cache entry has expired
        if (new Date(data.expires_at) < new Date()) {
            // Entry expired, delete it and return null
            await supabase
                .from('ai_query_cache')
                .delete()
                .eq('input_hash', inputHash)
                .eq('query_type', queryType);
            return null;
        }

        return data.response_json as T;
    } catch (error) {
        console.error('[AI Cache] Error checking cache:', error);
        return null;
    }
}

/**
 * Store response in cache
 */
async function setCachedResponse<T>(
    inputHash: string,
    queryType: AIQueryType,
    response: T,
    ttlDays: number = 30
): Promise<void> {
    try {
        const supabase = getSupabaseClient();

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + ttlDays);

        await supabase
            .from('ai_query_cache')
            .upsert({
                input_hash: inputHash,
                query_type: queryType,
                response_json: response,
                expires_at: expiresAt.toISOString(),
            }, {
                onConflict: 'input_hash,query_type'
            });
    } catch (error) {
        console.error('[AI Cache] Error storing in cache:', error);
        // Don't throw - caching failures shouldn't break the main flow
    }
}

/**
 * Main caching wrapper function for server-side use
 * 
 * Checks cache first, calls API if not found, stores result in cache
 * 
 * @param inputContent - The content to hash (prompt, document text, etc.)
 * @param queryType - Type of AI query for categorization
 * @param fetchFunction - Async function that calls the actual AI API
 * @param ttlDays - Cache TTL in days (default: 30)
 * @returns The AI response (from cache or fresh API call)
 */
export async function getOrFetchAIResponseServer<T>(
    inputContent: string,
    queryType: AIQueryType,
    fetchFunction: () => Promise<T>,
    ttlDays: number = 30
): Promise<{ data: T; fromCache: boolean }> {
    // 1. Generate hash of input content
    const inputHash = await hashContent(inputContent);

    // 2. Check cache for existing response
    const cachedResponse = await getCachedResponse<T>(inputHash, queryType);

    if (cachedResponse) {
        console.log(`[AI Cache] HIT for ${queryType} (hash: ${inputHash.substring(0, 8)}...)`);
        return { data: cachedResponse, fromCache: true };
    }

    console.log(`[AI Cache] MISS for ${queryType} (hash: ${inputHash.substring(0, 8)}...) - calling API`);

    // 3. Cache miss - call the actual API
    const freshResponse = await fetchFunction();

    // 4. Store in cache for future requests (don't await - fire and forget)
    setCachedResponse(inputHash, queryType, freshResponse, ttlDays).catch(err => {
        console.error('[AI Cache] Failed to store response:', err);
    });

    return { data: freshResponse, fromCache: false };
}

/**
 * Invalidate cache for a specific query (server-side)
 */
export async function invalidateCacheServer(
    inputContent: string,
    queryType: AIQueryType
): Promise<void> {
    try {
        const supabase = getSupabaseClient();
        const inputHash = await hashContent(inputContent);

        await supabase
            .from('ai_query_cache')
            .delete()
            .eq('input_hash', inputHash)
            .eq('query_type', queryType);

        console.log(`[AI Cache] Invalidated ${queryType} cache for hash: ${inputHash.substring(0, 8)}...`);
    } catch (error) {
        console.error('[AI Cache] Error invalidating cache:', error);
    }
}
