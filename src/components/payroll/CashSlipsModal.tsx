'use client';

import React from 'react';
import { X, Printer, CheckCircle2, Banknote, Calendar, Clock, User, Building, FileText } from 'lucide-react';
import { PayrollFacultyRow } from '@/types/payroll';

interface CashSlipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRows: PayrollFacultyRow[];
  activeCycleLabel: string;
  batchReferenceId: string;
  onPrintWindow: () => void;
  currency?: 'USD' | 'IQD';
  exchangeRate?: number;
}

export function CashSlipsModal({
  isOpen,
  onClose,
  selectedRows,
  onPrintWindow,
  currency = 'USD',
  exchangeRate = 150000,
}: CashSlipsModalProps) {
  if (!isOpen) return null;

  const totalAmount = selectedRows.reduce((acc, r) => acc + r.calculatedGross, 0);
  const totalHours = selectedRows.reduce((acc, r) => acc + r.billedHours, 0);

  const fmtTotalRate = (amount: number) => {
    if (currency === 'IQD') {
      const converted = amount * (exchangeRate / 100);
      return `IQD ${converted.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 print:static print:inset-auto print:p-0 print:m-0 print:bg-transparent print:backdrop-blur-none print:transform-none print:filter-none">
      {/* Absolute Print Isolation (The Nuclear Option) */}
      <style>{`
        @media print {
          @page {
            size: 22cm 11cm landscape; /* Standard DL Envelope Landscape */
            margin: 0;
          }
          /* Hide absolutely everything in the app */
          body * {
            visibility: hidden !important;
          }
          /* Make ONLY the envelope and its contents visible */
          .envelope-print-container, .envelope-print-container * {
            visibility: visible !important;
          }
          /* Rip the container out of the layout and pin it to 0,0 */
          .envelope-print-container {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 0.5cm !important; /* Add a tiny safe-print margin inside the box */
            width: 22cm !important;
            height: 11cm !important;
            transform: none !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
      <div className="bg-white rounded-3xl shadow-2xl max-w-[25cm] w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden text-left print:static print:max-w-none print:max-h-none print:border-none print:shadow-none print:overflow-visible print:bg-transparent print:transform-none">
        {/* Modal Header */}
        <div className="p-6 px-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#540225] text-white flex items-center justify-center shadow-md">
              <Banknote className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-[#0b1c30]">
                Cash Disbursal Envelope Slips
              </h2>
              <p className="text-xs text-slate-500">
                {selectedRows.length} Faculty Selected • {totalHours.toFixed(1)} hrs • Total:{' '}
                <strong className="text-[#540225] font-bold">
                  {fmtTotalRate(totalAmount)}
                </strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onPrintWindow}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold transition-all shadow-md hover:shadow-lg cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print All Slips (DL Envelope 11cm × 22cm)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Scrollable Envelope Previews */}
        <div className="p-6 px-8 overflow-y-auto space-y-6 flex-1 bg-slate-100/60 print:p-0 print:m-0 print:overflow-visible print:bg-transparent print:static">
          <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
            <span>Envelope Receipt Format (11cm × 22cm Standard DL Physical Disbursal Vouchers)</span>
            <span className="font-mono text-[11px] bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-semibold text-slate-600">
              {selectedRows.length} {selectedRows.length === 1 ? 'Envelope Slip' : 'Envelope Slips'}
            </span>
          </div>

          <div className="flex flex-col items-center gap-6">
            {selectedRows.map((row) => {
              const iqdAmount = row.calculatedGross * (exchangeRate / 100);
              const formattedIqd = `IQD ${iqdAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
              const formattedUsd = `$${row.calculatedGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
              const formattedRate = exchangeRate.toLocaleString('en-US');

              const rateIqd = row.approvedRate * (exchangeRate / 100);
              const rateStr =
                currency === 'IQD'
                  ? `(IQD ${rateIqd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/hr)`
                  : `($${row.approvedRate.toFixed(2)}/hr)`;

              const printDate = new Date().toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={row.id}
                  className="envelope-print-container w-[22cm] h-[11cm] max-w-full bg-white rounded-2xl border-2 border-dashed border-slate-300 p-4 sm:p-5 shadow-xs flex flex-col justify-between relative overflow-hidden text-[#0b1c30] select-none shrink-0"
                  style={{ width: '22cm', height: '11cm' }}
                >
                  {/* Header of Envelope Slip with TIU Logo and Right-Aligned Identity Block */}
                  <div className="border-b border-slate-200 pb-2.5 flex justify-between items-start">
                    {/* Left Side: Logo and Official University Titles */}
                    <div className="flex items-center gap-3">
                      <img
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDoDDRqJXEliwiAbQj3HE8fZbuJHyNLm4oXuQQ5QO7nQeR8qOdesMMJqIyGvqtkCY9Rjzbsq1raOKhc9i3B1hmX-CKY9ZP_pb0ev_safjontFAUkVZbtIPdFcN0LFfGLhBh695WC0f-958s-4dkfKqnb-dqpdihEqMy9cF7CHQFDpWItxiA4tI327j1Yut7rDKyJsZsz6UFPox71r5RXf4cWZ-uwLT2qmPnLstL1KjH8AKbnjNDjRdJpgmI0MtJb09N4w"
                        alt="TIU Logo"
                        className="w-10 h-10 object-contain"
                      />
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                          Tishk International University - Sulaimani
                        </div>
                        <h3 className="font-headline font-extrabold text-sm sm:text-base text-[#540225] tracking-tight">
                          TIUS Extra Hours Payment
                        </h3>
                        <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                          Official Cash Disbursal Record
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Staff Details for Stack/Locker Sorting */}
                    <div className="text-right flex flex-col items-end max-w-[50%]">
                      <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                        {row.name}
                      </div>
                      <div className="text-base sm:text-lg font-semibold text-gray-600 leading-snug">
                        {row.departmentName || 'Computer Engineering'}
                      </div>
                    </div>
                  </div>

                  {/* Body: Payout Details & Metadata pushed down toward bottom */}
                  <div className="mt-6 sm:mt-8 space-y-2 text-xs flex-1 flex flex-col justify-end">
                    {/* Secondary metadata strip */}
                    <div className="flex items-center justify-between text-xs bg-slate-50/80 p-2 px-3.5 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500 font-medium">Rate:</span>
                        <span className="font-bold text-slate-800">{row.contractType} {rateStr}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500 font-medium">Extra Hours:</span>
                        <span className="font-extrabold text-slate-900">{row.billedHours.toFixed(1)} hrs</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500 font-medium">Date of Print:</span>
                        <span className="text-slate-700 font-semibold">{printDate}</span>
                      </div>
                    </div>

                    {/* TOTAL PAYMENT AMOUNT: Conditional USD/IQD display */}
                    {currency === 'USD' ? (
                      <div className="mt-1.5 p-2.5 px-3.5 rounded-xl bg-amber-50/90 border border-amber-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                            TOTAL PAYMENT AMOUNT
                          </span>
                          <div className="flex items-baseline gap-2">
                            <span className="font-headline font-black text-lg text-[#540225]">
                              {formattedUsd}
                            </span>
                            <span className="text-xs font-bold text-amber-900/80">
                              ({formattedIqd})
                            </span>
                          </div>
                        </div>
                        <div className="text-[10px] text-amber-800/80 mt-0.5 font-semibold text-right">
                          * Rate: {formattedRate} IQD / $100
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1.5 p-2.5 px-3.5 rounded-xl bg-amber-50/90 border border-amber-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                          TOTAL PAYMENT AMOUNT
                        </span>
                        <span className="font-headline font-black text-xl text-[#540225]">
                          {formattedIqd}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-8 border-t border-slate-100 flex items-center justify-between bg-white text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Exact DL envelope dimensions: 11cm × 22cm • Native printer support</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
