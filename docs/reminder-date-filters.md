Due Dates & Reminders reads the same clinic appointments, vaccination next-dose dates, treatment-plan follow-up dates, and saved reminders used by the doctor and receptionist pages. The read endpoint does not create or send messages.

API:

- `GET /api/clinic-records/reminders`: retains the array response by default. Accepts `doctor` (name) or `doctor_id`, `appointment_type`, `status`, `search`, `from`, and `to`.
- Add `include_filters=true` to receive `{ reminders, filters, counts, total }`. Dropdown options and tab counts describe the whole assigned clinic, so a filter with no matches does not remove the other dropdown options.
- `GET /api/clinic-records/reminders/filters` and `GET /api/clinic-records/appointments/filters` return real clinic doctor names and appointment types.
- `GET /api/clinic-records/appointments` accepts `from`/`to`, `date_from`/`date_to`, and `dateFrom`/`dateTo`. Date-only values cover the full Manila calendar day. Existing timestamp ranges remain supported.

Staff requests are restricted to their authenticated clinic. The caller cannot override that clinic through query parameters. Reminder rows preserve numeric IDs; derived due items have stable source-prefixed IDs. Stored reminders take precedence over equivalent appointment/vaccination due items. Draft vaccinations, cancelled appointments, and completed treatment plans do not generate active due items.

Frontend reminder selections query the API with cancellation of obsolete requests and refresh on clinic events, focus, and every minute. Appointment pages keep their full clinic dataset so existing summary cards, tabs, and scheduling workflows continue to work while filtering the real records.

The shared date presets and date comparisons use Asia/Manila. Updated consumers include receptionist appointments and billing, doctor billing, patient visit histories, lab results, clinic appointment/visit lists, medications, and vaccination lists. Invalid or reversed backend ranges return HTTP 400. The custom date picker prevents applying a reversed range. Existing client filters that already receive complete real datasets do not require separate endpoints.

Validation: `node scripts/test_reminder_date_filters.js` exercises clinic-scoped dropdowns, combined filters, source deduplication, vaccination drafts, treatment follow-ups, date boundaries, invalid dates, and presets. Test records run inside a rolled-back database transaction. Also run `node scripts/test_billing_view.mjs` and `npm.cmd run build` in `admin`.

Restart the backend to register the new routes. No database migration is required.
