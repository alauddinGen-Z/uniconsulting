import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { Home, User, FileText, MessageSquare, LogOut } from 'lucide-react';

// Import page components
import StudentHomePage from './Home';
import StudentProfilePage from './Profile';
import StudentDocumentsPage from './Documents';
import StudentMessagesPage from './Messages';

const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/profile', label: 'Profile', icon: User },
    { path: '/documents', label: 'Documents', icon: FileText },
    { path: '/messages', label: 'Messages', icon: MessageSquare },
];

export default function StudentDashboard() {
    const { user, logout } = useAppStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col">
                <div className="p-6 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl flex items-center justify-center">
                            <span className="text-lg font-black">U</span>
                        </div>
                        <div>
                            <div className="font-bold">UNI</div>
                            <div className="text-xs text-slate-400">Student Portal</div>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-3 mb-3">Menu</div>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/'}
                            className={({ isActive }) => `
                                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                                ${isActive
                                    ? 'bg-orange-500 text-white font-bold'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }
                            `}
                        >
                            <item.icon className="w-5 h-5" />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-700">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold">{user?.full_name?.[0] || 'S'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{user?.full_name || 'Student'}</div>
                            <div className="text-xs text-slate-400 truncate">{user?.email}</div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            <main className="flex-1 overflow-auto p-6">
                <Routes>
                    <Route index element={<StudentHomePage />} />
                    <Route path="profile" element={<StudentProfilePage />} />
                    <Route path="documents" element={<StudentDocumentsPage />} />
                    <Route path="messages" element={<StudentMessagesPage />} />
                </Routes>
            </main>
        </div>
    );
}
