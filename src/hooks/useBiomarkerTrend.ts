import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  BiomarkerRow,
  BiomarkerSummaryRow,
  CanonicalBiomarkerRow,
} from '../types/database';

export interface UseBiomarkerTrendResult {
  biomarkers: BiomarkerRow[];
  canonical: CanonicalBiomarkerRow | null;
  summary: BiomarkerSummaryRow | null;
  loading: boolean;
  error: string | null;
}

export function useBiomarkerTrend(
  userId: string | undefined,
  canonicalName: string | undefined,
): UseBiomarkerTrendResult {
  const [biomarkers, setBiomarkers] = useState<BiomarkerRow[]>([]);
  const [canonical, setCanonical] = useState<CanonicalBiomarkerRow | null>(null);
  const [summary, setSummary] = useState<BiomarkerSummaryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !canonicalName) return;
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      const { data: member, error: memberErr } = await supabase
        .from('family_members')
        .select('id')
        .eq('owner_id', userId!)
        .eq('is_primary', true)
        .is('deleted_at', null)
        .maybeSingle();

      if (cancelled) return;

      if (memberErr || !member) {
        setError('Could not find your primary profile.');
        setLoading(false);
        return;
      }

      const primaryMemberId = (member as { id: string }).id;

      const [biomarkersRes, canonicalRes, summaryRes] = await Promise.all([
        supabase
          .from('biomarkers')
          .select('*')
          .eq('family_member_id', primaryMemberId)
          .eq('canonical_name', canonicalName!)
          .order('report_date', { ascending: true }),
        supabase
          .from('canonical_biomarkers')
          .select('*')
          .eq('canonical_name', canonicalName!)
          .maybeSingle(),
        supabase
          .from('biomarker_summaries')
          .select('*')
          .eq('family_member_id', primaryMemberId)
          .eq('canonical_name', canonicalName!)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (biomarkersRes.error) {
        setError('Could not load trend data.');
        setLoading(false);
        return;
      }

      setBiomarkers((biomarkersRes.data ?? []) as BiomarkerRow[]);
      setCanonical((canonicalRes.data ?? null) as CanonicalBiomarkerRow | null);
      setSummary((summaryRes.data ?? null) as BiomarkerSummaryRow | null);
      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [userId, canonicalName]);

  return { biomarkers, canonical, summary, loading, error };
}
