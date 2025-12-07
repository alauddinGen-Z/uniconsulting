-- Add columns for university preferences to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_regions text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preferred_major text,
ADD COLUMN IF NOT EXISTS budget_level text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
