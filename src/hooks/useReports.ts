import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ReportRow } from '../types/database';

const PAGE_SIZE = 20;

export interface ReportWithCounts extends Pick<ReportRow, 'id' | 'lab_name' | 'report_date' | 'extraction_status' | 'biomarker_count' | 'created_at'> {
  counts: { normal: number; flagged: number; critical: number };
}

interface UseReportsResult {
  reports: ReportWithCounts[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
}

export function useReports(userId: string | undefined): UseReportsResult {
  const [reports, setReports] = useState<ReportWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function fetchPage(pageOffset: number, append: boolean) {
    if (!userId) return;

    if (pageOffset === 0) setLoading(true);
    else setLoadingMore(true);

    const { data: reportData, error: reportErr } = await supabase
      .from('reports')
      .select('id, lab_name, report_date, extraction_status, biomarker_count, created_at')
      .eq('owner_id', userId)
      .is('deleted_at', null)
      .order('report_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(pageOffset, pageOffset + PAGE_SIZE - 1);

    if (reportErr) {
      setError('Could not load reports.');
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const page = (reportData ?? []) as Pick<ReportRow, 'id' | 'lab_name' | 'report_date' | 'extraction_status' | 'biomarker_count' | 'created_at'>[];
    setHasMore(page.length === PAGE_SIZE);

    // Batch-fetch biomarker status for this page
    const completeIds = page
      .filter(r => r.extraction_status === 'complete')
      .map(r => r.id);

    const countMap = new Map<string, { normal: number; flagged: number; critical: number }>();
    if (completeIds.length > 0) {
      const { data: bioData } = await supabase
        .from('biomarkers')
        .select('report_id, status')
        .in('report_id', completeIds);

      for (const b of bioData ?? []) {
        const rid = (b as any).report_id as string;
        const st = (b as any).status as string;
        if (!countMap.has(rid)) countMap.set(rid, { normal: 0, flagged: 0, critical: 0 });
        const entry = countMap.get(rid)!;
        if (st === 'normal') entry.normal++;
        else if (st === 'high' || st === 'low') entry.flagged++;
        else entry.critical++;
      }
    }

    const enriched: ReportWithCounts[] = page.map(r => ({
      ...r,
      counts: countMap.get(r.id) ?? { normal: 0, flagged: 0, critical: 0 },
    }));

    setReports(prev => append ? [...prev, ...enriched] : enriched);
    setLoading(false);
    setLoadingMore(false);
  }

  useEffect(() => {
    if (!userId) return;
    setOffset(0);
    fetchPage(0, false);
  }, [userId]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const nextOffset = offset + PAGE_SIZE;
    setOffset(nextOffset);
    fetchPage(nextOffset, true);
  }, [loadingMore, hasMore, offset, userId]);

  const refresh = useCallback(() => {
    setOffset(0);
    fetchPage(0, false);
  }, [userId]);

  return { reports, loading, loadingMore, hasMore, error, loadMore, refresh };
}
