import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function getDefaultPortal(role?: string | null): string {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'IT_ADMIN':
      return '/admin/roles';
    case 'COORDINATOR':
      return '/coordinator';
    case 'HOD':
      return '/hod';
    case 'ACCOUNTANT':
      return '/finance';
    case 'DEAN':
    case 'VICE_DEAN':
    case 'TEACHER':
      return '/teacher';
    default:
      return '/login';
  }
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('tius_session')?.value;
  const simRoleCookie = cookieStore.get('simulated_role')?.value;

  let userRole: string | null = null;
  let userId: string | null = null;

  if (sessionCookie) {
    try {
      const decoded = sessionCookie.includes('%') ? decodeURIComponent(sessionCookie) : sessionCookie;
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === 'object' && !parsed.isSimulation && parsed.id && parsed.role) {
        userRole = parsed.role;
        userId = parsed.id;
      }
    } catch {}
  }

  if (!userId) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (dbUser?.role) {
          userRole = dbUser.role;
          userId = user.id;
        }
      }
    } catch {}
  }

  // If user is Super Admin simulating another role
  if (simRoleCookie && userRole === 'SUPER_ADMIN') {
    userRole = simRoleCookie;
  }

  if (!userId || !userRole) {
    redirect('/login');
  }

  redirect(getDefaultPortal(userRole));
}
