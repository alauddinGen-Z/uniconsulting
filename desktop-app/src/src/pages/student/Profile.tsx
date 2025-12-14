import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { supabase } from '../../lib/supabase';
import { User, Save, Loader2, GraduationCap, Globe, Target, Phone, School, Award } from 'lucide-react';

interface ProfileData {
    full_name: string;
    phone_number: string;
    current_school: string;
    gpa: string;
    target_country: string;
    target_major: string;
    sat_score: string;
    ielts_score: string;
    toefl_score: string;
    budget: string;
}

export default function StudentProfilePage() {
    const { user, loadUserProfile } = useAppStore();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [profile, setProfile] = useState<ProfileData>({
        full_name: '',
        phone_number: '',
        current_school: '',
        gpa: '',
        target_country: '',
        target_major: '',
        sat_score: '',
        ielts_score: '',
        toefl_score: '',
        budget: '',
    });

    useEffect(() => {
        loadProfile();
    }, [user]);

    const loadProfile = async () => {
        if (!user?.id) return;
        setIsLoading(true);

        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (data) {
            setProfile({
                full_name: data.full_name || '',
                phone_number: data.phone_number || '',
                current_school: data.current_school || '',
                gpa: data.gpa?.toString() || '',
                target_country: data.target_country || '',
                target_major: data.target_major || '',
                sat_score: data.sat_score?.toString() || '',
                ielts_score: data.ielts_score?.toString() || '',
                toefl_score: data.toefl_score?.toString() || '',
                budget: data.budget?.toString() || '',
            });
        }
        setIsLoading(false);
    };

    const handleSave = async () => {
        if (!user?.id) return;
        setIsSaving(true);
        setSuccessMessage('');

        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: profile.full_name,
                phone_number: profile.phone_number,
                current_school: profile.current_school,
                gpa: profile.gpa ? parseFloat(profile.gpa) : null,
                target_country: profile.target_country,
                target_major: profile.target_major,
                sat_score: profile.sat_score ? parseInt(profile.sat_score) : null,
                ielts_score: profile.ielts_score ? parseFloat(profile.ielts_score) : null,
                toefl_score: profile.toefl_score ? parseInt(profile.toefl_score) : null,
                budget: profile.budget ? parseInt(profile.budget) : null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

        setIsSaving(false);
        if (!error) {
            setSuccessMessage('Profile saved successfully!');
            loadUserProfile();
            setTimeout(() => setSuccessMessage(''), 3000);
        }
    };

    const handleChange = (field: keyof ProfileData, value: string) => {
        setProfile(prev => ({ ...prev, [field]: value }));
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <User className="w-6 h-6 text-orange-500" />
                        My Profile
                    </h1>
                    <p className="text-slate-500">Update your personal information</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-pink-600 transition disabled:opacity-50 flex items-center gap-2"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                </button>
            </div>

            {successMessage && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
                    {successMessage}
                </div>
            )}

            {/* Personal Info */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-slate-400" />
                    Personal Information
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            value={profile.full_name}
                            onChange={(e) => handleChange('full_name', e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            placeholder="John Doe"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="tel"
                                value={profile.phone_number}
                                onChange={(e) => handleChange('phone_number', e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                                placeholder="+1 234 567 8900"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Education */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <School className="w-5 h-5 text-slate-400" />
                    Education
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Current School</label>
                        <input
                            type="text"
                            value={profile.current_school}
                            onChange={(e) => handleChange('current_school', e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            placeholder="Harvard High School"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">GPA</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="4.0"
                            value={profile.gpa}
                            onChange={(e) => handleChange('gpa', e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            placeholder="3.85"
                        />
                    </div>
                </div>
            </div>

            {/* Test Scores */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-slate-400" />
                    Test Scores
                </h2>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">SAT Score</label>
                        <input
                            type="number"
                            min="400"
                            max="1600"
                            value={profile.sat_score}
                            onChange={(e) => handleChange('sat_score', e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            placeholder="1400"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">IELTS Score</label>
                        <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="9"
                            value={profile.ielts_score}
                            onChange={(e) => handleChange('ielts_score', e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            placeholder="7.5"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">TOEFL Score</label>
                        <input
                            type="number"
                            min="0"
                            max="120"
                            value={profile.toefl_score}
                            onChange={(e) => handleChange('toefl_score', e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            placeholder="100"
                        />
                    </div>
                </div>
            </div>

            {/* Goals */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-slate-400" />
                    Goals & Preferences
                </h2>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Target Country</label>
                        <div className="relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                value={profile.target_country}
                                onChange={(e) => handleChange('target_country', e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                                placeholder="USA"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Target Major</label>
                        <div className="relative">
                            <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                value={profile.target_major}
                                onChange={(e) => handleChange('target_major', e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                                placeholder="Computer Science"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Budget (USD/year)</label>
                        <input
                            type="number"
                            min="0"
                            value={profile.budget}
                            onChange={(e) => handleChange('budget', e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            placeholder="50000"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
