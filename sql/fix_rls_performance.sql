-- ============================================================================
-- RLS POLICY PERFORMANCE OPTIMIZATION
-- ============================================================================
-- This migration fixes two performance issues detected by Supabase linter:
-- 1. auth.uid() being re-evaluated for each row (wrap in subselect)
-- 2. Multiple permissive policies for same role/action (consolidate)
-- ============================================================================

-- ============================================================================
-- ESSAY_VERSIONS TABLE - Enable RLS and create policies
-- Schema: id, essay_id, content, word_count, version_number, created_at
-- ============================================================================

ALTER TABLE essay_versions ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "essay_versions_insert" ON essay_versions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM essays 
            WHERE essays.id = essay_versions.essay_id 
            AND essays.student_id = (select auth.uid())
        )
    );

CREATE POLICY "essay_versions_delete" ON essay_versions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM essays 
            WHERE essays.id = essay_versions.essay_id 
            AND essays.student_id = (select auth.uid())
        )
    );

-- ============================================================================
-- PROFILES TABLE - Consolidate and optimize policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Read access policy" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Insert access policy" ON profiles;
DROP POLICY IF EXISTS "Update access policy" ON profiles;
DROP POLICY IF EXISTS "Teachers can update student profiles" ON profiles;

-- Create optimized policies with (select auth.uid())
CREATE POLICY "profiles_select" ON profiles FOR SELECT
    USING (true);  -- All authenticated users can view profiles

CREATE POLICY "profiles_insert" ON profiles FOR INSERT
    WITH CHECK (id = (select auth.uid()));

CREATE POLICY "profiles_update" ON profiles FOR UPDATE
    USING (
        id = (select auth.uid()) 
        OR 
        EXISTS (
            SELECT 1 FROM profiles p2
            WHERE p2.id = (select auth.uid()) AND p2.role = 'teacher'
        )
    );

-- ============================================================================
-- DOCUMENTS TABLE - Consolidate and optimize policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;
DROP POLICY IF EXISTS "Students can view own docs" ON documents;
DROP POLICY IF EXISTS "Students can insert own docs" ON documents;
DROP POLICY IF EXISTS "Teachers can view all docs" ON documents;
DROP POLICY IF EXISTS "Teachers can update all docs" ON documents;
DROP POLICY IF EXISTS "Teachers can insert docs for students" ON documents;
DROP POLICY IF EXISTS "Approved students can upload documents" ON documents;
DROP POLICY IF EXISTS "Approved students can update their documents" ON documents;

-- Create optimized consolidated policies
CREATE POLICY "documents_select" ON documents FOR SELECT
    USING (
        student_id = (select auth.uid())
        OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = (select auth.uid()) AND role = 'teacher'
        )
    );

CREATE POLICY "documents_insert" ON documents FOR INSERT
    WITH CHECK (
        student_id = (select auth.uid())
        OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = (select auth.uid()) AND role = 'teacher'
        )
    );

CREATE POLICY "documents_update" ON documents FOR UPDATE
    USING (
        student_id = (select auth.uid())
        OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = (select auth.uid()) AND role = 'teacher'
        )
    );

CREATE POLICY "documents_delete" ON documents FOR DELETE
    USING (student_id = (select auth.uid()));

-- ============================================================================
-- ESSAYS TABLE - Consolidate and optimize policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Students can view own essays" ON essays;
DROP POLICY IF EXISTS "Students can insert own essays" ON essays;
DROP POLICY IF EXISTS "Students can update own essays" ON essays;
DROP POLICY IF EXISTS "Students can delete own essays" ON essays;
DROP POLICY IF EXISTS "Teachers can view all essays" ON essays;
DROP POLICY IF EXISTS "Teachers can update all essays" ON essays;

-- Create optimized consolidated policies
CREATE POLICY "essays_select" ON essays FOR SELECT
    USING (
        student_id = (select auth.uid())
        OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = (select auth.uid()) AND role = 'teacher'
        )
    );

CREATE POLICY "essays_insert" ON essays FOR INSERT
    WITH CHECK (student_id = (select auth.uid()));

CREATE POLICY "essays_update" ON essays FOR UPDATE
    USING (
        student_id = (select auth.uid())
        OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = (select auth.uid()) AND role = 'teacher'
        )
    );

CREATE POLICY "essays_delete" ON essays FOR DELETE
    USING (student_id = (select auth.uid()));

-- ============================================================================
-- STUDENT_UNIVERSITIES TABLE - Consolidate and optimize policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Students can view own universities" ON student_universities;
DROP POLICY IF EXISTS "Students can insert own universities" ON student_universities;
DROP POLICY IF EXISTS "Students can update own universities" ON student_universities;
DROP POLICY IF EXISTS "Students can delete own universities" ON student_universities;
DROP POLICY IF EXISTS "Teachers can view student universities" ON student_universities;

-- Create optimized consolidated policies
CREATE POLICY "student_universities_select" ON student_universities FOR SELECT
    USING (
        student_id = (select auth.uid())
        OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = (select auth.uid()) AND role = 'teacher'
        )
    );

CREATE POLICY "student_universities_insert" ON student_universities FOR INSERT
    WITH CHECK (student_id = (select auth.uid()));

CREATE POLICY "student_universities_update" ON student_universities FOR UPDATE
    USING (student_id = (select auth.uid()));

CREATE POLICY "student_universities_delete" ON student_universities FOR DELETE
    USING (student_id = (select auth.uid()));

-- ============================================================================
-- CONVERSATIONS TABLE - Optimize policies
-- Schema: id, type, name, teacher_id, created_at, updated_at
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "conv_select" ON conversations;
DROP POLICY IF EXISTS "conv_insert" ON conversations;
DROP POLICY IF EXISTS "conv_update" ON conversations;
DROP POLICY IF EXISTS "conv_delete" ON conversations;

-- Create optimized policies
CREATE POLICY "conversations_select" ON conversations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants 
            WHERE conversation_id = conversations.id 
            AND user_id = (select auth.uid())
        )
    );

CREATE POLICY "conversations_insert" ON conversations FOR INSERT
    WITH CHECK (
        -- Teacher can create, or user is a participant
        teacher_id = (select auth.uid())
        OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = (select auth.uid())
        )
    );

CREATE POLICY "conversations_update" ON conversations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants 
            WHERE conversation_id = conversations.id 
            AND user_id = (select auth.uid())
        )
    );

CREATE POLICY "conversations_delete" ON conversations FOR DELETE
    USING (teacher_id = (select auth.uid()));

-- ============================================================================
-- CONVERSATION_PARTICIPANTS TABLE - Optimize policies
-- Schema: id, conversation_id, user_id, joined_at, last_read_at
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "part_select" ON conversation_participants;
DROP POLICY IF EXISTS "part_insert" ON conversation_participants;
DROP POLICY IF EXISTS "part_update" ON conversation_participants;
DROP POLICY IF EXISTS "part_delete" ON conversation_participants;

-- Create optimized policies
CREATE POLICY "participants_select" ON conversation_participants FOR SELECT
    USING (
        user_id = (select auth.uid())
        OR
        EXISTS (
            SELECT 1 FROM conversation_participants cp2 
            WHERE cp2.conversation_id = conversation_participants.conversation_id 
            AND cp2.user_id = (select auth.uid())
        )
    );

CREATE POLICY "participants_insert" ON conversation_participants FOR INSERT
    WITH CHECK (
        -- Anyone authenticated can be added as participant
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = (select auth.uid())
        )
    );

CREATE POLICY "participants_update" ON conversation_participants FOR UPDATE
    USING (user_id = (select auth.uid()));

-- ============================================================================
-- MESSAGES TABLE - Optimize policies
-- Schema: id, conversation_id, sender_id, content, is_announcement, created_at, is_read
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "msg_select" ON messages;
DROP POLICY IF EXISTS "msg_insert" ON messages;
DROP POLICY IF EXISTS "msg_update" ON messages;

-- Create optimized policies
CREATE POLICY "messages_select" ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants 
            WHERE conversation_id = messages.conversation_id 
            AND user_id = (select auth.uid())
        )
    );

CREATE POLICY "messages_insert" ON messages FOR INSERT
    WITH CHECK (
        sender_id = (select auth.uid())
        AND
        EXISTS (
            SELECT 1 FROM conversation_participants 
            WHERE conversation_id = messages.conversation_id 
            AND user_id = (select auth.uid())
        )
    );

CREATE POLICY "messages_update" ON messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants 
            WHERE conversation_id = messages.conversation_id 
            AND user_id = (select auth.uid())
        )
    );
