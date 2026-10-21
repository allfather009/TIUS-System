'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  GraduationCap,
  ShieldCheck,
  ShieldAlert,
  Landmark,
  LayoutGrid,
  BarChart3,
  SlidersHorizontal,
  LogOut,
  Users,
  Archive,
  Download,
  CalendarCog,
  FileText,
  Coins,
  FileSpreadsheet,
  FileCheck2,
} from 'lucide-react';

import { useSession } from '@/lib/context/SessionContext';
import { checkCanViewCurrency, checkCanManageCycles, getSystemSettings, updateSystemSettings } from '@/lib/services/systemSettingsService';
import { getPayrollSettings, updatePayrollSettings } from '@/lib/services/payrollSettingsService';
import { CurrencySettingsModal } from '@/components/payroll/CurrencySettingsModal';
import { CycleSettingsModal } from '@/components/payroll/CycleSettingsModal';
import { PayrollReportModal } from '@/components/payroll/PayrollReportModal';
import { getPayrollDisbursalSummary, exportPayrollToCSV } from '@/lib/services/payrollService';
import { PayrollSettings } from '@/types/database';
import { PayrollDisbursalSummary } from '@/types/payroll';
import { createClient } from '@/lib/supabase/client';

interface SidebarProps {
  activeItem?: 'teacher' | 'hod' | 'hod-requests' | 'coordinator' | 'superadmin' | 'roles' | 'payroll' | 'payment-archive' | 'departments' | 'reports' | 'settings' | 'rates' | 'structure' | 'audit-logs' | 'import' | '';
  activeRole?: string;
  pendingRequestsCount?: number;
  onExportCSV?: () => void;
  onOpenCycleSettings?: () => void;
  onGenerateReport?: () => void;
  onOpenCurrencySettings?: () => void;
  onDownloadSlip?: () => void;
}

export function Sidebar({
  activeItem,
  activeRole,
  pendingRequestsCount,
  onExportCSV,
  onOpenCycleSettings,
  onGenerateReport,
  onOpenCurrencySettings,
  onDownloadSlip,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();

  const currentRole =
    session.user?.role ||
    session.role ||
    activeRole ||
    (typeof window !== 'undefined' ? localStorage.getItem('tius_session_role') : null);

  const isSuperAdminUser =
    !session.isSimulating &&
    !session.user?.isSimulation &&
    (currentRole === 'SUPER_ADMIN' || session.isSuperAdmin);

  // Strictly mutually-exclusive active key calculation based on pathname:
  // Guarantees ONLY ONE link in the entire sidebar is highlighted in burgundy at a time.
  const getSingleActiveKey = () => {
    if (pathname.startsWith('/admin/roles')) return 'superadmin';
    if (pathname.startsWith('/admin/rates')) return 'rates';
    if (pathname.startsWith('/admin/structure')) return 'structure';
    if (pathname.startsWith('/coordinator')) return 'coordinator';
    if (pathname.startsWith('/hod/requests')) return 'hod-requests';
    if (pathname.startsWith('/hod')) return 'hod';
    if (pathname.startsWith('/teacher')) return 'teacher';
    if (pathname.startsWith('/finance/archive') || pathname.startsWith('/payroll/archive')) return 'payment-archive';
    if (pathname.startsWith('/payroll') || pathname.startsWith('/finance')) return 'payroll';
    if (pathname.startsWith('/admin/departments')) return 'departments';
    if (pathname.startsWith('/admin/reports')) return 'reports';
    if (pathname.startsWith('/admin/settings')) return 'settings';
    if (pathname.startsWith('/admin/audit')) return 'audit-logs';
    if (pathname.startsWith('/admin/import')) return 'import';
    return activeItem || '';
  };
  const singleActiveKey = getSingleActiveKey();

  const user = session.user;
  const isSuperAdmin =
    !session.isSimulating &&
    !user?.isSimulation &&
    (currentRole === 'SUPER_ADMIN' ||
      session.isSuperAdmin ||
      user?.role === 'SUPER_ADMIN');

  const userPerms = (user?.custom_permissions || {}) as Record<string, boolean>;

  // Dynamic permission checks using central effective permission resolution
  const canManageRoles = (currentRole === 'IT_ADMIN') || (session.hasPermission?.('can_manage_roles') ?? false);
  const canManageRates = session.hasPermission?.('can_manage_rates') ?? false;
  const canExportPayroll = session.hasPermission?.('can_export_payroll') ?? false;
  const canAuditLogs = session.hasPermission?.('can_audit_logs') ?? false;
  const canManageStructure = session.hasPermission?.('can_manage_structure') ?? false;
  const canManageSettings = session.hasPermission?.('can_manage_settings') ?? false;
  const canBatchImport = session.hasPermission?.('can_batch_import') ?? false;
  const canViewCurrency = session.hasPermission?.('can_view_currency_settings') ?? false;
  const canManageCycles = session.hasPermission?.('can_lock_cycles') ?? false;
  const canViewFinance = session.hasPermission?.('can_view_finance') ?? false;
  const canViewPaymentArchive = session.hasPermission?.('can_view_payment_archive') ?? false;
  const canExportCSV = session.hasPermission?.('can_export_csv') ?? false;
  const canGenerateReport = session.hasPermission?.('can_generate_payroll_report') ?? false;

  // Native modal management inside Sidebar so operational modals never redirect away from current user dashboard
  const [internalCurrencyOpen, setInternalCurrencyOpen] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(150000);

  const [internalCycleOpen, setInternalCycleOpen] = useState(false);
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings | null>(null);

  const [internalReportOpen, setInternalReportOpen] = useState(false);
  const [reportSummary, setReportSummary] = useState<PayrollDisbursalSummary | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadSettings() {
      try {
        const [sys, pay] = await Promise.all([
          getSystemSettings(),
          getPayrollSettings(),
        ]);
        if (mounted) {
          if (sys?.exchange_rate) setExchangeRate(sys.exchange_rate);
          if (pay) setPayrollSettings(pay);
        }
      } catch {}
    }
    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const handleCurrencyClick = async () => {
    if (onOpenCurrencySettings) {
      onOpenCurrencySettings();
      return;
    }
    try {
      const sys = await getSystemSettings();
      if (sys?.exchange_rate) setExchangeRate(sys.exchange_rate);
    } catch {}
    setInternalCurrencyOpen(true);
  };

  const handleCycleClick = async () => {
    if (onOpenCycleSettings) {
      onOpenCycleSettings();
      return;
    }
    try {
      const pay = await getPayrollSettings();
      if (pay) setPayrollSettings(pay);
    } catch {}
    setInternalCycleOpen(true);
  };

  const handleExportCSVClick = async () => {
    if (onExportCSV) {
      onExportCSV();
      return;
    }
    try {
      const sum = await getPayrollDisbursalSummary({ status: 'APPROVED' });
      exportPayrollToCSV(sum.departments);
    } catch (err) {
      console.error('Failed to export CSV from sidebar:', err);
    }
  };

  const handleReportClick = async () => {
    if (onGenerateReport) {
      onGenerateReport();
      return;
    }
    try {
      const sum = await getPayrollDisbursalSummary({ status: 'APPROVED' });
      setReportSummary(sum);
      setInternalReportOpen(true);
    } catch (err) {
      console.error('Failed to load report summary:', err);
    }
  };

  const handleSaveCurrency = async (newRate: number) => {
    setExchangeRate(newRate);
    try {
      await updateSystemSettings({ exchange_rate: newRate });
    } catch (err) {
      console.error('Failed to update exchange rate:', err);
    }
  };

  const handleSaveCycle = async (updated: Partial<PayrollSettings>) => {
    try {
      const res = await updatePayrollSettings(updated);
      if (res.data) {
        setPayrollSettings(res.data);
      }
    } catch (err) {
      console.error('Failed to update cycle settings:', err);
    }
  };

  // Role-isolated main portals list
  let mainPortals: Array<{
    key: string;
    label: string;
    href?: string;
    onClick?: () => void;
    icon: React.ComponentType<{ className?: string }>;
    active: boolean;
    badge?: string;
  }> = [];

  if (currentRole === 'ACCOUNTANT') {
    mainPortals = [];
  } else if (currentRole === 'TEACHER' || currentRole === 'DEAN' || currentRole === 'VICE_DEAN') {
    mainPortals = [
      {
        key: 'teacher',
        label: currentRole === 'DEAN' ? 'Dean Portal' : currentRole === 'VICE_DEAN' ? 'Vice Dean Portal' : 'Teacher Portal',
        href: '/teacher',
        icon: GraduationCap,
        active: singleActiveKey === 'teacher',
      },
    ];
  } else if (currentRole === 'IT_ADMIN') {
    mainPortals = [
      {
        key: 'roles',
        label: 'IT Admin',
        href: '/admin/roles',
        icon: Users,
        active: singleActiveKey === 'superadmin' || singleActiveKey === 'roles',
        badge: 'IT',
      },
    ];
  } else if (currentRole === 'HOD') {
    mainPortals = [
      {
        key: 'hod',
        label: 'Department (HoD)',
        href: '/hod',
        icon: Users,
        active: singleActiveKey === 'hod',
      },
      {
        key: 'hod-requests',
        label: 'Submissions Outbox',
        href: '/hod/requests',
        icon: FileCheck2,
        active: singleActiveKey === 'hod-requests',
      },
      ...(canManageStructure
        ? [
            {
              key: 'structure',
              label: 'Academic Structure',
              href: '/admin/structure',
              icon: LayoutGrid,
              active: singleActiveKey === 'structure',
            },
          ]
        : []),
    ];
  } else if (currentRole === 'COORDINATOR') {
    mainPortals = [
      {
        key: 'coordinator',
        label: 'Academic Coordinator',
        href: '/coordinator',
        icon: Users,
        active: singleActiveKey === 'coordinator',
      },
    ];
  } else if (isSuperAdminUser) {
    mainPortals = [
      {
        key: 'superadmin',
        label: 'Super Admin Portal',
        href: '/admin/roles',
        icon: ShieldAlert,
        active: singleActiveKey === 'superadmin',
        badge: 'ROOT',
      }
    ];
  } else {
    // Unrestricted or developer preview fallback
    mainPortals = [
      {
        key: 'coordinator',
        label: 'Academic Coordinator',
        href: '/coordinator',
        icon: Users,
        active: singleActiveKey === 'coordinator',
      },
      {
        key: 'hod',
        label: 'Department (HoD)',
        href: '/hod',
        icon: Users,
        active: singleActiveKey === 'hod',
      },
      {
        key: 'hod-requests',
        label: 'Submissions Outbox',
        href: '/hod/requests',
        icon: FileCheck2,
        active: singleActiveKey === 'hod-requests',
      },
      {
        key: 'teacher',
        label: 'Teacher Portal',
        href: '/teacher',
        icon: GraduationCap,
        active: singleActiveKey === 'teacher',
      },
    ];
  }

  // Add individual finance portals to MAIN PORTALS if permitted
  if (canViewFinance && !mainPortals.some((p) => p.key === 'payroll')) {
    mainPortals.push({
      key: 'payroll',
      label: 'Payroll & Finance',
      href: '/finance',
      icon: Landmark,
      active: singleActiveKey === 'payroll',
    });
  }

  if (canViewPaymentArchive && !mainPortals.some((p) => p.key === 'payment-archive')) {
    mainPortals.push({
      key: 'payment-archive',
      label: 'Payment Archive',
      href: '/finance/archive',
      icon: Archive,
      active: singleActiveKey === 'payment-archive',
    });
  }

  if (canExportCSV && !mainPortals.some((p) => p.key === 'export-csv')) {
    mainPortals.push({
      key: 'export-csv',
      label: 'Export to CSV',
      icon: Download,
      onClick: handleExportCSVClick,
      active: false,
    });
  }

  if (canManageCycles && !mainPortals.some((p) => p.key === 'cycle-settings')) {
    mainPortals.push({
      key: 'cycle-settings',
      label: 'Cycle Settings',
      icon: CalendarCog,
      onClick: handleCycleClick,
      active: false,
    });
  }

  if (canGenerateReport && !mainPortals.some((p) => p.key === 'generate-report')) {
    mainPortals.push({
      key: 'generate-report',
      label: 'Generate Payroll Report',
      icon: FileText,
      onClick: handleReportClick,
      active: false,
    });
  }

  if (canViewCurrency && !mainPortals.some((p) => p.key === 'currency-settings')) {
    mainPortals.push({
      key: 'currency-settings',
      label: 'Currency Settings',
      icon: Coins,
      onClick: handleCurrencyClick,
      active: false,
    });
  }

  const managementSystem = [
    ...(canManageRoles && currentRole !== 'SUPER_ADMIN' && currentRole !== 'IT_ADMIN'
      ? [
          {
            key: 'roles',
            label: 'Manage User Roles',
            href: '/admin/roles',
            icon: Users,
            active: singleActiveKey === 'superadmin' || singleActiveKey === 'roles',
          },
        ]
      : []),
    ...(canManageRates
      ? [
          {
            key: 'rates',
            label: 'Academic Rates',
            href: '/admin/rates',
            icon: SlidersHorizontal,
            active: singleActiveKey === 'rates',
          },
        ]
      : []),
    ...(canExportPayroll
      ? [
          {
            key: 'reports',
            label: 'Reports & Analytics',
            href: '/admin/reports',
            icon: BarChart3,
            active: singleActiveKey === 'reports',
          },
        ]
      : []),
    ...(canAuditLogs
      ? [
          {
            key: 'audit-logs',
            label: 'Audit Logs',
            href: '/admin/audit',
            icon: ShieldAlert,
            active: singleActiveKey === 'audit-logs',
          },
        ]
      : []),
    ...(canManageStructure && currentRole !== 'HOD'
      ? [
          {
            key: 'structure',
            label: 'Academic Structure',
            href: '/admin/structure',
            icon: LayoutGrid,
            active: singleActiveKey === 'structure',
          },
        ]
      : []),
    ...(canManageSettings
      ? [
          {
            key: 'settings',
            label: 'System Settings',
            href: '/admin/settings',
            icon: SlidersHorizontal,
            active: singleActiveKey === 'settings',
          },
        ]
      : []),
    ...(canBatchImport
      ? [
          {
            key: 'import',
            label: 'Batch Import',
            href: '/admin/import',
            icon: FileSpreadsheet,
            active: singleActiveKey === 'import',
          },
        ]
      : []),
  ];

  // The section header renders if SUPER_ADMIN OR at least one management module is permitted
  const showManagementSection =
    (isSuperAdmin || canManageRoles || canManageRates || canExportPayroll || canAuditLogs || canManageStructure || canManageSettings || canBatchImport) &&
    managementSystem.length > 0;

  return (
    <aside className={`fixed left-0 ${(session.isSimulating || session.user?.isSimulation) ? 'top-10 h-[calc(100vh-40px)]' : 'top-0 h-screen'} w-72 bg-white z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-slate-100 transition-all`}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Institutional Brand Header */}
        <div className="px-6 pt-6 pb-4 flex items-center gap-3 border-b border-slate-50">
          <img
            alt="TIU Logo"
            className="h-9 w-auto object-contain rounded-lg"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDoDDRqJXEliwiAbQj3HE8fZbuJHyNLm4oXuQQ5QO7nQeR8qOdesMMJqIyGvqtkCY9Rjzbsq1raOKhc9i3B1hmX-CKY9ZP_pb0ev_safjontFAUkVZbtIPdFcN0LFfGLhBh695WC0f-958s-4dkfKqnb-dqpdihEqMy9cF7CHQFDpWItxiA4tI327j1Yut7rDKyJsZsz6UFPox71r5RXf4cWZ-uwLT2qmPnLstL1KjH8AKbnjNDjRdJpgmI0MtJb09N4w"
          />
          <div className="flex flex-col">
            <span className="font-headline font-bold text-lg text-[#540225] tracking-tight leading-none">
              TIU Portal
            </span>
            <span className="text-[11px] text-slate-500 font-medium mt-1">
              Hours &amp; Payroll System
            </span>
          </div>
        </div>

        {/* Navigation Categories */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Section 1: MAIN PORTALS */}
          <div className="space-y-1">
            <p className="px-3 py-1 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              MAIN PORTALS
            </p>
            <nav className="space-y-1">
              {mainPortals.map((item) => {
                const Icon = item.icon;
                const content = (
                  <>
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        item.active ? 'text-white' : 'text-slate-400'
                      }`}
                    />
                    <div className="flex items-center justify-between flex-1 min-w-0">
                      <span className="truncate">{item.label}</span>
                      {'badge' in item && item.badge && (
                        <span
                          className={`flex items-center justify-center font-bold tracking-tight shadow-2xs transition-all ${
                            item.badge === 'ROOT'
                              ? 'text-[9px] px-1.5 py-0.5 rounded uppercase ' +
                                (item.active
                                  ? 'bg-white/20 text-white'
                                  : 'bg-red-50 text-[#ba1a1a] border border-red-200')
                              : 'min-w-5 h-5 px-1.5 rounded-full text-[10px] ' +
                                (item.active
                                  ? 'bg-white text-[#540225]'
                                  : 'bg-[#ba1a1a] text-white')
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </>
                );

                const itemClass = `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-xs sm:text-sm text-left ${
                  item.active
                    ? 'bg-[#540225] text-white font-semibold shadow-sm'
                    : 'text-slate-600 hover:bg-[#eff4ff] hover:text-[#0b1c30]'
                }`;

                return (
                  <div key={item.key} className="space-y-1">
                    {item.href ? (
                      <Link href={item.href} className={itemClass}>
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={item.onClick}
                        className={itemClass + ' cursor-pointer'}
                      >
                        {content}
                      </button>
                    )}

                    {/* Sub-navigation items rendered under active Teacher link */}
                    {item.key === 'teacher' && item.active && onDownloadSlip && (
                      <div className="ml-3 pl-3 border-l-2 border-[#540225]/20 space-y-1 mt-1.5 mb-2">
                        <button
                          type="button"
                          onClick={onDownloadSlip}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-[#540225] hover:bg-[#eff4ff] transition-all cursor-pointer text-left"
                        >
                          <Download className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                          <span className="truncate">Download Monthly Slip</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Section 2: MANAGEMENT & SYSTEM (Super Admin & Permitted Staff) */}
          {showManagementSection && (
            <div className="space-y-1">
              <p className="px-3 py-1 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                MANAGEMENT &amp; SYSTEM
              </p>
              <nav className="space-y-1">
                {managementSystem.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-xs sm:text-sm ${
                        item.active
                          ? 'bg-[#540225] text-white font-semibold shadow-sm'
                          : 'text-slate-600 hover:bg-[#eff4ff] hover:text-[#0b1c30]'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${item.active ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}

        </div>

        {/* Footer Navigation */}
        <div className="p-4 bg-[#eff4ff]/60 border-t border-slate-100">
          <div className="space-y-1.5">
            <a
              href="/auth/signout"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#ba1a1a] hover:bg-red-50 hover:text-red-700 transition-all text-xs font-medium"
            >
              <LogOut className="w-4 h-4 text-[#ba1a1a]" />
              <span>Sign Out</span>
            </a>
          </div>
        </div>
      </div>

      {/* Built-in native modals for global operational privileges so user never leaves current dashboard */}
      <CurrencySettingsModal
        isOpen={internalCurrencyOpen}
        onClose={() => setInternalCurrencyOpen(false)}
        exchangeRate={exchangeRate}
        onSave={handleSaveCurrency}
        financeCanEditExchange={session.hasPermission?.('can_manage_currency') ?? false}
      />

      {payrollSettings && (
        <CycleSettingsModal
          isOpen={internalCycleOpen}
          onClose={() => setInternalCycleOpen(false)}
          settings={payrollSettings}
          onSave={handleSaveCycle}
        />
      )}

      {reportSummary && (
        <PayrollReportModal
          summary={reportSummary}
          isOpen={internalReportOpen}
          onClose={() => setInternalReportOpen(false)}
          onExportCSV={() => exportPayrollToCSV(reportSummary.departments)}
          exchangeRate={exchangeRate}
        />
      )}
    </aside>
  );
}
