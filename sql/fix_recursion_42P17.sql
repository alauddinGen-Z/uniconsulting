-- =====================================================
-- fix_recursion_42P17.sql
-- EMERGENCY FIX: Error 42P17 - Infinite Recursion in RLS
-- 
-- The SECURITY DEFINER pattern breaks the recursion by
-- running the check function as 'postgres' (the owner),
-- which bypasses RLS entirely.
-- =====================================================

-- ================================================================
-- 1. CREATE BYPASS FUNCTION
-- ================================================================

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER  -- Runs as owner (postgres), bypasses RLS
STABLE            -- Cached per query for performance
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_admin = TRUE
    );
$$;

GRANT EXECUTE ON FUNCTION public.check_is_admin() TO authenticated;

-- ================================================================
-- 2. DROP ALL BROKEN POLICIES
-- ================================================================

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

-- ================================================================
-- 3. RE-APPLY SAFE POLICIES
-- ================================================================

-- Policy 1: Everyone can view profiles (typical for user lists)
CREATE POLICY "Public_View" ON profiles
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Users can update their own profile
CREATE POLICY "Update_Own" ON profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy 3: Users can insert their own profile (signup)
CREATE POLICY "Insert_Own" ON profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Policy 4: Admins can do everything (uses safe function)
CREATE POLICY "Admin_All" ON profiles
FOR ALL
TO authenticated
USING (check_is_admin())
WITH CHECK (check_is_admin());

-- ================================================================
-- 4. VERIFY FIX
-- ================================================================

-- Test query (run after migration):
-- SELECT id, full_name, role FROM profiles LIMIT 5;
-- Expected: No error, results returned
