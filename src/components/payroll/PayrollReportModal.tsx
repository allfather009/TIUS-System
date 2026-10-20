'use client';

import React from 'react';
import { X, Printer, Download, CheckCircle2 } from 'lucide-react';
import { PayrollDisbursalSummary } from '@/types/payroll';

interface PayrollReportModalProps {
  summary: PayrollDisbursalSummary;
  isOpen: boolean;
  onClose: () => void;
  onExportCSV: () => void;
  currency?: 'USD' | 'IQD';
  exchangeRate?: number;
}

export function PayrollReportModal({
  summary,
  isOpen,
  onClose,
  onExportCSV,
  currency = 'USD',
  exchangeRate = 150000,
}: PayrollReportModalProps) {
  if (!isOpen) return null;

  const fmtRate = (amount: number) => {
    if (currency === 'IQD') {
      const converted = amount * (exchangeRate / 100);
      return `IQD ${converted.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 print:static print:inset-auto print:p-0 print:m-0 print:bg-transparent print:backdrop-blur-none">
      {/* Isolated Print Styles */}
      <style>{`
        @media print {
          @page {
            margin: 0; /* This removes the default browser headers and footers */
            size: auto;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body * {
            visibility: hidden;
          }
          .report-print-container,
          .report-print-container * {
            visibility: visible;
          }
          .report-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 2cm !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }
          .report-print-container table {
            width: 100% !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .report-print-container tbody,
          .report-print-container tr,
          .report-print-container thead {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print\\:hidden,
          .print-hidden,
          button {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden text-left flex flex-col max-h-[92vh] print:max-w-none print:w-full print:max-h-none print:shadow-none print:border-none print:rounded-none print:overflow-visible print:bg-transparent print:m-0 print:p-0">
        {/* Modal Toolbar (hidden when printing) */}
        <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 print:hidden print-hidden">
          <div className="flex items-center gap-2">
            <span className="font-headline font-bold text-sm text-[#0b1c30]">
              Payroll Report Preview — {summary.cycleName}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              Cash Ready
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={onExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Report Document */}
        <div className="report-print-container p-8 sm:p-10 space-y-6 overflow-y-auto flex-1 bg-white print:m-0 print:overflow-visible print:w-full print:max-w-none">
          {/* Institutional Letterhead */}
          <div className="flex items-center gap-4 border-b pb-6 border-slate-200">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDoDDRqJXEliwiAbQj3HE8fZbuJHyNLm4oXuQQ5QO7nQeR8qOdesMMJqIyGvqtkCY9Rjzbsq1raOKhc9i3B1hmX-CKY9ZP_pb0ev_safjontFAUkVZbtIPdFcN0LFfGLhBh695WC0f-958s-4dkfKqnb-dqpdihEqMy9cF7CHQFDpWItxiA4tI327j1Yut7rDKyJsZsz6UFPox71r5RXf4cWZ-uwLT2qmPnLstL1KjH8AKbnjNDjRdJpgmI0MtJb09N4w"
              alt="TIU Logo"
              className="w-14 h-14 object-contain rounded-xl"
            />
            <div className="flex-1">
              <h1 className="font-headline font-bold text-lg sm:text-xl text-[#540225] tracking-tight">
                TISHK INTERNATIONAL UNIVERSITY
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                Directorate of Finance &amp; Human Resource Administration • Sulaimani Campus
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                Official Extra Teaching Hours &amp; Remuneration Statement
              </p>
            </div>
          </div>

          {/* Key Totals Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 font-bold uppercase text-[10px]">Total Hours Billed</span>
              <div className="font-headline font-bold text-lg text-slate-900 mt-0.5">
                {summary.totalExtraHoursBilled.toFixed(1)} hrs
              </div>
              <span className="text-[10px] text-slate-500">{summary.hoursBreakdownFT} FT / {summary.hoursBreakdownPT} PT</span>
            </div>

            <div>
              <span className="text-slate-400 font-bold uppercase text-[10px]">Total Gross Disbursal</span>
              <div className="font-headline font-bold text-lg text-[#540225] mt-0.5">
                {fmtRate(summary.totalPayrollUSD)}
              </div>
              <span className="text-[10px] text-slate-500">{currency} Currency</span>
            </div>

            <div>
              <span className="text-slate-400 font-bold uppercase text-[10px]">Eligible Staff</span>
              <div className="font-headline font-bold text-lg text-slate-900 mt-0.5">
                {summary.eligibleTeachersCount} Teachers
              </div>
              <span className="text-[10px] text-slate-500">{summary.finalizedCount} Finalized</span>
            </div>

            <div>
              <span className="text-slate-400 font-bold uppercase text-[10px]">Audit Verification</span>
              <div className="font-headline font-bold text-lg text-emerald-700 mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                100% Passed
              </div>
              <span className="text-[10px] text-slate-500">Gate 1 &amp; Gate 2 Complete</span>
            </div>
          </div>

          {/* Department Breakdown Table */}
          <div className="space-y-2">
            <h3 className="font-headline font-bold text-sm text-slate-800">
              Departmental Summary &amp; Wire Allocations
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-4">Faculty / Department Unit</th>
                    <th className="py-2.5 px-3 text-center">Faculty Count</th>
                    <th className="py-2.5 px-3 text-right">Dept Hours</th>
                    <th className="py-2.5 px-4 text-right">Subtotal Amount ({currency})</th>
                    <th className="py-2.5 px-4 text-center">Approval &amp; Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {summary.departments.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{d.name}</td>
                      <td className="py-2.5 px-3 text-center">{d.facultyCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{d.totalDeptHours.toFixed(1)} hrs</td>
                      <td className="py-2.5 px-4 text-right font-bold text-[#540225]">
                        {fmtRate(d.subtotalGross)}
                      </td>
                      <td className="py-2.5 px-4 text-center text-[11px] text-emerald-700 font-semibold">
                        ✓ {d.hodSignedStatus}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100/80 font-bold text-slate-900 border-t-2 border-slate-300">
                    <td className="py-3 px-4">Total University Disbursal</td>
                    <td className="py-3 px-3 text-center">{summary.eligibleTeachersCount}</td>
                    <td className="py-3 px-3 text-right font-mono">{summary.totalExtraHoursBilled.toFixed(1)} hrs</td>
                    <td className="py-3 px-4 text-right text-[#540225] text-sm">
                      {fmtRate(summary.totalPayrollUSD)}
                    </td>
                    <td className="py-3 px-4 text-center text-emerald-700">Coordinator Approved</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50 print:hidden print-hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            Close Preview
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-6 py-2 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report (PDF)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
