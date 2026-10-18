-- ==============================================================================
-- TIUS Extra Hours & Payroll System - Production Data Purge (Clean Slate)
-- Target: Supabase SQL Editor
-- Objective:
--   1. Wipe all timesheet records.
--   2. Wipe all faculty/staff users EXCEPT Super Admin.
--   3. Strictly preserve Super Admin (Barez Hassan).
--   4. Keep departments and academic_rates configuration tables intact.
--   5. Ensure no orphaned references remain.
-- ==============================================================================

BEGIN;

-- 1. Ensure academic_rates table exists with proper schema and RLS
CREATE TABLE IF NOT EXISTS public.academic_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL UNIQUE,
    hourly_rate NUMERIC(10, 2) NOT NULL CHECK (hourly_rate > 0),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.academic_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read academic_rates" ON public.academic_rates;
CREATE POLICY "Allow read academic_rates" ON public.academic_rates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert academic_rates" ON public.academic_rates;
CREATE POLICY "Allow insert academic_rates" ON public.academic_rates FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update academic_rates" ON public.academic_rates;
CREATE POLICY "Allow update academic_rates" ON public.academic_rates FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete academic_rates" ON public.academic_rates;
CREATE POLICY "Allow delete academic_rates" ON public.academic_rates FOR DELETE USING (true);

-- 2. Wipe all timesheets
DELETE FROM public.timesheets;

-- 3. Wipe all dummy users EXCEPT the Super Admin account
-- Strictly preserves any account with role = 'SUPER_ADMIN' or email = 'barez.hassan@tiu.edu.iq'
DELETE FROM public.users 
WHERE role IS DISTINCT FROM 'SUPER_ADMIN' 
  AND email <> 'barez.hassan@tiu.edu.iq';

-- 4. Clean up any orphaned department references on surviving admin users
UPDATE public.users 
SET department_id = NULL 
WHERE department_id IS NOT NULL 
  AND department_id NOT IN (SELECT id FROM public.departments);

-- 5. If Super Admin doesn't exist for any reason, safely upsert the Super Admin profile
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
    '3173be76-e43d-499e-869c-fefc30cac0e5',
    'barez.hassan@tiu.edu.iq',
    'Barez Hassan',
    'SUPER_ADMIN',
    NULL,
    'FULL_TIME',
    'System Super Administrator',
    0.00,
    'TIU-SUPER-001',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    TRUE
)
ON CONFLICT (email) DO UPDATE SET 
    role = 'SUPER_ADMIN',
    name = 'Barez Hassan',
    is_active = TRUE;

COMMIT;

-- ==============================================================================
-- Verification Queries (Run immediately after to confirm clean slate state)
-- ==============================================================================

SELECT 
    'Remaining Users' AS metric, 
    COUNT(*)::text AS count 
FROM public.users
UNION ALL
SELECT 
    'Remaining Timesheets', 
    COUNT(*)::text 
FROM public.timesheets
UNION ALL
SELECT 
    'Departments Intact', 
    COUNT(*)::text 
FROM public.departments
UNION ALL
SELECT 
    'Academic Rates Configured', 
    COUNT(*)::text 
FROM public.academic_rates;

-- Verify Preserved Super Admin Record
SELECT 
    id, 
    name, 
    email, 
    role, 
    academic_title, 
    hourly_rate, 
    is_active 
FROM public.users;
