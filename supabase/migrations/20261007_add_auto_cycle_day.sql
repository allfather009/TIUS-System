-- ==============================================================================
-- Migration: Add Customizable auto_cycle_day to payroll_settings
-- Project: TIUS Extra Hours & Payroll System
-- Date: 2026-10-07
-- ==============================================================================

BEGIN;

-- 1. Add auto_cycle_day column (defaults to 25)
ALTER TABLE public.payroll_settings 
ADD COLUMN IF NOT EXISTS auto_cycle_day INTEGER DEFAULT 25;

-- 2. Update existing rows if null
UPDATE public.payroll_settings 
SET auto_cycle_day = 25 
WHERE auto_cycle_day IS NULL;

COMMIT;

-- Verification
SELECT id, cycle_name, start_date, end_date, auto_lock, auto_cycle_day, is_locked 
FROM public.payroll_settings;
