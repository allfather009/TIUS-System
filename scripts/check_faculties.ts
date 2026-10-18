import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data: faculties } = await supabase.from('faculties').select('*');
  console.log('--- Faculties ---');
  console.log(faculties);

  const { data: departments } = await supabase.from('departments').select('*');
  console.log('--- Departments ---');
  console.log(departments?.filter(d => d.name.toLowerCase().includes('dentistry') || d.name.toLowerCase().includes('pharmacy')));
}

check();
