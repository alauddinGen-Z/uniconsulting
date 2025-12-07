-- Add preferred country and university columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS preferred_country TEXT,
ADD COLUMN IF NOT EXISTS preferred_university TEXT;

-- Add comment
COMMENT ON COLUMN profiles.preferred_country IS 'Student preferred country to study (e.g., USA, UK, Canada)';
COMMENT ON COLUMN profiles.preferred_university IS 'Student preferred university or program';
