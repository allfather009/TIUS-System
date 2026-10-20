'use client';

import React from 'react';
import { Clock, AlertCircle, CheckCircle2, Send, Users, XCircle } from 'lucide-react';

interface HodMetricCardsProps {
  totalHours: number;
  activeTeachersCount?: number;
  pendingCount: number;
  approvedCount?: number;
  rejectedCount?: number;
}

export function HodMetricCards({
  totalHours,
  activeTeachersCount = 0,
  pendingCount,
  approvedCount = 0,
  rejectedCount = 0,
}: HodMetricCardsProps) {
  const hasPending = pendingCount > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Metric 1: Total Extra Hours Submitted */}
      <div className="p-5 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col justify-between space-y-3 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              Total Hours Logged
            </span>
            <div className="font-headline text-2xl sm:text-3xl font-bold text-[#0b1c30] leading-none pt-1">
              {totalHours.toFixed(1)}{' '}
              <span className="text-sm text-slate-400 font-normal">hrs</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center text-[#540225] border border-pink-100">
            <Clock className="w-5 h-5 text-[#721c3b]" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          Accumulated extra teaching &amp; lab hours for this cycle.
        </p>
      </div>

      {/* Metric 2: Pending Coordinator Review */}
      <div
        className={`p-5 rounded-2xl shadow-xs border flex flex-col justify-between space-y-3 transition-shadow hover:shadow-md ${
          hasPending
            ? 'bg-amber-50/60 border-amber-200'
            : 'bg-white border-slate-100'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                Pending Review
              </span>
              {hasPending && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>
            <div
              className={`font-headline text-2xl sm:text-3xl font-bold leading-none pt-1 ${
                hasPending ? 'text-[#7c5800]' : 'text-slate-900'
              }`}
            >
              {pendingCount}{' '}
              <span className="text-sm text-slate-400 font-normal">in review</span>
            </div>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              hasPending
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}
          >
            <Send className="w-5 h-5" />
          </div>
        </div>
        <p className="text-[11px] text-amber-800 font-medium">
          {hasPending
            ? `${pendingCount} request(s) awaiting Academic Coordinator approval.`
            : 'All submitted requests have been reviewed.'}
        </p>
      </div>

      {/* Metric 3: Approved by Coordinator */}
      <div className="p-5 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col justify-between space-y-3 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              Approved Requests
            </span>
            <div className="font-headline text-2xl sm:text-3xl font-bold text-emerald-700 leading-none pt-1">
              {approvedCount}{' '}
              <span className="text-sm text-slate-400 font-normal">approved</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 border border-emerald-100">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
        </div>
        <p className="text-[11px] text-emerald-700 font-medium">
          Validated by Coordinator &amp; queued for Central Finance.
        </p>
      </div>

      {/* Metric 4: Department Faculty Count */}
      <div className="p-5 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col justify-between space-y-3 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              Active Faculty Scope
            </span>
            <div className="font-headline text-2xl sm:text-3xl font-bold text-[#0b1c30] leading-none pt-1">
              {activeTeachersCount}{' '}
              <span className="text-sm text-slate-400 font-normal">faculty</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700 border border-blue-100">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          Faculty, Lecturers &amp; Deans in selected department scope.
        </p>
      </div>
    </div>
  );
}
