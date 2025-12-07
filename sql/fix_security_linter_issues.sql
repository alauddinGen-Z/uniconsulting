-- Fix Security Issues Flagged by Supabase Linter
-- Issue 1: Remove SECURITY DEFINER from student_readiness view
-- Issue 2: Fix RLS policy to not use user_metadata

-- ============================================
-- FIX 1: Recreate student_readiness view without SECURITY DEFINER
-- ============================================
DROP VIEW IF EXISTS public.student_readiness;

CREATE VIEW public.student_readiness AS
SELECT 
    p.id,
    p.full_name,
    p.email,
    -- Calculate readiness score based on completed fields
    CASE 
        WHEN p.passport_number IS NOT NULL 
             AND p.home_address IS NOT NULL 
             AND p.mother_full_name IS NOT NULL 
             AND p.father_full_name IS NOT NULL 
        THEN 100
        ELSE 50
    END as readiness_score
FROM profiles p
WHERE p.role = 'student';

-- Grant appropriate access
GRANT SELECT ON public.student_readiness TO authenticated;

-- ============================================
-- FIX 2: Replace RLS policy that uses user_metadata
-- ============================================

-- Drop the insecure policy
DROP POLICY IF EXISTS "Teachers can view all profiles - fixed" ON public.profiles;

-- Also drop if it exists with the new name
DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;

-- Create a secure policy that checks the role column in profiles table
-- Teachers can view all profiles by checking their own role in the profiles table
CREATE POLICY "Teachers can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    -- Users can view their own profile
    auth.uid() = id
    OR
    -- OR if the user is a teacher (check their role in profiles table)
    EXISTS (
        SELECT 1 FROM public.profiles teacher_profile
        WHERE teacher_profile.id = auth.uid()
        AND teacher_profile.role = 'teacher'
    )
);

-- Verify the changes
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE viewname = 'student_readiness';

SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'profiles'
AND policyname = 'Teachers can view all profiles';
