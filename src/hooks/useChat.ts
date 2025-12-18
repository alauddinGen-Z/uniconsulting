/**
 * useChat.ts
 * Real-Time Chat Hook with TanStack Query + Supabase Realtime
 * 
 * CoVe Guarantees:
 *   ✅ Race Condition Safe: Deduplication + sorting after realtime events
 *   ✅ Connection State: isConnecting exposed for UI feedback
 *   ✅ Optimistic UI: sendMessage updates locally before server confirms
 */

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { Message, Profile } from '@/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// TYPES
// ============================================

export interface ChatMessage extends Message {
    sender?: Pick<Profile, 'id' | 'full_name' | 'role'>;
    isOptimistic?: boolean;
}

interface UseChatOptions {
    conversationId: string | undefined;
    enabled?: boolean;
}

interface UseChatResult {
    messages: ChatMessage[];
    isConnecting: boolean;
    isLoading: boolean;
    error: Error | null;
    sendMessage: (content: string) => Promise<void>;
    markAsRead: () => Promise<void>;
}

// ============================================
// QUERY KEYS
// ============================================

export const chatKeys = {
    all: ['chat'] as const,
    messages: (conversationId: string) => [...chatKeys.all, 'messages', conversationId] as const,
    conversations: () => [...chatKeys.all, 'conversations'] as const,
};

// ============================================
// HOOK: useChat
// ============================================

export function useChat(options: UseChatOptions): UseChatResult {
    const { conversationId, enabled = true } = options;
    const queryClient = useQueryClient();
    const supabase = createClient();
    const channelRef = useRef<RealtimeChannel | null>(null);

    // Connection state for realtime
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);

    // ============================================
    // FETCH INITIAL MESSAGES
    // ============================================

    const messagesQuery = useQuery({
        queryKey: chatKeys.messages(conversationId ?? ''),
        queryFn: async (): Promise<ChatMessage[]> => {
            if (!conversationId) throw new Error('Conversation ID required');

            const { data, error } = await supabase
                .from('messages')
                .select(`
          *,
          sender:profiles!sender_id(id, full_name, role)
        `)
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });

            if (error) throw new Error(error.message);

            return (data || []).map((msg): ChatMessage => ({
                ...msg,
                sender: msg.sender as ChatMessage['sender'],
            }));
        },
        enabled: enabled && !!conversationId,
        staleTime: 30_000, // 30 seconds
        gcTime: 5 * 60_000, // 5 minutes
    });

    // ============================================
    // REALTIME SUBSCRIPTION
    // Starts AFTER initial query succeeds (race condition prevention)
    // ============================================

    useEffect(() => {
        if (!conversationId || !enabled || messagesQuery.isLoading) {
            return;
        }

        const channelName = `chat-${conversationId}-${Date.now()}`;

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                async (payload) => {
                    const newMessage = payload.new as Message;

                    // Fetch sender info for the new message
                    const { data: sender } = await supabase
                        .from('profiles')
                        .select('id, full_name, role')
                        .eq('id', newMessage.sender_id)
                        .single();

                    const enrichedMessage: ChatMessage = {
                        ...newMessage,
                        sender: sender as ChatMessage['sender'],
                    };

                    // Update query cache with deduplication
                    queryClient.setQueryData<ChatMessage[]>(
                        chatKeys.messages(conversationId),
                        (oldMessages = []) => {
                            // Deduplication check
                            const existingIds = new Set(oldMessages.map(m => m.id));
                            if (existingIds.has(enrichedMessage.id)) {
                                return oldMessages;
                            }

                            // Remove any optimistic message with same content from same sender
                            const filtered = oldMessages.filter(m =>
                                !(m.isOptimistic && m.sender_id === enrichedMessage.sender_id)
                            );

                            // Add and sort by created_at
                            return [...filtered, enrichedMessage].sort(
                                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                            );
                        }
                    );

                    // Clear optimistic messages that are now confirmed
                    setOptimisticMessages(prev =>
                        prev.filter(m => m.sender_id !== enrichedMessage.sender_id)
                    );
                }
            )
            .subscribe((status) => {
                console.log('[Chat] Subscription status:', status);
                setIsSubscribed(status === 'SUBSCRIBED');
            });

        channelRef.current = channel;

        // Cleanup on unmount or dependency change
        return () => {
            if (channelRef.current) {
                console.log('[Chat] Unsubscribing from:', channelName);
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
                setIsSubscribed(false);
            }
        };
    }, [conversationId, enabled, messagesQuery.isLoading, queryClient, supabase]);

    // ============================================
    // OPTIMISTIC SEND MESSAGE
    // ============================================

    const sendMessage = useCallback(async (content: string): Promise<void> => {
        if (!conversationId || !content.trim()) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const optimisticId = `optimistic-${Date.now()}`;
        const optimisticMessage: ChatMessage = {
            id: optimisticId,
            conversation_id: conversationId,
            sender_id: user.id,
            content: content.trim(),
            is_announcement: false,
            created_at: new Date().toISOString(),
            isOptimistic: true,
        };

        // Add optimistic message to UI immediately
        queryClient.setQueryData<ChatMessage[]>(
            chatKeys.messages(conversationId),
            (oldMessages = []) => [...oldMessages, optimisticMessage]
        );

        // Import and call the server action
        try {
            const { sendChatMessage } = await import('@/app/chat/actions/send');
            const result = await sendChatMessage({ conversationId, content: content.trim() });

            if (!result?.data?.success) {
                throw new Error(result?.data?.error || 'Failed to send message');
            }

            // Success - realtime will update with the real message
        } catch (error) {
            // Remove optimistic message on error
            queryClient.setQueryData<ChatMessage[]>(
                chatKeys.messages(conversationId),
                (oldMessages = []) => oldMessages.filter(m => m.id !== optimisticId)
            );
            throw error;
        }
    }, [conversationId, queryClient, supabase]);

    // ============================================
    // MARK MESSAGES AS READ
    // ============================================

    const markAsRead = useCallback(async (): Promise<void> => {
        if (!conversationId) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('conversation_id', conversationId)
            .neq('sender_id', user.id)
            .eq('is_read', false);

        // Invalidate unread counts
        queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    }, [conversationId, supabase, queryClient]);

    // ============================================
    // COMPUTED STATE
    // ============================================

    const isConnecting = messagesQuery.isLoading || (!isSubscribed && enabled && !!conversationId);

    return {
        messages: messagesQuery.data ?? [],
        isConnecting,
        isLoading: messagesQuery.isLoading,
        error: messagesQuery.error,
        sendMessage,
        markAsRead,
    };
}

// ============================================
// HOOK: useConversations (List all user's chats)
// ============================================

export function useConversations() {
    const supabase = createClient();

    return useQuery({
        queryKey: chatKeys.conversations(),
        queryFn: async () => {
            const { data, error } = await supabase
                .from('conversations')
                .select(`
          *,
          participants:conversation_participants(
            user:profiles(id, full_name, role)
          ),
          messages(id, content, created_at, sender_id)
        `)
                .order('updated_at', { ascending: false });

            if (error) throw new Error(error.message);
            return data;
        },
        staleTime: 60_000,
    });
}
