'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  getSystemSettings,
  updateSystemSettings,
  updateRolePermissions,
  SYSTEM_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PermissionDefinition,
} from '@/lib/services/systemSettingsService';
import { getUsers, updateUserPermissions } from '@/lib/services/userService';
import { SystemSettings, UserRole } from '@/types/database';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useSession } from '@/lib/context/SessionContext';
import {
  Globe,
  Save,
  Check,
  Search,
  Users,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Coins,
  UserCog,
  ChevronRight,
  X,
  Shield,
  ShieldAlert,
  LayoutGrid,
  SlidersHorizontal,
  BarChart3,
  FileSpreadsheet,
  Lock,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { CustomSelect, CustomSelectOption } from '@/components/ui/CustomSelect';

const currencyOptions: CustomSelectOption[] = [
  { value: 'IQD', label: '🇮🇶 IQD — Iraqi Dinar' },
  { value: 'USD', label: '🇺🇸 USD — US Dollar' },
];

const GOVERNED_ROLES: Array<{
  role: UserRole;
  label: string;
  badge: string;
  desc: string;
}> = [
  {
    role: 'IT_ADMIN',
    label: 'IT Support Admin',
    badge: 'IT',
    desc: 'Technical operations, rates management, imports, and academic structure.',
  },
  {
    role: 'DEAN',
    label: 'Dean',
    badge: 'DEAN',
    desc: 'Faculty executive leadership and college governance.',
  },
  {
    role: 'VICE_DEAN',
    label: 'Vice Dean',
    badge: 'V-DEAN',
    desc: 'Deputy faculty administrator supporting academic programs.',
  },
  {
    role: 'HOD',
    label: 'Head of Department',
    badge: 'HOD',
    desc: 'Department curriculum supervision and Tier 1 timesheet approvals.',
  },
  {
    role: 'COORDINATOR',
    label: 'Academic Coordinator',
    badge: 'COORD',
    desc: 'Academic coordination, scheduling, and student workload planning.',
  },
  {
    role: 'ACCOUNTANT',
    label: 'Finance & Payroll',
    badge: 'FINANCE',
    desc: 'University treasury, payroll computations, and currency exchange clearing.',
  },
  {
    role: 'TEACHER',
    label: 'Teacher / Faculty',
    badge: 'FACULTY',
    desc: 'Academic instructional staff logging extra teaching and lecture hours.',
  },
];

interface SearchUser {
  id: string;
  name: string;
  email: string;
  role: string;
  academic_title: string | null;
  custom_permissions: Record<string, boolean> | null;
}

export default function AdminSettingsPage() {
  const session = useSession();

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string; isError?: boolean } | null>(null);

  const showToast = (title: string, desc: string, isError = false) => {
    setToastMessage({ title, desc, isError });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Settings state
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Currency card state
  const [currency, setCurrency] = useState<'USD' | 'IQD'>('IQD');
  const [exchangeRate, setExchangeRate] = useState<number>(150000);
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);
  const [currencySaved, setCurrencySaved] = useState(false);

  // Permission Governance tabs state: 'roles' (entire role) vs 'users' (individual user)
  const [activeGovernanceTab, setActiveGovernanceTab] = useState<'roles' | 'users'>('roles');

  // Tab 1: Role-Level Permissions state
  const [selectedRole, setSelectedRole] = useState<UserRole>('IT_ADMIN');
  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<string, boolean>>>(DEFAULT_ROLE_PERMISSIONS);
  const [isSavingRolePerms, setIsSavingRolePerms] = useState(false);
  const [rolePermsSaved, setRolePermsSaved] = useState(false);

  // Tab 2: User override state
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [isSavingUserPerms, setIsSavingUserPerms] = useState(false);
  const [userPermsSaved, setUserPermsSaved] = useState(false);

  // Authorization check
  const activeRole = session.user?.role || session.role;
  const isAuthorizedToManageSettings =
    session.isSuperAdmin ||
    activeRole === 'SUPER_ADMIN' ||
    session.hasPermission?.('can_manage_settings') ||
    session.user?.custom_permissions?.['can_manage_settings'] === true;

  // Load settings with strict no-store cache and deep merge
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/system-settings', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const data = json.data;
            setSettings(data);
            if (data.base_currency) setCurrency(data.base_currency);
            if (data.exchange_rate) setExchangeRate(data.exchange_rate);

            const merged: Record<string, Record<string, boolean>> = {};
            for (const [r, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
              merged[r] = { ...perms };
            }
            if (data.role_permissions && typeof data.role_permissions === 'object') {
              for (const [r, perms] of Object.entries(data.role_permissions)) {
                merged[r] = {
                  ...(merged[r] || (DEFAULT_ROLE_PERMISSIONS as any)[r] || {}),
                  ...(perms as Record<string, boolean>),
                };
              }
            }
            setRolePermissions(merged);
          }
        } else {
          console.error('Failed to load system settings:', res.status, res.statusText);
        }
      } catch (err) {
        console.error('Failed to load system settings on mount:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Save currency settings
  const handleSaveCurrency = async () => {
    if (!settings) return;
    setIsSavingCurrency(true);
    const success = await updateSystemSettings({ base_currency: currency, exchange_rate: exchangeRate });
    if (success) {
      setSettings({ ...settings, base_currency: currency, exchange_rate: exchangeRate });
      setCurrencySaved(true);
      setTimeout(() => setCurrencySaved(false), 3000);
      showToast('Success', 'Currency settings saved successfully.');
    } else {
      showToast('Error', 'Failed to save currency preferences.', true);
    }
    setIsSavingCurrency(false);
  };

  // Toggle role permission in Tab 1 with immediate state update & auto-save to Supabase
  const handleToggleRolePerm = async (key: string) => {
    const currentRoleObj = rolePermissions[selectedRole] || DEFAULT_ROLE_PERMISSIONS[selectedRole] || {};
    const currentVal = !!currentRoleObj[key];
    const updatedRoleObj = {
      ...currentRoleObj,
      [key]: !currentVal,
    };
    const updatedRolePermissions = {
      ...rolePermissions,
      [selectedRole]: updatedRoleObj,
    };

    setRolePermissions(updatedRolePermissions);
    setRolePermsSaved(false);
    setIsSavingRolePerms(true);

    try {
      const res = await fetch('/api/system-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_permissions: updatedRolePermissions }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setRolePermsSaved(true);
        setTimeout(() => setRolePermsSaved(false), 2500);
        await session.refreshPermissions();
        const roleLabel = GOVERNED_ROLES.find((r) => r.role === selectedRole)?.label || selectedRole;
        const permDef = SYSTEM_PERMISSIONS.find((p) => p.key === key);
        showToast('Permission Auto-Saved', `${permDef?.label || key} for ${roleLabel} is now ${!currentVal ? 'ENABLED' : 'DISABLED'}.`);
      } else {
        const errorMsg = json.error || 'Failed to save permission toggle to database.';
        showToast('Database Error', errorMsg, true);
        // Rollback state on error
        setRolePermissions(rolePermissions);
      }
    } catch (err: any) {
      console.error('Toggle role permission error:', err);
      showToast('Error', err?.message || 'Failed to save permission toggle.', true);
      setRolePermissions(rolePermissions);
    } finally {
      setIsSavingRolePerms(false);
    }
  };

  // Save role permissions in Tab 1 (manual save / confirmation action)
  const handleSaveRolePerms = async () => {
    setIsSavingRolePerms(true);
    try {
      const res = await fetch('/api/system-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_permissions: rolePermissions }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setRolePermsSaved(true);
        setTimeout(() => setRolePermsSaved(false), 3000);
        await session.refreshPermissions();
        const roleLabel = GOVERNED_ROLES.find((r) => r.role === selectedRole)?.label || selectedRole;
        showToast('Permissions Saved', `Role-level permissions for ${roleLabel} saved to database successfully.`);
      } else {
        const err = json.error || 'Failed to update role permissions in database.';
        showToast('Database Error', err, true);
      }
    } catch (err: any) {
      console.error('Save role permissions error:', err);
      showToast('Error', err?.message || 'An unexpected error occurred while saving role permissions.', true);
    } finally {
      setIsSavingRolePerms(false);
    }
  };

  // Reset role to system defaults and persist to database
  const handleResetRoleDefaults = async () => {
    const defaults = DEFAULT_ROLE_PERMISSIONS[selectedRole] || {};
    const updatedRolePermissions = {
      ...rolePermissions,
      [selectedRole]: { ...defaults },
    };
    setRolePermissions(updatedRolePermissions);
    setIsSavingRolePerms(true);

    try {
      const res = await fetch('/api/system-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_permissions: updatedRolePermissions }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setRolePermsSaved(true);
        setTimeout(() => setRolePermsSaved(false), 2500);
        await session.refreshPermissions();
        const roleLabel = GOVERNED_ROLES.find((r) => r.role === selectedRole)?.label || selectedRole;
        showToast('Defaults Restored', `Restored default baseline permissions for ${roleLabel}.`);
      } else {
        showToast('Database Error', json.error || 'Failed to reset defaults in database.', true);
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to reset defaults.', true);
    } finally {
      setIsSavingRolePerms(false);
    }
  };

  // Search users with debounce for Tab 2
  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/user-permissions?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setSearchResults(json.data as SearchUser[]);
          setIsSearching(false);
          return;
        }
      }

      // Fallback
      const allUsers = await getUsers();
      const filtered = allUsers
        .filter(
          (u) =>
            u.name.toLowerCase().includes(q.toLowerCase()) ||
            u.email.toLowerCase().includes(q.toLowerCase())
        )
        .slice(0, 5);
      setSearchResults(filtered as unknown as SearchUser[]);
    } catch (err) {
      console.error('User search error:', err);
    }
    setIsSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(userSearch), 300);
    return () => clearTimeout(timer);
  }, [userSearch, searchUsers]);

  // Select user for permission editing in Tab 2
  const handleSelectUser = (user: SearchUser) => {
    setSelectedUser(user);
    setUserPermissions(user.custom_permissions || {});
    setSearchResults([]);
    setUserSearch('');
    setUserPermsSaved(false);
  };

  // Toggle user permission in Tab 2 with role baseline awareness & auto-save to Supabase
  const handleToggleUserPerm = async (key: string) => {
    if (!selectedUser) return;
    const isExplicit = typeof userPermissions[key] === 'boolean';
    const userRole = (selectedUser.role as UserRole) || 'TEACHER';
    const roleBaseline = rolePermissions[userRole]?.[key] ?? DEFAULT_ROLE_PERMISSIONS[userRole]?.[key] ?? false;
    const currentEffective = isExplicit ? !!userPermissions[key] : roleBaseline;
    const nextVal = !currentEffective;

    const updatedUserPermissions = { ...userPermissions };
    if (nextVal === roleBaseline) {
      // If toggled value now matches role default, remove explicit override to keep JSON clean
      delete updatedUserPermissions[key];
    } else {
      updatedUserPermissions[key] = nextVal;
    }

    setUserPermissions(updatedUserPermissions);
    setUserPermsSaved(false);
    setIsSavingUserPerms(true);

    try {
      const res = await fetch('/api/user-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          custom_permissions: updatedUserPermissions,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSelectedUser({ ...selectedUser, custom_permissions: updatedUserPermissions });
        setUserPermsSaved(true);
        setTimeout(() => setUserPermsSaved(false), 2500);
        await session.refreshPermissions();
        const permDef = SYSTEM_PERMISSIONS.find((p) => p.key === key);
        const actionLabel = nextVal === roleBaseline ? 'INHERITED FROM ROLE' : nextVal ? 'OVERRIDE: ENABLED' : 'OVERRIDE: DISABLED';
        showToast('Override Saved', `${permDef?.label || key} for ${selectedUser.name} is now ${actionLabel}.`);
      } else {
        const errorMsg = json.error || 'Failed to update user permissions in database.';
        showToast('Database Error', errorMsg, true);
        setUserPermissions(userPermissions);
      }
    } catch (err: any) {
      console.error('Save user perms error:', err);
      showToast('Error', err?.message || 'An unexpected error occurred.', true);
      setUserPermissions(userPermissions);
    } finally {
      setIsSavingUserPerms(false);
    }
  };

  // Reset all overrides for selected user to inherit role defaults
  const handleResetUserPerms = async () => {
    if (!selectedUser) return;
    setIsSavingUserPerms(true);
    try {
      const res = await fetch('/api/user-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          custom_permissions: {},
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setUserPermissions({});
        setSelectedUser({ ...selectedUser, custom_permissions: {} });
        setUserPermsSaved(true);
        setTimeout(() => setUserPermsSaved(false), 2500);
        await session.refreshPermissions();
        showToast('Overrides Cleared', `Removed all individual overrides for ${selectedUser.name}. Now inheriting 100% from role (${selectedUser.role}).`);
      } else {
        showToast('Database Error', json.error || 'Failed to reset user overrides.', true);
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'An unexpected error occurred.', true);
    } finally {
      setIsSavingUserPerms(false);
    }
  };

  // Save user permissions in Tab 2 (manual confirmation action)
  const handleSaveUserPerms = async () => {
    if (!selectedUser) return;
    setIsSavingUserPerms(true);
    try {
      const res = await fetch('/api/user-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          custom_permissions: userPermissions,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSelectedUser({ ...selectedUser, custom_permissions: userPermissions });
        setUserPermsSaved(true);
        setTimeout(() => setUserPermsSaved(false), 3000);
        await session.refreshPermissions();
        showToast('Success', `Permissions successfully persisted to database for ${selectedUser.name || 'User'}`);
      } else {
        const errorMsg = json.error || 'Failed to update user permissions in database.';
        showToast('Database Error', errorMsg, true);
      }
    } catch (err: any) {
      console.error('Save user perms error:', err);
      showToast('Error', err?.message || 'An unexpected error occurred.', true);
    } finally {
      setIsSavingUserPerms(false);
    }
  };

  const currencyDirty = settings
    ? settings.base_currency !== currency || settings.exchange_rate !== exchangeRate
    : false;

  // Categorized permissions
  const adminModules = SYSTEM_PERMISSIONS.filter((p) => p.category === 'admin_modules');
  const operationalPrivileges = SYSTEM_PERMISSIONS.filter((p) => p.category === 'operational');

  const currentRolePerms = rolePermissions[selectedRole] || DEFAULT_ROLE_PERMISSIONS[selectedRole] || {};
  const currentRoleInfo = GOVERNED_ROLES.find((r) => r.role === selectedRole);

  // In-page access barrier if not authorized
  if (!loading && !isAuthorizedToManageSettings) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex flex-col justify-between">
        <Sidebar activeRole={activeRole || undefined} />
        <div className="pl-72 flex-1 flex flex-col">
          <Header
            breadcrumbCategory="TIU Central Administration"
            breadcrumbPage="Access Denied"
            activeViewLabel={session.activeViewLabel}
          />
          <main className="flex-1 flex items-center justify-center p-8 pt-24">
            <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-red-200 p-8 sm:p-10 text-center relative overflow-hidden">
              <div className="w-16 h-16 rounded-2xl bg-red-50 text-[#ba1a1a] flex items-center justify-center mx-auto mb-5 border border-red-200 shadow-sm">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-800 text-xs font-bold uppercase tracking-wider mb-3 border border-red-200">
                <Lock className="w-3.5 h-3.5 text-[#ba1a1a]" />
                403 Forbidden • Clearance Required
              </div>
              <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-[#0b1c30] tracking-tight mb-3">
                System Settings Access Blocked
              </h1>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                You do not possess the required clearance (<code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">can_manage_settings</code>) to configure global application settings.
              </p>
              <Link
                href="/admin/structure"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold transition-all"
              >
                Return to Academic Structure
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <Sidebar activeItem="settings" activeRole="SUPER_ADMIN" />

      <div className="pl-72 flex flex-col min-h-screen">
        <Header
          breadcrumbCategory="TIU Central Administration"
          breadcrumbPage="System Settings"
          activeViewLabel={session.activeViewLabel}
        />

        <main className="w-full flex-1 pt-20 pb-16 px-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Page Header */}
            <div>
              <h2 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1c30]">System Settings</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-3xl">
                Manage global application preferences, currency clearing rates, and university role &amp; user permission governance.
              </p>
            </div>

            {loading ? (
              <div className="flex items-center gap-3 text-slate-400 py-16 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Loading system settings...</span>
              </div>
            ) : (
              <>
                {/* ─────── CARD 1: LOCALIZATION & CURRENCY ─────── */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-headline font-bold text-base text-[#0b1c30]">Localization &amp; Currency Preferences</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Configure the primary base currency and system-wide exchange rate. All portals will reflect these values.
                      </p>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
                      {/* Currency Selector */}
                      <div className="grid gap-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Global Base Currency</label>
                        <div className="w-full">
                          <CustomSelect
                            value={currency}
                            onChange={(val) => setCurrency(val as 'USD' | 'IQD')}
                            options={currencyOptions}
                            placeholder="Select Base Currency..."
                            searchable={false}
                            triggerClassName="h-10 text-sm font-semibold"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Determines whether monetary values default to IQD or USD system-wide across all portals.
                        </p>
                      </div>

                      {/* Exchange Rate */}
                      <div className="grid gap-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">System Exchange Rate</label>
                        <div className="relative w-full">
                          <Coins className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                          <input
                            type="number"
                            value={exchangeRate}
                            onChange={(e) => setExchangeRate(Number(e.target.value))}
                            className="w-full h-10 pl-10 pr-24 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 transition-all"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">
                            IQD / $100
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Central Bank clearing rate used to convert USD base values to Iraqi Dinar equivalents.
                        </p>
                      </div>
                    </div>

                    {/* Save Currency Button */}
                    <div className="pt-2">
                      <button
                        onClick={handleSaveCurrency}
                        disabled={isSavingCurrency || !currencyDirty}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed bg-[#540225] hover:bg-[#721c3b] text-white cursor-pointer"
                      >
                        {isSavingCurrency ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : currencySaved ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>{isSavingCurrency ? 'Saving...' : currencySaved ? 'Saved ✓' : 'Save Currency Settings'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* ─────── CARD 2: UNIFIED ACCESS & PERMISSION CONTROL ENGINE ─────── */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                  {/* Card Header & Tabs */}
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 border border-violet-100">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-headline font-bold text-base text-[#0b1c30]">Role &amp; User Permission Governance</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-violet-100 text-violet-700">
                            Access Engine
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Centrally govern administrative access privileges. Modify permissions for an entire role or configure individual user overrides.
                        </p>
                      </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/60 self-start md:self-auto">
                      <button
                        type="button"
                        onClick={() => setActiveGovernanceTab('roles')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          activeGovernanceTab === 'roles'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Role-Level Permissions</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-violet-50 text-violet-700">
                          Entire Role
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveGovernanceTab('users')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          activeGovernanceTab === 'users'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <UserCog className="w-3.5 h-3.5" />
                        <span>User-Level Overrides</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-200/80 text-slate-700">
                          Individual
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6">
                    {/* ════════════════════════════════════════════════════════════════ */}
                    {/* TAB 1: ROLE-LEVEL PERMISSIONS (ENTIRE ROLE)                      */}
                    {/* ════════════════════════════════════════════════════════════════ */}
                    {activeGovernanceTab === 'roles' && (
                      <div className="space-y-6">
                        {/* Role Selector Pills */}
                        <div>
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 block">
                            Select System Role to Govern
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {GOVERNED_ROLES.map((r) => {
                              const isSelected = selectedRole === r.role;
                              return (
                                <button
                                  key={r.role}
                                  type="button"
                                  onClick={() => {
                                    setSelectedRole(r.role);
                                    setRolePermsSaved(false);
                                  }}
                                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                    isSelected
                                      ? 'bg-[#540225] text-white border-[#540225] shadow-xs'
                                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                                  }`}
                                >
                                  <span>{r.label}</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-mono font-extrabold ${
                                      isSelected
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-200 text-slate-600'
                                    }`}
                                  >
                                    {r.badge}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Active Role Context Info Banner */}
                        <div className="p-4 rounded-xl border border-violet-100 bg-violet-50/40 flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 font-bold text-xs">
                              {currentRoleInfo?.badge || 'ROLE'}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900">
                                Governing Baseline Permissions for: <span className="text-violet-700 font-extrabold">{currentRoleInfo?.label}</span>
                              </h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {currentRoleInfo?.desc} Changes apply university-wide to all accounts with this role, unless individually overridden in Tab 2.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                            {isSavingRolePerms && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-100 text-violet-700 text-xs font-semibold animate-pulse">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Saving...</span>
                              </div>
                            )}
                            {rolePermsSaved && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                <Check className="w-3.5 h-3.5" />
                                <span>Saved ✓</span>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={handleResetRoleDefaults}
                              disabled={isSavingRolePerms}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                              title="Reset this role to factory defaults"
                            >
                              <RotateCcw className="w-3 h-3 text-slate-400" />
                              <span>Reset Defaults</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveRolePerms}
                              disabled={isSavingRolePerms}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#540225] hover:bg-[#721c3b] transition-all shadow-xs cursor-pointer disabled:opacity-50"
                              title="Save role permissions to database"
                            >
                              {isSavingRolePerms ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : rolePermsSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                              <span>{isSavingRolePerms ? 'Saving...' : rolePermsSaved ? 'Saved ✓' : 'Save'}</span>
                            </button>
                          </div>
                        </div>

                        {/* SECTION A: Admin Portal Modules */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                              <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
                              <span>Admin Portal Modules &amp; Sub-Routes</span>
                            </h4>
                            <span className="text-[11px] text-slate-400 font-medium">
                              Controls visibility in sidebar &amp; route access guards
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {adminModules.map((perm) => {
                              const isEnabled = !!currentRolePerms[perm.key];
                              return (
                                <div
                                  key={perm.key}
                                  className={`flex items-start justify-between gap-4 p-4 rounded-xl border transition-all ${
                                    isEnabled
                                      ? 'bg-white border-violet-200 shadow-2xs ring-1 ring-violet-100'
                                      : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <p className="text-xs font-bold text-slate-900">{perm.label}</p>
                                      {perm.route && (
                                        <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/60 font-semibold">
                                          {perm.route}
                                        </code>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">{perm.description}</p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleRolePerm(perm.key)}
                                    className="shrink-0 cursor-pointer pt-0.5"
                                    aria-label={`Toggle ${perm.label}`}
                                  >
                                    {isEnabled ? (
                                      <ToggleRight className="w-8 h-8 text-emerald-500" />
                                    ) : (
                                      <ToggleLeft className="w-8 h-8 text-slate-300 hover:text-slate-400" />
                                    )}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* SECTION B: Operational & General Privileges */}
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                              <span>Operational &amp; General Privileges</span>
                            </h4>
                            <span className="text-[11px] text-slate-400 font-medium">
                              Cross-portal functional operations &amp; currency permissions
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {operationalPrivileges.map((perm) => {
                              const isEnabled = !!currentRolePerms[perm.key];
                              return (
                                <div
                                  key={perm.key}
                                  className={`flex items-start justify-between gap-4 p-4 rounded-xl border transition-all ${
                                    isEnabled
                                      ? 'bg-white border-violet-200 shadow-2xs ring-1 ring-violet-100'
                                      : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-900 mb-1">{perm.label}</p>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">{perm.description}</p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleRolePerm(perm.key)}
                                    className="shrink-0 cursor-pointer pt-0.5"
                                    aria-label={`Toggle ${perm.label}`}
                                  >
                                    {isEnabled ? (
                                      <ToggleRight className="w-8 h-8 text-emerald-500" />
                                    ) : (
                                      <ToggleLeft className="w-8 h-8 text-slate-300 hover:text-slate-400" />
                                    )}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Save Role Permissions Action Bar */}
                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              Role Simulator is hardcoded strictly to <strong>SUPER_ADMIN</strong> and cannot be granted to any other role.
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={handleSaveRolePerms}
                            disabled={isSavingRolePerms}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 bg-[#540225] hover:bg-[#721c3b] text-white cursor-pointer"
                          >
                            {isSavingRolePerms ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : rolePermsSaved ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            <span>{isSavingRolePerms ? 'Saving Permissions...' : rolePermsSaved ? 'Permissions Saved ✓' : 'Save Role Permissions'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ════════════════════════════════════════════════════════════════ */}
                    {/* TAB 2: USER-LEVEL OVERRIDES (INDIVIDUAL USER)                    */}
                    {/* ════════════════════════════════════════════════════════════════ */}
                    {activeGovernanceTab === 'users' && (
                      <div className="space-y-6">
                        {/* Search Input */}
                        <div className="relative w-full max-w-md">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                          <input
                            type="text"
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            placeholder="Search user by name or email..."
                            className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all"
                          />
                          {isSearching && (
                            <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-3 top-3" />
                          )}
                        </div>

                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                          <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-md max-h-60 overflow-y-auto">
                            {searchResults.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => handleSelectUser(u)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0 cursor-pointer"
                              >
                                <div className="w-8 h-8 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center text-[11px] font-bold shrink-0 border border-violet-100">
                                  {u.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-800 truncate">{u.name}</p>
                                  <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                                </div>
                                <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase">
                                  {u.role}
                                </span>
                                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Selected User Override Panel */}
                        {selectedUser ? (
                          <div className="rounded-xl border border-violet-100 bg-violet-50/30 overflow-hidden space-y-4">
                            {/* User Header */}
                            <div className="p-4 border-b border-violet-100 flex items-center justify-between bg-white/70">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-bold border border-violet-200">
                                  {selectedUser.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{selectedUser.name}</p>
                                  <p className="text-[11px] text-slate-500">
                                    {selectedUser.email} • <span className="uppercase font-bold text-violet-600">{selectedUser.role}</span>
                                    {Object.keys(userPermissions).length > 0 && (
                                      <span className="ml-2 text-amber-600 font-semibold">({Object.keys(userPermissions).length} active override{Object.keys(userPermissions).length > 1 ? 's' : ''})</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={handleResetUserPerms}
                                  disabled={isSavingUserPerms || Object.keys(userPermissions).length === 0}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-40 cursor-pointer shadow-2xs transition-all"
                                  title="Clear all custom overrides so this user inherits their role default permissions"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Reset to Role Baseline</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUser(null);
                                    setUserPermissions({});
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Section 1: Admin Modules for user */}
                            <div className="px-4 space-y-2">
                              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Admin Portal Modules Override
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {adminModules.map((perm) => {
                                  const isExplicit = typeof userPermissions[perm.key] === 'boolean';
                                  const userRole = (selectedUser.role as UserRole) || 'TEACHER';
                                  const roleBaseline = rolePermissions[userRole]?.[perm.key] ?? DEFAULT_ROLE_PERMISSIONS[userRole]?.[perm.key] ?? false;
                                  const effectiveVal = isExplicit ? !!userPermissions[perm.key] : roleBaseline;

                                  return (
                                    <div
                                      key={perm.key}
                                      className={`flex items-start justify-between gap-4 p-3.5 rounded-xl border transition-all ${
                                        effectiveVal
                                          ? 'bg-white border-violet-200 shadow-2xs'
                                          : 'bg-slate-50/70 border-slate-200'
                                      }`}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                          <p className="text-xs font-bold text-slate-800">{perm.label}</p>
                                          {isExplicit ? (
                                            effectiveVal ? (
                                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                Override: Granted
                                              </span>
                                            ) : (
                                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                                Override: Revoked
                                              </span>
                                            )
                                          ) : (
                                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                              Inherited ({roleBaseline ? 'Active' : 'Inactive'})
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">{perm.description}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleUserPerm(perm.key)}
                                        className="shrink-0 cursor-pointer pt-0.5"
                                        aria-label={`Toggle override for ${perm.label}`}
                                      >
                                        {effectiveVal ? (
                                          <ToggleRight className="w-8 h-8 text-emerald-500" />
                                        ) : (
                                          <ToggleLeft className="w-8 h-8 text-slate-300 hover:text-slate-400" />
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Section 2: Operational Privileges for user */}
                            <div className="px-4 space-y-2 pt-2">
                              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Operational &amp; Currency Privileges Override
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {operationalPrivileges.map((perm) => {
                                  const isExplicit = typeof userPermissions[perm.key] === 'boolean';
                                  const userRole = (selectedUser.role as UserRole) || 'TEACHER';
                                  const roleBaseline = rolePermissions[userRole]?.[perm.key] ?? DEFAULT_ROLE_PERMISSIONS[userRole]?.[perm.key] ?? false;
                                  const effectiveVal = isExplicit ? !!userPermissions[perm.key] : roleBaseline;

                                  return (
                                    <div
                                      key={perm.key}
                                      className={`flex items-start justify-between gap-4 p-3.5 rounded-xl border transition-all ${
                                        effectiveVal
                                          ? 'bg-white border-violet-200 shadow-2xs'
                                          : 'bg-slate-50/70 border-slate-200'
                                      }`}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                          <p className="text-xs font-bold text-slate-800">{perm.label}</p>
                                          {isExplicit ? (
                                            effectiveVal ? (
                                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                Override: Granted
                                              </span>
                                            ) : (
                                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                                Override: Revoked
                                              </span>
                                            )
                                          ) : (
                                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                              Inherited ({roleBaseline ? 'Active' : 'Inactive'})
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">{perm.description}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleUserPerm(perm.key)}
                                        className="shrink-0 cursor-pointer pt-0.5"
                                        aria-label={`Toggle override for ${perm.label}`}
                                      >
                                        {effectiveVal ? (
                                          <ToggleRight className="w-8 h-8 text-emerald-500" />
                                        ) : (
                                          <ToggleLeft className="w-8 h-8 text-slate-300 hover:text-slate-400" />
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Save User Overrides */}
                            <div className="p-4 pt-2 flex items-center gap-3">
                              <button
                                onClick={handleSaveUserPerms}
                                disabled={isSavingUserPerms}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                              >
                                {isSavingUserPerms ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : userPermsSaved ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Save className="w-3.5 h-3.5" />
                                )}
                                <span>{isSavingUserPerms ? 'Saving Override...' : userPermsSaved ? 'Override Saved ✓' : 'Save User Overrides'}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 px-5 py-8 rounded-xl bg-slate-50 border border-dashed border-slate-200">
                            <Users className="w-5 h-5 text-slate-300" />
                            <p className="text-xs text-slate-400">
                              Search for a faculty member or staff above to configure specific individual overrides that take precedence over their role default.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Floating Toast Notification */}
          {toastMessage && (
            <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
              <div
                className={`rounded-xl shadow-xl border p-4 pr-12 relative max-w-sm ${
                  toastMessage.isError ? 'bg-red-600 border-red-700' : 'bg-slate-900 border-slate-800'
                }`}
              >
                <h5 className="font-bold text-white">{toastMessage.title}</h5>
                <p className="text-slate-300 mt-0.5 leading-relaxed text-sm">{toastMessage.desc}</p>
                <button
                  onClick={() => setToastMessage(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
