-- ============================================================================
-- EMERGENCY FIX: Fix RLS recursion issue
-- Run this IMMEDIATELY to fix 500 errors
-- ============================================================================

-- The issue is profiles_update policy checks profiles table = infinite recursion
-- Let's fix it with a simpler approach

-- Drop the problematic policies
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;

-- Recreate with non-recursive policies
CREATE POLICY "profiles_select" ON profiles FOR SELECT
    USING (true);  -- Everyone can read profiles

CREATE POLICY "profiles_insert" ON profiles FOR INSERT
    WITH CHECK (id = (select auth.uid()));

-- Fix: Use a security definer function to avoid recursion
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'teacher'
    );
$$;

CREATE POLICY "profiles_update" ON profiles FOR UPDATE
    USING (
        id = (select auth.uid()) 
        OR 
        public.is_teacher()
    );

-- Also fix documents, essays, student_universities policies that have same issue
DROP POLICY IF EXISTS "documents_select" ON documents;
DROP POLICY IF EXISTS "documents_insert" ON documents;
DROP POLICY IF EXISTS "documents_update" ON documents;

CREATE POLICY "documents_select" ON documents FOR SELECT
    USING (
        student_id = (select auth.uid())
        OR public.is_teacher()
    );

CREATE POLICY "documents_insert" ON documents FOR INSERT
    WITH CHECK (
        student_id = (select auth.uid())
        OR public.is_teacher()
    );

CREATE POLICY "documents_update" ON documents FOR UPDATE
    USING (
        student_id = (select auth.uid())
        OR public.is_teacher()
    );

-- Essays
DROP POLICY IF EXISTS "essays_select" ON essays;
DROP POLICY IF EXISTS "essays_update" ON essays;

CREATE POLICY "essays_select" ON essays FOR SELECT
    USING (
        student_id = (select auth.uid())
        OR public.is_teacher()
    );

CREATE POLICY "essays_update" ON essays FOR UPDATE
    USING (
        student_id = (select auth.uid())
        OR public.is_teacher()
    );

-- Student universities
DROP POLICY IF EXISTS "student_universities_select" ON student_universities;

CREATE POLICY "student_universities_select" ON student_universities FOR SELECT
    USING (
        student_id = (select auth.uid())
        OR public.is_teacher()
    );

-- Essay versions  
DROP POLICY IF EXISTS "essay_versions_select" ON essay_versions;

CREATE POLICY "essay_versions_select" ON essay_versions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM essays 
            WHERE essays.id = essay_versions.essay_id 
            AND essays.student_id = (select auth.uid())
        )
        OR public.is_teacher()
    );
