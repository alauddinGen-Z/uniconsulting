/**
 * Application Configuration
 * 
 * Environment-based configuration values.
 * Import from '@/lib/config' or '@/lib'.
 */

// ============================================
// SUPABASE CONFIG
// ============================================

export const SUPABASE_CONFIG = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
} as const;

// ============================================
// FEATURE FLAGS
// ============================================

export const FEATURES = {
    AI_ESSAY_REVIEW: true,
    DOCUMENT_OCR: true,
    UNIVERSITY_MATCHER: true,
} as const;

// ============================================
// API ENDPOINTS
// ============================================

export const API_ENDPOINTS = {
    APPROVE_STUDENT: '/api/approve-student',
    AI_REVIEW: '/api/ai-review',
    DOCUMENT_OCR: '/api/document-ocr',
    UNIVERSITY_MATCHER: '/api/university-matcher',
} as const;

// ============================================
// EXTERNAL LINKS
// ============================================

export const EXTERNAL_LINKS = {
    SUPABASE_DASHBOARD: 'https://supabase.com/dashboard/project/ylwyuogdfwugjexyhtrq',
} as const;
