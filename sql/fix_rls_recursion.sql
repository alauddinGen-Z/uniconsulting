-- Fix RLS Infinite Recursion
-- Introduces SECURITY DEFINER functions to bypass RLS for self-referential checks

-- 1. Helper Function: Get My Agency ID
CREATE OR REPLACE FUNCTION get_my_agency_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT agency_id FROM profiles WHERE id = auth.uid();
$$;

-- 2. Helper Function: Get My Conversation IDs
CREATE OR REPLACE FUNCTION get_my_conversation_ids()
RETURNS TABLE (conversation_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid();
$$;

-- 3. Fix Profiles Policy
DROP POLICY IF EXISTS "Users can view profiles in same agency" ON profiles;

CREATE POLICY "Users can view profiles in same agency"
ON profiles FOR SELECT
To authenticated
USING (
  agency_id = get_my_agency_id()
  OR id = auth.uid() -- Always allow seeing self
);

-- 4. Fix Conversation Participants Policy
DROP POLICY IF EXISTS "Users can view conversation participants" ON conversation_participants;

CREATE POLICY "Users can view conversation participants"
ON conversation_participants FOR SELECT
TO authenticated
USING (
    -- User can see rows where they are the user
    user_id = auth.uid()
    OR
    -- OR user can see rows for conversations they are part of
    conversation_id IN ( SELECT conversation_id FROM get_my_conversation_ids() )
);

-- 5. Fix Messages Policy
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;

CREATE POLICY "Users can view messages in their conversations"
ON messages FOR SELECT
TO authenticated
USING (
    conversation_id IN ( SELECT conversation_id FROM get_my_conversation_ids() )
);

-- 6. Also optimize "Participants can send messages" to use the function
DROP POLICY IF EXISTS "Participants can send messages" ON messages;

CREATE POLICY "Participants can send messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN ( SELECT conversation_id FROM get_my_conversation_ids() )
);
