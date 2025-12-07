"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

interface UseUnreadMessageCountResult {
    unreadCount: number;
    loading: boolean;
    markConversationAsRead: (conversationId: string) => Promise<void>;
    refresh: () => Promise<void>;
}

export function useUnreadMessageCount(): UseUnreadMessageCountResult {
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const supabase = createClient();

    const fetchUnreadCount = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }
            setCurrentUserId(user.id);

            // Get all conversations the user is part of with their last_read_at
            const { data: participations, error: partError } = await supabase
                .from('conversation_participants')
                .select('conversation_id, last_read_at')
                .eq('user_id', user.id);

            if (partError || !participations || participations.length === 0) {
                setUnreadCount(0);
                setLoading(false);
                return;
            }

            // Count unread messages for each conversation
            let totalUnread = 0;

            for (const participation of participations) {
                const { count, error: countError } = await supabase
                    .from('messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('conversation_id', participation.conversation_id)
                    .neq('sender_id', user.id) // Don't count own messages
                    .gt('created_at', participation.last_read_at || '1970-01-01');

                if (!countError && count) {
                    totalUnread += count;
                }
            }

            setUnreadCount(totalUnread);
        } catch (error) {
            console.error("Error fetching unread count:", error);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    const markConversationAsRead = useCallback(async (conversationId: string) => {
        if (!currentUserId) return;

        try {
            const { error } = await supabase
                .from('conversation_participants')
                .update({ last_read_at: new Date().toISOString() })
                .eq('conversation_id', conversationId)
                .eq('user_id', currentUserId);

            if (!error) {
                // Refresh count after marking as read
                await fetchUnreadCount();
            }
        } catch (error) {
            console.error("Error marking conversation as read:", error);
        }
    }, [supabase, currentUserId, fetchUnreadCount]);

    useEffect(() => {
        fetchUnreadCount();
    }, [fetchUnreadCount]);

    // Subscribe to new messages for real-time updates
    useEffect(() => {
        if (!currentUserId) return;

        const channel = supabase
            .channel('unread-messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, async (payload: any) => {
                // If the new message is not from the current user, increment count
                if (payload.new.sender_id !== currentUserId) {
                    // Verify this message is in a conversation the user is part of
                    const { data: participation } = await supabase
                        .from('conversation_participants')
                        .select('conversation_id')
                        .eq('conversation_id', payload.new.conversation_id)
                        .eq('user_id', currentUserId)
                        .single();

                    if (participation) {
                        setUnreadCount(prev => prev + 1);
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, currentUserId]);

    return {
        unreadCount,
        loading,
        markConversationAsRead,
        refresh: fetchUnreadCount
    };
}
