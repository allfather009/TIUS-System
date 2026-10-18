import { createClient } from '@/lib/supabase/client';
import { Department, UniversityUser, UserRole, EmploymentType, DashboardMetrics, TeacherPortalData, EMPTY_TEACHER_PORTAL_DATA } from '@/types/database';
import { getPayrollSettings } from './payrollSettingsService';
import { getSystemSettings } from './systemSettingsService';
import { getAcademicRates, getRateForTitle } from './rateService';

const STORAGE_USERS_KEY = 'tius_local_users_v2';

export async function getDepartments(): Promise<Department[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('departments')
      .select('id, name, code, faculty_id, faculties(name)')
      .order('name');

    if (!error && data) {
      return data.map((d: any) => ({
        ...d,
        faculty: d.faculties?.name || 'Other Departments'
      })) as Department[];
    }
  } catch (err) {
    console.warn('Supabase departments query error:', err);
  }

  return [];
}

export async function getUsers(): Promise<UniversityUser[]> {
  const depts = await getDepartments();
  const deptMap = new Map(depts.map((d) => [d.id, d]));

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .select('*, department:departments(*)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mapped = data.map((u: Record<string, unknown>) => ({
        ...u,
        department: u.department || (u.department_id ? deptMap.get(u.department_id as string) : null),
      })) as UniversityUser[];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(mapped));
        } catch { /* ignore */ }
      }
      return mapped;
    }
  } catch (err) {
    console.warn('Supabase users query error:', err);
  }

  return [];
}

export async function updateUserRole(
  userId: string,
  role: UserRole,
  departmentId?: string | null,
  academicTitle?: string | null,
  hourlyRate?: number | null,
  departmentIds?: string[] | null,
  departmentNames?: string[] | null
): Promise<{ success: boolean; error?: string; user?: UniversityUser }> {
  try {
    const supabase = createClient();
    
    // Resolve primary department_id: if departmentIds is provided, default to first department
    const resolvedDeptId =
      departmentId !== undefined
        ? departmentId
        : departmentIds && departmentIds.length > 0
        ? departmentIds[0]
        : null;

    const updatePayload: Record<string, unknown> = {
      role,
      department_id: resolvedDeptId,
      updated_at: new Date().toISOString(),
    };

    if (departmentIds !== undefined) {
      updatePayload.department_ids = departmentIds || [];
    }
    if (departmentNames !== undefined) {
      updatePayload.departments = departmentNames || [];
    }

    if (academicTitle !== undefined) {
      updatePayload.academic_title = academicTitle;
    }
    if (hourlyRate !== undefined && hourlyRate !== null) {
      updatePayload.hourly_rate = hourlyRate;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select('*, department:departments(*)')
      .maybeSingle();

    if (!error && data) {
      // update local mirror
      updateLocalUser(data as UniversityUser);
      return { success: true, user: data as UniversityUser };
    }
  } catch (err) {
    console.warn('Supabase update failed, updating local state:', err);
  }

  // Update in localStorage
  if (typeof window !== 'undefined') {
    const currentUsers = await getUsers();
    const depts = await getDepartments();
    const resolvedDeptId =
      departmentId !== undefined
        ? departmentId
        : departmentIds && departmentIds.length > 0
        ? departmentIds[0]
        : null;
    const targetDept = resolvedDeptId ? depts.find((d) => d.id === resolvedDeptId) : null;

    const updated: UniversityUser[] = currentUsers.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          role,
          department_id: resolvedDeptId,
          department_ids: departmentIds !== undefined ? (departmentIds || []) : (u.department_ids || []),
          departments: departmentNames !== undefined ? (departmentNames || []) : (u.departments || []),
          department: resolvedDeptId !== undefined ? targetDept : u.department,
          academic_title: academicTitle !== undefined ? (academicTitle || null) : (u.academic_title ?? null),
          hourly_rate: (hourlyRate !== undefined && hourlyRate !== null) ? hourlyRate : u.hourly_rate,
          updated_at: new Date().toISOString(),
        };
      }
      return u;
    });

    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(updated));
    const modifiedUser = updated.find((u) => u.id === userId);
    return { success: true, user: modifiedUser };
  }

  return { success: false, error: 'Failed to update user role' };
}

export async function updateUserPermissions(
  userId: string,
  customPermissions: Record<string, boolean>
): Promise<{ success: boolean; error?: string; user?: UniversityUser }> {
  try {
    // 1. Try admin API route first to bypass client RLS
    try {
      const res = await fetch('/api/user-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, custom_permissions: customPermissions }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          updateLocalUser(json.data as UniversityUser);
          return { success: true, user: json.data as UniversityUser };
        }
      }
    } catch {
      // Continue to direct client fallback
    }

    // 2. Direct client fallback
    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .update({ custom_permissions: customPermissions, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('*, department:departments(*)');

    if (error) {
      console.warn('Supabase update error:', error);
      return { success: false, error: error.message || 'Supabase update failed.' };
    }
    
    if (!data || data.length === 0) {
      return { success: false, error: 'Update failed: Row Level Security blocked the update or user ID not found.' };
    }

    updateLocalUser(data[0] as UniversityUser);
    return { success: true, user: data[0] as UniversityUser };
  } catch (err: any) {
    console.error('Supabase permissions update exception:', err);
    return { success: false, error: err?.message || 'An unexpected error occurred.' };
  }
}

export async function createSingleUser(
  userData: Omit<UniversityUser, 'id' | 'department'>
): Promise<{ success: boolean; user?: UniversityUser; error?: string }> {
  const newId = crypto.randomUUID();
  const now = new Date().toISOString();

  const newUser: UniversityUser = {
    ...userData,
    id: newId,
    hourly_rate: userData.hourly_rate || 35.0,
    is_active: userData.is_active ?? true,
    created_at: now,
    updated_at: now,
  };

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .insert([newUser])
      .select('*, department:departments(*)')
      .maybeSingle();

    if (!error && data) {
      updateLocalUser(data as UniversityUser);
      return { success: true, user: data as UniversityUser };
    }
  } catch (err) {
    console.warn('Supabase insert failed, saving to local store:', err);
  }

  // Save to local storage
  if (typeof window !== 'undefined') {
    const current = await getUsers();
    const depts = await getDepartments();
    const dept = newUser.department_id ? depts.find((d) => d.id === newUser.department_id) : null;
    const itemToSave = { ...newUser, department: dept };
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify([itemToSave, ...current]));
    return { success: true, user: itemToSave };
  }

  return { success: false, error: 'Could not create user' };
}

export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('users').delete().eq('id', userId);
    
    if (!error) {
      if (typeof window !== 'undefined') {
         const current = await getUsers();
         localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(current.filter((u) => u.id !== userId)));
      }
      return { success: true };
    }
  } catch (err) {
    console.warn('Supabase delete failed:', err);
  }

  // Update in localStorage fallback
  if (typeof window !== 'undefined') {
    const current = await getUsers();
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(current.filter((u) => u.id !== userId)));
    return { success: true };
  }

  return { success: false, error: 'Failed to delete user' };
}

export type BulkImportRow = {
  name: string;
  email: string;
  department_name?: string;
  faculty_name?: string;
  employment_type?: string;
  academic_title?: string;
  staff_id?: string;
  role?: string;
  is_active?: boolean;
};

export async function bulkImportUsers(
  rows: BulkImportRow[]
): Promise<{ success: boolean; importedCount: number; errors: string[] }> {
  const depts = await getDepartments();
  const rates = await getAcademicRates();
  const existingUsers = await getUsers();
  const existingByEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase().trim(), u]));

  const errors: string[] = [];
  const recordsToInsert: UniversityUser[] = [];

  for (const row of rows) {
    if (!row.email || !row.name) {
      continue;
    }

    const cleanEmail = row.email.trim().toLowerCase();
    const existing = existingByEmail.get(cleanEmail);

    // Normalize and match department
    let matchedDept: Department | null = null;
    const rawDept = (row.department_name || '').trim();
    if (rawDept) {
      // 1. Direct match on name or code
      matchedDept = depts.find(
        (d) =>
          d.name.toLowerCase() === rawDept.toLowerCase() ||
          (d.code && d.code.toLowerCase() === rawDept.toLowerCase())
      ) || null;

      // 2. Normalized match (strip "Department", "Dept", "Unit", extra spaces)
      if (!matchedDept) {
        const norm = rawDept
          .toLowerCase()
          .replace(/\bdepartment\b/gi, '')
          .replace(/\bdept\b/gi, '')
          .replace(/\bunit\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        matchedDept = depts.find((d) => {
          const dNorm = d.name
            .toLowerCase()
            .replace(/\bdepartment\b/gi, '')
            .replace(/\bdept\b/gi, '')
            .replace(/\bunit\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
          return dNorm === norm;
        }) || null;

        // 3. Known department aliases
        if (!matchedDept) {
          if (norm.includes('architect')) {
            matchedDept = depts.find((d) => d.name.toLowerCase().includes('architect')) || null;
          } else if (norm.includes('information technology') && !norm.includes('service')) {
            matchedDept = depts.find((d) => d.name.toLowerCase().includes('information technology')) || null;
          } else if (norm.includes('medical') && norm.includes('analysis')) {
            matchedDept = depts.find((d) => d.name.toLowerCase().includes('medical analysis')) || null;
          }
        }
      }
    }

    // Role mapping
    let role: UserRole = existing?.role || 'TEACHER';
    const roleStr = (row.role || '').toUpperCase();
    const jobStr = (row.academic_title || '').toUpperCase();
    if (roleStr === 'SUPER_ADMIN' || roleStr.includes('SUPER')) role = 'SUPER_ADMIN';
    else if (roleStr === 'COORDINATOR' || roleStr.includes('COORD')) role = 'COORDINATOR';
    else if (roleStr === 'HOD' || roleStr.includes('HEAD') || jobStr.includes('HEAD OF DEPARTMENT')) role = 'HOD';
    else if (roleStr === 'ACCOUNTANT' || roleStr.includes('FINANCE')) role = 'ACCOUNTANT';
    else if (roleStr === 'TEACHER') role = 'TEACHER';

    // Employment type
    let empType: EmploymentType = existing?.employment_type || 'PART_TIME';
    const empStr = (row.employment_type || '').toUpperCase();
    if (empStr.includes('FULL')) empType = 'FULL_TIME';
    else if (empStr.includes('PART')) empType = 'PART_TIME';

    // Academic title & hourly rate
    const academicTitle = row.academic_title?.trim() || existing?.academic_title || 'Lecturer';
    const hourlyRate = (existing?.hourly_rate && existing.hourly_rate > 0)
      ? existing.hourly_rate
      : getRateForTitle(academicTitle, rates);

    // Active status
    const isActive = row.is_active !== undefined ? row.is_active : (existing?.is_active ?? true);

    const record: UniversityUser = {
      id: existing ? existing.id : crypto.randomUUID(),
      name: row.name.trim(),
      email: cleanEmail,
      academic_title: academicTitle,
      role,
      department_id: matchedDept ? matchedDept.id : (existing?.department_id || null),
      employment_type: empType,
      hourly_rate: hourlyRate,
      staff_id: row.staff_id?.trim() || existing?.staff_id || `TIU-${Math.floor(1000 + Math.random() * 9000)}`,
      is_active: isActive,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      custom_permissions: existing?.custom_permissions || {},
    };

    recordsToInsert.push(record);
  }

  if (recordsToInsert.length === 0) {
    return { success: false, importedCount: 0, errors };
  }

  // Attempt Supabase batch upsert
  try {
    const supabase = createClient();
    const chunkSize = 100;
    for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
      const chunk = recordsToInsert.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('users')
        .upsert(chunk, { onConflict: 'email' });
      if (error) {
        console.warn('Supabase bulk upsert error for chunk:', error);
        errors.push(`Chunk notice: ${error.message}`);
      }
    }

    // Sync local storage
    const current = await getUsers();
    const emailMap = new Map(recordsToInsert.map((r) => [r.email, r]));
    const merged = [
      ...recordsToInsert,
      ...current.filter((c) => !emailMap.has(c.email)),
    ];
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(merged));
    }
    return { success: true, importedCount: recordsToInsert.length, errors };
  } catch (err: unknown) {
    console.warn('Supabase bulk upsert exception, saving locally:', err);
    errors.push(err instanceof Error ? err.message : 'Database error');
  }

  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const current = await getUsers();
    const emailMap = new Map(recordsToInsert.map((r) => [r.email, r]));
    const merged = [
      ...recordsToInsert,
      ...current.filter((c) => !emailMap.has(c.email)),
    ];
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(merged));
  }

  return { success: true, importedCount: recordsToInsert.length, errors };
}

function updateLocalUser(user: UniversityUser) {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(STORAGE_USERS_KEY);
    if (!stored) return;
    const users: UniversityUser[] = JSON.parse(stored);
    const idx = users.findIndex((u) => u.id === user.id || u.email === user.email);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...user };
    } else {
      users.unshift(user);
    }
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error(e);
  }
}

export const EMPTY_DASHBOARD_METRICS: DashboardMetrics = {
  totalHours: 0,
  hoursCap: 250,
  hoursPercentage: 0,
  estimatedCostUSD: 0,
  estimatedCostIQD: 0,
  baseCurrency: 'IQD',
  exchangeRate: 1500,
  disbursedPercentage: 0,
  pendingApprovalsCount: 0,
  pendingDepartmentsCount: 0,
  totalUsersCount: 0,
  hodCount: 0,
  coordinatorCount: 0,
  accountantCount: 0,
  teacherCount: 0,
};

export function getMetrics(users: UniversityUser[], sys?: { exchangeRate: number; baseCurrency?: 'USD' | 'IQD' }): DashboardMetrics {
  const staff = users.filter((u) => u.role !== 'SUPER_ADMIN');
  const coordinators = staff.filter((u) => u.role === 'COORDINATOR').length;
  const hods = staff.filter((u) => u.role === 'HOD').length;
  const accountants = staff.filter((u) => u.role === 'ACCOUNTANT').length;
  const teachers = staff.filter((u) => u.role === 'TEACHER').length;

  return {
    ...EMPTY_DASHBOARD_METRICS,
    totalUsersCount: staff.length,
    coordinatorCount: coordinators,
    hodCount: hods,
    accountantCount: accountants,
    teacherCount: teachers,
    baseCurrency: sys?.baseCurrency ?? 'IQD',
    exchangeRate: sys?.exchangeRate ?? 1500,
  };
}

function isTimesheetInActiveCycle(
  ts: Record<string, unknown>,
  payrollSettings: { id?: string; start_date?: string; end_date?: string } | null
): boolean {
  if (!payrollSettings) return true;

  // Match either active cycle_id
  if (payrollSettings.id && ts.cycle_id && String(ts.cycle_id) === String(payrollSettings.id)) {
    return true;
  }

  // Or filter where the log's date falls between active cycle's start_date and end_date
  if (ts.date) {
    const logDate = String(ts.date).split('T')[0];
    const startDate = payrollSettings.start_date ? String(payrollSettings.start_date).split('T')[0] : '';
    const endDate = payrollSettings.end_date ? String(payrollSettings.end_date).split('T')[0] : '';

    if (startDate && endDate) {
      return logDate >= startDate && logDate <= endDate;
    }
    if (startDate) {
      return logDate >= startDate;
    }
    if (endDate) {
      return logDate <= endDate;
    }
  }

  return false;
}

export async function getTeacherPortalData(teacherEmail?: string): Promise<TeacherPortalData> {
  const targetEmail = teacherEmail ? teacherEmail.toLowerCase().trim() : '';

  try {
    const supabase = createClient();
    const payrollSettings = await getPayrollSettings();
    const activeCycleName = payrollSettings?.cycle_name || 'Active Cycle: Sep 25 - Oct 25';
    const systemSettings = await getSystemSettings();

    // 1. Fetch teacher record
    let userQuery = supabase.from('users').select('*, department:departments(*)');
    if (targetEmail) {
      userQuery = userQuery.ilike('email', targetEmail);
    } else {
      userQuery = userQuery.eq('role', 'TEACHER').limit(1);
    }
    const { data: userRecList } = await userQuery;
    const userRec = Array.isArray(userRecList) ? userRecList[0] : userRecList;

    if (!userRec) {
      return EMPTY_TEACHER_PORTAL_DATA;
    }

    const currentTeacher: UniversityUser = {
      ...userRec,
      hourly_rate: Number(userRec.hourly_rate) || 40.0,
      academic_title: userRec.academic_title || 'Lecturer',
    } as UniversityUser;

    // 2. Fetch department HoD
    let departmentHod = EMPTY_TEACHER_PORTAL_DATA.departmentHod;
    if (userRec.department_id) {
      const { data: hodUser } = await supabase
        .from('users')
        .select('name, academic_title, email')
        .eq('department_id', userRec.department_id)
        .eq('role', 'HOD')
        .maybeSingle();

      if (hodUser) {
        departmentHod = {
          name: hodUser.name,
          title: hodUser.academic_title || 'Head of Department',
          avatarInitials: hodUser.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
          email: hodUser.email,
        };
      }
    }

    // 3. Fetch timesheets
    const { data: timesheets, error } = await supabase
      .from('timesheets')
      .select('*')
      .eq('teacher_id', userRec.id)
      .order('date', { ascending: false });

    if (!error && timesheets && timesheets.length > 0) {
      const mappedLogs = timesheets.map((ts: Record<string, unknown>, idx: number) => {
        const rawStatus = String(ts.status || 'PENDING').toUpperCase();
        let status: 'APPROVED' | 'PENDING' | 'PENDING_HOD_APPROVAL' | 'REJECTED' = 'PENDING';
        if (rawStatus === 'APPROVED' || rawStatus === 'PAID') status = 'APPROVED';
        else if (rawStatus === 'REJECTED') status = 'REJECTED';
        else if (rawStatus === 'PENDING_HOD_APPROVAL') status = 'PENDING_HOD_APPROVAL';

        return {
          id: (ts.id as string) || `ts-${idx}`,
          date: new Date(ts.date as string).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
          dayAndTime: new Date(ts.date as string).toLocaleDateString('en-US', { weekday: 'long' }) + ', Session Completed',
          courseCode: (ts.course_code as string) || 'GEN',
          courseColor: (ts.course_code === 'IT204' ? 'amber' : ts.course_code === 'FYP-4' ? 'blue' : ts.course_code === 'EVAL' ? 'purple' : 'red') as 'red' | 'blue' | 'amber' | 'purple',
          deliverable: (ts.notes as string) || (ts.session_type as string) || 'Instructional Extra Session',
          duration: Number(ts.hours) || 0,
          durationFormatted: `${Number(ts.hours).toFixed(1)} hrs`,
          loggedByName: (status === 'PENDING_HOD_APPROVAL' || status === 'PENDING') ? 'Self-Submitted' : departmentHod.name,
          submissionRef: `#LOG-${9900 - idx * 15}`,
          status,
        };
      });

      // 1. Strict Active Cycle Filtering (matches active cycle_id OR falls between active cycle's start_date and end_date)
      const activeCycleTimesheets = timesheets.filter((ts: Record<string, unknown>) =>
        isTimesheetInActiveCycle(ts, payrollSettings)
      );

      // 2. Completely exclude any log where status === 'REJECTED'
      const validActiveCycleTimesheets = activeCycleTimesheets.filter((ts: Record<string, unknown>) => {
        const rawStatus = String(ts.status || '').toUpperCase();
        return rawStatus !== 'REJECTED';
      });

      // 3. Total Extra Hours: Sum of active cycle non-rejected logs
      const totalHours = validActiveCycleTimesheets.reduce(
        (acc: number, ts: Record<string, unknown>) => acc + (Number(ts.hours) || 0),
        0
      );
      const hourlyRate = currentTeacher.hourly_rate || 40.0;

      // 4. Approved Payout: Only calculate Total Payout using logs that are APPROVED or PAID in the active cycle
      const approvedCycleTimesheets = validActiveCycleTimesheets.filter((ts: Record<string, unknown>) => {
        const rawStatus = String(ts.status || '').toUpperCase();
        return rawStatus === 'APPROVED' || rawStatus === 'PAID';
      });

      const approvedHours = approvedCycleTimesheets.reduce(
        (acc: number, ts: Record<string, unknown>) => acc + (Number(ts.hours) || 0),
        0
      );
      const totalPayout = approvedHours * hourlyRate;

      // 5. Group courses for Hours by Course & Activity breakdown (strictly non-rejected active cycle logs)
      const courseMap = new Map<string, number>();
      validActiveCycleTimesheets.forEach((ts: Record<string, unknown>) => {
        const code = (ts.course_code as string) || 'GEN';
        const hrs = Number(ts.hours) || 0;
        courseMap.set(code, (courseMap.get(code) || 0) + hrs);
      });

      const colors = ['#721c3b', '#ffbe3b', '#0b1c30', '#4a6b82', '#6b7280'];
      const courseBreakdown = Array.from(courseMap.entries()).map(([code, hrs], idx) => ({
        code,
        name: code,
        hours: hrs,
        percentage: totalHours > 0 ? Math.round((hrs / totalHours) * 100) : 0,
        color: colors[idx % colors.length],
        dotColor: colors[idx % colors.length],
      }));

      const monthlyCap = 40;
      const capacityFulfilled = Math.min(Math.round((totalHours / monthlyCap) * 100), 100);

      return {
        ...EMPTY_TEACHER_PORTAL_DATA,
        teacher: currentTeacher,
        hourlyRate,
        totalExtraHours: totalHours,
        monthlyCapHours: monthlyCap,
        capacityFulfilledPercentage: capacityFulfilled,
        estimatedPayout: totalPayout,
        grossAmount: totalPayout,
        departmentHod,
        courseBreakdown,
        logs: mappedLogs,
        activeCycleName,
        systemSettings,
      };
    }

    // Teacher exists but has 0 timesheets logged yet
    return {
      ...EMPTY_TEACHER_PORTAL_DATA,
      teacher: currentTeacher,
      hourlyRate: currentTeacher.hourly_rate || 40.0,
      departmentHod,
      activeCycleName,
      systemSettings,
    };
  } catch (err) {
    console.error('Error fetching teacher portal data from Supabase:', err);
  }

  return EMPTY_TEACHER_PORTAL_DATA;
}


