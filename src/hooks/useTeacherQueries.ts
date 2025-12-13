/**
 * Teacher Data Queries
 * 
 * React Query hooks for teacher dashboard with caching.
 * Data appears instantly on tab switch (staleTime from QueryProvider).
 * 
 * @file src/hooks/useTeacherQueries.ts
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

// Query keys for cache management
export const teacherQueryKeys = {
    students: ["teacher", "students"] as const,
    pendingStudents: ["teacher", "pendingStudents"] as const,
    stats: ["teacher", "stats"] as const,
    activities: ["teacher", "activities"] as const,
    deadlines: ["teacher", "deadlines"] as const,
};

// Types
export interface Student {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    approval_status: 'pending' | 'approved' | 'rejected';
    preferred_country?: string;
    preferred_university?: string;
    preferred_major?: string;
    gpa?: number;
    ielts_overall?: number;
    sat_total?: number;
    toefl_total?: number;
    created_at: string;
    teacher_id?: string;
}

export interface DashboardStats {
    totalStudents: number;
    pendingApprovals: number;
    approvedStudents: number;
    totalDocuments: number;
    completedApplications: number;
    upcomingDeadlines: number;
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch all students for the teacher
 * Cached for instant access on tab switch
 */
export function useStudents() {
    return useQuery({
        queryKey: teacherQueryKeys.students,
        queryFn: async (): Promise<Student[]> => {
            const supabase = createClient();

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("role", "student")
                .eq("teacher_id", user.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data || [];
        },
    });
}

/**
 * Fetch only pending students
 */
export function usePendingStudents() {
    return useQuery({
        queryKey: teacherQueryKeys.pendingStudents,
        queryFn: async (): Promise<Student[]> => {
            const supabase = createClient();

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("role", "student")
                .eq("teacher_id", user.id)
                .eq("approval_status", "pending")
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data || [];
        },
    });
}

/**
 * Fetch dashboard statistics
 * Aggregated stats for the dashboard cards
 */
export function useDashboardStats() {
    return useQuery({
        queryKey: teacherQueryKeys.stats,
        queryFn: async (): Promise<DashboardStats> => {
            const supabase = createClient();

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            // Fetch students
            const { data: students } = await supabase
                .from("profiles")
                .select("id, approval_status")
                .eq("role", "student")
                .eq("teacher_id", user.id);

            const studentList = students || [];
            const studentIds = studentList.map(s => s.id);

            // Fetch documents count
            let totalDocuments = 0;
            if (studentIds.length > 0) {
                const { count } = await supabase
                    .from("student_documents")
                    .select("*", { count: "exact", head: true })
                    .in("student_id", studentIds);
                totalDocuments = count || 0;
            }

            return {
                totalStudents: studentList.length,
                pendingApprovals: studentList.filter(s => s.approval_status === "pending").length,
                approvedStudents: studentList.filter(s => s.approval_status === "approved").length,
                totalDocuments,
                completedApplications: 0,
                upcomingDeadlines: 0,
            };
        },
    });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Approve/reject a student
 * Optimistically updates the cache
 */
export function useUpdateStudentStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ studentId, status }: { studentId: string; status: 'approved' | 'rejected' }) => {
            const supabase = createClient();

            const { error } = await supabase
                .from("profiles")
                .update({ approval_status: status })
                .eq("id", studentId);

            if (error) throw error;
        },
        onSuccess: () => {
            // Invalidate related queries to refetch fresh data
            queryClient.invalidateQueries({ queryKey: teacherQueryKeys.students });
            queryClient.invalidateQueries({ queryKey: teacherQueryKeys.pendingStudents });
            queryClient.invalidateQueries({ queryKey: teacherQueryKeys.stats });
        },
    });
}
