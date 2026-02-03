"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Conversation, Message, Student } from "./types";

import ChatSidebar from "./ChatSidebar";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import NewChatModal from "./NewChatModal";

interface Props {
    userRole: 'teacher' | 'student';
}

export default function WhatsAppChat({ userRole }: Props) {
    // State
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [students, setStudents] = useState<Student[]>([]);

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [messageSearch, setMessageSearch] = useState("");
    const [showMessageSearch, setShowMessageSearch] = useState(false);

    // Group/New Chat State
    const [showNewChat, setShowNewChat] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [groupName, setGroupName] = useState("");
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);

    const supabase = createClient();

    // Initialization
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

        // Fetch students approved & assigned to teacher
        // (Assuming teacher_id on profiles for simplicity based on previous context, 
        // OR filtering by usage. The original code fetched ALL students approved.)
        // Original code:
        /*
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('role', 'student')
            .eq('approval_status', 'approved');
        */
        // I'll stick to original logic broadly but verifying teacher assignment if possible.
        // The original code in step 646 fetched ALL filtered by role=student.
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

                    if (conv.type === 'direct') {
                        const { data: participants } = await supabase
                            .from('conversation_participants')
                            .select('user_id')
                            .eq('conversation_id', conv.id);

                        const otherUserId = participants?.find(p => p.user_id !== user.id)?.user_id || null;

                        // Deduplication logic from original code
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

                if (userRole === 'student' && uniqueConversations.length > 0 && !selectedConversation) {
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

        return () => { supabase.removeChannel(channel); };
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
            // Optimistic update could happen here for better UX
            // But subscription handles it.
        } catch (error) {
            toast.error("Failed to send message");
        } finally {
            setIsSending(false);
        }
    };

    // Actions
    const handleDeleteConversation = async (convId: string) => {
        if (!confirm("Delete this conversation? This action cannot be undone.")) return;

        try {
            await supabase.from('messages').delete().eq('conversation_id', convId);
            await supabase.from('conversation_participants').delete().eq('conversation_id', convId);
            await supabase.from('conversations').delete().eq('id', convId);

            toast.success("Conversation deleted");
            setConversations(prev => prev.filter(c => c.id !== convId));
            if (selectedConversation?.id === convId) {
                setSelectedConversation(null);
            }
        } catch (error) {
            toast.error("Failed to delete conversation");
        }
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
    };

    const handleCopyChat = () => {
        const chatText = messages.map(m =>
            `[${new Date(m.created_at).toLocaleString()}] ${m.sender_name}: ${m.content}`
        ).join('\n');

        navigator.clipboard.writeText(chatText);
        toast.success("Chat copied to clipboard");
    };

    // New Chat / Group Logic
    const createNewChat = async (studentId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check for existing direct chat
        // (This logic is slightly expensive, ideally backend function, but keeping frontend logic for now)
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

        // Create new
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

    // Rendering
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-orange-50 to-white">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    // Identify filtered messages
    const filteredMessages = messageSearch
        ? messages.filter(m => m.content.toLowerCase().includes(messageSearch.toLowerCase()))
        : messages;

    return (
        <div className="flex h-full bg-white overflow-hidden">
            {/* Sidebar */}
            <ChatSidebar
                userRole={userRole}
                conversations={conversations}
                selectedConversation={selectedConversation}
                onSelectConversation={setSelectedConversation}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onNewChat={() => setShowNewChat(true)}
                onDeleteConversation={handleDeleteConversation}
            />

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col bg-slate-50 ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
                {selectedConversation ? (
                    <>
                        <ChatHeader
                            conversation={selectedConversation}
                            userRole={userRole}
                            onBack={() => setSelectedConversation(null)}
                            onSearch={setMessageSearch}
                            isSearching={showMessageSearch}
                            onToggleSearch={() => setShowMessageSearch(!showMessageSearch)}
                            onCopyChat={handleCopyChat}
                            onClearMessages={handleClearMessages}
                            onLeaveGroup={handleLeaveGroup}
                        />

                        <MessageList
                            messages={filteredMessages}
                            currentUserId={currentUserId}
                            selectedConversation={selectedConversation}
                            searchQuery={messageSearch}
                        />

                        <MessageInput
                            value={newMessage}
                            onChange={setNewMessage}
                            onSend={sendMessage}
                            isSending={isSending}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-white">
                        <MessageCircle className="w-16 h-16 text-orange-200 mb-4" />
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">UniConsulting Chat</h2>
                        <p className="text-slate-500">Select a conversation to start messaging</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showNewChat && userRole === 'teacher' && (
                <NewChatModal
                    students={students}
                    selectedStudents={selectedStudents}
                    groupName={groupName}
                    isCreatingGroup={isCreatingGroup}
                    onClose={() => setShowNewChat(false)}
                    onToggleStudent={(id) => setSelectedStudents(prev =>
                        prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
                    )}
                    onGroupNameChange={setGroupName}
                    onCreateGroup={createGroup}
                    onCreateDirectChat={createNewChat}
                    onStartSelection={(id) => setSelectedStudents([id])}
                />
            )}
        </div>
    );
}
