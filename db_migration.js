const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.asqlmvmabopyflqmzzqx:NxObybztZtRFfn6Z@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres'
});

async function run() {
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT PRIMARY KEY DEFAULT 1,
        base_currency TEXT DEFAULT 'IQD' NOT NULL,
        exchange_rate NUMERIC DEFAULT 150000 NOT NULL
      );
      
      INSERT INTO system_settings (id, base_currency, exchange_rate) 
      VALUES (1, 'IQD', 150000)
      ON CONFLICT (id) DO NOTHING;
      
      ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "Allow select for authenticated users" ON system_settings;
      CREATE POLICY "Allow select for authenticated users" ON system_settings FOR SELECT USING (auth.role() = 'authenticated');
      
      DROP POLICY IF EXISTS "Allow Super Admin full access" ON system_settings;
      CREATE POLICY "Allow Super Admin full access" ON system_settings FOR ALL USING (auth.jwt() ->> 'role' = 'SUPER_ADMIN') WITH CHECK (auth.jwt() ->> 'role' = 'SUPER_ADMIN');
      
      DROP POLICY IF EXISTS "Allow Accountant to update exchange rate" ON system_settings;
      CREATE POLICY "Allow Accountant to update exchange rate" ON system_settings FOR UPDATE USING (auth.jwt() ->> 'role' = 'ACCOUNTANT') WITH CHECK (auth.jwt() ->> 'role' = 'ACCOUNTANT');
      
      -- Also allow HOD, COORDINATOR, TEACHER etc to read? The authenticated rule covers that.
    `);
    console.log("Migration successful!");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
