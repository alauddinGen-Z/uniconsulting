"use client";

import { useState, useEffect } from "react";
import { User, LogOut, Settings, FolderOpen, Home, GraduationCap, MessageCircle, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ProfileModal from "@/components/shared/ProfileModal";
import SettingsModal from "@/components/shared/SettingsModal";
import { useUnreadMessageCount } from "@/hooks/useUnreadMessageCount";

interface DashboardSidebarProps {
    activeTab: string;
    onTabChange: (tabId: string) => void;
}

export default function DashboardSidebar({ activeTab, onTabChange }: DashboardSidebarProps) {
    const [profile, setProfile] = useState<{ full_name: string; email: string; teacher_name?: string } | null>(null);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const router = useRouter();
    const supabase = createClient();
    const { unreadCount } = useUnreadMessageCount();

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('full_name, teacher_id')
                    .eq('id', user.id)
                    .single();

                let teacherName = undefined;
                if (data?.teacher_id) {
                    const { data: teacher } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', data.teacher_id)
                        .single();
                    teacherName = teacher?.full_name;
                }

                setProfile({
                    full_name: data?.full_name || "Student",
                    email: user.email || "",
                    teacher_name: teacherName
                });
            }
        };
        fetchUser();
    }, [supabase]);

    const handleSignOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            toast.error("Error signing out");
        } else {
            toast.success("Signed out successfully");
            router.push("/login");
        }
    };

    const navItems = [
        { id: "home", label: "Home", icon: Home },
        { id: "profile", label: "Profile", icon: User },
        { id: "application", label: "Application", icon: GraduationCap, hasAI: true },
        { id: "documents", label: "Documents", icon: FolderOpen },
        { id: "messages", label: "Chat", icon: MessageCircle },
    ];

    return (
        <>
            {/* Premium Dark Theme Sidebar */}
            <div className="w-64 bg-slate-900 h-screen flex flex-col text-white shadow-2xl z-50 fixed left-0 top-0 border-r border-slate-800">
                {/* Logo Area */}
                <div className="p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10 flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-orange-500/20">
                            U
                        </div>
                        <span className="font-black font-montserrat text-2xl tracking-tight text-white">UNI</span>
                    </div>
                    <p className="text-slate-400 text-xs font-medium ml-1 relative z-10">Student Portal</p>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-4 space-y-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-4 mb-2">Menu</div>
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${activeTab === item.id
                                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25 font-bold"
                                : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                }`}
                        >
                            <div className="relative">
                                <item.icon className={`w-5 h-5 ${activeTab === item.id ? "text-white" : "text-slate-400 group-hover:text-white transition-colors"}`} />
                                {/* Unread Message Badge */}
                                {item.id === 'messages' && unreadCount > 0 && (
                                    <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-lg">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </div>
                            <span className="relative z-10">{item.label}</span>

                            {/* AI Badge for Application Tab */}
                            {'hasAI' in item && item.hasAI && (
                                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${activeTab === item.id ? 'bg-white/20 text-white' : 'bg-purple-500/20 text-purple-400'
                                    }`}>
                                    <Sparkles className="w-2 h-2" /> AI
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* Profile Section */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                    <button
                        onClick={() => setShowSettingsModal(true)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 transition-all text-left mb-2 group"
                    >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-slate-300 font-bold border border-slate-700 group-hover:border-orange-500/50 transition-colors">
                            {profile?.full_name?.charAt(0) || "S"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-white truncate">{profile?.full_name}</p>
                            <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
                        </div>
                        <Settings className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                    </button>

                    <button
                        onClick={() => setShowLogoutConfirm(true)}
                        className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs font-medium"
                    >
                        <LogOut className="w-3 h-3" /> Sign Out
                    </button>
                </div>
            </div>

            {/* Modals */}
            <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
            <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

            {/* Logout Confirmation */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
                    <div className="relative bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 fade-in">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Sign Out?</h3>
                        <p className="text-slate-500 text-sm mb-6">Are you sure you want to sign out of your account?</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="flex-1 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSignOut}
                                className="flex-1 py-2 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
