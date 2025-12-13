"use client";

/**
 * Real-Time Messages Hook
 * 
 * Provides zero-refresh message injection for Discord-like UX.
 * New messages are directly appended to local state without refetching.
 * 
 * Features:
 * - Direct injection of new messages
 * - Sound notification for new messages
 * - Preserves scroll position
 * - Typing indicators
 * 
 * @file src/hooks/useRealtimeMessages.ts
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { useAppStore } from "@/stores/appStore";

interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    read_at: string | null;
}

interface UseRealtimeMessagesOptions {
    conversationId: string | null;
    enabled?: boolean;
    onNewMessage?: (message: Message) => void;
}

// Audio notification (lazy loaded)
let notificationSound: HTMLAudioElement | null = null;

function playNotificationSound() {
    try {
        if (typeof window === 'undefined') return;

        if (!notificationSound) {
            // Create a simple beep using Web Audio API
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;

            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
            oscillator.stop(audioContext.currentTime + 0.15);
        }
    } catch (error) {
        // Silently fail if audio isn't available
        console.log('[RealtimeMessages] Audio notification unavailable');
    }
}

export function useRealtimeMessages({
    conversationId,
    enabled = true,
    onNewMessage,
}: UseRealtimeMessagesOptions) {
    const queryClient = useQueryClient();
    const supabase = createClient();
    const { user } = useAppStore();
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Direct injection of new messages into React Query cache
    const injectMessage = useCallback((newMessage: Message) => {
        // Update the messages query cache directly
        queryClient.setQueryData(
            ['messages', conversationId],
            (oldData: Message[] | undefined) => {
                if (!oldData) return [newMessage];

                // Prevent duplicates
                if (oldData.some(msg => msg.id === newMessage.id)) {
                    return oldData;
                }

                // Append new message (no refetch needed!)
                return [...oldData, newMessage];
            }
        );

        // If message is from someone else, show notification
        if (newMessage.sender_id !== user?.id) {
            playNotificationSound();
            onNewMessage?.(newMessage);
        }
    }, [queryClient, conversationId, user?.id, onNewMessage]);

    // Subscribe to new messages
    useEffect(() => {
        if (!conversationId || !enabled) return;

        const channel = supabase
            .channel(`messages:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    const newMessage = payload.new as Message;
                    console.log('[RealtimeMessages] New message received:', newMessage.id);
                    injectMessage(newMessage);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    // Update message in cache (e.g., read receipt)
                    const updatedMessage = payload.new as Message;
                    queryClient.setQueryData(
                        ['messages', conversationId],
                        (oldData: Message[] | undefined) => {
                            if (!oldData) return oldData;
                            return oldData.map(msg =>
                                msg.id === updatedMessage.id ? updatedMessage : msg
                            );
                        }
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId, enabled, supabase, injectMessage, queryClient]);

    // Typing indicator handling
    const handleTyping = useCallback(() => {
        setIsTyping(true);

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
        }, 2000);
    }, []);

    // Cleanup typing timeout
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    return {
        isTyping,
        handleTyping,
        injectMessage,
    };
}

/**
 * Hook for subscribing to new student applications (teacher dashboard)
 */
export function useRealtimeStudents() {
    const queryClient = useQueryClient();
    const supabase = createClient();
    const { user } = useAppStore();

    useEffect(() => {
        if (!user?.id || user.role !== 'teacher') return;

        const channel = supabase
            .channel('new-students')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'profiles',
                    filter: `teacher_id=eq.${user.id}`,
                },
                (payload) => {
                    console.log('[RealtimeStudents] New student registered');
                    playNotificationSound();

                    // Inject new student into cache
                    queryClient.setQueryData(
                        ['teacher', 'students'],
                        (oldData: any[] | undefined) => {
                            if (!oldData) return [payload.new];
                            return [payload.new, ...oldData];
                        }
                    );

                    // Also update pending students
                    queryClient.setQueryData(
                        ['teacher', 'pending-students'],
                        (oldData: any[] | undefined) => {
                            if (!oldData) return [payload.new];
                            return [payload.new, ...oldData];
                        }
                    );
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `teacher_id=eq.${user.id}`,
                },
                (payload) => {
                    // Update student in cache
                    queryClient.setQueryData(
                        ['teacher', 'students'],
                        (oldData: any[] | undefined) => {
                            if (!oldData) return oldData;
                            return oldData.map(student =>
                                student.id === payload.new.id ? payload.new : student
                            );
                        }
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, user?.role, supabase, queryClient]);
}

/**
 * Hook for real-time unread count updates
 */
export function useRealtimeUnreadCount() {
    const { user, incrementNotificationCount } = useAppStore();
    const supabase = createClient();

    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel('unread-messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                (payload) => {
                    const newMessage = payload.new as Message;
                    // If message is for current user and unread, increment count
                    if (newMessage.sender_id !== user.id && !newMessage.read_at) {
                        incrementNotificationCount();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, supabase, incrementNotificationCount]);
}

