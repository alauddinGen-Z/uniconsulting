import { useAppStore } from '../../store/appStore';
import { FileText, MessageSquare, Target, BookOpen, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

// Calculate application completeness
function calculateCompleteness(profile: any, documents: any[], essayCount: number): number {
    let score = 0;
    let total = 0;

    // Profile fields (50 points)
    const profileFields = ['full_name', 'phone_number', 'current_school', 'gpa', 'target_country', 'target_major'];
    profileFields.forEach(field => {
        total += 10;
        if (profile?.[field]) score += 10;
    });

    // Test scores (20 points)
    if (profile?.sat_score || profile?.ielts_score || profile?.toefl_score) {
        score += 20;
    }
    total += 20;

    // Documents (20 points)
    total += 20;
    if (documents.length > 0) score += Math.min(documents.length * 10, 20);

    // Essays (10 points)
    total += 10;
    if (essayCount > 0) score += 10;

    return Math.round((score / total) * 100);
}

export default function StudentHomePage() {
    const { user, messages } = useAppStore();
    const navigate = useNavigate();
    const [completeness, setCompleteness] = useState(0);
    const [documents, setDocuments] = useState<any[]>([]);
    const [essayCount, setEssayCount] = useState(0);
    const [recentMessages, setRecentMessages] = useState<any[]>([]);

    useEffect(() => {
        loadDashboardData();
    }, [user]);

    const loadDashboardData = async () => {
        if (!user?.id) return;

        // Fetch profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        // Fetch documents
        const { data: docs } = await supabase
            .from('documents')
            .select('*')
            .eq('student_id', user.id);

        // Fetch essays count
        const { count } = await supabase
            .from('essay_drafts')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', user.id);

        setDocuments(docs || []);
        setEssayCount(count || 0);
        setCompleteness(calculateCompleteness(profile, docs || [], count || 0));

        // Get recent messages
        const userMessages = messages.filter(m =>
            m.sender_id === user.id || m.receiver_id === user.id
        ).slice(-3);
        setRecentMessages(userMessages);
    };

    const quickActions = [
        { label: 'Edit Profile', icon: Target, path: '/profile', color: 'from-blue-500 to-cyan-500' },
        { label: 'Upload Documents', icon: FileText, path: '/documents', color: 'from-orange-500 to-pink-500' },
        { label: 'Messages', icon: MessageSquare, path: '/messages', color: 'from-purple-500 to-indigo-500' },
    ];

    return (
        <div className="space-y-6">
            {/* Welcome Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">
                    Welcome back, {user?.full_name?.split(' ')[0] || 'Student'}! 👋
                </h1>
                <p className="text-slate-500">Track your university application progress</p>
            </div>

            {/* Progress Bar Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-slate-900 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        Application Completeness
                    </h2>
                    <span className="text-2xl font-bold text-orange-500">{completeness}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                    <div
                        className="bg-gradient-to-r from-orange-500 to-pink-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${completeness}%` }}
                    />
                </div>
                <div className="grid grid-cols-4 gap-2 mt-4">
                    <div className="text-center">
                        <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center ${user?.full_name ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Target className="w-4 h-4" />
                        </div>
                        <div className="text-xs mt-1 text-slate-500">Profile</div>
                    </div>
                    <div className="text-center">
                        <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center ${documents.length > 0 ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                            <FileText className="w-4 h-4" />
                        </div>
                        <div className="text-xs mt-1 text-slate-500">Documents</div>
                    </div>
                    <div className="text-center">
                        <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center ${essayCount > 0 ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                            <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="text-xs mt-1 text-slate-500">Essays</div>
                    </div>
                    <div className="text-center">
                        <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center ${recentMessages.length > 0 ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                            <MessageSquare className="w-4 h-4" />
                        </div>
                        <div className="text-xs mt-1 text-slate-500">Messages</div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-4">
                {quickActions.map((action) => (
                    <button
                        key={action.path}
                        onClick={() => navigate(action.path)}
                        className={`bg-gradient-to-r ${action.color} p-5 rounded-2xl text-white hover:scale-105 transition-transform shadow-lg`}
                    >
                        <action.icon className="w-8 h-8 mb-2" />
                        <div className="font-bold">{action.label}</div>
                    </button>
                ))}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="text-3xl font-bold text-orange-500">{documents.length}</div>
                    <div className="text-slate-500">Documents Uploaded</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="text-3xl font-bold text-pink-500">{essayCount}</div>
                    <div className="text-slate-500">Essay Drafts</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="text-3xl font-bold text-purple-500">{recentMessages.length}</div>
                    <div className="text-slate-500">Conversations</div>
                </div>
            </div>

            {/* Recent Activity */}
            {recentMessages.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h2 className="font-bold text-slate-900 mb-4">Recent Messages</h2>
                    <div className="space-y-3">
                        {recentMessages.map((msg) => (
                            <div key={msg.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                                    <MessageSquare className="w-4 h-4 text-orange-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-700 truncate">{msg.content}</p>
                                    <p className="text-xs text-slate-400">
                                        {new Date(msg.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
