-- Add individual year GPA columns to profiles table
-- Run this in Supabase SQL Editor

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS gpa_9th TEXT,
ADD COLUMN IF NOT EXISTS gpa_10th TEXT,
ADD COLUMN IF NOT EXISTS gpa_11th TEXT,
ADD COLUMN IF NOT EXISTS gpa_12th TEXT;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name LIKE 'gpa%';
