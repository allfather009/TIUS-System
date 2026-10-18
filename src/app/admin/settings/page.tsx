'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getSystemSettings, updateSystemSettings } from '@/lib/services/systemSettingsService';
import { getUsers, updateUserPermissions } from '@/lib/services/userService';
import { SystemSettings } from '@/types/database';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useSession } from '@/lib/context/SessionContext';
import {
  Globe,
  Shield,
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
} from 'lucide-react';
import { CustomSelect, CustomSelectOption } from '@/components/ui/CustomSelect';

const currencyOptions: CustomSelectOption[] = [
  { value: 'IQD', label: '🇮🇶 IQD — Iraqi Dinar' },
  { value: 'USD', label: '🇺🇸 USD — US Dollar' },
];

// Permission definitions available for user-level overrides
const AVAILABLE_PERMISSIONS = [
  { key: 'can_view_currency_settings', label: 'View Currency Settings', description: 'View system exchange rate and currency preferences across all portals' },
  { key: 'can_manage_currency', label: 'Manage Currency & Rates', description: 'Permission to modify system currency conversion rates' },
  { key: 'can_audit_logs', label: 'Audit Logs Access', description: 'View and export system audit trail' },
  { key: 'can_manage_rates', label: 'Manage Academic Rates', description: 'Create and edit hourly rate tiers' },
  { key: 'can_export_payroll', label: 'Export Payroll Data', description: 'Download payroll CSVs and reports' },
  { key: 'can_manage_structure', label: 'Manage Academic Structure', description: 'Modify departments and faculties' },
  { key: 'can_batch_import', label: 'Batch Import Data', description: 'Import users and data via CSV' },
  { key: 'can_view_all_departments', label: 'View All Departments', description: 'Cross-department visibility' },
  { key: 'can_lock_cycles', label: 'Lock Payroll Cycles', description: 'Permission to lock/unlock pay cycles' },
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
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);

  const showToast = (title: string, desc: string) => {
    setToastMessage({ title, desc });
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Settings state
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Currency card state
  const [currency, setCurrency] = useState<'USD' | 'IQD'>('IQD');
  const [exchangeRate, setExchangeRate] = useState<number>(150000);
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);
  const [currencySaved, setCurrencySaved] = useState(false);

  // User override state
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [isSavingUserPerms, setIsSavingUserPerms] = useState(false);
  const [userPermsSaved, setUserPermsSaved] = useState(false);

  // Load settings
  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getSystemSettings();
      setSettings(data);
      setCurrency(data.base_currency);
      setExchangeRate(data.exchange_rate);
      setLoading(false);
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
    }
    setIsSavingCurrency(false);
  };

  // Search users with debounce
  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      // 1. Try admin API route first for freshest permissions from DB
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
      } catch {}

      // 2. Fallback to getUsers()
      const allUsers = await getUsers();
      const filtered = allUsers.filter(u => 
        u.name.toLowerCase().includes(q.toLowerCase()) || 
        u.email.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 5); // top 5 results
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

  // Select user for permission editing
  const handleSelectUser = (user: SearchUser) => {
    setSelectedUser(user);
    setUserPermissions(user.custom_permissions || {});
    setSearchResults([]);
    setUserSearch('');
    setUserPermsSaved(false);
  };

  // Toggle a user permission
  const handleToggleUserPerm = (key: string) => {
    setUserPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setUserPermsSaved(false);
  };

  // Save user permissions
  const handleSaveUserPerms = async () => {
    if (!selectedUser) return;
    setIsSavingUserPerms(true);
    try {
      const res = await updateUserPermissions(selectedUser.id, userPermissions);
      console.log('DEBUG: res from updateUserPermissions:', res);
      
      if (res.success && res.user) {
        setSelectedUser({ ...selectedUser, custom_permissions: userPermissions });
        setUserPermsSaved(true);
        setTimeout(() => setUserPermsSaved(false), 3000);
        showToast('Success', `Permissions successfully updated for ${selectedUser.name || 'User'}`);
      } else {
        const errorMsg = res.error || 'Failed to update user permissions.';
        console.warn('Update error:', res.error);
        console.log('DEBUG: res.error type:', typeof res.error, 'value:', JSON.stringify(res.error));
        showToast('Error', typeof errorMsg === 'string' ? errorMsg : 'Failed to update user permissions.');
      }
    } catch (err) {
      console.warn('Save user perms error:', err);
      showToast('Error', 'An unexpected error occurred.');
    }
    setIsSavingUserPerms(false);
  };

  const currencyDirty = settings
    ? settings.base_currency !== currency || settings.exchange_rate !== exchangeRate
    : false;

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <Sidebar activeItem="settings" activeRole="SUPER_ADMIN" />

      <div className="pl-72 flex flex-col min-h-screen">
        <Header
          breadcrumbCategory="TIU Central Administration"
          breadcrumbPage="System Settings"
          activeViewLabel="Super Admin"
        />

        <main className="w-full flex-1 pt-20 pb-16 px-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Page Header */}
            <div>
              <h2 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1c30]">System Settings</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-3xl">
                Manage global application preferences, currency localization, and granular access controls.
              </p>
            </div>

            {loading ? (
              <div className="flex items-center gap-3 text-slate-400 py-16 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Loading system settings...</span>
              </div>
            ) : (
              <>
                {/* Top Cards in a 2-column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">



      {/* ─────── CARD 1: LOCALIZATION & CURRENCY ─────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Card Header */}
        <div className="p-6 border-b border-slate-100 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <Globe className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-headline font-bold text-base text-[#0b1c30]">Localization & Currency Preferences</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure the primary base currency and system-wide exchange rate. All portals will reflect these values.
            </p>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-6">
          {/* Currency Selector */}
          <div className="grid gap-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Global Base Currency</label>
            <div className="w-full max-w-[280px]">
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
            <div className="relative w-full max-w-[280px]">
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

          {/* Save Button */}
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

      {/* ─────── CARD 2: UNIVERSAL ACCESS CONTROL OVERVIEW ─────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col justify-between">
        {/* Card Header */}
        <div className="p-6 border-b border-slate-100 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 border border-violet-100">
            <Shield className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-headline font-bold text-base text-[#0b1c30]">Universal Access Control</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Granular permission management is unified universally per user in the directory below.
            </p>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-xl bg-violet-50/60 border border-violet-100 text-xs text-violet-950 space-y-2">
            <p className="font-bold text-violet-900 flex items-center gap-2">
              <Check className="w-4 h-4 text-violet-600" />
              General Permissions for All Staff &amp; Faculty
            </p>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Currency viewing, exchange rate management, audit trails, and cycle locks are no longer isolated to specific role boxes. You can grant or remove any permission for any individual user (teachers, coordinators, accountants, or HoDs) directly below.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span><strong>View Currency Settings:</strong> Grantable to any teacher, coordinator, or staff</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span><strong>Manage Currency &amp; Rates:</strong> Grantable to any finance officer or administrator</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span><strong>Real-Time Synchronization:</strong> Updates apply instantly to user portals</span>
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Manage user permissions below</span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>
      {/* End of top 2-column grid */}
    </div>

      {/* ─────── CARD 3: USER PERMISSION OVERRIDES (FULL WIDTH) ─────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Card Header */}
        <div className="p-6 border-b border-slate-100 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 border border-violet-100">
            <UserCog className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-headline font-bold text-base text-[#0b1c30]">User-Level Permission Overrides</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Search the directory to grant specific privileges to individual users, overriding their base role defaults.
            </p>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-6">

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

            {/* Selected User Permission Panel */}
            {selectedUser ? (
              <div className="rounded-xl border border-violet-100 bg-violet-50/30 overflow-hidden">
                {/* User Header */}
                <div className="p-4 border-b border-violet-100 flex items-center justify-between bg-white/60">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-bold border border-violet-200">
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{selectedUser.name}</p>
                      <p className="text-[11px] text-slate-500">{selectedUser.email} • <span className="uppercase font-bold text-violet-600">{selectedUser.role}</span></p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedUser(null); setUserPermissions({}); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Permission Toggles */}
                <div className="p-4 space-y-2">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <div
                      key={perm.key}
                      className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg bg-white border border-slate-100 hover:border-violet-200 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700">{perm.label}</p>
                        <p className="text-[10px] text-slate-400">{perm.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleUserPerm(perm.key)}
                        className="shrink-0 cursor-pointer"
                      >
                        {userPermissions[perm.key] ? (
                          <ToggleRight className="w-8 h-8 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-slate-300" />
                        )}
                      </button>
                    </div>
                  ))}

                  {/* Save User Perms */}
                  <div className="pt-3 flex items-center gap-3">
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
                      <span>{isSavingUserPerms ? 'Saving...' : userPermsSaved ? 'Saved ✓' : 'Save'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-5 py-6 rounded-xl bg-slate-50 border border-dashed border-slate-200">
                <Users className="w-5 h-5 text-slate-300" />
                <p className="text-xs text-slate-400">Search for a user above to view and manage their individual permission overrides.</p>
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
      <div className={`rounded-xl shadow-xl border p-4 pr-12 relative max-w-sm ${
        toastMessage.title === 'Error' ? 'bg-red-600 border-red-700' : 'bg-slate-900 border-slate-800'
      }`}>
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
