# Billing review contract

Correctable invoices use `POST /api/clinic-records/invoices/:id/review`
with `action: "return"` and a reason. The doctor receives a notification,
edits charges through `POST /api/clinic-records/invoices/:id/correct`, and
resubmits the bill. Reception is notified. Returned bills cannot be issued
or paid until corrected. All review operations preserve activity and audit history.

Void is for an entirely invalid, uncorrectable invoice. It requires a reason
code from `GET /api/clinic-records/billing-review-options`, reason details,
`can_be_corrected: false`, and `entire_invoice_invalid: true`.

Reception submits that action as a request, leaving the invoice's financial
status unchanged and setting `metadata.void_request_status: "pending"` and
`billing_review_status: "void_requested"`. Pending requests appear in the
doctor's Voided tab with a Void Requested label. Payments, other review actions,
and corrections are blocked until the request is decided.

Clinical staff use `POST /api/clinic-records/invoices/:id/void-decision` with
`{ "decision": "approve" | "reject", "reason": "..." }`. Rejection requires
a reason and restores the invoice's previous financial and review statuses.
Approval sets the invoice to `void` and finalizes any retained/replacement links.
Both decisions record the actor, timestamp, activity, and audit history; notify
reception; and publish a billing update. Both screens refresh billing records
every 15 seconds and immediately after their own actions. The receptionist's
open dialog reads the refreshed invoice from the current list.

The endpoint enforces clinical roles, clinic ownership, an unpaid invoice,
and a pending request under a row lock. Repeated decisions return HTTP 409.
Legacy voided invoices without a decision permit one clinical review;
rejection is unavailable once another invoice is linked. A finalized decision
cannot be reversed through this endpoint.

| Reason code | Required handling |
| --- | --- |
| duplicate_invoice | Link the valid same-client/visit invoice using related_invoice_id; retain it. Do not create another replacement. |
| wrong_patient | Preserve the voided original. A doctor can create a linked replacement by selecting a valid different patient visit. |
| service_not_performed | Require no_charges_owed: true. If only an item is wrong, return for correction. No automatic replacement. |
| created_by_mistake | Preserve as voided. No automatic replacement. |
| appointment_cancelled | Require no_charges_owed: true. No automatic replacement. |
| incorrect_billing_record | If uncorrectable, preserve the voided original; replacement requires the correct different visit. Charge changes on the same visit use correction. |
| invoice_replaced | related_invoice_id must identify the valid existing replacement. Link both records. Do not create another replacement. |

Paid or partially paid invoices cannot be voided or corrected by this workflow.
Approved voided invoices never accept payments or return to an active state. Replacements
are new invoices and are linked to the original; duplicate replacement creation
is rejected. All referenced invoices, patients, and visits must belong to the
authenticated user's clinic. Backend validation must enforce these rules even
when the UI is bypassed. Legacy voided bills without a classified reason cannot
automatically generate a replacement through the correction endpoint.
