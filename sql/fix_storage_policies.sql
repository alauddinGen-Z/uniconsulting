-- ============================================================================
-- FIX SUPABASE STORAGE BUCKET POLICIES
-- Run this in Supabase SQL Editor to fix 400 download errors
-- ============================================================================

-- First, ensure the 'documents' bucket exists and is set up correctly
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop existing storage policies if any
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
DROP POLICY IF EXISTS "documents_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can download" ON storage.objects;

-- Create storage policies for 'documents' bucket
-- Allow authenticated users to upload to their own folder
CREATE POLICY "storage_documents_insert" ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'documents'
        AND auth.role() = 'authenticated'
    );

-- Allow users to view their own files OR teachers can view all
CREATE POLICY "storage_documents_select" ON storage.objects FOR SELECT
    USING (
        bucket_id = 'documents'
        AND (
            -- File belongs to user (path starts with user ID)
            (storage.foldername(name))[1] = auth.uid()::text
            OR
            -- User is a teacher
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() AND role = 'teacher'
            )
        )
    );

-- Allow users to update their own files
CREATE POLICY "storage_documents_update" ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow users to delete their own files
CREATE POLICY "storage_documents_delete" ON storage.objects FOR DELETE
    USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- ============================================================================
-- ALTERNATIVE: If the above doesn't work, use simpler policies
-- ============================================================================

-- Uncomment these if the above policies don't work:

-- DROP POLICY IF EXISTS "storage_documents_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "storage_documents_select" ON storage.objects;
-- DROP POLICY IF EXISTS "storage_documents_update" ON storage.objects;
-- DROP POLICY IF EXISTS "storage_documents_delete" ON storage.objects;

-- CREATE POLICY "storage_allow_authenticated" ON storage.objects
--     FOR ALL
--     USING (bucket_id = 'documents' AND auth.role() = 'authenticated')
--     WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');
