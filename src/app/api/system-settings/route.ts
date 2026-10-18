import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('system_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found, insert default
        const { data: inserted, error: insertError } = await admin
          .from('system_settings')
          .insert({ id: 1, base_currency: 'IQD', exchange_rate: 150000, finance_can_edit_exchange: true })
          .select()
          .single();
        if (insertError) {
          return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: inserted });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const admin = createAdminClient();

    const updatePayload: Record<string, unknown> = {};
    if (body.base_currency !== undefined) updatePayload.base_currency = body.base_currency;
    if (body.exchange_rate !== undefined) updatePayload.exchange_rate = body.exchange_rate;
    if (body.finance_can_edit_exchange !== undefined) updatePayload.finance_can_edit_exchange = body.finance_can_edit_exchange;
    if (body.coordinator_can_view_currency !== undefined) updatePayload.coordinator_can_view_currency = body.coordinator_can_view_currency;

    const { data, error } = await admin
      .from('system_settings')
      .update(updatePayload)
      .eq('id', 1)
      .select()
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

