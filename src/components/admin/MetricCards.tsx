'use client';

import React from 'react';
import { DashboardMetrics } from '@/types/database';
import { Clock, Wallet, AlertTriangle, TrendingUp, ArrowRight, ShieldAlert } from 'lucide-react';

interface MetricCardsProps {
  metrics: DashboardMetrics;
  hidePayrollCost?: boolean;
}

export function MetricCards({ metrics, hidePayrollCost = false }: MetricCardsProps) {
  const safe = {
    totalHours: Number(metrics?.totalHours ?? 0),
    hoursCap: Number(metrics?.hoursCap ?? 250),
    hoursPercentage: Number(metrics?.hoursPercentage ?? 0),
    estimatedCostUSD: Number(metrics?.estimatedCostUSD ?? 0),
    estimatedCostIQD: Number(metrics?.estimatedCostIQD ?? 0),
    baseCurrency: metrics?.baseCurrency ?? 'USD',
    exchangeRate: Number(metrics?.exchangeRate ?? 1500),
    disbursedPercentage: Number(metrics?.disbursedPercentage ?? 0),
    pendingApprovalsCount: Number(metrics?.pendingApprovalsCount ?? 0),
    pendingDepartmentsCount: Number(metrics?.pendingDepartmentsCount ?? 0),
  };

  return (
    <div className={`grid grid-cols-1 ${hidePayrollCost ? '' : 'md:grid-cols-2'} gap-6`}>
      {/* Metric 1: Total University Extra Hours */}
      <div className="p-6 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              Total University Extra Hours
            </span>
            <div className="font-headline text-3xl font-bold text-[#0b1c30] leading-none pt-1">
              {safe.totalHours.toLocaleString('en-US', { minimumFractionDigits: 1 })}{' '}
              <span className="text-base text-slate-400 font-normal">hrs</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#eff4ff] flex items-center justify-center text-[#540225] border border-blue-50">
            <Clock className="w-6 h-6 text-[#721c3b]" />
          </div>
        </div>


      </div>

      {/* Metric 2: Estimated Payroll Cost */}
      {!hidePayrollCost && (
        <div className="p-6 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                Estimated Payroll Cost
              </span>
              <div className="font-headline text-3xl font-bold text-[#0b1c30] leading-none pt-1">
                {safe.baseCurrency === 'IQD'
                  ? `IQD ${safe.estimatedCostIQD.toLocaleString()}`
                  : `$${safe.estimatedCostUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 border border-amber-100">
              <Wallet className="w-6 h-6 text-[#7c5800]" />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              {safe.baseCurrency !== 'IQD' && (
                <span className="px-2.5 py-1 rounded-full bg-[#ffdea8] text-[#271900] text-[11px] font-bold border border-amber-200">
                  ≈ {safe.estimatedCostIQD.toLocaleString()} IQD
                </span>
              )}
              <span className="text-[11px] text-slate-400 font-medium">
                Rate: {(safe.exchangeRate * 100).toLocaleString()} IQD per $100
              </span>
            </div>
            <div className="pt-2 flex items-center text-xs text-slate-500 border-t border-slate-50">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-2 h-2 rounded-full bg-[#ffbe3b]" />
                Budget Allocated ({safe.baseCurrency})
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
