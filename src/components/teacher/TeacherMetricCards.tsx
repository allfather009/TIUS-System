'use client';

import React from 'react';
import { Clock, Banknote, Wallet, ShieldCheck, Lock } from 'lucide-react';
import { TeacherPortalData } from '@/types/database';

interface TeacherMetricCardsProps {
  data: TeacherPortalData;
}

export function TeacherMetricCards({ data }: TeacherMetricCardsProps) {
  const fmtRate = (usdRate: number, isTotal = false) => {
    if (!data.systemSettings) return `$${usdRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const { base_currency, exchange_rate } = data.systemSettings;
    if (base_currency === 'IQD') {
      const iqd = usdRate * (exchange_rate / 100);
      return `IQD ${iqd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `$${usdRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Card 1: TOTAL EXTRA HOURS */}
      <div className="p-6 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              TOTAL EXTRA HOURS
            </span>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="font-headline text-3xl font-extrabold text-[#0b1c30] leading-none">
                {data.totalExtraHours.toFixed(1)}
              </span>
              <span className="text-base text-slate-400 font-normal">hrs</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#eff4ff] flex items-center justify-center text-indigo-700">
            <Clock className="w-5 h-5 text-indigo-600" />
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>Monthly Cap Usage</span>
            <span className="font-mono text-slate-800">
              {data.totalExtraHours.toFixed(1)} / {data.monthlyCapHours.toFixed(1)} hrs
            </span>
          </div>
          <div className="w-full bg-[#eff4ff] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#721c3b] h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(
                  (data.totalExtraHours / data.monthlyCapHours) * 100,
                  100
                )}%`,
              }}
            />
          </div>
          <div className="text-right text-[11px] text-slate-400 font-medium pt-0.5">
            {data.capacityFulfilledPercentage}% capacity fulfilled
          </div>
        </div>
      </div>

      {/* Card 2: HOURLY REMUNERATION */}
      <div className="p-6 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              HOURLY REMUNERATION
            </span>
            <div className="flex items-baseline gap-1.5 pt-1">
              <span className="font-headline text-3xl font-extrabold text-[#0b1c30] leading-none">
                {fmtRate(data.hourlyRate)}
              </span>
              <span className="text-sm text-slate-400 font-medium">/ hour</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 border border-emerald-100">
            <Banknote className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        <div className="pt-1">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{data.rateActiveDate}</span>
          </div>
        </div>
      </div>

      {/* Card 3: TOTAL PAYOUT */}
      <div className="p-6 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              TOTAL PAYOUT
            </span>
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="font-headline text-3xl font-extrabold text-[#0b1c30] leading-none">
                {data.systemSettings?.base_currency === 'IQD'
                  ? `IQD ${(data.estimatedPayout * ((data.systemSettings?.exchange_rate || 150000) / 100)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : `$${data.estimatedPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 border border-amber-100">
            <Wallet className="w-5 h-5 text-[#7c5800]" />
          </div>
        </div>

        <div className="pt-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <Wallet className={`w-3.5 h-3.5 shrink-0 ${data.estimatedPayout > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span className={`truncate ${data.estimatedPayout > 0 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
              {data.estimatedPayout > 0 ? 'Approved Balance Ready for Collection' : 'Current Active Cycle'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
