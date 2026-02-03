"use client";

/**
 * Teacher Messages Page
 * 
 * Chat/messaging view for teachers.
 * 
 * @file src/app/teacher/messages/page.tsx
 */

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamic import for Chat component
const WhatsAppChat = dynamic(() => import("@/components/chat/WhatsAppChat"), {
    loading: () => (
        <div className="flex-1 h-full flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/50">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
    ),
    ssr: false // Chat relies on window/browser APIs
});

export default function TeacherMessagesPage() {
    return (
        <div className="flex-1 min-h-0">
            <WhatsAppChat userRole="teacher" />
        </div>
    );
}
