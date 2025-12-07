-- Fix Infinite Recursion in RLS Policy
-- The previous policy caused recursion by checking profiles table within profiles policy
-- Solution: Create a SECURITY DEFINER function to safely check user role

-- ============================================
-- Step 1: Drop the problematic policy
-- ============================================
DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;

-- ============================================
-- Step 2: Create a helper function that bypasses RLS
-- ============================================
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
    -- This function runs with SECURITY DEFINER, bypassing RLS
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'teacher'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- Step 3: Create a safe RLS policy using the function
-- ============================================
CREATE POLICY "Users can view own profile, teachers can view all"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    -- Users can always view their own profile
    auth.uid() = id
    OR
    -- Teachers can view all profiles (using function to avoid recursion)
    public.is_teacher()
);

-- ============================================
-- Verification
-- ============================================
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'profiles';

-- Test the function
SELECT public.is_teacher();
