-- ============================================================================
-- FIX: Enable RLS on essay_versions table
-- Run this ONLY for essay_versions (it's missing RLS)
-- ============================================================================

ALTER TABLE essay_versions ENABLE ROW LEVEL SECURITY;

-- Students can view their own essay versions, teachers can view all
CREATE POLICY "essay_versions_select" ON essay_versions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM essays 
            WHERE essays.id = essay_versions.essay_id 
            AND (
                essays.student_id = (select auth.uid())
                OR
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE id = (select auth.uid()) AND role = 'teacher'
                )
            )
        )
    );

-- Only essay owner can insert versions
CREATE POLICY "essay_versions_insert" ON essay_versions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM essays 
            WHERE essays.id = essay_versions.essay_id 
            AND essays.student_id = (select auth.uid())
        )
    );

-- Only essay owner can delete versions  
CREATE POLICY "essay_versions_delete" ON essay_versions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM essays 
            WHERE essays.id = essay_versions.essay_id 
            AND essays.student_id = (select auth.uid())
        )
    );
