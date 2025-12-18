/**
 * Virtualized Student List Component
 * 
 * High-performance student list using windowing/virtualization.
 * Only renders visible rows (+ buffer) for smooth scrolling with
 * hundreds of students on low-end hardware.
 * 
 * Uses @tanstack/react-virtual for lightweight virtualization.
 * 
 * @module components/teacher/StudentList
 */

import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

// ============================================================================
//                         TYPES & INTERFACES
// ============================================================================

export interface Student {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    approval_status: 'pending' | 'approved' | 'rejected';
    preferred_country?: string;
    preferred_university?: string;
    created_at: string;
    // Academic scores
    ielts_overall?: string;
    sat_total?: string;
    gpa?: string;
}

export interface StudentListProps {
    /** Array of student data */
    students: Student[];
    /** Loading state */
    isLoading?: boolean;
    /** Callback when a student row is clicked */
    onStudentClick?: (student: Student) => void;
    /** Callback for student approval action */
    onApprove?: (studentId: string) => void;
    /** Callback for student rejection action */
    onReject?: (studentId: string) => void;
    /** Height of the list container (default: 600px) */
    containerHeight?: number;
    /** Estimated row height (default: 72px) */
    estimatedRowHeight?: number;
    /** Number of overscan rows (default: 5) */
    overscan?: number;
    /** Search filter query */
    searchQuery?: string;
}

// ============================================================================
//                         SKELETON LOADER
// ============================================================================

const SkeletonRow: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
    <div
        style={style}
        className="flex items-center gap-4 px-4 py-3 border-b border-slate-700/50 animate-pulse"
    >
        {/* Avatar skeleton */}
        <div className="w-10 h-10 rounded-full bg-slate-700/50" />

        {/* Content skeleton */}
        <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-700/50 rounded w-1/3" />
            <div className="h-3 bg-slate-700/30 rounded w-1/2" />
        </div>

        {/* Status skeleton */}
        <div className="w-20 h-6 bg-slate-700/50 rounded-full" />
    </div>
);

// ============================================================================
//                         STUDENT ROW COMPONENT
// ============================================================================

interface StudentRowProps {
    student: Student;
    style: React.CSSProperties;
    onClick?: (student: Student) => void;
    onApprove?: (studentId: string) => void;
    onReject?: (studentId: string) => void;
}

const StudentRow: React.FC<StudentRowProps> = React.memo(({
    student,
    style,
    onClick,
    onApprove,
    onReject,
}) => {
    const statusColors = {
        pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        approved: 'bg-green-500/20 text-green-400 border-green-500/30',
        rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    const handleApprove = (e: React.MouseEvent) => {
        e.stopPropagation();
        onApprove?.(student.id);
    };

    const handleReject = (e: React.MouseEvent) => {
        e.stopPropagation();
        onReject?.(student.id);
    };

    // Get initials for avatar
    const initials = student.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <div
            style={style}
            onClick={() => onClick?.(student)}
            className="flex items-center gap-4 px-4 py-3 border-b border-slate-700/50 
                 hover:bg-slate-800/50 cursor-pointer transition-colors duration-150
                 group"
            role="row"
            tabIndex={0}
            aria-label={`Student: ${student.full_name}`}
        >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 
                      flex items-center justify-center text-white font-medium text-sm
                      flex-shrink-0">
                {initials}
            </div>

            {/* Main Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-100 truncate">
                        {student.full_name}
                    </h3>
                    {student.preferred_country && (
                        <span className="text-xs text-slate-500 hidden sm:inline">
                            • {student.preferred_country}
                        </span>
                    )}
                </div>
                <p className="text-sm text-slate-400 truncate">
                    {student.email}
                </p>
            </div>

            {/* Scores (hidden on mobile) */}
            <div className="hidden lg:flex items-center gap-4 text-sm text-slate-400">
                {student.ielts_overall && (
                    <span title="IELTS">
                        IELTS: <span className="text-slate-200">{student.ielts_overall}</span>
                    </span>
                )}
                {student.sat_total && (
                    <span title="SAT">
                        SAT: <span className="text-slate-200">{student.sat_total}</span>
                    </span>
                )}
                {student.gpa && (
                    <span title="GPA">
                        GPA: <span className="text-slate-200">{student.gpa}</span>
                    </span>
                )}
            </div>

            {/* Status Badge */}
            <div className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[student.approval_status]}`}>
                {student.approval_status.charAt(0).toUpperCase() + student.approval_status.slice(1)}
            </div>

            {/* Action Buttons (show on hover for pending students) */}
            {student.approval_status === 'pending' && (
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={handleApprove}
                        className="p-1.5 rounded-md bg-green-500/20 text-green-400 
                       hover:bg-green-500/30 transition-colors"
                        title="Approve"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                    <button
                        onClick={handleReject}
                        className="p-1.5 rounded-md bg-red-500/20 text-red-400 
                       hover:bg-red-500/30 transition-colors"
                        title="Reject"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
});

StudentRow.displayName = 'StudentRow';

// ============================================================================
//                         EMPTY STATE
// ============================================================================

const EmptyState: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => (
    <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-300 mb-1">
            {searchQuery ? 'No students found' : 'No students yet'}
        </h3>
        <p className="text-sm text-slate-500 max-w-sm">
            {searchQuery
                ? `No students match "${searchQuery}". Try a different search term.`
                : 'Students will appear here once they create accounts and are assigned to you.'}
        </p>
    </div>
);

// ============================================================================
//                         MAIN VIRTUALIZED LIST
// ============================================================================

export const StudentList: React.FC<StudentListProps> = ({
    students,
    isLoading = false,
    onStudentClick,
    onApprove,
    onReject,
    containerHeight = 600,
    estimatedRowHeight = 72,
    overscan = 5,
    searchQuery = '',
}) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const [isScrolling, setIsScrolling] = useState(false);

    // Filter students based on search query
    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return students;

        const query = searchQuery.toLowerCase();
        return students.filter(student =>
            student.full_name.toLowerCase().includes(query) ||
            student.email.toLowerCase().includes(query) ||
            student.preferred_country?.toLowerCase().includes(query) ||
            student.preferred_university?.toLowerCase().includes(query)
        );
    }, [students, searchQuery]);

    // Setup virtualizer
    const virtualizer = useVirtualizer({
        count: isLoading ? 10 : filteredStudents.length, // Show 10 skeletons when loading
        getScrollElement: () => parentRef.current,
        estimateSize: useCallback(() => estimatedRowHeight, [estimatedRowHeight]),
        overscan,
        // Enable smooth scrolling detection
        scrollMargin: 0,
    });

    // Track scrolling state for performance optimizations
    useEffect(() => {
        let scrollTimeout: ReturnType<typeof setTimeout>;

        const handleScroll = () => {
            setIsScrolling(true);
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => setIsScrolling(false), 150);
        };

        const element = parentRef.current;
        element?.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            element?.removeEventListener('scroll', handleScroll);
            clearTimeout(scrollTimeout);
        };
    }, []);

    const virtualItems = virtualizer.getVirtualItems();

    // Show empty state
    if (!isLoading && filteredStudents.length === 0) {
        return <EmptyState searchQuery={searchQuery} />;
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header row */}
            <div className="flex items-center gap-4 px-4 py-2 bg-slate-800/50 border-b border-slate-700 
                      text-xs font-medium text-slate-400 uppercase tracking-wider sticky top-0 z-10">
                <div className="w-10" /> {/* Avatar space */}
                <div className="flex-1">Student</div>
                <div className="hidden lg:block w-48">Scores</div>
                <div className="w-24 text-center">Status</div>
                <div className="w-20" /> {/* Actions space */}
            </div>

            {/* Virtualized list container */}
            <div
                ref={parentRef}
                className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 
                   scrollbar-track-transparent"
                style={{ height: containerHeight }}
            >
                <div
                    style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {virtualItems.map((virtualItem) => {
                        const rowStyle: React.CSSProperties = {
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualItem.size}px`,
                            transform: `translateY(${virtualItem.start}px)`,
                        };

                        // Show skeleton while loading
                        if (isLoading) {
                            return (
                                <SkeletonRow
                                    key={`skeleton-${virtualItem.index}`}
                                    style={rowStyle}
                                />
                            );
                        }

                        const student = filteredStudents[virtualItem.index];
                        if (!student) return null;

                        return (
                            <StudentRow
                                key={student.id}
                                student={student}
                                style={rowStyle}
                                onClick={onStudentClick}
                                onApprove={onApprove}
                                onReject={onReject}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Footer with count */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800/30 
                      border-t border-slate-700 text-xs text-slate-500">
                <span>
                    Showing {filteredStudents.length} of {students.length} students
                    {searchQuery && ` matching "${searchQuery}"`}
                </span>
                {isScrolling && (
                    <span className="text-blue-400 animate-pulse">Scrolling...</span>
                )}
            </div>
        </div>
    );
};

// ============================================================================
//                         HOOK: USE STUDENT LIST
// ============================================================================

/**
 * Custom hook for managing student list state with virtualization support.
 * Handles loading, filtering, and selection.
 */
export function useStudentList(initialStudents: Student[] = []) {
    const [students, setStudents] = useState<Student[]>(initialStudents);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const selectedStudent = useMemo(
        () => students.find(s => s.id === selectedId),
        [students, selectedId]
    );

    const handleStudentClick = useCallback((student: Student) => {
        setSelectedId(student.id);
    }, []);

    const updateStudent = useCallback((studentId: string, updates: Partial<Student>) => {
        setStudents(prev =>
            prev.map(s => s.id === studentId ? { ...s, ...updates } : s)
        );
    }, []);

    return {
        students,
        setStudents,
        selectedId,
        selectedStudent,
        searchQuery,
        setSearchQuery,
        handleStudentClick,
        updateStudent,
    };
}

export default StudentList;
