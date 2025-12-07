-- Fix is_teacher() function to properly work with RLS
-- The function needs to SET LOCAL to bypass RLS when checking

-- Recreate the function with proper RLS bypass (using OR REPLACE to avoid dependency issues)
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'teacher'::user_role
    );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;

-- Test the function
SELECT 
    p.email,
    p.role,
    public.is_teacher() as is_teacher_result,
    p.id = auth.uid() as is_current_user
FROM public.profiles p
WHERE p.id = auth.uid();

-- Verify it works for different users
SELECT 
    email,
    role,
    id
FROM public.profiles
ORDER BY created_at DESC;
