"use client";

import { useState, useEffect } from "react";
import { Users, User, Phone, Mail, Save, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface FamilyTabProps {
    isLocked?: boolean;
}

interface FamilyData {
    mother_full_name: string;
    mother_occupation: string;
    mother_phone: string;
    mother_email: string;
    father_full_name: string;
    father_occupation: string;
    father_phone: string;
    father_email: string;
    number_of_siblings: number | null;
    siblings_info: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    family_notes: string;
}

export default function FamilyTab({ isLocked }: FamilyTabProps) {
    const [family, setFamily] = useState<FamilyData>({
        mother_full_name: "",
        mother_occupation: "",
        mother_phone: "",
        mother_email: "",
        father_full_name: "",
        father_occupation: "",
        father_phone: "",
        father_email: "",
        number_of_siblings: null,
        siblings_info: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        family_notes: "",
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        const fetchFamily = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('mother_full_name, mother_occupation, mother_phone, mother_email, father_full_name, father_occupation, father_phone, father_email, number_of_siblings, siblings_info, emergency_contact_name, emergency_contact_phone, family_notes')
                    .eq('id', user.id)
                    .single();

                if (data) {
                    setFamily({
                        mother_full_name: data.mother_full_name || "",
                        mother_occupation: data.mother_occupation || "",
                        mother_phone: data.mother_phone || "",
                        mother_email: data.mother_email || "",
                        father_full_name: data.father_full_name || "",
                        father_occupation: data.father_occupation || "",
                        father_phone: data.father_phone || "",
                        father_email: data.father_email || "",
                        number_of_siblings: data.number_of_siblings,
                        siblings_info: data.siblings_info || "",
                        emergency_contact_name: data.emergency_contact_name || "",
                        emergency_contact_phone: data.emergency_contact_phone || "",
                        family_notes: data.family_notes || "",
                    });
                }
            }
            setIsLoading(false);
        };

        fetchFamily();
    }, [supabase]);

    const handleChange = (field: keyof FamilyData, value: string | number | null) => {
        setFamily(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { error } = await supabase
                .from('profiles')
                .update(family)
                .eq('id', user.id);

            if (error) throw error;
            toast.success("Family information saved!");
        } catch (error) {
            console.error("Save error:", error);
            toast.error("Failed to save");
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
            {/* Mother's Information */}
            <section>
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-pink-500" />
                    Mother's Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            value={family.mother_full_name}
                            onChange={(e) => handleChange('mother_full_name', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="Mother's full name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Occupation</label>
                        <input
                            type="text"
                            value={family.mother_occupation}
                            onChange={(e) => handleChange('mother_occupation', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="Occupation"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                        <input
                            type="tel"
                            value={family.mother_phone}
                            onChange={(e) => handleChange('mother_phone', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="+1 234 567 8900"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={family.mother_email}
                            onChange={(e) => handleChange('mother_email', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="email@example.com"
                        />
                    </div>
                </div>
            </section>

            {/* Father's Information */}
            <section>
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-500" />
                    Father's Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            value={family.father_full_name}
                            onChange={(e) => handleChange('father_full_name', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="Father's full name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Occupation</label>
                        <input
                            type="text"
                            value={family.father_occupation}
                            onChange={(e) => handleChange('father_occupation', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="Occupation"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                        <input
                            type="tel"
                            value={family.father_phone}
                            onChange={(e) => handleChange('father_phone', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="+1 234 567 8900"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={family.father_email}
                            onChange={(e) => handleChange('father_email', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="email@example.com"
                        />
                    </div>
                </div>
            </section>

            {/* Siblings */}
            <section>
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-green-500" />
                    Siblings
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Number of Siblings</label>
                        <input
                            type="number"
                            min="0"
                            value={family.number_of_siblings ?? ""}
                            onChange={(e) => handleChange('number_of_siblings', e.target.value ? parseInt(e.target.value) : null)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="0"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Siblings Information</label>
                        <textarea
                            value={family.siblings_info}
                            onChange={(e) => handleChange('siblings_info', e.target.value)}
                            disabled={isLocked}
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50 resize-none"
                            placeholder="Names, ages, and education status of siblings..."
                        />
                    </div>
                </div>
            </section>

            {/* Emergency Contact */}
            <section>
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-red-500" />
                    Emergency Contact
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Contact Name</label>
                        <input
                            type="text"
                            value={family.emergency_contact_name}
                            onChange={(e) => handleChange('emergency_contact_name', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="Emergency contact name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Contact Phone</label>
                        <input
                            type="tel"
                            value={family.emergency_contact_phone}
                            onChange={(e) => handleChange('emergency_contact_phone', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50"
                            placeholder="+1 234 567 8900"
                        />
                    </div>
                </div>
            </section>

            {/* Additional Notes */}
            <section>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Additional Notes</h3>
                <textarea
                    value={family.family_notes}
                    onChange={(e) => handleChange('family_notes', e.target.value)}
                    disabled={isLocked}
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-50 disabled:bg-slate-50 resize-none"
                    placeholder="Any additional family information relevant to your application..."
                />
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
