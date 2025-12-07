-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid,
  university_name text NOT NULL,
  status text DEFAULT 'In Progress'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT applications_pkey PRIMARY KEY (id),
  CONSTRAINT applications_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT applications_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.debug_signup_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  user_email text,
  step text,
  details text,
  meta_data jsonb,
  CONSTRAINT debug_signup_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  type USER-DEFINED NOT NULL,
  file_url text NOT NULL,
  score_data jsonb,
  status USER-DEFINED DEFAULT 'Pending'::doc_status,
  created_at timestamp with time zone DEFAULT now(),
  title text,
  description text,
  content text,
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.essays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  title text NOT NULL,
  content text,
  word_count integer,
  status text DEFAULT 'draft'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT essays_pkey PRIMARY KEY (id),
  CONSTRAINT essays_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'student'::user_role,
  full_name text,
  email text,
  phone text,
  bio text,
  expertise ARRAY,
  hourly_rate numeric,
  teacher_id uuid,
  approval_status USER-DEFINED DEFAULT 'pending'::approval_status,
  passport_number text,
  home_address text,
  mother_full_name text,
  father_full_name text,
  personal_statement text,
  volunteering_hours integer,
  created_at timestamp with time zone DEFAULT now(),
  date_of_birth date,
  preferred_country text,
  preferred_university text,
  ielts_overall text,
  ielts_listening text,
  ielts_reading text,
  ielts_writing text,
  ielts_speaking text,
  sat_total text,
  sat_math text,
  sat_reading text,
  gpa text,
  gpa_scale text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.student_universities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  university_name text NOT NULL,
  country text NOT NULL,
  program text,
  category text DEFAULT 'match'::text CHECK (category = ANY (ARRAY['safety'::text, 'match'::text, 'reach'::text])),
  deadline_type text DEFAULT 'regular'::text CHECK (deadline_type = ANY (ARRAY['early_decision'::text, 'early_action'::text, 'regular'::text, 'rolling'::text, 'ucas'::text])),
  deadline_date date,
  application_status text DEFAULT 'researching'::text CHECK (application_status = ANY (ARRAY['researching'::text, 'preparing'::text, 'submitted'::text, 'accepted'::text, 'rejected'::text, 'waitlisted'::text])),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_universities_pkey PRIMARY KEY (id),
  CONSTRAINT student_universities_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);