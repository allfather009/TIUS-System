import fs from 'fs';
import { Client } from 'pg';

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  let dbUrl = '';
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) dbUrl = line.substring('DATABASE_URL='.length).trim();
  }
  
  if (!dbUrl) {
    throw new Error('DATABASE_URL not found in .env.local');
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to PostgreSQL.');

  // 1. Add column
  console.log('Adding custom_permissions column...');
  await client.query('ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT \'{}\'::jsonb;');
  console.log('Column custom_permissions ensured.');

  // 2. Check columns in users table
  const colRes = await client.query(`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'users' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);
  console.log('Columns in public.users:');
  console.table(colRes.rows);

  // 3. Check existing RLS policies on users table
  const polRes = await client.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename = 'users';
  `);
  console.log('Existing policies on public.users:');
  console.table(polRes.rows);

  // 4. Ensure RLS allows updates or see if RLS is enabled
  const rlsRes = await client.query(`
    SELECT relname, relrowsecurity 
    FROM pg_class 
    WHERE relname = 'users';
  `);
  console.log('RLS status on users:', rlsRes.rows);

  // Add Super Admin update policy or update policy for users if needed
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Super Admins can update users'
      ) THEN
        CREATE POLICY "Super Admins can update users" ON public.users
          FOR UPDATE
          USING (true)
          WITH CHECK (true);
      END IF;
    END $$;
  `);
  console.log('Ensured update policy exists on users.');

  // 5. Reload PostgREST schema cache
  console.log('Reloading PostgREST schema cache...');
  await client.query("NOTIFY pgrst, 'reload schema';");
  try {
    await client.query("NOTIFY pgrst, 'reload_schema';");
  } catch (e) {
    // ignore
  }
  console.log('PostgREST schema cache reload signal sent successfully.');

  await client.end();
  console.log('Migration completed successfully.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
