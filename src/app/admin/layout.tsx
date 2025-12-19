"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useAppStore } from "@/stores/appStore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Building2, Users, Settings, LogOut, ShieldCheck } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user: authUser, isLoading } = useAuth();
    const appUser = useAppStore((state) => state.user);
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        if (!isLoading && appUser) {
            // Check if user has admin privileges (owner role)
            if (appUser.role === 'owner') {
                setAuthorized(true);
            } else {
                // Redirect non-admins
                router.push('/teacher/home');
            }
        }
    }, [appUser, isLoading, router]);

    if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    if (!authorized) return <div className="min-h-screen flex items-center justify-center">Checking permissions...</div>;

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Admin Sidebar */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col">
                <div className="p-6 flex items-center gap-3 border-b border-slate-800">
                    <ShieldCheck className="w-8 h-8 text-orange-500" />
                    <span className="font-bold tracking-tight text-xl">PRO<span className="text-orange-500">ADMIN</span></span>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <Link href="/admin" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-300 hover:text-white">
                        <LayoutDashboard className="w-5 h-5" />
                        Dashboard
                    </Link>
                    <Link href="/admin/agencies" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-300 hover:text-white">
                        <Building2 className="w-5 h-5" />
                        Agencies
                    </Link>
                    <Link href="/admin/users" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-300 hover:text-white">
                        <Users className="w-5 h-5" />
                        System Users
                    </Link>
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors">
                        <LogOut className="w-5 h-5" />
                        Platform Exit
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
