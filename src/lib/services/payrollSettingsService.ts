import { createClient } from '@/lib/supabase/client';
import { PayrollSettings } from '@/types/database';

const STORAGE_SETTINGS_KEY = 'tius_payroll_settings_v1';
export const SETTINGS_SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Helper to format day with ordinal suffix (e.g., 1st, 2nd, 3rd, 20th, 25th).
 */
export function getDayOrdinal(day: number): string {
  const d = Math.abs(Math.round(day));
  const rem100 = d % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${d}th`;
  switch (d % 10) {
    case 1: return `${d}st`;
    case 2: return `${d}nd`;
    case 3: return `${d}rd`;
    default: return `${d}th`;
  }
}

/**
 * Computes automatic university cycle dates for any customizable rollover day (1 to 31).
 * Aligns the billing window from the {auto_cycle_day}th of the previous month
 * to the {auto_cycle_day}th of the current month.
 *
 * Example: If current month is October and rolloverDay is 20:
 * Start Date: Sept 20, End Date: Oct 20.
 */
export function computeAutoCycleDates(
  rolloverDay: number = 25,
  referenceDate: Date = new Date()
): {
  startDate: string;
  endDate: string;
  label: string;
} {
  const safeDay = Math.min(Math.max(Number(rolloverDay) || 25, 1), 31);
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0-indexed: 0 = Jan, 9 = Oct

  // Previous month and current month
  let startYear = year;
  let startMonth = month; // in 1-indexed (e.g. if month is 9 (Oct), startMonth is 9 (Sep))
  if (month === 0) {
    startYear = year - 1;
    startMonth = 12;
  }

  const endYear = year;
  const endMonth = month + 1; // current month in 1-indexed

  // Clamped days to safely handle months with fewer days (e.g. Feb 28/29, Sep 30)
  const maxDaysInStartMonth = new Date(startYear, startMonth, 0).getDate();
  const maxDaysInEndMonth = new Date(endYear, endMonth, 0).getDate();

  const clampedStartDay = Math.min(safeDay, maxDaysInStartMonth);
  const clampedEndDay = Math.min(safeDay, maxDaysInEndMonth);

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const startDate = `${startYear}-${pad(startMonth)}-${pad(clampedStartDay)}`;
  const endDate = `${endYear}-${pad(endMonth)}-${pad(clampedEndDay)}`;

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const startMonthName = monthNames[startMonth - 1] || 'Sep';
  const endMonthName = monthNames[endMonth - 1] || 'Oct';

  const label = `Active Cycle: ${startMonthName} ${clampedStartDay} - ${endMonthName} ${clampedEndDay}`;

  return { startDate, endDate, label };
}

/**
 * Backwards compatible alias for 25th-to-25th schedule.
 */
export function compute25thCycleDates(referenceDate: Date = new Date()): {
  startDate: string;
  endDate: string;
  label: string;
} {
  return computeAutoCycleDates(25, referenceDate);
}

/**
 * Format cycle dates into human-friendly string (e.g., "Sep 25 - Oct 25")
 */
export function formatCycleDates(startDateStr: string, endDateStr: string): string {
  if (!startDateStr || !endDateStr) return 'Active Cycle: Sep 25 - Oct 25';

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  try {
    const [sY, sM, sD] = startDateStr.split('-').map(Number);
    const [eY, eM, eD] = endDateStr.split('-').map(Number);

    const startMonth = monthNames[sM - 1] || 'Sep';
    const endMonth = monthNames[eM - 1] || 'Oct';

    return `Active Cycle: ${startMonth} ${sD} - ${endMonth} ${eD}`;
  } catch {
    return `Active Cycle: ${startDateStr} - ${endDateStr}`;
  }
}

/**
 * Returns default fallback settings
 */
export function getDefaultPayrollSettings(): PayrollSettings {
  const defaultDay = 25;
  const { startDate, endDate, label } = computeAutoCycleDates(defaultDay);
  return {
    id: SETTINGS_SINGLETON_ID,
    auto_lock: true,
    auto_cycle_day: defaultDay,
    start_date: startDate,
    end_date: endDate,
    is_locked: false,
    cycle_name: label,
  };
}

/**
 * Fetch payroll settings from Supabase payroll_settings table.
 * Falls back cleanly to localStorage / defaults if table is empty or inaccessible.
 */
export async function getPayrollSettings(): Promise<PayrollSettings> {
  const defaults = getDefaultPayrollSettings();

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('payroll_settings')
      .select('id, auto_lock, auto_cycle_day, start_date, end_date, is_locked, cycle_name, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const isAuto = Boolean(data.auto_lock);
      const autoDay = Number(data.auto_cycle_day) || defaults.auto_cycle_day || 25;
      let finalStartDate = String(data.start_date || defaults.start_date);
      let finalEndDate = String(data.end_date || defaults.end_date);

      // If auto_lock is enabled, dynamically align with auto_cycle_day schedule
      if (isAuto) {
        const autoDates = computeAutoCycleDates(autoDay);
        finalStartDate = autoDates.startDate;
        finalEndDate = autoDates.endDate;
      }

      const settings: PayrollSettings = {
        id: String(data.id || defaults.id),
        auto_lock: isAuto,
        auto_cycle_day: autoDay,
        start_date: finalStartDate,
        end_date: finalEndDate,
        is_locked: Boolean(data.is_locked),
        cycle_name: formatCycleDates(finalStartDate, finalEndDate),
        updated_at: data.updated_at ? String(data.updated_at) : new Date().toISOString(),
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
      }
      return settings;
    }
  } catch (err) {
    console.warn('[Payroll Settings] Supabase query notice:', err);
  }

  // Check localStorage cache
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.start_date && parsed?.end_date) {
          const autoDay = Number(parsed.auto_cycle_day) || 25;
          if (parsed.auto_lock) {
            const autoDates = computeAutoCycleDates(autoDay);
            parsed.start_date = autoDates.startDate;
            parsed.end_date = autoDates.endDate;
            parsed.cycle_name = autoDates.label;
          }
          parsed.auto_cycle_day = autoDay;
          return parsed as PayrollSettings;
        }
      }
    } catch {}
  }

  return defaults;
}

/**
 * Update payroll settings in Supabase and sync local state.
 */
export async function updatePayrollSettings(
  updates: Partial<PayrollSettings>
): Promise<{ success: boolean; data?: PayrollSettings; error?: string }> {
  const current = await getPayrollSettings();
  const now = new Date().toISOString();

  const isAuto = updates.auto_lock !== undefined ? updates.auto_lock : current.auto_lock;
  const autoDay = updates.auto_cycle_day !== undefined ? updates.auto_cycle_day : (current.auto_cycle_day ?? 25);
  let nextStartDate = updates.start_date ?? current.start_date;
  let nextEndDate = updates.end_date ?? current.end_date;

  if (isAuto) {
    const auto = computeAutoCycleDates(autoDay);
    nextStartDate = auto.startDate;
    nextEndDate = auto.endDate;
  }

  const cycleLabel = formatCycleDates(nextStartDate, nextEndDate);

  const updatedRecord: PayrollSettings = {
    ...current,
    ...updates,
    auto_lock: isAuto,
    auto_cycle_day: autoDay,
    start_date: nextStartDate,
    end_date: nextEndDate,
    cycle_name: cycleLabel,
    updated_at: now,
  };

  // Sync localStorage immediately
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(updatedRecord));

    // Try posting to admin server endpoint first to bypass client RLS seamlessly
    try {
      const res = await fetch('/api/payroll-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRecord),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(json.data));
          return { success: true, data: json.data };
        }
      }
    } catch (apiErr) {
      console.warn('[Payroll Settings] Admin endpoint fetch error, falling back:', apiErr);
    }
  }

  try {
    const supabase = createClient();

    // Check if row exists in table
    const { data: existingRows } = await supabase
      .from('payroll_settings')
      .select('id')
      .limit(1);

    let opError = null;

    if (existingRows && existingRows.length > 0) {
      const targetId = existingRows[0].id;
      const { error } = await supabase
        .from('payroll_settings')
        .update({
          auto_lock: updatedRecord.auto_lock,
          auto_cycle_day: updatedRecord.auto_cycle_day,
          start_date: updatedRecord.start_date,
          end_date: updatedRecord.end_date,
          is_locked: updatedRecord.is_locked,
          cycle_name: updatedRecord.cycle_name,
          updated_at: now,
        })
        .eq('id', targetId);
      opError = error;
    } else {
      const { error } = await supabase
        .from('payroll_settings')
        .insert({
          id: updatedRecord.id,
          auto_lock: updatedRecord.auto_lock,
          auto_cycle_day: updatedRecord.auto_cycle_day,
          start_date: updatedRecord.start_date,
          end_date: updatedRecord.end_date,
          is_locked: updatedRecord.is_locked,
          cycle_name: updatedRecord.cycle_name,
          updated_at: now,
        });
      opError = error;
    }

    if (opError) {
      console.warn('[Payroll Settings] Supabase write notice (cached locally):', opError.message);
      return { success: true, data: updatedRecord, error: opError.message };
    }

    return { success: true, data: updatedRecord };
  } catch (err: unknown) {
    console.error('[Payroll Settings] Exception updating settings:', err);
    return {
      success: true,
      data: updatedRecord,
      error: err instanceof Error ? err.message : 'Unknown write error',
    };
  }
}

/**
 * Checks if a timesheet date falls within a locked payroll cycle.
 */
export async function isDateInLockedPayrollCycle(
  dateStr: string
): Promise<{ isLocked: boolean; cycleLabel: string }> {
  try {
    const settings = await getPayrollSettings();
    if (!settings.is_locked) {
      return { isLocked: false, cycleLabel: '' };
    }

    if (dateStr >= settings.start_date && dateStr <= settings.end_date) {
      return {
        isLocked: true,
        cycleLabel: formatCycleDates(settings.start_date, settings.end_date),
      };
    }
  } catch (err) {
    console.error('[Payroll Settings] Error checking date lock:', err);
  }

  return { isLocked: false, cycleLabel: '' };
}
