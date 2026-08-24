# HealthApp — Handoff

> Single source of truth for a new session. Last updated **24 Aug 2026** — §3 rewritten after a full codebase teardown + live-DB diagnostics. Strategy and timeline are unchanged from the 23 Aug review (Android ~30 Oct / iOS ~5 Nov).
> Read order: this file → the [codebase teardown](https://claude.ai/code/artifact/003bbdda-71b2-4328-8ef5-e32440dc13ee) → the Notion boards (below). **`DATABASE.md` and `databaseSchema.sql` are design history, not schema — see §3.**
> **Notion is the working surface from 23 Aug 2026.** The strategy artifact (https://claude.ai/code/artifact/a3de5fbf-fa4b-4bf1-b067-28a5758141ba) is **frozen and historical** — it still describes the original 30-day plan. Read it for the strategy rationale (positioning, pricing, courses engine, competitive analysis); do NOT trust its dates, sequencing or scope.
> Session memory also persists at `~/.claude/projects/-Users-ishan-Code-healthapp/memory/` (auto-recalled).

---

## 1. Product

Family health-records app for India. Positioning: **"a doctor friend who never forgets anything about your family and would never tell anyone."** Core loop: upload/photograph lab report → AI extracts biomarkers → canonical normalization → trends over time. Plus doctor-visit log, medication tracking, family profiles.

### Strategy decisions (settled Aug 2026 — full rationale + sources in the artifact)

| Decision | Detail |
|---|---|
| Wedge | **Family caregiving layer** ("manage your parents' health from another city"), not a storage vault. Extraction+trends is free at 4 funded competitors (Eka, Ultrahuman Vision Cloud, August AI, Samsung Health). |
| Free tier | Storage/extraction/raw trends/basic reminders for **all** family members, forever. Never gate capture. |
| Paid tier | One **Plus** plan ₹1,499–1,999/yr, family-inclusive, annual prepaid (UPI AutoPay). Gates *interpretation + alerting*: course verdicts, caregiver alerts, digests, visit-prep packs, monthly family assessment. No paywall in month 1 — waitlist fake-door only. |
| Privacy | Trust floor + churn shield, not the invoice. Must be provable: access log, deletion UX, published handling policy. Launch copy: zero-retention extraction + honest disclosure ("processed in memory, never stored, never trained on"). Evaluate in-region inference (Bedrock ap-south-1 — verify model availability) post-launch. |
| Habit | Daily = med reminders (all members' meds fire on organizer's phone — no delegated access needed). Weekly = family digest. Episodic = the report moment. Quarterly = visit-prep pack. Never build habit on "viewing records." |
| Courses engine | n-of-1 "did it work" verdicts: intervention → adherence → retest → before/after with expected-effect band. v1 markers: 25-OH-D (hero: 60k IU sachet course), ferritin+Hb, HbA1c, lipids. **B12 excluded** (serum rises regardless of efficacy). Whoop-style statistics gate: no verdict until window elapsed + adherence threshold. Confounder guardrails: biotin×assays (48h washout), creatine×creatinine, vit-D seasonality, regression-to-mean bands. Copy: observational wellness framing only, no dose advice (CDSCO SaMD line + telemedicine rules). |
| Diet | As courses (psyllium→LDL −13 mg/dL; oat β-glucan −10; low-GI→HbA1c −0.31pp; DASH→SBP −11.4 @8wk), course-level yes/no adherence. **No calorie tracking ever** (fails differentiation test; category shrinking). |
| Next expansion | Caregiver-visible **home vitals** (BP/glucose/weight) — lane confirmed open (BeatO/Sugar.fit/Fitterfly are single-patient, none markets the caregiver job). Closest feature to SaMD line: trends + doctor-share, user-set thresholds, no diagnostic claims. Month 2+. |
| Super app | Never the strategy. Expansion filter: *"does it produce or explain a family health record?"* Fails: calorie coaching, consult marketplaces, delivery, community, cohort benchmarking. |
| Ingestion | WhatsApp forward-a-PDF becomes primary channel (month 2 — Meta verification paperwork starts month 1). Frame as document-intake bot, never "AI assistant on WhatsApp" (Meta ban, Jan 2026). ABDM/ABHA = secondary rail + trust hook. |
| Conflict-free rule | Retest nudges recommend the test, accept results from any lab, take **no hidden commission**. Never bundle OPD benefits (IRDAI/Kenko), never pharma data sales. |
| DPDP | Full obligations by 13 May 2027. Per-adult consent when adding family members; 72h breach runbook; grievance contact; India hosting throughout. |

---

## 2. Stack & running

React Native 0.83.4 + Expo SDK 55, Expo Router v3, Supabase (Mumbai `ap-south-1`), TypeScript strict, Reanimated 4, FlashList, Jest.

```bash
npm install && npx expo start        # dev (i = iOS sim)
npx jest                              # 151 tests pass in ~2s but cover 1.78% — NOT a safety net (see gaps)
supabase functions deploy extract-report
```

`.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Edge-function secrets (Supabase dashboard): `ANTHROPIC_API_KEY` (+ auto-injected URL/service-role key).

**Design system** (`src/constants/theme.ts`): flat, borders only, never shadows; warm off-white `#FAFAF9`; primary deep teal `#0F6E56`; cards = white surface, 1.5px `#E8E6E1` border, radius 14; spring-scale press feedback (`ScalePress`). Match it exactly.

---

## 3. Code state (re-verified 24 Aug 2026 — full teardown: https://claude.ai/code/artifact/003bbdda-71b2-4328-8ef5-e32440dc13ee)

> **`supabase/remote_schema.sql` is now the source of truth** (captured 24 Aug via `supabase db dump`). Treat `databaseSchema.sql` and `DATABASE.md` as design history — the former is a hand-maintained draft that drifted from production: its `refresh_biomarker_summaries` lacks both the `ROW_NUMBER()`/`rn = 1` dedup and the `(report_date DESC, id DESC)` tiebreaker the live function has, and it omits the `rls_auto_enable` event trigger entirely. Migration *history* is in sync — `supabase migration list --linked` shows `20260412` and `20260607` on both sides — but no migration ever created the base schema, so it lived only in that stale file until now.
>
> Re-dump after any dashboard change: `supabase db dump --db-url "postgresql://postgres.dnnvclnebifdovbsbkyq:<pw>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" -f supabase/remote_schema.sql` — needs Docker (`colima start`), and must go via the **IPv4 pooler**, since `db.<ref>.supabase.co` is IPv6-only and unreachable from a container.

### Working end-to-end
- Auth: welcome → 5-step onboarding → email OTP login/verify → create-profile → home. (Phone OTP code exists in `src/lib/auth.ts`, disabled pending Twilio+DLT.)
- Upload sheet (`app/upload.tsx`): camera/library/PDF → Supabase Storage → report row → `extract-report` edge function → realtime status + polling fallback → report detail with categorized expandable biomarkers.
- Records list (paginated), **visits (list/add/edit), medications (list/add/edit), biomarker trend chart (`app/(app)/trend/[canonicalName].tsx`)** — all real screens now.
- Extraction confirmed on 50+ biomarkers from 18-page Indian lab PDFs.

### Critical gaps (these ARE the week-1/2 work)
| Issue | Where |
|---|---|
| **Alias map conflates distinct analytes — fabricated trends.** BUN 11.87 and Urea 25.4 (×2.14, the exact conversion) both resolve to `Blood Urea Nitrogen`; RDW-CV 14.5% and RDW-SD 36.2 fL both resolve to `Red Cell Distribution Width`. Same panel, different analytes, plotted as consecutive trend points. Corrupts the one thing the product sells. | `canonical_biomarkers.aliases[]` — split the conflated rows; add a guard against one `canonical_name` twice in one `report_id` |
| **Scoping is split, not uniformly primary-hardwired.** Home + records filter on `owner_id` alone → they blend *all* members the day family CRUD ships. Trends/visits/meds filter on primary `family_member_id`. | `useHomeData.ts:52–99` and `useReports.ts:38` are the owner-scoped ones — **no `is_primary` appears in either**, so "grep `is_primary` to zero" will not catch them. `is_primary` reads: `useHomeData.ts:41`, `useBiomarkerTrend.ts:39`, `reports.ts:66`, `verify.tsx:97` (also missing its `deleted_at` filter). `create-profile.tsx:62` *writes* it and stays. |
| Unresolved biomarkers **silently dropped**, and `biomarker_count` reports the post-drop number | `extract-report/index.ts:270` drops, `:307` miscounts — persist as `pending_review` instead |
| **Test suite is not a safety net: 1.78% statement coverage.** 8 of 12 test files define the functions they test *inside the test file* (`authGateDecision`, `buildOnboardingPayload` exist nowhere in `src/`). 0% on every screen, hook and component. | `__tests__/` — 151 tests pass in 1.9s and cannot fail from an app change |
| A report that dies mid-extraction can never be retried — stuck in `processing` forever, client polls indefinitely | `index.ts:71–79` guard + no reaper; `upload.tsx:258` fires the invoke with no `await` and no `.catch()` |
| RPC error never checked — a summaries-refresh failure would be silent | `index.ts:313` |
| `consecutive_abnormal` can only ever be 0 or 1 — the `WHERE rn = 1` filter means its window frame (`UNBOUNDED PRECEDING AND CURRENT ROW`) contains exactly one row. It is a "latest reading is abnormal" boolean, not a streak count. Nothing reads it yet; the Week 5 digest/flag work would. | `refresh_biomarker_summaries` in `supabase/remote_schema.sql` |
| `tsc --noEmit` emits **516 errors, 515 of them config noise** (no `@types/jest`; `supabase/functions` inside the TS project). Unusable as a CI gate. | `tsconfig.json` is 4 lines with no `exclude`. One real error: `SkeletonPulse.tsx:43` |
| ~~No global error boundary~~ (done 24 Aug); no account-deletion flow (Apple + DPDP requirement) | `src/components/common/ErrorBoundary.tsx` / settings |
| **Trend chart draws MALE reference bands for every member.** `reference_min_male`/`reference_max_male` read unconditionally, so a woman's haemoglobin trend is drawn against 13.5–17.5 instead of 12.0–16.0 — she reads low when she is normal. Affects most sex-dimorphic markers. Chart band only; per-row status flags come from the lab's printed range and are unaffected. | `app/(app)/trend/[canonicalName].tsx:53-54`. Week 2 — needs the active-member context that member-scoping introduces. |
| `expo-notifications` installed but absent from `app.json` plugins; no `bundleIdentifier`/`package`/EAS id set | reminders = week 3; identity blocked on the name decision |
| Local `ScalePress` duplicate in `app/(app)/index.tsx`; `@react-navigation/drawer` unused; dead `index.ts` + `App.tsx` Expo scaffold | cleanup |

**Resolved 24 Aug (were listed as gaps, verified done):** `onboarding_data` column *exists* — migration already applied. Canonical biomarkers at **335**, not 23 — master seed is live, so the "expand toward ~100" task is closed and the slip lever *"cut canonical 100→50"* is void. A predicted `ON CONFLICT` defect in `refresh_biomarker_summaries` was **refuted** by direct execution against a member with duplicate readings.

### Architecture (detail in `DATABASE.md` + `databaseSchema.sql`)
- Two layers: append-only raw (`biomarkers` etc.) + computed (`biomarker_summaries`, refreshed by `refresh_biomarker_summaries()` window-function upsert per member).
- `family_members` is the hub; every table carries `owner_id` with RLS `auth.uid() = owner_id`. **Single-owner model** — delegated access (two siblings, one parent) is a known future schema evolution; design before data hardens.
- Canonical biomarker system: `canonical_name` FK + `aliases[]` resolves lab-name chaos; `raw_name` preserved.
- Soft deletes (`deleted_at`) on family_members/reports/visits/medications; filtered indexes.
- Phase-2 tables exist, unpopulated: `health_scores` (versioned), `wearable_daily_summaries`, `medication_adherence_log` (append-only).
- Edge function: JWT verify → download from private bucket → Claude (`claude-sonnet-4-5`, max_tokens 16000, direct Anthropic API) → JSON parse → canonical resolve → bulk insert → summaries refresh. Storage: private `reports` bucket, `/{owner_id}/{member_id}/{report_id}/`, signed URLs only.
- Cost ~₹2–25/report on Sonnet; fine at launch scale; cheaper first-pass model later.

---

## 4. The MVP plan (committed — revised 23 Aug 2026; strategy rationale in the frozen artifact §08, dates superseded here)

**Hypothesis to validate: families, not individuals, activate.** **Android is the launch vehicle, iOS follows within days.** Launch on **email OTP**. Day 1 = Mon 24 Aug 2026 · Android beta with real families **22 Sep** · submit both stores **26 Oct** · **Android live ~30 Oct, iOS target Thu 5 Nov**.

> **Code was never the constraint — paperwork is, and the bank account is the paperwork.** Founder decision (23 Aug): no company account opens before INC-20A is filed, and INC-20A needs the bank account. Chain: bank **25 Sep** → INC-20A **28 Sep** → D-U-N-S **~7 Oct** → store accounts **~mid Oct** → submit **26 Oct**. **Every day the bank account moves earlier, the launch moves with it** — that is the highest-leverage action available.

> **The store date slipped five weeks; the learning date did not.** The beta runs on Android, off-store, from 22 Sep exactly as originally planned — a Firebase App Distribution build needs no Play account, no D-U-N-S, no INC-20A.

**Entity: Ironstack Ventures Limited**, incorporated **27 Jul 2026** → INC-20A statutory deadline **23 Jan 2027** (153 days out — no compliance pressure; the pressure is pure sequencing). Company domain `ironstackventures.com` registered, email live — both satisfy Apple org-enrollment requirements. Product named separately (TBD).

> **Founder away 3–7 Sep** (no hands-on work). Capacity math: +8 calendar days − 5 hands-on = **+3 net build days**. The real gain is the think week absorbing writing/spec work that used to eat weeks 3–4.

- **Day 0 decisions:** app name **+ product domain as one coupled decision** (**hard deadline Wed 26 Aug** — also fixes the permanent bundle id; blocks EAS + listing; "HealthApp" is placeholder in `welcome.tsx`, `onboarding.tsx`, `app.json`) · seed list of 50 families (weight NRI organizers).

### Corporate track — lives at the company layer now

Company work (statutory compliance, banking, Apple/Play/Meta/D-U-N-S accounts) moved off this board on 23 Aug. **Detail: `~/Code/ironstack/COMPLIANCE.md` + the Ironstack Ventures boards in Notion.** The only thing this project needs to know:

> **bank a/c (after 20 Sep) → INC-20A (~28 Sep) → D-U-N-S (~7 Oct) → Apple / Play / Meta (~8 Oct) → submit 26 Oct.** No company account opens before INC-20A (founder decision). Neither store needs a bank account for a free app, and the **Android beta on 22 Sep needs no store account at all** — which is why the build plan below is unaffected by any of it.

- **Week 1 (24–30 Aug — revised 24 Aug):** ~~onboarding_data migration~~ (already applied) · ~~canonical expansion~~ (already at 335) · ~~error boundary~~ (done 24 Aug) · ~~capture real schema~~ (done 24 Aug, `db dump` not `db pull` — needs Docker) · `pending_review` fix (4 parts — drop/recreate `biomarkers_status_check`; make `canonical_name` nullable *or* add a sentinel canonical row, since it is `NOT NULL` with an FK; the type union; 3 else-branch count sites) → **alias-conflation fix** → **family CRUD + per-adult consent; member picker on upload** → EAS pipeline + rename → cleanup.
- **Week 2 (31 Aug–2 Sep, 3 days):** member switcher; **scope home/records/trends/report-detail by member** (kill every `is_primary` query). Both land *before* departure — never leave the never-cut architecture half-done across the gap. No TestFlight this month: all of Sep/early Oct runs on Expo dev-client + free provisioning on your own devices; first TestFlight is 16 Oct.
- **Think week (3–7 Sep, away, no code):** delegated-access schema design (two siblings, one parent — design before data hardens); courses v1 spec; extraction eval rubric; events-table/metrics spec; store-listing copy + shot list; onboarding/first-run copy; seed outreach + beta interview script; Bedrock ap-south-1 vs zero-retention decision.
- **Week 3 (8–13 Sep):** pilot extraction eval (10 reports, day back); **med reminders for any member on organizer's phone** → one-tap taken/skip → `medication_adherence_log` + streak; account deletion; data export (DPDP portability); report-complete push.
- **Week 4 (14–20 Sep):** onboarding "add first family member"; bulk-import screen; **full extraction eval — 40–50 reports across 6+ labs until >90% capture**; own-events-table metrics; **privacy/DPDP page + support@ live 19 Sep** (the beta needs them, not the store).
- **Week 5 (21–27 Sep):** **Android beta build via Firebase App Distribution (21 Sep) → 20–30 families (22 Sep)** — the thesis test, on the original schedule, with no store account involved; **bank account + subscription money deposited (25 Sep)**; weekly digest + out-of-range flag (Plus-gated post-launch, free preview at launch).
- **Launch (early Nov):** white-glove seeding of 50–100 families (4 Nov); go/no-go; **iOS live target Thu 5 Nov**. Android GA lands earlier, ~30 Oct.
- **Ambition added with the extra time:** courses v1 shell = start a course + adherence + retest reminder, **no verdict engine** (an 8–12 week retest window means no verdict can exist before ~Dec, so v1 doesn't need it); eval run twice and scaled; digest committed; data export; delegated-access design.
- **Still out:** courses verdict engine (month 3), home vitals, payments, ABDM, cross-account alerts, health scores, HealthKit, calorie tracking (ever).
- **Slip order:** digest + flag → ~~canonical count (100→50)~~ *(void — already at 335, nothing to cut)* → reminder polish. (WhatsApp left the list — month 2. Courses shell promoted to committed.) **October discipline:** that window is for beta iteration, not scope — no home vitals, no delegated-access build unless the beta demands it. **Never cut:** family CRUD + consent, member picker, member switcher, member-scoping, extraction eval, account deletion.
- **Targets:** ≥40% upload within 24h · **≥30% add a 2nd member in week 1 (thesis metric)** · >90% eval extraction · measure D7.

---

## 5. Immediate next steps for a fresh session

> ### ⚠️ READ FIRST — state as of end of 24 Aug 2026
>
> **All of today's work is on branch `week1-error-boundary-and-cleanup`, NOT merged to `main`.** Seven commits. Fast-forward with `git checkout main && git merge week1-error-boundary-and-cleanup` once reviewed.
>
> **Two things are pending action and one is blocked:**
>
> 1. **`supabase/migrations/20260824_fix_alias_conflations.sql` is written but NOT APPLIED.** Apply with `supabase db push` — migration history is in sync, so only this file is pending, and push does not need Docker.
> 2. **The alias data repair is blocked on one query.** The migration's closing comment holds it. Run this; the answer decides the repair *and* whether the resolver's canonical-before-raw order is itself a defect:
>    ```sql
>    select raw_name, value, unit, canonical_name, report_id, report_date
>      from biomarkers
>     where canonical_name in ('Blood Urea Nitrogen','Red Cell Distribution Width')
>     order by canonical_name, report_date;
>    ```
>    `raw_name` = `Urea` → the edge function trusting the model's `canonical_name` over the printed `raw_name` is the mechanism. `raw_name` = `S. Urea` → the alias collision alone explains it. **Do not flip the resolution order on theory** — raw lab names are chaotic and raw-first could lower the overall resolution rate. That call belongs to the extraction eval.
> 3. **Blast radius, same session:**
>    ```sql
>    select report_id, canonical_name, count(*), array_agg(raw_name), array_agg(value), array_agg(unit)
>      from biomarkers group by 1,2 having count(*) > 1;
>    ```
>
> **Housekeeping:** the Supabase DB password was exposed in a screenshot on 24 Aug — rotate it (Settings → Database → Reset; nothing in the app uses it). Colima is stopped.

**Done 24 Aug** (full detail in the [codebase teardown](https://claude.ai/code/artifact/003bbdda-71b2-4328-8ef5-e32440dc13ee) and the Notion board):

- **Global error boundary** at the root layout, outside `AuthGate`, with a "Back to home" escape hatch so a deterministic error can't trap the user. First real component test in the repo (mutation-checked).
- **Real schema captured** → `supabase/remote_schema.sql`. This is now the source of truth. `databaseSchema.sql` and `DATABASE.md` are design history.
- **Alias conflation fixed** in code + migration — three defect classes across the 335 canonical rows. Resolver extracted to `supabase/functions/_shared/canonicalResolver.ts`, importable by both Deno and Jest.
- **Graphify removed** from this project (still registered globally).
- Suite 151 → **175** passing; coverage 1.78% → ~4%.

**Two claims in §3 were disproved today and are already corrected there:** canonical biomarkers are at 335 (not 23), `onboarding_data` was already applied, and a predicted `ON CONFLICT` defect in `refresh_biomarker_summaries` was **refuted** by direct execution — the live function dedups via `ROW_NUMBER() … WHERE rn = 1`.

**Next in order:** `pending_review` (26 Aug — exact DDL is on the Notion row; write it against `remote_schema.sql`, not `databaseSchema.sql`) → family CRUD + consent (28 Aug) → member picker (29 Aug) → EAS + rename (30 Aug, blocked on the name decision).

**Still open founder decisions:** app name + product domain (one decision, **hard deadline 26 Aug**) · seed list of 50 families.


1. **Two boards now — company and product are separate.** Company-level work (statutory compliance, banking, Apple/Play/Meta/D-U-N-S accounts) moved OFF this project's board on 23 Aug into the **Ironstack Ventures** hub: https://app.notion.com/p/3c4afe337c73814aaa1ee391a9cca723 — holding *Compliance Calendar* and *Accounts & Vendors*, both relating back to the Projects database so you can see what blocks what. Context and reasoning live in `~/Code/ironstack` (COMPANY.md, COMPLIANCE.md, ACCOUNTS.md, research/, decisions/) — **that directory is deliberately not under version control and stays on this machine: do not `git init` it, add a remote, or offer to.** No version history there, so append and date rather than rewriting files wholesale. **The allocation rule: would you duplicate it if you started a fourth idea tomorrow? No → company layer.**
   **This project's board** is now build-only: **"HealthApp Launch"** (49 rows) at https://app.notion.com/p/0ea17bc2de5b4fd287e45a9254f9071d — views *Board by week*, *Calendar*, *Never cut*, *Think week (3–7 Sep)*, *Gated work*. Properties: Task, Week (Day 0 / Week 1–2 / Think week / Week 3–5 / October / Launch), Type, Status, Never-cut, Gate, Due, Notes. Update both as work lands — do not create a third.
2. On "go": start Week 1 in order (migration → error boundary → pending_review → family CRUD → member picker → EAS).
3. Keep **this file** and the **Notion boards** updated as decisions land — the artifact is frozen, do not update it.

**Open founder decisions:** app name + product domain (one decision, 26 Aug) · seed list. **Settled:** entity = Ironstack Ventures Limited (inc. 27 Jul 2026); no company accounts before INC-20A. **Scheduled:** Bedrock vs zero-retention disclosure (think week).

**The one lever that moves everything:** the bank account date. It gates INC-20A → store accounts → launch. Pulling it to early September moves launch ~3 weeks earlier; run a parallel application at a second bank.
