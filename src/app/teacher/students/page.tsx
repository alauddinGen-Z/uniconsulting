"use client";

/**
 * Teacher Students Page
 * 
 * Student list and detail management view.
 * 
 * @file src/app/teacher/students/page.tsx
 */

import { useState } from "react";
import StudentListView from "@/components/teacher/StudentListView";
import StudentDetailView from "@/components/teacher/StudentDetailView";

export default function TeacherStudentsPage() {
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    if (selectedStudentId) {
        return (
            <StudentDetailView
                studentId={selectedStudentId}
                onBack={() => setSelectedStudentId(null)}
            />
        );
    }

    return <StudentListView onSelectStudent={setSelectedStudentId} />;
}
