import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import {
    LayoutDashboard, Users, MessageSquare, LogOut, Zap, Sparkles
} from 'lucide-react';

// Page components
import CommandCenter from './CommandCenter';
import AllStudents from './AllStudents';
import Messages from './Messages';
import AIMatcherPage from './AIMatcherPage';
import AutomationPage from './AutomationPage';

const navItems = [
    { id: 'dashboard', path: '/', label: 'Command Center', icon: LayoutDashboard },
    { id: 'students', path: '/students', label: 'All Students', icon: Users },
    { id: 'messages', path: '/messages', label: 'Messages', icon: MessageSquare },
    { id: 'ai-matcher', path: '/ai-matcher', label: 'AI Matcher', icon: Sparkles },
    { id: 'automation', path: '/automation', label: 'Automation', icon: Zap },
];

export default function TeacherDashboard() {
    const { user, students, messages, logout } = useAppStore();
    const navigate = useNavigate();

    console.log('[TeacherDashboard] Rendering, user:', user?.email, 'students:', students.length);

    // Count unread messages
    const unreadCount = messages.filter(m => m.receiver_id === user?.id && !m.is_read).length;
    // Count pending students
    const pendingCount = students.filter(s => s.approval_status === 'pending').length;

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50">
            {/* Sidebar - Never unmounts */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col">
                {/* Logo */}
                <div className="p-6 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl flex items-center justify-center">
                            <span className="text-lg font-black">U</span>
                        </div>
                        <div>
                            <div className="font-bold">UNI</div>
                            <div className="text-xs text-slate-400">Teacher Console</div>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-3 mb-3">Menu</div>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.id}
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
                            {item.id === 'messages' && unreadCount > 0 && (
                                <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                                    {unreadCount}
                                </span>
                            )}
                            {item.id === 'students' && pendingCount > 0 && (
                                <span className="ml-auto bg-yellow-500 text-slate-900 text-xs px-2 py-0.5 rounded-full">
                                    {pendingCount}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* User section */}
                <div className="p-4 border-t border-slate-700">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold">{user?.full_name?.[0] || 'T'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{user?.full_name || 'Teacher'}</div>
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

            {/* Main Content - Instant transitions */}
            <main className="flex-1 overflow-auto p-6">
                <Routes>
                    <Route index element={<CommandCenter />} />
                    <Route path="students" element={<AllStudents />} />
                    <Route path="messages" element={<Messages />} />
                    <Route path="ai-matcher" element={<AIMatcherPage />} />
                    <Route path="automation" element={<AutomationPage />} />
                </Routes>
            </main>
        </div>
    );
}
