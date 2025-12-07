"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import CompanionWindowDynamic from "@/components/teacher/automation/CompanionWindowDynamic";
import { Loader2 } from "lucide-react";

function CompanionContent() {
    const searchParams = useSearchParams();
    const studentId = searchParams.get('studentId');

    if (!studentId) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-slate-500 font-medium">No student selected</p>
                    <p className="text-sm text-slate-400 mt-1">Please select a student from the dashboard</p>
                </div>
            </div>
        );
    }

    return <CompanionWindowDynamic studentId={studentId} />;
}

export default function CompanionPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        }>
            <CompanionContent />
        </Suspense>
    );
}
