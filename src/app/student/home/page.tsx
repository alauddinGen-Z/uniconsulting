"use client";

/**
 * Student Home Page
 * 
 * Main dashboard view for students.
 * 
 * @file src/app/student/home/page.tsx
 */

import HomeDashboard from "@/components/student/HomeDashboard";
import { useRouter } from "next/navigation";

export default function StudentHomePage() {
    const router = useRouter();

    const handleNavigate = (tab: string) => {
        router.push(`/student/${tab}`);
    };

    return <HomeDashboard onNavigate={handleNavigate} />;
}
