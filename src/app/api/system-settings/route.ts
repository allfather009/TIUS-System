import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/services/systemSettingsService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

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
        // Record not found, insert default with role permissions
        const { data: inserted, error: insertError } = await admin
          .from('system_settings')
          .insert({
            id: 1,
            base_currency: 'IQD',
            exchange_rate: 150000,
            finance_can_edit_exchange: true,
            role_permissions: DEFAULT_ROLE_PERMISSIONS,
          })
          .select()
          .single();

        if (insertError) {
          console.error('System settings default insert error:', insertError);
          return NextResponse.json(
            { success: false, error: `Failed to initialize system_settings in Supabase: ${insertError.message}` },
            { status: 500, headers: NO_CACHE_HEADERS }
          );
        }

        return NextResponse.json(
          {
            success: true,
            data: {
              ...inserted,
              role_permissions: inserted?.role_permissions || DEFAULT_ROLE_PERMISSIONS,
            },
          },
          { headers: NO_CACHE_HEADERS }
        );
      }

      console.error('System settings query error:', error);
      return NextResponse.json(
        { success: false, error: `Database error querying system_settings: ${error.message}` },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...data,
          role_permissions: data?.role_permissions && Object.keys(data.role_permissions).length > 0
            ? data.role_permissions
            : DEFAULT_ROLE_PERMISSIONS,
        },
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('System settings GET exception:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500, headers: NO_CACHE_HEADERS });
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
    if (body.role_permissions !== undefined) updatePayload.role_permissions = body.role_permissions;

    const { data, error } = await admin
      .from('system_settings')
      .update(updatePayload)
      .eq('id', 1)
      .select()
      .single();

    if (error) {
      console.error('System settings update error:', error);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to update system_settings in Supabase: ${error.message} (Code: ${error.code})`,
        },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...data,
          role_permissions: data?.role_permissions || body.role_permissions || DEFAULT_ROLE_PERMISSIONS,
        },
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('System settings POST exception:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
