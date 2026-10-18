-- ==============================================================================
-- Migration: Add approved_at timestamp to timesheets
-- Project: TIUS Extra Hours & Payroll System
-- Date: 2026-10-07
-- ==============================================================================

BEGIN;

ALTER TABLE public.timesheets 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Backfill existing approved or paid records
UPDATE public.timesheets 
SET approved_at = updated_at 
WHERE approved_at IS NULL AND status IN ('APPROVED', 'PAID');

COMMIT;
