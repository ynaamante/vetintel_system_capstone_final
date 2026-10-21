import { useEffect, useMemo, useState } from 'react';
import Topbar from '../../components/Topbar';
import StatusIndicator from '../../components/StatusIndicator';
import { Icons } from '../../icons';
import { canViewFeature } from '../../utils/permissionUtils';
import { formatDateText } from '../../utils/dateFormatting';

function formatCurrency(value) {
  const amount = Number(value || 0);
  if (Number.isNaN(amount)) return '₱0.00';
  return `₱${amount.toFixed(2)}`;
}

function formatDate(value) {
  return formatDateText(value, undefined, '');
}

function StatusBadge({ status }) {
  return <StatusIndicator status={status} />;
}

export default function BillingPage({ user }) {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [inpatientStays, setInpatientStays] = useState([]);
  const [dischargingStay, setDischargingStay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canView = canViewFeature(user.permissions, user.role, 'Billing & Payments');

  useEffect(() => {
    if (!user || !user.token) return;
    if (!canView) return;

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const params = new URLSearchParams();
    if (user.clinic_id) params.set('clinic_id', user.clinic_id);
    const query = params.toString() ? `?${params.toString()}` : '';
    const headers = { Authorization: `Bearer ${user.token}` };

    const loadBilling = async () => {
      setLoading(true);
      setError(null);

      try {
        const [invoicesRes, paymentsRes, staysRes] = await Promise.all([
          fetch(`${apiUrl}/clinic-records/invoices${query}`, { headers }),
          fetch(`${apiUrl}/clinic-records/payments${query}`, { headers }),
          fetch(`${apiUrl}/clinic-records/inpatient-stays${query}`, { headers }),
        ]);

        if (!invoicesRes.ok || !paymentsRes.ok || !staysRes.ok) {
          throw new Error('Failed to load billing data');
        }

        const [invoicesData, paymentsData, staysData] = await Promise.all([
          invoicesRes.json(),
          paymentsRes.json(),
          staysRes.json(),
        ]);

        setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
        setPayments(Array.isArray(paymentsData) ? paymentsData : []);
        setInpatientStays(Array.isArray(staysData) ? staysData : []);
      } catch (err) {
        console.error(err);
        setError('Unable to load billing data from the database.');
        setInvoices([]);
        setPayments([]);
        setInpatientStays([]);
      } finally {
        setLoading(false);
      }
    };

    loadBilling();
  }, [user, canView]);

  const dischargeStay = async stay => {
    if (!window.confirm(`Discharge ${stay.pet || 'this patient'} and stop future daily inpatient charges?`)) return;
    setDischargingStay(stay.id);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const params = new URLSearchParams();
      if (user.clinic_id) params.set('clinic_id', user.clinic_id);
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`${apiUrl}/clinic-records/inpatient-stays/${stay.id}/discharge${query}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + user.token},
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to discharge inpatient stay.');
      setInpatientStays(current => current.map(item => item.id === stay.id ? { ...item, ...payload } : item));
    } catch (dischargeError) {
      console.error(dischargeError);
      setError(dischargeError.message || 'Unable to discharge inpatient stay.');
    } finally {
      setDischargingStay(null);
    }
  };

  const pendingInvoices = useMemo(
    () => invoices.filter((invoice) => String(invoice.status || '').toLowerCase() !== 'paid'),
    [invoices]
  );

  const dueInvoices = useMemo(
    () => invoices.filter((invoice) => ['draft', 'issued', 'overdue'].includes(String(invoice.status || '').toLowerCase())),
    [invoices]
  );

  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const todayRevenue = useMemo(
    () => payments.reduce((sum, payment) => {
      const paidAt = payment.paid_at ? new Date(payment.paid_at) : null;
      const paidDate = paidAt ? `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, '0')}-${String(paidAt.getDate()).padStart(2, '0')}` : null;
      return paidDate === today ? sum + Number(payment.amount || 0) : sum;
    }, 0),
    [payments, today]
  );

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
    <div style={s.main}>
      <Topbar user={user} title="Billing & Payment Processing" subtitle="Process payments and generate receipts" />
      <div style={s.page}>
        <div style={s.pageHd}>
          <div>
            <div style={s.pageTitle}>Billing & Payment Processing</div>
            <div style={s.pageSub}>Process payments, invoices, and receipts from the clinic database</div>
          </div>
        </div>

        <div style={s.statsGrid}>
          {[
            { label: 'Pending Invoices', value: pendingInvoices.length, icon: Icons.clock, iconBg: '#fffbeb', iconColor: '#d97706' },
            { label: "Today's Revenue", value: formatCurrency(todayRevenue), icon: Icons.dollar, iconBg: '#f0fdf4', iconColor: '#16a34a' },
            { label: 'Due Invoices', value: dueInvoices.length, icon: Icons.file, iconBg: '#fef2f2', iconColor: '#dc2626' },
            { label: 'Payments Processed', value: payments.length, icon: Icons.check, iconBg: '#e7f5f2', iconColor: '#005447' },
          ].map((c) => (
            <div key={c.label} style={s.statCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: 17, height: 17, display: 'flex', color: c.iconColor }}>{c.icon}</span>
                </div>
                <div>
                  <div style={{ fontSize: '.7rem', color: '#64748b', fontWeight: 500 }}>{c.label}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2 }}>{c.value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={s.tableTitle}>Pending Invoices ({pendingInvoices.length})</div>
          {loading ? (
            <div style={{ padding: 40, color: '#64748b' }}>Loading billing data…</div>
          ) : error ? (
            <div style={{ padding: 40, color: '#dc2626' }}>{error}</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>{['Invoice ID', 'Date', 'Pet', 'Owner', 'Amount', 'Status', 'Actions'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {pendingInvoices.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...s.td, color: '#64748b' }}>No pending invoices found.</td></tr>
                ) : (
                  pendingInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td style={{ ...s.td, fontWeight: 600 }}>
                        {invoice.id}
                        {Array.isArray(invoice.items) && invoice.items.length > 0 && <details style={{ marginTop: 5, fontSize: '.72rem', fontWeight: 400 }}>
                          <summary style={{ color: '#005447', cursor: 'pointer' }}>View {invoice.items.length} item{invoice.items.length === 1 ? '' : 's'}</summary>
                          <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
                            {invoice.items.map(item => <li key={item.id}>{item.description} · {item.quantity} × {formatCurrency(item.unit_price)} = {formatCurrency(item.line_total)}</li>)}
                          </ul>
                        </details>}
                      </td>
                      <td style={s.tdMuted}>{formatDate(invoice.issued_at)}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{invoice.pet || 'N/A'}</td>
                      <td style={s.td}>{invoice.owner || 'N/A'}</td>
                      <td style={{ ...s.td, color: '#16a34a', fontWeight: 600 }}>{formatCurrency(invoice.total)}</td>
                      <td style={s.td}><StatusBadge status={invoice.status} /></td>
                      <td style={s.td}>
                        <button style={s.processBtn} disabled>
                          <span style={{ width: 13, height: 13, display: 'flex' }}>{Icons.dollar}</span>
                          Process
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={s.tableTitle}>Active Inpatient Stays ({inpatientStays.filter(stay => stay.status === 'active').length})</div>
          <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '.78rem' }}>Daily charges use the clinic catalog price and are added automatically. Discharge the patient to stop future daily charges.</p>
          {loading ? <div style={{ padding: 24, color: '#64748b' }}>Loading inpatient stays…</div>
            : inpatientStays.filter(stay => stay.status === 'active').length === 0
              ? <div style={{ padding: 24, color: '#64748b' }}>No active inpatient stays.</div>
              : <table style={s.table}>
                <thead><tr>{['Patient', 'Owner', 'Service', 'Admitted', 'Daily charge', 'Charged through', 'Action'].map(label => <th key={label} style={s.th}>{label}</th>)}</tr></thead>
                <tbody>{inpatientStays.filter(stay => stay.status === 'active').map(stay => <tr key={stay.id}>
                  <td style={{ ...s.td, fontWeight: 600 }}>{stay.pet || 'Patient'}</td>
                  <td style={s.td}>{stay.owner || 'N/A'}</td>
                  <td style={s.td}>{stay.service_name}</td>
                  <td style={s.tdMuted}>{formatDate(stay.admitted_on)}</td>
                  <td style={{ ...s.td, color: '#005447', fontWeight: 600 }}>{formatCurrency(stay.daily_price)} / day</td>
                  <td style={s.tdMuted}>{formatDate(stay.last_charged_on)}</td>
                  <td style={s.td}><button type="button" disabled={dischargingStay === stay.id} onClick={() => dischargeStay(stay)} style={{ padding: '7px 10px', border: '1px solid #d8e9e1', borderRadius: 7, background: '#fff', color: '#005447', font: 'inherit', fontSize: '.74rem', cursor: 'pointer' }}>{dischargingStay === stay.id ? 'Discharging…' : 'Discharge'}</button></td>
                </tr>)}</tbody>
              </table>}
        </div>

        <div style={s.card}>
          <div style={s.tableTitle}>Recent Payments</div>
          {loading ? (
            <div style={{ padding: 40, color: '#64748b' }}>Loading billing data…</div>
          ) : error ? (
            <div style={{ padding: 40, color: '#dc2626' }}>{error}</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>{['Payment ID', 'Date', 'Pet', 'Owner', 'Amount', 'Method', 'Status'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...s.td, color: '#64748b' }}>No payments have been recorded yet.</td></tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{payment.id}</td>
                      <td style={s.tdMuted}>{formatDate(payment.paid_at)}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{payment.pet || 'N/A'}</td>
                      <td style={s.td}>{payment.owner || 'N/A'}</td>
                      <td style={{ ...s.td, color: '#16a34a', fontWeight: 600 }}>{formatCurrency(payment.amount)}</td>
                      <td style={s.tdMuted}>{payment.method || 'N/A'}</td>
                      <td style={s.td}><StatusBadge status={payment.invoice_status || 'paid'} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  main: { flex: 1, overflowY: 'auto', background: '#f4f6f9' },
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