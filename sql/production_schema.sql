-- 1. UPDATE ENUMS
ALTER TYPE doc_type ADD VALUE IF NOT EXISTS 'Personal_Statement';
ALTER TYPE doc_type ADD VALUE IF NOT EXISTS 'Other';

-- Create approval_status enum if not exists
DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. UPDATE PROFILES
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approval_status approval_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS passport_number TEXT,
ADD COLUMN IF NOT EXISTS home_address TEXT,
ADD COLUMN IF NOT EXISTS mother_full_name TEXT,
ADD COLUMN IF NOT EXISTS father_full_name TEXT,
ADD COLUMN IF NOT EXISTS personal_statement TEXT,
ADD COLUMN IF NOT EXISTS volunteering_hours INTEGER;

-- 3. UPDATE DOCUMENTS
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;

-- 4. UPDATE READINESS VIEW
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
    -- Personal Statement (either as text in profile or uploaded doc)
    (
        p.personal_statement IS NOT NULL OR 
        EXISTS(SELECT 1 FROM documents d WHERE d.student_id = p.id AND d.type = 'Personal_Statement')
    ) AND
    -- Mother's Name and Address filled
    p.mother_full_name IS NOT NULL AND
    p.home_address IS NOT NULL
  ) as is_ready
FROM profiles p
WHERE p.role = 'student';
