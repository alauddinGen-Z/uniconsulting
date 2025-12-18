/**
 * Supplement seeder for large countries (US, UK, Canada)
 * These have many universities and need longer timeouts
 * 
 * Run with: npx tsx src/scripts/seed-large-countries.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HIPOLABS_API = 'http://universities.hipolabs.com/search';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing env vars');
    process.exit(1);
}

interface University {
    university_name: string;
    country: string;
}

const BATCH_SIZE = 500;

function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

async function fetchCountry(country: string): Promise<University[]> {
    console.log(`📡 Fetching ${country}...`);

    try {
        const response = await fetch(
            `${HIPOLABS_API}?country=${encodeURIComponent(country)}`,
            { signal: AbortSignal.timeout(60000) } // 60 second timeout
        );

        if (!response.ok) {
            console.error(`   ❌ Failed: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const universities: University[] = data.map((uni: any) => ({
            university_name: uni.name.trim(),
            country: uni.country.trim(),
        }));

        console.log(`   ✅ ${country}: ${universities.length} universities`);
        return universities;
    } catch (error) {
        console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        return [];
    }
}

async function seedToSupabase(universities: University[]): Promise<void> {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    });

    // Deduplicate
    const seen = new Set<string>();
    const unique = universities.filter(u => {
        const key = u.university_name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    console.log(`💾 Seeding ${unique.length} unique universities...`);

    const batches = chunkArray(unique, BATCH_SIZE);
    let success = 0;

    for (let i = 0; i < batches.length; i++) {
        const { error } = await supabase
            .from('universities')
            .upsert(batches[i], { onConflict: 'university_name' });

        if (error) {
            console.error(`   ❌ Batch ${i + 1} error: ${error.message}`);
        } else {
            success += batches[i].length;
            process.stdout.write(`\r   ⏳ Progress: ${success}/${unique.length}`);
        }
    }

    console.log('');

    const { count } = await supabase
        .from('universities')
        .select('*', { count: 'exact', head: true });

    console.log(`📦 Total in database: ${count}`);
}

async function main() {
    console.log('');
    console.log('🎓 Large Country University Seeder');
    console.log('===================================');
    console.log('');

    const countries = ['united states', 'united kingdom', 'canada'];
    const all: University[] = [];

    for (const country of countries) {
        const unis = await fetchCountry(country);
        all.push(...unis);
        // Wait between requests
        await new Promise(r => setTimeout(r, 2000));
    }

    if (all.length > 0) {
        await seedToSupabase(all);
    }

    console.log('');
    console.log('🎉 Done!');
}

main().catch(console.error);
