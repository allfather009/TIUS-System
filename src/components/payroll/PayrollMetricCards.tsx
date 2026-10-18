'use client';

import React from 'react';
import { Clock, Banknote, BarChart3, ShieldCheck, TrendingUp, CheckCircle, Briefcase } from 'lucide-react';
import { PayrollDisbursalSummary } from '@/types/payroll';

interface PayrollMetricCardsProps {
  summary: PayrollDisbursalSummary;
  currency?: 'USD' | 'IQD';
  exchangeRate?: number;
}

export function PayrollMetricCards({ 
  summary, 
  currency = 'USD', 
  exchangeRate = 150000 
}: PayrollMetricCardsProps) {
  const fmtRate = (amount: number, isGross = false) => {
    if (currency === 'IQD') {
      const converted = amount * (exchangeRate / 100);
      return `IQD ${converted.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5">
      {/* Metric 1: Total Approved Hours */}
      <div className="p-5 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">
            Total Approved Hours
          </span>
          <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-[#721c3b] border border-pink-100">
            <Clock className="w-4 h-4 text-[#721c3b]" />
          </div>
        </div>

        <div className="my-2 flex items-baseline gap-1.5">
          <span className="font-headline text-3xl font-bold text-[#0b1c30] tracking-tight">
            {summary.totalExtraHoursBilled.toLocaleString('en-US', { minimumFractionDigits: 1 })}
          </span>
          <span className="text-xs font-normal text-slate-400">hrs</span>
        </div>

        <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              <strong className="text-slate-700 font-semibold">{summary.hoursBreakdownFT.toLocaleString()}</strong> FT
            </span>
            <span className="text-slate-300">•</span>
            <span>
              <strong className="text-slate-700 font-semibold">{summary.hoursBreakdownPT.toLocaleString()}</strong> PT
            </span>
          </div>

          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#ffdea8] text-[#7c5800] text-[10px] font-bold">
            <TrendingUp className="w-3 h-3" />
            +{summary.hoursTrendPercent}%
          </span>
        </div>
      </div>

      {/* Metric 2: Total Payroll Amount */}
      <div className="p-5 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">
            Total Payroll Amount
          </span>
          <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-700 border border-rose-100">
            <Banknote className="w-4 h-4 text-rose-600" />
          </div>
        </div>

        <div className="my-2 flex items-baseline gap-1.5">
          <span className="font-headline text-3xl font-bold text-[#0b1c30] tracking-tight">
            {fmtRate(summary.totalPayrollUSD, true)}
          </span>
          <span className="text-xs font-bold text-slate-400">{currency}</span>
        </div>

        <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Ready for Cash Disbursal
          </span>
          <Banknote className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
    </div>
  );
}
