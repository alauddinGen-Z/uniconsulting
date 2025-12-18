-- =====================================================
-- 001_init_multi_tenant.sql
-- Multi-Tenant B2B SaaS Schema for UniConsulting
-- =====================================================

-- 1. Create agencies table (Top-level tenant)
CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS on agencies
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

-- 3. Add agency_id to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL;

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_agency_id ON profiles(agency_id);

-- 5. Create students table (agency-scoped)
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated')),
    application_status TEXT DEFAULT 'researching' CHECK (
        application_status IN ('researching', 'preparing', 'submitted', 'accepted', 'rejected', 'waitlisted')
    ),
    teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Enable RLS on students
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- 7. Create indexes for students
CREATE INDEX IF NOT EXISTS idx_students_agency_id ON students(agency_id);
CREATE INDEX IF NOT EXISTS idx_students_teacher_id ON students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

-- =====================================================
-- RLS POLICIES (CRITICAL - Agency Isolation)
-- =====================================================

-- PREREQUISITE: Run 000_add_owner_role.sql FIRST to add 'owner' to user_role enum
-- PostgreSQL requires enum values to be committed before use in policies

-- Helper function to get user's agency_id
CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT agency_id FROM profiles WHERE id = auth.uid()
$$;

-- ----- AGENCIES RLS -----
-- Users can only see their own agency
DROP POLICY IF EXISTS "RLS_agencies_select" ON agencies;
CREATE POLICY "RLS_agencies_select" ON agencies FOR SELECT
TO authenticated USING (
    id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
);

-- Only owners can update their agency
DROP POLICY IF EXISTS "RLS_agencies_update" ON agencies;
CREATE POLICY "RLS_agencies_update" ON agencies FOR UPDATE
TO authenticated USING (
    id IN (
        SELECT agency_id FROM profiles 
        WHERE id = auth.uid() AND role = 'owner'
    )
);

-- ----- PROFILES RLS (Updated for agency isolation) -----
-- Drop existing policies first
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
DROP POLICY IF EXISTS "Teachers can view their students" ON profiles;
DROP POLICY IF EXISTS "RLS_profiles_select" ON profiles;
DROP POLICY IF EXISTS "RLS_profiles_update" ON profiles;
DROP POLICY IF EXISTS "RLS_profiles_insert" ON profiles;

-- Users can see profiles in their agency
CREATE POLICY "RLS_profiles_select" ON profiles FOR SELECT
TO authenticated USING (
    -- Can see own profile OR profiles in same agency
    id = auth.uid() 
    OR agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
);

-- Users can update their own profile
CREATE POLICY "RLS_profiles_update" ON profiles FOR UPDATE
TO authenticated USING (
    id = auth.uid()
);

-- Allow profile creation during signup (agency_id can be null initially)
CREATE POLICY "RLS_profiles_insert" ON profiles FOR INSERT
TO authenticated WITH CHECK (
    id = auth.uid()
);

-- ----- STUDENTS RLS -----
DROP POLICY IF EXISTS "RLS_students_select" ON students;
DROP POLICY IF EXISTS "RLS_students_insert" ON students;
DROP POLICY IF EXISTS "RLS_students_update" ON students;
DROP POLICY IF EXISTS "RLS_students_delete" ON students;

-- Users can only see students in their agency
CREATE POLICY "RLS_students_select" ON students FOR SELECT
TO authenticated USING (
    agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
);

-- Users can only insert students in their agency
CREATE POLICY "RLS_students_insert" ON students FOR INSERT
TO authenticated WITH CHECK (
    agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
);

-- Users can only update students in their agency
CREATE POLICY "RLS_students_update" ON students FOR UPDATE
TO authenticated USING (
    agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
);

-- Only owners/teachers can delete students in their agency
CREATE POLICY "RLS_students_delete" ON students FOR DELETE
TO authenticated USING (
    agency_id IN (
        SELECT p.agency_id FROM profiles p 
        WHERE p.id = auth.uid() AND p.role IN ('owner', 'teacher')
    )
);

-- ----- ESSAYS RLS (Add agency_id if not exists) -----
ALTER TABLE essays ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id);
CREATE INDEX IF NOT EXISTS idx_essays_agency_id ON essays(agency_id);

DROP POLICY IF EXISTS "Students can view own essays" ON essays;
DROP POLICY IF EXISTS "Students can insert own essays" ON essays;
DROP POLICY IF EXISTS "Students can update own essays" ON essays;
DROP POLICY IF EXISTS "Teachers can view all essays" ON essays;
DROP POLICY IF EXISTS "Teachers can update all essays" ON essays;
DROP POLICY IF EXISTS "RLS_essays_select" ON essays;
DROP POLICY IF EXISTS "RLS_essays_insert" ON essays;
DROP POLICY IF EXISTS "RLS_essays_update" ON essays;

CREATE POLICY "RLS_essays_select" ON essays FOR SELECT
TO authenticated USING (
    agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
    OR student_id = auth.uid()
);

CREATE POLICY "RLS_essays_insert" ON essays FOR INSERT
TO authenticated WITH CHECK (
    agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
    OR student_id = auth.uid()
);

CREATE POLICY "RLS_essays_update" ON essays FOR UPDATE
TO authenticated USING (
    agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
    OR student_id = auth.uid()
);

-- ----- DOCUMENTS RLS (Add agency_id if not exists) -----
ALTER TABLE documents ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id);
CREATE INDEX IF NOT EXISTS idx_documents_agency_id ON documents(agency_id);

DROP POLICY IF EXISTS "RLS_documents_select" ON documents;
DROP POLICY IF EXISTS "RLS_documents_insert" ON documents;
DROP POLICY IF EXISTS "RLS_documents_update" ON documents;

CREATE POLICY "RLS_documents_select" ON documents FOR SELECT
TO authenticated USING (
    agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
    OR student_id = auth.uid()
);

CREATE POLICY "RLS_documents_insert" ON documents FOR INSERT
TO authenticated WITH CHECK (
    agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
    OR student_id = auth.uid()
);

CREATE POLICY "RLS_documents_update" ON documents FOR UPDATE
TO authenticated USING (
    agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
    OR student_id = auth.uid()
);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE agencies IS 'Top-level tenant for multi-tenant B2B SaaS';
COMMENT ON TABLE students IS 'Agency-scoped student records';
COMMENT ON COLUMN profiles.agency_id IS 'Links user to their agency for multi-tenancy';
COMMENT ON FUNCTION get_user_agency_id() IS 'Helper function to get current user agency_id for RLS';
