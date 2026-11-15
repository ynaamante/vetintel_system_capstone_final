# Owner Clinic Overview

The supplied screenshot is the layout reference. Its displayed names, revenue,
counts and dates are illustrative; the running clinic must use its own records.

## Live data prepared

`GET /api/owner-monitoring/overview` returns data for the authenticated owner's
clinic. A non-owner cannot access it; a supplied clinic ID cannot change an
owner's scope. Reporting boundaries use Asia/Manila, consistent with existing
clinical pages.

- Total patients: non-archived patient records.
- Patient comparison: registrations this month versus the previous month.
- Appointments: non-archived bookings scheduled this calendar month, compared
  with the previous month. This includes recorded bookings regardless of whether
  their visit has completed.
- Clinic revenue: received payments this month, excluding future-dated payments
  and payments attached to void invoices. Invoices alone are not revenue.
- Revenue chart: four calendar months, including the current month, with zero
  buckets where no payment was received.
- Pending restock requests: actual pending/approved doctor requests, not all
  low-stock items.
- Today's appointments: today's non-cancelled, non-archived bookings.
- New patients: patients registered today.
- Recent activity: clinic-scoped audit entries, with action/actor/time only.
- Search: up to ten matching own-clinic patients; no other clinic's results.

## Restock request workflow

`POST /api/clinic-records/restock-requests` requires an authenticated doctor with
Request Restock permission and an active item belonging to their clinic.
Positive whole-number quantities and notes of at most 1,000 characters are
accepted. An open request for the same item/requester cannot be duplicated.

`GET /api/clinic-records/restock-requests` lets owners see their clinic's open
requests and doctors see their own requests. `include_closed=true` includes
fulfilled/rejected requests.

`PATCH /api/clinic-records/restock-requests/:id` requires owner authority and
Restock Inventory permission. Owners may approve, fulfill or reject an open
request; rejection requires a reason. Completed requests cannot be reopened by
this endpoint. Reviews do not change stock quantities: the owner must record
actual received stock through the existing inventory editor.

Requests and reviews commit atomically with audit entries and emit a clinic
inventory event. The new `clinic_restock_requests` table has RLS enabled and no
direct browser-role privileges. No existing inventory or clinical data is deleted.

## Validation

`node scripts/test_owner_overview.js` tests live PostgreSQL queries and handlers
inside a transaction, then rolls back all fixtures and schema changes. It checks
payment totals, four revenue months, clinic isolation, duplicate requests,
owner-only review, request states, unchanged physical stock and audit entries.

Server startup installs the additive request schema after inventory tables exist.

The owner UI follows the supplied reference with a four-metric strip, restock
requests, monthly revenue, today's appointments/new patients, and recent activity.
Recent Activity lists actions recorded by doctors, assistant doctors and
veterinarians in the owner's clinic. Owner and receptionist actions are excluded.
The latest 20 doctor audit events supply both the card and its View All dialog.
Search and detail dialogs use the clinic's live records. Doctors submit
restock requests from Inventory and track owner decisions under My Requests.
Clicking a pending request row (or pressing Enter/Space) opens its owner review.
Both dialogs share product, stock, reorder and expiry details. Requests save
Normal/Urgent urgency, a positive quantity, and an optional note of up to 250
characters. Existing requests default to Normal. Declines require an owner reason.
The browser check in `scripts/test_owner_overview_ui.cjs` covers desktop and
mobile views, live patient totals, search, dialogs and horizontal overflow.
