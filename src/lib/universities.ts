/**
 * University Data Integration Service
 * 
 * Provides utilities for searching universities from local Supabase database.
 * Uses the seeded 10,000+ university lookup table for instant autocomplete.
 */

import { createClient } from '@/utils/supabase/client';

/**
 * University data structure from Supabase
 */
export interface University {
    name: string;
    country: string;
    // Legacy fields for compatibility (not stored in DB)
    domains: string[];
    web_pages: string[];
    alpha_two_code: string;
    'state-province': string | null;
}

/**
 * Raw database record
 */
interface UniversityRecord {
    id: string;
    university_name: string;
    country: string;
}

/**
 * Cache configuration
 */
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes (longer since it's local DB)
const cache = new Map<string, { data: University[]; timestamp: number }>();

/**
 * Convert database record to University interface
 */
function toUniversity(record: UniversityRecord): University {
    return {
        name: record.university_name,
        country: record.country,
        // Legacy fields - empty since not in DB
        domains: [],
        web_pages: [],
        alpha_two_code: '',
        'state-province': null,
    };
}

/**
 * Search for universities by name from Supabase
 * 
 * @param name - The search query (university name or partial name)
 * @returns Promise<University[]> - Array of matching universities
 * 
 * @example
 * const results = await searchUniversities('Harvard');
 * // Returns universities matching "Harvard"
 */
export async function searchUniversities(name: string): Promise<University[]> {
    // Return empty array for empty or too short queries
    if (!name || name.trim().length < 2) {
        return [];
    }

    const trimmedName = name.trim().toLowerCase();

    // Check cache first
    const cached = cache.get(trimmedName);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        const supabase = createClient();

        // Use ilike for case-insensitive partial matching
        const { data, error } = await supabase
            .from('universities')
            .select('id, university_name, country')
            .ilike('university_name', `%${trimmedName}%`)
            .limit(50)
            .order('university_name');

        if (error) {
            console.error('University search error:', error.message);
            return getCachedOrEmpty(trimmedName);
        }

        const universities = (data || []).map(toUniversity);

        // Update cache
        cache.set(trimmedName, {
            data: universities,
            timestamp: Date.now(),
        });

        return universities;
    } catch (error) {
        if (error instanceof Error) {
            console.error('University search failed:', error.message);
        }
        return getCachedOrEmpty(trimmedName);
    }
}

/**
 * Search for universities by country
 * 
 * @param country - The country name
 * @returns Promise<University[]> - Array of universities in that country
 */
export async function searchUniversitiesByCountry(country: string): Promise<University[]> {
    if (!country || country.trim().length < 2) {
        return [];
    }

    const trimmedCountry = country.trim();
    const cacheKey = `country:${trimmedCountry.toLowerCase()}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        const supabase = createClient();

        const { data, error } = await supabase
            .from('universities')
            .select('id, university_name, country')
            .ilike('country', `%${trimmedCountry}%`)
            .limit(100)
            .order('university_name');

        if (error) {
            console.error('University search error:', error.message);
            return getCachedOrEmpty(cacheKey);
        }

        const universities = (data || []).map(toUniversity);

        // Update cache
        cache.set(cacheKey, {
            data: universities,
            timestamp: Date.now(),
        });

        return universities;
    } catch (error) {
        if (error instanceof Error) {
            console.error('University search failed:', error.message);
        }
        return getCachedOrEmpty(cacheKey);
    }
}

/**
 * Search for universities with combined filters (name and country)
 * 
 * @param options - Search options
 * @returns Promise<University[]> - Array of matching universities
 */
export async function searchUniversitiesAdvanced(options: {
    name?: string;
    country?: string;
}): Promise<University[]> {
    const { name, country } = options;

    if (!name && !country) {
        return [];
    }

    const cacheKey = `advanced:${name || ''}-${country || ''}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        const supabase = createClient();

        let query = supabase
            .from('universities')
            .select('id, university_name, country');

        if (name && name.trim().length >= 2) {
            query = query.ilike('university_name', `%${name.trim()}%`);
        }

        if (country && country.trim().length >= 2) {
            query = query.ilike('country', `%${country.trim()}%`);
        }

        const { data, error } = await query
            .limit(100)
            .order('university_name');

        if (error) {
            console.error('University search error:', error.message);
            return getCachedOrEmpty(cacheKey);
        }

        const universities = (data || []).map(toUniversity);

        // Update cache
        cache.set(cacheKey, {
            data: universities,
            timestamp: Date.now(),
        });

        return universities;
    } catch (error) {
        if (error instanceof Error) {
            console.error('University search failed:', error.message);
        }
        return getCachedOrEmpty(cacheKey);
    }
}

/**
 * Get cached data or return empty array
 */
function getCachedOrEmpty(key: string): University[] {
    const cached = cache.get(key);
    if (cached) {
        // Return stale data if available (better than nothing)
        return cached.data;
    }
    return [];
}

/**
 * Clear the university cache (useful for testing or manual refresh)
 */
export function clearUniversityCache(): void {
    cache.clear();
}

/**
 * Debounce helper for autocomplete usage
 * Use this to wrap searchUniversities to prevent excessive calls
 * 
 * @param fn - The function to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;

    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Get total count of universities in database
 * Useful for displaying stats
 */
export async function getUniversityCount(): Promise<number> {
    try {
        const supabase = createClient();
        const { count, error } = await supabase
            .from('universities')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Count error:', error.message);
            return 0;
        }

        return count || 0;
    } catch {
        return 0;
    }
}
