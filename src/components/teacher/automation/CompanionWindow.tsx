"use client";

import { useEffect, useState } from "react";
import { Copy, Check, User, FileText, GraduationCap, Loader2, Download, File, Users, MapPin, Languages, Calculator, Award, Globe, Calendar, Mail, Phone, CreditCard } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

export default function CompanionWindow() {
    const [studentId, setStudentId] = useState<string | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [essays, setEssays] = useState<any[]>([]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'academic' | 'docs' | 'essays'>('info');
    const supabase = createClient();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('studentId');
        setStudentId(id);

        if (id) {
            fetchStudentData(id);
        } else {
            setIsLoading(false);
        }
    }, []);

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
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleDownload = async (doc: any) => {
        if (!profile) return;
        setDownloadingId(doc.id);

        try {
            // Try to download from storage
            const filePath = doc.file_url.replace('documents/', '');
            const { data, error } = await supabase.storage
                .from('documents')
                .download(filePath);

            if (error) {
                console.warn('Storage download failed, using fallback URL');
                // Fallback: try to get public URL
                const { data: urlData } = supabase.storage
                    .from('documents')
                    .getPublicUrl(filePath);

                if (urlData?.publicUrl) {
                    window.open(urlData.publicUrl, '_blank');
                    toast.success('Opening document in new tab');
                } else {
                    throw new Error('Could not access document');
                }
                setDownloadingId(null);
                return;
            }

            const studentName = profile.full_name?.replace(/\s+/g, '_') || 'Student';
            const docType = doc.type || 'Document';
            const extension = doc.file_url.split('.').pop() || 'pdf';
            const fileName = `${studentName}_${docType}.${extension}`;

            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`Downloaded: ${fileName}`);
        } catch (error) {
            console.error("Download error:", error);
            toast.error("Failed to download document");
        } finally {
            setDownloadingId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Loading student data...</p>
                </div>
            </div>
        );
    }

    if (!studentId || !profile) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center text-white">
                <div className="text-center">
                    <User className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                    <p className="text-xl font-bold">No Student Selected</p>
                    <p className="text-slate-400 text-sm mt-2">Select a student from the queue</p>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'info', label: 'Info', icon: User },
        { id: 'academic', label: 'Academic', icon: GraduationCap },
        { id: 'docs', label: `Docs (${documents.length})`, icon: FileText },
        { id: 'essays', label: `Essays (${essays.length})`, icon: Award },
    ];

    return (
        <div className="h-screen max-h-screen overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 p-5">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-black">
                        {profile.full_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1">
                        <h1 className="text-2xl font-black">{profile.full_name || 'Unnamed'}</h1>
                        <div className="flex items-center gap-4 text-sm text-white/80 mt-1">
                            <span className="flex items-center gap-1">
                                <Globe className="w-4 h-4" />
                                {profile.preferred_country || 'No country'}
                            </span>
                            <span className="flex items-center gap-1">
                                <GraduationCap className="w-4 h-4" />
                                {profile.preferred_university || 'No university'}
                            </span>
                        </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${profile.approval_status === 'approved' ? 'bg-green-500' :
                        profile.approval_status === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'
                        }`}>
                        {profile.approval_status?.toUpperCase() || 'PENDING'}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-800/50 border-b border-slate-700">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all ${activeTab === tab.id
                            ? 'text-orange-400 border-b-2 border-orange-400 bg-slate-800/50'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {/* Info Tab */}
                {activeTab === 'info' && (
                    <div className="space-y-4 animate-in fade-in">
                        {/* Personal */}
                        <Section title="Personal Information" icon={User}>
                            <CopyField icon={<User className="w-4 h-4" />} label="Full Name" value={profile.full_name} onCopy={() => handleCopy(profile.full_name, 'name')} copied={copiedField === 'name'} />
                            <CopyField icon={<Mail className="w-4 h-4" />} label="Email" value={profile.email} onCopy={() => handleCopy(profile.email, 'email')} copied={copiedField === 'email'} />
                            <CopyField icon={<Phone className="w-4 h-4" />} label="Phone" value={profile.phone} onCopy={() => handleCopy(profile.phone, 'phone')} copied={copiedField === 'phone'} />
                            <CopyField icon={<CreditCard className="w-4 h-4" />} label="Passport Number" value={profile.passport_number} onCopy={() => handleCopy(profile.passport_number, 'passport')} copied={copiedField === 'passport'} />
                            <CopyField icon={<Calendar className="w-4 h-4" />} label="Date of Birth" value={profile.date_of_birth} onCopy={() => handleCopy(profile.date_of_birth, 'dob')} copied={copiedField === 'dob'} />
                            <CopyField icon={<MapPin className="w-4 h-4" />} label="Home Address" value={profile.home_address} onCopy={() => handleCopy(profile.home_address, 'address')} copied={copiedField === 'address'} />
                        </Section>

                        {/* Family */}
                        <Section title="Family Information" icon={Users}>
                            <CopyField icon={<User className="w-4 h-4" />} label="Mother's Name" value={profile.mother_full_name} onCopy={() => handleCopy(profile.mother_full_name, 'mother')} copied={copiedField === 'mother'} />
                            <CopyField icon={<User className="w-4 h-4" />} label="Father's Name" value={profile.father_full_name} onCopy={() => handleCopy(profile.father_full_name, 'father')} copied={copiedField === 'father'} />
                        </Section>
                    </div>
                )}

                {/* Academic Tab */}
                {activeTab === 'academic' && (
                    <div className="space-y-4 animate-in fade-in">
                        {/* IELTS */}
                        <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl p-4 border border-cyan-500/30">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-xl bg-cyan-500 text-white">
                                    <Languages className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-lg">IELTS / TOEFL</h3>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <ScoreCard label="Overall" value={profile.ielts_overall} accent="cyan" />
                                <ScoreCard label="Listening" value={profile.ielts_listening} accent="cyan" />
                                <ScoreCard label="Reading" value={profile.ielts_reading} accent="cyan" />
                                <ScoreCard label="Writing" value={profile.ielts_writing} accent="cyan" />
                                <ScoreCard label="Speaking" value={profile.ielts_speaking} accent="cyan" />
                            </div>
                        </div>

                        {/* SAT */}
                        <div className="bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-2xl p-4 border border-violet-500/30">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-xl bg-violet-500 text-white">
                                    <Calculator className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-lg">SAT</h3>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <ScoreCard label="Total" value={profile.sat_total} accent="violet" large />
                                <ScoreCard label="Math" value={profile.sat_math} accent="violet" />
                                <ScoreCard label="Reading" value={profile.sat_reading} accent="violet" />
                            </div>
                        </div>

                        {/* GPA */}
                        <div className="bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-2xl p-4 border border-emerald-500/30">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-xl bg-emerald-500 text-white">
                                    <GraduationCap className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-lg">GPA</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <ScoreCard label="GPA" value={profile.gpa} accent="emerald" large />
                                <ScoreCard label="Scale" value={profile.gpa_scale} accent="emerald" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Documents Tab */}
                {activeTab === 'docs' && (
                    <div className="space-y-3 animate-in fade-in">
                        {documents.length > 0 ? (
                            documents.map(doc => (
                                <div key={doc.id} className="flex items-center gap-4 bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700 hover:border-orange-500/50 transition-all group">
                                    <div className="p-3 rounded-xl bg-orange-500/20 text-orange-400">
                                        <File className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold">{doc.type}</p>
                                        <p className="text-xs text-slate-400">
                                            {new Date(doc.created_at).toLocaleDateString()} • {doc.status || 'Uploaded'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDownload(doc)}
                                        disabled={downloadingId === doc.id}
                                        className="px-4 py-2 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {downloadingId === doc.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                <Download className="w-4 h-4" />
                                                Download
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12">
                                <FileText className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                                <p className="text-slate-400">No documents uploaded yet</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Essays Tab */}
                {activeTab === 'essays' && (
                    <div className="space-y-3 animate-in fade-in">
                        {essays.length > 0 ? (
                            essays.map(essay => (
                                <div key={essay.id} className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-bold text-lg">{essay.title}</h3>
                                        <button
                                            onClick={() => handleCopy(essay.content, essay.id)}
                                            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${copiedField === essay.id
                                                ? 'bg-green-500 text-white'
                                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                }`}
                                        >
                                            {copiedField === essay.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                            {copiedField === essay.id ? 'Copied!' : 'Copy'}
                                        </button>
                                    </div>
                                    <p className="text-slate-400 text-sm line-clamp-4">{essay.content}</p>
                                    <p className="text-xs text-slate-500 mt-3">{essay.word_count || 0} words</p>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12">
                                <Award className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                                <p className="text-slate-400">No essays written yet</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
    return (
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400">
                    <Icon className="w-4 h-4" />
                </div>
                <h2 className="font-bold">{title}</h2>
            </div>
            <div className="space-y-2">{children}</div>
        </div>
    );
}

function CopyField({ icon, label, value, onCopy, copied }: { icon: React.ReactNode; label: string; value?: string | null; onCopy: () => void; copied: boolean }) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/50 group hover:bg-slate-700 transition-all">
            <div className="text-slate-400">{icon}</div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-500 uppercase font-bold">{label}</p>
                <p className="text-sm truncate">{value || <span className="text-slate-500 italic">Not provided</span>}</p>
            </div>
            <button
                onClick={onCopy}
                className={`p-2 rounded-lg transition-all ${copied
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-slate-600 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100'
                    }`}
            >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
        </div>
    );
}

function ScoreCard({ label, value, accent, large }: { label: string; value?: string | null; accent: string; large?: boolean }) {
    const colorClass = {
        cyan: 'text-cyan-400',
        violet: 'text-violet-400',
        emerald: 'text-emerald-400',
    }[accent] || 'text-orange-400';

    return (
        <div className="bg-slate-800/70 rounded-xl p-3 text-center">
            <p className={`font-black ${large ? 'text-3xl' : 'text-2xl'} ${colorClass}`}>
                {value || '—'}
            </p>
            <p className="text-xs text-slate-400 mt-1">{label}</p>
        </div>
    );
}
