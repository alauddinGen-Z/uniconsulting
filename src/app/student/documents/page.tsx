"use client";

/**
 * Student Documents Page
 * 
 * Document management view for students (essays, transcripts, etc.).
 * 
 * @file src/app/student/documents/page.tsx
 */

import DocumentsTabPage from "@/components/student/DocumentsTabPage";
import { useStudentData } from "@/contexts/StudentDataContext";

export default function StudentDocumentsPage() {
    const { profile } = useStudentData();
    const isLocked = profile?.approval_status === 'pending' || profile?.approval_status === 'rejected';

    return <DocumentsTabPage isLocked={isLocked} />;
}
