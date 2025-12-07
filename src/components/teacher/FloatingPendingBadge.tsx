"use client";

import { useState, useEffect } from "react";
import { UserCheck, X, Check, XCircle, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface PendingStudent {
    id: string;
    full_name: string;
    email: string;
    created_at: string;
}

interface FloatingPendingBadgeProps {
    onViewPending?: () => void;
}

export default function FloatingPendingBadge({ onViewPending }: FloatingPendingBadgeProps) {
    const [pendingStudents, setPendingStudents] = useState<PendingStudent[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const supabase = createClient();

    const fetchPending = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, email, created_at')
                .eq('teacher_id', user.id)
                .eq('approval_status', 'pending')
                .eq('role', 'student')
                .order('created_at', { ascending: false });

            setPendingStudents(data || []);
        } catch (error) {
            console.error("Error fetching pending:", error);
        }
    };

    useEffect(() => {
        fetchPending();

        // Real-time subscription
        const setupRealtime = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const channel = supabase
                .channel('pending-badge-updates')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'profiles',
                    filter: `teacher_id=eq.${user.id}`
                }, () => {
                    fetchPending();
                })
                .subscribe();

            return () => supabase.removeChannel(channel);
        };

        setupRealtime();
    }, []);

    const handleApprove = async (studentId: string, studentName: string) => {
        setProcessingId(studentId);
        try {
            const response = await fetch('/api/approve-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId, action: 'approve' })
            });

            if (!response.ok) throw new Error('Failed to approve');

            toast.success(`${studentName} approved!`);
            setPendingStudents(prev => prev.filter(s => s.id !== studentId));
        } catch (error) {
            toast.error("Failed to approve student");
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (studentId: string, studentName: string) => {
        setProcessingId(studentId);
        try {
            const response = await fetch('/api/approve-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId, action: 'reject' })
            });

            if (!response.ok) throw new Error('Failed to reject');

            toast.success(`${studentName} rejected`);
            setPendingStudents(prev => prev.filter(s => s.id !== studentId));
        } catch (error) {
            toast.error("Failed to reject student");
        } finally {
            setProcessingId(null);
        }
    };

    if (pendingStudents.length === 0) return null;

    return (
        <>
            {/* Floating Badge Button */}
            <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                onClick={() => setIsExpanded(!isExpanded)}
                className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full shadow-2xl shadow-orange-500/30 flex items-center justify-center text-white hover:scale-110 transition-transform"
            >
                <UserCheck className="w-6 h-6" />
                {/* Badge Count */}
                <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full text-xs font-bold flex items-center justify-center border-2 border-white">
                    {pendingStudents.length}
                </span>
            </motion.button>

            {/* Expanded Panel */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-24 right-6 z-40 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <UserCheck className="w-5 h-5" />
                                    <span className="font-bold">Pending Approvals</span>
                                </div>
                                <button
                                    onClick={() => setIsExpanded(false)}
                                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Student List */}
                        <div className="max-h-80 overflow-y-auto p-2">
                            {pendingStudents.map(student => (
                                <div
                                    key={student.id}
                                    className="p-3 rounded-xl hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                                            {student.full_name?.charAt(0) || "?"}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-slate-800 truncate">
                                                {student.full_name || "Unknown"}
                                            </p>
                                            <p className="text-xs text-slate-400 truncate">
                                                {student.email}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={() => handleApprove(student.id, student.full_name)}
                                            disabled={processingId === student.id}
                                            className="flex-1 py-2 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                                        >
                                            {processingId === student.id ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <Check className="w-3 h-3" />
                                            )}
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleReject(student.id, student.full_name)}
                                            disabled={processingId === student.id}
                                            className="flex-1 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                                        >
                                            {processingId === student.id ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <XCircle className="w-3 h-3" />
                                            )}
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
