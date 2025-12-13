"use client";

/**
 * Teacher Home Page
 * 
 * Main dashboard view for teachers.
 * 
 * @file src/app/teacher/home/page.tsx
 */

import TeacherHomeDashboard from "@/components/teacher/TeacherHomeDashboard";

export default function TeacherHomePage() {
    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <TeacherHomeDashboard />
        </div>
    );
}
