# Database Architecture

> **Audience:** This document is written for a non-technical founder who is actively learning. Every decision has a *why*, not just a *what*.

---

## 1. Overview

The database has two distinct layers — a **raw layer** and a **computed layer** — plus a **reference data** table and two **phase 2** tables that are structured but not yet active.

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

### Why this separation exists

**The problem it solves:** A user might have 5 family members, each with 3 years of quarterly blood tests. That is 60+ reports, each containing 20–30 biomarkers — potentially 1,800 individual data points. If the mobile app had to query all of that raw data every time you opened the dashboard, it would be slow, battery-intensive, and expensive (Supabase charges per row read).

**The solution:** The raw layer stores every individual data point permanently — this is the ground truth and is never altered. The computed layer holds one pre-calculated row per biomarker per person, updated automatically after each new report. When the app loads the dashboard, it reads ~20 rows instead of potentially thousands. This is the difference between a screen loading in 80ms versus 2 seconds.

---

## 2. Tables

### `canonical_biomarkers`

**Purpose:** A master dictionary of every biomarker the system understands. Think of it as the "official spellings" reference that all labs get translated into.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `canonical_name` | text | Official name, e.g. `Haemoglobin` — unique |
| `category` | text | `CBC`, `Lipid`, `Thyroid`, `Diabetes`, `Kidney`, `Liver`, `Vitamins`, `Iron` |
| `unit_standard` | text | Standard unit, e.g. `g/dL` |
| `aliases` | text[] | Array of alternate names, e.g. `['Hb', 'HGB', 'Hemoglobin']` |
| `reference_min/max_male/female/child` | numeric | Normal range by demographic |
| `critical_low/high` | numeric | Values that should trigger an urgent alert |
| `description` | text | Plain English explanation |
| `low_meaning` / `high_meaning` | text | What an out-of-range result actually means |
| `is_active` | boolean | Soft-disable a biomarker without deleting it |

**Indexes:** None needed — this table is tiny (~23 rows) and queried by `canonical_name` which is indexed via the `unique` constraint.

**RLS:** No RLS. This table is read-only reference data, accessible to all authenticated users. Only admins can insert or update rows.

**Pre-seeded with 23 biomarkers** covering the most common Indian lab panels: CBC, Lipid, Thyroid, Diabetes, Kidney, Liver, Vitamins, Iron.

---

### `profiles`

**Purpose:** One row per user account (the person who signed up). Stores identity, subscription status, and onboarding state. Linked directly to Supabase Auth.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key — same UUID as `auth.users.id` |
| `full_name` | text | Required |
| `phone` | text | Unique across all accounts |
| `email` | text | Unique across all accounts |
| `avatar_url` | text | Profile photo URL |
| `subscription_tier` | text | `free` or `pro` |
| `subscription_expires_at` | timestamptz | When pro access expires |
| `onboarding_complete` | boolean | Whether the user finished setup flow |

**Indexes:** Primary key on `id`. Phone and email have implicit unique indexes.

**RLS:**
- Users can only read, update, or insert their own row — enforced by `auth.uid() = id`.

**Auto-created on signup:** When a user signs up via Supabase Auth, a trigger (`on_auth_user_created`) automatically creates their profile row. The app never has to do this manually.

---

### `family_members`

**Purpose:** Everyone whose health is managed under one account. This is the central entity in the entire schema — almost every other table connects back to it. The account holder themselves is also a row here (with `is_primary = true` and `relationship = 'self'`).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `owner_id` | uuid | Foreign key → `profiles.id` |
| `full_name` | text | Required |
| `date_of_birth` | date | Used for age-appropriate reference ranges |
| `gender` | text | `male`, `female`, or `other` |
| `relationship` | text | `self`, `parent`, `spouse`, `child`, `sibling`, `grandparent`, `other` |
| `blood_group` | text | `A+`, `B-`, etc. |
| `is_primary` | boolean | `true` for the account holder |
| `avatar_color` | text | UI color for their avatar tile |
| `known_conditions` | text[] | e.g. `['Type 2 Diabetes', 'Hypertension']` |
| `known_allergies` | text[] | Free-text array |
| `emergency_contact_name/phone` | text | For that family member |
| `deleted_at` | timestamptz | Soft delete — see section 9 |

**Indexes:** `(owner_id)` filtered to non-deleted rows — used to load all family members for a given user.

**RLS:** Users can do everything (select, insert, update, delete) on rows where `auth.uid() = owner_id`.

---

### `reports`

**Purpose:** One row per uploaded blood test report. The actual file (PDF or image) is stored in Supabase Storage — this table holds the metadata and tracks the AI extraction pipeline's status.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `owner_id` | uuid | Foreign key → `profiles.id` |
| `family_member_id` | uuid | Foreign key → `family_members.id` |
| `lab_name` | text | e.g. `Thyrocare`, `Dr Lal PathLabs` |
| `report_date` | date | Date on the report, not upload date |
| `file_path` | text | Path in Supabase Storage |
| `file_type` | text | `pdf` or `image` |
| `extraction_status` | text | `pending` → `processing` → `complete` / `failed` |
| `extraction_error` | text | Error message if AI extraction failed |
| `extraction_model` | text | Which AI model processed this report |
| `biomarker_count` | integer | How many values were extracted |
| `visit_id` | uuid | Optional link to a doctor visit |
| `deleted_at` | timestamptz | Soft delete |

**Indexes:**
- `(family_member_id, report_date DESC)` filtered to non-deleted — loads a person's report history chronologically.
- `(extraction_status)` filtered to `pending` and `processing` — used by the background extraction job to find reports that still need processing.

**RLS:** Users can do everything on rows where `auth.uid() = owner_id`.

---

### `biomarkers`

**Purpose:** The raw layer. Every individual value extracted from every report — one row per biomarker per report. This table is the ground truth. Values are never modified after insertion. If a re-extraction happens, new rows are inserted.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `owner_id` | uuid | Foreign key → `profiles.id` |
| `report_id` | uuid | Foreign key → `reports.id` |
| `family_member_id` | uuid | Foreign key → `family_members.id` |
| `canonical_name` | text | Foreign key → `canonical_biomarkers.canonical_name` |
| `raw_name` | text | Exactly what the lab printed, e.g. `S. HAEMOGLOBIN` |
| `value` | numeric | The numeric result |
| `unit` | text | Unit as reported by the lab |
| `reference_min/max` | numeric | The lab's own reference range for this test |
| `status` | text | `normal`, `low`, `high`, `critical_low`, `critical_high` |
| `report_date` | date | Denormalised from the report — enables fast range queries without a join |

**Indexes:**
- `(family_member_id, canonical_name, report_date DESC)` — the primary timeline index. Used when plotting a trend chart for one biomarker over time.
- `(report_id)` — fetches all values from a single report.
- `(family_member_id, status)` filtered to non-normal — fetches all abnormal values without scanning normal ones.

**RLS:** Users can do everything on rows where `auth.uid() = owner_id`.

---

### `biomarker_summaries`

**Purpose:** The computed layer. One row per biomarker per family member — always representing the latest known state. This is what the mobile app reads for dashboard views, health summaries, and quick-glance cards. It is recalculated automatically after every report extraction using the `refresh_biomarker_summaries` function.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `owner_id` | uuid | Foreign key → `profiles.id` |
| `family_member_id` | uuid | Foreign key → `family_members.id` |
| `canonical_name` | text | Foreign key → `canonical_biomarkers.canonical_name` |
| `latest_value` | numeric | Most recent result |
| `latest_unit` | text | Unit of the most recent result |
| `latest_status` | text | `normal`, `low`, `high`, `critical_low`, `critical_high` |
| `latest_report_date` | date | Date of the most recent test |
| `previous_value` | numeric | The result before the latest one |
| `previous_report_date` | date | Date of the previous test |
| `trend` | text | `improving`, `worsening`, `stable`, or `new` |
| `trend_percentage` | numeric | % change between latest and previous |
| `consecutive_abnormal` | integer | How many tests in a row have been out of range |
| `updated_at` | timestamptz | When this summary was last recalculated |

**Constraint:** `UNIQUE(family_member_id, canonical_name)` — enforces exactly one row per biomarker per person.

**Indexes:** `(family_member_id)` — loads all summaries for one person in a single query. This powers the main dashboard.

**RLS:** Users can do everything on rows where `auth.uid() = owner_id`.

---

### `doctor_visits`

**Purpose:** A log of every medical consultation for each family member. Optionally linked to reports (a report taken before or after a visit).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `owner_id` | uuid | Foreign key → `profiles.id` |
| `family_member_id` | uuid | Foreign key → `family_members.id` |
| `doctor_name` | text | Required |
| `specialty` | text | e.g. `Cardiologist`, `General Physician` |
| `clinic_hospital` | text | Where the visit happened |
| `visit_date` | date | Required |
| `reason` | text | Why the visit happened |
| `diagnosis` | text[] | Array of diagnoses made at this visit |
| `followup_date` | date | When the next visit is scheduled |
| `deleted_at` | timestamptz | Soft delete |

**Indexes:** `(family_member_id, visit_date DESC)` filtered to non-deleted — loads visit history for a person chronologically.

**RLS:** Users can do everything on rows where `auth.uid() = owner_id`.

---

### `medications`

**Purpose:** Active and historical prescriptions per family member. Optionally linked to the doctor visit at which they were prescribed.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `owner_id` | uuid | Foreign key → `profiles.id` |
| `family_member_id` | uuid | Foreign key → `family_members.id` |
| `visit_id` | uuid | Optional foreign key → `doctor_visits.id` |
| `name` | text | Brand name, e.g. `Metformin 500` |
| `generic_name` | text | Generic drug name |
| `dosage` / `dosage_unit` | text | e.g. `500mg` |
| `frequency` | text | Human-readable, e.g. `twice daily` |
| `times_per_day` | integer | Numeric version for reminder scheduling logic |
| `reminder_times` | time[] | e.g. `[08:00, 20:00]` |
| `with_food` | boolean | Whether to take with food |
| `start_date` / `end_date` | date | `end_date` is null for ongoing medications |
| `is_active` | boolean | Whether currently being taken |
| `prescribed_by` | text | Doctor's name |
| `deleted_at` | timestamptz | Soft delete |

**Indexes:** `(family_member_id, is_active)` filtered to non-deleted and active — loads today's medication list without touching historical records.

**RLS:** Users can do everything on rows where `auth.uid() = owner_id`.

---

### `medication_adherence_log`

**Purpose:** An append-only raw log of every medication reminder event and what the user did with it. This table is never updated — only new rows are inserted. Used to calculate adherence rates over time.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `owner_id` | uuid | Foreign key → `profiles.id` |
| `medication_id` | uuid | Foreign key → `medications.id` |
| `family_member_id` | uuid | Foreign key → `family_members.id` |
| `scheduled_time` | timestamptz | When the reminder was due |
| `actioned_time` | timestamptz | When the user responded (null if missed) |
| `outcome` | text | `taken`, `skipped`, `missed`, or `snoozed` |
| `snooze_count` | integer | How many times the user snoozed this dose |

**Indexes:**
- `(medication_id, scheduled_time DESC)` — calculates adherence rate for a specific medication over a date range.
- `(family_member_id, scheduled_time DESC)` — calculates adherence rate across all medications for a person.

**RLS:** Users can do everything on rows where `auth.uid() = owner_id`.

---

## 3. Key Relationships

### The `owner_id` pattern

Every table except `canonical_biomarkers` has an `owner_id` column that points back to `profiles.id`. This is the security backbone of the entire schema. Every RLS policy checks `auth.uid() = owner_id`, which means a logged-in user can only ever see data that belongs to their account — regardless of how the query is written.

### `family_member_id` as the central foreign key

`family_members` is the hub around which all health data is organised. Reports, biomarkers, visits, medications, and adherence logs all reference a `family_member_id`. This allows the app to ask "show me everything for Mum" with a simple filter on one column.

```
profiles (account)
    └── family_members (people)
            ├── reports (documents)
            │       └── biomarkers (raw values)
            ├── biomarker_summaries (computed state)
            ├── doctor_visits (consultations)
            └── medications (prescriptions)
                    └── medication_adherence_log (dose history)
```

### How reports link to visits

The link between `reports` and `doctor_visits` is **optional and bidirectional by intent**. A blood test might be ordered at a visit (`reports.visit_id` points to the visit), or a visit might have a lab report attached to it. The FK is set to `ON DELETE SET NULL`, meaning if a visit is deleted, the report remains — it doesn't disappear with it.

---

## 4. Security Model

### Row Level Security (RLS)

Supabase PostgreSQL has a feature called Row Level Security. When RLS is enabled on a table, every query — no matter where it comes from — must pass a policy check before any row is returned or modified. If no policy allows the action, the database returns zero rows (not an error, just nothing).

RLS is enabled on every table in this schema.

### The `owner_id` pattern

Every policy follows the same rule: `auth.uid() = owner_id`. `auth.uid()` is the UUID of the currently logged-in user, injected automatically by Supabase into every query. This means:

- User A cannot read User B's data, even if they know the UUID.
- A bug in the app that accidentally queries the wrong user's data returns nothing.
- A compromised API key cannot access another user's records.

**Security is enforced at the database level, not the app level.** This is critical — it means even if someone bypasses the app entirely and queries the database directly, they still cannot access data that isn't theirs.

### Storage bucket policy

The `reports` storage bucket (where uploaded files live) uses the same pattern. The folder structure is `/{owner_id}/{family_member_id}/{report_id}`. The storage policy checks that the first folder segment matches `auth.uid()`. This means a user can only read and write files inside their own folder.

The bucket is **private** — there are no public URLs. A file can only be accessed by the account holder via an authenticated signed URL.

---

## 5. Canonical Biomarker System

### The problem this solves

Different Indian labs print different names for the same test. Thyrocare might print `HGB`. Dr Lal PathLabs might print `HAEMOGLOBIN`. SRL might print `Hb`. A private hospital might use `Hemoglobin` (American spelling). If the database stores raw lab names as-is, it is impossible to plot a trend line for "haemoglobin over time" because the data looks like four completely different things.

### How it works

The `canonical_biomarkers` table defines the official name for every biomarker (e.g. `Haemoglobin`) plus an `aliases` array containing every known alternate spelling from Indian labs. When the AI extracts a value from a report, it maps the raw lab string to the canonical name before storing it. The raw string is also preserved in `biomarkers.raw_name` for audit purposes.

The `biomarkers` table enforces this via a foreign key: `canonical_name` must exist in `canonical_biomarkers.canonical_name`. It is not possible to store an unrecognised biomarker name.

### Why this is critical for trend analysis

Every biomarker trend chart, dashboard card, and health insight is built on top of `canonical_name` queries. Without canonical names, trend analysis across reports from different labs would be impossible. The canonical system is what makes "your haemoglobin has been trending down over 6 months" technically possible — even if those 6 reports came from 4 different labs.

---

## 6. Computed Layer

### The `biomarker_summaries` table

After every report is successfully processed, the system calls `refresh_biomarker_summaries(family_member_id)`. This function scans all raw `biomarkers` rows for that person and writes one summary row per unique `canonical_name` — capturing the latest value, the previous value, and the calculated trend.

The function uses SQL window functions to process all history in a single pass. Specifically it:

1. Finds the most recent and second-most-recent value for each biomarker using `first_value()` and `nth_value()`.
2. Calculates `trend` by comparing the status of the latest and previous readings (normal vs. abnormal).
3. Calculates `trend_percentage` as the percentage change between the two most recent values.
4. Counts `consecutive_abnormal` — how many consecutive tests have been out of range.
5. Uses `INSERT ... ON CONFLICT DO UPDATE` (upsert) — if a summary row already exists for that person + biomarker, it is updated in place rather than a duplicate being created.

### Why the mobile app reads this instead of raw biomarkers

When the dashboard opens, the app executes one query: `SELECT * FROM biomarker_summaries WHERE family_member_id = X`. This returns ~20 rows with everything pre-calculated. The app does not need to sort, aggregate, or calculate anything — the database has already done that work. The raw `biomarkers` table is only queried when the user explicitly views a full trend chart for one specific biomarker.

---

## 7. Phase 2 Tables

These tables are fully defined and exist in the database today. They have RLS enabled and indexes in place. They are simply unpopulated — no data flows into them yet.

### `health_scores`

Will store one composite health score per family member per week, broken down into four components:

- **Biomarker score** — based on how many biomarkers are in or out of range and for how long.
- **Medication adherence score** — calculated from the `medication_adherence_log`.
- **Visit regularity score** — based on how frequently the person sees a doctor relative to their conditions.
- **Overall score** — a weighted composite of the above, on a 0–100 scale.

The `version` column is built-in from day one so that when the scoring algorithm is improved, old scores remain tagged to the version that produced them — enabling fair before/after comparisons.

`score_breakdown` is stored as JSONB (flexible JSON), allowing the scoring algorithm to store any granular detail without requiring a schema change.

### `wearable_daily_summaries`

Will store daily aggregated health data from wearable devices and health platforms — one row per person per day per source. Planned sources include Apple Health, Google Fit, Ultrahuman, and Noise.

Critically, only **daily aggregates** are stored — not raw second-by-second readings. This keeps storage costs under control while still enabling trend analysis. The `raw_summary` JSONB column stores any source-specific fields that don't fit the standard columns, providing flexibility across different device manufacturers without requiring schema changes.

The `UNIQUE(family_member_id, summary_date, source)` constraint prevents duplicate imports.

---

## 8. Indexes

| Index | Table | Columns | Query it optimises |
|---|---|---|---|
| `family_members_owner_idx` | `family_members` | `(owner_id)` WHERE not deleted | Load all family members for an account |
| `reports_family_member_idx` | `reports` | `(family_member_id, report_date DESC)` WHERE not deleted | Load a person's report history, newest first |
| `reports_status_idx` | `reports` | `(extraction_status)` WHERE pending/processing | Background job polling for reports that need extraction |
| `biomarkers_timeline_idx` | `biomarkers` | `(family_member_id, canonical_name, report_date DESC)` | Plot a trend chart for one biomarker over time |
| `biomarkers_report_idx` | `biomarkers` | `(report_id)` | Fetch all values extracted from a single report |
| `biomarkers_abnormal_idx` | `biomarkers` | `(family_member_id, status)` WHERE not normal | Fetch all out-of-range values for a person |
| `biomarker_summaries_member_idx` | `biomarker_summaries` | `(family_member_id)` | Load dashboard — all latest biomarker states for one person |
| `visits_family_member_idx` | `doctor_visits` | `(family_member_id, visit_date DESC)` WHERE not deleted | Load visit history for a person |
| `medications_active_idx` | `medications` | `(family_member_id, is_active)` WHERE not deleted, active | Load today's active medications for a person |
| `adherence_medication_date_idx` | `medication_adherence_log` | `(medication_id, scheduled_time DESC)` | Calculate adherence rate for a specific medication |
| `adherence_member_date_idx` | `medication_adherence_log` | `(family_member_id, scheduled_time DESC)` | Calculate overall adherence across all medications |
| `health_scores_member_idx` | `health_scores` | `(family_member_id, score_date DESC)` | Load health score history for a person |
| `wearable_member_date_idx` | `wearable_daily_summaries` | `(family_member_id, summary_date DESC)` | Load wearable data history for a person |

**Why indexes matter:** Without an index, a query like "show me all biomarkers for this person" would scan every row in the `biomarkers` table. With an index, the database jumps directly to the relevant rows. As the table grows to millions of rows across all users, the difference between a query taking 5ms and 5 seconds comes down to whether the right index exists.

---

## 9. Soft Deletes

Several tables — `family_members`, `reports`, `doctor_visits`, `medications` — have a `deleted_at timestamptz` column instead of using actual SQL `DELETE` statements.

### How it works

When a user deletes a record, the app sets `deleted_at = now()` rather than removing the row. All indexes on these tables are filtered with `WHERE deleted_at IS NULL`, so deleted rows are invisible to normal queries — they don't affect performance and don't show up in results.

### Why not just delete?

1. **Audit trail.** If a user accidentally deletes a year of medical records, the data can be recovered. Medical history is not something you want to make permanently unrecoverable.
2. **Cascade safety.** A deleted report still has real biomarker rows linked to it. Using soft deletes avoids cascade-deleting historical data that might be referenced elsewhere.
3. **Undo functionality.** A future "recently deleted" feature becomes trivial — it's just querying rows where `deleted_at IS NOT NULL` within the last 30 days.

The `biomarkers` and `medication_adherence_log` tables do **not** have `deleted_at` — they are append-only raw logs and should never be deleted, only hidden by soft-deleting the parent record.
