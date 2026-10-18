'use client';

import React from 'react';
import {
  X,
  Calendar,
  Clock,
  BookOpen,
  FileText,
  CheckCircle2,
  XCircle,
  CheckCheck,
  Check,
  Trash2,
  Edit2,
  ShieldCheck,
  Building2,
  Mail,
  GraduationCap,
} from 'lucide-react';
import { Timesheet } from '@/types/database';

interface TimesheetDetailsModalProps {
  timesheet: Timesheet | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (timesheet: Timesheet) => void;
  onDelete?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function TimesheetDetailsModal({
  timesheet,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onApprove,
  onReject,
}: TimesheetDetailsModalProps) {
  if (!isOpen || !timesheet) return null;

  const teacher = timesheet.teacher;
  const initials = teacher?.name
    ? teacher.name.split(' ').map((n) => n[0]).join('').slice(0, 2)
    : 'TC';

  const isPending = timesheet.status === 'PENDING' || timesheet.status === 'PENDING_HOD_APPROVAL';
  const isPaid = timesheet.status === 'PAID';

  const getCourseBadgeColor = (code?: string | null) => {
    const c = (code || '').toUpperCase();
    if (c.includes('CS301') || c.includes('CS')) return 'bg-rose-50 text-[#721c3b] border-rose-200';
    if (c.includes('IT204') || c.includes('IT')) return 'bg-amber-50 text-amber-900 border-amber-200';
    if (c.includes('FYP')) return 'bg-blue-50 text-blue-900 border-blue-200';
    return 'bg-purple-50 text-purple-900 border-purple-200';
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_HOD_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-950 text-xs font-bold border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Teacher Request (Awaiting HoD Sign-Off)
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 text-xs font-bold border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Pending Department Endorsement
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            HoD Approved &amp; Endorsed
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-800 text-xs font-bold border border-rose-200">
            <XCircle className="w-4 h-4 text-rose-600" />
            Rejected by HoD
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 text-xs font-bold border border-indigo-200">
            <CheckCheck className="w-4 h-4 text-indigo-600" />
            Paid / Finalized by Finance
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
            {status}
          </span>
        );
    }
  };

  const formattedDate = new Date(timesheet.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden text-left flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-pink-50/40 via-white to-slate-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-50 text-[#540225] flex items-center justify-center border border-pink-100 shrink-0">
              <FileText className="w-5 h-5 text-[#721c3b]" />
            </div>
            <div>
              <h2 className="font-headline text-lg font-bold text-[#0b1c30]">
                Timesheet Request Details
              </h2>
              <p className="text-xs text-slate-500">
                Department extra hours log submission record &amp; audit history
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Teacher Profile Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3.5">
            {teacher?.avatar_url ? (
              <img
                src={teacher.avatar_url}
                alt={teacher.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-xs shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm ring-2 ring-white shadow-xs shrink-0">
                {initials}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm text-[#0b1c30] truncate">
                  {teacher?.name || 'Department Faculty'}
                </h3>
                <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {teacher?.academic_title || 'Faculty Member'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {teacher?.email || 'faculty@tiu.edu.iq'}
                </span>
                {teacher?.department && (
                  <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {teacher.department.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            {/* Status */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-2xs space-y-1 sm:col-span-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                Approval Status
              </span>
              <div>{renderStatusBadge(timesheet.status)}</div>
            </div>

            {/* Date */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-2xs space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Date Completed
              </span>
              <p className="font-semibold text-slate-900 text-xs sm:text-sm">
                {formattedDate}
              </p>
            </div>

            {/* Hours Claimed */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-2xs space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Claimed Duration
              </span>
              <p className="font-headline font-bold text-xl text-[#721c3b]">
                {Number(timesheet.hours).toFixed(1)}{' '}
                <span className="text-xs text-slate-500 font-normal">hours</span>
              </p>
            </div>

            {/* Course Code */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-2xs space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                Course Code
              </span>
              <div>
                <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold border font-mono ${getCourseBadgeColor(timesheet.course_code)}`}>
                  {timesheet.course_code || 'GEN'}
                </span>
              </div>
            </div>

            {/* Session Type */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-2xs space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                Session Type
              </span>
              <p className="font-semibold text-slate-800 text-xs">
                {timesheet.session_type || 'Instructional Lab Session'}
              </p>
            </div>
          </div>

          {/* Activity Description & Notes */}
          <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-2xs space-y-1.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              Activity Description &amp; Notes
            </span>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
              {timesheet.notes || timesheet.course_activity || 'No additional notes provided for this instructional session.'}
            </p>
          </div>

          {/* Audit Record Information */}
          <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-400">Record ID:</span>
              <span className="font-mono text-slate-600">{timesheet.id}</span>
            </div>
            {timesheet.approved_at && (
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-400">Approved At:</span>
                <span className="text-slate-600 font-medium">
                  {new Date(timesheet.approved_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isPending && onApprove && (
              <button
                type="button"
                onClick={() => {
                  onApprove(timesheet.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Approve Request</span>
              </button>
            )}

            {isPending && onReject && (
              <button
                type="button"
                onClick={() => {
                  onReject(timesheet.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Reject Request</span>
              </button>
            )}

            {!isPaid && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(timesheet);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-all cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit</span>
              </button>
            )}

            {!isPaid && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(timesheet.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-semibold transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                <span>Delete</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
