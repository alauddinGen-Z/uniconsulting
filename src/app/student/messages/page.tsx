"use client";

/**
 * Student Messages Page
 * 
 * Chat/messaging view for students.
 * 
 * @file src/app/student/messages/page.tsx
 */

import StudentChat from "@/components/chat/StudentChat";

export default function StudentMessagesPage() {
    return (
        <div className="h-[calc(100vh-80px)] md:h-[calc(100vh-80px)] -mx-4 lg:-mx-8 -mb-6 lg:-mb-8 p-4">
            <StudentChat />
        </div>
    );
}
