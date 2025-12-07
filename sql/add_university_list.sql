-- =====================================================
-- UNIVERSITY LIST FEATURE
-- Track student's target universities with deadlines
-- =====================================================

-- Create universities table (student's target list)
CREATE TABLE IF NOT EXISTS student_universities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    university_name TEXT NOT NULL,
    country TEXT NOT NULL,
    program TEXT,
    category TEXT CHECK (category IN ('safety', 'match', 'reach')) DEFAULT 'match',
    deadline_type TEXT CHECK (deadline_type IN ('early_decision', 'early_action', 'regular', 'rolling', 'ucas')) DEFAULT 'regular',
    deadline_date DATE,
    application_status TEXT CHECK (application_status IN ('researching', 'preparing', 'submitted', 'accepted', 'rejected', 'waitlisted')) DEFAULT 'researching',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE student_universities ENABLE ROW LEVEL SECURITY;

-- Students can view/manage their own universities
CREATE POLICY "Students can view own universities" ON student_universities
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert own universities" ON student_universities
    FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own universities" ON student_universities
    FOR UPDATE USING (auth.uid() = student_id);

CREATE POLICY "Students can delete own universities" ON student_universities
    FOR DELETE USING (auth.uid() = student_id);

-- Teachers can view their students' universities
CREATE POLICY "Teachers can view student universities" ON student_universities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'teacher'
        )
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_universities_student_id ON student_universities(student_id);
CREATE INDEX IF NOT EXISTS idx_student_universities_deadline ON student_universities(deadline_date);
CREATE INDEX IF NOT EXISTS idx_student_universities_status ON student_universities(application_status);
