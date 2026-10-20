-- ==============================================================================
-- Migration: Phase 1 - HoD Multi-Department & Submitter Model Alignment
-- System: TIUS Extra Hours & Payroll Portal
-- Institution: Tishk International University (TIU)
-- ==============================================================================

-- 1. Ensure timesheet_status enum includes 'PENDING', 'APPROVED', 'REJECTED'
DO $$ BEGIN
    ALTER TYPE timesheet_status ADD VALUE IF NOT EXISTS 'PENDING';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE timesheet_status ADD VALUE IF NOT EXISTS 'APPROVED';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE timesheet_status ADD VALUE IF NOT EXISTS 'REJECTED';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Add submitted_by_id to timesheets table
ALTER TABLE public.timesheets 
ADD COLUMN IF NOT EXISTS submitted_by_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Backfill submitted_by_id from hod_id if available
UPDATE public.timesheets 
SET submitted_by_id = hod_id 
WHERE submitted_by_id IS NULL AND hod_id IS NOT NULL;

-- Index for performant querying of requests by submitter
CREATE INDEX IF NOT EXISTS idx_timesheets_submitted_by_id ON public.timesheets(submitted_by_id);

-- 3. Add managed_department_ids to users table to support HoDs managing up to 2 departments
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS managed_department_ids TEXT[] DEFAULT '{}';

-- Backfill managed_department_ids for existing HODs from department_ids or department_id
UPDATE public.users
SET managed_department_ids = CASE 
    WHEN department_ids IS NOT NULL AND array_length(department_ids, 1) > 0 THEN department_ids
    WHEN department_id IS NOT NULL THEN ARRAY[department_id::text]
    ELSE '{}'::text[]
END
WHERE (role = 'HOD' OR role = 'COORDINATOR') 
  AND (managed_department_ids IS NULL OR managed_department_ids = '{}');

-- 4. Create department_heads relational mapping table (for normalized multi-department heads)
CREATE TABLE IF NOT EXISTS public.department_heads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(department_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_department_heads_dept ON public.department_heads(department_id);
CREATE INDEX IF NOT EXISTS idx_department_heads_user ON public.department_heads(user_id);

-- Backfill department_heads from existing HODs
INSERT INTO public.department_heads (department_id, user_id)
SELECT d.id, u.id
FROM public.users u
CROSS JOIN LATERAL unnest(
    CASE 
        WHEN u.managed_department_ids IS NOT NULL AND array_length(u.managed_department_ids, 1) > 0 
            THEN u.managed_department_ids
        WHEN u.department_id IS NOT NULL 
            THEN ARRAY[u.department_id::text]
        ELSE '{}'::text[]
    END
) AS m(dept_id_str)
JOIN public.departments d ON d.id::text = m.dept_id_str
WHERE u.role = 'HOD'
ON CONFLICT (department_id, user_id) DO NOTHING;

-- 5. Create or Replace Requests View with INSTEAD OF Triggers
-- Provides transparent access to requests table while maintaining 100% compatibility with timesheets
CREATE OR REPLACE VIEW public.requests AS
SELECT 
    t.id,
    t.teacher_id,
    t.teacher_id AS user_id,
    t.submitted_by_id,
    t.hod_id,
    t.date,
    t.hours,
    t.status,
    t.course_code,
    t.session_type,
    t.notes,
    t.course_activity,
    t.department,
    t.department_id,
    t.created_at,
    t.updated_at,
    t.approved_at
FROM public.timesheets t;

-- Trigger to handle INSERT into requests view
CREATE OR REPLACE FUNCTION public.handle_requests_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.timesheets (
        id,
        teacher_id,
        submitted_by_id,
        hod_id,
        date,
        hours,
        status,
        course_code,
        session_type,
        notes,
        course_activity,
        department,
        department_id,
        created_at,
        updated_at
    ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()),
        COALESCE(NEW.teacher_id, NEW.user_id),
        NEW.submitted_by_id,
        COALESCE(NEW.hod_id, NEW.submitted_by_id),
        NEW.date,
        NEW.hours,
        COALESCE(NEW.status, 'PENDING'),
        NEW.course_code,
        NEW.session_type,
        NEW.notes,
        COALESCE(NEW.course_activity, NEW.notes),
        NEW.department,
        NEW.department_id,
        COALESCE(NEW.created_at, timezone('utc'::text, now())),
        COALESCE(NEW.updated_at, timezone('utc'::text, now()))
    )
    RETURNING id INTO NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_requests_insert ON public.requests;
CREATE TRIGGER trg_requests_insert
INSTEAD OF INSERT ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.handle_requests_insert();

-- Trigger to handle UPDATE on requests view
CREATE OR REPLACE FUNCTION public.handle_requests_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.timesheets SET
        teacher_id = COALESCE(NEW.teacher_id, NEW.user_id, OLD.teacher_id),
        submitted_by_id = COALESCE(NEW.submitted_by_id, OLD.submitted_by_id),
        hod_id = COALESCE(NEW.hod_id, OLD.hod_id),
        date = COALESCE(NEW.date, OLD.date),
        hours = COALESCE(NEW.hours, OLD.hours),
        status = COALESCE(NEW.status, OLD.status),
        course_code = COALESCE(NEW.course_code, OLD.course_code),
        session_type = COALESCE(NEW.session_type, OLD.session_type),
        notes = COALESCE(NEW.notes, OLD.notes),
        course_activity = COALESCE(NEW.course_activity, OLD.course_activity),
        department = COALESCE(NEW.department, OLD.department),
        department_id = COALESCE(NEW.department_id, OLD.department_id),
        approved_at = COALESCE(NEW.approved_at, OLD.approved_at),
        updated_at = timezone('utc'::text, now())
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_requests_update ON public.requests;
CREATE TRIGGER trg_requests_update
INSTEAD OF UPDATE ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.handle_requests_update();

-- Trigger to handle DELETE on requests view
CREATE OR REPLACE FUNCTION public.handle_requests_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.timesheets WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_requests_delete ON public.requests;
CREATE TRIGGER trg_requests_delete
INSTEAD OF DELETE ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.handle_requests_delete();
