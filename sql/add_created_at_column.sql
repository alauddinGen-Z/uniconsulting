-- Add created_at column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Backfill existing rows (optional, but good for consistency)
UPDATE public.profiles
SET created_at = now()
WHERE created_at IS NULL;
