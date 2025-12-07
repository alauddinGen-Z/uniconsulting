"use client";

import { useState, useEffect } from "react";
import { GraduationCap, Languages, Save, Loader2, Check, Info, Calculator } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface AcademicTabProps {
    onUnlock: (amount: number) => void;
    isLocked?: boolean;
}

export default function AcademicTab({ onUnlock, isLocked }: AcademicTabProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [scores, setScores] = useState({
        ielts_overall: '',
        ielts_listening: '',
        ielts_reading: '',
        ielts_writing: '',
        ielts_speaking: '',
        sat_total: '',
        sat_math: '',
        sat_reading: '',
        gpa: '',
        gpa_scale: '',
        gpa_9th: '',
        gpa_10th: '',
        gpa_11th: '',
        gpa_12th: '',
        school_system: '12' // '11' or '12' grade system
    });
    const supabase = createClient();

    useEffect(() => {
        loadScores();

        // Listen for scores-updated event from DocumentsPage OCR
        const handleScoresUpdated = () => {
            console.log("Scores updated event received, reloading...");
            loadScores();
        };
        window.addEventListener('scores-updated', handleScoresUpdated);

        return () => {
            window.removeEventListener('scores-updated', handleScoresUpdated);
        };
    }, []);

    const loadScores = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('profiles')
                .select('ielts_overall, ielts_listening, ielts_reading, ielts_writing, ielts_speaking, sat_total, sat_math, sat_reading, gpa, gpa_scale, gpa_9th, gpa_10th, gpa_11th, gpa_12th, school_system')
                .eq('id', user.id)
                .single();

            if (data) {
                setScores({
                    ielts_overall: data.ielts_overall || '',
                    ielts_listening: data.ielts_listening || '',
                    ielts_reading: data.ielts_reading || '',
                    ielts_writing: data.ielts_writing || '',
                    ielts_speaking: data.ielts_speaking || '',
                    sat_total: data.sat_total || '',
                    sat_math: data.sat_math || '',
                    sat_reading: data.sat_reading || '',
                    gpa: data.gpa || '',
                    gpa_scale: data.gpa_scale || '',
                    gpa_9th: data.gpa_9th || '',
                    gpa_10th: data.gpa_10th || '',
                    gpa_11th: data.gpa_11th || '',
                    gpa_12th: data.gpa_12th || '',
                    school_system: data.school_system || '12'
                });
            }
        } catch (error) {
            console.error("Error loading scores:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (isLocked) {
            toast.error("Your account needs to be approved first");
            return;
        }

        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { error } = await supabase
                .from('profiles')
                .update(scores)
                .eq('id', user.id);

            if (error) throw error;
            toast.success("Academic scores saved successfully!");
            onUnlock(20);
        } catch (error: any) {
            toast.error(error.message || "Failed to save");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                    <p className="text-sm text-blue-700">
                        <strong>Note:</strong> Upload test score documents in the <strong>Documents</strong> tab.
                        Enter your scores here for quick reference.
                    </p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* IELTS Section */}
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-6 border border-cyan-100">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/30">
                            <Languages className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">IELTS / TOEFL</h3>
                            <p className="text-xs text-slate-400">Language proficiency</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Overall Band</label>
                            <input
                                type="text"
                                value={scores.ielts_overall}
                                onChange={(e) => setScores({ ...scores, ielts_overall: e.target.value })}
                                disabled={isLocked}
                                placeholder="e.g., 7.5"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Listening</label>
                                <input
                                    type="text"
                                    value={scores.ielts_listening}
                                    onChange={(e) => setScores({ ...scores, ielts_listening: e.target.value })}
                                    disabled={isLocked}
                                    placeholder="8.0"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Reading</label>
                                <input
                                    type="text"
                                    value={scores.ielts_reading}
                                    onChange={(e) => setScores({ ...scores, ielts_reading: e.target.value })}
                                    disabled={isLocked}
                                    placeholder="7.5"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Writing</label>
                                <input
                                    type="text"
                                    value={scores.ielts_writing}
                                    onChange={(e) => setScores({ ...scores, ielts_writing: e.target.value })}
                                    disabled={isLocked}
                                    placeholder="7.0"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Speaking</label>
                                <input
                                    type="text"
                                    value={scores.ielts_speaking}
                                    onChange={(e) => setScores({ ...scores, ielts_speaking: e.target.value })}
                                    disabled={isLocked}
                                    placeholder="7.5"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* SAT Section */}
                <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-100">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 text-white shadow-lg shadow-violet-500/30">
                            <Calculator className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">SAT</h3>
                            <p className="text-xs text-slate-400">Standardized test scores</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Total Score</label>
                            <input
                                type="text"
                                value={scores.sat_total}
                                onChange={(e) => setScores({ ...scores, sat_total: e.target.value })}
                                disabled={isLocked}
                                placeholder="e.g., 1450"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Math</label>
                                <input
                                    type="text"
                                    value={scores.sat_math}
                                    onChange={(e) => setScores({ ...scores, sat_math: e.target.value })}
                                    disabled={isLocked}
                                    placeholder="750"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Reading & Writing</label>
                                <input
                                    type="text"
                                    value={scores.sat_reading}
                                    onChange={(e) => setScores({ ...scores, sat_reading: e.target.value })}
                                    disabled={isLocked}
                                    placeholder="700"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* GPA Section */}
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6 border border-emerald-100 md:col-span-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg shadow-emerald-500/30">
                            <GraduationCap className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">High School GPA</h3>
                            <p className="text-xs text-slate-400">Academic performance by grade</p>
                        </div>
                    </div>

                    {/* Auto-Detected School System */}
                    <div className="mb-4 p-3 bg-white rounded-xl border border-emerald-100 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-500">School System</p>
                            <p className="text-sm text-slate-700">
                                {scores.school_system === '11' ? '11-Grade System (9th → 11th)' : '12-Grade System (9th → 12th)'}
                            </p>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            Auto-detected from transcript
                        </div>
                    </div>

                    {/* Cumulative GPA Row */}
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Cumulative/Average GPA *</label>
                            <input
                                type="text"
                                value={scores.gpa}
                                onChange={(e) => setScores({ ...scores, gpa: e.target.value })}
                                disabled={isLocked}
                                placeholder="e.g., 4.85"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Scale *</label>
                            <input
                                type="text"
                                value={scores.gpa_scale}
                                onChange={(e) => setScores({ ...scores, gpa_scale: e.target.value })}
                                disabled={isLocked}
                                placeholder="e.g., 5.0"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                        </div>
                    </div>

                    {/* Individual Grade GPAs */}
                    <div className={`grid gap-3 ${scores.school_system === '12' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">9th Grade</label>
                            <input
                                type="text"
                                value={scores.gpa_9th}
                                onChange={(e) => setScores({ ...scores, gpa_9th: e.target.value })}
                                disabled={isLocked}
                                placeholder="4.66"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">10th Grade</label>
                            <input
                                type="text"
                                value={scores.gpa_10th}
                                onChange={(e) => setScores({ ...scores, gpa_10th: e.target.value })}
                                disabled={isLocked}
                                placeholder="4.89"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">11th Grade</label>
                            <input
                                type="text"
                                value={scores.gpa_11th}
                                onChange={(e) => setScores({ ...scores, gpa_11th: e.target.value })}
                                disabled={isLocked}
                                placeholder="5.00"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                        </div>
                        {scores.school_system === '12' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">12th Grade</label>
                                <input
                                    type="text"
                                    value={scores.gpa_12th}
                                    onChange={(e) => setScores({ ...scores, gpa_12th: e.target.value })}
                                    disabled={isLocked}
                                    placeholder="—"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <button
                onClick={handleSave}
                disabled={isSaving || isLocked}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSaving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <>
                        <Save className="w-5 h-5" />
                        Save Academic Scores
                    </>
                )}
            </button>
        </div>
    );
}
