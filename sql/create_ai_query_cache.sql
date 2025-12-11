-- ============================================================================
-- AI QUERY CACHE TABLE
-- Purpose: Cache AI API responses to avoid duplicate API calls and reduce costs
-- Run this migration in Supabase SQL Editor
-- ============================================================================

-- 1. Create the query type enum
DO $$ BEGIN
    CREATE TYPE ai_query_type AS ENUM ('ocr', 'essay_review', 'university_match');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create the cache table
CREATE TABLE IF NOT EXISTS ai_query_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- The SHA-256 hash of the input (prompt + document content)
    input_hash TEXT NOT NULL,
    
    -- Type of AI query for filtering and analytics
    query_type ai_query_type NOT NULL,
    
    -- The cached response from the AI
    response_json JSONB NOT NULL,
    
    -- Token usage tracking (optional, for cost analysis)
    tokens_used INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Optional: expires_at for TTL-based cache invalidation
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    
    -- Unique constraint on hash + type to prevent duplicates
    CONSTRAINT unique_cache_entry UNIQUE (input_hash, query_type)
);

-- 3. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_cache_lookup 
ON ai_query_cache (input_hash, query_type);

-- 4. Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires 
ON ai_query_cache (expires_at);

-- 5. Enable RLS
ALTER TABLE ai_query_cache ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies - Allow authenticated users to read/write cache
-- Cache is shared across users for efficiency (same document = same result)
CREATE POLICY "ai_cache_select" ON ai_query_cache 
FOR SELECT TO authenticated 
USING (true);

CREATE POLICY "ai_cache_insert" ON ai_query_cache 
FOR INSERT TO authenticated 
WITH CHECK (true);

-- 7. Grant permissions
GRANT SELECT, INSERT ON ai_query_cache TO authenticated;
GRANT ALL ON ai_query_cache TO service_role;

-- 8. Optional: Create a cleanup function for expired entries
CREATE OR REPLACE FUNCTION cleanup_expired_ai_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM ai_query_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Optional: Schedule cleanup (run manually or via pg_cron)
-- SELECT cron.schedule('cleanup-ai-cache', '0 3 * * *', 'SELECT cleanup_expired_ai_cache()');

COMMENT ON TABLE ai_query_cache IS 'Caches AI API responses to reduce costs and improve performance';
COMMENT ON COLUMN ai_query_cache.input_hash IS 'SHA-256 hash of the input prompt/document for deduplication';
COMMENT ON COLUMN ai_query_cache.query_type IS 'Type of AI query: ocr, essay_review, or university_match';
COMMENT ON COLUMN ai_query_cache.response_json IS 'The full JSON response from the AI API';
