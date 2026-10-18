'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { HodHeader } from '@/components/hod/HodHeader';
import { HodMetricCards } from '@/components/hod/HodMetricCards';
import { UserTable } from '@/components/admin/UserTable';
import { LogExtraHoursModal } from '@/components/hod/LogExtraHoursModal';
import { EditTimesheetModal } from '@/components/hod/EditTimesheetModal';
import {
  getDepartmentTeachers,
  getDepartmentTimesheets,
  createTimesheet,
  updateTimesheet,
  deleteTimesheet,
  approveTimesheet,
  rejectTimesheet,
  batchApproveDepartmentTimesheets,
} from '@/lib/services/hodService';
import { UniversityUser, Department, Timesheet } from '@/types/database';
import { CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/lib/context/SessionContext';
import { CurrencySettingsModal } from '@/components/payroll/CurrencySettingsModal';
import {
  getSystemSettings,
  updateSystemSettings,
  checkCanViewCurrency,
  checkCanEditCurrency,
} from '@/lib/services/systemSettingsService';
import { SystemSettings } from '@/types/database';

export default function HodPage() {
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
  const [department, setDepartment] = useState<Department>({
    id: '',
    name: 'Academic Department',
    code: 'DEPT',
    faculty: 'Academic Faculty',
  });

  const [teachers, setTeachers] = useState<UniversityUser[]>([]);
  const [departmentFaculty, setDepartmentFaculty] = useState<UniversityUser[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [editingTimesheet, setEditingTimesheet] = useState<Timesheet | null>(null);
  const [isApprovingBatch, setIsApprovingBatch] = useState(false);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  // Search & Notifications
  const [globalSearch, setGlobalSearch] = useState('');
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);

  const showToast = (title: string, desc: string) => {
    setToastMessage({ title, desc });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  useEffect(() => {
    getSystemSettings().then(setSystemSettings);
  }, []);

  const userPerms = (session.user?.custom_permissions || {}) as Record<string, boolean>;
  const canViewCurrency = checkCanViewCurrency('HOD', userPerms, session.isSuperAdmin);
  const canEditCurrency = checkCanEditCurrency('HOD', userPerms, session.isSuperAdmin);

  useEffect(() => {
    let ignore = false;
    async function initialFetch() {
      try {
        setIsLoading(true);
        const supabase = createClient();

        // 1. Resolve current active HOD email from session/cookie/localStorage
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

        console.log('[HOD Page Debug] Initializing HOD portal for email:', activeEmail);

        // 2. Fetch HOD user profile & associated department from Supabase
        let hodQuery = supabase.from('users').select('*, department:departments(*)');
        if (activeEmail) {
          hodQuery = hodQuery.ilike('email', activeEmail);
        } else {
          hodQuery = hodQuery.eq('role', 'HOD').limit(1);
        }
        const { data: hodData, error: profileErr } = await hodQuery;
        const hodProfile = Array.isArray(hodData) ? hodData[0] : hodData;

        let targetDeptIds: string[] = [];

        if (profileErr) {
          console.error('[HOD Page Debug] PostgREST Error fetching HOD profile:', profileErr);
        } else if (hodProfile) {
          console.log('[HOD Page Debug] Successfully resolved HOD user profile:', {
            id: hodProfile.id,
            name: hodProfile.name,
            role: hodProfile.role,
            department_id: hodProfile.department_id,
            department_ids: hodProfile.department_ids,
          });

          if (hodProfile.department_ids && Array.isArray(hodProfile.department_ids) && hodProfile.department_ids.length > 0) {
            targetDeptIds = hodProfile.department_ids;
          } else if (hodProfile.department_id) {
            targetDeptIds = [hodProfile.department_id];
          }

          if (!ignore) {
            setHodUser(hodProfile as UniversityUser);
            if (hodProfile.department) {
              const deptObj = { ...(hodProfile.department as Department) };
              if (hodProfile.departments && Array.isArray(hodProfile.departments) && hodProfile.departments.length > 1) {
                deptObj.name = hodProfile.departments.join(' • ');
              }
              setDepartment(deptObj);
            } else if (hodProfile.departments && Array.isArray(hodProfile.departments) && hodProfile.departments.length > 0) {
              setDepartment({
                id: targetDeptIds[0] || '',
                name: hodProfile.departments.join(' • '),
                code: 'MULTI',
                faculty: 'Academic Faculty',
              } as Department);
            }
          }
        }

        console.log('[HOD Page Debug] Fetching teachers and timesheets for department_ids:', targetDeptIds);

        // 3. Fetch teachers and department timesheets
        const fetchedTeachers = await getDepartmentTeachers(targetDeptIds);
        if (!ignore) setTeachers(fetchedTeachers);

        const fetchedTimesheets = await getDepartmentTimesheets(targetDeptIds, fetchedTeachers, hodProfile?.departments);
        console.log(`[HOD Page Debug] Loaded ${fetchedTimesheets.length} total timesheets for HOD view.`);
        if (!ignore) setTimesheets(fetchedTimesheets);

        // 4. Fetch scoped department faculty for the Department Faculty Directory table
        const hodDepartments: string[] = (
          hodProfile?.departments && Array.isArray(hodProfile.departments) && hodProfile.departments.length > 0
            ? hodProfile.departments
            : hodProfile?.department?.name
            ? [hodProfile.department.name]
            : ['Pharmacy']
        ).filter(Boolean);

        let facultyQuery = supabase
          .from('users')
          .select('*, department:departments(*)')
          .in('role', ['TEACHER', 'COORDINATOR']);

        if (hodDepartments.length > 0) {
          facultyQuery = facultyQuery.overlaps('department', hodDepartments);
        }

        const { data: facultyData, error: facultyError } = await facultyQuery.order('name', { ascending: true });

        if (facultyError) {
          console.error('[HOD Page] Error fetching department faculty:', facultyError);
        } else if (facultyData && !ignore) {
          setDepartmentFaculty(facultyData as UniversityUser[]);
          if (facultyData.length > 0) {
            setTeachers(facultyData as UniversityUser[]);
          }
        }

        // Fetch all departments for UserTable department filtering dropdown
        const { data: deptRows } = await supabase.from('departments').select('*').order('name');
        if (deptRows && !ignore) {
          setAllDepartments(deptRows as Department[]);
        }
      } catch (err) {
        console.error('[HOD Page Debug] Error fetching HoD department data:', err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    initialFetch();
    return () => {
      ignore = true;
    };
  }, []);

  // Aggregate metric calculations
  const metrics = useMemo(() => {
    const totalHours = timesheets.reduce((acc, t) => acc + Number(t.hours), 0);
    const pendingCount = timesheets.filter(
      (t) => t.status === 'PENDING' || t.status === 'PENDING_HOD_APPROVAL'
    ).length;
    const approvedCount = timesheets.filter((t) => t.status === 'APPROVED' || t.status === 'PAID').length;

    return {
      totalHours,
      activeTeachersCount: teachers.length,
      pendingCount,
      approvedCount,
    };
  }, [timesheets, teachers]);

  // Handle + Log Extra Hours (Optimistic Insert)
  const handleLogExtraHours = async (data: {
    teacher_id: string;
    date: string;
    hours: number;
    course_code?: string;
    session_type?: string;
    notes?: string;
    hod_id: string;
    department?: string;
  }) => {
    const res = await createTimesheet(data);
    if (res.success && res.timesheet) {
      const teacherObj = (data.teacher_id === hodUser.id ? hodUser : teachers.find((t) => t.id === data.teacher_id)) || hodUser;
      const enrichedTimesheet: Timesheet = {
        ...res.timesheet,
        teacher: teacherObj || null,
      };

      // Optimistic state update
      setTimesheets((prev) => [enrichedTimesheet, ...prev]);
      showToast(
        'Extra Hours Logged',
        `Recorded ${data.hours} hrs for ${teacherObj?.name || 'Head of Department'} with status PENDING.`
      );
    } else {
      showToast(
        'Action Blocked by Finance',
        res.error || 'Failed to record timesheet for this date.'
      );
    }
  };

  // Handle Edit Timesheet
  const handleSaveEdit = async (id: string, updates: Partial<Timesheet>) => {
    const res = await updateTimesheet(id, updates);
    if (res.success) {
      setTimesheets((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
      showToast('Timesheet Updated', 'The log entry has been updated successfully.');
    } else {
      showToast('Update Failed', res.error || 'Failed to update timesheet.');
    }
  };

  // Handle Delete Timesheet
  const handleDeleteTimesheet = async (id: string) => {
    const target = timesheets.find((t) => t.id === id);
    const res = await deleteTimesheet(id);
    if (res.success) {
      setTimesheets((prev) => prev.filter((item) => item.id !== id));
      showToast(
        'Log Removed',
        `Timesheet log for ${target?.teacher?.name || 'Faculty'} was deleted.`
      );
    }
  };

  // Handle Approve Single Timesheet (From Teacher Request or Pending Log)
  const handleApproveSingle = async (id: string) => {
    const target = timesheets.find((t) => t.id === id);
    const res = await approveTimesheet(id, hodUser.id);
    if (res.success) {
      setTimesheets((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: 'APPROVED' as const, hod_id: hodUser.id } : item
        )
      );
      showToast(
        'Request Approved',
        `Approved extra hours request for ${target?.teacher?.name || 'Faculty Member'}.`
      );
    } else {
      showToast(
        'Approval Blocked by Finance',
        res.error || 'Action disabled because the payroll cycle is locked.'
      );
    }
  };

  // Handle Reject Single Timesheet (From Teacher Request or Pending Log)
  const handleRejectSingle = async (id: string) => {
    const target = timesheets.find((t) => t.id === id);
    const res = await rejectTimesheet(id, hodUser.id);
    if (res.success) {
      setTimesheets((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: 'REJECTED' as const, hod_id: hodUser.id } : item
        )
      );
      showToast(
        'Request Rejected',
        `Rejected extra hours request for ${target?.teacher?.name || 'Faculty Member'}.`
      );
    }
  };

  // Handle Batch Sign & Submit Department Hours to Finance
  const handleBatchApprove = async () => {
    setIsApprovingBatch(true);
    try {
      const targetDepts = hodUser.department_ids && hodUser.department_ids.length > 0
        ? hodUser.department_ids
        : department.id;
      const res = await batchApproveDepartmentTimesheets(targetDepts, hodUser.id);
      if (res.success) {
        // Optimistically update all PENDING & PENDING_HOD_APPROVAL records to APPROVED
        setTimesheets((prev) =>
          prev.map((item) =>
            item.status === 'PENDING' || item.status === 'PENDING_HOD_APPROVAL'
              ? { ...item, status: 'APPROVED' as const, hod_id: hodUser.id }
              : item
          )
        );

        showToast(
          'Department Timesheets Signed & Submitted',
          `Successfully authenticated and approved ${res.approvedCount} pending timesheet records. Forwarded to Central Finance for payroll reconciliation.`
        );
      } else {
        showToast(
          'Batch Approval Blocked',
          (res as { error?: string }).error || 'The current payroll cycle is locked by Central Finance.'
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsApprovingBatch(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      {/* Persistent Sidebar with Department (HoD) highlighted in burgundy */}
      <Sidebar
        activeItem="hod"
        activeRole="HOD"
        pendingRequestsCount={metrics.pendingCount}
        onOpenCurrencySettings={canViewCurrency ? () => setIsCurrencyModalOpen(true) : undefined}
      />

      {/* Main Content Area Offset by Sidebar */}
      <div className="pl-72">
        {/* Global Header */}
        <Header
          breadcrumbCategory="TIU Academic Portal"
          breadcrumbPage="Department Extra Hours"
          searchPlaceholder="⌘K Search faculty, courses, logs..."
          activeViewLabel="Head of Department"
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
          customPermissions={userPerms}
        />

        {/* Page Main Content */}
        <main className="w-full pt-20 pb-20 px-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Top Action & Header */}
            <HodHeader
              department={department}
              onOpenLogModal={() => setIsLogModalOpen(true)}
              pendingCount={metrics.pendingCount}
            />

            {/* Metric Cards (2 Columns) */}
            <HodMetricCards
              totalHours={metrics.totalHours}
              pendingCount={metrics.pendingCount}
            />

            {/* Department Faculty Directory (Replacing redundant timesheet ledger) */}
            <UserTable
              users={departmentFaculty}
              departments={allDepartments}
              isReadOnly={true}
              title="Department Faculty Directory"
            />
          </div>
        </main>
      </div>

      {/* Log Extra Hours Modal */}
      <LogExtraHoursModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        teachers={teachers}
        hodUser={hodUser}
        hodId={hodUser.id}
        departmentName={department.name}
        departments={hodUser.departments && hodUser.departments.length > 0 ? hodUser.departments : department.name ? [department.name] : []}
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
            const ok = await updateSystemSettings({ exchange_rate: newRate });
            if (ok) {
              setSystemSettings((prev) => (prev ? { ...prev, exchange_rate: newRate } : null));
              showToast('Currency Updated', `System exchange rate updated to ${(newRate / 100).toLocaleString()} IQD / $1.`);
            }
          }}
        />
      )}

      {/* Floating Toast Notification */}
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
