import { createClient } from '@/lib/supabase/client';
import { Timesheet, UniversityUser } from '@/types/database';
import { isDateInLockedPayrollCycle, getPayrollSettings } from './payrollSettingsService';

/**
 * Fetch all active faculty members (teachers) in one or more departments from Supabase.
 */
export async function getDepartmentTeachers(
  departmentId: string | string[]
): Promise<UniversityUser[]> {
  const ids = Array.isArray(departmentId) ? departmentId.filter(Boolean) : [departmentId].filter(Boolean);
  if (ids.length === 0) return [];

  try {
    const supabase = createClient();
    console.log('[HOD Service] Fetching teachers for department_ids:', ids);

    let query = supabase
      .from('users')
      .select('*, department:departments(*)')
      .eq('is_active', true)
      .order('name');

    if (ids.length === 1) {
      query = query.eq('department_id', ids[0]);
    } else {
      query = query.in('department_id', ids);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[HOD Service] Error fetching department teachers:', error);
      return [];
    }

    return (data || []) as UniversityUser[];
  } catch (err) {
    console.error('[HOD Service] Exception fetching department teachers:', err);
    return [];
  }
}

/**
 * Fetch timesheets strictly for teachers in the given department(s).
 * Filters for timesheets where the Teacher's department_id matches the logged-in HOD's department_id(s).
 */
export async function getDepartmentTimesheets(
  departmentId: string | string[],
  _teachersList?: UniversityUser[],
  departmentNames?: string | string[]
): Promise<Timesheet[]> {
  const ids = Array.isArray(departmentId) ? departmentId.filter(Boolean) : [departmentId].filter(Boolean);
  if (ids.length === 0) return [];

  try {
    const supabase = createClient();
    console.log('[HOD Service] Fetching department timesheets for department_ids:', ids);

    // Disambiguate foreign key via !timesheets_teacher_id_fkey and filter by department/department_id/teacher_id
    let query = supabase
      .from('timesheets')
      .select('*, teacher:users!timesheets_teacher_id_fkey(*, department:departments(*))')
      .order('date', { ascending: false });

    // Resolve teacher IDs for the given departments
    let teacherIds: string[] = (_teachersList || []).map((t) => t.id).filter(Boolean);
    if (teacherIds.length === 0) {
      const fetchedTeachers = await getDepartmentTeachers(ids);
      teacherIds = fetchedTeachers.map((t) => t.id).filter(Boolean);
    }

    const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const names = [
      ...(Array.isArray(departmentNames) ? departmentNames : departmentNames ? [departmentNames] : []),
      ...ids.filter((id) => !isUuid(id)),
    ].filter(Boolean);
    const uuidIds = ids.filter(isUuid);

    const orClauses: string[] = [];
    if (names.length > 0) {
      orClauses.push(`department.in.(${names.map((n) => `"${n}"`).join(',')})`);
    }
    if (uuidIds.length > 0) {
      orClauses.push(`department_id.in.(${uuidIds.join(',')})`);
    }
    if (teacherIds.length > 0) {
      orClauses.push(`teacher_id.in.(${teacherIds.join(',')})`);
    }

    if (orClauses.length > 0) {
      query = query.or(orClauses.join(','));
    }

    const { data, error } = await query;

    if (error) {
      console.error('[HOD Service] Error fetching department timesheets:', error.message || error);
      return [];
    }

    return (data || []) as Timesheet[];
  } catch (err) {
    console.error('[HOD Service] Exception fetching department timesheets:', err);
    return [];
  }
}

/**
 * Fetch pending teacher requests specifically matching status = 'PENDING_HOD_APPROVAL'
 * and filtering where the timesheet's or teacher's department matches the logged-in HOD's department(s).
 */
export async function getPendingTeacherRequests(
  departmentId: string | string[],
  departmentNames?: string | string[]
): Promise<Timesheet[]> {
  const ids = Array.isArray(departmentId) ? departmentId.filter(Boolean) : [departmentId].filter(Boolean);
  if (ids.length === 0) return [];

  try {
    const supabase = createClient();
    console.log('[HOD Service] Fetching pending requests for department_ids:', ids);

    let query = supabase
      .from('timesheets')
      .select('*, teacher:users!timesheets_teacher_id_fkey(*, department:departments(*))')
      .eq('status', 'PENDING_HOD_APPROVAL')
      .order('date', { ascending: false });

    const fetchedTeachers = await getDepartmentTeachers(ids);
    const teacherIds = fetchedTeachers.map((t) => t.id).filter(Boolean);

    const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const names = [
      ...(Array.isArray(departmentNames) ? departmentNames : departmentNames ? [departmentNames] : []),
      ...ids.filter((id) => !isUuid(id)),
    ].filter(Boolean);
    const uuidIds = ids.filter(isUuid);

    const orClauses: string[] = [];
    if (names.length > 0) {
      orClauses.push(`department.in.(${names.map((n) => `"${n}"`).join(',')})`);
    }
    if (uuidIds.length > 0) {
      orClauses.push(`department_id.in.(${uuidIds.join(',')})`);
    }
    if (teacherIds.length > 0) {
      orClauses.push(`teacher_id.in.(${teacherIds.join(',')})`);
    }

    if (orClauses.length > 0) {
      query = query.or(orClauses.join(','));
    }

    const { data, error } = await query;

    if (error) {
      console.error('[HOD Service] Error fetching pending requests:', error.message || error);
      return [];
    }

    return (data || []) as Timesheet[];
  } catch (err) {
    console.error('[HOD Service] Exception fetching pending requests:', err);
    return [];
  }
}

/**
 * Insert a new Extra Hours timesheet record with status PENDING and hod_id set
 */
export async function createTimesheet(data: {
  teacher_id: string;
  date: string;
  hours: number;
  course_code?: string;
  session_type?: string;
  notes?: string;
  hod_id: string;
  department?: string;
}): Promise<{ success: boolean; timesheet?: Timesheet; error?: string }> {
  // Validate against cycle lock
  const lockCheck = await isDateInLockedPayrollCycle(data.date);
  if (lockCheck.isLocked) {
    return {
      success: false,
      error: `Submission blocked: The payroll cycle (${lockCheck.cycleLabel}) is currently locked by Finance.`,
    };
  }
  try {
    const supabase = createClient();
    const courseActivity = data.notes || `${data.course_code || 'GEN'} - ${data.session_type || 'Instructional Extra Session'}`;

    const newRecord: Record<string, any> = {
      teacher_id: data.teacher_id,
      hod_id: data.hod_id,
      date: data.date,
      hours: Number(data.hours),
      status: 'PENDING' as const,
      course_code: data.course_code || 'GEN',
      session_type: data.session_type || 'Instructional Extra Session',
      notes: data.notes || '',
      course_activity: courseActivity,
    };

    if (data.department) {
      newRecord.department = data.department;
    }

    const { data: inserted, error } = await supabase
      .from('timesheets')
      .insert([newRecord])
      .select('*, teacher:users!timesheets_teacher_id_fkey(*)')
      .maybeSingle();

    if (error) {
      console.error('[HOD Service] Insert timesheet failed:', error.message || error);
      return { success: false, error: error.message };
    }

    return { success: true, timesheet: inserted as Timesheet };
  } catch (err) {
    console.error('[HOD Service] Exception during createTimesheet:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create timesheet' };
  }
}

/**
 * Update an existing timesheet record in Supabase
 */
export async function updateTimesheet(
  id: string,
  updates: Partial<Timesheet>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('timesheets')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('[HOD Service] Update timesheet failed:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[HOD Service] Exception during updateTimesheet:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Update failed' };
  }
}

/**
 * Delete a timesheet record by ID
 */
export async function deleteTimesheet(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('timesheets')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[HOD Service] Delete timesheet failed:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[HOD Service] Exception during deleteTimesheet:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Delete failed' };
  }
}

/**
 * Approve an individual timesheet request (sets status to APPROVED and records hod_id)
 */
export async function approveTimesheet(
  id: string,
  hodId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Check if timesheet falls within a locked payroll cycle
    const { data: targetTs } = await supabase
      .from('timesheets')
      .select('date')
      .eq('id', id)
      .maybeSingle();

    if (targetTs?.date) {
      const lockCheck = await isDateInLockedPayrollCycle(targetTs.date);
      if (lockCheck.isLocked) {
        return {
          success: false,
          error: `Approval blocked: This timesheet falls within a locked payroll cycle (${lockCheck.cycleLabel}). Approvals are frozen by Finance.`,
        };
      }
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('timesheets')
      .update({
        status: 'APPROVED',
        hod_id: hodId,
        approved_at: now,
        updated_at: now,
      })
      .eq('id', id);

    if (error) {
      console.error('[HOD Service] Approve timesheet failed:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[HOD Service] Exception during approveTimesheet:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Approve failed' };
  }
}

/**
 * Reject an individual timesheet request (sets status to REJECTED)
 */
export async function rejectTimesheet(
  id: string,
  hodId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('timesheets')
      .update({
        status: 'REJECTED',
        hod_id: hodId,
        notes: reason ? `[Rejected by HoD: ${reason}]` : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('[HOD Service] Reject timesheet failed:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[HOD Service] Exception during rejectTimesheet:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Reject failed' };
  }
}

/**
 * Batch approve all PENDING and PENDING_HOD_APPROVAL timesheets in this department
 */
export async function batchApproveDepartmentTimesheets(
  departmentId: string | string[],
  hodId: string
): Promise<{ success: boolean; approvedCount: number }> {
  const teachers = await getDepartmentTeachers(departmentId);
  const teacherIds = teachers.map((t) => t.id);

  if (teacherIds.length === 0) {
    return { success: true, approvedCount: 0 };
  }

  try {
    const supabase = createClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('timesheets')
      .update({ status: 'APPROVED', hod_id: hodId, approved_at: now, updated_at: now })
      .in('teacher_id', teacherIds)
      .in('status', ['PENDING', 'PENDING_HOD_APPROVAL'])
      .select();

    if (error) {
      console.error('[HOD Service] Batch approval failed:', error);
      return { success: false, approvedCount: 0 };
    }

    return { success: true, approvedCount: data?.length || 0 };
  } catch (err) {
    console.error('[HOD Service] Exception during batchApproveDepartmentTimesheets:', err);
    return { success: false, approvedCount: 0 };
  }
}
