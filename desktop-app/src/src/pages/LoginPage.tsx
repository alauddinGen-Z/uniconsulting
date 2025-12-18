import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, LogIn, Loader2, ExternalLink } from 'lucide-react';

// Electron API type declaration
declare global {
    interface Window {
        electronAPI?: {
            openExternal: (url: string) => void;
            onAuthSuccess: (callback: (data: { token: string; email: string }) => void) => () => void;
        };
    }
}

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron');

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Listen for auth from deep link (Electron)
    useEffect(() => {
        if (!isElectron) return;

        // @ts-ignore - Electron preload exposes this
        if (window.electronAPI?.onAuthSuccess) {
            window.electronAPI.onAuthSuccess(async (data: { token: string; email: string }) => {
                console.log('[Login] Auth received from deep link:', data.email);
                // App.tsx onAuthStateChange will handle the session change
            });
        }
    }, []);

    const handleBrowserLogin = async () => {
        // Open desktop auth page - auto-redirects if already logged in
        const loginUrl = 'https://uniconsulting.netlify.app/desktop-auth';

        if (isElectron) {
            // @ts-ignore
            window.electronAPI?.openExternal(loginUrl);
        } else {
            window.open(loginUrl, '_blank');
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            console.log('[Login] Attempting sign in for:', email);
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) {
                console.error('[Login] Auth error:', authError.message);
                throw authError;
            }

            console.log('[Login] Sign in successful for:', data.user?.email);
            // App.tsx onAuthStateChange will handle the rest (profile loading, navigation)
            // Just keep loading state true - App.tsx will set isLoading=false when done

        } catch (err: any) {
            console.error('[Login] Error:', err);
            setError(err.message || 'Login failed');
            setIsLoading(false);
        }
        // Don't set isLoading false on success - let App.tsx handle it
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-pink-50 p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <span className="text-2xl font-black text-white">U</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        UNI<span className="text-orange-500">CONSULTING</span>
                    </h1>
                    <p className="text-slate-500 mt-2">Sign in to your account</p>
                </div>

                {/* Browser Login Button (Recommended for Electron) */}
                {isElectron && (
                    <div className="mb-6">
                        <button
                            onClick={handleBrowserLogin}
                            className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition flex items-center justify-center gap-3"
                        >
                            <ExternalLink className="w-5 h-5" />
                            Sign in with Browser
                        </button>
                        <p className="text-center text-xs text-slate-500 mt-2">
                            Opens login page in your default browser
                        </p>
                        <div className="flex items-center gap-4 my-6">
                            <div className="flex-1 h-px bg-slate-200"></div>
                            <span className="text-xs text-slate-400">or sign in directly</span>
                            <div className="flex-1 h-px bg-slate-200"></div>
                        </div>
                    </div>
                )}

                {/* Direct Login Form */}
                <form onSubmit={handleLogin} className="bg-white rounded-2xl p-8 shadow-xl border border-slate-100">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
                                    placeholder="you@example.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
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
                                Sign In
                            </>
                        )}
                    </button>

                    {/* Register link */}
                    <div className="mt-4 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                const url = 'https://uniconsulting.netlify.app/login';
                                if (isElectron) {
                                    // @ts-ignore
                                    window.electronAPI?.openExternal(url);
                                } else {
                                    window.open(url, '_blank');
                                }
                            }}
                            className="text-sm text-orange-500 hover:text-orange-600"
                        >
                            Don't have an account? Register on website
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
