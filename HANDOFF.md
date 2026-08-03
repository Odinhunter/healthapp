# HealthApp — Project Handoff Document

> **Purpose:** This document is the complete handoff for a new Claude conversation. Read it fully before touching any code. It covers product vision, every technical decision made, the exact state of every file, and what to build next.

---

## SECTION 1 — PRODUCT VISION

### What this app is

A health records management app for the Indian market. The positioning: **"a doctor friend who never forgets anything about your family and would never tell anyone."**

The founding insight: Indians have no reliable way to store, track, and understand their health records over time. Reports are scattered across WhatsApp, folders, and labs. Nobody tracks trends. Doctors see patients for 4 minutes and have no historical context. This app fixes that.

### Five core features at launch

1. **Blood report upload and AI extraction** — photograph or upload a PDF, AI reads it, stores every number
2. **Biomarker timeline** — plot any single biomarker across multiple reports over time
3. **Doctor visit log** — record consultations, diagnoses, follow-up dates
4. **Medication tracking** — active prescriptions, reminder times, adherence log
5. **Family profiles** — manage records for multiple family members under one account

### Working app name

`HealthApp` — placeholder only. The wordmark appears in `app/(auth)/welcome.tsx`. Replace globally when final name is decided.

### Stack

- **Framework:** React Native 0.83.4 + Expo SDK 55
- **Routing:** Expo Router v3 (file-based, `app/` directory)
- **Backend:** Supabase (Mumbai region `ap-south-1`)
- **Language:** TypeScript strict throughout
- **Animations:** React Native Reanimated 4.2.1
- **List rendering:** `@shopify/flash-list` 2.0.2
- **SVG:** `react-native-svg` 15.15.3
- **Date formatting:** `date-fns` v4
- **Testing:** Jest + `jest-expo` + `@testing-library/react-native`

### Key product decisions — locked

| Decision | Detail |
|---|---|
| Market | India first, urban families 28–45 |
| Free tier | Unlimited uploads, basic view, one profile |
| Paid tier | AI interpretation, trends, family profiles |
| Upload policy | No upload limits ever — data in is always free |
| Auth | Phone OTP in production; email OTP active in development. Twilio + DLT registration pending |
| Data residency | Supabase Mumbai region. All health data stays in India |
| Analytics | No third-party analytics touching health data |
| Soft deletes | `deleted_at timestamptz` on all major tables |
| Session storage | Supabase JWT chunked into 2048-byte pieces in `expo-secure-store` (JWT exceeds the 2048-byte limit per key) |

---

## SECTION 2 — DATABASE SCHEMA

### Two-layer architecture

```
┌─────────────────────────────────────────────────────────────┐
│  REFERENCE DATA        canonical_biomarkers                 │
│  (admin-managed, read-only)                                 │
├─────────────────────────────────────────────────────────────┤
│  RAW LAYER             profiles                             │
│  (ground truth,        family_members                       │
│   append-only,         reports                              │
│   never modified)      biomarkers                           │
│                        doctor_visits                        │
│                        medications                          │
│                        medication_adherence_log             │
├─────────────────────────────────────────────────────────────┤
│  COMPUTED LAYER        biomarker_summaries                  │
│  (pre-processed,                                            │
│   what mobile reads)                                        │
├─────────────────────────────────────────────────────────────┤
│  PHASE 2 (structured   health_scores                        │
│  but unpopulated)      wearable_daily_summaries             │
└─────────────────────────────────────────────────────────────┘
```

**Why this separation exists:** A user with 5 family members over 3 years of quarterly tests could have 1,800+ individual data points. If the dashboard queried all of that every time, it would be slow and expensive (Supabase charges per row read). The computed layer stores one pre-calculated row per biomarker per person, updated automatically after each report. Dashboard loads ~20 rows instead of thousands.

### Table reference

#### `canonical_biomarkers`
Reference dictionary of every biomarker the system understands. Admin-managed, read-only for all users.

| Key columns | Notes |
|---|---|
| `canonical_name` | Official name, unique — e.g. `Haemoglobin` |
| `category` | `CBC`, `Lipid`, `Thyroid`, `Diabetes`, `Kidney`, `Liver`, `Vitamins`, `Iron` |
| `unit_standard` | Standard unit, e.g. `g/dL` |
| `aliases` | `text[]` of alternate names from Indian labs — e.g. `['Hb', 'HGB', 'Hemoglobin']` |
| `reference_min/max_male/female/child` | Normal range by demographic |
| `critical_low/high` | Values that trigger a critical alert |
| `description` | Plain English explanation |
| `low_meaning` / `high_meaning` | What out-of-range means in plain English |
| `is_active` | Soft-disable a biomarker without deleting it |

**RLS:** None. Accessible to all authenticated users. No insert/update from app.

**Pre-seeded:** 23 biomarkers covering the most common Indian lab panels — Haemoglobin, WBC, Platelets, HbA1c, Fasting Glucose, Total/LDL/HDL Cholesterol, Triglycerides, TSH, T3, T4, Creatinine, eGFR, Urea, SGPT, SGOT, Bilirubin Total, Vitamin D, Vitamin B12, Ferritin, Iron, Uric Acid.

#### `profiles`
One row per authenticated user account.

| Key columns | Notes |
|---|---|
| `id` | UUID — same as `auth.users.id` |
| `full_name` | Required |
| `phone` / `email` | Unique |
| `subscription_tier` | `free` or `pro` |
| `onboarding_complete` | Whether the user finished setup |
| `onboarding_data` | JSONB — answers from onboarding flow. **PENDING MIGRATION** — column does not exist in schema yet (see Known Issues) |

**RLS:** `auth.uid() = id` — users read/update/insert only their own row.

**Auto-created on signup:** The `on_auth_user_created` trigger (on `auth.users`) automatically inserts a profiles row using the user's email and `full_name` from `raw_user_meta_data`. The app never creates profiles manually.

#### `family_members`
Every person managed under one account, including the account holder (`is_primary = true`, `relationship = 'self'`). This is the **central entity** — almost every other table links back to it.

| Key columns | Notes |
|---|---|
| `owner_id` | FK → `profiles.id` |
| `full_name` | Required |
| `date_of_birth` | Used for age-appropriate reference ranges |
| `gender` | `male`, `female`, `other` |
| `relationship` | `self`, `parent`, `spouse`, `child`, `sibling`, `grandparent`, `other` |
| `blood_group` | `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-` |
| `is_primary` | `true` for the account holder |
| `avatar_color` | UI colour for their avatar tile |
| `known_conditions` | `text[]` — e.g. `['Type 2 Diabetes', 'Hypertension']` |
| `deleted_at` | Soft delete |

**RLS:** `auth.uid() = owner_id` — full CRUD on own family members.

**Indexes:** `(owner_id) WHERE deleted_at IS NULL`

#### `reports`
One row per uploaded blood test report. Tracks the async AI extraction pipeline.

| Key columns | Notes |
|---|---|
| `owner_id` | FK → `profiles.id` |
| `family_member_id` | FK → `family_members.id` |
| `lab_name` | e.g. `Thyrocare`, `Dr Lal PathLabs` |
| `report_date` | Date on the report, not upload date |
| `file_path` | Path in Supabase Storage bucket `reports` |
| `file_type` | `pdf` or `image` |
| `extraction_status` | `pending` → `processing` → `complete` / `failed` |
| `extraction_error` | Error message if AI extraction failed |
| `extraction_model` | Which AI model processed this report |
| `biomarker_count` | How many values were extracted |
| `deleted_at` | Soft delete |

**RLS:** `auth.uid() = owner_id`

**Indexes:**
- `(family_member_id, report_date DESC) WHERE deleted_at IS NULL`
- `(extraction_status) WHERE status IN ('pending', 'processing')`

**Realtime:** `replica identity full` is set. Table is added to `supabase_realtime` publication. The app subscribes to `UPDATE` events on a specific report to track extraction progress.

#### `biomarkers`
Raw layer. Every individual value extracted from every report. **Append-only — never modified.**

| Key columns | Notes |
|---|---|
| `report_id` | FK → `reports.id` |
| `family_member_id` | FK → `family_members.id` |
| `canonical_name` | FK → `canonical_biomarkers.canonical_name` (enforced by DB constraint) |
| `raw_name` | Exactly what the lab printed — preserved for audit |
| `value` | `numeric` |
| `unit` | Unit as reported by the lab |
| `reference_min/max` | The lab's own reference range |
| `status` | `normal`, `low`, `high`, `critical_low`, `critical_high` |
| `report_date` | Denormalised from report — enables fast range queries without a join |

**RLS:** `auth.uid() = owner_id`

**Indexes:**
- `(family_member_id, canonical_name, report_date DESC)` — primary trend query index
- `(report_id)` — fetch all values from a single report
- `(family_member_id, status) WHERE status != 'normal'` — fetch all abnormal values

#### `biomarker_summaries`
Computed layer. One row per biomarker per family member — always the latest known state. **Never written by the app directly — managed by the `refresh_biomarker_summaries` PostgreSQL function.**

| Key columns | Notes |
|---|---|
| `family_member_id` | FK → `family_members.id` |
| `canonical_name` | FK → `canonical_biomarkers.canonical_name` |
| `latest_value` / `latest_unit` / `latest_status` | Most recent result |
| `latest_report_date` | Date of most recent test |
| `previous_value` / `previous_report_date` | Second-most-recent result |
| `trend` | `improving`, `worsening`, `stable`, `new` |
| `trend_percentage` | % change between latest and previous |
| `consecutive_abnormal` | How many consecutive tests out of range |

**Constraint:** `UNIQUE(family_member_id, canonical_name)` — exactly one row per biomarker per person.

**RLS:** `auth.uid() = owner_id`

**Indexes:** `(family_member_id)` — loads all summaries for one person in one query.

#### `doctor_visits`
Log of medical consultations per family member.

| Key columns | Notes |
|---|---|
| `family_member_id` | FK → `family_members.id` |
| `doctor_name` | Required |
| `specialty` | e.g. `Cardiologist` |
| `visit_date` | Required |
| `diagnosis` | `text[]` |
| `followup_date` | When next visit is scheduled |
| `deleted_at` | Soft delete |

**RLS:** `auth.uid() = owner_id`

**Indexes:** `(family_member_id, visit_date DESC) WHERE deleted_at IS NULL`

#### `medications`
Active and historical prescriptions per family member.

| Key columns | Notes |
|---|---|
| `family_member_id` | FK → `family_members.id` |
| `visit_id` | Optional FK → `doctor_visits.id` |
| `name` / `generic_name` | Brand and generic names |
| `dosage` / `dosage_unit` / `frequency` | e.g. `500mg`, `twice daily` |
| `times_per_day` | Numeric, for reminder scheduling |
| `reminder_times` | `time[]` — e.g. `[08:00, 20:00]` |
| `with_food` | boolean |
| `start_date` / `end_date` | `end_date` null for ongoing |
| `is_active` | Whether currently being taken |
| `deleted_at` | Soft delete |

**RLS:** `auth.uid() = owner_id`

**Indexes:** `(family_member_id, is_active) WHERE deleted_at IS NULL AND is_active = true`

#### `medication_adherence_log`
Append-only raw log of every medication reminder event. Never updated — only new rows inserted.

| Key columns | Notes |
|---|---|
| `medication_id` | FK → `medications.id` |
| `scheduled_time` | When the reminder was due |
| `actioned_time` | When user responded (null if missed) |
| `outcome` | `taken`, `skipped`, `missed`, `snoozed` |
| `snooze_count` | How many times user snoozed this dose |

**RLS:** `auth.uid() = owner_id`

**Indexes:**
- `(medication_id, scheduled_time DESC)`
- `(family_member_id, scheduled_time DESC)`

#### `health_scores` — Phase 2, unpopulated
Will store one composite health score per family member per week: biomarker score, medication adherence score, visit regularity score, and weighted overall score (0–100). `version` column built in from day one so algorithm improvements can be tracked.

**RLS:** `auth.uid() = owner_id`

#### `wearable_daily_summaries` — Phase 2, unpopulated
Daily aggregated health data from wearable devices. Daily aggregates only (not raw readings). Planned sources: Apple Health, Google Fit, Ultrahuman, Noise. `UNIQUE(family_member_id, summary_date, source)` prevents duplicate imports.

**RLS:** `auth.uid() = owner_id`

### The `refresh_biomarker_summaries` function

Called after every successful report extraction. Takes a `family_member_id` and recalculates the `biomarker_summaries` table for that person.

**How it works:**
1. Uses SQL window functions with `PARTITION BY canonical_name ORDER BY report_date DESC` to process all history in a single pass.
2. `first_value()` gets the most recent value per biomarker.
3. `nth_value(value, 2)` gets the second-most-recent (previous) value.
4. `trend` is calculated by comparing `status` of latest vs. previous (normal vs. abnormal).
5. `trend_percentage` is the % change between the two most recent values.
6. `consecutive_abnormal` counts how many consecutive tests have been out of range.
7. Uses `INSERT ... ON CONFLICT DO UPDATE` (upsert) — safe to call repeatedly.

**Called via:** `supabase.rpc('refresh_biomarker_summaries', { p_family_member_id: ... })` in the edge function after biomarkers are inserted.

### The canonical naming system

**The problem:** Indian labs print wildly different names for the same test. Thyrocare prints `HGB`, Dr Lal prints `HAEMOGLOBIN`, SRL prints `Hb`. Without normalisation, trend analysis across labs is impossible.

**The solution:** `canonical_biomarkers.canonical_name` is the official name. `aliases` stores every known alternate spelling. The edge function resolves each extracted biomarker against this map (exact match first, then case-insensitive alias lookup) before inserting into `biomarkers`. The `raw_name` is also stored for audit purposes.

**Enforcement:** `biomarkers.canonical_name` has a FK constraint to `canonical_biomarkers.canonical_name`. Unrecognised biomarkers are silently dropped (not inserted) — a known limitation.

### Storage bucket

**Bucket name:** `reports` (private — no public URLs)

**Path structure:** `/{owner_id}/{family_member_id}/{report_id}/report.{jpg|pdf}`

**Storage RLS policy:** `auth.uid()::text = (storage.foldername(name))[1]` — users can only read/write files inside their own folder.

**File access:** Files are only accessible via authenticated signed URLs, never direct URLs.

---

## SECTION 3 — FULL FILE STRUCTURE

```
healthapp/
├── app/                          Expo Router pages
│   ├── _layout.tsx               Root layout + AuthGate (complete)
│   ├── upload.tsx                Upload bottom sheet — transparentModal (complete)
│   ├── (auth)/
│   │   ├── _layout.tsx           Auth stack, slide_from_right animation (complete)
│   │   ├── welcome.tsx           Welcome screen with IllustrationTrend (complete)
│   │   ├── onboarding.tsx        5-step onboarding, answers saved to AsyncStorage (complete)
│   │   ├── login.tsx             Email input → sends email OTP (complete)
│   │   ├── verify.tsx            OTP entry → verify + flush answers + route (complete)
│   │   └── create-profile.tsx    Create primary family_member (complete)
│   └── (app)/
│       ├── _layout.tsx           Tab navigator (Home, Records, Visits, Medications) (complete)
│       ├── index.tsx             Home screen — latest report + flagged biomarkers (complete)
│       ├── records.tsx           Paginated report list (complete)
│       ├── visits.tsx            PLACEHOLDER — just renders "Visits" text
│       ├── medications.tsx       PLACEHOLDER — just renders "Medications" text
│       └── report/
│           └── [id].tsx          Report detail — biomarkers by category (complete)
│
├── src/
│   ├── constants/
│   │   └── theme.ts              Colors, typography, spacing, radius (complete)
│   ├── types/
│   │   └── database.ts           Full TypeScript types for all 11 DB tables (complete)
│   ├── lib/
│   │   ├── supabase.ts           Supabase client with chunked SecureStore adapter (complete)
│   │   ├── auth.ts               OTP send/verify, sign out, current user (complete)
│   │   ├── reports.ts            createReport, subscribeToReportStatus, getPrimaryFamilyMember (complete)
│   │   ├── storage.ts            uploadReportFile to Supabase Storage (complete)
│   │   └── biomarkerGrouping.ts  groupBiomarkers, statusVariant, statusLabel, formatRefRange (complete)
│   ├── hooks/
│   │   ├── useAuth.ts            Session restore + onAuthStateChange subscription (complete)
│   │   ├── useHomeData.ts        Fetch primary member, latest report, status counts, flagged summaries (complete)
│   │   ├── useReports.ts         Paginated report list with biomarker counts (complete)
│   │   └── useReportDetail.ts    Report + enriched biomarkers + realtime + polling fallback (complete)
│   └── components/
│       ├── PrimaryButton.tsx     Full-width button with spring animation, loading state (complete)
│       ├── ScalePress.tsx        Animated spring-scale pressable wrapper (complete)
│       ├── home/
│       │   ├── EmptyReportIllustration.tsx  Illustration for empty home state (complete)
│       │   └── SkeletonPulse.tsx            Pulsing shimmer skeleton block (complete)
│       ├── illustrations/
│       │   ├── IllustrationTrend.tsx        Animated line chart SVG — used on welcome + onboarding step 3 (complete)
│       │   ├── IllustrationPulse.tsx        Animated pulsing rings — onboarding step 2 (complete)
│       │   ├── IllustrationScattered.tsx    Scattered rectangles — onboarding step 1 (complete)
│       │   ├── IllustrationShield.tsx       Shield graphic — onboarding step 5 (complete)
│       │   └── IllustrationOrbs.tsx         Floating orbs — onboarding step 4 (complete)
│       ├── onboarding/
│       │   ├── ProgressBar.tsx    Animated progress bar for 5-step onboarding (complete)
│       │   └── OptionCard.tsx     Selectable card with radio indicator + spring animation (complete)
│       ├── report/
│       │   ├── BiomarkerRow.tsx   Expandable row — name, value, unit, status pill, description (complete)
│       │   ├── CategoryHeader.tsx Category group header for FlashList (complete)
│       │   ├── SummaryStrip.tsx   Total / Normal / Attention counts at top of report detail (complete)
│       │   └── DetailSkeleton.tsx Skeleton for report detail loading state (complete)
│       └── records/
│           ├── ReportCard.tsx     Card for each report in the records list (complete)
│           ├── RecordsEmpty.tsx   Empty state for records tab (complete)
│           └── RecordsSkeleton.tsx Skeleton for records list loading (complete)
│
├── supabase/
│   └── functions/
│       └── extract-report/
│           └── index.ts          Edge function — AI extraction pipeline (complete, deployed)
│
├── __tests__/
│   ├── unit/
│   │   ├── auth-gate.test.ts           AuthGate routing logic
│   │   ├── auth-lib.test.ts            Auth library functions
│   │   ├── otp-validation.test.ts      OTP string cleaning + completion check
│   │   ├── phone-validation.test.ts    Phone number cleaning + completion
│   │   ├── verify-post-auth-flow.test.ts  Post-OTP routing decision logic
│   │   ├── profile-creation.test.ts    Profile insert shape validation
│   │   ├── onboarding-answers.test.ts  Onboarding payload shape
│   │   ├── onboarding-step-machine.test.ts  Step navigation and answer saving
│   │   └── theme.test.ts               Theme constants sanity checks
│   └── integration/
│       └── verify-flow.test.ts         End-to-end verify → route flow
│
├── __mocks__/
│   ├── supabase-js.js            Mock Supabase client for tests
│   ├── async-storage.js          Mock AsyncStorage
│   ├── expo-secure-store.js      Mock SecureStore
│   ├── expo-router.js            Mock expo-router
│   ├── react-native-svg.js       Mock SVG components
│   ├── datetimepicker.js         Mock DateTimePicker
│   └── url-polyfill.js           Mock URL polyfill
│
├── assets/
│   ├── icon.png                  App icon
│   ├── splash-icon.png           Splash screen
│   ├── favicon.png               Web favicon
│   ├── android-icon-foreground.png
│   ├── android-icon-background.png
│   └── android-icon-monochrome.png
│
├── databaseSchema.sql            Full SQL schema — source of truth for all tables/functions/RLS
├── DATABASE.md                   Plain-language database documentation for non-technical reference
├── CLAUDE.md                     Project instructions for Claude
├── HANDOFF.md                    This file
├── app.json                      Expo config
├── package.json                  Dependencies
├── babel.config.js               babel-preset-expo + react-native-worklets/plugin
├── tsconfig.json                 TypeScript config (strict)
└── .env                          Environment variables (not committed)
```

---

## SECTION 4 — SCREENS AND THEIR STATE

### `app/_layout.tsx` — Root Layout + AuthGate
**State:** Complete

The root layout wraps everything in an `AuthGate` component that:
- Listens to auth state via `useAuth`
- Redirects unauthenticated users to `/(auth)/welcome`
- Redirects authenticated users away from auth screens to `/(app)` — **with one exception:** `segments[1] === 'create-profile'` is exempted so the post-OTP profile setup flow isn't interrupted
- Renders a full-screen loading spinner while session is restoring
- Registers `upload` as a `transparentModal` screen so iOS doesn't apply sheet presentation controller insets

---

### `app/(auth)/welcome.tsx`
**State:** Complete

Entry point for new and returning users.
- Top 45%: `IllustrationTrend` animated SVG
- Bottom 55%: wordmark `HealthApp` (TODO: replace), headline, subtext
- Fade + slide-up entrance animation (Reanimated `withTiming` + `withSpring`)
- "Get started" → `/(auth)/onboarding`
- "I already have an account" → `/(auth)/login`

---

### `app/(auth)/onboarding.tsx`
**State:** Complete

5-step single-screen onboarding (all steps in one component, slides between them).

| Step | Type | Question | Answer options |
|---|---|---|---|
| 1 | Selection | Where do your health records live? | whatsapp / folder / lab_only / dont_track |
| 2 | Selection | How often do you get blood tests? | few_months / once_year / when_needed / been_a_while |
| 3 | Information | Most people lose 80% of health data | No selection — just CTA |
| 4 | Selection | What matters most to you? | understanding_reports / tracking_family / medications / one_place |
| 5 | Trust screen | Your data belongs to you | No selection — 3 trust bullet points |

**Animation:** `slideX` shared value — steps slide in from right on forward, from left on back. Uses `Easing.out(Easing.cubic)` — note: Reanimated 4.x uses `Easing.sin` not `Easing.sine`.

**On finish:** Serialises answers + `onboarding_completed_at` timestamp to `AsyncStorage` under key `onboarding_answers`. Navigates to `/(auth)/login`. Answers are flushed to `profiles.onboarding_data` in `verify.tsx` after successful OTP verification.

**Data shape stored in AsyncStorage:**
```json
{
  "records_location": "whatsapp | folder | lab_only | dont_track",
  "test_frequency": "few_months | once_year | when_needed | been_a_while",
  "top_priority": "understanding_reports | tracking_family | medications | one_place",
  "onboarding_completed_at": "ISO timestamp"
}
```

---

### `app/(auth)/login.tsx`
**State:** Complete (email OTP dev mode)

- Single email input field
- Validates via `isValidEmail()` (must contain `@` and `.`)
- Calls `sendEmailOTP(email)` from `src/lib/auth.ts`
- On success: navigates to `/(auth)/verify` passing `email` as a route param
- **Production TODO:** Switch to `signInWithOTP({ phone })` once Twilio + DLT registration is complete. The phone OTP code already exists in `auth.ts` as `signInWithOTP()`.

---

### `app/(auth)/verify.tsx`
**State:** Complete

Custom OTP input UI — 6 individual digit boxes driven by a hidden `TextInput`.

**Flow on successful verify:**
1. Call `verifyEmailOTP(email, token)`
2. Get current user via `supabase.auth.getUser()`
3. Read `onboarding_answers` from `AsyncStorage`
4. If found: `UPDATE profiles SET onboarding_data = ..., onboarding_complete = true` then `removeItem`
5. Query `family_members` for `is_primary = true` on this user
6. Route: primary member exists → `/(app)`, no primary member → `/(auth)/create-profile`

**Error UX:** Wrong OTP triggers a shake animation via `withSequence` on a `shakeX` shared value. OTP input is cleared.

**Resend:** 30-second countdown using `setTimeout` chain. Calls `sendEmailOTP(email)` again.

**Known issue:** `onboarding_data` column does not yet exist in the live database (see Known Issues section). The update call will silently fail or error until the migration is run.

---

### `app/(auth)/create-profile.tsx`
**State:** Complete

Creates the primary `family_members` row for the account holder.

Fields:
- Full name (required)
- Date of birth (DateTimePicker — modal on iOS, inline on Android)
- Gender (pill selector: Male / Female / Other)
- Blood group (grid pill selector: A+ through O-)

On submit:
1. Inserts `family_members` row with `relationship: 'self'`, `is_primary: true`, `avatar_color: colors.primary`
2. Updates `profiles.full_name` to match
3. Replaces navigation to `/(app)`

---

### `app/(app)/_layout.tsx`
**State:** Complete

Tab navigator with 4 tabs: **Home**, **Records**, **Visits**, **Medications**. The `report/[id]` route is registered with `href: null` to exclude it from the tab bar. Redirects to `/(auth)/welcome` if user logs out.

---

### `app/(app)/index.tsx` — Home Screen
**State:** Complete

**Data:** `useHomeData(user?.id)` fetches:
1. Primary family member name (split on space for first name)
2. Latest report (by `report_date DESC`)
3. Biomarker status counts from the latest report's `biomarkers` rows
4. Flagged `biomarker_summaries` count (total, for "See all" threshold)
5. Top 3 flagged biomarker summaries (for "Needs attention" section)

**Empty state:** If no reports exist, shows `EmptyReportIllustration` with a CTA to upload.

**Data state:** Shows:
- Header with greeting (Good morning/afternoon/evening) + first name + avatar initial
- "Latest report" card with lab name, date, stat pills (Normal / Flagged / Critical counts)
- "Needs attention" section with up to 3 `FlaggedRow` cards
- "See all →" if total flagged > 3 (button exists, **no destination yet**)
- FAB (+) for upload

**Known issue:** `FlaggedRow` has `onPress={() => {}}` — tapping a flagged biomarker does nothing. Should navigate to either the report detail or a biomarker trend view.

---

### `app/upload.tsx` — Upload Sheet
**State:** Complete

Presented as a `transparentModal` from any screen. The sheet panel is 88% of screen height, positioned at the bottom of a transparent overlay. Slide-up animation is driven manually via Reanimated (iOS doesn't apply `UISheetPresentationController` scroll insets in this mode).

**File sources:**
- Photo library (`expo-image-picker`)
- Camera (`expo-image-picker`)
- PDF (`expo-document-picker`)

**Form fields:** Lab name (optional text input), Report date (DateTimePicker, defaults to today).

**Upload flow (`analyse()` function):**
1. Generate `reportId = Crypto.randomUUID()`
2. Fetch primary family member via `getPrimaryFamilyMember(userId)`
3. Upload file to Storage: `uploadReportFile()` → `reports/{userId}/{memberId}/{reportId}/report.{ext}`
4. Create report row: `createReport()` with `extraction_status: 'pending'`
5. Invoke edge function: `supabase.functions.invoke('extract-report', { body: { report_id } })`
6. On success: `router.replace(`/(app)/report/${reportId}`)` — user lands on the processing screen

**File upload implementation:** Uses `expo-file-system`'s `File` class (not FormData or fetch) to read the file as an `ArrayBuffer` and upload directly to Supabase Storage.

**Known limitation:** Always uses the primary family member. No UI to select which family member this report belongs to.

---

### `app/(app)/report/[id].tsx` — Report Detail Screen
**State:** Complete

**Data:** `useReportDetail(id)` which:
- Fetches the report row
- If `complete`: fetches biomarkers with a join to `canonical_biomarkers` for category/description/meanings
- If `pending` or `processing`: subscribes to Supabase Realtime for UPDATE events on this report + starts a 3-second polling interval as fallback
- Cleans up subscription and polling on unmount

**States handled:**
- Loading → skeleton (`DetailSkeleton`)
- Error (could not load) → error message + go back
- `failed` → extraction error message + "Try uploading again"
- `pending` / `processing` → spinner + "Analysing your report…"
- `complete` + 0 biomarkers → "No biomarkers found" message
- `complete` + biomarkers → full list

**Biomarker list:** Rendered with `FlashList`. Items are flattened: each category group becomes a `CategoryHeader` item followed by individual `BiomarkerRow` items. Rows are expandable (tap toggles `expanded` Set state) to show description and meaning text from `canonical_biomarkers`.

**Components used:** `BiomarkerRow`, `CategoryHeader`, `SummaryStrip`, `DetailSkeleton`

---

### `app/(app)/records.tsx` — Records List
**State:** Complete

Paginated list of all reports for the user.

**Data:** `useReports(user?.id)` — fetches 20 reports per page ordered by `report_date DESC`. For `complete` reports, batch-fetches biomarker statuses to compute `counts: { normal, flagged, critical }`.

**States:** Loading skeleton, error, empty state (`RecordsEmpty`), populated list.

**FAB:** Same upload button as home screen.

---

### `app/(app)/visits.tsx`
**State:** PLACEHOLDER

```tsx
export default function VisitsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Visits</Text>
    </View>
  );
}
```

No data fetching, no UI beyond a centred text label.

---

### `app/(app)/medications.tsx`
**State:** PLACEHOLDER

```tsx
export default function MedicationsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Medications</Text>
    </View>
  );
}
```

No data fetching, no UI beyond a centred text label.

---

## SECTION 5 — BACKEND AND INFRASTRUCTURE

### Supabase project

- **Region:** `ap-south-1` (Mumbai) — chosen for Indian data residency
- **Auth config:** Email OTP enabled. Phone/SMS auth disabled (pending Twilio integration)
- **Realtime:** Enabled on the `reports` table (`replica identity full`, added to publication)
- **Extensions:** `uuid-ossp`, `pg_cron` (pg_cron added but not yet actively used)

### Edge Function: `extract-report`

**Location:** `supabase/functions/extract-report/index.ts`

**Trigger:** Called by the upload screen via `supabase.functions.invoke('extract-report', { body: { report_id } })` immediately after the report row is created.

**Model:** `claude-sonnet-4-5` (not claude-sonnet-4-6)

**Max tokens:** `16000` — large because comprehensive Indian blood panels have 50–100+ biomarkers

**Pipeline step by step:**

1. Validate `Authorization` header — extract JWT
2. Create admin Supabase client using service role key
3. Verify JWT: `supabaseAdmin.auth.getUser(token)` — authenticates the caller
4. Parse request body — require `report_id`
5. Fetch report row from DB — verify `owner_id = user.id` and `extraction_status = 'pending'`
6. Update report to `extraction_status: 'processing'`
7. Download file from Storage: `supabaseAdmin.storage.from('reports').download(report.file_path)`
8. Convert file to base64 (manual byte-by-byte loop using `btoa`)
9. Build Claude content blocks: PDF → `{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: ... } }`, image → `{ type: 'image', source: { type: 'base64', ... } }`
10. Call Claude API at `https://api.anthropic.com/v1/messages` with the prompt — expects pure JSON response
11. Strip any markdown code fences if present (Claude sometimes wraps output despite instructions)
12. Parse JSON response — handles non-medical file detection gracefully
13. Fetch `canonical_biomarkers` table — build alias map (case-insensitive)
14. Resolve each extracted biomarker's `canonical_name` via exact match then alias lookup
15. Filter: only insert biomarkers with valid `value` (number), `unit`, `raw_name`, and a resolved `canonical_name`
16. Bulk insert validated biomarkers into `biomarkers` table
17. Update report: `extraction_status: 'complete'`, `lab_name`, `biomarker_count`, `extraction_model: 'claude-sonnet-4-5'`
18. Call `refresh_biomarker_summaries(family_member_id)` via `supabaseAdmin.rpc()`
19. Return `{ success: true, biomarker_count: N }`

**Error handling:**
- Each failure mode updates `reports.extraction_status = 'failed'` and `extraction_error` with a message before returning an error response
- Non-medical files (detected from Claude's refusal text) return a user-friendly message: "This does not appear to be a blood test report."
- Unresolved biomarker names are silently dropped (not inserted)

**Confirmed working:** Extracts 50+ biomarkers from 18-page Indian lab PDF reports.

**Secrets required in Supabase dashboard:**
- `ANTHROPIC_API_KEY` — configured
- `SUPABASE_URL` — auto-injected by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — auto-injected by Supabase

### Realtime subscriptions

`useReportDetail` subscribes to `postgres_changes` on the `reports` table filtered by `id=eq.{reportId}`. The subscription is created via `subscribeToReportStatus()` in `src/lib/reports.ts`. A 3-second polling interval runs as a fallback in case the realtime event is missed. Both are cleaned up on component unmount.

### Auth configuration

**Current (development):** Email OTP. User enters email → receives 6-digit code → enters code in verify screen.

**Production plan:** Switch to phone OTP via Twilio. Code in `auth.ts` has `signInWithOTP({ phone })` and `verifyOTP({ phone, token, type: 'sms' })` already written, marked with `// PHONE AUTH — reinstate for production with Twilio`. Requires Twilio account, DLT registration (India telecom requirement for transactional SMS), and configuration in Supabase Auth settings.

---

## SECTION 6 — DESIGN SYSTEM

**Philosophy:** Flat, no shadows. Borders only, never elevation. Warm off-white background. Primary colour is a deep teal-green. All components follow this language consistently.

### Colors

```typescript
colors = {
  primary:       '#0F6E56',  // Deep teal-green — buttons, links, active states, primary actions
  primaryLight:  '#E1F5EE',  // Light teal — pill backgrounds, selected card bg, avatar bg
  background:    '#FAFAF9',  // Warm off-white — screen background
  surface:       '#FFFFFF',  // Pure white — cards, inputs, sheets
  border:        '#E8E6E1',  // Warm grey — card borders, input borders, dividers

  textPrimary:   '#1A1A1A',  // Near-black — headings, primary labels
  textSecondary: '#6B6966',  // Medium grey — subtitles, dates, secondary labels
  textTertiary:  '#9C9A92',  // Light grey — placeholders, metadata

  success:       '#1D9E75',  // Green — (reserved, not yet used in UI)
  warning:       '#BA7517',  // Amber — flagged biomarker text (high/low)
  danger:        '#E24B4A',  // Red — critical states, error text
  critical:      '#A32D2D',  // Dark red — critical biomarker text
}
```

**Status colour conventions (used in BiomarkerRow and home screen):**
- Normal: `primaryLight` background, `primary` text
- Flagged (high/low): `#FFF3DB` background, `#854F0B` text
- Critical: `#FCEBEB` background, `#A32D2D` text

### Typography scale

```typescript
typography = {
  xs:   11,  // Pills, metadata, timestamps
  sm:   13,  // Secondary labels, ref ranges, dates
  base: 15,  // Body text, button labels
  md:   17,  // Input text, section subtitles
  lg:   20,  // Section headers
  xl:   24,  // Screen subtitles
  xxl:  30,  // Screen titles, large names
}
```

### Spacing scale

```typescript
spacing = {
  xs:    4,
  sm:    8,
  md:    12,
  lg:    16,
  xl:    20,
  xxl:   24,
  xxxl:  32,
  xxxxl: 40,
  xxxxxl: 48,
}
```

### Border radius scale

```typescript
radius = {
  sm:   6,    // Small pills, tags
  md:   10,   // Biomarker rows
  lg:   14,   // Cards, inputs, buttons
  xl:   20,   // Large cards, sheet corners
  full: 999,  // Pills, avatars, circular buttons
}
```

### Key component patterns

**`PrimaryButton`** (`src/components/PrimaryButton.tsx`)
- Full width, 58px height, `radius.lg`
- Spring scale animation on press (scale 0.96)
- Disabled state: `backgroundColor: '#B4B2A9'`
- Loading state: `ActivityIndicator` replaces label
- Props: `label`, `onPress`, `disabled?`, `loading?`

**`ScalePress`** (`src/components/ScalePress.tsx`)
- Wrapper for any pressable content with spring scale animation (scale 0.97)
- Props: `onPress`, `style?`, `children`, `disabled?`
- Used instead of plain `Pressable` throughout the app for all interactive cards

**`OptionCard`** (`src/components/onboarding/OptionCard.tsx`)
- 64px height card with radio button on right
- Selected state: `primary` border (2px), `primaryLight` background
- Spring animation on press, accessibility role `radio`

**`ProgressBar`** (`src/components/onboarding/ProgressBar.tsx`)
- 3px track at top of screen
- Animated fill via `withTiming` (400ms, `Easing.out(Easing.cubic)`)

**Input field pattern** (used inline in login, verify, create-profile, upload):
- 58px height, 1.5px border (`colors.border`), `radius.lg`
- Focused: 2px border, `colors.primary`
- No shadow

**Card pattern:**
- `backgroundColor: colors.surface`, 1.5px border `colors.border`, `radius.lg`
- No shadow ever

### Animation conventions

- **Entrance:** `withTiming(opacity 0→1)` + `withSpring(translateY 20→0)`
- **Press feedback:** `withSpring(scale 0.96-0.97)` with `{ damping: 15, stiffness: 300 }`
- **Shake (error):** `withSequence` on `translateX`: -10, +10, -8, +8, 0 at 60ms each
- **Slide (onboarding):** `slideX` shared value set to ±SCREEN_WIDTH before step change, then `withTiming(0)` on re-render

---

## SECTION 7 — WHAT'S BUILT AND WHAT'S NEXT

### Fully working

- Complete auth flow end-to-end: Welcome → Onboarding → Login → OTP Verify → Create Profile → Home
- Onboarding 5 steps with answers persisted to AsyncStorage and flushed to DB on verify
- Home screen: empty state, data state with latest report card, flagged biomarker list, skeleton loading, FAB
- Upload sheet: camera, photo library, PDF, lab name + date form, upload + report creation + AI trigger
- AI extraction pipeline via Edge Function: PDF and image → Claude → canonical biomarkers → DB → biomarker_summaries refresh
- Report detail screen: FlashList with category headers, expandable biomarker rows, all pipeline states (pending/processing/complete/failed)
- Records tab: paginated list with biomarker counts per report, empty state, skeleton
- Realtime status updates on report detail screen (with polling fallback)
- All TypeScript types covering 11 DB tables
- 9 unit test files + 1 integration test file
- Confirmed working: 50+ biomarkers extracted from 18-page Indian lab PDF

### Partially working / needs attention

- **`FlaggedRow` `onPress`** is `() => {}` — tapping a flagged biomarker on the home screen does nothing. Should navigate to a biomarker trend view or the originating report.
- **"See all →" for flagged biomarkers** exists in home screen but has no destination.
- **Lab name on home screen card** — depends on edge function setting `lab_name` on the report row. Works when extraction succeeds; shows "Blood Report" as fallback when null.
- **Upload always uses primary family member** — no UI to choose which family member a report belongs to. This will be a problem as soon as users have more than one family member.

### What to build next (recommended order)

1. **Run the `onboarding_data` DB migration** (required before any new user completes onboarding)
2. **Biomarker trend chart** — tap a flagged biomarker on home → chart of that biomarker over time using `biomarkers` table with `biomarkers_timeline_idx`. The data model is ready; no UI exists yet.
3. **FlaggedRow navigation** — route to trend chart or report detail
4. **Doctor visits screen** — list, add, view, edit visit records (all DB infrastructure ready)
5. **Medications screen** — active medications, add/edit, adherence tracking
6. **Family member management** — add family members, switch active member context, select member on upload
7. **Medication reminders** — push notifications via `expo-notifications` (package already installed)
8. **Profile/settings screen** — edit name, change email, subscription info, sign out

---

## SECTION 8 — KNOWN ISSUES AND PENDING DECISIONS

### Bugs

**`onboarding_data` column missing from DB**
The `verify.tsx` screen calls:
```typescript
await supabase.from('profiles').update({
  onboarding_data: JSON.parse(raw),
  onboarding_complete: true,
}).eq('id', user.id);
```
But the `profiles` table in `databaseSchema.sql` does **not** have an `onboarding_data` column. The TypeScript types in `database.ts` include it, but the actual migration has not been run. Run this in the Supabase SQL editor:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_data jsonb DEFAULT '{}';
```

**Biomarker status counts on home screen**
The home screen queries `biomarkers` for the latest report and counts statuses. This works but does a second DB call after the report is fetched (not a single query). Consider whether biomarker counts should be pre-computed differently.

**Unresolved canonical names silently dropped**
In the edge function, biomarkers whose names cannot be resolved against `canonical_biomarkers` are silently filtered out. If a lab uses a name not in the aliases table, that biomarker is lost without any indication. This will surface as lower-than-expected `biomarker_count` on some reports.

### Tech debt

**`ScalePress` duplicated in home screen**
`app/(app)/index.tsx` contains a local `ScalePress` implementation identical to `src/components/ScalePress.tsx`. It predates the extracted component. The local version should be removed and the import used instead.

**`expo-notifications` installed but not wired**
`expo-notifications` is in `package.json` and `expo-local-authentication` too. Neither is configured or used yet.

**`@react-navigation/drawer` installed but not used**
`@react-navigation/drawer` is in dependencies but not used. May have been added in anticipation of a future feature.

**No error boundary**
There is no global React error boundary. An unhandled error in a screen will crash the app without recovery UI.

**No pull-to-refresh**
`useReports` has a `refresh()` function but no pull-to-refresh is wired in `records.tsx`.

**`biomarker_count` on reports row vs. actual**
The `reports.biomarker_count` column is set by the edge function to `biomarkers.length` after resolving canonical names. This means the count reflects only successfully resolved biomarkers, not total extracted. A 50-biomarker report might show 45 if 5 names didn't resolve.

### Pending decisions

- **Final app name** — `HealthApp` is a placeholder used in `welcome.tsx` wordmark, `onboarding.tsx` step 3 copy, `app.json` `name` and `slug`. All three need updating.
- **Phone OTP DLT registration** — Required for production in India. Without DLT (Distributed Ledger Technology) registration, SMS transactional messages are blocked by Indian telecom regulation. Twilio account + DLT entity/template registration needed before going live.
- **Subscription paywall** — The `subscription_tier` and `subscription_expires_at` columns exist. No paywall logic or payment integration exists yet.
- **Family member switching on upload** — Current assumption: always upload to primary member. Multi-member households need a member picker on the upload sheet.
- **Canonical biomarker coverage gaps** — Only 23 biomarkers are seeded. Indian comprehensive panels have 80–100+ tests. Gaps mean biomarkers are silently dropped on extraction. The aliases system is the right approach but needs more coverage.
- **`pg_cron` extension** — Installed but not used. Reserved for future scheduled jobs (e.g., weekly biomarker summary recalculations, scheduled health score computation).

---

## SECTION 9 — HOW TO RUN THE PROJECT

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Supabase CLI (`brew install supabase/tap/supabase`)
- iOS Simulator (Xcode) or Android Emulator, or physical device with Expo Go

### Environment variables

Create `.env` in the project root (this file is not committed):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Both values are found in the Supabase dashboard under **Project Settings → API**.

The edge function reads `ANTHROPIC_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` from Supabase secrets (not from `.env` — these are configured in the Supabase dashboard under **Edge Functions → Secrets**).

### Start development

```bash
npm install
npx expo start
```

Press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with Expo Go on a physical device.

### Run tests

```bash
npx jest
npx jest --watch          # watch mode
npx jest --coverage       # with coverage report
```

### Link Supabase project

```bash
supabase login
supabase link --project-ref your-project-ref
```

### Apply database schema

Run `databaseSchema.sql` in the Supabase SQL editor (Dashboard → SQL Editor). The schema is idempotent in most places (`CREATE OR REPLACE`, `CREATE IF NOT EXISTS`) but should be run once on a fresh project.

**Required additional migration** (not in `databaseSchema.sql`):
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_data jsonb DEFAULT '{}';
```

### Deploy edge functions

```bash
supabase functions deploy extract-report
```

Set secrets in Supabase dashboard: **Edge Functions → Secrets → Add new secret**:
- `ANTHROPIC_API_KEY` — your Anthropic API key

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase into all edge functions and do not need to be set manually.

### Build for production

```bash
npx expo build:ios      # iOS (requires Apple Developer account)
npx expo build:android  # Android
```

Or use EAS Build:
```bash
npm install -g eas-cli
eas build --platform ios
eas build --platform android
```
