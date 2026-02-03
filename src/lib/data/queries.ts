/**
 * Server-Side Cached Data Fetchers
 * 
 * Uses React cache() for request-level memoization.
 * These functions can be called multiple times in the same request
 * and will only execute once.
 * 
 * @file src/lib/data/queries.ts
 */

import { cache } from 'react';
import { createClient } from '@/utils/supabase/server';

export type Profile = {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    role: 'student' | 'teacher' | 'owner';
    approval_status: 'pending' | 'approved' | 'rejected' | null;
    teacher_id: string | null;
    avatar_url: string | null;
    created_at: string | null;
    updated_at: string | null;
    bio: string | null;
    agency_id: string | null;
};

export type University = {
    id: string;
    name: string;
    country: string;
    city: string | null;
    ranking: number | null;
    logo_url: string | null;
    website: string | null;
};

/**
 * Get current user profile - cached per request
 */
export const getCurrentUser = cache(async () => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, approval_status, avatar_url, agency_id')
        .eq('id', user.id)
        .single();

    return profile;
});

/**
 * Get students for a teacher - cached per request
 */
export const getStudentsForTeacher = cache(async (teacherId: string) => {
    const supabase = await createClient();

    const { data: students, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, approval_status, avatar_url, created_at, updated_at')
        .eq('teacher_id', teacherId)
        .eq('role', 'student')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching students:', error);
        return [];
    }

    return students || [];
});

/**
 * Get pending students for a teacher - cached per request
 */
export const getPendingStudents = cache(async (teacherId: string) => {
    const supabase = await createClient();

    const { data: students, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, created_at')
        .eq('teacher_id', teacherId)
        .eq('role', 'student')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching pending students:', error);
        return [];
    }

    return students || [];
});

/**
 * Get universities - cached per request
 */
export const getUniversities = cache(async (limit = 100) => {
    const supabase = await createClient();

    const { data: universities, error } = await supabase
        .from('universities')
        .select('id, name, country, city, ranking, logo_url, website')
        .order('ranking', { ascending: true, nullsFirst: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching universities:', error);
        return [];
    }

    return universities || [];
});

/**
 * Get student by ID - cached per request
 */
export const getStudentById = cache(async (studentId: string) => {
    const supabase = await createClient();

    const { data: student, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single();

    if (error) {
        console.error('Error fetching student:', error);
        return null;
    }

    return student;
});

/**
 * Get full dashboard data for teacher - cached per request
 */
export const getTeacherDashboardData = cache(async (teacherId: string) => {
    const supabase = await createClient();

    // 1. Fetch all students for this teacher
    const { data: students } = await supabase
        .from('profiles')
        .select('id, full_name, approval_status, created_at')
        .eq('teacher_id', teacherId)
        .eq('role', 'student');

    const totalStudents = students?.length || 0;
    const pendingApprovals = students?.filter(s => s.approval_status === 'pending').length || 0;
    const approvedStudents = students?.filter(s => s.approval_status === 'approved').length || 0;
    const studentIds = students?.map(s => s.id) || [];

    // 2. Parallel fetch for count, deadlines, recent docs
    const queries: PromiseLike<any>[] = [];

    // Documents count
    if (studentIds.length > 0) {
        queries.push(
            supabase.from('documents').select('*', { count: 'exact', head: true }).in('student_id', studentIds)
        );
    } else {
        queries.push(Promise.resolve({ count: 0 }));
    }

    // Deadlines
    if (studentIds.length > 0) {
        queries.push(
            supabase.from('student_universities')
                .select('id, university_name, deadline_date, deadline_type, student_id')
                .in('student_id', studentIds)
                .gte('deadline_date', new Date().toISOString().split('T')[0])
                .order('deadline_date', { ascending: true })
                .limit(5)
        );
    } else {
        queries.push(Promise.resolve({ data: [] }));
    }

    // Recent documents
    if (studentIds.length > 0) {
        queries.push(
            supabase.from('documents')
                .select('id, type, created_at, student_id')
                .in('student_id', studentIds)
                .order('created_at', { ascending: false })
                .limit(5)
        );
    } else {
        queries.push(Promise.resolve({ data: [] }));
    }

    const [docsCountResult, deadlinesResult, recentDocsResult] = await Promise.all(queries);

    const totalDocuments = docsCountResult.count || 0;

    // Process deadlines
    const deadlines = (deadlinesResult.data || []).map((d: any) => {
        const student = students?.find(s => s.id === d.student_id);
        const daysLeft = Math.ceil((new Date(d.deadline_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return {
            id: d.id,
            universityName: d.university_name,
            studentName: student?.full_name || 'Unknown',
            date: d.deadline_date,
            daysLeft,
            type: d.deadline_type
        };
    });

    // Process Activity Feed
    const activities: any[] = [];
    const formatTimeAgo = (date: Date): string => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    // Recent students
    const recentStudents = students?.filter(s => {
        const created = new Date(s.created_at);
        const daysDiff = (new Date().getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7;
    }) || [];

    recentStudents.forEach(s => {
        activities.push({
            id: `student-${s.id}`,
            type: 'approval',
            title: s.approval_status === 'pending' ? 'New Student Signup' : 'Student Approved',
            description: `${s.full_name} ${s.approval_status === 'pending' ? 'is waiting for approval' : 'joined your roster'}`,
            time: formatTimeAgo(new Date(s.created_at)),
            studentName: s.full_name,
            originalTime: new Date(s.created_at).getTime() // For sorting
        });
    });

    // Recent docs
    (recentDocsResult.data || []).forEach((doc: any) => {
        const student = students?.find(s => s.id === doc.student_id);
        activities.push({
            id: `doc-${doc.id}`,
            type: 'document',
            title: 'Document Uploaded',
            description: `${student?.full_name || 'A student'} uploaded ${doc.type}`,
            time: formatTimeAgo(new Date(doc.created_at)),
            studentName: student?.full_name,
            originalTime: new Date(doc.created_at).getTime()
        });
    });

    // Sort activities by time desc
    activities.sort((a, b) => b.originalTime - a.originalTime);

    // Remove sorting key
    const finalActivities = activities.slice(0, 8).map(({ originalTime, ...rest }) => rest);

    return {
        stats: {
            totalStudents,
            pendingApprovals,
            approvedStudents,
            totalDocuments,
            completedApplications: 0,
            upcomingDeadlines: deadlines.length
        },
        activities: finalActivities,
        deadlines
    };
});
