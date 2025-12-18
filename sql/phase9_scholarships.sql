-- =====================================================
-- phase9_scholarships.sql
-- Vector-based Scholarship Search with pgvector
-- 
-- CoVe Guarantees:
--   ✅ Cost: $0 - uses built-in Supabase pgvector
--   ✅ Performance: HNSW index for O(log n) search
--   ✅ Cold Start: 5 dummy scholarships seeded
-- =====================================================

-- ================================================================
-- 1. ENABLE VECTOR EXTENSION
-- ================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ================================================================
-- 2. CREATE SCHOLARSHIPS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS scholarships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    deadline DATE,
    country TEXT,
    eligibility_criteria TEXT[],
    field_of_study TEXT[],
    degree_level TEXT[], -- bachelor, master, phd
    gender_preference TEXT, -- null = any, 'female', 'male'
    url TEXT,
    provider TEXT,
    embedding vector(768), -- Gemini embedding dimension
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 3. CREATE HNSW INDEX FOR FAST SIMILARITY SEARCH
-- m=16: number of connections per layer
-- ef_construction=64: construction-time accuracy/speed tradeoff
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_scholarships_embedding 
ON scholarships 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Additional indexes for filtering
CREATE INDEX IF NOT EXISTS idx_scholarships_country ON scholarships(country);
CREATE INDEX IF NOT EXISTS idx_scholarships_deadline ON scholarships(deadline);
CREATE INDEX IF NOT EXISTS idx_scholarships_amount ON scholarships(amount);

-- ================================================================
-- 4. RLS POLICIES
-- ================================================================

ALTER TABLE scholarships ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read scholarships
CREATE POLICY "authenticated_read_scholarships" ON scholarships
FOR SELECT
TO authenticated
USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "admin_manage_scholarships" ON scholarships
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
);

-- ================================================================
-- 5. VECTOR SEARCH FUNCTION
-- Returns top N scholarships by cosine similarity
-- ================================================================

CREATE OR REPLACE FUNCTION match_scholarships(
    query_embedding vector(768),
    match_count INT DEFAULT 5,
    min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    amount DECIMAL,
    currency TEXT,
    deadline DATE,
    country TEXT,
    eligibility_criteria TEXT[],
    field_of_study TEXT[],
    degree_level TEXT[],
    provider TEXT,
    url TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.title,
        s.description,
        s.amount,
        s.currency,
        s.deadline,
        s.country,
        s.eligibility_criteria,
        s.field_of_study,
        s.degree_level,
        s.provider,
        s.url,
        1 - (s.embedding <=> query_embedding) AS similarity
    FROM scholarships s
    WHERE s.embedding IS NOT NULL
      AND 1 - (s.embedding <=> query_embedding) >= min_similarity
    ORDER BY s.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ================================================================
-- 6. KEYWORD SEARCH FUNCTION (Fallback)
-- ================================================================

CREATE OR REPLACE FUNCTION search_scholarships_keyword(
    search_query TEXT,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    amount DECIMAL,
    currency TEXT,
    deadline DATE,
    country TEXT,
    provider TEXT,
    url TEXT,
    relevance_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.title,
        s.description,
        s.amount,
        s.currency,
        s.deadline,
        s.country,
        s.provider,
        s.url,
        ts_rank(
            to_tsvector('english', s.title || ' ' || s.description),
            plainto_tsquery('english', search_query)
        )::FLOAT AS relevance_score
    FROM scholarships s
    WHERE 
        s.title ILIKE '%' || search_query || '%'
        OR s.description ILIKE '%' || search_query || '%'
        OR search_query = ANY(s.field_of_study)
        OR search_query = ANY(s.eligibility_criteria)
    ORDER BY relevance_score DESC
    LIMIT match_count;
END;
$$;

-- ================================================================
-- 7. SEED DATA (5 Dummy Scholarships)
-- Note: Embeddings are placeholder zeros. Run embedding script in production.
-- ================================================================

INSERT INTO scholarships (title, description, amount, currency, deadline, country, eligibility_criteria, field_of_study, degree_level, gender_preference, provider, url)
VALUES
(
    'Chevening Scholarship UK',
    'Fully-funded scholarship for outstanding leaders from around the world to pursue a one-year master''s degree in any subject at any UK university. Covers tuition, living expenses, and travel.',
    50000.00,
    'GBP',
    '2025-11-01',
    'United Kingdom',
    ARRAY['International students', '2+ years work experience', 'Leadership potential', 'Return to home country'],
    ARRAY['Any field', 'Business', 'Law', 'Engineering', 'Sciences'],
    ARRAY['master'],
    NULL,
    'UK Government Foreign Office',
    'https://www.chevening.org/'
),
(
    'DAAD Scholarship Germany',
    'Study Scholarships for graduates of all disciplines who want to pursue a Master''s degree at a German university. Monthly stipend plus travel and insurance allowances.',
    12000.00,
    'EUR',
    '2025-09-15',
    'Germany',
    ARRAY['Bachelor degree holders', 'Excellent academic record', 'German or English proficiency'],
    ARRAY['Engineering', 'Natural Sciences', 'Social Sciences', 'Humanities'],
    ARRAY['master'],
    NULL,
    'German Academic Exchange Service',
    'https://www.daad.de/'
),
(
    'Women in STEM Scholarship',
    'Supporting women pursuing careers in Science, Technology, Engineering and Mathematics. Partial tuition coverage for undergraduate and graduate students at partner universities.',
    15000.00,
    'USD',
    '2025-03-31',
    'United States',
    ARRAY['Female students', 'Enrolled in STEM program', '3.0+ GPA'],
    ARRAY['Computer Science', 'Engineering', 'Mathematics', 'Physics', 'Biology'],
    ARRAY['bachelor', 'master'],
    'female',
    'Women in Tech Foundation',
    'https://example.com/women-stem'
),
(
    'Central Asia Merit Scholarship',
    'Full scholarship for students from Kyrgyzstan, Kazakhstan, Uzbekistan, and Tajikistan to study at partner universities in Europe and North America. Includes tuition, accommodation, and monthly stipend.',
    35000.00,
    'USD',
    '2025-05-15',
    'Multiple',
    ARRAY['Central Asian nationality', 'Age 18-25', 'High school diploma with honors'],
    ARRAY['Business', 'Economics', 'Public Policy', 'International Relations'],
    ARRAY['bachelor', 'master'],
    NULL,
    'Central Asia Education Foundation',
    'https://example.com/ca-scholarship'
),
(
    'Fulbright Foreign Student Program',
    'The Fulbright Program provides funding for students to undertake graduate study, conduct research, or teach English in the United States. One of the most prestigious scholarships worldwide.',
    45000.00,
    'USD',
    '2025-04-01',
    'United States',
    ARRAY['Non-US citizens', 'Bachelor degree', 'English proficiency', 'Leadership qualities'],
    ARRAY['Any field', 'Arts', 'Sciences', 'Social Sciences', 'Humanities'],
    ARRAY['master', 'phd'],
    NULL,
    'U.S. Department of State',
    'https://foreign.fulbrightonline.org/'
)
ON CONFLICT DO NOTHING;

-- ================================================================
-- 8. COMMENTS
-- ================================================================

COMMENT ON TABLE scholarships IS 
'Scholarship database with vector embeddings for semantic search using pgvector';

COMMENT ON FUNCTION match_scholarships IS 
'Semantic search using cosine similarity on Gemini embeddings. Returns top matches.';

COMMENT ON INDEX idx_scholarships_embedding IS 
'HNSW index for O(log n) approximate nearest neighbor search';
