import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { resolveEffectivePermission } from '@/lib/services/systemSettingsService';

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request);

  const pathname = request.nextUrl.pathname;

  // Skip public assets, internal API routes, and auth callback
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth') ||
    pathname === '/favicon.ico'
  ) {
    return supabaseResponse;
  }

  // Parse real authenticated session from primary cookie or Supabase auth token
  const sessionCookie = request.cookies.get('tius_session')?.value;
  let realUserRole: string | null = null;
  let realCustomPermissions: Record<string, boolean> = {};
  let realUserId: string | null = null;
  let realEmail: string | null = null;
  let realName: string | null = null;

  if (sessionCookie) {
    try {
      const raw = sessionCookie;
      const decoded = raw.includes('%') ? decodeURIComponent(raw) : raw;
      const session = JSON.parse(decoded);
      if (session && typeof session === 'object' && !session.isSimulation) {
        realUserRole = session?.role || null;
        if (session?.custom_permissions) {
          realCustomPermissions = typeof session.custom_permissions === 'string'
            ? JSON.parse(session.custom_permissions)
            : session.custom_permissions;
        }
        realUserId = session?.id || session?.userId || null;
        realEmail = session?.email || null;
        realName = session?.name || null;
      }
    } catch {
      try {
        const session = JSON.parse(decodeURIComponent(sessionCookie));
        if (session && typeof session === 'object' && !session.isSimulation) {
          realUserRole = session?.role || null;
          if (session?.custom_permissions) {
            realCustomPermissions = typeof session.custom_permissions === 'string'
              ? JSON.parse(session.custom_permissions)
              : session.custom_permissions;
          }
          realUserId = session?.id || session?.userId || null;
          realEmail = session?.email || null;
          realName = session?.name || null;
        }
      } catch {
        // ignore parse error
      }
    }
  }

  const authUserRole = (user?.user_metadata?.role || user?.app_metadata?.role || null) as string | null;
  if (!realUserRole && authUserRole) {
    realUserRole = authUserRole;
    const metaPerms = user?.user_metadata?.custom_permissions || user?.app_metadata?.custom_permissions;
    if (metaPerms) {
      realCustomPermissions = typeof metaPerms === 'string' ? JSON.parse(metaPerms) : metaPerms;
    }
    realUserId = user?.id || null;
    realEmail = user?.email || null;
    realName = user?.user_metadata?.name || null;
  }

  // Verify whether the real primary session belongs to a SUPER_ADMIN
  let isRealSuperAdmin = realUserRole === 'SUPER_ADMIN' || authUserRole === 'SUPER_ADMIN';
  if (!isRealSuperAdmin && (realUserId || user?.id || user?.email || realEmail)) {
    try {
      let q = supabase.from('users').select('role');
      if (realUserId && !realUserId.startsWith('demo-') && !realUserId.startsWith('u1111') && !realUserId.startsWith('u8888')) {
        q = q.eq('id', realUserId);
      } else if (user?.email || realEmail) {
        q = q.ilike('email', (user?.email || realEmail)!);
      }
      const { data: dbReal } = await q.maybeSingle();
      if (dbReal?.role === 'SUPER_ADMIN') {
        isRealSuperAdmin = true;
        if (!realUserRole) realUserRole = 'SUPER_ADMIN';
      }
    } catch {
      // ignore
    }
  }

  // Check for safe simulation cookies
  const simulatedRole = request.cookies.get('simulated_role')?.value;
  const simulatedUserCookie = request.cookies.get('tius_simulated_user')?.value;
  let isSimulating = false;
  let simUserObj: any = null;

  let userRole: string | null = realUserRole;
  let customPermissions: Record<string, boolean> = realCustomPermissions;
  let sessionUserId: string | null = realUserId;
  let sessionEmail: string | null = realEmail;
  let sessionName: string | null = realName;

  if (simulatedRole) {
    if (!isRealSuperAdmin) {
      // Unauthorized simulation attempt: Clear simulation cookies
      supabaseResponse.cookies.set('simulated_role', '', { path: '/', maxAge: 0 });
      supabaseResponse.cookies.set('tius_simulated_user', '', { path: '/', maxAge: 0 });
      supabaseResponse.cookies.set('simulated_user_id', '', { path: '/', maxAge: 0 });
    } else {
      // Valid Super Admin simulation active!
      isSimulating = true;
      userRole = simulatedRole;

      if (simulatedUserCookie) {
        try {
          const raw = simulatedUserCookie;
          const decoded = raw.includes('%') ? decodeURIComponent(raw) : raw;
          simUserObj = JSON.parse(decoded);
          if (simUserObj && typeof simUserObj === 'object') {
            if (simUserObj.role) userRole = simUserObj.role;
            if (simUserObj.custom_permissions) {
              customPermissions = typeof simUserObj.custom_permissions === 'string'
                ? JSON.parse(simUserObj.custom_permissions)
                : simUserObj.custom_permissions;
            }
            sessionUserId = simUserObj.id || null;
            sessionEmail = simUserObj.email || null;
            sessionName = simUserObj.name || null;
          }
        } catch {
          // ignore parse error
        }
      }
    }
  }

  // Allow query param override in development or for preview switching
  const queryRole = request.nextUrl.searchParams.get('role');
  if (queryRole) {
    userRole = queryRole;
  }

  // If user is accessing protected routes and customPermissions is empty, sync fresh permissions from DB
  const isProtectedPath = pathname.startsWith('/admin') || pathname.startsWith('/finance') || pathname.startsWith('/payroll');
  if (
    isProtectedPath &&
    Object.keys(customPermissions).length === 0 &&
    (sessionUserId || sessionEmail || user?.email)
  ) {
    try {
      let query = supabase.from('users').select('id, name, role, email, custom_permissions');
      if (
        sessionUserId &&
        !sessionUserId.startsWith('demo-') &&
        !sessionUserId.startsWith('u1111') &&
        !sessionUserId.startsWith('u2222') &&
        !sessionUserId.startsWith('u4444') &&
        !sessionUserId.startsWith('u8888')
      ) {
        query = query.eq('id', sessionUserId);
      } else if (sessionEmail) {
        query = query.ilike('email', sessionEmail);
      } else if (user?.email) {
        query = query.ilike('email', user.email);
      }

      const { data: dbUser, error: dbErr } = await query.maybeSingle();
      if (dbErr) console.warn('Middleware DB query error:', dbErr);
      if (dbUser) {
        if (!userRole) userRole = dbUser.role;
        if (dbUser.custom_permissions && typeof dbUser.custom_permissions === 'object') {
          customPermissions = dbUser.custom_permissions;

          if (isSimulating) {
            // Update temporary simulation cookie ONLY (never overwrite primary tius_session!)
            const updatedSim = {
              ...(simUserObj || {}),
              id: dbUser.id,
              name: dbUser.name || sessionName,
              email: dbUser.email || sessionEmail,
              role: userRole || dbUser.role,
              custom_permissions: customPermissions,
              isSimulation: true,
            };
            supabaseResponse.cookies.set('tius_simulated_user', encodeURIComponent(JSON.stringify(updatedSim)), {
              path: '/',
              maxAge: 86400,
            });
            supabaseResponse.cookies.set('simulated_role', userRole || dbUser.role, {
              path: '/',
              maxAge: 86400,
            });
          } else {
            // Sync refreshed permissions back to primary tius_session cookie for real user
            const updatedSession = {
              id: dbUser.id,
              name: dbUser.name || sessionName,
              email: dbUser.email || sessionEmail || user?.email,
              role: userRole || dbUser.role,
              custom_permissions: customPermissions,
              isSimulation: false,
            };
            supabaseResponse.cookies.set('tius_session', encodeURIComponent(JSON.stringify(updatedSession)), {
              path: '/',
              maxAge: 604800,
            });
          }
        }
      }
    } catch (err) {
      console.error('Middleware DB exception:', err);
    }
  }

  // Default portal destinations per role
  const getDefaultPortal = (role: string | null): string => {
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
  };

  // 1. Root route handling: Redirect authenticated users to their respective default portal
  if (pathname === '/') {
    if (userRole) {
      const url = request.nextUrl.clone();
      url.pathname = getDefaultPortal(userRole);
      return NextResponse.redirect(url);
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 2. Login page handling: If already logged in, redirect to default portal
  if (pathname === '/login') {
    const errorParam = request.nextUrl.searchParams.get('error');
    if (userRole && !errorParam) {
      const url = request.nextUrl.clone();
      url.pathname = getDefaultPortal(userRole);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // 3. Unauthenticated route protection
  const isProtectedPortal =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/coordinator') ||
    pathname.startsWith('/hod') ||
    pathname.startsWith('/teacher') ||
    pathname.startsWith('/finance') ||
    pathname.startsWith('/payroll');

  if (isProtectedPortal && !userRole && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(url);
  }

  // 4. Canonical redirect for legacy /payroll route -> /finance
  if (pathname === '/payroll' || pathname.startsWith('/payroll/')) {
    if (
      userRole === 'ACCOUNTANT' ||
      userRole === 'SUPER_ADMIN' ||
      customPermissions.can_view_finance
    ) {
      const url = request.nextUrl.clone();
      url.pathname = '/finance';
      return NextResponse.redirect(url);
    } else {
      const url = request.nextUrl.clone();
      url.pathname = getDefaultPortal(userRole);
      return NextResponse.redirect(url);
    }
  }

  // ==============================================================================
  // 5. STRICT ROLE-BASED ACCESS CONTROL & CUSTOM PERMISSION EVALUATION
  // ==============================================================================

  const isFinanceRoute = pathname === '/finance' || pathname.startsWith('/finance/');
  const isTeacherRoute = pathname === '/teacher' || pathname.startsWith('/teacher/');
  const isHodRoute = pathname === '/hod' || pathname.startsWith('/hod/');
  const isCoordinatorRoute = pathname === '/coordinator' || pathname.startsWith('/coordinator/');
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');

  let allowed = false;
  let redirectUrl = getDefaultPortal(userRole);
  let deniedReason = 'role_isolation';

  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const perms = customPermissions || {};

  // Load dynamic role permissions from system_settings for role governance
  let rolePermissions: Record<string, Record<string, boolean>> | null = null;
  if (isAdminRoute || isFinanceRoute) {
    try {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/system_settings?select=role_permissions&limit=1`;
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.[0]?.role_permissions && typeof data[0].role_permissions === 'object') {
          rolePermissions = data[0].role_permissions;
        }
      }
    } catch {
      // fallback to defaults if database query fails
    }
  }

  // 1. Finance Route (/finance, /finance/*)
  if (isFinanceRoute) {
    const isArchiveRoute = pathname === '/finance/archive' || pathname.startsWith('/finance/archive/') || pathname.startsWith('/payroll/archive');
    if (isArchiveRoute) {
      const canViewPaymentArchive = resolveEffectivePermission('can_view_payment_archive', userRole, perms, rolePermissions);
      if (canViewPaymentArchive || isSuperAdmin || userRole === 'ACCOUNTANT') {
        allowed = true;
      } else {
        allowed = false;
        redirectUrl = getDefaultPortal(userRole);
        deniedReason = 'role_isolation';
      }
    } else {
      const canViewFinance = resolveEffectivePermission('can_view_finance', userRole, perms, rolePermissions);

      if (
        userRole === 'ACCOUNTANT' ||
        isSuperAdmin ||
        canViewFinance
      ) {
        allowed = true;
      } else {
        allowed = false;
        redirectUrl = getDefaultPortal(userRole);
        deniedReason = 'role_isolation';
      }
    }
  }
  
  // 2. Teacher Route (/teacher, /teacher/*)
  else if (isTeacherRoute) {
    if (userRole === 'TEACHER' || userRole === 'DEAN' || userRole === 'VICE_DEAN' || isSuperAdmin) {
      allowed = true;
    } else {
      allowed = false;
      redirectUrl = getDefaultPortal(userRole);
      deniedReason = 'role_isolation';
    }
  }

  // 3. HOD Route (/hod, /hod/*)
  else if (isHodRoute) {
    if (userRole === 'HOD' || isSuperAdmin) {
      allowed = true;
    } else {
      allowed = false;
      redirectUrl = getDefaultPortal(userRole);
      deniedReason = 'role_isolation';
    }
  }

  // 4. Coordinator Route (/coordinator, /coordinator/*)
  else if (isCoordinatorRoute) {
    if (userRole === 'COORDINATOR' || isSuperAdmin) {
      allowed = true;
    } else {
      allowed = false;
      redirectUrl = getDefaultPortal(userRole);
      deniedReason = 'role_isolation';
    }
  }

  // 5. Admin Routes (/admin, /admin/*) - STRICTLY FOR SUPER_ADMIN & EXPLICIT CUSTOM PERMISSIONS
  else if (isAdminRoute) {
    const isStructurePath = pathname === '/admin/structure' || pathname.startsWith('/admin/structure/');
    const isRatesPath = pathname === '/admin/rates' || pathname.startsWith('/admin/rates/');
    const isAuditPath = pathname === '/admin/audit' || pathname.startsWith('/admin/audit/');
    const isImportPath = pathname === '/admin/import' || pathname.startsWith('/admin/import/');
    const isReportsPath = pathname === '/admin/reports' || pathname.startsWith('/admin/reports/');
    const isDepartmentsPath = pathname === '/admin/departments' || pathname.startsWith('/admin/departments/');
    const isRolesPath = pathname === '/admin/roles' || pathname.startsWith('/admin/roles/');
    const isSettingsPath = pathname === '/admin/settings' || pathname.startsWith('/admin/settings/');
    const isAdminDashboardPath = pathname === '/admin';

    if (isSuperAdmin) {
      // Real Super Admin hitting /admin redirects to /admin/roles
      if (isAdminDashboardPath) {
        const url = request.nextUrl.clone();
        url.pathname = '/admin/roles';
        return NextResponse.redirect(url);
      }
      // Super Admin has unrestricted access to all admin routes
      allowed = true;
    } else {
      // For IT_ADMIN and all other roles, evaluate granular effective permissions
      const canManageRoles = userRole === 'IT_ADMIN' || resolveEffectivePermission('can_manage_roles', userRole, perms, rolePermissions);
      const canManageSettings = resolveEffectivePermission('can_manage_settings', userRole, perms, rolePermissions);
      const canManageRates = resolveEffectivePermission('can_manage_rates', userRole, perms, rolePermissions);
      const canManageStructure = resolveEffectivePermission('can_manage_structure', userRole, perms, rolePermissions);
      const canAuditLogs = resolveEffectivePermission('can_audit_logs', userRole, perms, rolePermissions);
      const canBatchImport = resolveEffectivePermission('can_batch_import', userRole, perms, rolePermissions);
      const canExportPayroll = resolveEffectivePermission('can_export_payroll', userRole, perms, rolePermissions);
      const canViewDepartments = resolveEffectivePermission('can_view_all_departments', userRole, perms, rolePermissions);

      if (isAdminDashboardPath) {
        const url = request.nextUrl.clone();
        if (canManageRoles || userRole === 'IT_ADMIN') url.pathname = '/admin/roles';
        else if (canManageStructure) url.pathname = '/admin/structure';
        else if (canManageRates) url.pathname = '/admin/rates';
        else if (canAuditLogs) url.pathname = '/admin/audit';
        else if (canManageSettings) url.pathname = '/admin/settings';
        else if (canBatchImport) url.pathname = '/admin/import';
        else if (canExportPayroll) url.pathname = '/admin/reports';
        else url.pathname = getDefaultPortal(userRole);
        return NextResponse.redirect(url);
      }

      if (isRolesPath) {
        allowed = canManageRoles;
        if (!allowed) {
          redirectUrl = getDefaultPortal(userRole);
          deniedReason = 'permission_required';
        }
      } else if (isSettingsPath) {
        allowed = canManageSettings;
        if (!allowed) {
          redirectUrl = getDefaultPortal(userRole);
          deniedReason = 'permission_required';
        }
      } else if (isRatesPath) {
        allowed = canManageRates;
        if (!allowed) {
          redirectUrl = getDefaultPortal(userRole);
          deniedReason = 'permission_required';
        }
      } else if (isStructurePath) {
        allowed = canManageStructure;
        if (!allowed) {
          redirectUrl = getDefaultPortal(userRole);
          deniedReason = 'permission_required';
        }
      } else if (isAuditPath) {
        allowed = canAuditLogs;
        if (!allowed) {
          redirectUrl = getDefaultPortal(userRole);
          deniedReason = 'permission_required';
        }
      } else if (isImportPath) {
        allowed = canBatchImport;
        if (!allowed) {
          redirectUrl = getDefaultPortal(userRole);
          deniedReason = 'permission_required';
        }
      } else if (isReportsPath) {
        allowed = canExportPayroll;
        if (!allowed) {
          redirectUrl = getDefaultPortal(userRole);
          deniedReason = 'permission_required';
        }
      } else if (isDepartmentsPath) {
        allowed = canViewDepartments;
        if (!allowed) {
          redirectUrl = getDefaultPortal(userRole);
          deniedReason = 'permission_required';
        }
      } else {
        allowed = Object.values(perms).some(Boolean);
        if (!allowed) {
          redirectUrl = getDefaultPortal(userRole);
          deniedReason = 'permission_required';
        }
      }
    }
  } else {
    // Other miscellaneous authenticated routes are allowed
    allowed = true;
  }

  if (!allowed) {
    const url = request.nextUrl.clone();
    url.pathname = redirectUrl;
    url.searchParams.set('denied', deniedReason);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, svg, icons
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
