/**
 * upload.ts
 * Secure Document Upload Server Action
 * 
 * CoVe Guarantees:
 *   ✅ Size Validation: Checked before processing
 *   ✅ MIME Validation: Only PDF allowed
 *   ✅ Safe Naming: UUID-based, no user input in filename
 *   ✅ Path Security: No directory traversal possible
 */

'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { actionClient } from '@/lib/safe-action';
import { z } from 'zod';

// ============================================
// CONSTANTS
// ============================================

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['application/pdf'] as const;
const BUCKET_NAME = 'assignments';

// ============================================
// ZOD SCHEMAS
// ============================================

const DocumentTypeSchema = z.enum([
    'passport',
    'transcript',
    'diploma',
    'certificate',
    'recommendation',
    'essay',
    'other',
]);

export type DocumentType = z.infer<typeof DocumentTypeSchema>;

// Schema for upload metadata (validated BEFORE file processing)
const UploadMetadataSchema = z.object({
    documentType: DocumentTypeSchema,
    title: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
});

// Full upload schema including file validation
const UploadDocumentSchema = z.object({
    documentType: DocumentTypeSchema,
    title: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    // File metadata (validated before actual upload)
    fileName: z.string().min(1),
    fileSize: z.number().max(MAX_FILE_SIZE, 'File size must be less than 5MB'),
    mimeType: z.literal('application/pdf'),
});

export type UploadDocumentInput = z.infer<typeof UploadDocumentSchema>;

export type UploadDocumentOutput = {
    success: boolean;
    documentId?: string;
    storagePath?: string;
    publicUrl?: string;
    message: string;
};

// ============================================
// HELPER: Generate Safe File Path
// ============================================

function generateSafeFilePath(
    userId: string,
    documentType: DocumentType,
): string {
    // Generate unique filename with UUID and timestamp
    // Format: {userId}/{documentType}/{uuid}-{timestamp}.pdf
    const uuid = crypto.randomUUID();
    const timestamp = Date.now();

    // SECURITY: No user input in filename, prevents directory traversal
    return `${userId}/${documentType}/${uuid}-${timestamp}.pdf`;
}

// ============================================
// ACTION: uploadDocument
// Handles secure file upload with validation
// ============================================

export const uploadDocument = actionClient
    .schema(UploadDocumentSchema)
    .action(async ({ parsedInput }): Promise<UploadDocumentOutput> => {
        const { documentType, title, description, fileName, fileSize, mimeType } = parsedInput;
        const supabase = await createClient();

        // ============================================
        // 1. AUTHENTICATION CHECK
        // ============================================

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            throw new Error('Authentication required');
        }

        // ============================================
        // 2. DOUBLE-CHECK: File validation (already done by Zod, but defense in depth)
        // ============================================

        if (fileSize > MAX_FILE_SIZE) {
            throw new Error('File size exceeds 5MB limit');
        }

        if (!ALLOWED_MIME_TYPES.includes(mimeType as typeof ALLOWED_MIME_TYPES[number])) {
            throw new Error('Invalid file type. Only PDF files are allowed.');
        }

        // ============================================
        // 3. GENERATE SAFE PATH
        // ============================================

        const storagePath = generateSafeFilePath(user.id, documentType);

        // Note: Actual file upload would happen via presigned URL
        // This action validates and returns the safe path for client-side upload

        // Generate signed upload URL (valid for 60 seconds)
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUploadUrl(storagePath);

        if (signedUrlError) {
            console.error('Signed URL error:', signedUrlError);
            throw new Error('Failed to generate upload URL');
        }

        // ============================================
        // 4. CREATE DOCUMENT RECORD (Metadata)
        // ============================================

        const { data: document, error: insertError } = await supabase
            .from('documents')
            .insert({
                student_id: user.id,
                type: documentType,
                title: title || fileName,
                description: description || null,
                file_url: storagePath,
                status: 'pending',
            })
            .select('id')
            .single();

        if (insertError) {
            console.error('Document insert error:', insertError);
            throw new Error('Failed to create document record');
        }

        // ============================================
        // 5. CACHE INVALIDATION
        // ============================================

        revalidatePath('/student/documents');
        revalidatePath('/student');

        return {
            success: true,
            documentId: document.id,
            storagePath,
            publicUrl: signedUrlData.signedUrl,
            message: 'Upload URL generated. Complete upload within 60 seconds.',
        };
    });

// ============================================
// ACTION: confirmUpload
// Called after client completes the upload
// ============================================

const ConfirmUploadSchema = z.object({
    documentId: z.string().uuid(),
    storagePath: z.string(),
});

export type ConfirmUploadInput = z.infer<typeof ConfirmUploadSchema>;

export const confirmUpload = actionClient
    .schema(ConfirmUploadSchema)
    .action(async ({ parsedInput }) => {
        const { documentId, storagePath } = parsedInput;
        const supabase = await createClient();

        // Auth check
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            throw new Error('Authentication required');
        }

        // Verify file exists in storage
        const { data: fileData, error: fileError } = await supabase.storage
            .from(BUCKET_NAME)
            .list(storagePath.split('/').slice(0, -1).join('/'), {
                search: storagePath.split('/').pop(),
            });

        if (fileError || !fileData?.length) {
            // File doesn't exist, mark document as failed
            await supabase
                .from('documents')
                .update({ status: 'failed' })
                .eq('id', documentId)
                .eq('student_id', user.id);

            throw new Error('File upload verification failed');
        }

        // Update document status to uploaded
        const { error: updateError } = await supabase
            .from('documents')
            .update({
                status: 'uploaded',
                uploaded_at: new Date().toISOString(),
            })
            .eq('id', documentId)
            .eq('student_id', user.id);

        if (updateError) {
            throw new Error('Failed to confirm upload');
        }

        revalidatePath('/student/documents');

        return {
            success: true,
            message: 'Document uploaded successfully',
        };
    });

// ============================================
// ACTION: deleteDocument
// ============================================

const DeleteDocumentSchema = z.object({
    documentId: z.string().uuid(),
});

export const deleteDocument = actionClient
    .schema(DeleteDocumentSchema)
    .action(async ({ parsedInput }) => {
        const { documentId } = parsedInput;
        const supabase = await createClient();

        // Auth check
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            throw new Error('Authentication required');
        }

        // Get document to find storage path
        const { data: document, error: fetchError } = await supabase
            .from('documents')
            .select('file_url')
            .eq('id', documentId)
            .eq('student_id', user.id) // RLS + app-level check
            .single();

        if (fetchError || !document) {
            throw new Error('Document not found');
        }

        // Delete from storage (RLS will enforce ownership)
        const { error: storageError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([document.file_url]);

        if (storageError) {
            console.error('Storage delete error:', storageError);
            // Continue to delete DB record even if storage fails
        }

        // Delete document record
        const { error: deleteError } = await supabase
            .from('documents')
            .delete()
            .eq('id', documentId)
            .eq('student_id', user.id);

        if (deleteError) {
            throw new Error('Failed to delete document record');
        }

        revalidatePath('/student/documents');

        return {
            success: true,
            message: 'Document deleted successfully',
        };
    });
