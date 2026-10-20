'use client';

import React from 'react';
import { Calendar, GraduationCap } from 'lucide-react';

interface TeacherHeroProps {
  teacherName?: string;
  departmentFaculty?: string;
  semester?: string;
  selectedMonth?: string;
}

export function TeacherHero({
  teacherName = 'Faculty Member',
  departmentFaculty = 'Department of Academic Studies',
  semester = 'Academic Year 2026–2027',
  selectedMonth = 'Active Cycle',
}: TeacherHeroProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pt-2">
      {/* Left: Greeting & Faculty Affiliation */}
      <div className="space-y-1.5">
        <h1 className="font-headline text-2xl sm:text-3xl lg:text-[32px] font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
          <span>Welcome back, {teacherName}</span>
          <span className="inline-block hover:rotate-12 transition-transform duration-200 select-none cursor-default">
            👋
          </span>
        </h1>
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 font-medium">
          <GraduationCap className="w-4 h-4 text-[#721c3b]" />
          <span className="font-semibold text-[#540225]">{departmentFaculty}</span>
          <span>•</span>
          <span>{semester}</span>
        </div>
      </div>

      {/* Right: Active Cycle Display */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span>{selectedMonth}</span>
        </div>
      </div>
    </div>
  );
}
