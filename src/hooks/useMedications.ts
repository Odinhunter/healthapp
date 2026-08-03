import { useCallback, useEffect, useState } from 'react';
import { getPrimaryFamilyMember } from '../lib/reports';
import { listMedications } from '../lib/medications';
import type { MedicationRow } from '../types/database';

export interface UseMedicationsResult {
  active: MedicationRow[];
  past: MedicationRow[];
  memberId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useMedications(userId: string | undefined): UseMedicationsResult {
  const [active, setActive] = useState<MedicationRow[]>([]);
  const [past, setPast] = useState<MedicationRow[]>([]);
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
    const { data, error: listErr } = await listMedications(member.id);
    if (listErr) {
      setError(listErr);
    } else {
      setActive(data.filter((m) => m.is_active));
      setPast(data.filter((m) => !m.is_active));
      setError(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { active, past, memberId, loading, error, refresh: load };
}
