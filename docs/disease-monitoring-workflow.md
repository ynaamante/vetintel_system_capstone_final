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

## Connected monitoring pages

Dashboard, Disease Monitoring and Risk Monitoring share applied disease, clinic,
reporting barangay and period filters through the app navigation. Search filters
from monitoring remain explicit when carried into Dashboard or Reports. Signing
out clears this in-memory scope. Reports initializes its builder from that scope;
generated files include the selected clinic, reporting barangay, dates, date basis,
and privacy notice. Disease summaries also include the grouped case-summary rows.

Disease Monitoring uses the system FilterSelect controls and an Apply Filters
button. Pending selections are identified and do not affect displayed results or
exports until applied. Four compact cards show released confirmed cases,
participating clinics, clinics reporting and diseases with positive released counts. The weekly chart
includes partial boundary weeks. All reported diseases appear in the scrollable
disease bar list; its counts and the summary table reconcile with the case card.
Charts sit side by side on desktop; the case table appears directly underneath.
Secondary actions, date/area definitions and the full privacy explanation live
under Monitoring details & tools. The table retains a short visible eligibility
and date-basis note. No internal scrollbar is used for the disease bars.

Case Summaries groups the already released cells by disease, clinic and reporting
barangay. By Clinic and By Barangay regroup these same rows without requesting
private patient details. Show more discloses additional summaries with an explicit
row count. A summary dialog can filter the charts to that group or open Risk
Monitoring with the same scope. Disease Monitoring no longer duplicates the risk
review queue. Rule configuration remains owner-only and exports remain gated by
the existing permissions.

Dates use the diagnosis episode's first-recorded date, matching the canonical
episode selection; finalizing an existing episode does not move its date or create
another case. UI and export labels explicitly identify this basis rather than
claiming confirmation-date reporting. Reporting barangay means the clinic's
approved surveillance-area mapping, not a patient's residence.

Case-summary rows never contain protected counts. Comparisons are unavailable
for rows with withheld data; a zero previous count is labeled New rather than an
infinite percentage increase. Wholly protected current counts remain null.

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

`config/santaMariaBarangays.js` defines the 24 official Santa Maria barangay names,
verified against the provincial Liga ng mga Barangay directory. The shared API
always supplies all 24 as filter/rule options, including barangays without cases.
Existing unmapped/legacy reporting areas remain accessible; adding the catalog
does not assign clinics to barangays or create case counts for empty areas.

## Rules and statuses

No medical thresholds are invented or seeded. Owner **Alert Rules** configuration
requires Configure Alert Rules. Choose disease, area (or each area), positive
weekly case threshold and optional positive growth percentage. A specific area
rule takes precedence over a wildcard rule. The chart only shows a threshold
for a selected disease AND area with an applicable rule.

Signals flag threshold activity or configured growth in released counts, not confirmed outbreaks.
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

## Risk Monitoring review workflow

Risk Monitoring uses Disease, Reporting Barangay, Status and Date Range filters
with Apply Filters. The three cards are Open Signals, Needs Review and Under
Review; disease, barangay, date and search scope affect the cards, while status
filters the table only. Open Signals always equals Needs Review plus Under Review.
An inherited clinic scope is explicitly shown with an option to clear it.

Potential Disease Signals includes resolved rows when requested. Its columns show
disease, reporting barangay, exact signal week, observed versus previous-calendar-
week cases, triggering condition and review status. Trigger labels are Threshold
Exceeded, Growth Increase and Threshold and Growth Increase. Current configured
growth rules also require the case threshold, so a passing growth rule generates
the combined label. The UI does not create independent growth-only signals.

Clicking a row (or Enter/Space on a focused row) opens Signal Details. Needs Review
offers Start Review, which assigns the authenticated reviewer. Under Review offers
Save Review Notes and Mark as Resolved. Resolved signals are read-only and expose
View Review History. The backend rejects skipped transitions, reopening resolved
signals and a submitted expected status that no longer matches. Later notes do
not change the original assigned reviewer; the audit records each acting user.

View Related Cases opens Disease Monitoring with the signal's disease, reporting
barangay and selected reporting period, preserving any inherited clinic scope and
clearing unrelated search text. It shows privacy-protected aggregate summaries,
never another clinic's individual records. The same modal is used on Dashboard.

The history endpoint re-evaluates signal visibility, requires disease/risk view
permission and restricts audit rows to the authenticated clinic. Returned history
contains review statuses, actor names, dates and saved notes, not case snapshots.

## Reports and snapshot consistency

Reports offers Disease Cases, Disease Signals and Clinic Reporting. Date Range
appears first; Disease, Clinic and Barangay live under More filters. Active
inherited filters open that section automatically. Status appears only for Disease Signals.
Changing filters refreshes the preview and disables generation until its data is
ready. Download PDF and the secondary Download CSV action each capture the displayed
model, build the file and download it directly. Refreshes pause while the file is
built. PDF and CSV use that same model instead of refetching counts.
Files include exact dates, applied filters, source snapshot time, generation time
in Asia/Manila, the episode-date basis and privacy notice. Signal files explicitly
compare each signal week with its preceding calendar week, rather than comparing
the two full selected periods.

Disease exports include every matching disease, all weekly buckets (including
partial or withheld intervals) and all protected case-summary rows. Clinic
Participation includes connected clinics with zero released cases and labels
wholly withheld clinic counts as Withheld. Zero cases does not establish that the
clinic submitted no reports. Counts reconcile with the same monitoring snapshot.
Signal exports include the selected statuses, weekly comparisons, rules and
assigned reviewers; they never declare a confirmed outbreak.

Recent downloads are collapsed by default. Files are held as in-memory Blobs at
the app level, so the session list survives navigation but clears on reload or
sign-out. New downloads require both Generate Reports and Export Reports; an
existing file can be downloaded again with Export Reports. Current permissions
are checked again before downloading. A file's displayed scope remains attached to it
even if the report builder changes afterwards.

Disease Monitoring and Risk Monitoring expose Download Report next to their
summary tables. These open Disease Cases and Disease Signals respectively with
the applied disease, clinic, barangay, date and search filters. The risk link
also carries its applied review status. No extra filter selection is required.

`node scripts/test_surveillance_reports.mjs` checks immutable preview/export
snapshots, status scoping, withheld values, totals, complete weekly intervals,
CSV contents and PDF generation for the three report types.

The UI rejects older monitoring responses without case-summary rows and a clinic
count instead of displaying missing fields as zero. A backend started without
watch mode must be restarted after service changes. The live API verification
script checks that the running Dashboard and monitoring endpoints reconcile.

## Verification

- `node scripts/migrate_disease_monitoring.js`: additive schema, RLS and revoked browser privileges.
- `node scripts/test_disease_monitoring.js`: transaction rollback fixtures for
  eligibility, deduplication, weekly bounds, privacy, persisted review states,
  deduplicated signals, active counts, and cross-clinic protection.
- `node scripts/test_confirmed_surveillance.js`: existing diagnosis lifecycle regression suite.
- `node scripts/test_clinic_rbac.js`: authentication and clinic permission isolation.
- `scripts/test_disease_monitoring_ui.cjs`: Chrome desktop/mobile live totals,
  active counts, rule dialog, periods, matching CSV export and separate risk queue.
