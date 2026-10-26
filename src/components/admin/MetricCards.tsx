'use client';

import React from 'react';
import { DashboardMetrics } from '@/types/database';
import { Clock, Wallet, AlertTriangle, TrendingUp, ArrowRight, ShieldAlert } from 'lucide-react';

interface MetricCardsProps {
  metrics: DashboardMetrics;
  hidePayrollCost?: boolean;
  loading?: boolean;
}

export function MetricCards({
  metrics,
  hidePayrollCost = false,
  loading = false,
}: MetricCardsProps) {
  const rawHours = Number(metrics?.totalHours);
  const rawCostIQD = Number(metrics?.estimatedCostIQD);
  const rawCostUSD = Number(metrics?.estimatedCostUSD);
  const rawExchangeRate = Number(metrics?.exchangeRate);

  const safe = {
    totalHours: isNaN(rawHours) ? 0 : rawHours,
    hoursCap: Number(metrics?.hoursCap) || 250,
    hoursPercentage: Number(metrics?.hoursPercentage) || 0,
    estimatedCostUSD: isNaN(rawCostUSD) ? 0 : rawCostUSD,
    estimatedCostIQD: isNaN(rawCostIQD) ? 0 : rawCostIQD,
    baseCurrency: metrics?.baseCurrency ?? 'IQD',
    exchangeRate: isNaN(rawExchangeRate) || rawExchangeRate <= 0 ? 150000 : rawExchangeRate,
    disbursedPercentage: Number(metrics?.disbursedPercentage) || 0,
    pendingApprovalsCount: Number(metrics?.pendingApprovalsCount) || 0,
    pendingDepartmentsCount: Number(metrics?.pendingDepartmentsCount) || 0,
  };

  const displayExchangeRate = safe.exchangeRate < 10000 ? safe.exchangeRate * 100 : safe.exchangeRate;

  return (
    <div className={`grid grid-cols-1 ${hidePayrollCost ? '' : 'md:grid-cols-2'} gap-6`}>
      {/* Metric 1: Total University Extra Hours */}
      <div className="p-6 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              Total University Extra Hours
            </span>
            {loading ? (
              <div className="pt-2">
                <div className="h-8 w-28 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            ) : (
              <div className="font-headline text-3xl font-bold text-[#0b1c30] leading-none pt-1">
                {safe.totalHours.toLocaleString(undefined, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{' '}
                <span className="text-base text-slate-400 font-normal">hrs</span>
              </div>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#eff4ff] flex items-center justify-center text-[#540225] border border-blue-50 shrink-0">
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
              {loading ? (
                <div className="pt-2">
                  <div className="h-8 w-40 bg-slate-100 rounded-lg animate-pulse" />
                </div>
              ) : (
                <div className="font-headline text-3xl font-bold text-[#0b1c30] leading-none pt-1">
                  IQD {Math.round(safe.estimatedCostIQD).toLocaleString()}
                </div>
              )}
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 border border-amber-100 shrink-0">
              <Wallet className="w-6 h-6 text-[#7c5800]" />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              {loading ? (
                <div className="h-4 w-44 bg-slate-100 rounded animate-pulse" />
              ) : (
                <span className="text-[11px] text-slate-400 font-medium">
                  Rate: {displayExchangeRate.toLocaleString()} IQD per $100
                </span>
              )}
            </div>
            <div className="pt-2 flex items-center text-xs text-slate-500 border-t border-slate-50">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-2 h-2 rounded-full bg-[#ffbe3b]" />
                Budget Allocated (IQD)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
