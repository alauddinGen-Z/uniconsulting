"use client";

import { useState, useEffect, useRef } from "react";
import { User, MapPin, Calendar, CreditCard, Globe, Save, Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface IdentityTabProps {
    isLocked?: boolean;
}

interface ProfileData {
    full_name: string;
    email: string;
    phone: string;
    date_of_birth: string;
    gender: string;
    nationality: string;
    passport_number: string;
    passport_expiry: string;
    home_address: string;
    city: string;
    country: string;
}

interface Teacher {
    id: string;
    full_name: string;
}

export default function IdentityTab({ isLocked }: IdentityTabProps) {
    const [profile, setProfile] = useState<ProfileData>({
        full_name: "",
        email: "",
        phone: "",
        date_of_birth: "",
        gender: "",
        nationality: "",
        passport_number: "",
        passport_expiry: "",
        home_address: "",
        city: "",
        country: "",
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
    const [currentTeacherName, setCurrentTeacherName] = useState<string>("");
    const [showTeacherChange, setShowTeacherChange] = useState(false);
    const [selectedNewTeacher, setSelectedNewTeacher] = useState<string>("");
    const [isChangingTeacher, setIsChangingTeacher] = useState(false);
    const hasFetched = useRef(false);
    const supabase = createClient();

    // Only fetch once on first mount
    useEffect(() => {
        if (!hasFetched.current) {
            hasFetched.current = true;
            fetchProfile();
            fetchTeachers();
        }
    }, []);

    const fetchTeachers = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'teacher')
            .eq('approval_status', 'approved');
        setTeachers(data || []);
    };

    const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from('profiles')
                .select('full_name, email, phone, date_of_birth, gender, nationality, passport_number, passport_expiry, home_address, city, country, teacher_id, teacher:teacher_id(full_name)')
                .eq('id', user.id)
                .single();

            if (data) {
                setProfile({
                    full_name: data.full_name || "",
                    email: data.email || user.email || "",
                    phone: data.phone || "",
                    date_of_birth: data.date_of_birth || "",
                    gender: data.gender || "",
                    nationality: data.nationality || "",
                    passport_number: data.passport_number || "",
                    passport_expiry: data.passport_expiry || "",
                    home_address: data.home_address || "",
                    city: data.city || "",
                    country: data.country || "",
                });
                setCurrentTeacherId(data.teacher_id);
                setCurrentTeacherName((data.teacher as any)?.full_name || "Not Assigned");
            }
        }
        setIsLoading(false);
    };

    const handleChangeTeacher = async () => {
        if (!selectedNewTeacher) return;

        setIsChangingTeacher(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { error } = await supabase
                .from('profiles')
                .update({
                    teacher_id: selectedNewTeacher,
                    approval_status: 'pending' // Reset to pending when changing teacher
                })
                .eq('id', user.id);

            if (error) throw error;

            const newTeacher = teachers.find(t => t.id === selectedNewTeacher);
            setCurrentTeacherId(selectedNewTeacher);
            setCurrentTeacherName(newTeacher?.full_name || "");
            setShowTeacherChange(false);
            setSelectedNewTeacher("");

            toast.success("Teacher changed! Your account is now pending approval from the new teacher.");
        } catch (error) {
            console.error("Error changing teacher:", error);
            toast.error("Failed to change teacher");
        } finally {
            setIsChangingTeacher(false);
        }
    };

    const handleChange = (field: keyof ProfileData, value: string) => {
        setProfile(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { error } = await supabase
                .from('profiles')
                .update(profile)
                .eq('id', user.id);

            if (error) throw error;
            toast.success("Profile saved successfully!");
        } catch (error) {
            console.error("Save error:", error);
            toast.error("Failed to save profile");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Current Teacher Section */}
            <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-500" />
                    Your Consultant
                </h3>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                            {currentTeacherName?.charAt(0) || '?'}
                        </div>
                        <div>
                            <p className="font-bold text-slate-900">{currentTeacherName}</p>
                            <p className="text-sm text-slate-500">Your assigned teacher/consultant</p>
                        </div>
                    </div>

                    {!showTeacherChange ? (
                        <button
                            onClick={() => setShowTeacherChange(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-white rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Change Teacher
                        </button>
                    ) : (
                        <div className="flex items-center gap-3">
                            <select
                                value={selectedNewTeacher}
                                onChange={(e) => setSelectedNewTeacher(e.target.value)}
                                className="px-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                            >
                                <option value="">Select new teacher</option>
                                {teachers.filter(t => t.id !== currentTeacherId).map(teacher => (
                                    <option key={teacher.id} value={teacher.id}>
                                        {teacher.full_name}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={handleChangeTeacher}
                                disabled={!selectedNewTeacher || isChangingTeacher}
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                {isChangingTeacher ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowTeacherChange(false);
                                    setSelectedNewTeacher("");
                                }}
                                className="px-4 py-2 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>

                {showTeacherChange && (
                    <p className="mt-3 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
                        ⚠️ Changing your teacher will reset your account to &quot;pending&quot; status. The new teacher will need to approve you.
                    </p>
                )}
            </section>

            {/* Personal Information */}
            <section>
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-orange-500" />
                    Personal Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            value={profile.full_name}
                            onChange={(e) => handleChange('full_name', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="Your full name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={profile.email}
                            disabled
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 opacity-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                        <input
                            type="tel"
                            value={profile.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="+1 234 567 8900"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                        <input
                            type="date"
                            value={profile.date_of_birth}
                            onChange={(e) => handleChange('date_of_birth', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                        <select
                            value={profile.gender}
                            onChange={(e) => handleChange('gender', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                        >
                            <option value="">Select gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                            <option value="prefer_not_to_say">Prefer not to say</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nationality</label>
                        <input
                            type="text"
                            value={profile.nationality}
                            onChange={(e) => handleChange('nationality', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="Your nationality"
                        />
                    </div>
                </div>
            </section>

            {/* Passport Information */}
            <section>
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-orange-500" />
                    Passport Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Passport Number</label>
                        <input
                            type="text"
                            value={profile.passport_number}
                            onChange={(e) => handleChange('passport_number', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="AB1234567"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Passport Expiry</label>
                        <input
                            type="date"
                            value={profile.passport_expiry}
                            onChange={(e) => handleChange('passport_expiry', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                        />
                    </div>
                </div>
            </section>

            {/* Address */}
            <section>
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-orange-500" />
                    Address
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Home Address</label>
                        <input
                            type="text"
                            value={profile.home_address}
                            onChange={(e) => handleChange('home_address', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="Street address"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                        <input
                            type="text"
                            value={profile.city}
                            onChange={(e) => handleChange('city', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="City"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                        <input
                            type="text"
                            value={profile.country}
                            onChange={(e) => handleChange('country', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="Country"
                        />
                    </div>
                </div>
            </section>

            {/* Save Button */}
            {!isLocked && (
                <div className="flex justify-end pt-4">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="btn-primary px-8 py-3 flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
