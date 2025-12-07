-- 1. Create a Debug Log Table
CREATE TABLE IF NOT EXISTS public.debug_signup_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_email TEXT,
    step TEXT,
    details TEXT,
    meta_data JSONB
);

-- 2. Instrument the Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
  v_approval_status approval_status;
  v_teacher_id uuid;
  v_full_name text;
  v_raw_role text;
  v_raw_status text;
BEGIN
  -- Log Entry
  INSERT INTO public.debug_signup_logs (user_email, step, details, meta_data)
  VALUES (new.email, 'START', 'Trigger started', new.raw_user_meta_data);

  -- 1. Extract Full Name
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'New User');

  -- 2. Extract Role (Safely)
  v_raw_role := new.raw_user_meta_data->>'role';
  BEGIN
    -- Try direct cast
    v_role := v_raw_role::user_role;
    INSERT INTO public.debug_signup_logs (user_email, step, details) VALUES (new.email, 'ROLE_CAST_SUCCESS', v_role::text);
  EXCEPTION WHEN OTHERS THEN
    -- Try lowercase cast
    BEGIN
        v_role := LOWER(v_raw_role)::user_role;
        INSERT INTO public.debug_signup_logs (user_email, step, details) VALUES (new.email, 'ROLE_CAST_LOWER_SUCCESS', v_role::text);
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.debug_signup_logs (user_email, step, details) VALUES (new.email, 'ROLE_CAST_FAIL', SQLERRM);
        v_role := 'student'; -- Fallback
    END;
  END;

  -- 3. Extract Approval Status (Safely)
  v_raw_status := new.raw_user_meta_data->>'approval_status';
  BEGIN
    v_approval_status := v_raw_status::approval_status;
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
    INSERT INTO public.debug_signup_logs (user_email, step, details) VALUES (new.email, 'TEACHER_ID_FAIL', SQLERRM);
    v_teacher_id := NULL;
  END;

  -- 5. Insert Profile
  BEGIN
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
      INSERT INTO public.debug_signup_logs (user_email, step, details) VALUES (new.email, 'INSERT_SUCCESS', 'Profile created');
  EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.debug_signup_logs (user_email, step, details) VALUES (new.email, 'INSERT_FAIL', SQLERRM);
      RAISE; -- Re-raise to trigger the outer exception block
  END;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Fallback
  INSERT INTO public.debug_signup_logs (user_email, step, details) VALUES (new.email, 'FATAL_ERROR', SQLERRM);
  
  INSERT INTO public.profiles (id, email, full_name, role, approval_status)
  VALUES (new.id, new.email, 'Fallback User', 'student', 'pending');
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
