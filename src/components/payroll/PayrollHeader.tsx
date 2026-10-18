'use client';

import React from 'react';
import { CalendarCog } from 'lucide-react';

interface PayrollHeaderProps {
  title?: string;
  subtitle?: string;
  activeCycleLabel?: string;
  isLocked?: boolean;
  onOpenCycleSettings?: () => void;
}

export function PayrollHeader({
  title = 'Payroll & Finance Disbursal',
  subtitle = 'Monthly Extra Hours Remuneration Summary',
  activeCycleLabel = 'Active Cycle: Sep 25 - Oct 25',
  isLocked = false,
  onOpenCycleSettings,
}: PayrollHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Top Section: Title & Subtitle on left, Active Cycle badge on right */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1.5">
          <h1 className="font-headline text-2xl sm:text-3xl font-bold text-[#0b1c30] tracking-tight">
            {title}
          </h1>

          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
            <span className="font-medium text-slate-700">{subtitle}</span>
          </div>
        </div>

        {/* Top Right: Prominent Active Cycle Pill */}
        {onOpenCycleSettings ? (
          <button
            type="button"
            onClick={onOpenCycleSettings}
            title="Click to configure cycle settings and submission lock"
            className={`group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border shadow-2xs self-start sm:self-auto shrink-0 transition-all cursor-pointer hover:shadow-sm hover:scale-[1.01] active:scale-[0.99] ${
              isLocked
                ? 'bg-red-50 text-red-900 border-red-200 hover:bg-red-100 hover:border-red-300'
                : 'bg-[#ffdea8] text-[#271900] border-amber-200 hover:bg-[#fad899] hover:border-amber-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLocked ? 'bg-red-600 animate-pulse' : 'bg-[#7c5800]'
              }`}
            />
            <span>{activeCycleLabel}</span>
            {isLocked ? (
              <span className="text-[10px] uppercase tracking-wider bg-red-200 text-red-800 px-1.5 py-0.5 rounded font-black">
                Locked
              </span>
            ) : null}
            <CalendarCog className="w-3.5 h-3.5 text-[#540225] opacity-60 group-hover:opacity-100 transition-opacity ml-0.5" />
          </button>
        ) : (
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border shadow-2xs self-start sm:self-auto shrink-0 ${
              isLocked
                ? 'bg-red-50 text-red-900 border-red-200'
                : 'bg-[#ffdea8] text-[#271900] border-amber-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLocked ? 'bg-red-600 animate-pulse' : 'bg-[#7c5800]'
              }`}
            />
            <span>{activeCycleLabel}</span>
            {isLocked && (
              <span className="text-[10px] uppercase tracking-wider bg-red-200 text-red-800 px-1.5 py-0.5 rounded font-black">
                Locked
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
