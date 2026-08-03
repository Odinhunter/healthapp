import { File } from 'expo-file-system';
import { supabase } from './supabase';

export async function uploadReportFile(params: {
  userId: string;
  familyMemberId: string;
  reportId: string;
  fileUri: string;
  fileType: 'image' | 'pdf';
}): Promise<{ filePath: string | null; error: string | null }> {
  try {
    const file = new File(params.fileUri);
    const arrayBuffer = await file.arrayBuffer();

    const contentType = params.fileType === 'image' ? 'image/jpeg' : 'application/pdf';
    const ext = params.fileType === 'image' ? 'jpg' : 'pdf';
    const path = `${params.userId}/${params.familyMemberId}/${params.reportId}/report.${ext}`;

    const { error } = await supabase.storage
      .from('reports')
      .upload(path, arrayBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      return { filePath: null, error: error.message };
    }

    return { filePath: path, error: null };
  } catch (err: any) {
    return { filePath: null, error: err.message ?? 'Upload failed' };
  }
}
