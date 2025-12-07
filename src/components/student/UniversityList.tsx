"use client";

import { useState, useEffect } from "react";
import { GraduationCap, Plus, Calendar, MapPin, Trash2, Edit2, Check, X, Loader2, Target, Clock, ChevronDown, Building, Sparkles, Star, DollarSign, BookOpen } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { API_ENDPOINTS } from "@/lib/config";

interface University {
    id: string;
    university_name: string;
    country: string;
    program: string;
    category: 'safety' | 'match' | 'reach';
    deadline_type: string;
    deadline_date: string;
    application_status: string;
    notes: string;
}

const countries = ['USA', 'UK', 'Canada', 'Australia', 'Germany', 'Netherlands', 'France', 'Japan', 'South Korea', 'China', 'Other'];

const deadlineTypes = [
    { value: 'early_decision', label: 'Early Decision', color: 'text-red-500' },
    { value: 'early_action', label: 'Early Action', color: 'text-orange-500' },
    { value: 'regular', label: 'Regular Decision', color: 'text-blue-500' },
    { value: 'rolling', label: 'Rolling Admission', color: 'text-green-500' },
    { value: 'ucas', label: 'UCAS (UK)', color: 'text-purple-500' },
];

const statusOptions = [
    { value: 'researching', label: 'Researching', color: 'bg-slate-500' },
    { value: 'preparing', label: 'Preparing', color: 'bg-yellow-500' },
    { value: 'submitted', label: 'Submitted', color: 'bg-blue-500' },
    { value: 'accepted', label: 'Accepted', color: 'bg-green-500' },
    { value: 'rejected', label: 'Rejected', color: 'bg-red-500' },
    { value: 'waitlisted', label: 'Waitlisted', color: 'bg-orange-500' },
];

// AI Match result interface
interface UniversityMatch {
    name: string;
    country: string;
    matchScore: number;
    category: 'safety' | 'match' | 'reach';
    reason: string;
    requirements: {
        gpa?: string;
        sat?: string;
        toefl?: string;
        ielts?: string;
    };
    tuitionRange: string;
    programStrength: string;
}

export default function UniversityList({ isLocked }: { isLocked?: boolean }) {
    const [universities, setUniversities] = useState<University[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        university_name: '',
        country: 'USA',
        program: '',
        category: 'match' as const,
        deadline_type: 'regular',
        deadline_date: '',
        notes: ''
    });
    // University Preferences state (for teacher to use when matching)
    const [showPrefsForm, setShowPrefsForm] = useState(false);
    const [savingPrefs, setSavingPrefs] = useState(false);
    const [universityPrefs, setUniversityPrefs] = useState({
        preferred_regions: [] as string[],
        preferred_field: '',
        budget_level: 'medium' as 'low' | 'medium' | 'high' | 'full_scholarship'
    });
    const supabase = createClient();

    useEffect(() => {
        fetchUniversities();
    }, []);

    const fetchUniversities = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('student_universities')
                .select('*')
                .eq('student_id', user.id)
                .order('deadline_date', { ascending: true });

            setUniversities(data || []);
        } catch (error) {
            console.error("Error fetching universities:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = async () => {
        if (isLocked) {
            toast.error("Your account needs to be approved first");
            return;
        }
        if (!formData.university_name.trim()) {
            toast.error("Please enter university name");
            return;
        }

        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { error } = await supabase
                .from('student_universities')
                .insert({
                    student_id: user.id,
                    ...formData
                });

            if (error) throw error;

            toast.success("University added!");
            setShowAddForm(false);
            setFormData({
                university_name: '',
                country: 'USA',
                program: '',
                category: 'match',
                deadline_type: 'regular',
                deadline_date: '',
                notes: ''
            });
            fetchUniversities();
        } catch (error: any) {
            toast.error(error.message || "Failed to add university");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (isLocked) return;

        try {
            await supabase.from('student_universities').delete().eq('id', id);
            toast.success("University removed");
            fetchUniversities();
        } catch (error) {
            toast.error("Failed to delete");
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        if (isLocked) return;

        try {
            await supabase
                .from('student_universities')
                .update({ application_status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', id);

            fetchUniversities();
            toast.success("Status updated");
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const getDaysUntilDeadline = (date: string) => {
        if (!date) return null;
        const deadline = new Date(date);
        const today = new Date();
        const diff = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'safety': return 'from-green-400 to-emerald-500';
            case 'match': return 'from-blue-400 to-indigo-500';
            case 'reach': return 'from-orange-400 to-red-500';
            default: return 'from-slate-400 to-slate-500';
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'safety': return '✅';
            case 'match': return '🎯';
            case 'reach': return '🚀';
            default: return '📚';
        }
    };

    // Save university preferences to profile (for teachers to use when matching)
    const saveUniversityPrefs = async () => {
        setSavingPrefs(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error("Please log in first");
                return;
            }

            console.log("Saving preferences for user:", user.id);
            console.log("Preferences data:", universityPrefs);

            const { data, error } = await supabase
                .from('profiles')
                .update({
                    preferred_regions: universityPrefs.preferred_regions,
                    preferred_major: universityPrefs.preferred_field,
                    budget_level: universityPrefs.budget_level
                })
                .eq('id', user.id)
                .select();

            console.log("Update response - data:", data);
            console.log("Update response - error:", error);

            if (error) {
                console.error('Supabase error details:', JSON.stringify(error, null, 2));
                throw error;
            }

            toast.success("Preferences saved! Your teacher can now find matching universities for you.");
            setShowPrefsForm(false);
        } catch (error: any) {
            console.error('Save preferences error:', error);
            console.error('Error type:', typeof error);
            console.error('Error stringified:', JSON.stringify(error, null, 2));
            toast.error(error?.message || error?.details || "Failed to save preferences. Please check database schema.");
        } finally {
            setSavingPrefs(false);
        }
    };


    // Load existing preferences on mount
    useEffect(() => {
        const loadPreferences = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('preferred_regions, preferred_major, budget_level')
                .eq('id', user.id)
                .single();

            if (profile) {
                setUniversityPrefs({
                    preferred_regions: profile.preferred_regions || [],
                    preferred_field: profile.preferred_major || '',
                    budget_level: profile.budget_level || 'medium'
                });
            }
        };
        loadPreferences();
    }, []);

    // Add matched university to list
    const addMatchedUniversity = async (match: UniversityMatch) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { error } = await supabase
                .from('student_universities')
                .insert({
                    student_id: user.id,
                    university_name: match.name,
                    country: match.country,
                    program: match.programStrength,
                    category: match.category,
                    deadline_type: 'regular',
                    notes: match.reason
                });

            if (error) throw error;

            toast.success(`${match.name} added to your list!`);
            fetchUniversities();
        } catch (error: any) {
            toast.error(error.message || "Failed to add university");
        }
    };

    const groupedUniversities = {
        reach: universities.filter(u => u.category === 'reach'),
        match: universities.filter(u => u.category === 'match'),
        safety: universities.filter(u => u.category === 'safety'),
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header - compact */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">My University List</h2>
                    <p className="text-slate-400 text-xs">Track your target schools with deadlines</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowPrefsForm(true)}
                        disabled={isLocked}
                        className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold text-sm flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Target className="w-4 h-4" />
                        My Preferences
                    </button>
                    <button
                        onClick={() => setShowAddForm(true)}
                        disabled={isLocked}
                        className="px-3 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold text-sm flex items-center gap-2 hover:shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4" />
                        Add
                    </button>
                </div>
            </div>

            {/* Stats - compact */}
            <div className="grid grid-cols-3 gap-3 mb-4 flex-shrink-0">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 border border-green-100">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm">✅</span>
                        <span className="text-green-600 font-bold text-xs">SAFETY</span>
                    </div>
                    <p className="text-2xl font-black text-green-700">{groupedUniversities.safety.length}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm">🎯</span>
                        <span className="text-blue-600 font-bold text-xs">MATCH</span>
                    </div>
                    <p className="text-2xl font-black text-blue-700">{groupedUniversities.match.length}</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-3 border border-orange-100">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm">🚀</span>
                        <span className="text-orange-600 font-bold text-xs">REACH</span>
                    </div>
                    <p className="text-2xl font-black text-orange-700">{groupedUniversities.reach.length}</p>
                </div>
            </div>

            {/* Add Form Modal */}
            {showAddForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-lg animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Add University</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-1">University Name *</label>
                                <input
                                    type="text"
                                    value={formData.university_name}
                                    onChange={(e) => setFormData({ ...formData, university_name: e.target.value })}
                                    placeholder="e.g., Harvard University"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-1">Country</label>
                                    <select
                                        value={formData.country}
                                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-400 outline-none"
                                    >
                                        {countries.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-1">Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-400 outline-none"
                                    >
                                        <option value="safety">✅ Safety</option>
                                        <option value="match">🎯 Match</option>
                                        <option value="reach">🚀 Reach</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-1">Program / Major</label>
                                <input
                                    type="text"
                                    value={formData.program}
                                    onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                                    placeholder="e.g., Computer Science"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-400 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-1">Deadline Type</label>
                                    <select
                                        value={formData.deadline_type}
                                        onChange={(e) => setFormData({ ...formData, deadline_type: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-400 outline-none"
                                    >
                                        {deadlineTypes.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-1">Deadline Date</label>
                                    <input
                                        type="date"
                                        value={formData.deadline_date}
                                        onChange={(e) => setFormData({ ...formData, deadline_date: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-400 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-1">Notes</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Any notes about this university..."
                                    rows={2}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-400 outline-none resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddForm(false)}
                                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAdd}
                                disabled={isSaving}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* University Preferences Modal */}
            {showPrefsForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500 text-white">
                                <Target className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">My University Preferences</h3>
                                <p className="text-xs text-slate-500">Help your teacher find the best universities for you</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Region Selection */}
                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-2">Where do you want to study?</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { value: 'north_america', label: '🇺🇸 North America' },
                                        { value: 'europe', label: '🇪🇺 Europe' },
                                        { value: 'asia', label: '🌏 Asia' },
                                        { value: 'oceania', label: '🇦🇺 Oceania' },
                                        { value: 'middle_east', label: '🌍 Middle East' },
                                    ].map(region => (
                                        <label key={region.value} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${universityPrefs.preferred_regions.includes(region.value)
                                            ? 'border-purple-500 bg-purple-50'
                                            : 'border-slate-200 hover:border-purple-300'
                                            }`}>
                                            <input
                                                type="checkbox"
                                                checked={universityPrefs.preferred_regions.includes(region.value)}
                                                onChange={(e) => {
                                                    const newRegions = e.target.checked
                                                        ? [...universityPrefs.preferred_regions, region.value]
                                                        : universityPrefs.preferred_regions.filter(r => r !== region.value);
                                                    setUniversityPrefs({ ...universityPrefs, preferred_regions: newRegions });
                                                }}
                                                className="accent-purple-500"
                                            />
                                            <span className="text-sm font-medium">{region.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Field of Study */}
                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-1">What do you want to study?</label>
                                <input
                                    type="text"
                                    value={universityPrefs.preferred_field}
                                    onChange={(e) => setUniversityPrefs({ ...universityPrefs, preferred_field: e.target.value })}
                                    placeholder="e.g., Computer Science, Business, Medicine"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 outline-none"
                                />
                            </div>

                            {/* Budget */}
                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-1">Your budget level</label>
                                <select
                                    value={universityPrefs.budget_level}
                                    onChange={(e) => setUniversityPrefs({ ...universityPrefs, budget_level: e.target.value as any })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-purple-400 outline-none"
                                >
                                    <option value="low">💰 Low (Under $20k/year)</option>
                                    <option value="medium">💰💰 Medium ($20k-$40k/year)</option>
                                    <option value="high">💰💰💰 High ($40k+/year)</option>
                                    <option value="full_scholarship">🎓 Need Full Scholarship</option>
                                </select>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowPrefsForm(false)}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveUniversityPrefs}
                                    disabled={savingPrefs}
                                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {savingPrefs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Save Preferences
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* University Lists by Category - Scrollable */}
            <div className="flex-1 overflow-y-auto space-y-4">
                {universities.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl">
                        <Building className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500 font-medium">No universities added yet</p>
                        <p className="text-slate-400 text-sm">Start building your list by clicking "Add"</p>
                    </div>
                ) : (
                    ['reach', 'match', 'safety'].map(category => {
                        const unis = groupedUniversities[category as keyof typeof groupedUniversities];
                        if (unis.length === 0) return null;

                        return (
                            <div key={category} className="space-y-3">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                    <span>{getCategoryIcon(category)}</span>
                                    {category.charAt(0).toUpperCase() + category.slice(1)} Schools ({unis.length})
                                </h3>
                                <div className="space-y-2">
                                    {unis.map(uni => {
                                        const daysLeft = getDaysUntilDeadline(uni.deadline_date);
                                        const statusOption = statusOptions.find(s => s.value === uni.application_status);

                                        return (
                                            <div
                                                key={uni.id}
                                                className="bg-white rounded-2xl p-4 border border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md transition-all group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getCategoryColor(uni.category)} flex items-center justify-center text-white text-xl font-bold`}>
                                                        {uni.university_name.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-slate-900">{uni.university_name}</h4>
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{uni.country}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                                                            {uni.program && <span>{uni.program}</span>}
                                                            {uni.deadline_date && (
                                                                <span className={`flex items-center gap-1 ${daysLeft !== null && daysLeft <= 14 ? 'text-red-500 font-bold' : ''}`}>
                                                                    <Calendar className="w-3 h-3" />
                                                                    {new Date(uni.deadline_date).toLocaleDateString()}
                                                                    {daysLeft !== null && daysLeft >= 0 && (
                                                                        <span className="text-xs">({daysLeft}d left)</span>
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Status Dropdown */}
                                                    <select
                                                        value={uni.application_status}
                                                        onChange={(e) => handleStatusChange(uni.id, e.target.value)}
                                                        disabled={isLocked}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-bold text-white ${statusOption?.color} border-0 outline-none cursor-pointer`}
                                                    >
                                                        {statusOptions.map(s => (
                                                            <option key={s.value} value={s.value}>{s.label}</option>
                                                        ))}
                                                    </select>

                                                    <button
                                                        onClick={() => handleDelete(uni.id)}
                                                        disabled={isLocked}
                                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all disabled:opacity-0"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
