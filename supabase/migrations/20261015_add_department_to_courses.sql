-- Add department and aliases to courses table
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS department TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'courses' AND column_name = 'course_code'
  ) THEN
    ALTER TABLE public.courses ADD COLUMN course_code TEXT GENERATED ALWAYS AS (code) STORED;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'courses' AND column_name = 'course_name'
  ) THEN
    ALTER TABLE public.courses ADD COLUMN course_name TEXT GENERATED ALWAYS AS (name) STORED;
  END IF;
END $$;

-- Trigger to auto-sync department from stages -> departments if null
CREATE OR REPLACE FUNCTION public.sync_course_department()
RETURNS trigger AS $$
BEGIN
  IF NEW.department IS NULL AND NEW.stage_id IS NOT NULL THEN
    SELECT d.name INTO NEW.department
    FROM public.stages s
    JOIN public.departments d ON d.id = s.department_id
    WHERE s.id = NEW.stage_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_course_department ON public.courses;
CREATE TRIGGER trg_sync_course_department
BEFORE INSERT OR UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.sync_course_department();
