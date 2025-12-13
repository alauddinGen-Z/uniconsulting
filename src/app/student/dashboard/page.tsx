import { redirect } from "next/navigation";

/**
 * Student Dashboard Redirect
 * 
 * Redirects legacy /student/dashboard route to /student/home
 * for backwards compatibility with bookmarks and shared links.
 * 
 * @file src/app/student/dashboard/page.tsx
 */
export default function StudentDashboardRedirect() {
    redirect("/student/home");
}
