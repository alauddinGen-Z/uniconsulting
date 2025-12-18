-- ============================================================================
-- UNIVERSITIES TABLE: PERFORMANCE OPTIMIZATION
-- Run this AFTER the initial table creation and seeding
-- ============================================================================

-- Enable pg_trgm extension for efficient ILIKE/pattern matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram indexes for fast pattern matching with ILIKE
-- These indexes support queries like: WHERE university_name ILIKE '%harvard%'
CREATE INDEX IF NOT EXISTS idx_universities_name_trgm 
ON public.universities 
USING GIN (university_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_universities_country_trgm 
ON public.universities 
USING GIN (country gin_trgm_ops);

-- Analyze the table to update statistics for query planner
ANALYZE public.universities;

-- Verify index creation
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'universities';
