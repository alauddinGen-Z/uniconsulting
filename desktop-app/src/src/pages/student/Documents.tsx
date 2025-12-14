import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import { supabase } from '../../lib/supabase';
import { FileText, Upload, Trash2, Loader2, Eye, Download, File, Image } from 'lucide-react';

interface Document {
    id: string;
    file_name: string;
    file_type: string;
    file_url: string;
    document_type: string;
    created_at: string;
}

export default function StudentDocumentsPage() {
    const { user } = useAppStore();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadDocuments();
    }, [user]);

    const loadDocuments = async () => {
        if (!user?.id) return;
        setIsLoading(true);

        const { data } = await supabase
            .from('documents')
            .select('*')
            .eq('student_id', user.id)
            .order('created_at', { ascending: false });

        setDocuments(data || []);
        setIsLoading(false);
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user?.id) return;

        setIsUploading(true);
        setUploadProgress(0);

        try {
            // Simulate progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => Math.min(prev + 10, 90));
            }, 200);

            // Upload to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(fileName, file);

            clearInterval(progressInterval);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('documents')
                .getPublicUrl(fileName);

            // Save to database
            const { error: dbError } = await supabase
                .from('documents')
                .insert({
                    student_id: user.id,
                    file_name: file.name,
                    file_type: file.type,
                    file_url: urlData.publicUrl,
                    document_type: detectDocumentType(file.name),
                });

            if (dbError) throw dbError;

            setUploadProgress(100);
            await loadDocuments();
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const detectDocumentType = (fileName: string): string => {
        const lower = fileName.toLowerCase();
        if (lower.includes('passport')) return 'passport';
        if (lower.includes('transcript')) return 'transcript';
        if (lower.includes('recommendation') || lower.includes('lor')) return 'recommendation';
        if (lower.includes('essay')) return 'essay';
        return 'other';
    };

    const handleDelete = async (doc: Document) => {
        if (!confirm('Delete this document?')) return;

        // Extract path from URL
        const path = doc.file_url.split('/documents/')[1];
        if (path) {
            await supabase.storage.from('documents').remove([path]);
        }

        await supabase.from('documents').delete().eq('id', doc.id);
        await loadDocuments();
    };

    const getFileIcon = (type: string) => {
        if (type.startsWith('image/')) return <Image className="w-5 h-5" />;
        return <File className="w-5 h-5" />;
    };

    const getDocumentTypeColor = (type: string) => {
        switch (type) {
            case 'passport': return 'bg-blue-100 text-blue-700';
            case 'transcript': return 'bg-green-100 text-green-700';
            case 'recommendation': return 'bg-purple-100 text-purple-700';
            case 'essay': return 'bg-orange-100 text-orange-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-orange-500" />
                        My Documents
                    </h1>
                    <p className="text-slate-500">Upload and manage your application documents</p>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-pink-600 transition disabled:opacity-50 flex items-center gap-2"
                >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Upload Document
                </button>
            </div>

            {/* Upload Progress */}
            {isUploading && (
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                        <div className="flex-1">
                            <div className="text-sm font-medium">Uploading...</div>
                            <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                                <div
                                    className="bg-orange-500 h-2 rounded-full transition-all"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Document Categories */}
            <div className="grid grid-cols-4 gap-4">
                {['passport', 'transcript', 'recommendation', 'essay'].map(type => {
                    const count = documents.filter(d => d.document_type === type).length;
                    return (
                        <div key={type} className={`p-4 rounded-xl ${getDocumentTypeColor(type)}`}>
                            <div className="text-2xl font-bold">{count}</div>
                            <div className="text-sm capitalize">{type}s</div>
                        </div>
                    );
                })}
            </div>

            {/* Documents List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
                {documents.length === 0 ? (
                    <div className="p-12 text-center">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No documents yet</h3>
                        <p className="text-slate-500">Upload your first document to get started</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {documents.map((doc) => (
                            <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-slate-50">
                                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                                    {getFileIcon(doc.file_type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-slate-900 truncate">{doc.file_name}</div>
                                    <div className="text-sm text-slate-500">
                                        {new Date(doc.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDocumentTypeColor(doc.document_type)}`}>
                                    {doc.document_type}
                                </span>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={doc.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </a>
                                    <a
                                        href={doc.file_url}
                                        download
                                        className="p-2 text-slate-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition"
                                    >
                                        <Download className="w-4 h-4" />
                                    </a>
                                    <button
                                        onClick={() => handleDelete(doc)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
