'use client';

import React, { useState } from 'react';
import { X, Clock, Calendar, CheckCircle2, FileText, MoreHorizontal, Edit2, Trash2 } from 'lucide-react';
import { PayrollFacultyRow } from '@/types/payroll';
import { formatDateTime } from '@/lib/services/payrollService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TeacherLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  facultyRow: PayrollFacultyRow | null;
  currency?: 'USD' | 'IQD';
  exchangeRate?: number;
}

export function TeacherLogsModal({
  isOpen,
  onClose,
  facultyRow,
  currency = 'USD',
  exchangeRate = 150000,
}: TeacherLogsModalProps) {
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  if (!isOpen || !facultyRow) return null;

  const entries = facultyRow.timesheetEntries || [];
  const totalHours = entries.reduce((acc, e) => acc + Number(e.hours || 0), 0) || facultyRow.billedHours;
  const totalGross = totalHours * facultyRow.approvedRate;

  const fmtRate = (amount: number, isGross = false) => {
    if (currency === 'IQD') {
      const converted = amount * (exchangeRate / 100);
      return `IQD ${converted.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `$${isGross ? amount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : amount.toFixed(2)}`;
  };

  const handleDeleteConfirm = (id: string) => {
    // Implement delete logic here, e.g., calling an API
    console.log(`Deleted log ${id}`);
    setDeleteConfirmationId(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden text-left flex flex-col max-h-[90vh]">
          {/* Modal Header */}
          <div className="p-6 px-8 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#540225] text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                {facultyRow.avatarInitials}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-headline font-bold text-lg text-[#0b1c30]">
                    {facultyRow.name}
                  </h2>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    {facultyRow.contractType}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {facultyRow.departmentName || 'Department of Computer Engineering'} • Rate:{' '}
                  <strong className="text-slate-800 font-semibold">
                    {fmtRate(facultyRow.approvedRate)} / hr
                  </strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Summary Banner */}
          <div className="px-8 py-3 bg-amber-50/70 border-b border-amber-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-amber-900 font-medium">
              <FileText className="w-4 h-4 text-amber-700" />
              <span>Itemized timesheet sessions for current disbursal cycle</span>
            </div>

            <div className="flex items-center gap-4 font-semibold">
              <span className="text-slate-600">
                Total Duration:{' '}
                <strong className="text-slate-900 font-bold">{totalHours.toFixed(1)} hrs</strong>
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-600">
                Calculated Payout:{' '}
                <strong className="text-[#540225] font-extrabold text-sm">
                  {fmtRate(totalGross, true)}
                </strong>
              </span>
            </div>
          </div>

          {/* Table Content */}
          <div className="p-6 px-8 overflow-y-auto flex-1">
            {entries.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-medium">No individual timesheet logs found for this teacher.</p>
              </div>
            ) : (
              <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4">Activity Description</th>
                      <th className="py-3 px-4">Submitted By (HoD)</th>
                      <th className="py-3 px-4">Coordinator Approval</th>
                      <th className="py-3 px-4 text-right">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entries.map((entry) => {
                      const formattedDate = new Date(entry.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });

                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Date */}
                          <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                            {formattedDate}
                          </td>

                          {/* Duration */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-bold text-[#540225] bg-[#540225]/5 px-2 py-0.5 rounded-md border border-[#540225]/10">
                              <Clock className="w-3 h-3 text-[#540225]" />
                              {Number(entry.hours).toFixed(1)} hrs
                            </span>
                          </td>

                          {/* Activity Description */}
                          <td className="py-3 px-4 text-slate-700 max-w-[280px]">
                            <div className="font-medium text-slate-900 leading-snug">
                              {entry.activityDescription}
                            </div>
                            {entry.courseCode && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                Code: {entry.courseCode}
                              </span>
                            )}
                            {entry.notes && entry.notes !== entry.activityDescription && (
                              <div className="text-[11px] text-slate-400 italic mt-0.5 truncate">
                                {entry.notes}
                              </div>
                            )}
                          </td>

                          {/* Submitter */}
                          <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                            <div className="font-semibold text-slate-800 text-[11px]">
                              {entry.submittedByName || facultyRow.submittedByName || 'Head of Department'}
                            </div>
                            <div className="text-[10px] text-slate-400">HoD Submitter</div>
                          </td>

                          {/* Coordinator Approval Date */}
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Coordinator: {formatDateTime(entry.approvedAt)}</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {entry.status === 'PAID' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                PAID
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ffdea8] text-[#271900] text-[10px] font-bold border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#7c5800]" />
                                APPROVED
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 bg-white border border-slate-200 shadow-xl rounded-xl p-1">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Placeholder for Edit action
                                  }}
                                  className="text-slate-700 focus:bg-slate-50 text-xs py-2 px-3 rounded-md cursor-pointer flex items-center"
                                >
                                  <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit Log
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmationId(entry.id);
                                  }}
                                  className="text-red-600 focus:text-red-700 focus:bg-red-50 text-xs py-2 px-3 rounded-md cursor-pointer flex items-center"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Log
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 px-8 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 text-xs">
            <span className="text-slate-500">
              {entries.length} log {entries.length === 1 ? 'entry' : 'entries'} verified for disbursal
            </span>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              Close Details
            </button>
          </div>
        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmationId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 overflow-hidden text-center p-6">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 mx-auto mb-4 border border-red-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-headline font-bold text-xl text-slate-900 mb-2">Delete Log?</h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete this timesheet log? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setDeleteConfirmationId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConfirm(deleteConfirmationId)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors shadow-md cursor-pointer"
              >
                Delete Log
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
