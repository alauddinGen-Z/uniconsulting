"use client";

import { useState } from "react";
import StudentListView from "@/components/teacher/StudentListView";
import StudentDetailView from "@/components/teacher/StudentDetailView";
import { type Student } from "@/contexts/TeacherDataContext";

interface StudentsPageClientProps {
    initialStudents: Student[];
}

export default function StudentsPageClient({ initialStudents }: StudentsPageClientProps) {
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    if (selectedStudentId) {
        return (
            <StudentDetailView
                studentId={selectedStudentId}
                onBack={() => setSelectedStudentId(null)}
            />
        );
    }

    return <StudentListView onSelectStudent={setSelectedStudentId} initialStudents={initialStudents} />;
}
