'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import {
  getTeachersForHodDepartments,
  getDepartmentTimesheets,
  createTimesheet,
  updateTimesheet,
  deleteTimesheet,
} from '@/lib/services/hodService';
import { UniversityUser, Department, Timesheet, SystemSettings } from '@/types/database';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Calendar,
  BookOpen,
  Building2,
  Plus,
  Send,
  Layers,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/lib/context/SessionContext';
import { CurrencySettingsModal } from '@/components/payroll/CurrencySettingsModal';
import { CycleSettingsModal } from '@/components/payroll/CycleSettingsModal';
import { getPayrollSettings, updatePayrollSettings } from '@/lib/services/payrollSettingsService';
import { HodTimesheetTable } from '@/components/hod/HodTimesheetTable';
import { LogExtraHoursModal } from '@/components/hod/LogExtraHoursModal';
import { EditTimesheetModal } from '@/components/hod/EditTimesheetModal';
import {
  getSystemSettings,
  updateSystemSettings,
} from '@/lib/services/systemSettingsService';
import { PayrollSettings } from '@/types/database';

export default function HodSubmissionsLogPage() {
  const session = useSession();
  const [hodUser, setHodUser] = useState<UniversityUser>({
    id: '',
    name: 'Head of Department',
    email: '',
    academic_title: 'Head of Department',
    role: 'HOD',
    department_id: null,
    employment_type: 'FULL_TIME',
    hourly_rate: 0,
    staff_id: '',
    avatar_url: null,
    is_active: true,
  });

  const [managedDepartments, setManagedDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');

  const [department, setDepartment] = useState<Department>({
    id: '',
    name: 'Academic Department',
    code: 'DEPT',
    faculty: 'Academic Faculty',
  });

  const [teachers, setTeachers] = useState<UniversityUser[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [editingTimesheet, setEditingTimesheet] = useState<Timesheet | null>(null);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings | null>(null);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);

  const showToast = (title: string, desc: string) => {
    setToastMessage({ title, desc });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  useEffect(() => {
    getSystemSettings().then(setSystemSettings);
    getPayrollSettings().then(setPayrollSettings);
  }, []);

  const userPerms = (session.user?.custom_permissions || {}) as Record<string, boolean>;
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
      `Active payroll cycle updated: ${res.data?.cycle_name || 'Active Cycle'}`
    );
  };

  // Data fetching
  useEffect(() => {
    let ignore = false;
    const supabase = createClient();
    async function initialFetch() {
      try {
        setIsLoading(true);

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
            if (storedEmail) activeEmail = storedEmail;
          }
        }

        // Fetch all departments
        const { data: deptRows } = await supabase.from('departments').select('*').order('name');
        const allDeptsList = (deptRows || []) as Department[];

        // Fetch HoD profile
        let hodQuery = supabase.from('users').select('*, department:departments(*)');
        if (activeEmail) {
          hodQuery = hodQuery.ilike('email', activeEmail);
        } else {
          hodQuery = hodQuery.eq('role', 'HOD').limit(1);
        }
        const { data: hodData, error: profileErr } = await hodQuery;
        const hodProfile = Array.isArray(hodData) ? hodData[0] : hodData;

        let targetDeptIds: string[] = [];
        if (!profileErr && hodProfile) {
          if (!ignore) setHodUser(hodProfile as UniversityUser);

          if (hodProfile.managed_department_ids && Array.isArray(hodProfile.managed_department_ids) && hodProfile.managed_department_ids.length > 0) {
            targetDeptIds = hodProfile.managed_department_ids;
          } else if (hodProfile.department_ids && Array.isArray(hodProfile.department_ids) && hodProfile.department_ids.length > 0) {
            targetDeptIds = hodProfile.department_ids;
          } else if (hodProfile.department_id) {
            targetDeptIds = [hodProfile.department_id];
          }

          if (targetDeptIds.length === 0 && hodProfile.id) {
            const { data: dhRows } = await supabase
              .from('department_heads')
              .select('department_id')
              .eq('user_id', hodProfile.id);
            if (dhRows && dhRows.length > 0) {
              targetDeptIds = dhRows.map((d: { department_id: string }) => d.department_id);
            }
          }

          const resolvedDepts = allDeptsList.filter((d) => targetDeptIds.includes(d.id));
          if (!ignore) {
            setManagedDepartments(resolvedDepts);
            if (resolvedDepts.length === 1) {
              setSelectedDeptId(resolvedDepts[0].id);
              setDepartment(resolvedDepts[0]);
            } else if (resolvedDepts.length > 1) {
              setSelectedDeptId('ALL');
              setDepartment({
                id: 'MULTI',
                name: resolvedDepts.map((d) => d.name).join(' • '),
                code: 'MULTI',
                faculty: 'Academic Faculties',
              });
            } else if (hodProfile.department) {
              setDepartment(hodProfile.department as Department);
            }
          }
        }

        const fetchedTeachers = await getTeachersForHodDepartments(hodProfile as UniversityUser);
        if (!ignore) setTeachers(fetchedTeachers);

        const fetchedTimesheets = await getDepartmentTimesheets(targetDeptIds, fetchedTeachers, hodProfile?.departments);
        if (!ignore) setTimesheets(fetchedTimesheets);
      } catch (err) {
        console.error('[HOD Submissions Log] Error fetching data:', err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    initialFetch();

    const channel = supabase
      .channel('realtime-hod-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'timesheets' },
        (payload: any) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            setTimesheets((prev) => {
              const newTs = payload.new as Timesheet;
              if (prev.some((t) => t.id === newTs.id)) return prev;
              return [newTs, ...prev];
            });
          }
          initialFetch();
        }
      )
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter scoped data based on selected department tab
  const activeDepartmentObj = useMemo(() => {
    if (selectedDeptId === 'ALL') return department;
    return managedDepartments.find((d) => d.id === selectedDeptId) || department;
  }, [selectedDeptId, managedDepartments, department]);

  const scopedTeachers = useMemo(() => {
    if (selectedDeptId === 'ALL') return teachers;
    return teachers.filter((t) => t.department_id === selectedDeptId);
  }, [teachers, selectedDeptId]);

  const scopedTimesheets = useMemo(() => {
    let list = timesheets;
    if (selectedDeptId !== 'ALL') {
      const targetDeptName = managedDepartments.find((d) => d.id === selectedDeptId)?.name;
      list = timesheets.filter((t) => {
        if (t.department_id && t.department_id === selectedDeptId) return true;
        if (targetDeptName && t.department && t.department.toLowerCase().includes(targetDeptName.toLowerCase())) {
          return true;
        }
        if (t.teacher?.department_id === selectedDeptId) return true;
        return false;
      });
    }
    return [...list].sort((a, b) => {
      const timeA = new Date(a.created_at || a.date).getTime();
      const timeB = new Date(b.created_at || b.date).getTime();
      return timeB - timeA; // Descending: newest on top
    });
  }, [timesheets, selectedDeptId, managedDepartments]);

  // Aggregate counts
  const counts = useMemo(() => {
    const pending = scopedTimesheets.filter(
      (t) => t.status === 'PENDING' || t.status === 'PENDING_HOD_APPROVAL'
    ).length;
    const approved = scopedTimesheets.filter(
      (t) => t.status === 'APPROVED' || t.status === 'PAID'
    ).length;
    const rejected = scopedTimesheets.filter(
      (t) => t.status === 'REJECTED'
    ).length;

    return {
      all: scopedTimesheets.length,
      pending,
      approved,
      rejected,
    };
  }, [scopedTimesheets]);

  // Create Request handler
  const handleLogExtraHours = async (data: {
    teacher_id: string;
    submitted_by_id?: string;
    date: string;
    hours: number;
    course_code?: string;
    session_type?: string;
    notes?: string;
    hod_id: string;
    department?: string;
    department_id?: string;
    is_special_condition?: boolean;
    special_condition_reason?: string;
  }) => {
    const res = await createTimesheet({
      ...data,
      submitted_by_id: data.submitted_by_id || hodUser.id,
      department_id: data.department_id || (selectedDeptId !== 'ALL' ? selectedDeptId : undefined),
    });

    if (res.success && res.timesheet) {
      const teacherObj =
        (data.teacher_id === hodUser.id ? hodUser : teachers.find((t) => t.id === data.teacher_id)) || hodUser;

      const enrichedTimesheet: Timesheet = {
        ...res.timesheet,
        teacher: teacherObj || null,
        submitted_by: { id: hodUser.id, name: hodUser.name, email: hodUser.email },
        created_at: res.timesheet?.created_at || new Date().toISOString(),
      };

      setTimesheets((prev) => [enrichedTimesheet, ...prev]);
      showToast(
        'Request Submitted to Coordinator',
        `Successfully submitted extra hours request for ${teacherObj?.name || 'Faculty Member'}.`
      );
    } else {
      showToast('Submission Blocked', res.error || 'Failed to submit extra hours request.');
    }
  };

  // Edit Request handler
  const handleSaveEdit = async (id: string, updates: Partial<Timesheet>) => {
    const res = await updateTimesheet(id, updates);
    if (res.success) {
      setTimesheets((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
      showToast('Request Updated', 'The submitted request has been updated successfully.');
    } else {
      showToast('Update Failed', res.error || 'Failed to update timesheet.');
    }
  };

  // Delete Request handler
  const handleDeleteTimesheet = async (id: string) => {
    if (!confirm('Are you sure you want to withdraw this extra hours request?')) return;
    const res = await deleteTimesheet(id);
    if (res.success) {
      setTimesheets((prev) => prev.filter((item) => item.id !== id));
      showToast('Request Withdrawn', 'The request has been deleted.');
    } else {
      showToast('Delete Failed', res.error || 'Failed to delete request.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      {/* Persistent Sidebar */}
      <Sidebar
        activeItem="hod-requests"
        activeRole="HOD"
        pendingRequestsCount={counts.pending}
        onOpenCurrencySettings={canViewCurrency ? () => setIsCurrencyModalOpen(true) : undefined}
        onOpenCycleSettings={canManageCycles ? () => setIsCycleModalOpen(true) : undefined}
      />

      {/* Main Content Area Offset by Sidebar */}
      <div className="pl-72">
        {/* Global Header */}
        <Header
          breadcrumbCategory="TIU Academic Portal"
          breadcrumbPage="Submissions Outbox"
          searchPlaceholder="⌘K Search requests..."
          activeViewLabel="Head of Department"
          customPermissions={userPerms}
        />

        {/* Page Main Content */}
        <main className="w-full pt-20 pb-20 px-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Top Action & Department Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#540225]" />
                  <h1 className="font-headline text-2xl font-bold text-[#0b1c30]">
                    Submitted Extra Hours Outbox
                  </h1>
                </div>
                <p className="text-xs text-slate-500 max-w-3xl">
                  Track and manage extra hours requests submitted for faculty in{' '}
                  <strong className="text-slate-800">{activeDepartmentObj.name}</strong>. In the new workflow, requests are reviewed and approved directly by the Academic Coordinator.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsLogModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Submit Extra Hours Request</span>
              </button>
            </div>

            {/* Multi-Department Switcher if HoD oversees > 1 department */}
            {managedDepartments.length > 1 && (
              <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#540225]" />
                    <span className="text-xs font-bold text-slate-800">
                      Filter Submissions by Department:
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {managedDepartments.length} Assigned Departments
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedDeptId('ALL')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      selectedDeptId === 'ALL'
                        ? 'bg-[#540225] text-white shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>All Departments ({timesheets.length})</span>
                  </button>

                  {managedDepartments.map((dept) => {
                    const deptCount = timesheets.filter((t) => {
                      if (t.department_id === dept.id) return true;
                      if (t.department && t.department.toLowerCase().includes(dept.name.toLowerCase())) return true;
                      if (t.teacher?.department_id === dept.id) return true;
                      return false;
                    }).length;

                    return (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => setSelectedDeptId(dept.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                          selectedDeptId === dept.id
                            ? 'bg-[#540225] text-white shadow-xs'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{dept.name} ({deptCount})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Outbox / Submissions Log Table */}
            <HodTimesheetTable
              timesheets={scopedTimesheets}
              onEdit={(ts) => setEditingTimesheet(ts)}
              onDelete={handleDeleteTimesheet}
            />
          </div>
        </main>
      </div>

      {/* Submit Extra Hours Request Modal */}
      <LogExtraHoursModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        teachers={scopedTeachers}
        hodUser={hodUser}
        hodId={hodUser.id}
        departmentName={activeDepartmentObj.name}
        departments={managedDepartments.map((d) => d.name)}
        activeDepartmentId={selectedDeptId !== 'ALL' ? selectedDeptId : managedDepartments[0]?.id}
        onSubmit={handleLogExtraHours}
      />

      {/* Edit Timesheet Modal */}
      <EditTimesheetModal
        isOpen={!!editingTimesheet}
        timesheet={editingTimesheet}
        onClose={() => setEditingTimesheet(null)}
        onSave={handleSaveEdit}
      />

      {/* Currency Settings Modal */}
      {canViewCurrency && systemSettings && (
        <CurrencySettingsModal
          isOpen={isCurrencyModalOpen}
          onClose={() => setIsCurrencyModalOpen(false)}
          exchangeRate={systemSettings.exchange_rate}
          financeCanEditExchange={canEditCurrency}
          onSave={async (newRate) => {
            await updateSystemSettings({ exchange_rate: newRate });
            setSystemSettings((prev) => (prev ? { ...prev, exchange_rate: newRate } : null));
            showToast('Currency Updated', `Exchange rate saved: $1 = ${newRate.toLocaleString()} IQD`);
          }}
        />
      )}

      {/* Cycle Settings Modal */}
      {canManageCycles && payrollSettings && (
        <CycleSettingsModal
          isOpen={isCycleModalOpen}
          onClose={() => setIsCycleModalOpen(false)}
          settings={payrollSettings}
          onSave={handleSaveCycleSettings}
        />
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0b1c30] text-white p-4 px-5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="flex flex-col">
            <span className="font-bold text-xs">{toastMessage.title}</span>
            <span className="text-[11px] text-slate-300">{toastMessage.desc}</span>
          </div>
        </div>
      )}
    </div>
  );
}
