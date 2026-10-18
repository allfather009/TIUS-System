-- ==============================================================================
-- TIUS EXTRA HOURS & PAYROLL SYSTEM - COMPREHENSIVE SUPABASE REPAIR & SYNC SCRIPT
-- Target: Supabase SQL Editor (https://supabase.com/dashboard/project/asqlmvmabopyflqmzzqx/sql)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Ensure Enum Types Exist and Contain All Statuses
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'COORDINATOR', 'HOD', 'TEACHER', 'ACCOUNTANT');
EXCEPTION
    WHEN duplicate_object THEN 
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN' BEFORE 'COORDINATOR';
        EXCEPTION
            WHEN others THEN null;
        END;
END $$;

DO $$ BEGIN
    CREATE TYPE timesheet_status AS ENUM ('PENDING', 'PENDING_HOD_APPROVAL', 'APPROVED', 'REJECTED', 'PAID');
EXCEPTION
    WHEN duplicate_object THEN 
        BEGIN
            ALTER TYPE timesheet_status ADD VALUE IF NOT EXISTS 'PENDING_HOD_APPROVAL';
            ALTER TYPE timesheet_status ADD VALUE IF NOT EXISTS 'REJECTED';
            ALTER TYPE timesheet_status ADD VALUE IF NOT EXISTS 'PAID';
        EXCEPTION
            WHEN others THEN null;
        END;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Create / Repair ACADEMIC_RATES Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.academic_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL UNIQUE,
    hourly_rate NUMERIC(10, 2) NOT NULL CHECK (hourly_rate > 0),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_academic_rates_title ON public.academic_rates(title);

ALTER TABLE public.academic_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read academic_rates" ON public.academic_rates;
CREATE POLICY "Allow read academic_rates" ON public.academic_rates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert academic_rates" ON public.academic_rates;
CREATE POLICY "Allow insert academic_rates" ON public.academic_rates FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update academic_rates" ON public.academic_rates;
CREATE POLICY "Allow update academic_rates" ON public.academic_rates FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete academic_rates" ON public.academic_rates;
CREATE POLICY "Allow delete academic_rates" ON public.academic_rates FOR DELETE USING (true);

-- Seed Standard TIUS Academic Rates
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

-- ------------------------------------------------------------------------------
-- 3. Repair TIMESHEETS Table Constraints & RLS
-- ------------------------------------------------------------------------------
-- Make course_activity nullable if it has a strict NOT NULL constraint
DO $$ BEGIN
    ALTER TABLE public.timesheets ALTER COLUMN course_activity DROP NOT NULL;
EXCEPTION
    WHEN undefined_column THEN null;
    WHEN others THEN null;
END $$;

ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "hod_select_department_timesheets" ON public.timesheets;
CREATE POLICY "hod_select_department_timesheets"
ON public.timesheets
FOR SELECT
TO authenticated, anon
USING (
  -- HOD selects timesheets of teachers in same department
  EXISTS (
    SELECT 1
    FROM public.users AS current_hod
    JOIN public.users AS teacher_user ON teacher_user.id = timesheets.teacher_id
    WHERE (
      (current_hod.id = auth.uid() OR current_hod.email = (auth.jwt() ->> 'email'))
      AND current_hod.role = 'HOD'
      AND current_hod.department_id = teacher_user.department_id
    )
  )
  -- Teacher selects own
  OR timesheets.teacher_id = auth.uid()
  -- Central admin roles
  OR EXISTS (
    SELECT 1
    FROM public.users AS admin_user
    WHERE (admin_user.id = auth.uid() OR admin_user.email = (auth.jwt() ->> 'email'))
      AND admin_user.role IN ('COORDINATOR', 'SUPER_ADMIN', 'ACCOUNTANT')
  )
  -- Anon fallback
  OR (auth.role() = 'anon')
);

DROP POLICY IF EXISTS "Allow insert timesheets" ON public.timesheets;
CREATE POLICY "Allow insert timesheets" ON public.timesheets FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "hod_update_department_timesheets" ON public.timesheets;
CREATE POLICY "hod_update_department_timesheets"
ON public.timesheets
FOR UPDATE
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1
    FROM public.users AS current_hod
    JOIN public.users AS teacher_user ON teacher_user.id = timesheets.teacher_id
    WHERE (
      (current_hod.id = auth.uid() OR current_hod.email = (auth.jwt() ->> 'email'))
      AND current_hod.role = 'HOD'
      AND current_hod.department_id = teacher_user.department_id
    )
  )
  OR EXISTS (
    SELECT 1
    FROM public.users AS admin_user
    WHERE (admin_user.id = auth.uid() OR admin_user.email = (auth.jwt() ->> 'email'))
      AND admin_user.role IN ('COORDINATOR', 'SUPER_ADMIN')
  )
  OR (auth.role() = 'anon')
);

DROP POLICY IF EXISTS "Allow delete timesheets" ON public.timesheets;
CREATE POLICY "Allow delete timesheets" ON public.timesheets FOR DELETE USING (true);

-- ------------------------------------------------------------------------------
-- 4. Repair & Deduplicate PAYROLL_SETTINGS Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auto_lock BOOLEAN NOT NULL DEFAULT true,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    cycle_name TEXT DEFAULT 'Active Cycle: Sep 25 - Oct 25',
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select payroll_settings" ON public.payroll_settings;
CREATE POLICY "Allow select payroll_settings" ON public.payroll_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert payroll_settings" ON public.payroll_settings;
CREATE POLICY "Allow insert payroll_settings" ON public.payroll_settings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update payroll_settings" ON public.payroll_settings;
CREATE POLICY "Allow update payroll_settings" ON public.payroll_settings FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete payroll_settings" ON public.payroll_settings;
CREATE POLICY "Allow delete payroll_settings" ON public.payroll_settings FOR DELETE USING (true);

-- Remove duplicate random UUID rows, keeping singleton ID
DELETE FROM public.payroll_settings 
WHERE id <> '00000000-0000-0000-0000-000000000001';

-- Ensure singleton row is seeded
INSERT INTO public.payroll_settings (
    id,
    auto_lock,
    start_date,
    end_date,
    is_locked,
    cycle_name,
    updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    true,
    '2026-09-25',
    '2026-10-25',
    false,
    'Active Cycle: Sep 25 - Oct 25',
    now()
)
ON CONFLICT (id) DO UPDATE SET
    auto_lock = EXCLUDED.auto_lock,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    cycle_name = EXCLUDED.cycle_name;

-- ------------------------------------------------------------------------------
-- 5. Repair USERS & DEPARTMENTS RLS
-- ------------------------------------------------------------------------------
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read departments" ON public.departments;
CREATE POLICY "Allow read departments" ON public.departments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all departments" ON public.departments;
CREATE POLICY "Allow all departments" ON public.departments FOR ALL USING (true);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read users" ON public.users;
CREATE POLICY "Allow read users" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert users" ON public.users;
CREATE POLICY "Allow insert users" ON public.users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update users" ON public.users;
CREATE POLICY "Allow update users" ON public.users FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete users" ON public.users;
CREATE POLICY "Allow delete users" ON public.users FOR DELETE USING (true);

COMMIT;

-- ------------------------------------------------------------------------------
-- Verification Query
-- ------------------------------------------------------------------------------
SELECT 'academic_rates count' as table_name, count(*)::text as row_count FROM public.academic_rates
UNION ALL
SELECT 'payroll_settings count', count(*)::text FROM public.payroll_settings
UNION ALL
SELECT 'users count', count(*)::text FROM public.users
UNION ALL
SELECT 'timesheets count', count(*)::text FROM public.timesheets
UNION ALL
SELECT 'departments count', count(*)::text FROM public.departments;
