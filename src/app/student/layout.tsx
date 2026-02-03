"use client";

/**
 * Student Shell Layout
 * 
 * Persistent layout that stays mounted across all student routes.
 * The sidebar, header, and user info remain in the DOM while
 * only the main content area transitions.
 * 
 * @file src/app/student/layout.tsx
 */

import { useState, useEffect, useCallback } from "react";
import DashboardSidebar from "@/components/student/DashboardSidebar";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { StudentDataProvider } from "@/contexts/StudentDataContext";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { usePrefetch } from "@/hooks/usePrefetch";

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const { prefetchStudentProfile, prefetchStudentDocuments, prefetchStudentEssays } = usePrefetch();

    // Extract active tab from pathname
    const activeTab = pathname.split("/").pop() || "home";

    // Prefetch all routes and data on layout mount
    useEffect(() => {
        // Prefetch route JS bundles
        router.prefetch('/student/home');
        router.prefetch('/student/documents');
        router.prefetch('/student/profile');
        router.prefetch('/student/messages');
        router.prefetch('/student/application');

        // Prefetch critical data
        prefetchStudentProfile();
        prefetchStudentDocuments();
        prefetchStudentEssays();
    }, [router, prefetchStudentProfile, prefetchStudentDocuments, prefetchStudentEssays]);

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

        let channel: ReturnType<typeof supabase.channel> | null = null;
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
                }, (payload: { new: { approval_status: string } }) => {
                    const newStatus = payload.new.approval_status as 'pending' | 'approved' | 'rejected';
                    if (newStatus !== approvalStatus) {
                        setApprovalStatus(newStatus);
                        if (newStatus === 'approved') {
                            toast.success('🎉 Your account has been approved!');
                        } else if (newStatus === 'rejected') {
                            toast.error('Your account was rejected.');
                        } else if (newStatus === 'pending') {
                            toast.info('Your account is now pending approval.');
                        }
                    }
                })
                .subscribe();
        };

        setupRealtime();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [checkApprovalStatus, approvalStatus, supabase]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-white to-pink-50">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <StudentDataProvider>
            <div className="flex min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50">
                {/* Persistent Sidebar - Never unmounts */}
                <DashboardSidebar
                    activeTab={activeTab}
                    onTabChange={() => { }} // No-op, navigation handled by Link
                    isMobileOpen={isMobileMenuOpen}
                    onMobileClose={() => setIsMobileMenuOpen(false)}
                />

                {/* Mobile Header - Persistent */}
                <div className="fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center px-4 z-30 md:hidden">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                        <Menu className="w-6 h-6 text-slate-700" />
                    </button>
                    <div className="flex items-center gap-2 ml-3">
                        <Image src="/logo.png" alt="UNI" width={32} height={32} className="rounded-lg" />
                        <span className="font-bold text-slate-900">UNI</span>
                    </div>
                </div>

                {/* Main Content Area - Instant render, no animation */}
                <main className="flex-1 md:ml-64 ml-0 p-4 md:p-6 lg:p-8 pt-20 md:pt-6 lg:pt-8 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <div className="max-w-5xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </StudentDataProvider>
    );
}
