/**
 * Tests the real resolver used by the extract-report edge function.
 *
 * Fixtures below are the actual alias arrays from the 335-row seed
 * (supabase/migrations/20260412_biomarker_master_seed.sql), so these cases
 * describe production data, not invented shapes.
 */
import {
  buildResolver,
  resolveBiomarker,
  demoteIntraReportCollisions,
  type CanonicalRow,
  type ResolvedBiomarker,
} from '../../supabase/functions/_shared/canonicalResolver';

// Verbatim from the seed, pre-fix.
const SEED: CanonicalRow[] = [
  { canonical_name: 'Triglycerides', aliases: ['TG', 'Trigs', 'Triglyceride', 'Serum Triglycerides'] },
  { canonical_name: 'Thyroglobulin', aliases: ['Tg', 'Serum Thyroglobulin'] },
  { canonical_name: 'Calcium (Ionized)', aliases: ['iCa', 'Ionized Calcium', 'Ca++', 'Free Calcium'] },
  { canonical_name: 'Islet Cell Antibodies', aliases: ['ICA'] },
  { canonical_name: 'Blood Urea Nitrogen', aliases: ['BUN', 'Urea Nitrogen', 'S. Urea'] },
  { canonical_name: 'Blood Urea', aliases: ['Urea', 'Serum Urea', 'S. Urea'] },
  { canonical_name: 'Lactate Dehydrogenase', aliases: ['LDH'] },
  { canonical_name: 'LDH (as tumor marker)', aliases: ['Lactate Dehydrogenase'] },
  { canonical_name: 'Hemoglobin', aliases: ['Hb', 'Hgb', 'HGB', 'Haemoglobin'] },
];

describe('buildResolver', () => {
  const resolver = buildResolver(SEED);

  it('resolves an unambiguous alias', () => {
    expect(resolver.resolve('Hb')).toEqual({
      status: 'resolved',
      canonicalName: 'Hemoglobin',
    });
  });

  it('matches canonical names case-insensitively', () => {
    // The old implementation used a case-sensitive Set here, so an
    // all-caps lab name fell through to the contested alias lookup.
    expect(resolver.resolve('HEMOGLOBIN')).toEqual({
      status: 'resolved',
      canonicalName: 'Hemoglobin',
    });
  });

  it('tolerates surrounding whitespace', () => {
    expect(resolver.resolve('  Hb  ')).toEqual({
      status: 'resolved',
      canonicalName: 'Hemoglobin',
    });
  });

  it('returns unresolved for a name nothing claims', () => {
    expect(resolver.resolve('Zorkonium')).toEqual({ status: 'unresolved' });
  });

  describe('contested aliases resolve to ambiguous, never a coin flip', () => {
    it('TG — Triglycerides vs Thyroglobulin', () => {
      // Case-insensitively 'TG' and 'Tg' are the same key. Getting this
      // wrong puts a lipid-panel triglyceride under a thyroid marker.
      expect(resolver.resolve('TG')).toEqual({
        status: 'ambiguous',
        candidates: ['Thyroglobulin', 'Triglycerides'],
      });
    });

    it('ICA — Islet Cell Antibodies vs ionized calcium', () => {
      expect(resolver.resolve('ICA')).toEqual({
        status: 'ambiguous',
        candidates: ['Calcium (Ionized)', 'Islet Cell Antibodies'],
      });
    });

    it('S. Urea — Blood Urea vs Blood Urea Nitrogen', () => {
      expect(resolver.resolve('S. Urea')).toEqual({
        status: 'ambiguous',
        candidates: ['Blood Urea', 'Blood Urea Nitrogen'],
      });
    });

    it('reports every contested key for logging', () => {
      expect(resolver.contestedAliases()).toEqual(['ica', 's. urea', 'tg']);
    });
  });

  it('lets the row owning a canonical name beat another row aliasing it', () => {
    // 'Lactate Dehydrogenase' is both its own row and an alias of
    // 'LDH (as tumor marker)'. That is not a genuine conflict.
    expect(resolver.resolve('Lactate Dehydrogenase')).toEqual({
      status: 'resolved',
      canonicalName: 'Lactate Dehydrogenase',
    });
    expect(resolver.contestedAliases()).not.toContain('lactate dehydrogenase');
  });

  it('survives rows with null or empty aliases', () => {
    const r = buildResolver([
      { canonical_name: 'Ferritin', aliases: null },
      { canonical_name: 'Iron', aliases: [] },
    ]);
    expect(r.resolve('Ferritin')).toEqual({ status: 'resolved', canonicalName: 'Ferritin' });
    expect(r.resolve('Iron')).toEqual({ status: 'resolved', canonicalName: 'Iron' });
  });
});

describe('resolveBiomarker', () => {
  const resolver = buildResolver(SEED);

  it('falls back to the printed name when the model proposes nonsense', () => {
    const out = resolveBiomarker(resolver, {
      raw_name: 'Hb',
      canonical_name: 'Completely Made Up',
    });
    expect(out.resolution).toEqual({ status: 'resolved', canonicalName: 'Hemoglobin' });
    expect(out.matchedOn).toBe('raw_name');
  });

  it('records which field matched, so extraction quality is measurable', () => {
    const out = resolveBiomarker(resolver, {
      raw_name: 'HAEMOGLOBIN (Hb)',
      canonical_name: 'Hemoglobin',
    });
    expect(out.matchedOn).toBe('canonical_name');
  });

  it('does not fall through to raw_name when the model hits an ambiguous alias', () => {
    // Ambiguity is a real answer, not a miss — falling through would let a
    // chaotic raw name silently pick one of the contested candidates.
    const out = resolveBiomarker(resolver, { raw_name: 'Hb', canonical_name: 'TG' });
    expect(out.resolution.status).toBe('ambiguous');
  });
});

describe('demoteIntraReportCollisions', () => {
  const resolver = buildResolver(SEED);

  const resolve = (items: Array<{ raw_name: string; canonical_name?: string }>) =>
    demoteIntraReportCollisions(items.map((b) => resolveBiomarker(resolver, b)));

  const nameOf = (r: ResolvedBiomarker) =>
    r.resolution.status === 'resolved' ? r.resolution.canonicalName : r.resolution.status;

  it('demotes both rows when one report maps two analytes onto one name', () => {
    // The production case: BUN 11.87 and Urea 25.4 (exactly x2.14) both
    // arriving as Blood Urea Nitrogen.
    const out = resolve([
      { raw_name: 'BUN', canonical_name: 'Blood Urea Nitrogen' },
      { raw_name: 'Urea', canonical_name: 'Blood Urea Nitrogen' },
    ]);
    expect(out.map(nameOf)).toEqual(['ambiguous', 'ambiguous']);
  });

  it('leaves genuinely distinct biomarkers alone', () => {
    const out = resolve([
      { raw_name: 'Hb', canonical_name: 'Hemoglobin' },
      { raw_name: 'BUN', canonical_name: 'Blood Urea Nitrogen' },
    ]);
    expect(out.map(nameOf)).toEqual(['Hemoglobin', 'Blood Urea Nitrogen']);
  });

  it('demotes all three when a name is claimed more than twice', () => {
    const out = resolve([
      { raw_name: 'BUN', canonical_name: 'Blood Urea Nitrogen' },
      { raw_name: 'Urea', canonical_name: 'Blood Urea Nitrogen' },
      { raw_name: 'S.Urea', canonical_name: 'Blood Urea Nitrogen' },
    ]);
    expect(out.map(nameOf)).toEqual(['ambiguous', 'ambiguous', 'ambiguous']);
  });

  it('is a no-op on an empty report', () => {
    expect(demoteIntraReportCollisions([])).toEqual([]);
  });
});
