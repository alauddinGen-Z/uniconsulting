/**
 * University Seeding Utility
 * 
 * Robust batch processor for seeding the universities lookup table.
 * Handles 10,000+ records with idempotent upsert operations.
 * 
 * @module seedUniversities
 */

import { createClient } from '@/utils/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

export interface University {
    university_name: string;
    country: string;
}

export interface SeedResult {
    success: boolean;
    totalProcessed: number;
    batchesCompleted: number;
    errors: string[];
    duration: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Maximum records per Supabase upsert call.
 * Supabase recommends batches of 1000 or fewer for optimal performance.
 */
const BATCH_SIZE = 1000;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Splits an array into chunks of specified size.
 * 
 * @param array - The array to chunk
 * @param size - Maximum size of each chunk
 * @returns Array of chunked arrays
 */
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * Validates university data before processing.
 * 
 * @param data - Array of university objects to validate
 * @returns Object with valid data and validation errors
 */
function validateUniversityData(data: University[]): {
    valid: University[];
    errors: string[];
} {
    const valid: University[] = [];
    const errors: string[] = [];

    data.forEach((uni, index) => {
        if (!uni.university_name || typeof uni.university_name !== 'string') {
            errors.push(`Row ${index + 1}: Missing or invalid university_name`);
            return;
        }
        if (!uni.country || typeof uni.country !== 'string') {
            errors.push(`Row ${index + 1}: Missing or invalid country`);
            return;
        }

        // Normalize data
        valid.push({
            university_name: uni.university_name.trim(),
            country: uni.country.trim(),
        });
    });

    return { valid, errors };
}

// ============================================================================
// MAIN SEEDING FUNCTION
// ============================================================================

/**
 * Seeds the universities table with batch upsert operations.
 * 
 * Features:
 * - Idempotent: Safe to run multiple times without creating duplicates
 * - Batch processing: Handles 10,000+ records efficiently
 * - Validation: Filters out invalid records before processing
 * - Error tracking: Collects and reports all errors
 * 
 * @param data - Array of University objects to seed
 * @returns Promise<SeedResult> - Result object with statistics
 * 
 * @example
 * ```typescript
 * import { seedUniversities } from '@/lib/data/seedUniversities';
 * 
 * const universities = [
 *   { university_name: 'Harvard University', country: 'United States' },
 *   { university_name: 'University of Oxford', country: 'United Kingdom' },
 * ];
 * 
 * const result = await seedUniversities(universities);
 * console.log(`Processed ${result.totalProcessed} universities in ${result.duration}ms`);
 * ```
 */
export async function seedUniversities(data: University[]): Promise<SeedResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let totalProcessed = 0;
    let batchesCompleted = 0;

    // Initialize Supabase client (uses anon key, not service_role)
    const supabase = createClient();

    // Validate input data
    if (!Array.isArray(data) || data.length === 0) {
        return {
            success: false,
            totalProcessed: 0,
            batchesCompleted: 0,
            errors: ['Input data must be a non-empty array'],
            duration: Date.now() - startTime,
        };
    }

    console.log(`[seedUniversities] Starting seed of ${data.length} universities...`);

    // Validate and normalize data
    const { valid: validData, errors: validationErrors } = validateUniversityData(data);
    errors.push(...validationErrors);

    if (validData.length === 0) {
        return {
            success: false,
            totalProcessed: 0,
            batchesCompleted: 0,
            errors: ['No valid university records to process', ...errors],
            duration: Date.now() - startTime,
        };
    }

    console.log(`[seedUniversities] Validated ${validData.length} records, ${validationErrors.length} invalid`);

    // Remove duplicates within the input data (by university_name)
    const uniqueMap = new Map<string, University>();
    validData.forEach(uni => {
        const key = uni.university_name.toLowerCase();
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, uni);
        }
    });
    const uniqueData = Array.from(uniqueMap.values());

    console.log(`[seedUniversities] Deduplicated to ${uniqueData.length} unique universities`);

    // Split into batches
    const batches = chunkArray(uniqueData, BATCH_SIZE);
    const totalBatches = batches.length;

    console.log(`[seedUniversities] Processing ${totalBatches} batches of up to ${BATCH_SIZE} records each`);

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchNumber = i + 1;

        try {
            console.log(`[seedUniversities] Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)`);

            // Upsert batch - uses university_name as the conflict target
            const { error, count } = await supabase
                .from('universities')
                .upsert(batch, {
                    onConflict: 'university_name',
                    ignoreDuplicates: false, // Update existing records
                })
                .select('id');

            if (error) {
                const errorMsg = `Batch ${batchNumber} failed: ${error.message}`;
                console.error(`[seedUniversities] ${errorMsg}`);
                errors.push(errorMsg);
                continue;
            }

            totalProcessed += batch.length;
            batchesCompleted++;

            console.log(`[seedUniversities] Batch ${batchNumber} complete. Total processed: ${totalProcessed}`);
        } catch (err) {
            const errorMsg = `Batch ${batchNumber} exception: ${err instanceof Error ? err.message : 'Unknown error'}`;
            console.error(`[seedUniversities] ${errorMsg}`);
            errors.push(errorMsg);
        }
    }

    const duration = Date.now() - startTime;
    const success = batchesCompleted === totalBatches && errors.length === 0;

    console.log(`[seedUniversities] Seeding complete in ${duration}ms`);
    console.log(`[seedUniversities] Success: ${success}, Processed: ${totalProcessed}, Batches: ${batchesCompleted}/${totalBatches}`);

    return {
        success,
        totalProcessed,
        batchesCompleted,
        errors,
        duration,
    };
}

// ============================================================================
// HELPER: SEED FROM JSON FILE (for CLI usage)
// ============================================================================

/**
 * Seeds universities from a JSON file path.
 * Useful for CLI scripts or one-time data imports.
 * 
 * @param filePath - Path to JSON file containing University[] data
 * @returns Promise<SeedResult>
 */
export async function seedUniversitiesFromFile(filePath: string): Promise<SeedResult> {
    try {
        // Dynamic import for Node.js fs (only works in server context)
        const fs = await import('fs/promises');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const data: University[] = JSON.parse(fileContent);
        return seedUniversities(data);
    } catch (err) {
        return {
            success: false,
            totalProcessed: 0,
            batchesCompleted: 0,
            errors: [`Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}`],
            duration: 0,
        };
    }
}

// ============================================================================
// SAMPLE DATA (for testing)
// ============================================================================

/**
 * Sample university data for testing the seeder.
 * Contains a small subset of popular universities.
 */
export const SAMPLE_UNIVERSITIES: University[] = [
    { university_name: 'Harvard University', country: 'United States' },
    { university_name: 'Massachusetts Institute of Technology', country: 'United States' },
    { university_name: 'Stanford University', country: 'United States' },
    { university_name: 'University of Oxford', country: 'United Kingdom' },
    { university_name: 'University of Cambridge', country: 'United Kingdom' },
    { university_name: 'California Institute of Technology', country: 'United States' },
    { university_name: 'Princeton University', country: 'United States' },
    { university_name: 'Yale University', country: 'United States' },
    { university_name: 'Imperial College London', country: 'United Kingdom' },
    { university_name: 'ETH Zurich', country: 'Switzerland' },
    { university_name: 'University of Tokyo', country: 'Japan' },
    { university_name: 'National University of Singapore', country: 'Singapore' },
    { university_name: 'Tsinghua University', country: 'China' },
    { university_name: 'Peking University', country: 'China' },
    { university_name: 'University of Toronto', country: 'Canada' },
    { university_name: 'McGill University', country: 'Canada' },
    { university_name: 'University of Melbourne', country: 'Australia' },
    { university_name: 'Australian National University', country: 'Australia' },
    { university_name: 'Seoul National University', country: 'South Korea' },
    { university_name: 'KAIST', country: 'South Korea' },
];
