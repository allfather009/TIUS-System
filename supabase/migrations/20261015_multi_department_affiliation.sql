-- Migration: Multi-Department Affiliation for Acting HoDs
-- Adds department_ids and departments array columns to public.users table

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department_ids TEXT[] DEFAULT '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS departments TEXT[] DEFAULT '{}';

-- Backfill existing department assignments
UPDATE public.users 
SET department_ids = ARRAY[department_id::text] 
WHERE department_id IS NOT NULL AND (department_ids IS NULL OR department_ids = '{}');

UPDATE public.users u
SET departments = ARRAY[d.name]
FROM public.departments d
WHERE u.department_id = d.id AND (u.departments IS NULL OR u.departments = '{}');
