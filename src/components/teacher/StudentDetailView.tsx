"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Download, FileText, Plus, Loader2, Send } from "lucide-react";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface StudentDetailViewProps {
    studentId: string;
    onBack: () => void;
}

interface Document {
    id: string;
    type: string;
    title?: string;
    status: string;
    file_url?: string;
    content?: string;
    created_at: string;
}

interface StudentProfile {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    bio?: string;
    personal_statement?: string;
    preferred_country?: string;
    preferred_university?: string;
}

export default function StudentDetailView({ studentId, onBack }: StudentDetailViewProps) {
    const [student, setStudent] = useState<StudentProfile | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRequesting, setIsRequesting] = useState(false);
    const [requestTitle, setRequestTitle] = useState("");
    const [requestType, setRequestType] = useState("Personal_Statement");

    const supabase = createClient();

    useEffect(() => {
        fetchStudentData();
    }, [studentId]);

    const fetchStudentData = async () => {
        try {
            // Fetch Profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', studentId)
                .single();

            if (profileError) throw profileError;
            setStudent(profile);

            // Fetch Documents
            const { data: docs, error: docsError } = await supabase
                .from('documents')
                .select('*')
                .eq('student_id', studentId)
                .order('created_at', { ascending: false });

            if (docsError) throw docsError;
            setDocuments(docs || []);

        } catch (error: any) {
            toast.error("Failed to load student data: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRequestEssay = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!requestTitle.trim()) return;

        try {
            const { error } = await supabase.from('documents').insert({
                student_id: studentId,
                type: requestType,
                title: requestTitle,
                status: 'Requested',
                file_url: '', // No file yet
            });

            if (error) throw error;

            toast.success("Essay requested successfully!");
            setIsRequesting(false);
            setRequestTitle("");
            fetchStudentData(); // Refresh list
        } catch (error: any) {
            toast.error("Failed to request essay: " + error.message);
        }
    };

    const handleDownload = async (doc: Document) => {
        if (!doc.file_url) {
            toast.error("No file available for download.");
            return;
        }

        // If it's a full URL, open it. If it's a path, sign it.
        // Assuming file_url is a path in 'documents' bucket for now
        try {
            const { data, error } = await supabase.storage
                .from('documents')
                .createSignedUrl(doc.file_url, 60); // 1 minute expiry

            if (error) throw error;
            window.open(data.signedUrl, '_blank');
        } catch (error) {
            // Fallback if it's just a string/link
            window.open(doc.file_url, '_blank');
        }
    };

    if (isLoading) return <div className="flex justify-center p-12"><LoadingSpinner /></div>;
    if (!student) return <div className="p-12 text-center">Student not found.</div>;

    return (
        <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-orange-600"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h1 className="text-3xl font-black font-montserrat text-slate-900">{student.full_name}</h1>
                    <p className="text-slate-500">{student.email}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden">
                {/* Left Col: Profile Info */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6 h-fit">
                    <h3 className="font-bold text-lg text-slate-800">Profile Details</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase">Phone</label>
                            <p className="font-medium text-slate-700">{student.phone || "N/A"}</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase">Bio</label>
                            <p className="text-sm text-slate-600 leading-relaxed">{student.bio || "No bio provided."}</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase">Personal Statement (Profile)</label>
                            <p className="text-sm text-slate-600 leading-relaxed line-clamp-6">{student.personal_statement || "Not written yet."}</p>
                        </div>
                    </div>

                    {/* Study Preferences */}
                    {(student.preferred_country || student.preferred_university) && (
                        <div className="pt-4 border-t border-slate-200">
                            <h4 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2">
                                <span className="text-lg">🎓</span>
                                Study Preferences
                            </h4>
                            <div className="space-y-3">
                                {student.preferred_country && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">Preferred Country</label>
                                        <p className="font-medium text-slate-700 bg-blue-50 px-3 py-2 rounded-lg inline-block">
                                            {student.preferred_country}
                                        </p>
                                    </div>
                                )}
                                {student.preferred_university && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">Preferred University</label>
                                        <p className="font-medium text-slate-700">{student.preferred_university}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Col: Documents & Essays */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-full overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg text-slate-800">Documents & Essays</h3>
                        <button
                            onClick={() => setIsRequesting(!isRequesting)}
                            className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Request Essay
                        </button>
                    </div>

                    {isRequesting && (
                        <form onSubmit={handleRequestEssay} className="mb-6 bg-orange-50 p-4 rounded-xl border border-orange-100 animate-in fade-in slide-in-from-top-2">
                            <h4 className="font-bold text-orange-800 mb-3 text-sm">Request New Document</h4>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    placeholder="Essay Title (e.g. Why Stanford?)"
                                    className="flex-1 px-4 py-2 rounded-lg border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    value={requestTitle}
                                    onChange={(e) => setRequestTitle(e.target.value)}
                                    required
                                />
                                <select
                                    className="px-4 py-2 rounded-lg border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                                    value={requestType}
                                    onChange={(e) => setRequestType(e.target.value)}
                                >
                                    <option value="Personal_Statement">Essay</option>
                                    <option value="Extracurricular">Activity List</option>
                                    <option value="Other">Other</option>
                                </select>
                                <button type="submit" className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 font-bold">
                                    Send
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {documents.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">No documents found.</div>
                        ) : (
                            documents.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-lg ${doc.status === 'Requested' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-50 text-blue-600'}`}>
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800">{doc.title || doc.type}</h4>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className={`px-2 py-0.5 rounded-full font-bold ${doc.status === 'Verified' ? 'bg-green-100 text-green-700' :
                                                    doc.status === 'Requested' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-slate-100 text-slate-500'
                                                    }`}>
                                                    {doc.status}
                                                </span>
                                                <span className="text-slate-400">{new Date(doc.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {doc.status !== 'Requested' && (
                                            <button
                                                onClick={() => handleDownload(doc)}
                                                className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
                                                title="Download"
                                            >
                                                <Download className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
