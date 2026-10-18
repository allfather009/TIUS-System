'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GraduationCap,
  ShieldCheck,
  ShieldAlert,
  Landmark,
  LayoutGrid,
  BarChart3,
  SlidersHorizontal,
  HelpCircle,
  Radio,
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
import { checkCanViewCurrency, checkCanManageCycles } from '@/lib/services/systemSettingsService';
import { createClient } from '@/lib/supabase/client';

interface SidebarProps {
  activeItem?: 'teacher' | 'hod' | 'hod-requests' | 'coordinator' | 'superadmin' | 'payroll' | 'departments' | 'reports' | 'settings' | 'rates' | 'structure' | 'audit-logs' | 'import' | '';
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
    if (pathname.startsWith('/payroll') || pathname.startsWith('/finance')) return 'payroll';
    if (pathname.startsWith('/admin/departments')) return 'departments';
    if (pathname.startsWith('/admin/reports')) return 'reports';
    if (pathname.startsWith('/admin/settings')) return 'settings';
    return activeItem || '';
  };
  const singleActiveKey = getSingleActiveKey();

  // Role-isolated main portals list
  let mainPortals: Array<{
    key: string;
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    active: boolean;
    badge?: string;
  }> = [];

  if (currentRole === 'ACCOUNTANT') {
    mainPortals = [
      {
        key: 'payroll',
        label: 'Payroll & Finance',
        href: '/finance',
        icon: Landmark,
        active: singleActiveKey === 'payroll',
      },
    ];
  } else if (currentRole === 'TEACHER') {
    mainPortals = [
      {
        key: 'teacher',
        label: 'Teacher Portal',
        href: '/teacher',
        icon: GraduationCap,
        active: singleActiveKey === 'teacher',
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
        label: 'Teacher Requests',
        href: '/hod/requests',
        icon: FileCheck2,
        active: singleActiveKey === 'hod-requests',
      },
      {
        key: 'structure',
        label: 'Academic Structure',
        href: '/admin/structure',
        icon: LayoutGrid,
        active: singleActiveKey === 'structure',
      },
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
        label: 'Teacher Requests',
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
      {
        key: 'payroll',
        label: 'Payroll & Finance',
        href: '/finance',
        icon: Landmark,
        active: singleActiveKey === 'payroll',
      },
    ];
  }

  // Globally apply custom permission portal overrides
  if (currentRole !== 'ACCOUNTANT' && (session.user?.custom_permissions?.can_view_finance || session.user?.custom_permissions?.can_export_payroll)) {
    // Ensure we don't duplicate if fallback already added it
    if (!mainPortals.some(p => p.key === 'payroll')) {
      mainPortals.push({
        key: 'payroll',
        label: 'Payroll & Finance',
        href: '/finance',
        icon: Landmark,
        active: singleActiveKey === 'payroll',
      });
    }
  }

  const user = session.user;
  const isSuperAdmin =
    !session.isSimulating &&
    !user?.isSimulation &&
    (currentRole === 'SUPER_ADMIN' ||
      session.isSuperAdmin ||
      user?.role === 'SUPER_ADMIN');

  const userPerms = (user?.custom_permissions || {}) as Record<string, boolean>;

  // Dynamic permission checks evaluating the JSONB custom_permissions object
  const canManageRates = isSuperAdmin || userPerms['can_manage_rates'] === true;
  const canExportPayroll = isSuperAdmin || userPerms['can_export_payroll'] === true || userPerms['can_view_reports'] === true;
  const canAuditLogs = isSuperAdmin || userPerms['can_audit_logs'] === true || userPerms['can_view_audit'] === true;
  const canManageStructure = (isSuperAdmin || userPerms['can_manage_structure'] === true) && currentRole !== 'HOD';
  const canBatchImport = isSuperAdmin || userPerms['can_batch_import'] === true || userPerms['can_import_data'] === true;
  const canManageSettings = isSuperAdmin;
  const canViewCurrency = checkCanViewCurrency(currentRole || undefined, userPerms, isSuperAdmin);
  const canManageCycles = checkCanManageCycles(currentRole || session.user?.role || undefined, userPerms, isSuperAdminUser || isSuperAdmin);

  const managementSystem = [
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

  // The section header only renders if the user is a SUPER_ADMIN OR at least one custom permission is true
  const showManagementSection =
    (isSuperAdmin || canManageRates || canExportPayroll || canAuditLogs || canManageStructure || canBatchImport) &&
    managementSystem.length > 0;

  return (
    <aside className={`fixed left-0 ${(session.isSimulating || session.user.isSimulation) ? 'top-10 h-[calc(100vh-40px)]' : 'top-0 h-screen'} w-72 bg-white z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-slate-100 transition-all`}>
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
                const isItemOnArchive =
                  item.key === 'payroll' &&
                  (pathname.startsWith('/finance/archive') || pathname.startsWith('/payroll/archive'));
                return (
                  <div key={item.key} className="space-y-1">
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-xs sm:text-sm ${
                        item.active && !isItemOnArchive
                          ? 'bg-[#540225] text-white font-semibold shadow-sm'
                          : item.active && isItemOnArchive
                          ? 'bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200/70'
                          : 'text-slate-600 hover:bg-[#eff4ff] hover:text-[#0b1c30]'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          item.active && !isItemOnArchive ? 'text-white' : item.active ? 'text-[#540225]' : 'text-slate-400'
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
                    </Link>

                    {/* Sub-navigation items rendered under active Teacher link */}
                    {item.key === 'teacher' && item.active && (onDownloadSlip || (onOpenCurrencySettings && canViewCurrency)) && (
                      <div className="ml-3 pl-3 border-l-2 border-[#540225]/20 space-y-1 mt-1.5 mb-2">
                        {/* Download Monthly Slip button */}
                        {onDownloadSlip && (
                          <button
                            type="button"
                            onClick={onDownloadSlip}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-[#540225] hover:bg-[#eff4ff] transition-all cursor-pointer text-left"
                          >
                            <Download className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                            <span className="truncate">Download Monthly Slip</span>
                          </button>
                        )}

                        {/* Currency Settings button */}
                        {onOpenCurrencySettings && canViewCurrency && (
                          <button
                            type="button"
                            onClick={onOpenCurrencySettings}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-[#540225] hover:bg-[#eff4ff] transition-all cursor-pointer text-left"
                          >
                            <Coins className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                            <span className="truncate">Currency Settings</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Sub-navigation items rendered under active Department (HoD) link */}
                    {item.key === 'hod' && item.active && onOpenCurrencySettings && canViewCurrency && (
                      <div className="ml-3 pl-3 border-l-2 border-[#540225]/20 space-y-1 mt-1.5 mb-2">
                        <button
                          type="button"
                          onClick={onOpenCurrencySettings}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-[#540225] hover:bg-[#eff4ff] transition-all cursor-pointer text-left"
                        >
                          <Coins className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                          <span className="truncate">Currency Settings</span>
                        </button>
                      </div>
                    )}

                    {/* Sub-navigation items rendered under active Teacher Requests link */}
                    {item.key === 'hod-requests' && item.active && onOpenCurrencySettings && canViewCurrency && (
                      <div className="ml-3 pl-3 border-l-2 border-[#540225]/20 space-y-1 mt-1.5 mb-2">
                        <button
                          type="button"
                          onClick={onOpenCurrencySettings}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-[#540225] hover:bg-[#eff4ff] transition-all cursor-pointer text-left"
                        >
                          <Coins className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                          <span className="truncate">Currency Settings</span>
                        </button>
                      </div>
                    )}

                    {/* Sub-navigation items rendered under active Payroll & Finance link */}
                    {item.key === 'payroll' && item.active && (
                      <div className="ml-3 pl-3 border-l-2 border-[#540225]/20 space-y-1 mt-1.5 mb-2">
                        {/* 1. Payment Archive link */}
                        <Link
                          href="/finance/archive"
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs transition-all ${
                            isItemOnArchive
                              ? 'bg-[#540225] text-white font-bold shadow-xs'
                              : 'text-slate-600 hover:text-[#540225] hover:bg-[#eff4ff] font-medium'
                          }`}
                        >
                          <Archive className={`w-3.5 h-3.5 shrink-0 ${isItemOnArchive ? 'text-white' : 'text-slate-500'}`} />
                          <span className="truncate">Payment Archive</span>
                        </Link>

                        {/* 2. Export to CSV button */}
                        <button
                          type="button"
                          onClick={onExportCSV}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-[#540225] hover:bg-[#eff4ff] transition-all cursor-pointer text-left"
                        >
                          <Download className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                          <span className="truncate">Export to CSV</span>
                        </button>

                        {/* 3. Cycle Settings button */}
                        {onOpenCycleSettings && canManageCycles && (
                          <button
                            type="button"
                            onClick={onOpenCycleSettings}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-[#540225] hover:bg-[#eff4ff] transition-all cursor-pointer text-left"
                          >
                            <CalendarCog className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                            <span className="truncate">Cycle Settings</span>
                          </button>
                        )}

                        {/* 4. Generate Payroll Report button */}
                        <button
                          type="button"
                          onClick={onGenerateReport}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-[#540225] hover:bg-[#eff4ff] transition-all cursor-pointer text-left"
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                          <span className="truncate">Generate Payroll Report</span>
                        </button>

                        {/* 5. Currency Settings button */}
                        {onOpenCurrencySettings && canViewCurrency && (
                          <button
                            type="button"
                            onClick={onOpenCurrencySettings}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-[#540225] hover:bg-[#eff4ff] transition-all cursor-pointer text-left"
                          >
                            <Coins className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                            <span className="truncate">Currency Settings</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Sub-navigation items rendered under active Coordinator link */}
                    {item.key === 'coordinator' && item.active && onOpenCurrencySettings && canViewCurrency && (
                      <div className="ml-3 pl-3 border-l-2 border-[#540225]/20 space-y-1 mt-1.5 mb-2">
                        <button
                          type="button"
                          onClick={onOpenCurrencySettings}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-[#540225] hover:bg-[#eff4ff] transition-all cursor-pointer text-left"
                        >
                          <Coins className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                          <span className="truncate">Currency Settings</span>
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

        {/* Footer Navigation & Status */}
        <div className="p-4 bg-[#eff4ff]/60 border-t border-slate-100">
          <div className="space-y-1.5">
            <a
              href="#help"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-white hover:text-[#0b1c30] transition-all text-xs font-medium"
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span>Help &amp; Documentation</span>
            </a>

            <div className="flex items-center justify-between px-3 py-2 rounded-xl text-slate-600 text-xs font-medium">
              <span className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-slate-400" />
                <span>System Status</span>
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-100 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            </div>

            <a
              href="/auth/signout"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#ba1a1a] hover:bg-red-50 hover:text-red-700 transition-all text-xs font-medium mt-1"
            >
              <LogOut className="w-4 h-4 text-[#ba1a1a]" />
              <span>Sign Out</span>
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
