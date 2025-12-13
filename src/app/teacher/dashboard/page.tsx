import { redirect } from "next/navigation";

/**
 * Teacher Dashboard Redirect
 * 
 * Redirects legacy /teacher/dashboard route to /teacher/home
 * for backwards compatibility with bookmarks and shared links.
 * 
 * @file src/app/teacher/dashboard/page.tsx
 */
export default function TeacherDashboardRedirect() {
    redirect("/teacher/home");
}
