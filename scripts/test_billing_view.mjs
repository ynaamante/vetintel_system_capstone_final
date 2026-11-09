import assert from 'node:assert/strict';
import { invoiceBalance, invoicePaymentStatus, filterBillingInvoices, isBillingQueueInvoice, csvCell } from '../admin/src/utils/billingView.js';

const now = new Date(2026, 10, 4);
const invoices = [
  { id: 1, issued_at: '2026-11-04', total: '1000', amount_paid: '0', status: 'issued', pet_id: 7, pet: 'Luna', owner: 'Sarah', doctor: 'Dr. Torres', metadata: { sent_to_reception: true }, items: [{ description: 'Rabies vaccination' }] },
  { id: 2, issued_at: '2026-11-03', total: '200', amount_paid: '100', status: 'issued', pet_id: 8, pet: 'Max', doctor: 'Dr. Chen', metadata: {} },
  { id: 3, issued_at: '2026-10-01', total: '500', amount_paid: '500', status: 'paid', metadata: {} },
  { id: 4, issued_at: '2026-10-02', total: '300', amount_paid: '50', status: 'overdue', metadata: {} },
  { id: 5, issued_at: '2026-10-03', total: '100', amount_paid: '0', status: 'void', metadata: { sent_to_reception: true } },
];
assert.equal(invoiceBalance(invoices[1]), 100);
assert.equal(invoiceBalance({ total: 100, amount_paid: 120 }), 0);
assert.deepEqual(invoices.map(invoice => invoicePaymentStatus(invoice, now)), ['Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Void']);
assert.equal(invoicePaymentStatus({ total: 100, metadata: { due_date: '2026-11-03' } }, now), 'Overdue');
assert.equal(invoicePaymentStatus({ total: 100, metadata: { due_date: '2026-11-04' } }, now), 'Unpaid');
assert.equal(invoicePaymentStatus({ total: 100, amount_paid: 100, status: 'overdue' }, now), 'Paid');
assert.equal(isBillingQueueInvoice(invoices[4]), false);
assert.deepEqual(filterBillingInvoices(invoices, { queueOnly: true }).map(invoice => invoice.id), [1]);
assert.deepEqual(filterBillingInvoices(invoices, { tab: 'Paid' }).map(invoice => invoice.id), [3]);
assert.deepEqual(filterBillingInvoices(invoices, { tab: 'Partially Paid' }).map(invoice => invoice.id), [2]);
assert.deepEqual(filterBillingInvoices(invoices, { search: 'rabies' }).map(invoice => invoice.id), [1]);
assert.deepEqual(filterBillingInvoices(invoices, { pet: '7', doctor: 'Dr. Torres', dateFrom: '2026-11-04', dateTo: '2026-11-04' }).map(invoice => invoice.id), [1]);
assert.deepEqual(filterBillingInvoices(invoices, { dateFrom: '2026-11-03', sort: 'oldest' }).map(invoice => invoice.id), [2, 1]);
assert.equal(csvCell('Pet, "Luna"'), '"Pet, ""Luna"""');
assert.equal(csvCell('=1+1'), '"\'=1+1"');
console.log('Billing view checks passed: balances, payment status, due dates, queue, combined filters, sorting, CSV escaping.');
