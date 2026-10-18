'use client';

import React, { useState, useEffect } from 'react';
import { AcademicRate } from '@/types/database';
import { X, Check, DollarSign, AlertCircle } from 'lucide-react';

interface EditRateModalProps {
  rate: AcademicRate | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, newRate: number, isActive?: boolean) => Promise<void>;
  baseCurrency?: 'USD' | 'IQD';
  exchangeRate?: number;
}

export function EditRateModal({
  rate,
  isOpen,
  onClose,
  onSave,
  baseCurrency = 'USD',
  exchangeRate = 150000,
}: EditRateModalProps) {
  const [hourlyRate, setHourlyRate] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const multiplier = exchangeRate / 100;
  const isIQD = baseCurrency === 'IQD';

  useEffect(() => {
    if (rate) {
      setIsActive(rate.is_active !== false);
      if (isIQD) {
        const iqdVal = Math.round(rate.hourly_rate * multiplier);
        setHourlyRate(String(iqdVal));
      } else {
        setHourlyRate(rate.hourly_rate.toFixed(2));
      }
      setError(null);
    }
  }, [rate, isOpen, isIQD, multiplier]);

  if (!isOpen || !rate) return null;

  const currentDisplay = isIQD
    ? `${Math.round(rate.hourly_rate * multiplier).toLocaleString()} IQD`
    : `$${rate.hourly_rate.toFixed(2)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(hourlyRate);
    if (isNaN(num) || num <= 0) {
      setError(`Please provide a valid positive hourly rate (e.g. ${isIQD ? '75,000' : '45.00'}).`);
      return;
    }
    const maxVal = isIQD ? 500 * multiplier : 500;
    if (num > maxVal) {
      setError(`Hourly rate cannot exceed ${isIQD ? `${maxVal.toLocaleString()} IQD/hr` : '$500.00/hr'}.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const rateInUSD = isIQD ? num / multiplier : num;
      await onSave(rate.id, rateInUSD, isActive);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update academic rate';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden text-left flex flex-col">
        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="font-headline text-xl font-bold text-[#0b1c30]">
              Edit Academic Rate
            </h2>
            <p className="text-xs text-slate-500">
              Update institutional compensation tier for <strong className="text-slate-800 font-semibold">{rate.title}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Academic Title Display */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Academic Title</label>
            <div className="w-full h-10 px-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 flex items-center">
              {rate.title}
            </div>
          </div>

          {/* Hourly Rate Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Hourly Rate ({isIQD ? 'IQD' : '$ USD'} / hr) *</span>
              <span className="text-[11px] text-slate-400">Current: {currentDisplay}</span>
            </label>
            <div className="relative">
              {isIQD ? (
                <span className="text-xs font-bold text-slate-500 absolute left-3.5 top-3.5 pointer-events-none">
                  IQD
                </span>
              ) : (
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              )}
              <input
                type="number"
                step={isIQD ? '500' : '0.5'}
                min={isIQD ? '1000' : '5'}
                max={isIQD ? 500 * multiplier : 500}
                required
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder={isIQD ? '75000' : '45.00'}
                className={`w-full h-11 ${isIQD ? 'pl-13' : 'pl-9'} pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:bg-white font-mono`}
              />
            </div>
          </div>

          {/* Policy Status Toggle */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-slate-700">Policy Status</label>
            <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/80">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <span className="text-xs font-bold text-slate-800">
                    {isActive ? 'Active Policy' : 'Deactivated Policy'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  {isActive
                    ? 'Available to assign when adding or editing teachers.'
                    : 'Hidden from teacher selection forms; preserved for existing payroll history.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
                  isActive ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                    isActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-70 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Update Rate Tier</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
