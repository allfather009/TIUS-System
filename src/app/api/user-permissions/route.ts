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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const type = searchParams.get('type') || '';
    const admin = createAdminClient();

    // 1. If requesting role permissions specifically
    if (type === 'roles') {
      const { data: settingsData, error: settingsError } = await admin
        .from('system_settings')
        .select('role_permissions')
        .eq('id', 1)
        .maybeSingle();

      if (settingsError) {
        console.error('Failed to query role_permissions:', settingsError);
        return NextResponse.json(
          { success: false, error: `Failed to fetch role permissions from database: ${settingsError.message}` },
          { status: 500, headers: NO_CACHE_HEADERS }
        );
      }

      const rolePerms = settingsData?.role_permissions && Object.keys(settingsData.role_permissions).length > 0
        ? settingsData.role_permissions
        : DEFAULT_ROLE_PERMISSIONS;

      return NextResponse.json(
        { success: true, role_permissions: rolePerms },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // 2. Fetch user directory with custom permissions
    let builder = admin
      .from('users')
      .select('id, name, email, role, academic_title, custom_permissions')
      .order('name');

    if (query.trim()) {
      builder = builder.or(`name.ilike.%${query}%,email.ilike.%${query}%`);
    }

    const { data, error } = await builder.limit(20);

    if (error) {
      console.error('Failed to query users directory:', error);
      return NextResponse.json(
        { success: false, error: `Failed to query users from database: ${error.message}` },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // Also include role_permissions for client convenience
    const { data: settingsData } = await admin
      .from('system_settings')
      .select('role_permissions')
      .eq('id', 1)
      .maybeSingle();

    const rolePerms = settingsData?.role_permissions && Object.keys(settingsData.role_permissions).length > 0
      ? settingsData.role_permissions
      : DEFAULT_ROLE_PERMISSIONS;

    return NextResponse.json(
      {
        success: true,
        data: data || [],
        role_permissions: rolePerms,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('User permissions GET exception:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const admin = createAdminClient();

    // Case 1: Update Role Permissions (Entire Role)
    if (body.role && body.role_permissions) {
      const { role, role_permissions } = body;
      const { data: currentSettings, error: fetchError } = await admin
        .from('system_settings')
        .select('role_permissions')
        .eq('id', 1)
        .maybeSingle();

      if (fetchError) {
        console.error('Failed to fetch existing role_permissions:', fetchError);
        return NextResponse.json(
          { success: false, error: `Failed to fetch existing role permissions: ${fetchError.message}` },
          { status: 500, headers: NO_CACHE_HEADERS }
        );
      }

      const existingRolePerms = (currentSettings?.role_permissions || DEFAULT_ROLE_PERMISSIONS) as Record<string, Record<string, boolean>>;
      const roleKey = String(role);
      const updatedRolePerms: Record<string, Record<string, boolean>> = {
        ...existingRolePerms,
        [roleKey]: {
          ...(existingRolePerms[roleKey] || (DEFAULT_ROLE_PERMISSIONS as Record<string, Record<string, boolean>>)[roleKey] || {}),
          ...role_permissions,
        },
      };

      const { data, error } = await admin
        .from('system_settings')
        .update({ role_permissions: updatedRolePerms })
        .eq('id', 1)
        .select()
        .single();

      if (error) {
        console.error('Failed to update role_permissions in database:', error);
        return NextResponse.json(
          {
            success: false,
            error: `Failed to save role_permissions to Supabase: ${error.message} (Code: ${error.code})`,
          },
          { status: 500, headers: NO_CACHE_HEADERS }
        );
      }

      return NextResponse.json(
        { success: true, role_permissions: data?.role_permissions || updatedRolePerms },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // Case 2: Update User-Level Permission Overrides (Individual User)
    const { userId, custom_permissions } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId or role is required' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const { data, error } = await admin
      .from('users')
      .update({ custom_permissions })
      .eq('id', userId)
      .select('id, name, email, role, custom_permissions')
      .single();

    if (error) {
      console.error('Failed to update user custom_permissions:', error);
      return NextResponse.json(
        { success: false, error: `Failed to update user permissions in database: ${error.message}` },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, data },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('User permissions POST exception:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
