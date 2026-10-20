'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { EditRateModal } from '@/components/admin/EditRateModal';
import {
  getAcademicRates,
  updateAcademicRate,
  createAcademicRate,
  deleteAcademicRate,
  toggleAcademicRateStatus,
} from '@/lib/services/rateService';
import { getSystemSettings } from '@/lib/services/systemSettingsService';
import { getUsers } from '@/lib/services/userService';
import { AcademicRate, UserRole, SystemSettings, UniversityUser } from '@/types/database';
import { useSession } from '@/lib/context/SessionContext';
import {
  DollarSign,
  Coins,
  TrendingUp,
  Award,
  Clock,
  Edit2,
  Trash2,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  ShieldAlert,
  AlertCircle,
  Lock,
  ArrowLeft,
  Sparkles,
  Building,
  PowerOff,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export default function AdminRatesPage() {
  const session = useSession();

  // Active identity & strict role state initialized deterministically
  const [activeRole, setActiveRole] = useState<UserRole>('SUPER_ADMIN');
  const [rates, setRates] = useState<AcademicRate[]>([]);
  const [allUsers, setAllUsers] = useState<UniversityUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Currency state from system_settings
  const [baseCurrency, setBaseCurrency] = useState<'USD' | 'IQD'>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(150000);

  // Modals state
  const [editingRate, setEditingRate] = useState<AcademicRate | null>(null);
  const [rateToDelete, setRateToDelete] = useState<AcademicRate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newRate, setNewRate] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);

  const showToast = (title: string, desc: string) => {
    setToastMessage({ title, desc });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const forcedRole = params.get('role');
      if (['SUPER_ADMIN', 'IT_ADMIN', 'COORDINATOR', 'HOD', 'DEAN', 'VICE_DEAN', 'TEACHER', 'ACCOUNTANT'].includes(forcedRole || '')) {
        setActiveRole(forcedRole as UserRole);
        return;
      }
      const match = document.cookie.match(/tius_session=([^;]+)/);
      if (match) {
        try {
          const raw = match[1];
          const decoded = raw.includes('%') ? decodeURIComponent(raw) : raw;
          const sess = JSON.parse(decoded);
          if (sess?.role) {
            setActiveRole(sess.role as UserRole);
          }
        } catch {
          // ignore
        }
      }
    }
  }, []);

  // Fetch rates, system settings, and university users
  const loadRates = async () => {
    setLoading(true);
    try {
      const [fetched, sysSettings, usersData] = await Promise.all([
        getAcademicRates(),
        getSystemSettings(),
        getUsers(),
      ]);
      if (fetched && fetched.length > 0) {
        setRates(fetched);
      }
      setBaseCurrency(sysSettings.base_currency);
      setExchangeRate(sysSettings.exchange_rate);
      if (usersData && usersData.length > 0) {
        setAllUsers(usersData);
      }
    } catch (err) {
      console.error('Failed to load academic rates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  // Filtered rates
  const filteredRates = useMemo(() => {
    if (!search.trim()) return rates;
    const q = search.toLowerCase();
    return rates.filter((r) => r.title.toLowerCase().includes(q));
  }, [rates, search]);

  // Currency formatting helpers
  const fmtRate = (usdRate: number) => {
    if (baseCurrency === 'IQD') {
      const iqd = usdRate * (exchangeRate / 100);
      return `${iqd.toLocaleString('en-US', { maximumFractionDigits: 0 })} IQD`;
    }
    return `$${usdRate.toFixed(2)}`;
  };

  const currencyLabel = baseCurrency === 'IQD' ? 'IQD' : '$ USD';
  const currencySymbol = baseCurrency === 'IQD' ? '' : '$';

  // Aggregate metrics
  const metrics = useMemo(() => {
    if (rates.length === 0) {
      return { totalTiers: 0, maxRate: 0, minRate: 0, avgRate: 0 };
    }
    const rateValues = rates.map((r) => Number(r.hourly_rate));
    const maxRate = Math.max(...rateValues);
    const minRate = Math.min(...rateValues);
    const sum = rateValues.reduce((a, b) => a + b, 0);
    const avgRate = sum / rates.length;

    return {
      totalTiers: rates.length,
      maxRate,
      minRate,
      avgRate,
    };
  }, [rates]);

  // Check users currently using the title marked for deletion
  const usersWithTitleToDelete = useMemo(() => {
    if (!rateToDelete) return [];
    return allUsers.filter(
      (u) => u.academic_title?.toLowerCase().trim() === rateToDelete.title.toLowerCase().trim()
    );
  }, [rateToDelete, allUsers]);

  // Handle Edit Rate
  const handleSaveEdit = async (id: string, newHourlyRate: number, isActive?: boolean) => {
    const res = await updateAcademicRate(id, newHourlyRate, isActive);
    if (res.success) {
      setRates((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                hourly_rate: newHourlyRate,
                ...(typeof isActive === 'boolean' ? { is_active: isActive } : {}),
              }
            : r
        )
      );
      const target = rates.find((r) => r.id === id);
      showToast(
        'Academic Rate Updated',
        `Updated ${target?.title || 'Title'} rate and policy settings. Changes are live.`
      );
    }
  };

  // Handle Toggle Policy Status (Activate / Deactivate)
  const handleTogglePolicyStatus = async (rate: AcademicRate, newStatus: boolean) => {
    const res = await toggleAcademicRateStatus(rate.id, newStatus);
    if (res.success) {
      setRates((prev) =>
        prev.map((r) => (r.id === rate.id ? { ...r, is_active: newStatus } : r))
      );
      showToast(
        newStatus ? 'Policy Activated' : 'Policy Deactivated',
        newStatus
          ? `${rate.title} is now active and available to assign to teachers.`
          : `${rate.title} policy is now deactivated and hidden from teacher assignment forms.`
      );
    } else {
      showToast('Error', res.error || 'Failed to update policy status.');
    }
    setRateToDelete(null);
  };

  // Handle Delete / Deactivate Rate
  const handleDeleteRate = async () => {
    if (!rateToDelete) return;
    setIsDeleting(true);
    try {
      if (usersWithTitleToDelete.length > 0) {
        // If users have used it, make status deactivate instead of destroying data
        await handleTogglePolicyStatus(rateToDelete, false);
      } else {
        const res = await deleteAcademicRate(rateToDelete.id);
        if (res.success) {
          setRates((prev) => prev.filter((r) => r.id !== rateToDelete.id));
          showToast(
            'Academic Rate Deleted',
            `Successfully removed ${rateToDelete.title} from university pay schedule.`
          );
        } else {
          showToast('Error', res.error || 'Failed to delete academic rate.');
        }
        setRateToDelete(null);
      }
    } catch (err) {
      console.error(err);
      showToast('Error', 'Failed to delete academic rate.');
      setRateToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Add New Rate Tier
  const handleAddTier = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = parseFloat(newRate);
    if (!newTitle.trim() || isNaN(rateNum) || rateNum <= 0) return;

    setIsAdding(true);
    try {
      const multiplier = exchangeRate / 100;
      const usdRate = baseCurrency === 'IQD' ? rateNum / multiplier : rateNum;
      const res = await createAcademicRate(newTitle.trim(), usdRate);
      if (res.success && res.rate) {
        setRates((prev) => [res.rate!, ...prev]);
        showToast(
          'New Rate Tier Added',
          `Successfully registered ${newTitle} at ${fmtRate(usdRate)}/hr.`
        );
        setIsAddModalOpen(false);
        setNewTitle('');
        setNewRate('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  // STRICT ACCESS BARRIER: ONLY SUPER_ADMIN OR PERMITTED USERS CAN ACCESS
  // --------------------------------------------------------------------------
  const isAuthorized =
    activeRole === 'SUPER_ADMIN' ||
    session.isSuperAdmin ||
    session.hasPermission?.('can_manage_rates') ||
    session.user?.custom_permissions?.['can_manage_rates'] === true;

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex flex-col justify-between">
        <Sidebar activeRole={activeRole} />

        <div className="pl-72 flex-1 flex flex-col">
          <Header
            breadcrumbCategory="TIU Central Administration"
            breadcrumbPage="Access Denied"
            activeViewLabel={activeRole}
          />

          <main className="flex-1 flex items-center justify-center p-8 pt-24">
            <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-red-200 p-8 sm:p-10 text-center relative overflow-hidden">
              <div className="w-16 h-16 rounded-2xl bg-red-50 text-[#ba1a1a] flex items-center justify-center mx-auto mb-5 border border-red-200 shadow-sm">
                <ShieldAlert className="w-8 h-8" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-800 text-xs font-bold uppercase tracking-wider mb-3 border border-red-200">
                <Lock className="w-3.5 h-3.5 text-[#ba1a1a]" />
                403 Forbidden • Super Admin or Permission Required
              </div>

              <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-[#0b1c30] tracking-tight mb-3">
                Rate Configuration Access Restricted
              </h1>

              <p className="text-sm text-slate-600 leading-relaxed mb-6 max-w-lg mx-auto">
                You are currently signed in with the <strong className="text-slate-900 font-semibold">{activeRole}</strong> role.
                The academic pay scale configuration at <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono text-xs">/admin/rates</code> is
                strictly restricted to <strong className="text-[#540225] font-semibold">Super Administrators</strong> and authorized rate administrators.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 border-t border-slate-100">
                <Link
                  href={
                    activeRole === 'TEACHER'
                      ? '/teacher'
                      : activeRole === 'HOD'
                      ? '/hod'
                      : activeRole === 'ACCOUNTANT'
                      ? '/finance'
                      : activeRole === 'COORDINATOR'
                      ? '/coordinator'
                      : '/admin/roles'
                  }
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-400" />
                  <span>Return to Authorized Portal</span>
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // AUTHORIZED VIEW (SUPER_ADMIN OR AUTHORIZED PERSONNEL)
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <Sidebar activeItem="rates" activeRole={activeRole} />

      <div className="pl-72">
        <Header
          breadcrumbCategory="TIU Central Administration"
          breadcrumbPage="Rates & Compensation"
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search academic titles, professorships..."
          activeViewLabel={activeRole === 'SUPER_ADMIN' ? 'Super Admin' : (session.user?.name || activeRole)}
        />

        <main className="w-full pt-20 pb-16 px-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header Block with Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <h1 className="font-headline text-2xl sm:text-3xl font-bold text-[#0b1c30] tracking-tight">
                Academic Titles &amp; Hourly Rates
              </h1>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold transition-all shadow-md hover:shadow-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Academic Title</span>
                </button>
              </div>
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Titles */}
              <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                    Configured Ranks
                  </span>
                  <div className="font-headline text-2xl font-bold text-[#0b1c30] mt-1">
                    {metrics.totalTiers} Tiers
                  </div>
                  <span className="text-[11px] text-slate-500">Active university pay scale</span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-rose-50 text-[#721c3b] flex items-center justify-center font-bold">
                  <Award className="w-6 h-6" />
                </div>
              </div>

              {/* Card 2: Highest Tier */}
              <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                    Highest Tier Rate
                  </span>
                  <div className="font-headline text-2xl font-bold text-emerald-700 mt-1">
                    {fmtRate(metrics.maxRate)}/hr
                  </div>
                  <span className="text-[11px] text-slate-500">Full Professorship ceiling</span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>

              {/* Card 3: Average Rate */}
              <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                    Average Hourly Rate
                  </span>
                  <div className="font-headline text-2xl font-bold text-indigo-700 mt-1">
                    {fmtRate(metrics.avgRate)}/hr
                  </div>
                  <span className="text-[11px] text-slate-500">Mean across all ranks</span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  {baseCurrency === 'IQD' ? <Coins className="w-6 h-6" /> : <DollarSign className="w-6 h-6" />}
                </div>
              </div>

              {/* Card 4: Entry Baseline */}
              <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                    Base Entry Rate
                  </span>
                  <div className="font-headline text-2xl font-bold text-amber-700 mt-1">
                    {fmtRate(metrics.minRate)}/hr
                  </div>
                  <span className="text-[11px] text-slate-500">Teaching Assistant / Lab Lead</span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Clock className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Rates Table Section */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
              {/* Table Top Header */}
              <div className="p-5 px-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#721c3b] flex items-center justify-center font-bold">
                    {baseCurrency === 'IQD' ? <Coins className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-base text-[#0b1c30]">
                      Academic Rates Directory
                    </h3>
                    <p className="text-xs text-slate-500">
                      Master pay schedule stored in Supabase <code className="font-mono text-[11px] bg-slate-100 px-1 rounded">academic_rates</code> table
                    </p>
                  </div>
                </div>

                {/* Search in table */}
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search titles..."
                    className="w-full h-10 pl-9 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Table content */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#eff4ff]/60 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                      <th className="py-3.5 px-6">Academic Title / Rank</th>
                      <th className="py-3.5 px-4 text-center">Hourly Rate ({currencyLabel})</th>
                      <th className="py-3.5 px-4 text-center">Sample 4h Lab Payout</th>
                      <th className="py-3.5 px-4">Jurisdiction &amp; Scope</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredRates.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          No academic titles matched your search query.
                        </td>
                      </tr>
                    ) : (
                      filteredRates.map((rate) => {
                        const samplePayoutUSD = rate.hourly_rate * 4;
                        return (
                          <tr key={rate.id} className="hover:bg-[#f8f9ff] transition-colors group">
                            {/* Academic Title */}
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#eff4ff] text-[#0b1c30] flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-[#ffdea8] group-hover:text-[#271900] transition-colors">
                                  <Award className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-sm text-[#0b1c30] group-hover:text-[#721c3b] transition-colors">
                                    {rate.title}
                                  </span>
                                  <span className="text-[11px] text-slate-400 font-mono">
                                    ID: {rate.id}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Hourly Rate */}
                            <td className="py-4 px-4 text-center">
                              <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-headline font-bold text-sm">
                                <span>{fmtRate(rate.hourly_rate)}</span>
                                <span className="text-[10px] text-emerald-600 font-normal">/hr</span>
                              </div>
                            </td>

                            {/* Sample 4h Lab Payout */}
                            <td className="py-4 px-4 text-center font-mono font-semibold text-slate-700">
                              {fmtRate(samplePayoutUSD)}
                            </td>

                            {/* Jurisdiction */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                                <Building className="w-3.5 h-3.5 text-slate-400" />
                                <span>All Engineering &amp; Science Faculties</span>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-4 px-4">
                              {rate.is_active !== false ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-100">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Active Policy
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold border border-slate-200">
                                  <PowerOff className="w-3.5 h-3.5 text-slate-400" />
                                  Deactivated
                                </span>
                              )}
                            </td>

                            {/* Actions: Three-dot dropdown menu */}
                            <td className="py-4 px-6 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer outline-none">
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingRate(rate);
                                    }}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Edit2 className="w-4 h-4" /> Edit Rate
                                  </DropdownMenuItem>

                                  {rate.is_active !== false ? (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTogglePolicyStatus(rate, false);
                                      }}
                                      className="gap-2 text-amber-700 focus:text-amber-700 focus:bg-amber-50 cursor-pointer"
                                    >
                                      <PowerOff className="w-4 h-4" /> Deactivate Policy
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTogglePolicyStatus(rate, true);
                                      }}
                                      className="gap-2 text-emerald-700 focus:text-emerald-700 focus:bg-emerald-50 cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Activate Policy
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRateToDelete(rate);
                                    }}
                                    className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" /> Delete Title
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Edit Rate Modal */}
      <EditRateModal
        rate={editingRate}
        isOpen={!!editingRate}
        onClose={() => setEditingRate(null)}
        onSave={handleSaveEdit}
        baseCurrency={baseCurrency}
        exchangeRate={exchangeRate}
      />

      {/* Delete / Deactivate Confirmation Modal */}
      {rateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 overflow-hidden text-left flex flex-col p-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 border ${
                  usersWithTitleToDelete.length > 0
                    ? 'bg-amber-50 border-amber-100 text-amber-600'
                    : 'bg-red-50 border-red-100 text-red-500'
                }`}
              >
                {usersWithTitleToDelete.length > 0 ? (
                  <ShieldAlert className="w-8 h-8" />
                ) : (
                  <AlertCircle className="w-8 h-8" />
                )}
              </div>
              <h2 className="font-headline text-xl font-bold text-slate-900">
                {usersWithTitleToDelete.length > 0
                  ? 'Title Currently in Use'
                  : 'Delete Academic Title?'}
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                {usersWithTitleToDelete.length > 0 ? (
                  <>
                    <strong>{rateToDelete.title}</strong> is currently assigned to{' '}
                    <strong className="text-slate-800">
                      {usersWithTitleToDelete.length} faculty member{usersWithTitleToDelete.length > 1 ? 's' : ''}
                    </strong>
                    . To protect teacher contracts and historical payroll records, this policy will be set to{' '}
                    <strong className="text-amber-800">Deactivated</strong> instead of deleted. It will no longer appear when assigning titles to teachers.
                  </>
                ) : (
                  <>
                    Are you sure you want to permanently delete{' '}
                    <strong>{rateToDelete.title}</strong> ({fmtRate(rateToDelete.hourly_rate)}/hr)? This action cannot be undone.
                  </>
                )}
              </p>
            </div>
            <div className="flex gap-3 mt-8 w-full">
              <button
                type="button"
                onClick={() => setRateToDelete(null)}
                disabled={isDeleting}
                className="flex-1 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRate}
                disabled={isDeleting}
                className={`flex-1 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                  usersWithTitleToDelete.length > 0
                    ? 'bg-[#721c3b] hover:bg-[#540225]'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isDeleting ? (
                  'Processing...'
                ) : usersWithTitleToDelete.length > 0 ? (
                  <>
                    <PowerOff className="w-4 h-4" /> Deactivate
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Rate Tier Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden text-left flex flex-col">
            <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between">
              <div>
                <h3 className="font-headline font-bold text-xl text-[#0b1c30]">
                  Add Academic Title &amp; Rate
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register a new faculty rank in the university compensation schedule.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTier} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Academic Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Distinguished Professor"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Hourly Rate ({baseCurrency === 'IQD' ? 'IQD' : '$ USD'} / hr) *
                </label>
                <div className="relative">
                  {baseCurrency === 'IQD' ? (
                    <span className="text-xs font-bold text-slate-500 absolute left-3.5 top-3.5 pointer-events-none">
                      IQD
                    </span>
                  ) : (
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                  )}
                  <input
                    type="number"
                    step={baseCurrency === 'IQD' ? '500' : '0.5'}
                    min={baseCurrency === 'IQD' ? '1000' : '5'}
                    max={baseCurrency === 'IQD' ? 500 * (exchangeRate / 100) : 500}
                    required
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    placeholder={baseCurrency === 'IQD' ? '75000' : '50.00'}
                    className={`w-full h-11 ${baseCurrency === 'IQD' ? 'pl-13' : 'pl-9'} pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white font-mono`}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-6 py-2.5 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-70"
                >
                  {isAdding ? 'Adding...' : 'Create Title & Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 border border-slate-800 animate-in slide-from-bottom-5 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <h5 className="font-bold text-white">{toastMessage.title}</h5>
            <p className="text-slate-300 mt-0.5 leading-relaxed">{toastMessage.desc}</p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
