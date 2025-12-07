-- =====================================================
-- COMPREHENSIVE SCHEMA FIX FOR UNICONSULTING
-- This migration adds all missing columns and tables
-- =====================================================

-- 1. Create approval_status enum if not exists
DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add missing columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approval_status approval_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS passport_number TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS home_address TEXT,
ADD COLUMN IF NOT EXISTS mother_full_name TEXT,
ADD COLUMN IF NOT EXISTS father_full_name TEXT,
ADD COLUMN IF NOT EXISTS personal_statement TEXT,
ADD COLUMN IF NOT EXISTS volunteering_hours INTEGER,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Create essays table
CREATE TABLE IF NOT EXISTS essays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS on essays table
ALTER TABLE essays ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS policies for essays
DROP POLICY IF EXISTS "Students can view own essays" ON essays;
CREATE POLICY "Students can view own essays" ON essays 
  FOR SELECT 
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert own essays" ON essays;
CREATE POLICY "Students can insert own essays" ON essays 
  FOR INSERT 
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update own essays" ON essays;
CREATE POLICY "Students can update own essays" ON essays 
  FOR UPDATE 
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Teachers can view all essays" ON essays;
CREATE POLICY "Teachers can view all essays" ON essays 
  FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  );

DROP POLICY IF EXISTS "Teachers can update all essays" ON essays;
CREATE POLICY "Teachers can update all essays" ON essays 
  FOR UPDATE 
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  );

-- 6. Update student_readiness view
DROP VIEW IF EXISTS student_readiness;

CREATE OR REPLACE VIEW student_readiness AS
SELECT 
  p.id as student_id,
  p.full_name,
  p.email,
  p.phone,
  p.approval_status,
  p.teacher_id,
  (
    -- Passport Uploaded
    EXISTS(SELECT 1 FROM documents d WHERE d.student_id = p.id AND d.type = 'Passport') AND
    -- GPA Uploaded
    EXISTS(SELECT 1 FROM documents d WHERE d.student_id = p.id AND d.type = 'GPA') AND
    -- Language Test (IELTS or TOEFL)
    (
      EXISTS(SELECT 1 FROM documents d WHERE d.student_id = p.id AND d.type = 'IELTS') OR
      EXISTS(SELECT 1 FROM documents d WHERE d.student_id = p.id AND d.type = 'TOEFL')
    )
  ) as is_ready
FROM profiles p
WHERE p.role = 'student';

-- 7. Add index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_teacher_id ON profiles(teacher_id);
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_essays_student_id ON essays(student_id);
CREATE INDEX IF NOT EXISTS idx_documents_student_id ON documents(student_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);

-- 8. Update existing teacher profiles to have approval_status = 'approved'
UPDATE profiles 
SET approval_status = 'approved' 
WHERE role = 'teacher' AND approval_status IS NULL;

-- 9. Grant access to student_readiness view
GRANT SELECT ON student_readiness TO authenticated;

COMMENT ON TABLE essays IS 'Stores student essays and personal statements';
COMMENT ON COLUMN profiles.teacher_id IS 'Reference to the teacher assigned to this student';
COMMENT ON COLUMN profiles.approval_status IS 'Student approval status: pending, approved, or rejected';
