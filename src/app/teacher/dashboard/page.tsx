"use client";

import { useState } from "react";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import StudentDetailView from "@/components/teacher/StudentDetailView";
import PendingStudentsView from "@/components/teacher/PendingStudentsView";
import StudentListView from "@/components/teacher/StudentListView";
import AutomationView from "@/components/teacher/AutomationView";
import AIMatcherView from "@/components/teacher/AIMatcherView";
import FloatingPendingBadge from "@/components/teacher/FloatingPendingBadge";
import WhatsAppChat from "@/components/chat/WhatsAppChat";
import TeacherHomeDashboard from "@/components/teacher/TeacherHomeDashboard";
import AdminPanel from "@/components/teacher/AdminPanel";
import { TeacherDataProvider, useTeacherData } from "@/contexts/TeacherDataContext";
import { Menu } from "lucide-react";

function DashboardContent() {
    const [activeTab, setActiveTab] = useState("dashboard");
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { selectedStudentId, setSelectedStudentId } = useTeacherData();

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        // Clear selected student when changing tabs
        if (selectedStudentId) setSelectedStudentId(null);
    };

    return (
        <div className="flex min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50">
            {/* Sidebar */}
            <TeacherSidebar
                activeTab={activeTab}
                onTabChange={handleTabChange}
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
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white font-black text-sm">
                        U
                    </div>
                    <span className="font-bold text-slate-900">UNI</span>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 md:ml-64 ml-0 p-4 md:p-6 lg:p-8 pt-20 md:pt-6 lg:pt-8 overflow-hidden h-screen flex flex-col">
                {activeTab === 'pending' ? (
                    <PendingStudentsView />
                ) : activeTab === 'students' ? (
                    selectedStudentId ? (
                        <StudentDetailView
                            studentId={selectedStudentId}
                            onBack={() => setSelectedStudentId(null)}
                        />
                    ) : (
                        <StudentListView onSelectStudent={setSelectedStudentId} />
                    )
                ) : activeTab === 'ai-matcher' ? (
                    <div className="flex-1 min-h-0">
                        <AIMatcherView />
                    </div>
                ) : activeTab === 'messages' ? (
                    <div className="flex-1 min-h-0">
                        <WhatsAppChat userRole="teacher" />
                    </div>
                ) : activeTab === 'automation' ? (
                    <>
                        <div className="flex-none mb-6">
                            <header>
                                <h1 className="text-3xl font-black font-montserrat text-slate-900 mb-1">AUTOMATION HUB</h1>
                                <p className="text-slate-500 font-medium">Copy student data and fill application forms efficiently.</p>
                            </header>
                        </div>
                        <div className="flex-1 min-h-0">
                            <AutomationView />
                        </div>
                    </>
                ) : activeTab === 'admin' ? (
                    <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        <AdminPanel />
                    </div>
                ) : (
                    // Dashboard Tab - Rich Teacher Dashboard
                    <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        <TeacherHomeDashboard />
                    </div>
                )}
            </main>

            {/* Floating Pending Approvals Badge */}
            <FloatingPendingBadge onViewPending={() => setActiveTab('pending')} />
        </div>
    );
}

export default function TeacherDashboard() {
    return (
        <TeacherDataProvider>
            <DashboardContent />
        </TeacherDataProvider>
    );
}
