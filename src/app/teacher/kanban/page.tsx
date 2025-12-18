"use client";

/**
 * Teacher Kanban Page
 * 
 * Drag-and-drop Kanban board for managing student application statuses.
 * 
 * @file src/app/teacher/kanban/page.tsx
 */

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import KanbanBoard, { type KanbanStudent, type ApplicationStatus } from "@/components/teacher/KanbanBoard";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function TeacherKanbanPage() {
    const [students, setStudents] = useState<KanbanStudent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();

    const fetchStudents = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setError("Authentication required");
                return;
            }

            // Check if admin
            const { data: profile } = await supabase
                .from("profiles")
                .select("is_admin")
                .eq("id", user.id)
                .single();

            // Build query
            let query = supabase
                .from("profiles")
                .select("id, full_name, email, approval_status, created_at")
                .eq("role", "student");

            // Non-admins only see their assigned students
            if (!profile?.is_admin) {
                query = query.eq("teacher_id", user.id);
            }

            const { data, error: fetchError } = await query.order("created_at", { ascending: false });

            if (fetchError) {
                setError(fetchError.message);
                return;
            }

            // Transform to Kanban format
            const kanbanStudents: KanbanStudent[] = (data || []).map((s) => ({
                id: s.id,
                full_name: s.full_name,
                email: s.email,
                application_status: (s.approval_status || "researching") as ApplicationStatus,
            }));

            setStudents(kanbanStudents);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load students");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, []);

    const handleRefresh = () => {
        fetchStudents();
        toast.success("Refreshed");
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <p className="text-red-500">{error}</p>
                <button
                    onClick={handleRefresh}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                        Application Pipeline
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Drag and drop students between stages
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 
                             text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 
                             dark:hover:bg-gray-700 transition-all"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Kanban Board */}
            <div className="overflow-x-auto">
                <KanbanBoard
                    initialStudents={students}
                    onRefresh={fetchStudents}
                />
            </div>
        </div>
    );
}
