-- 1. Safe Enum Creation
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('student', 'teacher');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Safe Column Addition
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approval_status approval_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS passport_number TEXT,
ADD COLUMN IF NOT EXISTS home_address TEXT,
ADD COLUMN IF NOT EXISTS mother_full_name TEXT,
ADD COLUMN IF NOT EXISTS father_full_name TEXT,
ADD COLUMN IF NOT EXISTS personal_statement TEXT,
ADD COLUMN IF NOT EXISTS volunteering_hours INTEGER;

-- 3. Redefine Trigger Function with Error Handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
  v_approval_status approval_status;
  v_teacher_id uuid;
  v_full_name text;
BEGIN
  -- Log start (visible in Supabase logs)
  RAISE WARNING 'Handling new user: %', new.email;

  -- 1. Extract Full Name
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'New User');

  -- 2. Extract Role (Safely)
  BEGIN
    v_role := (new.raw_user_meta_data->>'role')::user_role;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Invalid role: %, defaulting to student', new.raw_user_meta_data->>'role';
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
    RAISE WARNING 'Invalid teacher_id: %, setting to NULL', new.raw_user_meta_data->>'teacher_id';
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
  -- Fallback: If ANYTHING fails, insert a basic profile so the user can at least log in
  RAISE WARNING 'Profile creation failed: %, inserting fallback', SQLERRM;
  INSERT INTO public.profiles (id, email, full_name, role, approval_status)
  VALUES (new.id, new.email, 'Fallback User', 'student', 'pending');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-bind Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
