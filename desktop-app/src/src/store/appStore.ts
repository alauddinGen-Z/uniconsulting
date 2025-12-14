import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// Types
interface Profile {
    id: string;
    role: 'student' | 'teacher';
    full_name: string | null;
    email: string | null;
    approval_status: 'pending' | 'approved' | 'rejected';
    teacher_id: string | null;
}

interface Student extends Profile {
    phone: string | null;
    passport_number: string | null;
    home_address: string | null;
    preferred_country: string | null;
    date_of_birth: string | null;
    father_name: string | null;
    mother_name: string | null;
}

interface Message {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    created_at: string;
    is_read: boolean;
}

interface AppState {
    // Auth
    user: Profile | null;
    isLoading: boolean;
    isAuthenticated: boolean;

    // Data
    students: Student[];
    messages: Message[];

    // Actions
    setUser: (user: Profile | null) => void;
    setLoading: (loading: boolean) => void;
    setStudents: (students: Student[]) => void;
    addStudent: (student: Student) => void;
    updateStudent: (id: string, updates: Partial<Student>) => void;
    setMessages: (messages: Message[]) => void;
    addMessage: (message: Message) => void;
    markMessageRead: (id: string) => void;

    // Data fetching
    loadUserProfile: () => Promise<void>;
    loadStudents: () => Promise<void>;
    loadMessages: () => Promise<void>;
    logout: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
    // Initial state
    user: null,
    isLoading: true,
    isAuthenticated: false,
    students: [],
    messages: [],

    // Actions
    setUser: (user) => set({ user, isAuthenticated: !!user }),
    setLoading: (isLoading) => set({ isLoading }),
    setStudents: (students) => set({ students }),
    addStudent: (student) => set((state) => ({
        students: [student, ...state.students]
    })),
    updateStudent: (id, updates) => set((state) => ({
        students: state.students.map(s => s.id === id ? { ...s, ...updates } : s)
    })),
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => set((state) => ({
        messages: [...state.messages, message]
    })),
    markMessageRead: (id) => set((state) => ({
        messages: state.messages.map(m => m.id === id ? { ...m, is_read: true } : m)
    })),

    // Load user profile
    loadUserProfile: async () => {
        console.log('[AppStore] Starting loadUserProfile...');
        try {
            // Add timeout to prevent infinite waiting
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Auth timeout')), 10000)
            );

            const authPromise = supabase.auth.getUser();
            const { data: { user: authUser } } = await Promise.race([authPromise, timeoutPromise]) as Awaited<typeof authPromise>;

            console.log('[AppStore] Auth user:', authUser?.id || 'none');

            if (!authUser) {
                console.log('[AppStore] No auth user, setting unauthenticated');
                set({ user: null, isAuthenticated: false, isLoading: false });
                return;
            }

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .single();

            console.log('[AppStore] Profile loaded:', profile?.id, 'Error:', error?.message);

            set({
                user: profile,
                isAuthenticated: true,
                isLoading: false
            });
        } catch (error) {
            console.error('[AppStore] Error loading profile:', error);
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },

    // Load students (for teacher)
    loadStudents: async () => {
        const { user } = get();
        if (!user || user.role !== 'teacher') return;

        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'student')
            .eq('teacher_id', user.id)
            .order('created_at', { ascending: false });

        if (data) set({ students: data as Student[] });
    },

    // Load messages
    loadMessages: async () => {
        const { user } = get();
        if (!user) return;

        const { data } = await supabase
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .order('created_at', { ascending: true });

        if (data) set({ messages: data as Message[] });
    },

    // Logout
    logout: async () => {
        await supabase.auth.signOut();
        set({
            user: null,
            isAuthenticated: false,
            students: [],
            messages: []
        });
    },
}));

export default useAppStore;
