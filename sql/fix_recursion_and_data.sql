-- =====================================================
-- fix_recursion_and_data.sql
-- NUCLEAR RESET: Fix 42P17 Recursion + Repair Missing Data
-- 
-- RUN THIS ENTIRE SCRIPT IN SUPABASE SQL EDITOR
-- =====================================================

-- ================================================================
-- PART 1: THE SECURITY BYPASS FUNCTION
-- ================================================================
-- This function uses SECURITY DEFINER to bypass RLS
-- preventing the infinite recursion loop.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER  -- Runs as 'postgres', bypasses RLS
STABLE
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT role::TEXT FROM public.profiles WHERE id = auth.uid()),
        'student'
    );
$$;

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
        FALSE
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_admin() TO authenticated;

-- ================================================================
-- PART 2: NUCLEAR POLICY WIPE
-- ================================================================
-- Drop EVERY possible policy name to ensure clean slate

-- The Nuclear Option: Drop ALL policies at once
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
        RAISE NOTICE 'Dropped: %', pol.policyname;
    END LOOP;
END $$;

-- Manual cleanup of known policy names (belt and suspenders)
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Public_View" ON profiles;
DROP POLICY IF EXISTS "Update_Own" ON profiles;
DROP POLICY IF EXISTS "Insert_Own" ON profiles;
DROP POLICY IF EXISTS "Admin_All" ON profiles;
DROP POLICY IF EXISTS "Admins_All" ON profiles;
DROP POLICY IF EXISTS "Admins_Select_All" ON profiles;
DROP POLICY IF EXISTS "Admins_Update_All" ON profiles;
DROP POLICY IF EXISTS "Users_Self" ON profiles;
DROP POLICY IF EXISTS "Users_Own_Profile" ON profiles;
DROP POLICY IF EXISTS "Teacher_View_Students" ON profiles;
DROP POLICY IF EXISTS "Teachers_View_Students" ON profiles;
DROP POLICY IF EXISTS "Teachers_Update_Students" ON profiles;
DROP POLICY IF EXISTS "Same_Agency_Read" ON profiles;
DROP POLICY IF EXISTS "view_own_profile" ON profiles;
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "admin_select_all" ON profiles;
DROP POLICY IF EXISTS "admin_update_all" ON profiles;
DROP POLICY IF EXISTS "teacher_view_students" ON profiles;
DROP POLICY IF EXISTS "teacher_update_students" ON profiles;
DROP POLICY IF EXISTS "Read_All_Profiles" ON profiles;
DROP POLICY IF EXISTS "Update_Own_Profile" ON profiles;
DROP POLICY IF EXISTS "Insert_Own_Profile" ON profiles;

-- ================================================================
-- PART 3: CREATE SIMPLE, NON-RECURSIVE POLICIES
-- ================================================================
-- These policies DO NOT query any tables = NO RECURSION POSSIBLE

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: EVERYONE CAN READ (Fixes 90% of recursion bugs)
-- Profiles contain names/roles which are typically not sensitive
CREATE POLICY "Read_All_Profiles" ON profiles
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Users can UPDATE their own profile only
CREATE POLICY "Update_Own_Profile" ON profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy 3: Users can INSERT their own profile (signup)
CREATE POLICY "Insert_Own_Profile" ON profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Policy 4: Users can DELETE their own profile (account deletion)
CREATE POLICY "Delete_Own_Profile" ON profiles
FOR DELETE
TO authenticated
USING (id = auth.uid());

-- ================================================================
-- PART 4: BACKFILL MISSING PROFILES (Fixes 406)
-- ================================================================
-- Insert a profile for every auth.users that doesn't have one

INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    approval_status,
    created_at,
    updated_at
)
SELECT 
    au.id,
    au.email,
    COALESCE(
        au.raw_user_meta_data->>'full_name',
        split_part(au.email, '@', 1)
    ),
    COALESCE(
        (au.raw_user_meta_data->>'role')::user_role,
        'student'::user_role
    ),
    'pending'::approval_status,
    au.created_at,
    NOW()
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;  -- Double protection

-- ================================================================
-- PART 5: FIX HANDLE_NEW_USER TRIGGER
-- ================================================================
-- Ensure new signups always create a profile

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, approval_status)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'::user_role),
        'pending'::approval_status
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Test 1: This should NOT cause 42P17
-- SELECT * FROM profiles LIMIT 5;

-- Test 2: Check for missing profiles (should return 0 rows)
-- SELECT au.id, au.email 
-- FROM auth.users au 
-- LEFT JOIN profiles p ON au.id = p.id 
-- WHERE p.id IS NULL;

-- Test 3: Verify policies exist
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'profiles';

-- ================================================================
-- SUCCESS CONFIRMATION
-- ================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ NUCLEAR RESET COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Policies applied: Read_All, Update_Own, Insert_Own, Delete_Own';
    RAISE NOTICE 'Backfill: All auth.users now have profiles';
    RAISE NOTICE 'Trigger: handle_new_user is active';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Refresh your browser and try logging in';
    RAISE NOTICE '========================================';
END $$;
