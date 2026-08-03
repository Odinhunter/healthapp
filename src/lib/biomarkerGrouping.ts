import type { BiomarkerRow } from '../types/database';

// Priority order matches the categories seeded in canonical_biomarkers.
// Anything not in this list is grouped into 'Other' at the end.
export const CATEGORY_ORDER = [
  'Complete Blood Count',
  'WBC Differential',
  'Hemoglobin Studies',
  'Blood Sugar / Diabetes',
  'Metabolic / Diabetes (Advanced)',
  'Lipid Panel',
  'Thyroid',
  'Kidney Function',
  'Liver Function',
  'Liver (Advanced)',
  'Vitamins',
  'Iron Studies',
  'Minerals / Bone',
  'Electrolytes',
  'Hormones',
  'Inflammation',
  'Cardiac Markers',
  'Coagulation',
  'Urinalysis Markers',
  'Tumor Markers',
  'Infectious Serology',
  'Autoimmune',
  'Blood Gases',
  'Pancreatic',
  'Allergy',
  'Miscellaneous',
];

export interface CanonicalMeta {
  category: string | null;
  description: string | null;
  low_meaning: string | null;
  high_meaning: string | null;
}

// BiomarkerRow enriched with the joined canonical_biomarkers row
export interface EnrichedBiomarker extends BiomarkerRow {
  canonical_biomarkers: CanonicalMeta | null;
}

export interface BiomarkerGroup {
  category: string;
  rows: EnrichedBiomarker[];
}

export function groupBiomarkers(rows: EnrichedBiomarker[]): BiomarkerGroup[] {
  const map = new Map<string, EnrichedBiomarker[]>();

  for (const row of rows) {
    const cat = row.canonical_biomarkers?.category ?? 'Other';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(row);
  }

  const priority = new Map(CATEGORY_ORDER.map((c, i) => [c, i]));

  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      const pa = priority.get(a) ?? 999;
      const pb = priority.get(b) ?? 999;
      return pa !== pb ? pa - pb : a.localeCompare(b);
    })
    .map(([category, rows]) => ({ category, rows }));
}

export type StatusVariant = 'normal' | 'flagged' | 'critical';

export function statusVariant(status: BiomarkerRow['status']): StatusVariant {
  if (status === 'critical_low' || status === 'critical_high') return 'critical';
  if (status === 'low' || status === 'high') return 'flagged';
  return 'normal';
}

export function statusLabel(status: BiomarkerRow['status']): string {
  switch (status) {
    case 'low': return 'LOW';
    case 'high': return 'HIGH';
    case 'critical_low': return 'CRIT LOW';
    case 'critical_high': return 'CRIT HIGH';
    default: return 'NORMAL';
  }
}

export function formatRefRange(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `Ref: ${min} – ${max}`;
  if (max != null) return `Ref: below ${max}`;
  if (min != null) return `Ref: above ${min}`;
  return null;
}
