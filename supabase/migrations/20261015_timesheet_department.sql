-- Migration: Add department and department_id columns to timesheets
-- Enables explicit departmental routing for multi-department teachers

ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id);

-- Backfill department for existing timesheets from teacher's departments
UPDATE public.timesheets t
SET department = COALESCE(u.departments[1], d.name, 'Computer Engineering'),
    department_id = COALESCE(u.department_ids[1]::uuid, u.department_id)
FROM public.users u
LEFT JOIN public.departments d ON d.id = u.department_id
WHERE t.teacher_id = u.id AND t.department IS NULL;
