import { createClient } from '@/lib/supabase/client';
import { Timesheet, UniversityUser } from '@/types/database';
import { isDateInLockedPayrollCycle, getPayrollSettings } from './payrollSettingsService';
import { getWeekRange } from '@/lib/utils/weekRange';

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
 * Helper function to fetch all teachers affiliated with an HoD's assigned department(s).
 * Supports HoDs assigned to 1 or 2 departments (via managed_department_ids, department_heads, or primary department_id).
 */
export async function getTeachersForHodDepartments(
  hodOrDepartments: UniversityUser | string | string[]
): Promise<UniversityUser[]> {
  try {
    const supabase = createClient();
    let departmentIds: string[] = [];

    if (Array.isArray(hodOrDepartments)) {
      departmentIds = hodOrDepartments.filter(Boolean);
    } else if (typeof hodOrDepartments === 'object' && hodOrDepartments !== null) {
      // 1. Check managed_department_ids (array of up to 2 departments)
      if (hodOrDepartments.managed_department_ids && Array.isArray(hodOrDepartments.managed_department_ids) && hodOrDepartments.managed_department_ids.length > 0) {
        departmentIds.push(...hodOrDepartments.managed_department_ids.filter(Boolean));
      }
      // 2. Check department_ids (legacy array)
      if (departmentIds.length === 0 && hodOrDepartments.department_ids && Array.isArray(hodOrDepartments.department_ids)) {
        departmentIds.push(...hodOrDepartments.department_ids.filter(Boolean));
      }
      // 3. Check primary department_id
      if (departmentIds.length === 0 && hodOrDepartments.department_id) {
        departmentIds.push(hodOrDepartments.department_id);
      }
      // 4. Check relational department_heads table if still empty
      if (departmentIds.length === 0 && hodOrDepartments.id) {
        const { data: deptHeads } = await supabase
          .from('department_heads')
          .select('department_id')
          .eq('user_id', hodOrDepartments.id);
        if (deptHeads && deptHeads.length > 0) {
          departmentIds.push(...deptHeads.map((dh: { department_id: string }) => dh.department_id).filter(Boolean));
        }
      }
    } else if (typeof hodOrDepartments === 'string') {
      const val = hodOrDepartments.trim();
      if (val) {
        // Check department_heads table
        const { data: deptHeads } = await supabase
          .from('department_heads')
          .select('department_id')
          .eq('user_id', val);
        if (deptHeads && deptHeads.length > 0) {
          departmentIds.push(...deptHeads.map((dh: { department_id: string }) => dh.department_id).filter(Boolean));
        } else {
          // Check if user has managed_department_ids or department_id in users
          const { data: userRow } = await supabase
            .from('users')
            .select('department_id, managed_department_ids, department_ids')
            .eq('id', val)
            .maybeSingle();

          if (userRow?.managed_department_ids && Array.isArray(userRow.managed_department_ids) && userRow.managed_department_ids.length > 0) {
            departmentIds.push(...userRow.managed_department_ids.filter(Boolean));
          } else if (userRow?.department_id) {
            departmentIds.push(userRow.department_id);
          } else {
            // Assume val is department_id
            departmentIds.push(val);
          }
        }
      }
    }

    const uniqueDeptIds = Array.from(new Set(departmentIds.filter(Boolean)));
    if (uniqueDeptIds.length === 0) return [];

    return await getDepartmentTeachers(uniqueDeptIds);
  } catch (err) {
    console.error('[HOD Service] Exception in getTeachersForHodDepartments:', err);
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

    // Disambiguate foreign key via !timesheets_teacher_id_fkey and fetch submitter details
    let query = supabase
      .from('timesheets')
      .select('*, teacher:users!timesheets_teacher_id_fkey(*, department:departments(*)), submitted_by:users!timesheets_submitted_by_id_fkey(id, name, email)')
      .order('created_at', { ascending: false })
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
      .select('*, teacher:users!timesheets_teacher_id_fkey(*, department:departments(*)), submitted_by:users!timesheets_submitted_by_id_fkey(id, name, email)')
      .in('status', ['PENDING', 'PENDING_HOD_APPROVAL'])
      .order('created_at', { ascending: false })
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
 * Insert a new Extra Hours request / timesheet record with status PENDING and submitted_by_id set.
 * HoDs create requests on behalf of teachers or themselves.
 */
export async function createTimesheet(data: {
  teacher_id: string;
  date: string;
  hours: number;
  course_code?: string;
  session_type?: string;
  notes?: string;
  hod_id?: string;
  submitted_by_id?: string;
  department?: string;
  department_id?: string;
  is_special_condition?: boolean;
  special_condition_reason?: string;
}): Promise<{ success: boolean; timesheet?: Timesheet; request?: Timesheet; error?: string }> {
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

    // Cumulative Weekly Extra Hours Cap Validation
    try {
      const weekRange = getWeekRange(data.date);
      const { data: teacherRow } = await supabase
        .from('users')
        .select('max_weekly_hours')
        .eq('id', data.teacher_id)
        .maybeSingle();

      const teacherCap =
        teacherRow?.max_weekly_hours != null ? Number(teacherRow.max_weekly_hours) : 8.0;

      const { data: weekRecords } = await supabase
        .from('timesheets')
        .select('hours')
        .eq('teacher_id', data.teacher_id)
        .gte('date', weekRange.startDate)
        .lte('date', weekRange.endDate)
        .neq('status', 'REJECTED');

      const existingWeeklySum = (weekRecords || []).reduce(
        (sum, item) => sum + Number(item.hours || 0),
        0
      );

      const projectedTotal = existingWeeklySum + Number(data.hours || 0);
      const isSpecial = Boolean(data.is_special_condition);
      const specialReason = (data.special_condition_reason || '').trim();

      if (projectedTotal > teacherCap && (!isSpecial || !specialReason)) {
        return {
          success: false,
          error: `Weekly extra hours limit exceeded: Teacher has already logged ${existingWeeklySum} hrs for ${weekRange.label}. Adding ${data.hours} hrs brings the total to ${projectedTotal} hrs, exceeding the ${teacherCap} hrs weekly limit. An authorized Special Exception and Justification Reason are mandatory.`,
        };
      }
    } catch (capErr) {
      console.error('[HOD Service] Weekly cap validation error:', capErr);
    }

    const courseActivity = data.notes || `${data.course_code || 'GEN'} - ${data.session_type || 'Instructional Extra Session'}`;
    const submitterId = data.submitted_by_id || data.hod_id || data.teacher_id;

    const newRecord: Record<string, any> = {
      teacher_id: data.teacher_id,
      submitted_by_id: submitterId,
      hod_id: submitterId,
      date: data.date,
      hours: Number(data.hours),
      status: 'PENDING' as const,
      course_code: data.course_code || 'GEN',
      session_type: data.session_type || 'Instructional Extra Session',
      notes: data.notes || '',
      course_activity: courseActivity,
      is_special_condition: Boolean(data.is_special_condition),
      special_condition_reason: data.is_special_condition ? (data.special_condition_reason || null) : null,
    };

    if (data.department) {
      newRecord.department = data.department;
    }
    if (data.department_id) {
      newRecord.department_id = data.department_id;
    }

    const { data: inserted, error } = await supabase
      .from('timesheets')
      .insert([newRecord])
      .select('*, teacher:users!timesheets_teacher_id_fkey(*), submitted_by:users!timesheets_submitted_by_id_fkey(id, name, email)')
      .maybeSingle();

    if (error) {
      console.error('[HOD Service] Insert timesheet/request failed:', error.message || error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      timesheet: inserted as Timesheet,
      request: inserted as Timesheet,
    };
  } catch (err) {
    console.error('[HOD Service] Exception during createTimesheet:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create request/timesheet' };
  }
}

/**
 * Export createRequest alias matching Phase 1 spec
 */
export const createRequest = createTimesheet;

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
