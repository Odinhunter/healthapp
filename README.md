# HealthApp

**One place for a family's health records in India.** Photograph a lab report, AI reads every biomarker, and each value turns into a trend over time, for you and your parents.

> **Status:** research prototype, built solo by [Ishan Kabra](https://ishankabra.com/wisprflow), 2026. Not a medical device and not on the app stores. Nothing here gives medical advice.

## What it does

- **Upload a report.** Take a photo, pick one from your gallery or attach a PDF.
- **Read the biomarkers.** A Supabase edge function sends the report to Claude, which pulls out every test, value, unit and reference range. It handles 18-page Indian lab PDFs with 50+ biomarkers.
- **Use one name for each test.** Every lab prints names its own way, so each line is matched to one standard biomarker. Haemoglobin from Lal PathLabs and Hb from a local lab end up on the same chart.
- **See trends.** Every biomarker gets a chart across all your reports, drawn against its reference range.
- **Keep the rest of the record.** There's also a doctor-visit log, medication tracking and family profiles.

## How it works

```
photo / PDF ─► Supabase Storage ─► extract-report (edge function, Claude)
                                        │
                                        ▼
                          biomarkers ─► canonical mapping ─► Postgres
                                                               │
                         app (realtime status) ◄── trend summaries
```

## Stack

React Native 0.83 + Expo SDK 55, Expo Router, TypeScript (strict), Supabase (Postgres, Storage, Edge Functions, hosted in Mumbai), Claude for extraction, Reanimated, FlashList, Jest.

## Running it

```bash
npm install
npx expo start          # press i for the iOS simulator, a for Android
npx jest                # unit tests
```

Create a `.env` file with your own Supabase project:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

The edge function needs `ANTHROPIC_API_KEY` set as a Supabase secret. Deploy it with `supabase functions deploy extract-report`. `supabase/remote_schema.sql` is the current database schema.

## Known limits

Every lab writes test names differently, and matching them to one standard name is the hard part of this project. Some cases still go wrong. Two different tests can end up merged into one trend, as BUN and urea did. Results without a number, such as positive or negative, are skipped. [`HANDOFF.md`](HANDOFF.md) lists the open problems in detail.
