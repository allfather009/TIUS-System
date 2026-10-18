import fs from 'fs';
import { Client } from 'pg';

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  let dbUrl = '';
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) dbUrl = line.substring('DATABASE_URL='.length).trim();
  }
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to PostgreSQL.');

  await client.query('ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;');
  console.log('Column approved_at added.');

  await client.query("UPDATE public.timesheets SET approved_at = updated_at WHERE approved_at IS NULL AND status IN ('APPROVED', 'PAID');");
  console.log('Backfilled approved_at for existing rows.');

  const res = await client.query('SELECT id, status, created_at, approved_at FROM public.timesheets LIMIT 5;');
  console.table(res.rows);

  await client.end();
}

main().catch(console.error);
