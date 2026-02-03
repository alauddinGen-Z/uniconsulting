import { createClient } from "@/utils/supabase/server";
import { getTeacherDashboardData } from "@/lib/data/queries";
import TeacherHomeDashboard, { type DashboardData } from "@/components/teacher/TeacherHomeDashboard";
import { redirect } from "next/navigation";

export const metadata = {
    title: "Dashboard | IDP Concierge",
    description: "Your daily overview",
};

export default async function TeacherHomePage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/auth/login");

    let dashboardData: DashboardData | null = null;
    try {
        const data = await getTeacherDashboardData(user.id);
        dashboardData = data as unknown as DashboardData;
    } catch (error) {
        console.error("Dashboard fetch error:", error);
    }

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <TeacherHomeDashboard initialData={dashboardData} />
        </div>
    );
}
