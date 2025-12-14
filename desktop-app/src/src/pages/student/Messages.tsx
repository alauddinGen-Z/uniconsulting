import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import { supabase } from '../../lib/supabase';
import { Send, Loader2, User } from 'lucide-react';

interface Message {
    id: string;
    content: string;
    sender_id: string;
    receiver_id: string;
    created_at: string;
    is_read: boolean;
}

export default function StudentMessagesPage() {
    const { user } = useAppStore();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [teacherName, setTeacherName] = useState('Your Teacher');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadMessages();
        loadTeacherInfo();
        subscribeToMessages();
    }, [user]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadTeacherInfo = async () => {
        if (!user?.teacher_id) return;

        const { data } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.teacher_id)
            .single();

        if (data) setTeacherName(data.full_name);
    };

    const loadMessages = async () => {
        if (!user?.id) return;

        const { data } = await supabase
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .order('created_at', { ascending: true });

        setMessages(data || []);

        // Mark messages as read
        if (data && data.length > 0) {
            const unreadIds = data.filter(m => m.receiver_id === user.id && !m.is_read).map(m => m.id);
            if (unreadIds.length > 0) {
                await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
            }
        }
    };

    const subscribeToMessages = () => {
        if (!user?.id) return;

        const channel = supabase
            .channel('student-messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${user.id}`,
            }, (payload) => {
                setMessages(prev => [...prev, payload.new as Message]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async () => {
        if (!newMessage.trim() || !user?.id || !user?.teacher_id) return;

        setIsSending(true);

        const { data, error } = await supabase
            .from('messages')
            .insert({
                content: newMessage.trim(),
                sender_id: user.id,
                receiver_id: user.teacher_id,
                is_read: false,
            })
            .select()
            .single();

        if (!error && data) {
            setMessages(prev => [...prev, data]);
            setNewMessage('');
        }

        setIsSending(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (date: string) => {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
        });
    };

    // Group messages by date
    const groupedMessages: { [date: string]: Message[] } = {};
    messages.forEach(msg => {
        const date = new Date(msg.created_at).toDateString();
        if (!groupedMessages[date]) groupedMessages[date] = [];
        groupedMessages[date].push(msg);
    });

    return (
        <div className="flex flex-col h-[calc(100vh-48px)]">
            {/* Header */}
            <div className="bg-white rounded-t-2xl p-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="font-bold text-slate-900">{teacherName}</h2>
                    <p className="text-sm text-green-500">Your Counselor</p>
                </div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-4">
                {Object.entries(groupedMessages).map(([date, msgs]) => (
                    <div key={date}>
                        <div className="flex justify-center my-4">
                            <span className="px-3 py-1 bg-white rounded-full text-xs text-slate-500 shadow-sm">
                                {formatDate(date)}
                            </span>
                        </div>
                        {msgs.map((msg) => {
                            const isMe = msg.sender_id === user?.id;
                            return (
                                <div
                                    key={msg.id}
                                    className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}
                                >
                                    <div
                                        className={`max-w-[70%] px-4 py-2 rounded-2xl ${isMe
                                            ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-br-md'
                                            : 'bg-white text-slate-900 rounded-bl-md shadow-sm'
                                            }`}
                                    >
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        <p className={`text-xs mt-1 ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
                                            {formatTime(msg.created_at)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white rounded-b-2xl p-4 border-t border-slate-100">
                <div className="flex items-end gap-3">
                    <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type a message..."
                        rows={1}
                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                        style={{ maxHeight: '120px' }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!newMessage.trim() || isSending}
                        className="p-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl hover:from-orange-600 hover:to-pink-600 transition disabled:opacity-50"
                    >
                        {isSending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
