-- Master Fix for Supabase Login and Profile Issues
-- This script consolidates fixes for schema, triggers, RLS, and missing profiles.

-- ============================================
-- 1. Schema Updates (Enums and Columns)
-- ============================================

-- Create user_role enum if not exists
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('student', 'teacher');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create approval_status enum if not exists
DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add missing columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approval_status approval_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS passport_number TEXT,
ADD COLUMN IF NOT EXISTS home_address TEXT,
ADD COLUMN IF NOT EXISTS mother_full_name TEXT,
ADD COLUMN IF NOT EXISTS father_full_name TEXT,
ADD COLUMN IF NOT EXISTS personal_statement TEXT,
ADD COLUMN IF NOT EXISTS volunteering_hours INTEGER;

-- ============================================
-- 2. Helper Functions
-- ============================================

-- Function to safely check if user is a teacher (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
    -- This function runs with SECURITY DEFINER, bypassing RLS
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'teacher'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- 3. Trigger Function (Robust Version)
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_approval_status approval_status;
  v_teacher_id uuid;
  v_full_name text;
BEGIN
  -- Log start
  RAISE WARNING 'Handling new user: %', new.email;

  -- 1. Extract Full Name
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'New User');

  -- 2. Extract Role (Safely)
  BEGIN
    v_role := (new.raw_user_meta_data->>'role')::user_role;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'student';
  END;

  -- 3. Extract Approval Status (Safely)
  BEGIN
    v_approval_status := (new.raw_user_meta_data->>'approval_status')::approval_status;
  EXCEPTION WHEN OTHERS THEN
    v_approval_status := 'pending';
  END;

  -- 4. Extract Teacher ID (Safely)
  BEGIN
    IF new.raw_user_meta_data->>'teacher_id' IS NULL OR new.raw_user_meta_data->>'teacher_id' = '' THEN
      v_teacher_id := NULL;
    ELSE
      v_teacher_id := (new.raw_user_meta_data->>'teacher_id')::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_teacher_id := NULL;
  END;

  -- 5. Insert Profile
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    teacher_id,
    approval_status
  )
  VALUES (
    new.id,
    new.email,
    v_full_name,
    v_role,
    v_teacher_id,
    v_approval_status
  );
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Fallback: If ANYTHING fails, insert a basic profile
  RAISE WARNING 'Profile creation failed: %, inserting fallback', SQLERRM;
  INSERT INTO public.profiles (id, email, full_name, role, approval_status)
  VALUES (new.id, new.email, 'Fallback User', 'student', 'pending');
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 4. RLS Policies
-- ============================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile, teachers can view all" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Users can always view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;

-- Create comprehensive policies

-- 1. Read Policy: Users see themselves, Teachers see everyone
CREATE POLICY "Read access policy"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    auth.uid() = id
    OR
    public.is_teacher()
);

-- 2. Update Policy: Users can update themselves
CREATE POLICY "Update access policy"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 3. Insert Policy: Service role (trigger) needs to insert, but authenticated users might too if we allowed it manually
-- Usually trigger runs as security definer so it bypasses RLS, but for good measure:
CREATE POLICY "Insert access policy"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ============================================
-- 5. Backfill Missing Profiles
-- ============================================

INSERT INTO public.profiles (id, email, full_name, role, approval_status, created_at)
SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', 'Recovered User'),
    COALESCE((u.raw_user_meta_data->>'role')::user_role, 'student'::user_role),
    'pending'::approval_status,
    u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

