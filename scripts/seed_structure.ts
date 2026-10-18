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

const hierarchy = [
  {
    faculty: "Faculty of Education",
    departments: [
      "English Language Teaching"
    ]
  },
  {
    faculty: "Faculty of Engineering",
    departments: [
      "Architectural Engineering",
      "Civil Engineering",
      "Interior Design Engineering",
      "Computer Engineering"
    ]
  },
  {
    faculty: "Faculty of Administrative Sciences and Economics",
    departments: [
      "Business and Management",
      "International Relations and Diplomacy",
      "Finance and Banking",
      "Accounting"
    ]
  },
  {
    faculty: "Faculty of Applied Science",
    departments: [
      "Information Technology (IT)",
      "Physiotherapy",
      "Medical Analysis"
    ]
  },
  {
    faculty: "Faculty of Nursing",
    departments: [
      "Nursing"
    ]
  }
];

async function seed() {
  console.log('Starting seed...');

  // Optional: clear existing
  // await supabase.from('departments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  // await supabase.from('faculties').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  for (const item of hierarchy) {
    console.log(`Inserting Faculty: ${item.faculty}`);
    
    const { data: faculty, error: fError } = await supabase
      .from('faculties')
      .upsert({ name: item.faculty }, { onConflict: 'name' })
      .select()
      .single();

    if (fError) {
      console.error(`Error inserting faculty ${item.faculty}:`, fError);
      continue;
    }

    const facultyId = faculty.id;

    for (const depName of item.departments) {
      console.log(`  - Inserting Department: ${depName}`);
      // Generate a short code for department
      const code = depName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4);

      const { error: dError } = await supabase
        .from('departments')
        .upsert({
          name: depName,
          faculty_id: facultyId,
          code: code
        }, { onConflict: 'name' }); // Assuming name is unique, wait, is it?

      if (dError) {
        console.error(`    Error inserting department ${depName}:`, dError);
      }
    }
  }

  console.log('Seed complete!');
}

seed();
