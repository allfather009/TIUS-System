'use client';

import React from 'react';
import { Clock, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface HodMetricCardsProps {
  totalHours: number;
  hoursCap?: number;
  activeTeachersCount?: number;
  pendingCount: number;
  approvedCount?: number;
}

export function HodMetricCards({
  totalHours,
  pendingCount,
}: HodMetricCardsProps) {
  const hasPending = pendingCount > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Metric 1: Total Department Extra Hours (This Month) */}
      <div className="p-6 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              Total Department Extra Hours (This Month)
            </span>
            <div className="font-headline text-3xl font-bold text-[#0b1c30] leading-none pt-1">
              {totalHours.toFixed(1)}{' '}
              <span className="text-base text-slate-400 font-normal">hrs</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center text-[#540225] border border-pink-100">
            <Clock className="w-6 h-6 text-[#721c3b]" />
          </div>
        </div>
      </div>

      {/* Metric 2: Pending Actions */}
      <div
        className={`p-6 rounded-2xl shadow-xs border flex flex-col justify-between space-y-4 transition-shadow hover:shadow-md ${
          hasPending
            ? 'bg-amber-50/50 border-amber-200/90'
            : 'bg-white border-slate-100'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                Pending Actions
              </span>
              {hasPending && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>
            <div
              className={`font-headline text-3xl font-bold leading-none pt-1 ${
                hasPending ? 'text-[#7c5800]' : 'text-slate-900'
              }`}
            >
              {pendingCount}{' '}
              <span className="text-base text-slate-400 font-normal">Pending Logs</span>
            </div>
          </div>
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
              hasPending
                ? 'bg-[#ffdea8] text-[#271900] border-amber-300'
                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
            }`}
          >
            {hasPending ? (
              <AlertCircle className="w-6 h-6 text-[#7c5800]" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            )}
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {hasPending ? (
            <>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#ffdea8] text-[#271900] text-xs font-semibold">
                <ShieldAlert className="w-3.5 h-3.5 text-[#7c5800]" />
                Action Required: HoD Signature Gate 1
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500 font-medium">Batch Cutoff Oct 28</span>
                <span className="text-amber-800 font-bold">Ready for Batch Endorsement</span>
              </div>
            </>
          ) : (
            <div className="text-xs text-emerald-700 font-medium pt-3">
              ✓ All department logs are signed and audited for this cycle.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
