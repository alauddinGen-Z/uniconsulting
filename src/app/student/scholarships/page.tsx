"use client";

/**
 * Student Scholarships Page
 * 
 * Vector-based scholarship search with AI matching.
 * 
 * @file src/app/student/scholarships/page.tsx
 */

import ScholarshipFinder from "@/components/student/ScholarshipFinder";

export default function StudentScholarshipsPage() {
    return (
        <div className="flex-1 overflow-y-auto p-6">
            <ScholarshipFinder />
        </div>
    );
}
