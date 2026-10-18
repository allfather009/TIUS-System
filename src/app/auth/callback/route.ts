import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle provider error passed in query params
  if (error) {
    console.error('SSO provider callback error:', error, errorDescription);
    const redirectUrl = new URL('/login', origin);
    redirectUrl.searchParams.set('error', 'access_denied');
    redirectUrl.searchParams.set('message', errorDescription || error);
    return NextResponse.redirect(redirectUrl);
  }

  if (code) {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (authError || !authData.session?.user) {
      console.error('OAuth exchange error:', authError);
      const redirectUrl = new URL('/login', origin);
      redirectUrl.searchParams.set('error', 'access_denied');
      redirectUrl.searchParams.set('message', authError?.message || 'Authentication token exchange failed.');
      return NextResponse.redirect(redirectUrl);
    }

    const email = authData.session.user.email?.toLowerCase().trim();

    if (!email) {
      await supabase.auth.signOut();
      const redirectUrl = new URL('/login', origin);
      redirectUrl.searchParams.set('error', 'access_denied');
      redirectUrl.searchParams.set('message', 'Access Denied: No institutional email provided.');
      return NextResponse.redirect(redirectUrl);
    }

    // Query the users table to check the newly authenticated user's role
    const { data: existingUser, error: queryError } = await supabase
      .from('users')
      .select('id, email, name, role, is_active, academic_title, staff_id, avatar_url, custom_permissions, department_ids, departments')
      .ilike('email', email)
      .maybeSingle();

    if (queryError) {
      console.error('Error querying users table in callback:', queryError);
    }

    // If user's email doesn't exist in the database, redirect them back to the login page with an access denied error
    if (!existingUser) {
      await supabase.auth.signOut();

      const accessDeniedMessage =
        'Access Denied: Your account is not authorized. Contact the Academic Coordinator.';

      const redirectUrl = new URL('/login', origin);
      redirectUrl.searchParams.set('error', 'access_denied');
      redirectUrl.searchParams.set('message', accessDeniedMessage);
      redirectUrl.searchParams.set('email', email);

      const response = NextResponse.redirect(redirectUrl);
      response.cookies.delete('tius_session');
      return response;
    }

    if (existingUser.is_active === false) {
      await supabase.auth.signOut();

      const redirectUrl = new URL('/login', origin);
      redirectUrl.searchParams.set('error', 'access_denied');
      redirectUrl.searchParams.set('message', 'Access Denied: Your account has been deactivated. Please contact the Directorate of HR.');
      redirectUrl.searchParams.set('email', email);

      const response = NextResponse.redirect(redirectUrl);
      response.cookies.delete('tius_session');
      return response;
    }

    // Redirect the user to their respective dashboard based on their role:
    // /admin/roles for SUPER_ADMIN, /teacher for TEACHER, etc.
    let destination = '/teacher';
    switch (existingUser.role) {
      case 'SUPER_ADMIN':
        destination = '/admin/roles';
        break;
      case 'COORDINATOR':
        destination = '/coordinator';
        break;
      case 'HOD':
        destination = '/hod';
        break;
      case 'ACCOUNTANT':
        destination = '/finance';
        break;
      case 'TEACHER':
        destination = '/teacher';
        break;
      default:
        destination = '/teacher';
        break;
    }

    // If explicit next parameter was provided and doesn't conflict with role barriers
    const explicitNext = searchParams.get('next');
    if (
      explicitNext &&
      explicitNext.startsWith('/') &&
      explicitNext !== '/' &&
      explicitNext !== '/admin' &&
      !(existingUser.role !== 'SUPER_ADMIN' && explicitNext.startsWith('/admin/roles'))
    ) {
      destination = explicitNext;
    }

    // Prepare session cookie payload for frontend hydration & SSR middleware
    const sessionPayload = {
      id: existingUser.id,
      userId: existingUser.id,
      name: existingUser.name,
      email: existingUser.email,
      role: existingUser.role,
      roleTitle: existingUser.academic_title || existingUser.role,
      avatarUrl:
        existingUser.avatar_url ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(existingUser.name || 'User')}&background=721c3b&color=fff`,
      staffId: existingUser.staff_id || '',
      departmentName: existingUser.departments?.[0] || '',
      departments: existingUser.departments || [],
      department_ids: existingUser.department_ids || [],
      custom_permissions: existingUser.custom_permissions || {},
      isSimulation: false,
    };

    const response = NextResponse.redirect(`${origin}${destination}`);
    response.cookies.set('tius_session', encodeURIComponent(JSON.stringify(sessionPayload)), {
      path: '/',
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
    });

    return response;
  }

  // If no code provided in callback parameters, redirect back to login
  return NextResponse.redirect(`${origin}/login`);
}
