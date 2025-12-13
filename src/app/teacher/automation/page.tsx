"use client";

/**
 * Teacher Automation Page
 * 
 * Automation hub for copying student data and filling forms.
 * 
 * @file src/app/teacher/automation/page.tsx
 */

import AutomationView from "@/components/teacher/AutomationView";

export default function TeacherAutomationPage() {
    return (
        <>
            <div className="flex-none mb-6">
                <header>
                    <h1 className="text-3xl font-black font-montserrat text-slate-900 mb-1">AUTOMATION HUB</h1>
                    <p className="text-slate-500 font-medium">Copy student data and fill application forms efficiently.</p>
                </header>
            </div>
            <div className="flex-1 min-h-0">
                <AutomationView />
            </div>
        </>
    );
}
