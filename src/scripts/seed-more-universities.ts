/**
 * Additional University Seeder - More search terms
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
    console.log('🌍 Additional University Seeder');
    console.log('================================');
    console.log('');

    const searchTerms = [
        // More generic terms
        'community', 'vocational', 'technical', 'higher', 'graduate',
        'professional', 'seminary', 'theological', 'divinity',
        // Alphabetic searches (a-z)
        'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag', 'ah', 'ai', 'aj',
        'ak', 'al', 'am', 'an', 'ao', 'ap', 'aq', 'ar', 'as', 'at',
        'au', 'av', 'aw', 'ax', 'ay', 'az',
        'ba', 'be', 'bi', 'bo', 'br', 'bu',
        'ca', 'ce', 'ch', 'ci', 'cl', 'co', 'cr', 'cu',
        'da', 'de', 'di', 'do', 'dr', 'du',
        'ea', 'ec', 'ed', 'ef', 'eg', 'el', 'em', 'en', 'er', 'es', 'eu', 'ev',
        'fa', 'fe', 'fi', 'fl', 'fo', 'fr', 'fu',
        'ga', 'ge', 'gi', 'gl', 'go', 'gr', 'gu',
        'ha', 'he', 'hi', 'ho', 'hu', 'hy',
        'ia', 'ib', 'ic', 'id', 'if', 'ig', 'il', 'im', 'in', 'io', 'ir', 'is', 'it', 'iv',
        'ja', 'je', 'ji', 'jo', 'ju',
        'ka', 'ke', 'ki', 'ko', 'ku', 'ky',
        'la', 'le', 'li', 'lo', 'lu', 'ly',
        'ma', 'mc', 'me', 'mi', 'mo', 'mu', 'my',
        'na', 'ne', 'ni', 'no', 'nu', 'ny',
        'oa', 'ob', 'oc', 'od', 'of', 'oh', 'ok', 'ol', 'om', 'on', 'op', 'or', 'os', 'ot', 'ou', 'ov', 'ow', 'ox',
        'pa', 'pe', 'ph', 'pi', 'pl', 'po', 'pr', 'pu',
        'qa', 'qu',
        'ra', 're', 'rh', 'ri', 'ro', 'ru', 'ry',
        'sa', 'sc', 'se', 'sh', 'si', 'sk', 'sl', 'sm', 'so', 'sp', 'sq', 'sr', 'st', 'su', 'sw', 'sy',
        'ta', 'te', 'th', 'ti', 'to', 'tr', 'tu', 'tw', 'ty',
        'ua', 'ub', 'uc', 'ud', 'uf', 'ug', 'uh', 'ui', 'uk', 'ul', 'um', 'un', 'up', 'ur', 'us', 'ut', 'uv',
        'va', 've', 'vi', 'vo',
        'wa', 'we', 'wh', 'wi', 'wo', 'wr', 'wu',
        'xa', 'xe', 'xi',
        'ya', 'ye', 'yi', 'yo', 'yu',
        'za', 'ze', 'zh', 'zi', 'zo', 'zu',
    ];

    const allUnis: University[] = [];
    const seen = new Set<string>();

    // Get existing from database to skip
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    });

    const { data: existing } = await supabase.from('universities').select('university_name');
    if (existing) {
        existing.forEach(u => seen.add(u.university_name.toLowerCase()));
    }
    console.log(`📦 Already have ${seen.size} universities`);

    for (let i = 0; i < searchTerms.length; i++) {
        const term = searchTerms[i];
        process.stdout.write(`\r📡 [${i + 1}/${searchTerms.length}] Fetching: ${term.padEnd(15)} | New: ${allUnis.length}`);

        const unis = await fetchByName(term);

        for (const uni of unis) {
            const key = uni.university_name.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                allUnis.push(uni);
            }
        }

        await new Promise(r => setTimeout(r, 100));
    }

    console.log('');
    console.log(`📊 New unique universities: ${allUnis.length}`);

    if (allUnis.length === 0) {
        console.log('✅ No new universities to add');
        return;
    }

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

    console.log(`✅ Added: ${success}`);
    console.log(`📦 Total in database: ${count}`);
    console.log('');
    console.log('🎉 Done!');
}

main().catch(console.error);
