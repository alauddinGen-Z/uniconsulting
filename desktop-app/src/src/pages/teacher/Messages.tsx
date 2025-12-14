import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { supabase } from '../../lib/supabase';
import { Send, User } from 'lucide-react';

export default function Messages() {
    const { user, students, messages, addMessage } = useAppStore();
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Filter messages for selected conversation
    const conversationMessages = messages.filter(m =>
        (m.sender_id === user?.id && m.receiver_id === selectedStudentId) ||
        (m.sender_id === selectedStudentId && m.receiver_id === user?.id)
    );

    // Get student details
    const selectedStudent = students.find(s => s.id === selectedStudentId);

    // Auto-scroll to bottom when new message arrives
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversationMessages.length]);

    const handleSend = async () => {
        if (!newMessage.trim() || !selectedStudentId || !user) return;

        setIsSending(true);
        try {
            const messageData = {
                sender_id: user.id,
                receiver_id: selectedStudentId,
                content: newMessage.trim(),
                is_read: false,
            };

            const { data, error } = await supabase
                .from('messages')
                .insert(messageData)
                .select()
                .single();

            if (!error && data) {
                addMessage(data);
                setNewMessage('');
            }
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="h-full flex bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Conversations List */}
            <div className="w-80 border-r border-slate-100 flex flex-col">
                <div className="p-4 border-b border-slate-100">
                    <h2 className="font-bold text-slate-900">Messages</h2>
                </div>
                <div className="flex-1 overflow-auto">
                    {students.filter(s => s.approval_status === 'approved').map(student => {
                        const lastMsg = messages
                            .filter(m => m.sender_id === student.id || m.receiver_id === student.id)
                            .slice(-1)[0];
                        const unread = messages.filter(
                            m => m.sender_id === student.id && m.receiver_id === user?.id && !m.is_read
                        ).length;

                        return (
                            <button
                                key={student.id}
                                onClick={() => setSelectedStudentId(student.id)}
                                className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition text-left ${selectedStudentId === student.id ? 'bg-orange-50 border-r-2 border-orange-500' : ''
                                    }`}
                            >
                                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold">
                                    {student.full_name?.[0] || '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-slate-900 truncate">{student.full_name}</div>
                                    <div className="text-sm text-slate-500 truncate">{lastMsg?.content || 'No messages'}</div>
                                </div>
                                {unread > 0 && (
                                    <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                                        {unread}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
                {selectedStudentId ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold">
                                {selectedStudent?.full_name?.[0] || '?'}
                            </div>
                            <div>
                                <div className="font-medium text-slate-900">{selectedStudent?.full_name}</div>
                                <div className="text-sm text-slate-500">{selectedStudent?.email}</div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-auto p-4 space-y-4">
                            {conversationMessages.map(msg => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-xs px-4 py-2 rounded-2xl ${msg.sender_id === user?.id
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-slate-100 text-slate-900'
                                        }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-slate-100">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Type a message..."
                                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={isSending || !newMessage.trim()}
                                    className="px-4 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition disabled:opacity-50"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500">
                        <div className="text-center">
                            <User className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <p>Select a conversation</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
