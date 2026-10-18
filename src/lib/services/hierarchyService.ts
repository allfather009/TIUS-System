import { createClient } from '@/lib/supabase/client';
import { Faculty, Department, Stage, Course } from '@/types/database';

export async function getHierarchyData() {
  const supabase = createClient();
  
  const [facultiesRes, departmentsRes, stagesRes, coursesRes] = await Promise.all([
    supabase.from('faculties').select('*').order('name'),
    supabase.from('departments').select('*').order('name'),
    supabase.from('stages').select('*').order('level'),
    supabase.from('courses').select('*').order('name')
  ]);

  return {
    faculties: (facultiesRes.data as Faculty[]) || [],
    departments: (departmentsRes.data as Department[]) || [],
    stages: (stagesRes.data as Stage[]) || [],
    courses: (coursesRes.data as Course[]) || []
  };
}

export async function createFaculty(name: string, code?: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from('faculties').insert([{ name, code }]).select().single();
  if (error) throw error;
  return data as Faculty;
}

export async function createDepartment(name: string, faculty_id: string, code?: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from('departments').insert([{ name, faculty_id, code }]).select().single();
  if (error) throw error;
  return data as Department;
}

export async function createStage(name: string, level: number, department_id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from('stages').insert([{ name, level, department_id }]).select().single();
  if (error) throw error;
  return data as Stage;
}

export async function createCourse(name: string, code: string, stage_id: string, credits: number) {
  const supabase = createClient();
  const { data, error } = await supabase.from('courses').insert([{ name, code, stage_id, credits }]).select().single();
  if (error) throw error;
  return data as Course;
}

export async function deleteFaculty(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('faculties').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteDepartment(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('departments').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteStage(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('stages').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteCourse(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('courses').delete().eq('id', id);
  if (error) throw error;
}

export async function updateFaculty(id: string, name: string, code?: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from('faculties').update({ name, code }).eq('id', id).select().single();
  if (error) throw error;
  return data as Faculty;
}

export async function updateDepartment(id: string, name: string, code?: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from('departments').update({ name, code }).eq('id', id).select().single();
  if (error) throw error;
  return data as Department;
}

export async function updateStage(id: string, name: string, level: number) {
  const supabase = createClient();
  const { data, error } = await supabase.from('stages').update({ name, level }).eq('id', id).select().single();
  if (error) throw error;
  return data as Stage;
}

export async function updateCourse(id: string, name: string, code: string, credits: number) {
  const supabase = createClient();
  const { data, error } = await supabase.from('courses').update({ name, code, credits }).eq('id', id).select().single();
  if (error) throw error;
  return data as Course;
}
