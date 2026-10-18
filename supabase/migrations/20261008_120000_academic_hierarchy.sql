-- Create Faculties Table
CREATE TABLE IF NOT EXISTS public.faculties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read faculties" ON public.faculties;
CREATE POLICY "Allow read faculties" ON public.faculties FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert faculties" ON public.faculties;
CREATE POLICY "Allow insert faculties" ON public.faculties FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update faculties" ON public.faculties;
CREATE POLICY "Allow update faculties" ON public.faculties FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete faculties" ON public.faculties;
CREATE POLICY "Allow delete faculties" ON public.faculties FOR DELETE USING (true);

-- Update Departments to link to Faculties
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS faculty_id UUID REFERENCES public.faculties(id) ON DELETE CASCADE;

-- Create Stages Table
CREATE TABLE IF NOT EXISTS public.stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    level INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read stages" ON public.stages;
CREATE POLICY "Allow read stages" ON public.stages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert stages" ON public.stages;
CREATE POLICY "Allow insert stages" ON public.stages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update stages" ON public.stages;
CREATE POLICY "Allow update stages" ON public.stages FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete stages" ON public.stages;
CREATE POLICY "Allow delete stages" ON public.stages FOR DELETE USING (true);

-- Create Courses Table
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    credits NUMERIC(3, 1),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read courses" ON public.courses;
CREATE POLICY "Allow read courses" ON public.courses FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert courses" ON public.courses;
CREATE POLICY "Allow insert courses" ON public.courses FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update courses" ON public.courses;
CREATE POLICY "Allow update courses" ON public.courses FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete courses" ON public.courses;
CREATE POLICY "Allow delete courses" ON public.courses FOR DELETE USING (true);
