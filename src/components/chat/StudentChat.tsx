"use client";

/**
 * StudentChat - Premium chat view for students
 * 
 * A beautifully designed 1:1 chat interface with the assigned consultant.
 * Features: WhatsApp-style bubbles, typing animation, brand colors, and sleek design.
 */

import { useEffect, useState, useRef } from "react";
import { MessageCircle, Send, Loader2, Check, CheckCheck, UserCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/lib/i18n";

interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    sender_name?: string;
    is_from_me?: boolean;
    is_read?: boolean;
}

interface TeacherProfile {
    id: string;
    full_name: string;
    avatar_url?: string;
}

export default function StudentChat() {
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();
    const { t } = useLanguage();

    useEffect(() => {
        initializeChat();
    }, []);

    useEffect(() => {
        if (conversationId) {
            fetchMessages();
            markMessagesAsRead();
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
                // Get teacher profile (avatar_url column doesn't exist yet)
                const { data: teacherData } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .eq('id', profile.teacher_id)
                    .single();

                if (teacherData) {
                    setTeacher(teacherData);
                    // Simulate online status (in production, use presence)
                    setIsOnline(Math.random() > 0.3);
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

        const messagesWithMeta = (data || []).map(msg => ({
            ...msg,
            is_from_me: msg.sender_id === currentUserId
        }));

        setMessages(messagesWithMeta);
    };

    const markMessagesAsRead = async () => {
        if (!conversationId || !currentUserId) return;

        await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('conversation_id', conversationId)
            .neq('sender_id', currentUserId);
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
                const newMsg = {
                    ...payload.new,
                    is_from_me: payload.new.sender_id === currentUserId
                };
                setMessages(prev => [...prev, newMsg]);

                // Mark as read if not from me
                if (!newMsg.is_from_me) {
                    markMessagesAsRead();
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !conversationId || !currentUserId) return;

        setIsSending(true);
        const messageContent = newMessage.trim();
        setNewMessage("");

        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: currentUserId,
                    content: messageContent,
                    is_announcement: false
                });

            if (error) throw error;

            await supabase
                .from('conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', conversationId);

        } catch (error: any) {
            console.error("Error sending message:", error);
            toast.error("Failed to send message");
            setNewMessage(messageContent); // Restore message on error
        } finally {
            setIsSending(false);
            inputRef.current?.focus();
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDateSeparator = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return "Today";
        if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
        return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    };

    // Group messages by date
    const groupedMessages = messages.reduce((groups: { [key: string]: Message[] }, msg) => {
        const date = new Date(msg.created_at).toDateString();
        if (!groups[date]) groups[date] = [];
        groups[date].push(msg);
        return groups;
    }, {});

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-brand-primary-500 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Loading your chat...</p>
                </div>
            </div>
        );
    }

    if (!conversationId || !teacher) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center mb-6">
                    <MessageCircle className="w-12 h-12 text-slate-400" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">No Chat Available Yet</h3>
                <p className="text-slate-500 max-w-md">
                    Your personal chat with your consultant will appear here once your account is approved and a consultant is assigned.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
            {/* Premium Chat Header */}
            <div className="flex-none px-6 py-4 bg-gradient-to-r from-brand-primary-500 via-brand-primary-600 to-brand-secondary-500 text-white">
                <div className="flex items-center gap-4">
                    {/* Teacher Avatar */}
                    <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl font-bold ring-2 ring-white/30">
                            {teacher.avatar_url ? (
                                <img src={teacher.avatar_url} alt={teacher.full_name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                teacher.full_name.charAt(0).toUpperCase()
                            )}
                        </div>
                        {/* Online Indicator */}
                        <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${isOnline ? 'bg-green-400' : 'bg-slate-400'}`} />
                    </div>

                    {/* Teacher Info */}
                    <div className="flex-1">
                        <h3 className="font-bold text-lg">{teacher.full_name}</h3>
                        <p className="text-sm text-white/80 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-slate-400'}`} />
                            {isOnline ? 'Online' : 'Offline'}
                            <span className="mx-1">•</span>
                            Your Personal Consultant
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div
                className="flex-1 overflow-y-auto p-6 space-y-4"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f1f5f9' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    backgroundColor: '#fafbfc'
                }}
            >
                {messages.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-12"
                    >
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-brand-primary-100 flex items-center justify-center">
                            <MessageCircle className="w-10 h-10 text-brand-primary-500" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 mb-2">Start the Conversation</h4>
                        <p className="text-slate-500 max-w-xs mx-auto">
                            Say hello to {teacher.full_name}! They're here to help you with your university applications.
                        </p>
                    </motion.div>
                ) : (
                    <>
                        {Object.entries(groupedMessages).map(([date, msgs]) => (
                            <div key={date}>
                                {/* Date Separator */}
                                <div className="flex items-center justify-center my-4">
                                    <span className="px-4 py-1.5 bg-white rounded-full text-xs font-semibold text-slate-500 shadow-sm border border-slate-100">
                                        {formatDateSeparator(msgs[0].created_at)}
                                    </span>
                                </div>

                                {/* Messages */}
                                <AnimatePresence>
                                    {msgs.map((msg, idx) => (
                                        <motion.div
                                            key={msg.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.02 }}
                                            className={`flex mb-2 ${msg.is_from_me ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`
                                                max-w-[75%] px-4 py-3 rounded-2xl relative
                                                ${msg.is_from_me
                                                    ? 'bg-brand-primary-500 text-white rounded-br-sm'
                                                    : 'bg-white text-slate-900 rounded-bl-sm shadow-sm border border-slate-100'
                                                }
                                            `}>
                                                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                                                <div className={`flex items-center gap-1 mt-1.5 ${msg.is_from_me ? 'justify-end' : 'justify-start'}`}>
                                                    <span className={`text-[11px] ${msg.is_from_me ? 'text-white/70' : 'text-slate-400'}`}>
                                                        {formatTime(msg.created_at)}
                                                    </span>
                                                    {msg.is_from_me && (
                                                        <CheckCheck className={`w-3.5 h-3.5 ${msg.is_read ? 'text-blue-300' : 'text-white/50'}`} />
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        ))}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Premium Message Input */}
            <div className="flex-none p-4 border-t border-slate-100 bg-white">
                <div className="flex items-center gap-3">
                    <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        placeholder={`Message ${teacher.full_name}...`}
                        className="flex-1 px-5 py-3.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 text-[15px] bg-slate-50 placeholder:text-slate-400 transition-all"
                    />
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={sendMessage}
                        disabled={isSending || !newMessage.trim()}
                        className="p-3.5 rounded-full bg-brand-gradient text-white shadow-brand hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isSending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </motion.button>
                </div>
            </div>
        </div>
    );
}
