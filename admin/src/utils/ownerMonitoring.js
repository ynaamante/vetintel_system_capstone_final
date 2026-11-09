export const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0));
export const clinicDay = value => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : '';
};
export function financialData(data, period = 'Monthly', now = new Date()) {
  const invoices = new Map((data?.invoices || []).map(row => [String(row.id), row]));
  const payments = data?.payments || [];
  const today = clinicDay(now);
  const year = today.slice(0, 4);
  const month = Number(today.slice(5, 7));
  const valid = payments.filter(row => Number(row.amount) > 0 && clinicDay(row.paid_at));
  const sum = rows => rows.reduce((total, row) => total + Number(row.amount), 0);
  const current = valid.filter(row => {
    const day = clinicDay(row.paid_at);
    return day.slice(0, 4) === year && (period === 'Yearly' || (period === 'Quarterly' ? Math.floor((Number(day.slice(5, 7)) - 1) / 3) === Math.floor((month - 1) / 3) : day.slice(0, 7) === today.slice(0, 7)));
  });
  const trend = new Map();
  const services = new Map();
  for (const payment of current) {
    const day = clinicDay(payment.paid_at);
    const key = period === 'Monthly' ? day : day.slice(0, 7);
    const bucket = trend.get(key) || { month: key, revenue: 0, expenses: null, profit: null };
    bucket.revenue += Number(payment.amount); trend.set(key, bucket);
    const invoice = invoices.get(String(payment.invoice_id));
    const items = (invoice?.items || []).filter(item => Number(item.line_total) > 0);
    const total = items.reduce((amount, item) => amount + Number(item.line_total), 0);
    if (!total) services.set('Uncategorized', (services.get('Uncategorized') || 0) + Number(payment.amount));
    else for (const item of items) {
      const name = item.item_type || 'Clinic services';
      services.set(name, (services.get(name) || 0) + Number(payment.amount) * Number(item.line_total) / total);
    }
  }
  return {
    today: sum(valid.filter(row => clinicDay(row.paid_at) === today)),
    monthly: sum(valid.filter(row => clinicDay(row.paid_at).slice(0, 7) === today.slice(0, 7))),
    yearly: sum(valid.filter(row => clinicDay(row.paid_at).slice(0, 4) === year)),
    outstanding: (data?.invoices || []).filter(row => !['void', 'cancelled', 'canceled'].includes(String(row.status).toLowerCase())).reduce((total, row) => total + Math.max(0, Number(row.total || 0) - Number(row.amount_paid || 0)), 0),
    trend: [...trend.values()].sort((a, b) => a.month.localeCompare(b.month)),
    services: [...services].map(([service, revenue]) => ({ service, revenue })),
    transactions: [...current].sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at)).map(row => ({ id: `PAY-${row.id}`, date: row.paid_at, service: (invoices.get(String(row.invoice_id))?.items || []).map(item => item.description).filter(Boolean).join(', ') || `Invoice #${row.invoice_id}`, amount: Number(row.amount), status: 'Completed' })),
  };
}
