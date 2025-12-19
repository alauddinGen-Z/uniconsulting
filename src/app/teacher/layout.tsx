"use client";

/**
 * Teacher Shell Layout
 * 
 * Persistent layout that stays mounted across all teacher routes.
 * The command center sidebar and floating badge remain in the DOM
 * while only the main content area transitions.
 * 
 * @file src/app/teacher/layout.tsx
 */

import { useState, useEffect } from "react";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import FloatingPendingBadge from "@/components/teacher/FloatingPendingBadge";
import { TeacherDataProvider } from "@/contexts/TeacherDataContext";
import { Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { usePrefetch } from "@/hooks/usePrefetch";

export default function TeacherLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const { prefetchTeacherStudents, prefetchPendingStudents } = usePrefetch();

    // Extract active tab from pathname
    const activeTab = pathname.split("/").pop() || "home";

    // Aggressive prefetching on layout mount
    useEffect(() => {
        // Prefetch critical data when the teacher layout mounts
        prefetchTeacherStudents();
        prefetchPendingStudents();
    }, [prefetchTeacherStudents, prefetchPendingStudents]);

    return (
        <TeacherDataProvider>
            <div className="flex min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50">
                {/* Persistent Sidebar - Never unmounts */}
                <TeacherSidebar
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
                        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white font-black text-sm">
                            U
                        </div>
                        <span className="font-bold text-slate-900">UNI</span>
                    </div>
                </div>

                {/* Main Content Area - Instant render, no animation */}
                <main className="flex-1 md:ml-64 ml-0 p-4 md:p-6 lg:p-8 pt-20 md:pt-6 lg:pt-8 overflow-hidden h-screen flex flex-col">
                    <div className="flex-1 flex flex-col min-h-0">
                        {children}
                    </div>
                </main>

                {/* Floating Pending Approvals Badge - Persistent */}
                <FloatingPendingBadge onViewPending={() => router.push('/teacher/pending')} />
            </div>
        </TeacherDataProvider>
    );
}
