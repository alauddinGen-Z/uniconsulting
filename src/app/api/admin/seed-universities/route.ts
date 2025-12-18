/**
 * API Route: Seed Universities
 * 
 * POST /api/admin/seed-universities
 * 
 * Protected admin endpoint to seed the universities lookup table.
 * Requires authenticated admin/teacher user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { seedUniversities, SAMPLE_UNIVERSITIES, University } from '@/lib/data/seedUniversities';

export async function POST(request: NextRequest) {
    try {
        // Verify authentication
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized. Please log in.' },
                { status: 401 }
            );
        }

        // Verify user is a teacher (admin)
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'teacher') {
            return NextResponse.json(
                { error: 'Forbidden. Admin access required.' },
                { status: 403 }
            );
        }

        // Get custom data from request body, or use sample data
        const body = await request.json().catch(() => ({}));
        const universities: University[] = body.universities || SAMPLE_UNIVERSITIES;

        console.log(`[seed-universities] Starting seed of ${universities.length} universities by ${user.email}`);

        // Run the seeder
        const result = await seedUniversities(universities);

        if (result.success) {
            return NextResponse.json({
                message: `Successfully seeded ${result.totalProcessed} universities`,
                success: result.success,
                totalProcessed: result.totalProcessed,
                batchesCompleted: result.batchesCompleted,
                errors: result.errors,
                duration: result.duration,
            });
        } else {
            return NextResponse.json({
                message: 'Seeding completed with errors',
                success: result.success,
                totalProcessed: result.totalProcessed,
                batchesCompleted: result.batchesCompleted,
                errors: result.errors,
                duration: result.duration,
            }, { status: 207 }); // 207 Multi-Status
        }

    } catch (error) {
        console.error('[seed-universities] Fatal error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}

// GET: Check current university count
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { count, error } = await supabase
            .from('universities')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            count: count || 0,
            message: `Database contains ${count || 0} universities`,
        });

    } catch (error) {
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
