-- ============================================================
-- Migration: fix alias conflations in canonical_biomarkers
-- ------------------------------------------------------------
-- Found 24 Aug 2026 from live data. biomarker_summaries for one member
-- showed:
--
--   Blood Urea Nitrogen          latest 11.87   previous 25.4
--   Red Cell Distribution Width  latest 14.5    previous 36.2
--
-- 11.87 x 2.14 = 25.40 exactly, which is the standard Urea/BUN conversion.
-- Those are BUN and Urea from the SAME panel, not two readings over time.
-- Likewise RDW-CV (%) and RDW-SD (fL) are different measurements. Charted
-- as consecutive points they fabricate a ~53% decline in a product whose
-- entire value proposition is trends over time.
--
-- An audit of all 335 canonical rows found three defect classes.
--
-- IMPORTANT: this migration only edits alias arrays and adds one row. It
-- never renames an existing canonical_name — two foreign keys reference
-- canonical_biomarkers(canonical_name) by value (biomarkers and
-- biomarker_summaries), and the name is also a route param in
-- app/(app)/trend/[canonicalName].tsx.
--
-- Safe to run repeatedly.
-- ============================================================


-- ------------------------------------------------------------
-- CLASS 1 — aliases claimed by two different canonical rows
-- ------------------------------------------------------------
-- The edge function built its lookup with last-write-wins over a query that
-- had no ORDER BY, so which row won was arbitrary and could differ between
-- invocations. The resolver now refuses to guess on a contested alias, but
-- the underlying data should still be unambiguous.
--
-- Resolution rule: keep the abbreviation on the analyte that is ordered far
-- more often, and strip it from the rare one, whose full canonical name
-- still resolves on its own. Where both are rare and genuinely ambiguous,
-- strip it from both and let it fall through to unresolved.

-- 'TG' vs 'Tg' — triglycerides (routine lipid panel, mg/dL) vs
-- thyroglobulin (thyroid cancer follow-up, ng/mL). Case-insensitively the
-- same key. Keep TG on triglycerides.
update canonical_biomarkers
   set aliases = array_remove(aliases, 'Tg')
 where canonical_name = 'Thyroglobulin';

-- 'ICA' vs 'iCa' — islet cell antibodies (rare) vs ionized calcium
-- (routine, part of many metabolic panels). Keep it on calcium.
update canonical_biomarkers
   set aliases = array_remove(aliases, 'ICA')
 where canonical_name = 'Islet Cell Antibodies';

-- 'S. Urea' means serum urea, so it belongs to Blood Urea, not BUN.
update canonical_biomarkers
   set aliases = array_remove(aliases, 'S. Urea')
 where canonical_name = 'Blood Urea Nitrogen';

-- 'ACA' — anti-cardiolipin vs anti-centromere antibodies. Both are
-- uncommon and both legitimately abbreviate to ACA, so there is no
-- defensible winner. Removed from both: better unresolved than wrong.
-- 'aCL' still resolves anti-cardiolipin.
update canonical_biomarkers
   set aliases = array_remove(aliases, 'ACA')
 where canonical_name in ('Anti-Cardiolipin Antibodies', 'Anti-Centromere Antibodies');

-- Two rows aliased a name that is another row's canonical_name. Harmless
-- when the lab prints exact case, but the old resolver's exact-match check
-- was case-SENSITIVE while its alias map was lowercased — so an all-caps
-- "LACTATE DEHYDROGENASE" (routine on Indian reports) missed the exact
-- check and landed in the contested alias lookup.
update canonical_biomarkers
   set aliases = array_remove(aliases, 'Lactate Dehydrogenase')
 where canonical_name = 'LDH (as tumor marker)';

update canonical_biomarkers
   set aliases = array_remove(aliases, 'Total IgE')
 where canonical_name = 'Immunoglobulin E (Total)';


-- ------------------------------------------------------------
-- CLASS 2 — one canonical row covering two distinct analytes
-- ------------------------------------------------------------
-- Red Cell Distribution Width carried BOTH 'RDW-CV' and 'RDW-SD'. Its own
-- description said "CV is %, SD is fL" — the conflation was known and
-- shipped anyway. RDW-CV is a percentage (~11.5-14.5); RDW-SD is a volume
-- in femtolitres (~39-46). One canonical row cannot hold both: they share
-- a single reference range, which the trend chart draws as a band
-- (app/(app)/trend/[canonicalName].tsx:53).
--
-- Bare 'RDW' stays on the CV row — reporting RDW as a percentage is the
-- near-universal convention on Indian panels.
--
-- Reference range on the new row is left NULL deliberately. RDW-SD normal
-- ranges are analyser-dependent, and a seeded range here becomes a
-- flagging threshold in a health product. Per-report ranges printed by the
-- lab are still captured on the biomarker row itself, so nothing is lost;
-- the chart simply draws no band until a citable range is agreed.
insert into canonical_biomarkers
  (canonical_name, category, unit_standard, alt_units, aliases, description)
values
  ('Red Cell Distribution Width (SD)', 'Complete Blood Count', 'fL', null,
   array['RDW-SD'],
   'Red cell size variation expressed as a standard deviation in fL. Distinct from RDW-CV, which is a percentage.')
on conflict (canonical_name) do nothing;

update canonical_biomarkers
   set aliases   = array_remove(aliases, 'RDW-SD'),
       alt_units = null,
       description = 'Red cell size variation expressed as a coefficient of variation (%). Distinct from RDW-SD, which is a volume in fL.'
 where canonical_name = 'Red Cell Distribution Width';


-- ------------------------------------------------------------
-- CLASS 3 — aliases corrupted by the seed generator
-- ------------------------------------------------------------
-- The 20260412 seed was generated from biomarker_master_list.xlsx by
-- splitting alias lists on commas — which also split any alias that
-- CONTAINED a comma. Two rows lost their real abbreviation and gained a
-- bogus '1', which then collided with each other.
--   1,5-AG      -> '1' + '5-AG'
--   1,25(OH)2D  -> '1' + '25(OH)2D'
update canonical_biomarkers
   set aliases = array['1,5-AG', '5-AG', 'GlycoMark']
 where canonical_name = '1,5-Anhydroglucitol';

-- '25(OH)2D' is dropped as well: it is a meaningless fragment and sits one
-- character away from '25(OH)D', the 25-hydroxy vitamin D abbreviation.
update canonical_biomarkers
   set aliases = array['Calcitriol', '1,25(OH)2D', 'Active Vitamin D']
 where canonical_name = '1,25-Dihydroxy Vitamin D';


-- ------------------------------------------------------------
-- Verification — every row below should return zero
-- ------------------------------------------------------------
-- Any alias still claimed by two or more canonical rows:
--
--   select lower(a) as alias, array_agg(canonical_name order by canonical_name)
--     from canonical_biomarkers, unnest(aliases) as a
--    group by lower(a)
--   having count(distinct canonical_name) > 1;
--
-- Any alias that is also a different row's canonical_name:
--
--   select c.canonical_name, a
--     from canonical_biomarkers c, unnest(c.aliases) as a
--    where lower(a) in (select lower(canonical_name) from canonical_biomarkers)
--      and lower(a) <> lower(c.canonical_name);


-- ============================================================
-- DATA REPAIR — deliberately NOT included
-- ------------------------------------------------------------
-- Existing biomarkers rows are still mis-mapped. The repair is held back
-- until one question is answered, because it changes what the fix must be:
-- whether the mis-mapping came from the alias collision or from the edge
-- function trusting the model's proposed canonical_name over the printed
-- raw_name. raw_name discriminates:
--
--   select raw_name, value, unit, canonical_name, report_id, report_date
--     from biomarkers
--    where canonical_name in ('Blood Urea Nitrogen',
--                             'Red Cell Distribution Width')
--    order by canonical_name, report_date;
--
-- Full blast radius across all members:
--
--   select report_id, canonical_name, count(*),
--          array_agg(raw_name), array_agg(value), array_agg(unit)
--     from biomarkers
--    group by report_id, canonical_name
--   having count(*) > 1;
--
-- Repair will be a targeted UPDATE of canonical_name on the affected rows
-- followed by refresh_biomarker_summaries() per affected member. Rewriting
-- the derived canonical_name does not violate the append-only design of
-- this table: raw_name, value, unit and report_date — everything the lab
-- actually printed — are left untouched.
--
-- Pre-beta this is a handful of rows. Do not build a backfill framework.
-- ============================================================
