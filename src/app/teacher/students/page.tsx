import { createClient } from "@/utils/supabase/server";
import { getStudentsForTeacher } from "@/lib/data/queries";
import StudentsPageClient from "@/components/teacher/StudentsPageClient";
import { redirect } from "next/navigation";
import { type Student } from "@/contexts/TeacherDataContext";

export const metadata = {
    title: "Students | IDP Concierge",
    description: "Manage your students",
};

export default async function TeacherStudentsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/auth/login");
    }

    // Fetch data using cached query and map to Student interface
    // Use catch to handle potential errors gracefully
    const rawStudents = await getStudentsForTeacher(user.id).catch(error => {
        console.error("Failed to fetch students:", error);
        return [];
    });

    const students: Student[] = rawStudents.map((s: any) => ({
        id: s.id,
        full_name: s.full_name || 'Unknown',
        email: s.email || '',
        phone: s.phone || undefined,
        approval_status: s.approval_status || 'pending',
        created_at: s.created_at || new Date().toISOString(),
    }));

    return <StudentsPageClient initialStudents={students} />;
}
