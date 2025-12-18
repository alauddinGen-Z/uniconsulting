/**
 * Database Types - Supabase Table Definitions
 * 
 * These types mirror the Supabase database schema.
 * Import from '@/types' for type-safe database operations.
 */

// ============================================
// AGENCY TYPES (Multi-tenant)
// ============================================

export interface Agency {
    id: string;
    name: string;
    domain: string | null;
    created_at: string;
}

// ============================================
// USER & PROFILE TYPES
// ============================================

export type UserRole = 'owner' | 'teacher' | 'student';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
    id: string;
    agency_id: string | null; // Multi-tenant: links to agencies table
    role: UserRole;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    approval_status: ApprovalStatus;
    teacher_id: string | null;

    // Student-specific fields
    passport_number: string | null;
    home_address: string | null;
    preferred_country: string | null;
    preferred_university: string | null;
    city_of_birth: string | null;
    date_of_birth: string | null;

    // Family fields
    father_name: string | null;
    father_occupation: string | null;
    mother_name: string | null;
    mother_occupation: string | null;

    created_at: string;
    updated_at: string;
    is_admin?: boolean;
}

// ============================================
// DOCUMENT TYPES
// ============================================

export type DocumentType = 'passport' | 'diploma' | 'transcript' | 'certificate' | 'photo' | 'other';

export interface Document {
    id: string;
    agency_id: string | null; // Multi-tenant
    student_id: string;
    type: DocumentType;
    file_name: string;
    file_url: string;
    file_size: number;
    uploaded_at: string;
}

// ============================================
// ESSAY TYPES
// ============================================

export interface Essay {
    id: string;
    agency_id: string | null; // Multi-tenant
    student_id: string;
    title: string;
    content: string;
    word_count: number;
    ai_feedback: string | null;
    created_at: string;
    updated_at: string;
}

// ============================================
// UNIVERSITY TYPES
// ============================================

export type ApplicationStatus = 'researching' | 'applying' | 'applied' | 'accepted' | 'rejected';

export interface University {
    id: string;
    student_id: string;
    name: string;
    country: string;
    program: string | null;
    deadline: string | null;
    status: ApplicationStatus;
    notes: string | null;
    created_at: string;
}

// ============================================
// ACADEMIC TYPES
// ============================================

export interface AcademicScore {
    id: string;
    student_id: string;

    // IELTS scores
    ielts_overall: number | null;
    ielts_reading: number | null;
    ielts_writing: number | null;
    ielts_listening: number | null;
    ielts_speaking: number | null;

    // GPA
    gpa: number | null;
    gpa_scale: number | null; // e.g., 4.0 or 5.0

    created_at: string;
    updated_at: string;
}

// ============================================
// CHAT TYPES
// ============================================

export type ConversationType = 'direct' | 'group';

export interface Conversation {
    id: string;
    type: ConversationType;
    name: string | null; // null for direct, name for group
    teacher_id: string;
    created_at: string;
    updated_at: string;
}

export interface ConversationParticipant {
    id: string;
    conversation_id: string;
    user_id: string;
    joined_at: string;
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    is_announcement: boolean;
    created_at: string;
}

// ============================================
// STUDENT TYPES (Agency-scoped)
// ============================================

export type StudentStatus = 'active' | 'inactive' | 'graduated';
export type StudentApplicationStatus = 'researching' | 'preparing' | 'submitted' | 'accepted' | 'rejected' | 'waitlisted';

export interface Student {
    id: string;
    agency_id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    status: StudentStatus;
    application_status: StudentApplicationStatus;
    teacher_id: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface StudentWithTeacher extends Student {
    teacher?: Pick<Profile, 'id' | 'full_name' | 'email'>;
}

// ============================================
// EXTENDED TYPES (with joins)
// ============================================

export interface ProfileWithTeacher extends Profile {
    teacher?: Pick<Profile, 'id' | 'full_name' | 'email'>;
}

export interface MessageWithSender extends Message {
    sender_name?: string;
    sender_role?: UserRole;
}

export interface ConversationWithMeta extends Conversation {
    last_message?: Message;
    unread_count?: number;
    participants?: ConversationParticipant[];
}
