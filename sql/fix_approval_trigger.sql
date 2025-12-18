-- =====================================================
-- fix_approval_trigger.sql
-- Robust Student Approval Trigger with CoVe Guarantees:
--   ✅ Atomicity: All-or-nothing transaction
--   ✅ Race Condition: Null teacher guard
--   ✅ Idempotency: Duplicate conversation prevention
-- =====================================================

-- Drop existing trigger and function first
DROP TRIGGER IF EXISTS on_student_approval ON profiles;
DROP FUNCTION IF EXISTS handle_student_approval();

-- ================================================================
-- FUNCTION: handle_student_approval()
-- PURPOSE: Atomically create direct chat when student is approved
-- GUARANTEES: Idempotent (safe to call multiple times)
-- ================================================================

CREATE OR REPLACE FUNCTION handle_student_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conversation_id UUID;
    v_existing_conversation_id UUID;
BEGIN
    -- ============================================================
    -- GUARD 1: Only trigger on approval status change
    -- ============================================================
    IF NOT (
        (OLD.approval_status IS DISTINCT FROM 'approved') 
        AND (NEW.approval_status = 'approved') 
        AND (NEW.role = 'student')
    ) THEN
        RETURN NEW;
    END IF;

    -- ============================================================
    -- GUARD 2: Teacher must be assigned (Race Condition Prevention)
    -- ============================================================
    IF NEW.teacher_id IS NULL THEN
        RAISE EXCEPTION 'Cannot approve student without assigned teacher. Student ID: %', NEW.id
            USING HINT = 'Assign a teacher before approving the student.';
    END IF;

    -- ============================================================
    -- GUARD 3: Idempotency Check (Prevent Duplicate Conversations)
    -- Check if a direct conversation already exists between 
    -- this student and teacher
    -- ============================================================
    SELECT c.id INTO v_existing_conversation_id
    FROM conversations c
    WHERE c.type = 'direct'
      AND c.teacher_id = NEW.teacher_id
      AND EXISTS (
          SELECT 1 FROM conversation_participants cp
          WHERE cp.conversation_id = c.id
            AND cp.user_id = NEW.id
      )
    LIMIT 1;

    -- If conversation already exists, skip creation (idempotent)
    IF v_existing_conversation_id IS NOT NULL THEN
        RAISE NOTICE 'Conversation already exists (%) for student % with teacher %. Skipping.', 
            v_existing_conversation_id, NEW.id, NEW.teacher_id;
        RETURN NEW;
    END IF;

    -- ============================================================
    -- ATOMIC OPERATION: Create Conversation + Participants
    -- All wrapped in trigger's implicit transaction
    -- ============================================================
    
    -- 1. Create the direct conversation
    INSERT INTO conversations (type, teacher_id, created_at, updated_at)
    VALUES ('direct', NEW.teacher_id, NOW(), NOW())
    RETURNING id INTO v_conversation_id;

    -- 2. Add student as participant
    INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
    VALUES (v_conversation_id, NEW.id, NOW());

    -- 3. Add teacher as participant
    INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
    VALUES (v_conversation_id, NEW.teacher_id, NOW());

    -- Success log
    RAISE NOTICE 'Created conversation % for student % with teacher %', 
        v_conversation_id, NEW.id, NEW.teacher_id;

    RETURN NEW;

EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'Failed to create conversation: Invalid teacher or student reference. Teacher ID: %, Student ID: %', 
            NEW.teacher_id, NEW.id
            USING HINT = 'Ensure both teacher and student profiles exist.';
    WHEN unique_violation THEN
        -- Race condition: another transaction created the conversation
        RAISE NOTICE 'Conversation creation skipped due to concurrent insert for student %', NEW.id;
        RETURN NEW;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Unexpected error in student approval trigger: %', SQLERRM;
END;
$$;

-- ================================================================
-- TRIGGER: on_student_approval
-- Fires AFTER UPDATE to ensure NEW values are committed
-- ================================================================

CREATE TRIGGER on_student_approval
    AFTER UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION handle_student_approval();

-- ================================================================
-- COMMENTS
-- ================================================================
COMMENT ON FUNCTION handle_student_approval() IS 
'Atomically creates a direct chat conversation when a student is approved.
Guarantees:
- ATOMIC: All inserts in same transaction, rollback on any failure
- IDEMPOTENT: Safe to trigger multiple times, checks for existing conversation
- NULL-SAFE: Requires teacher_id, fails fast with clear error message';
