# Preliminary registration screening

Reception records structured owner reports, not a diagnosis. The server computes suggested indicators from 
`pet.screening_inputs`. Free text and client-supplied triage/risk values do not determine the suggestion.

Rules are illustrative, versioned as intake-screening-v1, and marked illustrative_not_clinically_validated.
A veterinarian must approve the clinical rules before clinical use. This implementation does not claim clinical validation.

## Endpoints

All paths are under /api/clinic-records and require authenticated clinic staff.

- GET /registration-screening/config: symptom/exposure choices, indicator definitions and rule version.
- POST /registration-screening/preview: calculate from { screening_inputs: { symptoms: [], exposures: [], other_symptom: '', routine_visit: false } } without saving.
- POST /registration-intakes: accepts the same selections as pet.screening_inputs, calculates and saves the flags, and notifies the assigned veterinarian.
- PUT /registration-intakes/:id/resubmit: recalculates from corrected owner reports and resets the prior screening review. Prior veterinary changes remain in the audit trail.
- GET /registration-intakes: returns stored reports, suggestions, effective flags and veterinary review to scoped staff.
- PATCH /registration-intakes/:id/screening: assigned veterinarian confirms or overrides with { triage_priority, infection_risk, note }. An override requires a reason.
- GET /registration-intakes/:id/patient-record: approved patient includes the preserved screening snapshot.

## Database storage

Uses existing PostgreSQL JSONB columns; no destructive schema migration or reseeding is needed.

- patient_registration_intakes.pet_data.screening: normalized inputs, rule_version, validation_status, matched_rules, original suggested flags, effective flags and veterinary review (reviewer, timestamp, note, overridden).
- pet_data.triage_priority and infection_risk mirror the server's effective flags for compatibility.
- pets.metadata.registration_screening: copied on approval and updated for later veterinary screening reviews.
- clinic_notifications: assigned veterinarian gets reported symptoms and computed flags; live clinic events refresh the doctor's intake and notification views.
- audit_trail: veterinary screening review stores before/after snapshots. Intake corrections/submissions retain their existing audit events.

## Missing and contradictory information

Unselected checkboxes mean unknown, not a negative finding. Blank reports default to Not assessed.
Routine / Not indicated requires explicit No symptoms reported AND No known exposure.
None and Unknown are exclusive choices; contradictory or unknown input values are rejected by the backend.
Other requires a description. Client-submitted result flags and review metadata are ignored.
Existing records without structured screening display Not assessed; prior free text is never retrospectively classified.

Run node scripts/test_intake_screening.js for rule/endpoint unit checks.
Run node scripts/test_registration_workflow.js for database persistence, notifications, doctor access, approval and override checks (rolled back).
