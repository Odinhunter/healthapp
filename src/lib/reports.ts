import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export async function createReport(params: {
  ownerId: string;
  familyMemberId: string;
  filePath: string;
  fileType: 'image' | 'pdf';
  reportDate: string;
  labName?: string;
  reportId: string;
}): Promise<{ reportId: string | null; error: string | null }> {
  try {
    const { error } = await supabase.from('reports').insert({
      id: params.reportId,
      owner_id: params.ownerId,
      family_member_id: params.familyMemberId,
      file_path: params.filePath,
      file_type: params.fileType,
      report_date: params.reportDate,
      lab_name: params.labName || null,
      extraction_status: 'pending',
    });

    if (error) {
      return { reportId: null, error: error.message };
    }

    return { reportId: params.reportId, error: null };
  } catch (err: any) {
    return { reportId: null, error: err.message ?? 'Could not create report' };
  }
}

export function subscribeToReportStatus(
  reportId: string,
  onStatusChange: (status: string, report: any) => void,
): RealtimeChannel {
  const channel = supabase
    .channel(`report-${reportId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'reports',
        filter: `id=eq.${reportId}`,
      },
      (payload) => {
        onStatusChange(payload.new.extraction_status, payload.new);
      },
    )
    .subscribe();

  return channel;
}

export async function getPrimaryFamilyMember(
  userId: string,
): Promise<{ member: any | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('owner_id', userId)
      .eq('is_primary', true)
      .is('deleted_at', null)
      .single();

    if (error) {
      return { member: null, error: error.message };
    }

    return { member: data, error: null };
  } catch (err: any) {
    return { member: null, error: err.message ?? 'Could not fetch family member' };
  }
}
