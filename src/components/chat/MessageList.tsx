"use client";

import { useEffect, useRef } from "react";
import { Loader2, MessageCircle, CheckCheck } from "lucide-react";
import { Message, Conversation } from "./types";

interface MessageListProps {
    messages: Message[];
    currentUserId: string | null;
    selectedConversation: Conversation | null;
    isLoading?: boolean;
    searchQuery?: string; // Highlight search query?
}

export default function MessageList({
    messages,
    currentUserId,
    selectedConversation,
    isLoading,
    searchQuery
}: MessageListProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = (force = false) => {
        if (!scrollContainerRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;

        if (force || isNearBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    };

    useEffect(() => {
        scrollToBottom(messages.some(m => m.isOptimistic));
    }, [messages]);

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-orange-50 to-white">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (!selectedConversation) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-white p-8">
                <div className="relative mb-8">
                    <div className="w-40 h-40 rounded-full bg-orange-50 animate-pulse flex items-center justify-center">
                        <div className="w-32 h-32 rounded-full bg-orange-100 flex items-center justify-center">
                            <MessageCircle className="w-16 h-16 text-orange-400" />
                        </div>
                    </div>
                </div>
                <h2 className="text-3xl font-bold text-slate-800 mb-4 text-center">Your Concierge Hub</h2>
                <p className="text-slate-500 text-center max-w-sm mb-8 leading-relaxed">
                    Welcome to the direct line between teachers and students.
                    Select a conversation from the sidebar to coordinate your educational journey.
                </p>
                <div className="flex gap-4">
                    <div className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-400 uppercase tracking-widest font-semibold">
                        Real-time
                    </div>
                    <div className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-400 uppercase tracking-widest font-semibold">
                        Secure
                    </div>
                </div>
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="inline-block px-4 py-2 bg-white rounded-xl text-slate-500 text-sm shadow-sm border border-slate-100">
                    {searchQuery ? 'No messages found' : 'No messages yet. Start the conversation!'}
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50" ref={scrollContainerRef}>
            {searchQuery && (
                <div className="text-center mb-4">
                    <span className="inline-block px-3 py-1 bg-orange-100 rounded-full text-orange-600 text-xs">
                        Search results for "{searchQuery}"
                    </span>
                </div>
            )}

            {messages.map((msg, idx) => {
                const showDate = idx === 0 ||
                    new Date(msg.created_at).toDateString() !== new Date(messages[idx - 1].created_at).toDateString();

                return (
                    <div key={msg.id}>
                        {showDate && (
                            <div className="text-center my-4">
                                <span className="inline-block px-3 py-1 bg-white rounded-full text-slate-400 text-xs shadow-sm border border-slate-100">
                                    {new Date(msg.created_at).toLocaleDateString([], {
                                        weekday: 'long', month: 'short', day: 'numeric'
                                    })}
                                </span>
                            </div>
                        )}
                        <div className={`flex ${msg.is_from_me ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm ${msg.is_from_me
                                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-br-md'
                                : 'bg-white text-slate-800 border border-slate-100 rounded-bl-md'
                                }`}>
                                {!msg.is_from_me && selectedConversation.type === 'group' && (
                                    <p className="text-xs text-orange-500 font-semibold mb-1">{msg.sender_name}</p>
                                )}
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                <div className={`flex items-center justify-end gap-1 mt-1 ${msg.is_from_me ? 'text-white/70' : 'text-slate-400'}`}>
                                    <span className="text-[10px]">{formatTime(msg.created_at)}</span>
                                    {msg.isOptimistic ? (
                                        <Loader2 className="w-3 h-3 animate-spin text-white/70" />
                                    ) : (
                                        msg.is_from_me && <CheckCheck className="w-3.5 h-3.5" />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>
    );
}
