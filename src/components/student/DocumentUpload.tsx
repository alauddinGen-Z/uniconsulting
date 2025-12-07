"use client";

import { useState, useRef } from "react";
import { UploadCloud, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

interface DocumentUploadProps {
    label: string;
    docType: 'IELTS' | 'TOEFL' | 'SAT' | 'GPA' | 'Passport' | 'Extracurricular';
    onUploadComplete: (url: string) => void;
    acceptedTypes?: string;
    disabled?: boolean;
}

export default function DocumentUpload({ label, docType, onUploadComplete, acceptedTypes = "application/pdf,image/*", disabled }: DocumentUploadProps) {
    const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setStatus('uploading');

        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error("You must be logged in to upload documents");
            }

            const userId = user.id;
            const fileExt = file.name.split('.').pop();
            const filePath = `${userId}/${docType}_${Date.now()}.${fileExt}`;

            // Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath);

            // Save metadata to documents table
            const { error: dbError } = await supabase
                .from('documents')
                .insert({
                    student_id: userId,
                    type: docType,
                    file_url: publicUrl,
                    status: 'Pending'
                });

            if (dbError) throw dbError;

            setStatus('success');
            onUploadComplete(publicUrl);
            toast.success(`${label} uploaded successfully`);

        } catch (error) {
            console.error('Upload failed:', error);
            setStatus('error');
            toast.error(`Failed to upload ${label}`);
        }
    };


    return (
        <div className="w-full">
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">{label}</label>

            <div
                onClick={() => !disabled && status !== 'success' && fileInputRef.current?.click()}
                className={`
          relative flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed transition-all overflow-hidden
          ${disabled ? 'border-slate-200 bg-slate-100 cursor-not-allowed opacity-60' : 'cursor-pointer'}
          ${!disabled && status === 'idle' ? 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400' : ''}
          ${status === 'uploading' ? 'border-blue-300 bg-blue-50' : ''}
          ${status === 'success' ? 'border-green-500 bg-green-50 cursor-default' : ''}
          ${status === 'error' ? 'border-red-300 bg-red-50' : ''}
        `}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={acceptedTypes}
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={status === 'success' || status === 'uploading'}
                />

                {status === 'idle' && (
                    <>
                        <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                        <p className="text-xs text-slate-500 font-medium">Click to upload or drag & drop</p>
                    </>
                )}

                {status === 'uploading' && (
                    <>
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                        <p className="text-xs text-blue-600 font-medium">Uploading {fileName}...</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                        <p className="text-xs text-green-700 font-bold">{fileName}</p>
                        <p className="text-[10px] text-green-600 uppercase mt-1">Verified</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <XCircle className="w-8 h-8 text-red-500 mb-2" />
                        <p className="text-xs text-red-600 font-medium">Upload Failed. Try Again.</p>
                    </>
                )}
            </div>
        </div>
    );
}
