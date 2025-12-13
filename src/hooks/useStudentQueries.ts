"use client";

/**
 * Student Data Queries
 * 
 * React Query hooks for student dashboard with caching.
 * Data appears instantly on tab switch (staleTime from QueryProvider).
 * 
 * @file src/hooks/useStudentQueries.ts
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

// Query keys for cache management
export const studentQueryKeys = {
    profile: ["student", "profile"] as const,
    documents: ["student", "documents"] as const,
    essays: ["student", "essays"] as const,
    universities: ["student", "universities"] as const,
    teacher: ["student", "teacher"] as const,
};

// Types
export interface StudentProfile {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    role: string;
    approval_status: string;
    teacher_id: string | null;
    date_of_birth: string | null;
    gender: string | null;
    nationality: string | null;
    address: string | null;
    preferred_country: string | null;
    preferred_university: string | null;
    preferred_major: string | null;
    budget_min: number | null;
    budget_max: number | null;
    budget_currency: string | null;
    ielts_overall: string | null;
    sat_total: string | null;
    gpa: string | null;
}

export interface StudentDocument {
    id: string;
    student_id: string;
    type: string;
    file_url: string;
    status: string;
    created_at: string;
}

export interface Essay {
    id: string;
    student_id: string;
    title: string;
    content: string;
    word_count: number;
    ai_feedback: string | null;
    created_at: string;
    updated_at: string;
}

export interface University {
    id: string;
    student_id: string;
    name: string;
    country: string;
    program: string;
    status: string;
    deadline: string | null;
    notes: string | null;
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch student profile
 * Cached for instant access on page revisit
 */
export function useStudentProfile() {
    return useQuery({
        queryKey: studentQueryKeys.profile,
        queryFn: async (): Promise<StudentProfile | null> => {
            const supabase = createClient();

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (error) throw error;
            return data;
        },
    });
}

/**
 * Fetch student documents
 */
export function useStudentDocuments() {
    return useQuery({
        queryKey: studentQueryKeys.documents,
        queryFn: async (): Promise<StudentDocument[]> => {
            const supabase = createClient();

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data, error } = await supabase
                .from("student_documents")
                .select("*")
                .eq("student_id", user.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data || [];
        },
    });
}

/**
 * Fetch student essays
 */
export function useStudentEssays() {
    return useQuery({
        queryKey: studentQueryKeys.essays,
        queryFn: async (): Promise<Essay[]> => {
            const supabase = createClient();

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data, error } = await supabase
                .from("essays")
                .select("*")
                .eq("student_id", user.id)
                .order("updated_at", { ascending: false });

            if (error) throw error;
            return data || [];
        },
    });
}

/**
 * Fetch student universities
 */
export function useStudentUniversities() {
    return useQuery({
        queryKey: studentQueryKeys.universities,
        queryFn: async (): Promise<University[]> => {
            const supabase = createClient();

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data, error } = await supabase
                .from("student_universities")
                .select("*")
                .eq("student_id", user.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data || [];
        },
    });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Update student profile
 */
export function useUpdateStudentProfile() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (updates: Partial<StudentProfile>) => {
            const supabase = createClient();

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { error } = await supabase
                .from("profiles")
                .update(updates)
                .eq("id", user.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: studentQueryKeys.profile });
        },
    });
}
