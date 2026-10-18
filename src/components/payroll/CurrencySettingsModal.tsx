'use client';

import React, { useState, useEffect } from 'react';
import { X, Coins, Lock } from 'lucide-react';

interface CurrencySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  exchangeRate: number;
  onSave: (exchangeRate: number) => void;
  financeCanEditExchange?: boolean;
}

export function CurrencySettingsModal({
  isOpen,
  onClose,
  exchangeRate: initialExchangeRate,
  onSave,
  financeCanEditExchange = true,
}: CurrencySettingsModalProps) {
  const [exchangeRate, setExchangeRate] = useState<number>(initialExchangeRate);

  useEffect(() => {
    if (isOpen) {
      setExchangeRate(initialExchangeRate);
    }
  }, [isOpen, initialExchangeRate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden text-left flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm shrink-0 border border-emerald-100">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-headline font-bold text-base text-[#0b1c30]">Currency Settings</h2>
              <p className="text-[11px] text-slate-500 font-medium">Manage IQD exchange rate</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 bg-white flex-1 overflow-y-auto">
          {financeCanEditExchange ? (
            /* ── Editable State ── */
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 ml-1">Exchange Rate</label>
              <div className="relative">
                <input
                  type="number"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value))}
                  className="w-full h-11 pl-4 pr-16 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  IQD / $100
                </span>
              </div>
              <p className="text-[11px] text-slate-500 ml-1">Set the conversion rate used to display Dinar values globally.</p>
            </div>
          ) : (
            /* ── Locked State ── */
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-200">
                <Lock className="w-7 h-7" />
              </div>
              <div className="text-center space-y-1.5 max-w-xs">
                <p className="text-sm font-bold text-slate-800">Exchange Rate Locked</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Exchange rate configuration is currently managed by Central Administration. Contact a Super Admin to modify this setting.
                </p>
              </div>
              <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Current Rate</span>
                <p className="text-lg font-headline font-bold text-slate-700 mt-0.5">
                  {(initialExchangeRate / 100).toLocaleString()} IQD / $1
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors"
          >
            {financeCanEditExchange ? 'Cancel' : 'Close'}
          </button>
          {financeCanEditExchange && (
            <button
              onClick={() => {
                onSave(exchangeRate);
                onClose();
              }}
              className="px-6 py-2.5 text-sm font-bold text-white bg-[#540225] hover:bg-[#721c3b] rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              Save Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
