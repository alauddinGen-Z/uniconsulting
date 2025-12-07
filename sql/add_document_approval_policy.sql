-- Policy: Students can only insert documents if their profile is approved
-- Note: Teachers can always insert (handled by existing policies or admin rights)

-- 1. Enable RLS on documents if not already (it should be)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 2. Create Policy for INSERT
DROP POLICY IF EXISTS "Approved students can upload documents" ON public.documents;
CREATE POLICY "Approved students can upload documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be the owner of the document
  auth.uid() = student_id
  AND
  -- User must have 'approved' status in profiles
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND approval_status = 'approved'
  )
);

-- 3. Create Policy for UPDATE (if needed)
DROP POLICY IF EXISTS "Approved students can update their documents" ON public.documents;
CREATE POLICY "Approved students can update their documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (
  auth.uid() = student_id
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND approval_status = 'approved'
  )
);

-- Note: We might need to drop existing permissive policies if they are too broad.
-- For now, we assume existing policies might be "Users can insert their own documents".
-- If so, we need to be careful. RLS policies are OR-ed together.
-- If there is already a policy "allow insert if uid = student_id", this new policy won't restrict anything.
-- We should probably DROP existing insert policies for students first.

-- DROP POLICY IF EXISTS "Students can insert own documents" ON public.documents;
-- (I will leave this commented out for safety, but the user should be aware)
