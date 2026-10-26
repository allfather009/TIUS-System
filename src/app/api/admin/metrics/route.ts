import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRateForTitle } from '@/lib/services/rateService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};


export async function GET() {
  try {
    const supabaseAdmin = createAdminClient();

    // 1. Fetch all timesheets (bypassing RLS with service role client)
    const { data: timesheets, error: tsError } = await supabaseAdmin
      .from('timesheets')
      .select('*');

    if (tsError) {
      console.error('[API /api/admin/metrics] Error fetching timesheets:', tsError);
    }

    // 2. Filter in TypeScript to avoid SQL enum/casing mismatch:
    const approvedTimesheets = (timesheets || []).filter((t) => {
      const s = String(t.status || '').toUpperCase();
      return s === 'APPROVED' || s === 'PAID' || s.includes('APPROVED');
    });

    // 3. Decoupled Rate Resolution (No fragile SQL joins):
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, academic_title');

    const { data: rates, error: ratesError } = await supabaseAdmin
      .from('academic_rates')
      .select('*');

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('system_settings')
      .select('*');

    if (usersError) console.error('[API /api/admin/metrics] Error fetching users:', usersError);
    if (ratesError) console.error('[API /api/admin/metrics] Error fetching rates:', ratesError);
    if (settingsError) console.error('[API /api/admin/metrics] Error fetching settings:', settingsError);

    // 4. Map teacher rates in memory using teacher_id -> users.academic_title -> academic_rates.hourly_rate_usd:
    const userTitleMap = new Map<string, string>();
    (users || []).forEach((u) => {
      if (u.id && u.academic_title) {
        userTitleMap.set(u.id, u.academic_title);
      }
    });

    const rateMap = new Map<string, number>();
    (rates || []).forEach((r) => {
      const title = String(r.title || '').toLowerCase().trim();
      const rateVal = Number(r.hourly_rate_usd ?? r.hourly_rate ?? 0);
      if (title && rateVal > 0) {
        rateMap.set(title, rateVal);
      }
    });

    // 5. System settings for exchange rate (defaulting to 1,500 IQD per $1.00 USD if missing)
    const settingObj = Array.isArray(settings) ? settings[0] : settings;
    const rawExchangeRate = Number(settingObj?.exchange_rate);
    const baseCurrency = (settingObj?.base_currency || 'IQD') as 'USD' | 'IQD';

    let exchangeRatePerUSD = 1500;
    if (rawExchangeRate && !isNaN(rawExchangeRate) && rawExchangeRate > 0) {
      exchangeRatePerUSD = rawExchangeRate >= 10000 ? rawExchangeRate / 100 : rawExchangeRate;
    }

    // 6. Calculate Totals:
    let totalHours = 0;
    let totalCostUSD = 0;
    let estimatedCostIQD = 0;

    for (const t of approvedTimesheets) {
      const hours = Number(t.hours) || 0;
      totalHours += hours;

      const title = String(userTitleMap.get(t.teacher_id) || '').toLowerCase().trim();
      let rateUSD = rateMap.get(title);

      if (!rateUSD) {
        for (const [k, v] of rateMap.entries()) {
          if (title.includes(k) || k.includes(title)) {
            rateUSD = v;
            break;
          }
        }
      }

      if (!rateUSD && title && rates && rates.length > 0) {
        rateUSD = getRateForTitle(title, rates as any);
      }

      if (!rateUSD || rateUSD <= 0) {
        rateUSD = 45.0; // Institutional default rate
      }

      const costUSD = hours * rateUSD;
      const costIQD = costUSD * exchangeRatePerUSD;

      totalCostUSD += costUSD;
      estimatedCostIQD += costIQD;
    }

    // 7. Add Server-Side Console Logs:
    console.log('[KPI Metrics Debug]', {
      totalRecords: timesheets?.length,
      approvedRecords: approvedTimesheets.length,
      totalHours,
      estimatedCostIQD,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          totalHours,
          estimatedCostUSD: totalCostUSD,
          estimatedCostIQD,
          exchangeRate: rawExchangeRate || 150000,
          baseCurrency,
          approvedCount: approvedTimesheets.length,
        },
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API /api/admin/metrics] Exception:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
