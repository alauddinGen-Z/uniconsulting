"use client";

import { useState, useEffect } from "react";
import { History, RotateCcw, X, ChevronRight, Clock, FileText, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface EssayVersion {
    id: string;
    content: string;
    word_count: number;
    version_number: number;
    created_at: string;
}

interface EssayVersionHistoryProps {
    essayId: string | null;
    currentContent: string;
    onRestore: (content: string) => void;
    onClose: () => void;
}

export default function EssayVersionHistory({
    essayId,
    currentContent,
    onRestore,
    onClose
}: EssayVersionHistoryProps) {
    const [versions, setVersions] = useState<EssayVersion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedVersion, setSelectedVersion] = useState<EssayVersion | null>(null);
    const supabase = createClient();

    useEffect(() => {
        if (essayId) {
            fetchVersions();
        }
    }, [essayId]);

    const fetchVersions = async () => {
        if (!essayId) return;

        try {
            const { data, error } = await supabase
                .from('essay_versions')
                .select('*')
                .eq('essay_id', essayId)
                .order('version_number', { ascending: false });

            if (error) throw error;
            setVersions(data || []);
        } catch (error) {
            console.error("Error fetching versions:", error);
            toast.error("Failed to load version history");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = () => {
        if (selectedVersion) {
            onRestore(selectedVersion.content);
            toast.success(`Restored version ${selectedVersion.version_number}`);
            onClose();
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getPreview = (content: string, length = 150) => {
        if (content.length <= length) return content;
        return content.substring(0, length) + '...';
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl">
                            <History className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black">Time Travel</h2>
                            <p className="text-white/80 text-sm">Restore previous versions of your essay</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Version List */}
                    <div className="w-1/3 border-r border-slate-200 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                            </div>
                        ) : versions.length === 0 ? (
                            <div className="p-6 text-center text-slate-500">
                                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                <p className="font-medium">No saved versions yet</p>
                                <p className="text-sm mt-1">Versions are created each time you save</p>
                            </div>
                        ) : (
                            <div className="p-2">
                                {versions.map((version) => (
                                    <button
                                        key={version.id}
                                        onClick={() => setSelectedVersion(version)}
                                        className={`w-full p-3 rounded-xl text-left mb-1 transition-all ${selectedVersion?.id === version.id
                                                ? 'bg-indigo-50 border-2 border-indigo-300'
                                                : 'hover:bg-slate-50 border-2 border-transparent'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-slate-900">
                                                Version {version.version_number}
                                            </span>
                                            <ChevronRight className={`w-4 h-4 transition-transform ${selectedVersion?.id === version.id ? 'rotate-90 text-indigo-500' : 'text-slate-300'
                                                }`} />
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Clock className="w-3 h-3" />
                                            {formatDate(version.created_at)}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {version.word_count} words
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Preview */}
                    <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
                        {selectedVersion ? (
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-slate-900">
                                        Preview - Version {selectedVersion.version_number}
                                    </h3>
                                    <span className="text-sm text-slate-500">
                                        {selectedVersion.word_count} words
                                    </span>
                                </div>
                                <div className="bg-white rounded-2xl p-4 border border-slate-200 max-h-[400px] overflow-y-auto">
                                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                        {selectedVersion.content}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400">
                                <div className="text-center">
                                    <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                    <p>Select a version to preview</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-white">
                    <p className="text-sm text-slate-500">
                        {versions.length} version{versions.length !== 1 ? 's' : ''} saved
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRestore}
                            disabled={!selectedVersion}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Restore This Version
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
