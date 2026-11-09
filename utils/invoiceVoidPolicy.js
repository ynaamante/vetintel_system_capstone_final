const VOID_REASONS = [
  { code: 'duplicate_invoice', label: 'Duplicate Invoice', relatedInvoice: true, guidance: 'Void the duplicate and retain the correct invoice.' },
  { code: 'wrong_patient', label: 'Invoice Created for Wrong Patient', replacement: true, guidance: 'Void the invalid invoice and create a bill for the correct patient and visit.' },
  { code: 'service_not_performed', label: 'Consultation or Service Not Performed', noCharges: true, guidance: 'Void only if the entire invoice is invalid. Otherwise request correction of the affected item.' },
  { code: 'created_by_mistake', label: 'Invoice Created by Mistake', guidance: 'Void the invalid invoice. No replacement is required.' },
  { code: 'appointment_cancelled', label: 'Appointment Cancelled Before Services', noCharges: true, guidance: 'Void only when no billable service occurred and no charges are legitimately owed.' },
  { code: 'incorrect_billing_record', label: 'Incorrect Billing Record', replacement: true, guidance: 'Request correction if possible. Void only when the original patient or visit record cannot be corrected.' },
  { code: 'invoice_replaced', label: 'Invoice Replaced', relatedInvoice: true, guidance: 'Void the original and link the valid replacement invoice.' },
];
module.exports = { VOID_REASONS };
