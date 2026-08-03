-- ============================================================
-- Migration: add onboarding_data to profiles
-- ------------------------------------------------------------
-- The onboarding flow (app/(auth)/onboarding.tsx) collects answers
-- that verify.tsx flushes into profiles.onboarding_data after OTP
-- verification. The column was missing from the live schema, so that
-- write silently failed for every new signup. This adds it.
--
-- Safe to run repeatedly (IF NOT EXISTS). Apply via the Supabase SQL
-- editor or `supabase db push`.
-- ============================================================

alter table profiles
  add column if not exists onboarding_data jsonb default '{}';
