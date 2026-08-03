# Graph Report - .  (2026-04-17)

## Corpus Check
- 73 files · ~46,260 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 182 nodes · 250 edges · 20 communities detected
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `Table: family_members` - 10 edges
2. `Raw Layer (Ground Truth)` - 8 edges
3. `Database Architecture` - 7 edges
4. `Table: reports` - 7 edges
5. `Table: biomarkers` - 6 edges
6. `App Icon (icon.png)` - 6 edges
7. `App Logo: Upward Chevron / A-shape` - 6 edges
8. `Table: biomarker_summaries` - 5 edges
9. `Table: doctor_visits` - 5 edges
10. `Table: medications` - 5 edges

## Surprising Connections (you probably didn't know these)
- `App Logo: Upward Chevron / A-shape` --conceptually_related_to--> `Family Health Management Model`  [AMBIGUOUS]
  assets/icon.png → DATABASE.md
- `App Icon (icon.png)` --semantically_similar_to--> `Android Icon Background`  [INFERRED] [semantically similar]
  assets/icon.png → assets/android-icon-background.png
- `App Icon (icon.png)` --semantically_similar_to--> `Android Icon Monochrome`  [INFERRED] [semantically similar]
  assets/icon.png → assets/android-icon-monochrome.png
- `App Icon (icon.png)` --semantically_similar_to--> `Android Icon Foreground`  [INFERRED] [semantically similar]
  assets/icon.png → assets/android-icon-foreground.png
- `App Icon (icon.png)` --semantically_similar_to--> `Favicon (favicon.png)`  [INFERRED] [semantically similar]
  assets/icon.png → assets/favicon.png

## Hyperedges (group relationships)
- **Raw Layer Tables** — table_profiles, table_family_members, table_reports, table_biomarkers, table_doctor_visits, table_medications, table_medication_adherence_log [EXTRACTED 1.00]
- **RLS-Protected Tables (owner_id pattern)** — table_profiles, table_family_members, table_reports, table_biomarkers, table_biomarker_summaries, table_doctor_visits, table_medications, table_medication_adherence_log, table_health_scores, table_wearable_daily_summaries [EXTRACTED 1.00]
- **Soft Delete Tables** — table_family_members, table_reports, table_doctor_visits, table_medications [EXTRACTED 1.00]
- **App Brand Asset Suite** — asset_icon, asset_android_icon_background, asset_android_icon_foreground, asset_android_icon_monochrome, asset_favicon, asset_splash_icon [EXTRACTED 1.00]
- **Family Health Data Hub (family_members as central entity)** — table_family_members, table_reports, table_biomarkers, table_biomarker_summaries, table_doctor_visits, table_medications, table_medication_adherence_log [EXTRACTED 1.00]

## Communities

### Community 0 - "Database & Backend Logic"
Cohesion: 0.17
Nodes (25): AI Extraction Pipeline, Canonical Biomarker System, Dashboard Performance Optimization, Family Health Management Model, on_auth_user_created Trigger, owner_id RLS Security Pattern, refresh_biomarker_summaries Function, Row Level Security (RLS) (+17 more)

### Community 1 - "Illustration Components"
Cohesion: 0.11
Nodes (0): 

### Community 2 - "Biomarker Display & Grouping"
Cohesion: 0.1
Nodes (0): 

### Community 3 - "App Entry & Core Types"
Cohesion: 0.12
Nodes (0): 

### Community 4 - "Auth & Navigation Layout"
Cohesion: 0.14
Nodes (3): handleChangeText(), handleVerify(), triggerShake()

### Community 5 - "Auth Library & Tests"
Cohesion: 0.16
Nodes (4): sendEmailOTP(), signInWithOTP(), verifyEmailOTP(), verifyOTP()

### Community 6 - "File Upload & Storage"
Cohesion: 0.15
Nodes (0): 

### Community 7 - "Records & Report List"
Cohesion: 0.31
Nodes (0): 

### Community 8 - "App Brand Assets"
Cohesion: 0.46
Nodes (8): Android Icon Background, Android Icon Foreground, Android Icon Monochrome, Favicon (favicon.png), App Icon (icon.png), Splash Screen Icon, App Logo: Upward Chevron / A-shape, Brand Color: Blue Gradient (#4A9EFF range)

### Community 9 - "OTP Validation"
Cohesion: 0.5
Nodes (0): 

### Community 10 - "Graphify Metadata"
Cohesion: 0.5
Nodes (4): Graph Report (GRAPH_REPORT.md), Graphify Knowledge Graph Config, Graphify Rebuild Command, Wiki Index (graphify-out/wiki/index.md)

### Community 11 - "Post-Auth Flow Tests"
Cohesion: 0.67
Nodes (0): 

### Community 12 - "Profile Creation Tests"
Cohesion: 0.67
Nodes (0): 

### Community 13 - "Onboarding Step Machine"
Cohesion: 0.67
Nodes (0): 

### Community 14 - "Phone Validation Tests"
Cohesion: 0.67
Nodes (0): 

### Community 15 - "Phase 2 DB Tables"
Cohesion: 0.67
Nodes (3): Phase 2 Tables (Structured, Unpopulated), Table: health_scores (Phase 2), Table: wearable_daily_summaries (Phase 2)

### Community 16 - "Auth Gate Tests"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Onboarding Payload Tests"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Babel Config"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "URL Polyfill"
Cohesion: 1.0
Nodes (0): 

## Ambiguous Edges - Review These
- `Family Health Management Model` → `App Logo: Upward Chevron / A-shape`  [AMBIGUOUS]
  assets/icon.png · relation: conceptually_related_to

## Knowledge Gaps
- **6 isolated node(s):** `Graph Report (GRAPH_REPORT.md)`, `Wiki Index (graphify-out/wiki/index.md)`, `Graphify Rebuild Command`, `Table: health_scores (Phase 2)`, `Table: wearable_daily_summaries (Phase 2)` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Auth Gate Tests`** (2 nodes): `auth-gate.test.ts`, `authGateDecision()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Onboarding Payload Tests`** (2 nodes): `onboarding-answers.test.ts`, `buildOnboardingPayload()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Babel Config`** (1 nodes): `babel.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `URL Polyfill`** (1 nodes): `url-polyfill.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Family Health Management Model` and `App Logo: Upward Chevron / A-shape`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Family Health Management Model` connect `Database & Backend Logic` to `App Brand Assets`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `App Logo: Upward Chevron / A-shape` connect `App Brand Assets` to `Database & Backend Logic`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `Graph Report (GRAPH_REPORT.md)`, `Wiki Index (graphify-out/wiki/index.md)`, `Graphify Rebuild Command` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Illustration Components` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Biomarker Display & Grouping` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `App Entry & Core Types` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._