"use client";

import { useEffect, useState, useRef } from "react";
import { MessageCircle, Users, User, Send, Loader2, Plus, Search, ArrowLeft, Bell, X, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface Conversation {
    id: string;
    type: 'group' | 'direct';
    name: string | null;
    teacher_id: string;
    created_at: string;
    updated_at: string;
    last_message?: Message;
    unread_count?: number;
    participants?: any[];
}

interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    is_announcement: boolean;
    created_at: string;
    sender_name?: string;
    sender_role?: string;
}

interface Student {
    id: string;
    full_name: string;
    email: string;
}

interface Props {
    userRole: 'teacher' | 'student';
}

export default function ChatView({ userRole }: Props) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    // Group creation state
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [groupName, setGroupName] = useState("");

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    useEffect(() => {
        initializeChat();
    }, []);

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation.id);
            const unsubscribe = subscribeToMessages(selectedConversation.id);
            return () => unsubscribe?.();
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

            // Fetch students for teacher
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

        // Get approved students assigned to this teacher
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('teacher_id', user.id)
            .eq('role', 'student')
            .eq('approval_status', 'approved');

        if (error) {
            console.error("Error fetching students:", error);
            // Fallback: get all approved students
            const { data: allStudents } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .eq('role', 'student')
                .eq('approval_status', 'approved');
            setStudents(allStudents || []);
        } else {
            setStudents(data || []);
        }
    };

    const fetchConversations = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get conversations user is part of
            const { data: participantData } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', user.id);

            const conversationIds = participantData?.map(p => p.conversation_id) || [];

            if (conversationIds.length > 0) {
                const { data: convData } = await supabase
                    .from('conversations')
                    .select('*')
                    .in('id', conversationIds)
                    .order('updated_at', { ascending: false });

                // Get display names for each conversation
                const conversationsWithMeta = await Promise.all((convData || []).map(async (conv) => {
                    // Get participants for direct chats
                    const { data: participantIds } = await supabase
                        .from('conversation_participants')
                        .select('user_id')
                        .eq('conversation_id', conv.id);

                    const otherUserId = participantIds?.find(p => p.user_id !== user.id)?.user_id;
                    let displayName = conv.name || 'Group';

                    if (conv.type === 'direct' && otherUserId) {
                        const { data: otherUser } = await supabase
                            .from('profiles')
                            .select('full_name')
                            .eq('id', otherUserId)
                            .single();
                        displayName = otherUser?.full_name || 'Unknown';
                    }

                    return {
                        ...conv,
                        name: displayName
                    };
                }));

                setConversations(conversationsWithMeta);
            } else {
                setConversations([]);
            }
        } catch (error) {
            console.error("Error fetching conversations:", error);
        }
    };

    const fetchMessages = async (conversationId: string) => {
        // Simplified query without join
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Error fetching messages:", error);
            return;
        }

        // Fetch sender names separately
        const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
        const { data: senders } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .in('id', senderIds);

        const senderMap = new Map(senders?.map(s => [s.id, s]) || []);

        const messagesWithSenders = (data || []).map(msg => ({
            ...msg,
            sender_name: senderMap.get(msg.sender_id)?.full_name || 'Unknown',
            sender_role: senderMap.get(msg.sender_id)?.role || 'unknown'
        }));

        setMessages(messagesWithSenders);
    };

    const subscribeToMessages = (conversationId: string) => {
        const channel = supabase
            .channel(`messages-${conversationId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`
            }, async (payload: any) => {
                // Fetch sender info
                const { data: sender } = await supabase
                    .from('profiles')
                    .select('full_name, role')
                    .eq('id', payload.new.sender_id)
                    .single();

                const newMsg = {
                    ...payload.new,
                    sender_name: sender?.full_name,
                    sender_role: sender?.role
                };
                setMessages(prev => [...prev, newMsg]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
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

            // Update conversation updated_at
            await supabase
                .from('conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', selectedConversation.id);

            setNewMessage("");
        } catch (error: any) {
            console.error("Error sending message:", error);
            toast.error("Failed to send message");
        } finally {
            setIsSending(false);
        }
    };

    // Auto-create or open direct chat when clicking on a student
    const openOrCreateDirectChat = async (student: Student) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            // Check if conversation already exists
            const { data: existingParticipations } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', student.id);

            const studentConvIds = existingParticipations?.map(p => p.conversation_id) || [];

            // Find existing DM between these two users
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
                        // Found existing DM
                        setSelectedConversation({ ...conv, name: student.full_name });
                        return;
                    }
                }
            }

            // Create new DM
            const { data: newConv, error: convError } = await supabase
                .from('conversations')
                .insert({
                    type: 'direct',
                    teacher_id: user.id
                })
                .select()
                .single();

            if (convError) throw convError;

            // Add participants
            await supabase
                .from('conversation_participants')
                .insert([
                    { conversation_id: newConv.id, user_id: user.id },
                    { conversation_id: newConv.id, user_id: student.id }
                ]);

            await fetchConversations();
            setSelectedConversation({ ...newConv, name: student.full_name });
            toast.success(`Chat with ${student.full_name} opened!`);
        } catch (error) {
            console.error("Error creating chat:", error);
            toast.error("Failed to open chat");
        }
    };

    // Create group with selected students
    const createGroup = async () => {
        if (!groupName.trim() || selectedStudents.length === 0) {
            toast.error("Enter a group name and select at least one student");
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            const { data: newConv, error: convError } = await supabase
                .from('conversations')
                .insert({
                    type: 'group',
                    name: groupName.trim(),
                    teacher_id: user.id
                })
                .select()
                .single();

            if (convError) throw convError;

            // Add teacher as participant
            const participants = [
                { conversation_id: newConv.id, user_id: user.id },
                ...selectedStudents.map(sid => ({ conversation_id: newConv.id, user_id: sid }))
            ];

            await supabase
                .from('conversation_participants')
                .insert(participants);

            await fetchConversations();
            setSelectedConversation({ ...newConv, name: groupName.trim() });
            setIsCreatingGroup(false);
            setGroupName("");
            setSelectedStudents([]);
            toast.success("Group created!");
        } catch (error) {
            console.error("Error creating group:", error);
            toast.error("Failed to create group");
        }
    };

    const toggleStudentSelection = (studentId: string) => {
        setSelectedStudents(prev =>
            prev.includes(studentId)
                ? prev.filter(id => id !== studentId)
                : [...prev, studentId]
        );
    };

    const filteredStudents = students.filter(s =>
        s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-200px)] bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
            {/* Left Panel: Students (for teachers) or Conversations */}
            <div className={`w-80 border-r border-slate-100 flex flex-col ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-slate-900">Messages</h2>
                        {userRole === 'teacher' && (
                            <button
                                onClick={() => setIsCreatingGroup(true)}
                                className="p-2 rounded-xl bg-purple-500 text-white hover:bg-purple-600 transition-colors"
                                title="Create Group"
                            >
                                <Users className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-sm"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Group Conversations */}
                    {conversations.filter(c => c.type === 'group').length > 0 && (
                        <div className="p-2">
                            <p className="px-2 py-1 text-xs font-bold text-slate-400 uppercase">Groups</p>
                            {conversations.filter(c => c.type === 'group').map(conv => (
                                <button
                                    key={conv.id}
                                    onClick={() => setSelectedConversation(conv)}
                                    className={`w-full p-3 flex items-center gap-3 rounded-xl transition-colors ${selectedConversation?.id === conv.id ? 'bg-purple-50' : 'hover:bg-slate-50'}`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <p className="font-semibold text-slate-900 truncate">{conv.name}</p>
                                        <p className="text-xs text-slate-500">Group Chat</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Students (for teachers) - Click to open direct chat */}
                    {userRole === 'teacher' && filteredStudents.length > 0 && (
                        <div className="p-2">
                            <p className="px-2 py-1 text-xs font-bold text-slate-400 uppercase">Students</p>
                            {filteredStudents.map(student => {
                                const existingChat = conversations.find(c =>
                                    c.type === 'direct' && c.name === student.full_name
                                );
                                return (
                                    <button
                                        key={student.id}
                                        onClick={() => existingChat
                                            ? setSelectedConversation(existingChat)
                                            : openOrCreateDirectChat(student)
                                        }
                                        className={`w-full p-3 flex items-center gap-3 rounded-xl transition-colors ${selectedConversation?.name === student.full_name ? 'bg-orange-50' : 'hover:bg-slate-50'}`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-white flex items-center justify-center font-bold">
                                            {student.full_name?.charAt(0) || '?'}
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <p className="font-semibold text-slate-900 truncate">{student.full_name}</p>
                                            <p className="text-xs text-slate-500 truncate">{student.email}</p>
                                        </div>
                                        {existingChat && (
                                            <div className="w-2 h-2 rounded-full bg-green-500" title="Chat exists" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* For students: show existing direct chats */}
                    {userRole === 'student' && (
                        <div className="p-2">
                            {conversations.filter(c => c.type === 'direct').map(conv => (
                                <button
                                    key={conv.id}
                                    onClick={() => setSelectedConversation(conv)}
                                    className={`w-full p-3 flex items-center gap-3 rounded-xl transition-colors ${selectedConversation?.id === conv.id ? 'bg-orange-50' : 'hover:bg-slate-50'}`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-white flex items-center justify-center font-bold">
                                        {conv.name?.charAt(0) || '?'}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <p className="font-semibold text-slate-900 truncate">{conv.name}</p>
                                        <p className="text-xs text-slate-500">Your Consultant</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {students.length === 0 && conversations.length === 0 && (
                        <div className="text-center py-12 px-4">
                            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <p className="text-slate-500 font-medium">No conversations yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
                {selectedConversation ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                            <button
                                onClick={() => setSelectedConversation(null)}
                                className="md:hidden p-2 rounded-lg hover:bg-slate-100"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedConversation.type === 'group' ? 'bg-purple-100 text-purple-600' : 'bg-gradient-to-br from-orange-400 to-orange-500 text-white font-bold'}`}>
                                {selectedConversation.type === 'group'
                                    ? <Users className="w-5 h-5" />
                                    : selectedConversation.name?.charAt(0) || '?'}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">{selectedConversation.name}</h3>
                                <p className="text-xs text-slate-500">
                                    {selectedConversation.type === 'group' ? 'Group Chat' : 'Direct Message'}
                                </p>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                            {messages.length === 0 ? (
                                <div className="text-center py-12">
                                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                    <p className="text-slate-500">No messages yet. Say hello!</p>
                                </div>
                            ) : (
                                messages.map(msg => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${msg.sender_id === currentUserId
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-white text-slate-900 shadow-sm border border-slate-100'
                                            }`}>
                                            {msg.sender_id !== currentUserId && (
                                                <p className={`text-xs font-semibold mb-1 ${msg.sender_id === currentUserId ? 'text-white/80' : 'text-orange-500'}`}>
                                                    {msg.sender_name || 'Unknown'}
                                                </p>
                                            )}
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                            <p className={`text-xs mt-1 ${msg.sender_id === currentUserId ? 'text-white/70' : 'text-slate-400'}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input */}
                        <div className="p-4 border-t border-slate-100 bg-white">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                    placeholder="Type a message..."
                                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={isSending || !newMessage.trim()}
                                    className="p-3 rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-center p-8">
                        <div>
                            <MessageCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Select a conversation</h3>
                            <p className="text-slate-500">
                                {userRole === 'teacher'
                                    ? 'Click on a student to start chatting'
                                    : 'Select a conversation from the list'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Group Creation Modal */}
            {isCreatingGroup && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-slate-900">Create Group</h3>
                            <button
                                onClick={() => { setIsCreatingGroup(false); setSelectedStudents([]); setGroupName(""); }}
                                className="p-2 rounded-lg hover:bg-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Group name..."
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 mb-4"
                        />

                        <p className="text-sm font-medium text-slate-600 mb-2">
                            Select students ({selectedStudents.length} selected)
                        </p>

                        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                            {students.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => toggleStudentSelection(student.id)}
                                    className={`w-full p-3 rounded-xl flex items-center gap-3 transition-colors ${selectedStudents.includes(student.id)
                                            ? 'bg-purple-50 border-2 border-purple-500'
                                            : 'border-2 border-transparent hover:bg-slate-50'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${selectedStudents.includes(student.id)
                                            ? 'bg-purple-500 text-white'
                                            : 'bg-slate-100 text-slate-600'
                                        }`}>
                                        {selectedStudents.includes(student.id)
                                            ? <Check className="w-5 h-5" />
                                            : student.full_name?.charAt(0) || '?'}
                                    </div>
                                    <div className="text-left">
                                        <p className="font-medium text-slate-900">{student.full_name}</p>
                                        <p className="text-xs text-slate-500">{student.email}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => { setIsCreatingGroup(false); setSelectedStudents([]); setGroupName(""); }}
                                className="flex-1 py-3 rounded-xl border border-slate-200 font-medium text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createGroup}
                                disabled={!groupName.trim() || selectedStudents.length === 0}
                                className="flex-1 py-3 rounded-xl bg-purple-500 text-white font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create Group
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
