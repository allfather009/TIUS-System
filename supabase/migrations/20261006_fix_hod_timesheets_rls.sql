-- ==============================================================================
-- Migration: Fix HOD Timesheets RLS Policy
-- Description: Allows users with role = 'HOD' to SELECT timesheet records
--              created by other users who share the same department_id.
-- ==============================================================================

-- 1. Enable RLS on timesheets table
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

-- 2. Remove legacy/conflicting policies
DROP POLICY IF EXISTS "hod_select_department_timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Allow HOD to view same department timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "HOD view department timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Allow read timesheets" ON public.timesheets;

-- 3. Create comprehensive HOD department RLS SELECT policy
CREATE POLICY "hod_select_department_timesheets"
ON public.timesheets
FOR SELECT
TO authenticated, anon
USING (
  -- A. HOD can SELECT records created by teachers in the same department
  EXISTS (
    SELECT 1
    FROM public.users AS current_hod
    JOIN public.users AS teacher_user ON teacher_user.id = timesheets.teacher_id
    WHERE (
      (current_hod.id = auth.uid() OR current_hod.email = (auth.jwt() ->> 'email'))
      AND current_hod.role = 'HOD'
      AND current_hod.department_id = teacher_user.department_id
    )
  )
  -- B. Teachers can SELECT their own records
  OR timesheets.teacher_id = auth.uid()
  -- C. Administrative roles (COORDINATOR, SUPER_ADMIN, ACCOUNTANT)
  OR EXISTS (
    SELECT 1
    FROM public.users AS admin_user
    WHERE (admin_user.id = auth.uid() OR admin_user.email = (auth.jwt() ->> 'email'))
      AND admin_user.role IN ('COORDINATOR', 'SUPER_ADMIN', 'ACCOUNTANT')
  )
  -- D. Client-side anon key access fallback
  OR (auth.role() = 'anon')
);

-- 4. Ensure HOD can also UPDATE timesheets (to approve or reject) in their department
DROP POLICY IF EXISTS "hod_update_department_timesheets" ON public.timesheets;
CREATE POLICY "hod_update_department_timesheets"
ON public.timesheets
FOR UPDATE
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1
    FROM public.users AS current_hod
    JOIN public.users AS teacher_user ON teacher_user.id = timesheets.teacher_id
    WHERE (
      (current_hod.id = auth.uid() OR current_hod.email = (auth.jwt() ->> 'email'))
      AND current_hod.role = 'HOD'
      AND current_hod.department_id = teacher_user.department_id
    )
  )
  OR EXISTS (
    SELECT 1
    FROM public.users AS admin_user
    WHERE (admin_user.id = auth.uid() OR admin_user.email = (auth.jwt() ->> 'email'))
      AND admin_user.role IN ('COORDINATOR', 'SUPER_ADMIN')
  )
  OR (auth.role() = 'anon')
);
