"use client";

import { useState, useEffect, useCallback } from "react";
import HomeDashboard from "@/components/student/HomeDashboard";
import ProfilePage from "@/components/student/ProfilePage";
import ApplicationPage from "@/components/student/ApplicationPage";
import DocumentsTabPage from "@/components/student/DocumentsTabPage";
import WhatsAppChat from "@/components/chat/WhatsAppChat";
import DashboardSidebar from "@/components/student/DashboardSidebar";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Menu } from "lucide-react";

export default function StudentDashboard() {
    const [activeTab, setActiveTab] = useState("home");
    const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const supabase = createClient();

    const checkApprovalStatus = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('profiles')
                .select('approval_status')
                .eq('id', user.id)
                .single();

            if (data) {
                setApprovalStatus(data.approval_status);
            }
        } catch (error) {
            console.error("Error checking approval:", error);
        } finally {
            setIsLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        checkApprovalStatus();

        let channel: any;
        const setupRealtime = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            channel = supabase
                .channel(`student-status-${user.id}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user.id}`
                }, (payload: any) => {
                    if (payload.new.approval_status !== approvalStatus) {
                        setApprovalStatus(payload.new.approval_status);
                        if (payload.new.approval_status === 'approved') {
                            toast.success('🎉 Your account has been approved!');
                        } else if (payload.new.approval_status === 'rejected') {
                            toast.error('Your account was rejected.');
                        }
                    }
                })
                .subscribe();
        };

        if (approvalStatus === 'pending' || approvalStatus === null) {
            setupRealtime();
        }

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [checkApprovalStatus, approvalStatus, supabase]);

    const isLocked = approvalStatus === 'pending' || approvalStatus === 'rejected';

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-white to-pink-50">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50">
            <DashboardSidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isMobileOpen={isMobileMenuOpen}
                onMobileClose={() => setIsMobileMenuOpen(false)}
            />

            {/* Mobile Header */}
            <div className="fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center px-4 z-30 md:hidden">
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors"
                >
                    <Menu className="w-6 h-6 text-slate-700" />
                </button>
                <div className="flex items-center gap-2 ml-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-black text-sm">
                        U
                    </div>
                    <span className="font-bold text-slate-900">UNI</span>
                </div>
            </div>

            <main className="flex-1 md:ml-64 ml-0 p-4 md:p-6 lg:p-8 pt-20 md:pt-6 lg:pt-8 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <div className="max-w-5xl mx-auto">
                    {/* Tab Content */}
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {activeTab === "home" && <HomeDashboard onNavigate={setActiveTab} />}
                        {activeTab === "profile" && <ProfilePage isLocked={isLocked} />}
                        {activeTab === "application" && <ApplicationPage isLocked={isLocked} />}
                        {activeTab === "documents" && <DocumentsTabPage isLocked={isLocked} />}
                        {activeTab === "messages" && (
                            <div className="h-[calc(100vh-80px)] md:h-[calc(100vh-80px)] -mx-4 lg:-mx-8 -mb-6 lg:-mb-8">
                                <WhatsAppChat userRole="student" />
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
