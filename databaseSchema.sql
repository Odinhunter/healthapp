-- ============================================================
-- HEALTHAPP DATABASE SCHEMA
-- Version: 1.0.0 (Phase 1)
-- Last updated: 2026
-- Region: ap-south-1 (Mumbai)
-- ============================================================
-- LAYER ARCHITECTURE:
-- Raw layer      → ground truth, append-only, never modified
-- Computed layer → what mobile reads, pre-processed, fast
-- Reference data → canonical biomarker names, read-only
-- Future-ready   → empty tables structured for phase 2
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";


-- ============================================================
-- REFERENCE DATA
-- Canonical biomarker names + known aliases across Indian labs.
-- Read-only for all users. Admin-managed only.
-- ============================================================
create table canonical_biomarkers (
  id uuid default uuid_generate_v4() primary key,
  canonical_name text not null unique,       -- e.g. 'Haemoglobin'
  category text not null,                    -- e.g. 'CBC', 'Lipid', 'Thyroid', 'Diabetes', 'Kidney', 'Liver'
  unit_standard text not null,               -- e.g. 'g/dL'
  aliases text[] default '{}',              -- ['Hb', 'HGB', 'Hemoglobin']
  reference_min_male numeric,
  reference_max_male numeric,
  reference_min_female numeric,
  reference_max_female numeric,
  reference_min_child numeric,
  reference_max_child numeric,
  description text,                          -- plain language explanation
  low_meaning text,                          -- what low means in plain English
  high_meaning text,                         -- what high means in plain English
  critical_low numeric,                      -- value that triggers critical alert
  critical_high numeric,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Seed with the most common Indian lab biomarkers
insert into canonical_biomarkers
  (canonical_name, category, unit_standard, aliases, reference_min_male, reference_max_male, reference_min_female, reference_max_female, description) values
  ('Haemoglobin',       'CBC',      'g/dL',   array['Hb','HGB','Hemoglobin','HAEMOGLOBIN'],              13.0, 17.0, 12.0, 15.0, 'Protein in red blood cells that carries oxygen'),
  ('WBC Count',         'CBC',      '10³/µL', array['WBC','Total WBC','Leucocytes','TLC'],                4.5,  11.0,  4.5, 11.0, 'White blood cells that fight infection'),
  ('Platelet Count',    'CBC',      '10³/µL', array['Platelets','PLT','Thrombocytes'],                  150.0, 400.0, 150.0, 400.0, 'Cells that help blood clot'),
  ('HbA1c',            'Diabetes', '%',       array['Glycated Haemoglobin','A1c','HbA1C','Hba1c'],       null,   5.7,  null,   5.7, 'Average blood sugar over 3 months'),
  ('Fasting Glucose',  'Diabetes', 'mg/dL',  array['FBS','Fasting Blood Sugar','FBG','Blood Glucose'],   70.0,  99.0,  70.0,  99.0, 'Blood sugar level after fasting'),
  ('Total Cholesterol','Lipid',    'mg/dL',  array['Cholesterol','TC','Serum Cholesterol'],              null, 200.0,  null, 200.0, 'Total cholesterol in blood'),
  ('LDL Cholesterol',  'Lipid',    'mg/dL',  array['LDL','LDL-C','Bad Cholesterol'],                    null, 100.0,  null, 100.0, 'Bad cholesterol linked to heart disease'),
  ('HDL Cholesterol',  'Lipid',    'mg/dL',  array['HDL','HDL-C','Good Cholesterol'],                   40.0,  null,  50.0,  null, 'Good cholesterol that protects the heart'),
  ('Triglycerides',    'Lipid',    'mg/dL',  array['TG','TRIG','Serum Triglycerides'],                  null, 150.0,  null, 150.0, 'Type of fat in the blood'),
  ('TSH',              'Thyroid',  'µIU/mL', array['Thyroid Stimulating Hormone','T.S.H'],               0.4,   4.0,   0.4,   4.0, 'Controls thyroid gland function'),
  ('T3',               'Thyroid',  'ng/dL',  array['Triiodothyronine','Total T3'],                      80.0, 200.0,  80.0, 200.0, 'Active thyroid hormone'),
  ('T4',               'Thyroid',  'µg/dL',  array['Thyroxine','Total T4','Serum T4'],                   5.1,  14.1,   5.1,  14.1, 'Main thyroid hormone'),
  ('Creatinine',       'Kidney',   'mg/dL',  array['Serum Creatinine','S. Creatinine','Creat'],          0.7,   1.2,   0.5,   1.1, 'Waste product filtered by kidneys'),
  ('eGFR',             'Kidney',   'mL/min', array['GFR','Estimated GFR','EGFR'],                       90.0,  null,  90.0,  null, 'Measure of kidney filtration ability'),
  ('Urea',             'Kidney',   'mg/dL',  array['Blood Urea','BUN','Serum Urea','Urea Nitrogen'],     15.0,  40.0,  15.0,  40.0, 'Waste product from protein breakdown'),
  ('SGPT',             'Liver',    'U/L',    array['ALT','Alanine Aminotransferase','ALAT'],              7.0,  56.0,   7.0,  56.0, 'Liver enzyme — elevated means liver stress'),
  ('SGOT',             'Liver',    'U/L',    array['AST','Aspartate Aminotransferase','ASAT'],           10.0,  40.0,  10.0,  40.0, 'Liver and heart enzyme'),
  ('Bilirubin Total',  'Liver',    'mg/dL',  array['Total Bilirubin','T. Bilirubin','Bili Total'],       null,   1.2,  null,   1.2, 'Pigment from red blood cell breakdown'),
  ('Vitamin D',        'Vitamins', 'ng/mL',  array['25-OH Vitamin D','Vit D','Vitamin D3','25(OH)D'],   30.0, 100.0,  30.0, 100.0, 'Essential for bones and immunity'),
  ('Vitamin B12',      'Vitamins', 'pg/mL',  array['Cobalamin','Vit B12','Cyanocobalamin'],             200.0, 900.0, 200.0, 900.0, 'Essential for nerves and blood cells'),
  ('Ferritin',         'Iron',     'ng/mL',  array['Serum Ferritin','S. Ferritin'],                     12.0, 300.0,  12.0, 150.0, 'Iron storage protein'),
  ('Iron',             'Iron',     'µg/dL',  array['Serum Iron','S. Iron','Fe'],                        60.0, 170.0,  60.0, 170.0, 'Mineral needed for haemoglobin'),
  ('Uric Acid',        'Kidney',   'mg/dL',  array['Serum Uric Acid','S. Uric Acid'],                   3.5,   7.2,   2.6,   6.0, 'Waste product — high levels cause gout');


-- ============================================================
-- PROFILES
-- One row per authenticated user (account holder).
-- ============================================================
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  phone text unique,
  email text unique,
  avatar_url text,
  subscription_tier text default 'free'
    check (subscription_tier in ('free', 'pro')),
  subscription_expires_at timestamptz,
  onboarding_complete boolean default false,
  onboarding_data jsonb default '{}',        -- answers captured during the onboarding flow
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- Auto-update updated_at on any change
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();


-- ============================================================
-- FAMILY MEMBERS
-- Everyone managed under one account.
-- Includes the account holder themselves (is_primary = true).
-- ============================================================
create table family_members (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references profiles(id) on delete cascade not null,
  full_name text not null,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other')),
  relationship text not null
    check (relationship in ('self', 'parent', 'spouse', 'child', 'sibling', 'grandparent', 'other')),
  blood_group text
    check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  is_primary boolean default false,
  avatar_color text,                          -- UI color for this profile's avatar
  known_conditions text[] default '{}',       -- ['Type 2 Diabetes', 'Hypertension']
  known_allergies text[] default '{}',
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

alter table family_members enable row level security;

create policy "Users can manage own family members"
  on family_members for all
  using (auth.uid() = owner_id);

create index family_members_owner_idx on family_members(owner_id)
  where deleted_at is null;

create trigger family_members_updated_at
  before update on family_members
  for each row execute function update_updated_at();


-- ============================================================
-- REPORTS
-- One row per uploaded blood report.
-- The actual file lives in Supabase Storage.
-- Processing is async — status tracks the extraction pipeline.
-- ============================================================
create table reports (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references profiles(id) on delete cascade not null,
  family_member_id uuid references family_members(id) on delete cascade not null,
  lab_name text,
  report_date date not null,
  file_path text not null,                    -- path in Supabase Storage bucket
  file_type text not null
    check (file_type in ('pdf', 'image')),
  extraction_status text default 'pending'
    check (extraction_status in ('pending', 'processing', 'complete', 'failed')),
  extraction_error text,                      -- error message if failed
  extraction_model text,                      -- which AI model did the extraction
  biomarker_count integer default 0,          -- how many biomarkers were extracted
  visit_id uuid,                              -- linked doctor visit (FK added below)
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

alter table reports enable row level security;

create policy "Users can manage own reports"
  on reports for all
  using (auth.uid() = owner_id);

create index reports_family_member_idx
  on reports(family_member_id, report_date desc)
  where deleted_at is null;

create index reports_status_idx
  on reports(extraction_status)
  where extraction_status in ('pending', 'processing');

create trigger reports_updated_at
  before update on reports
  for each row execute function update_updated_at();

-- Realtime: enable full payload on UPDATE events + add to publication
alter table reports replica identity full;
alter publication supabase_realtime add table reports;


-- ============================================================
-- BIOMARKERS (RAW LAYER)
-- Every individual value extracted from every report.
-- Canonical names enforced — no raw lab strings stored here.
-- ============================================================
create table biomarkers (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references profiles(id) on delete cascade not null,
  report_id uuid references reports(id) on delete cascade not null,
  family_member_id uuid references family_members(id) on delete cascade not null,
  canonical_name text not null
    references canonical_biomarkers(canonical_name),
  raw_name text not null,                     -- what the lab actually printed
  value numeric not null,
  unit text not null,
  reference_min numeric,
  reference_max numeric,
  status text not null
    check (status in ('normal', 'low', 'high', 'critical_low', 'critical_high')),
  report_date date not null,                  -- denormalised for fast range queries
  created_at timestamptz default now()
);

alter table biomarkers enable row level security;

create policy "Users can manage own biomarkers"
  on biomarkers for all
  using (auth.uid() = owner_id);

-- Primary query index: timeline for a specific biomarker
create index biomarkers_timeline_idx
  on biomarkers(family_member_id, canonical_name, report_date desc);

-- Query index: all biomarkers from a single report
create index biomarkers_report_idx
  on biomarkers(report_id);

-- Query index: all abnormal values for a family member
create index biomarkers_abnormal_idx
  on biomarkers(family_member_id, status)
  where status != 'normal';


-- ============================================================
-- BIOMARKER SUMMARIES (COMPUTED LAYER)
-- Pre-computed latest state per biomarker per family member.
-- This is what the mobile app reads for dashboard views.
-- Updated automatically after every report extraction.
-- ============================================================
create table biomarker_summaries (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references profiles(id) on delete cascade not null,
  family_member_id uuid references family_members(id) on delete cascade not null,
  canonical_name text not null
    references canonical_biomarkers(canonical_name),
  latest_value numeric not null,
  latest_unit text not null,
  latest_status text not null,
  latest_report_date date not null,
  previous_value numeric,
  previous_report_date date,
  trend text check (trend in ('improving', 'worsening', 'stable', 'new')),
  trend_percentage numeric,                   -- % change from previous
  consecutive_abnormal integer default 0,     -- how many tests in a row abnormal
  updated_at timestamptz default now(),
  unique(family_member_id, canonical_name)    -- one row per biomarker per person
);

alter table biomarker_summaries enable row level security;

create policy "Users can manage own biomarker summaries"
  on biomarker_summaries for all
  using (auth.uid() = owner_id);

-- The primary read index for dashboard loading
create index biomarker_summaries_member_idx
  on biomarker_summaries(family_member_id);

-- Function to refresh summaries after new report is processed
create or replace function refresh_biomarker_summaries(p_family_member_id uuid)
returns void as $$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id
    from family_members where id = p_family_member_id;

  insert into biomarker_summaries (
    owner_id, family_member_id, canonical_name,
    latest_value, latest_unit, latest_status, latest_report_date,
    previous_value, previous_report_date,
    trend, trend_percentage, consecutive_abnormal
  )
  select
    v_owner_id,
    p_family_member_id,
    canonical_name,
    first_value(value) over w           as latest_value,
    first_value(unit) over w            as latest_unit,
    first_value(status) over w          as latest_status,
    first_value(report_date) over w     as latest_report_date,
    nth_value(value, 2) over w          as previous_value,
    nth_value(report_date, 2) over w    as previous_report_date,
    case
      when nth_value(value, 2) over w is null then 'new'
      when first_value(status) over w = 'normal'
       and nth_value(status, 2) over w != 'normal' then 'improving'
      when first_value(status) over w != 'normal'
       and nth_value(status, 2) over w = 'normal' then 'worsening'
      else 'stable'
    end as trend,
    case when nth_value(value, 2) over w > 0 then
      round(((first_value(value) over w - nth_value(value, 2) over w)
        / nth_value(value, 2) over w * 100)::numeric, 1)
    end as trend_percentage,
    count(*) filter (where status != 'normal') over (
      partition by canonical_name
      order by report_date desc
      rows between unbounded preceding and current row
    ) as consecutive_abnormal
  from biomarkers
  where family_member_id = p_family_member_id
  window w as (
    partition by canonical_name
    order by report_date desc
    rows between unbounded preceding and unbounded following
  )
  on conflict (family_member_id, canonical_name)
  do update set
    latest_value          = excluded.latest_value,
    latest_unit           = excluded.latest_unit,
    latest_status         = excluded.latest_status,
    latest_report_date    = excluded.latest_report_date,
    previous_value        = excluded.previous_value,
    previous_report_date  = excluded.previous_report_date,
    trend                 = excluded.trend,
    trend_percentage      = excluded.trend_percentage,
    consecutive_abnormal  = excluded.consecutive_abnormal,
    updated_at            = now();
end;
$$ language plpgsql security definer;


-- ============================================================
-- DOCTOR VISITS
-- Every consultation logged, per family member.
-- ============================================================
create table doctor_visits (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references profiles(id) on delete cascade not null,
  family_member_id uuid references family_members(id) on delete cascade not null,
  doctor_name text not null,
  specialty text,
  clinic_hospital text,
  visit_date date not null,
  reason text,
  notes text,
  diagnosis text[] default '{}',              -- diagnoses made at this visit
  followup_date date,
  followup_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

alter table doctor_visits enable row level security;

create policy "Users can manage own visits"
  on doctor_visits for all
  using (auth.uid() = owner_id);

create index visits_family_member_idx
  on doctor_visits(family_member_id, visit_date desc)
  where deleted_at is null;

-- Now add the FK from reports to visits (both tables exist now)
alter table reports
  add constraint reports_visit_fk
  foreign key (visit_id)
  references doctor_visits(id)
  on delete set null;

create trigger visits_updated_at
  before update on doctor_visits
  for each row execute function update_updated_at();


-- ============================================================
-- MEDICATIONS
-- Prescriptions linked to a family member and optionally a visit.
-- ============================================================
create table medications (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references profiles(id) on delete cascade not null,
  family_member_id uuid references family_members(id) on delete cascade not null,
  visit_id uuid references doctor_visits(id) on delete set null,
  name text not null,
  generic_name text,                          -- generic drug name
  dosage text,                                -- e.g. '500mg'
  dosage_unit text,                           -- e.g. 'mg', 'ml'
  frequency text not null,                    -- e.g. 'twice daily', 'once at night'
  times_per_day integer,                      -- numeric for scheduling logic
  reminder_times time[] default '{}',         -- e.g. [08:00, 20:00]
  with_food boolean default false,
  start_date date not null,
  end_date date,                              -- null = ongoing
  is_active boolean default true,
  prescribed_by text,                         -- doctor name
  reason text,                                -- why prescribed
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

alter table medications enable row level security;

create policy "Users can manage own medications"
  on medications for all
  using (auth.uid() = owner_id);

create index medications_active_idx
  on medications(family_member_id, is_active)
  where deleted_at is null and is_active = true;

create trigger medications_updated_at
  before update on medications
  for each row execute function update_updated_at();


-- ============================================================
-- MEDICATION ADHERENCE LOG (RAW LAYER)
-- Append-only. One row per reminder event.
-- Never updated — only inserted.
-- ============================================================
create table medication_adherence_log (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references profiles(id) on delete cascade not null,
  medication_id uuid references medications(id) on delete cascade not null,
  family_member_id uuid references family_members(id) on delete cascade not null,
  scheduled_time timestamptz not null,        -- when the reminder was due
  actioned_time timestamptz,                  -- when user responded
  outcome text not null
    check (outcome in ('taken', 'skipped', 'missed', 'snoozed')),
  snooze_count integer default 0,
  created_at timestamptz default now()
);

alter table medication_adherence_log enable row level security;

create policy "Users can manage own adherence log"
  on medication_adherence_log for all
  using (auth.uid() = owner_id);

-- Optimised for adherence rate queries by date range
create index adherence_medication_date_idx
  on medication_adherence_log(medication_id, scheduled_time desc);

create index adherence_member_date_idx
  on medication_adherence_log(family_member_id, scheduled_time desc);


-- ============================================================
-- HEALTH SCORES (FUTURE-READY — PHASE 2)
-- Table exists now. Populated in phase 2.
-- One row per family member per week.
-- ============================================================
create table health_scores (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references profiles(id) on delete cascade not null,
  family_member_id uuid references family_members(id) on delete cascade not null,
  score_date date not null,
  overall_score numeric(5,2),                 -- 0-100
  biomarker_score numeric(5,2),
  medication_adherence_score numeric(5,2),
  visit_regularity_score numeric(5,2),
  score_breakdown jsonb default '{}',         -- detailed component breakdown
  version integer default 1,                  -- scoring algorithm version
  created_at timestamptz default now(),
  unique(family_member_id, score_date, version)
);

alter table health_scores enable row level security;

create policy "Users can manage own health scores"
  on health_scores for all
  using (auth.uid() = owner_id);

create index health_scores_member_idx
  on health_scores(family_member_id, score_date desc);


-- ============================================================
-- WEARABLE DAILY SUMMARIES (FUTURE-READY — PHASE 2)
-- Daily aggregates only. Never raw readings.
-- Structured for time-based partitioning when volume grows.
-- ============================================================
create table wearable_daily_summaries (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references profiles(id) on delete cascade not null,
  family_member_id uuid references family_members(id) on delete cascade not null,
  summary_date date not null,
  source text,                                -- 'apple_health', 'google_fit', 'ultrahuman', 'noise'
  resting_heart_rate_avg numeric,
  resting_heart_rate_min numeric,
  resting_heart_rate_max numeric,
  steps integer,
  active_minutes integer,
  sleep_duration_minutes integer,
  sleep_quality_score numeric,
  spo2_avg numeric,
  stress_score numeric,
  raw_summary jsonb default '{}',             -- source-specific extras, flexible
  created_at timestamptz default now(),
  unique(family_member_id, summary_date, source)
);

alter table wearable_daily_summaries enable row level security;

create policy "Users can manage own wearable data"
  on wearable_daily_summaries for all
  using (auth.uid() = owner_id);

create index wearable_member_date_idx
  on wearable_daily_summaries(family_member_id, summary_date desc);


-- ============================================================
-- STORAGE BUCKET
-- Private bucket — no public URLs ever.
-- Folder structure: /{owner_id}/{family_member_id}/{report_id}
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('reports', 'reports', false);

create policy "Users can manage own report files"
  on storage.objects for all
  using (
    bucket_id = 'reports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ============================================================
-- AUTOMATIC PROFILE CREATION ON SIGNUP
-- When a user signs up, create their profile row automatically.
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
