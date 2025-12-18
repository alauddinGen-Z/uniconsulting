/**
 * kanban.ts
 * Server Actions for Kanban Board Operations
 * 
 * CoVe Guarantees:
 *   ✅ Teacher Owner Check: Verifies teacher_id before mutation
 *   ✅ Zod Validation: Invalid status caught before DB
 *   ✅ Cache Invalidation: revalidatePath after success
 */

'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { actionClient } from '@/lib/safe-action';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const ApplicationStatusSchema = z.enum([
    'researching',
    'preparing',
    'submitted',
    'accepted',
    'rejected',
]);

const UpdateStudentStatusSchema = z.object({
    studentId: z.string().uuid('Invalid student ID'),
    newStatus: ApplicationStatusSchema,
});

export type UpdateStudentStatusInput = z.infer<typeof UpdateStudentStatusSchema>;

export type UpdateStudentStatusOutput = {
    success: boolean;
    error?: string;
};

// ============================================
// ACTION: updateStudentStatus
// Moves a student to a new application status
// ============================================

export const updateStudentStatus = actionClient
    .schema(UpdateStudentStatusSchema)
    .action(async ({ parsedInput }): Promise<UpdateStudentStatusOutput> => {
        const { studentId, newStatus } = parsedInput;
        const supabase = await createClient();

        // ============================================
        // STEP 1: Authenticate
        // ============================================

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { success: false, error: 'Authentication required' };
        }

        // ============================================
        // STEP 2: THE "TEACHER OWNER" CHECK
        // Verify the teacher manages this student
        // ============================================

        const { data: profile } = await supabase
            .from('profiles')
            .select('role, is_admin')
            .eq('id', user.id)
            .single();

        // Admins can update any student
        const isAdmin = profile?.is_admin === true;

        if (!isAdmin) {
            // For non-admins, check if they're the assigned teacher
            // Check in profiles table (where students have teacher_id)
            const { count: profileMatch } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('id', studentId)
                .eq('teacher_id', user.id);

            // Also check in students table if it exists
            const { count: studentMatch } = await supabase
                .from('students')
                .select('*', { count: 'exact', head: true })
                .eq('id', studentId)
                .eq('teacher_id', user.id);

            if ((profileMatch ?? 0) === 0 && (studentMatch ?? 0) === 0) {
                console.warn('[Kanban] Unauthorized update attempt:', {
                    teacherId: user.id,
                    studentId
                });
                return { success: false, error: 'Unauthorized: You do not manage this student' };
            }
        }

        // ============================================
        // STEP 3: Update Status
        // Try both tables (profiles and students)
        // ============================================

        // Update in profiles table (existing architecture)
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ approval_status: newStatus })
            .eq('id', studentId);

        // Update in students table (new multi-tenant architecture)
        const { error: studentError } = await supabase
            .from('students')
            .update({ application_status: newStatus })
            .eq('id', studentId);

        // Check if at least one succeeded
        if (profileError && studentError) {
            console.error('[Kanban] Update failed:', profileError?.message || studentError?.message);
            return { success: false, error: 'Failed to update status' };
        }

        // ============================================
        // STEP 4: Update student_universities if exists
        // ============================================

        await supabase
            .from('student_universities')
            .update({ application_status: newStatus })
            .eq('student_id', studentId);

        // ============================================
        // STEP 5: Cache Invalidation
        // ============================================

        revalidatePath('/teacher');
        revalidatePath('/teacher/dashboard');
        revalidatePath('/teacher/students');

        return { success: true };
    });

// ============================================
// ACTION: getKanbanStudents
// Fetches all students for the Kanban board
// ============================================

export const getKanbanStudents = actionClient
    .action(async () => {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { success: false, error: 'Authentication required', students: [] };
        }

        // Check if admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, is_admin')
            .eq('id', user.id)
            .single();

        let query = supabase
            .from('profiles')
            .select('id, full_name, email, approval_status, teacher_id')
            .eq('role', 'student');

        // Non-admins only see their assigned students
        if (!profile?.is_admin) {
            query = query.eq('teacher_id', user.id);
        }

        const { data: students, error } = await query.order('created_at', { ascending: false });

        if (error) {
            return { success: false, error: error.message, students: [] };
        }

        // Transform to Kanban format
        const kanbanStudents = (students || []).map((s) => ({
            id: s.id,
            full_name: s.full_name,
            email: s.email,
            application_status: s.approval_status || 'researching',
        }));

        return { success: true, students: kanbanStudents };
    });

// ============================================
// ACTION: bulkUpdateStatus
// Update multiple students at once
// ============================================

const BulkUpdateSchema = z.object({
    studentIds: z.array(z.string().uuid()),
    newStatus: ApplicationStatusSchema,
});

export const bulkUpdateStatus = actionClient
    .schema(BulkUpdateSchema)
    .action(async ({ parsedInput }) => {
        const { studentIds, newStatus } = parsedInput;
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { success: false, error: 'Authentication required' };
        }

        // Admin check
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single();

        if (!profile?.is_admin) {
            return { success: false, error: 'Admin privileges required for bulk update' };
        }

        const { error } = await supabase
            .from('profiles')
            .update({ approval_status: newStatus })
            .in('id', studentIds);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath('/teacher');
        revalidatePath('/teacher/dashboard');

        return { success: true, updatedCount: studentIds.length };
    });
