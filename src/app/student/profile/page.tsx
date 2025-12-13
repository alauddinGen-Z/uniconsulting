"use client";

/**
 * Student Profile Page
 * 
 * Profile management view for students.
 * 
 * @file src/app/student/profile/page.tsx
 */

import ProfilePage from "@/components/student/ProfilePage";
import { useStudentData } from "@/contexts/StudentDataContext";

export default function StudentProfilePage() {
    const { profile } = useStudentData();
    const isLocked = profile?.approval_status === 'pending' || profile?.approval_status === 'rejected';

    return <ProfilePage isLocked={isLocked} />;
}
