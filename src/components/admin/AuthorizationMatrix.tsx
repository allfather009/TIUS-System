'use client';

import React from 'react';
import { GraduationCap, Building2, ShieldCheck, WalletCards, Check } from 'lucide-react';

export function AuthorizationMatrix() {
  const tiers = [
    {
      role: 'Teacher',
      icon: GraduationCap,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      description:
        'Submit weekly extra lecture logs, tutorial sessions, and exam duty slips for departmental review.',
      badge: 'Self-service logging only',
    },
    {
      role: 'Head of Dept (HoD)',
      icon: Building2,
      color: 'bg-purple-50 text-purple-700 border-purple-200',
      description:
        'Verify academic syllabus delivery, approve or reject instructor hours, and flag anomalous over-caps.',
      badge: 'Department Tier 1 Clearance',
    },
    {
      role: 'Academic Coordinator',
      icon: ShieldCheck,
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      description:
        'Cross-faculty auditing, university-wide timetable reconciliations, and academic council reporting.',
      badge: 'Campus Tier 2 Validation',
    },
    {
      role: 'Finance / Accountant',
      icon: WalletCards,
      color: 'bg-amber-50 text-amber-800 border-amber-200',
      description:
        'Execute final rate computations, university treasury disbursement, and tax deduction statements.',
      badge: 'Final Payroll Disbursement',
    },
  ];

  return (
    <div className="p-6 rounded-3xl bg-white shadow-xs border border-slate-100 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-headline font-bold text-base text-[#0b1c30]">
            TIU Extra Hours Authorization Matrix
          </h3>
          <p className="text-xs text-slate-500">
            Standardized academic governance workflows per university bylaws.
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold">
          Active Term: Spring 2024–2025
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiers.map((t, idx) => {
          const Icon = t.icon;
          return (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${t.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-[#0b1c30]">{t.role}</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {t.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
                <Check className="w-3.5 h-3.5 text-[#540225]" />
                <span>{t.badge}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
