-- ============================================================================
-- COMPLETE FIX: All RLS policies with is_teacher() function
-- Run this to fix ALL 500 errors
-- ============================================================================

-- First, create the helper function (safe to run multiple times)
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'teacher'
    );
$$;

-- ============================================================================
-- CONVERSATION_PARTICIPANTS - This is causing the 500 error!
-- ============================================================================

DROP POLICY IF EXISTS "participants_select" ON conversation_participants;
DROP POLICY IF EXISTS "participants_insert" ON conversation_participants;
DROP POLICY IF EXISTS "participants_update" ON conversation_participants;
DROP POLICY IF EXISTS "part_select" ON conversation_participants;
DROP POLICY IF EXISTS "part_insert" ON conversation_participants;
DROP POLICY IF EXISTS "part_update" ON conversation_participants;

-- Simple policies - user can see/update their own participation
CREATE POLICY "participants_select" ON conversation_participants FOR SELECT
    USING (user_id = (select auth.uid()));

CREATE POLICY "participants_insert" ON conversation_participants FOR INSERT
    WITH CHECK (true);  -- Anyone authenticated can be added

CREATE POLICY "participants_update" ON conversation_participants FOR UPDATE
    USING (user_id = (select auth.uid()));

-- ============================================================================
-- CONVERSATIONS
-- ============================================================================

DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "conversations_insert" ON conversations;
DROP POLICY IF EXISTS "conversations_update" ON conversations;
DROP POLICY IF EXISTS "conversations_delete" ON conversations;
DROP POLICY IF EXISTS "conv_select" ON conversations;
DROP POLICY IF EXISTS "conv_insert" ON conversations;
DROP POLICY IF EXISTS "conv_update" ON conversations;

CREATE POLICY "conversations_select" ON conversations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants 
            WHERE conversation_id = conversations.id 
            AND user_id = (select auth.uid())
        )
    );

CREATE POLICY "conversations_insert" ON conversations FOR INSERT
    WITH CHECK (true);  -- Anyone authenticated can create

CREATE POLICY "conversations_update" ON conversations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants 
            WHERE conversation_id = conversations.id 
            AND user_id = (select auth.uid())
        )
    );

-- ============================================================================
-- MESSAGES
-- ============================================================================

DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
DROP POLICY IF EXISTS "msg_select" ON messages;
DROP POLICY IF EXISTS "msg_insert" ON messages;
DROP POLICY IF EXISTS "msg_update" ON messages;

CREATE POLICY "messages_select" ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants 
            WHERE conversation_id = messages.conversation_id 
            AND user_id = (select auth.uid())
        )
    );

CREATE POLICY "messages_insert" ON messages FOR INSERT
    WITH CHECK (sender_id = (select auth.uid()));

CREATE POLICY "messages_update" ON messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants 
            WHERE conversation_id = messages.conversation_id 
            AND user_id = (select auth.uid())
        )
    );
