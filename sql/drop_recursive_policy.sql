-- Remove redundant and recursive policy on profiles
-- Since 'Read_All_Profiles' exists, this specific policy is causing recursion without adding value (currently).

DROP POLICY IF EXISTS "Users can view profiles in same agency" ON profiles;

-- Note: We are relying on 'Read_All_Profiles' which was seen in pg_policies. 
-- If that policy is ever removed, we will need a non-recursive replacement.
