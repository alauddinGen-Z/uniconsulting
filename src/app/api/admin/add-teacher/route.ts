import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';

// Initialize Supabase Admin client for creating users
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
    try {
        // Verify the caller is an admin
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is admin
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('is_admin, role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile?.is_admin || profile.role !== 'teacher') {
            return NextResponse.json(
                { error: 'Only administrators can add teachers' },
                { status: 403 }
            );
        }

        // Get new teacher data from request
        const { email, full_name, password } = await request.json();

        if (!email || !full_name || !password) {
            return NextResponse.json(
                { error: 'Email, full name, and password are required' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }

        // Create auth user using admin client
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
                full_name,
                role: 'teacher',
                approval_status: 'approved'
            }
        });

        if (createError) {
            console.error('Error creating user:', createError);
            return NextResponse.json(
                { error: createError.message },
                { status: 400 }
            );
        }

        // The profile should be created by the database trigger, but let's update it to be safe
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: newUser.user.id,
                email,
                full_name,
                role: 'teacher',
                approval_status: 'approved',
                is_admin: false
            }, { onConflict: 'id' });

        if (updateError) {
            console.error('Error updating profile:', updateError);
            // Don't fail - the trigger should have created the profile
        }

        return NextResponse.json({
            success: true,
            message: 'Teacher created successfully',
            user: {
                id: newUser.user.id,
                email: newUser.user.email
            }
        });

    } catch (error: any) {
        console.error('Add teacher error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to add teacher' },
            { status: 500 }
        );
    }
}
