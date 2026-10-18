'use client';

import React from 'react';
import { Banknote, Printer, CheckCircle2 } from 'lucide-react';
import { PayrollDisbursalSummary, PayrollFacultyRow } from '@/types/payroll';

interface StickyDisbursalBarProps {
  summary: PayrollDisbursalSummary;
  selectedRows: PayrollFacultyRow[];
  onPrintCashSlipsAndPay: () => void;
  isProcessing?: boolean;
  actionButtonLabel?: string;
  barTitle?: string;
  emptyHint?: string;
  statusBadgeLabel?: string;
  grossLabel?: string;
  currency?: 'USD' | 'IQD';
  exchangeRate?: number;
}

export function StickyDisbursalBar({
  summary,
  selectedRows,
  onPrintCashSlipsAndPay,
  isProcessing = false,
  actionButtonLabel = 'Print Cash Slips & Mark Paid',
  barTitle,
  emptyHint,
  statusBadgeLabel = 'Ready for Physical Cash Disbursal',
  grossLabel = 'TOTAL DISBURSAL GROSS',
  currency = 'USD',
  exchangeRate = 150000,
}: StickyDisbursalBarProps) {
  const selectedCount = selectedRows.length;
  const selectedHours = selectedRows.reduce((acc, r) => acc + r.billedHours, 0);
  const selectedGross = selectedRows.reduce((acc, r) => acc + r.calculatedGross, 0);

  const fmtRate = (amount: number, isGross = false) => {
    if (currency === 'IQD') {
      const converted = amount * (exchangeRate / 100);
      return `IQD ${converted.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `$${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="sticky bottom-4 z-30 mt-8">
      <div className="max-w-7xl mx-auto">
        <div className="p-4 px-6 rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md bg-white/95">
          {/* Left Info: Dynamic selection stats */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#540225] flex items-center justify-center text-white shrink-0 shadow-md">
              <Banknote className="w-6 h-6 text-white" />
            </div>

            <div className="space-y-0.5">
              <h4 className="font-headline font-bold text-sm text-[#0b1c30]">
                {selectedCount > 0
                  ? (barTitle ? `${barTitle} • ${selectedCount} Selected` : `Cash Disbursal • ${selectedCount} Faculty Selected`)
                  : (barTitle || 'Cash Disbursal Bulk Action Bar')}
              </h4>
              <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                {selectedCount > 0 ? (
                  <>
                    <span>
                      Selected Hours:{' '}
                      <strong className="text-slate-800 font-semibold">
                        {selectedHours.toLocaleString('en-US', { minimumFractionDigits: 1 })} hrs
                      </strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>
                      Batch ID: <strong className="font-mono text-slate-700">{summary.batchReferenceId}</strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {statusBadgeLabel}
                    </span>
                  </>
                ) : (
                  <span>
                    {emptyHint ||
                      'Select faculty rows using the checkboxes above to disburse cash receipts and generate post card slips.'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Info & CTA */}
          <div className="flex items-center gap-6 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
            <div className="text-left md:text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                {selectedCount > 0 ? 'SELECTED CASH PAYOUT' : grossLabel}
              </span>
              <span className="font-headline text-2xl sm:text-3xl font-extrabold text-[#0b1c30] tracking-tight">
                {fmtRate(selectedGross, true)}
              </span>
            </div>

            <button
              type="button"
              onClick={onPrintCashSlipsAndPay}
              disabled={selectedCount === 0 || isProcessing}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all ${
                selectedCount === 0 || isProcessing
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-[#540225] hover:bg-[#721c3b] text-white hover:shadow-lg cursor-pointer'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>
                {isProcessing
                  ? 'Processing...'
                  : actionButtonLabel}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

