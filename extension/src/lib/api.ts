/**
 * API client for communicating with the main Next.js backend
 * 
 * @file extension/src/lib/api.ts
 */

import type { FieldMapping, FormElement, Student } from './types'
import { getSession } from './supabase'

// API base URL (defaults to localhost for development)
const API_BASE_URL = process.env.PLASMO_PUBLIC_API_URL || 'http://localhost:3000'

/**
 * Call the AI field mapping endpoint
 */
export async function mapFormFields(
    formElements: FormElement[],
    studentData: Partial<Student>
): Promise<FieldMapping[]> {
    const session = await getSession()

    if (!session) {
        throw new Error('User not authenticated')
    }

    // Create a simplified HTML context from form elements
    const htmlContext = formElements.map(el => {
        const parts = [`<${el.tagName.toLowerCase()}`]
        if (el.id) parts.push(`id="${el.id}"`)
        if (el.name) parts.push(`name="${el.name}"`)
        if (el.type) parts.push(`type="${el.type}"`)
        if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`)
        if (el.label) parts.push(`label="${el.label}"`)
        if (el.ariaLabel) parts.push(`aria-label="${el.ariaLabel}"`)
        parts.push('/>')
        return parts.join(' ')
    }).join('\n')

    const response = await fetch(`${API_BASE_URL}/api/ai/map-fields`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
            html_context: htmlContext,
            student_data: studentData,
        }),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error.error || `API error: ${response.status}`)
    }

    const result = await response.json()
    return result.mapping
}

/**
 * Fetch the student profile from the database
 */
export async function fetchStudentProfile(studentId?: string): Promise<Student | null> {
    const session = await getSession()

    if (!session) {
        throw new Error('User not authenticated')
    }

    // Import supabase client
    const { getSupabaseClient } = await import('./supabase')
    const supabase = getSupabaseClient()

    const targetId = studentId || session.user.id

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetId)
        .single()

    if (error) {
        console.error('[API] Error fetching student profile:', error)
        return null
    }

    return data as Student
}

/**
 * Fetch all students for a teacher (consultant mode)
 */
export async function fetchTeacherStudents(): Promise<Student[]> {
    const session = await getSession()

    if (!session) {
        throw new Error('User not authenticated')
    }

    const { getSupabaseClient } = await import('./supabase')
    const supabase = getSupabaseClient()

    // Check if user is a teacher
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

    if (profile?.role !== 'teacher') {
        return []
    }

    // Fetch students assigned to this teacher
    const { data: students, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('teacher_id', session.user.id)
        .eq('role', 'student')
        .eq('approval_status', 'approved')

    if (error) {
        console.error('[API] Error fetching teacher students:', error)
        return []
    }

    return students as Student[]
}
