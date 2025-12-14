import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';

/**
 * Hook for real-time Supabase subscriptions
 * New messages and student updates pop in without page refresh
 */
export function useRealtimeSubscriptions() {
    const { user, addMessage, addStudent, updateStudent } = useAppStore();

    useEffect(() => {
        if (!user) return;

        // Subscribe to new messages
        const messagesChannel = supabase
            .channel('realtime-messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `receiver_id=eq.${user.id}`
                },
                (payload) => {
                    console.log('New message received:', payload.new);
                    addMessage(payload.new as any);
                }
            )
            .subscribe();

        // For teachers: subscribe to new students
        let studentsChannel: any = null;
        if (user.role === 'teacher') {
            studentsChannel = supabase
                .channel('realtime-students')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'profiles',
                        filter: `teacher_id=eq.${user.id}`
                    },
                    (payload) => {
                        console.log('New student:', payload.new);
                        addStudent(payload.new as any);
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'profiles',
                        filter: `teacher_id=eq.${user.id}`
                    },
                    (payload) => {
                        console.log('Student updated:', payload.new);
                        updateStudent(payload.new.id, payload.new as any);
                    }
                )
                .subscribe();
        }

        // Cleanup on unmount
        return () => {
            supabase.removeChannel(messagesChannel);
            if (studentsChannel) {
                supabase.removeChannel(studentsChannel);
            }
        };
    }, [user, addMessage, addStudent, updateStudent]);
}

export default useRealtimeSubscriptions;
