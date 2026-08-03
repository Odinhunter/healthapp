// ============================================================
// DATABASE TYPES
// Generated from databaseSchema.sql — matches every column exactly.
// Row     = what you get back from a SELECT
// Insert  = what you send for an INSERT (computed fields optional)
// Update  = all fields optional (for PATCH-style updates)
// ============================================================

// ------------------------------------------------------------
// canonical_biomarkers — reference data, read-only
// ------------------------------------------------------------
export interface CanonicalBiomarkerRow {
  id: string;
  canonical_name: string;
  category: string;
  unit_standard: string;
  aliases: string[];
  reference_min_male: number | null;
  reference_max_male: number | null;
  reference_min_female: number | null;
  reference_max_female: number | null;
  reference_min_child: number | null;
  reference_max_child: number | null;
  description: string | null;
  low_meaning: string | null;
  high_meaning: string | null;
  critical_low: number | null;
  critical_high: number | null;
  is_active: boolean;
  created_at: string;
}

// ------------------------------------------------------------
// profiles
// ------------------------------------------------------------
export interface ProfileRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  subscription_tier: 'free' | 'pro';
  subscription_expires_at: string | null;
  onboarding_complete: boolean;
  onboarding_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  id: string; // must match auth.users.id
  full_name: string;
  phone?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  subscription_tier?: 'free' | 'pro';
  subscription_expires_at?: string | null;
  onboarding_complete?: boolean;
  onboarding_data?: Record<string, unknown>;
}

export type ProfileUpdate = Partial<Omit<ProfileInsert, 'id'>>;

// ------------------------------------------------------------
// family_members
// ------------------------------------------------------------
export interface FamilyMemberRow {
  id: string;
  owner_id: string;
  full_name: string;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'other' | null;
  relationship: 'self' | 'parent' | 'spouse' | 'child' | 'sibling' | 'grandparent' | 'other';
  blood_group: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | null;
  is_primary: boolean;
  avatar_color: string | null;
  known_conditions: string[];
  known_allergies: string[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface FamilyMemberInsert {
  owner_id: string;
  full_name: string;
  relationship: FamilyMemberRow['relationship'];
  date_of_birth?: string | null;
  gender?: FamilyMemberRow['gender'];
  blood_group?: FamilyMemberRow['blood_group'];
  is_primary?: boolean;
  avatar_color?: string | null;
  known_conditions?: string[];
  known_allergies?: string[];
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  notes?: string | null;
}

export type FamilyMemberUpdate = Partial<Omit<FamilyMemberInsert, 'owner_id'>>;

// ------------------------------------------------------------
// reports
// ------------------------------------------------------------
export interface ReportRow {
  id: string;
  owner_id: string;
  family_member_id: string;
  lab_name: string | null;
  report_date: string;
  file_path: string;
  file_type: 'pdf' | 'image';
  extraction_status: 'pending' | 'processing' | 'complete' | 'failed';
  extraction_error: string | null;
  extraction_model: string | null;
  biomarker_count: number;
  visit_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ReportInsert {
  owner_id: string;
  family_member_id: string;
  report_date: string;
  file_path: string;
  file_type: 'pdf' | 'image';
  lab_name?: string | null;
  extraction_status?: ReportRow['extraction_status'];
  extraction_error?: string | null;
  extraction_model?: string | null;
  biomarker_count?: number;
  visit_id?: string | null;
  notes?: string | null;
}

export type ReportUpdate = Partial<Omit<ReportInsert, 'owner_id' | 'family_member_id'>>;

// ------------------------------------------------------------
// biomarkers — raw layer, append-only
// ------------------------------------------------------------
export interface BiomarkerRow {
  id: string;
  owner_id: string;
  report_id: string;
  family_member_id: string;
  canonical_name: string;
  raw_name: string;
  value: number;
  unit: string;
  reference_min: number | null;
  reference_max: number | null;
  status: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';
  report_date: string;
  created_at: string;
}

export interface BiomarkerInsert {
  owner_id: string;
  report_id: string;
  family_member_id: string;
  canonical_name: string;
  raw_name: string;
  value: number;
  unit: string;
  status: BiomarkerRow['status'];
  report_date: string;
  reference_min?: number | null;
  reference_max?: number | null;
}

// ------------------------------------------------------------
// biomarker_summaries — computed layer, managed by DB function
// ------------------------------------------------------------
export interface BiomarkerSummaryRow {
  id: string;
  owner_id: string;
  family_member_id: string;
  canonical_name: string;
  latest_value: number;
  latest_unit: string;
  latest_status: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';
  latest_report_date: string;
  previous_value: number | null;
  previous_report_date: string | null;
  trend: 'improving' | 'worsening' | 'stable' | 'new' | null;
  trend_percentage: number | null;
  consecutive_abnormal: number;
  updated_at: string;
}

// ------------------------------------------------------------
// doctor_visits
// ------------------------------------------------------------
export interface DoctorVisitRow {
  id: string;
  owner_id: string;
  family_member_id: string;
  doctor_name: string;
  specialty: string | null;
  clinic_hospital: string | null;
  visit_date: string;
  reason: string | null;
  notes: string | null;
  diagnosis: string[];
  followup_date: string | null;
  followup_notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DoctorVisitInsert {
  owner_id: string;
  family_member_id: string;
  doctor_name: string;
  visit_date: string;
  specialty?: string | null;
  clinic_hospital?: string | null;
  reason?: string | null;
  notes?: string | null;
  diagnosis?: string[];
  followup_date?: string | null;
  followup_notes?: string | null;
}

export type DoctorVisitUpdate = Partial<Omit<DoctorVisitInsert, 'owner_id' | 'family_member_id'>>;

// ------------------------------------------------------------
// medications
// ------------------------------------------------------------
export interface MedicationRow {
  id: string;
  owner_id: string;
  family_member_id: string;
  visit_id: string | null;
  name: string;
  generic_name: string | null;
  dosage: string | null;
  dosage_unit: string | null;
  frequency: string;
  times_per_day: number | null;
  reminder_times: string[];
  with_food: boolean;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  prescribed_by: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MedicationInsert {
  owner_id: string;
  family_member_id: string;
  name: string;
  frequency: string;
  start_date: string;
  visit_id?: string | null;
  generic_name?: string | null;
  dosage?: string | null;
  dosage_unit?: string | null;
  times_per_day?: number | null;
  reminder_times?: string[];
  with_food?: boolean;
  end_date?: string | null;
  is_active?: boolean;
  prescribed_by?: string | null;
  reason?: string | null;
  notes?: string | null;
}

export type MedicationUpdate = Partial<Omit<MedicationInsert, 'owner_id' | 'family_member_id'>>;

// ------------------------------------------------------------
// medication_adherence_log — raw layer, append-only
// ------------------------------------------------------------
export interface MedicationAdherenceLogRow {
  id: string;
  owner_id: string;
  medication_id: string;
  family_member_id: string;
  scheduled_time: string;
  actioned_time: string | null;
  outcome: 'taken' | 'skipped' | 'missed' | 'snoozed';
  snooze_count: number;
  created_at: string;
}

export interface MedicationAdherenceLogInsert {
  owner_id: string;
  medication_id: string;
  family_member_id: string;
  scheduled_time: string;
  outcome: MedicationAdherenceLogRow['outcome'];
  actioned_time?: string | null;
  snooze_count?: number;
}

// ------------------------------------------------------------
// health_scores — phase 2, currently unpopulated
// ------------------------------------------------------------
export interface HealthScoreRow {
  id: string;
  owner_id: string;
  family_member_id: string;
  score_date: string;
  overall_score: number | null;
  biomarker_score: number | null;
  medication_adherence_score: number | null;
  visit_regularity_score: number | null;
  score_breakdown: Record<string, unknown>;
  version: number;
  created_at: string;
}

export interface HealthScoreInsert {
  owner_id: string;
  family_member_id: string;
  score_date: string;
  overall_score?: number | null;
  biomarker_score?: number | null;
  medication_adherence_score?: number | null;
  visit_regularity_score?: number | null;
  score_breakdown?: Record<string, unknown>;
  version?: number;
}

// ------------------------------------------------------------
// wearable_daily_summaries — phase 2, currently unpopulated
// ------------------------------------------------------------
export interface WearableDailySummaryRow {
  id: string;
  owner_id: string;
  family_member_id: string;
  summary_date: string;
  source: string | null;
  resting_heart_rate_avg: number | null;
  resting_heart_rate_min: number | null;
  resting_heart_rate_max: number | null;
  steps: number | null;
  active_minutes: number | null;
  sleep_duration_minutes: number | null;
  sleep_quality_score: number | null;
  spo2_avg: number | null;
  stress_score: number | null;
  raw_summary: Record<string, unknown>;
  created_at: string;
}

export interface WearableDailySummaryInsert {
  owner_id: string;
  family_member_id: string;
  summary_date: string;
  source?: string | null;
  resting_heart_rate_avg?: number | null;
  resting_heart_rate_min?: number | null;
  resting_heart_rate_max?: number | null;
  steps?: number | null;
  active_minutes?: number | null;
  sleep_duration_minutes?: number | null;
  sleep_quality_score?: number | null;
  spo2_avg?: number | null;
  stress_score?: number | null;
  raw_summary?: Record<string, unknown>;
}

// ============================================================
// Database — top-level type for createClient<Database>
// ============================================================
// Supabase JS v2 requires Row/Insert/Update to extend Record<string, unknown>.
// Interfaces don't satisfy this constraint in TS strict mode, so we intersect.
type R = Record<string, unknown>;

export interface Database {
  public: {
    Tables: {
      canonical_biomarkers: {
        Row: CanonicalBiomarkerRow & R;
        Insert: CanonicalBiomarkerRow & R; // admin-managed
        Update: Partial<CanonicalBiomarkerRow> & R;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow & R;
        Insert: ProfileInsert & R;
        Update: ProfileUpdate & R;
        Relationships: [];
      };
      family_members: {
        Row: FamilyMemberRow & R;
        Insert: FamilyMemberInsert & R;
        Update: FamilyMemberUpdate & R;
        Relationships: [];
      };
      reports: {
        Row: ReportRow & R;
        Insert: ReportInsert & R;
        Update: ReportUpdate & R;
        Relationships: [];
      };
      biomarkers: {
        Row: BiomarkerRow & R;
        Insert: BiomarkerInsert & R;
        Update: never; // append-only
        Relationships: [];
      };
      biomarker_summaries: {
        Row: BiomarkerSummaryRow & R;
        Insert: never; // managed by DB function
        Update: never;
        Relationships: [];
      };
      doctor_visits: {
        Row: DoctorVisitRow & R;
        Insert: DoctorVisitInsert & R;
        Update: DoctorVisitUpdate & R;
        Relationships: [];
      };
      medications: {
        Row: MedicationRow & R;
        Insert: MedicationInsert & R;
        Update: MedicationUpdate & R;
        Relationships: [];
      };
      medication_adherence_log: {
        Row: MedicationAdherenceLogRow & R;
        Insert: MedicationAdherenceLogInsert & R;
        Update: never; // append-only
        Relationships: [];
      };
      health_scores: {
        Row: HealthScoreRow & R;
        Insert: HealthScoreInsert & R;
        Update: Partial<HealthScoreInsert> & R;
        Relationships: [];
      };
      wearable_daily_summaries: {
        Row: WearableDailySummaryRow & R;
        Insert: WearableDailySummaryInsert & R;
        Update: Partial<WearableDailySummaryInsert> & R;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
