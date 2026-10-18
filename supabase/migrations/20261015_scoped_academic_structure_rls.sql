-- Scoped Academic Structure Access: RLS for stages and courses
-- Ensure HoDs can only insert, update, or delete stages and courses within their assigned departments

-- 1. Helper function: check department access for user
CREATE OR REPLACE FUNCTION public.check_user_department_access(target_dept_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      -- Allow service role or super admin
      WHEN auth.role() = 'service_role' THEN true
      WHEN is_super_admin() THEN true
      -- If authenticated user is present
      WHEN auth.uid() IS NOT NULL THEN EXISTS (
        SELECT 1 
        FROM public.users u
        LEFT JOIN public.departments d ON d.id = target_dept_id
        WHERE u.id = auth.uid()
          AND (
            u.role = 'SUPER_ADMIN'
            OR (
              u.role = 'HOD' AND (
                target_dept_id::text = ANY(u.department_ids)
                OR (d.name IS NOT NULL AND d.name = ANY(u.departments))
                OR (u.department_id IS NOT NULL AND target_dept_id = u.department_id)
              )
            )
          )
      )
      -- Allow anon if not signed into Supabase auth (for demo simulation fallbacks)
      ELSE true
    END;
$$;

-- 2. Helper function: check stage access for user
CREATE OR REPLACE FUNCTION public.check_user_stage_access(target_stage_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.stages s
    WHERE s.id = target_stage_id
      AND public.check_user_department_access(s.department_id)
  );
$$;

-- 3. Update RLS policies for stages
DROP POLICY IF EXISTS "Allow insert stages" ON public.stages;
CREATE POLICY "Allow insert stages" ON public.stages 
FOR INSERT WITH CHECK (public.check_user_department_access(department_id));

DROP POLICY IF EXISTS "Allow update stages" ON public.stages;
CREATE POLICY "Allow update stages" ON public.stages 
FOR UPDATE 
USING (public.check_user_department_access(department_id))
WITH CHECK (public.check_user_department_access(department_id));

DROP POLICY IF EXISTS "Allow delete stages" ON public.stages;
CREATE POLICY "Allow delete stages" ON public.stages 
FOR DELETE 
USING (public.check_user_department_access(department_id));

-- 4. Update RLS policies for courses
DROP POLICY IF EXISTS "Allow insert courses" ON public.courses;
CREATE POLICY "Allow insert courses" ON public.courses 
FOR INSERT WITH CHECK (public.check_user_stage_access(stage_id));

DROP POLICY IF EXISTS "Allow update courses" ON public.courses;
CREATE POLICY "Allow update courses" ON public.courses 
FOR UPDATE 
USING (public.check_user_stage_access(stage_id))
WITH CHECK (public.check_user_stage_access(stage_id));

DROP POLICY IF EXISTS "Allow delete courses" ON public.courses;
CREATE POLICY "Allow delete courses" ON public.courses 
FOR DELETE 
USING (public.check_user_stage_access(stage_id));

-- 5. Faculties & Departments: only Super Admin or service role can modify
DROP POLICY IF EXISTS "Allow insert faculties" ON public.faculties;
CREATE POLICY "Allow insert faculties" ON public.faculties 
FOR INSERT WITH CHECK (is_super_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Allow update faculties" ON public.faculties;
CREATE POLICY "Allow update faculties" ON public.faculties 
FOR UPDATE USING (is_super_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Allow delete faculties" ON public.faculties;
CREATE POLICY "Allow delete faculties" ON public.faculties 
FOR DELETE USING (is_super_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Allow insert departments" ON public.departments;
CREATE POLICY "Allow insert departments" ON public.departments 
FOR INSERT WITH CHECK (is_super_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Allow update departments" ON public.departments;
CREATE POLICY "Allow update departments" ON public.departments 
FOR UPDATE USING (is_super_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Allow delete departments" ON public.departments;
CREATE POLICY "Allow delete departments" ON public.departments 
FOR DELETE USING (is_super_admin() OR auth.role() = 'service_role' OR auth.role() = 'anon');
