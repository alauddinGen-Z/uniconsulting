"use client";

import { useState, useEffect } from "react";
import { Search, Globe, User, Check, XCircle, Clock, Users, UserCheck, Loader2 } from "lucide-react";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useTeacherData } from "@/contexts/TeacherDataContext";
import { toast } from "sonner";

interface StudentListViewProps {
    onSelectStudent: (studentId: string) => void;
}

export default function StudentListView({ onSelectStudent }: StudentListViewProps) {
    const { students, isLoading, refreshStudents } = useTeacherData();
    const [filteredStudents, setFilteredStudents] = useState(students);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved'>('all');
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        filterStudents();
    }, [searchQuery, activeTab, students]);

    const filterStudents = () => {
        let filtered = students;

        // Filter by search query
        if (searchQuery) {
            filtered = filtered.filter(s =>
                s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.email?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Filter by tab
        if (activeTab === 'pending') {
            filtered = filtered.filter(s => s.approval_status === 'pending');
        } else if (activeTab === 'approved') {
            filtered = filtered.filter(s => s.approval_status === 'approved');
        }

        setFilteredStudents(filtered);
    };

    const pendingCount = students.filter(s => s.approval_status === 'pending').length;
    const approvedCount = students.filter(s => s.approval_status === 'approved').length;

    const handleApprove = async (studentId: string, studentName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setProcessingId(studentId);
        try {
            const response = await fetch('/api/approve-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId, action: 'approve' })
            });

            if (!response.ok) throw new Error('Failed to approve');

            toast.success(`${studentName} approved!`);
            refreshStudents();
        } catch (error) {
            toast.error("Failed to approve student");
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (studentId: string, studentName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setProcessingId(studentId);
        try {
            const response = await fetch('/api/approve-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId, action: 'reject' })
            });

            if (!response.ok) throw new Error('Failed to reject');

            toast.success(`${studentName} rejected`);
            refreshStudents();
        } catch (error) {
            toast.error("Failed to reject student");
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
            approved: "bg-green-100 text-green-700 border-green-200",
            rejected: "bg-red-100 text-red-700 border-red-200",
        };
        return styles[status as keyof typeof styles] || "bg-gray-100 text-gray-700";
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><LoadingSpinner /></div>;
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-black font-montserrat text-slate-900">ALL STUDENTS</h2>
                    <p className="text-slate-500 text-sm">Manage all your students in one place</p>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search students..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 outline-none transition-all text-sm w-64"
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                >
                    <Users className="w-4 h-4" />
                    All
                    <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'all' ? 'bg-white/20' : 'bg-slate-200'}`}>
                        {students.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'pending'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                        }`}
                >
                    <Clock className="w-4 h-4" />
                    Pending
                    <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'pending' ? 'bg-white/20' : 'bg-yellow-200'}`}>
                        {pendingCount}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('approved')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'approved'
                        ? 'bg-green-500 text-white'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                >
                    <UserCheck className="w-4 h-4" />
                    Approved
                    <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'approved' ? 'bg-white/20' : 'bg-green-200'}`}>
                        {approvedCount}
                    </span>
                </button>
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-auto bg-white rounded-2xl border border-slate-100 shadow-sm">
                {filteredStudents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-12">
                        <User className="w-16 h-16 mb-4 opacity-20" />
                        <p className="font-medium">No students found</p>
                        <p className="text-sm">{activeTab === 'pending' ? 'No pending approvals' : 'Try adjusting your filters'}</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                            <tr>
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Student</th>
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Target</th>
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Joined</th>
                                <th className="text-right px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredStudents.map((student) => (
                                <tr
                                    key={student.id}
                                    onClick={() => onSelectStudent(student.id)}
                                    className="hover:bg-orange-50/50 cursor-pointer transition-colors group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold">
                                                {student.full_name?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                                                    {student.full_name || 'Unknown'}
                                                </p>
                                                <p className="text-xs text-slate-500">{student.email}</p>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(student.approval_status)}`}>
                                            {student.approval_status}
                                        </span>
                                    </td>

                                    <td className="px-6 py-4">
                                        {student.preferred_country || student.preferred_university ? (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Globe className="w-4 h-4 text-blue-500" />
                                                <span className="font-medium text-slate-700">
                                                    {student.preferred_country || student.preferred_university}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm">Not set</span>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {new Date(student.created_at).toLocaleDateString()}
                                    </td>

                                    <td className="px-6 py-4">
                                        {student.approval_status === 'pending' && (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={(e) => handleApprove(student.id, student.full_name, e)}
                                                    disabled={processingId === student.id}
                                                    className="px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    {processingId === student.id ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <Check className="w-3 h-3" />
                                                    )}
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={(e) => handleReject(student.id, student.full_name, e)}
                                                    disabled={processingId === student.id}
                                                    className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    <XCircle className="w-3 h-3" />
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                        {student.approval_status === 'approved' && (
                                            <span className="text-green-600 text-xs font-bold">✓ Active</span>
                                        )}
                                        {student.approval_status === 'rejected' && (
                                            <span className="text-red-600 text-xs font-bold">✗ Rejected</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
