-- Add missing columns for Sidecar Data
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mother_full_name text,
ADD COLUMN IF NOT EXISTS father_full_name text,
ADD COLUMN IF NOT EXISTS home_address text,
ADD COLUMN IF NOT EXISTS passport_number text;

-- Ensure RLS allows teachers to view these (existing policies likely cover 'select' for authenticated, but good to verify)
-- If policies are "view own profile only", teachers might need a specific policy.
-- Let's add a policy for teachers to view all student profiles just in case.

CREATE POLICY "Teachers can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'teacher'
);
