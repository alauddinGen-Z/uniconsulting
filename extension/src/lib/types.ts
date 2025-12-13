/**
 * Type definitions for the extension
 * 
 * @file extension/src/lib/types.ts
 */

// Student profile data structure (matching main app's database schema)
export interface Student {
    id: string
    full_name: string
    email: string
    avatar_url?: string
    phone?: string
    date_of_birth?: string
    nationality?: string
    passport_number?: string
    address?: string
    city?: string
    country?: string
    postal_code?: string

    // Academic info
    high_school_name?: string
    gpa?: number
    graduation_year?: number

    // Test scores
    sat_score?: number
    act_score?: number
    ielts_overall?: number
    toefl_score?: number

    // Parent info
    parent_name?: string
    parent_email?: string
    parent_phone?: string
}

// Field mapping from AI
export interface FieldMapping {
    selector: string
    value: string
    confidence?: number
}

// Message types for communication between popup, background, and content scripts
export type MessageType =
    | { type: 'SCAN_PAGE' }
    | { type: 'SCAN_PAGE_RESULT', data: FormElement[] }
    | { type: 'FILL_PAGE', mapping: FieldMapping[] }
    | { type: 'FILL_PAGE_RESULT', success: boolean, filled: number }
    | { type: 'GET_SESSION' }
    | { type: 'SESSION_RECEIVED', session: { access_token: string, refresh_token: string } }
    | { type: 'AUTH_STATUS', authenticated: boolean, user: any }

// Form element extracted from the page
export interface FormElement {
    selector: string
    tagName: string
    type?: string
    id?: string
    name?: string
    placeholder?: string
    label?: string
    ariaLabel?: string
    value?: string
}
