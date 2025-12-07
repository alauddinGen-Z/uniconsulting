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

export default function StudentDashboard() {
    const [activeTab, setActiveTab] = useState("home");
    const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
    const [isLoading, setIsLoading] = useState(true);
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
            <DashboardSidebar activeTab={activeTab} onTabChange={setActiveTab} />

            <main className="flex-1 ml-64 p-6 lg:p-8 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <div className="max-w-5xl mx-auto">
                    {/* Tab Content */}
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {activeTab === "home" && <HomeDashboard onNavigate={setActiveTab} />}
                        {activeTab === "profile" && <ProfilePage isLocked={isLocked} />}
                        {activeTab === "application" && <ApplicationPage isLocked={isLocked} />}
                        {activeTab === "documents" && <DocumentsTabPage isLocked={isLocked} />}
                        {activeTab === "messages" && (
                            <div className="h-[calc(100vh-80px)] -mx-4 lg:-mx-8 -mb-6 lg:-mb-8">
                                <WhatsAppChat userRole="student" />
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
