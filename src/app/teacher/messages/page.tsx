"use client";

/**
 * Teacher Messages Page
 * 
 * Chat/messaging view for teachers.
 * 
 * @file src/app/teacher/messages/page.tsx
 */

import WhatsAppChat from "@/components/chat/WhatsAppChat";

export default function TeacherMessagesPage() {
    return (
        <div className="flex-1 min-h-0">
            <WhatsAppChat userRole="teacher" />
        </div>
    );
}
