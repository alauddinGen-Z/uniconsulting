"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

// Types
interface Profile {
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
    passport_number: string | null;
    passport_expiry: string | null;
    home_address: string | null;
    city: string | null;
    country: string | null;
    city_of_birth: string | null;
    // Academic scores
    ielts_overall: string | null;
    ielts_listening: string | null;
    ielts_reading: string | null;
    ielts_writing: string | null;
    ielts_speaking: string | null;
    sat_total: string | null;
    sat_math: string | null;
    sat_reading: string | null;
    gpa: string | null;
    gpa_scale: string | null;
    gpa_9th: string | null;
    gpa_10th: string | null;
    gpa_11th: string | null;
    gpa_12th: string | null;
    school_system: string | null;
    toefl_total: string | null;
    preferred_country: string | null;
    preferred_university: string | null;
}

interface Document {
    id: string;
    student_id: string;
    type: string;
    file_url: string;
    status: string;
    created_at: string;
}

interface Essay {
    id: string;
    student_id: string;
    title: string;
    content: string;
    word_count: number;
    ai_feedback: string | null;
    created_at: string;
    updated_at: string;
}

interface University {
    id: string;
    student_id: string;
    name: string;
    country: string;
    program: string;
    status: string;
    deadline: string | null;
    notes: string | null;
}

interface StudentDataContextType {
    // Data
    profile: Profile | null;
    documents: Document[];
    essays: Essay[];
    universities: University[];
    teacherName: string;

    // State flags
    isLoading: boolean;
    isDataReady: boolean;

    // Actions
    refreshProfile: () => Promise<void>;
    refreshDocuments: () => Promise<void>;
    refreshEssays: () => Promise<void>;
    refreshUniversities: () => Promise<void>;
    refreshAll: () => Promise<void>;

    // Direct setters for optimistic updates
    setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
    setEssays: React.Dispatch<React.SetStateAction<Essay[]>>;
    setUniversities: React.Dispatch<React.SetStateAction<University[]>>;
}

const StudentDataContext = createContext<StudentDataContextType | undefined>(undefined);

export function useStudentData() {
    const context = useContext(StudentDataContext);
    if (!context) {
        throw new Error('useStudentData must be used within StudentDataProvider');
    }
    return context;
}

export function StudentDataProvider({ children }: { children: React.ReactNode }) {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [essays, setEssays] = useState<Essay[]>([]);
    const [universities, setUniversities] = useState<University[]>([]);
    const [teacherName, setTeacherName] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isDataReady, setIsDataReady] = useState(false);

    const hasInitialized = useRef(false);
    const supabase = createClient();

    // Fetch functions
    const refreshProfile = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('profiles')
            .select('*, teacher:teacher_id(full_name)')
            .eq('id', user.id)
            .single();

        if (data) {
            setProfile(data as Profile);
            setTeacherName((data.teacher as any)?.full_name || 'Not Assigned');
        }
    }, [supabase]);

    const refreshDocuments = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('documents')
            .select('*')
            .eq('student_id', user.id)
            .order('created_at', { ascending: false });

        setDocuments(data || []);
    }, [supabase]);

    const refreshEssays = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('essays')
            .select('*')
            .eq('student_id', user.id)
            .order('updated_at', { ascending: false });

        setEssays(data || []);
    }, [supabase]);

    const refreshUniversities = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('universities')
            .select('*')
            .eq('student_id', user.id)
            .order('created_at', { ascending: false });

        setUniversities(data || []);
    }, [supabase]);

    const refreshAll = useCallback(async () => {
        await Promise.all([
            refreshProfile(),
            refreshDocuments(),
            refreshEssays(),
            refreshUniversities()
        ]);
    }, [refreshProfile, refreshDocuments, refreshEssays, refreshUniversities]);

    // Initial data load
    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        const loadAllData = async () => {
            setIsLoading(true);
            try {
                await refreshAll();
            } catch (error) {
                console.error('Error loading student data:', error);
            } finally {
                setIsLoading(false);
                setIsDataReady(true);
            }
        };

        loadAllData();
    }, [refreshAll]);

    // Real-time subscriptions
    useEffect(() => {
        const setupSubscriptions = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Profile changes subscription
            const profileChannel = supabase
                .channel('student-profile-changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'profiles',
                        filter: `id=eq.${user.id}`
                    },
                    () => {
                        console.log('Profile changed, refreshing...');
                        refreshProfile();
                    }
                )
                .subscribe();

            // Documents subscription
            const documentsChannel = supabase
                .channel('student-documents-changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'documents',
                        filter: `student_id=eq.${user.id}`
                    },
                    () => {
                        console.log('Documents changed, refreshing...');
                        refreshDocuments();
                    }
                )
                .subscribe();

            // Essays subscription
            const essaysChannel = supabase
                .channel('student-essays-changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'essays',
                        filter: `student_id=eq.${user.id}`
                    },
                    () => {
                        console.log('Essays changed, refreshing...');
                        refreshEssays();
                    }
                )
                .subscribe();

            // Universities subscription
            const universitiesChannel = supabase
                .channel('student-universities-changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'universities',
                        filter: `student_id=eq.${user.id}`
                    },
                    () => {
                        console.log('Universities changed, refreshing...');
                        refreshUniversities();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(profileChannel);
                supabase.removeChannel(documentsChannel);
                supabase.removeChannel(essaysChannel);
                supabase.removeChannel(universitiesChannel);
            };
        };

        const cleanup = setupSubscriptions();
        return () => {
            cleanup.then(fn => fn?.());
        };
    }, [supabase, refreshProfile, refreshDocuments, refreshEssays, refreshUniversities]);

    // Listen for custom events (from OCR, etc.)
    useEffect(() => {
        const handleScoresUpdated = () => refreshProfile();
        const handleProfileUpdated = () => refreshProfile();
        const handleDocumentsUpdated = () => refreshDocuments();

        window.addEventListener('scores-updated', handleScoresUpdated);
        window.addEventListener('profile-updated', handleProfileUpdated);
        window.addEventListener('documents-updated', handleDocumentsUpdated);

        return () => {
            window.removeEventListener('scores-updated', handleScoresUpdated);
            window.removeEventListener('profile-updated', handleProfileUpdated);
            window.removeEventListener('documents-updated', handleDocumentsUpdated);
        };
    }, [refreshProfile, refreshDocuments]);

    const value: StudentDataContextType = {
        profile,
        documents,
        essays,
        universities,
        teacherName,
        isLoading,
        isDataReady,
        refreshProfile,
        refreshDocuments,
        refreshEssays,
        refreshUniversities,
        refreshAll,
        setDocuments,
        setEssays,
        setUniversities
    };

    return (
        <StudentDataContext.Provider value={value}>
            {children}
        </StudentDataContext.Provider>
    );
}
