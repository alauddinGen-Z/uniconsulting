-- Essay Version Control ("Time Travel" Feature)
-- Stores historical versions of essays for recovery

-- Create essay_versions table
CREATE TABLE IF NOT EXISTS essay_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    essay_id UUID NOT NULL REFERENCES essays(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    word_count INTEGER,
    version_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure unique version numbers per essay
    CONSTRAINT unique_version_per_essay UNIQUE (essay_id, version_number)
);

-- Create index for fast lookups by essay_id
CREATE INDEX IF NOT EXISTS idx_essay_versions_essay_id ON essay_versions(essay_id);

-- RLS Policies
ALTER TABLE essay_versions ENABLE ROW LEVEL SECURITY;

-- Students can view their own essay versions
CREATE POLICY "Students can view own essay versions"
    ON essay_versions FOR SELECT
    USING (
        essay_id IN (
            SELECT id FROM essays WHERE student_id = auth.uid()
        )
    );

-- Students can insert versions for their own essays
CREATE POLICY "Students can create own essay versions"
    ON essay_versions FOR INSERT
    WITH CHECK (
        essay_id IN (
            SELECT id FROM essays WHERE student_id = auth.uid()
        )
    );

-- Teachers can view all essay versions (for students they mentor)
CREATE POLICY "Teachers can view student essay versions"
    ON essay_versions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'teacher'
        )
    );

-- Grant permissions
GRANT SELECT, INSERT ON essay_versions TO authenticated;
