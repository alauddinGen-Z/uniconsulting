"use client";

/**
 * Smart Prefetch Hook
 * 
 * Enables hover-based prefetching for navigation links.
 * When a user hovers over a link, data is fetched before they click.
 * 
 * @file src/hooks/usePrefetch.ts
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { studentQueryKeys } from "./useStudentQueries";
import { teacherQueryKeys } from "./useTeacherQueries";

export function usePrefetch() {
    const queryClient = useQueryClient();
    const supabase = createClient();

    /**
     * Prefetch student profile data
     */
    const prefetchStudentProfile = useCallback(async () => {
        await queryClient.prefetchQuery({
            queryKey: studentQueryKeys.profile,
            queryFn: async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return null;

                const { data } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", user.id)
                    .single();

                return data;
            },
            staleTime: 5 * 60 * 1000, // 5 minutes
        });
    }, [queryClient, supabase]);

    /**
     * Prefetch student documents
     */
    const prefetchStudentDocuments = useCallback(async () => {
        await queryClient.prefetchQuery({
            queryKey: studentQueryKeys.documents,
            queryFn: async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return [];

                const { data } = await supabase
                    .from("student_documents")
                    .select("*")
                    .eq("student_id", user.id)
                    .order("created_at", { ascending: false });

                return data || [];
            },
            staleTime: 5 * 60 * 1000,
        });
    }, [queryClient, supabase]);

    /**
     * Prefetch student essays
     */
    const prefetchStudentEssays = useCallback(async () => {
        await queryClient.prefetchQuery({
            queryKey: studentQueryKeys.essays,
            queryFn: async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return [];

                const { data } = await supabase
                    .from("essays")
                    .select("*")
                    .eq("student_id", user.id)
                    .order("updated_at", { ascending: false });

                return data || [];
            },
            staleTime: 5 * 60 * 1000,
        });
    }, [queryClient, supabase]);

    /**
     * Prefetch teacher students data
     */
    const prefetchTeacherStudents = useCallback(async () => {
        await queryClient.prefetchQuery({
            queryKey: teacherQueryKeys.students,
            queryFn: async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return [];

                const { data } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("role", "student")
                    .eq("teacher_id", user.id)
                    .order("created_at", { ascending: false });

                return data || [];
            },
            staleTime: 5 * 60 * 1000,
        });
    }, [queryClient, supabase]);

    /**
     * Prefetch pending students
     */
    const prefetchPendingStudents = useCallback(async () => {
        await queryClient.prefetchQuery({
            queryKey: teacherQueryKeys.pendingStudents,
            queryFn: async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return [];

                const { data } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("role", "student")
                    .eq("teacher_id", user.id)
                    .eq("approval_status", "pending")
                    .order("created_at", { ascending: false });

                return data || [];
            },
            staleTime: 5 * 60 * 1000,
        });
    }, [queryClient, supabase]);

    /**
     * Prefetch data for a specific student route
     */
    const prefetchForStudentRoute = useCallback((route: string) => {
        switch (route) {
            case "profile":
                prefetchStudentProfile();
                break;
            case "documents":
                prefetchStudentDocuments();
                prefetchStudentEssays();
                break;
            case "application":
                // Universities are part of application
                break;
            default:
                prefetchStudentProfile();
        }
    }, [prefetchStudentProfile, prefetchStudentDocuments, prefetchStudentEssays]);

    /**
     * Prefetch data for a specific teacher route
     */
    const prefetchForTeacherRoute = useCallback((route: string) => {
        switch (route) {
            case "students":
                prefetchTeacherStudents();
                break;
            case "pending":
                prefetchPendingStudents();
                break;
            default:
                prefetchTeacherStudents();
        }
    }, [prefetchTeacherStudents, prefetchPendingStudents]);

    return {
        prefetchStudentProfile,
        prefetchStudentDocuments,
        prefetchStudentEssays,
        prefetchTeacherStudents,
        prefetchPendingStudents,
        prefetchForStudentRoute,
        prefetchForTeacherRoute,
    };
}
