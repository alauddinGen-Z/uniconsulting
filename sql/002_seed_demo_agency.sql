-- =====================================================
-- 002_seed_demo_agency.sql
-- Seed data for testing multi-tenant functionality
-- =====================================================

-- Insert Demo Agency
INSERT INTO agencies (id, name, domain, created_at)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Demo Agency',
    'demo.uniconsulting.com',
    NOW()
)
ON CONFLICT (domain) DO NOTHING;

-- Note: To link existing users to this agency, run:
-- UPDATE profiles SET agency_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' WHERE agency_id IS NULL;
