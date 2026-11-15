# Confirmed disease surveillance

The existing Node backend uses a privileged PostgreSQL connection to Supabase.
There is no browser Supabase client or copied case queue. All Disease Intelligence
pages and Reports use `/api/disease-intelligence/summary`, aggregating committed
diagnosis records directly. The next read reflects a successful save, correction,
or withdrawal. Open pages refresh every 30 seconds, on focus, and after a local
diagnosis save. Failed reads show an error and are retried on refresh. There is no
background write job that can silently miss a contribution.

## Eligibility and identity

Only the latest record of a private disease episode contributes, and only when
`record_status = finalized`, `case_classification = confirmed`, and its catalog
disease is active. Routine procedures, provisional diagnoses in other clinical
tables, and positive lab results do not contribute. Lab and urgent reporting
workflows are unchanged. This feature does not send notifications or declare
outbreaks; the existing activity-review thresholds remain separate.

`monitored_diseases` is the only new table; schema inspection found no existing
disease catalog or surveillance case table. The seven initial diseases have
stable text primary keys. Exact curated aliases resolve existing free text to
`patient_diagnoses.monitored_disease_id` at the database write boundary. There is
no fuzzy/substring matching during counting. The existing diagnosis suggestions
also offer canonical catalog names. Unrecognized text remains a local diagnosis.

The database trigger assigns `surveillance_episode_id`. New follow-up records
reuse the latest unresolved episode for the same clinic, patient, and disease.
Marking an episode resolved or ruled out allows the next new diagnosis to start
a new episode. Editing an existing record retains its episode, including when
the disease changes. Latest edits supersede earlier episode records, so ruling
out a follow-up cannot resurrect an older confirmed entry. Concurrent inserts
are serialized by a transaction advisory lock. Historical same-day entries use
a deterministic episode identity; older records across different days are not
automatically merged because their episode relationship is unknown.

Exact full-name CIRDC aliases, including Canine Infectious Respiratory Disease Complex, map to `cirdc` without changing the clinical diagnosis text.

The episode reporting date is the earliest clinical diagnosis date in that
episode, in Asia/Manila time. Follow-up saves do not shift a case to today's
reporting period. Private diagnosis saves and their existing audit snapshots
commit together; snapshots include disease/episode identifiers. A failed write
rolls back, and repeated edits do not create new contributions.

## Shared privacy and totals

Active, non-archived clinics are the existing participation boundary. The Connected Clinics card and reporting-clinic dropdown count only those with non-archived patient records, rather than empty registrations. Authorized
clinical/owner roles can view shared aggregates and filter by reporting clinic.
Patient and diagnosis endpoints still enforce the originating clinic boundary.
Supabase `anon` and `authenticated` roles have no direct table privileges on
diagnoses or the catalog; RLS is enabled without public policies. Backend access
uses the existing privileged PostgreSQL role. No service credentials are sent
to the browser.

All disease outputs derive from the same released cells. Authorized origin-clinic staff see their own exact eligible counts; other viewers receive only cells meeting the privacy threshold. Cells are grouped by: reporting month,
current/previous period, clinic, disease, species and recorded severity. Cells from other clinics
need at least three cases **and three distinct patients**. Set server variable
`SURVEILLANCE_MIN_COUNT` to an integer greater than or equal to three to increase
this minimum. Lower/invalid settings fall back to three.

Suppressed cells are absent from totals, charts, comparisons, risk groups and
exports. Totals describe publishable cases, not all local diagnoses. Therefore
a single confirmed diagnosis appears immediately for its own authorized clinic, but cannot be shared with other clinics alone. No hidden exact count or suppressed-cell count is returned. Trends use
monthly buckets; latest reporting dates are month-level. Risk Monitoring returns
aggregate groups, never individual case references or hashed patient IDs.
Vaccination coverage metrics remain scoped to the requesting clinic and are
separate from shared disease surveillance.

Minimum-count suppression reduces re-identification risk; it is not a formal
differential privacy guarantee against repeated overlapping queries or outside
knowledge. New privacy requirements should be reviewed before expanding filters.

## Apply and verify

Run from the repository root with the existing backend `.env`:

```powershell
node scripts/migrate_confirmed_surveillance.js
node scripts/test_surveillance_dashboard.js
node scripts/test_patient_diagnoses.js
node scripts/test_diagnosis_laboratory.mjs
npm --prefix admin run build
```

Server startup also applies the idempotent schema migration in a transaction.
Restart the backend to load the controller changes. The standalone migration
adds columns and constraints, backfills identities, creates a trigger and index,
and restricts direct browser table access. It does not delete clinical records.

The surveillance integration test applies the schema twice in a transaction,
uses real diagnosis controller saves and aggregation queries, and rolls back
all fixtures/schema changes. It checks confirmations, drafts, corrections,
withdrawals, follow-up deduplication, new episodes after resolution, suppression,
routine exclusions, inactive catalog entries, retry safety, audit, table
privileges and cross-clinic isolation. It requires an existing veterinarian
and two active clinics. Production counters are not changed by test fixtures.

To demonstrate manually, save finalized confirmed diagnoses for three separate
patients of the same species, disease, severity, clinic and reporting month.
Within 30 seconds all four views show consistent counts for the same viewer and filters. Origin-clinic staff also see single eligible cases; other clinics do not see a small group until it meets the threshold. Repeatedly
editing a diagnosis leaves that count unchanged. Ruling one out withdraws its
contribution. Origin staff then see two; other clinics have that remaining small cell suppressed in every view/export.
