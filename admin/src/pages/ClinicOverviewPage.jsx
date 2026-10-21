import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Topbar from '../components/Topbar';
import { Icons } from '../icons';
import { formatDateText } from '../utils/dateFormatting';
import { canViewFeature } from '../utils/permissionUtils';

const APPT_TREND = [
  { month: 'January', appointments: 242 },
  { month: 'February', appointments: 278 },
  { month: 'March', appointments: 312 },
  { month: 'April', appointments: 295 },
];

const REVENUE_DATA = [
  { month: 'Jan', revenue: 18500 },
  { month: 'Feb', revenue: 21200 },
  { month: 'Mar', revenue: 25800 },
  { month: 'Apr', revenue: 19800 },
];

const RECENT_ACTIVITY = [
  { name: 'Dr. Michael Torres', action: 'Completed consultation', time: '10 mins ago' },
  { name: 'Emily Rodriguez', action: 'Scheduled new appointment', time: '25 mins ago' },
  { name: 'Dr. Sarah Chen', action: 'Updated vaccination record', time: '1 hour ago' },
  { name: 'Dr. Michael Torres', action: 'Generated monthly report', time: '2 hours ago' },
];

const RESTOCK_REQUESTS = [
  { name: 'Doxycycline 100mg', requestedBy: 'Dr. Torres', time: '1 hour ago', remaining: '18 tablets remaining', level: 'Low', color: '#f59e0b' },
  { name: 'Metronidazole 250mg', requestedBy: 'Dr. Chen', time: '2 hours ago', remaining: '0 tablets remaining', level: 'Out of Stock', color: '#ef4444' },
  { name: 'DHPP Vaccine', requestedBy: 'Dr. Torres', time: '3 hours ago', remaining: '8 vials remaining', level: 'Critical', color: '#f97316' },
];

const TODAY_APPOINTMENTS = [
  { time: '09:00 AM', pet: 'Max', owner: 'John Smith', type: 'Checkup', doctor: 'Dr. Torres' },
  { time: '10:30 AM', pet: 'Luna', owner: 'Sarah Johnson', type: 'Vaccination', doctor: 'Dr. Torres' },
  { time: '11:00 AM', pet: 'Charlie', owner: 'Mike Davis', type: 'Surgery', doctor: 'Dr. Chen' },
  { time: '02:00 PM', pet: 'Bella', owner: 'Emma Wilson', type: 'Dental', doctor: 'Dr. Torres' },
  { time: '03:30 PM', pet: 'Rocky', owner: 'David Brown', type: 'Checkup', doctor: 'Dr. Chen' },
];

const TODAY_REVENUE = [
  { name: 'Consultations', amount: '₱850', percent: '35%' },
  { name: 'Vaccinations', amount: '₱520', percent: '21%' },
  { name: 'Surgeries', amount: '₱680', percent: '28%' },
  { name: 'Dental Services', amount: '₱400', percent: '16%' },
];

const NEW_PATIENTS = [
  { name: 'Buddy', species: 'Dog', breed: 'Beagle', owner: 'Alice Green', registered: '2026-04-27' },
  { name: 'Whiskers', species: 'Cat', breed: 'Siamese', owner: 'Bob White', registered: '2026-04-27' },
  { name: 'Rex', species: 'Dog', breed: 'German Shepherd', owner: 'Carol Black', registered: '2026-04-26' },
];

function OverviewModal({ type, onClose }) {
  if (!type) return null;
  const titles = {
    schedule: ["Today's Appointment Schedule", 'Complete schedule for today (5 appointments)'],
    revenue: ["Today's Revenue Breakdown", 'Total revenue: ₱2,450'],
    patients: ['New Patients', 'Recently registered patients (3 total)'],
  };
  const [title, subtitle] = titles[type];
  return (
    <>
      <div onClick={onClose} style={s.modalBackdrop} />
      <div style={s.overviewModal} role="dialog" aria-modal="true">
        <div style={s.modalHeader}>
          <div>
            <div style={s.modalTitle}>{title}</div>
            <div style={s.modalSubtitle}>{subtitle}</div>
          </div>
          <button type="button" onClick={onClose} style={s.modalClose} aria-label="Close">{Icons.close}</button>
        </div>
        {type === 'schedule' && (
          <div style={s.modalTableWrap}>
            <table style={s.modalTable}>
              <thead><tr>{['Time', 'Pet', 'Owner', 'Type', 'Doctor'].map(head => <th key={head} style={s.modalTh}>{head}</th>)}</tr></thead>
              <tbody>{TODAY_APPOINTMENTS.map(appointment => (
                <tr key={`${appointment.time}-${appointment.pet}`}>
                  <td style={s.modalTd}><strong>{appointment.time}</strong></td><td style={s.modalTd}>{appointment.pet}</td><td style={s.modalTd}>{appointment.owner}</td>
                  <td style={s.modalTd}><span style={s.typeBadge}>{appointment.type}</span></td><td style={{ ...s.modalTd, ...s.doctorCell }}>{appointment.doctor}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {type === 'revenue' && (
          <div style={s.revenueList}>{TODAY_REVENUE.map(item => (
            <div key={item.name} style={s.revenueItem}>
              <div style={s.revenueRow}><strong>{item.name}</strong><div style={s.revenueAmount}>{item.amount}<small style={s.revenuePercent}>{item.percent}</small></div></div>
              <div style={s.revenueTrack}><div style={{ ...s.revenueBar, width: item.percent }} /></div>
            </div>
          ))}</div>
        )}
        {type === 'patients' && (
          <div style={s.modalTableWrap}>
            <table style={s.modalTable}>
              <thead><tr>{['Name', 'Species', 'Breed', 'Owner', 'Registered'].map(head => <th key={head} style={s.modalTh}>{head}</th>)}</tr></thead>
              <tbody>{NEW_PATIENTS.map(patient => (
                <tr key={patient.name}>
                  <td style={s.modalTd}><strong style={s.patientName}><span style={s.patientIcon}>{Icons.pet}</span>{patient.name}</strong></td>
                  <td style={s.modalTd}>{patient.species}</td><td style={s.modalTd}>{patient.breed}</td><td style={s.modalTd}>{patient.owner}</td><td style={{ ...s.modalTd, ...s.doctorCell }}>{formatDateText(patient.registered)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

const StatCard = ({ icon, iconBg, label, value, sub, subColor, compact = false }) => (
  <div style={{ ...s.statCard, ...(compact ? s.compactStatCard : {}) }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ ...s.statIcon, ...(compact ? s.compactStatIcon : {}), background: iconBg }}>
        <span style={{ width: compact ? 16 : 20, height: compact ? 16 : 20, display: 'flex', color: subColor || '#005447' }}>{icon}</span>
      </div>
      <div>
        <div style={s.statLabel}>{label}</div>
        <div style={{ ...s.statValue, ...(compact ? s.compactStatValue : {}) }}>{value}</div>
        {sub && <div style={{ ...s.statSub, color: subColor || '#16a34a' }}>{sub}</div>}
      </div>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 8, padding: '8px 12px', fontSize: '.75rem', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
      <div style={{ color: '#64748b', marginBottom: 3 }}>{label}</div>
      <div style={{ fontWeight: 600, color: '#005447' }}>{payload[0].name} : {payload[0].value}</div>
    </div>
  );
};

const RevenueTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 8, padding: '8px 12px', fontSize: '.75rem', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
      <div style={{ color: '#64748b', marginBottom: 3 }}>{label}</div>
      <div style={{ fontWeight: 600, color: '#0f1117' }}>${payload[0].value.toLocaleString()}</div>
    </div>
  );
};

export default function ClinicOverviewPage({ user, onNavigate }) {
  const [restockRequests, setRestockRequests] = useState(RESTOCK_REQUESTS);
  const [overviewModal, setOverviewModal] = useState(null);
  const canView = canViewFeature(user.permissions, user.role, 'Clinic Overview');

  if (!canView) {
    return (
      <div style={s.main}>
        <Topbar user={user} title="Clinic Overview" subtitle="Comprehensive clinic performance and activity dashboard" />
        <div style={s.page}>
          <div style={s.accessDenied}>
            <div style={s.accessDeniedTitle}>Access Denied</div>
            <div style={s.accessDeniedMessage}>You do not have permission to view Clinic Overview.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.main}>
      <Topbar user={user} title="Clinic Overview" subtitle="Comprehensive clinic performance and activity dashboard" />
      <div style={s.page}>

        {/* STAT CARDS */}
        <div style={s.statsGrid}>
          <StatCard
            iconBg="#e7f5f2" icon={Icons.users}
            label="Total Patients" value="1,247"
            sub="↗ +12% this month" subColor="#16a34a"
          />
          <StatCard
            iconBg="#f0fdf4" icon={Icons.calendar}
            label="Appointments" value="298"
            sub="↘ -5% vs last month" subColor="#dc2626"
          />
          <StatCard
            iconBg="#faf5ff" icon={Icons.users}
            label="Active Users" value="4"
            sub="2 Doctors, 2 Staff" subColor="#64748b"
          />
          <StatCard
            iconBg="#fffbeb" icon={Icons.bell}
            label="Pending Vaccinations" value="43"
            sub="Due within 7 days" subColor="#d97706"
          />
        </div>

        <div style={s.inventoryStats}>
          <StatCard compact iconBg="#e7f5f2" icon={Icons.archive} label="Inventory Value" value="₱286,450" sub="" subColor="#005447" />
          <StatCard compact iconBg="#fffbeb" icon={Icons.archive} label="Low Stock Items" value="6" sub="" subColor="#d97706" />
          <StatCard compact iconBg="#fff1f2" icon={Icons.xCircle} label="Out of Stock" value="1" sub="" subColor="#dc2626" />
          <StatCard compact iconBg="#fff7ed" icon={Icons.clock} label="Expiring Medicines" value="4" sub="" subColor="#ea580c" />
          <StatCard compact iconBg="#faf5ff" icon={Icons.archive} label="Pending Restock" value="3" sub="" subColor="#9333ea" />
        </div>

        <section style={s.restockPanel}>
          <div style={s.restockHeader}>
            <div style={s.restockTitle}><span style={s.restockIcon}>{Icons.archive}</span><strong>Pending Restock Requests</strong><span style={s.countBadge}>{restockRequests.length}</span></div>
            <button type="button" style={s.manageButton} onClick={() => onNavigate?.('inventory')}>Manage Inventory</button>
          </div>
          <div style={s.restockList}>
            {restockRequests.map((request) => (
              <div key={request.name} style={s.restockRow}>
                <span style={{ ...s.requestDot, background: request.color }} />
                <div style={s.requestInfo}><strong style={s.requestName}>{request.name}</strong><span style={s.requestMeta}>Requested by {request.requestedBy} · {request.time} · {request.remaining}</span></div>
                <span style={{ ...s.levelBadge, color: request.color, background: `${request.color}18` }}>{request.level}</span>
              </div>
            ))}
            {!restockRequests.length && <div style={s.noRequests}>No pending restock requests.</div>}
          </div>
        </section>

        {/* REVENUE OVERVIEW */}
        <div style={s.chartsRow}>
          <div style={{ ...s.card, flex: 1 }}>
            <div style={s.cardTitle}>Revenue Overview</div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={REVENUE_DATA} barSize={52}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<RevenueTooltip />} />
                <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div style={s.chartsRow}>
          {/* Today's Overview */}
          <div style={{ ...s.card, flex: 1 }}>
            <div style={{ ...s.cardTitle, marginBottom: 16 }}>Today's Overview</div>
            <div style={{ ...s.todayItem, ...s.todayAppointments }}>
              <div style={s.todayLeft}>
                <div style={{ ...s.todayIcon, background: '#e7f5f2' }}>
                  <span style={{ width: 16, height: 16, display: 'flex', color: '#005447' }}>{Icons.calendar}</span>
                </div>
                <div>
                  <div style={s.todayLabel}>Today's Appointments</div>
                  <div style={s.todayVal}>12</div>
                </div>
              </div>
              <button type="button" style={s.todayBtn} onClick={() => setOverviewModal('schedule')}>View Schedule</button>
            </div>
            <div style={{ ...s.todayItem, ...s.todayRevenue }}>
              <div style={s.todayLeft}>
                <div style={{ ...s.todayIcon, background: '#f0fdf4' }}>
                  <span style={{ width: 16, height: 16, display: 'flex', color: '#16a34a' }}>{Icons.dollar}</span>
                </div>
                <div>
                  <div style={s.todayLabel}>Today's Revenue</div>
                  <div style={s.todayVal}>₱2,450</div>
                </div>
              </div>
              <button type="button" style={s.todayBtn} onClick={() => setOverviewModal('revenue')}>View Details</button>
            </div>
            <div style={{ ...s.todayItem, ...s.todayPatients, borderBottom: 'none' }}>
              <div style={s.todayLeft}>
                <div style={{ ...s.todayIcon, background: '#faf5ff' }}>
                  <span style={{ width: 16, height: 16, display: 'flex', color: '#7c3aed' }}>{Icons.users}</span>
                </div>
                <div>
                  <div style={s.todayLabel}>New Patients</div>
                  <div style={s.todayVal}>3</div>
                </div>
              </div>
              <button type="button" style={s.todayBtn} onClick={() => setOverviewModal('patients')}>View List</button>
            </div>
            <OverviewModal type={overviewModal} onClose={() => setOverviewModal(null)} />
          </div>

          {/* Recent Activity */}
          <div style={{ ...s.card, flex: 1 }}>
            <div style={{ ...s.cardTitle, marginBottom: 16 }}>Recent Activity</div>
            {RECENT_ACTIVITY.map((a, i) => (
              <div key={i} style={{ ...s.activityItem, borderBottom: i < RECENT_ACTIVITY.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div style={s.activityIcon}>
                  <span style={{ width: 13, height: 13, display: 'flex', color: '#64748b' }}>{Icons.activity}</span>
                </div>
                <div>
                  <div style={s.activityName}>{a.name}</div>
                  <div style={s.activityAction}>{a.action}</div>
                  <div style={s.activityTime}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

const s = {
  main: { flex: 1, overflowY: 'auto', background: '#f8fafc' },
  page: { padding: '28px 20px 40px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 20 },
  inventoryStats: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 20 },
  accessDenied: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '56vh', padding: '40px', background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb' },
  accessDeniedTitle: { fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginBottom: 10 },
  accessDeniedMessage: { fontSize: '1rem', color: '#6b7280' },
  statCard: { minWidth: 0, background: '#fff', border: '1px solid #dfe4ea', borderRadius: 12, padding: '20px 23px' },
  compactStatCard: { padding: '18px 23px' },
  statIcon: { width: 48, height: 48, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  compactStatIcon: { width: 32, height: 32, borderRadius: 9 },
  statLabel: { fontSize: '.78rem', color: '#64748b', marginBottom: 5, whiteSpace: 'nowrap' },
  statValue: { fontFamily: "'DM Sans', sans-serif", fontSize: '1.7rem', fontWeight: 700, color: '#0f1117', letterSpacing: '-.03em', lineHeight: 1 },
  compactStatValue: { fontSize: '1.15rem' },
  statSub: { fontSize: '.72rem', marginTop: 7, whiteSpace: 'nowrap' },
  chartsRow: { display: 'flex', gap: 14, marginBottom: 20 },
  card: { background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: '20px 22px' },
  restockPanel: { background: '#fffdf7', border: '1px solid #f8d77a', borderRadius: 14, padding: '20px 20px 21px', marginBottom: 20 },
  restockHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  restockTitle: { display: 'flex', alignItems: 'center', gap: 8, color: '#292524', fontSize: '.9rem' },
  restockIcon: { width: 15, height: 15, display: 'flex', color: '#ea580c' },
  countBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 22, height: 20, borderRadius: 6, background: '#fef3c7', color: '#d97706', fontSize: '.7rem', fontWeight: 700 },
  manageButton: { padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 7, background: '#fff', color: '#334155', fontSize: '.75rem', fontWeight: 600, cursor: 'pointer' },
  restockList: { display: 'grid', gap: 8 },
  restockRow: { display: 'flex', alignItems: 'center', gap: 10, minHeight: 50, padding: '8px 10px', border: '1px solid #f8e7b4', borderRadius: 9, background: '#fff' },
  requestDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  requestInfo: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 },
  requestName: { color: '#334155', fontSize: '.78rem' },
  requestMeta: { color: '#64748b', fontSize: '.68rem' },
  levelBadge: { borderRadius: 7, padding: '4px 8px', fontSize: '.66rem', fontWeight: 700, whiteSpace: 'nowrap' },
  approveButton: { display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 7, padding: '6px 10px', background: '#16a34a', color: '#fff', fontSize: '.7rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  declineButton: { border: '1px solid #fecaca', borderRadius: 7, padding: '5px 10px', background: '#fff', color: '#ef4444', fontSize: '.7rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  noRequests: { padding: 16, textAlign: 'center', color: '#64748b', fontSize: '.8rem' },
  cardTitle: { fontSize: '.88rem', fontWeight: 600, color: '#0f1117', letterSpacing: '-.01em', marginBottom: 16 },
  todayItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px', marginBottom: 16, borderRadius: 10, borderBottom: 'none' },
  todayAppointments: { background: '#e7f5f2' },
  todayRevenue: { background: '#f0fdf4' },
  todayPatients: { background: '#faf5ff', marginBottom: 0 },
  todayLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  todayIcon: { width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  todayLabel: { fontSize: '.75rem', color: '#64748b' },
  todayVal: { fontSize: '1.1rem', fontWeight: 600, color: '#0f1117', marginTop: 1 },
  todayBtn: { padding: '7px 14px', background: '#fff', border: '1px solid #e8ecf0', borderRadius: 8, fontSize: '.78rem', fontWeight: 500, color: '#0f1117', cursor: 'pointer' },
  activityItem: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 0' },
  activityIcon: { width: 28, height: 28, borderRadius: 7, background: '#f4f6f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  activityName: { fontSize: '.82rem', fontWeight: 500, color: '#0f1117' },
  activityAction: { fontSize: '.75rem', color: '#64748b', marginTop: 1 },
  activityTime: { fontSize: '.68rem', color: '#64748b', marginTop: 2 },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, .42)', zIndex: 100 },
  overviewModal: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 695, maxWidth: 'calc(100vw - 32px)', background: '#fff', borderRadius: 8, zIndex: 101, boxShadow: '0 20px 60px rgba(15, 23, 42, .22)', overflow: 'hidden' },
  modalHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 22px 16px' },
  modalTitle: { color: '#111827', fontSize: '1.05rem', fontWeight: 600 },
  modalSubtitle: { color: '#718096', fontSize: '.76rem', marginTop: 7 },
  modalClose: { width: 24, height: 24, padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', background: '#fff', border: '1px solid #b8c0ca', borderRadius: 6, cursor: 'pointer' },
  modalTableWrap: { padding: '20px 22px 22px', overflowX: 'auto' },
  modalTable: { width: '100%', borderCollapse: 'collapse', minWidth: 610, color: '#1f2937', fontSize: '.78rem' },
  modalTh: { textAlign: 'left', padding: '10px 7px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#111827' },
  modalTd: { padding: '10px 7px', borderBottom: '1px solid #e5e7eb' },
  typeBadge: { display: 'inline-flex', padding: '3px 9px', border: '1px solid #dce2e8', borderRadius: 7, color: '#1f2937', fontSize: '.68rem' },
  doctorCell: { color: '#506480' },
  revenueList: { padding: '12px 22px 22px', display: 'grid', gap: 15 },
  revenueItem: { padding: '20px 16px', background: '#f6f8fb', borderRadius: 10 },
  revenueRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', color: '#172033', fontSize: '.82rem' },
  revenueAmount: { color: '#00a63c', fontSize: '1.45rem', fontWeight: 700, textAlign: 'right', lineHeight: 1 },
  revenuePercent: { display: 'block', marginTop: 4, color: '#506480', fontSize: '.68rem', fontWeight: 400, lineHeight: 1 },
  revenueTrack: { height: 8, marginTop: 12, background: '#dfe7f1', borderRadius: 6, overflow: 'hidden' },
  revenueBar: { height: '100%', background: '#00a63c', borderRadius: 6 },
  patientName: { display: 'inline-flex', alignItems: 'center', gap: 7 },
  patientIcon: { width: 16, height: 16, display: 'flex', color: '#a855f7' },
};
