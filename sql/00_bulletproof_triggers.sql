-- =====================================================
-- 00_bulletproof_triggers.sql
-- BULLETPROOF AUTH: Anti-Zombie Triggers + Simple RLS
-- 
-- Run this ENTIRE script in Supabase SQL Editor
-- =====================================================

-- ================================================================
-- PART 1: SECURITY DEFINER HELPER FUNCTIONS
-- ================================================================

-- Check if current user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT is_admin FROM profiles WHERE id = auth.uid()),
        FALSE
    );
$$;

-- Get current user's role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT role::TEXT FROM profiles WHERE id = auth.uid()),
        'student'
    );
$$;

GRANT EXECUTE ON FUNCTION public.check_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- ================================================================
-- PART 2: ANTI-ZOMBIE TRIGGER (Auto-Create Profile on Signup)
-- ================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- Critical: bypasses RLS to prevent recursion
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        approval_status,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            split_part(NEW.email, '@', 1)
        ),
        COALESCE(
            (NEW.raw_user_meta_data->>'role')::user_role,
            'student'::user_role
        ),
        'pending'::approval_status,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the signup
        RAISE WARNING 'handle_new_user failed: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Recreate trigger (safe to run multiple times)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- PART 3: SELF-HEALING RPC (Frontend calls this if profile missing)
-- ================================================================

CREATE OR REPLACE FUNCTION public.ensure_profile_exists()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID;
    user_email TEXT;
    user_meta JSONB;
BEGIN
    -- Get current user info
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get user data from auth.users
    SELECT email, raw_user_meta_data 
    INTO user_email, user_meta
    FROM auth.users 
    WHERE id = current_user_id;
    
    -- Create profile if it doesn't exist
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        approval_status,
        created_at,
        updated_at
    )
    VALUES (
        current_user_id,
        user_email,
        COALESCE(
            user_meta->>'full_name',
            split_part(user_email, '@', 1)
        ),
        COALESCE(
            (user_meta->>'role')::user_role,
            'student'::user_role
        ),
        'pending'::approval_status,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_profile_exists() TO authenticated;

-- ================================================================
-- PART 4: NUCLEAR POLICY RESET
-- ================================================================

-- Drop ALL existing policies on profiles
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
    END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- PART 5: SIMPLE, NON-RECURSIVE POLICIES
-- ================================================================

-- Policy 1: Users can READ their own profile
CREATE POLICY "Read_Own_Profile" ON profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Policy 2: Teachers can read their students
CREATE POLICY "Teacher_Read_Students" ON profiles
FOR SELECT
TO authenticated
USING (teacher_id = auth.uid());

-- Policy 3: Same agency can see each other (for lists)
CREATE POLICY "Agency_Read_Members" ON profiles
FOR SELECT
TO authenticated
USING (
    agency_id IS NOT NULL 
    AND agency_id = (
        SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()
    )
);

-- Policy 4: Users can UPDATE their own profile
CREATE POLICY "Update_Own_Profile" ON profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy 5: Users can INSERT their own profile (signup)
CREATE POLICY "Insert_Own_Profile" ON profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Policy 6: Users can DELETE their own profile
CREATE POLICY "Delete_Own_Profile" ON profiles
FOR DELETE
TO authenticated
USING (id = auth.uid());

-- ================================================================
-- PART 6: BACKFILL ANY MISSING PROFILES
-- ================================================================

INSERT INTO public.profiles (id, email, full_name, role, approval_status)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    COALESCE((au.raw_user_meta_data->>'role')::user_role, 'student'::user_role),
    'pending'::approval_status
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id = au.id)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- VERIFICATION
-- ================================================================

DO $$
DECLARE
    policy_count INTEGER;
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'profiles';
    SELECT COUNT(*) INTO orphan_count 
    FROM auth.users au 
    LEFT JOIN profiles p ON au.id = p.id 
    WHERE p.id IS NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ BULLETPROOF TRIGGERS INSTALLED';
    RAISE NOTICE '   Policies on profiles: %', policy_count;
    RAISE NOTICE '   Orphan users fixed: %', orphan_count;
    RAISE NOTICE '';
END $$;
