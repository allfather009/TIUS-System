import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

function clearAllAuthCookies(response: NextResponse) {
  response.cookies.delete('tius_session');
  response.cookies.delete('tius_simulated_user');
  response.cookies.delete('simulated_role');
  response.cookies.delete('simulated_user_id');
  response.cookies.set('tius_session', '', { path: '/', maxAge: 0 });
  response.cookies.set('tius_simulated_user', '', { path: '/', maxAge: 0 });
  response.cookies.set('simulated_role', '', { path: '/', maxAge: 0 });
  response.cookies.set('simulated_user_id', '', { path: '/', maxAge: 0 });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {}

  const response = NextResponse.redirect(new URL('/login', request.url), {
    status: 302,
  });
  clearAllAuthCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {}

  const response = NextResponse.redirect(new URL('/login', request.url), {
    status: 302,
  });
  clearAllAuthCookies(response);
  return response;
}

