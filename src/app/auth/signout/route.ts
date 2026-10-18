import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL('/login', request.url), {
    status: 302,
  });
  response.cookies.delete('tius_session');
  return response;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL('/login', request.url), {
    status: 302,
  });
  response.cookies.delete('tius_session');
  return response;
}
