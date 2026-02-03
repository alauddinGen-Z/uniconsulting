"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

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
            // Listen for new students assigned to this teacher
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'profiles',
                filter: `teacher_id=eq.${teacherId}`
            }, (payload) => {
                console.log('New student added:', payload);
                setStudents(prev => [payload.new as Student, ...prev]);
                toast.success('New student registered!');
            })
            // Listen for updates to students already in our list
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `teacher_id=eq.${teacherId}`
            }, (payload) => {
                console.log('Student updated:', payload);
                const newData = payload.new as Student;
                const oldData = payload.old as Student;

                // Check if student was TRANSFERRED TO this teacher (teacher_id changed)
                if (oldData.teacher_id !== teacherId && newData.teacher_id === teacherId) {
                    // New student transferred to us - add to list
                    setStudents(prev => {
                        // Check if already in list
                        if (prev.some(s => s.id === newData.id)) {
                            return prev.map(s => s.id === newData.id ? newData : s);
                        }
                        return [newData, ...prev];
                    });
                    toast.success('New student transferred to you!');
                } else if (newData.teacher_id !== teacherId) {
                    // Student was transferred AWAY from us - remove from list
                    setStudents(prev => prev.filter(s => s.id !== newData.id));
                } else {
                    // Normal update - student still belongs to us
                    setStudents(prev => prev.map(s =>
                        s.id === newData.id ? { ...s, ...newData } : s
                    ));
                }
            })
            // Listen for deletions
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

        // Second channel: Listen for ALL student profile updates to catch teacher changes
        // This catches students switching TO this teacher (which the filtered subscription misses)
        const transferChannel = supabase
            .channel('teacher-transfer-sync')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `role=eq.student`
            }, (payload) => {
                const newData = payload.new as Student;
                const oldData = payload.old as Partial<Student>;

                // Check if student was transferred TO this teacher
                if (oldData.teacher_id !== teacherId && newData.teacher_id === teacherId) {
                    console.log('Student transferred to this teacher:', newData);
                    setStudents(prev => {
                        if (prev.some(s => s.id === newData.id)) {
                            return prev.map(s => s.id === newData.id ? newData : s);
                        }
                        return [newData, ...prev];
                    });
                    toast.success(`${newData.full_name || 'A student'} transferred to you!`);
                }
                // Check if student was transferred AWAY from this teacher
                else if (oldData.teacher_id === teacherId && newData.teacher_id !== teacherId) {
                    console.log('Student transferred away from this teacher:', newData);
                    setStudents(prev => prev.filter(s => s.id !== newData.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(transferChannel);
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
