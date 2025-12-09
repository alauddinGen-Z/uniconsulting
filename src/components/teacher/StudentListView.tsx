"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Search, Globe, User, Check, XCircle, Clock, Users, UserCheck, Loader2,
    ArrowUpDown, SortAsc, SortDesc, Filter, FileText, GraduationCap,
    Mail, Phone, Calendar, ChevronDown, MoreVertical, Eye, MessageCircle,
    TrendingUp, Target, Award
} from "lucide-react";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useTeacherData } from "@/contexts/TeacherDataContext";
import { toast } from "sonner";

interface StudentListViewProps {
    onSelectStudent: (studentId: string) => void;
}

type SortField = 'name' | 'status' | 'date' | 'country';
type SortDirection = 'asc' | 'desc';

export default function StudentListView({ onSelectStudent }: StudentListViewProps) {
    const { students, isLoading, refreshStudents } = useTeacherData();
    const [filteredStudents, setFilteredStudents] = useState(students);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

    // Calculate stats
    const stats = useMemo(() => {
        const pending = students.filter(s => s.approval_status === 'pending').length;
        const approved = students.filter(s => s.approval_status === 'approved').length;
        const rejected = students.filter(s => s.approval_status === 'rejected').length;
        const withCountry = students.filter(s => s.preferred_country).length;

        return { total: students.length, pending, approved, rejected, withCountry };
    }, [students]);

    useEffect(() => {
        filterAndSortStudents();
    }, [searchQuery, activeTab, students, sortField, sortDirection]);

    const filterAndSortStudents = () => {
        let filtered = [...students];

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(s =>
                s.full_name?.toLowerCase().includes(query) ||
                s.email?.toLowerCase().includes(query) ||
                s.preferred_country?.toLowerCase().includes(query) ||
                s.preferred_university?.toLowerCase().includes(query)
            );
        }

        // Filter by tab
        if (activeTab !== 'all') {
            filtered = filtered.filter(s => s.approval_status === activeTab);
        }

        // Sort
        filtered.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'name':
                    comparison = (a.full_name || '').localeCompare(b.full_name || '');
                    break;
                case 'status':
                    comparison = (a.approval_status || '').localeCompare(b.approval_status || '');
                    break;
                case 'country':
                    comparison = (a.preferred_country || '').localeCompare(b.preferred_country || '');
                    break;
                case 'date':
                default:
                    comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        setFilteredStudents(filtered);
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

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

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock className="w-3 h-3" />;
            case 'approved': return <Check className="w-3 h-3" />;
            case 'rejected': return <XCircle className="w-3 h-3" />;
            default: return null;
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    const SortButton = ({ field, label }: { field: SortField; label: string }) => (
        <button
            onClick={() => handleSort(field)}
            className="flex items-center gap-1 hover:text-orange-600 transition-colors"
        >
            {label}
            {sortField === field ? (
                sortDirection === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />
            ) : (
                <ArrowUpDown className="w-3 h-3 opacity-30" />
            )}
        </button>
    );

    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><LoadingSpinner /></div>;
    }

    return (
        <div className="h-full flex flex-col gap-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900">{stats.total}</p>
                            <p className="text-xs text-slate-500 font-medium">Total Students</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-yellow-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-yellow-600">{stats.pending}</p>
                            <p className="text-xs text-slate-500 font-medium">Pending</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-green-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                            <UserCheck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-green-600">{stats.approved}</p>
                            <p className="text-xs text-slate-500 font-medium">Approved</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-red-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
                            <XCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-red-600">{stats.rejected}</p>
                            <p className="text-xs text-slate-500 font-medium">Rejected</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center">
                            <Target className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-blue-600">{stats.withCountry}</p>
                            <p className="text-xs text-slate-500 font-medium">With Target</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Header with Search and Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-xl font-black font-montserrat text-slate-900">Student Directory</h2>
                    <p className="text-slate-500 text-sm">Manage and track all your students</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search name, email, country..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 outline-none transition-all text-sm w-64"
                        />
                    </div>

                    {/* View Toggle */}
                    <div className="flex items-center bg-slate-100 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FileText className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Users className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
                {[
                    { key: 'all', label: 'All', count: stats.total, color: 'slate' },
                    { key: 'pending', label: 'Pending', count: stats.pending, color: 'yellow' },
                    { key: 'approved', label: 'Approved', count: stats.approved, color: 'green' },
                    { key: 'rejected', label: 'Rejected', count: stats.rejected, color: 'red' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === tab.key
                            ? tab.color === 'slate' ? 'bg-slate-900 text-white'
                                : tab.color === 'yellow' ? 'bg-yellow-500 text-white'
                                    : tab.color === 'green' ? 'bg-green-500 text-white'
                                        : 'bg-red-500 text-white'
                            : tab.color === 'slate' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                : tab.color === 'yellow' ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                                    : tab.color === 'green' ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                        : 'bg-red-50 text-red-700 hover:bg-red-100'
                            }`}
                    >
                        {tab.label}
                        <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.key ? 'bg-white/20' : 'bg-current/10'}`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-auto bg-white rounded-2xl border border-slate-100 shadow-sm">
                {filteredStudents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-12">
                        <User className="w-16 h-16 mb-4 opacity-20" />
                        <p className="font-medium">No students found</p>
                        <p className="text-sm">{activeTab === 'pending' ? 'No pending approvals' : 'Try adjusting your filters'}</p>
                    </div>
                ) : viewMode === 'table' ? (
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                            <tr>
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    <SortButton field="name" label="Student" />
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    <SortButton field="status" label="Status" />
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    <SortButton field="country" label="Target Country" />
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    Progress
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    <SortButton field="date" label="Joined" />
                                </th>
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
                                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-orange-500/20">
                                                {student.full_name?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                                                    {student.full_name || 'Unknown'}
                                                </p>
                                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                                    <Mail className="w-3 h-3" />
                                                    {student.email}
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${getStatusBadge(student.approval_status)}`}>
                                            {getStatusIcon(student.approval_status)}
                                            {student.approval_status.charAt(0).toUpperCase() + student.approval_status.slice(1)}
                                        </span>
                                    </td>

                                    <td className="px-6 py-4">
                                        {student.preferred_country ? (
                                            <div className="flex items-center gap-2">
                                                <Globe className="w-4 h-4 text-blue-500" />
                                                <div>
                                                    <p className="font-medium text-slate-700 text-sm">{student.preferred_country}</p>
                                                    {student.preferred_university && (
                                                        <p className="text-xs text-slate-400">{student.preferred_university}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm italic">Not specified</span>
                                        )}
                                    </td>

                                    <td className="px-6 py-4">
                                        <div className="w-full max-w-[100px]">
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="text-slate-500">Profile</span>
                                                <span className="font-bold text-slate-700">
                                                    {student.ielts_overall ? '75%' : student.preferred_country ? '50%' : '25%'}
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-orange-400 to-pink-500 rounded-full transition-all"
                                                    style={{ width: student.ielts_overall ? '75%' : student.preferred_country ? '50%' : '25%' }}
                                                />
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            {formatDate(student.created_at)}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            {student.approval_status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={(e) => handleApprove(student.id, student.full_name, e)}
                                                        disabled={processingId === student.id}
                                                        className="px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1 disabled:opacity-50 shadow-sm"
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
                                                        className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1 disabled:opacity-50 shadow-sm"
                                                    >
                                                        <XCircle className="w-3 h-3" />
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                            {student.approval_status !== 'pending' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onSelectStudent(student.id); }}
                                                    className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1"
                                                >
                                                    <Eye className="w-3 h-3" />
                                                    View
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    /* Cards View */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                        {filteredStudents.map((student) => (
                            <div
                                key={student.id}
                                onClick={() => onSelectStudent(student.id)}
                                className="bg-white rounded-2xl border border-slate-100 p-5 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/10 cursor-pointer transition-all group"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-orange-500/20">
                                            {student.full_name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                                                {student.full_name || 'Unknown'}
                                            </p>
                                            <p className="text-xs text-slate-500">{student.email}</p>
                                        </div>
                                    </div>
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadge(student.approval_status)}`}>
                                        {getStatusIcon(student.approval_status)}
                                        {student.approval_status}
                                    </span>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Globe className="w-4 h-4 text-blue-500" />
                                        <span className="text-slate-600">{student.preferred_country || 'No target set'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        <span className="text-slate-600">Joined {formatDate(student.created_at)}</span>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="mb-4">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-slate-500">Profile Completion</span>
                                        <span className="font-bold text-slate-700">
                                            {student.ielts_overall ? '75%' : student.preferred_country ? '50%' : '25%'}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-orange-400 to-pink-500 rounded-full"
                                            style={{ width: student.ielts_overall ? '75%' : student.preferred_country ? '50%' : '25%' }}
                                        />
                                    </div>
                                </div>

                                {student.approval_status === 'pending' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => handleApprove(student.id, student.full_name, e)}
                                            disabled={processingId === student.id}
                                            className="flex-1 py-2 bg-green-500 text-white text-sm font-bold rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                                        >
                                            {processingId === student.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                            Approve
                                        </button>
                                        <button
                                            onClick={(e) => handleReject(student.id, student.full_name, e)}
                                            disabled={processingId === student.id}
                                            className="flex-1 py-2 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                                        >
                                            <XCircle className="w-4 h-4" />
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
