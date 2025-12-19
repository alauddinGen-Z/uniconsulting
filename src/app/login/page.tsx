"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowRight, GraduationCap, ArrowLeft } from "lucide-react";
import Link from "next/link";
import ParticlesBackground from "@/components/shared/ParticlesBackground";


interface Teacher {
    id: string;
    full_name: string;
}

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    // Only student self-registration is allowed - teachers are added by admin
    const [selectedTeacher, setSelectedTeacher] = useState<string>("");
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState("");
    const router = useRouter();
    const supabase = createClient();

    const handleForgotPassword = async () => {
        if (!resetEmail) {
            toast.error("Please enter your email");
            return;
        }
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: `${window.location.origin}/login`,
            });
            if (error) throw error;
            toast.success("Password reset email sent! Check your inbox.");
            setShowForgotPassword(false);
            setResetEmail("");
        } catch (error: any) {
            toast.error(error.message || "Failed to send reset email");
        } finally {
            setIsLoading(false);
        }
    };


    useEffect(() => {
        // Fetch teachers for the dropdown
        const fetchTeachers = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('role', 'teacher');
            if (data) setTeachers(data);
        };
        fetchTeachers();
    }, []);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (isSignUp) {
                if (!selectedTeacher) {
                    throw new Error("Please select a teacher to request access.");
                }
                if (!fullName.trim()) {
                    throw new Error("Please enter your full name.");
                }

                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            role: 'student',
                            teacher_id: selectedTeacher,
                            approval_status: 'pending'
                        },
                    },
                });
                if (error) throw error;

                // Check if the user was auto-confirmed (email confirmation disabled)
                if (data.session) {
                    // User is logged in, fetch profile and redirect
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', data.user!.id)
                        .single();

                    const userRole = profile?.role || 'student';
                    toast.success(`Welcome, ${userRole}!`);

                    // Reset loading state before navigation
                    setIsLoading(false);

                    // Use replace to prevent back-button returning to login
                    if (userRole === 'teacher') {
                        router.replace("/teacher/home");
                    } else {
                        router.replace("/student/home");
                    }
                    return; // Exit early since we're navigating
                } else {
                    // Email confirmation required
                    toast.success("Account created! Please check your email to verify.");
                    setIsSignUp(false);
                }
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;


                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role, approval_status')
                    .eq('id', data.user.id)
                    .maybeSingle(); // Use maybeSingle to avoid 406 errors

                if (profileError) {
                    console.error("Profile fetch error:", profileError);
                    toast.error("Error fetching profile. Please try again.");
                    await supabase.auth.signOut();
                    throw profileError;
                }

                if (!profile) {
                    // Profile doesn't exist yet - this shouldn't happen, but handle gracefully
                    console.error("Profile not found for user:", data.user.id);
                    toast.error("Profile not found. Please contact support.");
                    await supabase.auth.signOut();
                    throw new Error("Profile not found");
                }

                console.log("Fetched Profile:", profile);
                const userRole = profile.role;
                console.log("User Role from DB:", userRole);
                const status = profile.approval_status || 'pending';

                if (!userRole) {
                    toast.error("Account role not set. Please contact support.");
                    await supabase.auth.signOut();
                    throw new Error("Role not set");
                }

                if (userRole === 'student' && status !== 'approved') {
                    toast.warning("Your account is pending approval from your teacher.");
                }

                toast.success(`Welcome back, ${userRole}!`);



                // Reset loading state before navigation
                setIsLoading(false);

                // Use replace to prevent back-button returning to login
                if (userRole === 'teacher') {
                    router.replace("/teacher/home");
                } else {
                    router.replace("/student/home");
                }
                return; // Exit early since we're navigating
            }
        } catch (error: any) {
            toast.error(error.message || "Authentication failed");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-4 bg-white relative overflow-hidden">
            {/* Particles Background */}
            <ParticlesBackground particleCount={50} />
            <Link
                href="/"
                className="absolute top-8 left-8 flex items-center gap-2 text-slate-500 hover:text-orange-600 transition-colors font-bold"
            >
                <ArrowLeft className="w-5 h-5" />
                Back to Home
            </Link>

            <div className="glass-panel w-full max-w-md p-8 space-y-8 bg-white shadow-2xl rounded-3xl border border-white/50">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-black font-montserrat text-slate-900">
                        {isSignUp ? "JOIN UNI HUB" : "WELCOME BACK"}
                    </h1>
                    <p className="text-slate-500 font-medium">
                        {isSignUp ? "Start your journey today" : "Sign in to access your dashboard"}
                    </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && (
                        <div className="space-y-4">
                            {/* Students only - Teachers are added by admin */}
                            <div className="p-4 rounded-xl border-2 border-orange-500 bg-orange-50 text-orange-600 flex items-center gap-3">
                                <GraduationCap className="w-6 h-6" />
                                <div>
                                    <span className="text-xs font-bold uppercase block">Student Registration</span>
                                    <span className="text-[10px] text-orange-500">Teachers are added by administrators</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                                    placeholder="John Doe"
                                />
                            </div>

                            <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Select Your Teacher</label>
                                <select
                                    value={selectedTeacher}
                                    onChange={(e) => setSelectedTeacher(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all bg-white"
                                    required
                                >
                                    <option value="">-- Choose a Mentor --</option>
                                    {teachers.map(t => (
                                        <option key={t.id} value={t.id}>{t.full_name || "Unnamed Teacher"}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400">* You must be approved by a teacher to access the platform.</p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    {!isSignUp && (
                        <div className="text-right">
                            <button
                                type="button"
                                onClick={() => setShowForgotPassword(true)}
                                className="text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors"
                            >
                                Forgot Password?
                            </button>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full btn-primary flex items-center justify-center gap-2 mt-6 py-4 text-base shadow-xl shadow-orange-500/20"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                            <>
                                {isSignUp ? "Create Account" : "Sign In"}
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </form>

                <div className="text-center">
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-sm font-bold text-slate-500 hover:text-orange-600 transition-colors"
                    >
                        {isSignUp ? "Already have an account? Sign In" : "New here? Create Account"}
                    </button>
                </div>
            </div>

            {/* Forgot Password Modal */}
            {showForgotPassword && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowForgotPassword(false)} />
                    <div className="relative bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full animate-in zoom-in-95 fade-in">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Reset Password</h3>
                        <p className="text-slate-500 text-sm mb-6">Enter your email and we'll send you a link to reset your password.</p>

                        <input
                            type="email"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none mb-4"
                            placeholder="you@example.com"
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowForgotPassword(false)}
                                className="flex-1 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleForgotPassword}
                                disabled={isLoading || !resetEmail}
                                className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Send Reset Link
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
