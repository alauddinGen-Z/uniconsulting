/**
 * user-management.ts
 * Admin Server Actions for User Management
 * 
 * CoVe Guarantees:
 *   ✅ Double-Check: Application-layer auth before DB mutation
 *   ✅ RLS Backup: Even if app check bypassed, RLS blocks unauthorized writes
 *   ✅ Cache Invalidation: revalidatePath for immediate UI refresh
 */

'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { actionClient } from '@/lib/safe-action';
import {
    ToggleUserRoleSchema,
    type ToggleUserRoleOutput,
    ApproveStudentSchema,
    type ApproveStudentOutput,
    AdminUpdateProfileSchema,
    type AdminUpdateProfileOutput,
} from '@/types/actions';

// ============================================
// ACTION: toggleUserRole
// Toggle a user's admin status
// ============================================

export const toggleUserRole = actionClient
    .schema(ToggleUserRoleSchema)
    .action(async ({ parsedInput }): Promise<ToggleUserRoleOutput> => {
        const { userId, isAdmin } = parsedInput;
        const supabase = await createClient();

        // ============================================
        // SECURITY LAYER 1: Application-Level Auth Check
        // Must verify BEFORE any DB mutation
        // ============================================

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            throw new Error('Authentication required');
        }

        // Fetch current user's admin status
        const { data: currentUser, error: profileError } = await supabase
            .from('profiles')
            .select('is_admin, role')
            .eq('id', user.id)
            .single();

        if (profileError || !currentUser) {
            throw new Error('Failed to verify permissions');
        }

        // THE DOUBLE-CHECK: Application-layer authorization
        if (!currentUser.is_admin) {
            throw new Error('Unauthorized: Admin privileges required');
        }

        // Prevent self-demotion (admin cannot remove their own admin status)
        if (userId === user.id && isAdmin === false) {
            throw new Error('Cannot remove your own admin privileges');
        }

        // ============================================
        // SECURITY LAYER 2: RLS-Protected Mutation
        // Even if Layer 1 is bypassed, RLS policies block unauthorized writes
        // ============================================

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ is_admin: isAdmin })
            .eq('id', userId);

        if (updateError) {
            console.error('Toggle admin error:', updateError);
            throw new Error(`Failed to update user: ${updateError.message}`);
        }

        // ============================================
        // CACHE INVALIDATION: Immediate UI Refresh
        // ============================================

        revalidatePath('/teacher/admin');
        revalidatePath('/teacher');
        revalidatePath('/teacher/students');

        return {
            success: true,
            userId,
            isAdmin,
            message: isAdmin
                ? 'User granted admin privileges'
                : 'Admin privileges revoked',
        };
    });

// ============================================
// ACTION: approveStudent
// Approve or reject a student application
// ============================================

export const approveStudent = actionClient
    .schema(ApproveStudentSchema)
    .action(async ({ parsedInput }): Promise<ApproveStudentOutput> => {
        const { studentId, action, reason } = parsedInput;
        const supabase = await createClient();

        // Auth check
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            throw new Error('Authentication required');
        }

        // Verify caller is teacher or admin
        const { data: currentUser, error: profileError } = await supabase
            .from('profiles')
            .select('role, is_admin')
            .eq('id', user.id)
            .single();

        if (profileError || !currentUser) {
            throw new Error('Failed to verify permissions');
        }

        if (currentUser.role !== 'teacher' && !currentUser.is_admin) {
            throw new Error('Unauthorized: Teacher or Admin privileges required');
        }

        // Determine new status
        const newStatus = action === 'approve' ? 'approved' : 'rejected';

        // Update student status
        // Note: The approval trigger will auto-create chat if approved
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                approval_status: newStatus,
                ...(reason && { rejection_reason: reason }),
            })
            .eq('id', studentId)
            .eq('role', 'student'); // Extra safety: only update students

        if (updateError) {
            console.error('Approve student error:', updateError);
            throw new Error(`Failed to update student: ${updateError.message}`);
        }

        // Cache invalidation
        revalidatePath('/teacher');
        revalidatePath('/teacher/students');
        revalidatePath('/teacher/pending');

        return {
            success: true,
            studentId,
            newStatus,
            message: action === 'approve'
                ? 'Student approved successfully'
                : 'Student application rejected',
        };
    });

// ============================================
// ACTION: adminUpdateProfile
// Admin-only: Update any user's profile
// ============================================

export const adminUpdateProfile = actionClient
    .schema(AdminUpdateProfileSchema)
    .action(async ({ parsedInput }): Promise<AdminUpdateProfileOutput> => {
        const { userId, ...updates } = parsedInput;
        const supabase = await createClient();

        // Auth check
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            throw new Error('Authentication required');
        }

        // Admin-only check
        const { data: currentUser, error: profileError } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single();

        if (profileError || !currentUser?.is_admin) {
            throw new Error('Unauthorized: Admin privileges required');
        }

        // Build update object (only include provided fields)
        const updateData: Record<string, unknown> = {};
        if (updates.role !== undefined) updateData.role = updates.role;
        if (updates.isAdmin !== undefined) updateData.is_admin = updates.isAdmin;
        if (updates.approvalStatus !== undefined) updateData.approval_status = updates.approvalStatus;
        if (updates.teacherId !== undefined) updateData.teacher_id = updates.teacherId;

        if (Object.keys(updateData).length === 0) {
            throw new Error('No valid fields to update');
        }

        // Perform update
        const { error: updateError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', userId);

        if (updateError) {
            console.error('Admin update error:', updateError);
            throw new Error(`Failed to update profile: ${updateError.message}`);
        }

        // Cache invalidation
        revalidatePath('/teacher/admin');
        revalidatePath('/teacher');

        return {
            success: true,
            userId,
            message: 'Profile updated successfully',
        };
    });
