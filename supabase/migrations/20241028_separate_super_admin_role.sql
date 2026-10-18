-- ==============================================================================
-- Migration: Add SUPER_ADMIN to user_role ENUM & Provision Root Super Admin
-- Project: TIUS Extra Hours & Payroll System
-- Institution: Tishk International University (TIU) — Sulaimani Campus
-- ==============================================================================

-- 1. Extend user_role enum with the 5th role: SUPER_ADMIN
DO $$ 
BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN' BEFORE 'COORDINATOR';
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN others THEN null;
END $$;

-- 2. Verify all 5 distinct roles are supported:
-- SUPER_ADMIN: Root system authority who distributes roles and permissions.
-- COORDINATOR: Academic Coordinator managing university quotas and cross-faculty approvals.
-- HOD: Head of Department responsible for departmental hours verification.
-- TEACHER: Faculty member submitting weekly extra hours and lab makeup claims.
-- ACCOUNTANT: Payroll officer executing bank wires and RTGS locks.

-- 3. Upsert Super Admin Account
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
    null,
    'FULL_TIME',
    'System Super Administrator',
    0.00,
    'TIU-SUPER-001',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    true
)
ON CONFLICT (email) DO UPDATE SET 
    role = 'SUPER_ADMIN',
    name = EXCLUDED.name,
    academic_title = 'Super Admin';

-- 4. Clarify Dr. Sarah Al-Bayati as Academic Coordinator
UPDATE public.users 
SET 
    role = 'COORDINATOR',
    academic_title = 'Academic Coordinator & Lecturer'
WHERE email = 'sarah.bayati@tiu.edu.iq';
