'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Building2,
  AlertCircle,
  RefreshCw,
  CheckCheck,
  User,
  GraduationCap,
  Calendar,
  AlertTriangle,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Coins,
} from 'lucide-react';
import { useSession } from '@/lib/context/SessionContext';
import { Department, SystemSettings, PayrollSettings } from '@/types/database';
import { getDepartments } from '@/lib/services/userService';
import {
  getSystemSettings,
  updateSystemSettings,
} from '@/lib/services/systemSettingsService';
import {
  getPayrollSettings,
  updatePayrollSettings,
} from '@/lib/services/payrollSettingsService';
import { CurrencySettingsModal } from '@/components/payroll/CurrencySettingsModal';
import { CycleSettingsModal } from '@/components/payroll/CycleSettingsModal';

interface CoordinatorRequest {
  id: string;
  teacher_id: string;
  submitted_by_id: string;
  hod_id?: string | null;
  date: string;
  hours: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  course_code?: string | null;
  course_activity?: string | null;
  session_type?: string | null;
  notes?: string | null;
  department?: string | null;
  department_id?: string | null;
  created_at?: string;
  approved_at?: string | null;
  teacher?: {
    id: string;
    name: string;
    email: string;
    role: string;
    academic_title?: string | null;
    department?: {
      id: string;
      name: string;
      code?: string;
    } | null;
  } | null;
  submitted_by?: {
    id: string;
    name: string;
    email: string;
    role?: string;
    academic_title?: string | null;
  } | null;
}

export default function CoordinatorPortalPage() {
  const session = useSession();

  // Data states
  const [requests, setRequests] = useState<CoordinatorRequest[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Batch Selection
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());

  // Rejection Modal State
  const [rejectionModal, setRejectionModal] = useState<{
    isOpen: boolean;
    request: CoordinatorRequest | null;
    reason: string;
    submitting: boolean;
  }>({
    isOpen: false,
    request: null,
    reason: '',
    submitting: false,
  });

  // Settings & Currency
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings | null>(null);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    desc: string;
  } | null>(null);

  const showToast = (title: string, desc: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ type, title, desc });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Fetch Requests & Auxiliary Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resRequests, deptsList, sysSettings, paySettings] = await Promise.all([
        fetch('/api/requests', { cache: 'no-store' }).then((r) => r.json()),
        getDepartments(),
        getSystemSettings(),
        getPayrollSettings(),
      ]);

      if (resRequests.success && Array.isArray(resRequests.data)) {
        setRequests(resRequests.data);
      }
      setDepartments(deptsList);
      setSystemSettings(sysSettings);
      setPayrollSettings(paySettings);
    } catch (err) {
      console.error('[Coordinator] Failed to load requests:', err);
      showToast('Data Error', 'Unable to fetch requests from institutional database.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute Counts
  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter((r) => r.status === 'PENDING').length,
      approved: requests.filter((r) => r.status === 'APPROVED').length,
      rejected: requests.filter((r) => r.status === 'REJECTED').length,
      pendingHours: requests
        .filter((r) => r.status === 'PENDING')
        .reduce((sum, r) => sum + (Number(r.hours) || 0), 0),
      approvedHours: requests
        .filter((r) => r.status === 'APPROVED')
        .reduce((sum, r) => sum + (Number(r.hours) || 0), 0),
    };
  }, [requests]);

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // 1. Tab filter
      if (activeTab === 'PENDING' && req.status !== 'PENDING') return false;
      if (activeTab === 'APPROVED' && req.status !== 'APPROVED') return false;
      if (activeTab === 'REJECTED' && req.status !== 'REJECTED') return false;

      // 2. Department filter
      if (selectedDeptId !== 'ALL') {
        const matchesDeptId = req.department_id === selectedDeptId;
        const matchesDeptName =
          req.department &&
          departments.find((d) => d.id === selectedDeptId)?.name.toLowerCase() === req.department.toLowerCase();
        if (!matchesDeptId && !matchesDeptName) return false;
      }

      // 3. Search query (faculty beneficiary name, HoD submitter name, course code, notes)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const teacherName = req.teacher?.name?.toLowerCase() || '';
        const submitterName = req.submitted_by?.name?.toLowerCase() || '';
        const course = req.course_code?.toLowerCase() || '';
        const deliverable = (req.notes || req.course_activity || '').toLowerCase();
        const dept = (req.department || req.teacher?.department?.name || '').toLowerCase();

        return (
          teacherName.includes(q) ||
          submitterName.includes(q) ||
          course.includes(q) ||
          deliverable.includes(q) ||
          dept.includes(q)
        );
      }

      return true;
    });
  }, [requests, activeTab, selectedDeptId, searchQuery, departments]);

  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  // Handle Approve (Single or Batch)
  const handleApprove = async (ids: string[]) => {
    if (ids.length === 0) return;
    const isBatch = ids.length > 1;

    if (isBatch) setBatchLoading(true);
    else setActionLoadingId(ids[0]);

    try {
      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          status: 'APPROVED',
          reviewer_id: session.user?.id,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to approve request(s).');
      }

      // Optimistic update
      const nowIso = new Date().toISOString();
      setRequests((prev) =>
        prev.map((r) => (ids.includes(r.id) ? { ...r, status: 'APPROVED', approved_at: nowIso } : r))
      );

      // Deselect approved items
      setSelectedRequestIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });

      showToast(
        isBatch ? 'Batch Approval Successful' : 'Request Approved',
        isBatch
          ? `Successfully approved ${ids.length} pending extra hours requests.`
          : 'Request status updated to APPROVED and recorded in institutional audit log.',
        'success'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Coordinator] Approve error:', msg);
      showToast('Approval Failed', msg, 'error');
    } finally {
      if (isBatch) setBatchLoading(false);
      else setActionLoadingId(null);
    }
  };

  // Open Rejection Modal
  const openRejectionModal = (req: CoordinatorRequest) => {
    setRejectionModal({
      isOpen: true,
      request: req,
      reason: '',
      submitting: false,
    });
  };

  // Confirm Rejection
  const handleConfirmRejection = async () => {
    if (!rejectionModal.request) return;
    const req = rejectionModal.request;

    setRejectionModal((prev) => ({ ...prev, submitting: true }));

    try {
      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: [req.id],
          status: 'REJECTED',
          reason: rejectionModal.reason.trim() || undefined,
          reviewer_id: session.user?.id,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to reject request.');
      }

      // Optimistic update
      const formattedNote = rejectionModal.reason.trim()
        ? `[Rejected by Coordinator: ${rejectionModal.reason.trim()}] ${req.notes || ''}`
        : req.notes;

      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id ? { ...r, status: 'REJECTED', notes: formattedNote } : r
        )
      );

      // Deselect if it was selected
      setSelectedRequestIds((prev) => {
        const next = new Set(prev);
        next.delete(req.id);
        return next;
      });

      setRejectionModal({ isOpen: false, request: null, reason: '', submitting: false });

      showToast(
        'Request Rejected',
        `Extra hours claim for ${req.teacher?.name || 'Faculty Member'} marked as REJECTED with note logged.`,
        'info'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Coordinator] Reject error:', msg);
      showToast('Rejection Failed', msg, 'error');
      setRejectionModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Checkbox helpers for batch selection
  const pendingPaginatedIds = useMemo(() => {
    return paginatedRequests.filter((r) => r.status === 'PENDING').map((r) => r.id);
  }, [paginatedRequests]);

  const allPendingSelectedOnPage =
    pendingPaginatedIds.length > 0 && pendingPaginatedIds.every((id) => selectedRequestIds.has(id));

  const toggleSelectAllPendingOnPage = () => {
    setSelectedRequestIds((prev) => {
      const next = new Set(prev);
      if (allPendingSelectedOnPage) {
        pendingPaginatedIds.forEach((id) => next.delete(id));
      } else {
        pendingPaginatedIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectRow = (id: string) => {
    setSelectedRequestIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Helper: Detect if HoD submitted request for themselves
  const isHodSelfRequest = (req: CoordinatorRequest) => {
    const isSameId = Boolean(req.submitted_by_id && req.teacher_id && req.submitted_by_id === req.teacher_id);
    const isHodRole = req.teacher?.role === 'HOD';
    return isSameId || (isHodRole && req.submitted_by_id === req.teacher_id);
  };

  // Helper: Extract Clean Rejection Note
  const extractRejectionNote = (notes?: string | null) => {
    if (!notes) return null;
    const match = notes.match(/\[Rejected by Coordinator:\s*([^\]]+)\]/i);
    return match ? match[1].trim() : notes;
  };

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
      `Active payroll cycle updated: ${res.data?.cycle_name || 'Active Cycle'}${
        updated.is_locked ? ' • SYSTEM LOCKED' : ''
      }`
    );
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      {/* Navigation Sidebar */}
      <Sidebar
        activeItem="coordinator"
        activeRole="COORDINATOR"
        onOpenCurrencySettings={canViewCurrency ? () => setIsCurrencyModalOpen(true) : undefined}
        onOpenCycleSettings={canManageCycles ? () => setIsCycleModalOpen(true) : undefined}
      />

      {/* Main Container Offset by Sidebar */}
      <div className="pl-72">
        {/* Top Header */}
        <Header
          breadcrumbCategory="TIU Academic Affairs"
          breadcrumbPage="Approval Engine"
          activeViewLabel="Academic Coordinator"
          customPermissions={userPerms}
        />

        {/* Page Content */}
        <main className={`w-full ${session.isSimulating ? 'pt-28' : 'pt-20'} pb-16 px-8`}>
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Block & Primary Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="font-headline text-2xl sm:text-3xl font-bold text-[#0b1c30] tracking-tight">
                    Academic Coordinator Approval Hub
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                    Sole Approval Authority
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
                  Central institutional review queue. Inspect and approve or reject extra hours claims submitted by Heads of Department across all university divisions.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {canViewCurrency && systemSettings && (
                  <button
                    type="button"
                    onClick={() => setIsCurrencyModalOpen(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 transition-all shadow-2xs cursor-pointer group"
                  >
                    <Coins className="w-4 h-4 text-emerald-600 transition-transform group-hover:scale-110" />
                    <span>Rate: {(systemSettings.exchange_rate / 100).toLocaleString()} IQD</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Reload incoming requests queue"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh Queue</span>
                </button>
              </div>
            </div>

            {/* KPI Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: PENDING REVIEW */}
              <div className="p-5 rounded-2xl bg-white border border-amber-200/70 shadow-xs flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-amber-900/70">
                    PENDING REVIEW
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-headline text-2xl sm:text-3xl font-extrabold text-[#0b1c30]">
                      {counts.pending}
                    </span>
                    <span className="text-xs font-semibold text-amber-700 font-mono">
                      ({counts.pendingHours.toFixed(1)} hrs)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 block">Awaiting Coordinator decision</span>
                </div>
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
              </div>

              {/* Card 2: APPROVED REQUESTS */}
              <div className="p-5 rounded-2xl bg-white border border-emerald-200/70 shadow-xs flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-900/70">
                    APPROVED CLAIMS
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-headline text-2xl sm:text-3xl font-extrabold text-[#0b1c30]">
                      {counts.approved}
                    </span>
                    <span className="text-xs font-semibold text-emerald-700 font-mono">
                      ({counts.approvedHours.toFixed(1)} hrs)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 block">Passed to Finance for payroll</span>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              {/* Card 3: REJECTED CLAIMS */}
              <div className="p-5 rounded-2xl bg-white border border-rose-200/70 shadow-xs flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-rose-900/70">
                    REJECTED CLAIMS
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-headline text-2xl sm:text-3xl font-extrabold text-[#0b1c30]">
                      {counts.rejected}
                    </span>
                    <span className="text-xs text-rose-700 font-medium">declined</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block">Returned with rejection notes</span>
                </div>
                <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                  <XCircle className="w-5 h-5" />
                </div>
              </div>

              {/* Card 4: TOTAL IN QUEUE */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200/70 shadow-xs flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                    TOTAL SUBMISSIONS
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-headline text-2xl sm:text-3xl font-extrabold text-[#0b1c30]">
                      {counts.all}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">total items</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block">Across all academic faculties</span>
                </div>
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Filter Tabs, Search & Department Dropdown */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Filter Tabs */}
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 text-xs font-semibold shrink-0 flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('PENDING');
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === 'PENDING'
                      ? 'bg-[#540225] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Pending Review</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono ${
                      activeTab === 'PENDING'
                        ? 'bg-amber-400 text-slate-900'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {counts.pending}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('APPROVED');
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === 'APPROVED'
                      ? 'bg-[#540225] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Approved</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono ${
                      activeTab === 'APPROVED'
                        ? 'bg-emerald-400 text-slate-900'
                        : 'bg-emerald-100 text-emerald-900'
                    }`}
                  >
                    {counts.approved}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('REJECTED');
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === 'REJECTED'
                      ? 'bg-[#540225] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Rejected</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono ${
                      activeTab === 'REJECTED'
                        ? 'bg-rose-400 text-white'
                        : 'bg-rose-100 text-rose-900'
                    }`}
                  >
                    {counts.rejected}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('ALL');
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === 'ALL'
                      ? 'bg-[#540225] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>All Requests</span>
                  <span className="text-[10px] opacity-70">({counts.all})</span>
                </button>
              </div>

              {/* Department Dropdown & Search Input */}
              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap w-full lg:w-auto">
                {/* Department Filter Dropdown */}
                <div className="relative w-full sm:w-56 shrink-0">
                  <select
                    value={selectedDeptId}
                    onChange={(e) => {
                      setSelectedDeptId(e.target.value);
                      setCurrentPage(1);
                    }}
                    aria-label="Filter requests by academic department"
                    className="w-full h-9 pl-3 pr-8 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white transition-all cursor-pointer truncate"
                  >
                    <option value="ALL">All Departments ({departments.length})</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search faculty, HoD, course..."
                    className="w-full h-9 pl-8 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Batch Action Bar (Visible when items selected) */}
            {selectedRequestIds.size > 0 && (
              <div className="p-3.5 px-5 rounded-2xl bg-[#0b1c30] text-white flex items-center justify-between gap-4 shadow-xl border border-slate-700 animate-in slide-in-from-top-3 duration-200">
                <div className="flex items-center gap-3 text-xs">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-extrabold flex items-center justify-center text-xs">
                    {selectedRequestIds.size}
                  </span>
                  <span className="font-medium text-slate-200">
                    pending request{selectedRequestIds.size === 1 ? '' : 's'} selected for bulk processing
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRequestIds(new Set())}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(Array.from(selectedRequestIds))}
                    disabled={batchLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCheck className={`w-3.5 h-3.5 ${batchLoading ? 'animate-spin' : ''}`} />
                    <span>Batch Approve ({selectedRequestIds.size})</span>
                  </button>
                </div>
              </div>
            )}

            {/* Main Review Table */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#eff4ff]/50 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                      {/* Checkbox Column for Pending Items */}
                      <th className="py-3 px-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={allPendingSelectedOnPage}
                          onChange={toggleSelectAllPendingOnPage}
                          disabled={pendingPaginatedIds.length === 0}
                          aria-label="Select all pending requests on this page"
                          className="w-4 h-4 rounded border-slate-300 text-[#540225] focus:ring-[#721c3b]/30 cursor-pointer disabled:opacity-30"
                        />
                      </th>
                      <th className="py-3 px-5">FACULTY BENEFICIARY</th>
                      <th className="py-3 px-5">DEPARTMENT</th>
                      <th className="py-3 px-5">SUBMITTED BY (HOD)</th>
                      <th className="py-3 px-5">COURSE &amp; DELIVERABLE</th>
                      <th className="py-3 px-4">HOURS</th>
                      <th className="py-3 px-5">DATE</th>
                      <th className="py-3 px-5 text-right">ACTIONS / STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <RefreshCw className="w-6 h-6 animate-spin text-[#721c3b]" />
                            <span className="font-medium text-xs">Loading requests queue...</span>
                          </div>
                        </td>
                      </tr>
                    ) : paginatedRequests.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-1.5 max-w-sm mx-auto">
                            <FileText className="w-8 h-8 text-slate-300" />
                            <h4 className="font-bold text-slate-700 text-sm">No requests found</h4>
                            <p className="text-xs text-slate-400">
                              {searchQuery || selectedDeptId !== 'ALL'
                                ? 'No requests match the active filter criteria. Try clearing search or switching departments.'
                                : activeTab === 'PENDING'
                                ? 'No pending requests in queue! All submitted extra hours claims have been processed.'
                                : 'No records exist under this status category.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedRequests.map((req) => {
                        const isSelf = isHodSelfRequest(req);
                        const isSelected = selectedRequestIds.has(req.id);
                        const isPending = req.status === 'PENDING';
                        const isActing = actionLoadingId === req.id;
                        const rejectionNote = extractRejectionNote(req.notes);

                        return (
                          <tr
                            key={req.id}
                            className={`transition-colors ${
                              isSelf
                                ? 'bg-purple-50/30 hover:bg-purple-50/60'
                                : isSelected
                                ? 'bg-amber-50/40 hover:bg-amber-50/60'
                                : 'hover:bg-[#f8f9ff]'
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-4 px-4 text-center">
                              {isPending ? (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectRow(req.id)}
                                  aria-label={`Select request for ${req.teacher?.name || 'Faculty Member'}`}
                                  className="w-4 h-4 rounded border-slate-300 text-[#540225] focus:ring-[#721c3b]/30 cursor-pointer"
                                />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
                              )}
                            </td>

                            {/* Faculty Beneficiary */}
                            <td className="py-4 px-5">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-[#0b1c30] text-sm">
                                    {req.teacher?.name || 'Faculty Member'}
                                  </span>
                                  {isSelf && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 text-[10px] font-extrabold border border-purple-200 tracking-tight">
                                      HoD Self-Submission
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                                  <span>{req.teacher?.academic_title || 'Lecturer'}</span>
                                  <span>•</span>
                                  <span className="font-mono text-[10px] uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                    {req.teacher?.role || 'TEACHER'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Department */}
                            <td className="py-4 px-5 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                                {req.department || req.teacher?.department?.name || 'Academic Department'}
                              </span>
                            </td>

                            {/* Submitted By (HoD) */}
                            <td className="py-4 px-5 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold flex items-center justify-center border border-amber-200">
                                  {(req.submitted_by?.name || 'HD')
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-medium text-slate-800">
                                    {req.submitted_by?.name || 'Head of Department'}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    HoD Submitter
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Course & Deliverable */}
                            <td className="py-4 px-5 max-w-[220px]">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                                    {req.course_code || 'GEN'}
                                  </span>
                                  <span className="font-semibold text-slate-800 truncate" title={req.notes || ''}>
                                    {req.notes || req.session_type || 'Instructional Extra Session'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {req.session_type || 'Instructional Deliverable'}
                                </div>
                              </div>
                            </td>

                            {/* Hours Breakdown */}
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span className="font-extrabold text-[#721c3b] text-sm">
                                {Number(req.hours).toFixed(1)} hrs
                              </span>
                            </td>

                            {/* Date */}
                            <td className="py-4 px-5 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-800">{req.date}</span>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(req.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                </span>
                              </div>
                            </td>

                            {/* Actions / Status */}
                            <td className="py-4 px-5 text-right whitespace-nowrap">
                              {isPending ? (
                                <div className="flex items-center justify-end gap-2">
                                  {/* Accept Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleApprove([req.id])}
                                    disabled={isActing}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs hover:shadow active:scale-95 cursor-pointer disabled:opacity-50"
                                    title="Accept and approve extra hours claim"
                                  >
                                    <CheckCircle2 className={`w-3.5 h-3.5 ${isActing ? 'animate-spin' : ''}`} />
                                    <span>Accept</span>
                                  </button>

                                  {/* Reject Button */}
                                  <button
                                    type="button"
                                    onClick={() => openRejectionModal(req)}
                                    disabled={isActing}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200 transition-all shadow-2xs hover:border-rose-300 active:scale-95 cursor-pointer disabled:opacity-50"
                                    title="Reject request with optional reason"
                                  >
                                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Reject</span>
                                  </button>
                                </div>
                              ) : req.status === 'APPROVED' ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Approved
                                  </span>
                                  {req.approved_at && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {new Date(req.approved_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: '2-digit',
                                      })}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-col items-end gap-1">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 text-[11px] font-bold border border-rose-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    Rejected
                                  </span>
                                  {rejectionNote && (
                                    <span
                                      className="text-[10px] text-rose-700 max-w-[140px] truncate block text-right font-medium"
                                      title={rejectionNote}
                                    >
                                      {rejectionNote}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination Bar */}
              <div className="p-4 px-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div>
                  Showing{' '}
                  <span className="font-semibold text-slate-800">
                    {filteredRequests.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-slate-800">
                    {Math.min(currentPage * pageSize, filteredRequests.length)}
                  </span>{' '}
                  of <span className="font-semibold text-slate-800">{filteredRequests.length}</span> requests
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Previous
                  </button>

                  <span className="font-semibold text-slate-800 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 text-xs">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Rejection Confirmation Modal */}
      {rejectionModal.isOpen && rejectionModal.request && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-100">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-headline font-bold text-lg text-[#0b1c30]">
                    Reject Extra Hours Claim
                  </h3>
                  <p className="text-xs text-slate-500">
                    Institutional decision by Academic Coordinator
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setRejectionModal({ isOpen: false, request: null, reason: '', submitting: false })
                }
                className="text-slate-400 hover:text-slate-600 text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Request Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Faculty Beneficiary:</span>
                <span className="font-bold text-[#0b1c30]">
                  {rejectionModal.request.teacher?.name || 'Faculty Member'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Department:</span>
                <span className="font-semibold text-slate-800">
                  {rejectionModal.request.department || rejectionModal.request.teacher?.department?.name || 'Academic Division'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Submitted By (HoD):</span>
                <span className="font-semibold text-slate-800">
                  {rejectionModal.request.submitted_by?.name || 'Head of Department'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Claim Details:</span>
                <span className="font-mono font-bold text-[#721c3b]">
                  {rejectionModal.request.hours} hrs • {rejectionModal.request.course_code || 'GEN'}
                </span>
              </div>
            </div>

            {/* Rejection Reason Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Rejection Reason (Optional Note)
              </label>
              <textarea
                value={rejectionModal.reason}
                onChange={(e) =>
                  setRejectionModal((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="Enter justification or feedback for the HoD and faculty member (e.g., Exceeds approved institutional hours quota)..."
                rows={3}
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:bg-white transition-all resize-none"
              />
              <span className="text-[11px] text-slate-400 block">
                This note will be visible to the teacher and their Head of Department.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  setRejectionModal({ isOpen: false, request: null, reason: '', submitting: false })
                }
                disabled={rejectionModal.submitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRejection}
                disabled={rejectionModal.submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {rejectionModal.submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Currency Settings Modal */}
      {canViewCurrency && systemSettings && (
        <CurrencySettingsModal
          isOpen={isCurrencyModalOpen}
          onClose={() => setIsCurrencyModalOpen(false)}
          exchangeRate={systemSettings.exchange_rate || 150000}
          onSave={async (newRate) => {
            const ok = await updateSystemSettings({ exchange_rate: newRate });
            if (ok) {
              setSystemSettings((prev) => (prev ? { ...prev, exchange_rate: newRate } : null));
              showToast(
                'Currency Updated',
                `System exchange rate updated to ${(newRate / 100).toLocaleString()} IQD / $1.`
              );
              loadData();
            }
          }}
          financeCanEditExchange={canEditCurrency}
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

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 border border-slate-800 animate-in slide-in-from-bottom-5 duration-300">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : toastMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          )}
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
