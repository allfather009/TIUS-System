'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import {
  getDepartmentTeachers,
  getDepartmentTimesheets,
  approveTimesheet,
  rejectTimesheet,
  batchApproveDepartmentTimesheets,
} from '@/lib/services/hodService';
import { UniversityUser, Department, Timesheet, SystemSettings } from '@/types/database';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Check,
  X,
  CheckCheck,
  Search,
  FileCheck2,
  Calendar,
  BookOpen,
  Eye,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/lib/context/SessionContext';
import { CurrencySettingsModal } from '@/components/payroll/CurrencySettingsModal';
import { TimesheetDetailsModal } from '@/components/hod/TimesheetDetailsModal';
import {
  getSystemSettings,
  updateSystemSettings,
  checkCanViewCurrency,
  checkCanEditCurrency,
} from '@/lib/services/systemSettingsService';

export default function HodTeacherRequestsPage() {
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
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApprovingBatch, setIsApprovingBatch] = useState(false);

  // Status Filter: PENDING by default
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'ALL' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [search, setSearch] = useState('');

  // Modals & Feedback
  const [selectedForDetails, setSelectedForDetails] = useState<Timesheet | null>(null);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
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

  // Data fetching
  useEffect(() => {
    let ignore = false;
    async function initialFetch() {
      try {
        setIsLoading(true);
        const supabase = createClient();

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

        const fetchedTeachers = await getDepartmentTeachers(targetDeptIds);
        if (!ignore) setTeachers(fetchedTeachers);

        const fetchedTimesheets = await getDepartmentTimesheets(targetDeptIds, fetchedTeachers, hodProfile?.departments);
        if (!ignore) setTimesheets(fetchedTimesheets);
      } catch (err) {
        console.error('[HOD Requests Page] Error fetching data:', err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    initialFetch();
    return () => {
      ignore = true;
    };
  }, []);

  // Helper for Course Tag color
  const getCourseBadgeColor = (code?: string | null) => {
    const c = (code || '').toUpperCase();
    if (c.includes('CS301') || c.includes('CS')) return 'bg-rose-50 text-[#721c3b] border-rose-200';
    if (c.includes('IT204') || c.includes('IT')) return 'bg-amber-50 text-amber-900 border-amber-200';
    if (c.includes('FYP')) return 'bg-blue-50 text-blue-900 border-blue-200';
    return 'bg-purple-50 text-purple-900 border-purple-200';
  };

  // Pending items
  const pendingRequests = useMemo(() => {
    return timesheets.filter(
      (ts) => ts.status === 'PENDING_HOD_APPROVAL' || ts.status === 'PENDING'
    );
  }, [timesheets]);

  // Counts
  const counts = useMemo(() => {
    const pending = timesheets.filter((t) => t.status === 'PENDING' || t.status === 'PENDING_HOD_APPROVAL').length;
    const approved = timesheets.filter((t) => t.status === 'APPROVED' || t.status === 'PAID').length;
    const rejected = timesheets.filter((t) => t.status === 'REJECTED').length;
    return {
      all: timesheets.length,
      pending,
      approved,
      rejected,
    };
  }, [timesheets]);

  // Filtered requests based on search and statusFilter
  const filtered = useMemo(() => {
    return timesheets.filter((ts) => {
      if (statusFilter === 'PENDING' && ts.status !== 'PENDING' && ts.status !== 'PENDING_HOD_APPROVAL') {
        return false;
      }
      if (statusFilter === 'APPROVED' && ts.status !== 'APPROVED' && ts.status !== 'PAID') {
        return false;
      }
      if (statusFilter === 'REJECTED' && ts.status !== 'REJECTED') {
        return false;
      }

      if (search) {
        const q = search.toLowerCase();
        const teacherName = ts.teacher?.name?.toLowerCase() || '';
        const email = ts.teacher?.email?.toLowerCase() || '';
        const course = ts.course_code?.toLowerCase() || '';
        const notes = ts.notes?.toLowerCase() || '';
        const sessionType = ts.session_type?.toLowerCase() || '';

        return (
          teacherName.includes(q) ||
          email.includes(q) ||
          course.includes(q) ||
          notes.includes(q) ||
          sessionType.includes(q)
        );
      }

      return true;
    });
  }, [timesheets, search, statusFilter]);

  // Handle Approve Single Timesheet
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

  // Handle Reject Single Timesheet
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
    } else {
      showToast(
        'Action Blocked',
        res.error || 'Failed to reject timesheet.'
      );
    }
  };

  // Handle Batch Approve All Pending
  const handleBatchApprove = async () => {
    setIsApprovingBatch(true);
    try {
      const targetDepts = hodUser.department_ids && hodUser.department_ids.length > 0
        ? hodUser.department_ids
        : department.id;
      const res = await batchApproveDepartmentTimesheets(targetDepts, hodUser.id);
      if (res.success) {
        setTimesheets((prev) =>
          prev.map((item) =>
            item.status === 'PENDING' || item.status === 'PENDING_HOD_APPROVAL'
              ? { ...item, status: 'APPROVED' as const, hod_id: hodUser.id }
              : item
          )
        );
        showToast(
          'All Requests Approved',
          `Successfully authenticated and approved ${res.approvedCount} pending timesheet requests.`
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
      {/* Persistent Sidebar with Teacher Requests highlighted in burgundy */}
      <Sidebar
        activeItem="hod-requests"
        activeRole="HOD"
        pendingRequestsCount={counts.pending}
        onOpenCurrencySettings={canViewCurrency ? () => setIsCurrencyModalOpen(true) : undefined}
      />

      {/* Main Content Area Offset by Sidebar */}
      <div className="pl-72">
        {/* Global Header */}
        <Header
          breadcrumbCategory="TIU Academic Portal"
          breadcrumbPage="Teacher Requests"
          searchPlaceholder="⌘K Search teacher requests, course..."
          activeViewLabel="Head of Department"
          searchQuery={search}
          onSearchChange={setSearch}
          customPermissions={userPerms}
        />

        {/* Page Main Content */}
        <main className="w-full pt-20 pb-20 px-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Top Action & Department Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
              <div className="space-y-1">
                <h1 className="font-headline text-2xl font-bold text-[#0b1c30]">
                  Faculty Timesheet Requests
                </h1>
                <p className="text-xs text-slate-500">
                  Review, approve, or reject monthly extra hours submitted by faculty members in your department requiring Head of Department sign-off.
                </p>
              </div>

              {pendingRequests.length > 0 && (
                <button
                  type="button"
                  onClick={handleBatchApprove}
                  disabled={isApprovingBatch}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-70 shrink-0"
                >
                  {isApprovingBatch ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Approving All...</span>
                    </>
                  ) : (
                    <>
                      <CheckCheck className="w-4 h-4" />
                      <span>Approve All ({pendingRequests.length})</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Filter Pills & Search Bar */}
            <div className="p-4 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search faculty name, course code, notes..."
                  className="w-full h-10 pl-9 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white transition-all"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setStatusFilter('PENDING')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === 'PENDING'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                  Pending ({counts.pending})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-[#540225] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Requests ({counts.all})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('APPROVED')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === 'APPROVED'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  Approved ({counts.approved})
                </button>

                {counts.rejected > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('REJECTED')}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      statusFilter === 'REJECTED'
                        ? 'bg-rose-700 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-300" />
                    Rejected ({counts.rejected})
                  </button>
                )}
              </div>
            </div>

            {/* Main Pending Teacher Requests Workflow Box */}
            <div className="bg-white rounded-3xl shadow-sm border border-amber-200/90 overflow-hidden">
              <div className="p-5 px-6 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40 border-b border-amber-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4 text-amber-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-headline font-bold text-base text-[#0b1c30]">
                        Teacher Requests
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 text-xs font-bold border border-amber-300">
                        {filtered.length} Displayed
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Timesheets submitted by faculty members in your department requiring Head of Department sign-off
                    </p>
                  </div>
                </div>
              </div>

              {/* Requests List */}
              <div className="divide-y divide-slate-100">
                {isLoading ? (
                  <div className="p-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-[#540225] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs">Loading faculty requests...</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">All Teacher Requests Handled</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {statusFilter === 'PENDING'
                        ? 'No faculty timesheets are currently awaiting departmental endorsement.'
                        : 'No timesheet records found for this status.'}
                    </p>
                  </div>
                ) : (
                  filtered.map((ts) => {
                    const teacher = ts.teacher;
                    const initials = teacher?.name
                      ? teacher.name.split(' ').map((n) => n[0]).join('').slice(0, 2)
                      : 'TC';
                    const isPending = ts.status === 'PENDING' || ts.status === 'PENDING_HOD_APPROVAL';

                    return (
                      <div
                        key={ts.id}
                        className="p-4 sm:p-5 px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-amber-50/20 transition-colors"
                      >
                        {/* Left: Teacher Info & Details */}
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                          {teacher?.avatar_url ? (
                            <img
                              src={teacher.avatar_url}
                              alt={teacher.name}
                              className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-100 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs ring-2 ring-blue-50 shrink-0">
                              {initials}
                            </div>
                          )}

                          <div className="flex flex-col min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-[#0b1c30]">
                                {teacher?.name || 'Faculty Member'}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {teacher?.academic_title || 'Assistant Professor'}
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                {teacher?.email || 'teacher@tiu.edu.iq'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${getCourseBadgeColor(ts.course_code)}`}>
                                {ts.course_code || 'GEN'}
                              </span>
                              <span className="font-semibold text-slate-800">
                                {new Date(ts.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                              </span>
                              <span>•</span>
                              <span className="font-medium text-slate-700">
                                {ts.notes || ts.session_type || 'Instructional makeup session'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Hours badge and action buttons */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div className="text-right">
                            <div className="font-headline font-bold text-base text-[#721c3b]">
                              {Number(ts.hours).toFixed(1)} hrs
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">Claimed Duration</span>
                          </div>

                          {isPending ? (
                            <div className="flex items-center gap-2">
                              {/* VIEW DETAILS BUTTON */}
                              <button
                                type="button"
                                onClick={() => setSelectedForDetails(ts)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 active:scale-95 text-xs font-semibold transition-all cursor-pointer"
                                title="View full request details"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                <span>Details</span>
                              </button>

                              {/* INLINE APPROVE BUTTON */}
                              <button
                                type="button"
                                onClick={() => handleApproveSingle(ts.id)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                                title="Approve this timesheet"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>

                              {/* INLINE REJECT BUTTON */}
                              <button
                                type="button"
                                onClick={() => handleRejectSingle(ts.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 active:scale-95 text-xs font-bold transition-all cursor-pointer"
                                title="Reject this timesheet"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedForDetails(ts)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 active:scale-95 text-xs font-semibold transition-all cursor-pointer"
                                title="View full request details"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                <span>Details</span>
                              </button>
                              {ts.status === 'APPROVED' || ts.status === 'PAID' ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-100">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Approved
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 text-xs font-bold border border-rose-200">
                                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                  Rejected
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Timesheet Details Modal */}
      <TimesheetDetailsModal
        isOpen={!!selectedForDetails}
        timesheet={selectedForDetails}
        onClose={() => setSelectedForDetails(null)}
        onApprove={handleApproveSingle}
        onReject={handleRejectSingle}
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
