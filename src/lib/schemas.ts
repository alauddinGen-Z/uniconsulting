/**
 * Zod Schemas - Validation schemas for all entities
 * 
 * Schema-First Directive: Always define Zod schema before Server Action logic.
 * These schemas provide runtime validation and TypeScript inference.
 */

import { z } from "zod";

// ============================================
// AGENCY SCHEMAS
// ============================================

export const AgencySchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(2, "Agency name must be at least 2 characters"),
    domain: z.string().optional().nullable(),
    created_at: z.string().datetime().optional(),
});

export const CreateAgencySchema = z.object({
    name: z.string().min(2, "Agency name must be at least 2 characters"),
    domain: z.string().optional(),
});

export type Agency = z.infer<typeof AgencySchema>;
export type CreateAgencyInput = z.infer<typeof CreateAgencySchema>;

// ============================================
// PROFILE SCHEMAS
// ============================================

export const UserRoleSchema = z.enum(["owner", "teacher", "student"]);

export const ProfileSchema = z.object({
    id: z.string().uuid(),
    agency_id: z.string().uuid().nullable(),
    role: UserRoleSchema,
    full_name: z.string().nullable(),
    email: z.string().email().nullable(),
    phone: z.string().nullable().optional(),
    created_at: z.string().datetime().optional(),
});

export const UpdateProfileSchema = z.object({
    full_name: z.string().min(2).optional(),
    phone: z.string().optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

// ============================================
// STUDENT SCHEMAS
// ============================================

export const StudentStatusSchema = z.enum(["active", "inactive", "graduated"]);

export const ApplicationStatusSchema = z.enum([
    "researching",
    "preparing",
    "submitted",
    "accepted",
    "rejected",
    "waitlisted",
]);

export const StudentSchema = z.object({
    id: z.string().uuid(),
    agency_id: z.string().uuid(),
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
    status: StudentStatusSchema,
    application_status: ApplicationStatusSchema,
    teacher_id: z.string().uuid().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
});

export const CreateStudentSchema = z.object({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    status: StudentStatusSchema.optional().default("active"),
    application_status: ApplicationStatusSchema.optional().default("researching"),
    teacher_id: z.string().uuid().optional(),
    notes: z.string().optional(),
});

export const UpdateStudentSchema = z.object({
    id: z.string().uuid(),
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    status: StudentStatusSchema.optional(),
    application_status: ApplicationStatusSchema.optional(),
    teacher_id: z.string().uuid().nullable().optional(),
    notes: z.string().optional(),
});

export const UpdateStudentStageSchema = z.object({
    studentId: z.string().uuid(),
    newStage: ApplicationStatusSchema,
});

export type Student = z.infer<typeof StudentSchema>;
export type StudentStatus = z.infer<typeof StudentStatusSchema>;
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;
export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;
export type UpdateStudentStageInput = z.infer<typeof UpdateStudentStageSchema>;

// ============================================
// ESSAY SCHEMAS
// ============================================

export const EssaySchema = z.object({
    id: z.string().uuid(),
    agency_id: z.string().uuid().nullable().optional(),
    student_id: z.string().uuid(),
    title: z.string().min(1, "Title is required"),
    content: z.string().nullable(),
    word_count: z.number().int().nonnegative().optional(),
    ai_feedback: z.any().nullable().optional(), // JSONB
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
});

export const CreateEssaySchema = z.object({
    title: z.string().min(1, "Title is required"),
    content: z.string().optional(),
});

export const UpdateEssaySchema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1).optional(),
    content: z.string().optional(),
});

export const RequestAIReviewSchema = z.object({
    essayId: z.string().uuid(),
});

export type Essay = z.infer<typeof EssaySchema>;
export type CreateEssayInput = z.infer<typeof CreateEssaySchema>;
export type UpdateEssayInput = z.infer<typeof UpdateEssaySchema>;
export type RequestAIReviewInput = z.infer<typeof RequestAIReviewSchema>;

// ============================================
// AUTH SCHEMAS
// ============================================

export const SignupSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    fullName: z.string().min(2, "Name must be at least 2 characters"),
    role: z.enum(["owner", "teacher"]),
    agencyId: z.string().uuid().optional(), // For joining existing agency
    agencyName: z.string().min(2).optional(), // For creating new agency (owner only)
}).refine(
    (data) => {
        // Owner must provide agency name
        if (data.role === "owner" && !data.agencyName) {
            return false;
        }
        // Teacher must provide agency ID
        if (data.role === "teacher" && !data.agencyId) {
            return false;
        }
        return true;
    },
    {
        message: "Owners must provide agency name, teachers must provide agency ID",
        path: ["agencyId"],
    }
);

export const LoginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
});

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

// ============================================
// UTILITY SCHEMAS
// ============================================

export const PaginationSchema = z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
});

export const IdSchema = z.object({
    id: z.string().uuid(),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;
export type IdInput = z.infer<typeof IdSchema>;
