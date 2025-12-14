'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Monitor, CheckCircle, LogIn } from 'lucide-react';

/**
 * Desktop Auth Page
 * 
 * Flow:
 * 1. Desktop app opens browser to this page
 * 2. If user already logged in → auto-redirect to desktop app with token
 * 3. If not logged in → show login form → after login, redirect to desktop app
 */
export default function DesktopAuthPage() {
    const [status, setStatus] = useState<'checking' | 'logged-in' | 'not-logged-in' | 'redirecting' | 'error'>('checking');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const supabase = createClient();

    // Check if user is already logged in
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
                setStatus('logged-in');
                // Auto-redirect to desktop app after short delay
                setTimeout(() => redirectToDesktop(session.access_token, session.user.email || ''), 1500);
            } else {
                setStatus('not-logged-in');
            }
        } catch (err) {
            console.error('Auth check error:', err);
            setStatus('error');
        }
    };

    const redirectToDesktop = (token: string, userEmail: string) => {
        setStatus('redirecting');
        // Deep link to desktop app
        const deepLink = `uniconsulting://auth?token=${encodeURIComponent(token)}&email=${encodeURIComponent(userEmail)}`;
        window.location.href = deepLink;

        // Show message after redirect attempt
        setTimeout(() => {
            setStatus('logged-in');
        }, 2000);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) throw authError;

            if (data.session) {
                setStatus('logged-in');
                setTimeout(() => redirectToDesktop(data.session.access_token, data.session.user.email || ''), 1000);
            }
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-pink-50 p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Monitor className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        Desktop Login
                    </h1>
                    <p className="text-slate-500 mt-2">Sign in to UniConsulting Desktop App</p>
                </div>

                {/* Status: Checking */}
                {status === 'checking' && (
                    <div className="bg-white rounded-2xl p-8 shadow-xl border border-slate-100 text-center">
                        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
                        <p className="text-slate-600">Checking login status...</p>
                    </div>
                )}

                {/* Status: Already Logged In */}
                {status === 'logged-in' && (
                    <div className="bg-white rounded-2xl p-8 shadow-xl border border-slate-100 text-center">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-900 mb-2">You're logged in!</h2>
                        <p className="text-slate-600 mb-4">Redirecting to desktop app...</p>
                        <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto" />
                        <p className="text-sm text-slate-400 mt-4">
                            If the app doesn't open, <button
                                onClick={() => {
                                    supabase.auth.getSession().then(({ data }) => {
                                        if (data.session) {
                                            redirectToDesktop(data.session.access_token, data.session.user.email || '');
                                        }
                                    });
                                }}
                                className="text-orange-500 hover:underline"
                            >
                                click here to try again
                            </button>
                        </p>
                    </div>
                )}

                {/* Status: Redirecting */}
                {status === 'redirecting' && (
                    <div className="bg-white rounded-2xl p-8 shadow-xl border border-slate-100 text-center">
                        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Opening Desktop App...</h2>
                        <p className="text-slate-600">You can close this window</p>
                    </div>
                )}

                {/* Status: Not Logged In - Show Login Form */}
                {status === 'not-logged-in' && (
                    <form onSubmit={handleLogin} className="bg-white rounded-2xl p-8 shadow-xl border border-slate-100">
                        <div className="text-center mb-6">
                            <LogIn className="w-10 h-10 text-orange-500 mx-auto mb-2" />
                            <p className="text-slate-600">Please sign in to continue</p>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                                    placeholder="you@example.com"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-pink-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    Sign In & Open Desktop App
                                </>
                            )}
                        </button>

                        <p className="text-center text-sm text-slate-500 mt-4">
                            Don't have an account?{' '}
                            <a href="/login" className="text-orange-500 hover:underline">
                                Register here
                            </a>
                        </p>
                    </form>
                )}

                {/* Status: Error */}
                {status === 'error' && (
                    <div className="bg-white rounded-2xl p-8 shadow-xl border border-slate-100 text-center">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">⚠️</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
                        <p className="text-slate-600 mb-4">Please try again</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                        >
                            Retry
                        </button>
                    </div>
                )}

                <p className="text-center text-xs text-slate-400 mt-6">
                    This page is for desktop app authentication only
                </p>
            </div>
        </div>
    );
}
