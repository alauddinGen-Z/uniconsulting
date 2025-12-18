/**
 * useTeacherDashboard.ts
 * TanStack Query v5 + Supabase Realtime
 * 
 * CoVe Guarantees:
 *   ✅ Cache Staleness: Realtime subscription invalidates queries instantly
 *   ✅ Memory Leaks: Proper cleanup in useEffect return
 *   ✅ Type Safety: Strict Profile typing, no 'any'
 */

'use client';

import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { Profile } from '@/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// QUERY KEYS (Centralized for cache management)
// ============================================

export const teacherKeys = {
    all: ['teacher'] as const,
    dashboard: () => [...teacherKeys.all, 'dashboard'] as const,
    pendingStudents: (teacherId: string) => [...teacherKeys.dashboard(), 'pending', teacherId] as const,
    allStudents: (teacherId: string) => [...teacherKeys.dashboard(), 'students', teacherId] as const,
    studentDetail: (studentId: string) => [...teacherKeys.all, 'student', studentId] as const,
} as const;

// ============================================
// TYPES
// ============================================

export interface TeacherDashboardStudent extends Profile {
    documents_count?: number;
    essays_count?: number;
}

interface UseTeacherStudentsOptions {
    teacherId: string | undefined;
    enabled?: boolean;
}

interface UseTeacherStudentsResult {
    students: TeacherDashboardStudent[];
    count: number;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => void;
}

// ============================================
// HOOK: usePendingStudents
// Fetches students with approval_status = 'pending'
// ============================================

export function usePendingStudents(
    options: UseTeacherStudentsOptions
): UseTeacherStudentsResult {
    const { teacherId, enabled = true } = options;
    const queryClient = useQueryClient();
    const supabase = createClient();
    const channelRef = useRef<RealtimeChannel | null>(null);

    // Query function with strict typing
    const queryFn = useCallback(async (): Promise<TeacherDashboardStudent[]> => {
        if (!teacherId) throw new Error('Teacher ID is required');

        const { data, error } = await supabase
            .from('profiles')
            .select(`
        *,
        documents:documents(count),
        essays:essays(count)
      `)
            .eq('role', 'student')
            .eq('teacher_id', teacherId)
            .eq('approval_status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        // Transform and type the response
        return (data || []).map((student): TeacherDashboardStudent => ({
            ...student,
            documents_count: (student.documents as { count: number }[])?.[0]?.count ?? 0,
            essays_count: (student.essays as { count: number }[])?.[0]?.count ?? 0,
        }));
    }, [teacherId, supabase]);

    // TanStack Query with proper typing
    const query: UseQueryResult<TeacherDashboardStudent[], Error> = useQuery({
        queryKey: teacherKeys.pendingStudents(teacherId ?? ''),
        queryFn,
        enabled: enabled && !!teacherId,
        staleTime: 60_000, // 1 minute
        gcTime: 5 * 60_000, // 5 minutes (formerly cacheTime)
        retry: 2,
        refetchOnWindowFocus: true,
    });

    // ============================================
    // REALTIME SUBSCRIPTION (Cache Staleness Fix)
    // ============================================
    useEffect(() => {
        // Guard: Don't subscribe if disabled or no teacherId
        if (!enabled || !teacherId) {
            return;
        }

        // Create unique channel name
        const channelName = `pending-students-${teacherId}-${Date.now()}`;

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'profiles',
                    filter: `teacher_id=eq.${teacherId}`,
                },
                (payload) => {
                    console.log('[Realtime] Pending students change:', payload.eventType);
                    // Invalidate to force fresh fetch
                    queryClient.invalidateQueries({
                        queryKey: teacherKeys.pendingStudents(teacherId),
                    });
                    // Also invalidate all students query
                    queryClient.invalidateQueries({
                        queryKey: teacherKeys.allStudents(teacherId),
                    });
                }
            )
            .subscribe((status) => {
                console.log('[Realtime] Subscription status:', status);
            });

        // Store ref for cleanup
        channelRef.current = channel;

        // ============================================
        // CLEANUP (Memory Leak Prevention)
        // ============================================
        return () => {
            if (channelRef.current) {
                console.log('[Realtime] Cleaning up channel:', channelName);
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [teacherId, enabled, queryClient, supabase]);

    return {
        students: query.data ?? [],
        count: query.data?.length ?? 0,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
    };
}

// ============================================
// HOOK: useAllStudents
// Fetches ALL students for this teacher (Kanban/List views)
// ============================================

export function useAllStudents(
    options: UseTeacherStudentsOptions
): UseTeacherStudentsResult {
    const { teacherId, enabled = true } = options;
    const queryClient = useQueryClient();
    const supabase = createClient();
    const channelRef = useRef<RealtimeChannel | null>(null);

    const queryFn = useCallback(async (): Promise<TeacherDashboardStudent[]> => {
        if (!teacherId) throw new Error('Teacher ID is required');

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'student')
            .eq('teacher_id', teacherId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        return (data as TeacherDashboardStudent[]) ?? [];
    }, [teacherId, supabase]);

    const query: UseQueryResult<TeacherDashboardStudent[], Error> = useQuery({
        queryKey: teacherKeys.allStudents(teacherId ?? ''),
        queryFn,
        enabled: enabled && !!teacherId,
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: 2,
    });

    // Realtime subscription
    useEffect(() => {
        if (!enabled || !teacherId) return;

        const channelName = `all-students-${teacherId}-${Date.now()}`;

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'profiles',
                    filter: `teacher_id=eq.${teacherId}`,
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: teacherKeys.allStudents(teacherId),
                    });
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [teacherId, enabled, queryClient, supabase]);

    return {
        students: query.data ?? [],
        count: query.data?.length ?? 0,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
    };
}

// ============================================
// HOOK: useDashboardStats (Aggregated)
// ============================================

export interface DashboardStats {
    totalStudents: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    isLoading: boolean;
}

export function useDashboardStats(teacherId: string | undefined): DashboardStats {
    const { students, isLoading: allLoading } = useAllStudents({ teacherId });
    const { count: pendingCount, isLoading: pendingLoading } = usePendingStudents({ teacherId });

    const approvedCount = students.filter(s => s.approval_status === 'approved').length;
    const rejectedCount = students.filter(s => s.approval_status === 'rejected').length;

    return {
        totalStudents: students.length,
        pendingCount,
        approvedCount,
        rejectedCount,
        isLoading: allLoading || pendingLoading,
    };
}

// ============================================
// UTILITY: Prefetch for SSR/Navigation
// ============================================

export function prefetchTeacherDashboard(
    queryClient: ReturnType<typeof useQueryClient>,
    teacherId: string
): void {
    queryClient.prefetchQuery({
        queryKey: teacherKeys.pendingStudents(teacherId),
        queryFn: async () => {
            const supabase = createClient();
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'student')
                .eq('teacher_id', teacherId)
                .eq('approval_status', 'pending');
            return data ?? [];
        },
        staleTime: 60_000,
    });
}
