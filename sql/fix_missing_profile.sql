-- This script will create a profile for any auth.users that don't have one
-- Run this AFTER running add_profile_columns.sql

INSERT INTO public.profiles (id, email, role, approval_status, full_name)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'role', 'student')::user_role,
    COALESCE(au.raw_user_meta_data->>'approval_status', 'pending')::approval_status,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email)
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;
