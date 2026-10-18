import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    let directPgResult: Record<string, unknown> | null = null;

    // Optional direct pg connection test if DATABASE_URL is provided in environment
    if (databaseUrl) {
      try {
        const { Client } = await import('pg');
        const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
        await client.connect();
        const pgRes = await client.query('SELECT 1 as ping, NOW() as server_time');
        await client.end();
        directPgResult = {
          success: true,
          rows: pgRes.rows,
        };
      } catch (pgErr) {
        directPgResult = {
          success: false,
          error: pgErr instanceof Error ? pgErr.message : String(pgErr),
        };
      }
    }

    // Connect via @supabase/ssr server client
    const supabase = await createClient();

    // Check service role admin key if configured
    let serviceRoleConnected = false;
    let serviceRoleError: string | null = null;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const adminSupabase = createAdminClient();
        const { error: adminErr } = await adminSupabase.from('payroll_settings').select('id').limit(1);
        if (adminErr) {
          serviceRoleError = adminErr.message;
        } else {
          serviceRoleConnected = true;
        }
      } catch (adminEx) {
        serviceRoleError = adminEx instanceof Error ? adminEx.message : String(adminEx);
      }
    }

    // Query departments and users to verify live Supabase schema accessibility
    const [deptRes, usersRes] = await Promise.all([
      supabase.from('departments').select('id, name, code').limit(1),
      supabase.from('users').select('id, email, name, role').limit(1),
    ]);

    const isConnected = !deptRes.error && !usersRes.error;
    const latencyMs = Date.now() - startTime;

    if (!isConnected) {
      return NextResponse.json(
        {
          success: false,
          status: 'error',
          message: 'Database query failed',
          latencyMs,
          errors: {
            departments: deptRes.error,
            users: usersRes.error,
          },
          directPg: directPgResult,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: 'connected',
        ping: 1,
        serverTime: new Date().toISOString(),
        latencyMs,
        client: '@supabase/ssr',
        supabaseUrl,
        keyConfigured: Boolean(supabaseAnonKey),
        serviceRole: {
          configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
          connected: serviceRoleConnected,
          error: serviceRoleError,
        },
        tables: {
          departments: {
            accessible: true,
            sample: deptRes.data?.[0] || null,
          },
          users: {
            accessible: true,
            sample: usersRes.data?.[0] || null,
          },
        },
        directPg: directPgResult,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        status: 'connection_failed',
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
