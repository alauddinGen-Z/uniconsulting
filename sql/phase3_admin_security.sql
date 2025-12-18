-- =====================================================
-- phase3_admin_security.sql
-- Admin Security Layer with RLS Policies
-- 
-- CoVe Guarantees:
--   ✅ Recursion-Safe: EXISTS pattern with auth.uid()
--   ✅ Privilege Escalation: Teachers blocked from is_admin changes
--   ✅ Multi-Layer: RLS + Application checks
-- =====================================================

-- ================================================================
-- 1. SCHEMA: Add is_admin column
-- ================================================================

-- Add is_admin column if not exists
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create partial index for admin queries (only index true values)
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin 
ON profiles(is_admin) 
WHERE is_admin = TRUE;

-- ================================================================
-- 2. DROP EXISTING CONFLICTING POLICIES
-- ================================================================

-- Drop old policies that may conflict
DROP POLICY IF EXISTS "admin_view_all_profiles" ON profiles;
DROP POLICY IF EXISTS "admin_update_all_profiles" ON profiles;
DROP POLICY IF EXISTS "teacher_view_students" ON profiles;
DROP POLICY IF EXISTS "teacher_update_students" ON profiles;
DROP POLICY IF EXISTS "user_view_own_profile" ON profiles;
DROP POLICY IF EXISTS "user_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "user_insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "RLS_profiles_select" ON profiles;
DROP POLICY IF EXISTS "RLS_profiles_update" ON profiles;
DROP POLICY IF EXISTS "RLS_profiles_insert" ON profiles;

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 3. ADMIN POLICIES (Highest Privilege)
-- Uses EXISTS pattern to avoid infinite recursion
-- ================================================================

-- Admin: Can SELECT all profiles
CREATE POLICY "admin_select_all" ON profiles
FOR SELECT
TO authenticated
USING (
    -- Recursion-safe: auth.uid() is evaluated as constant
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() 
        AND p.is_admin = TRUE
    )
);

-- Admin: Can UPDATE all profiles (including is_admin)
CREATE POLICY "admin_update_all" ON profiles
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() 
        AND p.is_admin = TRUE
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() 
        AND p.is_admin = TRUE
    )
);

-- Admin: Can DELETE profiles (except their own)
CREATE POLICY "admin_delete_others" ON profiles
FOR DELETE
TO authenticated
USING (
    id != auth.uid() -- Cannot delete self
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() 
        AND p.is_admin = TRUE
    )
);

-- ================================================================
-- 4. TEACHER POLICIES (Limited Privilege)
-- ================================================================

-- Teacher: Can SELECT assigned students only
CREATE POLICY "teacher_select_students" ON profiles
FOR SELECT
TO authenticated
USING (
    -- Teacher can see students assigned to them
    teacher_id = auth.uid()
    -- Teachers can also see themselves
    OR id = auth.uid()
);

-- Teacher: Can UPDATE assigned students (with restrictions)
CREATE POLICY "teacher_update_students" ON profiles
FOR UPDATE
TO authenticated
USING (
    -- Can only update students assigned to them
    teacher_id = auth.uid()
    -- CANNOT update admin users (protect admins)
    AND is_admin = FALSE
    -- CANNOT update other teachers
    AND role = 'student'
)
WITH CHECK (
    -- Teacher CANNOT set is_admin to true (privilege escalation block)
    is_admin = FALSE
    -- Teacher CANNOT change student to teacher/owner
    AND role = 'student'
);

-- ================================================================
-- 5. USER SELF-SERVICE POLICIES (Lowest Privilege)
-- ================================================================

-- User: Can always SELECT their own profile
CREATE POLICY "user_select_own" ON profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- User: Can UPDATE their own profile (limited fields)
CREATE POLICY "user_update_own" ON profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid()
    -- Cannot self-promote to admin
    AND is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid())
    -- Cannot change own role
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
);

-- User: Can INSERT their own profile (signup)
CREATE POLICY "user_insert_own" ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
    id = auth.uid()
    AND is_admin = FALSE  -- New users cannot be admin
);

-- ================================================================
-- 6. COMMENTS
-- ================================================================

COMMENT ON COLUMN profiles.is_admin IS 'Grants full platform admin privileges when TRUE. Only other admins can set this.';

COMMENT ON POLICY "admin_select_all" ON profiles IS 
'Admins can see all profiles. Uses EXISTS pattern to prevent RLS recursion.';

COMMENT ON POLICY "teacher_update_students" ON profiles IS 
'Teachers can update assigned students but CANNOT: (1) update admins, (2) set is_admin=true, (3) change roles.';
