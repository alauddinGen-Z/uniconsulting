"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import StudentListView from "@/components/teacher/StudentListView";
import StudentDetailView from "@/components/teacher/StudentDetailView";
import { type Student } from "@/contexts/TeacherDataContext";

interface StudentsPageClientProps {
    initialStudents: Student[];
}

export default function StudentsPageClient({ initialStudents }: StudentsPageClientProps) {
    const searchParams = useSearchParams();
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    // Auto-select student from URL query param (for Companion deep-linking)
    useEffect(() => {
        const studentIdFromUrl = searchParams.get('studentId');
        if (studentIdFromUrl && !selectedStudentId) {
            setSelectedStudentId(studentIdFromUrl);
        }
    }, [searchParams, selectedStudentId]);

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
