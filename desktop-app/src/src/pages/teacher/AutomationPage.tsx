/**
 * Automation Hub - Data Copying Page
 * 
 * Copy student data and fill application forms efficiently.
 * This is the data copying functionality (separate from AI Browser Automation).
 * 
 * @file desktop-app/src/src/pages/teacher/AutomationPage.tsx
 */

import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { supabase } from '../../lib/supabase';
import {
    Search, Loader2, Copy, Check, User, Phone, Mail, Home, FileText,
    Users, GraduationCap, ArrowRight, Clipboard, Download, File, Zap, Calendar, MapPin, Bot
} from 'lucide-react';
import AutoApplyPanel from '../../components/AutoApplyPanel';

interface Student {
    id: string;
    full_name: string;
    email: string;
    approval_status: string;
    preferred_major?: string;
    preferred_country?: string;
}

// Full profile with all database fields
interface ProfileData {
    // Basic info
    full_name?: string;
    email?: string;
    phone?: string;
    date_of_birth?: string;
    gender?: string;
    nationality?: string;

    // Passport
    passport_number?: string;
    passport_expiry?: string;

    // Address
    home_address?: string;
    city?: string;
    country?: string;
    city_of_birth?: string;

    // Academic scores
    ielts_overall?: string;
    ielts_listening?: string;
    ielts_reading?: string;
    ielts_writing?: string;
    ielts_speaking?: string;
    sat_total?: string;
    sat_math?: string;
    sat_reading?: string;
    gpa?: string;
    gpa_scale?: string;
    toefl_total?: string;

    // Preferences
    preferred_country?: string;
    preferred_university?: string;
    preferred_major?: string;

    // Family
    father_name?: string;
    father_occupation?: string;
    mother_name?: string;
    mother_occupation?: string;
}

interface Document {
    id: string;
    file_name?: string;
    file_url: string;
    type?: string;
}

interface Essay {
    id: string;
    title: string;
    content: string;
}

export default function AutomationPage() {
    const { user } = useAppStore();
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [essays, setEssays] = useState<Essay[]>([]);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'copy' | 'autoapply'>('copy');

    useEffect(() => {
        loadStudents();
    }, [user]);

    const loadStudents = async () => {
        if (!user?.id) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);

        try {
            // Use AbortSignal for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('teacher_id', user.id)
                .eq('approval_status', 'approved')
                .order('full_name')
                .abortSignal(controller.signal);

            clearTimeout(timeoutId);

            if (error) {
                console.error('[AutomationPage] Supabase error:', error);
            }
            setStudents(data || []);
        } catch (err) {
            console.error('[AutomationPage] Failed to load students:', err);
            setStudents([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectStudent = async (studentId: string) => {
        setSelectedStudentId(studentId);
        setIsLoadingProfile(true);

        try {
            // Load full profile with all fields
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', studentId)
                .single();
            setProfileData(profile);

            // Load documents
            const { data: docs } = await supabase
                .from('documents')
                .select('*')
                .eq('student_id', studentId);
            setDocuments(docs || []);

            // Load essays
            const { data: essayData } = await supabase
                .from('essays')
                .select('*')
                .eq('student_id', studentId);
            setEssays(essayData || []);
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const filteredStudents = searchQuery
        ? students.filter(s =>
            s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.preferred_major?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : students;

    const selectedStudent = students.find(s => s.id === selectedStudentId);

    const handleCopy = (text: string | undefined | null, fieldKey: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldKey);
        setTimeout(() => setCopiedField(null), 1500);
    };

    const handleCopyAll = () => {
        if (!profileData) return;
        const allData = `${profileData.full_name || ''}
${profileData.email || ''}
${profileData.phone || ''}
${profileData.passport_number || ''}
${profileData.date_of_birth || ''}
${profileData.home_address || ''}
${profileData.city || ''} ${profileData.country || ''}`;
        navigator.clipboard.writeText(allData);
        setCopiedField('all');
        setTimeout(() => setCopiedField(null), 1500);
    };

    const handleDownload = async (doc: Document) => {
        if (!profileData) return;
        setDownloadingId(doc.id);

        try {
            // Remove 'documents/' prefix if present
            const storagePath = doc.file_url.replace('documents/', '');

            const { data, error } = await supabase.storage
                .from('documents')
                .download(storagePath);

            if (error) throw error;

            // Create filename
            const studentName = profileData.full_name?.replace(/\s+/g, '_') || 'Student';
            const docType = doc.type || 'Document';
            const extension = doc.file_url.split('.').pop() || 'pdf';
            const fileName = `${studentName}_${docType}.${extension}`;

            // Trigger download
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download error:', error);
            if (doc.file_url.startsWith('http')) {
                window.open(doc.file_url, '_blank');
            }
        } finally {
            setDownloadingId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header with Tabs */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center">
                        <Zap className="w-7 h-7 text-orange-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">AUTOMATION HUB</h1>
                        <p className="text-slate-500">Copy student data and fill application forms efficiently.</p>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                    <button
                        onClick={() => setActiveTab('copy')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'copy'
                            ? 'bg-white text-orange-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Clipboard className="w-4 h-4 inline-block mr-2" />
                        Copy Data
                    </button>
                    <button
                        onClick={() => setActiveTab('autoapply')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'autoapply'
                            ? 'bg-white text-purple-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Bot className="w-4 h-4 inline-block mr-2" />
                        Auto-Apply
                    </button>
                </div>
            </div>

            <div className="flex gap-6 h-[calc(100vh-200px)]">
                {/* Left Panel - Student Selection */}
                <div className="w-72 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
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

                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
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
                                            ? 'bg-orange-500 text-white shadow-lg'
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
                                            <p className="font-bold text-sm truncate">{student.full_name}</p>
                                            <p className={`text-xs truncate ${selectedStudentId === student.id ? 'text-white/70' : 'text-slate-400'}`}>
                                                {student.preferred_major || 'No major'}
                                            </p>
                                        </div>
                                        <ArrowRight className={`w-4 h-4 ${selectedStudentId === student.id ? 'text-white' : 'text-slate-300'}`} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
                        <span className="text-xs font-medium text-slate-500">
                            {students.length} students ready
                        </span>
                    </div>
                </div>

                {/* Right Panel - Data Display or Auto-Apply */}
                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                    {activeTab === 'autoapply' ? (
                        <AutoApplyPanel studentData={profileData ? { id: selectedStudentId || '', ...profileData } : null} />
                    ) : !selectedStudentId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                <Clipboard className="w-8 h-8 opacity-30" />
                            </div>
                            <h3 className="font-bold text-lg text-slate-500 mb-2">Select a Student</h3>
                            <p className="text-sm text-center max-w-xs">Choose from the list to view and copy their data</p>
                        </div>
                    ) : isLoadingProfile ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-orange-50 to-pink-50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-xl font-bold text-white shadow-lg">
                                            {selectedStudent?.full_name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900">{selectedStudent?.full_name}</h2>
                                            <p className="text-slate-400 text-sm flex items-center gap-2">
                                                <GraduationCap className="w-4 h-4" />
                                                {profileData?.preferred_major || 'No major set'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCopyAll}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors ${copiedField === 'all'
                                            ? 'bg-green-100 text-green-600'
                                            : 'bg-white border border-slate-200 hover:border-orange-300 text-slate-600 hover:text-orange-600'
                                            }`}
                                    >
                                        {copiedField === 'all' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        Copy All
                                    </button>
                                </div>

                                {/* Quick Stats */}
                                <div className="grid grid-cols-4 gap-3 mt-4">
                                    <StatCard label="GPA" value={profileData?.gpa} color="emerald" />
                                    <StatCard label="SAT" value={profileData?.sat_total} color="violet" />
                                    <StatCard label="IELTS" value={profileData?.ielts_overall} color="cyan" />
                                    <StatCard label="Docs" value={documents.length.toString()} color="orange" />
                                </div>
                            </div>

                            {/* Data Fields */}
                            <div className="flex-1 overflow-y-auto p-5">
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Basic Info */}
                                    <CopyField icon={User} label="Full Name" value={profileData?.full_name} onCopy={() => handleCopy(profileData?.full_name, 'name')} copied={copiedField === 'name'} />
                                    <CopyField icon={Mail} label="Email" value={profileData?.email} onCopy={() => handleCopy(profileData?.email, 'email')} copied={copiedField === 'email'} />
                                    <CopyField icon={Phone} label="Phone" value={profileData?.phone} onCopy={() => handleCopy(profileData?.phone, 'phone')} copied={copiedField === 'phone'} />
                                    <CopyField icon={FileText} label="Passport" value={profileData?.passport_number} onCopy={() => handleCopy(profileData?.passport_number, 'passport')} copied={copiedField === 'passport'} />
                                    <CopyField icon={Calendar} label="Date of Birth" value={profileData?.date_of_birth} onCopy={() => handleCopy(profileData?.date_of_birth, 'dob')} copied={copiedField === 'dob'} />
                                    <CopyField icon={MapPin} label="Nationality" value={profileData?.nationality} onCopy={() => handleCopy(profileData?.nationality, 'nationality')} copied={copiedField === 'nationality'} />
                                    <CopyField icon={Home} label="Address" value={profileData?.home_address} onCopy={() => handleCopy(profileData?.home_address, 'address')} copied={copiedField === 'address'} className="col-span-2" />

                                    {/* Family */}
                                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Family</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <CopyField icon={User} label="Mother" value={profileData?.mother_name} onCopy={() => handleCopy(profileData?.mother_name, 'mother')} copied={copiedField === 'mother'} />
                                            <CopyField icon={User} label="Father" value={profileData?.father_name} onCopy={() => handleCopy(profileData?.father_name, 'father')} copied={copiedField === 'father'} />
                                        </div>
                                    </div>

                                    {/* Academic Scores */}
                                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Academic Scores</h4>
                                        <div className="grid grid-cols-3 gap-3">
                                            <CopyField icon={GraduationCap} label="GPA" value={profileData?.gpa} onCopy={() => handleCopy(profileData?.gpa, 'gpa')} copied={copiedField === 'gpa'} />
                                            <CopyField icon={GraduationCap} label="SAT Total" value={profileData?.sat_total} onCopy={() => handleCopy(profileData?.sat_total, 'sat')} copied={copiedField === 'sat'} />
                                            <CopyField icon={GraduationCap} label="TOEFL" value={profileData?.toefl_total} onCopy={() => handleCopy(profileData?.toefl_total, 'toefl')} copied={copiedField === 'toefl'} />
                                            <CopyField icon={GraduationCap} label="IELTS Overall" value={profileData?.ielts_overall} onCopy={() => handleCopy(profileData?.ielts_overall, 'ielts')} copied={copiedField === 'ielts'} />
                                            <CopyField icon={GraduationCap} label="IELTS Speaking" value={profileData?.ielts_speaking} onCopy={() => handleCopy(profileData?.ielts_speaking, 'ielts_s')} copied={copiedField === 'ielts_s'} />
                                            <CopyField icon={GraduationCap} label="IELTS Writing" value={profileData?.ielts_writing} onCopy={() => handleCopy(profileData?.ielts_writing, 'ielts_w')} copied={copiedField === 'ielts_w'} />
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
                                                            <span className="text-sm font-medium text-slate-700 truncate">{doc.type || doc.file_name || 'Document'}</span>
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
    icon: React.ElementType;
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
