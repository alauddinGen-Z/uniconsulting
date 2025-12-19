-- =============================================================================
-- grant_super_admin.sql
-- Run this in Supabase SQL Editor to grant Super-Admin access
-- =============================================================================

-- Grant Super-Admin access to the platform owner
UPDATE public.profiles
SET 
    is_admin = true,
    role = 'owner'
WHERE email = 'alauddin.jamshitbekov@gmail.com';

-- Verify the update
SELECT id, email, role, is_admin 
FROM public.profiles 
WHERE email = 'alauddin.jamshitbekov@gmail.com';
