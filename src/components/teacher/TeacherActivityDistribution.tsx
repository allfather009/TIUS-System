'use client';

import React from 'react';
import { ShieldCheck, Mail } from 'lucide-react';
import { TeacherPortalData } from '@/types/database';

interface TeacherActivityDistributionProps {
  data: TeacherPortalData;
  onContactHod?: () => void;
}

export function TeacherActivityDistribution({
  data,
  onContactHod,
}: TeacherActivityDistributionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Hours by Course & Activity (12 Cols) */}
      <div className="lg:col-span-12 p-6 rounded-2xl bg-white shadow-xs border border-slate-100 flex flex-col justify-between space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="font-headline font-bold text-base text-[#0b1c30]">
              Hours by Course &amp; Activity
            </h3>
            <p className="text-xs text-slate-500">
              Distribution across assigned academic deliverables
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
            {data.courseBreakdown.length} Active Tasks
          </span>
        </div>

        {/* Multi-segmented Horizontal Progress Bar */}
        <div className="space-y-3">
          <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100 gap-0.5 p-0.5">
            {data.courseBreakdown.map((item, idx) => (
              <div
                key={idx}
                className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-700"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: item.color,
                }}
                title={`${item.name}: ${item.hours} hrs (${item.percentage}%)`}
              />
            ))}
          </div>

          {/* Legend Items */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {data.courseBreakdown.length === 0 ? (
              <div className="col-span-full py-6 text-center text-xs text-slate-400">
                No course hours logged yet this cycle. Log extra hours using the button above to view deliverable distribution.
              </div>
            ) : (
              data.courseBreakdown.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#eff4ff]/60 border border-blue-50/80 flex items-center gap-2.5"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.dotColor }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-[#0b1c30] truncate">
                      {item.name}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {item.hours.toFixed(1)} hrs ({item.percentage}%)
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>


    </div>
  );
}
