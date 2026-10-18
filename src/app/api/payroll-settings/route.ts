import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PayrollSettings } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('payroll_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data?.[0] || null });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: Partial<PayrollSettings> = await req.json();
    const admin = createAdminClient();

    const { data: existingRows } = await admin
      .from('payroll_settings')
      .select('id')
      .limit(1);

    const now = new Date().toISOString();
    let resultData = null;

    if (existingRows && existingRows.length > 0) {
      const targetId = existingRows[0].id;
      const { data, error } = await admin
        .from('payroll_settings')
        .update({
          auto_lock: body.auto_lock,
          auto_cycle_day: body.auto_cycle_day !== undefined ? body.auto_cycle_day : 25,
          start_date: body.start_date,
          end_date: body.end_date,
          is_locked: body.is_locked,
          cycle_name: body.cycle_name,
          updated_at: now,
        })
        .eq('id', targetId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      resultData = data;
    } else {
      const { data, error } = await admin
        .from('payroll_settings')
        .insert({
          auto_lock: body.auto_lock,
          auto_cycle_day: body.auto_cycle_day !== undefined ? body.auto_cycle_day : 25,
          start_date: body.start_date,
          end_date: body.end_date,
          is_locked: body.is_locked,
          cycle_name: body.cycle_name,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      resultData = data;
    }

    return NextResponse.json({ success: true, data: resultData });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
