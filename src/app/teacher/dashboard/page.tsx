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
import { TeacherDataProvider, useTeacherData } from "@/contexts/TeacherDataContext";

function DashboardContent() {
    const [activeTab, setActiveTab] = useState("dashboard");
    const { selectedStudentId, setSelectedStudentId } = useTeacherData();

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        // Clear selected student when changing tabs
        if (selectedStudentId) setSelectedStudentId(null);
    };

    return (
        <div className="flex min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50">
            {/* Sidebar */}
            <TeacherSidebar activeTab={activeTab} onTabChange={handleTabChange} />

            {/* Main Content Area */}
            <main className="flex-1 ml-64 p-6 lg:p-8 overflow-hidden h-screen flex flex-col">
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
