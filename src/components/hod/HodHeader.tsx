'use client';

import React from 'react';
import { Plus, CalendarCog, Lock, Send } from 'lucide-react';
import { Department } from '@/types/database';

interface HodHeaderProps {
  department: Department;
  onOpenLogModal: () => void;
  pendingCount: number;
  onOpenCycleSettings?: () => void;
  isCycleLocked?: boolean;
  title?: string;
  subtitle?: React.ReactNode;
}

export function HodHeader({
  department,
  onOpenLogModal,
  pendingCount,
  onOpenCycleSettings,
  isCycleLocked,
  title,
  subtitle,
}: HodHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
      {/* Title & Department Scope */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#540225]" />
          <h1 className="font-headline text-2xl sm:text-3xl font-bold text-[#0b1c30] tracking-tight">
            {title || 'HoD Submission Hub'}
          </h1>
        </div>

        {subtitle ? (
          <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
            {subtitle}
          </p>
        ) : (
          <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
            Submit and track instructional extra hours and laboratory practicals for faculty in{' '}
            <strong className="text-slate-800">{department.name}</strong>. All requests route directly to the Academic Coordinator.
          </p>
        )}
      </div>

      {/* Primary Action Buttons */}
      <div className="flex items-center gap-3 shrink-0">
        {onOpenCycleSettings && (
          <button
            type="button"
            onClick={onOpenCycleSettings}
            className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow-sm cursor-pointer ${
              isCycleLocked
                ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {isCycleLocked ? (
              <Lock className="w-4 h-4 text-amber-600" />
            ) : (
              <CalendarCog className="w-4 h-4 text-[#540225]" />
            )}
            <span>Cycle Settings {isCycleLocked ? '(Locked)' : ''}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenLogModal}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs sm:text-sm font-bold transition-all shadow-md hover:shadow-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Submit Extra Hours Request</span>
        </button>
      </div>
    </div>
  );
}
