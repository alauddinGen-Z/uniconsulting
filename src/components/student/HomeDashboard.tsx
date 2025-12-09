"use client";

import { useState, useEffect, useRef } from "react";
import { User, FileText, PenTool, CheckCircle, Clock, XCircle, ArrowRight, GraduationCap, Loader2, FolderOpen, TrendingUp, Calendar, MessageCircle, X, Target } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";

interface HomeDashboardProps {
    onNavigate: (tab: string) => void;
}

export default function HomeDashboard({ onNavigate }: HomeDashboardProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [stats, setStats] = useState({
        documents: 0,
        essays: 0,
        profileComplete: 0
    });
    const [dismissedApprovalBanner, setDismissedApprovalBanner] = useState(false);
    const hasFetched = useRef(false);
    const supabase = createClient();

    // Check if approval banner was dismissed
    useEffect(() => {
        const dismissed = localStorage.getItem('dismissedApprovalBanner');
        if (dismissed === 'true') {
            setDismissedApprovalBanner(true);
        }
    }, []);

    const dismissApprovalBanner = () => {
        setDismissedApprovalBanner(true);
        localStorage.setItem('dismissedApprovalBanner', 'true');
    };

    // Only fetch once on first mount - not on every tab switch
    useEffect(() => {
        if (!hasFetched.current) {
            hasFetched.current = true;
            fetchData();
        }
    }, []);

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*, teacher:teacher_id(full_name)')
                .eq('id', user.id)
                .single();

            setProfile(profileData);

            // Get document count
            const { count: docCount } = await supabase
                .from('documents')
                .select('*', { count: 'exact', head: true })
                .eq('student_id', user.id);

            // Get essay count
            const { count: essayCount } = await supabase
                .from('essays')
                .select('*', { count: 'exact', head: true })
                .eq('student_id', user.id);

            // Calculate profile completion
            const fields = ['full_name', 'email', 'phone', 'passport_number', 'home_address', 'preferred_country', 'preferred_university'];
            const filledFields = fields.filter(f => profileData?.[f]);
            const completion = Math.round((filledFields.length / fields.length) * 100);

            setStats({
                documents: docCount || 0,
                essays: essayCount || 0,
                profileComplete: completion
            });
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const greetingTime = new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening';

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Welcome Header with Particles */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 p-8 text-white shadow-2xl">
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 mix-blend-overlay" />
                    <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-white rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 mix-blend-overlay" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-center md:text-left">
                        <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-full px-3 py-1 mb-3 border border-white/20">
                            <span className="animate-pulse w-2 h-2 rounded-full bg-green-400"></span>
                            <span className="text-xs font-medium text-white">System Online</span>
                        </div>
                        <h1 className="text-4xl font-black mb-2 tracking-tight">Good {greetingTime}, {profile?.full_name?.split(' ')[0] || 'Student'}! 👋</h1>
                        <p className="text-orange-50 text-lg max-w-xl leading-relaxed">Your application journey is moving forward. Check your tasks below.</p>
                    </div>

                    {/* XP Card - Glassmorphic */}
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 min-w-[160px] text-center shadow-xl">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="p-2 bg-yellow-400/20 rounded-lg">
                                <span className="text-2xl">⚡</span>
                            </div>
                            <div>
                                <span className="text-3xl font-black block leading-none">{profile?.xp_points || 0}</span>
                                <span className="text-[10px] uppercase tracking-wider opacity-70">XP Points</span>
                            </div>
                        </div>
                        <div className="relative h-2 bg-black/20 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, ((profile?.xp_points || 0) % 100))}%` }}
                                className="absolute top-0 left-0 h-full bg-yellow-400 rounded-full"
                            />
                        </div>
                        <p className="text-xs mt-2 font-medium">Level {profile?.level || 1} Scholar</p>
                    </div>
                </div>
            </div>

            {/* Status Ticket */}
            {!(profile?.approval_status === 'approved' && dismissedApprovalBanner) && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`relative overflow-hidden rounded-2xl border flex items-center p-1 ${profile?.approval_status === 'approved' ? 'bg-emerald-50 border-emerald-100' :
                        profile?.approval_status === 'rejected' ? 'bg-red-50 border-red-100' :
                            'bg-amber-50 border-amber-100'
                        }`}
                >
                    <div className={`p-4 rounded-xl mr-4 flex items-center justify-center ${profile?.approval_status === 'approved' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' :
                        profile?.approval_status === 'rejected' ? 'bg-red-500 text-white shadow-lg shadow-red-200' :
                            'bg-amber-500 text-white shadow-lg shadow-amber-200'
                        }`}>
                        {profile?.approval_status === 'approved' ? <CheckCircle className="w-8 h-8" /> :
                            profile?.approval_status === 'rejected' ? <XCircle className="w-8 h-8" /> :
                                <Clock className="w-8 h-8 animate-pulse" />}
                    </div>

                    <div className="flex-1 py-3 pr-4">
                        <h3 className={`text-lg font-bold mb-1 ${profile?.approval_status === 'approved' ? 'text-emerald-900' :
                            profile?.approval_status === 'rejected' ? 'text-red-900' :
                                'text-amber-900'
                            }`}>
                            Account Status: {profile?.approval_status === 'approved' ? 'Verified & Active' :
                                profile?.approval_status === 'rejected' ? 'Action Required' : 'Under Review'}
                        </h3>
                        <p className={`text-sm ${profile?.approval_status === 'approved' ? 'text-emerald-700' :
                            profile?.approval_status === 'rejected' ? 'text-red-700' :
                                'text-amber-700'
                            }`}>
                            {profile?.approval_status === 'approved'
                                ? 'Your account is fully approved. You can now access all features.'
                                : 'Your profile is currently waiting for teacher approval.'}
                        </p>
                    </div>

                    {profile?.approval_status === 'approved' && (
                        <button
                            onClick={dismissApprovalBanner}
                            className="mr-4 p-2 hover:bg-emerald-100 rounded-full transition-colors text-emerald-600"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </motion.div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Teacher", value: profile?.teacher?.full_name || 'Not Assigned', icon: User, color: "blue", sub: "Your Consultant" },
                    { label: "Documents", value: stats.documents, icon: FolderOpen, color: "purple", sub: "Uploaded Files" },
                    { label: "Essays", value: stats.essays, icon: PenTool, color: "orange", sub: "Drafts & Finals" },
                    { label: "Profile", value: `${stats.profileComplete}%`, icon: TrendingUp, color: "emerald", sub: "Completion Rate" },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        whileHover={{ y: -5 }}
                        className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300"
                    >
                        <div className={`p-3 rounded-xl bg-${stat.color}-50 text-${stat.color}-600 w-fit mb-4`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{stat.label}</p>
                        <p className="font-black text-slate-900 text-xl truncate">{stat.value}</p>
                        <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>
                    </motion.div>
                ))}
            </div>

            {/* Main Action Area */}
            <div className="grid lg:grid-cols-3 gap-8">
                {/* Large Quick Actions */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-xl text-slate-900">Your Shortcuts</h3>
                        <span className="text-sm font-medium text-slate-400">Most used actions</span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <button onClick={() => onNavigate('documents')} className="group flex flex-col p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-purple-200 transition-all text-left relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform">
                                <FolderOpen className="w-24 h-24 text-purple-500" />
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <FolderOpen className="w-6 h-6" />
                            </div>
                            <h4 className="font-bold text-lg text-slate-900 mb-1">Upload Documents</h4>
                            <p className="text-sm text-slate-500 mb-4 z-10 w-2/3">Add passports, certificates, and transcripts.</p>
                            <div className="mt-auto flex items-center text-sm font-bold text-purple-600 gap-2">
                                Upload Now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </button>

                        <button onClick={() => onNavigate('essays')} className="group flex flex-col p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all text-left relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform">
                                <PenTool className="w-24 h-24 text-orange-500" />
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <PenTool className="w-6 h-6" />
                            </div>
                            <h4 className="font-bold text-lg text-slate-900 mb-1">Essay Workshop</h4>
                            <p className="text-sm text-slate-500 mb-4 z-10 w-2/3">Write and get AI feedback on your essays.</p>
                            <div className="mt-auto flex items-center text-sm font-bold text-orange-600 gap-2">
                                Start Writing <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </button>

                        <button onClick={() => onNavigate('academic')} className="group flex flex-col p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all text-left relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform">
                                <GraduationCap className="w-24 h-24 text-emerald-500" />
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <GraduationCap className="w-6 h-6" />
                            </div>
                            <h4 className="font-bold text-lg text-slate-900 mb-1">Academic Scores</h4>
                            <p className="text-sm text-slate-500 mb-4 z-10 w-2/3">Update your GPA and test scores.</p>
                            <div className="mt-auto flex items-center text-sm font-bold text-emerald-600 gap-2">
                                View Scores <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </button>

                        <button onClick={() => onNavigate('messages')} className="group flex flex-col p-6 bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl shadow-lg hover:shadow-2xl transition-all text-left relative overflow-hidden text-white">
                            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-150 transition-transform">
                                <MessageCircle className="w-24 h-24 text-white" />
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <MessageCircle className="w-6 h-6" />
                            </div>
                            <h4 className="font-bold text-lg mb-1">Contact Teacher</h4>
                            <p className="text-sm text-white/60 mb-4 z-10 w-2/3">Need help? Message your consultant directly.</p>
                            <div className="mt-auto flex items-center text-sm font-bold text-white gap-2">
                                Open Chat <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </button>
                    </div>
                </div>

                {/* University Target Card - Vertical */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-xl text-slate-900">Your Goal</h3>
                    </div>
                    {profile?.preferred_university ? (
                        <div className="h-full max-h-[400px] bg-gradient-to-b from-blue-600 to-blue-800 rounded-3xl p-8 text-white relative overflow-hidden flex flex-col justify-between shadow-xl">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />

                            <div>
                                <div className="p-4 bg-white/10 rounded-2xl w-fit mb-6 backdrop-blur-md">
                                    <GraduationCap className="w-10 h-10" />
                                </div>
                                <p className="text-blue-200 text-sm font-bold uppercase tracking-widest mb-2">Target University</p>
                                <h3 className="text-3xl font-black leading-tight mb-4">{profile.preferred_university}</h3>
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                                    <span className="text-lg">📍</span> {profile.preferred_country || 'Global'}
                                </div>
                            </div>

                            <button className="mt-8 w-full py-4 bg-white text-blue-900 rounded-2xl font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                                View Details <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-3xl p-8 text-center border-2 border-dashed border-slate-200 hover:border-orange-300 hover:bg-orange-50 transition-all cursor-pointer group" onClick={() => onNavigate('profile')}>
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                <Target className="w-8 h-8 text-slate-300 group-hover:text-orange-500" />
                            </div>
                            <h4 className="font-bold text-slate-900 text-lg mb-2">Set Your Goal</h4>
                            <p className="text-slate-500 text-sm mb-6">Select your dream university to start tracking your progress.</p>
                            <span className="text-orange-500 font-bold text-sm">Set Target &rarr;</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
