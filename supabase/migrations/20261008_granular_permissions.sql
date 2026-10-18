-- =================================================================
-- Migration: Granular Permissions & Feature Toggles
-- Date: 2026-10-08
-- Description: Adds finance_can_edit_exchange to system_settings
--              and custom_permissions JSONB column to users.
-- =================================================================

-- 1. Add finance edit toggle to system_settings
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS finance_can_edit_exchange BOOLEAN DEFAULT true;

-- 2. Add custom_permissions JSONB to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT '{}'::jsonb;

-- 3. Ensure the singleton row has the new column populated
UPDATE system_settings
  SET finance_can_edit_exchange = true
  WHERE id = 1 AND finance_can_edit_exchange IS NULL;

-- =================================================================
-- RLS Policies (adjust as needed for your Supabase project)
-- =================================================================

-- Super Admin can update everything on system_settings
-- (Assuming existing policies already grant this)

-- Accountant can only update exchange_rate (not base_currency or finance_can_edit_exchange)
-- This is enforced at the application layer via the financeCanEditExchange flag.
-- If you want database-level enforcement:
--
-- CREATE POLICY "accountant_update_exchange_rate_only"
--   ON system_settings
--   FOR UPDATE
--   USING (auth.jwt() ->> 'role' = 'ACCOUNTANT')
--   WITH CHECK (
--     base_currency = (SELECT base_currency FROM system_settings WHERE id = 1)
--     AND finance_can_edit_exchange = (SELECT finance_can_edit_exchange FROM system_settings WHERE id = 1)
--   );
