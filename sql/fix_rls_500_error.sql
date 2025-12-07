-- EMERGENCY FIX: Drop the problematic RLS policy that's causing 500 errors
-- The issue: The policy does a subquery on profiles table while evaluating RLS on profiles table

DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;

-- Instead, use a simpler approach with JWT claims
-- This policy allows teachers to view all profiles without recursion
CREATE POLICY "Teachers can view all profiles - fixed"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Get role from JWT claims instead of querying profiles table
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'teacher'
  OR 
  -- Users can always view their own profile
  id = auth.uid()
);

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles';
