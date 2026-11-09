The doctor’s Due Dates & Reminders chevron opens Reminder Details. It reads existing patient/owner, appointment, vaccination, and treatment-plan records without creating duplicate clinical records.

Endpoints (authenticated, clinic-scoped):

- `GET /api/clinic-records/reminders/:id`: current source records, clinical notes, owner contact details, notification history, generated message preview, available channels, and appointment rescheduling eligibility.
- `POST /api/clinic-records/reminders/:id/send`: `{ "channels": ["email", "in_app"], "request_id": "<UUID>" }`. Either or both channels can be selected. Repeating the same UUID for the same reminder/channel returns the existing result instead of sending twice. SMS and WhatsApp are no longer accepted.
- Rescheduling uses the existing `POST /api/clinic-records/appointments/:id/related` workflow with `action: "reschedule"`. Ineligible reminders link to the existing doctor schedule instead. Patient links open the existing Patient Records screen.

Reminder identifiers may be a numeric saved-reminder ID, `appointment:<id>`, `vaccination:<id>`, or `plan:<id>`.

Startup creates `clinic_reminder_deliveries` and `clinic_owner_notifications` through `reminderDetailsController.ensureSchema`. Delivery history is separate from clinical due status. Sending a notification does not complete a vaccination or follow-up. The reminder list displays the most recent attempt separately. Historical channel records are retained.

Email uses Brevo when `BREVO_API_KEY` and `SENDER_EMAIL` (or `BREVO_SENDER_EMAIL`) are set in the backend `.env`. `BREVO_SENDER_NAME` is optional. The sender must be verified in Brevo. Otherwise, email uses the existing SMTP transport: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, optional `SMTP_FROM` and `SMTP_SECURE`. The Email option is unavailable when SMTP or the owner’s email is missing. In-App Notification works independently of SMTP and uses the owner’s registered email on the clinic client profile.

For email, `sent` means the email provider accepted the message. For in-app, it means the message was saved to the owner’s inbox. `delivered` is recorded only after the pet app acknowledges receipt. Read timestamps appear in the doctor’s reminder history. Failed attempts remain in history. No real owners are notified by automated tests.

Owner app APIs:

- `GET /api/owner/notifications`
- `POST /api/owner/notifications/acknowledge` with `{ "ids": ["<notification ID>"] }`
- `PATCH /api/owner/notifications/:id/read`
- `PATCH /api/owner/notifications/read-all`

These endpoints match the signed-in account’s email against both the notification recipient and the current clinic client record. They ignore caller-supplied clinic/owner filters, so one owner cannot read or acknowledge another owner’s notifications.

The pet app’s Alerts screen and unread badges use a shared notification context. It refreshes while the app is active, on screen focus, on returning to foreground, and on pull-to-refresh. Mark-read state is stored on the backend. Existing public announcement banners remain available on Home. Reload the updated pet app to use the connected inbox.

Validation:

- `node scripts/test_reminder_details.js`: uses rolled-back records and mocked SMTP to check linked records, histories, idempotency, failures, missing configuration, role access, and clinic isolation.
- `node scripts/test_live_clinic_fetch.js`: reads authenticated live endpoints, including modal detail data, without sending notifications.
- `npm.cmd run build` in `admin`.
- `node node_modules/typescript/bin/tsc --noEmit` in `petwatch-rn`.
