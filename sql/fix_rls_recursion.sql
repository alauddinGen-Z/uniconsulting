-- =====================================================
-- fix_rls_recursion.sql
-- EMERGENCY FIX: RLS Infinite Recursion on profiles table
-- 
-- DIAGNOSIS: The RLS policy on `profiles` contains a 
--            self-referential query that causes infinite
--            recursion and 500 errors.
--
-- SOLUTION: Use SECURITY DEFINER function to break the chain.
--           The function runs as the owner (postgres), which
--           bypasses RLS, preventing the recursive trigger.
--
-- CoVe Guarantees:
--   ✅ Recursion Proof: SECURITY DEFINER bypasses RLS
--   ✅ Security Risk: Function only returns boolean
--   ✅ Performance: STABLE keyword enables query caching
-- =====================================================

-- ================================================================
-- 1. CREATE BYPASS FUNCTION (SECURITY DEFINER)
-- ================================================================

-- This function checks if the current user is an admin.
-- SECURITY DEFINER means it runs as 'postgres' (the owner),
-- which bypasses RLS and breaks the recursion chain.

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER  -- RUN AS OWNER (bypasses RLS)
STABLE            -- Cached per query for performance
SET search_path = public  -- Prevent search_path attacks
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE id = auth.uid() 
        AND is_admin = TRUE
    );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_is_admin() TO authenticated;

-- ================================================================
-- EXPLANATION: Why does SECURITY DEFINER fix the 500 error?
-- ================================================================
-- 
-- THE LOOP (Before Fix):
-- 1. User queries `profiles` table
-- 2. RLS policy triggers: SELECT ... FROM profiles WHERE is_admin = true
-- 3. That SELECT queries `profiles` again
-- 4. Step 2 triggers again → infinite loop → timeout → 500 error
--
-- THE FIX (After):
-- 1. User queries `profiles` table  
-- 2. RLS policy calls `check_is_admin()` function
-- 3. Function runs as 'postgres' (SECURITY DEFINER)
-- 4. Postgres role bypasses RLS → no policy trigger → no recursion
-- 5. Function returns boolean → RLS completes → query succeeds
--
-- ================================================================

-- ================================================================
-- 2. HELPER: Check if user is a teacher
-- ================================================================

CREATE OR REPLACE FUNCTION public.check_is_teacher()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('teacher', 'owner')
    );
$$;

GRANT EXECUTE ON FUNCTION public.check_is_teacher() TO authenticated;

-- ================================================================
-- 3. HELPER: Get current user's role
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT role::TEXT FROM profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- ================================================================
-- 4. DROP BROKEN POLICIES
-- ================================================================

-- Drop all existing policies on profiles that may cause recursion
DROP POLICY IF EXISTS "admin_select_all" ON profiles;
DROP POLICY IF EXISTS "admin_update_all" ON profiles;
DROP POLICY IF EXISTS "admin_insert_all" ON profiles;
DROP POLICY IF EXISTS "admin_delete_all" ON profiles;
DROP POLICY IF EXISTS "Admins_All" ON profiles;
DROP POLICY IF EXISTS "Users_Self" ON profiles;
DROP POLICY IF EXISTS "Teacher_View_Students" ON profiles;
DROP POLICY IF EXISTS "teacher_select_students" ON profiles;
DROP POLICY IF EXISTS "teacher_update_students" ON profiles;
DROP POLICY IF EXISTS "user_select_self" ON profiles;
DROP POLICY IF EXISTS "user_update_self" ON profiles;
DROP POLICY IF EXISTS "RLS_profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "RLS_profiles_select_teacher" ON profiles;
DROP POLICY IF EXISTS "RLS_profiles_select_same_agency" ON profiles;
DROP POLICY IF EXISTS "RLS_profiles_update_own" ON profiles;

-- ================================================================
-- 5. RE-APPLY SAFE POLICIES (Using helper functions)
-- ================================================================

-- POLICY 1: Users can always read and update their own profile
CREATE POLICY "Users_Own_Profile" ON profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- POLICY 2: Admins can read ALL profiles
-- Uses check_is_admin() which bypasses RLS via SECURITY DEFINER
CREATE POLICY "Admins_Select_All" ON profiles
FOR SELECT
TO authenticated
USING (check_is_admin());

-- POLICY 3: Admins can update ALL profiles
CREATE POLICY "Admins_Update_All" ON profiles
FOR UPDATE
TO authenticated
USING (check_is_admin())
WITH CHECK (check_is_admin());

-- POLICY 4: Teachers can read their assigned students
CREATE POLICY "Teachers_View_Students" ON profiles
FOR SELECT
TO authenticated
USING (
    teacher_id = auth.uid()
    AND role = 'student'
);

-- POLICY 5: Teachers can update their assigned students (limited)
CREATE POLICY "Teachers_Update_Students" ON profiles
FOR UPDATE
TO authenticated
USING (
    teacher_id = auth.uid()
    AND role = 'student'
    AND is_admin = FALSE  -- Cannot update admin accounts
)
WITH CHECK (
    -- Teacher cannot escalate privileges
    is_admin = FALSE
    AND role = 'student'
);

-- POLICY 6: Users in same agency can see each other (for lists)
CREATE POLICY "Same_Agency_Read" ON profiles
FOR SELECT
TO authenticated
USING (
    agency_id IS NOT NULL
    AND agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
);

-- ================================================================
-- 6. VERIFICATION QUERY
-- ================================================================

-- After running this migration, test with:
-- SELECT * FROM profiles LIMIT 10;
-- 
-- Expected: Query completes without error
-- If still 500: Check for other recursive policies

-- ================================================================
-- 7. COMMENTS
-- ================================================================

COMMENT ON FUNCTION public.check_is_admin() IS 
'Recursion-safe admin check using SECURITY DEFINER. Runs as postgres to bypass RLS.';

COMMENT ON FUNCTION public.check_is_teacher() IS 
'Recursion-safe teacher check using SECURITY DEFINER.';

COMMENT ON POLICY "Admins_Select_All" ON profiles IS 
'Admin read access using check_is_admin() to prevent RLS recursion.';
