-- FINAL IDEMPOTENT RLS RECURSION FIX
-- Resolves the permanent "login hang" by breaking circular policy dependencies.

-- 1. Helper Functions (Non-recursive, Security Definer)
CREATE OR REPLACE FUNCTION get_my_agency_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_id UUID;
BEGIN
    SELECT agency_id INTO v_id FROM profiles WHERE id = auth.uid() LIMIT 1;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION is_teacher(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = user_id AND role = 'teacher'
    );
END;
$$;

CREATE OR REPLACE FUNCTION is_teacher()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'teacher'
    );
END;
$$;

-- 2. Cleanup all dependent policies
DROP POLICY IF EXISTS "profiles_select_clean" ON profiles;
DROP POLICY IF EXISTS "profiles_authenticated_select" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_agency" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;

DROP POLICY IF EXISTS "essays_select_clean" ON essays;
DROP POLICY IF EXISTS "essays_update_clean" ON essays;
DROP POLICY IF EXISTS "essays_select_policy" ON essays;
DROP POLICY IF EXISTS "essays_update_policy" ON essays;
DROP POLICY IF EXISTS "RLS_essays_select" ON essays;
DROP POLICY IF EXISTS "essays_select" ON essays;
DROP POLICY IF EXISTS "essays_update" ON essays;

DROP POLICY IF EXISTS "documents_select_clean" ON documents;
DROP POLICY IF EXISTS "documents_update_clean" ON documents;
DROP POLICY IF EXISTS "documents_select_v2" ON documents;
DROP POLICY IF EXISTS "documents_update_v2" ON documents;
DROP POLICY IF EXISTS "documents_select_policy" ON documents;
DROP POLICY IF EXISTS "documents_update_policy" ON documents;
DROP POLICY IF EXISTS "documents_select" ON documents;
DROP POLICY IF EXISTS "documents_update" ON documents;
DROP POLICY IF EXISTS "documents_delete" ON documents;

DROP POLICY IF EXISTS "students_all_clean" ON students;
DROP POLICY IF EXISTS "students_select_secure" ON students;
DROP POLICY IF EXISTS "students_all_secure" ON students;
DROP POLICY IF EXISTS "students_update_policy" ON students;

-- 3. APPLY NEW CLEAN POLICIES

-- PROFILES
CREATE POLICY "profiles_select_clean" ON profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR agency_id = get_my_agency_id());

-- ESSAYS
CREATE POLICY "essays_select_clean" ON essays FOR SELECT TO authenticated
USING (student_id = auth.uid() OR agency_id = get_my_agency_id());

CREATE POLICY "essays_update_clean" ON essays FOR UPDATE TO authenticated
USING (student_id = auth.uid() OR agency_id = get_my_agency_id());

-- DOCUMENTS
CREATE POLICY "documents_select_clean" ON documents FOR SELECT TO authenticated
USING (student_id = auth.uid() OR agency_id = get_my_agency_id() OR is_teacher());

CREATE POLICY "documents_update_clean" ON documents FOR UPDATE TO authenticated
USING (student_id = auth.uid() OR agency_id = get_my_agency_id() OR is_teacher());

-- STUDENTS
CREATE POLICY "students_all_clean" ON students FOR ALL TO authenticated
USING (agency_id = get_my_agency_id());
