-- Add is_admin column to profiles table
-- This column determines whether a teacher has admin privileges to add other teachers

-- Add the column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Set the designated admin account - CHANGE ROLE TO TEACHER AND SET ADMIN
-- This will convert the account to teacher role if it's currently a student
UPDATE public.profiles
SET 
    role = 'teacher',
    is_admin = true,
    approval_status = 'approved',
    teacher_id = NULL  -- Teachers don't have a teacher assigned
WHERE email = 'm.madiiarov@gmail.com';

-- Create an index for quick admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = true;
