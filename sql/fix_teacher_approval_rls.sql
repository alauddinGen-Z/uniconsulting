-- Fix: Allow teachers to update student profiles (e.g. approval_status)

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Teachers can update student profiles" ON public.profiles;

-- Create new policy
CREATE POLICY "Teachers can update student profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    -- Allow if the user is a teacher
    public.is_teacher()
)
WITH CHECK (
    -- Allow if the user is a teacher
    public.is_teacher()
);

-- Verify the policy
SELECT * FROM pg_policies WHERE tablename = 'profiles';
