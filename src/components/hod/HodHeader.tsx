'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { Department } from '@/types/database';

interface HodHeaderProps {
  department: Department;
  onOpenLogModal: () => void;
  pendingCount: number;
}

export function HodHeader({
  department,
  onOpenLogModal,
  pendingCount,
}: HodHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
      {/* Title & Department Scope */}
      <div className="space-y-1.5">
        <h1 className="font-headline text-2xl sm:text-3xl font-bold text-[#0b1c30] tracking-tight">
          Department Extra Hours
        </h1>

        <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
          Manage and review instructional extra hours and lab sessions for <strong>{department.name}</strong>.
        </p>
      </div>

      {/* Primary Action Button */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenLogModal}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs sm:text-sm font-bold transition-all shadow-md hover:shadow-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Log Extra Hours</span>
        </button>
      </div>
    </div>
  );
}
