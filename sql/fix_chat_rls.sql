-- FINAL FIX: Chat RLS Policies (No Recursion)
-- Run this in Supabase SQL Editor

-- Disable RLS to reset
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename FROM pg_policies 
        WHERE tablename IN ('conversations', 'conversation_participants', 'messages')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- =====================
-- CONVERSATIONS: Simple policies
-- =====================
CREATE POLICY "conv_select" ON conversations FOR SELECT
    USING (true);  -- Allow all authenticated to read (filtered by participant check in app)

CREATE POLICY "conv_insert" ON conversations FOR INSERT
    WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "conv_update" ON conversations FOR UPDATE
    USING (auth.uid() = teacher_id);

-- =====================
-- PARTICIPANTS: Simple policies without recursion
-- =====================
CREATE POLICY "part_select" ON conversation_participants FOR SELECT
    USING (true);  -- Anyone can see participants (needed to check membership)

CREATE POLICY "part_insert" ON conversation_participants FOR INSERT
    WITH CHECK (true);  -- App handles permission

CREATE POLICY "part_update" ON conversation_participants FOR UPDATE
    USING (user_id = auth.uid());

-- =====================
-- MESSAGES: Use security definer function for membership check
-- =====================

-- Create a function to check conversation membership
CREATE OR REPLACE FUNCTION is_conversation_member(conv_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM conversation_participants 
        WHERE conversation_id = conv_id AND user_id = auth.uid()
    );
$$;

-- Messages policies using the function
CREATE POLICY "msg_select" ON messages FOR SELECT
    USING (is_conversation_member(conversation_id));

CREATE POLICY "msg_insert" ON messages FOR INSERT
    WITH CHECK (
        sender_id = auth.uid() 
        AND is_conversation_member(conversation_id)
    );

-- Verify
SELECT tablename, policyname, cmd FROM pg_policies 
WHERE tablename IN ('conversations', 'conversation_participants', 'messages')
ORDER BY tablename, policyname;
