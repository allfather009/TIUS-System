'use client';

import React from 'react';
import { Users } from 'lucide-react';
import { DashboardMetrics } from '@/types/database';

interface RoleCountsBarProps {
  metrics: DashboardMetrics;
}

export function RoleCountsBar({ metrics }: RoleCountsBarProps) {
  const total = metrics?.totalUsersCount || 1; // avoid division by zero
  const tPercent = ((metrics?.teacherCount || 0) / total) * 100;
  const hPercent = ((metrics?.hodCount || 0) / total) * 100;
  const cPercent = ((metrics?.coordinatorCount || 0) / total) * 100;
  const aPercent = ((metrics?.accountantCount || 0) / total) * 100;
  const sPercent = Math.max(0, 100 - tPercent - hPercent - cPercent - aPercent); // for super admins

  return (
    <div className="p-6 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-800">
          <Users className="w-5 h-5 text-indigo-600" />
          <h2 className="font-headline text-lg font-bold">System Staff Distribution</h2>
        </div>
        <div className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
          Total Users: {metrics?.totalUsersCount || 0}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-100">
        {tPercent > 0 && <div style={{ width: `${tPercent}%` }} className="bg-blue-500 transition-all duration-700" title="Teachers" />}
        {hPercent > 0 && <div style={{ width: `${hPercent}%` }} className="bg-emerald-500 transition-all duration-700" title="HoDs" />}
        {cPercent > 0 && <div style={{ width: `${cPercent}%` }} className="bg-purple-500 transition-all duration-700" title="Coordinators" />}
        {aPercent > 0 && <div style={{ width: `${aPercent}%` }} className="bg-amber-500 transition-all duration-700" title="Accountants" />}
        {sPercent > 0 && <div style={{ width: `${sPercent}%` }} className="bg-slate-400 transition-all duration-700" title="Super Admins" />}
      </div>

      {/* Legend */}
      <div className="flex items-center flex-wrap gap-4 pt-2 border-t border-slate-50">
        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
          Teachers <span className="font-bold text-slate-900">{metrics?.teacherCount || 0}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          HoDs <span className="font-bold text-slate-900">{metrics?.hodCount || 0}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
          <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
          Coordinators <span className="font-bold text-slate-900">{metrics?.coordinatorCount || 0}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
          Accountants <span className="font-bold text-slate-900">{metrics?.accountantCount || 0}</span>
        </div>
      </div>
    </div>
  );
}
