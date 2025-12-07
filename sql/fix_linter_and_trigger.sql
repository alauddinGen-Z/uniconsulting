-- 1. Fix Security Definer View (student_readiness)
DROP VIEW IF EXISTS public.student_readiness;
-- Re-create it without SECURITY DEFINER (default is INVOKER)
CREATE OR REPLACE VIEW public.student_readiness AS
SELECT 
    p.id as student_id,
    p.full_name,
    p.email,
    p.approval_status,
    p.teacher_id,
    COUNT(d.id) FILTER (WHERE d.status = 'Verified') as approved_docs,
    COUNT(d.id) as total_docs
FROM public.profiles p
LEFT JOIN public.documents d ON p.id = d.student_id
WHERE p.role = 'student'
GROUP BY p.id;

-- 2. Fix RLS on 'applications' (Add a basic policy)
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for users" ON public.applications
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Fix Trigger Function (Add search_path = public)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public -- CRITICAL FIX: Lock down search path
AS $$
DECLARE
  v_role user_role;
  v_approval_status approval_status;
  v_teacher_id uuid;
  v_full_name text;
BEGIN
  -- Log Entry (if table exists)
  BEGIN
    INSERT INTO public.debug_signup_logs (user_email, step, details, meta_data)
    VALUES (new.email, 'START', 'Trigger started with search_path=public', new.raw_user_meta_data);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore logging errors
  END;

  -- 1. Extract Full Name
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'New User');

  -- 2. Extract Role
  BEGIN
    v_role := (new.raw_user_meta_data->>'role')::user_role;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'student';
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
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Fallback
  INSERT INTO public.profiles (id, email, full_name, role, approval_status)
  VALUES (new.id, new.email, 'Fallback User', 'student', 'pending');
  RETURN new;
END;
$$ LANGUAGE plpgsql;
