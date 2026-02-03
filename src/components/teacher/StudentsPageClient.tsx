"use client";

import StudentListView from "@/components/teacher/StudentListView";
import { type Student } from "@/contexts/TeacherDataContext";

interface StudentsPageClientProps {
    initialStudents: Student[];
}

export default function StudentsPageClient({ initialStudents }: StudentsPageClientProps) {
    return <StudentListView initialStudents={initialStudents} />;
}
