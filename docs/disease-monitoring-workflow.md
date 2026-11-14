# Disease monitoring and signal review

Eligible source: latest version of a monitored diagnosis episode, confirmed and
finalized, in an active clinic. No blanket laboratory-result requirement is added.
The existing stable episode identity prevents edits and ongoing follow-ups from
creating duplicate cases; draft, suspected and withdrawn episodes are excluded.

All clinical surveillance consumers use `services/diseaseMonitoring.js` through
the summary/report/export handlers. Vaccination coverage remains clinic-local.
Disease Monitoring answers counts, geographic distribution and weekly trends.
Risk Monitoring answers which signals need review, reviewer and follow-up notes.
Dashboard and Reports use the same persisted signals, not independent growth rules.

## Periods and privacy

Reporting periods are 30/60/90 inclusive calendar days ending today in Manila.
The previous comparison window has exactly the same number of days. Counts are
per Monday–Sunday week, not cumulative; boundary weeks are explicitly partial.
Origin-clinic users retain exact counts for their own eligible episodes.
Foreign release cells are fixed calendar week × clinic × disease × species ×
recorded severity, requiring at least three distinct patients (or the configured
higher minimum). Partial foreign weeks are withheld. This conservative policy
can show fewer shared cases than a monthly aggregate.

Suppression runs before search, area or disease aggregation. The same released
cells feed totals, trend, distribution, comparisons, exports and signal detection.
No endpoint returns withheld counts. A wholly suppressed chart point is null,
not zero; region rows indicate Suppressed or Partial data. Growth is unavailable
when protected groups prevent a complete comparison. Signals with a protected
baseline do not calculate a growth percentage. Totals are labeled released cases.
Removed or newly private source cells do not remain readable through saved alert IDs.

Reporting area is the approved `clinics.metadata.surveillance_area` value. Missing
mapping displays Area not configured; the service does not guess regions from
addresses or substitute clinic names. No pet/owner names, clinical notes or
individual patient IDs are returned in surveillance results.

## Rules and statuses

No medical thresholds are invented or seeded. Owner **Alert Rules** configuration
requires Configure Alert Rules. Choose disease, area (or each area), positive
weekly case threshold and optional positive growth percentage. A specific area
rule takes precedence over a wildcard rule. The chart only shows a threshold
for a selected disease AND area with an applicable rule.

Signals are potential increases in released counts, not confirmed outbreaks.
The growth condition also requires the configured minimum case count and a
nonzero released baseline. Evidence includes observed cases, preceding week,
triggering rule, severity, geography and reporting window. Partial weeks use
cases observed so far; their thresholds are not scaled down.

Signal identity is clinic policy × rule × area × calendar week. Repeated reads
and evidence updates preserve New / Under Review / Resolved and review notes.
New plus Under Review equals Active Alerts. Reviews record the authenticated
reviewer and an audit entry. Owner rule changes also create audit entries.
Doctors/owners need Review Disease Alerts; receptionists cannot receive it.
The owner can configure the staff permission using the existing role editor.
No notification or cross-clinic message is sent by these endpoints.

## Verification

- `node scripts/migrate_disease_monitoring.js`: additive schema, RLS and revoked browser privileges.
- `node scripts/test_disease_monitoring.js`: transaction rollback fixtures for
  eligibility, deduplication, weekly bounds, privacy, persisted review states,
  deduplicated signals, active counts, and cross-clinic protection.
- `node scripts/test_confirmed_surveillance.js`: existing diagnosis lifecycle regression suite.
- `node scripts/test_clinic_rbac.js`: authentication and clinic permission isolation.
- `scripts/test_disease_monitoring_ui.cjs`: Chrome desktop/mobile live totals,
  active counts, rule dialog, periods, matching CSV export and separate risk queue.
