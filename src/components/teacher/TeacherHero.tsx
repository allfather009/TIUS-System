'use client';

import React from 'react';
import { Calendar, GraduationCap } from 'lucide-react';

interface TeacherHeroProps {
  teacherName?: string;
  departmentFaculty?: string;
  semester?: string;
  selectedMonth?: string;
  onRequestHours?: () => void;
}

export function TeacherHero({
  teacherName = 'Faculty Member',
  departmentFaculty = 'Department of Academic Studies',
  semester = 'Academic Year 2024–2025',
  selectedMonth = 'October 2024',
  onRequestHours,
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

      {/* Right: Month Selector & Request Button */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Current Active Cycle Display */}
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span>{selectedMonth}</span>
        </div>

        {/* Request Extra Hours Button */}
        <button
          type="button"
          onClick={onRequestHours}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer"
        >
          <span className="text-base leading-none">+</span>
          <span>Request Extra Hours</span>
        </button>
      </div>
    </div>
  );
}
