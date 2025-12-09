"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface Student {
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

interface TeacherProfile {
    id: string;
    full_name: string;
    email: string;
    is_admin: boolean;
}

interface TeacherDataContextType {
    students: Student[];
    pendingStudents: Student[];
    stats: {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
    };
    teacherProfile: TeacherProfile | null;
    selectedStudentId: string | null;
    setSelectedStudentId: (id: string | null) => void;
    refreshData: () => Promise<void>;
    refreshStudents: () => Promise<void>;  // Alias for refreshData
    smartRefresh: () => Promise<void>;     // Only refreshes if data is stale
    updateStudentStatus: (studentId: string, status: 'pending' | 'approved' | 'rejected') => Promise<void>;
    isLoading: boolean;        // True only on initial load
    isRefreshing: boolean;     // True during background refresh
    isDataReady: boolean;      // True once initial data is loaded
    lastFetchedAt: number | null; // Timestamp of last successful fetch
}

const TeacherDataContext = createContext<TeacherDataContextType | undefined>(undefined);

// Data freshness threshold: 5 minutes in milliseconds
const DATA_FRESHNESS_THRESHOLD = 5 * 60 * 1000;

export function TeacherDataProvider({ children }: { children: ReactNode }) {
    const [students, setStudents] = useState<Student[]>([]);
    const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [teacherId, setTeacherId] = useState<string | null>(null);
    const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
    const hasInitialized = useRef(false);
    const supabase = createClient();

    const fetchAllData = useCallback(async (isInitial = false) => {
        if (isInitial) {
            setIsLoading(true);
        } else {
            setIsRefreshing(true);
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setTeacherId(user.id);

            // Fetch teacher profile and students in parallel for speed
            const [profileResult, studentsResult] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id, full_name, email, is_admin')
                    .eq('id', user.id)
                    .single(),
                supabase
                    .from('profiles')
                    .select('*')
                    .eq('role', 'student')
                    .eq('teacher_id', user.id)
                    .order('created_at', { ascending: false })
            ]);

            if (profileResult.data) {
                setTeacherProfile(profileResult.data as TeacherProfile);
            }

            if (studentsResult.data) {
                setStudents(studentsResult.data);
            }

            // Mark data as fresh
            setLastFetchedAt(Date.now());
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [supabase]);

    // Smart refresh: only fetches if data is stale (older than threshold)
    const smartRefresh = useCallback(async () => {
        // Skip if data is still fresh
        if (lastFetchedAt && (Date.now() - lastFetchedAt) < DATA_FRESHNESS_THRESHOLD) {
            console.log('Data is fresh, skipping refetch');
            return;
        }
        // Data is stale, do a background refresh
        await fetchAllData(false);
    }, [lastFetchedAt, fetchAllData]);

    // Optimistic update for student status - updates UI immediately, then syncs to DB
    const updateStudentStatus = useCallback(async (studentId: string, newStatus: 'pending' | 'approved' | 'rejected') => {
        // Optimistic update - update local state immediately for fast UI
        setStudents(prev => prev.map(s =>
            s.id === studentId ? { ...s, approval_status: newStatus } : s
        ));

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ approval_status: newStatus })
                .eq('id', studentId);

            if (error) throw error;

            // Success - no need to refetch, optimistic update is correct
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error("Failed to update status. Reverting...");
            // Revert on error - refetch to get correct state
            await fetchAllData();
        }
    }, [supabase, fetchAllData]);

    useEffect(() => {
        if (!hasInitialized.current) {
            hasInitialized.current = true;
            fetchAllData(true); // Initial load
        }
    }, [fetchAllData]);

    // Set up real-time subscription
    useEffect(() => {
        if (!teacherId) return;

        const channel = supabase
            .channel('teacher-realtime-sync')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'profiles',
                filter: `teacher_id=eq.${teacherId}`
            }, (payload) => {
                console.log('New student added:', payload);
                // Add new student to list
                setStudents(prev => [payload.new as Student, ...prev]);
                toast.success('New student registered!');
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `teacher_id=eq.${teacherId}`
            }, (payload) => {
                console.log('Student updated:', payload);
                // Update student in list (if not from our own optimistic update)
                setStudents(prev => prev.map(s =>
                    s.id === payload.new.id ? { ...s, ...payload.new } as Student : s
                ));
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'profiles',
                filter: `teacher_id=eq.${teacherId}`
            }, (payload) => {
                console.log('Student removed:', payload);
                setStudents(prev => prev.filter(s => s.id !== payload.old.id));
            })
            .subscribe((status) => {
                console.log('Realtime subscription status:', status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [teacherId, supabase]);

    // Computed values
    const pendingStudents = students.filter(s => s.approval_status === 'pending');
    const stats = {
        total: students.length,
        pending: pendingStudents.length,
        approved: students.filter(s => s.approval_status === 'approved').length,
        rejected: students.filter(s => s.approval_status === 'rejected').length
    };

    const value = {
        students,
        pendingStudents,
        stats,
        teacherProfile,
        selectedStudentId,
        setSelectedStudentId,
        refreshData: () => fetchAllData(false),
        refreshStudents: () => fetchAllData(false),  // Alias for refreshData
        smartRefresh,
        updateStudentStatus,
        isLoading,
        isRefreshing,
        isDataReady: !isLoading && students.length >= 0,
        lastFetchedAt
    };

    return (
        <TeacherDataContext.Provider value={value}>
            {children}
        </TeacherDataContext.Provider>
    );
}

export function useTeacherData() {
    const context = useContext(TeacherDataContext);
    if (context === undefined) {
        throw new Error('useTeacherData must be used within a TeacherDataProvider');
    }
    return context;
}
