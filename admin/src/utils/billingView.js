import { dateFilterValue } from './dateFilters.js';
export const invoiceBalance = invoice => Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
export function localPaymentTime() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
export const invoiceNumber = invoice => invoice.invoice_number || `INV-${String(invoice.issued_at || '').slice(0, 4) || '----'}-${String(invoice.id).padStart(4, '0')}`;
export function invoicePaymentStatus(invoice, today = new Date()) {
  if (['void', 'cancelled', 'canceled'].includes(String(invoice.status).toLowerCase())) return 'Void';
  if (invoiceBalance(invoice) === 0) return 'Paid';
  const due = invoice.due_date || invoice.metadata?.due_date;
  const dueDay = due ? String(due).slice(0, 10) : '';
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (String(invoice.status).toLowerCase() === 'overdue' || (dueDay && dueDay < day)) return 'Overdue';
  return Number(invoice.amount_paid || 0) > 0 ? 'Partially Paid' : 'Unpaid';
}
export const invoiceCharges = invoice => (invoice.items || []).map(item => item.description).filter(Boolean).join(', ') || invoice.appointment_reason || invoice.lab_test_name || 'Clinic services';
export const isBillingQueueInvoice = invoice => invoice.metadata?.sent_to_reception === true && invoice.metadata?.void_request_status !== 'pending' && !['issued', 'returned', 'void', 'void_requested'].includes(invoice.metadata?.billing_review_status) && invoiceBalance(invoice) > 0 && invoicePaymentStatus(invoice) !== 'Void';
export const invoiceType = invoice => invoice.appointment_type
  || (invoice.lab_test_name ? 'Laboratory' : '')
  || invoice.items?.find(item => item.item_type)?.item_type
  || (invoice.consultation_id ? 'Consultation' : 'Clinic Services');

const paymentMethodOptions = [
  { value: 'cash', label: 'Cash', legacyMethods: ['cash'] },
  { value: 'qr_ph', label: 'QR Ph', legacyMethods: ['transfer'] },
  { value: 'gcash', label: 'GCash', legacyMethods: ['transfer'] },
  { value: 'maya', label: 'Maya', legacyMethods: ['transfer'] },
  { value: 'credit_card', label: 'Credit Card', legacyMethods: ['card'] },
  { value: 'debit_card', label: 'Debit Card', legacyMethods: ['card'] },
  { value: 'bank_transfer', label: 'Bank Transfer', legacyMethods: ['transfer'] },
];

export { paymentMethodOptions };

function paymentMatchesMethod(payment, method) {
  const selected = paymentMethodOptions.find(option => option.value === method);
  if (!selected) return false;
  const recordedChannel = String(payment.metadata?.payment_channel || '').toLowerCase();
  if (recordedChannel) return recordedChannel === method;
  return selected.legacyMethods.includes(String(payment.method || '').toLowerCase());
}

export function filterBillingInvoices(invoices, {
  search = '', tab = 'All Invoices', pet = 'all', doctor = 'all', workflow = 'all',
  dateFrom = '', dateTo = '', queueOnly = false, sort = 'newest', type = 'all',
  paymentMethod = 'all', billingStatus = 'all', receptionist = 'all',
  includeVoided = false, payments = [],
} = {}) {
  const query = search.trim().toLowerCase();
  return invoices.filter(invoice => {
    const date = dateFilterValue(invoice.issued_at);
    const voided = ['void', 'cancelled', 'canceled'].includes(String(invoice.status || '').toLowerCase());
    const invoicePayments = payments.filter(payment => String(payment.invoice_id) === String(invoice.id));
    const receptionistIds = invoicePayments
      .map(payment => payment.metadata?.recorded_by)
      .filter(value => value !== null && value !== undefined).map(String);
    return (tab === 'All Invoices' || invoicePaymentStatus(invoice) === tab)
      && (pet === 'all' || String(invoice.pet_id ?? invoice.pet) === pet)
      && (doctor === 'all' || invoice.doctor === doctor)
      && (workflow === 'all' || (workflow === 'sent' ? invoice.metadata?.sent_to_reception === true : invoice.metadata?.sent_to_reception !== true))
      && (!queueOnly || isBillingQueueInvoice(invoice))
      && (includeVoided || !voided)
      && (type === 'all' || String(invoiceType(invoice) || '').trim().toLowerCase() === type.trim().toLowerCase())
      && (paymentMethod === 'all' || invoicePayments.some(payment => paymentMatchesMethod(payment, paymentMethod)))
      && (billingStatus === 'all' || invoicePaymentStatus(invoice) === billingStatus)
      && (receptionist === 'all' || receptionistIds.includes(receptionist))
      && (!dateFrom || date && date >= dateFrom) && (!dateTo || date && date <= dateTo)
      && (!query || [invoiceNumber(invoice), invoice.id, invoice.pet, invoice.owner, invoice.doctor, invoice.consultation_id, invoiceCharges(invoice)].some(value => String(value || '').toLowerCase().includes(query)));
  }).sort((a, b) => (sort === 'oldest' ? 1 : -1) * (new Date(a.issued_at || 0) - new Date(b.issued_at || 0)));
}

export const csvCell = value => `"${String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`;
