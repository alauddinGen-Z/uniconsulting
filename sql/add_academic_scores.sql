-- =====================================================
-- ADD ACADEMIC SCORES COLUMNS TO PROFILES
-- Run this in Supabase SQL Editor
-- =====================================================

-- Add academic score columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS ielts_overall TEXT,
ADD COLUMN IF NOT EXISTS ielts_listening TEXT,
ADD COLUMN IF NOT EXISTS ielts_reading TEXT,
ADD COLUMN IF NOT EXISTS ielts_writing TEXT,
ADD COLUMN IF NOT EXISTS ielts_speaking TEXT,
ADD COLUMN IF NOT EXISTS sat_total TEXT,
ADD COLUMN IF NOT EXISTS sat_math TEXT,
ADD COLUMN IF NOT EXISTS sat_reading TEXT,
ADD COLUMN IF NOT EXISTS gpa TEXT,
ADD COLUMN IF NOT EXISTS gpa_scale TEXT,
ADD COLUMN IF NOT EXISTS preferred_university TEXT,
ADD COLUMN IF NOT EXISTS preferred_country TEXT;

-- Confirm changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;
