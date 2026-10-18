import { createClient } from '@/lib/supabase/client';
import { AcademicRate } from '@/types/database';

export const DEFAULT_ACADEMIC_RATES: AcademicRate[] = [
  { id: 'a1111111-1111-1111-1111-111111111111', title: 'Professor', hourly_rate: 65.0, is_active: true },
  { id: 'a2222222-2222-2222-2222-222222222222', title: 'Associate Professor', hourly_rate: 55.0, is_active: true },
  { id: 'a3333333-3333-3333-3333-333333333333', title: 'Assistant Professor', hourly_rate: 45.0, is_active: true },
  { id: 'a4444444-4444-4444-4444-444444444444', title: 'Senior Clinical Lecturer', hourly_rate: 60.0, is_active: true },
  { id: 'a5555555-5555-5555-5555-555555555555', title: 'Lecturer', hourly_rate: 38.0, is_active: true },
  { id: 'a6666666-6666-6666-6666-666666666666', title: 'Assistant Lecturer', hourly_rate: 30.0, is_active: true },
  { id: 'a7777777-7777-7777-7777-777777777777', title: 'Teaching Assistant / Lab Lead', hourly_rate: 25.0, is_active: true },
];

const LOCAL_STORAGE_RATES_KEY = 'tius_academic_rates_cache_v1';

export async function getAcademicRates(): Promise<AcademicRate[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('academic_rates')
      .select('*')
      .order('hourly_rate', { ascending: false });

    if (!error && data && data.length > 0) {
      const mapped = data.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        title: String(r.title),
        hourly_rate: Number(r.hourly_rate),
        is_active: r.is_active !== undefined && r.is_active !== null ? Boolean(r.is_active) : true,
        created_at: r.created_at ? String(r.created_at) : undefined,
        updated_at: r.updated_at ? String(r.updated_at) : undefined,
      }));
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_RATES_KEY, JSON.stringify(mapped));
      }
      return mapped;
    }
  } catch (err) {
    console.warn('Supabase academic_rates query notice:', err);
  }

  // Fallback to localStorage or standard TIUS rates
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_RATES_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((r: AcademicRate) => ({
            ...r,
            is_active: r.is_active !== undefined ? Boolean(r.is_active) : true,
          }));
        }
      }
    } catch {
      // ignore
    }
  }

  return DEFAULT_ACADEMIC_RATES;
}

export async function updateAcademicRate(
  id: string,
  newHourlyRate: number,
  isActive?: boolean
): Promise<{ success: boolean; error?: string; rate?: AcademicRate }> {
  const now = new Date().toISOString();

  const updatePayload: Record<string, unknown> = {
    hourly_rate: newHourlyRate,
    updated_at: now,
  };
  if (typeof isActive === 'boolean') {
    updatePayload.is_active = isActive;
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('academic_rates')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Supabase update academic_rates error:', error);
      return { success: false, error: error.message };
    }

    if (data) {
      const updatedRate: AcademicRate = {
        id: String(data.id),
        title: String(data.title),
        hourly_rate: Number(data.hourly_rate),
        is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
        created_at: data.created_at ? String(data.created_at) : undefined,
        updated_at: data.updated_at ? String(data.updated_at) : undefined,
      };
      if (typeof window !== 'undefined') {
        try {
          const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_RATES_KEY) || '[]');
          const idx = cached.findIndex((r: AcademicRate) => r.id === id);
          if (idx >= 0) cached[idx] = updatedRate;
          localStorage.setItem(LOCAL_STORAGE_RATES_KEY, JSON.stringify(cached));
        } catch { /* ignore */ }
      }
      return { success: true, rate: updatedRate };
    }
  } catch (err: unknown) {
    console.warn('Supabase update academic_rates notice:', err);
  }

  // Graceful fallback for offline / pending migration state
  if (typeof window !== 'undefined') {
    try {
      const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_RATES_KEY) || '[]');
      const target = cached.find((r: AcademicRate) => r.id === id) || DEFAULT_ACADEMIC_RATES.find((r) => r.id === id);
      if (target) {
        const updatedRate: AcademicRate = {
          ...target,
          hourly_rate: newHourlyRate,
          ...(typeof isActive === 'boolean' ? { is_active: isActive } : {}),
          updated_at: now,
        };
        const updatedList = cached.map((r: AcademicRate) => r.id === id ? updatedRate : r);
        if (!cached.some((r: AcademicRate) => r.id === id)) updatedList.push(updatedRate);
        localStorage.setItem(LOCAL_STORAGE_RATES_KEY, JSON.stringify(updatedList));
        return { success: true, rate: updatedRate };
      }
    } catch { /* ignore */ }
  }

  return { success: true };
}

export async function toggleAcademicRateStatus(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string; rate?: AcademicRate }> {
  const now = new Date().toISOString();

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('academic_rates')
      .update({ is_active: isActive, updated_at: now })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (!error && data) {
      const updatedRate: AcademicRate = {
        id: String(data.id),
        title: String(data.title),
        hourly_rate: Number(data.hourly_rate),
        is_active: Boolean(data.is_active),
        created_at: data.created_at ? String(data.created_at) : undefined,
        updated_at: data.updated_at ? String(data.updated_at) : undefined,
      };
      if (typeof window !== 'undefined') {
        try {
          const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_RATES_KEY) || '[]');
          const idx = cached.findIndex((r: AcademicRate) => r.id === id);
          if (idx >= 0) cached[idx] = updatedRate;
          localStorage.setItem(LOCAL_STORAGE_RATES_KEY, JSON.stringify(cached));
        } catch { /* ignore */ }
      }
      return { success: true, rate: updatedRate };
    }
  } catch (err: unknown) {
    console.warn('Supabase toggle academic_rates notice:', err);
  }

  if (typeof window !== 'undefined') {
    try {
      const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_RATES_KEY) || '[]');
      const target = cached.find((r: AcademicRate) => r.id === id) || DEFAULT_ACADEMIC_RATES.find((r) => r.id === id);
      if (target) {
        const updatedRate: AcademicRate = { ...target, is_active: isActive, updated_at: now };
        const updatedList = cached.map((r: AcademicRate) => r.id === id ? updatedRate : r);
        if (!cached.some((r: AcademicRate) => r.id === id)) updatedList.push(updatedRate);
        localStorage.setItem(LOCAL_STORAGE_RATES_KEY, JSON.stringify(updatedList));
        return { success: true, rate: updatedRate };
      }
    } catch { /* ignore */ }
  }

  return { success: true };
}

export async function createAcademicRate(
  title: string,
  hourlyRate: number,
  isActive: boolean = true
): Promise<{ success: boolean; error?: string; rate?: AcademicRate }> {
  const now = new Date().toISOString();

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('academic_rates')
      .insert({
        title: title.trim(),
        hourly_rate: Number(hourlyRate),
        is_active: isActive,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .maybeSingle();

    if (error) {
      console.warn('Supabase insert academic_rates notice:', error.message);
    } else if (data) {
      const created: AcademicRate = {
        id: String(data.id),
        title: String(data.title),
        hourly_rate: Number(data.hourly_rate),
        is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
        created_at: data.created_at ? String(data.created_at) : undefined,
        updated_at: data.updated_at ? String(data.updated_at) : undefined,
      };
      if (typeof window !== 'undefined') {
        try {
          const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_RATES_KEY) || '[]');
          cached.push(created);
          localStorage.setItem(LOCAL_STORAGE_RATES_KEY, JSON.stringify(cached));
        } catch { /* ignore */ }
      }
      return { success: true, rate: created };
    }
  } catch (err: unknown) {
    console.warn('Supabase insert academic_rates notice:', err);
  }

  const fallback: AcademicRate = {
    id: 'rate-' + Math.random().toString(36).substring(2, 9),
    title: title.trim(),
    hourly_rate: Number(hourlyRate),
    is_active: isActive,
    created_at: now,
    updated_at: now,
  };
  if (typeof window !== 'undefined') {
    try {
      const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_RATES_KEY) || '[]');
      cached.push(fallback);
      localStorage.setItem(LOCAL_STORAGE_RATES_KEY, JSON.stringify(cached));
    } catch { /* ignore */ }
  }
  return { success: true, rate: fallback };
}

export async function deleteAcademicRate(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('academic_rates')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Supabase delete academic_rates notice:', error.message);
    }
  } catch (err: unknown) {
    console.warn('Supabase delete academic_rates notice:', err);
  }

  if (typeof window !== 'undefined') {
    try {
      const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_RATES_KEY) || '[]');
      const filtered = cached.filter((r: AcademicRate) => r.id !== id);
      localStorage.setItem(LOCAL_STORAGE_RATES_KEY, JSON.stringify(filtered));
    } catch { /* ignore */ }
  }

  return { success: true };
}

export function getRateForTitle(title: string, rates: AcademicRate[]): number {
  if (!title) return 45.0;
  const match = rates.find(
    (r) => r.title.toLowerCase().trim() === title.toLowerCase().trim()
  );
  if (match) return match.hourly_rate;

  const t = title.toLowerCase();
  if (t.includes('professor') && !t.includes('assistant') && !t.includes('associate')) return 65.0;
  if (t.includes('associate')) return 55.0;
  if (t.includes('assistant professor')) return 45.0;
  if (t.includes('clinical')) return 60.0;
  if (t.includes('assistant lecturer')) return 30.0;
  if (t.includes('lecturer')) return 38.0;
  if (t.includes('teaching assistant') || t.includes('research assistant') || t.includes('demonstrator') || t.includes('lab lead')) return 25.0;

  return 45.0;
}
