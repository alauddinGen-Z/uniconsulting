"use client";

/**
 * StudentChat - Simplified chat view for students
 * 
 * Shows only the ONE direct message conversation with their assigned teacher.
 * No conversation list, no group chat features - just a simple chat interface.
 */

import { useEffect, useState, useRef } from "react";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    sender_name?: string;
    is_from_me?: boolean;
}

export default function StudentChat() {
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [teacherName, setTeacherName] = useState<string>("Your Consultant");
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    useEffect(() => {
        initializeChat();
    }, []);

    useEffect(() => {
        if (conversationId) {
            fetchMessages();
            const unsubscribe = subscribeToMessages();
            return () => unsubscribe?.();
        }
    }, [conversationId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const initializeChat = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setCurrentUserId(user.id);

            // Get student's profile to find their teacher
            const { data: profile } = await supabase
                .from('profiles')
                .select('teacher_id')
                .eq('id', user.id)
                .single();

            if (profile?.teacher_id) {
                // Get teacher name
                const { data: teacher } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', profile.teacher_id)
                    .single();

                if (teacher?.full_name) {
                    setTeacherName(teacher.full_name);
                }

                // Find the ONE direct conversation with this teacher
                const { data: participations } = await supabase
                    .from('conversation_participants')
                    .select('conversation_id')
                    .eq('user_id', user.id);

                const myConvIds = participations?.map(p => p.conversation_id) || [];

                // Find direct conversation where teacher is also a participant
                for (const convId of myConvIds) {
                    const { data: conv } = await supabase
                        .from('conversations')
                        .select('*')
                        .eq('id', convId)
                        .eq('type', 'direct')
                        .single();

                    if (conv) {
                        const { data: participants } = await supabase
                            .from('conversation_participants')
                            .select('user_id')
                            .eq('conversation_id', convId);

                        const participantIds = participants?.map(p => p.user_id) || [];
                        if (participantIds.includes(profile.teacher_id)) {
                            setConversationId(convId);
                            break;
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error initializing chat:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMessages = async () => {
        if (!conversationId || !currentUserId) return;

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Error fetching messages:", error);
            return;
        }

        // Get sender names
        const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
        const { data: senders } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', senderIds);

        const senderMap = new Map(senders?.map(s => [s.id, s.full_name]) || []);

        const messagesWithMeta = (data || []).map(msg => ({
            ...msg,
            sender_name: senderMap.get(msg.sender_id) || 'Unknown',
            is_from_me: msg.sender_id === currentUserId
        }));

        setMessages(messagesWithMeta);
    };

    const subscribeToMessages = () => {
        if (!conversationId) return;

        const channel = supabase
            .channel(`student-chat-${conversationId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`
            }, async (payload: any) => {
                const { data: sender } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', payload.new.sender_id)
                    .single();

                const newMsg = {
                    ...payload.new,
                    sender_name: sender?.full_name || 'Unknown',
                    is_from_me: payload.new.sender_id === currentUserId
                };
                setMessages(prev => [...prev, newMsg]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !conversationId || !currentUserId) return;

        setIsSending(true);
        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: currentUserId,
                    content: newMessage.trim(),
                    is_announcement: false
                });

            if (error) throw error;

            await supabase
                .from('conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', conversationId);

            setNewMessage("");
        } catch (error: any) {
            console.error("Error sending message:", error);
            toast.error("Failed to send message");
        } finally {
            setIsSending(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (!conversationId) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <MessageCircle className="w-16 h-16 mb-4 text-slate-300" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">No Chat Available</h3>
                <p className="text-slate-500">
                    Your chat with your consultant will appear here once your account is approved.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden">
            {/* Chat Header */}
            <div className="flex-none p-4 border-b border-slate-100 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold">
                        {teacherName.charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-bold">{teacherName}</h3>
                        <p className="text-xs text-white/80">Your Consultant</p>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                {messages.length === 0 ? (
                    <div className="text-center py-8">
                        <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p className="text-slate-500">No messages yet. Say hello!</p>
                    </div>
                ) : (
                    messages.map(msg => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.is_from_me ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${msg.is_from_me
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-white text-slate-900 shadow-sm border border-slate-100'
                                }`}>
                                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                                <p className={`text-[10px] mt-1 ${msg.is_from_me ? 'text-white/70' : 'text-slate-400'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="flex-none p-3 border-t border-slate-100 bg-white">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={isSending || !newMessage.trim()}
                        className="p-2.5 rounded-full bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
