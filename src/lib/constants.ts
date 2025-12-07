/**
 * Application Constants
 * 
 * Centralized constants to avoid hardcoded values throughout the app.
 * Import from '@/lib/constants' or '@/lib'.
 */

// ============================================
// THEME & COLORS
// ============================================

export const COLORS = {
    primary: '#E65100',      // Orange theme color
    primaryLight: '#FF9800',
    accent: '#FFEB3B',       // Yellow accent
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
} as const;

// ============================================
// USER ROLES
// ============================================

export const USER_ROLES = {
    STUDENT: 'student',
    TEACHER: 'teacher',
} as const;

export const APPROVAL_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
} as const;

// ============================================
// NAVIGATION
// ============================================

export const STUDENT_NAV_ITEMS = [
    { id: 'home', label: 'Home' },
    { id: 'profile', label: 'Profile' },
    { id: 'application', label: 'Application' },
    { id: 'documents', label: 'Documents' },
    { id: 'messages', label: 'Chat' },
] as const;

export const TEACHER_NAV_ITEMS = [
    { id: 'dashboard', label: 'Command Center' },
    { id: 'students', label: 'All Students' },
    { id: 'messages', label: 'Messages' },
    { id: 'automation', label: 'Automation' },
] as const;

// ============================================
// DOCUMENT TYPES
// ============================================

export const DOCUMENT_TYPES = [
    { value: 'passport', label: 'Passport' },
    { value: 'diploma', label: 'Diploma' },
    { value: 'transcript', label: 'Transcript' },
    { value: 'certificate', label: 'Certificate' },
    { value: 'photo', label: 'Photo' },
    { value: 'other', label: 'Other' },
] as const;

// ============================================
// APPLICATION STATUS
// ============================================

export const APPLICATION_STATUSES = [
    { value: 'researching', label: 'Researching', color: 'slate' },
    { value: 'applying', label: 'Applying', color: 'blue' },
    { value: 'applied', label: 'Applied', color: 'purple' },
    { value: 'accepted', label: 'Accepted', color: 'green' },
    { value: 'rejected', label: 'Rejected', color: 'red' },
] as const;

// ============================================
// LIMITS & DEFAULTS
// ============================================

export const LIMITS = {
    MAX_FILE_SIZE_MB: 10,
    MAX_ESSAY_WORDS: 5000,
    MIN_ESSAY_WORDS: 50,
    MAX_UNIVERSITIES: 20,
} as const;

export const DEFAULTS = {
    WELCOME_MESSAGE: "Welcome! Your account has been approved. Feel free to message me if you have any questions.",
    ESSAY_PLACEHOLDER: "Start writing your essay here...",
} as const;

// ============================================
// SUPABASE TABLES
// ============================================

export const TABLES = {
    PROFILES: 'profiles',
    DOCUMENTS: 'documents',
    ESSAYS: 'essays',
    ESSAY_VERSIONS: 'essay_versions',
    UNIVERSITIES: 'universities',
    ACADEMIC_SCORES: 'academic_scores',
    CONVERSATIONS: 'conversations',
    CONVERSATION_PARTICIPANTS: 'conversation_participants',
    MESSAGES: 'messages',
} as const;

// ============================================
// GAMIFICATION (XP SYSTEM)
// ============================================

export const XP_REWARDS = {
    SAVE_ESSAY: 10,
    UPLOAD_DOCUMENT: 25,
    COMPLETE_PROFILE_TAB: 50,
    GET_AI_FEEDBACK: 15,
    FIRST_LOGIN: 100,
    ADD_UNIVERSITY: 20,
} as const;

export const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2500, 4000] as const;

export const LEVEL_NAMES = [
    'Newcomer',
    'Explorer',
    'Rising Star',
    'Achiever',
    'Scholar',
    'Expert',
    'Master',
    'Legend',
] as const;

