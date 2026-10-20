import { SystemSettings, UserRole } from '@/types/database';

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: 'admin_modules' | 'operational';
  route?: string;
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // Admin Portal Modules
  {
    key: 'can_manage_roles',
    label: 'Manage User Roles',
    description: 'Access and manage user accounts, assign roles, and directory administration (/admin/roles)',
    category: 'admin_modules',
    route: '/admin/roles',
  },
  {
    key: 'can_manage_rates',
    label: 'Academic Rates',
    description: 'Configure and modify hourly pay rates by academic title (/admin/rates)',
    category: 'admin_modules',
    route: '/admin/rates',
  },
  {
    key: 'can_manage_structure',
    label: 'Academic Structure',
    description: 'Configure faculties, departments, and course stages (/admin/structure)',
    category: 'admin_modules',
    route: '/admin/structure',
  },
  {
    key: 'can_manage_settings',
    label: 'System & Currency Settings',
    description: 'Access global preferences, currency rates, and permission governance (/admin/settings)',
    category: 'admin_modules',
    route: '/admin/settings',
  },
  {
    key: 'can_audit_logs',
    label: 'Audit Logs',
    description: 'View chronological audit trails and administrative security actions (/admin/audit)',
    category: 'admin_modules',
    route: '/admin/audit',
  },
  {
    key: 'can_batch_import',
    label: 'Batch Import Data',
    description: 'Bulk import users, faculty records, and course catalogs from CSV (/admin/import)',
    category: 'admin_modules',
    route: '/admin/import',
  },
  {
    key: 'can_export_payroll',
    label: 'Reports & Analytics',
    description: 'Access cross-department analytics, financial summaries, and reporting (/admin/reports)',
    category: 'admin_modules',
    route: '/admin/reports',
  },

  // Operational & General Privileges
  {
    key: 'can_view_currency_settings',
    label: 'View Currency Settings',
    description: 'View active exchange rates and currency preferences across all portals',
    category: 'operational',
  },
  {
    key: 'can_manage_currency',
    label: 'Manage Currency & Rates',
    description: 'Authorize editing and updating central exchange rates (IQD / USD)',
    category: 'operational',
  },
  {
    key: 'can_lock_cycles',
    label: 'Lock/Unlock Payroll Cycles',
    description: 'Authorize locking active payroll cycles to prevent extra-hours log edits',
    category: 'operational',
  },
  {
    key: 'can_view_all_departments',
    label: 'View All Departments',
    description: 'Cross-department visibility across requests, logs, and summaries',
    category: 'operational',
  },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Record<string, boolean>> = {
  SUPER_ADMIN: {
    can_manage_roles: true,
    can_manage_rates: true,
    can_manage_structure: true,
    can_manage_settings: true,
    can_audit_logs: true,
    can_batch_import: true,
    can_export_payroll: true,
    can_view_currency_settings: true,
    can_manage_currency: true,
    can_lock_cycles: true,
    can_view_all_departments: true,
  },
  IT_ADMIN: {
    can_manage_roles: false,
    can_manage_rates: true,
    can_manage_structure: true,
    can_manage_settings: false,
    can_audit_logs: true,
    can_batch_import: true,
    can_export_payroll: false,
    can_view_currency_settings: true,
    can_manage_currency: false,
    can_lock_cycles: false,
    can_view_all_departments: true,
  },
  ACCOUNTANT: {
    can_manage_roles: false,
    can_manage_rates: false,
    can_manage_structure: false,
    can_manage_settings: false,
    can_audit_logs: false,
    can_batch_import: false,
    can_export_payroll: true,
    can_view_currency_settings: true,
    can_manage_currency: true,
    can_lock_cycles: true,
    can_view_all_departments: true,
  },
  HOD: {
    can_manage_roles: false,
    can_manage_rates: false,
    can_manage_structure: true,
    can_manage_settings: false,
    can_audit_logs: false,
    can_batch_import: false,
    can_export_payroll: false,
    can_view_currency_settings: false,
    can_manage_currency: false,
    can_lock_cycles: false,
    can_view_all_departments: false,
  },
  COORDINATOR: {
    can_manage_roles: false,
    can_manage_rates: false,
    can_manage_structure: false,
    can_manage_settings: false,
    can_audit_logs: false,
    can_batch_import: false,
    can_export_payroll: false,
    can_view_currency_settings: false,
    can_manage_currency: false,
    can_lock_cycles: false,
    can_view_all_departments: false,
  },
  DEAN: {
    can_manage_roles: false,
    can_manage_rates: false,
    can_manage_structure: false,
    can_manage_settings: false,
    can_audit_logs: false,
    can_batch_import: false,
    can_export_payroll: false,
    can_view_currency_settings: false,
    can_manage_currency: false,
    can_lock_cycles: false,
    can_view_all_departments: false,
  },
  VICE_DEAN: {
    can_manage_roles: false,
    can_manage_rates: false,
    can_manage_structure: false,
    can_manage_settings: false,
    can_audit_logs: false,
    can_batch_import: false,
    can_export_payroll: false,
    can_view_currency_settings: false,
    can_manage_currency: false,
    can_lock_cycles: false,
    can_view_all_departments: false,
  },
  TEACHER: {
    can_manage_roles: false,
    can_manage_rates: false,
    can_manage_structure: false,
    can_manage_settings: false,
    can_audit_logs: false,
    can_batch_import: false,
    can_export_payroll: false,
    can_view_currency_settings: false,
    can_manage_currency: false,
    can_lock_cycles: false,
    can_view_all_departments: false,
  },
};

/**
 * Universal Effective Permission Resolver
 * Strict priority order:
 * 1. SUPER_ADMIN -> Always true for everything (including Simulator).
 *    HARD RULE: Portal / Role Simulator is NEVER accessible to anyone other than SUPER_ADMIN.
 * 2. User-Level Override -> If explicitly set for that specific user_id, use user override.
 * 3. Role-Level Permission -> Otherwise, use the saved permissions for user's assigned role.
 * 4. Default Role Fallback -> System built-in default for that role.
 */
export function resolveEffectivePermission(
  permissionKey: string,
  role?: string | null,
  userOverrides?: Record<string, boolean> | null,
  rolePermissions?: Record<string, Record<string, boolean>> | null
): boolean {
  // 1. SUPER_ADMIN is always true for everything
  if (role === 'SUPER_ADMIN') {
    return true;
  }

  // HARD RULE: The Portal/Role Simulator must NEVER be toggleable or accessible to IT_ADMIN or any other role
  if (
    permissionKey === 'can_simulate_roles' ||
    permissionKey === 'simulator' ||
    permissionKey === 'role_simulator'
  ) {
    return false;
  }

  // Aliases support for backward compatibility
  const aliases: Record<string, string[]> = {
    can_manage_rates: ['can_manage_rates', 'can_edit_rates'],
    can_export_payroll: ['can_export_payroll', 'can_view_reports'],
    can_audit_logs: ['can_audit_logs', 'can_view_audit'],
    can_batch_import: ['can_batch_import', 'can_import_data'],
    can_view_currency_settings: ['can_view_currency_settings'],
    can_manage_currency: ['can_manage_currency', 'can_edit_exchange_rate'],
  };

  const keysToCheck = aliases[permissionKey] || [permissionKey];

  // 2. User-Level Override (Individual User)
  if (userOverrides) {
    for (const k of keysToCheck) {
      if (typeof userOverrides[k] === 'boolean') {
        return userOverrides[k];
      }
    }
  }

  // 3. Role-Level Permission (Entire Role)
  if (role && rolePermissions && rolePermissions[role]) {
    for (const k of keysToCheck) {
      if (typeof rolePermissions[role][k] === 'boolean') {
        return rolePermissions[role][k];
      }
    }
  }

  // 4. Default Role Fallback
  if (role && (role as UserRole) in DEFAULT_ROLE_PERMISSIONS) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[role as UserRole];
    for (const k of keysToCheck) {
      if (typeof defaults[k] === 'boolean') {
        return defaults[k];
      }
    }
  }

  return false;
}

export async function getSystemSettings(): Promise<SystemSettings> {
  if (typeof window === 'undefined') {
    return {
      id: 1,
      base_currency: 'IQD',
      exchange_rate: 150000,
      role_permissions: DEFAULT_ROLE_PERMISSIONS,
    };
  }

  try {
    const res = await fetch('/api/system-settings', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.error('Error fetching system settings:', err);
  }
  return {
    id: 1,
    base_currency: 'IQD',
    exchange_rate: 150000,
    role_permissions: DEFAULT_ROLE_PERMISSIONS,
  };
}

export async function updateSystemSettings(settings: Partial<SystemSettings>): Promise<boolean> {
  try {
    const res = await fetch('/api/system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.error('Failed to update system settings:', errJson.error || res.statusText);
      return false;
    }
    const json = await res.json();
    return Boolean(json.success);
  } catch (err) {
    console.error('Error updating system settings:', err);
    return false;
  }
}

export async function getRolePermissions(): Promise<Record<string, Record<string, boolean>>> {
  const settings = await getSystemSettings();
  return settings.role_permissions || DEFAULT_ROLE_PERMISSIONS;
}

export async function updateRolePermissions(
  role: UserRole,
  permissions: Record<string, boolean>
): Promise<boolean> {
  try {
    const current = await getSystemSettings();
    const existingRolePerms = current.role_permissions || DEFAULT_ROLE_PERMISSIONS;
    const updatedRolePerms = {
      ...existingRolePerms,
      [role]: {
        ...(existingRolePerms[role] || DEFAULT_ROLE_PERMISSIONS[role] || {}),
        ...permissions,
      },
    };

    return await updateSystemSettings({
      role_permissions: updatedRolePerms,
    });
  } catch (err) {
    console.error('Error saving role permissions:', err);
    return false;
  }
}

/**
 * Universal Permission Check: Can this user view currency & exchange rates?
 */
export function checkCanViewCurrency(
  userRole?: string,
  customPerms?: Record<string, boolean> | null,
  isSuperAdmin?: boolean,
  rolePerms?: Record<string, Record<string, boolean>> | null
): boolean {
  if (isSuperAdmin) return true;
  return resolveEffectivePermission('can_view_currency_settings', userRole, customPerms, rolePerms);
}

/**
 * Universal Permission Check: Can this user edit/save system currency exchange rates?
 */
export function checkCanEditCurrency(
  userRole?: string,
  customPerms?: Record<string, boolean> | null,
  isSuperAdmin?: boolean,
  rolePerms?: Record<string, Record<string, boolean>> | null
): boolean {
  if (isSuperAdmin) return true;
  return resolveEffectivePermission('can_manage_currency', userRole, customPerms, rolePerms);
}

/**
 * Universal Permission Check: Can this user manage payroll cycle settings & lockout?
 */
export function checkCanManageCycles(
  userRole?: string,
  customPerms?: Record<string, boolean> | null,
  isSuperAdmin?: boolean,
  rolePerms?: Record<string, Record<string, boolean>> | null
): boolean {
  if (isSuperAdmin) return true;
  return resolveEffectivePermission('can_lock_cycles', userRole, customPerms, rolePerms);
}
