-- =====================================================
-- phase4_storage_security.sql
-- Secure Document Storage
-- 
-- ⚠️ IMPORTANT: Storage policies must be created via
-- Supabase Dashboard > Storage > Policies
-- This file contains only the bucket creation.
-- =====================================================

-- ================================================================
-- 1. CREATE PRIVATE BUCKET (Run in SQL Editor)
-- ================================================================

-- Note: Bucket creation may fail if bucket already exists.
-- If so, configure via Dashboard > Storage > assignments bucket settings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'assignments',
    'assignments',
    FALSE,  -- Private bucket
    5242880,  -- 5MB limit (5 * 1024 * 1024)
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = FALSE,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];


-- ================================================================
-- ⚠️ MANUAL STEP: Create Storage Policies via Dashboard
-- ================================================================
-- 
-- Go to: Supabase Dashboard > Storage > assignments > Policies
-- 
-- Create these 4 policies:
--
-- ---------------------------------------------------------------
-- POLICY 1: student_upload_own_folder (INSERT)
-- ---------------------------------------------------------------
-- Name: student_upload_own_folder
-- Allowed operation: INSERT
-- Target roles: authenticated
-- WITH CHECK expression:
--   (bucket_id = 'assignments' AND (storage.foldername(name))[1] = (auth.uid())::text)
--
-- ---------------------------------------------------------------
-- POLICY 2: student_read_own_folder (SELECT)
-- ---------------------------------------------------------------
-- Name: student_read_own_folder
-- Allowed operation: SELECT
-- Target roles: authenticated
-- USING expression:
--   (bucket_id = 'assignments' AND (storage.foldername(name))[1] = (auth.uid())::text)
--
-- ---------------------------------------------------------------
-- POLICY 3: student_delete_own_folder (DELETE)
-- ---------------------------------------------------------------
-- Name: student_delete_own_folder
-- Allowed operation: DELETE
-- Target roles: authenticated
-- USING expression:
--   (bucket_id = 'assignments' AND (storage.foldername(name))[1] = (auth.uid())::text)
--
-- ---------------------------------------------------------------
-- POLICY 4: teacher_read_assigned_students (SELECT)
-- ---------------------------------------------------------------
-- Name: teacher_read_assigned_students
-- Allowed operation: SELECT
-- Target roles: authenticated
-- USING expression:
--   (bucket_id = 'assignments' AND (storage.foldername(name))[1] IN (
--     SELECT (p.id)::text FROM public.profiles p 
--     WHERE p.teacher_id = auth.uid() AND p.role = 'student'
--   ))
--
-- ================================================================
