export type PayrollStatus = 'Finalized' | 'Approved' | 'Paid' | 'Pending Disbursal';

export interface TimesheetBreakdownEntry {
  id: string;
  date: string;
  hours: number;
  activityDescription: string;
  courseCode?: string;
  sessionType?: string;
  status: string;
  notes?: string;
  createdAt?: string;
  approvedAt?: string | null;
}

export interface PayrollFacultyRow {
  id: string;
  teacherId: string;
  timesheetIds: string[];
  timesheetEntries: TimesheetBreakdownEntry[];
  name: string;
  email: string;
  avatarInitials: string;
  avatarBgColor: 'pink' | 'blue' | 'yellow' | 'purple' | 'emerald';
  contractType: 'Full-Time' | 'Part-Time';
  approvedRate: number; // e.g. 45.00
  billedHours: number; // e.g. 28.5
  calculatedGross: number; // e.g. 1282.50
  requestedAt?: string | null;
  approvedAt?: string | null;
  status: PayrollStatus;
  departmentName?: string;
  academicRank?: string;
}

export interface DepartmentPayrollGroup {
  id: string;
  name: string;
  facultyCount: number;
  totalDeptHours: number;
  subtotalGross: number;
  hodSignedStatus: string;
  isInitiallyExpanded?: boolean;
  rows: PayrollFacultyRow[];
}

import { PayrollSettings } from './database';

export interface PayrollDisbursalSummary {
  cycleName: string;
  activeCycleLabel: string;
  closingDate: string;
  totalExtraHoursBilled: number;
  hoursBreakdownFT: number;
  hoursBreakdownPT: number;
  hoursTrendPercent: number;
  totalPayrollUSD: number;
  avgPayoutPerTeacher: number;
  eligibleTeachersCount: number;
  finalizedCount: number;
  pendingDisbursalCount: number;
  verificationPercent: number;
  auditSignOffSummary: string;
  batchReferenceId: string;
  departments: DepartmentPayrollGroup[];
  settings?: PayrollSettings;
}

export const EMPTY_PAYROLL_DATA: PayrollDisbursalSummary = {
  cycleName: 'Cycle: October 2024',
  activeCycleLabel: 'Active Cycle: Sep 25 - Oct 25',
  closingDate: 'End of Month',
  totalExtraHoursBilled: 0,
  hoursBreakdownFT: 0,
  hoursBreakdownPT: 0,
  hoursTrendPercent: 0,
  totalPayrollUSD: 0,
  avgPayoutPerTeacher: 0,
  eligibleTeachersCount: 0,
  finalizedCount: 0,
  pendingDisbursalCount: 0,
  verificationPercent: 100,
  auditSignOffSummary: '0 HoD Signed • Ready for disbursal',
  batchReferenceId: 'TIU-PR-EMPTY',
  departments: [],
};

