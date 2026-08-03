import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { subscribeToReportStatus } from '../lib/reports';
import type { ReportRow } from '../types/database';
import {
  groupBiomarkers,
  type BiomarkerGroup,
  type EnrichedBiomarker,
} from '../lib/biomarkerGrouping';

export interface ReportDetailTotals {
  total: number;
  normal: number;
  needsAttention: number;
}

export interface UseReportDetailResult {
  report: ReportRow | null;
  groups: BiomarkerGroup[];
  totals: ReportDetailTotals;
  loading: boolean;
  error: string | null;
}

export function useReportDetail(reportId: string): UseReportDetailResult {
  const [report, setReport] = useState<ReportRow | null>(null);
  const [groups, setGroups] = useState<BiomarkerGroup[]>([]);
  const [totals, setTotals] = useState<ReportDetailTotals>({ total: 0, normal: 0, needsAttention: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof subscribeToReportStatus> | null>(null);

  async function fetchBiomarkers(id: string) {
    const { data } = await supabase
      .from('biomarkers')
      .select(`
        id, canonical_name, raw_name, value, unit, reference_min, reference_max, status, report_date,
        owner_id, report_id, family_member_id, created_at,
        canonical_biomarkers ( category, description, low_meaning, high_meaning )
      `)
      .eq('report_id', id);

    const enriched = (data ?? []) as unknown as EnrichedBiomarker[];
    setGroups(groupBiomarkers(enriched));

    let normal = 0;
    let needsAttention = 0;
    for (const b of enriched) {
      if (b.status === 'normal') normal++;
      else needsAttention++;
    }
    setTotals({ total: enriched.length, normal, needsAttention });
  }

  function startPolling(id: string) {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id)
        .single();

      if (!data) return;
      const polled = data as ReportRow;
      setReport(polled);

      if (polled.extraction_status === 'complete') {
        stopWaiting();
        await fetchBiomarkers(id);
      } else if (polled.extraction_status === 'failed') {
        stopWaiting();
      }
    }, 3000);
  }

  function stopWaiting() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (channelRef.current) { channelRef.current.unsubscribe(); channelRef.current = null; }
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (cancelled) return;

      if (err || !data) {
        setError('Could not load report.');
        setLoading(false);
        return;
      }

      const rep = data as ReportRow;
      setReport(rep);

      if (rep.extraction_status === 'complete') {
        await fetchBiomarkers(reportId);
        if (!cancelled) setLoading(false);
        return;
      }

      setLoading(false);

      if (rep.extraction_status === 'pending' || rep.extraction_status === 'processing') {
        // Subscribe for real-time updates
        channelRef.current = subscribeToReportStatus(reportId, async (newStatus, newReport) => {
          if (cancelled) return;
          setReport(newReport as ReportRow);
          if (newStatus === 'complete') {
            stopWaiting();
            await fetchBiomarkers(reportId);
          } else if (newStatus === 'failed') {
            stopWaiting();
          }
        });

        // Polling fallback in case realtime misses the event
        startPolling(reportId);
      }
    }

    init();

    return () => {
      cancelled = true;
      stopWaiting();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  return { report, groups, totals, loading, error };
}
