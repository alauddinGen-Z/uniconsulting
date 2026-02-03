"use client";

import { MessageCircle, Search, Plus, Users, MoreVertical, Trash2, X } from "lucide-react";
import { Conversation } from "./types";
import { formatTime } from "@/utils/date"; // We might need to extract formatTime or duplicate it. 
// I'll assume we can pass it or duplicate it for now to avoid creating utils/date if it doesn't exist.
// Actually allow me to inline formatTime here or extract it to a util.
// I'll inline it for safety.

interface ChatSidebarProps {
    userRole: 'teacher' | 'student';
    conversations: Conversation[];
    selectedConversation: Conversation | null;
    onSelectConversation: (conv: Conversation) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    onNewChat: () => void;
    onDeleteConversation?: (convId: string) => void;
}

export default function ChatSidebar({
    userRole,
    conversations,
    selectedConversation,
    onSelectConversation,
    searchQuery,
    setSearchQuery,
    onNewChat,
    onDeleteConversation
}: ChatSidebarProps) {
    const formatTime = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();

        if (isToday) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // Filter conversations
    const filteredConversations = conversations.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className={`w-80 bg-gradient-to-b from-orange-50 to-white border-r border-orange-100 flex flex-col ${selectedConversation && userRole === 'student' ? 'hidden md:flex' : 'flex'}`}>
            {/* Header */}
            <div className="h-16 px-4 bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
                        {userRole === 'teacher' ? 'T' : 'S'}
                    </div>
                    <span className="font-bold text-white">Messages</span>
                </div>
                {userRole === 'teacher' && (
                    <button
                        onClick={onNewChat}
                        className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                        title="New Chat"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="p-3 flex-shrink-0">
                <div className="flex items-center bg-white rounded-xl px-3 py-2.5 border border-orange-100 shadow-sm">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search conversations..."
                        className="flex-1 bg-transparent ml-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No conversations yet</p>
                    </div>
                ) : (
                    filteredConversations.map(conv => (
                        <div key={conv.id} className="relative group">
                            <button
                                onClick={() => onSelectConversation(conv)}
                                className={`w-full px-3 py-3 flex items-center gap-3 hover:bg-orange-50 transition-colors border-b border-orange-50 ${selectedConversation?.id === conv.id ? 'bg-orange-100' : ''
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${conv.type === 'group'
                                    ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                                    : 'bg-gradient-to-br from-orange-400 to-orange-500'
                                    }`}>
                                    {conv.type === 'group' ? <Users className="w-5 h-5" /> : conv.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-800 truncate">{conv.name}</span>
                                        {conv.last_message_time && (
                                            <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                                                {formatTime(conv.last_message_time)}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500 truncate">{conv.last_message || 'No messages yet'}</p>
                                </div>
                            </button>

                            {/* Delete button (simplified menu) */}
                            {userRole === 'teacher' && onDeleteConversation && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteConversation(conv.id);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
