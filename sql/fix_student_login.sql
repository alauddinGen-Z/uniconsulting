-- Fix Student Login Issues
-- Problem: Profile not found during login
-- Solutions: 
-- 1. Ensure signup trigger creates profiles correctly
-- 2. Fix RLS policies to allow users to read their own profile
-- 3. Add policies for profile creation

-- ============================================
-- Step 1: Recreate the signup trigger function
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert new profile with proper error handling
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        approval_status,
        created_at
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'::user_role),
        CASE 
            WHEN COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'::user_role) = 'student'::user_role THEN 'pending'::approval_status
            ELSE 'approved'::approval_status
        END,
        NOW()
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the signup
        RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Step 2: Fix RLS Policies - Users MUST be able to read their own profile
-- ============================================

-- Drop all existing SELECT policies on profiles
DROP POLICY IF EXISTS "Users can view own profile, teachers can view all" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for users based on user_id" ON public.profiles;

-- Create a simple, foolproof policy for reading own profile
CREATE POLICY "Users can always view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Separate policy for teachers to view all profiles
CREATE POLICY "Teachers can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_teacher());

-- Policy for users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy for inserting profiles (needed for trigger)
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;
CREATE POLICY "Service role can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ============================================
-- Step 3: Verify and fix any existing users without profiles
-- ============================================

-- Check for auth users without profiles
SELECT 
    u.id,
    u.email,
    p.id as profile_id
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Create missing profiles for existing users
INSERT INTO public.profiles (id, email, full_name, role, approval_status, created_at)
SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', ''),
    COALESCE((u.raw_user_meta_data->>'role')::user_role, 'student'::user_role),
    CASE 
        WHEN COALESCE((u.raw_user_meta_data->>'role')::user_role, 'student'::user_role) = 'student'::user_role THEN 'pending'::approval_status
        ELSE 'approved'::approval_status
    END,
    u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Verification
-- ============================================

-- Check all profiles
SELECT id, email, role, approval_status, created_at FROM public.profiles ORDER BY created_at DESC;

-- Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Test the is_teacher function
SELECT 
    email,
    role,
    public.is_teacher() as is_teacher_result
FROM public.profiles
LIMIT 5;
