"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Search, Globe, User, Users, UserCheck, Clock,
    ArrowUpDown, SortAsc, SortDesc, FileText, GraduationCap,
    Mail, Calendar, Eye, MessageCircle, Target, BookOpen,
    Filter, LayoutGrid, List, ChevronRight
} from "lucide-react";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useTeacherData, type Student } from "@/contexts/TeacherDataContext";

interface StudentListViewProps {
    onSelectStudent: (studentId: string) => void;
    initialStudents?: Student[];
}

type SortField = 'name' | 'country' | 'date' | 'score';
type SortDirection = 'asc' | 'desc';
type FilterCountry = 'all' | string;

export default function StudentListView({ onSelectStudent, initialStudents }: StudentListViewProps) {
    const { students: contextStudents, isLoading: contextLoading } = useTeacherData();

    // Prefer server-passed data if available
    const students = initialStudents || contextStudents;
    const isLoading = initialStudents ? false : contextLoading;

    // Only show approved students in this view
    const approvedStudents = useMemo(() =>
        students.filter(s => s.approval_status === 'approved'),
        [students]
    );

    const [filteredStudents, setFilteredStudents] = useState(approvedStudents);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
    const [filterCountry, setFilterCountry] = useState<FilterCountry>('all');

    // Get unique countries for filtering
    const countries = useMemo(() => {
        const countrySet = new Set<string>();
        approvedStudents.forEach(s => {
            if (s.preferred_country) countrySet.add(s.preferred_country);
        });
        return Array.from(countrySet).sort();
    }, [approvedStudents]);

    // Stats for overview
    const stats = useMemo(() => {
        const byCountry: Record<string, number> = {};
        let withScores = 0;
        let complete = 0;

        approvedStudents.forEach(s => {
            if (s.preferred_country) {
                byCountry[s.preferred_country] = (byCountry[s.preferred_country] || 0) + 1;
            }
            if (s.ielts_overall || s.sat_total || s.toefl_total) withScores++;
            if (s.preferred_country && (s.ielts_overall || s.sat_total)) complete++;
        });

        return {
            total: approvedStudents.length,
            byCountry,
            withScores,
            complete,
            topCountry: Object.entries(byCountry).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
        };
    }, [approvedStudents]);

    useEffect(() => {
        filterAndSortStudents();
    }, [searchQuery, approvedStudents, sortField, sortDirection, filterCountry]);

    const filterAndSortStudents = () => {
        let filtered = [...approvedStudents];

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

        // Filter by country
        if (filterCountry !== 'all') {
            filtered = filtered.filter(s => s.preferred_country === filterCountry);
        }

        // Sort
        filtered.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'name':
                    comparison = (a.full_name || '').localeCompare(b.full_name || '');
                    break;
                case 'country':
                    comparison = (a.preferred_country || 'zzz').localeCompare(b.preferred_country || 'zzz');
                    break;
                case 'score':
                    const scoreA = Number(a.ielts_overall) || Number(a.sat_total) || 0;
                    const scoreB = Number(b.ielts_overall) || Number(b.sat_total) || 0;
                    comparison = scoreB - scoreA;
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

    const getScoreDisplay = (student: typeof students[0]) => {
        if (student.ielts_overall) return { type: 'IELTS', score: student.ielts_overall, color: 'text-cyan-600 bg-cyan-50' };
        if (student.sat_total) return { type: 'SAT', score: student.sat_total, color: 'text-violet-600 bg-violet-50' };
        if (student.toefl_total) return { type: 'TOEFL', score: student.toefl_total, color: 'text-blue-600 bg-blue-50' };
        if (student.gpa) return { type: 'GPA', score: student.gpa, color: 'text-emerald-600 bg-emerald-50' };
        return null;
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
        <div className="h-full flex flex-col gap-5">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-3xl font-black">{stats.total}</p>
                            <p className="text-blue-100 text-sm font-medium">Active Students</p>
                        </div>
                        <Users className="w-10 h-10 text-blue-200" />
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-3xl font-black text-emerald-600">{stats.withScores}</p>
                            <p className="text-slate-500 text-sm font-medium">With Test Scores</p>
                        </div>
                        <GraduationCap className="w-10 h-10 text-emerald-200" />
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-3xl font-black text-orange-600">{stats.complete}</p>
                            <p className="text-slate-500 text-sm font-medium">Profile Complete</p>
                        </div>
                        <Target className="w-10 h-10 text-orange-200" />
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-black text-slate-900 truncate">{stats.topCountry}</p>
                            <p className="text-slate-500 text-sm font-medium">Top Destination</p>
                        </div>
                        <Globe className="w-10 h-10 text-slate-200" />
                    </div>
                </div>
            </div>

            {/* Filters & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 flex-1">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search students..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 outline-none transition-all text-sm"
                        />
                    </div>

                    {/* Country Filter */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <select
                            value={filterCountry}
                            onChange={(e) => setFilterCountry(e.target.value)}
                            className="pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 outline-none transition-all text-sm appearance-none bg-white cursor-pointer"
                        >
                            <option value="all">All Countries</option>
                            {countries.map(c => (
                                <option key={c} value={c}>{c} ({stats.byCountry[c]})</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* View Toggle */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">View:</span>
                    <div className="flex items-center bg-slate-100 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Info */}
            <div className="flex items-center justify-between px-1">
                <p className="text-sm text-slate-500">
                    Showing <span className="font-bold text-slate-700">{filteredStudents.length}</span> of {stats.total} students
                    {filterCountry !== 'all' && <span className="text-orange-600"> • Filtered by {filterCountry}</span>}
                </p>
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-auto bg-white rounded-2xl border border-slate-100 shadow-sm">
                {filteredStudents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-12">
                        <User className="w-16 h-16 mb-4 opacity-20" />
                        <p className="font-medium">No students found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
                    </div>
                ) : viewMode === 'table' ? (
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                            <tr>
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    <SortButton field="name" label="Student" />
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    <SortButton field="country" label="Target" />
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    <SortButton field="score" label="Scores" />
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    <SortButton field="date" label="Joined" />
                                </th>
                                <th className="text-right px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredStudents.map((student) => {
                                const scoreInfo = getScoreDisplay(student);
                                return (
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
                                            {student.preferred_country ? (
                                                <div className="flex items-center gap-2">
                                                    <Globe className="w-4 h-4 text-blue-500" />
                                                    <div>
                                                        <p className="font-medium text-slate-700 text-sm">{student.preferred_country}</p>
                                                        {student.preferred_university && (
                                                            <p className="text-xs text-slate-400 truncate max-w-[150px]">{student.preferred_university}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-sm italic">Not specified</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4">
                                            {scoreInfo ? (
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${scoreInfo.color}`}>
                                                    {scoreInfo.type}: {scoreInfo.score}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic">No scores yet</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                {formatDate(student.created_at)}
                                            </div>
                                        </td>

                                        <td className="px-6 py-4">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onSelectStudent(student.id); }}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xs font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/20 transition-all"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                View
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    /* Cards View */
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
                        {filteredStudents.map((student) => {
                            const scoreInfo = getScoreDisplay(student);
                            return (
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
                                    </div>

                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Globe className="w-4 h-4 text-blue-500" />
                                            <span className="text-slate-600">{student.preferred_country || 'No target set'}</span>
                                        </div>
                                        {student.preferred_university && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <BookOpen className="w-4 h-4 text-purple-500" />
                                                <span className="text-slate-600 truncate">{student.preferred_university}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-sm">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            <span className="text-slate-600">Joined {formatDate(student.created_at)}</span>
                                        </div>
                                    </div>

                                    {/* Score Badge */}
                                    {scoreInfo && (
                                        <div className="mb-4">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${scoreInfo.color}`}>
                                                <GraduationCap className="w-3.5 h-3.5" />
                                                {scoreInfo.type}: {scoreInfo.score}
                                            </span>
                                        </div>
                                    )}

                                    <button
                                        onClick={(e) => { e.stopPropagation(); onSelectStudent(student.id); }}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/20 transition-all"
                                    >
                                        <Eye className="w-4 h-4" />
                                        View Profile
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
