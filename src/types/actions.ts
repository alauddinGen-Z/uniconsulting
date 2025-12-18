/**
 * actions.ts
 * Type definitions for Server Actions
 * 
 * Schema-First Directive: Define Zod schemas before action logic
 */

import { z } from 'zod';

// ============================================
// ADMIN: Toggle User Role
// ============================================

export const ToggleUserRoleSchema = z.object({
    userId: z.string().uuid('Invalid user ID format'),
    isAdmin: z.boolean(),
});

export type ToggleUserRoleInput = z.infer<typeof ToggleUserRoleSchema>;

export type ToggleUserRoleOutput = {
    success: boolean;
    userId: string;
    isAdmin: boolean;
    message: string;
};

// ============================================
// ADMIN: Update User Profile
// ============================================

export const AdminUpdateProfileSchema = z.object({
    userId: z.string().uuid('Invalid user ID format'),
    role: z.enum(['owner', 'teacher', 'student']).optional(),
    isAdmin: z.boolean().optional(),
    approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
    teacherId: z.string().uuid().nullable().optional(),
});

export type AdminUpdateProfileInput = z.infer<typeof AdminUpdateProfileSchema>;

export type AdminUpdateProfileOutput = {
    success: boolean;
    userId: string;
    message: string;
};

// ============================================
// ADMIN: List All Users
// ============================================

export const ListUsersSchema = z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    role: z.enum(['owner', 'teacher', 'student']).optional(),
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

export type ListUsersInput = z.infer<typeof ListUsersSchema>;

// ============================================
// TEACHER: Approve/Reject Student
// ============================================

export const ApproveStudentSchema = z.object({
    studentId: z.string().uuid('Invalid student ID format'),
    action: z.enum(['approve', 'reject']),
    reason: z.string().optional(),
});

export type ApproveStudentInput = z.infer<typeof ApproveStudentSchema>;

export type ApproveStudentOutput = {
    success: boolean;
    studentId: string;
    newStatus: 'approved' | 'rejected';
    message: string;
};
