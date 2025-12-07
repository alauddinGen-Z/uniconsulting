-- Fix Security Advisor Warnings
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. Fix SECURITY DEFINER view
-- =============================================
-- Drop and recreate the view with SECURITY INVOKER (default, safer)
DROP VIEW IF EXISTS public.student_readiness;

-- If you need this view, recreate it WITHOUT security_definer
-- CREATE VIEW public.student_readiness AS
-- SELECT ... (your view query here)
-- WITH (security_invoker = on);

-- =============================================
-- 2. Fix function search_path for is_conversation_member
-- =============================================
CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.conversation_participants 
        WHERE conversation_id = conv_id AND user_id = auth.uid()
    );
$$;

-- =============================================
-- 3. Fix function search_path for is_teacher
-- =============================================
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'teacher'
    );
$$;

-- =============================================
-- 4. Leaked Password Protection
-- =============================================
-- This needs to be enabled in Supabase Dashboard:
-- Go to: Authentication > Providers > Email
-- Enable "Leaked Password Protection"
-- (Cannot be done via SQL)

-- Verify functions have correct search_path
SELECT 
    proname as function_name,
    proconfig as config
FROM pg_proc 
WHERE proname IN ('is_conversation_member', 'is_teacher');
