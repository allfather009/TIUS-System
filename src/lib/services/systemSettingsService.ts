import { createClient } from '@/lib/supabase/client';
import { SystemSettings } from '@/types/database';

export async function getSystemSettings(): Promise<SystemSettings> {
  if (typeof window === 'undefined') {
    // Server side, can use admin client or fetch absolute URL. 
    // Usually getSystemSettings is called on client or during API calls.
    // Let's use fetch with a relative URL if window exists, else return default.
    return { id: 1, base_currency: 'IQD', exchange_rate: 150000 };
  }

  try {
    const res = await fetch('/api/system-settings');
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
  } catch (err) {
    console.error('Error fetching system settings:', err);
  }
  return { id: 1, base_currency: 'IQD', exchange_rate: 150000 };
}

export async function updateSystemSettings(settings: Partial<SystemSettings>): Promise<boolean> {
  try {
    const res = await fetch('/api/system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const json = await res.json();
    return json.success;
  } catch (err) {
    console.error('Error updating system settings:', err);
    return false;
  }
}

/**
 * Universal Permission Check: Can this user view currency & exchange rates?
 * Supports per-user custom_permissions override for ANY user (Teacher, Coordinator, Accountant, HoD, etc.)
 */
export function checkCanViewCurrency(
  userRole?: string,
  customPerms?: Record<string, boolean> | null,
  isSuperAdmin?: boolean
): boolean {
  if (isSuperAdmin) return true;
  if (!customPerms) customPerms = {};

  // Explicit user-level override (highest priority)
  if (customPerms['can_view_currency_settings'] === true) return true;
  if (customPerms['can_manage_currency'] === true) return true;
  if (customPerms['can_edit_exchange_rate'] === true) return true;
  if (customPerms['can_view_currency_settings'] === false || customPerms['can_manage_currency'] === false) return false;

  // Role defaults (if not explicitly overridden):
  // Only Finance / Accountant view currency by default.
  // Coordinators, HoDs, and Teachers do NOT view currency unless explicitly granted permission.
  if (userRole === 'ACCOUNTANT') {
    return true;
  }

  return false;
}

/**
 * Universal Permission Check: Can this user edit/save system currency exchange rates?
 * Supports per-user custom_permissions override for ANY user.
 */
export function checkCanEditCurrency(
  userRole?: string,
  customPerms?: Record<string, boolean> | null,
  isSuperAdmin?: boolean
): boolean {
  if (isSuperAdmin) return true;
  if (!customPerms) customPerms = {};

  // Explicit user-level override (highest priority)
  if (customPerms['can_manage_currency'] === true) return true;
  if (customPerms['can_edit_exchange_rate'] === true) return true;
  if (customPerms['can_manage_currency'] === false || customPerms['can_edit_exchange_rate'] === false) return false;

  // Role defaults:
  if (userRole === 'ACCOUNTANT') {
    return true;
  }

  return false;
}

/**
 * Universal Permission Check: Can this user manage payroll cycle settings & lockout?
 * Supports per-user custom_permissions override for ANY user.
 */
export function checkCanManageCycles(
  userRole?: string,
  customPerms?: Record<string, boolean> | null,
  isSuperAdmin?: boolean
): boolean {
  if (isSuperAdmin) return true;
  if (!customPerms) customPerms = {};

  // Explicit user-level override (highest priority)
  if (customPerms['can_lock_cycles'] === true) return true;
  if (customPerms['can_lock_cycles'] === false) return false;

  // Role defaults:
  // Finance / Accountant manages payroll cycles by default
  if (userRole === 'ACCOUNTANT') {
    return true;
  }

  return false;
}
