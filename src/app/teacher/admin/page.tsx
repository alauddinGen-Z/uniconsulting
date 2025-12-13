"use client";

/**
 * Teacher Admin Page
 * 
 * Admin panel for managing teachers.
 * 
 * @file src/app/teacher/admin/page.tsx
 */

import AdminPanel from "@/components/teacher/AdminPanel";

export default function TeacherAdminPage() {
    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <AdminPanel />
        </div>
    );
}
