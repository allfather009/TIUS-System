import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually since this is a script
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE URL or SERVICE KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedStages() {
  console.log('Starting seed for stages...');

  // Fetch all departments
  const { data: departments, error: depError } = await supabase
    .from('departments')
    .select('id, name');

  if (depError) {
    console.error('Failed to fetch departments:', depError);
    return;
  }

  if (!departments || departments.length === 0) {
    console.log('No departments found to add stages to.');
    return;
  }

  console.log(`Found ${departments.length} departments.`);

  for (const dept of departments) {
    console.log(`Adding stages for department: ${dept.name}`);
    for (let level = 1; level <= 4; level++) {
      const stageName = `Stage ${level}`;

      // Insert stage for the department
      const { error: stageError } = await supabase
        .from('stages')
        .upsert({
          department_id: dept.id,
          name: stageName,
          level: level
        }, { onConflict: 'department_id, level' }); 
        // We assume we don't want duplicates. The schema in 20261008_120000_academic_hierarchy.sql 
        // didn't explicitly have a unique constraint on (department_id, level) or (department_id, name).
        // If there's no unique constraint, upsert might fail.
        
      if (stageError) {
        // If upsert fails because of missing unique constraint, let's just do an insert but check first to avoid duplicates.
        // Let's do a select check first to be safe.
        const { data: existing } = await supabase
          .from('stages')
          .select('id')
          .eq('department_id', dept.id)
          .eq('level', level)
          .single();

        if (!existing) {
          const { error: insertErr } = await supabase
            .from('stages')
            .insert({
              department_id: dept.id,
              name: stageName,
              level: level
            });
            
          if (insertErr) {
            console.error(`  - Failed to insert ${stageName}:`, insertErr);
          } else {
             console.log(`  - Inserted ${stageName}`);
          }
        } else {
           // console.log(`  - ${stageName} already exists`);
        }
      } else {
        console.log(`  - Upserted ${stageName}`);
      }
    }
  }

  console.log('Stages seed complete!');
}

seedStages();
