-- Create Essays Table
CREATE TABLE IF NOT EXISTS public.essays (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.profiles(id) NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    word_count INTEGER,
    status TEXT DEFAULT 'draft', -- draft, final
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.essays ENABLE ROW LEVEL SECURITY;

-- Policies
-- Students can view/edit their own essays
CREATE POLICY "Students can view own essays" ON public.essays
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert own essays" ON public.essays
    FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own essays" ON public.essays
    FOR UPDATE USING (auth.uid() = student_id);

CREATE POLICY "Students can delete own essays" ON public.essays
    FOR DELETE USING (auth.uid() = student_id);

-- Teachers can view all essays
CREATE POLICY "Teachers can view all essays" ON public.essays
    FOR SELECT USING (public.is_teacher());

-- Grant permissions
GRANT ALL ON public.essays TO authenticated;
GRANT ALL ON public.essays TO service_role;
