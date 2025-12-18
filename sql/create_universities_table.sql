-- ============================================================================
-- UNIVERSITIES LOOKUP TABLE
-- Master list of universities for application tracking and AI matching
-- Run this file completely in one execution.
-- ============================================================================

-- Drop existing objects if they exist (for clean re-creation)
DROP TRIGGER IF EXISTS trigger_universities_updated_at ON public.universities;
DROP FUNCTION IF EXISTS update_universities_updated_at();
DROP POLICY IF EXISTS "Users can read all listed universities." ON public.universities;
DROP TABLE IF EXISTS public.universities CASCADE;

-- Create the universities lookup table
CREATE TABLE public.universities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    university_name TEXT NOT NULL,
    country TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint for upsert operations
ALTER TABLE public.universities 
ADD CONSTRAINT universities_name_unique UNIQUE (university_name);

-- Create index for faster country-based queries
CREATE INDEX idx_universities_country ON public.universities(country);

-- Create index for faster name searches  
CREATE INDEX idx_universities_name ON public.universities(university_name);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on the table
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read the university list
CREATE POLICY "Users can read all listed universities."
ON public.universities FOR SELECT TO authenticated
USING ( true );

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_universities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_universities_updated_at
    BEFORE UPDATE ON public.universities
    FOR EACH ROW
    EXECUTE FUNCTION update_universities_updated_at();
