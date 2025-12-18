/**
 * Production University Seeder
 * 
 * Fetches 10,000+ universities from HipoLabs API and seeds to Supabase.
 * Uses service_role key to bypass RLS for admin seeding.
 * 
 * Run with: npx tsx src/scripts/seed-universities-production.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: '.env.local' });

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HIPOLABS_API = 'http://universities.hipolabs.com/search';

if (!SUPABASE_URL) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL');
    process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
    console.error('   Add this to your .env.local:');
    console.error('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-from-supabase-dashboard');
    console.error('');
    console.error('   Find it at: Supabase Dashboard → Settings → API → service_role key');
    process.exit(1);
}

// ============================================================================
// TYPES
// ============================================================================

interface HipoLabsUniversity {
    name: string;
    country: string;
    domains: string[];
    web_pages: string[];
    alpha_two_code: string;
    'state-province': string | null;
}

interface University {
    university_name: string;
    country: string;
}

// ============================================================================
// BATCH PROCESSING CONFIG
// ============================================================================

const BATCH_SIZE = 500;
const CONCURRENT_BATCHES = 3;

function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// ============================================================================
// FETCH UNIVERSITIES FROM HIPOLABS
// ============================================================================

async function fetchAllUniversities(): Promise<University[]> {
    console.log('📡 Fetching universities from HipoLabs API...');

    // List of countries to fetch (covers most major countries)
    const countries = [
        // North America
        'united states', 'canada', 'mexico',
        // Europe
        'united kingdom', 'germany', 'france', 'spain', 'italy', 'netherlands',
        'sweden', 'norway', 'denmark', 'finland', 'austria', 'switzerland',
        'belgium', 'ireland', 'portugal', 'poland', 'czech republic', 'hungary',
        'greece', 'romania', 'ukraine', 'russia',
        // Asia Pacific
        'china', 'japan', 'south korea', 'india', 'singapore', 'hong kong',
        'taiwan', 'thailand', 'vietnam', 'philippines', 'indonesia', 'malaysia',
        'australia', 'new zealand',
        // Middle East
        'united arab emirates', 'saudi arabia', 'israel', 'turkey', 'qatar',
        // South America
        'brazil', 'argentina', 'chile', 'colombia', 'peru',
        // Africa
        'south africa', 'egypt', 'nigeria', 'kenya', 'morocco',
    ];

    const allUniversities: University[] = [];
    const seenNames = new Set<string>();

    for (const country of countries) {
        try {
            const response = await fetch(
                `${HIPOLABS_API}?country=${encodeURIComponent(country)}`,
                { signal: AbortSignal.timeout(15000) }
            );

            if (!response.ok) {
                console.warn(`   ⚠️ Failed to fetch ${country}: ${response.status}`);
                continue;
            }

            const data: HipoLabsUniversity[] = await response.json();

            for (const uni of data) {
                const normalizedName = uni.name.trim();
                const normalizedCountry = uni.country.trim();

                // Skip duplicates
                const key = normalizedName.toLowerCase();
                if (seenNames.has(key)) continue;
                seenNames.add(key);

                allUniversities.push({
                    university_name: normalizedName,
                    country: normalizedCountry,
                });
            }

            console.log(`   ✅ ${country}: ${data.length} universities`);

            // Small delay to be nice to the API
            await new Promise(r => setTimeout(r, 100));
        } catch (error) {
            console.warn(`   ⚠️ Error fetching ${country}: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
    }

    console.log(`📊 Total unique universities fetched: ${allUniversities.length}`);
    return allUniversities;
}

// ============================================================================
// SEED TO SUPABASE
// ============================================================================

async function seedToSupabase(universities: University[]): Promise<void> {
    console.log('');
    console.log('💾 Seeding to Supabase...');

    // Create admin client with service_role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    });

    // Check current count
    const { count: existingCount } = await supabase
        .from('universities')
        .select('*', { count: 'exact', head: true });

    console.log(`📦 Existing records: ${existingCount || 0}`);

    // Split into batches
    const batches = chunkArray(universities, BATCH_SIZE);
    console.log(`📦 Processing ${batches.length} batches of ${BATCH_SIZE} records...`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process batches with limited concurrency
    for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
        const batchGroup = batches.slice(i, i + CONCURRENT_BATCHES);

        const results = await Promise.all(
            batchGroup.map(async (batch, j) => {
                const batchNum = i + j + 1;

                const { error } = await supabase
                    .from('universities')
                    .upsert(batch, {
                        onConflict: 'university_name',
                        ignoreDuplicates: false,
                    });

                if (error) {
                    return { success: false, batchNum, error: error.message };
                }
                return { success: true, batchNum, count: batch.length };
            })
        );

        for (const result of results) {
            if (result.success) {
                successCount += (result as any).count;
                process.stdout.write(`\r   ⏳ Progress: ${successCount}/${universities.length} records`);
            } else {
                errorCount++;
                errors.push(`Batch ${result.batchNum}: ${result.error}`);
            }
        }
    }

    console.log('');
    console.log('');

    // Verify final count
    const { count: finalCount } = await supabase
        .from('universities')
        .select('*', { count: 'exact', head: true });

    console.log('====================');
    console.log('📊 SUMMARY');
    console.log('====================');
    console.log(`✅ Records processed: ${successCount}`);
    console.log(`📦 Final database count: ${finalCount || 0}`);
    console.log(`❌ Failed batches: ${errorCount}`);

    if (errors.length > 0) {
        console.log('');
        console.log('⚠️ Errors:');
        errors.slice(0, 10).forEach(e => console.log(`   - ${e}`));
        if (errors.length > 10) {
            console.log(`   ... and ${errors.length - 10} more`);
        }
    }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('');
    console.log('🎓 Production University Seeder');
    console.log('================================');
    console.log('');

    const startTime = Date.now();

    // Step 1: Fetch from HipoLabs
    const universities = await fetchAllUniversities();

    if (universities.length === 0) {
        console.error('❌ No universities fetched. Check your internet connection.');
        process.exit(1);
    }

    // Step 2: Seed to Supabase
    await seedToSupabase(universities);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('');
    console.log(`⏱️ Completed in ${duration}s`);
    console.log('🎉 Done!');
}

main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});
