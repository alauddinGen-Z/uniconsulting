"use client";

import { useState, useEffect } from "react";
import { Copy, Check, ExternalLink, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

interface DataSidecarProps {
    studentId: string | null;
}

interface StudentProfile {
    full_name: string;
    email: string;
    phone: string;
    passport_number: string;
    home_address: string;
    mother_full_name: string;
    father_full_name: string;
}

interface StudentDocument {
    id: string;
    name: string;
    content: string;
    type: string;
}

export default function DataSidecar({ studentId }: DataSidecarProps) {
    const [activeTab, setActiveTab] = useState<'identity' | 'family' | 'essays'>('identity');
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [documents, setDocuments] = useState<StudentDocument[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        if (!studentId) {
            setProfile(null);
            setDocuments([]);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch Profile
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', studentId)
                    .single();

                if (profileError) throw profileError;
                setProfile(profileData);

                // Fetch Documents (PDFs)
                const { data: docData, error: docError } = await supabase
                    .from('documents')
                    .select('*')
                    .eq('student_id', studentId);

                if (docError) throw docError;

                // Fetch Essays (Text)
                const { data: essayData, error: essayError } = await supabase
                    .from('essays')
                    .select('*')
                    .eq('student_id', studentId);

                if (essayError) throw essayError;

                // Combine them
                const combinedDocs: StudentDocument[] = [
                    ...(docData || []).map((d: any) => ({
                        id: d.id,
                        name: d.type,
                        content: "", // PDFs don't have text content easily accessible
                        type: d.type
                    })),
                    ...(essayData || []).map((e: any) => ({
                        id: e.id,
                        name: e.title,
                        content: e.content,
                        type: 'Essay'
                    }))
                ];

                setDocuments(combinedDocs);

            } catch (error) {
                console.error("Error fetching student data:", error);
                toast.error("Failed to load student data");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [studentId]);

    const handleCopy = (text: string | null | undefined, fieldKey: string) => {
        if (!text) {
            toast.error("Nothing to copy");
            return;
        }
        navigator.clipboard.writeText(text);
        setCopiedField(fieldKey);
        toast.success("Copied!");
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleLaunchPortal = () => {
        window.open('https://www.commonapp.org/', '_blank', 'width=1200,height=800');
    };

    if (!studentId) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-8 text-center">
                <p className="font-medium">Select a student from the queue to view data.</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-white">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white border-l border-slate-200">
            {/* Connection Hub Header */}
            <div className="p-6 bg-slate-900 text-white flex flex-col gap-4">
                <div>
                    <h2 className="text-xl font-bold font-montserrat">Ready to Apply</h2>
                    <p className="text-slate-400 text-sm">Target: Common App</p>
                </div>

                <button
                    onClick={handleLaunchPortal}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <ExternalLink className="w-5 h-5" />
                    Launch University Portal
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-white">
                {['identity', 'family', 'essays'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === tab
                            ? 'text-orange-600 border-orange-500 bg-orange-50'
                            : 'text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Data Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                <div className="space-y-4">
                    {activeTab === 'identity' && profile && (
                        <>
                            <DataItem label="Full Name" value={profile.full_name} onCopy={() => handleCopy(profile.full_name, 'full_name')} copied={copiedField === 'full_name'} />
                            <DataItem label="Email" value={profile.email} onCopy={() => handleCopy(profile.email, 'email')} copied={copiedField === 'email'} />
                            <DataItem label="Phone" value={profile.phone} onCopy={() => handleCopy(profile.phone, 'phone')} copied={copiedField === 'phone'} />
                            <DataItem label="Passport Number" value={profile.passport_number} onCopy={() => handleCopy(profile.passport_number, 'passport_number')} copied={copiedField === 'passport_number'} />
                            <DataItem label="Home Address" value={profile.home_address} onCopy={() => handleCopy(profile.home_address, 'home_address')} copied={copiedField === 'home_address'} />
                        </>
                    )}

                    {activeTab === 'family' && profile && (
                        <>
                            <DataItem label="Mother's Name" value={profile.mother_full_name} onCopy={() => handleCopy(profile.mother_full_name, 'mother_full_name')} copied={copiedField === 'mother_full_name'} />
                            <DataItem label="Father's Name" value={profile.father_full_name} onCopy={() => handleCopy(profile.father_full_name, 'father_full_name')} copied={copiedField === 'father_full_name'} />
                        </>
                    )}

                    {activeTab === 'essays' && (
                        <div className="space-y-6">
                            {documents.filter(d => d.type === 'Essay').map((doc) => (
                                <div key={doc.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-orange-500" />
                                            <span className="font-bold text-slate-700 text-sm">{doc.name}</span>
                                        </div>
                                        <button
                                            onClick={() => handleCopy(doc.content, doc.id)}
                                            className={`p-2 rounded-lg transition-colors ${copiedField === doc.id ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400 hover:text-orange-500'}`}
                                        >
                                            {copiedField === doc.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 font-mono text-xs leading-relaxed max-h-40 overflow-y-auto border border-slate-100">
                                        {doc.content}
                                    </div>
                                </div>
                            ))}
                            {documents.filter(d => d.type === 'Essay').length === 0 && (
                                <p className="text-center text-slate-400 text-sm py-8">No essays found for this student.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function DataItem({ label, value, onCopy, copied }: { label: string, value: string | null | undefined, onCopy: () => void, copied: boolean }) {
    return (
        <div className="group bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-orange-200 transition-colors">
            <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
                <button
                    onClick={onCopy}
                    className={`p-1.5 rounded-md transition-all ${copied ? 'bg-green-100 text-green-600' : 'text-slate-300 hover:text-orange-500 hover:bg-orange-50 opacity-0 group-hover:opacity-100'}`}
                >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
            </div>
            <div className="font-medium text-slate-800 break-words">
                {value || <span className="text-slate-300 italic">Not set</span>}
            </div>
        </div>
    );
}
