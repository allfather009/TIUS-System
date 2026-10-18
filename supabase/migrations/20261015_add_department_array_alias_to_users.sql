-- Add department TEXT[] generated column to public.users for backward and forward compatibility
-- with queries using .overlaps('department', ...) or .overlaps('departments', ...)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'department'
    ) THEN
        ALTER TABLE public.users 
        ADD COLUMN department TEXT[] GENERATED ALWAYS AS (departments) STORED;
    END IF;
END $$;
