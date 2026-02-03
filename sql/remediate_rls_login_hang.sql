-- ==========================================
-- REMEDIATION: Fix RLS Infinite Recursion & Login Hang
-- Applied: 2026-02-03
-- ==========================================

-- 1. CLEANUP OLD POLICIES (Profiles)
DROP POLICY IF EXISTS "Read_All_Profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in same agency" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Update_Own_Profile" ON profiles;
DROP POLICY IF EXISTS "Insert_Own_Profile" ON profiles;
DROP POLICY IF EXISTS "Delete_Own_Profile" ON profiles;
DROP POLICY IF EXISTS "profiles_anon_select_teachers" ON profiles;

-- 2. RE-DECLARE HELPER FUNCTIONS (Optimized)
-- Ensure these functions use SECURITY DEFINER to bypass RLS for lookups
CREATE OR REPLACE FUNCTION get_my_agency_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT agency_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_teacher()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'teacher'
  );
$$;

-- 3. APPLY CLEAN PROFILES POLICIES
-- Authenticated Select: Own profile or same agency
CREATE POLICY "profiles_select_policy" 
ON profiles FOR SELECT 
TO authenticated 
USING (
  id = auth.uid() 
  OR 
  agency_id = get_my_agency_id()
);

-- Anon Select: Allow seeing teacher names for signup dropdown
CREATE POLICY "profiles_anon_select_teachers" 
ON profiles FOR SELECT 
TO anon 
USING (role = 'teacher');

-- Update/Insert: Own profile only
CREATE POLICY "profiles_update_policy" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_policy" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- 4. FIX OTHER TABLES (Non-Recursive)
-- Use the helper function instead of raw subqueries on profiles

-- Essays
DROP POLICY IF EXISTS "RLS_essays_update" ON essays;
CREATE POLICY "essays_update_policy" ON essays FOR UPDATE TO authenticated 
USING (id = auth.uid() OR agency_id = get_my_agency_id());

-- Documents
DROP POLICY IF EXISTS "RLS_documents_select" ON documents;
DROP POLICY IF EXISTS "RLS_documents_update" ON documents;
CREATE POLICY "documents_select_policy" ON documents FOR SELECT TO authenticated 
USING (student_id = auth.uid() OR agency_id = get_my_agency_id());
CREATE POLICY "documents_update_policy" ON documents FOR UPDATE TO authenticated 
USING (student_id = auth.uid() OR agency_id = get_my_agency_id());

-- Students table
DROP POLICY IF EXISTS "RLS_students_update" ON students;
CREATE POLICY "students_update_policy" ON students FOR UPDATE TO authenticated 
USING (agency_id = get_my_agency_id());
