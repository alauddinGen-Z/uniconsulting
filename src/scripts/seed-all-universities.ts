/**
 * Complete University Seeder - Fetches ALL from HipoLabs
 * Uses smaller queries to avoid timeout
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

async function fetchByName(name: string): Promise<University[]> {
    try {
        const response = await fetch(
            `${HIPOLABS_API}?name=${encodeURIComponent(name)}`,
            { signal: AbortSignal.timeout(45000) }
        );
        if (!response.ok) return [];
        const data = await response.json();
        return data.map((uni: any) => ({
            university_name: uni.name.trim(),
            country: uni.country.trim(),
        }));
    } catch {
        return [];
    }
}

async function main() {
    console.log('');
    console.log('🌍 Complete University Seeder');
    console.log('==============================');
    console.log('');

    // Comprehensive search terms to maximize coverage
    const searchTerms = [
        // Generic terms (gets lots of results)
        'university', 'college', 'institute', 'school', 'academy',
        'polytechnic', 'technology', 'sciences', 'arts',
        // US states
        'alabama', 'alaska', 'arizona', 'arkansas', 'california',
        'colorado', 'connecticut', 'delaware', 'florida', 'georgia',
        'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
        'kansas', 'kentucky', 'louisiana', 'maine', 'maryland',
        'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri',
        'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey',
        'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
        'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina',
        'south dakota', 'tennessee', 'texas', 'utah', 'vermont',
        'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming',
        // Top universities by name
        'harvard', 'stanford', 'mit', 'yale', 'princeton', 'columbia',
        'berkeley', 'ucla', 'chicago', 'duke', 'northwestern', 'caltech',
        'oxford', 'cambridge', 'imperial', 'ucl', 'lse', 'edinburgh',
        'toronto', 'mcgill', 'british columbia', 'waterloo',
        'melbourne', 'sydney', 'queensland', 'monash', 'anu',
        'tokyo', 'kyoto', 'osaka', 'waseda', 'keio',
        'tsinghua', 'peking', 'fudan', 'zhejiang', 'shanghai',
        'seoul', 'kaist', 'yonsei', 'korea',
        'singapore', 'nan', 'hong kong',
        'eth', 'epfl', 'munich', 'heidelberg', 'berlin', 'frankfurt',
        'amsterdam', 'delft', 'leiden', 'utrecht',
        'paris', 'sorbonne', 'lyon', 'marseille',
        'madrid', 'barcelona', 'valencia',
        'rome', 'milan', 'bologna', 'florence',
        // Common words in university names
        'national', 'federal', 'state', 'central', 'eastern',
        'western', 'northern', 'southern', 'medical', 'engineering',
        'business', 'law', 'agriculture', 'dental', 'pharmacy',
        'nursing', 'education', 'music', 'design', 'architecture',
        // More countries
        'indian', 'brazil', 'mexico', 'argentina', 'chile',
        'south africa', 'egypt', 'nigeria', 'kenya', 'morocco',
        'israel', 'turkey', 'saudi', 'dubai', 'qatar',
        'indonesia', 'malaysia', 'thailand', 'vietnam', 'philippines',
        'pakistan', 'bangladesh', 'russia', 'ukraine', 'poland',
        'czech', 'hungary', 'romania', 'greece', 'portugal',
        'sweden', 'norway', 'denmark', 'finland', 'ireland',
        'belgium', 'austria', 'switzerland',
    ];

    const allUnis: University[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < searchTerms.length; i++) {
        const term = searchTerms[i];
        process.stdout.write(`\r📡 [${i + 1}/${searchTerms.length}] Fetching: ${term.padEnd(20)} | Found: ${allUnis.length}`);

        const unis = await fetchByName(term);

        for (const uni of unis) {
            const key = uni.university_name.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                allUnis.push(uni);
            }
        }

        // Small delay to be nice to API
        await new Promise(r => setTimeout(r, 150));
    }

    console.log('');
    console.log(`📊 Total unique universities: ${allUnis.length}`);

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

    for (let i = 0; i < batches.length; i++) {
        const { error } = await supabase
            .from('universities')
            .upsert(batches[i], { onConflict: 'university_name' });

        if (!error) {
            success += batches[i].length;
            process.stdout.write(`\r   ⏳ Progress: ${success}/${allUnis.length}`);
        }
    }

    console.log('');

    const { count } = await supabase
        .from('universities')
        .select('*', { count: 'exact', head: true });

    console.log(`✅ Processed: ${success}`);
    console.log(`📦 Total in database: ${count}`);
    console.log('');
    console.log('🎉 Done!');
}

main().catch(console.error);
