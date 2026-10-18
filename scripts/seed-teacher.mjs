// ==============================================================================
// Script: Provision Test Teacher Account
// Account: teacher@tiu.edu.iq
// Role: TEACHER | Title: Assistant Professor | Rate: $45.00/hr
// ==============================================================================
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://asqlmvmabopyflqmzzqx.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_sikyBX32eE1AYeH_qipJ-A_aih0fgfO';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('--- Provisioning Test Teacher Account ---');
  console.log('Target Email: teacher@tiu.edu.iq');

  // 1. Ensure Auth Account
  const defaultPassword = 'TeacherPassword2025!';
  let userId = 'f28d7827-4388-400b-ab7e-bb32e0d6dd5a';

  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'teacher@tiu.edu.iq',
      password: defaultPassword,
      options: {
        data: {
          name: 'Dr. Test Teacher',
          role: 'TEACHER',
          academic_title: 'Assistant Professor',
        },
      },
    });

    if (signUpData?.user?.id) {
      userId = signUpData.user.id;
      console.log('Auth user confirmed with ID:', userId);
    } else if (signUpError) {
      console.log('Auth status notice:', signUpError.message);
    }
  } catch (err) {
    console.warn('Auth provision warning:', err);
  }

  // 2. Find Computer Engineering & IT department
  const { data: depts } = await supabase
    .from('departments')
    .select('id, name, code')
    .ilike('code', 'CE-IT')
    .limit(1);

  const deptId = depts?.[0]?.id || 'd2646927-5d00-4c43-8711-11cdcfbee981';
  console.log('Department assigned:', depts?.[0]?.name || 'CE-IT', `(${deptId})`);

  // 3. Upsert in public.users table
  const { data: userData, error: userError } = await supabase
    .from('users')
    .upsert(
      {
        id: userId,
        email: 'teacher@tiu.edu.iq',
        name: 'Dr. Test Teacher',
        role: 'TEACHER',
        department_id: deptId,
        employment_type: 'FULL_TIME',
        academic_title: 'Assistant Professor',
        hourly_rate: 45.0,
        staff_id: 'TIU-TEACH-999',
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    )
    .select()
    .maybeSingle();

  if (userError) {
    console.error('Error inserting into public.users:', userError);
  } else {
    console.log('Successfully provisioned public.users record:', userData);
  }

  console.log('\nAccount Ready for Testing:');
  console.log('Email: teacher@tiu.edu.iq');
  console.log('Password:', defaultPassword);
  console.log('Role: TEACHER');
  console.log('Academic Title: Assistant Professor');
  console.log('Hourly Rate: $45.00 / hr');
}

main().catch(console.error);
