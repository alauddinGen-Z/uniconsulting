-- Delete all documents for students
DELETE FROM public.documents 
WHERE student_id IN (SELECT id FROM public.profiles WHERE role = 'student');

-- Delete all applications for students
DELETE FROM public.applications 
WHERE student_id IN (SELECT id FROM public.profiles WHERE role = 'student');

-- Delete all student profiles
-- Note: This might fail if there are other foreign key constraints not handled above.
-- But based on our schema, documents and applications are the main ones.
DELETE FROM public.profiles 
WHERE role = 'student';

-- Optional: Delete from auth.users (Requires special permissions, usually can't do via SQL Editor easily)
-- So we just clean up the public schema.
