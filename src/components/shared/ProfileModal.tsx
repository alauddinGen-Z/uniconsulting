"use client";

import { useState, useEffect } from "react";
import { X, User, Mail, Phone, Calendar, Globe, GraduationCap, Check, Loader2, Camera } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ProfileData {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    role: 'student' | 'teacher';
    approval_status?: string;
    preferred_country?: string;
    preferred_university?: string;
    date_of_birth?: string;
    created_at: string;
    teacher_name?: string;
    student_count?: number;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        full_name: "",
        phone: ""
    });
    const supabase = createClient();

    useEffect(() => {
        if (isOpen) {
            fetchProfile();
        }
    }, [isOpen]);

    const fetchProfile = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            let profileData: ProfileData = {
                ...data,
                email: user.email || data.email
            };

            // If student, fetch teacher name
            if (data.role === 'student' && data.teacher_id) {
                const { data: teacher } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', data.teacher_id)
                    .single();
                profileData.teacher_name = teacher?.full_name || "Unknown";
            }

            // If teacher, fetch student count
            if (data.role === 'teacher') {
                const { count } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('teacher_id', user.id)
                    .eq('role', 'student');
                profileData.student_count = count || 0;
            }

            setProfile(profileData);
            setEditData({
                full_name: data.full_name || "",
                phone: data.phone || ""
            });
        } catch (error) {
            console.error("Error fetching profile:", error);
            toast.error("Failed to load profile");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!profile) return;
        setIsSaving(true);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: editData.full_name,
                    phone: editData.phone
                })
                .eq('id', profile.id);

            if (error) throw error;

            setProfile({ ...profile, ...editData });
            setIsEditing(false);
            toast.success("Profile updated successfully");
        } catch (error) {
            console.error("Error saving profile:", error);
            toast.error("Failed to save profile");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-pink-500 p-6 text-white">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold border-4 border-white/30">
                                {profile?.full_name?.charAt(0) || "?"}
                            </div>
                            <button className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full text-orange-500 shadow-lg hover:scale-110 transition-transform">
                                <Camera className="w-3 h-3" />
                            </button>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{profile?.full_name || "Loading..."}</h2>
                            <p className="text-white/80 text-sm capitalize flex items-center gap-2">
                                {profile?.role === 'teacher' ? (
                                    <><GraduationCap className="w-4 h-4" /> Teacher</>
                                ) : (
                                    <><User className="w-4 h-4" /> Student</>
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Editable Fields */}
                            {isEditing ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                                        <input
                                            value={editData.full_name}
                                            onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                                            className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Phone</label>
                                        <input
                                            value={editData.phone}
                                            onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                                            className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                                            placeholder="+1 234 567 8900"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Read-only Fields */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <InfoItem icon={Mail} label="Email" value={profile?.email} />
                                        <InfoItem icon={Phone} label="Phone" value={profile?.phone || "Not set"} />
                                    </div>

                                    {profile?.role === 'student' && (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <InfoItem icon={Globe} label="Preferred Country" value={profile?.preferred_country || "Not set"} />
                                                <InfoItem icon={GraduationCap} label="Target University" value={profile?.preferred_university || "Not set"} />
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-500 uppercase">Assigned Teacher</p>
                                                    <p className="font-medium text-slate-800">{profile?.teacher_name}</p>
                                                </div>
                                                <div className={`px-3 py-1 rounded-full text-xs font-bold ${profile?.approval_status === 'approved'
                                                        ? 'bg-green-100 text-green-700'
                                                        : profile?.approval_status === 'rejected'
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {profile?.approval_status || 'pending'}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {profile?.role === 'teacher' && (
                                        <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-xl p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-500 uppercase">Total Students</p>
                                                    <p className="text-3xl font-black text-orange-600">{profile?.student_count}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-bold text-slate-500 uppercase">Member Since</p>
                                                    <p className="font-medium text-slate-700">
                                                        {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3">
                    {isEditing ? (
                        <>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex-1 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Save
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="w-full py-3 rounded-xl bg-slate-100 font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                            Edit Profile
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function InfoItem({ icon: Icon, label, value }: { icon: any, label: string, value?: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                <Icon className="w-4 h-4" />
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
                <p className="font-medium text-slate-800 text-sm">{value}</p>
            </div>
        </div>
    );
}
