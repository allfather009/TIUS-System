import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TIUS Extra Hours & Payroll Portal | Tishk International University',
  description:
    'Institutional role-based extra teaching hours verification, Department Head review, and central payroll reconciliation portal for Tishk International University - Sulaimani Campus.',
  icons: {
    icon: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDoDDRqJXEliwiAbQj3HE8fZbuJHyNLm4oXuQQ5QO7nQeR8qOdesMMJqIyGvqtkCY9Rjzbsq1raOKhc9i3B1hmX-CKY9ZP_pb0ev_safjontFAUkVZbtIPdFcN0LFfGLhBh695WC0f-958s-4dkfKqnb-dqpdihEqMy9cF7CHQFDpWItxiA4tI327j1Yut7rDKyJsZsz6UFPox71r5RXf4cWZ-uwLT2qmPnLstL1KjH8AKbnjNDjRdJpgmI0MtJb09N4w',
  },
};

import { cookies } from 'next/headers';
import { SessionProvider, DEFAULT_USERS } from '@/lib/context/SessionContext';
import { UserRole } from '@/types/database';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('tius_session')?.value;
  const simRoleCookie = cookieStore.get('simulated_role')?.value;
  const simUserCookie = cookieStore.get('tius_simulated_user')?.value;

  let initialRole: UserRole | undefined;
  let initialRealUser: any = null;
  let initialSimulatedUser: any = null;
  let initialIsSimulating = false;

  if (sessionCookie) {
    try {
      const raw = sessionCookie;
      const decoded = raw.includes('%') ? decodeURIComponent(raw) : raw;
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === 'object') {
        initialRealUser = parsed;
        if (parsed?.role && parsed.role in DEFAULT_USERS) {
          initialRole = parsed.role as UserRole;
        }
      }
    } catch {
      // ignore parse error
    }
  }

  // Simulation is strictly gated exclusively to real SUPER_ADMIN
  if (simRoleCookie && initialRealUser?.role === 'SUPER_ADMIN') {
    if (simUserCookie) {
      try {
        const raw = simUserCookie;
        const decoded = raw.includes('%') ? decodeURIComponent(raw) : raw;
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed === 'object') {
          initialSimulatedUser = parsed;
          initialIsSimulating = true;
          if (parsed.role && parsed.role in DEFAULT_USERS) {
            initialRole = parsed.role as UserRole;
          }
        }
      } catch {
        // ignore parse error
      }
    } else if (simRoleCookie in DEFAULT_USERS) {
      initialRole = simRoleCookie as UserRole;
      initialIsSimulating = true;
    }
  }

  return (
    <html lang="en" className={`${inter.variable} ${plusJakartaSans.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-surface font-body-md text-on-surface antialiased selection:bg-primary selection:text-on-primary">
        <SessionProvider
          initialRole={initialRole}
          initialRealUser={initialRealUser}
          initialSimulatedUser={initialSimulatedUser}
          initialIsSimulating={initialIsSimulating}
        >
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
