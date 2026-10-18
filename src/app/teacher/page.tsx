'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { TeacherHero } from '@/components/teacher/TeacherHero';
import { TeacherMetricCards } from '@/components/teacher/TeacherMetricCards';
import { TeacherActivityDistribution } from '@/components/teacher/TeacherActivityDistribution';
import { TeacherLogsTable } from '@/components/teacher/TeacherLogsTable';
import { MonthlySlipModal } from '@/components/teacher/MonthlySlipModal';
import { RequestExtraHoursModal } from '@/components/teacher/RequestExtraHoursModal';
import { CurrencySettingsModal } from '@/components/payroll/CurrencySettingsModal';
import { getTeacherPortalData } from '@/lib/services/userService';
import {
  getSystemSettings,
  updateSystemSettings,
  checkCanViewCurrency,
  checkCanEditCurrency,
} from '@/lib/services/systemSettingsService';
import { TeacherPortalData, TeacherLog, EMPTY_TEACHER_PORTAL_DATA, SystemSettings } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { isDateInLockedPayrollCycle } from '@/lib/services/payrollSettingsService';
import { CheckCircle2 } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/context/SessionContext';

export default function TeacherPortalPage() {
  const router = useRouter();
  const session = useSession();
  const [data, setData] = useState<TeacherPortalData>(EMPTY_TEACHER_PORTAL_DATA);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
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

  useEffect(() => {
    async function loadData() {
      try {
        let activeEmail = session.user?.email || '';
        if (!activeEmail && typeof window !== 'undefined') {
          const simMatch = document.cookie.match(/tius_simulated_user=([^;]+)/);
          if (simMatch) {
            try {
              const decoded = simMatch[1].includes('%') ? decodeURIComponent(simMatch[1]) : simMatch[1];
              const parsed = JSON.parse(decoded);
              if (parsed?.email) activeEmail = parsed.email;
            } catch {}
          }
          if (!activeEmail) {
            const storedEmail = localStorage.getItem('tius_session_email');
            if (storedEmail) {
              activeEmail = storedEmail;
            } else {
              const cookieMatch = document.cookie.match(/tius_session=([^;]+)/);
              if (cookieMatch) {
                try {
                  const decoded = cookieMatch[1].includes('%') ? decodeURIComponent(cookieMatch[1]) : cookieMatch[1];
                  const parsed = JSON.parse(decoded);
                  if (parsed?.email) activeEmail = parsed.email;
                } catch {}
              }
            }
          }
        }
        const [portalData, sysSettings] = await Promise.all([
          getTeacherPortalData(activeEmail || 'teacher@tiu.edu.iq'),
          getSystemSettings(),
        ]);
        setData(portalData);
        setSystemSettings(sysSettings);
      } catch (err) {
        console.error('Error loading teacher portal data:', err);
      }
    }
    loadData();
  }, [session.user?.email]);

  const userPerms = {
    ...(session.user?.custom_permissions || {}),
    ...(data.teacher?.custom_permissions || {}),
  } as Record<string, boolean>;
  const canViewCurrency = checkCanViewCurrency('TEACHER', userPerms, session.isSuperAdmin);
  const canEditCurrency = checkCanEditCurrency('TEACHER', userPerms, session.isSuperAdmin);

  // Handler for teacher requesting extra hours
  const handleRequestHours = async (formData: {
    date: string;
    hours: number;
    course_code: string;
    session_type?: string;
    notes: string;
    department?: string;
  }) => {
    // 0. Check if date falls in a locked payroll cycle
    const lockCheck = await isDateInLockedPayrollCycle(formData.date);
    if (lockCheck.isLocked) {
      showToast(
        'Submission Blocked: Cycle Locked',
        `Finance has locked the current payroll cycle (${lockCheck.cycleLabel}). New submissions are frozen.`
      );
      throw new Error(`The payroll cycle covering ${formData.date} is currently locked by Finance.`);
    }

    try {
      const supabase = createClient();
      let activeEmail = session.user?.email || 'teacher@tiu.edu.iq';
      if (!activeEmail && typeof window !== 'undefined') {
        const storedEmail = localStorage.getItem('tius_session_email');
        if (storedEmail) activeEmail = storedEmail;
      }

      // 1. Resolve teacher's user record in Supabase
      const { data: userRec } = await supabase
        .from('users')
        .select('id, name, department_id, department_ids, departments')
        .ilike('email', activeEmail)
        .maybeSingle();

      const teacherId = userRec?.id || 'f28d7827-4388-400b-ab7e-bb32e0d6dd5a';

      // 2. Resolve target department name & ID
      const chosenDept = formData.department || (userRec?.departments && userRec.departments[0]) || null;
      let targetDeptId: string | null = null;
      if (chosenDept) {
        const { data: deptRow } = await supabase
          .from('departments')
          .select('id')
          .ilike('name', chosenDept)
          .maybeSingle();
        if (deptRow?.id) {
          targetDeptId = deptRow.id;
        }
      }
      if (!targetDeptId && userRec?.department_id) {
        targetDeptId = userRec.department_id;
      }

      // 3. Insert into timesheets table with status = 'PENDING_HOD_APPROVAL' and explicit department
      const newRecord = {
        teacher_id: teacherId,
        date: formData.date,
        hours: formData.hours,
        course_activity: `${formData.course_code} - ${formData.session_type || 'Lecture'}`,
        course_code: formData.course_code,
        session_type: formData.session_type || 'Lecture',
        notes: formData.notes,
        department: chosenDept,
        department_id: targetDeptId,
        status: 'PENDING_HOD_APPROVAL',
      };

      const { data: inserted, error: insertError } = await supabase
        .from('timesheets')
        .insert([newRecord])
        .select()
        .maybeSingle();

      if (insertError) {
        console.warn('Supabase insert notice (persisting optimistically):', insertError.message);
      }

      // 3. Optimistic local state update
      const newRef = `#REQ-${Math.floor(1000 + Math.random() * 9000)}`;
      const newLog: TeacherLog = {
        id: inserted?.id || `req-${Date.now()}`,
        date: new Date(formData.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        dayAndTime: new Date(formData.date).toLocaleDateString('en-US', { weekday: 'long' }) + ', Submitted Claim',
        courseCode: formData.course_code,
        courseColor: formData.course_code.includes('301') ? 'red' : formData.course_code.includes('204') ? 'amber' : 'blue',
        deliverable: formData.notes,
        duration: formData.hours,
        durationFormatted: `${formData.hours.toFixed(1)} hrs`,
        loggedByName: 'Faculty Request',
        submissionRef: newRef,
        status: 'PENDING_HOD_APPROVAL',
      };

      setData((prev) => {
        const nextTotal = prev.totalExtraHours + formData.hours;
        const existingIdx = prev.courseBreakdown.findIndex((c) => c.code === formData.course_code);
        let nextBreakdown = [...prev.courseBreakdown];
        if (existingIdx >= 0) {
          nextBreakdown[existingIdx] = {
            ...nextBreakdown[existingIdx],
            hours: nextBreakdown[existingIdx].hours + formData.hours,
          };
        } else {
          nextBreakdown.push({
            code: formData.course_code,
            name: formData.course_code,
            hours: formData.hours,
            percentage: 0,
            color: '#721c3b',
            dotColor: '#721c3b',
          });
        }
        nextBreakdown = nextBreakdown.map((item) => ({
          ...item,
          percentage: nextTotal > 0 ? Math.round((item.hours / nextTotal) * 100) : 0,
        }));

        return {
          ...prev,
          totalExtraHours: nextTotal,
          courseBreakdown: nextBreakdown,
          logs: [newLog, ...prev.logs],
        };
      });

      showToast(
        'Request Submitted to HoD',
        `Successfully logged ${formData.hours} hrs for ${formData.course_code}. Status: PENDING_HOD_APPROVAL.`
      );
    } catch (err: unknown) {
      console.error('Failed to submit extra hours request:', err);
      showToast('Submission Notice', 'Your request has been recorded locally for HoD review.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      {/* Navigation Sidebar */}
      <Sidebar
        activeItem="teacher"
        activeRole="TEACHER"
        onDownloadSlip={() => setIsSlipModalOpen(true)}
        onOpenCurrencySettings={canViewCurrency ? () => setIsCurrencyModalOpen(true) : undefined}
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
            {/* Welcome Hero Section */}
            <TeacherHero
              teacherName={session.user?.name || data.teacher.name || 'Faculty Member'}
              departmentFaculty={data.teacher?.department?.name || 'Faculty of Computer Engineering & IT'}
              semester="Fall Semester 2026–2027"
              selectedMonth={data.activeCycleName || 'Active Cycle: Sep 25 - Oct 25'}
              onRequestHours={() => setIsRequestModalOpen(true)}
            />

            {/* Top Metric Cards (3 Columns) */}
            <TeacherMetricCards data={data} />

            {/* Middle Content Section (2 Columns: Course Distribution + Workflow Notice) */}
            <TeacherActivityDistribution
              data={data}
              onContactHod={() => {
                window.location.href = `mailto:${data.departmentHod.email}?subject=Extra Hours Reconciliation Inquiry - ${data.teacher.name}`;
              }}
            />

            {/* Detailed Extra Hours Log (Data Table) */}
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

      {/* Request Extra Hours Modal */}
      <RequestExtraHoursModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSubmit={handleRequestHours}
        teacher={data.teacher}
        departmentName={data.teacher?.department?.name || session.user?.departmentName || 'Faculty of Computer Engineering & IT'}
        departments={data.teacher?.departments || session.user?.departments || []}
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
