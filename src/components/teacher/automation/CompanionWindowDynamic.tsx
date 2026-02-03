"use client";

import { useEffect, useState } from "react";
import { Copy, Check, User, FileText, GraduationCap, Loader2, Download, File, Users, MapPin, Languages, Calculator, Award, Globe, Calendar, Mail, Phone, CreditCard, Heart, AlertCircle, Briefcase } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface Props {
    studentId: string;
}

export default function CompanionWindowDynamic({ studentId }: Props) {
    const [profile, setProfile] = useState<any>(null);
    const [essays, setEssays] = useState<any[]>([]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'family' | 'academic' | 'docs' | 'essays'>('info');
    const supabase = createClient();

    useEffect(() => {
        if (studentId) {
            fetchStudentData(studentId);
        } else {
            setIsLoading(false);
        }
    }, [studentId]);

    const fetchStudentData = async (id: string) => {
        setIsLoading(true);
        try {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single();

            setProfile(profileData);

            const { data: essayData } = await supabase
                .from('essays')
                .select('*')
                .eq('student_id', id);

            setEssays(essayData || []);

            const { data: docData } = await supabase
                .from('documents')
                .select('*')
                .eq('student_id', id);

            setDocuments(docData || []);
        } catch (error) {
            console.error("Error fetching student:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = (text: string | null | undefined, fieldKey: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldKey);
        toast.success('Copied!');
        setTimeout(() => setCopiedField(null), 1500);
    };

    const handleCopyAll = () => {
        if (!profile) return;
        const allData = `${profile.full_name || ''}\n${profile.email || ''}\n${profile.phone || ''}\n${profile.passport_number || ''}\n${profile.date_of_birth || ''}\n${profile.home_address || ''}`;
        navigator.clipboard.writeText(allData);
        toast.success('All info copied!');
    };

    const handleDownload = async (doc: any) => {
        if (!profile) return;
        setDownloadingId(doc.id);

        try {
            let filePath = doc.file_url || '';
            if (filePath.includes('supabase.co')) {
                const match = filePath.match(/\/documents\/(.+)$/);
                if (match) filePath = match[1];
            } else if (filePath.startsWith('documents/')) {
                filePath = filePath.substring('documents/'.length);
            }

            const { data: signedData, error } = await supabase.storage
                .from('documents')
                .createSignedUrl(filePath, 300);

            if (error || !signedData?.signedUrl) throw error;

            const studentName = (profile.full_name || 'Student').replace(/\s+/g, '_');
            const extension = filePath.split('.').pop() || 'pdf';
            const downloadName = `${studentName}_${doc.type}.${extension}`;

            const response = await fetch(signedData.signedUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`Downloaded: ${doc.type}`);
        } catch (error: any) {
            toast.error("Download failed");
        } finally {
            setDownloadingId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (!studentId || !profile) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50 flex items-center justify-center">
                <div className="text-center">
                    <User className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium text-slate-500">No Student Selected</p>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'info', label: 'Info', icon: User },
        { id: 'family', label: 'Family', icon: Users },
        { id: 'academic', label: 'Scores', icon: GraduationCap },
        { id: 'docs', label: `Docs`, icon: FileText, count: documents.length },
        { id: 'essays', label: `Essays`, icon: Award, count: essays.length },
    ];

    const maxGrade = profile.school_system === '11' ? 11 : 12;

    return (
        <div className="h-screen flex flex-col bg-gradient-to-br from-orange-50 via-white to-pink-50">
            {/* Sticky Header */}
            <div className="flex-shrink-0 bg-white border-b border-slate-100 p-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-orange-500/20">
                        {profile.full_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="font-bold text-slate-900 truncate">{profile.full_name || 'Unnamed'}</h1>
                        <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {profile.preferred_university || profile.preferred_country || 'No preference set'}
                        </p>
                    </div>
                    <button
                        onClick={handleCopyAll}
                        className="p-2 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-200 transition-colors"
                        title="Copy all info"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Sticky Tabs */}
            <div className="flex-shrink-0 flex bg-white border-b border-slate-100 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 flex flex-col items-center py-2.5 text-xs font-medium transition-all min-w-0 ${activeTab === tab.id
                            ? 'text-orange-500 border-b-2 border-orange-500 bg-orange-50/50'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <tab.icon className="w-4 h-4 mb-0.5" />
                        <span className="flex items-center gap-1 truncate">
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className="px-1 py-0.5 rounded-full bg-orange-100 text-orange-600 text-[9px] font-bold">
                                    {tab.count}
                                </span>
                            )}
                        </span>
                    </button>
                ))}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-20">
                {/* Personal Info Tab */}
                {activeTab === 'info' && (
                    <div className="space-y-2">
                        <CopyRow icon={<User className="w-4 h-4" />} label="Full Name" value={profile.full_name} onCopy={() => handleCopy(profile.full_name, 'name')} copied={copiedField === 'name'} />
                        <CopyRow icon={<Mail className="w-4 h-4" />} label="Email" value={profile.email} onCopy={() => handleCopy(profile.email, 'email')} copied={copiedField === 'email'} />
                        <CopyRow icon={<Phone className="w-4 h-4" />} label="Phone" value={profile.phone} onCopy={() => handleCopy(profile.phone, 'phone')} copied={copiedField === 'phone'} />
                        <CopyRow icon={<CreditCard className="w-4 h-4" />} label="Passport" value={profile.passport_number} onCopy={() => handleCopy(profile.passport_number, 'passport')} copied={copiedField === 'passport'} />
                        <CopyRow icon={<Calendar className="w-4 h-4" />} label="Date of Birth" value={profile.date_of_birth} onCopy={() => handleCopy(profile.date_of_birth, 'dob')} copied={copiedField === 'dob'} />
                        <CopyRow icon={<Globe className="w-4 h-4" />} label="Nationality" value={profile.nationality} onCopy={() => handleCopy(profile.nationality, 'nationality')} copied={copiedField === 'nationality'} />
                        <CopyRow icon={<MapPin className="w-4 h-4" />} label="Address" value={profile.home_address} onCopy={() => handleCopy(profile.home_address, 'address')} copied={copiedField === 'address'} />
                    </div>
                )}

                {/* Family & Emergency Tab */}
                {activeTab === 'family' && (
                    <div className="space-y-4">
                        {/* Emergency Contact - Top Priority */}
                        <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                            <p className="text-xs font-bold text-red-600 uppercase mb-2 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Emergency Contact
                            </p>
                            <div className="space-y-2">
                                <CopyRow icon={<User className="w-4 h-4" />} label="Name" value={profile.emergency_contact_name} onCopy={() => handleCopy(profile.emergency_contact_name, 'emerg_name')} copied={copiedField === 'emerg_name'} accent="red" />
                                <CopyRow icon={<Phone className="w-4 h-4" />} label="Phone" value={profile.emergency_contact_phone} onCopy={() => handleCopy(profile.emergency_contact_phone, 'emerg_phone')} copied={copiedField === 'emerg_phone'} accent="red" />
                            </div>
                        </div>

                        {/* Mother */}
                        <div className="bg-pink-50 rounded-xl p-3 border border-pink-100">
                            <p className="text-xs font-bold text-pink-600 uppercase mb-2 flex items-center gap-1">
                                <Heart className="w-3 h-3" /> Mother
                            </p>
                            <div className="space-y-2">
                                <CopyRow icon={<User className="w-4 h-4" />} label="Name" value={profile.mother_full_name} onCopy={() => handleCopy(profile.mother_full_name, 'mother_name')} copied={copiedField === 'mother_name'} accent="pink" />
                                <CopyRow icon={<Briefcase className="w-4 h-4" />} label="Occupation" value={profile.mother_occupation} onCopy={() => handleCopy(profile.mother_occupation, 'mother_occ')} copied={copiedField === 'mother_occ'} accent="pink" />
                                <CopyRow icon={<Phone className="w-4 h-4" />} label="Phone" value={profile.mother_phone} onCopy={() => handleCopy(profile.mother_phone, 'mother_phone')} copied={copiedField === 'mother_phone'} accent="pink" />
                                <CopyRow icon={<Mail className="w-4 h-4" />} label="Email" value={profile.mother_email} onCopy={() => handleCopy(profile.mother_email, 'mother_email')} copied={copiedField === 'mother_email'} accent="pink" />
                            </div>
                        </div>

                        {/* Father */}
                        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                            <p className="text-xs font-bold text-blue-600 uppercase mb-2 flex items-center gap-1">
                                <User className="w-3 h-3" /> Father
                            </p>
                            <div className="space-y-2">
                                <CopyRow icon={<User className="w-4 h-4" />} label="Name" value={profile.father_full_name} onCopy={() => handleCopy(profile.father_full_name, 'father_name')} copied={copiedField === 'father_name'} accent="blue" />
                                <CopyRow icon={<Briefcase className="w-4 h-4" />} label="Occupation" value={profile.father_occupation} onCopy={() => handleCopy(profile.father_occupation, 'father_occ')} copied={copiedField === 'father_occ'} accent="blue" />
                                <CopyRow icon={<Phone className="w-4 h-4" />} label="Phone" value={profile.father_phone} onCopy={() => handleCopy(profile.father_phone, 'father_phone')} copied={copiedField === 'father_phone'} accent="blue" />
                                <CopyRow icon={<Mail className="w-4 h-4" />} label="Email" value={profile.father_email} onCopy={() => handleCopy(profile.father_email, 'father_email')} copied={copiedField === 'father_email'} accent="blue" />
                            </div>
                        </div>

                        {/* Siblings */}
                        {(profile.number_of_siblings || profile.siblings_info) && (
                            <div className="bg-white rounded-xl p-3 border border-slate-100">
                                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Siblings</p>
                                {profile.number_of_siblings && (
                                    <p className="text-sm text-slate-700 mb-1">Number: {profile.number_of_siblings}</p>
                                )}
                                {profile.siblings_info && (
                                    <p className="text-xs text-slate-500">{profile.siblings_info}</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Academic Tab */}
                {activeTab === 'academic' && (
                    <div className="space-y-4">
                        {/* IELTS */}
                        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-cyan-100 rounded-lg text-cyan-600"><Languages className="w-4 h-4" /></div>
                                <span className="font-bold text-sm text-slate-700">IELTS</span>
                                <div className="ml-auto flex items-center gap-2">
                                    {profile.ielts_overall && <span className="text-lg font-black text-cyan-600">{profile.ielts_overall}</span>}
                                    <CopyButton value={profile.ielts_overall} fieldKey="ielts_overall" copiedField={copiedField} onCopy={handleCopy} />
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center">
                                <ScoreWithCopy label="L" value={profile.ielts_listening} fieldKey="ielts_l" copiedField={copiedField} onCopy={handleCopy} />
                                <ScoreWithCopy label="R" value={profile.ielts_reading} fieldKey="ielts_r" copiedField={copiedField} onCopy={handleCopy} />
                                <ScoreWithCopy label="W" value={profile.ielts_writing} fieldKey="ielts_w" copiedField={copiedField} onCopy={handleCopy} />
                                <ScoreWithCopy label="S" value={profile.ielts_speaking} fieldKey="ielts_s" copiedField={copiedField} onCopy={handleCopy} />
                            </div>
                        </div>

                        {/* SAT */}
                        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-violet-100 rounded-lg text-violet-600"><Calculator className="w-4 h-4" /></div>
                                <span className="font-bold text-sm text-slate-700">SAT</span>
                                <div className="ml-auto flex items-center gap-2">
                                    {profile.sat_total && <span className="text-lg font-black text-violet-600">{profile.sat_total}</span>}
                                    <CopyButton value={profile.sat_total} fieldKey="sat_total" copiedField={copiedField} onCopy={handleCopy} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center">
                                <ScoreWithCopy label="Math" value={profile.sat_math} fieldKey="sat_m" copiedField={copiedField} onCopy={handleCopy} />
                                <ScoreWithCopy label="Reading" value={profile.sat_reading} fieldKey="sat_r" copiedField={copiedField} onCopy={handleCopy} />
                            </div>
                        </div>

                        {/* GPA */}
                        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600"><GraduationCap className="w-4 h-4" /></div>
                                <span className="font-bold text-sm text-slate-700">GPA</span>
                                <span className="text-xs text-slate-400">({maxGrade}-grade)</span>
                                <div className="ml-auto flex items-center gap-2">
                                    <span className="text-lg font-black text-emerald-600">
                                        {profile.gpa || '—'}{profile.gpa_scale && <span className="text-sm font-normal text-slate-400">/{profile.gpa_scale}</span>}
                                    </span>
                                    <CopyButton value={profile.gpa} fieldKey="gpa" copiedField={copiedField} onCopy={handleCopy} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <ScoreWithCopy label="9th Grade" value={profile.gpa_9th} fieldKey="gpa_9" copiedField={copiedField} onCopy={handleCopy} />
                                <ScoreWithCopy label="10th Grade" value={profile.gpa_10th} fieldKey="gpa_10" copiedField={copiedField} onCopy={handleCopy} />
                                <ScoreWithCopy label="11th Grade" value={profile.gpa_11th} fieldKey="gpa_11" copiedField={copiedField} onCopy={handleCopy} />
                                {maxGrade === 12 && (
                                    <ScoreWithCopy label="12th Grade" value={profile.gpa_12th} fieldKey="gpa_12" copiedField={copiedField} onCopy={handleCopy} />
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Documents Tab */}
                {activeTab === 'docs' && (
                    <div className="space-y-2">
                        {documents.length > 0 ? (
                            documents.map(doc => (
                                <div key={doc.id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                                    <div className="p-2 bg-orange-100 rounded-lg text-orange-500">
                                        <File className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-slate-700 truncate">{doc.type}</p>
                                        <p className="text-xs text-slate-400">{doc.status || 'Uploaded'}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDownload(doc)}
                                        disabled={downloadingId === doc.id}
                                        className="p-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50"
                                    >
                                        {downloadingId === doc.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Download className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8">
                                <FileText className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                                <p className="text-sm text-slate-400">No documents</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Essays Tab */}
                {activeTab === 'essays' && (
                    <div className="space-y-2">
                        {essays.length > 0 ? (
                            essays.map(essay => (
                                <div key={essay.id} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-sm text-slate-700 truncate">{essay.title}</span>
                                        <button
                                            onClick={() => handleCopy(essay.content, essay.id)}
                                            className={`p-1.5 rounded-lg transition-all ${copiedField === essay.id
                                                ? 'bg-green-100 text-green-600'
                                                : 'bg-slate-100 text-slate-400 hover:text-orange-500'
                                                }`}
                                        >
                                            {copiedField === essay.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-400 line-clamp-2">{essay.content}</p>
                                    <p className="text-[10px] text-slate-300 mt-1">{essay.word_count || 0} words</p>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8">
                                <Award className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                                <p className="text-sm text-slate-400">No essays</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Copy row component with accent color support
function CopyRow({ icon, label, value, onCopy, copied, accent }: { icon: React.ReactNode; label: string; value?: string | null; onCopy: () => void; copied: boolean; accent?: string }) {
    const bgClass = accent === 'red' ? 'bg-red-50/50' : accent === 'pink' ? 'bg-pink-50/50' : accent === 'blue' ? 'bg-blue-50/50' : 'bg-white';
    const borderClass = accent === 'red' ? 'border-red-100' : accent === 'pink' ? 'border-pink-100' : accent === 'blue' ? 'border-blue-100' : 'border-slate-100';

    return (
        <div className={`flex items-center gap-3 rounded-xl p-2.5 border ${bgClass} ${borderClass} group hover:border-orange-200 transition-colors`}>
            <div className="text-slate-400">{icon}</div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-400 uppercase font-bold">{label}</p>
                <p className="text-sm text-slate-700 truncate">{value || <span className="text-slate-300 italic">—</span>}</p>
            </div>
            <button
                onClick={onCopy}
                className={`p-1.5 rounded-lg transition-all ${copied
                    ? 'bg-green-100 text-green-600'
                    : 'bg-slate-50 text-slate-300 hover:text-orange-500 hover:bg-orange-50'
                    }`}
            >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
        </div>
    );
}

// Small copy button
function CopyButton({ value, fieldKey, copiedField, onCopy }: { value?: string | null; fieldKey: string; copiedField: string | null; onCopy: (text: string | null | undefined, key: string) => void }) {
    if (!value) return null;
    return (
        <button
            onClick={() => onCopy(value, fieldKey)}
            className={`p-1 rounded-lg transition-all ${copiedField === fieldKey
                ? 'bg-green-100 text-green-600'
                : 'bg-slate-100 text-slate-400 hover:text-orange-500'
                }`}
        >
            {copiedField === fieldKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </button>
    );
}

// Score with copy button
function ScoreWithCopy({ label, value, fieldKey, copiedField, onCopy }: { label: string; value?: string | null; fieldKey: string; copiedField: string | null; onCopy: (text: string | null | undefined, key: string) => void }) {
    return (
        <div className="bg-slate-50 rounded-lg p-2 group relative">
            <p className="text-lg font-bold text-slate-700">{value || '—'}</p>
            <p className="text-[10px] text-slate-400">{label}</p>
            {value && (
                <button
                    onClick={() => onCopy(value, fieldKey)}
                    className={`absolute top-1 right-1 p-1 rounded transition-all opacity-0 group-hover:opacity-100 ${copiedField === fieldKey
                        ? 'bg-green-100 text-green-600 opacity-100'
                        : 'bg-white text-slate-400 hover:text-orange-500'
                        }`}
                >
                    {copiedField === fieldKey ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                </button>
            )}
        </div>
    );
}
