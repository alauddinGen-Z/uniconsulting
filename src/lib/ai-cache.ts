/**
 * AI Caching Service
 * 
 * Provides a caching layer for AI API calls to avoid duplicate requests
 * and reduce costs. Uses SHA-256 hashing for content deduplication.
 * 
 * @file src/lib/ai-cache.ts
 */

import { createClient } from '@/utils/supabase/client';

// Query types that can be cached
export type AIQueryType = 'ocr' | 'essay_review' | 'university_match';

// Cache entry structure
interface CacheEntry {
    id: string;
    input_hash: string;
    query_type: AIQueryType;
    response_json: Record<string, unknown>;
    created_at: string;
    expires_at: string;
}

/**
 * Generate SHA-256 hash of input content
 * Works in both browser and Node.js environments
 */
export async function hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);

    // Use Web Crypto API (available in browser and modern Node.js)
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
    const supabase = createClient();

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
    const supabase = createClient();

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
}

/**
 * Main caching wrapper function
 * 
 * Checks cache first, calls API if not found, stores result in cache
 * 
 * @param inputContent - The content to hash (prompt, document text, etc.)
 * @param queryType - Type of AI query for categorization
 * @param fetchFunction - Async function that calls the actual AI API
 * @param ttlDays - Cache TTL in days (default: 30)
 * @returns The AI response (from cache or fresh API call)
 * 
 * @example
 * const response = await getOrFetchAIResponse(
 *   essayContent,
 *   'essay_review',
 *   async () => {
 *     const res = await fetch('/api/ai-review', { ... });
 *     return res.json();
 *   }
 * );
 */
export async function getOrFetchAIResponse<T>(
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

    // 4. Store in cache for future requests
    await setCachedResponse(inputHash, queryType, freshResponse, ttlDays);

    return { data: freshResponse, fromCache: false };
}

/**
 * Invalidate cache for a specific query
 * Useful when content has been updated and needs fresh analysis
 */
export async function invalidateCache(
    inputContent: string,
    queryType: AIQueryType
): Promise<void> {
    const supabase = createClient();
    const inputHash = await hashContent(inputContent);

    await supabase
        .from('ai_query_cache')
        .delete()
        .eq('input_hash', inputHash)
        .eq('query_type', queryType);

    console.log(`[AI Cache] Invalidated ${queryType} cache for hash: ${inputHash.substring(0, 8)}...`);
}

/**
 * Clear all cache entries of a specific type
 * Useful for admin operations
 */
export async function clearCacheByType(queryType: AIQueryType): Promise<number> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('ai_query_cache')
        .delete()
        .eq('query_type', queryType)
        .select('id');

    const count = data?.length || 0;
    console.log(`[AI Cache] Cleared ${count} entries of type ${queryType}`);

    return count;
}

/**
 * Get cache statistics
 * Useful for monitoring and debugging
 */
export async function getCacheStats(): Promise<{
    total: number;
    byType: Record<AIQueryType, number>;
    oldestEntry: string | null;
}> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('ai_query_cache')
        .select('query_type, created_at')
        .order('created_at', { ascending: true });

    if (error || !data) {
        return { total: 0, byType: { ocr: 0, essay_review: 0, university_match: 0 }, oldestEntry: null };
    }

    const byType: Record<AIQueryType, number> = {
        ocr: 0,
        essay_review: 0,
        university_match: 0
    };

    data.forEach(entry => {
        byType[entry.query_type as AIQueryType]++;
    });

    return {
        total: data.length,
        byType,
        oldestEntry: data[0]?.created_at || null
    };
}
