"use client";

import { Check, Calendar, X } from "lucide-react";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useTeacherData } from "@/contexts/TeacherDataContext";

export default function PendingStudentsView() {
    const { pendingStudents, updateStudentStatus, isLoading } = useTeacherData();

    const handleAction = async (studentId: string, action: 'approve' | 'reject') => {
        const newStatus = action === 'approve' ? 'approved' : 'rejected';
        await updateStudentStatus(studentId, newStatus);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <LoadingSpinner />
            </div>
        );
    }

    if (pendingStudents.length === 0) {
        return (
            <div className="p-8 max-w-5xl mx-auto">
                <h2 className="text-2xl font-black font-montserrat text-slate-900 mb-6">
                    PENDING APPROVALS
                </h2>
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">All caught up!</h3>
                    <p className="text-slate-500">No students pending approval.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black font-montserrat text-slate-900 flex items-center gap-3">
                    PENDING APPROVALS
                    <span className="bg-orange-100 text-orange-600 text-base font-bold px-4 py-1.5 rounded-full animate-pulse">
                        {pendingStudents.length}
                    </span>
                </h2>
                <p className="text-sm text-slate-500">
                    Review and approve student accounts to grant them access
                </p>
            </div>

            <div className="grid gap-4">
                {pendingStudents.map(student => (
                    <div key={student.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 font-bold text-xl">
                                {student.full_name?.[0] || '?'}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 text-lg">{student.full_name || "Unknown Name"}</h3>
                                <div className="flex items-center gap-4 text-sm text-slate-500">
                                    {student.preferred_university && (
                                        <span>Target: {student.preferred_university}</span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        Joined {new Date(student.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handleAction(student.id, 'reject')}
                                className="px-4 py-2 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-lg font-bold transition-colors flex items-center gap-2"
                            >
                                <X className="w-4 h-4" />
                                Reject
                            </button>
                            <button
                                onClick={() => handleAction(student.id, 'approve')}
                                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold shadow-lg shadow-orange-500/20 transition-all hover:scale-105 flex items-center gap-2"
                            >
                                <Check className="w-4 h-4" />
                                Approve
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
