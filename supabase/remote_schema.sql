


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_biomarker_summaries"("p_family_member_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT owner_id INTO v_owner_id
    FROM family_members WHERE id = p_family_member_id;

  INSERT INTO biomarker_summaries (
    owner_id, family_member_id, canonical_name,
    latest_value, latest_unit, latest_status, latest_report_date,
    previous_value, previous_report_date,
    trend, trend_percentage, consecutive_abnormal
  )
  SELECT
    v_owner_id,
    p_family_member_id,
    canonical_name,
    latest_value, latest_unit, latest_status, latest_report_date,
    previous_value, previous_report_date,
    trend, trend_percentage, consecutive_abnormal
  FROM (
    SELECT
      canonical_name,
      first_value(value) OVER w           AS latest_value,
      first_value(unit) OVER w            AS latest_unit,
      first_value(status) OVER w          AS latest_status,
      first_value(report_date) OVER w     AS latest_report_date,
      nth_value(value, 2) OVER w          AS previous_value,
      nth_value(report_date, 2) OVER w    AS previous_report_date,
      CASE
        WHEN nth_value(value, 2) OVER w IS NULL THEN 'new'
        WHEN first_value(status) OVER w = 'normal'
         AND nth_value(status, 2) OVER w != 'normal' THEN 'improving'
        WHEN first_value(status) OVER w != 'normal'
         AND nth_value(status, 2) OVER w = 'normal' THEN 'worsening'
        ELSE 'stable'
      END AS trend,
      CASE WHEN nth_value(value, 2) OVER w > 0 THEN
        ROUND(((first_value(value) OVER w - nth_value(value, 2) OVER w)
          / nth_value(value, 2) OVER w * 100)::numeric, 1)
      END AS trend_percentage,
      COUNT(*) FILTER (WHERE status != 'normal') OVER (
        PARTITION BY canonical_name
        ORDER BY report_date DESC, id DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS consecutive_abnormal,
      ROW_NUMBER() OVER (PARTITION BY canonical_name ORDER BY report_date DESC, id DESC) AS rn
    FROM biomarkers
    WHERE family_member_id = p_family_member_id
    WINDOW w AS (
      PARTITION BY canonical_name
      ORDER BY report_date DESC, id DESC
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    )
  ) sub
  WHERE rn = 1
  ON CONFLICT (family_member_id, canonical_name)
  DO UPDATE SET
    latest_value          = EXCLUDED.latest_value,
    latest_unit           = EXCLUDED.latest_unit,
    latest_status         = EXCLUDED.latest_status,
    latest_report_date    = EXCLUDED.latest_report_date,
    previous_value        = EXCLUDED.previous_value,
    previous_report_date  = EXCLUDED.previous_report_date,
    trend                 = EXCLUDED.trend,
    trend_percentage      = EXCLUDED.trend_percentage,
    consecutive_abnormal  = EXCLUDED.consecutive_abnormal,
    updated_at            = now();
END;
$$;


ALTER FUNCTION "public"."refresh_biomarker_summaries"("p_family_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."biomarker_summaries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "family_member_id" "uuid" NOT NULL,
    "canonical_name" "text" NOT NULL,
    "latest_value" numeric NOT NULL,
    "latest_unit" "text" NOT NULL,
    "latest_status" "text" NOT NULL,
    "latest_report_date" "date" NOT NULL,
    "previous_value" numeric,
    "previous_report_date" "date",
    "trend" "text",
    "trend_percentage" numeric,
    "consecutive_abnormal" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "biomarker_summaries_trend_check" CHECK (("trend" = ANY (ARRAY['improving'::"text", 'worsening'::"text", 'stable'::"text", 'new'::"text"])))
);


ALTER TABLE "public"."biomarker_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."biomarkers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "report_id" "uuid" NOT NULL,
    "family_member_id" "uuid" NOT NULL,
    "canonical_name" "text" NOT NULL,
    "raw_name" "text" NOT NULL,
    "value" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "reference_min" numeric,
    "reference_max" numeric,
    "status" "text" NOT NULL,
    "report_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "biomarkers_status_check" CHECK (("status" = ANY (ARRAY['normal'::"text", 'low'::"text", 'high'::"text", 'critical_low'::"text", 'critical_high'::"text"])))
);


ALTER TABLE "public"."biomarkers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."canonical_biomarkers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "canonical_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "unit_standard" "text" NOT NULL,
    "aliases" "text"[] DEFAULT '{}'::"text"[],
    "reference_min_male" numeric,
    "reference_max_male" numeric,
    "reference_min_female" numeric,
    "reference_max_female" numeric,
    "reference_min_child" numeric,
    "reference_max_child" numeric,
    "description" "text",
    "low_meaning" "text",
    "high_meaning" "text",
    "critical_low" numeric,
    "critical_high" numeric,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "alt_units" "text"
);


ALTER TABLE "public"."canonical_biomarkers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doctor_visits" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "family_member_id" "uuid" NOT NULL,
    "doctor_name" "text" NOT NULL,
    "specialty" "text",
    "clinic_hospital" "text",
    "visit_date" "date" NOT NULL,
    "reason" "text",
    "notes" "text",
    "diagnosis" "text"[] DEFAULT '{}'::"text"[],
    "followup_date" "date",
    "followup_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."doctor_visits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "date_of_birth" "date",
    "gender" "text",
    "relationship" "text" NOT NULL,
    "blood_group" "text",
    "is_primary" boolean DEFAULT false,
    "avatar_color" "text",
    "known_conditions" "text"[] DEFAULT '{}'::"text"[],
    "known_allergies" "text"[] DEFAULT '{}'::"text"[],
    "emergency_contact_name" "text",
    "emergency_contact_phone" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "family_members_blood_group_check" CHECK (("blood_group" = ANY (ARRAY['A+'::"text", 'A-'::"text", 'B+'::"text", 'B-'::"text", 'AB+'::"text", 'AB-'::"text", 'O+'::"text", 'O-'::"text"]))),
    CONSTRAINT "family_members_gender_check" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text", 'other'::"text"]))),
    CONSTRAINT "family_members_relationship_check" CHECK (("relationship" = ANY (ARRAY['self'::"text", 'parent'::"text", 'spouse'::"text", 'child'::"text", 'sibling'::"text", 'grandparent'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."family_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."health_scores" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "family_member_id" "uuid" NOT NULL,
    "score_date" "date" NOT NULL,
    "overall_score" numeric(5,2),
    "biomarker_score" numeric(5,2),
    "medication_adherence_score" numeric(5,2),
    "visit_regularity_score" numeric(5,2),
    "score_breakdown" "jsonb" DEFAULT '{}'::"jsonb",
    "version" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."health_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medication_adherence_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "medication_id" "uuid" NOT NULL,
    "family_member_id" "uuid" NOT NULL,
    "scheduled_time" timestamp with time zone NOT NULL,
    "actioned_time" timestamp with time zone,
    "outcome" "text" NOT NULL,
    "snooze_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "medication_adherence_log_outcome_check" CHECK (("outcome" = ANY (ARRAY['taken'::"text", 'skipped'::"text", 'missed'::"text", 'snoozed'::"text"])))
);


ALTER TABLE "public"."medication_adherence_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "family_member_id" "uuid" NOT NULL,
    "visit_id" "uuid",
    "name" "text" NOT NULL,
    "generic_name" "text",
    "dosage" "text",
    "dosage_unit" "text",
    "frequency" "text" NOT NULL,
    "times_per_day" integer,
    "reminder_times" time without time zone[] DEFAULT '{}'::time without time zone[],
    "with_food" boolean DEFAULT false,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "is_active" boolean DEFAULT true,
    "prescribed_by" "text",
    "reason" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."medications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "avatar_url" "text",
    "subscription_tier" "text" DEFAULT 'free'::"text",
    "subscription_expires_at" timestamp with time zone,
    "onboarding_complete" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "onboarding_data" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "profiles_subscription_tier_check" CHECK (("subscription_tier" = ANY (ARRAY['free'::"text", 'pro'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "family_member_id" "uuid" NOT NULL,
    "lab_name" "text",
    "report_date" "date" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "extraction_status" "text" DEFAULT 'pending'::"text",
    "extraction_error" "text",
    "extraction_model" "text",
    "biomarker_count" integer DEFAULT 0,
    "visit_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "reports_extraction_status_check" CHECK (("extraction_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'complete'::"text", 'failed'::"text"]))),
    CONSTRAINT "reports_file_type_check" CHECK (("file_type" = ANY (ARRAY['pdf'::"text", 'image'::"text"])))
);

ALTER TABLE ONLY "public"."reports" REPLICA IDENTITY FULL;


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wearable_daily_summaries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "family_member_id" "uuid" NOT NULL,
    "summary_date" "date" NOT NULL,
    "source" "text",
    "resting_heart_rate_avg" numeric,
    "resting_heart_rate_min" numeric,
    "resting_heart_rate_max" numeric,
    "steps" integer,
    "active_minutes" integer,
    "sleep_duration_minutes" integer,
    "sleep_quality_score" numeric,
    "spo2_avg" numeric,
    "stress_score" numeric,
    "raw_summary" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wearable_daily_summaries" OWNER TO "postgres";


ALTER TABLE ONLY "public"."biomarker_summaries"
    ADD CONSTRAINT "biomarker_summaries_family_member_id_canonical_name_key" UNIQUE ("family_member_id", "canonical_name");



ALTER TABLE ONLY "public"."biomarker_summaries"
    ADD CONSTRAINT "biomarker_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."biomarkers"
    ADD CONSTRAINT "biomarkers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."canonical_biomarkers"
    ADD CONSTRAINT "canonical_biomarkers_canonical_name_key" UNIQUE ("canonical_name");



ALTER TABLE ONLY "public"."canonical_biomarkers"
    ADD CONSTRAINT "canonical_biomarkers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doctor_visits"
    ADD CONSTRAINT "doctor_visits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."health_scores"
    ADD CONSTRAINT "health_scores_family_member_id_score_date_version_key" UNIQUE ("family_member_id", "score_date", "version");



ALTER TABLE ONLY "public"."health_scores"
    ADD CONSTRAINT "health_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medication_adherence_log"
    ADD CONSTRAINT "medication_adherence_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medications"
    ADD CONSTRAINT "medications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wearable_daily_summaries"
    ADD CONSTRAINT "wearable_daily_summaries_family_member_id_summary_date_sour_key" UNIQUE ("family_member_id", "summary_date", "source");



ALTER TABLE ONLY "public"."wearable_daily_summaries"
    ADD CONSTRAINT "wearable_daily_summaries_pkey" PRIMARY KEY ("id");



CREATE INDEX "adherence_medication_date_idx" ON "public"."medication_adherence_log" USING "btree" ("medication_id", "scheduled_time" DESC);



CREATE INDEX "adherence_member_date_idx" ON "public"."medication_adherence_log" USING "btree" ("family_member_id", "scheduled_time" DESC);



CREATE INDEX "biomarker_summaries_member_idx" ON "public"."biomarker_summaries" USING "btree" ("family_member_id");



CREATE INDEX "biomarkers_abnormal_idx" ON "public"."biomarkers" USING "btree" ("family_member_id", "status") WHERE ("status" <> 'normal'::"text");



CREATE INDEX "biomarkers_report_idx" ON "public"."biomarkers" USING "btree" ("report_id");



CREATE INDEX "biomarkers_timeline_idx" ON "public"."biomarkers" USING "btree" ("family_member_id", "canonical_name", "report_date" DESC);



CREATE INDEX "family_members_owner_idx" ON "public"."family_members" USING "btree" ("owner_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "health_scores_member_idx" ON "public"."health_scores" USING "btree" ("family_member_id", "score_date" DESC);



CREATE INDEX "medications_active_idx" ON "public"."medications" USING "btree" ("family_member_id", "is_active") WHERE (("deleted_at" IS NULL) AND ("is_active" = true));



CREATE INDEX "reports_family_member_idx" ON "public"."reports" USING "btree" ("family_member_id", "report_date" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "reports_status_idx" ON "public"."reports" USING "btree" ("extraction_status") WHERE ("extraction_status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "visits_family_member_idx" ON "public"."doctor_visits" USING "btree" ("family_member_id", "visit_date" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "wearable_member_date_idx" ON "public"."wearable_daily_summaries" USING "btree" ("family_member_id", "summary_date" DESC);



CREATE OR REPLACE TRIGGER "family_members_updated_at" BEFORE UPDATE ON "public"."family_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "medications_updated_at" BEFORE UPDATE ON "public"."medications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "reports_updated_at" BEFORE UPDATE ON "public"."reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "visits_updated_at" BEFORE UPDATE ON "public"."doctor_visits" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."biomarker_summaries"
    ADD CONSTRAINT "biomarker_summaries_canonical_name_fkey" FOREIGN KEY ("canonical_name") REFERENCES "public"."canonical_biomarkers"("canonical_name");



ALTER TABLE ONLY "public"."biomarker_summaries"
    ADD CONSTRAINT "biomarker_summaries_family_member_id_fkey" FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."biomarker_summaries"
    ADD CONSTRAINT "biomarker_summaries_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."biomarkers"
    ADD CONSTRAINT "biomarkers_canonical_name_fkey" FOREIGN KEY ("canonical_name") REFERENCES "public"."canonical_biomarkers"("canonical_name");



ALTER TABLE ONLY "public"."biomarkers"
    ADD CONSTRAINT "biomarkers_family_member_id_fkey" FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."biomarkers"
    ADD CONSTRAINT "biomarkers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."biomarkers"
    ADD CONSTRAINT "biomarkers_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doctor_visits"
    ADD CONSTRAINT "doctor_visits_family_member_id_fkey" FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doctor_visits"
    ADD CONSTRAINT "doctor_visits_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."health_scores"
    ADD CONSTRAINT "health_scores_family_member_id_fkey" FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."health_scores"
    ADD CONSTRAINT "health_scores_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medication_adherence_log"
    ADD CONSTRAINT "medication_adherence_log_family_member_id_fkey" FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medication_adherence_log"
    ADD CONSTRAINT "medication_adherence_log_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medication_adherence_log"
    ADD CONSTRAINT "medication_adherence_log_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medications"
    ADD CONSTRAINT "medications_family_member_id_fkey" FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medications"
    ADD CONSTRAINT "medications_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medications"
    ADD CONSTRAINT "medications_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "public"."doctor_visits"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_family_member_id_fkey" FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_visit_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."doctor_visits"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wearable_daily_summaries"
    ADD CONSTRAINT "wearable_daily_summaries_family_member_id_fkey" FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wearable_daily_summaries"
    ADD CONSTRAINT "wearable_daily_summaries_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage own adherence log" ON "public"."medication_adherence_log" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can manage own biomarker summaries" ON "public"."biomarker_summaries" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can manage own biomarkers" ON "public"."biomarkers" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can manage own family members" ON "public"."family_members" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can manage own health scores" ON "public"."health_scores" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can manage own medications" ON "public"."medications" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can manage own reports" ON "public"."reports" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can manage own visits" ON "public"."doctor_visits" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can manage own wearable data" ON "public"."wearable_daily_summaries" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."biomarker_summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."biomarkers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."canonical_biomarkers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doctor_visits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."health_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medication_adherence_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wearable_daily_summaries" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."reports";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_biomarker_summaries"("p_family_member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_biomarker_summaries"("p_family_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_biomarker_summaries"("p_family_member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";
























GRANT ALL ON TABLE "public"."biomarker_summaries" TO "anon";
GRANT ALL ON TABLE "public"."biomarker_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."biomarker_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."biomarkers" TO "anon";
GRANT ALL ON TABLE "public"."biomarkers" TO "authenticated";
GRANT ALL ON TABLE "public"."biomarkers" TO "service_role";



GRANT ALL ON TABLE "public"."canonical_biomarkers" TO "anon";
GRANT ALL ON TABLE "public"."canonical_biomarkers" TO "authenticated";
GRANT ALL ON TABLE "public"."canonical_biomarkers" TO "service_role";



GRANT ALL ON TABLE "public"."doctor_visits" TO "anon";
GRANT ALL ON TABLE "public"."doctor_visits" TO "authenticated";
GRANT ALL ON TABLE "public"."doctor_visits" TO "service_role";



GRANT ALL ON TABLE "public"."family_members" TO "anon";
GRANT ALL ON TABLE "public"."family_members" TO "authenticated";
GRANT ALL ON TABLE "public"."family_members" TO "service_role";



GRANT ALL ON TABLE "public"."health_scores" TO "anon";
GRANT ALL ON TABLE "public"."health_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."health_scores" TO "service_role";



GRANT ALL ON TABLE "public"."medication_adherence_log" TO "anon";
GRANT ALL ON TABLE "public"."medication_adherence_log" TO "authenticated";
GRANT ALL ON TABLE "public"."medication_adherence_log" TO "service_role";



GRANT ALL ON TABLE "public"."medications" TO "anon";
GRANT ALL ON TABLE "public"."medications" TO "authenticated";
GRANT ALL ON TABLE "public"."medications" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."wearable_daily_summaries" TO "anon";
GRANT ALL ON TABLE "public"."wearable_daily_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."wearable_daily_summaries" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































