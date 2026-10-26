'use client';

import React, { useState, useMemo } from 'react';
import { Timesheet } from '@/types/database';
import {
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  CheckCheck,
  MoreVertical,
  Eye,
  Clock,
  Building2,
  Send,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { TimesheetDetailsModal } from './TimesheetDetailsModal';

interface HodTimesheetTableProps {
  timesheets: Timesheet[];
  onEdit: (timesheet: Timesheet) => void;
  onDelete: (id: string) => void;
}

export function HodTimesheetTable({
  timesheets,
  onEdit,
  onDelete,
}: HodTimesheetTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [selectedForDetails, setSelectedForDetails] = useState<Timesheet | null>(null);

  // Filter and sort timesheets (newest on top)
  const filtered = useMemo(() => {
    const list = timesheets.filter((ts) => {
      // Status filter
      if (statusFilter === 'PENDING') {
        if (ts.status !== 'PENDING' && ts.status !== 'PENDING_HOD_APPROVAL') return false;
      } else if (statusFilter === 'APPROVED') {
        if (ts.status !== 'APPROVED' && ts.status !== 'PAID') {
          return false;
        }
      } else if (statusFilter === 'REJECTED') {
        if (ts.status !== 'REJECTED') {
          return false;
        }
      }

      // Search query
      if (search) {
        const q = search.toLowerCase();
        const teacherName = ts.teacher?.name?.toLowerCase() || '';
        const email = ts.teacher?.email?.toLowerCase() || '';
        const course = ts.course_code?.toLowerCase() || '';
        const notes = ts.notes?.toLowerCase() || '';
        const sessionType = ts.session_type?.toLowerCase() || '';
        const dept = ts.department?.toLowerCase() || '';

        return (
          teacherName.includes(q) ||
          email.includes(q) ||
          course.includes(q) ||
          notes.includes(q) ||
          sessionType.includes(q) ||
          dept.includes(q)
        );
      }

      return true;
    });

    return [...list].sort((a, b) => {
      const timeA = new Date(a.created_at || a.date).getTime();
      const timeB = new Date(b.created_at || b.date).getTime();
      return timeB - timeA; // Descending: newest on top
    });
  }, [timesheets, search, statusFilter]);

  // Counts
  const counts = useMemo(() => {
    const pending = timesheets.filter(
      (t) => t.status === 'PENDING' || t.status === 'PENDING_HOD_APPROVAL'
    ).length;
    const approved = timesheets.filter(
      (t) => t.status === 'APPROVED' || t.status === 'PAID'
    ).length;
    const rejected = timesheets.filter(
      (t) => t.status === 'REJECTED'
    ).length;

    return {
      all: timesheets.length,
      pending,
      approved,
      rejected,
    };
  }, [timesheets]);

  // Helper for status badge
  const renderStatusBadge = (status: string, notes?: string | null) => {
    switch (status) {
      case 'PENDING':
      case 'PENDING_HOD_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 text-[11px] font-bold border border-amber-300 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending Coordinator Review
          </span>
        );
      case 'APPROVED':
      case 'APPROVED_BY_HOD':
      case 'APPROVED_BY_COORDINATOR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Approved by Coordinator
          </span>
        );
      case 'REJECTED':
      case 'REJECTED_BY_HOD':
      case 'REJECTED_BY_COORDINATOR':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 text-[11px] font-bold border border-rose-200 shadow-2xs group relative cursor-help"
            title={notes || 'Request rejected by Academic Coordinator.'}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Rejected by Coordinator</span>
            {notes && <HelpCircle className="w-3 h-3 text-rose-400" />}
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 text-[11px] font-bold border border-indigo-200">
            <CheckCheck className="w-3.5 h-3.5 text-indigo-600" />
            Paid / Finalized
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px]">
            {status}
          </span>
        );
    }
  };

  // Helper for Course Tag color
  const getCourseBadgeColor = (code?: string | null) => {
    const c = (code || '').toUpperCase();
    if (c.includes('CS301') || c.includes('CS')) return 'bg-rose-50 text-[#721c3b] border-rose-200';
    if (c.includes('IT204') || c.includes('IT')) return 'bg-amber-50 text-amber-900 border-amber-200';
    if (c.includes('PHAR')) return 'bg-emerald-50 text-emerald-900 border-emerald-200';
    if (c.includes('DENT')) return 'bg-cyan-50 text-cyan-900 border-cyan-200';
    if (c.includes('FYP')) return 'bg-blue-50 text-blue-900 border-blue-200';
    return 'bg-purple-50 text-purple-900 border-purple-200';
  };

  return (
    <div className="space-y-4">
      {/* Table Top Filtration Bar */}
      <div className="p-4 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search faculty name, course code, department..."
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white transition-all"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-[#540225] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Submissions ({counts.all})
          </button>

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

      {/* Outbox Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-[#540225]" />
            <h3 className="font-headline font-bold text-sm text-[#0b1c30]">
              Submitted Requests Tracking (Outbox)
            </h3>
          </div>

          <span className="text-xs text-slate-400 font-medium">
            Reviewed by Academic Coordinator
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#eff4ff]/60 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3 px-6">Faculty Member</th>
                <th className="py-3 px-4">Course &amp; Code</th>
                <th className="py-3 px-4">Hours Breakdown</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Submission Date</th>
                <th className="py-3 px-4">Coordinator Status</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No submitted request records found for this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((ts) => {
                  const teacher = ts.teacher;
                  const isPaid = ts.status === 'PAID';
                  const isPending = ts.status === 'PENDING' || ts.status === 'PENDING_HOD_APPROVAL';
                  const initials = teacher?.name
                    ? teacher.name.split(' ').map((n) => n[0]).join('').slice(0, 2)
                    : 'FA';

                  return (
                    <tr key={ts.id} className="hover:bg-[#f8f9ff] transition-colors group">
                      {/* Faculty Avatar & Details */}
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          {teacher?.avatar_url ? (
                            <img
                              src={teacher.avatar_url}
                              alt={teacher.name}
                              className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs ring-2 ring-blue-50 shrink-0">
                              {initials}
                            </div>
                          )}

                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-[#0b1c30] group-hover:text-[#540225] transition-colors truncate">
                              {teacher?.name || 'Faculty Member'}
                            </span>
                            <span className="text-[11px] text-slate-500 truncate">
                              {teacher?.academic_title || teacher?.role || 'Lecturer'} • {teacher?.email || 'faculty@tiu.edu.iq'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Course & Code */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${getCourseBadgeColor(
                                ts.course_code
                              )}`}
                            >
                              {ts.course_code || 'GEN'}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium truncate">
                              {ts.session_type || 'Instructional Extra Session'}
                            </span>
                          </div>
                          <p className="text-slate-700 leading-snug line-clamp-1">
                            {ts.notes || ts.course_activity || 'Extra teaching session'}
                          </p>
                        </div>
                      </td>

                      {/* Hours Breakdown */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-block px-2.5 py-0.5 rounded-md bg-pink-50 text-[#540225] border border-pink-200 font-headline font-extrabold text-xs">
                            {Number(ts.hours).toFixed(1)} hrs total
                          </span>
                          {ts.session_type && ts.session_type.includes('Theoretical') && (
                            <span className="text-[10px] text-slate-400">
                              {ts.session_type}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-medium text-[11px]">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {ts.department || teacher?.department?.name || 'Department'}
                        </span>
                      </td>

                      {/* Submission Date */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800">
                            {new Date(ts.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: '2-digit',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(ts.date).toLocaleDateString('en-US', { weekday: 'short' })}
                          </span>
                        </div>
                      </td>

                      {/* Coordinator Status */}
                      <td className="py-3.5 px-4">{renderStatusBadge(ts.status, ts.notes)}</td>

                      {/* Actions */}
                      <td className="py-3.5 px-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer outline-none"
                              title="Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedForDetails(ts);
                              }}
                              className="gap-2 cursor-pointer font-medium text-xs text-slate-700"
                            >
                              <Eye className="w-4 h-4 text-slate-500" /> View Details
                            </DropdownMenuItem>

                            {isPending && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit(ts);
                                }}
                                disabled={isPaid}
                                className="gap-2 cursor-pointer font-medium text-xs text-slate-700 disabled:opacity-40"
                              >
                                <Edit2 className="w-4 h-4 text-slate-500" /> Edit Request
                              </DropdownMenuItem>
                            )}

                            {isPending && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(ts.id);
                                }}
                                disabled={isPaid}
                                className="gap-2 cursor-pointer font-medium text-xs text-rose-600 focus:text-rose-700 focus:bg-rose-50 disabled:opacity-40"
                              >
                                <Trash2 className="w-4 h-4 text-rose-500" /> Delete Request
                              </DropdownMenuItem>
                            )}
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

      {/* Timesheet Details Modal */}
      <TimesheetDetailsModal
        isOpen={!!selectedForDetails}
        timesheet={selectedForDetails}
        onClose={() => setSelectedForDetails(null)}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}
