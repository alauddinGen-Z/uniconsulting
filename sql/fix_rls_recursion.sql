-- FINAL COMPREHENSIVE RLS FIX (v4)
-- Fixes ALL remaining recursive subqueries across all core tables.
-- Updated: 2026-02-03

-- ==========================================
-- HELPER FUNCTIONS (Non-recursive, SECURITY DEFINER)
-- ==========================================
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

DROP FUNCTION IF EXISTS is_teacher(uuid);
DROP FUNCTION IF EXISTS is_teacher();

CREATE OR REPLACE FUNCTION is_teacher(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND role = 'teacher');
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
    RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher');
END;
$$;

-- ==========================================
-- PROFILES TABLE
-- ==========================================
DROP POLICY IF EXISTS "profiles_select_v3" ON profiles;
DROP POLICY IF EXISTS "profiles_select_final" ON profiles;
DROP POLICY IF EXISTS "RLS_profiles_select" ON profiles;

CREATE POLICY "profiles_select_final" ON profiles FOR SELECT TO authenticated
USING (
    id = auth.uid()
    OR teacher_id = auth.uid()
    OR (agency_id IS NOT NULL AND agency_id = get_my_agency_id())
);

-- ==========================================
-- ESSAYS TABLE
-- ==========================================
DROP POLICY IF EXISTS "essays_select_v3" ON essays;
DROP POLICY IF EXISTS "essays_select_final" ON essays;
DROP POLICY IF EXISTS "RLS_essays_select" ON essays;

CREATE POLICY "essays_select_final" ON essays FOR SELECT TO authenticated
USING (
    student_id = auth.uid()
    OR (agency_id IS NOT NULL AND agency_id = get_my_agency_id())
    OR student_id IN (SELECT id FROM profiles WHERE teacher_id = auth.uid())
);

DROP POLICY IF EXISTS "essays_update_v3" ON essays;
DROP POLICY IF EXISTS "essays_update_final" ON essays;
DROP POLICY IF EXISTS "RLS_essays_update" ON essays;

CREATE POLICY "essays_update_final" ON essays FOR UPDATE TO authenticated
USING (
    student_id = auth.uid()
    OR (agency_id IS NOT NULL AND agency_id = get_my_agency_id())
);

-- ==========================================
-- DOCUMENTS TABLE
-- ==========================================
DROP POLICY IF EXISTS "documents_select_v3" ON documents;
DROP POLICY IF EXISTS "documents_select_final" ON documents;
DROP POLICY IF EXISTS "RLS_documents_select" ON documents;

CREATE POLICY "documents_select_final" ON documents FOR SELECT TO authenticated
USING (
    student_id = auth.uid()
    OR (agency_id IS NOT NULL AND agency_id = get_my_agency_id())
    OR is_teacher()
    OR student_id IN (SELECT id FROM profiles WHERE teacher_id = auth.uid())
);

DROP POLICY IF EXISTS "documents_update_v3" ON documents;
DROP POLICY IF EXISTS "documents_update_final" ON documents;
DROP POLICY IF EXISTS "RLS_documents_update" ON documents;

CREATE POLICY "documents_update_final" ON documents FOR UPDATE TO authenticated
USING (
    student_id = auth.uid()
    OR (agency_id IS NOT NULL AND agency_id = get_my_agency_id())
);

-- ==========================================
-- AGENCIES TABLE
-- ==========================================
DROP POLICY IF EXISTS "RLS_agencies_select" ON agencies;
DROP POLICY IF EXISTS "agencies_select_final" ON agencies;

CREATE POLICY "agencies_select_final" ON agencies FOR SELECT TO authenticated
USING (id = get_my_agency_id());

DROP POLICY IF EXISTS "RLS_agencies_update" ON agencies;
DROP POLICY IF EXISTS "agencies_update_final" ON agencies;

CREATE POLICY "agencies_update_final" ON agencies FOR UPDATE TO authenticated
USING (id = get_my_agency_id() AND is_teacher());

-- ==========================================
-- STUDENTS TABLE
-- ==========================================
DROP POLICY IF EXISTS "RLS_students_select" ON students;
DROP POLICY IF EXISTS "RLS_students_delete" ON students;
DROP POLICY IF EXISTS "students_all_clean" ON students;
DROP POLICY IF EXISTS "students_all_v3" ON students;
DROP POLICY IF EXISTS "students_select_final" ON students;
DROP POLICY IF EXISTS "students_modify_final" ON students;

CREATE POLICY "students_select_final" ON students FOR SELECT TO authenticated
USING (agency_id IS NOT NULL AND agency_id = get_my_agency_id());

CREATE POLICY "students_modify_final" ON students FOR ALL TO authenticated
USING (agency_id IS NOT NULL AND agency_id = get_my_agency_id() AND is_teacher());
