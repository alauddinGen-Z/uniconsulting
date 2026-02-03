-- Database Performance Indexes
-- Based on PLAN-quick-wins.md Phase 1

-- 1. Profiles Table Indexes
-- Speeds up filtering students for a specific teacher (Teacher Dashboard)
CREATE INDEX IF NOT EXISTS idx_profiles_teacher_id ON profiles(teacher_id);

-- Speeds up filtering by role and approval status (Student Lists)
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON profiles(role, approval_status);

-- Speeds up sorting by updated_at (Recent Activity)
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at DESC);

-- 2. Candidates Table Indexes (if table exists)
-- Speeds up Kanban board filtering
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_teacher_date ON candidates(teacher_id, target_date);

-- Verification
SELECT 
    schemaname, 
    tablename, 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename IN ('profiles', 'candidates')
ORDER BY tablename, indexname;
