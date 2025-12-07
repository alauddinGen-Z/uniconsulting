-- 1. Enable RLS on Tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debug_signup_logs ENABLE ROW LEVEL SECURITY;

-- 2. Policies for 'profiles'
-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Service Role Full Access" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Database Owner Insert" ON public.profiles;

-- Allow Trigger (Service Role) to do ANYTHING
CREATE POLICY "Service Role Full Access" ON public.profiles
AS PERMISSIVE FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow Users to View/Edit their OWN profile
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Allow Trigger to Insert (Explicitly for Postgres/Database Owner)
CREATE POLICY "Database Owner Insert" ON public.profiles
AS PERMISSIVE FOR INSERT
TO postgres
WITH CHECK (true);

-- 3. Policies for 'debug_signup_logs' (Open for Debugging)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.debug_signup_logs;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.debug_signup_logs;

CREATE POLICY "Enable read access for all users" ON public.debug_signup_logs
FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable insert access for all users" ON public.debug_signup_logs
FOR INSERT
TO public
WITH CHECK (true);

-- 4. Grant Permissions (Just to be safe)
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT ALL ON TABLE public.debug_signup_logs TO postgres, service_role, anon, authenticated;

-- 5. Re-run the Trigger Setup (Just to be sure it's bound)
-- (This is the same robust function from before)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
  v_approval_status approval_status;
  v_teacher_id uuid;
  v_full_name text;
BEGIN
  -- Log Entry
  INSERT INTO public.debug_signup_logs (user_email, step, details, meta_data)
  VALUES (new.email, 'START', 'Trigger started', new.raw_user_meta_data);

  -- 1. Extract Full Name
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'New User');

  -- 2. Extract Role
  BEGIN
    v_role := (new.raw_user_meta_data->>'role')::user_role;
    INSERT INTO public.debug_signup_logs (user_email, step, details) VALUES (new.email, 'ROLE_CAST_SUCCESS', v_role::text);
  EXCEPTION WHEN OTHERS THEN
    v_role := 'student';
    INSERT INTO public.debug_signup_logs (user_email, step, details) VALUES (new.email, 'ROLE_CAST_FAIL', SQLERRM);
  END;

  -- 3. Extract Approval Status
  BEGIN
    v_approval_status := (new.raw_user_meta_data->>'approval_status')::approval_status;
  EXCEPTION WHEN OTHERS THEN
    v_approval_status := 'pending';
  END;

  -- 4. Extract Teacher ID
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
  INSERT INTO public.profiles (id, email, full_name, role, teacher_id, approval_status)
  VALUES (new.id, new.email, v_full_name, v_role, v_teacher_id, v_approval_status);
  
  INSERT INTO public.debug_signup_logs (user_email, step, details) VALUES (new.email, 'SUCCESS', 'Profile created');

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.debug_signup_logs (user_email, step, details) VALUES (new.email, 'FATAL_ERROR', SQLERRM);
  -- Fallback
  INSERT INTO public.profiles (id, email, full_name, role, approval_status)
  VALUES (new.id, new.email, 'Fallback User', 'student', 'pending');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
