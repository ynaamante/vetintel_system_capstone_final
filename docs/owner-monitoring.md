Owner monitoring reads the existing clinic database. Inventory and Service Management were left intact.

Authenticated owner APIs:

- `GET /api/owner-monitoring/summary`: patients, clients, appointments, invoices, payments, vaccinations, inventory alerts, staff, and audit activity. Reuses the clinic read handlers used by doctors and receptionists.
- `GET /api/owner-monitoring/data-status`: database record totals and latest recorded entries. There is no separate scheduled sync engine or transfer queue.
- `GET /api/owner-monitoring/report?days=30&disease=...`: real diagnosis, risk, clinic, and vaccination aggregates. Supports 30, 60, and 90 days like the existing intelligence endpoint.

Owners are scoped to their authenticated clinic; requesting a different clinic cannot override that scope. The summary refreshes on clinic events, window focus, and every 30 seconds. Audit reads are also scoped server-side.

Financial reports calculate income from payments, rather than invoice totals. Partial payments count only their received amount. Invoice balances exclude void/cancelled invoices. Calendar dates use Asia/Manila. Service revenue allocates each received payment proportionally across the invoice items. Expenses and profit are unavailable because there is no expense ledger; they are not fabricated.

Reports download real PDF/CSV files. Recent generated files are retained for the current browser session. Empty source datasets produce explicit empty reports.

Shared clinic inbox APIs:

- `GET /api/clinic-records/inbox`
- `POST /api/clinic-records/inbox` with a saved `pet_id`
- `PATCH /api/clinic-records/inbox/:id` with a message, status, assignee, or read state

Conversations are persisted in clinic-scoped settings entries and shared across owners, doctors, and receptionists. These are recorded clinic messages; no SMS, email, or PetWatch chat delivery integration is implied. Staff assignments and patient references must belong to the same clinic.

Validation:

- `node scripts/test_owner_monitoring.js`: database endpoint shapes, clinic isolation, matching payment totals, date boundaries, partial payments, allocation, and period filters.
- `node scripts/test_clinic_inbox.js`: cross-role persistence, atomic message appends, validation, and clinic isolation, inside a rolled-back transaction.
- `node scripts/test_reception_billing_http.js`: existing authenticated receptionist/doctor billing workflow regression, inside a rolled-back transaction.
- `node scripts/test_billing_view.mjs`
- `npm.cmd run build` in `admin`.

Restart the backend after updating to register the new routes. No database migration is required.
