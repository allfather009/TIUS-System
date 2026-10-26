'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { TeacherHero } from '@/components/teacher/TeacherHero';
import { TeacherMetricCards } from '@/components/teacher/TeacherMetricCards';
import { TeacherActivityDistribution } from '@/components/teacher/TeacherActivityDistribution';
import { TeacherLogsTable } from '@/components/teacher/TeacherLogsTable';
import { MonthlySlipModal } from '@/components/teacher/MonthlySlipModal';
import { CurrencySettingsModal } from '@/components/payroll/CurrencySettingsModal';
import { CycleSettingsModal } from '@/components/payroll/CycleSettingsModal';
import { getTeacherPortalData } from '@/lib/services/userService';
import {
  getSystemSettings,
  updateSystemSettings,
  checkCanViewCurrency,
  checkCanEditCurrency,
} from '@/lib/services/systemSettingsService';
import { TeacherPortalData, EMPTY_TEACHER_PORTAL_DATA, SystemSettings, PayrollSettings } from '@/types/database';
import { getPayrollSettings, updatePayrollSettings } from '@/lib/services/payrollSettingsService';
import { CheckCircle2, Info } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/context/SessionContext';

export default function TeacherPortalPage() {
  const router = useRouter();
  const session = useSession();
  const [data, setData] = useState<TeacherPortalData>(EMPTY_TEACHER_PORTAL_DATA);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings | null>(null);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);

  const showToast = (title: string, desc: string) => {
    setToastMessage({ title, desc });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Critical architectural rule: Super Admin must NOT be viewing teacher read-only timesheet (unless simulating)
  useEffect(() => {
    if (!session.isSimulating && !session.user?.isSimulation && (session.isSuperAdmin || session.role === 'SUPER_ADMIN')) {
      router.replace('/admin/roles');
    }
  }, [session.isSuperAdmin, session.role, session.isSimulating, session.user?.isSimulation, router]);

  const loadData = useCallback(async () => {
    try {
      let activeIdentifier = session.user?.id || session.user?.email || '';
      if (!activeIdentifier && typeof window !== 'undefined') {
        const simMatch = document.cookie.match(/tius_simulated_user=([^;]+)/);
        if (simMatch) {
          try {
            const decoded = simMatch[1].includes('%') ? decodeURIComponent(simMatch[1]) : simMatch[1];
            const parsed = JSON.parse(decoded);
            if (parsed?.id) activeIdentifier = parsed.id;
            else if (parsed?.email) activeIdentifier = parsed.email;
          } catch {}
        }
        if (!activeIdentifier) {
          const storedEmail = localStorage.getItem('tius_session_email');
          if (storedEmail) {
            activeIdentifier = storedEmail;
          } else {
            const cookieMatch = document.cookie.match(/tius_session=([^;]+)/);
            if (cookieMatch) {
              try {
                const decoded = cookieMatch[1].includes('%') ? decodeURIComponent(cookieMatch[1]) : cookieMatch[1];
                const parsed = JSON.parse(decoded);
                if (parsed?.id) activeIdentifier = parsed.id;
                else if (parsed?.email) activeIdentifier = parsed.email;
              } catch {}
            }
          }
        }
      }
      const [portalData, sysSettings, paySettings] = await Promise.all([
        getTeacherPortalData(activeIdentifier || 'teacher@tiu.edu.iq'),
        getSystemSettings(),
        getPayrollSettings(),
      ]);
      setData(portalData);
      setSystemSettings(sysSettings);
      setPayrollSettings(paySettings);
    } catch (err) {
      console.error('Error loading teacher portal data:', err);
    }
  }, [session.user?.id, session.user?.email]);

  useEffect(() => {
    loadData();

    const supabase = createClient();
    const channel = supabase
      .channel('realtime-teacher-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'timesheets' },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const userPerms = {
    ...(session.user?.custom_permissions || {}),
    ...(data.teacher?.custom_permissions || {}),
  } as Record<string, boolean>;
  const canViewCurrency = session.hasPermission?.('can_view_currency_settings') ?? false;
  const canEditCurrency = session.hasPermission?.('can_manage_currency') ?? false;
  const canManageCycles = session.hasPermission?.('can_lock_cycles') ?? false;

  const handleSaveCycleSettings = async (updated: Partial<PayrollSettings>) => {
    const res = await updatePayrollSettings(updated);
    if (res.data) {
      setPayrollSettings(res.data);
    }
    showToast(
      'Cycle Settings Saved',
      `Active payroll cycle updated: ${res.data?.cycle_name || 'Active Cycle'}${
        updated.is_locked ? ' • SYSTEM LOCKED' : ''
      }`
    );
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      {/* Navigation Sidebar */}
      <Sidebar
        activeItem="teacher"
        activeRole="TEACHER"
        onDownloadSlip={() => setIsSlipModalOpen(true)}
        onOpenCurrencySettings={canViewCurrency ? () => setIsCurrencyModalOpen(true) : undefined}
        onOpenCycleSettings={canManageCycles ? () => setIsCycleModalOpen(true) : undefined}
      />

      {/* Main Container Offset by Sidebar */}
      <div className="pl-72">
        {/* Top Header */}
        <Header
          breadcrumbCategory="TIU Academic Portal"
          breadcrumbPage="Extra Hours &amp; Payroll"
          activeViewLabel="Teacher"
          customPermissions={userPerms}
        />

        {/* Page Content */}
        <main className="w-full pt-20 pb-16 px-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Informational Policy Banner */}
            <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-100/90 text-xs text-indigo-950 shadow-2xs">
              <div className="w-7 h-7 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-700">
                <Info className="w-4 h-4" />
              </div>
              <p className="font-medium leading-relaxed">
                Extra hours requests are submitted on your behalf by your Head of Department and reviewed by the Academic Coordinator.
              </p>
            </div>

            {/* Welcome Hero Section (Read-Only) */}
            <TeacherHero
              teacherName={session.user?.name || data.teacher.name || 'Faculty Member'}
              departmentFaculty={data.teacher?.department?.name || 'Faculty of Computer Engineering & IT'}
              semester="Academic Year 2026–2027"
              selectedMonth={data.activeCycleName || 'Active Cycle: Sep 25 - Oct 25'}
              weeklyCap={data.teacher.max_weekly_hours != null ? Number(data.teacher.max_weekly_hours) : data.weeklyCapHours || 8.0}
            />

            {/* Top Metric Cards (3 Columns: Approved Hours, Pending Hours, Total Requests) */}
            <TeacherMetricCards data={data} />

            {/* Middle Content Section (Course Distribution) */}
            <TeacherActivityDistribution
              data={data}
              onContactHod={() => {
                window.location.href = `mailto:${data.departmentHod.email}?subject=Extra Hours Reconciliation Inquiry - ${data.teacher.name}`;
              }}
            />

            {/* Detailed Extra Hours Log (Data Table: Course, Breakdown, Dept, HoD, Date, Status) */}
            <TeacherLogsTable logs={data.logs} />
          </div>
        </main>
      </div>

      {/* Monthly Payslip Modal */}
      <MonthlySlipModal
        isOpen={isSlipModalOpen}
        onClose={() => setIsSlipModalOpen(false)}
        data={data}
      />

      {/* Currency Settings Modal */}
      {canViewCurrency && systemSettings && (
        <CurrencySettingsModal
          isOpen={isCurrencyModalOpen}
          onClose={() => setIsCurrencyModalOpen(false)}
          exchangeRate={systemSettings.exchange_rate}
          financeCanEditExchange={canEditCurrency}
          onSave={async (newRate) => {
            const ok = await updateSystemSettings({ exchange_rate: newRate });
            if (ok) {
              setSystemSettings((prev) => (prev ? { ...prev, exchange_rate: newRate } : null));
              showToast('Currency Updated', `System exchange rate updated to ${(newRate / 100).toLocaleString()} IQD / $1.`);
            }
          }}
        />
      )}

      {/* Cycle Configuration & System Lock Modal */}
      {canManageCycles && payrollSettings && (
        <CycleSettingsModal
          isOpen={isCycleModalOpen}
          onClose={() => setIsCycleModalOpen(false)}
          settings={payrollSettings}
          onSave={handleSaveCycleSettings}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 border border-slate-800 animate-in slide-in-from-bottom-5 duration-300">
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
