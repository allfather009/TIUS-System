export type UserRole = 'SUPER_ADMIN' | 'COORDINATOR' | 'HOD' | 'TEACHER' | 'ACCOUNTANT';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME';
export type TimesheetStatus = 'PENDING' | 'PENDING_HOD_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface AcademicRate {
  id: string;
  title: string;
  hourly_rate: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Faculty {
  id: string;
  name: string;
  code?: string;
  created_at?: string;
}

export interface Department {
  id: string;
  name: string;
  code?: string;
  faculty_id?: string;
  faculty?: string; // Keep for backward compatibility
  created_at?: string;
}

export interface Stage {
  id: string;
  department_id: string;
  name: string;
  level: number;
  created_at?: string;
}

export interface Course {
  id: string;
  stage_id: string;
  name: string;
  code: string;
  credits?: number;
  created_at?: string;
}

export interface UniversityUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department_id: string | null;
  department_ids?: string[];
  departments?: string[];
  employment_type: EmploymentType;
  academic_title: string | null;
  hourly_rate: number;
  staff_id?: string | null;
  avatar_url?: string | null;
  is_active?: boolean;
  custom_permissions?: Record<string, boolean>;
  department?: Department | null;
  created_at?: string;
  updated_at?: string;
}

export interface Timesheet {
  id: string;
  teacher_id: string;
  hod_id?: string | null;
  date: string;
  hours: number;
  status: TimesheetStatus;
  course_activity?: string | null;
  course_code?: string | null;
  session_type?: string | null;
  notes?: string | null;
  department?: string | null;
  department_id?: string | null;
  teacher?: UniversityUser | null;
  hod?: UniversityUser | null;
  created_at?: string;
  approved_at?: string | null;
  updated_at?: string;
}

export interface DashboardMetrics {
  totalHours: number;
  hoursCap: number;
  hoursPercentage: number;
  estimatedCostUSD: number;
  estimatedCostIQD: number;
  baseCurrency: 'USD' | 'IQD';
  exchangeRate: number;
  disbursedPercentage: number;
  pendingApprovalsCount: number;
  pendingDepartmentsCount: number;
  totalUsersCount: number;
  hodCount: number;
  coordinatorCount: number;
  accountantCount: number;
  teacherCount: number;
}

export interface TeacherLog {
  id: string;
  date: string;
  dayAndTime: string;
  courseCode: string;
  courseColor: 'red' | 'amber' | 'blue' | 'purple' | 'slate';
  deliverable: string;
  duration: number;
  durationFormatted: string;
  loggedByName: string;
  loggedByAvatar?: string;
  submissionRef: string;
  status: 'APPROVED' | 'PENDING' | 'PENDING_HOD_APPROVAL' | 'REJECTED';
}

export interface TeacherPortalData {
  teacher: UniversityUser;
  totalExtraHours: number;
  monthlyCapHours: number;
  capacityFulfilledPercentage: number;
  positiveTrendHours: number;
  hourlyRate: number;
  contractTier: string;
  rateActiveDate: string;
  estimatedPayout: number;
  payrollDate: string;
  grossAmount: number;
  taxExemptAmount: number;
  depositAccountText: string;
  departmentHod: {
    name: string;
    title: string;
    avatarInitials: string;
    avatarUrl?: string;
    email: string;
  };
  courseBreakdown: Array<{
    code: string;
    name: string;
    hours: number;
    percentage: number;
    color: string;
    dotColor: string;
  }>;
  logs: TeacherLog[];
  activeCycleName?: string;
  systemSettings: SystemSettings;
}

export const EMPTY_TEACHER_PORTAL_DATA: TeacherPortalData = {
  teacher: {
    id: '',
    name: 'Faculty Member',
    email: '',
    academic_title: 'Lecturer',
    role: 'TEACHER',
    department_id: null,
    employment_type: 'FULL_TIME',
    hourly_rate: 0,
    staff_id: '',
    avatar_url: null,
    is_active: true,
  },
  totalExtraHours: 0,
  monthlyCapHours: 40,
  capacityFulfilledPercentage: 0,
  positiveTrendHours: 0,
  hourlyRate: 0,
  contractTier: 'Academic Staff',
  rateActiveDate: 'Current Cycle',
  estimatedPayout: 0,
  payrollDate: 'End of Month',
  grossAmount: 0,
  taxExemptAmount: 0,
  depositAccountText: 'TIU Direct Deposit',
  departmentHod: {
    name: 'Unassigned HoD',
    title: 'Head of Department',
    avatarInitials: 'HD',
    email: '',
  },
  courseBreakdown: [],
  logs: [],
  activeCycleName: 'Active Cycle: Sep 25 - Oct 25',
  systemSettings: { id: 1, base_currency: 'IQD', exchange_rate: 150000, finance_can_edit_exchange: true },
};
export interface PayrollSettings {
  id: string;
  auto_lock: boolean;
  auto_cycle_day?: number;
  start_date: string;
  end_date: string;
  is_locked: boolean;
  cycle_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SystemSettings {
  id: number;
  base_currency: 'USD' | 'IQD';
  exchange_rate: number;
  finance_can_edit_exchange?: boolean;
  coordinator_can_view_currency?: boolean;
}
