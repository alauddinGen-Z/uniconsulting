/**
 * One-time script to seed universities database
 * 
 * Run with: npx tsx src/scripts/seed-universities.ts
 * 
 * This script seeds the universities table with sample data.
 * Safe to run multiple times (idempotent upsert).
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: '.env.local' });

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
    console.error('   Make sure .env.local is configured');
    process.exit(1);
}

// ============================================================================
// UNIVERSITY DATA
// ============================================================================

interface University {
    university_name: string;
    country: string;
}

const UNIVERSITIES: University[] = [
    // United States - Top Universities
    { university_name: 'Harvard University', country: 'United States' },
    { university_name: 'Massachusetts Institute of Technology', country: 'United States' },
    { university_name: 'Stanford University', country: 'United States' },
    { university_name: 'California Institute of Technology', country: 'United States' },
    { university_name: 'Princeton University', country: 'United States' },
    { university_name: 'Yale University', country: 'United States' },
    { university_name: 'Columbia University', country: 'United States' },
    { university_name: 'University of Chicago', country: 'United States' },
    { university_name: 'University of Pennsylvania', country: 'United States' },
    { university_name: 'Cornell University', country: 'United States' },
    { university_name: 'Duke University', country: 'United States' },
    { university_name: 'Johns Hopkins University', country: 'United States' },
    { university_name: 'Northwestern University', country: 'United States' },
    { university_name: 'Brown University', country: 'United States' },
    { university_name: 'Dartmouth College', country: 'United States' },
    { university_name: 'University of California, Berkeley', country: 'United States' },
    { university_name: 'University of California, Los Angeles', country: 'United States' },
    { university_name: 'University of Michigan', country: 'United States' },
    { university_name: 'Carnegie Mellon University', country: 'United States' },
    { university_name: 'New York University', country: 'United States' },
    { university_name: 'University of Southern California', country: 'United States' },
    { university_name: 'Boston University', country: 'United States' },
    { university_name: 'Georgia Institute of Technology', country: 'United States' },
    { university_name: 'University of Texas at Austin', country: 'United States' },
    { university_name: 'University of Washington', country: 'United States' },

    // United Kingdom
    { university_name: 'University of Oxford', country: 'United Kingdom' },
    { university_name: 'University of Cambridge', country: 'United Kingdom' },
    { university_name: 'Imperial College London', country: 'United Kingdom' },
    { university_name: 'London School of Economics', country: 'United Kingdom' },
    { university_name: 'University College London', country: 'United Kingdom' },
    { university_name: 'University of Edinburgh', country: 'United Kingdom' },
    { university_name: 'University of Manchester', country: 'United Kingdom' },
    { university_name: 'King\'s College London', country: 'United Kingdom' },
    { university_name: 'University of Bristol', country: 'United Kingdom' },
    { university_name: 'University of Warwick', country: 'United Kingdom' },

    // Canada
    { university_name: 'University of Toronto', country: 'Canada' },
    { university_name: 'McGill University', country: 'Canada' },
    { university_name: 'University of British Columbia', country: 'Canada' },
    { university_name: 'University of Waterloo', country: 'Canada' },
    { university_name: 'University of Alberta', country: 'Canada' },

    // Australia
    { university_name: 'University of Melbourne', country: 'Australia' },
    { university_name: 'Australian National University', country: 'Australia' },
    { university_name: 'University of Sydney', country: 'Australia' },
    { university_name: 'University of Queensland', country: 'Australia' },
    { university_name: 'Monash University', country: 'Australia' },

    // Asia
    { university_name: 'University of Tokyo', country: 'Japan' },
    { university_name: 'Kyoto University', country: 'Japan' },
    { university_name: 'National University of Singapore', country: 'Singapore' },
    { university_name: 'Nanyang Technological University', country: 'Singapore' },
    { university_name: 'Tsinghua University', country: 'China' },
    { university_name: 'Peking University', country: 'China' },
    { university_name: 'Fudan University', country: 'China' },
    { university_name: 'Seoul National University', country: 'South Korea' },
    { university_name: 'KAIST', country: 'South Korea' },
    { university_name: 'The University of Hong Kong', country: 'Hong Kong' },
    { university_name: 'Hong Kong University of Science and Technology', country: 'Hong Kong' },

    // Europe
    { university_name: 'ETH Zurich', country: 'Switzerland' },
    { university_name: 'EPFL', country: 'Switzerland' },
    { university_name: 'Technical University of Munich', country: 'Germany' },
    { university_name: 'Ludwig Maximilian University of Munich', country: 'Germany' },
    { university_name: 'Heidelberg University', country: 'Germany' },
    { university_name: 'University of Amsterdam', country: 'Netherlands' },
    { university_name: 'Delft University of Technology', country: 'Netherlands' },
    { university_name: 'Sorbonne University', country: 'France' },
    { university_name: 'Sciences Po', country: 'France' },
    { university_name: 'KU Leuven', country: 'Belgium' },
];

// ============================================================================
// BATCH PROCESSING
// ============================================================================

const BATCH_SIZE = 500;

function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function main() {
    console.log('🎓 University Seeder');
    console.log('====================');
    console.log(`📊 Total universities: ${UNIVERSITIES.length}`);
    console.log(`🔗 Supabase URL: ${SUPABASE_URL.substring(0, 30)}...`);
    console.log('');

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Check current count
    const { count: existingCount } = await supabase
        .from('universities')
        .select('*', { count: 'exact', head: true });

    console.log(`📦 Existing records: ${existingCount || 0}`);
    console.log('');

    // Process in batches
    const batches = chunkArray(UNIVERSITIES, BATCH_SIZE);
    let totalUpserted = 0;
    let errors: string[] = [];

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`⏳ Processing batch ${i + 1}/${batches.length} (${batch.length} records)...`);

        const { error } = await supabase
            .from('universities')
            .upsert(batch, {
                onConflict: 'university_name',
                ignoreDuplicates: false
            });

        if (error) {
            console.error(`   ❌ Batch ${i + 1} failed: ${error.message}`);
            errors.push(error.message);
        } else {
            totalUpserted += batch.length;
            console.log(`   ✅ Batch ${i + 1} complete`);
        }
    }

    console.log('');
    console.log('====================');
    console.log('📊 SUMMARY');
    console.log('====================');
    console.log(`✅ Total processed: ${totalUpserted}`);
    console.log(`❌ Errors: ${errors.length}`);

    // Verify final count
    const { count: finalCount } = await supabase
        .from('universities')
        .select('*', { count: 'exact', head: true });

    console.log(`📦 Final record count: ${finalCount || 0}`);

    if (errors.length > 0) {
        console.log('');
        console.log('⚠️  Errors encountered:');
        errors.forEach(e => console.log(`   - ${e}`));
        process.exit(1);
    }

    console.log('');
    console.log('🎉 Seeding complete!');
}

main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});
