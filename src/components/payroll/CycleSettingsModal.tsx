'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  RefreshCw,
  Clock,
  ShieldAlert,
  Banknote,
} from 'lucide-react';
import { PayrollSettings } from '@/types/database';
import {
  computeAutoCycleDates,
  formatCycleDates,
  getDayOrdinal,
} from '@/lib/services/payrollSettingsService';
import { CustomSelect, CustomSelectOption } from '@/components/ui/CustomSelect';

interface CycleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PayrollSettings;
  onSave: (updated: Partial<PayrollSettings>) => Promise<void>;
}

export function CycleSettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
}: CycleSettingsModalProps) {
  const [autoLock, setAutoLock] = useState(settings?.auto_lock ?? true);
  const [autoCycleDay, setAutoCycleDay] = useState<number>(settings?.auto_cycle_day ?? 25);
  const [startDate, setStartDate] = useState(settings?.start_date || '');
  const [endDate, setEndDate] = useState(settings?.end_date || '');
  const [isLocked, setIsLocked] = useState(settings?.is_locked ?? false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cycleDayOptions: CustomSelectOption[] = useMemo(() => {
    return Array.from({ length: 31 }, (_, i) => i + 1).map((day) => ({
      value: String(day),
      label: `${day} (${getDayOrdinal(day)})`,
    }));
  }, []);

  // Sync state whenever modal opens or settings change
  useEffect(() => {
    if (isOpen && settings) {
      const isAuto = settings.auto_lock ?? true;
      const day = settings.auto_cycle_day ?? 25;
      setAutoLock(isAuto);
      setAutoCycleDay(day);
      if (isAuto) {
        const auto = computeAutoCycleDates(day);
        setStartDate(auto.startDate);
        setEndDate(auto.endDate);
      } else {
        setStartDate(settings.start_date || '');
        setEndDate(settings.end_date || '');
      }
      setIsLocked(settings.is_locked ?? false);

      setErrorMsg(null);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleToggleAuto = () => {
    const nextAuto = !autoLock;
    setAutoLock(nextAuto);
    if (nextAuto) {
      const auto = computeAutoCycleDates(autoCycleDay);
      setStartDate(auto.startDate);
      setEndDate(auto.endDate);
    }
  };

  const handleCycleDayChange = (newDay: number) => {
    setAutoCycleDay(newDay);
    if (autoLock) {
      const auto = computeAutoCycleDates(newDay);
      setStartDate(auto.startDate);
      setEndDate(auto.endDate);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!startDate || !endDate) {
      setErrorMsg('Both start and end dates are required for the payroll cycle.');
      return;
    }

    if (startDate > endDate) {
      setErrorMsg('Start date cannot be after the end date.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        auto_lock: autoLock,
        auto_cycle_day: autoCycleDay,
        start_date: startDate,
        end_date: endDate,
        is_locked: isLocked,
        cycle_name: formatCycleDates(startDate, endDate),

      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update payroll cycle settings');
    } finally {
      setSaving(false);
    }
  };

  const cyclePreview = formatCycleDates(startDate, endDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-[#eff4ff] via-slate-50 to-[#fff8f6] border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#540225] text-white flex items-center justify-center shadow-md">
              <Calendar className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-[#0b1c30]">
                Cycle Settings &amp; Lockout
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Configure dynamic billing windows and global submission freeze
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Active Cycle Preview Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Target Payroll Window
              </span>
              <p className="font-headline font-bold text-sm text-[#0b1c30]">
                {cyclePreview}
              </p>
            </div>
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                isLocked
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              {isLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-red-600" />
                  <span>Cycle Locked</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Cycle Open</span>
                </>
              )}
            </div>
          </div>

          {/* Control 1: Auto-Lock Toggle & Customizable Rollover Day */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors space-y-3.5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-700" />
                  <label className="font-bold text-xs text-slate-900 cursor-pointer" onClick={handleToggleAuto}>
                    Enable Automatic Rolling Cycle
                  </label>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Automatically aligns the billing window from the {getDayOrdinal(autoCycleDay)} of the previous month to the {getDayOrdinal(autoCycleDay)} of the current month.
                </p>
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={autoLock}
                onClick={handleToggleAuto}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 ${
                  autoLock ? 'bg-[#540225]' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    autoLock ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* When toggle is active: Reveal Cycle Rollover Day Dropdown */}
            {autoLock && (
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="space-y-0.5">
                  <label htmlFor="cycle-rollover-day" className="block text-xs font-bold text-slate-800">
                    Cycle Rollover Day
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Select monthly rollover boundary (1 through 31)
                  </span>
                </div>

                <div className="min-w-[150px]">
                  <CustomSelect
                    id="cycle-rollover-day"
                    value={String(autoCycleDay)}
                    onChange={(val) => handleCycleDayChange(Number(val))}
                    options={cycleDayOptions}
                    placeholder="Select Day..."
                    searchable={false}
                    triggerClassName="h-10"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Control 2: Date Overrides */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                Cycle Date Overrides
              </label>
              {autoLock && (
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  Locked by Auto Cycle
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Start Date */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">
                  Cycle Start Date
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={autoLock}
                  className={`w-full h-11 px-3.5 rounded-xl border text-xs font-semibold transition-all ${
                    autoLock
                      ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed opacity-80'
                      : 'bg-white text-slate-900 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:border-[#721c3b]'
                  }`}
                />
              </div>

              {/* End Date */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">
                  Cycle End Date
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={autoLock}
                  className={`w-full h-11 px-3.5 rounded-xl border text-xs font-semibold transition-all ${
                    autoLock
                      ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed opacity-80'
                      : 'bg-white text-slate-900 border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#721c3b]/30 focus:border-[#721c3b]'
                  }`}
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-normal">
              {autoLock
                ? 'Date fields are read-only while Automatic Cycle is enabled. Toggle OFF to set custom fiscal dates.'
                : 'Finance override active: Enter custom start and end boundaries for this cycle.'}
            </p>
          </div>

          {/* Control 3: System Lock Toggle */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isLocked
                ? 'bg-red-50/70 border-red-200 shadow-xs'
                : 'bg-slate-50/70 border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {isLocked ? (
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-600" />
                  )}
                  <label
                    className={`font-bold text-xs cursor-pointer ${
                      isLocked ? 'text-red-900' : 'text-slate-900'
                    }`}
                    onClick={() => setIsLocked(!isLocked)}
                  >
                    Lock System for Current Cycle
                  </label>
                </div>
                <p className={`text-[11px] leading-relaxed ${isLocked ? 'text-red-700' : 'text-slate-500'}`}>
                  When active, no Teacher or HOD can add, edit, or approve hours falling between{' '}
                  <span className="font-semibold">{startDate || 'start'}</span> and{' '}
                  <span className="font-semibold">{endDate || 'end'}</span>.
                </p>
              </div>

              {/* Master Lock switch */}
              <button
                type="button"
                role="switch"
                aria-checked={isLocked}
                onClick={() => setIsLocked(!isLocked)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500/30 ${
                  isLocked ? 'bg-red-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isLocked ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#540225] hover:bg-[#721c3b] text-white text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to Supabase...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>Save Cycle Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
