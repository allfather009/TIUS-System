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

async function seed() {
  console.log('Adding Dentistry and Pharmacy...');

  // 1. Ensure Faculties Exist
  const facultiesToAdd = ['Faculty of Dentistry', 'Faculty of Pharmacy'];
  
  for (const name of facultiesToAdd) {
    const { data: existing } = await supabase.from('faculties').select('id').eq('name', name).maybeSingle();
    if (!existing) {
      console.log(`Inserting faculty: ${name}`);
      await supabase.from('faculties').insert([{ name }]);
    }
  }

  const { data: facDentistry } = await supabase.from('faculties').select('id').eq('name', 'Faculty of Dentistry').single();
  const { data: facPharmacy } = await supabase.from('faculties').select('id').eq('name', 'Faculty of Pharmacy').single();

  if (!facDentistry || !facPharmacy) {
    console.error('Failed to get faculty IDs');
    return;
  }

  // Helper to ensure department has stages
  async function ensureStages(departmentId: string) {
    const { data: existingStages } = await supabase.from('stages').select('id').eq('department_id', departmentId);
    if (!existingStages || existingStages.length === 0) {
      for (let i = 1; i <= 4; i++) {
        await supabase.from('stages').insert([{ name: `Stage ${i}`, department_id: departmentId }]);
        console.log(`  - Inserted Stage ${i}`);
      }
    }
  }

  // 2. Update or Insert Dentistry Department
  const { data: deptDent } = await supabase.from('departments').select('id, name').eq('name', 'Faculty of Dentistry').maybeSingle();
  if (deptDent) {
    console.log(`Updating existing department 'Faculty of Dentistry' to 'Dentistry' and linking to Faculty`);
    await supabase.from('departments').update({ name: 'Dentistry', faculty_id: facDentistry.id, faculty: 'Dentistry' }).eq('id', deptDent.id);
    await ensureStages(deptDent.id);
  } else {
    const { data: dentByNewName } = await supabase.from('departments').select('id').eq('name', 'Dentistry').maybeSingle();
    if (dentByNewName) {
      console.log(`Updating existing department 'Dentistry' linking to Faculty`);
      await supabase.from('departments').update({ faculty_id: facDentistry.id, faculty: 'Dentistry' }).eq('id', dentByNewName.id);
      await ensureStages(dentByNewName.id);
    } else {
      console.log(`Inserting new department 'Dentistry'`);
      const { data: newDept, error } = await supabase.from('departments').insert([{ name: 'Dentistry', faculty_id: facDentistry.id, faculty: 'Dentistry', code: 'DENT' }]).select().single();
      if (newDept) await ensureStages(newDept.id);
    }
  }

  // 3. Update or Insert Pharmacy Department
  const { data: deptPharm } = await supabase.from('departments').select('id, name').eq('name', 'Faculty of Pharmacy').maybeSingle();
  if (deptPharm) {
    console.log(`Updating existing department 'Faculty of Pharmacy' to 'Pharmacy' and linking to Faculty`);
    await supabase.from('departments').update({ name: 'Pharmacy', faculty_id: facPharmacy.id, faculty: 'Pharmacy' }).eq('id', deptPharm.id);
    await ensureStages(deptPharm.id);
  } else {
    const { data: pharmByNewName } = await supabase.from('departments').select('id').eq('name', 'Pharmacy').maybeSingle();
    if (pharmByNewName) {
      console.log(`Updating existing department 'Pharmacy' linking to Faculty`);
      await supabase.from('departments').update({ faculty_id: facPharmacy.id, faculty: 'Pharmacy' }).eq('id', pharmByNewName.id);
      await ensureStages(pharmByNewName.id);
    } else {
      console.log(`Inserting new department 'Pharmacy'`);
      const { data: newDept, error } = await supabase.from('departments').insert([{ name: 'Pharmacy', faculty_id: facPharmacy.id, faculty: 'Pharmacy', code: 'PHARM' }]).select().single();
      if (newDept) await ensureStages(newDept.id);
    }
  }

  console.log('Seed completed successfully!');
}

seed().catch(console.error);
