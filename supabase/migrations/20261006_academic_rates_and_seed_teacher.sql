-- ==============================================================================
-- Migration: Academic Rates Schema, Extended Timesheet Status, & Seed Teacher
-- Project: TIUS Extra Hours & Payroll System
-- Institution: Tishk International University (TIU) — Sulaimani Campus
-- Date: 2026-10-06
-- ==============================================================================

-- 1. Create Academic Rates Table
CREATE TABLE IF NOT EXISTS public.academic_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL UNIQUE,
    hourly_rate NUMERIC(10, 2) NOT NULL CHECK (hourly_rate > 0),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index on academic title
CREATE INDEX IF NOT EXISTS idx_academic_rates_title ON public.academic_rates(title);

-- Enable RLS
ALTER TABLE public.academic_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow public read academic_rates" ON public.academic_rates;
CREATE POLICY "Allow public read academic_rates" ON public.academic_rates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert academic_rates" ON public.academic_rates;
CREATE POLICY "Allow authenticated insert academic_rates" ON public.academic_rates FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update academic_rates" ON public.academic_rates;
CREATE POLICY "Allow authenticated update academic_rates" ON public.academic_rates FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow authenticated delete academic_rates" ON public.academic_rates;
CREATE POLICY "Allow authenticated delete academic_rates" ON public.academic_rates FOR DELETE USING (true);

-- 2. Seed Standard TIUS Academic Rates
INSERT INTO public.academic_rates (id, title, hourly_rate)
VALUES
    ('a1111111-1111-1111-1111-111111111111', 'Professor', 65.00),
    ('a2222222-2222-2222-2222-222222222222', 'Associate Professor', 55.00),
    ('a3333333-3333-3333-3333-333333333333', 'Assistant Professor', 45.00),
    ('a4444444-4444-4444-4444-444444444444', 'Senior Clinical Lecturer', 60.00),
    ('a5555555-5555-5555-5555-555555555555', 'Lecturer', 38.00),
    ('a6666666-6666-6666-6666-666666666666', 'Assistant Lecturer', 30.00),
    ('a7777777-7777-7777-7777-777777777777', 'Teaching Assistant / Lab Lead', 25.00)
ON CONFLICT (title) DO UPDATE SET 
    hourly_rate = EXCLUDED.hourly_rate,
    updated_at = timezone('utc'::text, now());

-- 3. Update timesheet_status enum if needed
DO $$ 
BEGIN
    ALTER TYPE timesheet_status ADD VALUE IF NOT EXISTS 'PENDING_HOD_APPROVAL';
    ALTER TYPE timesheet_status ADD VALUE IF NOT EXISTS 'REJECTED';
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_object THEN null;
    WHEN others THEN null;
END $$;

-- 4. Provision Seed Teacher Account in public.users
-- Note: Associated Auth account is teacher@tiu.edu.iq (password: TeacherPassword2025!)
INSERT INTO public.users (
    id,
    email,
    name,
    role,
    department_id,
    employment_type,
    academic_title,
    hourly_rate,
    staff_id,
    avatar_url,
    is_active
)
VALUES (
    'f28d7827-4388-400b-ab7e-bb32e0d6dd5a',
    'teacher@tiu.edu.iq',
    'Dr. Test Teacher',
    'TEACHER',
    (SELECT id FROM public.departments WHERE code = 'CE-IT' LIMIT 1),
    'FULL_TIME',
    'Assistant Professor',
    45.00,
    'TIU-TEACH-999',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    true
)
ON CONFLICT (email) DO UPDATE SET 
    role = 'TEACHER',
    academic_title = 'Assistant Professor',
    hourly_rate = 45.00,
    is_active = true,
    updated_at = timezone('utc'::text, now());
