-- ==============================================================================
-- Migration: Add role_permissions JSONB to system_settings
-- Date: 2026-10-19
-- Description: Supports role-level permission governance for all system roles.
-- ==============================================================================

-- 1. Create system_settings table if it doesn't already exist
CREATE TABLE IF NOT EXISTS public.system_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    base_currency TEXT NOT NULL DEFAULT 'IQD',
    exchange_rate NUMERIC(12, 2) NOT NULL DEFAULT 150000,
    finance_can_edit_exchange BOOLEAN DEFAULT true,
    coordinator_can_view_currency BOOLEAN DEFAULT false,
    role_permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add role_permissions column if system_settings already exists
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS role_permissions JSONB DEFAULT '{}'::jsonb;

-- 3. Populate default role permissions for all roles
UPDATE public.system_settings
SET role_permissions = jsonb_build_object(
    'SUPER_ADMIN', jsonb_build_object(
        'can_manage_roles', true,
        'can_manage_rates', true,
        'can_manage_structure', true,
        'can_manage_settings', true,
        'can_audit_logs', true,
        'can_batch_import', true,
        'can_export_payroll', true,
        'can_view_currency_settings', true,
        'can_manage_currency', true,
        'can_lock_cycles', true,
        'can_view_all_departments', true
    ),
    'IT_ADMIN', jsonb_build_object(
        'can_manage_roles', false,
        'can_manage_rates', true,
        'can_manage_structure', true,
        'can_manage_settings', false,
        'can_audit_logs', true,
        'can_batch_import', true,
        'can_export_payroll', false,
        'can_view_currency_settings', true,
        'can_manage_currency', false,
        'can_lock_cycles', false,
        'can_view_all_departments', true
    ),
    'ACCOUNTANT', jsonb_build_object(
        'can_manage_roles', false,
        'can_manage_rates', false,
        'can_manage_structure', false,
        'can_manage_settings', false,
        'can_audit_logs', false,
        'can_batch_import', false,
        'can_export_payroll', true,
        'can_view_currency_settings', true,
        'can_manage_currency', true,
        'can_lock_cycles', true,
        'can_view_all_departments', true
    ),
    'HOD', jsonb_build_object(
        'can_manage_roles', false,
        'can_manage_rates', false,
        'can_manage_structure', true,
        'can_manage_settings', false,
        'can_audit_logs', false,
        'can_batch_import', false,
        'can_export_payroll', false,
        'can_view_currency_settings', false,
        'can_manage_currency', false,
        'can_lock_cycles', false,
        'can_view_all_departments', false
    ),
    'COORDINATOR', jsonb_build_object(
        'can_manage_roles', false,
        'can_manage_rates', false,
        'can_manage_structure', false,
        'can_manage_settings', false,
        'can_audit_logs', false,
        'can_batch_import', false,
        'can_export_payroll', false,
        'can_view_currency_settings', false,
        'can_manage_currency', false,
        'can_lock_cycles', false,
        'can_view_all_departments', false
    ),
    'DEAN', jsonb_build_object(
        'can_manage_roles', false,
        'can_manage_rates', false,
        'can_manage_structure', false,
        'can_manage_settings', false,
        'can_audit_logs', false,
        'can_batch_import', false,
        'can_export_payroll', false,
        'can_view_currency_settings', false,
        'can_manage_currency', false,
        'can_lock_cycles', false,
        'can_view_all_departments', false
    ),
    'VICE_DEAN', jsonb_build_object(
        'can_manage_roles', false,
        'can_manage_rates', false,
        'can_manage_structure', false,
        'can_manage_settings', false,
        'can_audit_logs', false,
        'can_batch_import', false,
        'can_export_payroll', false,
        'can_view_currency_settings', false,
        'can_manage_currency', false,
        'can_lock_cycles', false,
        'can_view_all_departments', false
    ),
    'TEACHER', jsonb_build_object(
        'can_manage_roles', false,
        'can_manage_rates', false,
        'can_manage_structure', false,
        'can_manage_settings', false,
        'can_audit_logs', false,
        'can_batch_import', false,
        'can_export_payroll', false,
        'can_view_currency_settings', false,
        'can_manage_currency', false,
        'can_lock_cycles', false,
        'can_view_all_departments', false
    )
)
WHERE id = 1 AND (role_permissions IS NULL OR role_permissions = '{}'::jsonb);

-- Ensure row id=1 exists if table was newly created
INSERT INTO public.system_settings (id, base_currency, exchange_rate, finance_can_edit_exchange, role_permissions)
VALUES (
    1,
    'IQD',
    150000,
    true,
    jsonb_build_object(
        'IT_ADMIN', jsonb_build_object(
            'can_manage_roles', false,
            'can_manage_rates', true,
            'can_manage_structure', true,
            'can_manage_settings', false,
            'can_audit_logs', true,
            'can_batch_import', true,
            'can_export_payroll', false,
            'can_view_currency_settings', true,
            'can_manage_currency', false,
            'can_lock_cycles', false,
            'can_view_all_departments', true
        )
    )
)
ON CONFLICT (id) DO NOTHING;
