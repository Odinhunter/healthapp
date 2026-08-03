import { supabase } from './supabase';
import type {
  MedicationRow,
  MedicationInsert,
  MedicationUpdate,
} from '../types/database';

export async function listMedications(
  familyMemberId: string,
): Promise<{ data: MedicationRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('family_member_id', familyMemberId)
    .is('deleted_at', null)
    .order('is_active', { ascending: false })
    .order('start_date', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as MedicationRow[], error: null };
}

export async function getMedication(
  id: string,
): Promise<{ data: MedicationRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: (data ?? null) as MedicationRow | null, error: null };
}

export async function createMedication(
  input: MedicationInsert,
): Promise<{ data: MedicationRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('medications')
    .insert(input as MedicationInsert & Record<string, unknown>)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as MedicationRow, error: null };
}

export async function updateMedication(
  id: string,
  patch: MedicationUpdate,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('medications')
    .update(patch)
    .eq('id', id);

  return { error: error?.message ?? null };
}

export async function deleteMedication(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('medications')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  return { error: error?.message ?? null };
}
