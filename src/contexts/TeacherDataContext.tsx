"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
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
    created_at: string;
    teacher_id?: string;
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
    selectedStudentId: string | null;
    setSelectedStudentId: (id: string | null) => void;
    refreshData: () => Promise<void>;
    refreshStudents: () => Promise<void>;  // Alias for refreshData
    updateStudentStatus: (studentId: string, status: 'pending' | 'approved' | 'rejected') => Promise<void>;
    isLoading: boolean;
}

const TeacherDataContext = createContext<TeacherDataContextType | undefined>(undefined);

export function TeacherDataProvider({ children }: { children: ReactNode }) {
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [teacherId, setTeacherId] = useState<string | null>(null);
    const supabase = createClient();

    const fetchStudents = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setTeacherId(user.id);

            // Fetch all students assigned to this teacher
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'student')
                .eq('teacher_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setStudents(data || []);
        } catch (error) {
            console.error("Error fetching students:", error);
        } finally {
            setIsLoading(false);
        }
    }, [supabase]);

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
            await fetchStudents();
        }
    }, [supabase, fetchStudents]);

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

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
        selectedStudentId,
        setSelectedStudentId,
        refreshData: fetchStudents,
        refreshStudents: fetchStudents,  // Alias for refreshData
        updateStudentStatus,
        isLoading
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
