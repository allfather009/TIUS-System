import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const admin = createAdminClient();

    let builder = admin
      .from('users')
      .select('id, name, email, role, academic_title, custom_permissions')
      .order('name');

    if (query.trim()) {
      builder = builder.or(`name.ilike.%${query}%,email.ilike.%${query}%`);
    }

    const { data, error } = await builder.limit(20);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, custom_permissions } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('users')
      .update({ custom_permissions })
      .eq('id', userId)
      .select('id, name, email, role, custom_permissions')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
