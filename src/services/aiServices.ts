"use client";

/**
 * AI Services API Layer
 * 
 * Unified API client for AI features that works both in web and desktop.
 * Uses Supabase Edge Functions for production (static export compatible).
 * 
 * @file src/services/aiServices.ts
 */

import { createClient } from "@/utils/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface AIFeedback {
    overallScore: number;
    overallComment: string;
    strengths?: { point: string; explanation: string }[];
    improvements?: { issue: string; suggestion: string; priority: string }[];
    structure?: { score: number; feedback: string };
    voice?: { score: number; feedback: string };
    impact?: { score: number; feedback: string };
    grammarIssues?: { text: string; suggestion: string }[];
    coachingPrompts?: string[];
    pickupTestFlags?: { sentence: string; reason: string }[];
    rawFeedback?: string;
}

export interface OCRResult {
    success: boolean;
    documentType: string;
    extractedData: Record<string, any>;
    scores?: {
        overall?: number;
        reading?: number;
        writing?: number;
        listening?: number;
        speaking?: number;
        math?: number;
        verbal?: number;
    };
    rawText?: string;
    error?: string;
}

export interface UniversityMatch {
    name: string;
    country: string;
    ranking?: number;
    matchScore: number;
    matchReason: string;
    requirements?: {
        gpa?: number;
        ielts?: number;
        sat?: number;
    };
    tuitionRange?: string;
    applicationDeadline?: string;
}

export interface UniversityMatcherResult {
    universities: UniversityMatch[];
    summary: string;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Check if running in Electron desktop app
 */
function isDesktop(): boolean {
    return typeof window !== 'undefined' && !!(window as any).electron?.isDesktop;
}

/**
 * Get AI Essay Review feedback
 * Uses Supabase Edge Function for production compatibility
 */
export async function getEssayReview(
    content: string,
    essayType: string = "Common App",
    wordLimit: number = 650
): Promise<{ feedback: AIFeedback; error?: string }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase.functions.invoke('ai-review', {
            body: { content, essayType, wordLimit }
        });

        if (error) {
            console.error('[AIServices] Essay review error:', error);
            return {
                feedback: { overallScore: 0, overallComment: '' },
                error: error.message
            };
        }

        return { feedback: data.feedback };
    } catch (err: any) {
        console.error('[AIServices] Essay review exception:', err);
        return {
            feedback: { overallScore: 0, overallComment: '' },
            error: err.message
        };
    }
}

/**
 * Process document with OCR
 * Uses Supabase Edge Function for production compatibility
 */
export async function processDocumentOCR(
    fileBase64: string,
    documentType: string,
    fileName: string
): Promise<OCRResult> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase.functions.invoke('document-ocr', {
            body: { fileBase64, documentType, fileName }
        });

        if (error) {
            console.error('[AIServices] OCR error:', error);
            return {
                success: false,
                documentType,
                extractedData: {},
                error: error.message
            };
        }

        return data;
    } catch (err: any) {
        console.error('[AIServices] OCR exception:', err);
        return {
            success: false,
            documentType,
            extractedData: {},
            error: err.message
        };
    }
}

/**
 * Get AI University Matches
 * Uses Supabase Edge Function for production compatibility
 */
export async function getUniversityMatches(
    studentProfile: {
        gpa?: number;
        ieltsOverall?: number;
        ieltsReading?: number;
        ieltsWriting?: number;
        ieltsListening?: number;
        ieltsSpeaking?: number;
        satTotal?: number;
        satMath?: number;
        satVerbal?: number;
        budget?: number;
        preferredCountries?: string[];
        intendedMajor?: string;
    }
): Promise<UniversityMatcherResult> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase.functions.invoke('university-matcher', {
            body: studentProfile
        });

        if (error) {
            console.error('[AIServices] University matcher error:', error);
            return {
                universities: [],
                summary: `Error: ${error.message}`
            };
        }

        return data;
    } catch (err: any) {
        console.error('[AIServices] University matcher exception:', err);
        return {
            universities: [],
            summary: `Error: ${err.message}`
        };
    }
}

// ============================================================================
// Legacy API Route Wrappers (for backward compatibility during migration)
// ============================================================================

/**
 * @deprecated Use getEssayReview() instead
 * Fallback to API route for web version if Edge Function fails
 */
export async function getEssayReviewLegacy(
    content: string,
    essayType: string = "Common App",
    wordLimit: number = 650
): Promise<{ feedback: AIFeedback; error?: string }> {
    // Try Edge Function first
    const result = await getEssayReview(content, essayType, wordLimit);
    if (!result.error) return result;

    // Fallback to API route (only works in web, not desktop)
    if (isDesktop()) {
        return result; // Can't fallback in desktop mode
    }

    try {
        const response = await fetch('/api/ai-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, essayType, wordLimit })
        });

        const data = await response.json();
        if (!response.ok) {
            return {
                feedback: { overallScore: 0, overallComment: '' },
                error: data.error
            };
        }

        return { feedback: data.feedback };
    } catch (err: any) {
        return {
            feedback: { overallScore: 0, overallComment: '' },
            error: err.message
        };
    }
}
