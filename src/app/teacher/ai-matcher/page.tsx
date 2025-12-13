"use client";

/**
 * Teacher AI Matcher Page
 * 
 * AI-powered university matching view.
 * 
 * @file src/app/teacher/ai-matcher/page.tsx
 */

import AIMatcherView from "@/components/teacher/AIMatcherView";

export default function TeacherAIMatcherPage() {
    return (
        <div className="flex-1 min-h-0">
            <AIMatcherView />
        </div>
    );
}
