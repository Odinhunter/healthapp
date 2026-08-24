/**
 * Resolves a lab-printed biomarker name to a canonical name.
 *
 * Lives in _shared/ so both the Deno edge function and the Jest suite can
 * import it. Deliberately free of Deno globals and Supabase imports — it is
 * pure data in, pure data out.
 *
 * Three problems in the previous inline implementation this fixes:
 *
 * 1. Case-sensitive exact match. `validNames` was a plain Set of
 *    canonical_name while the alias map was lowercased, so a report printing
 *    "LACTATE DEHYDROGENASE" missed the exact check and fell through to the
 *    alias lookup — where that key is contested. Exact matching is now
 *    case-insensitive and always beats an alias.
 *
 * 2. Silent last-write-wins on contested aliases. Several abbreviations are
 *    claimed by two canonical rows (TG = Triglycerides and Thyroglobulin;
 *    ICA/iCa = Islet Cell Antibodies and Calcium (Ionized)). The old Map
 *    build let whichever row Postgres returned last overwrite the earlier
 *    one — and the query had no ORDER BY, so the winner could differ between
 *    invocations. A contested alias now resolves to `ambiguous`, never to a
 *    coin-flip winner.
 *
 * 3. A canonical name that is also another row's alias (Lactate
 *    Dehydrogenase, Total IgE) is not contested — the row that owns the name
 *    wins. That holds even before the alias data is cleaned up.
 */

export interface CanonicalRow {
  canonical_name: string;
  aliases: string[] | null;
}

export type Resolution =
  /** Exactly one canonical row claims this name. */
  | { status: 'resolved'; canonicalName: string }
  /** Two or more rows claim it as an alias — refuse to guess. */
  | { status: 'ambiguous'; candidates: string[] }
  /** Nothing claims it. */
  | { status: 'unresolved' };

export interface Resolver {
  resolve(name: string): Resolution;
  /** Alias keys claimed by more than one canonical row, for logging. */
  contestedAliases(): string[];
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export function buildResolver(rows: CanonicalRow[]): Resolver {
  // Canonical names win outright, so they are keyed separately from aliases.
  const byCanonical = new Map<string, string>();
  for (const row of rows) {
    if (row?.canonical_name) {
      byCanonical.set(normalize(row.canonical_name), row.canonical_name);
    }
  }

  // Collect every claimant per alias rather than overwriting, so a contested
  // key is visible instead of silently resolving to the last writer.
  const aliasClaims = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row?.canonical_name) continue;
    for (const alias of row.aliases ?? []) {
      if (!alias) continue;
      const key = normalize(alias);
      // An alias that collides with a canonical name is not a conflict:
      // the row owning the name takes it.
      if (byCanonical.has(key)) continue;
      if (!aliasClaims.has(key)) aliasClaims.set(key, new Set());
      aliasClaims.get(key)!.add(row.canonical_name);
    }
  }

  return {
    resolve(name: string): Resolution {
      if (!name) return { status: 'unresolved' };
      const key = normalize(name);

      const exact = byCanonical.get(key);
      if (exact) return { status: 'resolved', canonicalName: exact };

      const claims = aliasClaims.get(key);
      if (!claims || claims.size === 0) return { status: 'unresolved' };
      if (claims.size === 1) {
        return { status: 'resolved', canonicalName: [...claims][0] };
      }
      return { status: 'ambiguous', candidates: [...claims].sort() };
    },

    contestedAliases(): string[] {
      return [...aliasClaims.entries()]
        .filter(([, claims]) => claims.size > 1)
        .map(([key]) => key)
        .sort();
    },
  };
}

export interface ExtractedBiomarker {
  raw_name: string;
  canonical_name?: string;
  [key: string]: unknown;
}

export interface ResolvedBiomarker {
  input: ExtractedBiomarker;
  resolution: Resolution;
  /** Which field produced the resolution, for debugging extraction quality. */
  matchedOn: 'canonical_name' | 'raw_name' | null;
}

/**
 * Resolves one extracted biomarker, trying the model's proposed canonical
 * name first and falling back to the name the lab actually printed.
 *
 * NOTE on ordering: the model's guess is still tried first, preserving today's
 * behaviour. There is a live hypothesis that this is itself a defect — the
 * extraction prompt lists "Blood Urea Nitrogen" among its examples but not
 * "Blood Urea", which may lead the model to normalise a printed "Urea" onto
 * the wrong canonical row, overriding a raw_name that would have resolved
 * correctly. Flipping the order is deliberately NOT done here: raw lab names
 * are chaotic and raw-name-first could lower the overall resolution rate.
 * That trade-off belongs to the extraction eval, not to a guess.
 */
export function resolveBiomarker(
  resolver: Resolver,
  b: ExtractedBiomarker,
): ResolvedBiomarker {
  if (b.canonical_name) {
    const r = resolver.resolve(b.canonical_name);
    if (r.status !== 'unresolved') {
      return { input: b, resolution: r, matchedOn: 'canonical_name' };
    }
  }
  if (b.raw_name) {
    const r = resolver.resolve(b.raw_name);
    if (r.status !== 'unresolved') {
      return { input: b, resolution: r, matchedOn: 'raw_name' };
    }
  }
  return { input: b, resolution: { status: 'unresolved' }, matchedOn: null };
}

/**
 * Two biomarkers in ONE report resolving to the same canonical name are, by
 * definition, different analytes collapsed onto one name — a lab does not
 * print the same test twice with different values. Observed in production:
 * BUN 11.87 and Urea 25.4 (exactly x2.14) both landed on Blood Urea Nitrogen,
 * and RDW-CV 14.5% and RDW-SD 36.2 fL both landed on Red Cell Distribution
 * Width. Charted as consecutive points they fabricate a ~53% decline.
 *
 * Keeping either one asserts a value that may be the wrong analyte, so this
 * demotes ALL members of a colliding group to unresolved. In a health record a
 * missing point is safer than a wrong one, and once unresolved rows persist as
 * `pending_review` this becomes lossless rather than a drop.
 */
export function demoteIntraReportCollisions(
  resolved: ResolvedBiomarker[],
): ResolvedBiomarker[] {
  const counts = new Map<string, number>();
  for (const r of resolved) {
    if (r.resolution.status === 'resolved') {
      const n = r.resolution.canonicalName;
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
  }

  return resolved.map((r) => {
    if (r.resolution.status !== 'resolved') return r;
    if ((counts.get(r.resolution.canonicalName) ?? 0) < 2) return r;
    return {
      ...r,
      resolution: {
        status: 'ambiguous',
        candidates: [r.resolution.canonicalName],
      },
    };
  });
}
