-- =====================================================
-- 000_add_owner_role.sql
-- RUN THIS FIRST, SEPARATELY
-- Adds 'owner' to user_role enum
-- =====================================================

-- Add 'owner' to the user_role enum
-- This must be committed before it can be used in policies
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
