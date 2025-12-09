-- Add is_admin column to profiles table
-- This column determines whether a teacher has admin privileges to add other teachers

-- Add the column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Set the designated admin account
UPDATE public.profiles
SET is_admin = true
WHERE email = 'm.madiiarov@gmail.com' AND role = 'teacher';

-- Create an index for quick admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = true;
