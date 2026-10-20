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
  Trash2,
  Edit2,
  Building2,
  Mail,
  GraduationCap,
  Send,
  UserCheck,
} from 'lucide-react';
import { Timesheet } from '@/types/database';

interface TimesheetDetailsModalProps {
  timesheet: Timesheet | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (timesheet: Timesheet) => void;
  onDelete?: (id: string) => void;
}

export function TimesheetDetailsModal({
  timesheet,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: TimesheetDetailsModalProps) {
  if (!isOpen || !timesheet) return null;

  const teacher = timesheet.teacher;
  const submitter = timesheet.submitted_by;
  const initials = teacher?.name
    ? teacher.name.split(' ').map((n) => n[0]).join('').slice(0, 2)
    : 'FA';

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
      case 'PENDING':
      case 'PENDING_HOD_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 text-xs font-bold border border-amber-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Pending Coordinator Review
          </span>
        );
      case 'APPROVED':
      case 'APPROVED_BY_HOD':
      case 'APPROVED_BY_COORDINATOR':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Approved by Coordinator
          </span>
        );
      case 'REJECTED':
      case 'REJECTED_BY_HOD':
      case 'REJECTED_BY_COORDINATOR':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-800 text-xs font-bold border border-rose-200 shadow-2xs">
            <XCircle className="w-4 h-4 text-rose-600" />
            Rejected by Coordinator
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden text-left flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-slate-50 via-white to-pink-50/20">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#540225]" />
              <h2 className="font-headline text-lg font-bold text-[#0b1c30]">
                Extra Hours Request Details
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Submitted to Academic Coordinator for institutional endorsement.
            </p>
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
          {/* Status & Hours Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Coordinator Review Status
              </span>
              <div>{renderStatusBadge(timesheet.status)}</div>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Extra Hours
              </span>
              <span className="font-headline text-2xl font-bold text-[#540225] font-mono">
                {Number(timesheet.hours).toFixed(1)} hrs
              </span>
            </div>
          </div>

          {/* Submitter & Beneficiary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Faculty Beneficiary */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                Faculty Member
              </span>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#0b1c30] truncate">
                    {teacher?.name || 'Department Faculty'}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {teacher?.email || 'faculty@tiu.edu.iq'}
                  </div>
                </div>
              </div>
            </div>

            {/* Submitter HoD */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Send className="w-3.5 h-3.5 text-[#540225]" />
                Submitted By (HoD)
              </span>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-pink-100 text-[#540225] flex items-center justify-center font-bold text-xs shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#0b1c30] truncate">
                    {submitter?.name || 'Head of Department'}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {submitter?.email || 'hod@tiu.edu.iq'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Course & Date Information */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                Course &amp; Session Type
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${getCourseBadgeColor(
                  timesheet.course_code
                )}`}
              >
                {timesheet.course_code || 'GEN'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-0.5">
                <span className="text-slate-400 font-medium">Session Type:</span>
                <p className="font-semibold text-slate-800">
                  {timesheet.session_type || 'Instructional Extra Session'}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-slate-400 font-medium">Date Completed:</span>
                <p className="font-semibold text-slate-800">
                  {new Date(timesheet.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>

              {timesheet.department && (
                <div className="space-y-0.5 col-span-2">
                  <span className="text-slate-400 font-medium">Department:</span>
                  <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {timesheet.department}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notes & Activity Description */}
          <div className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Activity Details &amp; Notes
            </span>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed">
              {timesheet.notes || timesheet.course_activity || 'No additional notes provided.'}
            </div>
          </div>

          {/* Audit Timestamp */}
          <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
            <span>Submitted: {timesheet.created_at ? new Date(timesheet.created_at).toLocaleString() : 'N/A'}</span>
            <span className="font-mono text-[10px]">ID: {timesheet.id.slice(0, 8)}...</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isPending && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(timesheet);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit Request</span>
              </button>
            )}

            {isPending && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(timesheet.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Delete</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
