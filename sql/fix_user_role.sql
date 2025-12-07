-- Fix User Role
-- Replace 'YOUR_EMAIL_HERE' with the email address of the user you want to fix.

UPDATE public.profiles
SET 
    role = 'student', 
    approval_status = 'pending',
    teacher_id = NULL -- Reset teacher so they can select one again if needed
WHERE email = 'YOUR_EMAIL_HERE';

-- Verify the change
SELECT * FROM public.profiles WHERE email = 'YOUR_EMAIL_HERE';
