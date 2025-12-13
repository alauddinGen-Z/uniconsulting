"use client";

/**
 * Student Application Page
 * 
 * University applications management view.
 * 
 * @file src/app/student/application/page.tsx
 */

import ApplicationPage from "@/components/student/ApplicationPage";
import { useStudentData } from "@/contexts/StudentDataContext";

export default function StudentApplicationPage() {
    const { profile } = useStudentData();
    const isLocked = profile?.approval_status === 'pending' || profile?.approval_status === 'rejected';

    return <ApplicationPage isLocked={isLocked} />;
}
