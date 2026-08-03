import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ReportRow, BiomarkerSummaryRow } from '../types/database';

interface StatusCounts {
  normal: number;
  flagged: number;
  critical: number;
}

interface HomeData {
  loading: boolean;
  firstName: string;
  latestReport: ReportRow | null;
  statusCounts: StatusCounts;
  flaggedBiomarkers: BiomarkerSummaryRow[];
  totalFlagged: number;
}

export function useHomeData(userId: string | undefined): HomeData {
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [latestReport, setLatestReport] = useState<ReportRow | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({ normal: 0, flagged: 0, critical: 0 });
  const [flaggedBiomarkers, setFlaggedBiomarkers] = useState<BiomarkerSummaryRow[]>([]);
  const [totalFlagged, setTotalFlagged] = useState(0);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function fetchAll() {
      setLoading(true);

      // 1. Primary family member name
      const { data: member } = await supabase
        .from('family_members')
        .select('full_name, id')
        .eq('owner_id', userId!)
        .eq('is_primary', true)
        .is('deleted_at', null)
        .maybeSingle();

      if (cancelled) return;
      const primaryMemberId = (member as any)?.id as string | undefined;
      if (member?.full_name) {
        setFirstName(member.full_name.split(' ')[0]);
      }

      // 2. Latest report
      const { data: reports } = await supabase
        .from('reports')
        .select('*')
        .eq('owner_id', userId!)
        .is('deleted_at', null)
        .order('report_date', { ascending: false })
        .limit(1);

      if (cancelled) return;
      const report = reports?.[0] ?? null;
      setLatestReport(report as ReportRow | null);

      // 3. Biomarker status counts directly from the latest report
      if (report) {
        const { data: biomarkers } = await supabase
          .from('biomarkers')
          .select('status')
          .eq('report_id', report.id);

        if (cancelled) return;
        const counts: StatusCounts = { normal: 0, flagged: 0, critical: 0 };
        for (const b of biomarkers ?? []) {
          const st = (b as any).status as string;
          if (st === 'normal') counts.normal++;
          else if (st === 'high' || st === 'low') counts.flagged++;
          else counts.critical++;
        }
        setStatusCounts(counts);
      }

      // 4. Flagged biomarker summaries — get total count first
      const { count } = await supabase
        .from('biomarker_summaries')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId!)
        .in('latest_status', ['high', 'low', 'critical_high', 'critical_low']);

      if (cancelled) return;
      setTotalFlagged(count ?? 0);

      // 5. Flagged biomarker summaries — top 3
      const { data: flagged } = await supabase
        .from('biomarker_summaries')
        .select('*')
        .eq('owner_id', userId!)
        .in('latest_status', ['high', 'low', 'critical_high', 'critical_low'])
        .order('latest_report_date', { ascending: false })
        .limit(3);

      if (cancelled) return;
      setFlaggedBiomarkers((flagged as BiomarkerSummaryRow[]) ?? []);

      setLoading(false);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [userId]);

  return { loading, firstName, latestReport, statusCounts, flaggedBiomarkers, totalFlagged };
}
