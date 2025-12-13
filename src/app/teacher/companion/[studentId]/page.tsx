"use client";

import CompanionWindowDynamic from "@/components/teacher/automation/CompanionWindowDynamic";
import { useParams } from "next/navigation";

// For static export, we handle dynamic routes client-side
// The studentId will be read from URL params at runtime

export default function CompanionDynamicPage() {
    const params = useParams();
    const studentId = params?.studentId as string;

    if (!studentId) {
        return <div className="p-8 text-center text-slate-500">Loading...</div>;
    }

    return <CompanionWindowDynamic studentId={studentId} />;
}
