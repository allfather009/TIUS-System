-- ==============================================================================
-- TIUS Extra Hours & Payroll System - Database Schema (Supabase PostgreSQL)
-- Institution: Tishk International University (TIU) — Sulaimani Campus
-- ==============================================================================

-- 1. Create custom ENUM types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'IT_ADMIN', 'COORDINATOR', 'HOD', 'DEAN', 'VICE_DEAN', 'TEACHER', 'ACCOUNTANT');
EXCEPTION
    WHEN duplicate_object THEN 
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN' BEFORE 'COORDINATOR';
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'IT_ADMIN';
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'DEAN';
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'VICE_DEAN';
        EXCEPTION
            WHEN others THEN null;
        END;
END $$;

DO $$ BEGIN
    CREATE TYPE employment_type AS ENUM ('FULL_TIME', 'PART_TIME');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE timesheet_status AS ENUM ('PENDING', 'PENDING_HOD_APPROVAL', 'APPROVED', 'REJECTED', 'PAID');
EXCEPTION
    WHEN duplicate_object THEN 
        BEGIN
            ALTER TYPE timesheet_status ADD VALUE IF NOT EXISTS 'PENDING_HOD_APPROVAL';
            ALTER TYPE timesheet_status ADD VALUE IF NOT EXISTS 'REJECTED';
        EXCEPTION
            WHEN others THEN null;
        END;
END $$;

-- 2. Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT,
    faculty TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Users Table
-- Note: id matches auth.users.id when logged in with Supabase Auth,
-- or defaults to gen_random_uuid() for pre-provisioned university faculty/staff.
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'TEACHER',
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    employment_type employment_type NOT NULL DEFAULT 'FULL_TIME',
    academic_title TEXT,
    hourly_rate NUMERIC(10, 2) DEFAULT 35.00,
    staff_id TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Timesheets Table
CREATE TABLE IF NOT EXISTS public.timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    hod_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    hours NUMERIC(5, 2) NOT NULL CHECK (hours > 0),
    status timesheet_status NOT NULL DEFAULT 'PENDING',
    course_code TEXT,
    session_type TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Academic Rates Table
CREATE TABLE IF NOT EXISTS public.academic_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL UNIQUE,
    hourly_rate NUMERIC(10, 2) NOT NULL CHECK (hourly_rate > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON public.users(department_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_teacher_id ON public.timesheets(teacher_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_hod_id ON public.timesheets(hod_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_date ON public.timesheets(date);
CREATE INDEX IF NOT EXISTS idx_timesheets_status ON public.timesheets(status);
CREATE INDEX IF NOT EXISTS idx_academic_rates_title ON public.academic_rates(title);

-- Enable Row Level Security (RLS)
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read academic_rates" ON public.academic_rates;
CREATE POLICY "Allow read academic_rates" ON public.academic_rates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert academic_rates" ON public.academic_rates;
CREATE POLICY "Allow insert academic_rates" ON public.academic_rates FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update academic_rates" ON public.academic_rates;
CREATE POLICY "Allow update academic_rates" ON public.academic_rates FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete academic_rates" ON public.academic_rates;
CREATE POLICY "Allow delete academic_rates" ON public.academic_rates FOR DELETE USING (true);

-- Public / Authenticated RLS Policies
DROP POLICY IF EXISTS "Allow public read departments" ON public.departments;
CREATE POLICY "Allow public read departments" ON public.departments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all modifications on departments" ON public.departments;
CREATE POLICY "Allow all modifications on departments" ON public.departments FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read users" ON public.users;
CREATE POLICY "Allow read users" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert users" ON public.users;
CREATE POLICY "Allow insert users" ON public.users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update users" ON public.users;
CREATE POLICY "Allow update users" ON public.users FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete users" ON public.users;
CREATE POLICY "Allow delete users" ON public.users FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow read timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "hod_select_department_timesheets" ON public.timesheets;
CREATE POLICY "hod_select_department_timesheets"
ON public.timesheets
FOR SELECT
TO authenticated, anon
USING (
  -- Allow HOD to select timesheets of teachers in the same department
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
  OR timesheets.teacher_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.users AS admin_user
    WHERE (admin_user.id = auth.uid() OR admin_user.email = (auth.jwt() ->> 'email'))
      AND admin_user.role IN ('COORDINATOR', 'SUPER_ADMIN', 'ACCOUNTANT')
  )
  OR (auth.role() = 'anon')
);

DROP POLICY IF EXISTS "Allow insert timesheets" ON public.timesheets;
CREATE POLICY "Allow insert timesheets" ON public.timesheets FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update timesheets" ON public.timesheets;
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


-- ==============================================================================
-- SEED DATA (Departments & University Staff matching TIUS Design Prototype)
-- ==============================================================================

-- 1. Insert Departments
INSERT INTO public.departments (id, name, code, faculty)
VALUES
    ('d1111111-1111-1111-1111-111111111111', 'Computer Engineering & IT', 'CE-IT', 'Engineering'),
    ('d2222222-2222-2222-2222-222222222222', 'Faculty of Dentistry', 'DENT', 'Dentistry'),
    ('d3333333-3333-3333-3333-333333333333', 'Civil Engineering', 'CIVIL', 'Engineering'),
    ('d4444444-4444-4444-4444-444444444444', 'Administrative Sciences & Economics', 'ADMIN-ECON', 'Business & Law'),
    ('d5555555-5555-5555-5555-555555555555', 'Faculty of Pharmacy', 'PHARM', 'Pharmacy'),
    ('d6666666-6666-6666-6666-666666666666', 'Law & International Relations', 'LAW-IR', 'Business & Law'),
    ('d7777777-7777-7777-7777-777777777777', 'Architecture & Interior Design', 'ARCH', 'Engineering'),
    ('d8888888-8888-8888-8888-888888888888', 'Basic Sciences & Math', 'SCI-MATH', 'Science'),
    ('d9999999-9999-9999-9999-999999999999', 'Academic Coordination Office', 'ACO', 'Central Admin'),
    ('daaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'University Finance & Treasury', 'FIN', 'Central Admin')
ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code;

-- 2. Insert Staff & Faculty Users
INSERT INTO public.users (id, email, name, role, department_id, employment_type, academic_title, hourly_rate, staff_id, avatar_url)
VALUES
    ('3173be76-e43d-499e-869c-fefc30cac0e5', 'barez.hassan@tiu.edu.iq', 'Barez Hassan', 'SUPER_ADMIN', null, 'FULL_TIME', 'System Super Administrator', 0.00, 'TIU-SUPER-001', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'),
    ('u1111111-1111-1111-1111-111111111111', 'sarah.bayati@tiu.edu.iq', 'Dr. Sarah Al-Bayati', 'COORDINATOR', 'd1111111-1111-1111-1111-111111111111', 'FULL_TIME', 'Academic Coordinator & Lecturer', 55.00, 'TIU-4119', 'https://lh3.googleusercontent.com/aida-public/AB6AXuDi_rhOoAnU0dCCIZzwWJzlPTStvQ0i2xVlLfrpvE-UM02VNwSEJEqpAzEu1UxsrVZFvFziGMcZYPbuEHCEFu-owfquciCIKADZEL5yCfpqjqt-AW7UciRILindl61y0tBj5fdk_q5wFjMWeOAAHFlW1gj1EQeNc178N9kiJHG_nHkPIvo3UDQA82Cmv15L4e_0ce_i96NHEIT5gmiN_HHg8eINlrCyGTN2uKGseLd8oXuNKnxK1npo'),
    ('u2222222-2222-2222-2222-222222222222', 'kawa.rashid@tiu.edu.iq', 'Prof. Dr. Kawa Rashid', 'HOD', 'd1111111-1111-1111-1111-111111111111', 'FULL_TIME', 'Professor & Faculty Lead', 65.00, 'TIU-1002', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCX2p6NwcVU0pCAxARYDeyTLZutJFLjcth9uydwQh63jB3qJH5ALx7OwVMb8vPHGe6pDab5oik_gI9YuypAnWxgp5i5EfTnxdVCPIifX8ust1tuNXFgQljoI51HHI17tXYtwK5jztSqKV4_L7JkW6ROjhPQRkXiN4zcvEDrncOJ7svg7YReLxujgnUW2fsOci80adG1iPGsqtxgj0ABlPu3vFoMpBHtFGHC7wRnTlYOoySnEhPSUsRN'),
    ('u3333333-3333-3333-3333-333333333333', 'aras.karim@tiu.edu.iq', 'Dr. Aras Karim', 'HOD', 'd3333333-3333-3333-3333-333333333333', 'FULL_TIME', 'Associate Professor', 50.00, 'TIU-1088', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBpl3XmYvQ2dE_tfw6-x0fRbsmV6wnkyCqOqWKmOF16ND5ke8j6ZPkPHHl7mE71RFzOfLANGHPjBpUGb1g71QQ53r9K6KLDFLCGPJB5YjeIRJabUFrIkw2jFCtknw0oLPAwJ5WEe8jyEjHiYYxhjPCHL_P1qK68QUzFeT5V6XYjgf_dX8yfKzdM6bs2R69JqthuLrmbMSFuPugmeG8gUmEHg-oye-nDDoOpojLXM9mKzT3r0_dRpOHV'),
    ('u4444444-4444-4444-4444-444444444444', 'rezan.faraj@tiu.edu.iq', 'Rezan K. Faraj', 'ACCOUNTANT', 'daaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'FULL_TIME', 'Chief Payroll Officer', 45.00, 'TIU-0941', null),
    ('u5555555-5555-5555-5555-555555555555', 'alan.omer@tiu.edu.iq', 'Dr. Alan Omer', 'TEACHER', 'd1111111-1111-1111-1111-111111111111', 'FULL_TIME', 'Assistant Professor', 45.00, 'TIU-2104', null),
    ('u6666666-6666-6666-6666-666666666666', 'darya.qadir@tiu.edu.iq', 'Asst. Prof. Darya Qadir', 'COORDINATOR', 'd9999999-9999-9999-9999-999999999999', 'FULL_TIME', 'Academic Affairs Lead', 55.00, 'TIU-0842', null),
    ('u7777777-7777-7777-7777-777777777777', 'halgurd.saber@tiu.edu.iq', 'Dr. Halgurd Saber', 'TEACHER', 'd2222222-2222-2222-2222-222222222222', 'PART_TIME', 'Senior Clinical Lecturer', 60.00, 'TIU-3321', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBpl3XmYvQ2dE_tfw6-x0fRbsmV6wnkyCqOqWKmOF16ND5ke8j6ZPkPHHl7mE71RFzOfLANGHPjBpUGb1g71QQ53r9K6KLDFLCGPJB5YjeIRJabUFrIkw2jFCtknw0oLPAwJ5WEe8jyEjHiYYxhjPCHL_P1qK68QUzFeT5V6XYjgf_dX8yfKzdM6bs2R69JqthuLrmbMSFuPugmeG8gUmEHg-oye-nDDoOpojLXM9mKzT3r0_dRpOHV'),
    ('u8888888-8888-8888-8888-888888888888', 'ali.rashid@tiu.edu.iq', 'Dr. Ali Rashid', 'TEACHER', 'd1111111-1111-1111-1111-111111111111', 'FULL_TIME', 'Assistant Professor', 45.00, 'TIU-2490', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCX2p6NwcVU0pCAxARYDeyTLZutJFLjcth9uydwQh63jB3qJH5ALx7OwVMb8vPHGe6pDab5oik_gI9YuypAnWxgp5i5EfTnxdVCPIifX8ust1tuNXFgQljoI51HHI17tXYtwK5jztSqKV4_L7JkW6ROjhPQRkXiN4zcvEDrncOJ7svg7YReLxujgnUW2fsOci80adG1iPGsqtxgj0ABlPu3vFoMpBHtFGHC7wRnTlYOoySnEhPSUsRN'),
    ('u9999999-9999-9999-9999-999999999999', 'zana.hama@tiu.edu.iq', 'Dr. Zana Hama', 'TEACHER', 'd5555555-5555-5555-5555-555555555555', 'FULL_TIME', 'Pharmaceutical Researcher', 45.00, 'TIU-1930', 'https://lh3.googleusercontent.com/aida-public/AB6AXuAb4cB5EuDfeGSfMcTh0hinBDBEvsIdM4UewE26PiwYPPCLEOWRV1o4DtNdS7SiDTyVIXa_QPFHe0FmV0QMeNVL1BPt2TzBeX-JBQ5Wulzo4cIkfIDOE-s8ueewGEqOuTXFmVxnIrZ_0rRbDBwsoLrUixDKqQYj99A9sa9OPIOEDEstEZeWm6j4PU4bf3JNwtVAY85uwghKOzSnKSO4s1LpblLquawqqdeR90Y11O9fUb9Y56v2QgRr')
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    academic_title = EXCLUDED.academic_title,
    hourly_rate = EXCLUDED.hourly_rate;

-- 3. Insert Sample Timesheets
INSERT INTO public.timesheets (teacher_id, hod_id, date, hours, status, course_code, session_type, notes)
VALUES
    ('u8888888-8888-8888-8888-888888888888', 'u2222222-2222-2222-2222-222222222222', '2024-10-15', 2.0, 'APPROVED', 'CS301', 'Algorithm Lab Makeup', 'Holiday makeup session'),
    ('u1111111-1111-1111-1111-111111111111', 'u2222222-2222-2222-2222-222222222222', '2024-10-18', 3.5, 'APPROVED', 'SE402', 'Curriculum Review Lab', 'Specialized review module'),
    ('u7777777-7777-7777-7777-777777777777', 'u2222222-2222-2222-2222-222222222222', '2024-10-20', 4.0, 'PENDING', 'DENT201', 'Clinical Prosthodontics Session 4', 'Extended clinic supervision'),
    ('u9999999-9999-9999-9999-999999999999', 'u2222222-2222-2222-2222-222222222222', '2024-10-21', 3.0, 'PENDING', 'PHARM305', 'Organic Chemistry Synthesis Lab', 'Extended titration module');
