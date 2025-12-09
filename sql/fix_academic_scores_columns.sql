-- =====================================================
-- FIX ALL PROFILE COLUMNS - COMPREHENSIVE
-- Run this in Supabase SQL Editor to ensure all columns exist
-- =====================================================

-- Add ALL required columns for auto-extraction
ALTER TABLE profiles 
-- Academic score columns
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
ADD COLUMN IF NOT EXISTS gpa_9th TEXT,
ADD COLUMN IF NOT EXISTS gpa_10th TEXT,
ADD COLUMN IF NOT EXISTS gpa_11th TEXT,
ADD COLUMN IF NOT EXISTS gpa_12th TEXT,
ADD COLUMN IF NOT EXISTS school_system TEXT,
ADD COLUMN IF NOT EXISTS toefl_total TEXT,
-- Passport/Identity columns
ADD COLUMN IF NOT EXISTS nationality TEXT,
ADD COLUMN IF NOT EXISTS passport_number TEXT,
ADD COLUMN IF NOT EXISTS passport_expiry DATE,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS city_of_birth TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT;

-- Verify all columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;
