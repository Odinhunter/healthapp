import { supabase } from './supabase';
import type {
  DoctorVisitRow,
  DoctorVisitInsert,
  DoctorVisitUpdate,
} from '../types/database';

export async function listVisits(
  familyMemberId: string,
): Promise<{ data: DoctorVisitRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('doctor_visits')
    .select('*')
    .eq('family_member_id', familyMemberId)
    .is('deleted_at', null)
    .order('visit_date', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as DoctorVisitRow[], error: null };
}

export async function getVisit(
  id: string,
): Promise<{ data: DoctorVisitRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('doctor_visits')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: (data ?? null) as DoctorVisitRow | null, error: null };
}

export async function createVisit(
  input: DoctorVisitInsert,
): Promise<{ data: DoctorVisitRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('doctor_visits')
    .insert(input as DoctorVisitInsert & Record<string, unknown>)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as DoctorVisitRow, error: null };
}

export async function updateVisit(
  id: string,
  patch: DoctorVisitUpdate,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('doctor_visits')
    .update(patch)
    .eq('id', id);

  return { error: error?.message ?? null };
}

export async function deleteVisit(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('doctor_visits')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  return { error: error?.message ?? null };
}
