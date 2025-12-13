"use client";

import { useEffect, useState, useRef } from "react";
import {
    Users, GraduationCap, FileText, Clock, TrendingUp,
    CheckCircle, AlertCircle, Calendar, Bell, MessageCircle,
    ChevronRight, Sparkles, Target, Award
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

interface Stats {
    totalStudents: number;
    pendingApprovals: number;
    approvedStudents: number;
    totalDocuments: number;
    completedApplications: number;
    upcomingDeadlines: number;
}

interface Activity {
    id: string;
    type: 'document' | 'application' | 'message' | 'approval' | 'essay';
    title: string;
    description: string;
    time: string;
    studentName?: string;
}

interface Deadline {
    id: string;
    universityName: string;
    studentName: string;
    date: string;
    daysLeft: number;
    type: string;
}

// Helper function - outside component for use in useQuery
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

export default function TeacherHomeDashboard() {
    const supabase = createClient();

    // React Query for dashboard data - instant on tab switch!
    const { data: dashboardData, isLoading } = useQuery({
        queryKey: ['teacher', 'dashboard'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            // Fetch student stats
            const { data: students } = await supabase
                .from('profiles')
                .select('id, full_name, approval_status, created_at')
                .eq('teacher_id', user.id)
                .eq('role', 'student');

            const totalStudents = students?.length || 0;
            const pendingApprovals = students?.filter(s => s.approval_status === 'pending').length || 0;
            const approvedStudents = students?.filter(s => s.approval_status === 'approved').length || 0;

            // Fetch documents count
            const studentIds = students?.map(s => s.id) || [];
            let totalDocuments = 0;
            if (studentIds.length > 0) {
                const { count } = await supabase
                    .from('documents')
                    .select('*', { count: 'exact', head: true })
                    .in('student_id', studentIds);
                totalDocuments = count || 0;
            }

            // Fetch upcoming deadlines
            let deadlines: Deadline[] = [];
            if (studentIds.length > 0) {
                const { data: deadlineData } = await supabase
                    .from('student_universities')
                    .select('id, university_name, deadline_date, deadline_type, student_id')
                    .in('student_id', studentIds)
                    .gte('deadline_date', new Date().toISOString().split('T')[0])
                    .order('deadline_date', { ascending: true })
                    .limit(5);

                if (deadlineData) {
                    deadlines = deadlineData.map((d) => {
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
                }
            }

            // Build activity feed
            const activities: Activity[] = [];
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
                    studentName: s.full_name
                });
            });

            // Get recent documents
            if (studentIds.length > 0) {
                const { data: recentDocs } = await supabase
                    .from('documents')
                    .select('id, type, created_at, student_id')
                    .in('student_id', studentIds)
                    .order('created_at', { ascending: false })
                    .limit(5);

                recentDocs?.forEach(doc => {
                    const student = students?.find(s => s.id === doc.student_id);
                    activities.push({
                        id: `doc-${doc.id}`,
                        type: 'document',
                        title: 'Document Uploaded',
                        description: `${student?.full_name || 'A student'} uploaded ${doc.type}`,
                        time: formatTimeAgo(new Date(doc.created_at)),
                        studentName: student?.full_name
                    });
                });
            }

            return {
                stats: {
                    totalStudents,
                    pendingApprovals,
                    approvedStudents,
                    totalDocuments,
                    completedApplications: 0,
                    upcomingDeadlines: deadlines.length
                },
                activities: activities.slice(0, 8),
                deadlines
            };
        },
        staleTime: 5 * 60 * 1000, // 5 minutes - instant on tab switch
    });

    const stats = dashboardData?.stats || {
        totalStudents: 0,
        pendingApprovals: 0,
        approvedStudents: 0,
        totalDocuments: 0,
        completedApplications: 0,
        upcomingDeadlines: 0
    };
    const activities = dashboardData?.activities || [];
    const deadlines = dashboardData?.deadlines || [];

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'document': return <FileText className="w-5 h-5" />;
            case 'application': return <GraduationCap className="w-5 h-5" />;
            case 'message': return <MessageCircle className="w-5 h-5" />;
            case 'approval': return <Users className="w-5 h-5" />;
            case 'essay': return <Sparkles className="w-5 h-5" />;
            default: return <Bell className="w-5 h-5" />;
        }
    };

    const getActivityColor = (type: string) => {
        switch (type) {
            case 'document': return 'bg-blue-100 text-blue-600';
            case 'application': return 'bg-purple-100 text-purple-600';
            case 'message': return 'bg-green-100 text-green-600';
            case 'approval': return 'bg-orange-100 text-orange-600';
            case 'essay': return 'bg-pink-100 text-pink-600';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Welcome Header with Particles */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-orange-600 to-red-600 p-8 text-white shadow-2xl">
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 mix-blend-overlay" />
                    <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-white rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 mix-blend-overlay" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-full px-3 py-1 mb-3 border border-white/20">
                            <span className="w-2 h-2 rounded-full bg-orange-300"></span>
                            <span className="text-xs font-medium text-white">Teacher Console</span>
                        </div>
                        <h1 className="text-4xl font-black mb-2 tracking-tight">Welcome back! 👋</h1>
                        <p className="text-orange-50 text-lg">
                            You have <span className="font-bold underline decoration-orange-300 underline-offset-4">{stats.pendingApprovals > 0 ? `${stats.pendingApprovals} pending approval${stats.pendingApprovals > 1 ? 's' : ''}` : 'no pending tasks'}</span> to review today.
                        </p>
                    </div>

                    {/* Quick Stats Summary */}
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex gap-8">
                        <div className="text-center">
                            <p className="text-3xl font-black">{stats.totalStudents}</p>
                            <p className="text-[10px] uppercase tracking-wider opacity-70">Total Students</p>
                        </div>
                        <div className="w-px bg-white/20" />
                        <div className="text-center">
                            <p className="text-3xl font-black">{stats.upcomingDeadlines}</p>
                            <p className="text-[10px] uppercase tracking-wider opacity-70">Deadlines</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Total Students", value: stats.totalStudents, icon: Users, color: "blue", sub: "Active Roster" },
                    { label: "Pending", value: stats.pendingApprovals, icon: Clock, color: "orange", sub: "Needs Approval" },
                    { label: "Documents", value: stats.totalDocuments, icon: FileText, color: "emerald", sub: "Uploaded" },
                    { label: "Deadlines", value: stats.upcomingDeadlines, icon: Target, color: "purple", sub: "Upcoming" },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        whileHover={{ y: -5 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300"
                    >
                        <div className={`p-3 rounded-xl bg-${stat.color}-50 text-${stat.color}-600 w-fit mb-4`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{stat.label}</p>
                        <p className="font-black text-slate-900 text-3xl">{stat.value}</p>
                        <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>
                    </motion.div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
                {/* Activity Feed */}
                <div className="lg:col-span-2 bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-slate-100 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-slate-600" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Recent Activity</h2>
                        </div>
                        <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-500 rounded-lg">{activities.length} updates</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                        {activities.length === 0 ? (
                            <div className="p-12 text-center">
                                <Bell className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                <p className="text-slate-500 font-medium">No recent activity</p>
                                <p className="text-sm text-slate-400">Activity from your students will appear here</p>
                            </div>
                        ) : (
                            activities.map((activity, idx) => (
                                <motion.div
                                    key={activity.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${getActivityColor(activity.type)}`}>
                                            {getActivityIcon(activity.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-900">{activity.title}</p>
                                            <p className="text-sm text-slate-500 truncate group-hover:text-slate-700">{activity.description}</p>
                                        </div>
                                        <span className="text-xs text-slate-400 whitespace-nowrap bg-slate-100 px-2 py-1 rounded-full">{activity.time}</span>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                {/* Upcoming Deadlines */}
                <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Calendar className="w-5 h-5 text-purple-600" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Deadlines</h2>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
                        {deadlines.length === 0 ? (
                            <div className="p-8 text-center h-full flex flex-col items-center justify-center">
                                <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                <p className="text-slate-500 text-sm">No upcoming deadlines</p>
                            </div>
                        ) : (
                            deadlines.map((deadline, idx) => (
                                <motion.div
                                    key={deadline.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="p-4 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm ${deadline.daysLeft <= 7
                                            ? 'bg-red-100 text-red-600'
                                            : deadline.daysLeft <= 14
                                                ? 'bg-amber-100 text-amber-600'
                                                : 'bg-green-100 text-green-600'
                                            }`}>
                                            {deadline.daysLeft}d
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-900 truncate">{deadline.universityName}</p>
                                            <p className="text-xs text-slate-500">{deadline.studentName}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${deadline.type === 'early_decision' ? 'bg-purple-100 text-purple-600' :
                                            deadline.type === 'early_action' ? 'bg-blue-100 text-blue-600' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                            {deadline.type.replace('_', ' ')}
                                        </span>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <button className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 hover:shadow-xl hover:border-orange-200 transition-all group active:scale-95">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Users className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <p className="font-semibold text-slate-900">View Students</p>
                            <p className="text-xs text-slate-500">Manage roster</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 ml-auto group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                    </div>
                </button>

                <button className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 hover:shadow-xl hover:border-purple-200 transition-all group active:scale-95">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <MessageCircle className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <p className="font-semibold text-slate-900">Messages</p>
                            <p className="text-xs text-slate-500">Chat with students</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 ml-auto group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                    </div>
                </button>

                <button className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 hover:shadow-xl hover:border-blue-200 transition-all group active:scale-95">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <p className="font-semibold text-slate-900">Documents</p>
                            <p className="text-xs text-slate-500">Review uploads</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 ml-auto group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </div>
                </button>

                <button className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 hover:shadow-xl hover:border-green-200 transition-all group active:scale-95">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Award className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <p className="font-semibold text-slate-900">Automation</p>
                            <p className="text-xs text-slate-500">Fill applications</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 ml-auto group-hover:text-green-500 group-hover:translate-x-1 transition-all" />
                    </div>
                </button>
            </div>
        </div>
    );
}
