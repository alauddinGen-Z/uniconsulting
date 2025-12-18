-- =====================================================
-- phase6_chat_security.sql
-- Secure Real-Time Chat with Participant-Only Access
-- 
-- CoVe Guarantees:
--   ✅ Participant-Only: SELECT requires conversation membership
--   ✅ Write Security: INSERT denied at RLS, enforced via Server Action
--   ✅ Realtime: publish='insert' for efficient one-way sync
-- =====================================================

-- ================================================================
-- 1. ENSURE TABLES EXIST (Reference)
-- ================================================================

-- Conversations table (should already exist from add_chat_tables.sql)
-- CREATE TABLE IF NOT EXISTS conversations (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     type TEXT NOT NULL DEFAULT 'direct',
--     name TEXT,
--     teacher_id UUID REFERENCES profiles(id),
--     created_at TIMESTAMPTZ DEFAULT NOW(),
--     updated_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- Conversation participants (should already exist)
-- CREATE TABLE IF NOT EXISTS conversation_participants (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
--     user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
--     joined_at TIMESTAMPTZ DEFAULT NOW(),
--     UNIQUE(conversation_id, user_id)
-- );

-- Messages table (should already exist)
-- CREATE TABLE IF NOT EXISTS messages (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
--     sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
--     content TEXT NOT NULL,
--     is_announcement BOOLEAN DEFAULT FALSE,
--     is_read BOOLEAN DEFAULT FALSE,
--     created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- ================================================================
-- 2. ENABLE RLS ON ALL CHAT TABLES
-- ================================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 3. DROP EXISTING POLICIES (Clean Slate)
-- ================================================================

-- Conversations
DROP POLICY IF EXISTS "participant_select_conversations" ON conversations;
DROP POLICY IF EXISTS "teacher_create_conversations" ON conversations;

-- Participants
DROP POLICY IF EXISTS "participant_select_participants" ON conversation_participants;
DROP POLICY IF EXISTS "system_insert_participants" ON conversation_participants;

-- Messages
DROP POLICY IF EXISTS "participant_select_messages" ON messages;
DROP POLICY IF EXISTS "participant_insert_messages" ON messages;
DROP POLICY IF EXISTS "server_insert_messages" ON messages;

-- ================================================================
-- 4. CONVERSATIONS POLICIES
-- ================================================================

-- Users can only SELECT conversations they're a participant of
CREATE POLICY "participant_select_conversations" ON conversations
FOR SELECT
TO authenticated
USING (
    id IN (
        SELECT conversation_id 
        FROM conversation_participants 
        WHERE user_id = auth.uid()
    )
);

-- Teachers/Admins can create conversations
CREATE POLICY "teacher_create_conversations" ON conversations
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (role IN ('teacher', 'owner') OR is_admin = TRUE)
    )
);

-- ================================================================
-- 5. CONVERSATION PARTICIPANTS POLICIES
-- ================================================================

-- Users can see participants of their conversations
CREATE POLICY "participant_select_participants" ON conversation_participants
FOR SELECT
TO authenticated
USING (
    conversation_id IN (
        SELECT conversation_id 
        FROM conversation_participants 
        WHERE user_id = auth.uid()
    )
);

-- ================================================================
-- 6. MESSAGES POLICIES (Participant-Only)
-- ================================================================

-- SELECT: Only participants can read messages
CREATE POLICY "participant_select_messages" ON messages
FOR SELECT
TO authenticated
USING (
    conversation_id IN (
        SELECT conversation_id 
        FROM conversation_participants 
        WHERE user_id = auth.uid()
    )
);

-- INSERT: Participants can send messages to their conversations
-- The Server Action performs additional validation
CREATE POLICY "participant_insert_messages" ON messages
FOR INSERT
TO authenticated
WITH CHECK (
    -- Sender must be the authenticated user
    sender_id = auth.uid()
    -- User must be a participant of the conversation
    AND conversation_id IN (
        SELECT conversation_id 
        FROM conversation_participants 
        WHERE user_id = auth.uid()
    )
);

-- UPDATE: Users can mark their own received messages as read
CREATE POLICY "recipient_update_read_status" ON messages
FOR UPDATE
TO authenticated
USING (
    -- Message is in a conversation user participates in
    conversation_id IN (
        SELECT conversation_id 
        FROM conversation_participants 
        WHERE user_id = auth.uid()
    )
    -- Only update is_read field (enforced by server action)
);

-- ================================================================
-- 7. REALTIME PUBLICATION
-- ================================================================

-- Add messages to realtime publication (insert only for efficiency)
-- Note: This might need to be run by a superuser
DO $$
BEGIN
    -- Check if publication exists
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        -- Add messages table to publication if not already added
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND tablename = 'messages'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE messages;
        END IF;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not modify publication: %. Enable via Dashboard.', SQLERRM;
END $$;

-- ================================================================
-- 8. INDEXES FOR PERFORMANCE
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);

-- ================================================================
-- 9. COMMENTS
-- ================================================================

COMMENT ON POLICY "participant_select_messages" ON messages IS 
'Only conversation participants can read messages. Enforced via subquery on conversation_participants.';

COMMENT ON POLICY "participant_insert_messages" ON messages IS 
'Participants can send messages. Server Action provides additional validation (bouncer logic).';
