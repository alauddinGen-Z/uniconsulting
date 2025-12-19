-- =============================================================================
-- SUPABASE DATABASE SCHEMA REFERENCE
-- This file documents the production schema. DO NOT RUN - for reference only.
-- Last updated: 2025-12-18
-- =============================================================================

-- ============================================
-- ENUMS (USER-DEFINED Types)
-- ============================================

-- user_role: 'student', 'teacher', 'owner'
-- approval_status: 'pending', 'approved', 'rejected'
-- doc_status: 'Pending', 'Approved', 'Rejected'

-- ============================================
-- CORE TABLES
-- ============================================

-- agencies: Multi-tenant agency management
CREATE TABLE public.agencies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agencies_pkey PRIMARY KEY (id)
);

-- profiles: User profiles (linked to auth.users)
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  full_name text,
  email text,
  phone text,
  bio text,
  expertise text[],
  hourly_rate numeric,
  teacher_id uuid,
  approval_status approval_status DEFAULT 'pending',
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
  gpa_9th text,
  gpa_10th text,
  gpa_11th text,
  gpa_12th text,
  preferred_regions text[],
  budget_level text,
  xp_points integer DEFAULT 0,
  level integer DEFAULT 1,
  is_admin boolean DEFAULT false,
  agency_id uuid,
  -- ... (additional fields)
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- ============================================
-- STUDENT DATA TABLES
-- ============================================

-- essays: Student essays
CREATE TABLE public.essays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  title text NOT NULL,
  content text,
  word_count integer,
  status text DEFAULT 'draft',
  created_at timestamp with time zone DEFAULT now(),
  agency_id uuid,
  CONSTRAINT essays_pkey PRIMARY KEY (id),
  CONSTRAINT essays_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);

-- documents: Uploaded documents (passport, transcripts)
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  type text NOT NULL,
  file_url text NOT NULL,
  score_data jsonb,
  status text DEFAULT 'Pending',
  created_at timestamp with time zone DEFAULT now(),
  agency_id uuid,
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);

-- student_universities: University shortlist
CREATE TABLE public.student_universities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  university_name text NOT NULL,
  country text NOT NULL,
  category text DEFAULT 'match' CHECK (category IN ('safety', 'match', 'reach')),
  application_status text DEFAULT 'researching' CHECK (application_status IN 
    ('researching', 'preparing', 'submitted', 'accepted', 'rejected', 'waitlisted')),
  deadline_date date,
  notes text,
  CONSTRAINT student_universities_pkey PRIMARY KEY (id),
  CONSTRAINT student_universities_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);

-- ============================================
-- CHAT TABLES (Realtime)
-- ============================================

-- conversations: Chat threads
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  type text NOT NULL CHECK (type IN ('group', 'direct')),
  name text,
  teacher_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id)
);

-- conversation_participants: Who can see each conversation
CREATE TABLE public.conversation_participants (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  conversation_id uuid,
  user_id uuid,
  joined_at timestamp with time zone DEFAULT now(),
  last_read_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conversation_participants_pkey PRIMARY KEY (id),
  CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id)
);

-- messages: Chat messages
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  conversation_id uuid,
  sender_id uuid,
  content text NOT NULL,
  is_announcement boolean DEFAULT false,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id)
);

-- ============================================
-- AI & SEARCH TABLES
-- ============================================

-- scholarships: With pgvector embedding
CREATE TABLE public.scholarships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'USD',
  deadline date,
  country text,
  eligibility_criteria text[],
  field_of_study text[],
  degree_level text[],
  gender_preference text,
  url text,
  provider text,
  embedding vector(768),  -- pgvector for semantic search
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT scholarships_pkey PRIMARY KEY (id)
);

-- ai_query_cache: Cache AI responses
CREATE TABLE public.ai_query_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  input_hash text NOT NULL,
  query_type text NOT NULL,
  response_json jsonb NOT NULL,
  tokens_used integer,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + '30 days'),
  CONSTRAINT ai_query_cache_pkey PRIMARY KEY (id)
);

-- universities: University reference data
CREATE TABLE public.universities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  university_name text NOT NULL UNIQUE,
  country text NOT NULL,
  CONSTRAINT universities_pkey PRIMARY KEY (id)
);

-- ============================================
-- KEY INDEXES
-- ============================================

-- Already created in production:
-- profiles_teacher_id_idx
-- profiles_agency_id_idx
-- essays_student_id_idx
-- documents_student_id_idx
-- scholarships_embedding_idx (HNSW for vector search)

-- ============================================
-- RLS POLICIES (Enabled on all tables)
-- ============================================

-- See Supabase Dashboard > Authentication > Policies
-- Key patterns:
--   - Users can view/edit own rows: id = auth.uid()
--   - Teachers can view assigned students: teacher_id = auth.uid()
--   - Admins use check_is_admin_secure() function
