"use client";

/**
 * Teacher AI Matcher Page
 * 
 * AI-powered university matching view.
 * 
 * @file src/app/teacher/ai-matcher/page.tsx
 */

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamic import for heavy AI Matcher component
const AIMatcherView = dynamic(() => import("@/components/teacher/AIMatcherView"), {
    loading: () => (
        <div className="flex-1 h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-primary">
                <Loader2 className="w-10 h-10 animate-spin" />
                <p className="font-medium">Loading AI Engine...</p>
            </div>
        </div>
    ),
});

export default function TeacherAIMatcherPage() {
    return (
        <div className="flex-1 min-h-0">
            <AIMatcherView />
        </div>
    );
}
