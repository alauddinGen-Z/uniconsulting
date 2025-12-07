"use client";

import { useState, useEffect, useMemo } from "react";
import { CheckCircle, Clock, Search, Loader2, UserCheck, XCircle } from "lucide-react";
import { useTeacherData } from "@/contexts/TeacherDataContext";

interface StudentQueueProps {
    onSelectStudent: (studentId: string) => void;
    selectedStudentId: string | null;
}

export default function StudentQueue({ onSelectStudent, selectedStudentId }: StudentQueueProps) {
    const { students, updateStudentStatus, isLoading } = useTeacherData();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

    // Filter students based on search and status (memoized for performance)
    const filteredStudents = useMemo(() => {
        let result = students;

        // Apply status filter
        if (statusFilter !== 'all') {
            result = result.filter(s => s.approval_status === statusFilter);
        }

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(s =>
                s.full_name?.toLowerCase().includes(query) ||
                s.preferred_university?.toLowerCase().includes(query)
            );
        }

        return result;
    }, [students, searchQuery, statusFilter]);

    const handleStatusChange = async (studentId: string, newStatus: 'pending' | 'approved' | 'rejected') => {
        await updateStudentStatus(studentId, newStatus);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved':
                return <UserCheck className="w-4 h-4 text-green-500" />;
            case 'rejected':
                return <XCircle className="w-4 h-4 text-red-500" />;
            default:
                return <Clock className="w-4 h-4 text-yellow-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved':
                return 'bg-green-500';
            case 'rejected':
                return 'bg-red-500';
            default:
                return 'bg-yellow-500';
        }
    };

    // Stats calculated from context students
    const stats = useMemo(() => ({
        pending: students.filter(s => s.approval_status === 'pending').length,
        approved: students.filter(s => s.approval_status === 'approved').length,
        rejected: students.filter(s => s.approval_status === 'rejected').length
    }), [students]);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="p-4 border-b border-slate-100">
                <h2 className="font-bold font-montserrat text-slate-900 mb-4">STUDENT QUEUE</h2>

                {/* Search */}
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-lg text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        placeholder="Search by name..."
                    />
                </div>

                {/* Status Filter */}
                <div className="flex gap-1">
                    {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setStatusFilter(filter)}
                            className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-colors capitalize ${statusFilter === filter
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-y-auto">
                {filteredStudents.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                        No students found
                    </div>
                ) : (
                    filteredStudents.map(student => (
                        <div
                            key={student.id}
                            className={`border-b border-slate-50 ${selectedStudentId === student.id ? 'bg-orange-50' : ''}`}
                        >
                            <button
                                onClick={() => onSelectStudent(student.id)}
                                className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left relative"
                            >
                                {selectedStudentId === student.id && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />
                                )}

                                {/* Status Dot */}
                                <div className={`w-2 h-2 rounded-full ${getStatusColor(student.approval_status)}`} />

                                {/* Student Info */}
                                <div className="flex-1 min-w-0">
                                    <p className={`font-bold text-sm truncate ${selectedStudentId === student.id ? 'text-orange-900' : 'text-slate-900'}`}>
                                        {student.full_name || "Unnamed Student"}
                                    </p>
                                    <p className="text-xs text-slate-500 truncate">
                                        {student.preferred_university || 'No target university'}
                                    </p>
                                </div>

                                {/* Status Icon */}
                                {getStatusIcon(student.approval_status)}
                            </button>

                            {/* Status Edit Panel (visible when selected) */}
                            {selectedStudentId === student.id && (
                                <div className="px-4 pb-3 animate-in slide-in-from-top-2 duration-200">
                                    <div className="bg-slate-50 rounded-lg p-3">
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Change Status</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStatusChange(student.id, 'pending');
                                                }}
                                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${student.approval_status === 'pending'
                                                        ? 'bg-yellow-500 text-white'
                                                        : 'bg-white border border-slate-200 text-slate-600 hover:border-yellow-300'
                                                    }`}
                                            >
                                                Pending
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStatusChange(student.id, 'approved');
                                                }}
                                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${student.approval_status === 'approved'
                                                        ? 'bg-green-500 text-white'
                                                        : 'bg-white border border-slate-200 text-slate-600 hover:border-green-300'
                                                    }`}
                                            >
                                                Approved
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStatusChange(student.id, 'rejected');
                                                }}
                                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${student.approval_status === 'rejected'
                                                        ? 'bg-red-500 text-white'
                                                        : 'bg-white border border-slate-200 text-slate-600 hover:border-red-300'
                                                    }`}
                                            >
                                                Rejected
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Footer Stats */}
            <div className="p-4 border-t border-slate-100 bg-slate-50">
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                        <p className="text-lg font-black text-yellow-600">{stats.pending}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Pending</p>
                    </div>
                    <div>
                        <p className="text-lg font-black text-green-600">{stats.approved}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Approved</p>
                    </div>
                    <div>
                        <p className="text-lg font-black text-red-600">{stats.rejected}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Rejected</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
