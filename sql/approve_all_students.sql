UPDATE public.profiles
SET approval_status = 'approved'
WHERE role = 'student' AND approval_status = 'pending';
