-- ==============================================================================
-- Migration: Add IT_ADMIN, DEAN, and VICE_DEAN to user_role ENUM
-- Project: TIUS Extra Hours & Payroll System
-- Institution: Tishk International University (TIU) — Sulaimani Campus
-- Date: 2026-10-19
-- ==============================================================================

-- 1. Add new enum values to user_role type if not already present
-- Note: In PostgreSQL, ALTER TYPE ... ADD VALUE must run outside of a multi-statement transaction in some versions.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'IT_ADMIN';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'DEAN';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'VICE_DEAN';

-- 2. Comment on user_role enum explaining each role's system scope
COMMENT ON TYPE user_role IS 'University system roles: SUPER_ADMIN (Root), IT_ADMIN (IT Support Admin), COORDINATOR (Academic Coordinator), HOD (Head of Department), DEAN (Faculty Dean), VICE_DEAN (Faculty Vice Dean), TEACHER (Lecturer/Faculty), ACCOUNTANT (Finance/Payroll)';
