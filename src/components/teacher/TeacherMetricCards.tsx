'use client';

import React from 'react';
import { Clock, CheckCircle2, ClipboardList } from 'lucide-react';
import { TeacherPortalData } from '@/types/database';

interface TeacherMetricCardsProps {
  data: TeacherPortalData;
}

export function TeacherMetricCards({ data }: TeacherMetricCardsProps) {
  const approvedLogs = data.logs.filter((l) => l.status === 'APPROVED');
  const pendingLogs = data.logs.filter((l) => l.status === 'PENDING' || l.status === 'PENDING_HOD_APPROVAL');

  const approvedHours = approvedLogs.reduce((acc, l) => acc + (Number(l.duration) || 0), 0);
  const pendingHours = pendingLogs.reduce((acc, l) => acc + (Number(l.duration) || 0), 0);
  const totalRequests = data.logs.length;

  const fmtCurrency = (usdVal: number) => {
    if (!data.systemSettings) return `$${usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const { base_currency, exchange_rate } = data.systemSettings;
    if (base_currency === 'IQD') {
      const iqd = usdVal * (exchange_rate / 100);
      return `IQD ${iqd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `$${usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const approvedPayout = approvedHours * (data.hourlyRate || 40);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Card 1: APPROVED EXTRA HOURS */}
      <div className="p-6 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              APPROVED EXTRA HOURS
            </span>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="font-headline text-3xl font-extrabold text-[#0b1c30] leading-none">
                {approvedHours.toFixed(1)}
              </span>
              <span className="text-base text-slate-400 font-normal">hrs</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 border border-emerald-100">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        <div className="pt-1 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Verified by Coordinator</span>
          </div>
          {approvedPayout > 0 && (
            <span className="font-mono text-[11px] font-bold text-slate-600">
              {fmtCurrency(approvedPayout)}
            </span>
          )}
        </div>
      </div>

      {/* Card 2: PENDING REVIEW HOURS */}
      <div className="p-6 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              PENDING REVIEW HOURS
            </span>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="font-headline text-3xl font-extrabold text-[#0b1c30] leading-none">
                {pendingHours.toFixed(1)}
              </span>
              <span className="text-base text-slate-400 font-normal">hrs</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 border border-amber-100">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
        </div>

        <div className="pt-1">
          <div className="text-[11px] text-amber-800 flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>
              {pendingLogs.length} request{pendingLogs.length === 1 ? '' : 's'} awaiting Coordinator action
            </span>
          </div>
        </div>
      </div>

      {/* Card 3: TOTAL SUBMITTED REQUESTS */}
      <div className="p-6 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              TOTAL SUBMITTED REQUESTS
            </span>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="font-headline text-3xl font-extrabold text-[#0b1c30] leading-none">
                {totalRequests}
              </span>
              <span className="text-base text-slate-400 font-normal">submissions</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700 border border-indigo-100">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
          </div>
        </div>

        <div className="pt-1">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
            <span>Submitted on your behalf by your Head of Department</span>
          </div>
        </div>
      </div>
    </div>
  );
}
