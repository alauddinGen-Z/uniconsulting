-- Fix Foreign Key and Update Messages Table
-- Run this in Supabase SQL Editor

-- Add foreign key from messages.sender_id to profiles.id (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'messages_sender_id_fkey' 
        AND table_name = 'messages'
    ) THEN
        ALTER TABLE messages 
        ADD CONSTRAINT messages_sender_id_fkey 
        FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key from conversation_participants.user_id to profiles.id (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'conversation_participants_user_id_fkey' 
        AND table_name = 'conversation_participants'
    ) THEN
        ALTER TABLE conversation_participants 
        ADD CONSTRAINT conversation_participants_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Also ensure conversations.teacher_id references profiles
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'conversations_teacher_id_fkey' 
        AND table_name = 'conversations'
    ) THEN
        ALTER TABLE conversations 
        ADD CONSTRAINT conversations_teacher_id_fkey 
        FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Clean up orphaned conversations (without participants)
DELETE FROM conversations 
WHERE id NOT IN (SELECT DISTINCT conversation_id FROM conversation_participants);

-- Verify the structure
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name IN ('conversations', 'conversation_participants', 'messages')
AND tc.constraint_type = 'FOREIGN KEY';
