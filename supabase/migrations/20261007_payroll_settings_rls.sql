-- ==============================================================================
-- Migration: Payroll Settings Table RLS Policies & Default Cycle Seed
-- Enables full access for finance operations and inserts initial singleton row
-- ==============================================================================

BEGIN;

-- 1. Ensure table exists with all required columns
CREATE TABLE IF NOT EXISTS public.payroll_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auto_lock BOOLEAN NOT NULL DEFAULT true,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    cycle_name TEXT DEFAULT 'Active Cycle: Sep 25 - Oct 25',
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Configure Row Level Security (RLS)
ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select payroll_settings" ON public.payroll_settings;
CREATE POLICY "Allow select payroll_settings" 
ON public.payroll_settings 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow insert payroll_settings" ON public.payroll_settings;
CREATE POLICY "Allow insert payroll_settings" 
ON public.payroll_settings 
FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update payroll_settings" ON public.payroll_settings;
CREATE POLICY "Allow update payroll_settings" 
ON public.payroll_settings 
FOR UPDATE 
USING (true);

DROP POLICY IF EXISTS "Allow delete payroll_settings" ON public.payroll_settings;
CREATE POLICY "Allow delete payroll_settings" 
ON public.payroll_settings 
FOR DELETE 
USING (true);

-- 3. Seed default active cycle if table is empty
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

COMMIT;

-- Verify payroll_settings status
SELECT * FROM public.payroll_settings;
