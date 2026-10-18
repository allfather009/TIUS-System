import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('tius_session')?.value;

  if (sessionCookie) {
    try {
      const raw = sessionCookie;
      const decoded = raw.includes('%') ? decodeURIComponent(raw) : raw;
      const session = JSON.parse(decoded);
      if (session.role === 'SUPER_ADMIN') {
        redirect('/admin/roles');
      } else if (session.role === 'COORDINATOR') {
        redirect('/coordinator');
      } else if (session.role === 'HOD') {
        redirect('/hod');
      } else if (session.role === 'ACCOUNTANT') {
        redirect('/finance');
      } else if (session.role === 'TEACHER') {
        redirect('/teacher');
      }
    } catch {
      // ignore parse error and proceed to login
    }
  }

  redirect('/login');
}
