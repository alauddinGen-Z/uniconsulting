import { supabase } from '../lib/supabase';

interface SplashScreenProps {
    message?: string;
    showLogout?: boolean;
}

export default function SplashScreen({ message = "Loading...", showLogout = false }: SplashScreenProps) {
    const handleEmergencyLogout = async () => {
        console.log('[SplashScreen] Emergency logout...');
        await supabase.auth.signOut();
        localStorage.clear();
        window.location.reload();
    };

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-orange-500 to-pink-500 flex flex-col items-center justify-center">
            {/* Logo */}
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-xl animate-pulse">
                <span className="text-3xl font-black text-orange-500">U</span>
            </div>

            {/* App Name */}
            <h1 className="text-white text-2xl font-bold mb-2">UniConsulting</h1>

            {/* Loading message */}
            <p className="text-white/80 text-sm">{message}</p>

            {/* Loading spinner */}
            <div className="mt-6">
                <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            </div>

            {/* Emergency Logout Button */}
            {showLogout && (
                <button
                    onClick={handleEmergencyLogout}
                    className="mt-8 px-6 py-2 bg-white/20 hover:bg-white/30 text-white text-sm rounded-lg transition"
                >
                    Sign Out
                </button>
            )}
        </div>
    );
}

