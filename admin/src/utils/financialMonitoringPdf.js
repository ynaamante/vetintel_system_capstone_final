import { jsPDF } from 'jspdf';
import { clinicDay } from './ownerMonitoring.js';

const colors = {
  ink: [24, 59, 53],
  green: [0, 84, 71],
  muted: [82, 107, 100],
  section: [232, 242, 242],
  tableHeader: [0, 84, 71],
  row: [245, 250, 250],
  border: [199, 219, 217],
  white: [255, 255, 255],
};

const php = value => `PHP ${Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})}`;

const shortMonth = value => new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  timeZone: 'Asia/Manila',
}).format(new Date(`${value}-01T12:00:00+08:00`));

const displayText = value => value === null || value === undefined || value === '' ? 'Not tracked' : String(value);

function buildTrend(data) {
  const now = new Date();
  const today = clinicDay(now);
  const currentMonth = today.slice(0, 7);
  const monthKeys = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(`${currentMonth}-01T12:00:00+08:00`);
    date.setMonth(date.getMonth() - (5 - index));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  const buckets = new Map(monthKeys.map(key => [key, { month: key, revenue: 0, expenses: 0 }]));
  const payments = (data?.payments || []).filter(row => Number(row.amount) > 0 && clinicDay(row.paid_at));
  for (const row of payments) {
    const bucket = buckets.get(clinicDay(row.paid_at).slice(0, 7));
    if (bucket) bucket.revenue += Number(row.amount);
  }

  const expensesAvailable = data?.expenses_available === true && Array.isArray(data?.expenses);
  if (expensesAvailable) {
    for (const row of data.expenses) {
      const date = row.date || row.expense_date || row.paid_at || row.created_at;
      const key = clinicDay(date).slice(0, 7);
      const bucket = buckets.get(key);
      const amount = Number(row.amount ?? row.total);
      if (bucket && Number.isFinite(amount) && amount >= 0) bucket.expenses += amount;
    }
  }

  return {
    expensesAvailable,
    rows: [...buckets.values()].map(row => ({
      ...row,
      profit: expensesAvailable ? row.revenue - row.expenses : null,
    })),
  };
}

function drawTable(doc, { x, y, widths, headers, rows, rowHeight = 7 }) {
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const tableHeight = rowHeight * (rows.length + 1);

  doc.setFillColor(...colors.tableHeader);
  doc.rect(x, y, totalWidth, rowHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(...colors.white);
  let columnX = x;
  headers.forEach((header, index) => {
    doc.text(String(header), columnX + 2, y + 4.7);
    columnX += widths[index];
  });

  rows.forEach((row, rowIndex) => {
    const rowY = y + rowHeight * (rowIndex + 1);
    doc.setFillColor(...colors.row);
    doc.rect(x, rowY, totalWidth, rowHeight, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.ink);
    columnX = x;
    row.forEach((value, index) => {
      const maxWidth = widths[index] - 4;
      const lines = doc.splitTextToSize(displayText(value), maxWidth);
      doc.text(lines[0] || '', columnX + 2, rowY + 4.7);
      columnX += widths[index];
    });
  });

  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.25);
  doc.rect(x, y, totalWidth, tableHeight, 'S');
  let lineX = x;
  widths.slice(0, -1).forEach(width => {
    lineX += width;
    doc.line(lineX, y, lineX, y + tableHeight);
  });
  for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
    const lineY = y + rowHeight * rowIndex;
    doc.line(x, lineY, x + totalWidth, lineY);
  }
}

function drawSectionTitle(doc, title, y) {
  doc.setFillColor(...colors.section);
  doc.roundedRect(15, y - 5, 180, 7.2, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.green);
  doc.text(title.toUpperCase(), 18, y);
}

export function createFinancialMonitoringPdf({ user, data, financial, period }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const reportDate = new Intl.DateTimeFormat('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
  }).format(new Date());
  const clinicName = user?.clinic_name || 'Clinic';
  const { rows: trendRows, expensesAvailable } = buildTrend(data);
  const expensesForPeriod = expensesAvailable
    ? trendRows.filter(row => row.month === clinicDay(new Date()).slice(0, 7)).reduce((sum, row) => sum + row.expenses, 0)
    : null;
  const monthlyRevenue = trendRows.find(row => row.month === clinicDay(new Date()).slice(0, 7))?.revenue || 0;
  const profitMargin = expensesAvailable && monthlyRevenue > 0
    ? `${(((monthlyRevenue - expensesForPeriod) / monthlyRevenue) * 100).toFixed(1)}%`
    : 'Not tracked';

  doc.setFillColor(...colors.white);
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...colors.ink);
  doc.text(clinicName, margin + 2, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.muted);
  doc.text('Financial monitoring report', margin, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...colors.green);
  doc.text('FINANCIAL REPORT', pageWidth - margin, 7.5, { align: 'right' });
  doc.setFontSize(13.5);
  doc.setTextColor(...colors.ink);
  doc.text('Financial Monitoring', pageWidth - margin, 14, { align: 'right' });
  doc.setFillColor(...colors.green);
  doc.roundedRect(pageWidth - margin - 27, 17.5, 27, 7, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setTextColor(...colors.white);
  doc.text(period.toUpperCase(), pageWidth - margin - 13.5, 22.1, { align: 'center' });

  doc.setDrawColor(...colors.green);
  doc.setLineWidth(0.6);
  doc.line(margin, 28, pageWidth - margin, 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.muted);
  doc.text(`Generated ${reportDate}`, margin, 36);
  doc.text(`Reporting period: ${period}`, pageWidth - margin, 36, { align: 'right' });

  drawSectionTitle(doc, 'Financial Summary', 46.5);
  drawTable(doc, {
    x: margin,
    y: 51.5,
    widths: [54, 36, 54, contentWidth - 144],
    headers: ['Metric', 'Amount', 'Metric', 'Amount'],
    rowHeight: 7,
    rows: [
      ["Today's Income", php(financial.today), 'Monthly Income', php(financial.monthly)],
      ['Yearly Income', php(financial.yearly), 'Profit Margin', profitMargin],
    ],
  });

  drawSectionTitle(doc, 'Revenue, Expenses & Profit Trend', 80.5);
  drawTable(doc, {
    x: margin,
    y: 85.5,
    widths: [36, 48, 48, contentWidth - 132],
    headers: ['Month', 'Revenue', 'Expenses', 'Profit'],
    rowHeight: 7,
    rows: trendRows.map(row => [
      shortMonth(row.month), php(row.revenue),
      expensesAvailable ? php(row.expenses) : 'Not tracked',
      expensesAvailable ? php(row.profit) : 'Not tracked',
    ]),
  });

  const serviceLabels = {
    consultation: 'Checkups', checkup: 'Checkups', checkups: 'Checkups',
    vaccination: 'Vaccinations', vaccinations: 'Vaccinations',
    surgery: 'Surgeries', surgeries: 'Surgeries', dental: 'Dental', emergency: 'Emergency',
  };
  const servicesByLabel = new Map();
  for (const row of financial.services) {
    const sourceName = String(row.service);
    const label = serviceLabels[sourceName.toLowerCase()]
      || sourceName.replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    servicesByLabel.set(label, (servicesByLabel.get(label) || 0) + Number(row.revenue || 0));
  }
  const services = [...servicesByLabel]
    .map(([service, revenue]) => ({ service, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  drawSectionTitle(doc, 'Revenue by Service Type', 143);
  drawTable(doc, {
    x: margin,
    y: 148,
    widths: [117, contentWidth - 117],
    headers: ['Service', 'Revenue'],
    rowHeight: 7,
    rows: services.length ? services.map(row => [row.service, php(row.revenue)]) : [['No service revenue recorded', 'PHP 0.00']],
  });

  drawSectionTitle(doc, 'Recent Transactions', 198);
  const transactions = financial.transactions.slice(0, 5);
  drawTable(doc, {
    x: margin,
    y: 203,
    widths: [32, 29, 58, 32, contentWidth - 151],
    headers: ['Transaction ID', 'Date', 'Service', 'Amount', 'Status'],
    rowHeight: 7,
    rows: transactions.length
      ? transactions.map(row => [row.id, formatTransactionDate(row.date), row.service, php(row.amount), row.status])
      : [['No transactions', '', 'No payments recorded', 'PHP 0.00', '-']],
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.25);
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.muted);
  doc.text(clinicName, margin, pageHeight - 6);
  doc.text('Page 1 of 1', pageWidth - margin, pageHeight - 6, { align: 'right' });
  return doc;
}

function formatTransactionDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}
