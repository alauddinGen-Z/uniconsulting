"use client";

import { useState } from "react";
import { Search, Loader2, Copy, Check, ExternalLink, User, Phone, Mail, Home, FileText, Users, GraduationCap, ArrowRight, Clipboard, Download, File, Languages, Calculator } from "lucide-react";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useTeacherData } from "@/contexts/TeacherDataContext";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

export default function AutomationView() {
    const { students, isLoading } = useTeacherData();
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [profileData, setProfileData] = useState<any>(null);
    const [essays, setEssays] = useState<any[]>([]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const supabase = createClient();

    // Only show approved students for automation
    const approvedStudents = students.filter(s => s.approval_status === 'approved');
    const filteredStudents = searchQuery
        ? approvedStudents.filter(s =>
            s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.preferred_university?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : approvedStudents;

    const handleSelectStudent = async (studentId: string) => {
        setSelectedStudentId(studentId);
        setIsLoadingProfile(true);

        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', studentId)
                .single();

            setProfileData(profile);

            const { data: essayData } = await supabase
                .from('essays')
                .select('*')
                .eq('student_id', studentId);

            setEssays(essayData || []);

            const { data: docData } = await supabase
                .from('documents')
                .select('*')
                .eq('student_id', studentId);

            setDocuments(docData || []);
        } catch (error) {
            console.error("Error loading profile:", error);
            toast.error("Failed to load student data");
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const handleDownload = async (doc: any) => {
        if (!profileData) return;
        setDownloadingId(doc.id);

        try {
            const { data, error } = await supabase.storage
                .from('documents')
                .download(doc.file_url.replace('documents/', ''));

            if (error) throw error;

            const studentName = profileData.full_name?.replace(/\s+/g, '_') || 'Student';
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

    const handleCopy = (text: string | null | undefined, fieldKey: string) => {
        if (!text) {
            toast.error("Nothing to copy");
            return;
        }
        navigator.clipboard.writeText(text);
        setCopiedField(fieldKey);
        toast.success("Copied!");
        setTimeout(() => setCopiedField(null), 1500);
    };

    const handleCopyAll = () => {
        if (!profileData) return;

        const allData = `${profileData.full_name || ''}
${profileData.email || ''}
${profileData.phone || ''}
${profileData.passport_number || ''}
${profileData.date_of_birth || ''}
${profileData.home_address || ''}`;

        navigator.clipboard.writeText(allData);
        toast.success("All data copied!");
    };

    const selectedStudent = approvedStudents.find(s => s.id === selectedStudentId);

    return (
        <div className="h-full flex gap-6">
            {/* Left Panel - Student Selection */}
            <div className="w-72 flex-shrink-0 bg-white rounded-2xl shadow-lg border border-slate-100 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <Users className="w-5 h-5 text-orange-500" />
                        Students
                    </h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm border-0 focus:ring-2 focus:ring-orange-500/20 outline-none"
                        />
                    </div>
                </div>

                {/* Student List */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <LoadingSpinner />
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">
                            <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No approved students</p>
                        </div>
                    ) : (
                        <div className="p-2">
                            {filteredStudents.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => handleSelectStudent(student.id)}
                                    className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all mb-1 ${selectedStudentId === student.id
                                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                                        : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${selectedStudentId === student.id
                                        ? 'bg-white/20 text-white'
                                        : 'bg-gradient-to-br from-orange-400 to-pink-500 text-white'
                                        }`}>
                                        {student.full_name?.charAt(0) || '?'}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <p className="font-bold text-sm truncate">{student.full_name || 'Unnamed'}</p>
                                        <p className={`text-xs truncate ${selectedStudentId === student.id ? 'text-white/70' : 'text-slate-400'}`}>
                                            {student.preferred_university || 'No university'}
                                        </p>
                                    </div>
                                    <ArrowRight className={`w-4 h-4 ${selectedStudentId === student.id ? 'text-white' : 'text-slate-300'}`} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
                    <span className="text-xs font-medium text-slate-500">
                        {approvedStudents.length} students ready
                    </span>
                </div>
            </div>

            {/* Right Panel - Data Display */}
            <div className="flex-1 bg-white rounded-2xl shadow-lg border border-slate-100 flex flex-col overflow-hidden">
                {!selectedStudentId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                            <Clipboard className="w-8 h-8 opacity-30" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-500 mb-2">Select a Student</h3>
                        <p className="text-sm text-center max-w-xs">Choose from the list to view and copy their data</p>
                    </div>
                ) : isLoadingProfile ? (
                    <div className="flex-1 flex items-center justify-center">
                        <LoadingSpinner />
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-orange-50 to-pink-50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-orange-500/20">
                                        {selectedStudent?.full_name?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900">{selectedStudent?.full_name}</h2>
                                        <p className="text-slate-400 text-sm flex items-center gap-2">
                                            <GraduationCap className="w-4 h-4" />
                                            {profileData?.preferred_university || 'No university set'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCopyAll}
                                        className="px-4 py-2.5 bg-white border border-slate-200 hover:border-orange-300 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors text-slate-600 hover:text-orange-600"
                                    >
                                        <Copy className="w-4 h-4" /> Copy All
                                    </button>
                                    <button
                                        onClick={() => window.open(`/teacher/companion?studentId=${selectedStudentId}`, 'StudentCompanion', 'width=400,height=700,scrollbars=yes,resizable=yes,left=100,top=100')}
                                        className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors text-white shadow-lg shadow-orange-500/20"
                                    >
                                        <ExternalLink className="w-4 h-4" /> Companion
                                    </button>
                                </div>
                            </div>

                            {/* Quick Stats */}
                            <div className="grid grid-cols-4 gap-3 mt-4">
                                <StatCard label="IELTS" value={profileData?.ielts_overall} color="cyan" />
                                <StatCard label="SAT" value={profileData?.sat_total} color="violet" />
                                <StatCard label="GPA" value={profileData?.gpa} color="emerald" />
                                <StatCard label="Docs" value={documents.length.toString()} color="orange" />
                            </div>
                        </div>

                        {/* Data Fields */}
                        <div className="flex-1 overflow-y-auto p-5">
                            <div className="grid grid-cols-2 gap-3">
                                <CopyField icon={User} label="Full Name" value={profileData?.full_name} onCopy={() => handleCopy(profileData?.full_name, 'name')} copied={copiedField === 'name'} />
                                <CopyField icon={Mail} label="Email" value={profileData?.email} onCopy={() => handleCopy(profileData?.email, 'email')} copied={copiedField === 'email'} />
                                <CopyField icon={Phone} label="Phone" value={profileData?.phone} onCopy={() => handleCopy(profileData?.phone, 'phone')} copied={copiedField === 'phone'} />
                                <CopyField icon={FileText} label="Passport" value={profileData?.passport_number} onCopy={() => handleCopy(profileData?.passport_number, 'passport')} copied={copiedField === 'passport'} />
                                <CopyField icon={Home} label="Address" value={profileData?.home_address} onCopy={() => handleCopy(profileData?.home_address, 'address')} copied={copiedField === 'address'} className="col-span-2" />

                                {/* Family */}
                                <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Family</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <CopyField icon={User} label="Mother" value={profileData?.mother_full_name} onCopy={() => handleCopy(profileData?.mother_full_name, 'mother')} copied={copiedField === 'mother'} />
                                        <CopyField icon={User} label="Father" value={profileData?.father_full_name} onCopy={() => handleCopy(profileData?.father_full_name, 'father')} copied={copiedField === 'father'} />
                                    </div>
                                </div>

                                {/* Documents */}
                                <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Documents ({documents.length})</h4>
                                    {documents.length > 0 ? (
                                        <div className="grid grid-cols-3 gap-2">
                                            {documents.map(doc => (
                                                <div key={doc.id} className="flex items-center justify-between bg-slate-50 rounded-xl p-3 group hover:bg-orange-50 transition-colors">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <File className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                                        <span className="text-sm font-medium text-slate-700 truncate">{doc.type}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDownload(doc)}
                                                        disabled={downloadingId === doc.id}
                                                        className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-orange-500 hover:border-orange-300 transition-all disabled:opacity-50"
                                                    >
                                                        {downloadingId === doc.id ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <Download className="w-3 h-3" />
                                                        )}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-xl">No documents</p>
                                    )}
                                </div>

                                {/* Essays */}
                                {essays.length > 0 && (
                                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Essays ({essays.length})</h4>
                                        <div className="space-y-2">
                                            {essays.map(essay => (
                                                <div key={essay.id} className="bg-slate-50 rounded-xl p-3 group hover:bg-orange-50 transition-colors">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-medium text-sm text-slate-700">{essay.title}</span>
                                                        <button
                                                            onClick={() => handleCopy(essay.content, essay.id)}
                                                            className={`p-1.5 rounded-lg transition-all ${copiedField === essay.id
                                                                ? 'bg-green-100 text-green-600'
                                                                : 'bg-white text-slate-400 hover:text-orange-500 border border-slate-200'
                                                                }`}
                                                        >
                                                            {copiedField === essay.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-slate-400 line-clamp-1">{essay.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value?: string | null; color: string }) {
    const colorClasses: Record<string, string> = {
        cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100',
        violet: 'bg-violet-50 text-violet-600 border-violet-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        orange: 'bg-orange-50 text-orange-600 border-orange-100',
    };
    return (
        <div className={`rounded-xl p-3 text-center border ${colorClasses[color] || colorClasses.orange}`}>
            <p className="text-xl font-black">{value || '—'}</p>
            <p className="text-xs opacity-70">{label}</p>
        </div>
    );
}

function CopyField({
    icon: Icon,
    label,
    value,
    onCopy,
    copied,
    className = ''
}: {
    icon: any;
    label: string;
    value?: string | null;
    onCopy: () => void;
    copied: boolean;
    className?: string;
}) {
    return (
        <div className={`group bg-slate-50 rounded-xl p-3 hover:bg-orange-50 transition-colors ${className}`}>
            <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Icon className="w-3 h-3" />
                    {label}
                </label>
                <button
                    onClick={onCopy}
                    className={`p-1 rounded-lg transition-all ${copied
                        ? 'bg-green-100 text-green-600'
                        : 'bg-white text-slate-300 group-hover:text-orange-500 border border-slate-200'
                        }`}
                >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
            </div>
            <p className="font-medium text-slate-700 truncate">{value || <span className="text-slate-300 italic">—</span>}</p>
        </div>
    );
}
