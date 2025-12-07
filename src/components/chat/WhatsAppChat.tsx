"use client";

/**
 * UniConsulting Chat Component
 * 
 * Full-featured platform-styled chat with orange theme.
 * All buttons are functional with proper features.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { MessageCircle, Users, Send, Loader2, Search, ArrowLeft, MoreVertical, Check, CheckCheck, X, Plus, UserPlus, Trash2, LogOut, Bell, Copy, Settings } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface Conversation {
    id: string;
    type: 'group' | 'direct';
    name: string;
    avatar?: string;
    last_message?: string;
    last_message_time?: string;
    unread?: number;
    teacher_id: string;
}

interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    sender_name?: string;
    is_from_me?: boolean;
}

interface Student {
    id: string;
    full_name: string;
    email: string;
}

interface Props {
    userRole: 'teacher' | 'student';
}

export default function WhatsAppChat({ userRole }: Props) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [messageSearch, setMessageSearch] = useState("");
    const [showMessageSearch, setShowMessageSearch] = useState(false);

    // Group creation
    const [showNewChat, setShowNewChat] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [groupName, setGroupName] = useState("");
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);

    // Menu states
    const [showChatMenu, setShowChatMenu] = useState(false);
    const [showConvMenu, setShowConvMenu] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatMenuRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    // Close menus on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (chatMenuRef.current && !chatMenuRef.current.contains(e.target as Node)) {
                setShowChatMenu(false);
            }
            setShowConvMenu(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        initializeChat();
    }, []);

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation.id);
            const unsubscribe = subscribeToMessages(selectedConversation.id);
            return () => { unsubscribe?.(); };
        }
    }, [selectedConversation]);

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

            if (userRole === 'teacher') {
                await fetchStudents();
            }

            await fetchConversations();
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStudents = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('role', 'student')
            .eq('approval_status', 'approved');

        setStudents(data || []);
    };

    const fetchConversations = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: participantData } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', user.id);

            const conversationIds = [...new Set(participantData?.map(p => p.conversation_id) || [])];

            if (conversationIds.length > 0) {
                const { data: convData } = await supabase
                    .from('conversations')
                    .select('*')
                    .in('id', conversationIds)
                    .order('updated_at', { ascending: false });

                const seenIds = new Set<string>();
                const seenDirectPartners = new Set<string>();
                const uniqueConversations: Conversation[] = [];

                for (const conv of convData || []) {
                    if (seenIds.has(conv.id)) continue;

                    let displayName = conv.name || 'Chat';
                    let otherUserId: string | null = null;

                    if (conv.type === 'direct') {
                        const { data: participants } = await supabase
                            .from('conversation_participants')
                            .select('user_id')
                            .eq('conversation_id', conv.id);

                        otherUserId = participants?.find(p => p.user_id !== user.id)?.user_id || null;

                        if (otherUserId && seenDirectPartners.has(otherUserId)) {
                            continue;
                        }

                        if (otherUserId) {
                            seenDirectPartners.add(otherUserId);
                            const { data: otherUser } = await supabase
                                .from('profiles')
                                .select('full_name')
                                .eq('id', otherUserId)
                                .single();
                            displayName = otherUser?.full_name || 'Unknown';
                        }
                    }

                    seenIds.add(conv.id);

                    const { data: lastMsg } = await supabase
                        .from('messages')
                        .select('content, created_at')
                        .eq('conversation_id', conv.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();

                    uniqueConversations.push({
                        ...conv,
                        name: displayName,
                        last_message: lastMsg?.content || '',
                        last_message_time: lastMsg?.created_at
                    });
                }

                setConversations(uniqueConversations);

                if (userRole === 'student' && uniqueConversations.length > 0) {
                    setSelectedConversation(uniqueConversations[0]);
                }
            }
        } catch (error) {
            console.error("Error fetching conversations:", error);
        }
    };

    const fetchMessages = async (conversationId: string) => {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) return;

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

    const subscribeToMessages = (conversationId: string) => {
        const channel = supabase
            .channel(`uni-chat-${conversationId}`)
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

        return () => supabase.removeChannel(channel);
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedConversation || !currentUserId) return;

        setIsSending(true);
        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: selectedConversation.id,
                    sender_id: currentUserId,
                    content: newMessage.trim(),
                    is_announcement: false
                });

            if (error) throw error;

            await supabase
                .from('conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', selectedConversation.id);

            setNewMessage("");
        } catch (error) {
            toast.error("Failed to send message");
        } finally {
            setIsSending(false);
        }
    };

    const createNewChat = async (studentId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: studentParticipations } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', studentId);

        const studentConvIds = studentParticipations?.map(p => p.conversation_id) || [];

        for (const convId of studentConvIds) {
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
                if (participantIds.includes(user.id)) {
                    const student = students.find(s => s.id === studentId);
                    setSelectedConversation({ ...conv, name: student?.full_name || 'Chat' });
                    setShowNewChat(false);
                    return;
                }
            }
        }

        const { data: newConv, error } = await supabase
            .from('conversations')
            .insert({ type: 'direct', teacher_id: user.id })
            .select()
            .single();

        if (error) return;

        await supabase.from('conversation_participants').insert([
            { conversation_id: newConv.id, user_id: user.id },
            { conversation_id: newConv.id, user_id: studentId }
        ]);

        await fetchConversations();
        setShowNewChat(false);

        const student = students.find(s => s.id === studentId);
        setSelectedConversation({ ...newConv, name: student?.full_name || 'Chat' });
    };

    const createGroup = async () => {
        if (!groupName.trim() || selectedStudents.length === 0) {
            toast.error("Enter group name and select students");
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setIsCreatingGroup(true);
        try {
            const { data: newConv, error } = await supabase
                .from('conversations')
                .insert({
                    type: 'group',
                    name: groupName.trim(),
                    teacher_id: user.id
                })
                .select()
                .single();

            if (error) throw error;

            const participants = [
                { conversation_id: newConv.id, user_id: user.id },
                ...selectedStudents.map(sid => ({ conversation_id: newConv.id, user_id: sid }))
            ];

            await supabase.from('conversation_participants').insert(participants);

            await fetchConversations();
            setSelectedConversation({ ...newConv, name: groupName.trim() });
            setShowNewChat(false);
            setGroupName("");
            setSelectedStudents([]);
            toast.success("Group created!");
        } catch (error) {
            toast.error("Failed to create group");
        } finally {
            setIsCreatingGroup(false);
        }
    };

    // ============================================
    // FUNCTIONAL BUTTONS
    // ============================================

    const handleDeleteConversation = async (convId: string) => {
        if (!confirm("Delete this conversation? This action cannot be undone.")) return;

        try {
            // Delete messages first
            await supabase.from('messages').delete().eq('conversation_id', convId);
            // Delete participants
            await supabase.from('conversation_participants').delete().eq('conversation_id', convId);
            // Delete conversation
            await supabase.from('conversations').delete().eq('id', convId);

            toast.success("Conversation deleted");
            setConversations(prev => prev.filter(c => c.id !== convId));
            if (selectedConversation?.id === convId) {
                setSelectedConversation(null);
            }
        } catch (error) {
            toast.error("Failed to delete conversation");
        }
        setShowConvMenu(null);
    };

    const handleClearMessages = async () => {
        if (!selectedConversation) return;
        if (!confirm("Clear all messages in this conversation?")) return;

        try {
            await supabase.from('messages').delete().eq('conversation_id', selectedConversation.id);
            setMessages([]);
            toast.success("Messages cleared");
        } catch (error) {
            toast.error("Failed to clear messages");
        }
        setShowChatMenu(false);
    };

    const handleLeaveGroup = async () => {
        if (!selectedConversation || !currentUserId) return;
        if (selectedConversation.type !== 'group') return;
        if (!confirm("Leave this group?")) return;

        try {
            await supabase
                .from('conversation_participants')
                .delete()
                .eq('conversation_id', selectedConversation.id)
                .eq('user_id', currentUserId);

            toast.success("Left group");
            setConversations(prev => prev.filter(c => c.id !== selectedConversation.id));
            setSelectedConversation(null);
        } catch (error) {
            toast.error("Failed to leave group");
        }
        setShowChatMenu(false);
    };

    const handleCopyChat = () => {
        const chatText = messages.map(m =>
            `[${new Date(m.created_at).toLocaleString()}] ${m.sender_name}: ${m.content}`
        ).join('\n');

        navigator.clipboard.writeText(chatText);
        toast.success("Chat copied to clipboard");
        setShowChatMenu(false);
    };

    const handleSearchInMessages = () => {
        setShowMessageSearch(true);
        setShowChatMenu(false);
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();

        if (isToday) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // Filter messages by search
    const filteredMessages = messageSearch
        ? messages.filter(m => m.content.toLowerCase().includes(messageSearch.toLowerCase()))
        : messages;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-orange-50 to-white">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="flex h-full bg-white overflow-hidden">
            {/* Left Sidebar - Conversation List */}
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
                            onClick={() => setShowNewChat(true)}
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
                        conversations
                            .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map(conv => (
                                <div key={conv.id} className="relative group">
                                    <button
                                        onClick={() => setSelectedConversation(conv)}
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

                                    {/* Conversation Menu (Teachers only) */}
                                    {userRole === 'teacher' && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setShowConvMenu(showConvMenu === conv.id ? null : conv.id); }}
                                                className="p-1.5 rounded-lg hover:bg-orange-200/50 text-slate-400"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {showConvMenu === conv.id && (
                                                <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-slate-100 py-1 w-40 z-10">
                                                    <button
                                                        onClick={() => handleDeleteConversation(conv.id)}
                                                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                    >
                                                        <Trash2 className="w-4 h-4" /> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                    )}
                </div>
            </div>

            {/* Right Panel - Chat */}
            <div className={`flex-1 flex flex-col bg-slate-50 ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
                {selectedConversation ? (
                    <>
                        {/* Chat Header */}
                        <div className="h-16 px-4 bg-white border-b border-slate-100 flex items-center justify-between shadow-sm flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedConversation(null)}
                                    className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${selectedConversation.type === 'group'
                                        ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                                        : 'bg-gradient-to-br from-orange-400 to-orange-500'
                                    }`}>
                                    {selectedConversation.type === 'group'
                                        ? <Users className="w-5 h-5" />
                                        : selectedConversation.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{selectedConversation.name}</h3>
                                    <p className="text-xs text-slate-500">
                                        {selectedConversation.type === 'group' ? 'Group Chat' : 'Direct Message'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Search in messages */}
                                {showMessageSearch ? (
                                    <div className="flex items-center bg-slate-100 rounded-lg px-3 py-1.5">
                                        <input
                                            type="text"
                                            value={messageSearch}
                                            onChange={(e) => setMessageSearch(e.target.value)}
                                            placeholder="Search messages..."
                                            className="bg-transparent text-sm w-32 focus:outline-none"
                                            autoFocus
                                        />
                                        <button onClick={() => { setShowMessageSearch(false); setMessageSearch(""); }}>
                                            <X className="w-4 h-4 text-slate-400" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleSearchInMessages}
                                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                                        title="Search messages"
                                    >
                                        <Search className="w-5 h-5" />
                                    </button>
                                )}

                                {/* Menu */}
                                <div className="relative" ref={chatMenuRef}>
                                    <button
                                        onClick={() => setShowChatMenu(!showChatMenu)}
                                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                                    >
                                        <MoreVertical className="w-5 h-5" />
                                    </button>

                                    {showChatMenu && (
                                        <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-slate-100 py-1 w-48 z-10">
                                            <button
                                                onClick={handleCopyChat}
                                                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                            >
                                                <Copy className="w-4 h-4" /> Copy Chat
                                            </button>
                                            {userRole === 'teacher' && (
                                                <button
                                                    onClick={handleClearMessages}
                                                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                >
                                                    <Trash2 className="w-4 h-4" /> Clear Messages
                                                </button>
                                            )}
                                            {selectedConversation.type === 'group' && (
                                                <button
                                                    onClick={handleLeaveGroup}
                                                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                >
                                                    <LogOut className="w-4 h-4" /> Leave Group
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messageSearch && (
                                <div className="text-center mb-4">
                                    <span className="inline-block px-3 py-1 bg-orange-100 rounded-full text-orange-600 text-xs">
                                        {filteredMessages.length} results for "{messageSearch}"
                                    </span>
                                </div>
                            )}

                            {filteredMessages.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="inline-block px-4 py-2 bg-white rounded-xl text-slate-500 text-sm shadow-sm border border-slate-100">
                                        {messageSearch ? 'No messages found' : 'No messages yet. Start the conversation!'}
                                    </div>
                                </div>
                            ) : (
                                filteredMessages.map((msg, idx) => {
                                    const showDate = idx === 0 ||
                                        new Date(msg.created_at).toDateString() !== new Date(filteredMessages[idx - 1].created_at).toDateString();

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
                                                        {msg.is_from_me && <CheckCheck className="w-3.5 h-3.5" />}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input */}
                        <div className="p-4 bg-white border-t border-slate-100 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-slate-50 rounded-xl px-4 py-3 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 border border-slate-200"
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={isSending || !newMessage.trim()}
                                    className="p-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition-all shadow-lg shadow-orange-200"
                                >
                                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Empty State */
                    <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-white">
                        <div className="w-32 h-32 mb-6 rounded-full bg-orange-100 flex items-center justify-center">
                            <MessageCircle className="w-16 h-16 text-orange-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">UniConsulting Chat</h2>
                        <p className="text-slate-500 text-center max-w-sm">
                            Select a conversation to start messaging with your {userRole === 'teacher' ? 'students' : 'consultant'}.
                        </p>
                    </div>
                )}
            </div>

            {/* New Chat Modal */}
            {showNewChat && userRole === 'teacher' && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl">
                        <div className="h-14 px-4 bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">
                                {selectedStudents.length > 0 ? 'Create Group' : 'New Chat'}
                            </h3>
                            <button
                                onClick={() => { setShowNewChat(false); setSelectedStudents([]); setGroupName(""); }}
                                className="p-2 rounded-full hover:bg-white/20 text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {selectedStudents.length > 0 && (
                            <div className="p-4 border-b border-slate-100">
                                <input
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="Group name..."
                                    className="w-full bg-slate-50 rounded-xl px-4 py-2.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 border border-slate-200"
                                />
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {selectedStudents.map(sid => {
                                        const s = students.find(st => st.id === sid);
                                        return (
                                            <span key={sid} className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                                {s?.full_name}
                                                <button onClick={() => setSelectedStudents(prev => prev.filter(id => id !== sid))}>
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="overflow-y-auto max-h-80">
                            {students.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => {
                                        if (selectedStudents.length > 0) {
                                            setSelectedStudents(prev =>
                                                prev.includes(student.id)
                                                    ? prev.filter(id => id !== student.id)
                                                    : [...prev, student.id]
                                            );
                                        } else {
                                            createNewChat(student.id);
                                        }
                                    }}
                                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-orange-50 transition-colors ${selectedStudents.includes(student.id) ? 'bg-orange-50' : ''
                                        }`}
                                >
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold">
                                        {student.full_name?.charAt(0) || '?'}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="font-semibold text-slate-800">{student.full_name}</p>
                                        <p className="text-sm text-slate-500">{student.email}</p>
                                    </div>
                                    {selectedStudents.includes(student.id) && (
                                        <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                                            <Check className="w-4 h-4 text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {selectedStudents.length > 0 && (
                            <div className="p-4 border-t border-slate-100">
                                <button
                                    onClick={createGroup}
                                    disabled={isCreatingGroup || !groupName.trim()}
                                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-200"
                                >
                                    {isCreatingGroup ? 'Creating...' : `Create Group (${selectedStudents.length} members)`}
                                </button>
                            </div>
                        )}

                        {selectedStudents.length === 0 && students.length > 0 && (
                            <div className="p-4 border-t border-slate-100">
                                <button
                                    onClick={() => setSelectedStudents([students[0]?.id])}
                                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-orange-600 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    <UserPlus className="w-5 h-5" />
                                    Create Group Chat
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
