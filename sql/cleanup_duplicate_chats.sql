-- Cleanup Duplicate Conversations
-- Run this in Supabase SQL Editor to remove duplicate direct chats

-- Step 1: Find and keep only the FIRST (oldest) conversation for each teacher-student pair
WITH ranked_conversations AS (
    SELECT 
        c.id as conversation_id,
        c.teacher_id,
        cp.user_id as student_id,
        ROW_NUMBER() OVER (
            PARTITION BY c.teacher_id, cp.user_id 
            ORDER BY c.created_at ASC
        ) as rn
    FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id
    WHERE c.type = 'direct'
    AND cp.user_id != c.teacher_id  -- Get the student participant
),
duplicates AS (
    SELECT conversation_id
    FROM ranked_conversations
    WHERE rn > 1  -- Keep only duplicates (not the first one)
)
-- First, delete messages from duplicate conversations
DELETE FROM messages 
WHERE conversation_id IN (SELECT conversation_id FROM duplicates);

-- Step 2: Delete participants from duplicate conversations
WITH ranked_conversations AS (
    SELECT 
        c.id as conversation_id,
        c.teacher_id,
        cp.user_id as student_id,
        ROW_NUMBER() OVER (
            PARTITION BY c.teacher_id, cp.user_id 
            ORDER BY c.created_at ASC
        ) as rn
    FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id
    WHERE c.type = 'direct'
    AND cp.user_id != c.teacher_id
),
duplicates AS (
    SELECT conversation_id
    FROM ranked_conversations
    WHERE rn > 1
)
DELETE FROM conversation_participants 
WHERE conversation_id IN (SELECT conversation_id FROM duplicates);

-- Step 3: Delete the duplicate conversations themselves
WITH ranked_conversations AS (
    SELECT 
        c.id as conversation_id,
        c.teacher_id,
        cp.user_id as student_id,
        ROW_NUMBER() OVER (
            PARTITION BY c.teacher_id, cp.user_id 
            ORDER BY c.created_at ASC
        ) as rn
    FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id
    WHERE c.type = 'direct'
    AND cp.user_id != c.teacher_id
),
duplicates AS (
    SELECT conversation_id
    FROM ranked_conversations
    WHERE rn > 1
)
DELETE FROM conversations 
WHERE id IN (SELECT conversation_id FROM duplicates);

-- Verify: Show remaining direct conversations
SELECT 
    c.id, 
    c.type, 
    c.teacher_id,
    p1.full_name as teacher_name, 
    p2.full_name as student_name, 
    c.created_at
FROM conversations c
JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id != c.teacher_id
JOIN profiles p1 ON p1.id = c.teacher_id
JOIN profiles p2 ON p2.id = cp.user_id
WHERE c.type = 'direct'
ORDER BY c.created_at;
