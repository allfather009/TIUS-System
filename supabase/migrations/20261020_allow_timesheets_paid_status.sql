-- Migration: Allow 'PAID' and 'ARCHIVED' statuses on timesheets and grant ACCOUNTANT role update permissions in RLS
-- Fixes timesheets_status_check check constraint violation when marking payments as PAID

-- 1. Update check constraint on timesheets to allow 'PAID' and 'ARCHIVED'
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_status_check;
ALTER TABLE timesheets ADD CONSTRAINT timesheets_status_check 
  CHECK (status = ANY (ARRAY[
    'PENDING'::text, 
    'APPROVED'::text, 
    'REJECTED'::text, 
    'PAID'::text, 
    'ARCHIVED'::text, 
    'PENDING_HOD_APPROVAL'::text, 
    'APPROVED_BY_HOD'::text, 
    'REJECTED_BY_HOD'::text, 
    'APPROVED_BY_COORDINATOR'::text, 
    'REJECTED_BY_COORDINATOR'::text
  ]));

-- 2. Update RLS policy hod_update_department_timesheets to allow ACCOUNTANT role to mark timesheets as PAID
DROP POLICY IF EXISTS hod_update_department_timesheets ON timesheets;
CREATE POLICY hod_update_department_timesheets ON timesheets
  FOR UPDATE
  TO anon, authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM users current_hod
      JOIN users teacher_user ON teacher_user.id = timesheets.teacher_id
      WHERE (
        (current_hod.id = auth.uid() OR current_hod.email = (auth.jwt() ->> 'email'::text))
        AND current_hod.role::text = 'HOD'
        AND (
          current_hod.department_id = teacher_user.department_id 
          OR timesheets.department_id::text = ANY(current_hod.managed_department_ids)
        )
      )
    ))
    OR (EXISTS (
      SELECT 1 FROM users admin_user
      WHERE (
        (admin_user.id = auth.uid() OR admin_user.email = (auth.jwt() ->> 'email'::text))
        AND admin_user.role::text = ANY (ARRAY['COORDINATOR', 'SUPER_ADMIN', 'ACCOUNTANT', 'IT_ADMIN'])
      )
    ))
    OR (auth.role() = 'anon'::text)
  );
