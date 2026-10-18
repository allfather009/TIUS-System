'use client';

import React from 'react';
import { X, Printer, ShieldCheck } from 'lucide-react';
import { TeacherPortalData } from '@/types/database';

interface MonthlySlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TeacherPortalData;
}

export function MonthlySlipModal({ isOpen, onClose, data }: MonthlySlipModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const fmtRate = (usdRate: number) => {
    if (!data.systemSettings) return `$${usdRate.toFixed(2)}`;
    const { base_currency, exchange_rate } = data.systemSettings;
    if (base_currency === 'IQD') {
      const iqd = usdRate * (exchange_rate / 100);
      return `IQD ${iqd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `$${usdRate.toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden text-left flex flex-col max-h-[92vh]">
        {/* Modal Top Actions */}
        <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Institutional Remuneration Slip • October 2024
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Payslip Body */}
        <div className="p-8 space-y-6 overflow-y-auto flex-1 text-slate-800" id="monthly-slip-content">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-[#540225] pb-5">
            <div className="flex items-center gap-3">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDoDDRqJXEliwiAbQj3HE8fZbuJHyNLm4oXuQQ5QO7nQeR8qOdesMMJqIyGvqtkCY9Rjzbsq1raOKhc9i3B1hmX-CKY9ZP_pb0ev_safjontFAUkVZbtIPdFcN0LFfGLhBh695WC0f-958s-4dkfKqnb-dqpdihEqMy9cF7CHQFDpWItxiA4tI327j1Yut7rDKyJsZsz6UFPox71r5RXf4cWZ-uwLT2qmPnLstL1KjH8AKbnjNDjRdJpgmI0MtJb09N4w"
                alt="TIU Logo"
                className="w-12 h-12 object-contain"
              />
              <div>
                <h2 className="font-headline font-extrabold text-base text-[#540225] leading-tight">
                  Tishk International University
                </h2>
                <p className="text-xs text-slate-500 font-medium">Sulaimani Campus • Directorate of Finance</p>
                <p className="text-[11px] text-slate-400">Extra Hours &amp; Academic Overtime Remuneration</p>
              </div>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                AUDITED &amp; APPROVED
              </span>
              <div className="text-[11px] font-mono text-slate-400 mt-1.5">SLIP #TIUS-2024-10-4119</div>
            </div>
          </div>

          {/* Faculty Info Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Faculty Name</span>
              <p className="font-bold text-slate-900 mt-0.5">{data.teacher.name}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Staff ID</span>
              <p className="font-mono font-bold text-slate-900 mt-0.5">TIU-4119</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Department</span>
              <p className="font-medium text-slate-800 mt-0.5">Computer Eng &amp; IT</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Contract Tier</span>
              <p className="font-medium text-slate-800 mt-0.5">{data.contractTier}</p>
            </div>
          </div>

          {/* Hours Breakdown Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Deliverables &amp; Course Distribution
            </h4>
            <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-[#eff4ff] text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Course / Deliverable</th>
                  <th className="p-2.5 text-center">Approved Hours</th>
                  <th className="p-2.5 text-right">Hourly Rate</th>
                  <th className="p-2.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.courseBreakdown.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-2.5 font-medium text-slate-800">{item.name}</td>
                    <td className="p-2.5 text-center font-bold text-[#721c3b]">{item.hours.toFixed(1)} hrs</td>
                    <td className="p-2.5 text-right text-slate-600">{fmtRate(data.hourlyRate)}</td>
                    <td className="p-2.5 text-right font-bold text-slate-900">
                      {fmtRate(item.hours * data.hourlyRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200 text-xs">
                <tr>
                  <td className="p-2.5 text-slate-700">Total Approved Deliverables</td>
                  <td className="p-2.5 text-center text-[#721c3b]">{data.totalExtraHours.toFixed(1)} hrs</td>
                  <td className="p-2.5 text-right text-slate-500">Gross Remuneration</td>
                  <td className="p-2.5 text-right text-base text-[#540225] font-extrabold">
                    {fmtRate(data.estimatedPayout)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Currency Equivalent Box */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-[#271900]">Central Bank Disbursal Equivalent</span>
              <p className="text-[11px] text-amber-800">
                Converted at Central Bank of Iraq official clearing rate of {(data.systemSettings.exchange_rate / 100).toLocaleString()} IQD / USD.
              </p>
            </div>
            <div className="text-right">
              <span className="font-headline font-bold text-lg text-[#7c5800]">
                ≈ {(data.estimatedPayout * (data.systemSettings.exchange_rate / 100)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} IQD
              </span>
            </div>
          </div>

          {/* Verification Signatures */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-200 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Head of Department Sign-off</span>
              <div className="flex items-center gap-2 mt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-slate-800">{data.departmentHod.name}</span>
              </div>
              <p className="text-[10px] text-slate-400">Authenticated via Biometric Turnstile Logs</p>
            </div>
            <div className="space-y-1 text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400">University Treasury Release</span>
              <div className="font-semibold text-slate-800 mt-1">Direct Bank Wire (RTGS)</div>
              <p className="text-[10px] text-slate-400">Deposit Date: October 31, 2024</p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 px-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
