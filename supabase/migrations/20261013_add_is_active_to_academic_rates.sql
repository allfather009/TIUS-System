-- Add is_active column to public.academic_rates
ALTER TABLE public.academic_rates 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Update RLS policies to ensure authenticated/anon users can select, insert, update is_active
NOTIFY pgrst, 'reload schema';
