"use client";

import { useState, useEffect } from "react";
import { Folder, Upload, FileText, File, Trash2, Loader2, Check, X, Plus, Camera, Award, FileCheck, Heart, GraduationCap, Languages, FilePlus, Banknote, Users, Calculator, Shield, FileWarning, AlertTriangle, Sparkles, ScanLine } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { API_ENDPOINTS } from "@/lib/config";

interface Document {
    id: string;
    type: string;
    file_url: string;
    status: string;
    created_at: string;
}

const documentCategories = [
    // Core Identity
    { id: 'passport', label: 'Passport', icon: FileCheck, color: 'from-blue-400 to-blue-600', bgColor: 'bg-blue-50', description: 'Passport scan or photo', required: true },
    { id: 'portrait', label: 'Portrait Photo', icon: Camera, color: 'from-purple-400 to-purple-600', bgColor: 'bg-purple-50', description: '3x4 photo for applications', required: true },

    // Academic
    { id: 'gpa', label: 'GPA / Transcript', icon: GraduationCap, color: 'from-emerald-400 to-emerald-600', bgColor: 'bg-emerald-50', description: 'High school records', required: true },
    { id: 'ielts', label: 'IELTS / TOEFL', icon: Languages, color: 'from-cyan-400 to-cyan-600', bgColor: 'bg-cyan-50', description: 'Language test scores', required: true },
    { id: 'sat', label: 'SAT / ACT', icon: Calculator, color: 'from-violet-400 to-violet-600', bgColor: 'bg-violet-50', description: 'Standardized test scores', required: false },
    { id: 'certificate', label: 'Certificates', icon: Award, color: 'from-amber-400 to-amber-600', bgColor: 'bg-amber-50', description: 'Academic awards & achievements', required: false },

    // Financial
    { id: 'bank_statement', label: 'Bank Statement', icon: Banknote, color: 'from-green-400 to-green-600', bgColor: 'bg-green-50', description: 'Proof of funds (max 3 months old)', required: true, hasExpiry: true },
    { id: 'sponsor_letter', label: 'Sponsor Letter', icon: Users, color: 'from-teal-400 to-teal-600', bgColor: 'bg-teal-50', description: 'Affidavit of financial support', required: false },

    // Recommendations
    { id: 'recommendation', label: 'Recommendations', icon: FileText, color: 'from-indigo-400 to-indigo-600', bgColor: 'bg-indigo-50', description: 'Teacher recommendation letters', required: true },

    // Visa & Legal
    { id: 'medical', label: 'Medical Certificate', icon: Heart, color: 'from-rose-400 to-rose-600', bgColor: 'bg-rose-50', description: 'Health examination report', required: false },
    { id: 'police_clearance', label: 'Police Clearance', icon: Shield, color: 'from-slate-400 to-slate-600', bgColor: 'bg-slate-50', description: 'Criminal background check', required: false },
    { id: 'visa_form', label: 'Visa Documents', icon: FileWarning, color: 'from-orange-400 to-orange-600', bgColor: 'bg-orange-50', description: 'I-20, CoE, PAL, etc.', required: false },
];

export default function DocumentsPage({ isLocked }: { isLocked?: boolean }) {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [showCustomUpload, setShowCustomUpload] = useState(false);
    const [customDocName, setCustomDocName] = useState("");

    // OCR State
    const [scanning, setScanning] = useState<string | null>(null);
    const [ocrResult, setOcrResult] = useState<{ text: string; structuredData?: any; extractedScores?: Record<string, string> } | null>(null);
    const [showOcrModal, setShowOcrModal] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('documents')
                .select('*')
                .eq('student_id', user.id)
                .order('created_at', { ascending: false });

            setDocuments(data || []);
        } catch (error) {
            console.error("Error fetching documents:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpload = async (categoryId: string, file: File, customName?: string) => {
        if (isLocked) {
            toast.error("Your account needs to be approved first");
            return;
        }

        setUploadingCategory(categoryId);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const fileExt = file.name.split('.').pop();
            const docType = customName || categoryId;
            const fileName = `${user.id}/${docType.replace(/\\s+/g, '_')}_${Date.now()}.${fileExt}`;

            console.log("Uploading to storage:", fileName);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('documents')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            console.log("Upload result:", { uploadData, uploadError });

            if (uploadError) {
                console.error("Storage error:", uploadError);
                throw new Error(uploadError.message || JSON.stringify(uploadError));
            }

            const { error: dbError } = await supabase
                .from('documents')
                .insert({
                    student_id: user.id,
                    type: docType,
                    file_url: `documents/${fileName}`,
                    status: 'Pending'
                });

            if (dbError) throw dbError;

            const label = customName || documentCategories.find(c => c.id === categoryId)?.label || categoryId;
            toast.success(`${label} uploaded successfully!`);
            fetchDocuments();
            setShowCustomUpload(false);
            setCustomDocName("");

            // Auto-extract scores for academic documents using AI
            const academicDocTypes = ['gpa', 'ielts', 'sat', 'toefl'];
            console.log("Checking if should extract scores for:", categoryId, "includes:", academicDocTypes.includes(categoryId.toLowerCase()));

            if (academicDocTypes.includes(categoryId.toLowerCase())) {
                toast.loading("✨ AI is extracting scores...", { id: "ai-extract" });

                try {
                    // Convert file to base64 for processing (works with private buckets)
                    const reader = new FileReader();
                    const base64Promise = new Promise<{ base64: string, mimeType: string }>((resolve, reject) => {
                        reader.onload = () => {
                            const result = reader.result as string;
                            // Get MIME type from data URL
                            const mimeType = result.split(';')[0].split(':')[1] || 'image/jpeg';
                            // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
                            const base64 = result.split(',')[1];
                            resolve({ base64, mimeType });
                        };
                        reader.onerror = reject;
                    });
                    reader.readAsDataURL(file);
                    const { base64: imageBase64, mimeType: detectedMimeType } = await base64Promise;

                    console.log("Got base64, length:", imageBase64.length, "MIME type:", detectedMimeType);

                    // Call OCR with document type for specialized extraction
                    const response = await fetch(API_ENDPOINTS.DOCUMENT_OCR, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            imageBase64: imageBase64,
                            documentType: categoryId.toLowerCase(),
                            mimeType: detectedMimeType
                        })
                    });

                    const result = await response.json();
                    console.log("OCR API full result:", JSON.stringify(result, null, 2));

                    if (result.success && result.extractedScores) {
                        // Update profiles table with extracted scores
                        const scoresToUpdate: Record<string, string> = {};
                        const scores = result.extractedScores;

                        console.log("Raw extracted scores from API:", scores);
                        console.log("Score keys:", Object.keys(scores));

                        // Only include non-null scores
                        Object.entries(scores).forEach(([key, value]) => {
                            console.log(`Processing score: ${key} = ${value} (type: ${typeof value})`);
                            if (value !== null && value !== undefined && value !== '' && value !== 'null') {
                                scoresToUpdate[key] = String(value);
                            }
                        });

                        console.log("Final scores to update:", scoresToUpdate);
                        console.log("Number of scores to save:", Object.keys(scoresToUpdate).length);

                        if (Object.keys(scoresToUpdate).length > 0) {
                            console.log("Updating profile for user:", user.id);
                            const { data: updateData, error: updateError } = await supabase
                                .from('profiles')
                                .update(scoresToUpdate)
                                .eq('id', user.id)
                                .select();

                            console.log("Profile update result - data:", updateData, "error:", updateError);

                            if (!updateError) {
                                toast.success("✨ AI extracted and saved your scores!", { id: "ai-extract" });
                                // Dispatch custom event so Academic tab can refresh
                                window.dispatchEvent(new CustomEvent('scores-updated'));
                            } else {
                                console.error("Error updating scores:", updateError);
                                toast.error("Scores extracted but failed to save: " + (updateError.message || JSON.stringify(updateError)), { id: "ai-extract" });
                            }
                        } else {
                            toast.dismiss("ai-extract");
                            toast.info("No scores could be extracted from the document");
                        }
                    } else {
                        toast.dismiss("ai-extract");
                        console.log("OCR result did not have extractedScores. Success:", result.success, "Has extractedScores:", !!result.extractedScores);
                        if (result.error) {
                            console.error("OCR error:", result.error);
                            toast.error("AI extraction failed: " + result.error);
                        } else if (!result.extractedScores) {
                            toast.info("Document scanned, but no scores were detected");
                        }
                    }
                } catch (ocrError: any) {
                    console.error("OCR error:", ocrError);
                    toast.dismiss("ai-extract");
                    toast.error("Failed to extract scores: " + (ocrError?.message || "Unknown error"));
                }
            }
        } catch (error: any) {
            console.error("Upload error details:", error);
            toast.error(error.message || "Failed to upload document");
        } finally {
            setUploadingCategory(null);
        }
    };

    const handleDelete = async (docId: string, fileUrl: string) => {
        if (isLocked) {
            toast.error("Your account needs to be approved first");
            return;
        }

        try {
            const filePath = fileUrl.replace('documents/', '');
            await supabase.storage.from('documents').remove([filePath]);
            await supabase.from('documents').delete().eq('id', docId);

            toast.success("Document deleted");
            fetchDocuments();
        } catch (error) {
            toast.error("Failed to delete document");
        }
    };

    // OCR Scan Function
    const scanDocument = async (doc: Document) => {
        setScanning(doc.id);
        try {
            // Download the file from storage
            const filePath = doc.file_url.replace('documents/', '');
            console.log("Downloading file:", filePath);

            const { data: fileData, error: downloadError } = await supabase.storage
                .from('documents')
                .download(filePath);

            if (downloadError || !fileData) {
                console.error("Download error:", downloadError);
                toast.error("Failed to download document for scanning");
                return;
            }

            // Convert blob to base64
            const reader = new FileReader();
            const base64Promise = new Promise<{ base64: string, mimeType: string }>((resolve, reject) => {
                reader.onload = () => {
                    const result = reader.result as string;
                    // Result format: "data:application/pdf;base64,..."
                    const mimeType = result.split(';')[0].split(':')[1] || 'application/octet-stream';
                    const base64 = result.split(',')[1];
                    resolve({ base64, mimeType });
                };
                reader.onerror = reject;
            });
            reader.readAsDataURL(fileData);
            const { base64: imageBase64, mimeType } = await base64Promise;

            console.log("Got base64, length:", imageBase64.length, "MIME type:", mimeType);

            // Get session for auth
            const { data: { session } } = await supabase.auth.getSession();

            // Determine document type from the doc.type field
            const docType = doc.type.toLowerCase();

            console.log("Calling OCR API with docType:", docType, "mimeType:", mimeType);

            // Build headers - only include auth if session exists
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            // Check file size - warn if large (> 5MB base64 is ~6.67MB file)
            const fileSizeMB = (imageBase64.length * 0.75) / (1024 * 1024);
            console.log("File size (approx):", fileSizeMB.toFixed(2), "MB");

            if (fileSizeMB > 10) {
                toast.error("File too large for OCR (max ~10MB). Please compress the image or use a smaller file.");
                return;
            }

            let response;
            try {
                response = await fetch(API_ENDPOINTS.DOCUMENT_OCR, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        imageBase64: imageBase64,
                        documentType: docType,
                        mimeType: mimeType
                    })
                });
            } catch (fetchError: any) {
                console.error("Fetch error:", fetchError);
                toast.error("Network error - please check your connection and try again. If the issue persists, restart the dev server.");
                return;
            }

            if (!response.ok) {
                let errorBody = "";
                try {
                    errorBody = await response.text();
                    console.error("Response not OK:", response.status, response.statusText, "Body:", errorBody);
                } catch (e) {
                    console.error("Response not OK:", response.status, response.statusText, "Could not read body");
                }
                toast.error(`Server error (${response.status}): ${errorBody.substring(0, 100) || "Unknown error"}`);
                return;
            }

            const result = await response.json();
            console.log("OCR result:", result);

            if (result.success) {
                setOcrResult({
                    text: result.text || "No text found",
                    structuredData: result.structuredData,
                    extractedScores: result.extractedScores
                });
                setShowOcrModal(true);
                toast.success("Document scanned successfully!");

                // If scores were extracted, offer to save them
                if (result.extractedScores && Object.keys(result.extractedScores).length > 0) {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const scoresToUpdate: Record<string, string> = {};
                        Object.entries(result.extractedScores).forEach(([key, value]) => {
                            console.log(`scanDocument - Processing score: ${key} = ${value}`);
                            if (value !== null && value !== undefined && value !== '' && value !== 'null') {
                                scoresToUpdate[key] = String(value);
                            }
                        });

                        console.log("scanDocument - Scores to save:", scoresToUpdate);

                        if (Object.keys(scoresToUpdate).length > 0) {
                            const { data: updateData, error: updateError } = await supabase
                                .from('profiles')
                                .update(scoresToUpdate)
                                .eq('id', user.id)
                                .select();

                            console.log("scanDocument - Save result:", { updateData, updateError });

                            if (!updateError) {
                                toast.success("✨ Scores auto-saved to your profile!");
                                // Dispatch custom event so Academic tab can refresh
                                window.dispatchEvent(new CustomEvent('scores-updated'));
                            } else {
                                console.error("scanDocument - Save error:", updateError);
                                toast.error("Failed to save scores: " + (updateError.message || JSON.stringify(updateError)));
                            }
                        }
                    }
                }
            } else {
                console.error("OCR error:", result.error);
                toast.error(result.error || "Failed to scan document");
            }
        } catch (error: any) {
            console.error("Scan error:", error);
            toast.error(error?.message || "Failed to scan document. Please try again.");
        } finally {
            setScanning(null);
        }
    };

    const getDocsByCategory = (categoryId: string) => {
        return documents.filter(d => d.type === categoryId);
    };

    const getOtherDocs = () => {
        const standardTypes = documentCategories.map(c => c.id);
        return documents.filter(d => !standardTypes.includes(d.type));
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-pink-500 text-white mb-4 shadow-lg shadow-orange-500/30">
                    <Folder className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Document Center</h2>
                <p className="text-slate-400 max-w-md mx-auto">Upload and organize all your application documents in one place</p>
            </div>

            {isLocked && (
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-2xl p-4 text-center">
                    <span className="text-yellow-700 font-medium">⚠️ Document uploads will be enabled once your teacher approves your account.</span>
                </div>
            )}

            {/* Progress Bar - Required Documents Only */}
            <div className="bg-slate-50 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-slate-700">Required Documents</span>
                    <span className="text-sm font-bold text-orange-500">
                        {documentCategories.filter(c => c.required && getDocsByCategory(c.id).length > 0).length}/{documentCategories.filter(c => c.required).length} complete
                    </span>
                </div>
                <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-orange-400 to-pink-500 rounded-full transition-all duration-500"
                        style={{ width: `${(documentCategories.filter(c => c.required && getDocsByCategory(c.id).length > 0).length / documentCategories.filter(c => c.required).length) * 100}%` }}
                    />
                </div>
            </div>

            {/* Document Categories Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {documentCategories.map((category) => {
                    const categoryDocs = getDocsByCategory(category.id);
                    const hasDocument = categoryDocs.length > 0;
                    const Icon = category.icon;
                    const isSelected = selectedCategory === category.id;

                    return (
                        <div
                            key={category.id}
                            className={`relative rounded-2xl border-2 transition-all duration-300 overflow-hidden ${isSelected
                                ? 'border-orange-400 shadow-xl shadow-orange-500/20 scale-[1.02]'
                                : hasDocument
                                    ? 'border-green-200 bg-green-50/50'
                                    : category.required && !hasDocument
                                        ? 'border-orange-100 hover:border-orange-200 hover:shadow-lg bg-orange-50/30'
                                        : 'border-slate-100 hover:border-slate-200 hover:shadow-lg bg-white'
                                }`}
                        >
                            {/* Badges */}
                            <div className="absolute top-3 right-3 z-10 flex gap-1">
                                {category.required && !hasDocument && (
                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-bold rounded-full">
                                        Required
                                    </span>
                                )}
                                {hasDocument && (
                                    <div className="p-1.5 bg-green-500 rounded-full shadow-lg shadow-green-500/30">
                                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                    </div>
                                )}
                            </div>

                            {/* Folder Header */}
                            <button
                                onClick={() => setSelectedCategory(isSelected ? null : category.id)}
                                className="w-full p-4 text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${category.color} text-white shadow-lg`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-sm text-slate-900">{category.label}</h3>
                                        <p className="text-[10px] text-slate-400 truncate">{category.description}</p>
                                    </div>
                                </div>
                            </button>

                            {/* Expanded Content */}
                            {isSelected && (
                                <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                    {/* Existing Documents */}
                                    {categoryDocs.length > 0 && (
                                        <div className="space-y-2">
                                            {categoryDocs.map(doc => (
                                                <div key={doc.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 group hover:border-slate-200 transition-all">
                                                    <div className={`p-2 rounded-lg ${category.bgColor}`}>
                                                        <File className="w-4 h-4 text-slate-500" />
                                                    </div>
                                                    <span className="flex-1 text-sm text-slate-600 truncate font-medium">
                                                        {new Date(doc.created_at).toLocaleDateString()}
                                                    </span>

                                                    {/* AI Scan Button */}
                                                    <button
                                                        onClick={() => scanDocument(doc)}
                                                        disabled={scanning === doc.id}
                                                        className="p-2 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all disabled:opacity-100"
                                                        title="Scan with AI"
                                                    >
                                                        {scanning === doc.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Sparkles className="w-4 h-4" />
                                                        )}
                                                    </button>

                                                    <button
                                                        onClick={() => handleDelete(doc.id, doc.file_url)}
                                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Upload Button */}
                                    <label className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isLocked
                                        ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-50'
                                        : 'border-slate-200 hover:border-orange-400 hover:bg-orange-50'
                                        }`}>
                                        {uploadingCategory === category.id ? (
                                            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                                        ) : (
                                            <>
                                                <Upload className="w-5 h-5 text-slate-400" />
                                                <span className="text-sm font-medium text-slate-500">Upload File</span>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            className="hidden"
                                            disabled={isLocked || uploadingCategory === category.id}
                                            accept={category.id === 'portrait' ? 'image/*' : '.pdf,.jpg,.jpeg,.png'}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleUpload(category.id, file);
                                                e.target.value = '';
                                            }}
                                        />
                                    </label>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Other Documents Card */}
                <div
                    className={`relative rounded-2xl border-2 transition-all duration-300 overflow-hidden ${showCustomUpload
                        ? 'border-orange-400 shadow-xl shadow-orange-500/20 col-span-2 lg:col-span-3'
                        : 'border-dashed border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 bg-slate-50'
                        }`}
                >
                    <button
                        onClick={() => setShowCustomUpload(!showCustomUpload)}
                        className="w-full p-5 text-left"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-slate-400 to-slate-600 text-white shadow-lg">
                                <FilePlus className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-900">Other Documents</h3>
                                <p className="text-xs text-slate-400">Add custom document types</p>
                            </div>
                            {getOtherDocs().length > 0 && (
                                <div className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                                    {getOtherDocs().length}
                                </div>
                            )}
                        </div>
                    </button>

                    {/* Custom Upload Form */}
                    {showCustomUpload && (
                        <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                            {/* Existing Other Documents */}
                            {getOtherDocs().length > 0 && (
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                    {getOtherDocs().map(doc => (
                                        <div key={doc.id} className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-100 group hover:border-slate-200 transition-all">
                                            <File className="w-4 h-4 text-slate-400" />
                                            <span className="flex-1 text-sm text-slate-600 truncate font-medium">
                                                {doc.type}
                                            </span>
                                            <button
                                                onClick={() => handleDelete(doc.id, doc.file_url)}
                                                className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add New Custom Document */}
                            <div className="bg-white rounded-xl p-4 border border-slate-100">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Document Name</label>
                                <input
                                    type="text"
                                    value={customDocName}
                                    onChange={(e) => setCustomDocName(e.target.value)}
                                    placeholder="e.g., Recommendation Letter, Bank Statement..."
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 outline-none text-sm"
                                    disabled={isLocked}
                                />

                                <label className={`mt-3 flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isLocked || !customDocName.trim()
                                    ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-50'
                                    : 'border-orange-300 bg-orange-50 hover:bg-orange-100'
                                    }`}>
                                    {uploadingCategory === 'custom' ? (
                                        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                                    ) : (
                                        <>
                                            <Upload className="w-5 h-5 text-orange-500" />
                                            <span className="text-sm font-bold text-orange-600">
                                                {customDocName.trim() ? `Upload "${customDocName}"` : 'Enter name first'}
                                            </span>
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        className="hidden"
                                        disabled={isLocked || !customDocName.trim() || uploadingCategory === 'custom'}
                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file && customDocName.trim()) {
                                                handleUpload('custom', file, customDocName.trim());
                                            }
                                            e.target.value = '';
                                        }}
                                    />
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Stats */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-3xl font-black">{documents.length}</p>
                        <p className="text-slate-400 text-sm">Total Documents</p>
                    </div>
                    <div className="flex gap-2">
                        {documentCategories.map(category => {
                            const hasDoc = getDocsByCategory(category.id).length > 0;
                            return (
                                <div
                                    key={category.id}
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasDoc ? `bg-gradient-to-br ${category.color}` : 'bg-slate-700'
                                        }`}
                                    title={category.label}
                                >
                                    {hasDoc ? (
                                        <Check className="w-5 h-5 text-white" />
                                    ) : (
                                        <category.icon className="w-5 h-5 text-slate-500" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* OCR Results Modal */}
            {showOcrModal && ocrResult && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        {/* Modal Header */}
                        <div className="h-14 px-6 bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <Check className="w-5 h-5" />
                                <h3 className="font-bold">Scores Extracted & Saved!</h3>
                            </div>
                            <button
                                onClick={() => { setShowOcrModal(false); setOcrResult(null); }}
                                className="p-2 rounded-full hover:bg-white/20 text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content - Show extracted scores nicely */}
                        <div className="p-6 space-y-4">
                            {ocrResult.extractedScores && Object.keys(ocrResult.extractedScores).length > 0 ? (
                                <>
                                    <p className="text-slate-500 text-sm text-center">
                                        ✨ Your scores have been auto-saved to your Academic profile
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {Object.entries(ocrResult.extractedScores).map(([key, value]) => {
                                            if (!value || value === 'null') return null;
                                            // Format the label nicely
                                            const label = key
                                                .replace('ielts_', 'IELTS ')
                                                .replace('sat_', 'SAT ')
                                                .replace('toefl_', 'TOEFL ')
                                                .replace('gpa_', 'GPA ')
                                                .replace('_', ' ')
                                                .split(' ')
                                                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                                .join(' ');

                                            return (
                                                <div key={key} className="flex flex-col items-center p-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-green-100">
                                                    <span className="text-2xl font-bold text-emerald-600">{String(value)}</span>
                                                    <span className="text-xs text-slate-500 mt-1">{label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-6">
                                    <Sparkles className="w-12 h-12 text-purple-300 mx-auto mb-3" />
                                    <p className="text-slate-500">No specific scores were detected in this document.</p>
                                </div>
                            )}

                            <button
                                onClick={() => { setShowOcrModal(false); setOcrResult(null); }}
                                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
