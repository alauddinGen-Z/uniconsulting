-- Add university preference columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS preferred_regions TEXT[],
ADD COLUMN IF NOT EXISTS budget_level TEXT;

-- Note: preferred_major column likely already exists
