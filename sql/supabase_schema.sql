-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('student', 'teacher');
CREATE TYPE doc_type AS ENUM ('IELTS', 'TOEFL', 'SAT', 'GPA', 'Passport', 'Extracurricular');
CREATE TYPE doc_status AS ENUM ('Pending', 'Verified', 'Rejected');

-- 2. PROFILES
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  role user_role NOT NULL DEFAULT 'student',
  full_name TEXT,
  email TEXT,
  phone TEXT
);

-- 3. DOCUMENTS
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) NOT NULL,
  type doc_type NOT NULL,
  file_url TEXT NOT NULL,
  score_data JSONB,
  status doc_status DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. APPLICATIONS
CREATE TABLE applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) NOT NULL,
  teacher_id UUID REFERENCES profiles(id),
  university_name TEXT NOT NULL,
  status TEXT DEFAULT 'In Progress',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. READINESS VIEW
CREATE OR REPLACE VIEW student_readiness AS
SELECT 
  p.id as student_id,
  p.full_name,
  p.email,
  p.phone,
  (
    EXISTS(SELECT 1 FROM documents d WHERE d.student_id = p.id AND d.type = 'Passport') AND
    EXISTS(SELECT 1 FROM documents d WHERE d.student_id = p.id AND d.type = 'GPA') AND
    (
      EXISTS(SELECT 1 FROM documents d WHERE d.student_id = p.id AND d.type = 'IELTS') OR
      EXISTS(SELECT 1 FROM documents d WHERE d.student_id = p.id AND d.type = 'TOEFL')
    )
  ) as is_ready
FROM profiles p
WHERE p.role = 'student';

-- 6. RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Documents Policies
CREATE POLICY "Students can view own docs" ON documents FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can insert own docs" ON documents FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Teachers can view all docs" ON documents FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);
CREATE POLICY "Teachers can update all docs" ON documents FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);

-- Storage Bucket (If not exists, usually done via API but trying SQL)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Give students access to own folder 1u57l0_0" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Give students access to own folder 1u57l0_1" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Give teachers access to all 1u57l0_2" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher'));
