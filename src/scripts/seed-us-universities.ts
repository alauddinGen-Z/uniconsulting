/**
 * US Universities Seeder - Fetches by searching common terms
 * HipoLabs API times out on full 'united states' query
 * This fetches using specific search terms
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

async function fetchByTerm(term: string): Promise<University[]> {
    try {
        const response = await fetch(
            `${HIPOLABS_API}?name=${encodeURIComponent(term)}&country=united+states`,
            { signal: AbortSignal.timeout(30000) }
        );

        if (!response.ok) return [];

        const data = await response.json();
        return data.map((uni: any) => ({
            university_name: uni.name.trim(),
            country: 'United States',
        }));
    } catch {
        return [];
    }
}

async function main() {
    console.log('');
    console.log('🇺🇸 US Universities Seeder');
    console.log('===========================');
    console.log('');

    // Search terms to get US universities
    const searchTerms = [
        'university of', 'college', 'state university', 'community college',
        'institute of', 'california', 'texas', 'new york', 'florida',
        'illinois', 'ohio', 'pennsylvania', 'michigan', 'georgia',
        'north carolina', 'virginia', 'massachusetts', 'arizona', 'washington',
        'colorado', 'maryland', 'minnesota', 'wisconsin', 'missouri',
        'alabama', 'louisiana', 'oregon', 'oklahoma', 'connecticut',
        'iowa', 'kansas', 'arkansas', 'utah', 'nevada',
        'harvard', 'stanford', 'mit', 'yale', 'princeton', 'columbia',
        'cornell', 'duke', 'northwestern', 'caltech', 'berkeley',
        'ucla', 'michigan', 'nyu', 'carnegie', 'johns hopkins',
    ];

    const allUnis: University[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < searchTerms.length; i++) {
        const term = searchTerms[i];
        process.stdout.write(`\r📡 Fetching: ${term.padEnd(25)} (${i + 1}/${searchTerms.length})`);

        const unis = await fetchByTerm(term);

        for (const uni of unis) {
            const key = uni.university_name.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                allUnis.push(uni);
            }
        }

        await new Promise(r => setTimeout(r, 200));
    }

    console.log('');
    console.log(`📊 Found ${allUnis.length} unique US universities`);

    if (allUnis.length === 0) {
        console.log('❌ No universities fetched');
        return;
    }

    // Seed to Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    });

    console.log('💾 Seeding to Supabase...');

    const batches = chunkArray(allUnis, BATCH_SIZE);
    let success = 0;

    for (const batch of batches) {
        const { error } = await supabase
            .from('universities')
            .upsert(batch, { onConflict: 'university_name' });

        if (!error) {
            success += batch.length;
        }
    }

    const { count } = await supabase
        .from('universities')
        .select('*', { count: 'exact', head: true });

    console.log(`✅ Processed: ${success}`);
    console.log(`📦 Total in database: ${count}`);
    console.log('');
    console.log('🎉 Done!');
}

main().catch(console.error);
