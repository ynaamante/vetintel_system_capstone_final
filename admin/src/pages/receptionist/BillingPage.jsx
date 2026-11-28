import { usePageState } from '../../utils/usePageState.js';
import { apiFetch as fetch } from '../../utils/apiFetch.js';
import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import PropTypes from 'prop-types';
import DateRangeFilter from '../../components/DateRangeFilter';
import FilterSelect from '../../components/FilterSelect';
import { invoiceBalance, invoiceNumber, invoicePaymentStatus, invoiceCharges, invoiceType, paymentMethodOptions, isBillingQueueInvoice, filterBillingInvoices, csvCell } from '../../utils/billingView';
import './billingPage.css';
import InvoiceReviewPanel from './InvoiceReviewPanel';
import RecordPaymentDialog from './RecordPaymentDialog';
import { localPaymentTime } from '../../utils/billingView';
import { notifySuccess } from '../../utils/notifications';
import Topbar from '../../components/Topbar';
import { canViewFeature, hasAction } from '../../utils/permissionUtils';
import { formatDateText } from '../../utils/dateFormatting';

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number.isNaN(amount) ? 0 : amount);
}

function formatDate(value) {
  return formatDateText(value, undefined, '');
}

function StatusBadge({ status }) {
  return <span className={'billing-payment-badge billing-payment-' + String(status || '').toLowerCase().replaceAll(' ', '-')}>{status}</span>;
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

const doctorAppointmentTypes = [
  'Vaccination', 'Treatment', 'Laboratory', 'Surgery', 'Dental',
  'Check-up', 'Follow-up', 'Confinement', 'Grooming', 'General',
];

export default function BillingPage({ user }) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('All Invoices');
  const [pet, setPet] = useState('all');
  const [doctor, setDoctor] = useState('all');
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [billingStatusFilter, setBillingStatusFilter] = useState('all');
  const [receptionistFilter, setReceptionistFilter] = useState('all');
  const [includeVoided, setIncludeVoided] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [queueOpen, setQueueOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [invoices, setInvoices] = usePageState(user, "pages/receptionist/BillingPage.jsx:invoices", []);
  const [payments, setPayments] = usePageState(user, "pages/receptionist/BillingPage.jsx:payments", []);
  const [processingInvoice, setProcessingInvoice] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'cash', reference: '', paidAt: '', notes: '' });
  const [clinicProfile, setClinicProfile] = usePageState(user, "pages/receptionist/BillingPage.jsx:clinicProfile", null);
  const [clinicStaff, setClinicStaff] = usePageState(user, "pages/receptionist/BillingPage.jsx:clinicStaff", []);
  const [staffLoadError, setStaffLoadError] = usePageState(user, "pages/receptionist/BillingPage.jsx:staffLoadError", '');
  const [paymentError, setPaymentError] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [loading, setLoading] = usePageState(user, "pages/receptionist/BillingPage.jsx:loading", true, "loading");
  const [error, setError] = usePageState(user, "pages/receptionist/BillingPage.jsx:error", null);

  const canView = canViewFeature(user.permissions, user.role, 'Billing & Payments');

  useEffect(() => {
    if (!user || !user.token) return;
    if (!canView) return;

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const params = new URLSearchParams();
    if (user.clinic_id) params.set('clinic_id', user.clinic_id);

    const query = params.toString() ? `?${params.toString()}` : '';
    const headers = { Authorization: `Bearer ${user.token}` };

    let active = true;
    let refreshing = false;
    const loadBilling = async (silent = false) => {
      if (refreshing) return;
      refreshing = true;
      if (!silent) setLoading(true);
      setError(null);

      try {
        const [invoicesRes, paymentsRes] = await Promise.all([
          fetch(`${apiUrl}/clinic-records/invoices${query}`, { headers }),
          fetch(`${apiUrl}/clinic-records/payments${query}`, { headers }),
        ]);

        if (!invoicesRes.ok || !paymentsRes.ok) {
          throw new Error('Failed to load billing data');
        }

        const [invoicesData, paymentsData] = await Promise.all([
          invoicesRes.json(),
          paymentsRes.json(),
        ]);

        if (!active) return;
        setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
        setPayments(Array.isArray(paymentsData) ? paymentsData : []);
      } catch (err) {
        console.error(err);
        setError('Unable to load billing data from the database.');
        setInvoices([]);
        setPayments([]);
      } finally {
        refreshing = false;
        if (active) setLoading(false);
      }
    };

    loadBilling();
    const refresh = () => { if (!document.hidden) loadBilling(true); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('vetintel:billing-updated', refresh);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('vetintel:billing-updated', refresh); window.removeEventListener('focus', refresh); };
  }, [user, canView]);

  useEffect(() => {
    if (!user?.token || !user?.clinic_id || !canView) return undefined;
    const controller = new AbortController();
    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
    fetch(`${apiUrl}/clinics/${encodeURIComponent(user.clinic_id)}`, {
      headers: { Authorization: 'Bearer ' + user.token },
      signal: controller.signal,
    }).then(async response => {
      const profile = await response.json().catch(() => null);
      if (response.ok && !controller.signal.aborted) setClinicProfile(profile);
    }).catch(failure => {
      if (failure.name !== 'AbortError') console.warn('Unable to load clinic receipt details.', failure);
    });
    return () => controller.abort();
  }, [user?.token, user?.clinic_id, canView]);

  useEffect(() => {
    if (!user?.token || !user?.clinic_id || !canView) return undefined;
    const controller = new AbortController();
    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
    fetch(`${apiUrl}/clinics/${encodeURIComponent(user.clinic_id)}/staff?status=active`, {
      headers: { Authorization: 'Bearer ' + user.token },
      signal: controller.signal,
    }).then(async response => {
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Unable to load clinic staff (HTTP ${response.status}).`);
      if (!Array.isArray(payload)) throw new Error('The clinic staff endpoint returned an invalid response.');
      setClinicStaff(payload);
      setStaffLoadError('');
    }).catch(loadError => {
      if (loadError.name === 'AbortError') return;
      setStaffLoadError(loadError.message || 'Unable to load clinic staff.');
    });
    return () => controller.abort();
  }, [user?.token, user?.clinic_id, canView]);

  const openPaymentDialog = invoice => {
    const balance = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
    setProcessingInvoice(invoice);
    setPaymentForm({ amount: balance.toFixed(2), method: 'cash', reference: '', paidAt: localPaymentTime(), notes: '' });
    setPaymentError('');
  };

  const submitPayment = async event => {
    event.preventDefault();
    if (!processingInvoice || savingPayment) return;
    if (!paymentForm.paidAt || Number.isNaN(new Date(paymentForm.paidAt).getTime())) {
      setPaymentError('Select the payment date and time.');
      return;
    }
    setSavingPayment(true);
    setPaymentError('');
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
      const params = new URLSearchParams();
      if (user.clinic_id) params.set('clinic_id', user.clinic_id);
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`${apiUrl}/clinic-records/invoices/${processingInvoice.id}/payments${query}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentForm.amount,
          method: ['cash'].includes(paymentForm.method) ? 'cash'
            : ['credit_card', 'debit_card'].includes(paymentForm.method) ? 'card' : 'transfer',
          payment_channel: paymentForm.method,
          reference: paymentForm.reference,
          paid_at: new Date(paymentForm.paidAt).toISOString(),
          notes: paymentForm.notes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Unable to record payment (HTTP ${response.status}).`);
      setInvoices(current => current.map(invoice => String(invoice.id) === String(payload.invoice.id)
        ? { ...invoice, ...payload.invoice, amount_paid: payload.amount_paid }
        : invoice));
      setPayments(current => [{
        ...payload.payment,
        metadata: { ...payload.payment.metadata, recorded_by: user.id, payment_channel: paymentForm.method },
        pet: processingInvoice.pet,
        owner: processingInvoice.owner,
        invoice_status: payload.invoice.status,
      }, ...current]);
      setProcessingInvoice(null);
      notifySuccess('Payment recorded', invoiceNumber(processingInvoice) + ' has been updated.');
      window.dispatchEvent(new Event('vetintel:billing-updated'));
    } catch (paymentSubmitError) {
      setPaymentError(paymentSubmitError.message || 'Unable to record payment.');
    } finally {
      setSavingPayment(false);
    }
  };

  const liveInvoices = invoices.filter(invoice => invoicePaymentStatus(invoice) !== 'Void');
  const queue = liveInvoices.filter(isBillingQueueInvoice);
  const outstanding = liveInvoices.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);
  const overdue = liveInvoices.filter(invoice => invoicePaymentStatus(invoice) === 'Overdue');
  const billingFilters = { search, pet, doctor, dateFrom, dateTo, type: invoiceTypeFilter, paymentMethod: paymentMethodFilter, billingStatus: billingStatusFilter, receptionist: receptionistFilter, includeVoided, payments };
  const filteredInvoices = filterBillingInvoices(invoices, { ...billingFilters, tab });
  const petOptions = [...new Map(invoices.map(invoice => [String(invoice.pet_id ?? invoice.pet ?? ''), invoice.pet])).entries()].filter(([id, name]) => id && name);
  const clinicVeterinarians = clinicStaff.filter(member => ['doctor', 'veterinarian', 'assistant_doctor'].includes(normalizeRole(member.role)));
  const clinicReceptionists = clinicStaff.filter(member => normalizeRole(member.role) === 'receptionist');
  const doctors = [...new Set([...clinicVeterinarians.map(member => member.name), ...invoices.map(invoice => invoice.doctor)].filter(Boolean))].sort();
  const invoiceTypes = [...new Set([...doctorAppointmentTypes, ...invoices.map(invoiceType).filter(Boolean)])].sort();
  const receptionistIds = [...new Set([
    ...clinicReceptionists.map(member => member.id),
    ...payments.map(payment => payment.metadata?.recorded_by),
  ].filter(value => value !== null && value !== undefined).map(String))].sort();
  const selectOptions = (values, allLabel) => [
    { value: 'all', label: allLabel },
    ...values.map(value => ({ value, label: value })),
  ];
  const billingPaymentOptions = [{ value: 'all', label: 'All Methods' }, ...paymentMethodOptions];
  const billingStatusOptions = selectOptions(['Paid', 'Unpaid', 'Partially Paid', 'Overdue', 'Void'], 'All Statuses');
  const receptionistOptions = [
    { value: 'all', label: 'All Receptionists' },
    ...receptionistIds.map(id => ({
      value: id,
      label: clinicReceptionists.find(member => String(member.id) === id)?.name
        || (String(user.id) === id ? (user.name || user.full_name || 'You') : `Receptionist #${id}`),
    })),
  ];
  const applyBillingFilters = (invoiceList, selectedTab) => filterBillingInvoices(invoiceList, { ...billingFilters, tab: selectedTab });
  const exportInvoices = () => {
    const rows = [['Invoice No.', 'Invoice Date', 'Pet', 'Owner', 'Consultation / Charges', 'Veterinarian', 'Total', 'Paid', 'Outstanding', 'Payment Status', 'Billing Status'], ...filteredInvoices.map(invoice => [invoiceNumber(invoice), formatDate(invoice.issued_at), invoice.pet, invoice.owner, invoiceCharges(invoice), invoice.doctor, invoice.total, invoice.amount_paid, invoiceBalance(invoice), invoicePaymentStatus(invoice), invoice.metadata?.sent_to_reception ? 'Sent to Receptionist' : invoice.status])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = 'billing-invoices.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const printInvoice = invoice => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      const forest = [1, 56, 38];
      const green = [8, 107, 80];
      const mint = [231, 244, 236];
      const border = [172, 199, 184];
      const ink = [25, 39, 32];
      const muted = [76, 91, 82];
      const money = value => 'PHP ' + Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const text = (value, x, y, size = 10, color = ink, style = 'normal', options = {}) => {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
        doc.setTextColor(...color);
        doc.text(Array.isArray(value) ? value.map(line => String(line)) : String(value ?? ''), x, y, options);
      };
      const rounded = (x, y, w, h, radius = 2, fill = [255, 255, 255], stroke = border) => {
        doc.setFillColor(...fill); doc.setDrawColor(...stroke); doc.setLineWidth(.3);
        doc.roundedRect(x, y, w, h, radius, radius, 'FD');
      };
      const drawSectionCard = (x, y, w, h, title) => {
        rounded(x, y, w, h, 2, [255, 255, 255], border);
        doc.setFillColor(...mint); doc.roundedRect(x + .15, y + .15, w - .3, 9, 2, 2, 'F');
        doc.rect(x + .15, y + 5, w - .3, 4.2, 'F');
        text(title, x + 4, y + 6.3, 13, forest, 'bold');
      };
      const clinicName = clinicProfile?.name || user.clinic_name || 'VetIntel Veterinary Clinic';
      const patient = invoice.pet || 'Not recorded';
      const owner = invoice.owner || 'Not recorded';
      const invoicePayments = payments.filter(payment => String(payment.invoice_id) === String(invoice.id));
      const latestPayment = [...invoicePayments].sort((a, b) => new Date(b.paid_at || 0) - new Date(a.paid_at || 0))[0];
      const status = invoicePaymentStatus(invoice);
      const isPaid = Number(invoice.amount_paid || 0) > 0;
      const issuedDate = formatDate(invoice.issued_at) || 'Not recorded';
      const paymentDate = latestPayment?.paid_at
        ? new Date(latestPayment.paid_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
        : 'Not recorded';
      const receiptYear = latestPayment?.paid_at ? new Date(latestPayment.paid_at).getFullYear() : new Date().getFullYear();
      const receiptNumber = latestPayment?.receipt_number || latestPayment?.receipt_no ||
        (latestPayment?.id ? 'PAY-' + receiptYear + '-' + String(latestPayment.id).padStart(6, '0') : invoiceNumber(invoice));
      const cashier = latestPayment?.cashier_name || latestPayment?.received_by || user.name || user.full_name || 'Front Desk';
      const items = invoice.items?.length ? invoice.items : [{ description: invoiceCharges(invoice) || 'Invoice charges', quantity: 1, unit_price: invoice.total, line_total: invoice.total }];
      const subtotal = items.reduce((sum, item) => sum + Number(item.line_total ?? (Number(item.quantity || 0) * Number(item.unit_price || 0))), 0);
      const paid = Number(invoice.amount_paid || 0);
      const total = Number(invoice.total || 0);
      const balance = invoiceBalance(invoice);
      const clinicPhone = clinicProfile?.phone || user.clinic_phone;
      const clinicEmail = clinicProfile?.email || user.clinic_email;
      const clinicTin = clinicProfile?.tin || clinicProfile?.metadata?.tin || clinicProfile?.metadata?.tax_id || user.clinic_tin;
      const clinicDetails = [
        clinicProfile?.address || user.clinic_address,
        clinicPhone ? 'Tel: ' + clinicPhone : '',
        clinicEmail ? 'Email: ' + clinicEmail : '',
        clinicTin ? 'TIN: ' + clinicTin : '',
      ].filter(Boolean);

      // Clinic heading and receipt title.
      const headerLeft = 10;
      text(clinicName, headerLeft, 15, 20, forest, 'bold');
      clinicDetails.slice(0, 4).forEach((detail, index) => text(detail, headerLeft, 22 + index * 5.3, 10, ink));
      const lastDetailY = clinicDetails.length ? 22 + (Math.min(clinicDetails.length, 4) - 1) * 5.3 : 15;
      const ruleY = Math.max(23, lastDetailY + 6);
      doc.setDrawColor(...green); doc.setLineWidth(.7); doc.line(8, ruleY, pageWidth - 8, ruleY);
      const titleY = ruleY + 15;
      text(isPaid ? 'PAYMENT RECEIPT' : 'INVOICE', pageWidth / 2, titleY, 20, forest, 'bold', { align: 'center' });
      text(isPaid ? 'Payment confirmation' : 'Veterinary services invoice', pageWidth / 2, titleY + 7, 10, muted, 'normal', { align: 'center' });

      // Receipt reference, payment date, and cashier strip.
      const metaY = titleY + 14;
      rounded(margin, metaY, contentWidth, 21, 3, [245, 250, 246], border);
      const metaW = contentWidth / 3;
      [['Receipt No.', isPaid ? receiptNumber : invoiceNumber(invoice)], [isPaid ? 'Date of Payment' : 'Invoice Date', isPaid ? paymentDate : issuedDate], ['Cashier', cashier]].forEach(([label, value], index) => {
        const x = margin + metaW * index;
        if (index) { doc.setDrawColor(...border); doc.setLineWidth(.3); doc.line(x, metaY + 3.5, x, metaY + 16.5); }
        text(label, x + 8, metaY + 8, 10.5, forest, 'bold');
        const valueLines = doc.splitTextToSize(String(value), metaW - 16);
        text(valueLines.slice(0, 2), x + 8, metaY + 15, 12, ink, 'bold');
      });

      // Client and pet details.
      const infoY = metaY + 29;
      const gap = 5;
      const infoW = (contentWidth - gap) / 2;
      drawSectionCard(margin, infoY, infoW, 34, 'Client Information');
      drawSectionCard(margin + infoW + gap, infoY, infoW, 34, 'Pet Information');
      const infoRow = (label, value, x, y) => {
        text(label, x, y, 11, muted);
        text(value || 'Not recorded', x + 34, y, 11.5, ink, 'bold');
      };
      infoRow('Received From:', owner, margin + 4, infoY + 17);
      infoRow('Contact No.:', invoice.owner_phone || 'Not recorded', margin + 4, infoY + 24);
      infoRow('Pet Name:', patient, margin + infoW + gap + 4, infoY + 17);
      infoRow('Species:', invoice.species || 'Not recorded', margin + infoW + gap + 4, infoY + 24);
      infoRow('Breed:', invoice.breed || 'Not recorded', margin + infoW + gap + 4, infoY + 31);

      // Itemized charges table.
      let y = infoY + 42;
      const cols = [16, contentWidth - 16 - 27 - 34 - 35, 27, 34, 35];
      const xs = [margin];
      cols.forEach((width, index) => { if (index < cols.length - 1) xs.push(xs[index] + width); });
      const headers = ['No.', 'Description', 'Quantity', 'Unit Price', 'Amount'];
      const tableHeaderY = y;
      y += 10;
      items.forEach((item, index) => {
        const description = doc.splitTextToSize(String(item.description || 'Service / product'), cols[1] - 8);
        const rowH = Math.max(10, description.length * 4 + 5);
        if (y + rowH > pageHeight - 48) { doc.addPage(); y = 18; }
        doc.setDrawColor(...border); doc.setLineWidth(.25); doc.rect(margin, y, contentWidth, rowH, 'S');
        for (let col = 1; col < cols.length; col++) doc.line(xs[col], y, xs[col], y + rowH);
        text(index + 1, xs[0] + cols[0] / 2, y + 6.5, 11.5, ink, 'normal', { align: 'center' });
        text(description.slice(0, 2), xs[1] + 4, y + 6.5, 11.5, ink);
        text(Number(item.quantity || 0), xs[2] + cols[2] / 2, y + 6.5, 11.5, ink, 'normal', { align: 'center' });
        text(money(item.unit_price), xs[3] + cols[3] - 3, y + 6.5, 11.5, ink, 'normal', { align: 'right' });
        text(money(item.line_total), xs[4] + cols[4] - 3, y + 6.5, 11.5, ink, 'normal', { align: 'right' });
        y += rowH;
      });
      // Paint the header last so row grid strokes can never show through it.
      doc.setFillColor(...forest); doc.setDrawColor(...forest); doc.setLineWidth(0);
      doc.roundedRect(margin, tableHeaderY, contentWidth, 10, 2, 2, 'F');
      doc.rect(margin, tableHeaderY + 2, contentWidth, 8, 'F');
      doc.setDrawColor(65, 112, 87); doc.setLineWidth(.25);
      for (let col = 1; col < cols.length; col++) {
        doc.line(xs[col], tableHeaderY, xs[col], tableHeaderY + 10);
      }
      headers.forEach((header, index) => {
        const align = index >= 2 ? 'center' : 'left';
        const x = index === 0 ? xs[index] + 3 : index === 1 ? xs[index] + 4 : xs[index] + cols[index] / 2;
        text(header, x, tableHeaderY + 6.7, 12, [255, 255, 255], 'bold', { align });
      });

      // Payment details and aligned total summary.
      y += 8;
      if (y + 48 > pageHeight - 24) { doc.addPage(); y = 20; }
      const detailsW = (contentWidth - 5) * .52;
      const totalsX = margin + detailsW + 5;
      const totalsW = contentWidth - detailsW - 5;
      drawSectionCard(margin, y, detailsW, 40, 'Payment Details');
      [['Payment Method:', latestPayment?.method || 'Not recorded'], ['Reference No.:', latestPayment?.reference || 'Not recorded'], ['Payment Status:', status]].forEach(([label, value], index) => {
        const rowY = y + 17 + index * 7;
        text(label, margin + 4, rowY, 12, muted);
        text(value || 'Not recorded', margin + 38, rowY, 12.5, ink, 'bold');
      });
      rounded(totalsX, y, totalsW, 40, 2, [255, 255, 255], border);
      const totalRows = [
        ['Subtotal:', subtotal], ['Discount:', Math.max(0, subtotal - total)], ['Total Amount:', total], ['Amount Paid:', paid], ['Balance:', balance],
      ];
      const rowH = 8;
      totalRows.forEach(([label, value], index) => {
        const rowY = y + index * rowH;
        if (index === 2) { doc.setFillColor(...mint); doc.rect(totalsX + .3, rowY + .2, totalsW - .6, rowH, 'F'); }
        if (index) { doc.setDrawColor(220, 230, 223); doc.setLineWidth(.2); doc.line(totalsX + 2, rowY, totalsX + totalsW - 2, rowY); }
        text(label, totalsX + 4, rowY + 5.4, 11.5, ink, index === 2 ? 'bold' : 'normal');
        text(money(value), totalsX + totalsW - 4, rowY + 5.4, 11.5, ink, 'bold', { align: 'right' });
      });

      const footerY = pageHeight - 19;
      doc.setDrawColor(...green); doc.setLineWidth(.45); doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);
      text('Thank you for trusting ' + clinicName + ' with your pet’s care.', pageWidth / 2, footerY, 12, ink, 'normal', { align: 'center' });
      text('This receipt serves as proof of payment.', pageWidth / 2, footerY + 6, 10.5, muted, 'normal', { align: 'center' });
      doc.save((isPaid ? 'receipt-' : 'invoice-') + invoiceNumber(invoice) + '.pdf');
    } catch { setError('Unable to generate the invoice PDF. Please try again.'); }
  };
  if (!canView) {
    return (
      <div style={s.main}>
        <Topbar user={user} title="Billing & Payment Processing" subtitle="Process payments and generate receipts" />
        <div style={s.page}>
          <div style={s.pageHd}>
            <div>
              <div style={s.pageTitle}>Billing & Payment Processing</div>
              <div style={s.pageSub}>You do not have permission to view this page.</div>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: 28, color: '#475569' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Access denied</h2>
            <p style={{ marginTop: 12 }}>Your role (<strong>{user.role}</strong>) does not currently have permission to view Billing & Payments.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.main} className="reception-billing-page">
      <Topbar user={user} title="Billing & Payment Processing" subtitle="Auto-generated bills from consultations; process payments and print receipts." />
      <div style={s.page} className="billing-content">
        <section className="billing-summary" aria-label="Billing totals">
          {[
            { label: 'Total Billed', value: liveInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0), detail: liveInvoices.length + ' issued invoices' },
            { label: 'Collected', value: liveInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid || 0), 0), detail: payments.length + ' payments recorded' },
            { label: 'Outstanding', value: outstanding, detail: liveInvoices.filter(invoice => invoiceBalance(invoice) > 0).length + ' open invoices' },
            { label: 'Overdue', value: overdue.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0), detail: overdue.length + ' past due date' },
          ].map(card => <div className="billing-summary-card" key={card.label}><div><span>{card.label}</span><strong className={card.label === 'Overdue' ? 'billing-overdue' : ''}>{loading ? '-' : formatCurrency(card.value)}</strong><small>{loading ? 'Loading...' : card.detail}</small></div></div>)}
        </section>
        <button type="button" className="billing-queue-banner" aria-expanded={queueOpen} aria-controls="reception-billing-queue" onClick={() => setQueueOpen(value => !value)}>
          <strong>Receptionist Billing Queue</strong><b>{queue.length}</b><span className="billing-queue-description">Bills from doctors that need your action.</span><span className="billing-queue-link">{queueOpen ? 'Collapse Queue' : 'Review Queue'}</span>
        </button>
        <section id="reception-billing-queue" className="billing-invoice-card" aria-label="Receptionist billing queue" hidden={!queueOpen}>
          <div className="billing-table-scroll"><table className="billing-invoice-table billing-queue-table">
            <thead><tr>{['Reference', 'Pet / Owner', 'Consultation', 'Veterinarian', 'Total', 'Date Received', 'Status', ''].map(label => <th key={label} aria-label={label || 'Actions'}>{label}</th>)}</tr></thead>
            <tbody>{loading ? <tr><td colSpan="8" className="billing-empty">Loading billing queue...</td></tr> : queue.length === 0 ? <tr><td colSpan="8" className="billing-empty">{error ? 'Billing data could not be loaded.' : 'No bills are waiting for review.'}</td></tr> : queue.map(invoice => <tr key={invoice.id} className="billing-clickable-row" onClick={event => { if (!event.target.closest('button')) setViewInvoice(invoice); }}>
              <td><strong>{invoiceNumber(invoice)}</strong>{invoice.consultation_id && <small>CON-{String(invoice.consultation_id).padStart(4, '0')}</small>}</td>
              <td><strong>{invoice.pet || 'N/A'}</strong><span className="billing-queue-secondary">{invoice.owner || 'N/A'}</span></td>
              <td className="billing-charges"><strong>{formatDate(invoice.consultation_completed_at || invoice.visit_date || invoice.issued_at)}</strong><span className="billing-queue-secondary">{invoiceCharges(invoice)}</span></td>
              <td>{invoice.doctor || '-'}</td>
              <td className="billing-money"><strong>{formatCurrency(invoice.total)}</strong></td>
              <td>{formatDate(invoice.metadata?.sent_to_reception_at || invoice.issued_at)}</td>
              <td><span className="billing-queue-status">For Payment</span></td>
              <td><button type="button" className="billing-outline-button billing-review-button" aria-label={'Review ' + invoiceNumber(invoice)} onClick={() => setViewInvoice(invoice)}>Review</button></td>
            </tr>)}</tbody>
          </table></div>
        </section>
        <div className="billing-tabs-toolbar">
          <nav className="billing-tabs" aria-label="Filter invoices by payment status">{['All Invoices', 'Paid', 'Unpaid', 'Partially Paid', 'Overdue'].map(label => { const active = tab === label; return <button type="button" key={label} className={active ? 'is-active' : ''} aria-pressed={active} onClick={() => setTab(label)} style={{ minHeight: 40, padding: '8px 17px', border: `1px solid ${active ? '#086b50' : 'transparent'}`, borderRadius: 8, background: active ? '#086b50' : 'transparent', color: active ? '#fff' : '#013826', boxShadow: 'none' }}><span>{label === 'All Invoices' ? 'All' : label}</span><span className="billing-tab-count" style={{ color: active ? '#fff' : '#164b38' }}>{loading ? '-' : applyBillingFilters(invoices, label).length}</span></button>; })}</nav>
          <button type="button" className="billing-primary-button billing-export-button" disabled={loading || !filteredInvoices.length} onClick={exportInvoices}>Export</button>
        </div>
        <div className="billing-filters">
          <label className="billing-search"><input aria-label="Search invoices" placeholder="Search invoice, pet, owner, or consultation..." value={search} onChange={event => setSearch(event.target.value)} /></label>
          <FilterSelect label="Filter invoices by pet" value={pet} onChange={setPet} options={[{ value: 'all', label: 'All Pets' }, ...petOptions.map(([value, label]) => ({ value, label }))]} />
          <div className="billing-date-filter"><span>Invoice Date</span><DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} label="Filter by invoice date" /></div>
          <button type="button" className="billing-outline-button" aria-expanded={advanced} onClick={() => setAdvanced(value => !value)}>Advanced Filters<span className={'lab-date-range-chevron' + (advanced ? ' open' : '')} /></button>
        </div>
        {advanced && <section className="billing-advanced" aria-label="Advanced invoice filters">
          <label><span>Invoice Type</span><FilterSelect className="billing-advanced-select" label="Filter by invoice type" value={invoiceTypeFilter} onChange={setInvoiceTypeFilter} options={selectOptions(invoiceTypes, 'All Types')} /></label>
          <label><span>Payment Method</span><FilterSelect className="billing-advanced-select" label="Filter by payment method" value={paymentMethodFilter} onChange={setPaymentMethodFilter} options={billingPaymentOptions} /></label>
          <label><span>Billing Status</span><FilterSelect className="billing-advanced-select" label="Filter by billing status" value={billingStatusFilter} onChange={setBillingStatusFilter} options={billingStatusOptions} /></label>
          <label><span>Veterinarian</span><FilterSelect className="billing-advanced-select" label="Filter by veterinarian" value={doctor} onChange={setDoctor} options={selectOptions(doctors, 'All Veterinarians')} /></label>
          <label><span>Receptionist</span><FilterSelect className="billing-advanced-select" label="Filter by receptionist" value={receptionistFilter} onChange={setReceptionistFilter} options={receptionistOptions} /></label>
          <label className="billing-voided-toggle">
            <input type="checkbox" checked={includeVoided} onChange={event => setIncludeVoided(event.target.checked)} />
            <span className="billing-voided-switch" aria-hidden="true" />
            <span>Include cancelled / voided invoices</span>
          </label>
          {staffLoadError && <p className="billing-staff-load-error" role="alert">{staffLoadError}</p>}
        </section>}
        {error && <div className="billing-error" role="alert">{error}</div>}
        <p className="billing-matching-count" role="status">{loading ? 'Loading invoices...' : filteredInvoices.length + ' matching invoice' + (filteredInvoices.length === 1 ? '' : 's')}</p>
        <section className="billing-invoice-card" aria-label="Invoices">
          <div className="billing-table-scroll"><table className="billing-invoice-table">
            <thead><tr>{['Invoice No.', 'Invoice Date', 'Pet', 'Owner', 'Consultation / Charges', 'Veterinarian', 'Total', 'Paid', 'Outstanding', 'Payment Status', 'Billing Status', ''].map(label => <th key={label} aria-label={label || 'View invoice'}>{label}</th>)}</tr></thead>
            <tbody>{loading ? <tr><td colSpan="12" className="billing-empty">Loading billing data...</td></tr> : filteredInvoices.length === 0 ? <tr><td colSpan="12" className="billing-empty">{error ? 'Billing data could not be loaded.' : 'No invoices match the selected filters.'}</td></tr> : filteredInvoices.map(invoice => {
              const status = invoicePaymentStatus(invoice);
              return <tr key={invoice.id} className="billing-clickable-row" onClick={event => { if (!event.target.closest('button')) setViewInvoice(invoice); }}>
                <td><strong>{invoiceNumber(invoice)}</strong>{invoice.consultation_id && <small>CON-{String(invoice.consultation_id).padStart(4, '0')}</small>}</td><td>{formatDate(invoice.issued_at).replace(/([A-Za-z]{3})[A-Za-z]+/, '$1')}</td><td><strong>{invoice.pet || 'N/A'}</strong></td><td>{invoice.owner || 'N/A'}</td>
                <td className="billing-charges" title={invoiceCharges(invoice)}>{invoiceCharges(invoice)}</td><td>{invoice.doctor || '-'}</td><td className="billing-money">{formatCurrency(invoice.total)}</td><td className="billing-money">{formatCurrency(invoice.amount_paid)}</td><td className={'billing-money ' + (status === 'Overdue' ? 'billing-overdue' : invoiceBalance(invoice) > 0 ? 'billing-unpaid' : '')}>{formatCurrency(invoiceBalance(invoice))}</td>
                <td><StatusBadge status={status} /></td><td><span className={'billing-workflow' + (invoice.metadata?.sent_to_reception ? ' billing-status-sent' : '')}>{invoice.metadata?.void_request_status === 'pending' ? 'Void Awaiting Approval' : invoice.metadata?.void_request_status === 'approved' ? 'Void Approved' : invoice.metadata?.void_request_status === 'rejected' ? 'Void Rejected' : invoice.metadata?.billing_review_status === 'returned' ? 'Returned for Correction' : invoice.metadata?.billing_review_status === 'issued' ? 'Issued' : invoice.metadata?.sent_to_reception ? 'Sent to Receptionist' : String(invoice.status || 'Issued').replace(/^./, letter => letter.toUpperCase())}</span></td>
                <td><button type="button" className="billing-open-invoice" aria-label={'View ' + invoiceNumber(invoice)} onClick={() => setViewInvoice(invoice)}>&rsaquo;</button></td>
              </tr>;
            })}</tbody>
          </table></div>
        </section>


      </div>

      {viewInvoice && <InvoiceReviewPanel key={viewInvoice.id}
        invoice={invoices.find(invoice => String(invoice.id) === String(viewInvoice.id)) || viewInvoice}
        invoices={invoices}
        payments={payments}
        user={user} onClose={() => setViewInvoice(null)}
        onUpdate={updated => { setViewInvoice(updated); setInvoices(current => current.map(invoice => String(invoice.id) === String(updated.id) ? { ...invoice, ...updated } : invoice)); }}
        onPayment={hasAction(user.permissions,user.role,'Process Payment') ? () => { openPaymentDialog(invoices.find(invoice => String(invoice.id) === String(viewInvoice.id)) || viewInvoice); } : undefined}
        onDownload={() => printInvoice(invoices.find(invoice => String(invoice.id) === String(viewInvoice.id)) || viewInvoice)}
      />}
      {processingInvoice && <RecordPaymentDialog invoice={invoices.find(invoice => String(invoice.id) === String(processingInvoice.id)) || processingInvoice} form={paymentForm} setForm={setPaymentForm} saving={savingPayment} error={paymentError} user={user} onClose={() => { if (!savingPayment) setProcessingInvoice(null); }} onSubmit={submitPayment} />}
    </div>
  );
}

StatusBadge.propTypes = { status: PropTypes.string };
BillingPage.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    full_name: PropTypes.string,
    token: PropTypes.string,
    clinic_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    clinic_name: PropTypes.string,
    role: PropTypes.string,
    permissions: PropTypes.object,
  }).isRequired,
};

const s = {
  main: { flex: 1, overflowY: 'auto', background: 'var(--color-warm-ivory)' },
  page: { padding: '24px 28px' },
  pageHd: { marginBottom: 20 },
  pageTitle: { fontFamily: "'DM Sans',sans-serif", fontSize: '1.3rem', fontWeight: 600, letterSpacing: '-.02em' },
  pageSub: { fontSize: '.78rem', color: '#64748b', marginTop: 3 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 },
  statCard: { background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: '16px 20px' },
  card: { background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: '20px 24px' },
  tableTitle: { fontSize: '.9rem', fontWeight: 600, color: '#0f1117', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: '.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', paddingBottom: 10, borderBottom: '1px solid #f1f5f9' },
  td: { padding: '13px 0', fontSize: '.82rem', color: '#0f1117', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle' },
  tdMuted: { padding: '13px 0', fontSize: '.82rem', color: '#64748b', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle' },
  processBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#f8fafc', border: '1px solid #e8ecf0', borderRadius: 6, fontSize: '.75rem', color: '#0f1117', cursor: 'pointer' },
  receiptBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#f8fafc', border: '1px solid #e8ecf0', borderRadius: 6, fontSize: '.75rem', color: '#0f1117', cursor: 'pointer' },
};
