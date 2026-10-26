import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isDateInLockedPayrollCycle } from '@/lib/services/payrollSettingsService';
import { getWeekRange } from '@/lib/utils/weekRange';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

/**
 * Resolves current user info from request cookies or auth headers.
 */
function resolveCaller(req: Request): {
  id: string | null;
  role: string | null;
  name: string | null;
  email: string | null;
} {
  const cookieHeader = req.headers.get('cookie') || '';

  // 1. Check for active simulation cookie
  const simMatch = cookieHeader.match(/tius_simulated_user=([^;]+)/);
  if (simMatch) {
    try {
      const decoded = simMatch[1].includes('%') ? decodeURIComponent(simMatch[1]) : simMatch[1];
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === 'object') {
        return {
          id: parsed.id || null,
          role: parsed.role || null,
          name: parsed.name || null,
          email: parsed.email || null,
        };
      }
    } catch {}
  }

  // 2. Check for simulated_role and simulated_user_id cookies
  const roleMatch = cookieHeader.match(/simulated_role=([^;]+)/);
  const idMatch = cookieHeader.match(/simulated_user_id=([^;]+)/);
  if (roleMatch || idMatch) {
    return {
      id: idMatch ? idMatch[1] : null,
      role: roleMatch ? roleMatch[1] : null,
      name: null,
      email: null,
    };
  }

  return { id: null, role: null, name: null, email: null };
}

/**
 * POST /api/requests
 * Creates an extra hours request.
 * Workflow:
 * - Verifies caller is HOD, SUPER_ADMIN, or IT_ADMIN.
 * - Attaches submitted_by_id = session user id.
 * - Sets teacher_id from form payload (the faculty member performing the hours).
 * - Assigns initial status = 'PENDING'.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const caller = resolveCaller(req);

    // 1. Resolve submitted_by_id
    const submittedById = caller.id || body.submitted_by_id || body.hod_id;
    if (!submittedById) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Missing authenticated submitter (HoD ID required).' },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    // 2. Verify caller role (must be HOD, SUPER_ADMIN, or IT_ADMIN)
    const admin = createAdminClient();
    const { data: submitterUser, error: userError } = await admin
      .from('users')
      .select('id, name, email, role, department_id, managed_department_ids, is_active')
      .eq('id', submittedById)
      .maybeSingle();

    if (userError || !submitterUser) {
      return NextResponse.json(
        { success: false, error: 'Submitter profile not found in university directory.' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    // 2. Strictly verify caller role: ONLY HOD, SUPER_ADMIN, and IT_ADMIN can create requests.
    // Teachers, Deans, Vice Deans, and Coordinators are strictly blocked.
    const allowedCreationRoles = ['HOD', 'SUPER_ADMIN', 'IT_ADMIN'];
    const effectiveRole = caller.role || submitterUser.role;

    if (!allowedCreationRoles.includes(effectiveRole)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Forbidden: Under institutional policy, Teachers, Deans, Vice Deans, and Coordinators cannot submit requests. Requests must be submitted exclusively by Heads of Department (HOD) or System Administrators.',
        },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    // 3. Validate required fields
    const targetTeacherId = body.teacher_id || body.user_id || submittedById;
    const date = body.date || new Date().toISOString().split('T')[0];
    const hours = Number(body.hours);

    if (isNaN(hours) || hours <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid extra hours quantity: Hours must be greater than 0.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // 4. Validate against locked payroll cycle
    const lockCheck = await isDateInLockedPayrollCycle(date);
    if (lockCheck.isLocked) {
      return NextResponse.json(
        {
          success: false,
          error: `Submission blocked: The payroll cycle (${lockCheck.cycleLabel}) is currently locked by Finance.`,
        },
        { status: 423, headers: NO_CACHE_HEADERS }
      );
    }

    // 4.5 Cumulative Weekly Extra Hours Cap Validation
    // Calculate calendar week boundaries (Monday to Sunday)
    const weekRange = getWeekRange(date);

    // Fetch teacher's max weekly hours limit (default to 8.0 if unset)
    const { data: teacherProfile } = await admin
      .from('users')
      .select('id, name, max_weekly_hours')
      .eq('id', targetTeacherId)
      .maybeSingle();

    const teacherCap =
      teacherProfile?.max_weekly_hours != null ? Number(teacherProfile.max_weekly_hours) : 8.0;

    // Query non-rejected hours for this teacher in this calendar week
    const { data: existingWeekRecords, error: weekRecordsError } = await admin
      .from('timesheets')
      .select('hours')
      .eq('teacher_id', targetTeacherId)
      .gte('date', weekRange.startDate)
      .lte('date', weekRange.endDate)
      .neq('status', 'REJECTED');

    if (weekRecordsError) {
      console.error('[API /api/requests] Error checking weekly tally:', weekRecordsError);
    }

    const existingWeeklySum = (existingWeekRecords || []).reduce(
      (sum, item) => sum + Number(item.hours || 0),
      0
    );

    const projectedTotal = existingWeeklySum + hours;
    const isSpecialCondition = Boolean(body.is_special_condition);
    const specialReason =
      typeof body.special_condition_reason === 'string'
        ? body.special_condition_reason.trim()
        : '';

    if (projectedTotal > teacherCap) {
      if (!isSpecialCondition || !specialReason) {
        return NextResponse.json(
          {
            success: false,
            error: `Weekly extra hours limit exceeded: Teacher has already logged ${existingWeeklySum} hrs for this calendar week (${weekRange.label}). Adding ${hours} hrs brings the cumulative total to ${projectedTotal} hrs, exceeding the ${teacherCap} hrs weekly cap. An authorized Special Exception and Justification Reason are mandatory to submit over-cap requests.`,
            details: {
              currentWeekLogged: existingWeeklySum,
              newHours: hours,
              projectedTotal,
              maxWeeklyHours: teacherCap,
              weekRange: weekRange.label,
              startDate: weekRange.startDate,
              endDate: weekRange.endDate,
            },
          },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
    }

    // 5. Construct record with status = 'PENDING'
    const courseCode = (body.course_code || 'GEN').trim().toUpperCase();
    const sessionType = body.session_type || 'Instructional Extra Session';
    const notes = body.notes || '';
    const courseActivity = notes || `${courseCode} - ${sessionType}`;

    const newRequest = {
      teacher_id: targetTeacherId,
      submitted_by_id: submittedById,
      hod_id: submittedById, // Retained for backward-compatibility with existing queries
      date,
      hours,
      status: 'PENDING',
      course_code: courseCode,
      session_type: sessionType,
      notes,
      course_activity: courseActivity,
      department: body.department || null,
      department_id: body.department_id || null,
      is_special_condition: Boolean(body.is_special_condition),
      special_condition_reason: body.is_special_condition ? (body.special_condition_reason || null) : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertError } = await admin
      .from('timesheets')
      .insert([newRequest])
      .select('*, teacher:users!timesheets_teacher_id_fkey(*), submitted_by:users!timesheets_submitted_by_id_fkey(id, name, email, role, academic_title)')
      .maybeSingle();

    if (insertError) {
      console.error('[API /api/requests] Insert error:', insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, data: inserted },
      { status: 201, headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API /api/requests] Exception:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

/**
 * PATCH /api/requests
 * Mutates request status to 'APPROVED' or 'REJECTED'.
 * Security Workflow:
 * - Strictly enforces that ONLY COORDINATOR, SUPER_ADMIN, and IT_ADMIN can approve or reject.
 * - Blocks HOD, TEACHER, DEAN, VICE_DEAN, and all other roles from approving or rejecting.
 * - Records action, timestamp, and actor details to the audit_logs table.
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const caller = resolveCaller(req);

    // 1. Resolve reviewer identity & role
    const reviewerId = caller.id || body.reviewer_id;
    const admin = createAdminClient();

    let reviewerRole = caller.role;
    let reviewerName = caller.name;

    if (reviewerId) {
      const { data: userRow } = await admin
        .from('users')
        .select('id, name, role, email')
        .eq('id', reviewerId)
        .maybeSingle();
      if (userRow) {
        if (!reviewerRole) reviewerRole = userRow.role;
        if (!reviewerName) reviewerName = userRow.name;
      }
    }

    // 2. Validate status and target IDs
    const newStatus = (body.status || '').toUpperCase();
    if (newStatus !== 'APPROVED' && newStatus !== 'REJECTED' && newStatus !== 'PAID') {
      return NextResponse.json(
        { success: false, error: "Invalid status: Must be either 'APPROVED', 'REJECTED', or 'PAID'." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const effectiveRole = reviewerRole || 'ANONYMOUS';

    if (newStatus === 'PAID') {
      const allowedPaymentRoles = ['ACCOUNTANT', 'SUPER_ADMIN', 'IT_ADMIN', 'COORDINATOR'];
      if (!allowedPaymentRoles.includes(effectiveRole)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Forbidden: Only Finance / Accountant or Super Admin has authority to mark requests as PAID.',
          },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }
    } else {
      const allowedApprovalRoles = ['COORDINATOR', 'SUPER_ADMIN', 'IT_ADMIN'];
      if (!allowedApprovalRoles.includes(effectiveRole)) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Forbidden: Only the Academic Coordinator (or Super Admin) has authority to approve or reject requests. Heads of Department, Teachers, and other roles are strictly blocked from changing request status.',
          },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }
    }

    const rawIds: string[] = body.ids || (body.id ? [body.id] : []);
    const targetIds = rawIds.filter((id) => typeof id === 'string' && id.trim().length > 0);

    if (targetIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing target request ID(s) to update.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const rejectionReason = (body.reason || body.rejection_reason || '').trim();
    const nowIso = new Date().toISOString();

    // 3. Perform update on timesheets
    // If rejected with reason, update status and append/set rejection note
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      updated_at: nowIso,
    };

    if (newStatus === 'APPROVED') {
      updatePayload.approved_at = nowIso;
    }

    // Update records in timesheets
    const { data: updatedRows, error: updateError } = await admin
      .from('timesheets')
      .update(updatePayload)
      .in('id', targetIds)
      .select('*, teacher:users!timesheets_teacher_id_fkey(*), submitted_by:users!timesheets_submitted_by_id_fkey(id, name, email, role, academic_title)');

    if (updateError) {
      console.error('[API /api/requests PATCH] Update error:', updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // If rejection reason provided, update notes cleanly for those records
    if (newStatus === 'REJECTED' && rejectionReason && updatedRows) {
      for (const row of updatedRows) {
        const existingNotes = (row.notes || '').replace(/\[Rejected by Coordinator:[^\]]*\]/g, '').trim();
        const updatedNotes = `[Rejected by Coordinator: ${rejectionReason}]${existingNotes ? ` ${existingNotes}` : ''}`;
        await admin
          .from('timesheets')
          .update({ notes: updatedNotes })
          .eq('id', row.id);
      }
    }

    // 4. Record entry to audit_logs
    try {
      const auditEntries = targetIds.map((targetId) => ({
        entity_type: 'timesheet',
        entity_id: targetId,
        action:
          newStatus === 'PAID'
            ? 'MARK_PAID_DISBURSAL'
            : newStatus === 'APPROVED'
            ? targetIds.length > 1
              ? 'BATCH_APPROVE_REQUEST'
              : 'APPROVE_REQUEST'
            : 'REJECT_REQUEST',
        actor_id: reviewerId || null,
        actor_name: reviewerName || (newStatus === 'PAID' ? 'Finance Officer' : 'Academic Coordinator'),
        actor_role: effectiveRole,
        details: {
          previous_status: 'PENDING',
          new_status: newStatus,
          rejection_reason: rejectionReason || null,
          processed_at: nowIso,
          batch_count: targetIds.length,
        },
        created_at: nowIso,
      }));

      await admin.from('audit_logs').insert(auditEntries);
    } catch (auditErr) {
      console.warn('[API /api/requests PATCH] Audit log notice:', auditErr);
    }

    return NextResponse.json(
      {
        success: true,
        count: targetIds.length,
        status: newStatus,
        data: updatedRows,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API /api/requests PATCH] Exception:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

/**
 * GET /api/requests
 * Retrieves extra hours requests with optional filters.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('department_id');
    const teacherId = searchParams.get('teacher_id');
    const submittedById = searchParams.get('submitted_by_id');
    const status = searchParams.get('status');

    const caller = resolveCaller(req);
    const forFinance = searchParams.get('for_finance') === 'true' || caller.role === 'ACCOUNTANT';

    const admin = createAdminClient();
    let query = admin
      .from('timesheets')
      .select('*, teacher:users!timesheets_teacher_id_fkey(*, department:departments(*)), submitted_by:users!timesheets_submitted_by_id_fkey(id, name, email, role, academic_title)')
      .order('created_at', { ascending: false })
      .order('date', { ascending: false });

    if (departmentId && departmentId !== 'ALL') {
      query = query.eq('department_id', departmentId);
    }
    if (teacherId) {
      query = query.eq('teacher_id', teacherId);
    }
    if (submittedById) {
      query = query.eq('submitted_by_id', submittedById);
    }

    if (forFinance) {
      // Strict Finance & Payroll Visibility Gate:
      // Finance and Payroll Officers ONLY receive requests that have been accepted by the Academic Coordinator ('APPROVED' or 'PAID').
      // Requests with status === 'PENDING' or status === 'REJECTED' are completely invisible.
      if (status && ['APPROVED', 'PAID'].includes(status.toUpperCase())) {
        query = query.eq('status', status.toUpperCase());
      } else {
        query = query.in('status', ['APPROVED', 'PAID']);
      }
    } else if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }

    const { data, error } = await query.limit(300);

    if (error) {
      console.error('[API /api/requests GET] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, data: data || [] },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
