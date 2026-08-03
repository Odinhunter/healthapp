import { useCallback, useEffect, useState } from 'react';
import { getPrimaryFamilyMember } from '../lib/reports';
import { listVisits } from '../lib/visits';
import type { DoctorVisitRow } from '../types/database';

export interface UseVisitsResult {
  visits: DoctorVisitRow[];
  memberId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useVisits(userId: string | undefined): UseVisitsResult {
  const [visits, setVisits] = useState<DoctorVisitRow[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { member, error: memberErr } = await getPrimaryFamilyMember(userId);
    if (memberErr || !member) {
      setError('Could not find your profile.');
      setLoading(false);
      return;
    }

    setMemberId(member.id);
    const { data, error: listErr } = await listVisits(member.id);
    if (listErr) {
      setError(listErr);
    } else {
      setVisits(data);
      setError(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { visits, memberId, loading, error, refresh: load };
}
