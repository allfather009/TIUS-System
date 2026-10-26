/**
 * Helper to calculate calendar week boundaries (Monday 00:00:00 to Sunday 23:59:59).
 * Used for cumulative weekly extra hours cap calculation and validation.
 */

export interface WeekRange {
  startDate: string; // YYYY-MM-DD (Monday)
  endDate: string;   // YYYY-MM-DD (Sunday)
  startDateTime: Date;
  endDateTime: Date;
  label: string;
}

/**
 * Given a request date (Date object or YYYY-MM-DD string),
 * returns the start (Monday) and end (Sunday) of that calendar week.
 */
export function getWeekRange(dateInput: Date | string): WeekRange {
  let dt: Date;

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      // Parse YYYY-MM-DD directly at noon local time to prevent timezone shift issues
      const [y, m, d] = trimmed.split('T')[0].split('-').map(Number);
      dt = new Date(y, m - 1, d, 12, 0, 0);
    } else {
      dt = new Date(trimmed);
    }
  } else if (dateInput instanceof Date) {
    dt = new Date(dateInput.getTime());
  } else {
    dt = new Date();
  }

  if (isNaN(dt.getTime())) {
    dt = new Date();
  }

  // Calculate Monday (start of week) and Sunday (end of week)
  // getDay(): 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const day = dt.getDay();
  // If Sunday (0), Monday is 6 days ago (-6). Otherwise, Monday is (1 - day) days ago.
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + diffToMonday, 0, 0, 0, 0);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const toIsoDate = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const startDate = toIsoDate(monday);
  const endDate = toIsoDate(sunday);

  const monMonth = monday.toLocaleDateString('en-US', { month: 'short' });
  const sunMonth = sunday.toLocaleDateString('en-US', { month: 'short' });

  let label = '';
  if (monMonth === sunMonth) {
    label = `Week of ${monMonth} ${monday.getDate()}–${sunday.getDate()}`;
  } else {
    label = `Week of ${monMonth} ${monday.getDate()} – ${sunMonth} ${sunday.getDate()}`;
  }

  return {
    startDate,
    endDate,
    startDateTime: monday,
    endDateTime: sunday,
    label,
  };
}
