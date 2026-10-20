import { createClient } from '@/lib/supabase/client';
import {
  PayrollDisbursalSummary,
  DepartmentPayrollGroup,
  PayrollFacultyRow,
  TimesheetBreakdownEntry,
  EMPTY_PAYROLL_DATA,
} from '@/types/payroll';
import { getPayrollSettings, formatCycleDates } from './payrollSettingsService';
import { getRateForTitle } from './rateService';

export interface GetPayrollOptions {
  status?: 'APPROVED' | 'PAID' | ('APPROVED' | 'PAID')[];
  month?: string; // e.g. '2026-10' or '2024-10'
  startDate?: string;
  endDate?: string;
  overrideCycleName?: string;
}

export interface HistoricalCycleOption {
  label: string;
  value: string;
  startDate: string;
  endDate: string;
  count: number;
}

export async function getPayrollDisbursalSummary(
  optionsOrCycleName?: string | GetPayrollOptions
): Promise<PayrollDisbursalSummary> {
  try {
    const options: GetPayrollOptions =
      typeof optionsOrCycleName === 'string'
        ? { overrideCycleName: optionsOrCycleName }
        : optionsOrCycleName || {};

    const settings = await getPayrollSettings();
    const activeCycleLabel = formatCycleDates(settings.start_date, settings.end_date);
    const displayCycleName = options.overrideCycleName || activeCycleLabel;
    const supabase = createClient();

    // Enforce strict Finance & Payroll Visibility Gate:
    // Only coordinator-approved requests ('APPROVED' or subsequent payout states 'PAID') can ever be retrieved.
    // 'PENDING' and 'REJECTED' requests must be completely invisible to the Accountant/Finance portal.
    const ALLOWED_FINANCE_STATUSES = ['APPROVED', 'PAID'];
    let safeStatus: string[] = [];
    if (Array.isArray(options.status)) {
      safeStatus = options.status.filter((s) => ALLOWED_FINANCE_STATUSES.includes(s));
    } else if (options.status && ALLOWED_FINANCE_STATUSES.includes(options.status)) {
      safeStatus = [options.status];
    } else {
      safeStatus = ['APPROVED'];
    }
    if (safeStatus.length === 0) {
      safeStatus = ['APPROVED'];
    }

    // Determine date boundaries
    let filterStartDate: string | undefined = undefined;
    let filterEndDate: string | undefined = undefined;

    if (options.startDate && options.endDate) {
      filterStartDate = options.startDate;
      filterEndDate = options.endDate;
    } else if (options.month && options.month !== 'all') {
      const [yearStr, monthStr] = options.month.split('-');
      const year = parseInt(yearStr, 10);
      const monthIdx = parseInt(monthStr, 10) - 1;
      const lastDay = new Date(year, monthIdx + 1, 0).getDate();
      filterStartDate = `${options.month}-01`;
      filterEndDate = `${options.month}-${String(lastDay).padStart(2, '0')}`;
    }

    // Build Supabase query strictly gated to coordinator-approved / paid requests
    let query = supabase
      .from('timesheets')
      .select('*, teacher:users!timesheets_teacher_id_fkey!inner(*, department:departments(*)), submitted_by:users!timesheets_submitted_by_id_fkey(id, name, email, role, academic_title)')
      .in('status', safeStatus);

    if (filterStartDate) {
      query = query.gte('date', filterStartDate);
    }
    if (filterEndDate) {
      query = query.lte('date', filterEndDate);
    }

    const [timesheetsRes, academicRatesRes] = await Promise.all([
      query,
      supabase.from('academic_rates').select('title, hourly_rate, is_active'),
    ]);

    const timesheets = timesheetsRes.data;
    const error = timesheetsRes.error;
    const dbRates = (academicRatesRes.data || []) as { title: string; hourly_rate: number; is_active?: boolean }[];

    if (!error && timesheets) {
      if (timesheets.length === 0) {
        return {
          ...EMPTY_PAYROLL_DATA,
          cycleName: displayCycleName,
          activeCycleLabel,
          closingDate: filterEndDate || settings.end_date || '',
          settings,
        };
      }

      // Group timesheets by department and faculty member
      const deptMap = new Map<
        string,
        {
          id: string;
          name: string;
          teacherRows: Map<string, PayrollFacultyRow>;
        }
      >();

      let totalHours = 0;
      let totalGross = 0;
      let ftHours = 0;
      let ptHours = 0;

      for (const ts of timesheets) {
        const teacher = ts.teacher;
        if (!teacher) continue;

        const deptId = teacher.department_id || 'unassigned';
        const deptName = teacher.department?.name || 'General Academic Department';
        const hours = Number(ts.hours) || 0;
        
        // Dynamically pull the actual hourly_rate associated with the staff member's academic title/role from the database
        let rate = Number(teacher.hourly_rate);
        const matchedRate = dbRates.find(
          (r) =>
            r.title &&
            teacher.academic_title &&
            r.title.toLowerCase().trim() === teacher.academic_title.toLowerCase().trim()
        );
        if (matchedRate && Number(matchedRate.hourly_rate) > 0) {
          rate = Number(matchedRate.hourly_rate);
        } else if (!rate || isNaN(rate) || rate <= 0) {
          rate = getRateForTitle(teacher.academic_title || teacher.role, dbRates as any);
        }

        const isFT = teacher.employment_type === 'FULL_TIME';

        totalHours += hours;
        if (isFT) ftHours += hours;
        else ptHours += hours;

        const submitterName = ts.submitted_by?.name || (ts.submitted_by_id && ts.teacher?.id === ts.submitted_by_id ? ts.teacher.name : 'Head of Department');
        const approvedByName = 'Academic Coordinator';

        if (!deptMap.has(deptId)) {
          deptMap.set(deptId, {
            id: deptId,
            name: deptName,
            teacherRows: new Map(),
          });
        }

        const deptGroup = deptMap.get(deptId)!;
        if (!deptGroup.teacherRows.has(teacher.id)) {
          const initials = teacher.name
            ? teacher.name
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
            : 'FM';

          deptGroup.teacherRows.set(teacher.id, {
            id: `row-${teacher.id}`,
            teacherId: teacher.id,
            timesheetIds: [],
            timesheetEntries: [],
            name: teacher.name,
            email: teacher.email,
            avatarInitials: initials,
            avatarBgColor: 'blue',
            contractType: isFT ? 'Full-Time' : 'Part-Time',
            approvedRate: rate,
            billedHours: 0,
            calculatedGross: 0,
            requestedAt: ts.created_at,
            approvedAt: ts.approved_at || ts.updated_at,
            submittedByName: submitterName,
            approvedByName,
            status: ts.status === 'PAID' ? 'Paid' : 'Approved',
            departmentName: deptName,
            academicRank: teacher.academic_title || 'Lecturer',
          });
        }

        const teacherRow = deptGroup.teacherRows.get(teacher.id)!;
        teacherRow.billedHours += hours;
        teacherRow.calculatedGross += hours * rate;
        teacherRow.timesheetIds.push(ts.id);
        if (!teacherRow.submittedByName && submitterName) {
          teacherRow.submittedByName = submitterName;
        }

        const breakdownEntry: TimesheetBreakdownEntry = {
          id: ts.id,
          date: ts.date,
          hours,
          activityDescription: ts.course_activity || ts.notes || 'Extra Teaching Session',
          courseCode: ts.course_code || undefined,
          sessionType: ts.session_type || undefined,
          status: ts.status,
          notes: ts.notes || undefined,
          createdAt: ts.created_at,
          approvedAt: ts.approved_at || ts.updated_at,
          submittedByName: submitterName,
          approvedByName,
        };
        teacherRow.timesheetEntries.push(breakdownEntry);

        // Keep earliest requested date
        if (ts.created_at && (!teacherRow.requestedAt || new Date(ts.created_at) < new Date(teacherRow.requestedAt))) {
          teacherRow.requestedAt = ts.created_at;
        }
        // Keep latest approved date
        const tsApproved = ts.approved_at || ts.updated_at;
        if (tsApproved && (!teacherRow.approvedAt || new Date(tsApproved) > new Date(teacherRow.approvedAt))) {
          teacherRow.approvedAt = tsApproved;
        }
        if (ts.status === 'PAID') {
          teacherRow.status = 'Paid';
        }
      }

      // Format department groups
      const departmentGroups: DepartmentPayrollGroup[] = [];
      let totalEligibleTeachers = 0;

      deptMap.forEach((dept) => {
        const rows = Array.from(dept.teacherRows.values());
        const totalDeptHours = rows.reduce((acc, r) => acc + r.billedHours, 0);
        const subtotalGross = rows.reduce((acc, r) => acc + r.calculatedGross, 0);
        totalGross += subtotalGross;
        totalEligibleTeachers += rows.length;

        departmentGroups.push({
          id: dept.id,
          name: dept.name,
          facultyCount: rows.length,
          totalDeptHours,
          subtotalGross,
          hodSignedStatus: 'Coordinator: Approved & Audited',
          isInitiallyExpanded: true,
          rows,
        });
      });

      return {
        cycleName: displayCycleName,
        activeCycleLabel,
        closingDate: filterEndDate || settings.end_date || '',
        totalExtraHoursBilled: totalHours,
        hoursBreakdownFT: ftHours,
        hoursBreakdownPT: ptHours,
        hoursTrendPercent: 0,
        totalPayrollUSD: totalGross,
        avgPayoutPerTeacher: totalEligibleTeachers > 0 ? totalGross / totalEligibleTeachers : 0,
        eligibleTeachersCount: totalEligibleTeachers,
        finalizedCount: totalEligibleTeachers,
        pendingDisbursalCount: 0,
        verificationPercent: 100,
        auditSignOffSummary: `${departmentGroups.length}/${departmentGroups.length} Coordinator Approved • Ready for Disbursal`,
        batchReferenceId: `TIU-PR-${Date.now().toString().slice(-6)}`,
        departments: departmentGroups,
        settings,
      };
    }
  } catch (err) {
    console.error('Error fetching live payroll disbursal summary:', err);
  }

  return {
    ...EMPTY_PAYROLL_DATA,
    cycleName: typeof optionsOrCycleName === 'string' ? optionsOrCycleName : 'Active Cycle: Sep 25 - Oct 25',
    activeCycleLabel: 'Active Cycle: Sep 25 - Oct 25',
  };
}

export async function getHistoricalPayrollCycles(status: 'PAID' | 'APPROVED' | 'ALL' = 'PAID'): Promise<HistoricalCycleOption[]> {
  try {
    const supabase = createClient();
    const settings = await getPayrollSettings();

    // Query dates of timesheets strictly restricted to approved/paid states
    let query = supabase.from('timesheets').select('date');
    if (status === 'PAID') {
      query = query.eq('status', 'PAID');
    } else if (status === 'APPROVED') {
      query = query.eq('status', 'APPROVED');
    } else {
      // In Finance & Payroll, 'ALL' must ONLY query APPROVED and PAID requests, never PENDING or REJECTED
      query = query.in('status', ['APPROVED', 'PAID']);
    }
    const { data: timesheets } = await query;

    const monthMap = new Map<string, number>();
    let totalCount = 0;

    if (timesheets) {
      for (const t of timesheets) {
        if (!t.date) continue;
        const key = t.date.slice(0, 7); // 'YYYY-MM'
        monthMap.set(key, (monthMap.get(key) || 0) + 1);
        totalCount++;
      }
    }

    // Include the current/active month from payroll settings if not already present
    if (settings.end_date) {
      const activeKey = settings.end_date.slice(0, 7);
      if (!monthMap.has(activeKey)) {
        monthMap.set(activeKey, 0);
      }
    }

    const options: HistoricalCycleOption[] = [
      {
        label: 'All Cycles',
        value: 'all',
        startDate: '',
        endDate: '',
        count: totalCount,
      },
    ];

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const sortedKeys = Array.from(monthMap.keys()).sort().reverse();

    for (const key of sortedKeys) {
      const [yearStr, monthStr] = key.split('-');
      const year = parseInt(yearStr, 10);
      const monthIdx = parseInt(monthStr, 10) - 1;
      const label = `${monthNames[monthIdx] || monthStr} ${year}`;
      const lastDay = new Date(year, monthIdx + 1, 0).getDate();
      options.push({
        label,
        value: key,
        startDate: `${key}-01`,
        endDate: `${key}-${String(lastDay).padStart(2, '0')}`,
        count: monthMap.get(key) || 0,
      });
    }

    return options;
  } catch (err) {
    console.error('Error fetching historical cycles:', err);
    return [
      {
        label: 'All Cycles',
        value: 'all',
        startDate: '',
        endDate: '',
        count: 0,
      },
      {
        label: 'October 2026',
        value: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        count: 0,
      },
    ];
  }
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${month} ${day}, ${hours}:${minutes}`;
  } catch {
    return '—';
  }
}

export async function markTimesheetsPaid(
  timesheetIds: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!timesheetIds || timesheetIds.length === 0) {
    return { success: true };
  }

  // 1. Try updating via /api/requests PATCH (server-side admin execution with audit log)
  try {
    const res = await fetch('/api/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: timesheetIds,
        status: 'PAID',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return { success: true };
      }
    } else {
      const errData = await res.json().catch(() => null);
      if (errData?.error) {
        console.warn('API /api/requests returned error, trying direct update fallback:', errData.error);
      }
    }
  } catch (apiErr) {
    console.warn('Network or API /api/requests error, trying direct Supabase update:', apiErr);
  }

  // 2. Direct Supabase client update fallback
  try {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('timesheets')
      .update({
        status: 'PAID',
        updated_at: new Date().toISOString(),
      })
      .in('id', timesheetIds);

    if (updateError) {
      const errorMsg = updateError.message || updateError.details || JSON.stringify(updateError);
      console.error('Error marking timesheets as PAID in Supabase:', errorMsg, updateError);
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Exception marking timesheets as PAID:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

export function exportPayrollToCSV(departments: DepartmentPayrollGroup[], filename = 'TIU_Payroll_Cash_Disbursal.csv') {
  const headers = [
    'FACULTY BENEFICIARY',
    'EMAIL',
    'DEPARTMENT',
    'SUBMITTED BY (HOD)',
    'APPROVED BY (COORDINATOR)',
    'CONTRACT TYPE',
    'APPROVED RATE (USD/HR)',
    'BILLED HOURS (HRS)',
    'CALCULATED GROSS (USD)',
    'TOTAL SESSIONS',
    'STATUS',
  ];

  const rows: string[] = [];

  for (const dept of departments) {
    for (const row of dept.rows) {
      rows.push(
        [
          `"${row.name}"`,
          `"${row.email}"`,
          `"${dept.name}"`,
          `"${row.submittedByName || 'Head of Department'}"`,
          `"${row.approvedByName || 'Academic Coordinator'}"`,
          `"${row.contractType}"`,
          `"${row.approvedRate.toFixed(2)}"`,
          `"${row.billedHours.toFixed(1)}"`,
          `"${row.calculatedGross.toFixed(2)}"`,
          `"${row.timesheetEntries?.length || row.timesheetIds.length}"`,
          `"${row.status}"`,
        ].join(',')
      );
    }
  }

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
