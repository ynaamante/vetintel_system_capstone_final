import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import jsPDF from 'jspdf';
import Topbar from '../../components/Topbar';
import StatusIndicator from '../../components/StatusIndicator';
import { VaccinationVerificationDialog } from '../../components/VaccinationRecordDrawer';
import FilterSelect from '../../components/FilterSelect';
import LabDateTimePicker, { getUnavailableAppointmentTimes } from '../../components/LabDateTimePicker';
import { ModalDialog, ModalHeader, ModalTitle, ModalDescription, ModalFooter, ModalStepper } from '../../components/ModalDialog';
import { Icons } from '../../icons';
import { canViewFeature } from '../../utils/permissionUtils';
import { notifySuccess } from '../../utils/notifications';
import { validateOwnerFields } from '../../utils/validation';
import { CLINIC_MOCK_DATA } from '../../data/clinicMockData';
import { formatDateText, formatDateTimeText } from '../../utils/dateFormatting';

// ── DATA ──────────────────────────────────────────────────────────────
const APPOINTMENTS = [
  { id: 'APT-001', datetime: 'March 18, 2026 09:00 AM', pet: 'Max',    owner: 'John Smith',    type: 'Checkup',    status: 'confirmed', notes: 'Annual checkup' },
  { id: 'APT-002', datetime: 'March 18, 2026 10:30 AM', pet: 'Luna',   owner: 'Sarah Johnson', type: 'Vaccination', status: 'confirmed', notes: 'Distemper vaccine' },
  { id: 'APT-003', datetime: 'March 18, 2026 11:00 AM', pet: 'Charlie',owner: 'Mike Davis',    type: 'Surgery',    status: 'pending',   notes: 'Dental cleaning' },
  { id: 'APT-004', datetime: 'March 18, 2026 02:00 PM', pet: 'Bella',  owner: 'Emma Wilson',   type: 'Dental',     status: 'confirmed', notes: 'Routine dental' },
  { id: 'APT-005', datetime: 'March 18, 2026 03:30 PM', pet: 'Rocky',  owner: 'David Brown',   type: 'Checkup',    status: 'confirmed', notes: 'Annual checkup' },
];

const OWNERS = [
  { id: 'OWN-001', name: 'John Smith',    phone: '+1 555-0101', email: 'john.smith@email.com',  address: '123 Main St, Springfield', pets: 2 },
  { id: 'OWN-002', name: 'Sarah Johnson', phone: '+1 555-0102', email: 'sarah.j@email.com',      address: '456 Oak Ave, Springfield',  pets: 1 },
  { id: 'OWN-003', name: 'Mike Davis',    phone: '+1 555-0103', email: 'mike.davis@email.com',   address: '789 Pine Rd, Springfield',  pets: 3 },
];

const PETS = [
  { id: 'PET-001', name: 'Max',     species: 'Dog', breed: 'Golden Retriever', owner: 'John Smith',    age: '3 years',   lastVisit: 'March 1, 2026',   status: 'up-to-date' },
  { id: 'PET-002', name: 'Luna',    species: 'Cat', breed: 'Persian',          owner: 'Sarah Johnson', age: '5 months',  lastVisit: 'February 28, 2026',    status: 'high-risk'  },
  { id: 'PET-003', name: 'Charlie', species: 'Dog', breed: 'Labrador',         owner: 'Mike Davis',    age: '7 years',   lastVisit: 'January 15, 2026',    status: 'moderate'   },
];

const SAMPLE_TREATMENT_PLAN = {
  id: 'SAMPLE-PLAN-001',
  isMock: true,
  status: 'active',
  title: 'Acute Gastroenteritis Support (Sample)',
  pet: 'Milo (Sample Patient)',
  species: 'Dog',
  age: '4 years',
  owner: 'Jordan Lee (Sample Owner)',
  diagnosis: 'Acute gastroenteritis with mild dehydration',
  diagnosisConfirmation: 'Example assessment based on history and physical examination',
  severity: 'Moderate',
  weight: '12.4 kg',
  allergies: 'No known allergies (sample)',
  isolationRequired: false,
  reportedToDiseaseMonitoring: false,
  sex: 'Male, neutered',
  vaccines: 'Up to date (sample)',
  consent: 'Signed (sample)',
  homeCareInstructions: 'Sent (sample)',
  estimate: '₱1,850.00 (sample estimate)',
  monitoring: {
    temperature: '38.7 °C',
    temperatureStatus: 'Within expected range',
    weight: '12.4 kg',
    hydration: 'Mildly dehydrated · improving',
    appetite: 'Reduced · monitor',
    whiteBloodCellCount: '14.2 × 10⁹/L',
    whiteBloodCellStatus: 'Slightly elevated · recheck if symptoms persist',
    lastUpdatedAt: '2026-10-11T10:30:00',
    latestObservation: 'Pet is responding to supportive care. Continue monitoring appetite and hydration at the next assessment.',
    observations: [
      {
        date: '2026-10-11T10:30:00',
        author: 'Dr. A. Rivera (Sample)',
        text: 'Pet is responding to supportive care. Continue monitoring appetite and hydration at the next assessment.',
        temperature: '38.7 °C',
        weight: '12.4 kg',
        hydration: 'Mildly dehydrated · improving',
        appetite: 'Reduced · monitor',
      },
    ],
  },
  doctor: 'Dr. A. Rivera (Sample)',
  created: 'October 5, 2026',
  followUp: 'October 12, 2026',
  nextActionDue: 'October 6, 2026',
  completedSteps: 1,
  totalSteps: 4,
  stepDetails: [
    { title: 'Initial assessment and hydration check', detail: 'Review vomiting, stool, appetite, and hydration.', assignee: 'Dr. A. Rivera (Sample)', completedAt: 'October 5, 2026' },
    { title: 'Start supportive care', detail: 'Provide prescribed fluids and gastrointestinal diet instructions.', assignee: 'Dr. A. Rivera (Sample)', due: 'October 6, 2026' },
    { title: 'Monitor response at home', detail: 'Record appetite, water intake, vomiting, and stool changes.', assignee: 'Jordan Lee (Sample Owner)', due: 'October 8, 2026' },
    { title: 'Veterinary follow-up', detail: 'Reassess hydration and recovery; escalate if symptoms worsen.', assignee: 'Dr. A. Rivera (Sample)', due: 'October 12, 2026' },
  ],
  medications: [
    { name: 'Maropitant', dose: '24 mg', route: 'Oral', frequency: 'Once daily for 3 days', duration: '3 days', day: 'Day 1 of 3', nextDue: 'October 6, 2026 · 9:00 AM', status: 'In Progress' },
    { name: 'Probiotic supplement', dose: '1 sachet', route: 'Oral', frequency: 'Once daily for 5 days', duration: '5 days', day: 'Day 1 of 5', nextDue: 'October 6, 2026 · with food', status: 'In Progress' },
  ],
  pastMedications: [],
  clinicalUpdates: [
    { date: 'October 5, 2026 · 10:30 AM', author: 'Dr. A. Rivera (Sample)', text: 'Sample update: mild dehydration noted. Supportive care and home monitoring discussed with the owner.' },
  ],
};

const VACCINATIONS = CLINIC_MOCK_DATA.vaccinations;
const TREATMENTS = CLINIC_MOCK_DATA.treatments;
const LAB_RESULTS = CLINIC_MOCK_DATA.labResults;

function formatClinicDate(value) {
  if (!value || value === '—') return '—';
  const rawValue = String(value);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawValue);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(rawValue);
  if (Number.isNaN(date.getTime())) return rawValue;
  return formatDateText(date, 'en-US', rawValue);
}

function formatShortClinicDate(value) {
  if (!value || value === '—') return 'Date not recorded';
  const rawValue = String(value);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawValue);
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(rawValue);
  return Number.isNaN(date.getTime()) ? rawValue : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function normalizeVaccineName(value) {
  return String(value || '').toLowerCase()
    .replace(/\b(dog|canine|cat|feline|vaccine|vaccination|vax)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function clinicDateKey(value) {
  if (!value) return '';
  const rawValue = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) return rawValue;
  const date = new Date(rawValue);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function getLocalDateTimeInputValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function calculatePatientAge(value) {
  if (!value) return '';
  const dateText = String(value).slice(0, 10);
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(dateText)
    ? new Date(`${dateText}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(birthDate.getTime())) return '';
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  if (today.getDate() < birthDate.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years < 0) return '';
  return years ? `${years} yr${months ? ` ${months} mo` : ''}` : `${months} mo`;
}

function normalizeLabPatient(patient) {
  const patientId = patient.databasePetId || patient.id;
  const birthDate = patient.birth_date || patient.birthDate || '';
  const age = birthDate ? calculatePatientAge(birthDate) : patient.age || '';
  const recordedSex = patient.sex || patient.gender || '';
  const rawDisplayId = patient.patientId || patient.displayId || patient.id || patientId;
  const displayId = /^\d+$/.test(String(rawDisplayId))
    ? `P-${String(rawDisplayId).padStart(4, '0')}`
    : String(rawDisplayId);
  return {
    ...patient,
    id: patientId,
    displayId,
    name: patient.name || '',
    species: patient.species || 'Not recorded',
    breed: patient.breed || 'Not recorded',
    sex: !recordedSex || /^(unknown|not recorded)$/i.test(recordedSex) ? 'Not recorded' : recordedSex,
    reproductiveStatus: patient.reproductiveStatus || patient.reproductive_status || patient.metadata?.reproductive_status || '',
    birthDate,
    age,
    owner: typeof patient.owner === 'string'
      ? patient.owner
      : patient.owner?.name || patient.owner_name || 'Not recorded',
    ownerPhone: patient.ownerPhone || patient.owner?.phone || patient.phone || '',
    ownerEmail: patient.ownerEmail || patient.owner?.email || patient.email || '',
  };
}

function calculateMedicationEndDate(startDate, duration) {
  const durationMatch = String(duration || '').trim().match(/^(\d+)\s*(day|week|month)s?$/i);
  if (!startDate || !durationMatch) return '';
  const durationCount = Number(durationMatch[1]);
  if (durationCount < 1) return '';
  const unit = durationMatch[2].toLowerCase();
  const date = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return '';
  if (unit === 'day') date.setUTCDate(date.getUTCDate() + durationCount - 1);
  if (unit === 'week') date.setUTCDate(date.getUTCDate() + durationCount * 7 - 1);
  if (unit === 'month') {
    const originalDay = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + durationCount);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(originalDay, lastDay));
  }
  return date.toISOString().slice(0, 10);
}

function formatMonitoringDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : formatDateTimeText(date, 'en-US', String(value));
}

function normalizeVaccination(v) {
  const dueValue = v.nextDue || v.next_due;
  let status = v.status;
  const isVerified = v.verified ?? v.clinic_verified ?? v.clinicVerified ?? false;
  if (isVerified && ['scheduled', 'administered'].includes(String(status || '').toLowerCase())) {
    const due = dueValue ? new Date(`${String(dueValue).slice(0, 10)}T00:00:00`) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    status = due && !Number.isNaN(due.getTime()) && due < today ? 'overdue' : 'up-to-date';
  }
  if (!status && dueValue) {
    const due = new Date(`${String(dueValue).slice(0, 10)}T00:00:00`);
    if (!Number.isNaN(due.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / 86400000);
      status = daysUntilDue < 0 ? 'overdue' : daysUntilDue <= 30 ? 'due-soon' : 'up-to-date';
    }
  }
  return {
    ...v,
    id: v.id || v.vaccination_id,
    pet: v.pet || v.pet_name || '—',
    photo_url: v.photo_url || v.pet_photo_url || v.petPhotoUrl || '',
    type: v.type || v.vaccine_name || '—',
    dateGiven: v.dateGiven || v.date_given || '—',
    nextDue: dueValue || '—',
    attendingDoctor: v.attendingDoctor || v.attending_doctor || v.administered_by_name || v.administered_by || v.by || '—',
    createdBy: v.createdBy || v.created_by || v.created_by_name || v.administered_by_name || v.by || '—',
    lastUpdatedBy: v.lastUpdatedBy || v.last_updated_by || v.administered_by_name || v.by || '—',
    dateCreated: v.dateCreated || v.date_created || v.created_at || '—',
    linkedPatient: v.linkedPatient || v.linked_patient || (v.pet && v.owner ? `${v.pet} (${v.owner})` : v.pet) || '—',
    pet_id: v.pet_id,
    stickerUrl: v.sticker_url || v.stickerUrl || '',
    stickerFilename: v.sticker_filename || v.stickerFilename || '',
    status: status || 'unknown',
    clinicVerified: v.verified ?? v.clinic_verified ?? v.clinicVerified ?? false,
  };
}

const CLINIC_INVENTORY = [
  { name: 'Amoxicillin 500mg', category: 'Medication', stock: '240 tablets', quantity: 240, expiry: '2027-06-30', status: 'Healthy Stock' },
  { name: 'Doxycycline 100mg', category: 'Medication', stock: '18 tablets', quantity: 18, expiry: '2027-03-15', status: 'Low Stock' },
  { name: 'Metronidazole 250mg', category: 'Medication', stock: '0 tablets', quantity: 0, expiry: '2026-12-01', status: 'Out of Stock' },
  { name: 'Meloxicam Oral 1.5mg/ml', category: 'Medication', stock: '12 bottles', quantity: 12, expiry: '2026-09-20', status: 'Expiring Soon' },
  { name: 'Enrofloxacin 50mg', category: 'Medication', stock: '95 tablets', quantity: 95, expiry: '2027-01-10', status: 'Healthy Stock' },
  { name: 'Rabies Vaccine (IMRAB)', category: 'Vaccine', stock: '22 vials', quantity: 22, expiry: '2026-11-30', status: 'Healthy Stock' },
  { name: 'DHPP (Distemper Combo)', category: 'Vaccine', stock: '8 vials', quantity: 8, expiry: '2026-08-15', status: 'Critical Stock' },
  { name: 'Feline Distemper (FVRCP)', category: 'Vaccine', stock: '15 vials', quantity: 15, expiry: '2026-10-01', status: 'Expiring Soon' },
  { name: 'Bordetella Intranasal', category: 'Vaccine', stock: '30 doses', quantity: 30, expiry: '2027-02-28', status: 'Healthy Stock' },
  { name: 'Leptospirosis 4-way', category: 'Vaccine', stock: '5 vials', quantity: 5, expiry: '2026-07-31', status: 'Critical Stock' },
  { name: 'Syringes 5ml', category: 'Supply', stock: '500 pieces', quantity: 500, expiry: 'N/A', status: 'Healthy Stock' },
  { name: 'Exam Gloves (Medium)', category: 'Supply', stock: '80 pairs', quantity: 80, expiry: 'N/A', status: 'Reorder Soon' },
];

const CONSULTATION_PETS = ['Max — John Smith', 'Luna — Sarah Johnson', 'Charlie — Mike Davis'];
const CONSULTATION_SERVICES = [
  { name: 'General Consultation', charge: 850 },
  { name: 'Vaccination Consultation', charge: 650 },
  { name: 'Dental Examination', charge: 1200 },
];
const CONSULTATION_ITEMS = [
  { name: 'Amoxicillin 500mg', category: 'Medication', unit: 'tablets' },
  { name: 'Doxycycline 100mg', category: 'Medication', unit: 'tablets' },
  { name: 'Metronidazole 250mg', category: 'Medication', unit: 'tablets' },
  { name: 'Meloxicam Oral 1.5mg/ml', category: 'Medication', unit: 'mls' },
  { name: 'Enrofloxacin 50mg', category: 'Medication', unit: 'tablets' },
  { name: 'Rabies Vaccine (IMRAB)', category: 'Vaccine', unit: 'vials' },
  { name: 'DHPP (Distemper Combo)', category: 'Vaccine', unit: 'vials' },
  { name: 'Feline Distemper (FVRCP)', category: 'Vaccine', unit: 'vials' },
  { name: 'Bordetella Intranasal', category: 'Vaccine', unit: 'doses' },
  { name: 'Leptospirosis 4-way', category: 'Vaccine', unit: 'vials' },
  { name: 'Carprofen 50mg', category: 'Medication', unit: 'tablets' },
];
const OWNER_ADDRESS_OPTIONS = [
  {
    region: 'Region III',
    provinces: [{
      name: 'Bulacan',
      municipalities: [
        {
          name: 'Santa Maria',
          zip: '3022',
          barangays: ['Bagbaguin', 'Balasing', 'Buenavista', 'Bulac', 'Camangyanan', 'Catmon', 'Cay Pombo', 'Caysio', 'Guyong', 'Lalakhan', 'Mag-asawang Sapa', 'Mahabang Parang', 'Manggahan', 'Parada', 'Poblacion', 'Pulong Buhangin', 'San Gabriel', 'San Jose Patag', 'San Vicente', 'Santa Clara', 'Santa Cruz', 'Silangan', 'Tabing Bakod', 'Tumana'],
        },
        {
          name: 'Pandi',
          zip: '3014',
          barangays: ['Bagbaguin', 'Bagong Barrio', 'Baka-Bakahan', 'Bunsuran 1st', 'Bunsuran 2nd', 'Bunsuran 3rd', 'Cacarong Bata', 'Cacarong Matanda', 'Cupang', 'Malibo Bata', 'Malibo Matanda', 'Manatal', 'Mapulang Lupa', 'Masagana', 'Masuso', 'Pinagkuartelan', 'Poblacion', 'Real de Cacarong', 'San Roque', 'Santo Niño', 'Siling Bata', 'Siling Matanda'],
        },
      ],
    }],
  },
];

// ── STATUS BADGES ──────────────────────────────────────────────────────
function StatusBadge({ status, vaccination = false }) {
  return <StatusIndicator status={status} className={vaccination ? 'vaccination-status-indicator' : ''} />;
}

const ab = {
  btn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' },
};

async function updateClinicRecordArchive({ user, endpoint, record, label }) {
  if (!user?.clinic_id) throw new Error('Your account is not assigned to a clinic.');
  const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
  const query = `?clinic_id=${encodeURIComponent(user.clinic_id)}`;
  const response = await fetch(`${apiUrl}${endpoint}/${record.id}/archive${query}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ archived: !record.archived }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Unable to update the ${label} record.`);
  return payload;
}

// ── SHARED TABLE STYLES ────────────────────────────────────────────────
const T = {
  wrap:    { background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: '20px 24px' },
  hd:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title:   { fontSize: '.9rem', fontWeight: 600, color: '#111827' },
  actions: { display: 'flex', gap: 10 },
  search:  {
    width: '100%', padding: '9px 14px 9px 36px',
    border: '1px solid #e8ecf0', borderRadius: 8,
    fontSize: '.78rem', color: '#111827',
    background: '#f4f6f9', outline: 'none', marginBottom: 20,
  },
  searchWrap: { position: 'relative', marginBottom: 20 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#64748b', display: 'flex' },
  table:   { width: '100%', borderCollapse: 'collapse' },
  th:      { textAlign: 'left', fontSize: '.72rem', fontWeight: 700, color: '#111827', textTransform: 'none', letterSpacing: 0, paddingBottom: 10, borderBottom: '1px solid #f1f5f9' },
  td:      { padding: '13px 0', fontSize: '.75rem', color: '#111827', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle' },
  tdMuted: { padding: '13px 0', fontSize: '.75rem', color: '#111827', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle' },
  secondaryBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', border: '1px solid #e8ecf0',
    borderRadius: 8, fontSize: '.75rem', color: '#111827',
    background: '#fff', cursor: 'pointer',
  },
  primaryBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', border: 'none',
    borderRadius: 8, fontSize: '.75rem', color: '#fff',
    background: '#005447', cursor: 'pointer', fontWeight: 500,
  },
};

// ── PRIVACY BANNER ─────────────────────────────────────────────────────
function PrivacyBanner({ onClose }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: '#f0fdf4', border: '1px solid #bbf7d0',
      borderRadius: 10, padding: '12px 16px', marginBottom: 20,
    }}>
      <span style={{ width: 16, height: 16, display: 'flex', color: '#15803d', flexShrink: 0 }}>{Icons.lock}</span>
      <div style={{ fontSize: '.82rem', color: '#166534', flex: 1 }}>
        <strong style={{ fontWeight: 600 }}>Privacy Protected</strong>
        {' — Patient names, owner info, and contact details are stored locally and NEVER shared with the intelligence network.'}
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803d', display: 'flex' }}>
        <span style={{ width: 16, height: 16, display: 'flex' }}>{Icons.close}</span>
      </button>
    </div>
  );
}

// ── TAB NAV ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard',    label: 'Dashboard',    icon: 'home'     },
  { id: 'owners',       label: 'Owners',       icon: 'users'    },
  { id: 'pets',         label: 'Pets',         icon: 'pet'      },
  { id: 'appointments', label: 'Appointments', icon: 'calendar' },
  { id: 'visits',       label: 'Visit & Check-up', icon: 'stethoscope' },
  { id: 'vaccinations', label: 'Vaccinations', icon: 'syringe'  },
  { id: 'plans',        label: 'Treatments & Plans', icon: 'clipboard' },
  { id: 'lab-results',  label: 'Lab Test',  icon: 'file'     },
  { id: 'inpatient',    label: 'Inpatient',    icon: 'bed'      },
  { id: 'consultation', label: 'Billing', icon: 'stethoscope' },
  { id: 'inventory',    label: 'Inventory',    icon: 'building'  },
  
];

function TabNav({ active, setTab }) {
  return (
    <nav className="clinic-records-tabnav" aria-label="Clinic records sections">
      {TABS.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTab(t.id)}
          className={`clinic-records-tabnav-item${active === t.id ? ' active' : ''}`}
          aria-current={active === t.id ? 'page' : undefined}
        >
          <span aria-hidden="true">
            {Icons[t.icon] || Icons.grid}
          </span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function ClinicSectionPlaceholder({ label }) {
  return (
    <div style={T.wrap}>
      <div style={T.title}>{label}</div>
      <div style={{ padding: '32px 0 18px', color: '#64748b', fontSize: '.82rem' }}>
        {label} records will appear here when they are available for this clinic.
      </div>
    </div>
  );
}

export function LabResultsTab({ patientName, patientRecord, user, onCountChange, appointments = [] } = {}) {
  const [search, setSearch] = useState('');
  const [localResults, setLocalResults] = useState([]);
  const [clinicPatients, setClinicPatients] = useState(() => (
    patientRecord ? [normalizeLabPatient(patientRecord)] : []
  ));
  const [clinicOwners, setClinicOwners] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [testTypeOptionsOpen, setTestTypeOptionsOpen] = useState(false);
  const [patientLoadError, setPatientLoadError] = useState('');
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [clinicVeterinarians, setClinicVeterinarians] = useState([]);
  const [veterinarianLoadError, setVeterinarianLoadError] = useState('');
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [savedLabTest, setSavedLabTest] = useState(null);
  const [isSavingLabTest, setIsSavingLabTest] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestStep, setRequestStep] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showArchivedResults, setShowArchivedResults] = useState(false);
  const [labTestConfirmation, setLabTestConfirmation] = useState(null);
  const [petFilter, setPetFilter] = useState('all');
  const [testFilter, setTestFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState('newest');
  const [viewMode, setViewMode] = useState('list');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [actionLabTest, setActionLabTest] = useState(null);
  const [labActionReturn, setLabActionReturn] = useState(null);
  const [resultEditor, setResultEditor] = useState(null);
  const [resultEditorError, setResultEditorError] = useState('');
  const [reportReading, setReportReading] = useState(false);
  const [reportReadMessage, setReportReadMessage] = useState('');
  const [editorMode, setEditorMode] = useState('edit');
  const [viewResultTab, setViewResultTab] = useState('details');
  const [uploadTargetId, setUploadTargetId] = useState('');
  const uploadInputRef = useRef(null);
  const [requestForm, setRequestForm] = useState({
    patientId: patientRecord?.databasePetId || patientRecord?.id || '',
    pet: patientRecord?.name || patientName || '',
    testType: '',
    indication: '',
    priority: 'Routine',
    orderDateTime: getLocalDateTimeInputValue(),
    veterinarian: /doctor|veterinarian/i.test(user?.role || '') ? user.name || '' : '',
    sampleId: '',
    specimenType: '',
    specimenTypeOther: '',
    collectionDate: '',
    collectionTime: '',
    collectionMethod: '',
    collectionMethodOther: '',
    collector: '',
    notes: '',
  });
  const [historyResult, setHistoryResult] = useState(null);
  const [historyTab, setHistoryTab] = useState('details');
  const [viewResult, setViewResult] = useState(null);
  const [labTestsLoading, setLabTestsLoading] = useState(false);
  const [labTestsLoadError, setLabTestsLoadError] = useState('');
  useEffect(() => {
    if (!user?.token || !user?.clinic_id) {
      setClinicPatients(patientRecord ? [normalizeLabPatient(patientRecord)] : []);
      setClinicOwners([]);
      return undefined;
    }
    const controller = new AbortController();
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    const query = `?clinic_id=${encodeURIComponent(user.clinic_id)}`;
    setPatientsLoading(true);
    const headers = { Authorization: `Bearer ${user.token}` };
    const loadRecords = async () => {
      const [petsResponse, ownersResponse] = await Promise.all([
        fetch(`${apiUrl}/clinic-records/pets${query}`, { headers, signal: controller.signal }),
        fetch(`${apiUrl}/clinic-records/clients${query}`, { headers, signal: controller.signal }),
      ]);
      const petsPayload = await petsResponse.json().catch(() => null);
      if (!petsResponse.ok) {
        const serverMessage = petsPayload && typeof petsPayload.error === 'string' ? ` ${petsPayload.error}` : '';
        throw new Error(`Unable to load registered patients (HTTP ${petsResponse.status}).${serverMessage}`);
      }
      if (!Array.isArray(petsPayload)) throw new Error('The registered patients endpoint returned an invalid response.');
      const ownersPayload = await ownersResponse.json().catch(() => null);
      if (!ownersResponse.ok) {
        const serverMessage = ownersPayload && typeof ownersPayload.error === 'string' ? ` ${ownersPayload.error}` : '';
        throw new Error(`Unable to load patient owner information (HTTP ${ownersResponse.status}).${serverMessage}`);
      }
      if (!Array.isArray(ownersPayload)) throw new Error('The clinic owners endpoint returned an invalid response.');
      const owners = ownersPayload.filter(owner => !owner.archived);
      setClinicOwners(owners);
      const patients = petsPayload.filter(patient => !patient.archived).map(patient => {
        const owner = owners.find(item => String(item.id) === String(patient.client_id));
        return normalizeLabPatient({ ...patient, owner: owner || patient.owner });
      });
      if (patientRecord) {
        const currentPatient = normalizeLabPatient(patientRecord);
        const matchIndex = patients.findIndex(patient => String(patient.id) === String(currentPatient.id));
        if (matchIndex >= 0) patients[matchIndex] = { ...patients[matchIndex], ...currentPatient };
        else patients.push(currentPatient);
      }
      setClinicPatients(patients);
      setPatientLoadError('');
    };
    loadRecords().catch(error => {
      if (error.name === 'AbortError') return;
      setPatientLoadError(error.message || 'Unable to load registered patients.');
      setClinicPatients(patientRecord ? [normalizeLabPatient(patientRecord)] : []);
    }).finally(() => {
      if (!controller.signal.aborted) setPatientsLoading(false);
    });
    return () => controller.abort();
  }, [
    user?.clinic_id,
    user?.token,
    patientRecord?.databasePetId,
    patientRecord?.id,
    patientRecord?.name,
    patientRecord?.birthDate,
    patientRecord?.species,
    patientRecord?.breed,
    patientRecord?.gender,
    patientRecord?.owner,
  ]);
  useEffect(() => {
    if (!user?.token || !user?.clinic_id) {
      setLocalResults([]);
      setLabTestsLoadError('Sign in to this clinic to load lab tests.');
      return undefined;
    }
    const controller = new AbortController();
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    setLabTestsLoading(true);
    fetch(`${apiUrl}/clinic-records/lab-tests?clinic_id=${encodeURIComponent(user.clinic_id)}&include_archived=true`, {
      headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal,
    }).then(async response => {
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Unable to load lab tests (HTTP ${response.status}).`);
      if (!Array.isArray(payload)) throw new Error('The lab tests endpoint returned an invalid response.');
      setLocalResults(payload);
      setLabTestsLoadError('');
    }).catch(error => {
      if (error.name !== 'AbortError') setLabTestsLoadError(error.message || 'Unable to load lab tests.');
    }).finally(() => { if (!controller.signal.aborted) setLabTestsLoading(false); });
    return () => controller.abort();
  }, [user?.clinic_id, user?.token]);
  useEffect(() => {
    if (!user?.token || !user?.clinic_id) {
      setClinicVeterinarians([]);
      setVeterinarianLoadError('');
      return undefined;
    }
    const controller = new AbortController();
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    const url = `${apiUrl}/clinics/${encodeURIComponent(user.clinic_id)}/staff?status=active`;
    fetch(url, {
      headers: { Authorization: `Bearer ${user.token}` },
      signal: controller.signal,
    }).then(async response => {
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const serverMessage = payload && typeof payload.error === 'string' ? ` ${payload.error}` : '';
        throw new Error(`Unable to load clinic veterinarians (HTTP ${response.status}).${serverMessage}`);
      }
      if (!Array.isArray(payload)) throw new Error('The clinic staff endpoint returned an invalid response.');
      const veterinarians = payload.filter(member => ['doctor', 'veterinarian', 'assistant_doctor'].includes(
        String(member.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
      )).map(member => member.name).filter(Boolean);
      setClinicVeterinarians(veterinarians);
      setVeterinarianLoadError('');
      if (!/doctor|veterinarian/i.test(user.role || '') && veterinarians.length) {
        setRequestForm(previous => ({ ...previous, veterinarian: previous.veterinarian || veterinarians[0] }));
      }
    }).catch(error => {
      if (error.name === 'AbortError') return;
      setVeterinarianLoadError(error.message || 'Unable to load clinic veterinarians.');
      setClinicVeterinarians([]);
    });
    return () => controller.abort();
  }, [user?.clinic_id, user?.token, user?.role]);

  const getStatusKey = status => {
    const normalized = String(status || '').toLowerCase().replace(/[\s_]+/g, '-');
    if (['pending', 'scheduled'].includes(normalized)) return 'ordered';
    if (normalized === 'normal') return 'results-ready';
    return normalized;
  };
  const getDateInputValue = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const patientResults = localResults.filter(result => !patientName || result.pet === patientName);
  const scheduledLabAppointments = appointments.filter(appointment => {
    let notes = appointment.notes || {};
    if (typeof notes === 'string') { try { notes = JSON.parse(notes); } catch { notes = {}; } }
    const category = String(notes.service_category || appointment.type || '').toLowerCase();
    return !appointment.archived && /lab|laboratory|test/.test(category)
      && !['completed', 'complete', 'cancelled', 'canceled', 'no show', 'no-show'].includes(String(appointment.status || '').toLowerCase());
  }).map(appointment => {
    let notes = appointment.notes || {};
    if (typeof notes === 'string') { try { notes = JSON.parse(notes); } catch { notes = {}; } }
    return { ...appointment, scheduledService: String(notes.service_name || appointment.reason || 'Lab test').replace(/^.*?[—:-]\s*/, ''), scheduledNotes: notes };
  });
  useEffect(() => {
    if (patientRecord) onCountChange?.(patientResults.filter(result => !result.archived).length);
  }, [onCountChange, patientName, patientRecord, patientResults]);
  const patientResultsInArchiveView = patientResults.filter(result => Boolean(result.archived) === showArchivedResults);
  const archivedResultCount = patientResults.filter(result => Boolean(result.archived)).length;
  const statusOptions = [
    ['all', 'All Tests'],
    ['ordered', 'Ordered'],
    ['in-progress', 'In Progress'],
    ['results-ready', 'Results Ready'],
    ['finalized', 'Finalized'],
    ['cancelled', 'Cancelled'],
  ];
  const statusCounts = statusOptions.reduce((counts, [key]) => ({
    ...counts,
    [key]: key === 'all'
      ? patientResultsInArchiveView.length
      : patientResultsInArchiveView.filter(result => getStatusKey(result.status) === key).length,
  }), {});
  const filtered = patientResultsInArchiveView.filter(result => {
    const matchesSearch = [
      result.id, result.pet, result.testType, result.date, result.laboratory, result.summary,
      result.status, result.requestedBy, result.createdBy, result.lastUpdatedBy,
      result.dateCreated, result.linkedPatient, result.interpretation, result.notes,
      ...(result.measurements || []).flatMap(measurement => [
        measurement.name, measurement.value, measurement.unit, measurement.referenceRange,
      ]),
    ].some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase()));
    const resultDate = getDateInputValue(result.date);
    return matchesSearch &&
      (statusFilter === 'all' || getStatusKey(result.status) === statusFilter) &&
      (petFilter === 'all' || result.pet === petFilter) &&
      (testFilter === 'all' || result.testType === testFilter) &&
      (!dateFrom || (resultDate && resultDate >= dateFrom)) &&
      (!dateTo || (resultDate && resultDate <= dateTo));
  }).sort((first, second) => {
    const difference = new Date(first.date).getTime() - new Date(second.date).getTime();
    return sortOrder === 'newest' ? -difference : difference;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedResults = filtered.slice((page - 1) * pageSize, page * pageSize);
  const petOptions = [...new Set([
    ...patientResults.map(result => result.pet),
    ...clinicPatients.map(patient => patient.name),
    patientName,
  ].filter(Boolean))];
  const downloadResult = async result => {
    if (result.reportAttachmentId && user?.token) {
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/clinic-records/attachments/${encodeURIComponent(result.reportAttachmentId)}/content?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!response.ok) throw new Error('Unable to download the laboratory report.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName || `${result.id}-report`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    if (typeof File !== 'undefined' && result.attachment instanceof File) {
      const url = URL.createObjectURL(result.attachment);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.attachment.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text('Laboratory Result', 14, 18);
    pdf.setFontSize(10);
    let pdfY = 32;
    [
      `ID: ${result.id}`,
      `Pet: ${result.pet}`,
      `Test Type: ${result.testType}`,
      `Date: ${formatDateText(result.date, undefined, result.date)}`,
      `Laboratory: ${result.laboratory}`,
      `Status: ${result.status}`,
      `Summary: ${result.summary}`,
      ...(result.measurements || []).map(measurement => (
        `${measurement.name}: ${measurement.value} ${measurement.unit} (Reference range: ${measurement.referenceRange})`
      )),
      `Veterinarian Interpretation: ${result.interpretation || 'Not recorded'}`,
      `Clinical Notes: ${result.notes || 'Not recorded'}`,
    ].forEach(line => {
      const wrappedLine = pdf.splitTextToSize(line, 180);
      if (pdfY + wrappedLine.length * 5 > 280) {
        pdf.addPage();
        pdfY = 20;
      }
      pdf.text(wrappedLine, 14, pdfY);
      pdfY += wrappedLine.length * 5 + 3;
    });
    pdf.save(`${result.id}-lab-result.pdf`);
  };
  const selectedPatient = clinicPatients.find(patient => String(patient.id) === String(requestForm.patientId))
    || clinicPatients.find(patient => patient.name === requestForm.pet)
    || null;
  const selectedPatientOwner = selectedPatient && (
    clinicOwners.find(owner => String(owner.id) === String(selectedPatient.client_id))
    || (selectedPatient.owner && typeof selectedPatient.owner === 'object' ? selectedPatient.owner : null)
  );
  const [clinicalAlerts, setClinicalAlerts] = useState(null);
  const [clinicalAlertsLoading, setClinicalAlertsLoading] = useState(false);
  const [clinicalAlertsError, setClinicalAlertsError] = useState('');
  useEffect(() => {
    if (!newRequestOpen || !selectedPatient || !user?.token || !user?.clinic_id) {
      setClinicalAlerts(null);
      return undefined;
    }
    const controller = new AbortController();
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    setClinicalAlertsLoading(true);
    fetch(`${apiUrl}/clinic-records/pets/${encodeURIComponent(selectedPatient.id)}/clinical-alerts?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
      headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal,
    }).then(async response => {
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Unable to load patient history (HTTP ${response.status}).`);
      setClinicalAlerts(payload);
      setClinicalAlertsError('');
    }).catch(error => {
      if (error.name !== 'AbortError') setClinicalAlertsError(error.message || 'Unable to load patient history.');
    }).finally(() => { if (!controller.signal.aborted) setClinicalAlertsLoading(false); });
    return () => controller.abort();
  }, [newRequestOpen, selectedPatient?.id, user?.clinic_id, user?.token]);
  const matchingPatients = clinicPatients.filter(patient => (
    `${patient.name} ${patient.displayId} ${patient.species} ${patient.owner}`.toLowerCase()
      .includes(patientSearch.trim().toLowerCase())
  ));
  const testOptions = [...new Set([...localResults, ...LAB_RESULTS].map(result => result.testType).filter(Boolean))];
  const matchingTestOptions = testOptions.filter(test => (
    test.toLowerCase().includes(requestForm.testType.trim().toLowerCase())
  ));
  const veterinarianOptions = [...new Set([
    ...clinicVeterinarians,
    ...localResults.map(result => result.requestedBy),
    ...(/doctor|veterinarian/i.test(user?.role || '') && user?.name ? [user.name] : []),
  ].filter(Boolean))];
  const closeNewRequest = () => {
    if (isSavingLabTest) return;
    setNewRequestOpen(false);
    setSavedLabTest(null);
    setRequestError('');
    setRequestStep(1);
    setPatientSearch('');
    setRequestForm({
      patientId: patientRecord?.databasePetId || patientRecord?.id || '',
      pet: patientRecord?.name || patientName || '',
      testType: '',
      indication: '',
      priority: 'Routine',
      orderDateTime: getLocalDateTimeInputValue(),
      veterinarian: /doctor|veterinarian/i.test(user?.role || '') ? user.name || '' : '',
      sampleId: '',
      specimenType: '',
      specimenTypeOther: '',
      collectionDate: '',
      collectionTime: '',
      collectionMethod: '',
      collectionMethodOther: '',
      collector: '',
      notes: '',
    });
  };
  const advanceRequestStep = () => {
    setRequestError('');
    if (requestStep === 1 && !selectedPatient) {
      setRequestError('Select a patient to continue.');
      return;
    }
    const otherDetailMissing = (requestForm.specimenType === 'Other' && !requestForm.specimenTypeOther.trim())
      || (requestForm.collectionMethod === 'Other' && !requestForm.collectionMethodOther.trim());
    if (requestStep === 2 && (!testOptions.includes(requestForm.testType) || !requestForm.veterinarian || !requestForm.orderDateTime || otherDetailMissing)) {
      setRequestError(otherDetailMissing ? 'Enter the details for each field set to Other.' : 'Select an available test type, ordering veterinarian, and order date and time before continuing.');
      return;
    }
    setRequestStep(step => Math.min(3, step + 1));
  };
  const submitNewRequest = async event => {
    event.preventDefault();
    if (!savedLabTest && requestStep < 3) advanceRequestStep();
  };
  const saveNewRequest = async () => {
    if (savedLabTest || isSavingLabTest || requestStep !== 3) return;
    const otherDetailMissing = (requestForm.specimenType === 'Other' && !requestForm.specimenTypeOther.trim())
      || (requestForm.collectionMethod === 'Other' && !requestForm.collectionMethodOther.trim());
    if (!selectedPatient || !testOptions.includes(requestForm.testType) || !requestForm.veterinarian || !requestForm.orderDateTime || otherDetailMissing) {
      setRequestStep(!selectedPatient ? 1 : 2);
      setRequestError(otherDetailMissing ? 'Enter the details for each field set to Other.' : 'Complete the required patient, test type, ordering veterinarian, and order date and time fields.');
      return;
    }
    setIsSavingLabTest(true);
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/clinic-records/lab-tests?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pet_id: selectedPatient.id,
          ...requestForm,
          specimenType: requestForm.specimenType === 'Other' ? requestForm.specimenTypeOther.trim() || 'Other' : requestForm.specimenType,
          collectionMethod: requestForm.collectionMethod === 'Other' ? requestForm.collectionMethodOther.trim() || 'Other' : requestForm.collectionMethod,
          orderDateTime: new Date(requestForm.orderDateTime).toISOString(),
          requestedBy: requestForm.veterinarian,
          createdBy: requestForm.veterinarian,
          lastUpdatedBy: requestForm.veterinarian,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Unable to save lab test (HTTP ${response.status}).`);
      setLocalResults(previous => [payload, ...previous]);
      setPage(1);
      setSavedLabTest(payload);
      setRequestError('');
    } catch (error) {
      setRequestError(error.message || 'Unable to save the lab test.');
    } finally {
      setIsSavingLabTest(false);
    }
  };
  const openResultEditor = (result, mode) => {
    const time = String(result.date).match(/\b\d{1,2}:\d{2}\s(?:AM|PM)\b/i)?.[0] || '';
    const parsedTime = time ? new Date(`2000-01-01 ${time}`) : null;
    const resultTimestamp = new Date();
    setEditorMode(mode);
    setResultEditorError('');
    setReportReadMessage('');
    setResultEditor({
      ...result,
      orderStatus: getStatusKey(result.status),
      date: getDateInputValue(result.date),
      time: parsedTime && !Number.isNaN(parsedTime.getTime())
        ? `${String(parsedTime.getHours()).padStart(2, '0')}:${String(parsedTime.getMinutes()).padStart(2, '0')}`
        : '',
      resultDate: result.resultDate || getDateInputValue(resultTimestamp),
      resultTime: result.resultTime || `${String(resultTimestamp.getHours()).padStart(2, '0')}:${String(resultTimestamp.getMinutes()).padStart(2, '0')}`,
      status: mode === 'results' && ['ordered', 'in-progress'].includes(getStatusKey(result.status))
        ? 'results-ready'
        : getStatusKey(result.status),
      measurements: result.measurements?.length
        ? result.measurements.map(measurement => ({ status: 'Not assessed', ...measurement }))
        : [{ name: '', value: '', unit: '', referenceRange: '', status: 'Not assessed' }],
      attachment: null,
    });
    if (mode === 'results' && result.reportAttachmentId && (!result.summary || result.summary === 'Awaiting laboratory result') && !result.measurements?.length) {
      setReportReading(true);
      setReportReadMessage('Reading the attached report to prefill result fields...');
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      fetch(`${apiUrl}/clinic-records/attachments/${encodeURIComponent(result.reportAttachmentId)}/content?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      }).then(async response => {
        if (!response.ok) throw new Error('Unable to read the attached report.');
        const blob = await response.blob();
        const reportFile = new File([blob], result.fileName || 'lab-report', { type: result.reportContentType || blob.type });
        const { readLabReport } = await import('../../utils/labReportReader');
        const extracted = await readLabReport(reportFile, progress => setReportReadMessage(progress));
        setResultEditor(previous => previous?.id === result.id ? { ...previous, reportText: extracted.text } : previous);
        if (!extracted.summary && !extracted.interpretation && !extracted.measurements.length) {
          setReportReadMessage('The report is attached. Review the recognized text below and enter the findings manually if needed.');
          return;
        }
        setResultEditor(previous => previous?.id === result.id ? {
          ...previous,
          summary: extracted.summary || (previous.summary === 'Awaiting laboratory result' ? '' : previous.summary),
          interpretation: extracted.interpretation || previous.interpretation,
          measurements: extracted.measurements.length ? extracted.measurements : previous.measurements,
        } : previous);
        setReportReadMessage('Report read. Review the extracted fields before saving.');
      }).catch(error => setResultEditorError(error.message || 'Unable to read the attached report.'))
        .finally(() => setReportReading(false));
    }
  };
  const saveResultEditor = async event => {
    event.preventDefault();
    if (!resultEditor) return;
    const saveAsDraft = event.nativeEvent.submitter?.value === 'draft';
    const original = localResults.find(result => result.id === resultEditor.id);
    const reportFile = resultEditor.attachment instanceof File ? resultEditor.attachment : null;
    if (reportFile && reportFile.size > 4 * 1024 * 1024) {
      setResultEditorError('Choose a report file that is 4 MB or smaller.');
      return;
    }
    if (reportFile && !['application/pdf', 'image/jpeg', 'image/png'].includes(reportFile.type)) {
      setResultEditorError('Upload a PDF, JPG, or PNG laboratory report.');
      return;
    }
    setResultEditorError('');
    const displayDate = formatClinicDate(resultEditor.date);
    const enteredTime = resultEditor.time
      ? ` ${new Date(`2000-01-01T${resultEditor.time}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
      : '';
    const updatedResult = {
      ...resultEditor,
      date: `${displayDate}${enteredTime}`,
      dateCreated: original?.dateCreated || displayDate,
      status: saveAsDraft ? 'in-progress' : getStatusKey(resultEditor.status),
      measurements: resultEditor.measurements.filter(measurement => (
        measurement.name || measurement.value || measurement.unit || measurement.referenceRange || measurement.status !== 'Not assessed'
      )),
      attachment: resultEditor.attachment || original?.attachment || null,
      fileName: resultEditor.attachment?.name || original?.fileName || '',
      downloadable: Boolean(
        resultEditor.attachment ||
        original?.downloadable ||
        (!saveAsDraft && ['results-ready', 'finalized'].includes(getStatusKey(resultEditor.status)))
      ),
      lastUpdatedBy: 'Dr. Smith',
    };
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const resultPayload = { ...updatedResult };
      delete resultPayload.attachment;
      delete resultPayload.reportText;
      const response = await fetch(`${apiUrl}/clinic-records/lab-tests/${encodeURIComponent(updatedResult.id)}?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'PUT', headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...resultPayload,
          collectionDate: resultEditor.date,
          collectionTime: resultEditor.time,
          resultDate: resultEditor.resultDate,
          resultTime: resultEditor.resultTime,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Unable to update lab test (HTTP ${response.status}).`);
      let saved = { ...updatedResult, ...payload };
      if (reportFile) {
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Unable to read the selected report file.'));
          reader.readAsDataURL(reportFile);
        });
        const uploadResponse = await fetch(`${apiUrl}/clinic-records/lab-tests/${encodeURIComponent(updatedResult.id)}/report?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
          method: 'POST', headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: reportFile.name, content_type: reportFile.type, data }),
        });
        const attachment = await uploadResponse.json().catch(() => null);
        if (!uploadResponse.ok) throw new Error(attachment?.error || `Unable to upload laboratory report (HTTP ${uploadResponse.status}).`);
        saved = { ...saved, fileName: attachment.filename, reportAttachmentId: attachment.id, reportContentType: attachment.content_type, downloadable: true };
      }
      setLocalResults(previous => previous.map(result => result.id === updatedResult.id ? saved : result));
      setResultEditor(null);
      if (labActionReturn) {
        setActionLabTest({ ...labActionReturn, ...saved });
        setLabActionReturn(null);
      }
    } catch (error) {
      setResultEditorError(error.message || 'Unable to save lab result.');
    }
  };
  const handleReportUpload = event => {
    const file = event.target.files?.[0];
    if (!file || !uploadTargetId) return;
    setLocalResults(previous => previous.map(result => (
      result.id === uploadTargetId
        ? {
          ...result,
          attachment: file,
          fileName: file.name,
          downloadable: true,
          status: 'results-ready',
          lastUpdatedBy: 'Dr. Smith',
        }
        : result
    )));
    setUploadTargetId('');
    event.target.value = '';
  };
  const cancelLabTest = async result => {
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/clinic-records/lab-tests/${encodeURIComponent(result.id)}?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'PUT', headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', summary: result.summary || 'Test cancelled.', lastUpdatedBy: user.name || '' }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Unable to cancel lab test (HTTP ${response.status}).`);
      setLocalResults(previous => previous.map(item => item.id === result.id ? { ...item, ...payload } : item));
    } catch (error) { setLabTestsLoadError(error.message || 'Unable to cancel lab test.'); }
  };
  const archiveLabTest = async result => {
    const archived = !result.archived;
    const action = archived ? 'Archive' : 'Restore';
    try {
      const payload = await updateClinicRecordArchive({ user, endpoint: '/clinic-records/lab-tests', record: result, label: 'lab test' });
      setLocalResults(previous => previous.map(item => item.id === result.id ? { ...item, ...payload } : item));
      setPage(1);
    } catch (error) {
      setLabTestsLoadError(error.message || `Unable to ${action.toLowerCase()} lab test.`);
    }
  };
  const requestLabTestAction = (action, result) => {
    setLabTestConfirmation({ action, result });
  };
  const confirmLabTestAction = async () => {
    if (!labTestConfirmation) return;
    const { action, result } = labTestConfirmation;
    setLabTestConfirmation(null);
    setLabActionReturn(null);
    if (action === 'archive') await archiveLabTest(result);
    else await cancelLabTest(result);
  };
  const openLabTestActions = result => {
    const patient = clinicPatients.find(item => String(item.id) === String(result.patientId || result.pet_id));
    setLabActionReturn(null);
    setActionLabTest({ ...result, photo_url: result.photo_url || getPetPhotoUrl(patient) });
  };
  const backToLabTestActions = closeChild => {
    closeChild();
    if (labActionReturn) {
      setActionLabTest(labActionReturn);
      setLabActionReturn(null);
    }
  };
  const openResultEntryFromActions = result => {
    setLabActionReturn(result);
    setActionLabTest(null);
    openResultEditor(result, 'results');
  };
  const renderActionMenu = result => (
    <button
      type="button"
      className="lab-row-action-trigger clinic-record-actions-trigger"
      aria-label={`Actions for ${result.id}`}
      aria-haspopup="dialog"
      onClick={event => { event.stopPropagation(); openLabTestActions(result); }}
    >
      {Icons.chevronRight}
    </button>
  );
  const openLabTestView = result => {
    const patient = clinicPatients.find(item => String(item.id) === String(result.patientId || result.pet_id));
    setLabActionReturn(result);
    setViewResultTab('details');
    setViewResult({
      ...result,
      photo_url: result.photo_url || getPetPhotoUrl(patient),
      breed: result.breed || patient?.breed,
      species: result.species || patient?.species,
      sex: result.sex || patient?.sex,
      age: result.age || patient?.age,
      weight: result.weight || patient?.weight,
      ownerPhone: result.ownerPhone || patient?.ownerPhone,
    });
    setActionLabTest(null);
  };
  const openLabTestHistory = result => {
    setLabActionReturn(result);
    setHistoryTab('details');
    setHistoryResult(result);
    setActionLabTest(null);
  };
  const hasRecordedResult = Boolean(viewResult && (
    viewResult.measurements?.length ||
    viewResult.interpretation ||
    (viewResult.summary && !/awaiting laboratory result|being processed/i.test(viewResult.summary))
  ));
  const resultIsAvailable = Boolean(viewResult &&
    String(viewResult.status || '').toLowerCase() !== 'cancelled' &&
    (hasRecordedResult || ['results-ready', 'finalized'].includes(String(viewResult.status || '').toLowerCase()))
  );
  const historyTimeline = historyResult ? [
    ...((historyResult.lastUpdatedAt || historyResult.updatedAt) ? [{
      title: 'Result Updated',
      date: historyResult.lastUpdatedAt || historyResult.updatedAt,
      actor: historyResult.lastUpdatedBy || 'Clinic staff',
      detail: 'Test details or result information were updated.',
    }] : []),
    ...((historyResult.resultDate || historyResult.reportedAt) && (
      historyResult.measurements?.length ||
      historyResult.interpretation ||
      ['results-ready', 'finalized'].includes(String(historyResult.status || '').toLowerCase())
    ) ? [{
      title: 'Result Received',
      date: historyResult.reportedAt || (historyResult.resultTime && historyResult.resultDate
        ? `${historyResult.resultDate}T${historyResult.resultTime}`
        : historyResult.resultDate),
      actor: historyResult.laboratory || 'Laboratory',
      detail: `Lab result was received from ${historyResult.laboratory || 'the laboratory'}.`,
    }] : []),
    ...(historyResult.dateCreated || historyResult.createdAt ? [{
      title: 'Test Created',
      date: historyResult.createdAt || historyResult.dateCreated,
      actor: historyResult.createdBy || historyResult.requestedBy || 'Clinic staff',
      detail: 'Lab test order was created.',
    }] : []),
    ...((historyResult.orderDateTime || historyResult.date) ? [{
      title: 'Test Requested',
      date: historyResult.orderDateTime || historyResult.date,
      actor: historyResult.requestedBy || 'Clinic staff',
      detail: 'Lab test was requested.',
    }] : []),
  ].sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime()) : [];
  return (
    <div className={`lab-results-tab${patientRecord ? ' patient-record-lab-results' : ''}`}>
      {patientRecord ? (
        <div className="detail-panel-heading patient-lab-results-heading">
          <span>Lab Results</span>
        </div>
      ) : (
        <div className="lab-results-header">
          <div>
            <h2 className="lab-results-title">Lab Tests</h2>
            <p className="lab-results-description">Track laboratory orders, review test results, and manage patient diagnostics.</p>
          </div>
        </div>
      )}
      {labTestsLoading && <p className="lab-clinical-history-state">Loading saved lab tests…</p>}
      {!patientRecord && scheduledLabAppointments.length > 0 && <section className="lab-clinical-history-state" style={{ margin: '10px 0 14px' }}><strong>Scheduled lab tests</strong>{scheduledLabAppointments.map(appointment => <div key={appointment.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8, color: '#334155' }}><span>{appointment.pet} · {appointment.scheduledService}</span><span>{formatDateText(appointment.start_time)} · Scheduled</span></div>)}</section>}
      {labTestsLoadError && <p className="lab-clinical-history-error" role="alert">{labTestsLoadError}</p>}
      {!patientRecord && <div className="lab-status-row">
        <div className="lab-status-filters" role="tablist" aria-label="Lab test status">
          {statusOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={statusFilter === value}
              className={statusFilter === value ? 'active' : ''}
              onClick={() => { setStatusFilter(value); setPage(1); }}
            >
              {label}<span>{statusCounts[value]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="lab-results-add" onClick={() => { setSavedLabTest(null); setNewRequestOpen(true); }}>
          {Icons.plus} Add Lab Test
        </button>
      </div>}
      {patientRecord && <div className="lab-status-row patient-record-status-row">
        <div className="lab-status-filters" role="tablist" aria-label="Lab test status">
          {statusOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={statusFilter === value}
              className={statusFilter === value ? 'active' : ''}
              onClick={() => { setStatusFilter(value); setPage(1); }}
            >
              {value === 'all' ? 'All' : label}<span>{statusCounts[value]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="detail-edit patient-primary-add" onClick={() => { setSavedLabTest(null); setNewRequestOpen(true); }}>
          {Icons.plus} Add Lab Test
        </button>
      </div>}
      <div className={`lab-filter-bar${patientRecord ? ' medication-filter-bar patient-record-filter-controls' : ''}`}>
        <label className={`lab-results-search${patientRecord ? ' medication-search' : ''}`}>
          {Icons.search}
          <input
            type="search"
            aria-label="Search lab tests"
            placeholder={patientRecord ? 'Search test name, reason, or test ID...' : 'Search by pet name, test type, or ID...'}
            value={search}
            onChange={event => { setSearch(event.target.value); setPage(1); }}
          />
        </label>
        {!patientRecord && <FilterSelect
          label="Filter by pet"
          className="lab-records-filter-select"
          value={petFilter}
          onChange={value => { setPetFilter(value); setPage(1); }}
          options={[{ value: 'all', label: 'All Pets' }, ...petOptions.map(pet => ({ value: pet, label: pet }))]}
        />}
        <FilterSelect
          label="Filter by test type"
          className={patientRecord ? 'medication-filter-select' : 'lab-records-filter-select'}
          value={testFilter}
          onChange={value => { setTestFilter(value); setPage(1); }}
          options={[{ value: 'all', label: patientRecord ? 'All type' : 'All Test Types' }, ...testOptions.map(test => ({ value: test, label: test }))]}
        />
        <div className={`lab-date-range${patientRecord ? ' medication-date-filter' : ''}`}>
          <button
            type="button"
            className="lab-date-range-trigger"
            aria-label="Choose date range"
            aria-expanded={dateRangeOpen}
            onClick={() => setDateRangeOpen(open => !open)}
          >
            <span className="lab-date-range-calendar">{Icons.calendar}</span>
            <span>Date Range</span>
            <span className={`lab-date-range-chevron${dateRangeOpen ? ' open' : ''}`} aria-hidden="true" />
          </button>
          {dateRangeOpen && <div className="lab-date-range-popover" role="group" aria-label="Date range and sorting">
            <label>From<LabDateTimePicker label="Start date" mode="date" value={dateFrom} max={dateTo || undefined} onChange={date => { setDateFrom(date); setPage(1); }} /></label>
            <label>To<LabDateTimePicker label="End date" mode="date" value={dateTo} min={dateFrom || undefined} onChange={date => { setDateTo(date); setPage(1); }} /></label>
            <label>Sort order
              <select aria-label="Sort lab tests" value={sortOrder} onChange={event => { setSortOrder(event.target.value); setPage(1); }}>
                <option value="newest">Newest to Oldest</option>
                <option value="oldest">Oldest to Newest</option>
              </select>
            </label>
            <div className="lab-date-range-actions">
              <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}>Clear</button>
              <button type="button" onClick={() => setDateRangeOpen(false)}>Done</button>
            </div>
          </div>}
        </div>
      </div>
      {!patientRecord && <div className="clinic-archive-toolbar">
          <div className="lab-list-controls">
            <div className="lab-archive-tabs" role="tablist" aria-label="Active and archived lab tests">
              <button
                type="button"
                role="tab"
                aria-selected={!showArchivedResults}
                className={!showArchivedResults ? 'active' : ''}
                onClick={() => { setShowArchivedResults(false); setPage(1); }}
              >Active <span>{patientResults.length - archivedResultCount}</span></button>
              <button
                type="button"
                role="tab"
                aria-selected={showArchivedResults}
                className={showArchivedResults ? 'active' : ''}
                onClick={() => { setShowArchivedResults(true); setPage(1); }}
              >Archived <span>{archivedResultCount}</span></button>
            </div>
            <div className="lab-view-toggle" role="group" aria-label="Lab test view">
              <button type="button" aria-label="List view" aria-pressed={viewMode === 'list'} className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>☷</button>
              <button type="button" aria-label="Grid view" aria-pressed={viewMode === 'grid'} className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}>▦</button>
            </div>
          </div>
      </div>}
      <section className="lab-results-list">
        {viewMode === 'list' ? (
          <div className="lab-results-table-wrap">
            <table className="lab-results-table">
              <thead><tr><th>Pet</th><th>Test</th><th>Date</th><th>Status</th><th className="clinic-action-heading" aria-label="Row actions" /></tr></thead>
              <tbody>
                {paginatedResults.map(result => {
                  const time = String(result.date).match(/\b\d{1,2}:\d{2}\s(?:AM|PM)\b/i)?.[0];
                  const openActions = () => openLabTestActions(result);
                  return <tr key={result.id} className="clinic-action-row" tabIndex={0} onClick={openActions} onKeyDown={event => handleClinicActionRowKeyDown(event, openActions)}>
                    <td data-label="Pet" className="lab-result-pet">{result.pet}</td>
                    <td data-label="Test"><div className="lab-result-test"><strong>{result.testType}</strong><span>{result.id}</span></div></td>
                    <td data-label="Date"><div className="lab-result-date"><strong>{formatDateText(result.date, undefined, result.date)}</strong>{time && <span>{time}</span>}</div></td>
                    <td data-label="Status"><StatusIndicator status={result.status || 'ordered'} /></td>
                    <td data-label="Actions" className="lab-result-actions">{renderActionMenu(result)}</td>
                  </tr>;
                })}
                {!paginatedResults.length && <tr><td className="lab-results-empty" colSpan="5">No lab tests match the selected search and filters.</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="lab-results-card-grid">
            {paginatedResults.map(result => {
              const time = String(result.date).match(/\b\d{1,2}:\d{2}\s(?:AM|PM)\b/i)?.[0];
              const openActions = () => openLabTestActions(result);
              return <article className="lab-results-card clinic-action-row" key={result.id} tabIndex={0} onClick={openActions} onKeyDown={event => handleClinicActionRowKeyDown(event, openActions)}>
                <div className="lab-results-card-heading">
                  <div className="lab-card-identity">
                    <span><small>Pet</small><strong>{result.pet}</strong></span>
                    <span><small>Test</small><strong>{result.testType} · {result.id}</strong></span>
                  </div>
                  {renderActionMenu(result)}
                </div>
                <div className="lab-results-card-meta"><span>{formatDateText(result.date, undefined, result.date)}{time ? ` · ${time}` : ''}</span><StatusIndicator status={result.status || 'ordered'} /></div>
                {result.summary && <p>{result.summary}</p>}
              </article>;
            })}
            {!paginatedResults.length && <div className="lab-results-empty">No lab tests match the selected search and filters.</div>}
          </div>
        )}
      </section>
      <footer className="lab-results-pagination">
        <div>
          <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>‹</button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map(pageNumber => (
            <button key={pageNumber} type="button" aria-current={page === pageNumber ? 'page' : undefined} className={page === pageNumber ? 'active' : ''} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
          ))}
          <button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage(current => Math.min(pageCount, current + 1))}>›</button>
        </div>
      </footer>
      <input
        ref={uploadInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="lab-upload-input"
        aria-label="Upload lab report"
        onChange={handleReportUpload}
      />
      {newRequestOpen && <div style={modalStyles.backdrop} onClick={() => { if (!isSavingLabTest) closeNewRequest(); }}>
        <form className="lab-add-test-dialog lab-wizard-dialog" role="dialog" aria-modal="true" aria-labelledby="new-lab-request-title" onSubmit={submitNewRequest} onClick={event => event.stopPropagation()} style={{ ...modalStyles.dialog, width: 'min(820px, 100%)', height: selectedPatient ? 'min(700px, calc(100dvh - 32px))' : 'min(510px, calc(100dvh - 32px))', maxHeight: 'calc(100dvh - 32px)', overflow: 'hidden', padding: 'clamp(16px, 3vw, 26px)' }}>
          <button type="button" className="lab-add-test-close" onClick={closeNewRequest} disabled={isSavingLabTest}>Close</button>
          <header className="lab-wizard-header">
            <div>
              <h2 id="new-lab-request-title">Add Lab Test</h2>
              <p>Step {requestStep} of 3 · {['Patient', 'Test Details', 'Review & Save'][requestStep - 1]}</p>
            </div>
          </header>
          <ol className="lab-wizard-steps">
            {['Patient', 'Test Details', 'Review & Save'].map((label, index) => {
              const step = index + 1;
              return <li key={label} className={requestStep === step ? 'active' : requestStep > step ? 'complete' : ''}>
                <span>{step}</span><strong>{label}</strong>
              </li>;
            })}
          </ol>
          <div className="lab-wizard-body">
            {requestStep === 1 && <section className="lab-wizard-section">
              <div className="lab-wizard-patient-search-block">
                <label className="lab-wizard-field">
                  <span>Find Patient</span>
                  <span className="lab-wizard-search-control">
                    {Icons.search}
                    <input
                      className="lab-wizard-search-input"
                      type="search"
                      value={patientSearch}
                      onChange={event => {
                        setPatientSearch(event.target.value);
                        setRequestForm(previous => ({ ...previous, patientId: '', pet: '' }));
                      }}
                      placeholder="Search by pet name, patient ID, or owner name..."
                      autoComplete="off"
                    />
                  </span>
                </label>
                {!selectedPatient && <div className="lab-wizard-patient-results" role="listbox" aria-label="Registered patients">
                  {patientsLoading && <div className="lab-wizard-patient-empty">Loading registered patients…</div>}
                  {!patientsLoading && !matchingPatients.length && <div className="lab-wizard-patient-empty">
                    {patientLoadError ? 'Patient search is unavailable until patient records load.' : 'No matching registered patients.'}
                  </div>}
                  {!patientsLoading && matchingPatients.slice(0, 20).map(patient => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      key={patient.id}
                      onClick={() => {
                        setRequestForm(previous => ({
                          ...previous,
                          patientId: patient.id,
                          pet: patient.name,
                        }));
                        setPatientSearch('');
                      }}
                    >
                      <span className="lab-wizard-result-avatar">{patient.name.slice(0, 1).toUpperCase() || 'P'}</span>
                      <span><strong>{patient.name}</strong><small>{patient.displayId} · {patient.species} · {patient.owner}</small></span>
                    </button>
                  ))}
                </div>}
              </div>
              {patientLoadError && <div role="alert" className="lab-wizard-error">{patientLoadError}</div>}
              {selectedPatient && <div className="lab-wizard-patient-summary">
                <div className="lab-wizard-patient-overview">
                  {selectedPatient.photo_url
                    ? <img className="lab-wizard-pet-photo" src={selectedPatient.photo_url} alt="" />
                    : <span className="lab-wizard-pet-photo lab-wizard-pet-initial">{selectedPatient.name.slice(0, 1).toUpperCase() || 'P'}</span>}
                  <div className="lab-wizard-patient-identity">
                    <strong>{selectedPatient.name}</strong>
                    <span>Patient ID: {selectedPatient.displayId}</span>
                    <span className="lab-wizard-patient-selected">Patient selected</span>
                  </div>
                  <div className="lab-wizard-patient-fact"><small>Species</small><strong>{selectedPatient.species}</strong></div>
                  <div className="lab-wizard-patient-fact"><small>Breed</small><strong>{selectedPatient.breed || 'Not recorded'}</strong></div>
                  <div className="lab-wizard-patient-fact"><small>Sex</small><strong>{[selectedPatient.sex, selectedPatient.reproductiveStatus].filter(value => value && value !== 'Not recorded').join(' · ') || 'Not recorded'}</strong></div>
                  <div className="lab-wizard-patient-fact"><small>Age</small><strong>{selectedPatient.age || 'Not recorded'}</strong></div>
                  <button type="button" onClick={() => {
                    setRequestForm(previous => ({ ...previous, patientId: '', pet: '' }));
                    setPatientSearch('');
                  }}>Change Patient</button>
                </div>
                <div className="lab-wizard-owner-card">
                  <h4>Owner Information</h4>
                  <div className="lab-wizard-owner-details">
                    <span className="lab-wizard-owner-avatar">{selectedPatient.owner.slice(0, 1).toUpperCase() || 'O'}</span>
                    <div className="lab-wizard-owner-name"><strong>{selectedPatient.owner}</strong><small>Owner</small></div>
                    <div className="lab-wizard-owner-contact">
                      <span>{Icons.phone}<span>{selectedPatient.ownerPhone || selectedPatientOwner?.phone || 'Phone not recorded'}</span></span>
                      <span>{Icons.mail}<span>{selectedPatient.ownerEmail || selectedPatientOwner?.email || 'Email not recorded'}</span></span>
                    </div>
                  </div>
                </div>
                <div className="lab-wizard-additional-patient-details">
                  <h4>Clinical Alerts &amp; Relevant History</h4>
                  <p className="lab-clinical-history-intro">Relevant information from the patient's existing record</p>
                  {clinicalAlertsLoading && <p className="lab-clinical-history-state">Loading the patient's clinical record…</p>}
                  {clinicalAlertsError && <p className="lab-clinical-history-error" role="alert">{clinicalAlertsError}</p>}
                  {!clinicalAlertsLoading && !clinicalAlertsError && clinicalAlerts && <div className="lab-clinical-history-list">
                    <section>
                      <h5>Current Treatments</h5>
                      <div className="lab-clinical-history-list-content">
                        {clinicalAlerts.currentTreatments?.length
                          ? <ul>{clinicalAlerts.currentTreatments.map((treatment, index) => <li className="lab-clinical-treatment-item" key={`${treatment.name}-${index}`}><strong>{treatment.name || 'Treatment'}</strong>{treatment.status && <span className="lab-clinical-treatment-status">{treatment.status}</span>}</li>)}</ul>
                          : <p>No current treatments recorded.</p>}
                      </div>
                    </section>
                    <section>
                      <h5>Known Allergies / Adverse Reactions</h5>
                      <div className="lab-clinical-history-list-content"><p>{clinicalAlerts.allergiesDocumented ? clinicalAlerts.allergies : 'No allergy information recorded.'}</p></div>
                    </section>
                    <section>
                      <h5>Relevant Medical History</h5>
                      <div className="lab-clinical-history-list-content">
                        {clinicalAlerts.medicalHistory?.length
                          ? <ul>{clinicalAlerts.medicalHistory.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
                          : <p>No relevant medical history recorded.</p>}
                      </div>
                    </section>
                  </div>}
                  {!clinicalAlerts && !clinicalAlertsLoading && !clinicalAlertsError && <p className="lab-clinical-history-state">Select a patient to review their clinical history.</p>}
                  <p className="lab-clinical-history-review">{Icons.info}<span>Review this information before selecting or interpreting a test. Update the patient's record to correct missing or outdated information.</span></p>
                  <div className="lab-wizard-additional-patient-content">
                    <dl className="lab-wizard-patient-details">
                      <div><dt>Species</dt><dd>{selectedPatient.species}</dd></div>
                      <div><dt>Sex</dt><dd>{[selectedPatient.sex, selectedPatient.reproductiveStatus].filter(value => value && value !== 'Not recorded').join(' · ') || 'Not recorded'}</dd></div>
                      <div><dt>Breed</dt><dd>{selectedPatient.breed || 'Not recorded'}</dd></div>
                      <div><dt>Date of Birth</dt><dd>{selectedPatient.birthDate ? `${formatClinicDate(selectedPatient.birthDate)}${selectedPatient.age ? ` (${selectedPatient.age})` : ''}` : selectedPatient.age || 'Not recorded'}</dd></div>
                    </dl>
                    <p>{Icons.info}<span>This information is pulled from the patient record. To correct it, update the patient record.</span></p>
                  </div>
                </div>
              </div>}
            </section>}
            {requestStep === 2 && <section className="lab-wizard-section">
              <h3>Test Information</h3>
              <div className="lab-wizard-test-grid">
                <div className="lab-wizard-field lab-wizard-test-type">
                  <span>Test Type <b className="system-required-star">*</b></span>
                  <span className="lab-wizard-search-control">
                    {Icons.search}
                    <input
                      className="lab-wizard-search-input"
                      required
                      role="combobox"
                      aria-label="Test Type"
                      aria-autocomplete="list"
                      aria-expanded={testTypeOptionsOpen}
                      aria-controls="lab-test-type-options"
                      value={requestForm.testType}
                      onFocus={() => setTestTypeOptionsOpen(true)}
                      onClick={() => setTestTypeOptionsOpen(true)}
                      onBlur={() => setTestTypeOptionsOpen(false)}
                      onKeyDown={event => {
                        if (event.key === 'Escape') setTestTypeOptionsOpen(false);
                      }}
                      onChange={event => {
                        setRequestForm(previous => ({ ...previous, testType: event.target.value }));
                        setTestTypeOptionsOpen(true);
                      }}
                      placeholder="Search or select a lab test"
                      autoComplete="off"
                    />
                  </span>
                  {testTypeOptionsOpen && <div className="lab-wizard-test-options" id="lab-test-type-options" role="listbox" aria-label="Available lab tests">
                    {matchingTestOptions.length
                      ? matchingTestOptions.map(test => (
                        <button
                          type="button"
                          role="option"
                          aria-selected={requestForm.testType === test}
                          key={test}
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => {
                            setRequestForm(previous => ({ ...previous, testType: test }));
                            setTestTypeOptionsOpen(false);
                          }}
                        >{test}</button>
                      ))
                      : <p>No matching lab tests.</p>}
                  </div>}
                </div>
                <fieldset className="lab-wizard-priority">
                  <legend>Priority</legend>
                  <div>
                    {['Routine', 'Urgent'].map(priority => (
                      <button
                        key={priority}
                        type="button"
                        aria-pressed={requestForm.priority === priority}
                        className={requestForm.priority === priority ? 'selected' : ''}
                        onClick={() => setRequestForm(previous => ({ ...previous, priority }))}
                      >
                        <span aria-hidden="true" />{priority}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="lab-wizard-field lab-wizard-field-full">
                  <span>Clinical Indication / Reason for Testing <small>(Optional)</small></span>
                  <textarea maxLength={500} rows={2} value={requestForm.indication} onChange={event => setRequestForm(previous => ({ ...previous, indication: event.target.value }))} placeholder="e.g., vomiting, suspected infection, wellness screening..." />
                  <small>{requestForm.indication.length}/500</small>
                </label>
                <label className="lab-wizard-field">
                  <span>Ordering Veterinarian <b className="system-required-star">*</b></span>
                  <FilterSelect
                    className="lab-wizard-filter-select"
                    label="Ordering Veterinarian"
                    value={requestForm.veterinarian}
                    onChange={veterinarian => setRequestForm(previous => ({ ...previous, veterinarian }))}
                    options={[
                      { value: '', label: 'Select veterinarian' },
                      ...veterinarianOptions.map(veterinarian => ({ value: veterinarian, label: veterinarian })),
                    ]}
                  />
                  {veterinarianLoadError && <small role="alert">{veterinarianLoadError}</small>}
                </label>
                <div className="lab-wizard-system-field">
                  <span>Test ID</span>
                  <strong>Will be generated after saving</strong>
                </div>
                <div className="lab-wizard-system-field lab-wizard-order-date">
                  <span>Order Date &amp; Time</span>
                  <LabDateTimePicker
                    className="lab-wizard-date-time"
                    label="Order Date and Time"
                    value={requestForm.orderDateTime}
                    onChange={orderDateTime => setRequestForm(previous => ({ ...previous, orderDateTime }))}
                  />
                </div>
              </div>
              <hr className="lab-wizard-divider" />
              <h3>Specimen &amp; Collection Information</h3>
              <div className="lab-wizard-fields-grid">
                <label className="lab-wizard-field">
                  <span>Specimen Type <small>(Optional)</small></span>
                  <FilterSelect
                    className="lab-wizard-filter-select"
                    label="Specimen Type"
                    value={requestForm.specimenType}
                    onChange={specimenType => setRequestForm(previous => ({ ...previous, specimenType, specimenTypeOther: specimenType === 'Other' ? previous.specimenTypeOther : '' }))}
                    options={[
                      { value: '', label: 'Select specimen type' },
                      ...['Whole blood', 'Serum', 'Plasma', 'Urine', 'Feces', 'Swab', 'Other'].map(specimen => ({ value: specimen, label: specimen })),
                    ]}
                  />
                  {requestForm.specimenType === 'Other' && <input className="lab-wizard-other-detail" aria-label="Specify other specimen type" required value={requestForm.specimenTypeOther} onChange={event => setRequestForm(previous => ({ ...previous, specimenTypeOther: event.target.value }))} placeholder="Enter specimen type" maxLength={120} />}
                </label>
                <label className="lab-wizard-field">
                  <span>Collection Date &amp; Time <small>(Optional)</small></span>
                  <LabDateTimePicker
                    className="lab-wizard-date-time"
                    label="Collection Date and Time"
                    value={requestForm.collectionDate && requestForm.collectionTime ? `${requestForm.collectionDate}T${requestForm.collectionTime}` : ''}
                    onChange={value => {
                      const [collectionDate = '', collectionTime = ''] = value.split('T');
                      setRequestForm(previous => ({ ...previous, collectionDate, collectionTime }));
                    }}
                  />
                </label>
                <label className="lab-wizard-field">
                  <span>Collection Method / Site <small>(Optional)</small></span>
                  <FilterSelect
                    className="lab-wizard-filter-select"
                    label="Collection Method / Site"
                    value={requestForm.collectionMethod}
                    onChange={collectionMethod => setRequestForm(previous => ({ ...previous, collectionMethod, collectionMethodOther: collectionMethod === 'Other' ? previous.collectionMethodOther : '' }))}
                    options={[
                      { value: '', label: 'Select method / site' },
                      ...['Venipuncture', 'Cystocentesis', 'Free catch', 'Fecal collection', 'Swab', 'Other'].map(method => ({ value: method, label: method })),
                    ]}
                  />
                  {requestForm.collectionMethod === 'Other' && <input className="lab-wizard-other-detail" aria-label="Specify other collection method or site" required value={requestForm.collectionMethodOther} onChange={event => setRequestForm(previous => ({ ...previous, collectionMethodOther: event.target.value }))} placeholder="Describe method or site" maxLength={160} />}
                </label>
                <label className="lab-wizard-field">
                  <span>Collector <small>(Optional)</small></span>
                  <span className="lab-wizard-filter-select-shell">
                    {Icons.user}
                    <FilterSelect
                      className="lab-wizard-filter-select"
                      label="Collector"
                      value={requestForm.collector}
                      onChange={collector => setRequestForm(previous => ({ ...previous, collector }))}
                      options={[
                        { value: '', label: 'Select collector' },
                        ...veterinarianOptions.map(collector => ({ value: collector, label: collector })),
                      ]}
                    />
                  </span>
                </label>
                <label className="lab-wizard-field lab-wizard-field-full lab-wizard-notes-field">
                  <span>Clinical Notes <small>(Optional)</small></span>
                  <textarea className="lab-wizard-notes" maxLength={500} rows={2} value={requestForm.notes} onChange={event => setRequestForm(previous => ({ ...previous, notes: event.target.value }))} placeholder="Add any relevant notes, such as clinical signs, reason for testing, or special instructions..." />
                  <small>{requestForm.notes.length}/500</small>
                </label>
              </div>
            </section>}
            {requestStep === 3 && <section className="lab-wizard-section lab-wizard-review-page">
              <header className="lab-wizard-review-header">
                <span className="lab-wizard-review-icon">{Icons.clipboard}</span>
                <div>
                  <h3>Review &amp; Save</h3>
                  <p>Step 3 of 3 · Confirm the information before creating the lab test.</p>
                </div>
              </header>
              <section className="lab-wizard-review-group">
                <div className="lab-wizard-review-group-heading">
                  <h4>Patient</h4>
                  <button type="button" onClick={() => { setRequestError(''); setRequestStep(1); }}><span aria-hidden="true">{Icons.edit}</span>Edit patient</button>
                </div>
                <div className="lab-wizard-review-patient">
                  {selectedPatient?.photo_url
                    ? <img src={selectedPatient.photo_url} alt="" />
                    : <span className="lab-wizard-review-patient-avatar">{selectedPatient?.name?.slice(0, 1).toUpperCase() || 'P'}</span>}
                  <div>
                    <strong>{selectedPatient?.name || 'Patient not selected'}</strong>
                    <span>Patient ID: {selectedPatient?.displayId || 'Not available'} <b>·</b> {selectedPatient?.species || 'Species not recorded'} <b>·</b> {selectedPatient?.sex || 'Sex not recorded'}</span>
                  </div>
                </div>
              </section>
              <section className="lab-wizard-review-group">
                <div className="lab-wizard-review-group-heading">
                  <h4>Test Information</h4>
                  <button type="button" onClick={() => { setRequestError(''); setRequestStep(2); }}><span aria-hidden="true">{Icons.edit}</span>Edit details</button>
                </div>
                <dl className="lab-wizard-review-list">
                  <div><dt>Test type</dt><dd>{requestForm.testType || 'Not selected'}</dd></div>
                  <div><dt>Priority</dt><dd><span className="lab-wizard-review-priority">{requestForm.priority}</span></dd></div>
                  <div><dt>Ordering veterinarian</dt><dd>{requestForm.veterinarian || 'Not selected'}</dd></div>
                  <div><dt>Reason for testing</dt><dd>{requestForm.indication.trim() || 'Not provided'}</dd></div>
                  {requestForm.notes.trim() && <div><dt>Clinical notes</dt><dd>{requestForm.notes.trim()}</dd></div>}
                </dl>
              </section>
              <section className="lab-wizard-review-group">
                <div className="lab-wizard-review-group-heading">
                  <h4>Specimen &amp; Collection</h4>
                  <button type="button" onClick={() => { setRequestError(''); setRequestStep(2); }}><span aria-hidden="true">{Icons.edit}</span>Edit details</button>
                </div>
                <dl className="lab-wizard-review-list">
                  <div><dt>Specimen type</dt><dd>{(requestForm.specimenType === 'Other' ? requestForm.specimenTypeOther.trim() : requestForm.specimenType) || 'To be recorded'}</dd></div>
                  <div><dt>Collection date/time</dt><dd>{requestForm.collectionDate && requestForm.collectionTime
                    ? `${formatClinicDate(requestForm.collectionDate)} · ${requestForm.collectionTime}`
                    : 'Not collected yet'}</dd></div>
                  {requestForm.collectionMethod && <div><dt>Collection method / site</dt><dd>{requestForm.collectionMethod === 'Other' ? requestForm.collectionMethodOther.trim() : requestForm.collectionMethod}</dd></div>}
                  <div><dt>Collector</dt><dd>{requestForm.collector || 'Not selected'}</dd></div>
                  {requestForm.sampleId.trim() && <div><dt>Sample ID / Accession</dt><dd>{requestForm.sampleId.trim()}</dd></div>}
                </dl>
              </section>
              <div className="lab-wizard-review-after-save">
                {Icons.info}
                <div><strong>After saving</strong><p>The lab test will appear in the Lab Tests list with its generated test ID and initial status. You can record collection details and enter results when available.</p></div>
              </div>
            </section>}
          </div>
          {savedLabTest && <div className="lab-wizard-success" role="status">
            <span aria-hidden="true">✓</span>
            <div><strong>Lab test saved</strong><small>{savedLabTest.id} was added to {savedLabTest.pet}'s clinic record.</small></div>
          </div>}
          {requestError && <div role="alert" className="lab-wizard-error">{requestError}</div>}
          <footer className={`lab-wizard-footer${requestStep === 3 ? ' lab-wizard-review-footer' : ''}`}>
            {savedLabTest
              ? <button type="button" className="lab-wizard-cancel" onClick={closeNewRequest} disabled={isSavingLabTest}>Close</button>
              : requestStep === 3
                ? <button type="button" className="lab-wizard-back" onClick={() => { setRequestError(''); setRequestStep(2); }} disabled={isSavingLabTest}>Back</button>
                : <button type="button" className="lab-wizard-cancel" onClick={closeNewRequest} disabled={isSavingLabTest}>Cancel</button>}
            {!savedLabTest && <div>
              {requestStep > 1 && requestStep < 3 && <button type="button" className="lab-wizard-back" onClick={() => { setRequestError(''); setRequestStep(step => step - 1); }} disabled={isSavingLabTest}>Back</button>}
              {requestStep < 3
                ? <button type="button" className="lab-wizard-next" onClick={advanceRequestStep}>{requestStep === 2 ? 'Review & Save' : 'Next'}</button>
                : <button type="button" className="lab-wizard-next" onClick={saveNewRequest} disabled={isSavingLabTest}>{isSavingLabTest ? 'Saving…' : 'Save Lab Test'}</button>}
            </div>}
          </footer>
        </form>
      </div>}
      {actionLabTest && <div style={modalStyles.backdrop} onClick={() => setActionLabTest(null)}>
        <div role="dialog" aria-modal="true" aria-labelledby="lab-test-actions-title" onClick={event => event.stopPropagation()} style={modalStyles.vaccinationActionsDialog}>
          <button type="button" onClick={() => setActionLabTest(null)} style={{ ...modalStyles.vaccinationActionsClose, width: 'auto', height: 'auto', font: 'inherit', fontSize: '.72rem', fontWeight: 600 }}>Close</button>
          <div style={modalStyles.vaccinationActionsHeader}>
            <div>
              <h2 id="lab-test-actions-title" style={modalStyles.vaccinationActionsTitle}>Lab Test Actions</h2>
              <div style={modalStyles.vaccinationActionsSubtitle}>{actionLabTest.id} — {actionLabTest.testType || 'Laboratory test'} ({actionLabTest.pet || 'Selected Pet'})</div>
            </div>
          </div>
          <div style={modalStyles.vaccinationActionsPet}>
            <div style={modalStyles.vaccinationActionsPetInfo}>
              {actionLabTest.photo_url ? <>
                <img src={actionLabTest.photo_url} alt={`${actionLabTest.pet || 'Pet'} profile`} style={modalStyles.vaccinationActionsPetImage} onError={event => { event.currentTarget.style.display = 'none'; if (event.currentTarget.nextElementSibling) event.currentTarget.nextElementSibling.style.display = 'grid'; }} />
                <span aria-hidden="true" style={{ ...modalStyles.vaccinationActionsPetImage, display: 'none', placeItems: 'center', background: '#e7f5f2', color: '#005447', fontWeight: 700 }}>{String(actionLabTest.pet || 'P').slice(0, 1).toUpperCase()}</span>
              </> : <span aria-hidden="true" style={{ ...modalStyles.vaccinationActionsPetImage, display: 'grid', placeItems: 'center', background: '#e7f5f2', color: '#005447', fontWeight: 700 }}>{String(actionLabTest.pet || 'P').slice(0, 1).toUpperCase()}</span>}
              <div>
                <div style={modalStyles.vaccinationActionsPetName}>{actionLabTest.testType || 'Lab Test'}</div>
                <div style={modalStyles.vaccinationActionsPetMeta}>
                  {actionLabTest.laboratory || actionLabTest.specimenType || 'Laboratory test'}
                  {' · '}{formatDateText(actionLabTest.date, undefined, actionLabTest.date)}
                </div>
              </div>
            </div>
            <StatusIndicator status={actionLabTest.status || 'ordered'} />
          </div>
          <div style={modalStyles.vaccinationActionsList}>
            <button type="button" onClick={() => openLabTestView(actionLabTest)} style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #b7e4d7', background: '#f2fbf8' }}>
              <span style={modalStyles.vaccinationActionCardText}><strong style={modalStyles.vaccinationActionCardTitle}>View Test</strong><small style={modalStyles.vaccinationActionCardDescription}>Review the test details and any recorded results.</small></span>
            </button>
            {!actionLabTest.archived && <button type="button" onClick={() => openResultEntryFromActions(actionLabTest)} style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #b7e4d7', background: '#f2fbf8' }}>
              <span style={modalStyles.vaccinationActionCardText}><strong style={modalStyles.vaccinationActionCardTitle}>Enter Results</strong><small style={modalStyles.vaccinationActionCardDescription}>Record findings and interpretation for this test.</small></span>
            </button>}
            {!actionLabTest.archived && <button type="button" disabled={getStatusKey(actionLabTest.status) === 'cancelled'} onClick={() => { setLabActionReturn(actionLabTest); setActionLabTest(null); requestLabTestAction('cancel', actionLabTest); }} style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #cbd9e8', background: '#f2fbf8', opacity: getStatusKey(actionLabTest.status) === 'cancelled' ? 0.55 : 1, cursor: getStatusKey(actionLabTest.status) === 'cancelled' ? 'not-allowed' : 'pointer' }}>
              <span style={modalStyles.vaccinationActionCardText}><strong style={modalStyles.vaccinationActionCardTitle}>Cancel Test</strong><small style={modalStyles.vaccinationActionCardDescription}>Cancel this lab test order. You will be asked to confirm.</small></span>
            </button>}
            <button type="button" onClick={() => openLabTestHistory(actionLabTest)} style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #b7e4d7', background: '#f2fbf8' }}>
              <span style={modalStyles.vaccinationActionCardText}><strong style={modalStyles.vaccinationActionCardTitle}>View Audit History</strong><small style={modalStyles.vaccinationActionCardDescription}>See changes and activity recorded for this lab test.</small></span>
            </button>
            <button type="button" onClick={() => { setLabActionReturn(actionLabTest); setActionLabTest(null); requestLabTestAction('archive', actionLabTest); }} style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #ffc0c8', background: '#fff5f6' }}>
              <span style={modalStyles.vaccinationActionCardText}><strong style={modalStyles.vaccinationActionCardTitle}>{actionLabTest.archived ? 'Restore Test' : 'Archive Test'}</strong><small style={modalStyles.vaccinationActionCardDescription}>{actionLabTest.archived ? 'Restore this test to the active lab-test list.' : 'Archive this lab test from the active list.'}</small></span>
            </button>
          </div>
          <div style={modalStyles.vaccinationActionsFooter}><span style={modalStyles.vaccinationActionsNote}>These actions only affect the selected lab test ({actionLabTest.id}).</span><button type="button" style={modalStyles.vaccinationActionsCancel} onClick={() => setActionLabTest(null)}>Cancel</button></div>
        </div>
      </div>}
      {resultEditor && <div className="lab-result-editor-backdrop" style={{ ...modalStyles.backdrop, padding: editorMode === 'results' ? 12 : 20 }} onClick={() => { setResultEditor(null); setLabActionReturn(null); }}>
        <form
          className={`lab-result-editor${editorMode === 'results' ? ' lab-result-entry' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="lab-result-editor-title"
          onSubmit={saveResultEditor}
          onClick={event => event.stopPropagation()}
          style={{ ...modalStyles.dialog, width: editorMode === 'results' ? 'min(760px, 70vw)' : 'min(640px, 100%)', maxHeight: editorMode === 'results' ? 'calc(100dvh - 40px)' : 'calc(100dvh - 32px)', padding: editorMode === 'results' ? '14px' : 'clamp(18px, 4vw, 24px)' }}
        >
          <button type="button" aria-label="Close lab test editor" onClick={() => { setResultEditor(null); setLabActionReturn(null); }} style={modalStyles.close}>{Icons.close}</button>
          {editorMode === 'results' ? (
            <>
              <header className="lab-result-entry-header">
                <span className="lab-result-entry-header-icon">{Icons.syringe}</span>
                <div><h2 id="lab-result-editor-title">Enter Lab Results</h2><p>Record and review laboratory test findings for this patient.</p></div>
                <div className="lab-result-entry-meta">
                  <span><small>Lab Test ID</small><strong>{resultEditor.id}</strong></span>
                  <span><small>Date Ordered</small><strong>{formatDateText(resultEditor.date, undefined, resultEditor.date)}</strong></span>
                  <StatusIndicator status={resultEditor.orderStatus || 'in-progress'} />
                </div>
              </header>
              <section className="lab-result-entry-patient">
                <span className="lab-result-entry-avatar">{String(resultEditor.pet || 'P').slice(0, 1).toUpperCase()}</span>
                <div><strong>{resultEditor.pet || 'Patient'}</strong><span>{[resultEditor.species, resultEditor.breed, resultEditor.age, resultEditor.sex, resultEditor.patientId ? `ID: ${String(resultEditor.patientId).startsWith('P-') ? resultEditor.patientId : `P-${String(resultEditor.patientId).padStart(4, '0')}`}` : ''].filter(Boolean).join(' · ') || resultEditor.testType}</span></div>
                <div className="lab-result-entry-owner">{Icons.user}<span><small>Owner</small><strong>{resultEditor.owner || 'Not recorded'}</strong>{resultEditor.ownerPhone && <small>{resultEditor.ownerPhone}</small>}</span></div>
              </section>
            </>
          ) : (
            <>
              <h2 id="lab-result-editor-title" style={{ margin: 0, paddingRight: 24, color: '#1f2937', fontSize: '1rem', fontWeight: 700 }}>Edit Test Details</h2>
              <p style={{ margin: '6px 0 0', color: '#475569', fontSize: '.75rem' }}>{resultEditor.id} · {resultEditor.pet}</p>
            </>
          )}
          <div className={`lab-editor-fields${editorMode === 'results' ? ' lab-result-entry-fields' : ''}`}>
            {editorMode === 'edit' && <>
              <label>Test Type<input required value={resultEditor.testType} onChange={event => setResultEditor(previous => ({ ...previous, testType: event.target.value }))} /></label>
              <label>Laboratory<input value={resultEditor.laboratory || ''} onChange={event => setResultEditor(previous => ({ ...previous, laboratory: event.target.value }))} /></label>
              <label>Test Date<LabDateTimePicker mode="date" required value={resultEditor.date} onChange={date => setResultEditor(previous => ({ ...previous, date }))} /></label>
              <label>Test Time<LabDateTimePicker mode="time" value={resultEditor.time} onChange={time => setResultEditor(previous => ({ ...previous, time }))} /></label>
            </>}
            <label className={editorMode === 'results' ? 'lab-result-entry-status' : ''}>Result Status
              {editorMode === 'results'
                ? <FilterSelect
                  label="Result Status"
                  value={resultEditor.status}
                  options={statusOptions.slice(1).map(([value, label]) => ({ value, label }))}
                  className="lab-wizard-filter-select lab-result-entry-select"
                  onChange={value => setResultEditor(previous => ({ ...previous, status: value }))}
                />
                : <select value={resultEditor.status} onChange={event => setResultEditor(previous => ({ ...previous, status: event.target.value }))}>
                  {statusOptions.slice(1).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>}
              {editorMode === 'results' && <small>Indicates the completeness of the result entry.</small>}
            </label>
            {editorMode === 'results' && <label className="lab-result-entry-test-type"><span>Lab Test Type</span><input value={resultEditor.testType || ''} readOnly /></label>}
            {editorMode === 'results' && <label className="lab-result-entry-date"><span>Result Date &amp; Time</span><LabDateTimePicker
              className="lab-result-entry-date-picker"
              label="Result Date and Time"
              value={resultEditor.resultDate && resultEditor.resultTime ? `${resultEditor.resultDate}T${resultEditor.resultTime}` : ''}
              onChange={value => {
                const [resultDate = '', resultTime = ''] = value.split('T');
                setResultEditor(previous => ({ ...previous, resultDate, resultTime }));
              }}
            /></label>}
            <label className="lab-editor-full lab-result-entry-summary"><span>{Icons.file}<span><strong>Result Summary</strong><small>Brief overview of the findings</small></span></span><textarea rows={2} maxLength={500} value={resultEditor.summary || ''} onChange={event => setResultEditor(previous => ({ ...previous, summary: event.target.value }))} /><small className="lab-result-entry-count">{(resultEditor.summary || '').length}/500</small></label>
            <div className={`lab-measurements lab-editor-full${editorMode === 'results' ? ' lab-result-entry-measurements' : ''}`}>
              <div className="lab-measurements-heading">
                <div className="lab-result-entry-section-title">{Icons.clipboard}<span><strong>Test Values and Reference Ranges</strong><small>Enter the individual test values. You can add multiple analytes as needed.</small></span></div>
                <button type="button" onClick={() => setResultEditor(previous => ({
                  ...previous,
                  measurements: [...previous.measurements, { name: '', value: '', unit: '', referenceRange: '', status: 'Not assessed' }],
                }))}>＋ Add Test Value</button>
              </div>
              {editorMode === 'results' && <div className="lab-measurement-table-wrap">
                <table className="lab-measurement-entry-table"><thead><tr><th>Analyte</th><th>Result</th><th>Unit</th><th>Reference Range</th><th>Status</th><th aria-label="Actions" /></tr></thead>
                  <tbody>{resultEditor.measurements.map((measurement, index) => (
                    <tr key={`editor-measurement-${index}`}>
                      {[
                        ['name', 'e.g. RBC (Red Blood Cells)'],
                        ['value', 'Enter result'],
                        ['unit', 'e.g. M/µL'],
                        ['referenceRange', 'e.g. 5.5 – 8.5'],
                      ].map(([key, placeholder]) => <td key={key}><input aria-label={`${['Analyte', 'Result', 'Unit', 'Reference Range'][['name', 'value', 'unit', 'referenceRange'].indexOf(key)]} ${index + 1}`} value={measurement[key] || ''} placeholder={placeholder} onChange={event => setResultEditor(previous => ({
                        ...previous,
                        measurements: previous.measurements.map((item, itemIndex) => (
                          itemIndex === index ? { ...item, [key]: event.target.value } : item
                        )),
                      }))} /></td>)}
                      <td><FilterSelect
                        label={`Result status ${index + 1}`}
                        value={measurement.status || 'Not assessed'}
                        options={['Not assessed', 'Normal', 'Low', 'High', 'Critical'].map(status => ({ value: status, label: status }))}
                        className="lab-wizard-filter-select lab-result-entry-select"
                        onChange={value => setResultEditor(previous => ({
                          ...previous,
                          measurements: previous.measurements.map((item, itemIndex) => (
                            itemIndex === index ? { ...item, status: value } : item
                          )),
                        }))}
                      /></td>
                      <td><button type="button" className="lab-measurement-remove" aria-label={`Remove test value ${index + 1}`} disabled={resultEditor.measurements.length === 1} onClick={() => setResultEditor(previous => ({
                        ...previous,
                        measurements: previous.measurements.filter((_, itemIndex) => itemIndex !== index),
                      }))}>{Icons.trash}</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>}
              {editorMode === 'edit' && resultEditor.measurements.map((measurement, index) => (
                <div className="lab-measurement-row" key={`editor-measurement-${index}`}>
                  {[
                    ['Test / analyte', 'name'],
                    ['Value', 'value'],
                    ['Unit', 'unit'],
                    ['Reference range', 'referenceRange'],
                  ].map(([label, key]) => (
                    <label key={key}><span>{label}</span><input value={measurement[key] || ''} onChange={event => setResultEditor(previous => ({
                      ...previous,
                      measurements: previous.measurements.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, [key]: event.target.value } : item
                      )),
                    }))} /></label>
                  ))}
                  {resultEditor.measurements.length > 1 && <button type="button" className="lab-measurement-remove" onClick={() => setResultEditor(previous => ({
                    ...previous,
                    measurements: previous.measurements.filter((_, itemIndex) => itemIndex !== index),
                  }))}>Remove</button>}
                </div>
              ))}
            </div>
            <label className="lab-editor-full lab-result-entry-interpretation"><span>{Icons.stethoscope}<span><strong>Veterinarian Interpretation</strong><small>Your professional assessment of the results, including clinical relevance.</small></span></span><textarea rows="3" maxLength={1000} value={resultEditor.interpretation || ''} onChange={event => setResultEditor(previous => ({ ...previous, interpretation: event.target.value }))} /><small className="lab-result-entry-count">{(resultEditor.interpretation || '').length}/1000</small></label>
            {editorMode === 'edit' && <label className="lab-editor-full">Clinical Notes<textarea rows="3" value={resultEditor.notes || ''} onChange={event => setResultEditor(previous => ({ ...previous, notes: event.target.value }))} /></label>}
            <section className="lab-editor-full lab-result-entry-upload">
              <div><span>{Icons.file}<strong>Upload Report</strong></span><small>Attach the official laboratory report (PDF, JPG, PNG).</small></div>
              <div className="lab-result-entry-upload-row">
                {(resultEditor.attachment || resultEditor.fileName) && <div className="lab-result-entry-file">{Icons.file}<span><strong>{resultEditor.attachment?.name || resultEditor.fileName}</strong><small>{resultEditor.attachment ? `${(resultEditor.attachment.size / (1024 * 1024)).toFixed(1)} MB` : 'Report attached'}</small></span><button type="button" aria-label="Remove attached report" onClick={() => setResultEditor(previous => ({ ...previous, attachment: null, fileName: '' }))}>{Icons.close}</button></div>}
                <label className={`lab-result-entry-choose${resultEditor.attachment || resultEditor.fileName ? '' : ' is-empty'}`}>{Icons.plus}<span>{resultEditor.attachment || resultEditor.fileName ? 'Replace file' : 'Choose file'}<small>or drag and drop</small></span><input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={async event => { const file = event.target.files?.[0] || null; setResultEditorError(''); setReportReadMessage(''); event.target.value = ''; if (!file) return; if (file.size > 4 * 1024 * 1024) { setResultEditorError('Choose a report file that is 4 MB or smaller.'); return; } if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) { setResultEditorError('Upload a PDF, JPG, or PNG laboratory report.'); return; } setResultEditor(previous => ({ ...previous, attachment: file, reportText: '' })); setReportReading(true); try { const { readLabReport } = await import('../../utils/labReportReader'); const extracted = await readLabReport(file, setReportReadMessage); setResultEditor(previous => ({ ...previous, reportText: extracted.text, summary: extracted.summary || previous.summary, interpretation: extracted.interpretation || previous.interpretation, measurements: extracted.measurements.length ? extracted.measurements : previous.measurements })); if (extracted.summary || extracted.interpretation || extracted.measurements.length) setReportReadMessage('Report read. Review the extracted fields before saving.'); else setReportReadMessage('Report attached. Review the recognized text below and enter the findings manually if needed.'); } catch (error) { setResultEditorError(error.message || 'Unable to read the report. You can still enter results manually.'); } finally { setReportReading(false); } }} /></label>
              </div>
              <small className="lab-result-entry-supported">Supported formats: PDF, JPG, PNG · Max size: 4 MB</small>
            </section>
          </div>
          {resultEditorError && <div className="lab-result-entry-error" role="alert">{resultEditorError}</div>}
          {reportReadMessage && <div className="lab-result-entry-note" role="status">{reportReadMessage}</div>}
          {resultEditor.reportText && <details className="lab-result-entry-recognized"><summary>Recognized report text</summary><pre>{resultEditor.reportText.slice(0, 6000)}</pre></details>}
          {editorMode === 'results' && <div className="lab-result-entry-note">{Icons.info}<span>Saved findings appear in this patient’s Lab Results. The uploaded report is also linked under Files &amp; Documents.</span></div>}
          <div className={`lab-result-editor-footer${editorMode === 'results' ? ' lab-result-entry-footer' : ''}`}>
            <button type="button" className={labActionReturn ? 'cancel lab-action-back-button' : 'cancel'} onClick={() => labActionReturn ? backToLabTestActions(() => setResultEditor(null)) : setResultEditor(null)}>{labActionReturn ? 'Back to actions' : 'Cancel'}</button>
            {editorMode === 'results' && <button type="submit" className="draft" value="draft" disabled={reportReading}>Save as Draft</button>}
            <button type="submit" className="save" disabled={reportReading}>{editorMode === 'results' ? 'Save Results' : 'Save Changes'}</button>
          </div>
        </form>
      </div>}
      {viewResult && <div className="lab-test-view-backdrop" onClick={() => { setViewResult(null); setLabActionReturn(null); }}>
        <div className={`lab-test-view-dialog${viewResultTab === 'result' ? ' has-result-tab' : ''}`} role="dialog" aria-modal={patientRecord ? 'false' : 'true'} aria-labelledby="lab-test-view-title" onClick={event => event.stopPropagation()}>
          <header className="lab-test-view-header">
            <div>
              <div className="lab-test-view-title-row">
                <span className="lab-test-view-title-icon">{Icons.clipboard}</span>
                <h2 id="lab-test-view-title">Lab Test</h2>
                <StatusIndicator status={viewResult.status || 'Pending'} className="lab-test-view-header-status" />
              </div>
              <p className="lab-test-view-subtitle">{viewResult.id} · {viewResult.testType || 'Laboratory test'}</p>
            </div>
            <button type="button" aria-label="Close lab test details" onClick={() => { setViewResult(null); setLabActionReturn(null); }}>{Icons.close}</button>
          </header>
          <div className="lab-test-view-patient">
            <span className="lab-test-view-pet-avatar">
              {viewResult.photo_url
                ? <img src={viewResult.photo_url} alt="" />
                : <span>{Icons.pet}</span>}
            </span>
            <div className="lab-test-view-pet-info">
              <strong>{viewResult.pet || 'Patient'}{viewResult.sex && /^male\b/i.test(viewResult.sex) ? <span className="lab-test-view-sex">♂</span> : null}</strong>
              <span>{[viewResult.breed, viewResult.species, viewResult.age, viewResult.weight].filter(Boolean).join(' · ') || 'Patient details not available'}</span>
            </div>
            <div className="lab-test-view-owner-info">
              <span>Owner</span>
              <strong>{viewResult.owner || 'Not recorded'}</strong>
              {viewResult.ownerPhone && <small><span aria-hidden="true">{Icons.phone}</span>{viewResult.ownerPhone}</small>}
            </div>
          </div>
          <div className="lab-test-view-tabs" role="tablist" aria-label="Lab test information">
            <button type="button" id="lab-test-details-tab" role="tab" aria-selected={viewResultTab === 'details'} aria-controls="lab-test-details-panel" className={viewResultTab === 'details' ? 'active' : ''} onClick={() => setViewResultTab('details')}><span>{Icons.clipboard}</span>Test Details</button>
            <button type="button" id="lab-test-result-tab" role="tab" aria-selected={viewResultTab === 'result'} aria-controls="lab-test-result-panel" className={viewResultTab === 'result' ? 'active' : ''} onClick={() => setViewResultTab('result')}><span>{Icons.activity}</span>Test Result</button>
          </div>
          <div className="lab-test-view-content">
            {viewResultTab === 'details' ? <section id="lab-test-details-panel" role="tabpanel" aria-labelledby="lab-test-details-tab">
              <dl className="lab-test-view-details">
                <div><dt>Test Type</dt><dd>{viewResult.testType || '—'}</dd></div>
                <div><dt>Date Requested</dt><dd>{formatDateTimeText(viewResult.orderDateTime || viewResult.date, 'en-US', viewResult.orderDateTime || viewResult.date || '—')}</dd></div>
                <div><dt>Laboratory</dt><dd>{viewResult.laboratory || 'In-house'}</dd></div>
                <div><dt>Date Completed</dt><dd>{viewResult.resultDate ? formatDateText(viewResult.resultDate, undefined, viewResult.resultDate) : '—'}</dd></div>
                <div><dt>Requested By</dt><dd>{viewResult.requestedBy || '—'}</dd></div>
                <div><dt>Status</dt><dd className="lab-test-view-inline-status"><StatusIndicator status={viewResult.status || 'Pending'} /></dd></div>
              </dl>
              <section className="lab-test-view-info-card">
                <span className="lab-test-view-info-icon">{Icons.file}</span>
                <div><h3>Notes</h3><p>{viewResult.notes || viewResult.indication || 'No clinical notes recorded.'}</p></div>
              </section>
              <section className="lab-test-view-info-card">
                <span className="lab-test-view-info-icon">{Icons.stethoscope}</span>
                <div><h3>Veterinarian Interpretation</h3><p>{viewResult.interpretation || 'No interpretation recorded.'}</p></div>
              </section>
            </section> : <section id="lab-test-result-panel" role="tabpanel" aria-labelledby="lab-test-result-tab">
              <div className={`lab-test-result-status${resultIsAvailable ? ' available' : ''}`}>
                <div><span className="lab-test-result-status-dot" /><div><strong>{resultIsAvailable ? 'Result available' : 'Result not entered yet'}</strong><small>{resultIsAvailable ? `Reported ${formatDateText(viewResult.resultDate || viewResult.reportedAt || viewResult.date, undefined, viewResult.resultDate || viewResult.reportedAt || viewResult.date)}` : 'Enter the findings when the laboratory results are ready.'}</small></div></div>
                <button type="button" onClick={() => { const selectedResult = viewResult; setViewResult(null); openResultEditor(selectedResult, 'results'); }}>{resultIsAvailable ? 'Edit Result' : 'Enter Result'}</button>
              </div>
              {resultIsAvailable ? <>
                <section className="lab-test-view-result-summary">
                  <div><span>Result summary</span><strong>{viewResult.summary || 'No summary recorded.'}</strong></div>
                </section>
                <section className="lab-test-view-result-table-section">
                  <div className="lab-test-view-section-heading"><div><h3>Test Result</h3><p>Recorded analytes and their reference ranges.</p></div></div>
                  {viewResult.measurements?.length ? <div className="lab-test-view-table-wrap">
                    <table className="lab-test-view-table">
                      <thead><tr><th>Test / analyte</th><th>Result</th><th>Unit</th><th>Reference range</th><th>Assessment</th></tr></thead>
                      <tbody>{viewResult.measurements.map((measurement, index) => <tr key={`${measurement.name}-${index}`}>
                        <td>{measurement.name || '—'}</td><td>{measurement.value || '—'}</td><td>{measurement.unit || '—'}</td><td>{measurement.referenceRange || '—'}</td><td>{measurement.status || measurement.interpretation || '—'}</td>
                      </tr>)}</tbody>
                    </table>
                  </div> : <p className="lab-test-view-empty">A result summary is available, but no individual analyte values were recorded.</p>}
                </section>
                <section className="lab-test-view-interpretation"><h3>Veterinarian interpretation</h3><p>{viewResult.interpretation || 'No interpretation recorded.'}</p></section>
                {(viewResult.fileName || viewResult.downloadable) && <div className="lab-result-attachment"><span>{viewResult.fileName || `${String(viewResult.id).toLowerCase()}_report.pdf`}</span>{viewResult.downloadable && <button type="button" onClick={() => downloadResult(viewResult)}>Download report</button>}</div>}
              </> : <div className="lab-test-view-no-result"><strong>No test result has been recorded.</strong><p>When the laboratory findings are available, enter the summary, values, and veterinarian interpretation here.</p></div>}
            </section>}
          </div>
          <footer className="lab-test-view-footer">{labActionReturn && <button type="button" className="lab-test-view-back-button" onClick={() => backToLabTestActions(() => setViewResult(null))}>Back to actions</button>}<button type="button" className="lab-test-view-close-button" onClick={() => { setViewResult(null); setLabActionReturn(null); }}>Close</button></footer>
        </div>
      </div>}
      {historyResult && <div className="lab-audit-backdrop" onClick={() => { setHistoryResult(null); setLabActionReturn(null); }}>
        <div className="lab-audit-dialog" role="dialog" aria-modal="true" aria-labelledby="lab-audit-title" onClick={event => event.stopPropagation()}>
          <header className="lab-audit-header">
            <div><h2 id="lab-audit-title">Lab Test Audit History</h2><p>{historyResult.pet || 'Patient'} · Recorded changes to this lab test</p></div>
            <button type="button" aria-label="Close audit history" onClick={() => { setHistoryResult(null); setLabActionReturn(null); }}>{Icons.close}</button>
          </header>
          <div className="lab-audit-tabs" role="tablist" aria-label="Audit test information">
            <button type="button" role="tab" aria-selected={historyTab === 'details'} className={historyTab === 'details' ? 'active' : ''} onClick={() => setHistoryTab('details')}>Test Details</button>
            <button type="button" role="tab" aria-selected={historyTab === 'result'} className={historyTab === 'result' ? 'active' : ''} onClick={() => setHistoryTab('result')}>Test Result</button>
          </div>
          <div className="lab-audit-content">
            {historyTab === 'details' ? <dl className="lab-audit-summary">
              <div><dt>Test Name</dt><dd>{historyResult.testType || '—'}</dd></div>
              <div><dt>Date Requested</dt><dd>{formatDateTimeText(historyResult.orderDateTime || historyResult.date, 'en-US', historyResult.orderDateTime || historyResult.date || '—')}</dd></div>
              <div><dt>Pet Name</dt><dd>{historyResult.pet || '—'}</dd></div>
              <div><dt>Laboratory</dt><dd>{historyResult.laboratory || '—'}</dd></div>
              <div><dt>Owner</dt><dd>{historyResult.owner || '—'}</dd></div>
              <div><dt>Status</dt><dd><StatusIndicator status={historyResult.status || 'Pending'} /></dd></div>
              <div><dt>Requesting Veterinarian</dt><dd>{historyResult.requestedBy || '—'}</dd></div>
              <div><dt>Notes</dt><dd>{historyResult.notes || historyResult.indication || '—'}</dd></div>
            </dl> : <section className="lab-audit-result">
              <div className="lab-audit-result-heading"><h3>Test Result</h3><StatusIndicator status={historyResult.status || 'Pending'} /></div>
              <div className="lab-audit-result-summary"><span>Result summary</span><strong>{historyResult.summary || 'No result summary recorded.'}</strong></div>
              <div className="lab-audit-result-meta"><div><span>Date completed</span><strong>{historyResult.resultDate ? formatDateTimeText(historyResult.resultTime ? `${historyResult.resultDate}T${historyResult.resultTime}` : historyResult.resultDate, 'en-US', historyResult.resultDate) : '—'}</strong></div><div><span>Interpretation</span><strong>{historyResult.interpretation || '—'}</strong></div></div>
              {historyResult.measurements?.length ? <div className="lab-audit-result-table-wrap"><table className="lab-audit-result-table"><thead><tr><th>Test / analyte</th><th>Result</th><th>Unit</th><th>Reference range</th></tr></thead><tbody>{historyResult.measurements.map((measurement, index) => <tr key={`${measurement.name}-${index}`}><td>{measurement.name || '—'}</td><td>{measurement.value || '—'}</td><td>{measurement.unit || '—'}</td><td>{measurement.referenceRange || '—'}</td></tr>)}</tbody></table></div> : <p className="lab-audit-empty">No individual test values recorded.</p>}
            </section>}
            <section className="lab-audit-timeline lab-result-audit-timeline">
              <h3>Activity Timeline</h3>
              {historyTimeline.length ? <ol>{historyTimeline.map((event, index) => <AuditTimelineEntry key={`${event.title}-${event.date}-${index}`}
                date={formatDateTimeText(event.date, 'en-US', event.date)} dateTime={event.date} title={event.title} detail={event.detail}
                actor={event.title === 'Result Received' ? '' : event.actor} />)}</ol> : <p className="lab-audit-empty">No dated activity has been recorded for this test.</p>}
            </section>
          </div>
          <footer className="lab-audit-footer">{labActionReturn && <button type="button" className="lab-audit-back-button" onClick={() => backToLabTestActions(() => setHistoryResult(null))}>Back to actions</button>}<button type="button" className="lab-audit-close-button" onClick={() => { setHistoryResult(null); setLabActionReturn(null); }}>Close</button></footer>
        </div>
      </div>}
      {labTestConfirmation && <div style={modalStyles.backdrop} onClick={() => setLabTestConfirmation(null)}>
        <div role="alertdialog" aria-modal="true" aria-labelledby="lab-test-confirm-title" aria-describedby="lab-test-confirm-description" onClick={event => event.stopPropagation()} style={{ ...modalStyles.dialog, width: 'min(420px, 100%)', padding: '22px 24px 18px' }}>
          <h2 id="lab-test-confirm-title" style={{ margin: 0, color: '#1f2937', fontSize: '1rem', fontWeight: 700 }}>
            {labTestConfirmation.action === 'archive' ? (labTestConfirmation.result.archived ? 'Restore lab test?' : 'Archive lab test?') : 'Cancel lab test?'}
          </h2>
          <p id="lab-test-confirm-description" style={{ margin: '9px 0 0', color: '#526571', fontSize: '.8rem', lineHeight: 1.5 }}>
            {labTestConfirmation.action === 'archive'
              ? `${labTestConfirmation.result.id} for ${labTestConfirmation.result.pet} will be ${labTestConfirmation.result.archived ? 'restored to' : 'moved to'} the ${labTestConfirmation.result.archived ? 'active' : 'archived'} lab tests.`
              : `${labTestConfirmation.result.id} for ${labTestConfirmation.result.pet} will be marked as cancelled.`}
          </p>
          <div style={{ ...modalStyles.footer, marginTop: 20 }}>
            <button type="button" style={modalStyles.cancel} onClick={() => backToLabTestActions(() => setLabTestConfirmation(null))}>{labActionReturn ? 'Back to actions' : 'Keep test'}</button>
            <button type="button" style={{ ...T.primaryBtn, padding: '9px 14px', fontSize: '.76rem', background: labTestConfirmation.action === 'archive' && !labTestConfirmation.result.archived ? '#a33b2e' : '#005447' }} onClick={confirmLabTestAction}>
              {labTestConfirmation.action === 'archive' ? (labTestConfirmation.result.archived ? 'Restore test' : 'Archive test') : 'Cancel test'}
            </button>
          </div>
        </div>
      </div>}
    </div>
  );
}

function InpatientTab({ user, onOpenTreatmentPlan, appointments = [], externalAdmissionRequest = null, onExternalAdmissionClose, onExternalAdmissionSave }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [localRecords, setLocalRecords] = useState([]);
  const [clinicPets, setClinicPets] = useState([]);
  const [treatmentPlans, setTreatmentPlans] = useState([]);
  const [doctorOptions, setDoctorOptions] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [recordsError, setRecordsError] = useState('');
  const [careLogs, setCareLogs] = useState({ observations: [], medications: [] });
  const [loadingCare, setLoadingCare] = useState(false);
  const [careForm, setCareForm] = useState({ clinical_progress: '', temperature: '', heart_rate: '', respiratory_rate: '', hydration: '', appetite: '', pain_assessment: '' });
  const [medicationForm, setMedicationForm] = useState({ prescription_id: '', medication: '', dose: '', status: 'administered', notes: '' });
  const [dischargeForm, setDischargeForm] = useState({ discharge_assessment: '', home_instructions: '', outstanding_concerns: '', follow_up_recommendations: '' });
  const [savingCare, setSavingCare] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [admitOpen, setAdmitOpen] = useState(Boolean(externalAdmissionRequest));
  const [admitError, setAdmitError] = useState('');
  const [admitForm, setAdmitForm] = useState({ pet_id: '', ward: '', admitted_at: getLocalDateTimeInputValue(), admission_reason: '', urgency_level: 'Normal', presenting_complaint: '', provisional_diagnosis: '', initial_assessment: '', patient_weight: '', temperature: '', heart_rate: '', respiratory_rate: '', physical_notes: '', known_allergies: '', relevant_medical_history: '', expected_discharge_at: '', attending_veterinarian_id: '', treatment_plan_id: '', consent_status: 'obtained', authorized_by: '', consent_date_time: getLocalDateTimeInputValue(), consent_scope: 'Hospital admission and inpatient care', consent_notes: 'Owner agrees to hospital admission and the recommended treatment plan. No additional concerns at this time.', estimated_cost: '', estimated_add_ons: '', authorized_limit: '' });
  const [patientSearch, setPatientSearch] = useState('');
  const [activeAdmissionTab, setActiveAdmissionTab] = useState(0);
  const admissionTabs = ['Patient & Owner', 'Assessment', 'Treatment Plan', 'Hospitalization', 'Consent & Authorization', 'Patient Summary'];
  const [treatmentPlanMode, setTreatmentPlanMode] = useState('none');
  const [newPlanForm, setNewPlanForm] = useState({ title: '', diagnosis: '', first_step: '' });
  const [pendingNewPlanId, setPendingNewPlanId] = useState('');
  const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
  const request = async (path, options = {}) => {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${user?.token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (HTTP ${response.status}).`);
    return payload;
  };
  const loadStays = async () => {
    if (!user?.token || !user?.clinic_id) return;
    setLoadingRecords(true);
    try {
      const query = `?clinic_id=${encodeURIComponent(user.clinic_id)}`;
      const [stays, pets, plans, staff] = await Promise.all([
        request(`/clinic-records/inpatient-stays${query}`),
        request(`/clinic-records/pets${query}`),
        request(`/clinic-records/treatment-plans${query}`),
        request(`/clinics/${encodeURIComponent(user.clinic_id)}/staff?status=active`),
      ]);
      setClinicPets(pets);
      setTreatmentPlans(plans);
      setDoctorOptions(staff.filter(member => ['doctor', 'veterinarian', 'assistant_doctor'].includes(String(member.role || '').trim().toLowerCase().replace(/[\\s-]+/g, '_'))));
      setLocalRecords(stays.map(stay => ({
        ...stay,
        id: `INP-${stay.id}`,
        databaseId: stay.id,
        pet: stay.pet,
        owner: stay.owner || 'Not recorded',
        admitted: formatDateTimeText(stay.admitted_at || stay.admitted_on),
        ward: stay.ward || 'Not assigned',
        diagnosis: stay.admission_reason || 'Not recorded',
        discharge: stay.expected_discharge_at ? formatDateText(stay.expected_discharge_at) : 'Not scheduled',
        doctor: stay.veterinarian || 'Not assigned',
        status: stay.status === 'active' ? 'admitted' : 'discharged',
      })));
      setRecordsError('');
    } catch (error) {
      setRecordsError(error.message || 'Unable to load inpatient records.');
    } finally {
      setLoadingRecords(false);
    }
  };
  useEffect(() => { loadStays(); }, [user?.token, user?.clinic_id]);
  useEffect(() => {
    if (!externalAdmissionRequest) return;
    const admittedAt = externalAdmissionRequest.date && externalAdmissionRequest.time
      ? new Date(`${externalAdmissionRequest.date}T${externalAdmissionRequest.time}`)
      : null;
    setAdmitForm(current => ({
      ...current,
      pet_id: externalAdmissionRequest.pet_id || '',
      admitted_at: admittedAt && !Number.isNaN(admittedAt.getTime()) ? getLocalDateTimeInputValue(admittedAt) : current.admitted_at,
      admission_reason: externalAdmissionRequest.service_name || 'Confinement',
      presenting_complaint: externalAdmissionRequest.reason_for_visit || 'Confinement admission',
      attending_veterinarian_id: externalAdmissionRequest.practitioner_id || '',
      authorized_by: externalAdmissionRequest.authorized_by || '',
    }));
    setPatientSearch(externalAdmissionRequest.pet || '');
    setActiveAdmissionTab(0);
  }, [externalAdmissionRequest]);
  const records = localRecords.filter(record => (
    (filter === 'all' || record.status === filter) &&
    [record.id, record.pet, record.owner, record.ward, record.diagnosis, record.discharge, record.doctor, record.status]
      .some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase()))
  ));
  const admittedCount = localRecords.filter(record => record.status === 'admitted').length;
  const dischargedCount = localRecords.filter(record => record.status === 'discharged').length;
  const pendingAdmissions = appointments.filter(appointment => {
    let notes = appointment.notes || {};
    if (typeof notes === 'string') { try { notes = JSON.parse(notes); } catch { notes = {}; } }
    return !appointment.archived && /inpatient|confinement|hospital|admission/.test(String(notes.service_category || appointment.type || '').toLowerCase())
      && !['completed', 'complete', 'cancelled', 'canceled', 'no show', 'no-show'].includes(String(appointment.status || '').toLowerCase());
  });
  const petOptions = clinicPets;
  const selectedAdmissionPet = clinicPets.find(pet => String(pet.id) === String(admitForm.pet_id));
  const visiblePetOptions = clinicPets.filter(pet => `${pet.name} ${pet.id} ${pet.breed || ''} ${pet.owner || ''}`.toLowerCase().includes(patientSearch.trim().toLowerCase()));
  const linkedAdmissionPlan = treatmentPlans.find(plan => String(plan.id) === String(admitForm.treatment_plan_id));
  const wardOptions = ['Ward A - Cage 1', 'Ward A - Cage 2', 'Ward A - Cage 3', 'Ward B - Cage 1', 'Ward B - Cage 2'];
  const closeAdmit = (notifyExternal = true) => {
    setAdmitOpen(false);
    setAdmitError('');
    setAdmitForm({ pet_id: '', ward: '', admitted_at: getLocalDateTimeInputValue(), admission_reason: '', urgency_level: 'Normal', presenting_complaint: '', provisional_diagnosis: '', initial_assessment: '', patient_weight: '', temperature: '', heart_rate: '', respiratory_rate: '', physical_notes: '', known_allergies: '', relevant_medical_history: '', expected_discharge_at: '', attending_veterinarian_id: '', treatment_plan_id: '', consent_status: 'obtained', authorized_by: '', consent_date_time: getLocalDateTimeInputValue(), consent_scope: 'Hospital admission and inpatient care', consent_notes: 'Owner agrees to hospital admission and the recommended treatment plan. No additional concerns at this time.', estimated_cost: '', estimated_add_ons: '', authorized_limit: '' });
    setPatientSearch('');
    setActiveAdmissionTab(0);
    setTreatmentPlanMode('none');
    setNewPlanForm({ title: '', diagnosis: '', first_step: '' });
    setPendingNewPlanId('');
    if (notifyExternal && externalAdmissionRequest) onExternalAdmissionClose?.();
  };
  const admissionTabIsValid = tab => {
    const valid = tab === 0
      ? Boolean(admitForm.pet_id)
      : tab === 1
        ? Boolean(admitForm.admitted_at && admitForm.admission_reason.trim() && admitForm.presenting_complaint.trim())
        : tab === 2
          ? (treatmentPlanMode !== 'existing' || Boolean(admitForm.treatment_plan_id)) && (treatmentPlanMode !== 'new' || Boolean(newPlanForm.title.trim() && newPlanForm.diagnosis.trim() && newPlanForm.first_step.trim()))
          : tab === 3
            ? Boolean(admitForm.ward && admitForm.attending_veterinarian_id)
            : tab === 4
              ? Boolean(admitForm.consent_status && admitForm.authorized_by && admitForm.consent_date_time && admitForm.consent_scope)
              : true;
    if (!valid) setAdmitError(tab === 0 ? 'Select a registered patient to continue.' : tab === 1 ? 'Enter the admission date, reason, and presenting complaint to continue.' : tab === 2 ? 'Select a treatment plan or choose no linked plan.' : tab === 3 ? 'Choose a ward and attending veterinarian to continue.' : 'Complete the consent details to continue.');
    return valid;
  };
  const advanceAdmissionTab = () => {
    if (!admissionTabIsValid(activeAdmissionTab)) return;
    setAdmitError('');
    setActiveAdmissionTab(current => Math.min(current + 1, admissionTabs.length - 1));
  };
  const selectAdmissionTab = index => {
    if (index <= activeAdmissionTab) {
      setAdmitError('');
      setActiveAdmissionTab(index);
      return;
    }
    for (let tab = activeAdmissionTab; tab < index; tab += 1) {
      if (!admissionTabIsValid(tab)) {
        setActiveAdmissionTab(tab);
        return;
      }
    }
    setAdmitError('');
    setActiveAdmissionTab(index);
  };
  const reviewAdmissionSummary = event => {
    event.preventDefault();
    event.stopPropagation();
    for (let tab = 0; tab < admissionTabs.length - 1; tab += 1) {
      if (!admissionTabIsValid(tab)) {
        setActiveAdmissionTab(tab);
        return;
      }
    }
    setAdmitError('');
    setActiveAdmissionTab(admissionTabs.length - 1);
  };
  const retreatAdmissionTab = () => {
    setAdmitError('');
    setActiveAdmissionTab(current => Math.max(current - 1, 0));
  };
  const submitAdmission = async event => {
    event.preventDefault();
    if (activeAdmissionTab !== admissionTabs.length - 1 || savingCare) return;
    const invalidTab = [0, 1, 2, 3].find(tab => !admissionTabIsValid(tab));
    if (invalidTab !== undefined || !admitForm.pet_id || !admitForm.ward || !admitForm.attending_veterinarian_id || !admitForm.admission_reason || !admitForm.presenting_complaint || !admitForm.admitted_at
      || !admitForm.consent_status || !admitForm.authorized_by || !admitForm.consent_date_time || !admitForm.consent_scope
      || (treatmentPlanMode === 'existing' && !admitForm.treatment_plan_id)
      || (treatmentPlanMode === 'new' && (!newPlanForm.title.trim() || !newPlanForm.diagnosis.trim() || !newPlanForm.first_step.trim()))) {
      if (invalidTab !== undefined) setActiveAdmissionTab(invalidTab);
      if (treatmentPlanMode === 'new' && (!newPlanForm.title.trim() || !newPlanForm.diagnosis.trim() || !newPlanForm.first_step.trim())) setActiveAdmissionTab(2);
      setAdmitError('Complete the required patient, admission, treatment-plan, and consent fields.');
      return;
    }
    setSavingCare(true);
    try {
      let treatmentPlanId = treatmentPlanMode === 'existing' ? admitForm.treatment_plan_id : '';
      if (treatmentPlanMode === 'new') {
        if (pendingNewPlanId) treatmentPlanId = pendingNewPlanId;
        else {
          const plan = await request(`/clinic-records/treatment-plans?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
            method: 'POST',
            body: JSON.stringify({
              pet_id: Number(admitForm.pet_id),
              title: newPlanForm.title.trim(),
              diagnosis: newPlanForm.diagnosis.trim(),
              severity: 'Moderate',
              attending_veterinarian_id: admitForm.attending_veterinarian_id || null,
              steps: [{ title: newPlanForm.first_step.trim(), done: false }],
            }),
          });
          treatmentPlanId = plan.id;
          setPendingNewPlanId(String(plan.id));
          setTreatmentPlans(previous => [plan, ...previous]);
        }
      }
      const result = await request(`/clinic-records/inpatient-stays?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'POST', body: JSON.stringify({ ...admitForm, initial_assessment: admitForm.physical_notes, treatment_plan_id: treatmentPlanId || null, expected_discharge_at: admitForm.expected_discharge_at || null, authorized_by: admitForm.authorized_by || selectedAdmissionPet?.owner || '', consent_date_time: admitForm.consent_date_time || getLocalDateTimeInputValue(), consent_scope: admitForm.consent_scope || 'Hospital admission and inpatient care' }),
      });
      await loadStays();
      closeAdmit(false);
      notifySuccess('Patient admitted successfully', `Inpatient record INP-${result.id} was created.`);
      if (externalAdmissionRequest) onExternalAdmissionSave?.();
    } catch (error) {
      setAdmitError(error.message || 'Unable to admit this patient.');
    } finally {
      setSavingCare(false);
    }
  };
  useEffect(() => {
    if (!selectedRecord?.databaseId) return;
    let active = true;
    setLoadingCare(true);
    request(`/clinic-records/inpatient-stays/${selectedRecord.databaseId}/care?clinic_id=${encodeURIComponent(user.clinic_id)}`)
      .then(data => { if (active) setCareLogs(data); })
      .catch(error => { if (active) setRecordsError(error.message || 'Unable to load inpatient care logs.'); })
      .finally(() => { if (active) setLoadingCare(false); });
    return () => { active = false; };
  }, [selectedRecord?.databaseId]);
  const submitCareLog = async (event, type) => {
    event.preventDefault();
    if (!selectedRecord?.databaseId || savingCare) return;
    setSavingCare(true);
    const isMedication = type === 'medications';
    try {
      await request(`/clinic-records/inpatient-stays/${selectedRecord.databaseId}/${type}?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'POST', body: JSON.stringify(isMedication ? medicationForm : careForm),
      });
      const data = await request(`/clinic-records/inpatient-stays/${selectedRecord.databaseId}/care?clinic_id=${encodeURIComponent(user.clinic_id)}`);
      setCareLogs(data);
      if (isMedication) setMedicationForm({ prescription_id: '', medication: '', dose: '', status: 'administered', notes: '' });
      else setCareForm({ clinical_progress: '', temperature: '', heart_rate: '', respiratory_rate: '', hydration: '', appetite: '', pain_assessment: '' });
      setRecordsError('');
      notifySuccess(isMedication ? 'Medication event recorded' : 'Inpatient observation recorded', 'The entry is timestamped and attributed to your account.');
    } catch (error) {
      setRecordsError(error.message || 'Unable to save this inpatient record.');
    } finally {
      setSavingCare(false);
    }
  };
  const dischargePatient = async () => {
    if (!selectedRecord?.databaseId || !dischargeForm.discharge_assessment.trim() || savingCare) return;
    setSavingCare(true);
    try {
      const result = await request(`/clinic-records/inpatient-stays/${selectedRecord.databaseId}/discharge?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'PATCH', body: JSON.stringify(dischargeForm),
      });
      const updatedRecord = { ...selectedRecord, ...result, status: 'discharged' };
      setSelectedRecord(updatedRecord);
      setLocalRecords(previous => previous.map(item => item.databaseId === updatedRecord.databaseId ? { ...item, ...updatedRecord } : item));
      await loadStays();
      setRecordsError('');
      notifySuccess(`Patient ${selectedRecord.pet} discharged`, 'Discharge assessment and home-care instructions were saved.');
    } catch (error) {
      setRecordsError(error.message || 'Unable to discharge this patient.');
    } finally {
      setSavingCare(false);
    }
  };
  const openInpatientRecord = record => {
    setSelectedRecord(record);
    setDischargeForm({ discharge_assessment: '', home_instructions: '', outstanding_concerns: '', follow_up_recommendations: '' });
    setRecordsError('');
  };
  return (
    <div className="clinic-management-tab clinic-inpatient-tab" style={{ ...T.wrap, padding: '20px 20px 18px', borderRadius: 14 }}>
      <div className="lab-results-header">
        <div>
          <h2 className="lab-results-title">Inpatient &amp; Ward Management</h2>
          <p className="lab-results-description">Track hospitalized patients, ward assignments, and discharge status.</p>
        </div>
      </div>
      {pendingAdmissions.length > 0 && <section className="lab-clinical-history-state" style={{ margin: '0 0 14px' }}><strong>Scheduled for inpatient assessment</strong>{pendingAdmissions.map(appointment => <div key={appointment.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8, color: '#334155' }}><span>{appointment.pet} · {appointment.reason}</span><span>{formatDateTimeText(appointment.start_time, 'en-US', appointment.start_time)} · Awaiting admission confirmation</span></div>)}</section>}
      <div className="lab-status-row clinic-management-status-row clinic-inpatient-status-row">
        <div className="lab-status-filters" role="tablist" aria-label="Inpatient status">
          {[
            ['all', 'All Patients', localRecords.length],
            ['admitted', 'Currently Admitted', admittedCount],
            ['discharged', 'Discharged', dischargedCount],
          ].map(([value, label, count]) => <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className={filter === value ? 'active' : ''}
            onClick={() => setFilter(value)}
          >{label}<span>{count}</span></button>)}
        </div>
        <button type="button" className="lab-results-add" onClick={() => setAdmitOpen(true)}>{Icons.plus} Admit Patient</button>
      </div>
      <div className="lab-filter-bar clinic-inpatient-filter-bar">
        <label className="lab-results-search">
          {Icons.search}
          <input type="search" aria-label="Search inpatient records" placeholder="Search patient, owner, ward, diagnosis, or record ID..." value={search} onChange={event => setSearch(event.target.value)} />
        </label>
      </div>
      {recordsError && !selectedRecord && <div role="alert" style={{ margin: '10px 0', color: '#b42318', fontSize: '.75rem' }}>{recordsError}</div>}
      {loadingRecords && <div role="status" style={{ margin: '10px 0', color: '#526571', fontSize: '.75rem' }}>Loading inpatient stays...</div>}
      {filter === 'admitted' && (
        <div className="lab-clinical-history-state clinic-inpatient-notice" role="status">
          Showing {admittedCount} currently admitted {admittedCount === 1 ? 'patient' : 'patients'}.
        </div>
      )}
      <section className="lab-results-list clinic-management-list clinic-inpatient-list">
        <div className="lab-results-table-wrap">
          <table className="lab-results-table clinic-management-table clinic-inpatient-table">
            <thead>
              <tr>
                {['ID', 'Pet', 'Owner', 'Admitted', 'Ward / Cage', 'Diagnosis', 'Exp. Discharge', 'Doctor', 'Status', 'Actions'].map(label => <th key={label} className={label === 'Actions' ? 'clinic-action-heading' : undefined} aria-label={label === 'Actions' ? 'Row actions' : undefined}>{label === 'Actions' ? '' : label}</th>)}
              </tr>
            </thead>
            <tbody>
              {records.map(record => {
                const openActions = () => openInpatientRecord(record);
                return <tr key={record.id} className="clinic-action-row" tabIndex={0} onClick={openActions} onKeyDown={event => handleClinicActionRowKeyDown(event, openActions)}>
                <td className="clinic-management-id">{record.id}</td>
                <td className="clinic-management-primary">{record.pet}</td>
                <td>{record.owner}</td>
                <td>{record.admitted}</td>
                <td>{record.ward}</td>
                <td>{record.diagnosis}</td>
                <td>{record.discharge}</td>
                <td>{record.doctor}</td>
                <td><StatusIndicator status={record.status === 'admitted' ? 'Active' : 'Completed'} /></td>
                <td className="lab-result-actions">
                  <button type="button" className="clinic-record-actions-trigger" aria-label={`Open actions for inpatient record ${record.id}`} onClick={event => { event.stopPropagation(); openActions(); }}>
                    {Icons.chevronRight}
                  </button>
                </td>
              </tr>;
              })}
              {!records.length && <tr><td className="lab-results-empty" colSpan="10">No inpatient records match the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {admitOpen && <div style={modalStyles.backdrop} onClick={closeAdmit}>
        <ModalDialog as="form" size="large" role="dialog" aria-modal="true" aria-labelledby="admit-patient-title" onSubmit={submitAdmission} onClick={event => event.stopPropagation()} className="clinic-inpatient-admit-dialog" style={modalStyles.dialog}>
          <button type="button" aria-label="Close admit patient" onClick={closeAdmit} style={modalStyles.close}>{Icons.close}</button>
          <ModalHeader style={{ paddingRight: 24, marginBottom: 0 }}>
            <ModalTitle id="admit-patient-title" style={{ margin: 0, color: '#171717', fontSize: '1.05rem', fontWeight: 700 }}>Admit Patient</ModalTitle>
            <ModalDescription as="div" style={{ marginTop: 7, color: '#64748b', fontSize: '.73rem' }}>Create this hospital stay and link it to the registered patient and treatment plan.</ModalDescription>
          </ModalHeader>
          <ModalStepper as="div" className="clinic-inpatient-admit-tabs" role="tablist" aria-label="Admission sections">
            {admissionTabs.map((tab, index) => <button key={tab} id={`inpatient-admission-tab-${index}`} type="button" role="tab" aria-selected={activeAdmissionTab === index} aria-controls={index === 5 ? 'inpatient-admission-summary-panel' : 'inpatient-admission-tabpanel'} onClick={() => selectAdmissionTab(index)} className={activeAdmissionTab === index ? 'is-active' : index < activeAdmissionTab ? 'is-complete' : ''}><span aria-hidden="true" /><small>{tab}</small></button>)}
          </ModalStepper>
          <div className="clinic-inpatient-admit-body">
          <div id="inpatient-admission-tabpanel" role="tabpanel" aria-labelledby={`inpatient-admission-tab-${activeAdmissionTab}`} className={`clinic-inpatient-admit-fields${activeAdmissionTab === 1 ? ' clinic-inpatient-assessment-fields' : ''}`} style={{ display: activeAdmissionTab === 5 ? 'none' : 'grid', gridTemplateColumns: '1fr 1fr', gap: activeAdmissionTab === 1 ? '10px 14px' : '14px 16px', marginTop: activeAdmissionTab === 1 ? 14 : 18 }}>
            {activeAdmissionTab === 0 && <>
            <strong style={{ gridColumn: '1 / -1', color: '#193a32', fontSize: '.78rem' }}>1. Patient &amp; Owner</strong>
            <label className="clinic-inpatient-admit-span" style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>Search patient by name or ID
              <input value={patientSearch} onChange={event => setPatientSearch(event.target.value)} placeholder="Search patient name or ID..." style={{ border: '1px solid #d6e5e0', borderRadius: 8, background: '#fff', color: '#111827', padding: '11px 12px', fontSize: '.78rem' }} />
            </label>
            {[
              ['Patient (Pet)*', 'pet_id', 'Select patient', visiblePetOptions.map(option => ({ value: option.id, label: option.name }))],
            ].map(([label, field, placeholder, options]) => (
              <label key={field} style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>
                {label}
                <span style={{ position: 'relative' }}>
                  <select required={field === 'pet_id'} value={admitForm[field]} onChange={event => { const pet = clinicPets.find(option => String(option.id) === event.target.value); setAdmitForm(previous => ({ ...previous, [field]: event.target.value, ...(field === 'pet_id' ? { treatment_plan_id: '', patient_weight: pet?.weight || '', known_allergies: pet?.allergies && pet.allergies !== 'Not recorded' ? pet.allergies : '', authorized_by: pet?.owner ? `${pet.owner} (Owner)` : '', consent_scope: 'Hospital admission and inpatient care', consent_date_time: previous.consent_date_time || getLocalDateTimeInputValue() } : {}) })); }} style={{ width: '100%', appearance: 'none', border: 'none', borderRadius: 9, background: '#f1f1f3', color: '#111827', padding: '10px 35px 10px 13px', fontSize: '.75rem', outline: 'none' }}>
                    <option value="" disabled>{placeholder}</option>
                    {options.map(option => <option key={option.value} value={option.value} style={{ color: '#111827' }}>{option.label}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 13, top: '46%', transform: 'translateY(-50%)', color: '#aeb4c0', pointerEvents: 'none', fontSize: 16, lineHeight: 1 }}>⌄</span>
                </span>
              </label>
            ))}
            {selectedAdmissionPet && <div className="clinic-inpatient-selected-pet clinic-inpatient-admit-span">
              {selectedAdmissionPet.photo_url ? <img src={selectedAdmissionPet.photo_url} alt="" /> : <span className="clinic-inpatient-pet-fallback">{selectedAdmissionPet.name?.slice(0, 1) || 'P'}</span>}
              <div className="clinic-inpatient-pet-summary"><strong>{selectedAdmissionPet.name} <span>{selectedAdmissionPet.species || 'Pet'}</span></strong><small>{[selectedAdmissionPet.breed, selectedAdmissionPet.sex, selectedAdmissionPet.age, selectedAdmissionPet.weight && `${selectedAdmissionPet.weight} kg`].filter(Boolean).join(' · ')}</small><small>Patient ID: P-{String(selectedAdmissionPet.id).padStart(4, '0')}</small></div>
              <span className="clinic-inpatient-allergy">Allergies: {selectedAdmissionPet.allergies || 'Not recorded'}</span>
            </div>}
            <div className="clinic-inpatient-owner-summary clinic-inpatient-admit-span"><strong>Owner Information</strong><span>{selectedAdmissionPet?.owner || 'Select a patient to view owner details'}</span><span>{selectedAdmissionPet?.owner_phone || ''}</span><span>{selectedAdmissionPet?.owner_email || ''}</span></div>
            </>}
            {activeAdmissionTab === 1 && <>
            <strong style={{ gridColumn: '1 / -1', marginTop: 3, color: '#193a32', fontSize: '.78rem' }}>Admission &amp; Clinical Assessment</strong>
            <label style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>Admission Date &amp; Time*
              <input required type="datetime-local" value={admitForm.admitted_at} onChange={event => setAdmitForm(previous => ({ ...previous, admitted_at: event.target.value }))} />
            </label>
            <label style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>Urgency Level*
              <select value={admitForm.urgency_level} onChange={event => setAdmitForm(previous => ({ ...previous, urgency_level: event.target.value }))}><option>Normal</option><option>Urgent</option><option>Emergency</option></select>
            </label>
            <label style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>Presenting Complaint*
              <textarea required value={admitForm.presenting_complaint} onChange={event => setAdmitForm(previous => ({ ...previous, presenting_complaint: event.target.value }))} placeholder="What brought the patient in today?" rows={2} />
            </label>
            <label style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>Provisional Diagnosis
              <input value={admitForm.provisional_diagnosis} onChange={event => setAdmitForm(previous => ({ ...previous, provisional_diagnosis: event.target.value }))} placeholder="Initial working diagnosis" />
            </label>
            </>}
            {activeAdmissionTab === 3 && <><label style={{ display: 'grid', gridColumn: '1 / -1', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>
              Ward / Cage Assignment*
              <span style={{ position: 'relative' }}>
                <select required value={admitForm.ward} onChange={event => setAdmitForm(previous => ({ ...previous, ward: event.target.value }))} style={{ width: '100%', appearance: 'none', border: 'none', borderRadius: 9, background: '#f1f1f3', color: '#111827', padding: '10px 35px 10px 13px', fontSize: '.75rem', outline: 'none' }}>
                  <option value="" disabled>Select ward</option>
                  {wardOptions.map(option => <option key={option} value={option} style={{ color: '#111827' }}>{option}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 13, top: '46%', transform: 'translateY(-50%)', color: '#aeb4c0', pointerEvents: 'none', fontSize: 16, lineHeight: 1 }}>⌄</span>
              </span>
            </label></>}
            {activeAdmissionTab === 1 && <><label style={{ display: 'grid', gridColumn: '1 / -1', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>
              Admission Reason*
              <input required value={admitForm.admission_reason} onChange={event => setAdmitForm(previous => ({ ...previous, admission_reason: event.target.value }))} placeholder="e.g. Post-operative recovery" style={{ border: 'none', borderRadius: 9, background: '#f1f1f3', color: '#111827', padding: '10px 13px', fontSize: '.75rem', outline: 'none' }} />
            </label>
            {false && <><strong className="clinic-inpatient-admit-span" style={{ marginTop: 3, color: '#193a32', fontSize: '.78rem' }}>Initial Clinical Assessment</strong>
            {[
              ['Weight (kg)', 'patient_weight', 'number'], ['Temperature (°C)', 'temperature', 'number'],
            ].map(([label, field, type]) => <label key={field} style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>{label}<input type={type} min="0" step="any" value={admitForm[field]} onChange={event => setAdmitForm(previous => ({ ...previous, [field]: event.target.value }))} /></label>)}
            <label className="clinic-inpatient-admit-span" style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>Physical Examination / Notes<textarea value={admitForm.physical_notes} onChange={event => setAdmitForm(previous => ({ ...previous, physical_notes: event.target.value }))} placeholder="Examination findings and immediate care needs..." rows={3} /></label>
            <label style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>Known Allergies<input value={admitForm.known_allergies} onChange={event => setAdmitForm(previous => ({ ...previous, known_allergies: event.target.value }))} placeholder={selectedAdmissionPet?.allergies || 'None recorded'} /></label>
            <label style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>Relevant Medical History<input value={admitForm.relevant_medical_history} onChange={event => setAdmitForm(previous => ({ ...previous, relevant_medical_history: event.target.value }))} placeholder="Previous episodes, conditions, or procedures" /></label></>}
            </>}
            {activeAdmissionTab === 2 && <>
            <strong style={{ gridColumn: '1 / -1', marginTop: 3, color: '#193a32', fontSize: '.78rem' }}>Treatment Plan</strong>
            <label style={{ display: 'grid', gridColumn: '1 / -1', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>
              Link Treatment Plan (optional)
              <select value={treatmentPlanMode === 'new' ? '__new__' : treatmentPlanMode === 'existing' ? admitForm.treatment_plan_id : ''} onChange={event => { const value = event.target.value; setTreatmentPlanMode(value === '__new__' ? 'new' : value ? 'existing' : 'none'); setPendingNewPlanId(''); setAdmitForm(previous => ({ ...previous, treatment_plan_id: value === '__new__' ? '' : value })); }} style={{ width: '100%', border: '1px solid #d8e9e1', borderRadius: 9, background: '#fff', color: '#111827', padding: '10px 13px', fontSize: '.75rem' }}>
                <option value="">No linked plan</option>
                {treatmentPlans.filter(plan => String(plan.pet_id) === String(admitForm.pet_id) && !plan.archived).map(plan => <option key={plan.id} value={plan.id}>{plan.title} ({plan.status})</option>)}
                <option value="__new__">Create new treatment plan...</option>
              </select>
              <span style={{ color: '#64748b', fontSize: '.68rem', fontWeight: 400 }}>Planned steps remain in the treatment plan; actual inpatient care is logged separately.</span>
            </label>
            {treatmentPlanMode === 'new' && <>
              {pendingNewPlanId && <div role="status" style={{ gridColumn: '1 / -1', color: '#315b49', fontSize: '.7rem' }}>Treatment plan created and will be linked to this admission.</div>}
              <label style={{ display: 'grid', gridColumn: '1 / -1', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>New Plan Title*
                <input required value={newPlanForm.title} onChange={event => setNewPlanForm(previous => ({ ...previous, title: event.target.value }))} placeholder="e.g. Post-operative recovery" style={{ border: '1px solid #d8e9e1', borderRadius: 7, padding: '9px 12px', color: '#111827', fontSize: '.75rem' }} />
              </label>
              <label style={{ display: 'grid', gridColumn: '1 / -1', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>Plan Diagnosis*
                <input required value={newPlanForm.diagnosis} onChange={event => setNewPlanForm(previous => ({ ...previous, diagnosis: event.target.value }))} placeholder="Treatment plan diagnosis" style={{ border: '1px solid #d8e9e1', borderRadius: 7, padding: '9px 12px', color: '#111827', fontSize: '.75rem' }} />
              </label>
              <label style={{ display: 'grid', gridColumn: '1 / -1', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>First Planned Step*
                <input required value={newPlanForm.first_step} onChange={event => setNewPlanForm(previous => ({ ...previous, first_step: event.target.value }))} placeholder="First treatment or monitoring step" style={{ border: '1px solid #d8e9e1', borderRadius: 7, padding: '9px 12px', color: '#111827', fontSize: '.75rem' }} />
              </label>
              <div style={{ gridColumn: '1 / -1', color: '#64748b', fontSize: '.68rem' }}>This creates one Treatment Plan for the selected patient. Plan steps are managed there, not duplicated in the admission.</div>
            </>}
            </>}
            {activeAdmissionTab === 3 && <>
            <strong style={{ gridColumn: '1 / -1', marginTop: 3, color: '#193a32', fontSize: '.78rem' }}>Hospitalization Plan</strong>
            <label style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>
              Expected Discharge Date
              <LabDateTimePicker mode="date" value={admitForm.expected_discharge_at} onChange={expected_discharge_at => setAdmitForm(previous => ({ ...previous, expected_discharge_at }))} style={{ border: '1px solid #d8e9e1', borderRadius: 9, background: '#fff', color: '#111827', padding: '10px 13px', fontSize: '.75rem', outline: 'none' }} />
            </label>
            </>}
            {activeAdmissionTab === 3 && <><label style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>
              Attending Doctor
              <span style={{ position: 'relative' }}>
                <select required value={admitForm.attending_veterinarian_id} onChange={event => setAdmitForm(previous => ({ ...previous, attending_veterinarian_id: event.target.value }))} style={{ width: '100%', appearance: 'none', border: 'none', borderRadius: 9, background: '#f1f1f3', color: '#111827', padding: '10px 35px 10px 13px', fontSize: '.75rem', outline: 'none' }}>
                  <option value="" disabled>Select doctor</option>
                  {doctorOptions.map(option => <option key={option.id} value={option.id} style={{ color: '#111827' }}>{option.name}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 13, top: '46%', transform: 'translateY(-50%)', color: '#aeb4c0', pointerEvents: 'none', fontSize: 16, lineHeight: 1 }}>⌄</span>
              </span>
            </label></>}
            {activeAdmissionTab === 1 && <><strong className="clinic-inpatient-admit-span" style={{ marginTop: 3, color: '#193a32', fontSize: '.78rem' }}>Initial Clinical Assessment</strong>
            {[
              ['Weight (kg)', 'patient_weight', 'number'], ['Temperature (°C)', 'temperature', 'number'],
            ].map(([label, field, type]) => <label key={field} style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>{label}<input type={type} min="0" step="any" value={admitForm[field]} onChange={event => setAdmitForm(previous => ({ ...previous, [field]: event.target.value }))} /></label>)}
            <label className="clinic-inpatient-admit-span" style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>
              Physical Examination / Notes
              <textarea value={admitForm.physical_notes} onChange={event => setAdmitForm(previous => ({ ...previous, physical_notes: event.target.value }))} placeholder="Examination findings and immediate care needs..." rows={3} />
            </label>
            <label style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>Known Allergies
              <input value={admitForm.known_allergies} onChange={event => setAdmitForm(previous => ({ ...previous, known_allergies: event.target.value }))} placeholder={selectedAdmissionPet?.allergies || 'None recorded'} />
            </label>
            <label style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>Relevant Medical History
              <input value={admitForm.relevant_medical_history} onChange={event => setAdmitForm(previous => ({ ...previous, relevant_medical_history: event.target.value }))} placeholder="Previous episodes, conditions, or procedures" />
            </label>
            </>}
            {activeAdmissionTab === 4 && <div className="clinic-inpatient-consent-fields" style={{ gridColumn: '1 / -1', display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <strong style={{ color: '#193a32', fontSize: '1.04rem', fontWeight: 700 }}>Consent &amp; Authorization</strong>
                <span style={{ color: '#64748b', fontSize: '.72rem' }}>Record the owner's authorization for admission and inpatient care.</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                <label style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>Admission Consent Status *
                  <select value={admitForm.consent_status} onChange={event => setAdmitForm(previous => ({ ...previous, consent_status: event.target.value }))} style={{ border: '1px solid #d1e0d9', borderRadius: 8, background: '#fff', color: '#111827', padding: '10px 12px', fontSize: '.78rem' }}>
                    {[['obtained', 'Consent Obtained'], ['pending', 'Pending'], ['declined', 'Declined'], ['emergency', 'Emergency exception']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>Authorized By *
                  <select value={admitForm.authorized_by} onChange={event => setAdmitForm(previous => ({ ...previous, authorized_by: event.target.value }))} style={{ border: '1px solid #d1e0d9', borderRadius: 8, background: '#fff', color: '#111827', padding: '10px 12px', fontSize: '.78rem' }}>
                    {!admitForm.authorized_by && <option value="" disabled>Select owner</option>}
                    {selectedAdmissionPet?.owner && <option value={`${selectedAdmissionPet.owner} (Owner)`}>{`${selectedAdmissionPet.owner} (Owner)`}</option>}
                    {selectedAdmissionPet?.owner && <option value={selectedAdmissionPet.owner}>{selectedAdmissionPet.owner}</option>}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>Consent Date &amp; Time *
                  <input type="datetime-local" value={admitForm.consent_date_time} onChange={event => setAdmitForm(previous => ({ ...previous, consent_date_time: event.target.value }))} style={{ border: '1px solid #d1e0d9', borderRadius: 8, background: '#fff', color: '#111827', padding: '10px 12px', fontSize: '.78rem' }} />
                </label>
                <label style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>Consent Scope *
                  <select value={admitForm.consent_scope} onChange={event => setAdmitForm(previous => ({ ...previous, consent_scope: event.target.value }))} style={{ border: '1px solid #d1e0d9', borderRadius: 8, background: '#fff', color: '#111827', padding: '10px 12px', fontSize: '.78rem' }}>
                    {['Hospital admission and inpatient care', 'Hospital admission and treatment plan', 'Hospital admission and emergency procedures', 'Hospital admission and outpatient follow-up'].map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <div style={{ border: '1px solid #d9e8e2', borderRadius: 10, background: '#f3faf6', padding: '14px 16px' }}>
                <div style={{ marginBottom: 10, color: '#0b5148', fontSize: '.87rem', fontWeight: 700 }}>Consent Checklist</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 18px', color: '#19483f', fontSize: '.78rem' }}>
                  {[['Owner informed of the reason for admission.', true], ['Owner informed of the proposed treatment plan and care.', true], ['Owner informed of relevant risks and possible outcomes.', true], ['Owner given the opportunity to ask questions.', true]].map(([text]) => (
                    <label key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="checkbox" checked readOnly style={{ width: 16, height: 16, accentColor: '#0b7c67' }} />
                      <span>{text}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label style={{ display: 'grid', gap: 6, color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>Consent Notes
                <textarea value={admitForm.consent_notes} onChange={event => setAdmitForm(previous => ({ ...previous, consent_notes: event.target.value }))} rows={2} placeholder="Authorization details or estimate scope" style={{ border: '1px solid #d1e0d9', borderRadius: 8, background: '#fff', color: '#111827', fontFamily: 'inherit', fontSize: '.78rem', padding: '9px 12px' }} />
              </label>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#202020', fontSize: '.73rem', fontWeight: 600 }}>
                  <span>Supporting Document (Optional)</span>
                  <span style={{ color: '#64748b', fontSize: '.68rem', fontWeight: 500 }}>0/500</span>
                </div>
                <label style={{ display: 'grid', minHeight: 130, border: '1px dashed #c5d6d0', borderRadius: 10, background: '#f9fbfa', cursor: 'pointer', overflow: 'hidden', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#2d4f4d', fontSize: '.8rem', fontWeight: 600 }}>
                    <span style={{ fontSize: 28, lineHeight: 1, transform: 'translateY(-1px)' }}>⇪</span>
                    <div style={{ display: 'grid', gap: 2, textAlign: 'center' }}>
                      <span>Upload signed consent form</span>
                      <small style={{ color: '#6b7d78', fontSize: '.65rem', fontWeight: 500 }}>PDF or image (JPG, PNG) up to 5 MB</small>
                    </div>
                  </div>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} />
                </label>
              </div>
            </div>}
          </div>
          {activeAdmissionTab === 5 && <aside id="inpatient-admission-summary-panel" role="tabpanel" aria-labelledby="inpatient-admission-tab-5" className="clinic-inpatient-admit-summary clinic-inpatient-admit-summary-tab" aria-label="Admission summary">
            <h3>Patient Summary</h3>
            {selectedAdmissionPet && <div className="clinic-inpatient-summary-pet">{selectedAdmissionPet.photo_url ? <img src={selectedAdmissionPet.photo_url} alt="" /> : <span>{selectedAdmissionPet.name?.slice(0, 1) || 'P'}</span>}<div><strong>{selectedAdmissionPet.name}</strong><small>{[selectedAdmissionPet.species, selectedAdmissionPet.breed, selectedAdmissionPet.age].filter(Boolean).join(' · ')}</small><small>Patient ID: P-{String(selectedAdmissionPet.id).padStart(4, '0')}</small></div></div>}
            <section><h4>Owner</h4><strong>{selectedAdmissionPet?.owner || 'Not selected'}</strong><small>{selectedAdmissionPet?.owner_phone || 'Phone not recorded'}</small><small>{selectedAdmissionPet?.owner_email || 'Email not recorded'}</small></section>
            <section><h4>Admission Details</h4><div><span>Date &amp; Time</span><strong>{admitForm.admitted_at ? formatDateTimeText(admitForm.admitted_at, 'en-US', admitForm.admitted_at) : 'Not set'}</strong></div><div><span>Reason</span><strong>{admitForm.admission_reason || 'Not entered'}</strong></div><div><span>Urgency</span><strong>{admitForm.urgency_level}</strong></div><div><span>Attending Vet</span><strong>{doctorOptions.find(doctor => String(doctor.id) === String(admitForm.attending_veterinarian_id))?.name || 'Not assigned'}</strong></div></section>
            <section><h4>Hospitalization Plan</h4><div><span>Ward / Cage</span><strong>{admitForm.ward || 'Not assigned'}</strong></div><div><span>Expected Discharge</span><strong>{admitForm.expected_discharge_at ? formatDateText(admitForm.expected_discharge_at) : 'Not scheduled'}</strong></div></section>
            <section><h4>Treatment Plan</h4><strong>{treatmentPlanMode === 'new' ? newPlanForm.title || 'New plan' : linkedAdmissionPlan?.title || 'No linked plan'}</strong>{linkedAdmissionPlan && <small>{linkedAdmissionPlan.status || 'Active'}</small>}</section>
            <p className="clinic-inpatient-summary-note">This admission links to the selected treatment plan. Planned steps and medications stay in that plan; inpatient records track actual care.</p>
          </aside>}
          </div>
          {admitError && <div role="alert" style={{ marginTop: 12, color: '#b42318', fontSize: '.72rem' }}>{admitError}</div>}
          <ModalFooter className="clinic-inpatient-admit-footer" style={{ ...modalStyles.footer, marginTop: 16 }}>
            <button type="button" style={modalStyles.cancel} onClick={closeAdmit}>Cancel</button>
            <div className="clinic-inpatient-admit-footer-nav">
              {activeAdmissionTab > 0 && <button type="button" className="clinic-inpatient-admit-back" onClick={retreatAdmissionTab}>Back</button>}
              {activeAdmissionTab < admissionTabs.length - 2
                ? <button type="button" className="clinic-inpatient-admit-next" onClick={advanceAdmissionTab}>Next</button>
                : activeAdmissionTab === admissionTabs.length - 2
                  ? <button type="button" className="clinic-inpatient-admit-next" onClick={reviewAdmissionSummary}>Review Summary</button>
                : <button type="submit" disabled={savingCare} style={{ ...T.primaryBtn, display: 'flex', alignItems: 'center', gap: 7, padding: '9px 13px', fontSize: '.72rem', borderRadius: 8, opacity: savingCare ? .65 : 1 }}><span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.bed}</span>{savingCare ? 'Saving...' : 'Admit Patient'}</button>}
            </div>
          </ModalFooter>
        </ModalDialog>
      </div>}
      {selectedRecord && <div style={modalStyles.backdrop} onClick={() => setSelectedRecord(null)}>
        <div className="clinic-inpatient-record-dialog" role="dialog" aria-modal="true" aria-labelledby="inpatient-record-title" onClick={event => event.stopPropagation()} style={{ ...modalStyles.dialog, overflowY: 'auto' }}>
          <button type="button" aria-label="Close inpatient record" onClick={() => setSelectedRecord(null)} style={modalStyles.close}>{Icons.close}</button>
          <div style={{ paddingRight: 24 }}><h2 id="inpatient-record-title" style={{ margin: 0, color: '#111827', fontSize: '1.05rem', fontWeight: 700 }}>Inpatient Record</h2><div style={{ marginTop: 6, color: '#64748b', fontSize: '.72rem' }}>{selectedRecord.id} - {selectedRecord.pet}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '17px 28px', marginTop: 20 }}>
            {[['Pet', selectedRecord.pet], ['Owner', selectedRecord.owner], ['Ward / Cage', selectedRecord.ward], ['Doctor', selectedRecord.doctor], ['Admitted', selectedRecord.admitted], ['Expected Discharge', selectedRecord.discharge]].map(([label, value]) => <div key={label}><div style={{ color: '#718096', fontSize: '.7rem' }}>{label}</div><div style={{ marginTop: 4, color: '#111827', fontSize: '.76rem', fontWeight: 600 }}>{value}</div></div>)}
          </div>
          <div style={{ marginTop: 18, padding: '13px 12px', border: '1px solid #dce1e7', borderRadius: 10 }}><div style={{ color: '#718096', fontSize: '.7rem' }}>Diagnosis</div><div style={{ marginTop: 8, color: '#111827', fontSize: '.78rem', fontWeight: 600 }}>{selectedRecord.diagnosis}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12, padding: '13px 12px', border: '1px solid #dce1e7', borderRadius: 9 }}><div><div style={{ color: '#718096', fontSize: '.7rem' }}>Admission authorization</div><strong style={{ display: 'block', marginTop: 5, color: '#111827', fontSize: '.74rem', textTransform: 'capitalize' }}>{selectedRecord.consent_status || 'Pending'}</strong></div><div><div style={{ color: '#718096', fontSize: '.7rem' }}>Estimated hospitalization cost</div><strong style={{ display: 'block', marginTop: 5, color: '#111827', fontSize: '.74rem' }}>{selectedRecord.estimated_cost == null ? 'Not estimated' : `₱${Number(selectedRecord.estimated_cost).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}</strong></div>{selectedRecord.consent_notes && <p style={{ gridColumn: '1 / -1', margin: 0, color: '#526571', fontSize: '.72rem' }}>{selectedRecord.consent_notes}</p>}</div>
          <div style={{ marginTop: 12, padding: '13px 12px', borderRadius: 10, background: '#f6f8fa' }}><div style={{ color: '#718096', fontSize: '.7rem' }}>Initial Assessment</div><div style={{ marginTop: 8, color: '#111827', fontSize: '.78rem' }}>{selectedRecord.initial_assessment || 'No initial assessment recorded.'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 18px', marginTop: 10, padding: '13px 12px', border: '1px solid #dce8e4', borderRadius: 8 }}><strong style={{ gridColumn: '1 / -1', color: '#145c50', fontSize: '.74rem' }}>Admission assessment</strong>{[['Urgency', selectedRecord.urgency_level], ['Presenting complaint', selectedRecord.presenting_complaint], ['Provisional diagnosis', selectedRecord.provisional_diagnosis], ['Weight', selectedRecord.patient_weight && `${selectedRecord.patient_weight} kg`], ['Temperature', selectedRecord.temperature && `${selectedRecord.temperature} °C`], ['Heart rate', selectedRecord.heart_rate && `${selectedRecord.heart_rate} bpm`], ['Respiratory rate', selectedRecord.respiratory_rate && `${selectedRecord.respiratory_rate} br/min`], ['Known allergies', selectedRecord.known_allergies], ['Relevant medical history', selectedRecord.relevant_medical_history]].filter(([, value]) => value).map(([label, value]) => <div key={label}><div style={{ color: '#718096', fontSize: '.68rem' }}>{label}</div><div style={{ marginTop: 3, color: '#283c38', fontSize: '.73rem', fontWeight: 600 }}>{value}</div></div>)}</div>
          {selectedRecord.status === 'discharged' && <div style={{ marginTop: 12, padding: '13px 12px', borderRadius: 10, background: '#f2faf6', border: '1px solid #d5e9df' }}><strong style={{ color: '#315b49', fontSize: '.76rem' }}>Discharged {selectedRecord.discharged_at ? `· ${formatDateTimeText(selectedRecord.discharged_at)}` : ''}</strong><div style={{ marginTop: 8, color: '#111827', fontSize: '.74rem' }}>{selectedRecord.discharge_assessment || 'No discharge assessment recorded.'}</div>{selectedRecord.home_instructions && <p style={{ margin: '7px 0 0', color: '#334155', fontSize: '.72rem' }}>Home instructions: {selectedRecord.home_instructions}</p>}{selectedRecord.outstanding_concerns && <p style={{ margin: '7px 0 0', color: '#334155', fontSize: '.72rem' }}>Outstanding concerns: {selectedRecord.outstanding_concerns}</p>}{selectedRecord.follow_up_recommendations && <p style={{ margin: '7px 0 0', color: '#334155', fontSize: '.72rem' }}>Follow-up: {selectedRecord.follow_up_recommendations}</p>}</div>}
          <section style={{ marginTop: 14, padding: 14, border: '1px solid #dce1e7', borderRadius: 9 }}>
            <h3 style={{ margin: '0 0 8px', color: '#193a32', fontSize: '.82rem' }}>Linked Treatment Plan</h3>
            {selectedRecord.treatment_plan_id ? <>
              <button type="button" onClick={() => onOpenTreatmentPlan?.(selectedRecord)} style={{ padding: 0, border: 0, background: 'transparent', color: '#005447', fontSize: '.78rem', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>{selectedRecord.treatment_plan_title || 'Treatment plan'} · Open plan</button>
              <span style={{ marginLeft: 8, color: '#64748b', fontSize: '.72rem' }}>{selectedRecord.treatment_plan_status || 'active'}</span>
              <div style={{ marginTop: 8, display: 'grid', gap: 5 }}>{(Array.isArray(selectedRecord.treatment_plan_steps) ? selectedRecord.treatment_plan_steps : []).map((step, index) => { const detail = typeof step === 'string' ? { title: step } : step; return <div key={`${detail.title || index}-${index}`} style={{ color: '#334155', fontSize: '.72rem' }}>{detail.done ? 'Completed' : 'Planned'} · {detail.title || 'Treatment step'}{detail.due ? ` · Due ${detail.due}` : ''}{detail.assignee ? ` · ${detail.assignee}` : ''}</div>; })}</div>
              {!!selectedRecord.treatment_plan_medications?.length && <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid #e7ecef' }}><strong style={{ color: '#334155', fontSize: '.7rem' }}>Plan medication schedule</strong>{selectedRecord.treatment_plan_medications.map(medication => <div key={medication.id} style={{ marginTop: 5, color: '#526571', fontSize: '.7rem' }}>{medication.medication} · {medication.dosage || 'Dose not specified'} · {medication.frequency || 'Schedule not specified'} · {medication.status}</div>)}</div>}
              {selectedRecord.treatment_plan_follow_up && <div style={{ marginTop: 8, color: '#775a14', fontSize: '.7rem' }}>Follow-up pending · {formatDateText(selectedRecord.treatment_plan_follow_up)}</div>}
            </> : <span style={{ color: '#64748b', fontSize: '.74rem' }}>No treatment plan linked.</span>}
          </section>
          <section style={{ marginTop: 14, padding: 14, border: '1px solid #dce1e7', borderRadius: 9 }}>
            <h3 style={{ margin: '0 0 10px', color: '#193a32', fontSize: '.82rem' }}>Inpatient Monitoring</h3>
            {loadingCare ? <p style={{ color: '#64748b', fontSize: '.74rem' }}>Loading observations...</p> : careLogs.observations.map(observation => <div key={observation.id} style={{ padding: '8px 0', borderTop: '1px solid #e7ecef', fontSize: '.72rem' }}><strong>{formatDateTimeText(observation.observed_at)}</strong><span style={{ marginLeft: 8, color: '#64748b' }}>by {observation.recorded_by_name || 'Clinic staff'}</span><p style={{ margin: '5px 0', color: '#334155' }}>{observation.clinical_progress}</p><span style={{ color: '#526571' }}>{[observation.temperature && `Temp ${observation.temperature}°`, observation.heart_rate && `HR ${observation.heart_rate}`, observation.respiratory_rate && `RR ${observation.respiratory_rate}`, observation.hydration && `Hydration ${observation.hydration}`, observation.appetite && `Appetite ${observation.appetite}`, observation.pain_assessment && `Pain ${observation.pain_assessment}`].filter(Boolean).join(' · ')}</span></div>)}
            {!loadingCare && !careLogs.observations.length && <p style={{ color: '#64748b', fontSize: '.72rem' }}>No inpatient observations recorded.</p>}
            {selectedRecord.status === 'admitted' && <form onSubmit={event => submitCareLog(event, 'observations')} style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[['Temperature °C', 'temperature'], ['Heart rate', 'heart_rate'], ['Respiratory rate', 'respiratory_rate'], ['Hydration', 'hydration'], ['Appetite', 'appetite'], ['Pain assessment', 'pain_assessment']].map(([label, field]) => <label key={field} style={{ display: 'grid', gap: 4, color: '#526571', fontSize: '.67rem' }}>{label}<input value={careForm[field]} onChange={event => setCareForm(previous => ({ ...previous, [field]: event.target.value }))} style={{ minWidth: 0, border: '1px solid #d8e1e5', borderRadius: 6, padding: '7px 8px', color: '#111827' }} /></label>)}
              <label style={{ gridColumn: '1 / -1', display: 'grid', gap: 4, color: '#526571', fontSize: '.67rem' }}>Clinical Progress<span className="system-required-star">*</span><textarea required value={careForm.clinical_progress} onChange={event => setCareForm(previous => ({ ...previous, clinical_progress: event.target.value }))} rows={2} style={{ border: '1px solid #d8e1e5', borderRadius: 6, padding: 8, color: '#111827', font: 'inherit' }} /></label>
              <button type="submit" disabled={savingCare} style={{ ...T.primaryBtn, justifySelf: 'start', padding: '8px 11px', fontSize: '.7rem' }}>Record Observation</button>
            </form>}
          </section>
          <section style={{ marginTop: 14, padding: 14, border: '1px solid #dce1e7', borderRadius: 9 }}>
            <h3 style={{ margin: '0 0 8px', color: '#193a32', fontSize: '.82rem' }}>Medication Administration</h3>
            <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '.69rem' }}>Only entries logged here count as doses given; planned medication is not assumed to have been administered.</p>
            {careLogs.medications.map(entry => <div key={entry.id} style={{ padding: '7px 0', borderTop: '1px solid #e7ecef', fontSize: '.72rem' }}><strong>{entry.medication}</strong> · {entry.dose || 'Dose not specified'} · <b>{entry.status}</b><div style={{ marginTop: 3, color: '#64748b' }}>{formatDateTimeText(entry.event_at)} · {entry.recorded_by_name || 'Clinic staff'}{entry.notes ? ` · ${entry.notes}` : ''}</div></div>)}
            {!careLogs.medications.length && <p style={{ color: '#64748b', fontSize: '.72rem' }}>No doses or medication outcomes recorded.</p>}
            {selectedRecord.status === 'admitted' && <form onSubmit={event => submitCareLog(event, 'medications')} style={{ display: 'grid', gridTemplateColumns: '1.2fr .7fr .8fr', gap: 8, marginTop: 9 }}>
              <select aria-label="Select planned medication (optional)" value={medicationForm.prescription_id} onChange={event => { const chosen = selectedRecord.treatment_plan_medications?.find(item => String(item.id) === event.target.value); setMedicationForm(previous => ({ ...previous, prescription_id: event.target.value, medication: chosen?.medication || previous.medication, dose: chosen?.dosage || previous.dose })); }} style={{ gridColumn: '1 / -1', border: '1px solid #d8e1e5', borderRadius: 6, padding: '8px', color: '#111827' }}><option value="">Select planned medication (optional)</option>{(selectedRecord.treatment_plan_medications || []).map(item => <option key={item.id} value={item.id}>{item.medication} · {item.dosage || 'dose unspecified'} · {item.frequency || 'schedule unspecified'}</option>)}</select>
              <input required aria-label="Medication" placeholder="Medication" value={medicationForm.medication} onChange={event => setMedicationForm(previous => ({ ...previous, medication: event.target.value, prescription_id: '' }))} style={{ minWidth: 0, border: '1px solid #d8e1e5', borderRadius: 6, padding: '8px', color: '#111827' }} />
              <input aria-label="Dose" placeholder="Dose" value={medicationForm.dose} onChange={event => setMedicationForm(previous => ({ ...previous, dose: event.target.value }))} style={{ minWidth: 0, border: '1px solid #d8e1e5', borderRadius: 6, padding: '8px', color: '#111827' }} />
              <select aria-label="Administration status" value={medicationForm.status} onChange={event => setMedicationForm(previous => ({ ...previous, status: event.target.value }))} style={{ border: '1px solid #d8e1e5', borderRadius: 6, padding: '8px', color: '#111827' }}>{['administered', 'missed', 'withheld', 'delayed'].map(status => <option key={status}>{status}</option>)}</select>
              <input aria-label="Medication event note" placeholder="Note (optional)" value={medicationForm.notes} onChange={event => setMedicationForm(previous => ({ ...previous, notes: event.target.value }))} style={{ gridColumn: '1 / 3', border: '1px solid #d8e1e5', borderRadius: 6, padding: '8px', color: '#111827' }} />
              <button type="submit" disabled={savingCare} style={{ ...T.primaryBtn, padding: '8px 10px', fontSize: '.7rem' }}>Record Outcome</button>
            </form>}
          </section>
          {selectedRecord.status === 'admitted' && <section style={{ marginTop: 14, padding: 14, border: '1px solid #dce1e7', borderRadius: 9 }}>
            <h3 style={{ margin: '0 0 9px', color: '#193a32', fontSize: '.82rem' }}>Discharge</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                ['Discharge Assessment*', 'discharge_assessment'],
                ['Medications and Instructions for Home', 'home_instructions'],
                ['Outstanding Concerns', 'outstanding_concerns'],
                ['Follow-up Recommendations', 'follow_up_recommendations'],
              ].map(([label, field]) => <label key={field} style={{ display: 'grid', gap: 4, color: '#526571', fontSize: '.68rem' }}>{label}<textarea required={field === 'discharge_assessment'} rows={field === 'discharge_assessment' ? 2 : 1} value={dischargeForm[field]} onChange={event => setDischargeForm(previous => ({ ...previous, [field]: event.target.value }))} style={{ border: '1px solid #d8e1e5', borderRadius: 6, padding: 8, color: '#111827', font: 'inherit' }} /></label>)}
            </div>
          </section>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}><span style={{ color: '#718096', fontSize: '.72rem' }}>Status:</span><StatusIndicator status={selectedRecord.status === 'admitted' ? 'Admitted' : 'Discharged'} /></div>
          {recordsError && <p role="alert" style={{ color: '#b42318', fontSize: '.72rem' }}>{recordsError}</p>}
          <div style={{ ...modalStyles.footer, marginTop: 17 }}><button type="button" style={modalStyles.cancel} onClick={() => setSelectedRecord(null)}>Close</button>{selectedRecord.status === 'admitted' && <button type="button" disabled={savingCare || !dischargeForm.discharge_assessment.trim()} onClick={dischargePatient} style={{ ...T.primaryBtn, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', fontSize: '.7rem', opacity: savingCare || !dischargeForm.discharge_assessment.trim() ? .6 : 1 }}><span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.check}</span>{savingCare ? 'Saving...' : 'Discharge Patient'}</button>}</div>
        </div>
      </div>}
    </div>
  );
}

export function TreatmentPlansTab({ patientName, user, standalonePlanRequest, onStandalonePlanClose, appointments = [] } = {}) {
  const [recordFilter, setRecordFilter] = useState('All Plans');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [patientFilter, setPatientFilter] = useState(patientName || 'all');
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [createPlanError, setCreatePlanError] = useState('');
  const [createTreatmentRecordOpen, setCreateTreatmentRecordOpen] = useState(false);
  const [createTreatmentRecordError, setCreateTreatmentRecordError] = useState('');
  const [savingNewTreatmentRecord, setSavingNewTreatmentRecord] = useState(false);
  const [newTreatmentRecordForm, setNewTreatmentRecordForm] = useState({ petId: '', diagnosis: '', procedure: '', outcome: '', notes: '', status: 'completed' });
  const [createPlanForm, setCreatePlanForm] = useState(() => ({
    pet: patientName || '',
    title: '',
    diagnosis: '',
    severity: 'Moderate',
    veterinarianId: '',
    followUp: '',
    steps: [{ title: '', due: '' }],
    includeMedication: false,
    medication: { name: '', dosage: '', route: '', frequency: '', quantity: '', instructions: '', startDate: '', endDate: '' },
  }));
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedPlanTab, setSelectedPlanTab] = useState('Plan Details');
  const [planStepState, setPlanStepState] = useState({});
  const [planOverrides, setPlanOverrides] = useState({});
  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [editPlanForm, setEditPlanForm] = useState({ title: '', severity: '', doctor: '', completionDate: '', steps: [] });
  const [planNote, setPlanNote] = useState('');
  const [savingPlanNote, setSavingPlanNote] = useState(false);
  const [planNoteError, setPlanNoteError] = useState('');
  const [fullPlanOpen, setFullPlanOpen] = useState(false);
  const [monitoringFormOpen, setMonitoringFormOpen] = useState(false);
  const [monitoringForm, setMonitoringForm] = useState({});
  const [monitoringError, setMonitoringError] = useState('');
  const [savingMonitoring, setSavingMonitoring] = useState(false);
  const [addMedicationOpen, setAddMedicationOpen] = useState(false);
  const [medicationForm, setMedicationForm] = useState({
    name: '', dose: '', unit: 'mg', route: '', routeOther: '',
    frequency: '', frequencyOther: '', duration: '', quantity: '',
    date: '', endDate: '', instructions: '', treatmentPlanId: '',
  });
  const [addMedicationError, setAddMedicationError] = useState('');
  const [savingMedication, setSavingMedication] = useState(false);
  const [doseLog, setDoseLog] = useState({});
  const [archivingPlan, setArchivingPlan] = useState(false);
  const [archivePlanError, setArchivePlanError] = useState('');
  const [savedPlans, setSavedPlans] = useState([]);
  const [clinicPets, setClinicPets] = useState([]);
  const [clinicVeterinarians, setClinicVeterinarians] = useState([]);
  const [clinicalRecordsError, setClinicalRecordsError] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingPlanProgress, setSavingPlanProgress] = useState(false);
  const [clinicalRecordsVersion, setClinicalRecordsVersion] = useState(0);
  const [treatmentRecordOverrides, setTreatmentRecordOverrides] = useState({});
  const [selectedTreatmentRecord, setSelectedTreatmentRecord] = useState(null);
  const [editingTreatmentRecord, setEditingTreatmentRecord] = useState(null);
  const [openTreatmentActions, setOpenTreatmentActions] = useState(null);
  const [treatmentRecordError, setTreatmentRecordError] = useState('');
  const [savingTreatmentRecord, setSavingTreatmentRecord] = useState(false);
  useEffect(() => {
    if (!user?.token || !user?.clinic_id) return undefined;
    const controller = new AbortController();
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    const query = `?clinic_id=${encodeURIComponent(user.clinic_id)}`;
    const headers = { Authorization: `Bearer ${user.token}` };
    const endpoints = [
      ['clinic patients', `${apiUrl}/clinic-records/pets${query}`],
      ['treatment plans', `${apiUrl}/clinic-records/treatment-plans${query}&include_archived=true`],
      ['clinic staff', `${apiUrl}/clinics/${encodeURIComponent(user.clinic_id)}/staff?status=active`],
    ];
    Promise.all(endpoints.map(async ([label, url]) => {
      const response = await fetch(url, { headers, signal: controller.signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const serverMessage = payload && typeof payload.error === 'string' ? ` ${payload.error}` : '';
        throw new Error(`Unable to load ${label} (HTTP ${response.status}).${serverMessage}`);
      }
      if (!Array.isArray(payload)) {
        throw new Error(`The ${label} endpoint returned an invalid response.`);
      }
      return payload;
    })).then(([pets, apiPlans, staff]) => {
      setClinicPets(pets);
      const veterinarians = staff.filter(member => ['doctor', 'veterinarian', 'assistant_doctor'].includes(
        String(member.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
      ));
      setClinicVeterinarians(veterinarians);
      setCreatePlanForm(previous => ({
        ...previous,
        veterinarianId: veterinarians.some(member => String(member.id) === String(previous.veterinarianId))
          ? String(previous.veterinarianId)
          : (veterinarians[0] ? String(veterinarians[0].id) : ''),
      }));
      setSavedPlans(apiPlans.map(plan => {
        const steps = Array.isArray(plan.steps) ? plan.steps : [];
        const completedSteps = steps.filter(step => step && typeof step === 'object' && step.done).length;
        const createdDate = formatDateText(plan.created_at);
        return {
          ...plan,
          id: `DB-${plan.id}`,
          databaseId: plan.id,
          archived: Boolean(plan.archived),
          pet: plan.pet || 'Unknown patient',
          owner: plan.owner || 'Owner not recorded',
          title: plan.title || 'Untitled plan',
          diagnosis: plan.diagnosis || 'Not recorded',
          doctor: plan.veterinarian || 'Clinic team',
          created: createdDate,
          followUp: plan.follow_up ? formatDateText(String(plan.follow_up).slice(0, 10)) : '—',
          totalSteps: steps.length || 1,
          completedSteps: plan.status === 'completed' ? (steps.length || 1) : completedSteps,
          stepDetails: steps.map(step => typeof step === 'string' ? { title: step, detail: step } : step),
          medications: (plan.prescriptions || []).map(item => ({
            name: item.medication,
            dose: item.dosage,
            route: item.route,
            frequency: item.frequency,
            duration: item.end_date ? `Until ${String(item.end_date).slice(0, 10)}` : item.instructions || '—',
            quantity: item.quantity,
            instructions: item.instructions,
            nextDue: item.end_date ? formatDateText(String(item.end_date).slice(0, 10)) : '—',
            status: item.status || 'Active',
          })),
          pastMedications: [],
          clinicalUpdates: Array.isArray(plan.clinical_updates) ? plan.clinical_updates : [],
          notes: Array.isArray(plan.notes) ? plan.notes : [],
        };
      }));
      setClinicalRecordsError('');
    }).catch(error => {
      if (error.name !== 'AbortError') {
        console.error('Unable to load saved treatment details:', error);
        setClinicalRecordsError(error.message || 'Unable to load saved treatment details.');
      }
    });
    return () => controller.abort();
  }, [user?.clinic_id, user?.token, clinicalRecordsVersion]);
  useEffect(() => {
    if (!standalonePlanRequest?.planId) return;
    const plan = savedPlans.find(item => String(item.databaseId) === String(standalonePlanRequest.planId));
    if (!plan) return;
    setSelectedPlan(plan);
    setFullPlanOpen(true);
  }, [standalonePlanRequest, savedPlans]);

  const allPlans = [...savedPlans, SAMPLE_TREATMENT_PLAN].map(plan => ({ ...plan, ...(planOverrides[plan.id] || {}) }));
  const scheduledTreatmentAppointments = appointments.filter(appointment => {
    let notes = appointment.notes || {};
    if (typeof notes === 'string') { try { notes = JSON.parse(notes); } catch { notes = {}; } }
    return !appointment.archived && /treatment|surgery|dental/.test(String(notes.service_category || appointment.type || '').toLowerCase())
      && !['completed', 'complete', 'cancelled', 'canceled', 'no show', 'no-show'].includes(String(appointment.status || '').toLowerCase());
  }).map(appointment => {
    let notes = appointment.notes || {};
    if (typeof notes === 'string') { try { notes = JSON.parse(notes); } catch { notes = {}; } }
    return { ...appointment, scheduledService: String(notes.service_name || appointment.reason || 'Treatment').replace(/^.*?[—:-]\s*/, '') };
  });
  const plans = allPlans.filter(plan => {
    const matchesSearch = [plan.pet, plan.owner, plan.title, plan.diagnosis, plan.doctor].some(value => value.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch && (statusFilter === 'all' || plan.status === statusFilter) && (patientFilter === 'all' || plan.pet === patientFilter);
  });
  const combinedRecords = [
    ...plans.map(plan => ({
      id: `plan-${plan.id}`,
      sourceId: plan.id,
      kind: 'plan',
      isMock: plan.isMock,
      patient: plan.pet,
      title: plan.title,
      diagnosis: plan.diagnosis,
      details: `${plan.completedSteps}/${plan.totalSteps} steps${plan.medications?.length ? ` · ${plan.medications.map(item => item.name).join(', ')}` : ''}`,
      status: plan.status,
      date: plan.created,
      plan,
    })),
  ].sort((left, right) => (Date.parse(right.date || '') || 0) - (Date.parse(left.date || '') || 0)).filter(record => {
    const recordStatus = String(record.status || '').toLowerCase();
    const isCompleted = ['completed', 'finalized'].includes(recordStatus);
    const matchesCategory = recordFilter === 'Archived Plans'
      ? Boolean(record.plan?.archived)
      : !record.plan?.archived && (
        recordFilter === 'All Plans'
        || (recordFilter === 'Active Plans' && recordStatus === 'active')
        || (recordFilter === 'Paused Plans' && recordStatus === 'paused')
        || (recordFilter === 'Completed' && isCompleted)
      );
    const matchesPatient = patientFilter === 'all' || record.patient === patientFilter;
    const matchesSearch = [record.patient, record.title, record.diagnosis, record.details, record.status]
      .some(value => String(value || '').toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesPatient && matchesSearch;
  });
  const openEditTreatmentRecord = record => {
    const source = record.record || {};
    const rawDate = source.performed_at || record.date;
    const parsedDate = rawDate ? new Date(rawDate) : new Date();
    const localDate = Number.isNaN(parsedDate.getTime())
      ? ''
      : new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setTreatmentRecordError('');
    setEditingTreatmentRecord({
      ...record,
      diagnosis: record.diagnosis || '',
      procedure: record.title || '',
      outcome: source.outcome || '',
      notes: source.notes || '',
      performed_at: localDate,
      status: String(record.status || 'completed').toLowerCase(),
    });
  };
  const saveTreatmentRecord = async event => {
    event.preventDefault();
    if (!editingTreatmentRecord) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      diagnosis: String(form.get('diagnosis') || '').trim(),
      procedure: String(form.get('procedure') || '').trim(),
      outcome: String(form.get('outcome') || '').trim(),
      notes: String(form.get('notes') || '').trim(),
      performed_at: new Date(String(form.get('performed_at') || '')).toISOString(),
      status: String(form.get('status') || ''),
    };
    setSavingTreatmentRecord(true);
    setTreatmentRecordError('');
    try {
      if (editingTreatmentRecord.isMock) {
        setTreatmentRecordOverrides(previous => ({
          ...previous,
          [editingTreatmentRecord.recordId]: {
            diagnosis: payload.diagnosis,
            title: payload.procedure,
            details: [payload.outcome, payload.notes].filter(Boolean).join(' · ') || 'Treatment record',
            status: payload.status,
            date: payload.performed_at,
            record: { ...editingTreatmentRecord.record, ...payload },
          },
        }));
      } else {
        const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
        const response = await fetch(`${apiUrl}/clinic-records/treatment-records/${encodeURIComponent(editingTreatmentRecord.recordId)}?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Unable to save treatment record (HTTP ${response.status}).`);
        setClinicalRecordsVersion(version => version + 1);
      }
      setEditingTreatmentRecord(null);
      notifySuccess('Treatment record updated', 'The treatment details were saved.');
    } catch (error) {
      setTreatmentRecordError(error.message || 'Unable to save the treatment record.');
    } finally {
      setSavingTreatmentRecord(false);
    }
  };
  const selectedPatient = selectedPlan && (
    clinicPets.find(pet => String(pet.id) === String(selectedPlan.pet_id))
    || clinicPets.find(pet => pet.name === selectedPlan.pet)
    || PETS.find(pet => pet.name === selectedPlan.pet)
    || selectedPlan
  );
  const selectedPatientAge = selectedPatient?.age || (() => {
    if (!selectedPatient?.birth_date) return '';
    const birthDate = new Date(`${String(selectedPatient.birth_date).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(birthDate.getTime())) return '';
    const now = new Date();
    let years = now.getFullYear() - birthDate.getFullYear();
    let months = now.getMonth() - birthDate.getMonth();
    if (now.getDate() < birthDate.getDate()) months -= 1;
    if (months < 0) { years -= 1; months += 12; }
    if (years < 0) return '';
    return years ? `${years} ${years === 1 ? 'year' : 'years'}${months ? `, ${months} ${months === 1 ? 'month' : 'months'}` : ''}` : `${months} ${months === 1 ? 'month' : 'months'}`;
  })();
  const selectedPatientSex = selectedPatient?.sex
    ? `${String(selectedPatient.sex).slice(0, 1).toUpperCase()}${String(selectedPatient.sex).slice(1)}`
    : '';
  const patientOptions = [...new Set([...savedPlans.map(plan => plan.pet), ...clinicPets.map(pet => pet.name), ...(patientName ? [patientName] : [])])];
  const planSteps = (plan, completedSteps = plan.completedSteps) => {
    const defaultSteps = [
      { title: 'Initial Assessment', detail: plan.diagnosis, date: plan.created },
      { title: 'Treatment Protocol', detail: `${plan.title} care protocol`, date: plan.created },
      { title: 'Progress Check', detail: 'Review patient response', date: plan.created },
      { title: 'Follow-up Review', detail: 'Confirm recovery and next steps', date: plan.followUp || 'Not scheduled' },
    ];
    return Array.from({ length: plan.totalSteps }, (_, index) => ({
      ...(defaultSteps[index] || {
        title: `Treatment Step ${index + 1}`,
        detail: `${plan.title} care protocol`,
        date: plan.created,
      }),
      ...plan.stepDetails?.[index],
      done: index < completedSteps,
    }));
  };
  const selectedPlanCheckedSteps = selectedPlan
    ? planStepState[selectedPlan.id] || Array.from({ length: selectedPlan.totalSteps }, (_, index) => index < selectedPlan.completedSteps)
    : [];
  const selectedPlanSteps = selectedPlan
    ? planSteps(selectedPlan).map((step, index) => ({ ...step, done: selectedPlanCheckedSteps[index] }))
    : [];
  const savePlanStepProgress = async (stepIndex, done) => {
    if (!selectedPlan?.databaseId || savingPlanProgress) return;
    const previous = selectedPlanCheckedSteps;
    const next = previous.map((checked, index) => index === stepIndex ? done : checked);
    const nextStatus = selectedPlan.status === 'completed' && next.some(checked => !checked)
      ? 'active'
      : selectedPlan.status;
    const steps = selectedPlanSteps.map((step, index) => ({
      ...step,
      done: next[index],
      ...(next[index] ? { completedAt: step.completedAt || formatDateText(new Date()) } : { completedAt: '' }),
    }));
    setPlanStepState(current => ({ ...current, [selectedPlan.id]: next }));
    setSavingPlanProgress(true);
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/clinic-records/treatment-plans/${encodeURIComponent(selectedPlan.databaseId)}?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps, status: nextStatus }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to save treatment plan progress.');
      setClinicalRecordsError('');
      const updatedPlan = {
        ...selectedPlan,
        status: nextStatus,
        stepDetails: steps,
        completedSteps: steps.filter(step => step.done).length,
      };
      setSavedPlans(current => current.map(plan => String(plan.databaseId) === String(selectedPlan.databaseId)
        ? { ...plan, ...updatedPlan }
        : plan));
      setPlanOverrides(current => ({ ...current, [selectedPlan.id]: updatedPlan }));
      setSelectedPlan(updatedPlan);
      notifySuccess(
        nextStatus === 'completed' ? 'Treatment plan completed' : 'Treatment progress saved',
        nextStatus === 'completed'
          ? `${selectedPlan.title} was marked completed.`
          : `${selectedPlan.pet}'s treatment plan progress was saved.`
      );
    } catch (error) {
      setPlanStepState(current => ({ ...current, [selectedPlan.id]: previous }));
      const message = error.message || 'Unable to save treatment plan progress.';
      setClinicalRecordsError(message === 'A valid plan id and at least one supported field are required'
        ? 'The backend is running an older treatment-plan API that does not accept progress updates. Restart the backend from the vetinel folder, then try again.'
        : message);
    } finally {
      setSavingPlanProgress(false);
    }
  };
  const completeTreatmentPlan = async () => {
    if (!selectedPlan?.databaseId || savingPlanProgress) return;
    setSavingPlanProgress(true);
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/clinic-records/treatment-plans/${encodeURIComponent(selectedPlan.databaseId)}?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to complete the treatment plan.');
      const updatedPlan = { ...selectedPlan, status: payload.status || 'completed' };
      setSavedPlans(current => current.map(plan => String(plan.databaseId) === String(selectedPlan.databaseId)
        ? { ...plan, ...updatedPlan }
        : plan));
      setPlanOverrides(current => ({ ...current, [selectedPlan.id]: updatedPlan }));
      setSelectedPlan(updatedPlan);
      setClinicalRecordsError('');
      notifySuccess('Treatment plan completed', `${selectedPlan.title} was marked completed.`);
    } catch (error) {
      setClinicalRecordsError(error.message || 'Unable to complete the treatment plan.');
    } finally {
      setSavingPlanProgress(false);
    }
  };
  const openAddMedication = () => {
    setAddMedicationError('');
    setMedicationForm({
      name: '', dose: '', unit: 'mg', route: '', routeOther: '',
      frequency: '', frequencyOther: '', duration: '', quantity: '',
      date: '', endDate: '', instructions: '',
      treatmentPlanId: selectedPlan?.databaseId ? String(selectedPlan.databaseId) : '',
    });
    setAddMedicationOpen(true);
  };
  const savePlanMedication = async event => {
    event.preventDefault();
    if (!selectedPlan?.pet_id || !user?.token || !user?.clinic_id) {
      setAddMedicationError('This patient or clinic link is missing, so the medication cannot be saved.');
      return;
    }
    const route = medicationForm.route === 'Other' ? medicationForm.routeOther.trim() : medicationForm.route;
    const frequency = medicationForm.frequency === 'Other' ? medicationForm.frequencyOther.trim() : medicationForm.frequency;
    if (!medicationForm.name.trim() || !medicationForm.dose.trim() || !medicationForm.unit.trim() || !route || !frequency || !medicationForm.duration.trim() || !medicationForm.date) {
      setAddMedicationError('Complete all required medication details before saving.');
      return;
    }
    setSavingMedication(true);
    setAddMedicationError('');
    const startDate = medicationForm.date;
    const calculatedEndDate = calculateMedicationEndDate(startDate, medicationForm.duration);
    const endDate = medicationForm.endDate || calculatedEndDate;
    if (endDate && endDate < startDate) {
      setAddMedicationError('End date cannot be before the start date.');
      setSavingMedication(false);
      return;
    }
    const treatmentPlanId = medicationForm.treatmentPlanId ? Number(medicationForm.treatmentPlanId) : null;
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/clinic-records/treatments?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pet_id: selectedPlan.pet_id,
          ...(treatmentPlanId ? { treatment_plan_id: treatmentPlanId } : {}),
          medication: medicationForm.name.trim(),
          dosage: `${medicationForm.dose.trim()} ${medicationForm.unit.trim()}`,
          quantity: medicationForm.quantity.trim() || undefined,
          instructions: medicationForm.instructions.trim() || undefined,
          route,
          frequency,
          start_date: startDate,
          end_date: endDate,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to save medication to this treatment plan.');
      const savedMedication = {
        id: payload.id,
        name: payload.medication,
        dose: payload.dosage,
        route: payload.route,
        frequency: payload.frequency,
        duration: medicationForm.duration.trim(),
        quantity: payload.quantity,
        instructions: payload.instructions,
        nextDue: payload.end_date ? formatDateText(String(payload.end_date).slice(0, 10)) : medicationForm.duration.trim(),
        status: payload.status || 'Active',
      };
      setSavedPlans(current => current.map(plan => treatmentPlanId && String(plan.databaseId) === String(treatmentPlanId)
        ? { ...plan, medications: [...(plan.medications || []), savedMedication] }
        : plan));
      setSelectedPlan(current => current && treatmentPlanId && String(current.databaseId) === String(treatmentPlanId)
        ? { ...current, medications: [...(current.medications || []), savedMedication] }
        : current);
      setMedicationForm({
        name: '', dose: '', unit: 'mg', route: '', routeOther: '',
        frequency: '', frequencyOther: '', duration: '', quantity: '',
        date: '', endDate: '', instructions: '', treatmentPlanId: '',
      });
      setAddMedicationOpen(false);
      notifySuccess('Medication saved', `${savedMedication.name} was saved to ${selectedPlan.pet}'s medication records.`);
    } catch (error) {
      setAddMedicationError(error.message || 'Unable to save medication to this treatment plan.');
    } finally {
      setSavingMedication(false);
    }
  };
  const savePlanNote = async () => {
    const text = planNote.trim();
    if (!text || !selectedPlan?.databaseId || !user?.token || !user?.clinic_id || savingPlanNote) return;
    setSavingPlanNote(true);
    setPlanNoteError('');
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/clinic-records/treatment-plans/${encodeURIComponent(selectedPlan.databaseId)}/notes?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to save this treatment plan note.');
      const notes = Array.isArray(payload.notes) ? payload.notes : [...(selectedPlan.notes || []), payload.note];
      setSavedPlans(current => current.map(plan => String(plan.databaseId) === String(selectedPlan.databaseId)
        ? { ...plan, notes }
        : plan));
      setSelectedPlan(current => current && String(current.databaseId) === String(selectedPlan.databaseId)
        ? { ...current, notes }
        : current);
      setPlanNote('');
      notifySuccess('Note saved', `A note was added to ${selectedPlan.pet}'s treatment plan.`);
    } catch (error) {
      setPlanNoteError(error.message || 'Unable to save this treatment plan note.');
    } finally {
      setSavingPlanNote(false);
    }
  };
  const nextStepIndex = selectedPlanCheckedSteps.findIndex(done => !done);
  const nextPlanStep = nextStepIndex < 0 ? null : selectedPlanSteps[nextStepIndex];
  const primaryPlanFollowUpDate = selectedPlan?.nextActionDue || selectedPlan?.followUp;
  const planReassessmentRequired = Boolean(selectedPlan?.monitoring?.observations?.some(observation => /reassessment required|immediate veterinary review/i.test(observation.followUpAction || '')));
  const planFollowUpPending = Boolean(selectedPlan?.followUp && !selectedPlanSteps.some(step => /follow.?up|recheck|review/i.test(step.title || '') && step.done));
  const planMedicationPending = Boolean(selectedPlan?.medications?.some(medication => !/^(completed|stopped|discontinued)$/i.test(medication.status || '')));
  const planClosureBlocked = planReassessmentRequired || planFollowUpPending || planMedicationPending;
  const currentMedicationCount = selectedPlan
    ? (selectedPlan.medications || []).length
    : 0;
  const selectedPlanMedications = selectedPlan
    ? [...(selectedPlan.medications || [])]
    : [];
  const currentNoteCount = selectedPlan?.isMock ? (selectedPlan.clinicalUpdates || []).length : (selectedPlan?.notes || []).length;
  const selectedPlanClinicalUpdates = selectedPlan
    ? [...(selectedPlan.clinicalUpdates || [])]
    : [];
  const openMonitoringForm = () => {
    setMonitoringError('');
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    setMonitoringForm({
      date: localDate.toISOString().slice(0, 10),
      time: localDate.toISOString().slice(11, 16),
      temperature: '',
      weight: '',
      hydration: 'Normal',
      appetite: 'Normal',
      observation: '',
      followUpAction: 'Continue routine monitoring',
    });
    setMonitoringFormOpen(true);
  };
  const saveMonitoring = async event => {
    event.preventDefault();
    if (!selectedPlan?.databaseId || !user?.token || !user?.clinic_id) {
      setMonitoringError('Monitoring can only be saved for a clinic treatment plan.');
      return;
    }
    if (!monitoringForm.date || !monitoringForm.time) {
      setMonitoringError('Enter the observation date and time.');
      return;
    }
    if (!monitoringForm.observation.trim()) {
      setMonitoringError('Clinical notes are required.');
      return;
    }
    const observedAt = new Date(`${monitoringForm.date}T${monitoringForm.time}`);
    if (Number.isNaN(observedAt.getTime())) {
      setMonitoringError('Enter a valid observation date and time.');
      return;
    }
    if (observedAt > new Date()) {
      setMonitoringError('Observation date and time cannot be in the future.');
      return;
    }
    setSavingMonitoring(true);
    setMonitoringError('');
    try {
      const recordedAt = observedAt.toISOString();
      const author = user.name || selectedPlan.doctor || 'Clinic staff';
      const currentMonitoring = selectedPlan.monitoring || {};
      const observationValues = Object.fromEntries(
        ['temperature', 'weight', 'hydration', 'appetite']
          .map(key => [key, monitoringForm[key].trim()])
      );
      const updatedValues = Object.fromEntries(
        Object.entries(observationValues).map(([key, value]) => [key, value || currentMonitoring[key] || ''])
      );
      const existingObservations = Array.isArray(currentMonitoring.observations)
        ? currentMonitoring.observations.map(observation => ({
          date: observation.date,
          author: observation.author || '',
          text: [
            observation.text || '',
            observation.followUpAction ? `Follow-up action: ${observation.followUpAction}` : '',
          ].filter(Boolean).join('\n'),
          temperature: observation.temperature || '',
          weight: observation.weight || '',
          hydration: observation.hydration || '',
          appetite: observation.appetite || '',
        }))
        : selectedPlanClinicalUpdates.map(update => ({
          date: update.date,
          author: update.author,
          text: update.text || '',
        }));
      const observationText = [
        monitoringForm.observation.trim(),
        `Follow-up action: ${monitoringForm.followUpAction}`,
      ].join('\n');
      const observation = {
        date: recordedAt,
        author,
        text: observationText,
        ...observationValues,
      };
      const monitoring = {
        ...Object.fromEntries([
          'temperature', 'temperatureStatus', 'weight', 'hydration', 'appetite',
          'whiteBloodCellCount', 'whiteBloodCellStatus',
        ].filter(key => currentMonitoring[key] !== undefined).map(key => [key, currentMonitoring[key]])),
        ...updatedValues,
        lastUpdatedAt: recordedAt,
        latestObservation: observation.text,
        observations: [observation, ...existingObservations].slice(0, 100),
      };
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/clinic-records/treatment-plans/${encodeURIComponent(selectedPlan.databaseId)}?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitoring }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.error === 'A valid plan id and status are required') {
          throw new Error('The backend is running an older treatment-plan API. Restart the backend from the vetinel folder, then save this observation again.');
        }
        throw new Error(result.error || `Unable to save monitoring details (HTTP ${response.status}).`);
      }
      const updatedPlan = { ...selectedPlan, monitoring: result.monitoring || {} };
      setPlanOverrides(previous => ({ ...previous, [selectedPlan.id]: updatedPlan }));
      setSavedPlans(previous => previous.map(plan => plan.id === selectedPlan.id ? updatedPlan : plan));
      setSelectedPlan(updatedPlan);
      setMonitoringFormOpen(false);
      notifySuccess('Observation added', `Clinical monitoring was updated for ${selectedPlan.pet}.`);
    } catch (error) {
      setMonitoringError(error.message || 'Unable to save the clinical observation.');
    } finally {
      setSavingMonitoring(false);
    }
  };
  const dateForInput = value => {
    if (!value || value === '—') return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  };
  const openEditPlan = () => {
    if (!selectedPlan) return;
    setEditPlanForm({
      title: selectedPlan.title,
      severity: selectedPlan.severity || 'Moderate',
      doctor: selectedPlan.doctor,
      completionDate: dateForInput(selectedPlan.followUp),
      steps: selectedPlanSteps.map((step, index) => ({ index, title: step.title, assignee: step.assignee || selectedPlan.doctor, due: step.due || step.date || '' })).filter(step => !selectedPlanCheckedSteps[step.index]),
    });
    setEditPlanOpen(true);
  };
  const saveEditedPlan = event => {
    event.preventDefault();
    if (!selectedPlan || !editPlanForm.title.trim()) return;
    const formattedCompletionDate = editPlanForm.completionDate
      ? formatDateText(editPlanForm.completionDate, 'en-US')
      : selectedPlan.followUp;
    const changes = [];
    if (editPlanForm.title !== selectedPlan.title) changes.push(`Plan title changed to "${editPlanForm.title}"`);
    if (editPlanForm.severity !== selectedPlan.severity) changes.push(`Severity changed to ${editPlanForm.severity}`);
    if (editPlanForm.doctor !== selectedPlan.doctor) changes.push(`Attending veterinarian changed to ${editPlanForm.doctor}`);
    if (formattedCompletionDate !== selectedPlan.followUp) changes.push(`Expected completion changed to ${formattedCompletionDate}`);
    const stepDetails = selectedPlanSteps.map((step, index) => {
      const editedStep = editPlanForm.steps.find(item => item.index === index);
      if (!editedStep) return selectedPlan.stepDetails?.[index] || step;
      const stepChanges = [];
      if (editedStep.assignee !== step.assignee) stepChanges.push(`${step.title} assigned to ${editedStep.assignee}`);
      if (editedStep.due !== (step.due || step.date || '')) stepChanges.push(`${step.title} due date changed to ${editedStep.due}`);
      changes.push(...stepChanges);
      return {
        ...(selectedPlan.stepDetails?.[index] || step),
        assignee: editedStep.assignee,
        due: editedStep.due,
        overdue: editedStep.due !== (step.due || step.date || '') ? false : step.overdue,
      };
    });
    if (!changes.length) {
      setEditPlanOpen(false);
      return;
    }
    const updatedPlan = {
      ...selectedPlan,
      title: editPlanForm.title.trim(),
      severity: editPlanForm.severity,
      doctor: editPlanForm.doctor,
      followUp: formattedCompletionDate,
      stepDetails,
    };
    setPlanOverrides(previous => ({ ...previous, [selectedPlan.id]: updatedPlan }));
    setSelectedPlan(updatedPlan);
    setEditPlanOpen(false);
    notifySuccess('Treatment plan updated', `${selectedPlan.pet}'s treatment plan changes were saved and logged.`);
  };
  const closeCreatePlan = () => {
    setCreatePlanOpen(false);
    setCreatePlanError('');
    setCreatePlanForm({
      pet: patientName || '',
      title: '',
      diagnosis: '',
      severity: 'Moderate',
      veterinarianId: clinicVeterinarians[0] ? String(clinicVeterinarians[0].id) : '',
      followUp: '',
      steps: [{ title: '', due: '' }],
      includeMedication: false,
      medication: { name: '', dosage: '', route: '', frequency: '', quantity: '', instructions: '', startDate: '', endDate: '' },
    });
  };
  const saveNewPlan = async event => {
    event.preventDefault();
    const steps = createPlanForm.steps
      .map(step => ({ ...step, title: step.title.trim() }))
      .filter(step => step.title);
    if (!createPlanForm.pet || !createPlanForm.title.trim() || !createPlanForm.diagnosis.trim() || !steps.length) {
      setCreatePlanError('Select a patient and enter a plan title, diagnosis, and at least one treatment step.');
      return;
    }
    if (createPlanForm.includeMedication
      && (!createPlanForm.medication.name.trim() || !createPlanForm.medication.dosage.trim())) {
      setCreatePlanError('Enter a medication name and dosage, or turn off the optional medication section.');
      return;
    }
    const petRecord = clinicPets.find(pet => pet.name === createPlanForm.pet);
    if (!user?.token || !user?.clinic_id || !petRecord?.id) {
      setCreatePlanError('Select a saved clinic patient before creating a treatment plan.');
      return;
    }
    setSavingPlan(true);
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/clinic-records/treatment-plans?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pet_id: petRecord.id,
          title: createPlanForm.title.trim(),
          diagnosis: createPlanForm.diagnosis.trim(),
          severity: createPlanForm.severity,
          attending_veterinarian_id: createPlanForm.veterinarianId || null,
          follow_up: createPlanForm.followUp || null,
          steps,
          ...(createPlanForm.includeMedication ? {
            prescription: {
              medication: createPlanForm.medication.name.trim(),
              dosage: createPlanForm.medication.dosage.trim(),
              route: createPlanForm.medication.route.trim() || null,
              frequency: createPlanForm.medication.frequency.trim() || null,
              quantity: createPlanForm.medication.quantity.trim() || null,
              instructions: createPlanForm.medication.instructions.trim() || null,
              start_date: createPlanForm.medication.startDate || null,
              end_date: createPlanForm.medication.endDate || null,
            },
          } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to save the treatment plan.');
      setSearch('');
      setStatusFilter('all');
      setPatientFilter('all');
      setClinicalRecordsVersion(version => version + 1);
      closeCreatePlan();
      notifySuccess('Treatment plan created', `${createPlanForm.title.trim()} was saved for ${createPlanForm.pet}.`);
    } catch (error) {
      setCreatePlanError(error.message || 'Unable to save the treatment plan.');
    } finally {
      setSavingPlan(false);
    }
  };
  const closeCreateTreatmentRecord = () => {
    setCreateTreatmentRecordOpen(false);
    setCreateTreatmentRecordError('');
    setNewTreatmentRecordForm({ petId: '', diagnosis: '', procedure: '', outcome: '', notes: '', status: 'completed' });
  };
  const saveNewTreatmentRecord = async event => {
    event.preventDefault();
    const pet = clinicPets.find(item => String(item.id) === String(newTreatmentRecordForm.petId));
    const diagnosis = newTreatmentRecordForm.diagnosis.trim();
    const procedure = newTreatmentRecordForm.procedure.trim();
    if (!pet || !diagnosis || !procedure) {
      setCreateTreatmentRecordError('Select a saved patient and enter a diagnosis and treatment/procedure.');
      return;
    }
    if (!user?.token || !user?.clinic_id) {
      setCreateTreatmentRecordError('Your clinic session is unavailable. Sign in again and retry.');
      return;
    }
    setSavingNewTreatmentRecord(true);
    setCreateTreatmentRecordError('');
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/clinic-records/treatment-records?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pet_id: pet.id,
          diagnosis,
          procedure,
          outcome: newTreatmentRecordForm.outcome.trim(),
          notes: newTreatmentRecordForm.notes.trim(),
          status: newTreatmentRecordForm.status,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Unable to save treatment record (HTTP ${response.status}).`);
      setRecordFilter('All Plans');
      setStatusFilter('all');
      setPatientFilter(pet.name);
      setSearch('');
      setClinicalRecordsVersion(version => version + 1);
      closeCreateTreatmentRecord();
      notifySuccess('Treatment record created', `${procedure} was saved for ${pet.name}.`);
    } catch (error) {
      setCreateTreatmentRecordError(error.message || 'Unable to save the treatment record.');
    } finally {
      setSavingNewTreatmentRecord(false);
    }
  };
  const logMedicationDose = key => {
    if (doseLog[key]) return;
    const givenAt = new Date().toISOString();
    setDoseLog(previous => ({ ...previous, [key]: givenAt }));
    notifySuccess('Dose logged', `Medication dose recorded at ${new Date(givenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`);
  };
  const formatDoseTime = value => value
    ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;
  const togglePlanArchive = async () => {
    if (!selectedPlan?.databaseId || !user?.token || !user?.clinic_id || archivingPlan) return;
    setArchivingPlan(true);
    setArchivePlanError('');
    const restoring = Boolean(selectedPlan.archived);
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/clinic-records/treatment-plans/${encodeURIComponent(selectedPlan.databaseId)}/archive?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archived: !restoring,
          reason: restoring ? 'Treatment plan restored from the archive.' : 'Treatment plan archived from Treatments & Plans.',
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Unable to ${restoring ? 'restore' : 'archive'} treatment plan (HTTP ${response.status}).`);
      const updatedPlan = { ...selectedPlan, archived: !restoring };
      setPlanOverrides(previous => ({ ...previous, [selectedPlan.id]: updatedPlan }));
      setSelectedPlan(updatedPlan);
      setClinicalRecordsVersion(version => version + 1);
      setRecordFilter(restoring ? 'All Plans' : 'Archived Plans');
      notifySuccess(restoring ? 'Treatment plan restored' : 'Treatment plan archived', `${selectedPlan.pet}'s treatment plan was ${restoring ? 'restored' : 'moved to the archive'}.`);
    } catch (error) {
      setArchivePlanError(error.message || 'Unable to update the treatment plan archive status.');
    } finally {
      setArchivingPlan(false);
    }
  };
  return (
    <div style={standalonePlanRequest ? { display: 'none' } : { ...T.wrap, padding: '20px 20px 20px', borderRadius: 14 }}>
      <div style={{ ...T.hd, margin: '0 0 26px' }}>
        <div>
          <div style={{ ...T.title, fontSize: '.9rem', fontWeight: 600 }}>Treatments &amp; Plans</div>
          <div style={{ marginTop: 4, fontSize: '.75rem', color: '#64748b' }}>Centralized care plans and ongoing treatment progress for clinic patients</div>
        </div>
      </div>
      <div className="treatment-plan-status-row">
        <div className="lab-status-filters" role="tablist" aria-label="Treatment plans">
          {['All Plans', 'Active Plans', 'Paused Plans', 'Completed', 'Archived Plans'].map(filter => <button
            key={filter}
            type="button"
            role="tab"
            aria-selected={recordFilter === filter}
            className={recordFilter === filter ? 'active' : ''}
            onClick={() => { setRecordFilter(filter); setStatusFilter('all'); }}
          >{filter}</button>)}
        </div>
        <button type="button" className="lab-results-add treatment-plan-create-button" onClick={() => { setCreatePlanError(''); setCreatePlanOpen(true); }}>
          {Icons.plus} Create Plan
        </button>
      </div>
      {scheduledTreatmentAppointments.length > 0 && <section className="lab-clinical-history-state" style={{ margin: '0 0 14px' }}><strong>Scheduled treatments · plan pending doctor assessment</strong>{scheduledTreatmentAppointments.map(appointment => <div key={appointment.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8, color: '#334155' }}><span>{appointment.pet} · {appointment.scheduledService}</span><span>{formatDateTimeText(appointment.start_time, 'en-US', appointment.start_time)} · Scheduled</span></div>)}</section>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.6fr) minmax(180px, .75fr)', gap: 12, marginBottom: 14 }}>
        <div style={{ ...T.searchWrap, margin: 0 }}>
          <span style={T.searchIcon}>{Icons.search}</span>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by pet name, owner, or diagnosis..." style={{ ...T.search, marginBottom: 0, padding: '9px 12px 9px 34px', fontSize: '.74rem' }} />
        </div>
        <span style={{ position: 'relative', display: 'block' }}>
          <select value={patientFilter} onChange={event => setPatientFilter(event.target.value)} style={{ width: '100%', height: 36, appearance: 'none', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f4f6f9', color: '#111827', padding: '0 34px 0 12px', fontSize: '.74rem', outline: 'none', cursor: 'pointer' }}>
            <option value="all">All Patients</option>{patientOptions.map(patient => <option key={patient} value={patient}>{patient}</option>)}
          </select>
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none', fontSize: 15, lineHeight: 1 }}>⌄</span>
        </span>
      </div>
      {combinedRecords.some(record => record.isMock) && <div role="note" style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid #ead9a7', borderRadius: 8, background: '#fffaf0', color: '#755b16', fontSize: '.74rem' }}>
        <strong>Reference sample only:</strong> this example is for guidance and is not a real patient record. It is read-only and is not saved to the clinic database.
      </div>}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
        <table style={{ ...T.table, minWidth: 960, tableLayout: 'fixed' }}>
          <thead><tr>{[['Patient', '16%'], ['Treatment plan', '20%'], ['Diagnosis', '16%'], ['Care instructions / progress', '20%'], ['Status', '10%'], ['Created / Follow-up', '14%'], ['Actions', '4%']].map(([label, width]) => <th key={label} className={label === 'Actions' ? 'clinic-action-heading' : undefined} aria-label={label === 'Actions' ? 'Row actions' : undefined} style={{ ...T.th, width, padding: label === 'Actions' ? '11px 0' : '11px 9px', color: '#374151', fontSize: '.7rem', textTransform: 'none', letterSpacing: 0, textAlign: 'left' }}>{label === 'Actions' ? '' : label}</th>)}</tr></thead>
          <tbody>
            {combinedRecords.map(record => {
              const plan = record.kind === 'plan' ? record.plan : null;
              const displayDate = record.date || '—';
              const patient = PETS.find(item => item.name === record.patient)
                || clinicPets.find(item => item.name === record.patient);
              const openPlan = () => {
                setArchivePlanError('');
                setSelectedPlan(plan);
                setSelectedPlanTab('Plan Details');
              };
              return <tr key={record.id} className="clinic-action-row" tabIndex={0} onClick={openPlan} onKeyDown={event => handleClinicActionRowKeyDown(event, openPlan)}>
                <td style={{ ...T.td, padding: '13px 9px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: '50%', background: '#e7f5f2', color: '#005447', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.78rem' }}>{String(record.patient || '?').slice(0, 1)}</div><div><div style={{ color: '#111827', fontWeight: 700, fontSize: '.78rem' }}>{record.patient}</div><div style={{ color: '#64748b', fontSize: '.68rem' }}>{plan?.species || patient?.species || 'Patient record'}</div></div></div></td>
                <td style={{ ...T.td, padding: '13px 9px', color: '#005447', fontWeight: 700, fontSize: '.78rem' }}><div>{record.title}</div><div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 3, color: '#64748b', fontWeight: 400, fontSize: '.68rem' }}><span>{plan.isMock ? 'Reference sample · not saved' : `Plan · ${plan.id}`}</span></div></td>
                <td style={{ ...T.tdMuted, padding: '13px 9px', color: '#475569', fontSize: '.7rem' }}>{record.diagnosis}</td>
                <td style={{ ...T.tdMuted, padding: '13px 9px', color: '#475569', fontSize: '.7rem', lineHeight: 1.45 }}>{record.details}</td>
                <td style={{ ...T.td, padding: '13px 9px' }}><StatusIndicator status={plan?.archived ? 'Archived' : record.status} /></td>
                <td style={{ ...T.tdMuted, padding: '13px 9px', color: '#475569', fontSize: '.68rem' }}>{plan?.followUp && plan.followUp !== '—' ? plan.followUp : displayDate}</td>
                <td style={{ ...T.td, position: 'relative', width: '4%', padding: '8px 0', textAlign: 'center', verticalAlign: 'middle' }}>
                  <button
                    type="button"
                    aria-label={`Actions for ${record.patient}: ${record.title}`}
                    onClick={event => { event.stopPropagation(); openPlan(); }}
                    className="clinic-record-actions-trigger"
                  >{Icons.chevronRight}</button>
                </td>
              </tr>;
            })}
            {!combinedRecords.length && <tr><td colSpan={7} style={{ ...T.tdMuted, padding: 16, textAlign: 'center' }}>No records match this filter.</td></tr>}
          </tbody>
        </table>
      </div>
      {clinicalRecordsError && <div role="alert" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: '.78rem' }}>{clinicalRecordsError}</div>}
      {createPlanOpen && createPortal(<div style={modalStyles.backdrop} onClick={closeCreatePlan}>
        <ModalDialog as="form" size="large" role="dialog" aria-modal="true" aria-labelledby="create-plan-title" onSubmit={saveNewPlan} onClick={event => event.stopPropagation()} style={{ ...modalStyles.dialog, width: 'min(720px, calc(100vw - 24px))', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', padding: '26px 28px 22px', fontSize: '1rem' }}>
          <button type="button" aria-label="Close create treatment plan" onClick={closeCreatePlan} style={modalStyles.close}>{Icons.close}</button>
          <div style={{ paddingRight: 25 }}>
            <h2 id="create-plan-title" style={{ margin: 0, color: '#193a32', fontSize: '1.4rem', fontWeight: 700 }}>Create Treatment Plan</h2>
            <div style={{ marginTop: 7, color: '#526b64', fontSize: '.95rem', lineHeight: 1.45 }}>Create a structured care plan and assign follow-up steps to a patient.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px 16px', marginTop: 19 }}>
            <label style={{ display: 'grid', gap: 7, color: '#193a32', fontSize: '1rem', fontWeight: 600 }}>
              Patient (Pet)*
              <select required value={createPlanForm.pet} onChange={event => setCreatePlanForm(previous => ({ ...previous, pet: event.target.value }))} style={{ width: '100%', minWidth: 0, height: 48, border: '1px solid #d8e9e1', borderRadius: 9, background: '#fff', color: '#193a32', padding: '0 14px', fontSize: '1rem', outlineColor: '#78b7a1' }}>
                <option value="" disabled>Select patient</option>
                {patientOptions.map(patient => <option key={patient} value={patient}>{patient}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 7, color: '#193a32', fontSize: '1rem', fontWeight: 600 }}>
              Plan title*
              <input required value={createPlanForm.title} onChange={event => setCreatePlanForm(previous => ({ ...previous, title: event.target.value }))} placeholder="e.g. Post-surgery recovery" style={{ width: '100%', minWidth: 0, height: 48, boxSizing: 'border-box', border: '1px solid #d8e9e1', borderRadius: 9, padding: '0 14px', color: '#193a32', font: 'inherit', fontWeight: 400, outlineColor: '#78b7a1' }} />
            </label>
            <label style={{ display: 'grid', gap: 7, color: '#193a32', fontSize: '1rem', fontWeight: 600 }}>
              Diagnosis*
              <input required value={createPlanForm.diagnosis} onChange={event => setCreatePlanForm(previous => ({ ...previous, diagnosis: event.target.value }))} placeholder="Enter diagnosis or reason for care" style={{ width: '100%', minWidth: 0, height: 48, boxSizing: 'border-box', border: '1px solid #d8e9e1', borderRadius: 9, padding: '0 14px', color: '#193a32', font: 'inherit', fontWeight: 400, outlineColor: '#78b7a1' }} />
            </label>
            <label style={{ display: 'grid', gap: 7, color: '#193a32', fontSize: '1rem', fontWeight: 600 }}>
              Severity
              <select value={createPlanForm.severity} onChange={event => setCreatePlanForm(previous => ({ ...previous, severity: event.target.value }))} style={{ width: '100%', height: 48, border: '1px solid #d8e9e1', borderRadius: 9, background: '#fff', color: '#193a32', padding: '0 14px', fontSize: '1rem', outlineColor: '#78b7a1' }}>
                <option>Low</option><option>Mild</option><option>Moderate</option><option>Severe</option><option>High</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 7, color: '#193a32', fontSize: '1rem', fontWeight: 600 }}>
              Attending veterinarian
              <select value={createPlanForm.veterinarianId} onChange={event => {
                setCreatePlanForm(previous => ({ ...previous, veterinarianId: event.target.value }));
              }} style={{ width: '100%', height: 48, border: '1px solid #d8e9e1', borderRadius: 9, background: '#fff', color: '#193a32', padding: '0 14px', fontSize: '1rem', outlineColor: '#78b7a1' }}>
                <option value="">{clinicVeterinarians.length ? 'Select veterinarian' : 'No active veterinarians found'}</option>
                {clinicVeterinarians.map(veterinarian => <option key={veterinarian.id} value={veterinarian.id}>{veterinarian.name} ({veterinarian.role})</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 7, color: '#193a32', fontSize: '1rem', fontWeight: 600 }}>
              Expected follow-up
              <LabDateTimePicker mode="date" value={createPlanForm.followUp} onChange={followUp => setCreatePlanForm(previous => ({ ...previous, followUp }))} style={{ width: '100%', height: 48, boxSizing: 'border-box', border: '1px solid #d8e9e1', borderRadius: 9, background: '#fff', color: '#193a32', padding: '0 14px', font: 'inherit', outlineColor: '#78b7a1' }} />
            </label>
          </div>
          <section style={{ display: 'grid', gap: 10, marginTop: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, color: '#193a32', fontSize: '1.1rem' }}>Treatment steps<span className="system-required-star">*</span></h3>
                <p style={{ margin: '4px 0 0', color: '#526b64', fontSize: '.9rem', lineHeight: 1.4 }}>Add the actions that make up this care plan.</p>
              </div>
              <button type="button" onClick={() => setCreatePlanForm(previous => ({ ...previous, steps: [...previous.steps, { title: '', due: '' }] }))} style={{ ...modalStyles.cancel, minHeight: 44, padding: '8px 13px', color: '#005447', fontSize: '.95rem' }}>＋ Add step</button>
            </div>
            {createPlanForm.steps.map((step, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(145px, .55fr) auto', gap: 9, alignItems: 'center' }}>
                <input aria-label={`Treatment step ${index + 1}`} value={step.title} onChange={event => setCreatePlanForm(previous => ({ ...previous, steps: previous.steps.map((item, stepIndex) => stepIndex === index ? { ...item, title: event.target.value } : item) }))} placeholder={`Step ${index + 1} · e.g. Initial assessment`} style={{ width: '100%', minWidth: 0, height: 48, boxSizing: 'border-box', border: '1px solid #d8e9e1', borderRadius: 9, padding: '0 14px', color: '#193a32', font: 'inherit', fontSize: '1rem', outlineColor: '#78b7a1' }} />
                <LabDateTimePicker mode="date" label={`Treatment step ${index + 1} due date`} value={step.due} onChange={due => setCreatePlanForm(previous => ({ ...previous, steps: previous.steps.map((item, stepIndex) => stepIndex === index ? { ...item, due } : item) }))} style={{ width: '100%', minWidth: 0, height: 48, boxSizing: 'border-box', border: '1px solid #d8e9e1', borderRadius: 9, padding: '0 10px', color: '#193a32', font: 'inherit', fontSize: '.95rem', outlineColor: '#78b7a1' }} />
                <button
                  type="button"
                  disabled={createPlanForm.steps.length === 1}
                  aria-label={`Remove treatment step ${index + 1}`}
                  title={createPlanForm.steps.length === 1 ? 'At least one treatment step is required' : `Remove step ${index + 1}`}
                  onClick={() => setCreatePlanForm(previous => ({ ...previous, steps: previous.steps.filter((_, stepIndex) => stepIndex !== index) }))}
                  style={{
                    ...ab.btn,
                    minWidth: 42,
                    minHeight: 42,
                    justifyContent: 'center',
                    color: createPlanForm.steps.length === 1 ? '#9aa8a2' : '#b42318',
                    background: createPlanForm.steps.length === 1 ? '#f4f6f9' : '#fff5f5',
                    border: `1px solid ${createPlanForm.steps.length === 1 ? '#e5ebe8' : '#f3d5d5'}`,
                    padding: 7,
                    cursor: createPlanForm.steps.length === 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <svg aria-hidden="true" viewBox="0 0 20 20" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.75 5.5h12.5M8 5.5V3.75h4V5.5m2.75 0-.65 10.1a1.5 1.5 0 0 1-1.5 1.4H7.4a1.5 1.5 0 0 1-1.5-1.4L5.25 5.5m2.9 3v5.5m3.7-5.5v5.5" />
                  </svg>
                </button>
              </div>
            ))}
          </section>
          <section style={{ display: 'grid', gap: 12, marginTop: 22, padding: 16, border: '1px solid #d8e9e1', borderRadius: 10, background: '#f8fbf9' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: '#193a32', fontSize: '.95rem', fontWeight: 650, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={createPlanForm.includeMedication}
                onChange={event => setCreatePlanForm(previous => ({ ...previous, includeMedication: event.target.checked }))}
                style={{ width: 18, height: 18, marginTop: 2, accentColor: '#078673' }}
              />
              Add a medication prescription to this treatment plan
            </label>
            {createPlanForm.includeMedication && <>
              <p style={{ margin: '-5px 0 2px 28px', color: '#526b64', fontSize: '.84rem', lineHeight: 1.45 }}>
                The prescription will be saved for this patient and linked to the plan.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px 14px' }}>
                {[
                  ['Medication*', 'name', 'e.g. Amoxicillin'],
                  ['Dosage*', 'dosage', 'e.g. 250 mg'],
                  ['Route', 'route', 'e.g. Oral'],
                  ['Frequency', 'frequency', 'e.g. Twice daily'],
                  ['Quantity', 'quantity', 'e.g. 14 capsules'],
                ].map(([label, key, placeholder]) => <label key={key} style={{ display: 'grid', gap: 6, color: '#193a32', fontSize: '.86rem', fontWeight: 600 }}>
                  {label}
                  <input
                    required={key === 'name' || key === 'dosage'}
                    value={createPlanForm.medication[key]}
                    onChange={event => setCreatePlanForm(previous => ({ ...previous, medication: { ...previous.medication, [key]: event.target.value } }))}
                    placeholder={placeholder}
                    style={{ width: '100%', minWidth: 0, height: 43, boxSizing: 'border-box', border: '1px solid #d8e9e1', borderRadius: 8, padding: '0 11px', color: '#193a32', font: 'inherit', fontSize: '.9rem', fontWeight: 400, outlineColor: '#78b7a1' }}
                  />
                </label>)}
                <label style={{ display: 'grid', gap: 6, color: '#193a32', fontSize: '.86rem', fontWeight: 600 }}>
                  Start date
                  <LabDateTimePicker mode="date" value={createPlanForm.medication.startDate} max={createPlanForm.medication.endDate || undefined} onChange={startDate => setCreatePlanForm(previous => ({ ...previous, medication: { ...previous.medication, startDate } }))} style={{ width: '100%', minWidth: 0, height: 43, boxSizing: 'border-box', border: '1px solid #d8e9e1', borderRadius: 8, padding: '0 11px', color: '#193a32', font: 'inherit', outlineColor: '#78b7a1' }} />
                </label>
                <label style={{ display: 'grid', gap: 6, color: '#193a32', fontSize: '.86rem', fontWeight: 600 }}>
                  End date
                  <LabDateTimePicker mode="date" value={createPlanForm.medication.endDate} min={createPlanForm.medication.startDate || undefined} onChange={endDate => setCreatePlanForm(previous => ({ ...previous, medication: { ...previous.medication, endDate } }))} style={{ width: '100%', minWidth: 0, height: 43, boxSizing: 'border-box', border: '1px solid #d8e9e1', borderRadius: 8, padding: '0 11px', color: '#193a32', font: 'inherit', outlineColor: '#78b7a1' }} />
                </label>
                <label style={{ display: 'grid', gridColumn: '1 / -1', gap: 6, color: '#193a32', fontSize: '.86rem', fontWeight: 600 }}>
                  Instructions
                  <textarea
                    rows={2}
                    value={createPlanForm.medication.instructions}
                    onChange={event => setCreatePlanForm(previous => ({ ...previous, medication: { ...previous.medication, instructions: event.target.value } }))}
                    placeholder="Instructions for administering this medication"
                    style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', border: '1px solid #d8e9e1', borderRadius: 8, padding: 10, color: '#193a32', font: 'inherit', fontSize: '.9rem', fontWeight: 400, outlineColor: '#78b7a1' }}
                  />
                </label>
              </div>
            </>}
          </section>
          {createPlanError && <div role="alert" style={{ marginTop: 12, color: '#b42318', fontSize: '.74rem' }}>{createPlanError}</div>}
          <div style={{ ...modalStyles.footer, marginTop: 20 }}>
            <button type="button" onClick={closeCreatePlan} style={{ ...modalStyles.cancel, minHeight: 46, padding: '10px 16px', fontSize: '.95rem' }}>Cancel</button>
            <button type="submit" disabled={savingPlan} style={{ ...T.primaryBtn, display: 'flex', alignItems: 'center', gap: 8, minHeight: 46, padding: '10px 16px', fontSize: '.95rem', borderRadius: 8, opacity: savingPlan ? .7 : 1 }}><span style={{ width: 16, height: 16, display: 'flex' }}>{Icons.plus}</span>{savingPlan ? 'Saving…' : 'Create Plan'}</button>
          </div>
        </ModalDialog>
      </div>, document.body)}
      {selectedPlan && !fullPlanOpen && <div style={modalStyles.backdrop} onClick={() => setSelectedPlan(null)}>
        <div role="dialog" aria-modal="true" aria-labelledby="treatment-plan-details-title" onClick={event => event.stopPropagation()} style={{ ...modalStyles.dialog, position: 'relative', display: 'flex', flexDirection: 'column', width: 'min(760px, calc(100vw - 20px))', maxHeight: 'calc(100vh - 20px)', overflow: 'hidden', padding: 0, borderRadius: 16 }}>
          <button type="button" aria-label="Close treatment plan details" onClick={() => setSelectedPlan(null)} style={{ ...modalStyles.close, zIndex: 1, top: 18, right: 20, width: 'auto', height: 'auto', fontSize: '.8rem', fontWeight: 600 }}>Close</button>
          <header style={{ flex: '0 0 auto', padding: '22px 30px 12px', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, paddingRight: 26 }}>
              <div style={{ position: 'relative', width: 52, height: 52, flex: '0 0 52px', overflow: 'hidden', borderRadius: '50%', background: '#e7f5f2', color: '#005447', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem', fontWeight: 700 }}>
                {selectedPlan.pet.trim().slice(0, 1).toUpperCase()}
                {(selectedPatient?.photo_url || selectedPatient?.photoUrl) && <img src={selectedPatient.photo_url || selectedPatient.photoUrl} alt={`${selectedPlan.pet} profile`} onError={event => { event.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />}
              </div>
              <div style={{ minWidth: 0 }}><h2 id="treatment-plan-details-title" style={{ margin: 0, color: '#1f2937', fontSize: '1.25rem' }}>{selectedPlan.pet} <StatusIndicator status={selectedPlan.status} style={{ marginLeft: 7, verticalAlign: 'middle', fontSize: '.78rem' }} /></h2><div style={{ marginTop: 4, color: '#64748b', fontSize: '.82rem' }}>{selectedPatient?.species || 'Pet'} · {selectedPatientAge || '—'} · Owner: {selectedPatient?.owner || selectedPlan.owner || '—'}</div></div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 22px', margin: '13px 0 0 65px', color: '#334155', fontSize: '.75rem' }}>
              <span>{selectedPatient?.weight || selectedPlan.weight || 'Weight not recorded'}</span>
              <span>Allergies: {selectedPlan.allergies || selectedPatient?.allergies || 'Not recorded'}</span>
              {selectedPlan.isolationRequired && <span style={{ padding: '5px 9px', borderRadius: 7, color: '#b42318', background: '#fff1f0', whiteSpace: 'nowrap' }}>⚠ Isolation required</span>}
            </div>
          </header>
          {selectedPlan.isMock && <div role="note" style={{ margin: '10px 30px 0', padding: '9px 11px', border: '1px solid #ead9a7', borderRadius: 8, background: '#fffaf0', color: '#755b16', fontSize: '.74rem' }}>
            Reference sample only — this is not a real patient record and cannot be edited or saved.
          </div>}
          <nav aria-label="Treatment plan sections" style={{ display: 'flex', flex: '0 0 auto', gap: 0, padding: '0 30px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
            {[['Plan Details', 'Plan'], ['Medications', 'Medications'], ['Notes', 'Notes']].map(([tab, label]) => <button key={tab} type="button" aria-current={selectedPlanTab === tab ? 'page' : undefined} onClick={() => setSelectedPlanTab(tab)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginRight: 25, padding: '11px 0 10px', border: 0, borderBottom: selectedPlanTab === tab ? '3px solid #005447' : '3px solid transparent', background: 'transparent', color: selectedPlanTab === tab ? '#005447' : '#64748b', fontWeight: selectedPlanTab === tab ? 700 : 500, fontSize: '.8rem', cursor: 'pointer' }}>{label}{tab === 'Medications' && <span style={{ borderRadius: 6, padding: '2px 5px', background: '#edf5f2', color: '#526663', fontSize: '.65rem' }}>{currentMedicationCount}</span>}{tab === 'Notes' && <span style={{ borderRadius: 6, padding: '2px 5px', background: '#edf5f2', color: '#526663', fontSize: '.65rem' }}>{currentNoteCount}</span>}</button>)}
          </nav>
          <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '0 30px 20px', background: '#fff' }}>
          {selectedPlanTab === 'Medications' ? <div style={{ marginTop: 19 }}>
            <h3 style={{ margin: 0, color: '#526663', fontSize: '.72rem', letterSpacing: '.07em', textTransform: 'uppercase' }}>Current medications</h3>
            <div style={{ marginTop: 5, borderTop: '1px solid #dcece5' }}>
              {(selectedPlan.medications || []).map((medication, index) => <div key={`${medication.id || medication.name}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, padding: '11px 4px', borderBottom: '1px solid #e5eeea', color: '#475569', fontSize: '.72rem' }}>
                <div><strong style={{ display: 'block', color: '#1f2937', fontSize: '.77rem' }}>{medication.name}</strong><span style={{ display: 'block', marginTop: 3, color: '#64748b' }}>{medication.dose} · {medication.route || 'Route not recorded'} · {medication.frequency}</span><small style={{ display: 'block', marginTop: 2, color: '#64748b' }}>{medication.day ? `${medication.day} of ${medication.duration} · ` : ''}Next dose {medication.nextDue || medication.duration || 'Not scheduled'}</small></div>
                <StatusIndicator status={medication.status} style={{ flexShrink: 0, fontSize: '.7rem' }} />
              </div>)}
              {!currentMedicationCount && <p style={{ padding: '14px 4px', color: '#64748b', fontSize: '.74rem' }}>No current medications recorded.</p>}
            </div>
            <div style={{ marginTop: 15 }}>
              <h3 style={{ margin: '0 0 7px', color: '#526663', fontSize: '.68rem', letterSpacing: '.06em', textTransform: 'uppercase' }}>Dose log · tap when given</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{selectedPlanMedications.map((medication, index) => {
                const key = `${selectedPlan.id}-${medication.name}-${index}`;
                const logged = doseLog[key];
                return <button key={key} type="button" aria-pressed={!!logged} disabled={!!logged} onClick={() => logMedicationDose(key)} style={{ border: `1px solid ${logged ? '#b7e4d7' : '#dcece5'}`, borderRadius: 7, background: logged ? '#e7f5f2' : '#fff', color: '#005447', padding: '7px 9px', fontSize: '.68rem', cursor: logged ? 'default' : 'pointer' }}>{logged ? '✓' : '○'} {medication.name} · {logged ? `Given ${formatDoseTime(logged)}` : '9:00 AM'}</button>;
              })}</div>
            </div>
            <h3 style={{ margin: '20px 0 0', color: '#526663', fontSize: '.72rem', letterSpacing: '.07em', textTransform: 'uppercase' }}>Past medications</h3>
            <div style={{ marginTop: 5, borderTop: '1px solid #dcece5' }}>{(selectedPlan.pastMedications || []).map(item => <div key={item} style={{ padding: '10px 4px', borderBottom: '1px solid #e5eeea', color: '#475569', fontSize: '.72rem' }}>{item}</div>)}</div>
          </div> : selectedPlanTab === 'Notes' ? <div style={{ marginTop: 19 }}>
            {selectedPlan.isMock
              ? <div style={{ display: 'grid', gap: 9 }}><h3 style={{ margin: 0, color: '#005447', fontSize: '.95rem' }}>Example clinical updates</h3>{selectedPlan.clinicalUpdates.map((note, index) => <div key={`${note.date}-${index}`} style={{ padding: 12, border: '1px solid #eef2f7', borderRadius: 8 }}><div style={{ color: '#334155', fontSize: '.78rem' }}>{note.text}</div><div style={{ marginTop: 5, color: '#64748b', fontSize: '.68rem' }}>{formatDateText(note.date, undefined, note.date)} · {note.author}</div></div>)}</div>
              : <><div style={{ display: 'grid', gap: 10, padding: 14, border: '1px solid #d8f4e8', borderRadius: 10, background: '#f8fbff' }}><h3 style={{ margin: 0, color: '#005447', fontSize: '.95rem' }}>Add Note</h3><textarea value={planNote} onChange={event => { setPlanNote(event.target.value); setPlanNoteError(''); }} placeholder="Write a note about this patient's condition, treatment, or follow-up..." rows={4} style={{ resize: 'vertical', border: '1px solid #d8f4e8', borderRadius: 8, padding: 11, color: '#111827', fontFamily: 'inherit', fontSize: '.78rem', outline: 'none' }} /></div>
                {planNoteError && <div role="alert" style={{ marginTop: 10, color: '#b42318', fontSize: '.75rem' }}>{planNoteError}</div>}
                <h3 style={{ margin: '22px 0 10px', color: '#005447', fontSize: '.95rem' }}>Patient Notes</h3><div style={{ display: 'grid', gap: 9 }}>{[...(selectedPlan.notes || [])].reverse().map((note, index) => <div key={`${note.date}-${index}`} style={{ padding: 12, border: '1px solid #eef2f7', borderRadius: 8 }}><div style={{ color: '#334155', fontSize: '.78rem' }}>{note.text}</div><div style={{ marginTop: 5, color: '#64748b', fontSize: '.68rem' }}>{formatDateText(note.date, undefined, note.date)} · {note.author || 'Clinic team'}</div></div>)}{!selectedPlan.notes?.length && <p style={{ margin: 0, padding: 12, color: '#64748b', fontSize: '.78rem' }}>No patient notes have been added to this plan.</p>}</div></>}
          </div> : <>
          <div style={{ marginTop: 18, paddingBottom: 15, borderBottom: '1px solid #e2e8f0' }}><strong style={{ display: 'block', color: '#1f2937', fontSize: '.9rem' }}>{selectedPlan.title}</strong><span style={{ display: 'block', marginTop: 4, color: '#64748b', fontSize: '.72rem' }}>{selectedPlan.id} · Created {selectedPlan.created} · {selectedPlan.doctor}</span></div>
          {nextPlanStep && <div style={{ marginTop: 14, padding: '12px 14px', border: `1px solid ${nextPlanStep.overdue ? '#f2d5a6' : '#d8e9e2'}`, borderRadius: 11, background: nextPlanStep.overdue ? '#fff8eb' : '#f6fbf8' }}>
            <div style={{ color: nextPlanStep.overdue ? '#9a5b00' : '#526663', fontSize: '.68rem', fontWeight: 700, letterSpacing: '.03em' }}>NEXT ACTION{nextPlanStep.overdue ? ' · OVERDUE' : ''}</div>
            <strong style={{ display: 'block', marginTop: 5, color: '#1f2937', fontSize: '.95rem' }}>{nextPlanStep.title}</strong>
            <span style={{ display: 'block', marginTop: 3, color: '#64748b', fontSize: '.75rem' }}>Was due {nextPlanStep.due || selectedPlan.nextActionDue || selectedPlan.followUp || 'Not scheduled'} · {nextPlanStep.assignee || selectedPlan.doctor}</span>
          </div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '17px 24px', marginTop: 17 }}>
            <div><div style={{ color: '#64748b', fontSize: '.72rem' }}>Diagnosis</div><strong style={{ display: 'block', marginTop: 3, color: '#1f2937', fontSize: '.82rem' }}>{selectedPlan.diagnosis}</strong><span style={{ display: 'block', marginTop: 2, color: '#64748b', fontSize: '.7rem' }}>{selectedPlan.diagnosisConfirmation || 'Confirmation not recorded'}</span></div>
            <div><div style={{ color: '#64748b', fontSize: '.72rem' }}>Severity</div><strong style={{ display: 'block', marginTop: 3, color: '#1f2937', fontSize: '.82rem' }}>{selectedPlan.severity || 'Not recorded'}</strong></div>
            <div><div style={{ color: '#64748b', fontSize: '.72rem' }}>Start date</div><strong style={{ display: 'block', marginTop: 3, color: '#1f2937', fontSize: '.82rem' }}>{selectedPlan.created}</strong></div>
            <div><div style={{ color: '#64748b', fontSize: '.72rem' }}>Next follow-up</div><strong style={{ display: 'block', marginTop: 3, color: '#1f2937', fontSize: '.82rem' }}>{selectedPlan.followUp || (selectedPlan.status === 'completed' ? 'Completed' : 'Not scheduled')}</strong></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 21, color: '#005447', fontSize: '.78rem', fontWeight: 700 }}><span>Progress</span><span>{selectedPlanCheckedSteps.filter(Boolean).length} of {selectedPlan.totalSteps} steps</span></div>
          <div style={{ height: 9, marginTop: 7, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}><div style={{ width: `${(selectedPlanCheckedSteps.filter(Boolean).length / selectedPlan.totalSteps) * 100}%`, height: '100%', background: '#139b76', borderRadius: 6, transition: 'width .2s ease' }} /></div>
          <div style={{ display: 'grid', marginTop: 10 }}>
            {selectedPlanSteps.map((step, index) => {
              const stepStatus = step.done ? `Done ${step.completedAt || step.date}` : step.overdue ? 'Overdue' : `Due ${step.due || step.date}`;
              const stepStatusColor = step.done ? '#005447' : step.overdue ? '#c51f18' : '#1d55bd';
              return <button key={step.title} type="button" aria-pressed={step.done} disabled={selectedPlan.isMock || savingPlanProgress} onClick={() => savePlanStepProgress(index, !step.done)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 0', border: 0, borderBottom: index < selectedPlanSteps.length - 1 ? '1px solid #e5eeea' : 0, background: 'transparent', textAlign: 'left', cursor: selectedPlan.isMock || savingPlanProgress ? 'wait' : 'pointer' }}>
                <span style={{ width: 27, height: 27, flex: '0 0 27px', borderRadius: '50%', border: `2px solid ${step.done ? '#0c8b6e' : step.overdue ? '#e42d27' : '#cbd5e1'}`, background: step.done ? '#0c8b6e' : '#fff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.76rem' }}>{step.done ? '✓' : ''}</span>
                <span style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', color: '#334155', fontSize: '.78rem' }}>{step.title}</strong><small style={{ display: 'block', marginTop: 3, color: '#64748b', fontSize: '.68rem' }}>{step.assignee || selectedPlan.doctor}</small></span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: stepStatusColor, fontSize: '.7rem', whiteSpace: 'nowrap' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: stepStatusColor }} />{stepStatus}</span>
              </button>;
            })}
          </div>
          </>}
          </div>
          {archivePlanError && <div role="alert" style={{ flex: '0 0 auto', padding: '8px 28px 0', color: '#b42318', fontSize: '.75rem' }}>{archivePlanError}</div>}
          <footer style={{ display: 'flex', flex: '0 0 auto', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 28px', borderTop: '1px solid #e2e8f0', background: '#fff' }}>
            <button type="button" onClick={() => setFullPlanOpen(true)} style={{ border: 0, background: 'transparent', color: '#005447', padding: '10px 12px', fontSize: '.76rem', fontWeight: 600, cursor: 'pointer' }}>Open full plan</button>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
            {selectedPlan.databaseId && <button type="button" disabled={archivingPlan} onClick={togglePlanArchive} style={{ border: '1px solid #f0c9c7', borderRadius: 9, background: '#fff', color: selectedPlan.archived ? '#005447' : '#b42318', padding: '10px 12px', fontSize: '.75rem', fontWeight: 700, cursor: archivingPlan ? 'wait' : 'pointer' }}>{archivingPlan ? 'Saving…' : selectedPlan.archived ? 'Restore plan' : 'Archive plan'}</button>}
            {selectedPlanTab === 'Plan Details' ? <button type="button" disabled={!nextPlanStep || selectedPlan.isMock || savingPlanProgress} onClick={() => {
              if (!nextPlanStep) return;
              savePlanStepProgress(nextStepIndex, true);
            }} style={{ border: 0, borderRadius: 9, background: nextPlanStep && !selectedPlan.isMock ? '#005447' : '#d1e5dd', color: '#fff', padding: '11px 17px', fontSize: '.75rem', fontWeight: 700, cursor: nextPlanStep && !selectedPlan.isMock ? 'pointer' : 'default' }}>{savingPlanProgress ? 'Saving…' : selectedPlan.isMock ? 'Reference sample' : nextPlanStep ? 'Complete step' : 'All steps complete'}</button>
              : selectedPlanTab === 'Medications' ? !selectedPlan.isMock && <button type="button" className="patient-primary-add" onClick={openAddMedication} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 42, whiteSpace: 'nowrap', border: 0, borderRadius: 9, background: '#005447', color: '#fff', padding: '10px 15px', fontSize: '.8rem', fontWeight: 700, cursor: 'pointer' }}><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 16px', width: 16, height: 16 }}>{Icons.plus}</span>Add medication</button>
                : !selectedPlan.isMock && <button type="button" disabled={!planNote.trim() || savingPlanNote} onClick={savePlanNote} style={{ border: 0, borderRadius: 9, background: planNote.trim() && !savingPlanNote ? '#005447' : '#d1e5dd', color: '#fff', padding: '11px 17px', fontSize: '.75rem', fontWeight: 700, cursor: planNote.trim() && !savingPlanNote ? 'pointer' : 'default' }}>{savingPlanNote ? 'Saving…' : 'Save note'}</button>}
            </div>
          </footer>
        </div>
      </div>}
      {addMedicationOpen && selectedPlan && createPortal(<div style={{ ...modalStyles.backdrop, zIndex: 1400 }} onClick={() => setAddMedicationOpen(false)}>
        <ModalDialog as="form" size="standard" role="dialog" aria-modal="true" aria-labelledby="add-medication-title" onClick={event => event.stopPropagation()} onSubmit={savePlanMedication} style={{ ...modalStyles.dialog, width: 'min(500px, calc(100vw - 32px))', padding: '25px 28px 22px' }}>
          <button type="button" aria-label="Close add medication" onClick={() => setAddMedicationOpen(false)} style={modalStyles.close}>{Icons.close}</button>
          <h2 id="add-medication-title" style={{ margin: 0, color: '#1f2937', fontSize: '1.15rem' }}>Add Medication</h2>
          <div style={{ marginTop: 6, paddingBottom: 14, borderBottom: '1px solid #e5eeea', color: '#64748b', fontSize: '.78rem' }}>Add a prescribed medication to {selectedPlan.pet}&apos;s treatment record.</div>
          {addMedicationError && <div role="alert" style={{ marginTop: 14, padding: 10, border: '1px solid #fecaca', borderRadius: 8, background: '#fff7f7', color: '#b42318', fontSize: '.75rem' }}>{addMedicationError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 10px', marginTop: 16 }}>
            <label style={{ gridColumn: '1 / -1', display: 'grid', gap: 5, color: '#1f2937', fontSize: '.76rem', fontWeight: 700 }}>Medication name <span className="system-required-star">*</span><input required value={medicationForm.name} onChange={event => setMedicationForm(previous => ({ ...previous, name: event.target.value }))} placeholder="Search or enter medication name" style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '10px 11px', color: '#111827', fontSize: '.78rem', outlineColor: '#78b7a1' }} /></label>
            <label style={{ display: 'grid', gap: 5, color: '#1f2937', fontSize: '.76rem', fontWeight: 700 }}>Dose <span className="system-required-star">*</span><input required value={medicationForm.dose} onChange={event => setMedicationForm(previous => ({ ...previous, dose: event.target.value }))} placeholder="e.g. 250" style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '10px 11px', color: '#111827', fontSize: '.78rem', outlineColor: '#78b7a1' }} /></label>
            <label style={{ display: 'grid', gap: 5, color: '#1f2937', fontSize: '.76rem', fontWeight: 700 }}>Unit <span className="system-required-star">*</span><input required value={medicationForm.unit} onChange={event => setMedicationForm(previous => ({ ...previous, unit: event.target.value }))} placeholder="mg" style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '10px 11px', color: '#111827', fontSize: '.78rem', outlineColor: '#78b7a1' }} /></label>
            <label style={{ display: 'grid', gap: 5, color: '#1f2937', fontSize: '.76rem', fontWeight: 700 }}>Route <span className="system-required-star">*</span><select required value={medicationForm.route} onChange={event => setMedicationForm(previous => ({ ...previous, route: event.target.value, routeOther: '' }))} style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '10px 11px', background: '#fff', color: '#111827', fontSize: '.78rem' }}><option value="">Select route</option>{['Oral', 'Intravenous (IV)', 'Intramuscular (IM)', 'Subcutaneous (SC)', 'Topical', 'Ophthalmic', 'Otic', 'Inhaled', 'Other'].map(route => <option key={route}>{route}</option>)}</select></label>
            <label style={{ display: 'grid', gap: 5, color: '#1f2937', fontSize: '.76rem', fontWeight: 700 }}>Frequency <span className="system-required-star">*</span><select required value={medicationForm.frequency} onChange={event => setMedicationForm(previous => ({ ...previous, frequency: event.target.value, frequencyOther: '' }))} style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '10px 11px', background: '#fff', color: '#111827', fontSize: '.78rem' }}><option value="">Select frequency</option>{['Once daily (q24h)', 'Twice daily (q12h)', 'Three times daily (q8h)', 'Four times daily (q6h)', 'Every 4 hours (q4h)', 'Every 6 hours (q6h)', 'Every 8 hours (q8h)', 'Every 12 hours (q12h)', 'As needed (PRN)', 'Other'].map(frequency => <option key={frequency}>{frequency}</option>)}</select></label>
            {medicationForm.route === 'Other' && <label style={{ display: 'grid', gap: 5, color: '#1f2937', fontSize: '.76rem', fontWeight: 700 }}>Specify route <span className="system-required-star">*</span><input required value={medicationForm.routeOther} onChange={event => setMedicationForm(previous => ({ ...previous, routeOther: event.target.value }))} placeholder="Enter route" style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '10px 11px', color: '#111827', fontSize: '.78rem' }} /></label>}
            {medicationForm.frequency === 'Other' && <label style={{ display: 'grid', gap: 5, color: '#1f2937', fontSize: '.76rem', fontWeight: 700 }}>Specify frequency <span className="system-required-star">*</span><input required value={medicationForm.frequencyOther} onChange={event => setMedicationForm(previous => ({ ...previous, frequencyOther: event.target.value }))} placeholder="Enter frequency" style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '10px 11px', color: '#111827', fontSize: '.78rem' }} /></label>}
            <label style={{ display: 'grid', gap: 5, color: '#1f2937', fontSize: '.76rem', fontWeight: 700 }}>Duration <span className="system-required-star">*</span><input required value={medicationForm.duration} onChange={event => setMedicationForm(previous => ({ ...previous, duration: event.target.value }))} placeholder="e.g. 7 days" style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '10px 11px', color: '#111827', fontSize: '.78rem' }} /></label>
            <label style={{ display: 'grid', gap: 5, color: '#1f2937', fontSize: '.76rem', fontWeight: 700 }}>Quantity to dispense<input value={medicationForm.quantity} onChange={event => setMedicationForm(previous => ({ ...previous, quantity: event.target.value }))} placeholder="e.g. 14 tablets" style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '10px 11px', color: '#111827', fontSize: '.78rem' }} /></label>
            <label style={{ display: 'grid', gap: 5, color: '#1f2937', fontSize: '.76rem', fontWeight: 700 }}>Start date <span className="system-required-star">*</span><LabDateTimePicker mode="date" required value={medicationForm.date} onChange={date => setMedicationForm(previous => ({ ...previous, date }))} style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '9px 10px', color: '#111827', fontSize: '.78rem' }} /></label>
            <label style={{ display: 'grid', gap: 5, color: '#1f2937', fontSize: '.76rem', fontWeight: 700 }}>End date<LabDateTimePicker mode="date" min={medicationForm.date || undefined} value={medicationForm.endDate} onChange={endDate => setMedicationForm(previous => ({ ...previous, endDate }))} style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '9px 10px', color: '#111827', fontSize: '.78rem' }} />{!medicationForm.endDate && calculateMedicationEndDate(medicationForm.date, medicationForm.duration) && <small style={{ color: '#64748b', fontWeight: 400 }}>Calculated: {formatDateText(calculateMedicationEndDate(medicationForm.date, medicationForm.duration))}</small>}</label>
            <label style={{ gridColumn: '1 / -1', display: 'grid', gap: 5, color: '#1f2937', fontSize: '.76rem', fontWeight: 700 }}>Instructions for owner<textarea rows={3} value={medicationForm.instructions} onChange={event => setMedicationForm(previous => ({ ...previous, instructions: event.target.value }))} placeholder="Enter administration instructions, precautions, or other prescribed directions..." style={{ resize: 'vertical', border: '1px solid #d1d5db', borderRadius: 7, padding: '10px 11px', color: '#111827', font: 'inherit', fontSize: '.78rem', outlineColor: '#78b7a1' }} /></label>
            <label style={{ gridColumn: '1 / -1', display: 'grid', gap: 5, color: '#1f2937', fontSize: '.76rem', fontWeight: 700 }}>Linked treatment plan<select value={medicationForm.treatmentPlanId} onChange={event => setMedicationForm(previous => ({ ...previous, treatmentPlanId: event.target.value }))} style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '10px 11px', background: '#fff', color: '#111827', fontSize: '.78rem' }}><option value="">No linked plan (optional)</option>{savedPlans.filter(plan => String(plan.pet_id) === String(selectedPlan.pet_id)).map(plan => <option key={plan.databaseId} value={plan.databaseId}>{plan.title}</option>)}</select></label>
            <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 5, color: '#1f2937', fontSize: '.76rem', fontWeight: 700 }}>Prescribed by<div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#005447', fontWeight: 500 }}><span aria-hidden="true">♙</span>{user?.name || selectedPlan.doctor || 'Current veterinarian'}</div></div>
          </div>
          <div style={{ ...modalStyles.footer, marginTop: 20 }}><button type="button" disabled={savingMedication} onClick={() => setAddMedicationOpen(false)} style={modalStyles.cancel}>Cancel</button><button type="submit" disabled={savingMedication} style={{ ...T.primaryBtn, padding: '10px 14px', fontSize: '.78rem' }}>{savingMedication ? 'Saving…' : 'Save Medication'}</button></div>
        </ModalDialog>
      </div>, document.body)}
      {editPlanOpen && selectedPlan && createPortal(<div onClick={() => setEditPlanOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: 20, boxSizing: 'border-box', background: 'rgba(25, 43, 38, .52)' }}>
        <form role="dialog" aria-modal="true" aria-labelledby="edit-plan-title" onClick={event => event.stopPropagation()} onSubmit={saveEditedPlan} style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: 'min(554px, 100%)', maxHeight: 'calc(100vh - 40px)', overflow: 'hidden', borderRadius: 20, background: '#fff', boxShadow: '0 24px 70px rgba(15, 35, 28, .26)', color: '#193a32' }}>
          <button type="button" aria-label="Close edit plan" onClick={() => setEditPlanOpen(false)} style={{ position: 'absolute', top: 22, right: 23, zIndex: 1, display: 'grid', placeItems: 'center', width: 28, height: 28, border: 0, background: 'transparent', color: '#58716b', fontSize: 23, cursor: 'pointer' }}>×</button>
          <header style={{ flex: '0 0 auto', padding: '22px 24px 13px' }}>
            <h2 id="edit-plan-title" style={{ margin: 0, paddingRight: 36, color: '#193a32', fontSize: '1.28rem', fontWeight: 750 }}>Edit plan</h2>
            <div style={{ marginTop: 4, color: '#58716b', fontSize: '.88rem' }}>{selectedPlan.pet} · {selectedPlan.id}</div>
          </header>
          <div style={{ flex: '1 1 auto', overflowY: 'auto', display: 'grid', alignContent: 'start', gap: 17, padding: '9px 24px 22px' }}>
            <label style={{ display: 'grid', gap: 8, color: '#193a32', fontSize: '.88rem', fontWeight: 600 }}>
              Plan title
              <input required value={editPlanForm.title} onChange={event => setEditPlanForm(previous => ({ ...previous, title: event.target.value }))} style={{ width: '100%', height: 55, boxSizing: 'border-box', border: '1px solid #d8e9e1', borderRadius: 13, padding: '0 15px', color: '#193a32', font: 'inherit', fontWeight: 400, outlineColor: '#78b7a1' }} />
            </label>
            <fieldset style={{ display: 'grid', gap: 9, margin: 0, padding: 0, border: 0 }}>
              <legend style={{ marginBottom: 9, color: '#193a32', fontSize: '.88rem', fontWeight: 600 }}>Severity</legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>{['Mild', 'Moderate', 'Severe'].map(severity => <button key={severity} type="button" aria-pressed={editPlanForm.severity === severity} onClick={() => setEditPlanForm(previous => ({ ...previous, severity }))} style={{ minWidth: 72, height: 47, border: `1px solid ${editPlanForm.severity === severity ? '#005447' : '#d8e9e1'}`, borderRadius: 13, background: editPlanForm.severity === severity ? '#e7f5f2' : '#fff', color: editPlanForm.severity === severity ? '#005447' : '#38534c', fontSize: '.8rem', cursor: 'pointer' }}>{severity}</button>)}</div>
            </fieldset>
            <fieldset style={{ display: 'grid', gap: 9, margin: 0, padding: 0, border: 0 }}>
              <legend style={{ marginBottom: 9, color: '#193a32', fontSize: '.88rem', fontWeight: 600 }}>Attending veterinarian</legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>{Array.from(new Set([selectedPlan.doctor, ...clinicVeterinarians.map(member => member.name)].filter(Boolean))).map(doctor => <button key={doctor} type="button" aria-pressed={editPlanForm.doctor === doctor} onClick={() => setEditPlanForm(previous => ({ ...previous, doctor }))} style={{ minHeight: 47, border: `1px solid ${editPlanForm.doctor === doctor ? '#005447' : '#d8e9e1'}`, borderRadius: 13, background: editPlanForm.doctor === doctor ? '#e7f5f2' : '#fff', color: editPlanForm.doctor === doctor ? '#005447' : '#38534c', padding: '0 14px', fontSize: '.8rem', cursor: 'pointer' }}>{doctor}</button>)}</div>
            </fieldset>
            <label style={{ display: 'grid', gap: 8, color: '#193a32', fontSize: '.88rem', fontWeight: 600 }}>
              Expected completion
              <LabDateTimePicker mode="date" value={editPlanForm.completionDate} onChange={completionDate => setEditPlanForm(previous => ({ ...previous, completionDate }))} style={{ width: '100%', height: 55, boxSizing: 'border-box', border: '1px solid #d8e9e1', borderRadius: 13, padding: '0 15px', background: '#fff', color: '#193a32', font: 'inherit', fontWeight: 400, outlineColor: '#78b7a1' }} />
            </label>
            {!!editPlanForm.steps.length && <section style={{ display: 'grid', gap: 13 }}>
              <h3 style={{ margin: '3px 0 0', color: '#58716b', fontSize: '.8rem', fontWeight: 750, letterSpacing: '.08em' }}>REMAINING STEPS</h3>
              {editPlanForm.steps.map(step => <div key={step.index} style={{ display: 'grid', gap: 8 }}>
                <strong style={{ color: '#193a32', fontSize: '.88rem' }}>{step.index + 1}. {step.title}</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <select aria-label={`${step.title} assignee`} value={step.assignee} onChange={event => setEditPlanForm(previous => ({ ...previous, steps: previous.steps.map(item => item.index === step.index ? { ...item, assignee: event.target.value } : item) }))} style={{ minWidth: 0, height: 56, border: '1px solid #d8e9e1', borderRadius: 13, padding: '0 13px', background: '#fff', color: '#38534c', fontSize: '.8rem' }}>{Array.from(new Set([step.assignee, selectedPlan.doctor, ...clinicVeterinarians.map(member => member.name)].filter(Boolean))).map(doctor => <option key={doctor} value={doctor}>{doctor}</option>)}</select>
                  <input aria-label={`${step.title} due date`} value={step.due} onChange={event => setEditPlanForm(previous => ({ ...previous, steps: previous.steps.map(item => item.index === step.index ? { ...item, due: event.target.value } : item) }))} placeholder="Due date and time" style={{ minWidth: 0, height: 56, boxSizing: 'border-box', border: '1px solid #d8e9e1', borderRadius: 13, padding: '0 13px', color: '#38534c', fontSize: '.8rem', outlineColor: '#78b7a1' }} />
                </div>
              </div>)}
              <p style={{ margin: 0, color: '#58716b', fontSize: '.76rem', lineHeight: 1.45 }}>Changing a due date reschedules the step and clears its overdue flag. Every change is logged in Clinical Updates.</p>
            </section>}
          </div>
          <footer style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 22, padding: '16px 24px', borderTop: '1px solid #e1ebe6', background: '#fff' }}>
            <button type="button" onClick={() => setEditPlanOpen(false)} style={{ border: 0, background: 'transparent', color: '#005447', padding: '10px 8px', fontSize: '.82rem', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ minWidth: 123, border: 0, borderRadius: 12, background: '#005447', color: '#fff', padding: '15px 17px', fontSize: '.82rem', fontWeight: 700, cursor: 'pointer' }}>Save changes</button>
          </footer>
        </form>
      </div>, document.body)}
      {standalonePlanRequest && !selectedPlan && createPortal(<div role={clinicalRecordsError ? 'alert' : 'status'} style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'center', background: '#f4f7fb', color: clinicalRecordsError ? '#b42318' : '#334155', fontSize: 15 }}>{clinicalRecordsError || 'Loading full treatment plan…'}{clinicalRecordsError && <button type="button" onClick={() => onStandalonePlanClose?.()} style={{ marginTop: 12 }}>Back to patient record</button>}</div>, document.body)}
      {fullPlanOpen && selectedPlan && createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 1200, overflowY: 'auto', background: '#f4f7fb', padding: '24px 20px 40px', boxSizing: 'border-box' }}>
        <style>{`.full-plan-columns{grid-template-columns:minmax(0,1.35fr) minmax(300px,.8fr)}@media(max-width:900px){.full-plan-columns{grid-template-columns:minmax(0,1fr)!important}}@media(max-width:620px){.full-plan-metadata{grid-template-columns:repeat(2,minmax(0,1fr))!important}.full-plan-metadata>div{border-right:0!important;border-bottom:1px solid #e5eeea}.full-treatment-plan{font-size:15px!important}}`}</style>
        <div className="full-treatment-plan" role="dialog" aria-modal="true" aria-labelledby="full-plan-title" style={{ width: 'min(1180px, 100%)', margin: '0 auto', padding: '4px 0', fontSize: '16px' }}>
          <button type="button" onClick={() => standalonePlanRequest ? onStandalonePlanClose?.() : setFullPlanOpen(false)} style={{ border: 0, background: 'transparent', color: '#005447', padding: 0, fontSize: '.95rem', fontWeight: 700, cursor: 'pointer' }}>← Back to Treatment Plans</button>
          <div style={{ marginTop: 18, padding: '25px 27px', border: '1px solid #dcece5', borderRadius: 14, background: '#fff' }}>
            {selectedPlan.isMock && <div role="note" style={{ marginBottom: 18, padding: '10px 12px', border: '1px solid #ead9a7', borderRadius: 8, background: '#fffaf0', color: '#755b16', fontSize: '.8rem' }}><strong>Reference sample only:</strong> this fully filled example is for viewing purposes and is not a real patient record. All details are illustrative.</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', width: 46, height: 46, flex: '0 0 46px', overflow: 'hidden', borderRadius: '50%', background: '#e7f5f2', color: '#005447', display: 'grid', placeItems: 'center', fontSize: '1.05rem', fontWeight: 800 }}>
                {selectedPlan.pet.trim().slice(0, 1).toUpperCase()}
                {getPetPhotoUrl(selectedPatient) && <img src={getPetPhotoUrl(selectedPatient)} alt={`${selectedPlan.pet} profile`} onError={event => { event.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 id="full-plan-title" style={{ margin: 0, color: '#1f2937', fontSize: '1.35rem' }}>{selectedPlan.pet} <StatusIndicator status={selectedPlan.status} style={{ marginLeft: 7, verticalAlign: 'middle', fontSize: '.86rem' }} /></h2>
                <div style={{ marginTop: 5, color: '#526663', fontSize: '.86rem' }}>{selectedPlan.diagnosis} · {selectedPlan.diagnosisConfirmation || 'Diagnosis confirmation not recorded'} · {selectedPlan.created} · Severity: {selectedPlan.severity || 'Not recorded'}</div>
                <div style={{ marginTop: 4, color: '#64748b', fontSize: '.8rem' }}>{selectedPlan.id} · {selectedPlan.doctor} · Owner: {selectedPlan.owner}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 9 }}>{selectedPlan.isolationRequired && <span style={{ padding: '5px 9px', borderRadius: 6, color: '#b42318', background: '#fff1f0', fontSize: '.76rem' }}>⚠ Isolation required</span>}{selectedPlan.reportedToDiseaseMonitoring && <span style={{ padding: '5px 9px', borderRadius: 6, color: '#1d55bd', background: '#eef4ff', fontSize: '.76rem' }}>● Reported to Disease Monitoring</span>}</div>
              </div>
            </div>
            <div className="full-plan-metadata" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', marginTop: 16, border: '1px solid #e5eeea', borderRadius: 9, overflow: 'hidden' }}>{[
              ['Weight', selectedPatient?.weight || selectedPlan.weight || 'Not recorded'],
              ['Species · Age', `${selectedPatient?.species || selectedPlan.species || 'Pet'} · ${selectedPatientAge || selectedPlan.age || '—'}`],
              ['Sex', selectedPatientSex || selectedPlan.sex || 'Not recorded'],
              ['Allergies', selectedPlan.allergies || selectedPatient?.allergies || 'Not recorded'],
              ['Vaccines', selectedPlan.vaccines || 'Not recorded'],
            ].map(([label, value], index) => <div key={label} style={{ minWidth: 0, padding: '13px 14px', borderRight: index < 4 ? '1px solid #e5eeea' : 0 }}><small style={{ display: 'block', color: '#64748b', fontSize: '.76rem' }}>{label}</small><strong style={{ display: 'block', marginTop: 4, color: '#1f2937', fontSize: '.86rem' }}>{value}</strong></div>)}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 18, color: '#334155', fontSize: '.86rem' }}><strong>Plan progress</strong><span>Step {Math.min(selectedPlanCheckedSteps.filter(Boolean).length + 1, selectedPlan.totalSteps)} of {selectedPlan.totalSteps} · Expected completion {selectedPlan.followUp || 'Not scheduled'}</span></div><div style={{ height: 10, marginTop: 7, background: '#e1ebe6', borderRadius: 7, overflow: 'hidden' }}><div style={{ width: `${selectedPlanCheckedSteps.filter(Boolean).length / selectedPlan.totalSteps * 100}%`, height: '100%', background: '#0c8b6e', borderRadius: 7 }} /></div>
          </div>
          {nextPlanStep && <section style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginTop: 16, padding: '19px 21px', border: `1px solid ${nextPlanStep.overdue ? '#f2d5a6' : '#dcece5'}`, borderRadius: 12, background: nextPlanStep.overdue ? '#fff8eb' : '#fff' }}>
            <div><div style={{ color: nextPlanStep.overdue ? '#9a5b00' : '#64748b', fontSize: '.78rem', fontWeight: 700, letterSpacing: '.04em' }}>NEXT ACTION · {nextPlanStep.overdue ? 'OVERDUE' : 'SCHEDULED'}</div><strong style={{ display: 'block', marginTop: 5, color: '#1f2937', fontSize: '1.08rem' }}>{nextPlanStep.title}</strong><span style={{ color: '#64748b', fontSize: '.84rem' }}>Was due {nextPlanStep.due || selectedPlan.nextActionDue || selectedPlan.followUp || 'Not scheduled'} · Assigned to {nextPlanStep.assignee || selectedPlan.doctor}</span></div>
            {!selectedPlan.isMock && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}><button type="button" disabled={savingPlanProgress} onClick={() => {
              if (!nextPlanStep) return;
              savePlanStepProgress(nextStepIndex, true);
            }} style={{ ...modalStyles.cancel, padding: '11px 14px', fontSize: '.78rem' }}>{savingPlanProgress ? 'Saving…' : 'Complete step'}</button></div>}
          </section>}
          <div className="full-plan-columns" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(300px, .8fr)', gap: 18, marginTop: 17, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
              <section style={{ border: '1px solid #dcece5', borderRadius: 13, padding: '21px 22px', background: '#fff' }}>
                <h3 style={{ margin: 0, color: '#1f2937', fontSize: '1.02rem' }}>Treatment Steps</h3>
                <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '.78rem' }}>What needs to be done?</p>
                <div style={{ display: 'grid', marginTop: 12 }}>{selectedPlanSteps.map((step, index) => {
                  const statusLabel = step.done ? `Done ${step.completedAt || step.date}` : step.overdue ? 'Overdue' : `Scheduled ${step.due || step.date}`;
                  const tone = step.done ? '#0c8b6e' : step.overdue ? '#dc2626' : '#3674e8';
                  return <div key={step.title} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: '15px 0', borderBottom: index < selectedPlanSteps.length - 1 ? '1px solid #e5eeea' : 0 }}>
                    <span style={{ width: 29, height: 29, borderRadius: '50%', border: `2px solid ${tone}`, background: step.done ? tone : '#fff', color: step.done ? '#fff' : tone, display: 'grid', placeItems: 'center', fontSize: '.82rem' }}>{step.done ? '✓' : index + 1}</span>
                    <div><strong style={{ display: 'block', color: '#1f2937', fontSize: '.86rem' }}>{step.title}</strong><small style={{ display: 'block', marginTop: 4, color: '#64748b', fontSize: '.76rem', lineHeight: 1.4 }}>{step.detail} · {step.assignee || selectedPlan.doctor}</small></div>
                    <span style={{ color: tone, fontSize: '.76rem', whiteSpace: 'nowrap' }}>● {statusLabel}</span>
                  </div>;
                })}</div>
              </section>
              <section style={{ border: '1px solid #dcece5', borderRadius: 13, padding: '21px 22px', background: '#fff', minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><div><h3 style={{ margin: 0, color: '#1f2937', fontSize: '1.02rem' }}>Medications</h3><p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '.78rem' }}>What medication should be given?</p></div>{!selectedPlan.isMock && <button type="button" className="full-plan-add-medication" onClick={openAddMedication}><span aria-hidden="true">{Icons.plus}</span>Add medication</button>}</div>
                <div style={{ overflowX: 'auto', marginTop: 14 }}>
                  <div style={{ minWidth: 630 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, .7fr) minmax(0, .65fr) minmax(0, 1.2fr) minmax(0, .9fr) 92px', gap: 10, padding: '0 5px 9px', borderBottom: '1px solid #dcece5', color: '#64748b', fontSize: '.73rem', fontWeight: 700 }}><span>Drug</span><span>Dose</span><span>Route</span><span>Frequency</span><span>Next due</span><span>Status</span></div>
                    {(selectedPlan.medications || []).map((medication, index) => <div key={`${medication.id || medication.name}-${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, .7fr) minmax(0, .65fr) minmax(0, 1.2fr) minmax(0, .9fr) 92px', gap: 10, alignItems: 'center', padding: '13px 5px', borderBottom: '1px solid #e8efec', color: '#334155', fontSize: '.78rem' }}>
                      <span style={{ minWidth: 0 }}><strong style={{ display: 'block', color: '#1f2937', fontSize: '.83rem', overflowWrap: 'anywhere' }}>{medication.name}</strong><small style={{ display: 'block', marginTop: 3, color: '#64748b', fontSize: '.73rem' }}>{medication.day || medication.duration}</small></span><span style={{ minWidth: 0 }}>{medication.dose}</span><span style={{ minWidth: 0 }}>{medication.route || '—'}</span><span style={{ minWidth: 0 }}>{medication.frequency}</span><span style={{ minWidth: 0 }}>{medication.nextDue || medication.duration}</span><span style={{ minWidth: 0, whiteSpace: 'nowrap' }}><StatusIndicator status={medication.status} style={{ fontSize: '.74rem' }} /></span>
                    </div>)}
                  </div>
                </div>
                {!currentMedicationCount && <p style={{ margin: '13px 5px', color: '#64748b', fontSize: '.8rem' }}>No current medications recorded.</p>}
                <div style={{ marginTop: 16 }}>
                  <div style={{ marginBottom: 9, color: '#526663', fontSize: '.73rem', fontWeight: 700, letterSpacing: '.05em' }}>DOSE LOG · TAP WHEN GIVEN</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{selectedPlanMedications.map((medication, index) => {
                    const key = `${selectedPlan.id}-${medication.name}-${index}`;
                    const logged = doseLog[key];
                    return <button key={key} type="button" aria-pressed={!!logged} disabled={!!logged || selectedPlan.isMock} onClick={() => logMedicationDose(key)} style={{ border: '1px solid #cfe8dc', borderRadius: 8, background: logged ? '#e7f5f2' : '#fff', color: '#005447', padding: '9px 11px', fontSize: '.76rem', cursor: logged || selectedPlan.isMock ? 'default' : 'pointer' }}>{logged ? '✓' : '○'} {medication.name} · {logged ? `Given ${formatDoseTime(logged)}` : '9:00 AM'}</button>;
                  })}</div>
                </div>
              </section>
              <section style={{ border: '1px solid #dcece5', borderRadius: 13, padding: '20px 21px', background: '#fff', minWidth: 0 }}>
                <h3 style={{ margin: 0, color: '#1f2937', fontSize: '1.02rem' }}>Medication notes</h3>
                <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '.78rem' }}>Owner instructions and notes saved with each medication.</p>
                <div style={{ display: 'grid', gap: 9, marginTop: 13 }}>
                  {selectedPlanMedications.filter(medication => medication.instructions?.trim()).map((medication, index) => (
                    <article key={`${medication.id || medication.name}-${index}`} style={{ padding: '12px 13px', border: '1px solid #dcece5', borderLeft: '3px solid #0c8b6e', borderRadius: 9, background: '#f8fbf9' }}>
                      <strong style={{ display: 'block', color: '#005447', fontSize: '.82rem' }}>{medication.name}</strong>
                      <p style={{ margin: '6px 0 0', color: '#475569', fontSize: '.8rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{medication.instructions}</p>
                    </article>
                  ))}
                  {!selectedPlanMedications.some(medication => medication.instructions?.trim()) && <p style={{ margin: 0, color: '#64748b', fontSize: '.8rem' }}>No medication notes have been added.</p>}
                </div>
              </section>
            </div>
            <div style={{ display: 'grid', gap: 15, minWidth: 0 }}>
              <section style={{ border: '1px solid #dcece5', borderRadius: 13, padding: '20px 21px', background: '#fff' }}>
                {(() => {
                  const monitoring = selectedPlan.monitoring || {};
                  const legacyObservations = selectedPlanClinicalUpdates.map(update => ({
                      date: update.date,
                      author: update.author,
                      text: update.text || '',
                    }));
                  const savedObservations = Array.isArray(monitoring.observations) ? monitoring.observations : [];
                  const observations = [...savedObservations, ...legacyObservations]
                    .filter((observation, index, all) => all.findIndex(item => item.date === observation.date && item.text === observation.text) === index)
                    .sort((left, right) => (Date.parse(right.date) || 0) - (Date.parse(left.date) || 0));
                  const latestObservation = observations[0];
                  const latestText = monitoring.latestObservation || latestObservation?.text;
                  const lastUpdated = monitoring.lastUpdatedAt || latestObservation?.date;
                  const observationFields = [
                    ['temperature', 'Temperature (°C)'],
                    ['weight', 'Weight (kg)'],
                    ['hydration', 'Hydration'],
                    ['appetite', 'Appetite'],
                  ];
                  return <>
                    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, paddingBottom: 15, borderBottom: '1px solid #e5eeea' }}>
                      <div>
                        <h3 style={{ margin: 0, color: '#1f2937', fontSize: '1.02rem' }}>Clinical Monitoring</h3>
                        <p style={{ margin: '4px 0 13px', color: '#64748b', fontSize: '.78rem' }}>Latest recorded observations</p>
                        <small style={{ display: 'block', color: '#64748b', fontSize: '.68rem', letterSpacing: '.04em' }}>LAST UPDATED</small>
                        <strong style={{ display: 'block', marginTop: 4, color: '#1f2937', fontSize: '.84rem', fontWeight: 600 }}>{formatMonitoringDate(lastUpdated)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                        {!selectedPlan.isMock && <button type="button" className="full-plan-action-button" onClick={monitoringFormOpen ? () => setMonitoringFormOpen(false) : openMonitoringForm}><span aria-hidden="true" style={{ fontSize: '1rem', lineHeight: 1 }}>＋</span>{monitoringFormOpen ? 'Close' : 'Add Observation'}</button>}
                      </div>
                    </header>
                    {monitoringFormOpen && createPortal(<div onClick={() => !savingMonitoring && setMonitoringFormOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1350, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: 16, boxSizing: 'border-box', background: 'rgba(15, 23, 42, .48)' }}>
                      <form role="dialog" aria-modal="true" aria-labelledby="add-observation-title" onClick={event => event.stopPropagation()} onSubmit={saveMonitoring} style={{ width: 'min(680px, 100%)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', padding: '22px 24px', border: '1px solid #dcece5', borderRadius: 13, background: '#fff', boxShadow: '0 18px 50px rgba(15,23,42,.24)', color: '#1f2937' }}>
                        <header style={{ paddingBottom: 12, borderBottom: '1px solid #e5eeea' }}>
                                      <h2 id="add-observation-title" style={{ margin: 0, fontSize: '1.25rem' }}>Add Clinical Observation</h2>
                                      <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '.95rem' }}>Record the pet&apos;s current condition.</p>
                        </header>
                        {(() => {
                                      const inputStyle = { width: '100%', minWidth: 0, minHeight: 48, boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: '11px 12px', color: '#1f2937', font: 'inherit', fontSize: '1rem', outlineColor: '#78b7a1' };
                                      const labelStyle = { display: 'grid', gap: 7, color: '#475569', fontSize: '.95rem', fontWeight: 650 };
                          const updateField = (field, value) => setMonitoringForm(previous => ({ ...previous, [field]: value }));
                          const radioGroup = (field, label, options) => <fieldset key={field} style={{ display: 'grid', gap: 7, margin: 0, padding: 0, border: 0 }}>
                            <legend style={{ marginBottom: 4, color: '#475569', fontSize: '.75rem', fontWeight: 650 }}>{label}</legend>
                            {options.map(option =>                             <label key={option} style={{ display: 'flex', alignItems: 'center', gap: 9, minHeight: 38, color: '#334155', fontSize: '.95rem', fontWeight: 400 }}>
                              <input type="radio" name={`observation-${field}`} value={option} checked={monitoringForm[field] === option} onChange={() => updateField(field, option)} />
                              {option}
                            </label>)}
                          </fieldset>;
                          return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px 14px', paddingTop: 17 }}>
                            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>Observation date <span className="system-required-star">*</span><LabDateTimePicker mode="date" required max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)} value={monitoringForm.date || ''} onChange={date => updateField('date', date)} style={inputStyle} /></label>
                            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>Time <span className="system-required-star">*</span><LabDateTimePicker mode="time" required value={monitoringForm.time || ''} onChange={time => updateField('time', time)} style={inputStyle} /></label>
                            <label style={labelStyle}>Temperature (°C)<input type="number" min="0" max="60" step="0.1" value={monitoringForm.temperature || ''} onChange={event => updateField('temperature', event.target.value)} placeholder="Enter value" style={inputStyle} /></label>
                            <label style={labelStyle}>Weight (kg)<input type="number" min="0" step="0.01" value={monitoringForm.weight || ''} onChange={event => updateField('weight', event.target.value)} placeholder="e.g. 12.4" style={inputStyle} /></label>
                            {radioGroup('hydration', 'Hydration assessment', ['Normal', 'Mildly dehydrated', 'Moderately dehydrated', 'Severely dehydrated', 'Not assessed'])}
                            {radioGroup('appetite', 'Appetite', ['Normal', 'Reduced', 'No appetite', 'Not assessed'])}
                            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>Clinical notes <span className="system-required-star">*</span><textarea required rows={3} maxLength={4500} value={monitoringForm.observation || ''} onChange={event => updateField('observation', event.target.value)} placeholder="Describe the pet's condition, observed symptoms, and changes since the previous assessment..." style={{ ...inputStyle, minHeight: 112, resize: 'vertical' }} /></label>
                            {radioGroup('followUpAction', 'Follow-up action', ['Continue routine monitoring', 'Reassessment required', 'Immediate veterinary review'])}
                            <p style={{ gridColumn: '1 / -1', margin: 0, color: '#64748b', fontSize: '.85rem', lineHeight: 1.5 }}>The attending veterinarian should assess findings and determine the appropriate action. Leave a measurement blank if it was not taken.</p>
                            {monitoringError && <div role="alert" style={{ gridColumn: '1 / -1', padding: '9px 10px', border: '1px solid #fecaca', borderRadius: 7, background: '#fff7f7', color: '#b42318', fontSize: '.76rem' }}>{monitoringError}</div>}
                            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 9, paddingTop: 10, borderTop: '1px solid #e5eeea' }}>
                              <button type="button" disabled={savingMonitoring} onClick={() => setMonitoringFormOpen(false)} style={{ ...modalStyles.cancel, minHeight: 48, padding: '11px 16px', fontSize: '.95rem' }}>Cancel</button>
                              <button type="submit" disabled={savingMonitoring} style={{ ...T.primaryBtn, minHeight: 48, padding: '11px 16px', fontSize: '.95rem' }}>{savingMonitoring ? 'Saving…' : 'Save observation'}</button>
                            </div>
                          </div>;
                        })()}
                      </form>
                    </div>, document.body)}
                    <div className="clinical-monitoring-readings" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
                      {observationFields.map(([key, label]) => <div key={key} style={{ minWidth: 0, padding: '12px 13px', borderRadius: 9, background: '#f8faf9', border: '1px solid #edf2ef' }}>
                        <span style={{ color: '#64748b', fontSize: '.76rem' }}>{label}</span>
                        <strong style={{ display: 'block', marginTop: 5, color: '#111827', fontSize: '.98rem', fontWeight: 600 }}>{monitoring[key] || 'Not recorded'}</strong>
                        <small style={{ display: 'block', marginTop: 3, color: '#64748b', fontSize: '.7rem' }}>{formatMonitoringDate(lastUpdated)}</small>
                      </div>)}
                    </div>
                    <div style={{ marginTop: 11, padding: '12px 13px', border: '1px solid #dce3df', borderRadius: 9, background: '#fbfcfb' }}>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#1f2937', fontSize: '.82rem' }}>Latest clinical observation</strong>
                      <p style={{ margin: '6px 0 0', color: '#1f2937', fontSize: '.8rem', lineHeight: 1.5 }}>{latestText || 'No clinical observation has been recorded yet.'}</p>
                      <small style={{ display: 'block', marginTop: 4, color: '#64748b', fontSize: '.69rem' }}>{latestObservation?.author || (selectedPlan.isMock ? 'Illustrative sample data only' : 'Clinical record')}</small>
                    </div>
                    <details style={{ marginTop: 10 }}>
                      <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '.76rem', cursor: 'pointer', listStylePosition: 'inside' }}>View previous observations <span aria-hidden="true">›</span></summary>
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        {observations.length > 1 ? observations.slice(1).map((observation, index) => <article key={`${observation.date}-${index}`} style={{ padding: '10px 12px', border: '1px solid #e5eeea', borderRadius: 8, background: '#fbfcfb' }}>
                          <strong style={{ color: '#334155', fontSize: '.74rem' }}>{formatMonitoringDate(observation.date)} · {observation.author || 'Clinic staff'}</strong>
                          <p style={{ margin: '5px 0 0', color: '#475569', fontSize: '.76rem', lineHeight: 1.45 }}>{observation.text || 'Measurements recorded.'}</p>
                          <small style={{ display: 'block', marginTop: 5, color: '#64748b', fontSize: '.7rem' }}>{observation.temperature && `Temperature ${observation.temperature} °C`} {observation.weight && ` · Weight ${observation.weight} kg`} {observation.hydration && ` · Hydration ${observation.hydration}`} {observation.appetite && ` · Appetite ${observation.appetite}`} {observation.followUpAction && ` · Follow-up ${observation.followUpAction}`}</small>
                        </article>) : <p style={{ margin: 0, color: '#64748b', fontSize: '.76rem' }}>No previous observations recorded.</p>}
                      </div>
                    </details>
                  </>;
                })()}
              </section>
              <section style={{ border: '1px solid #dcece5', borderRadius: 13, padding: '20px 21px', background: '#fff' }}>
                <h3 style={{ margin: 0, color: '#1f2937', fontSize: '1.02rem' }}>Follow-up schedule</h3>
                <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>{[
                  [selectedPlan.nextActionDue || selectedPlan.followUp, nextPlanStep?.title || 'Progress check', nextPlanStep?.overdue ? 'Overdue' : 'Due Soon'],
                  ...(selectedPlan.followUp && selectedPlan.followUp !== primaryPlanFollowUpDate
                    ? [[selectedPlan.followUp, 'Follow-up review', 'Booked']]
                    : []),
                ].map(([date, label, status], index) => <div key={`${label}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderTop: '1px solid #e8efec', color: '#334155', fontSize: '.78rem' }}><span>{date || 'No date set'} · {label}</span><StatusIndicator status={status} style={{ fontSize: '.74rem' }} /></div>)}</div>
              </section>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 24, paddingTop: 17, borderTop: '1px solid #e2e8f0' }}>{!selectedPlan.isMock && <button type="button" className="full-plan-action-button" onClick={openEditPlan}>Edit Plan</button>}<button type="button" onClick={() => notifySuccess('Treatment plan printed', `${selectedPlan.title} is ready to print.`)} style={{ ...modalStyles.cancel, padding: '10px 14px', fontSize: '.76rem' }}>Print Plan</button></div>
          {!selectedPlan.isMock && selectedPlan.status !== 'completed' && selectedPlan.completedSteps >= selectedPlan.totalSteps && <>
            <div role="status" style={{ marginTop: 12, padding: '10px 12px', border: `1px solid ${planClosureBlocked ? '#ead9a7' : '#d5e9df'}`, borderRadius: 8, background: planClosureBlocked ? '#fffaf0' : '#f2faf6', color: planClosureBlocked ? '#755b16' : '#315b49', fontSize: '.74rem' }}>
              {planReassessmentRequired
                ? 'All treatment steps are done, but a clinical reassessment is required before closing this plan.'
                : planFollowUpPending
                  ? 'All treatment steps are done. Follow-up is still pending, so the plan remains open.'
                  : planMedicationPending
                    ? 'All treatment steps are done. Active medication remains, so the plan remains open.'
                    : 'Treatment steps are complete. You can now formally close the treatment plan.'}
            </div>
            <button type="button" disabled={savingPlanProgress || planClosureBlocked} onClick={completeTreatmentPlan} style={{ width: '100%', marginTop: 10, border: 0, borderRadius: 8, background: '#005447', color: '#fff', padding: '12px 14px', fontSize: '.8rem', fontWeight: 700, cursor: savingPlanProgress || planClosureBlocked ? 'not-allowed' : 'pointer', opacity: savingPlanProgress || planClosureBlocked ? .55 : 1 }}>{savingPlanProgress ? 'Completing…' : 'Complete Treatment Plan'}</button>
          </>}
        </div>
      </div>, document.body)}
    </div>
  );
}

function BillingTab({ user, initialInvoiceId = null }) {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(initialInvoiceId);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!user?.token) return;
    const controller = new AbortController();
    const loadBilling = async () => {
      setLoading(true);
      setError('');
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
        const query = user.clinic_id ? `?clinic_id=${encodeURIComponent(user.clinic_id)}` : '';
        const headers = { Authorization: `Bearer ${user.token}` };
        const [invoiceResponse, paymentResponse] = await Promise.all([
          fetch(`${apiUrl}/clinic-records/invoices${query}`, { headers, signal: controller.signal }),
          fetch(`${apiUrl}/clinic-records/payments${query}`, { headers, signal: controller.signal }),
        ]);
        const [invoicePayload, paymentPayload] = await Promise.all([
          invoiceResponse.json(),
          paymentResponse.json(),
        ]);
        if (!invoiceResponse.ok || !paymentResponse.ok) {
          throw new Error(invoicePayload.error || paymentPayload.error || 'Unable to load billing records.');
        }
        if (!Array.isArray(invoicePayload) || !Array.isArray(paymentPayload)) {
          throw new Error('Billing records were returned in an unexpected format.');
        }
        setInvoices(invoicePayload);
        setPayments(paymentPayload);
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          console.error(loadError);
          setError(loadError.message || 'Unable to load billing records.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadBilling();
    return () => controller.abort();
  }, [user?.token, user?.clinic_id]);

  const paymentsByInvoice = new Map();
  payments.forEach(payment => {
    const invoiceId = String(payment.invoice_id);
    paymentsByInvoice.set(invoiceId, (paymentsByInvoice.get(invoiceId) || 0) + Number(payment.amount || 0));
  });
  const getBillingStatus = invoice => {
    const paid = paymentsByInvoice.get(String(invoice.id)) || 0;
    const total = Number(invoice.total || 0);
    if (String(invoice.status).toLowerCase() === 'paid' || (total > 0 && paid >= total)) return 'Completed';
    if (paid > 0) return 'Half Paid';
    if (String(invoice.status).toLowerCase() === 'overdue') return 'Due';
    return 'Unpaid';
  };
  const filterCounts = ['All', 'Unpaid', 'Due', 'Half Paid', 'Completed'].reduce((counts, label) => {
    counts[label] = invoices.filter(invoice => label === 'All'
      ? String(invoice.status).toLowerCase() !== 'void'
      : getBillingStatus(invoice) === label).length;
    return counts;
  }, {});
  const visibleInvoices = invoices.filter(invoice => {
    const status = String(invoice.status || '').toLowerCase();
    if (status === 'void') return false;
    if (statusFilter !== 'All' && getBillingStatus(invoice) !== statusFilter) return false;
    const query = search.trim().toLowerCase();
    if (query && ![invoice.id, invoice.pet, invoice.owner].some(value => String(value || '').toLowerCase().includes(query))) return false;
    const issuedDate = invoice.issued_at ? new Date(invoice.issued_at).toISOString().slice(0, 10) : '';
    if (startDate && (!issuedDate || issuedDate < startDate)) return false;
    if (endDate && (!issuedDate || issuedDate > endDate)) return false;
    return true;
  });
  const awaitingInvoices = invoices.filter(invoice => {
    const paid = paymentsByInvoice.get(String(invoice.id)) || 0;
    return String(invoice.status || '').toLowerCase() !== 'void'
      && Number(invoice.total || 0) > paid;
  }).filter(invoice => {
    const query = search.trim().toLowerCase();
    return !query || [invoice.id, invoice.pet, invoice.owner]
      .some(value => String(value || '').toLowerCase().includes(query));
  });
  const selectedInvoice = invoices.find(invoice => String(invoice.id) === String(selectedInvoiceId));
  const selectedConsultationNotes = selectedInvoice?.consultation_notes
    && typeof selectedInvoice.consultation_notes === 'object'
    ? selectedInvoice.consultation_notes : {};
  const consultationSummaryRows = [
    ['Complaint', selectedConsultationNotes.chiefComplaint],
    ['Diagnosis', selectedConsultationNotes.diagnosis],
    ['Findings', selectedConsultationNotes.clinicalFindings],
    ['Treatment', selectedConsultationNotes.treatment],
    ['Medication', selectedConsultationNotes.medications],
    ['Vaccines', selectedConsultationNotes.vaccinations],
    ['Lab tests', selectedConsultationNotes.labTests],
    ['Follow-up', selectedConsultationNotes.followUpInstructions],
  ].filter(([, value]) => String(value || '').trim());
  const fieldStyle = {
    minWidth: 0, height: 40, boxSizing: 'border-box', padding: '0 8px',
    border: 0, borderRadius: 7, background: 'transparent',
    color: '#25384a', font: 'inherit', fontSize: '.76rem', outlineColor: '#005447',
  };
  const currency = value => `₱${Number(value || 0).toFixed(2)}`;
  const invoiceDate = value => value ? formatDateText(value, undefined, '—') : '—';

  return (
    <section style={{ color: '#203444' }}>
      <header style={{ margin: '0 0 18px', padding: '0 2px' }}>
        <h1 style={{ margin: 0, color: '#203444', fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-.02em' }}>Billing</h1>
        <p style={{ margin: '4px 0 0', color: '#718198', fontSize: '.8rem' }}>View and manage patient bills, track payments, and monitor outstanding balances.</p>
      </header>
      <div style={{ padding: 16, border: '1px solid #e0e7ee', borderRadius: 10, background: '#fff' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative', width: '100%', marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, height: 42, padding: '0 12px', border: `1px solid ${showPatientResults ? '#3b82f6' : '#d8e9e1'}`, borderRadius: 9, background: '#fff', color: '#668078', boxShadow: showPatientResults ? '0 0 0 2px #dbeafe' : 'none' }}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
              <input
                aria-label="Search or select a patient who needs to pay"
                aria-expanded={showPatientResults}
                aria-controls="billing-awaiting-patients"
                type="search"
                value={search}
                onFocus={() => setShowPatientResults(true)}
                onBlur={() => setTimeout(() => setShowPatientResults(false), 120)}
                onChange={event => {
                  setSearch(event.target.value);
                  setSelectedInvoiceId(null);
                  setShowPatientResults(true);
                }}
                placeholder="Search or select a patient who needs to pay..."
                style={{ width: '100%', minWidth: 0, border: 0, outline: 0, color: '#2c4050', font: 'inherit', fontSize: '.76rem' }}
              />
            </label>
            {showPatientResults && !loading && !error && <div id="billing-awaiting-patients" role="listbox" aria-label="Patients awaiting billing" style={{ position: 'absolute', zIndex: 5, top: 'calc(100% + 4px)', left: 0, right: 0, maxHeight: 280, overflowY: 'auto', border: '1px solid #dce4eb', borderRadius: 10, background: '#fff', boxShadow: '0 8px 20px rgba(26, 42, 58, .12)' }}>
              <div style={{ padding: '10px 12px 5px', color: '#8293a7', fontSize: '.63rem', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>Awaiting billing</div>
              {awaitingInvoices.length ? awaitingInvoices.map(invoice => {
                const balance = Math.max(0, Number(invoice.total || 0) - (paymentsByInvoice.get(String(invoice.id)) || 0));
                return <button
                  key={invoice.id}
                  type="button"
                  role="option"
                  aria-selected={String(selectedInvoiceId) === String(invoice.id)}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => {
                    setSelectedInvoiceId(invoice.id);
                    setShowPatientResults(false);
                  }}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', border: 0, borderTop: '1px solid #f0f3f6', background: String(selectedInvoiceId) === String(invoice.id) ? '#f0f8f5' : '#fff', color: '#203444', textAlign: 'left', cursor: 'pointer' }}
                >
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', overflow: 'hidden', fontSize: '.8rem', fontWeight: 600, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invoice.pet || 'Patient'}</strong>
                    <span style={{ display: 'block', marginTop: 2, overflow: 'hidden', color: '#718198', fontSize: '.7rem', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invoice.owner || 'Owner not listed'} · {invoice.consultation_id ? '1 visit' : `Invoice #${invoice.id}`}</span>
                  </span>
                  <strong style={{ flexShrink: 0, color: '#40546a', fontSize: '.78rem' }}>{currency(balance)}</strong>
                </button>;
              }) : <div style={{ padding: '10px 12px 14px', color: '#718198', fontSize: '.76rem' }}>No patients are awaiting payment.</div>}
            </div>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <div role="group" aria-label="Filter invoices by payment status" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 }}>
              {['All', 'Unpaid', 'Due', 'Half Paid', 'Completed'].map(label => <button
                key={label}
                type="button"
                aria-pressed={statusFilter === label}
                onClick={() => setStatusFilter(label)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 12px',
                  border: `1px solid ${statusFilter === label ? '#9bcbbd' : '#d8e9e1'}`,
                  borderRadius: 999, background: statusFilter === label ? '#e7f5f2' : '#fff',
                  color: statusFilter === label ? '#005447' : '#38534c', font: 'inherit',
                  fontSize: '.76rem', fontWeight: statusFilter === label ? 700 : 500, cursor: 'pointer',
                }}
              >{label}<span style={{ display: 'grid', minWidth: 21, height: 21, padding: '0 5px', placeItems: 'center', borderRadius: 12, background: statusFilter === label ? '#c9e4db' : '#edf2f0', color: statusFilter === label ? '#005447' : '#526b64', fontSize: '.68rem', fontWeight: 700 }}>{filterCounts[label] || 0}</span></button>)}
            </div>
          <div role="group" aria-label="Filter invoices by date" style={{ display: 'flex', flex: '0 1 310px', minWidth: 260, alignItems: 'center', gap: 8 }}>
            <label style={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'center', gap: 7, height: 42, padding: '0 9px', border: '1px solid #d8e9e1', borderRadius: 9, background: '#fff', color: '#668078' }}>
              <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 10h17" /></svg>
              <input aria-label="Start date" type="date" value={startDate} max={endDate || undefined} onChange={event => setStartDate(event.target.value)} style={{ ...fieldStyle, width: '100%' }} />
            </label>
            <label style={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'center', gap: 7, height: 42, padding: '0 9px', border: '1px solid #d8e9e1', borderRadius: 9, background: '#fff', color: '#668078' }}>
              <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 10h17" /></svg>
              <input aria-label="End date" type="date" value={endDate} min={startDate || undefined} onChange={event => setEndDate(event.target.value)} style={{ ...fieldStyle, width: '100%' }} />
            </label>
          </div>
          </div>
        </div>

        {selectedInvoice && <section aria-label="Selected patient bill" style={{ marginBottom: 16, overflow: 'hidden', border: '1px solid #dce4eb', borderRadius: 9, background: '#fff' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderBottom: '1px solid #e8edf2' }}>
            <div>
              <h2 style={{ margin: 0, color: '#203c4c', fontSize: '1.05rem', fontWeight: 700 }}>{selectedInvoice.pet || 'Patient'}</h2>
              <div style={{ marginTop: 3, color: '#526579', fontSize: '.76rem' }}>Owner: {selectedInvoice.owner || '—'}</div>
            </div>
            <div style={{ color: '#526579', fontSize: '.74rem', textAlign: 'right' }}>
              <div>{invoiceDate(selectedInvoice.consultation_completed_at || selectedInvoice.issued_at)}</div>
              {selectedInvoice.doctor && <div style={{ marginTop: 3 }}>Dr. {selectedInvoice.doctor}</div>}
              <div style={{ marginTop: 3 }}>Invoice #{selectedInvoice.id}</div>
            </div>
          </div>
          <div style={{ padding: 14 }}>
            <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 6, background: '#f1f6f8', color: '#526d83', fontSize: '.69rem', fontWeight: 700, letterSpacing: '.03em' }}>CLINICAL FINDINGS</div>
            {consultationSummaryRows.length ? <div style={{ marginBottom: 14 }}>
              {consultationSummaryRows.map(([label, value]) => <div key={label} style={{ display: 'grid', gridTemplateColumns: 'minmax(95px, 17%) 1fr', gap: 12, padding: '8px 9px', borderBottom: '1px solid #e6edf2', color: '#40546a', fontSize: '.76rem' }}>
                <span style={{ color: '#7188a2' }}>{label}</span><span style={{ whiteSpace: 'pre-wrap' }}>{value}</span>
              </div>)}
            </div> : <p style={{ margin: '8px 2px 14px', color: '#718198', fontSize: '.76rem' }}>No consultation notes were saved for this bill.</p>}
            <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 6, background: '#f1f6f8', color: '#526d83', fontSize: '.69rem', fontWeight: 700, letterSpacing: '.03em' }}>SERVICES, TESTS, MEDICINES & VACCINES</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 440, borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead><tr>{['Description', 'Type', 'Qty / Rate', 'Amount'].map(label => <th key={label} style={{ padding: '8px 9px', background: '#f8fafc', color: '#607184', fontSize: '.68rem', fontWeight: 700 }}>{label}</th>)}</tr></thead>
                <tbody>{(selectedInvoice.items || []).map(item => <tr key={item.id}>
                  <td style={billingStyles.cell}>{item.description || 'Service'}</td>
                  <td style={billingStyles.cell}>{({ consultation: 'Service', treatment: 'Treatment', medication: 'Medication', vaccination: 'Vaccine', lab_test: 'Test', inpatient: 'Inpatient' })[item.item_type] || 'Service'}</td>
                  <td style={billingStyles.cell}>{item.quantity} × {currency(item.unit_price)}</td>
                  <td style={{ ...billingStyles.cell, textAlign: 'right' }}>{currency(item.line_total)}</td>
                </tr>)}</tbody>
                <tfoot><tr>
                  <th colSpan="3" style={{ padding: '11px 9px', background: '#f1f6f8', color: '#203c4c', fontSize: '.82rem', textAlign: 'left' }}>Total</th>
                  <th style={{ padding: '11px 9px', background: '#f1f6f8', color: '#203c4c', fontSize: '.82rem', textAlign: 'right' }}>{currency(selectedInvoice.total)}</th>
                </tr></tfoot>
              </table>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 9, color: '#526579', fontSize: '.74rem' }}>
              <span>Paid: {currency(paymentsByInvoice.get(String(selectedInvoice.id)) || 0)}</span>
              <strong style={{ color: '#203c4c' }}>Balance due: {currency(Math.max(0, Number(selectedInvoice.total || 0) - (paymentsByInvoice.get(String(selectedInvoice.id)) || 0)))}</strong>
            </div>
          </div>
        </section>}

        {loading ? <div role="status" style={{ display: 'grid', minHeight: 280, placeItems: 'center', border: '1px dashed #dce4eb', borderRadius: 8, color: '#728198', fontSize: '.84rem' }}>Loading billing records…</div>
          : error ? <div role="alert" style={{ display: 'grid', minHeight: 220, placeItems: 'center', border: '1px solid #fecaca', borderRadius: 8, background: '#fffafa', color: '#b42318', fontSize: '.84rem' }}>{error}</div>
            : visibleInvoices.length === 0 ? <div style={{ display: 'flex', minHeight: 286, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, border: '1px dashed #dce4eb', borderRadius: 8, textAlign: 'center' }}>
              <svg aria-hidden="true" width="54" height="60" viewBox="0 0 54 60" fill="none"><path d="M12 3h22l12 12v34a5 5 0 0 1-5 5H12a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Z" stroke="#93a1b2" strokeWidth="2.5" /><path d="M34 4v12h12M16 26h19M16 34h16" stroke="#b6c1cd" strokeWidth="2.5" strokeLinecap="round" /><circle cx="42" cy="45" r="9" fill="#8795a6" /><path d="M38 45h8" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
              <strong style={{ color: '#263d4d', fontSize: '1rem', fontWeight: 600 }}>No billing records found</strong>
              <span style={{ color: '#718198', fontSize: '.78rem' }}>Try adjusting your search, date range, or filters.</span>
            </div> : <div style={{ overflowX: 'auto', border: '1px solid #e4eaf0', borderRadius: 8 }}>
              <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead><tr>{['Invoice', 'Patient', 'Owner', 'Date', 'Items', 'Amount', 'Paid', 'Balance', 'Status'].map(label => <th key={label} style={{ padding: '12px 14px', borderBottom: '1px solid #e5ebf1', background: '#f8fafc', color: '#607184', fontSize: '.69rem', fontWeight: 700 }}>{label}</th>)}</tr></thead>
                <tbody>{visibleInvoices.map(invoice => {
                  const paid = paymentsByInvoice.get(String(invoice.id)) || 0;
                  const balance = Math.max(0, Number(invoice.total || 0) - paid);
                  const status = getBillingStatus(invoice);
                  return <tr key={invoice.id}>
                    <td style={billingStyles.cell}>#{invoice.id}</td>
                    <td style={billingStyles.cell}>{invoice.pet || '—'}</td>
                    <td style={billingStyles.cell}>{invoice.owner || '—'}</td>
                    <td style={billingStyles.cell}>{invoiceDate(invoice.issued_at)}</td>
                    <td style={billingStyles.cell}>
                      <details><summary style={{ color: '#087f65', cursor: 'pointer' }}>{invoice.items?.length || 0} item{invoice.items?.length === 1 ? '' : 's'}</summary>
                        <div style={{ minWidth: 200, padding: '6px 0', color: '#526579', fontSize: '.72rem' }}>{(invoice.items || []).map(item => <div key={item.id}>{item.description} × {item.quantity} · {currency(item.line_total)}</div>)}</div>
                      </details>
                    </td>
                    <td style={billingStyles.cell}>{currency(invoice.total)}</td>
                    <td style={billingStyles.cell}>{currency(paid)}</td>
                    <td style={billingStyles.cell}>{currency(balance)}</td>
                    <td style={billingStyles.cell}><span style={{ padding: '4px 9px', borderRadius: 15, background: status === 'Completed' ? '#e6f5ee' : '#fff5dc', color: status === 'Completed' ? '#16744b' : '#896414', fontSize: '.7rem', fontWeight: 700 }}>{status}</span></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>}
      </div>
    </section>
  );
}

const billingStyles = {
  cell: { padding: '13px 14px', borderBottom: '1px solid #edf1f5', color: '#304456', fontSize: '.77rem', verticalAlign: 'top' },
};

function InventoryTab() {
  const [category, setCategory] = useState('All Items');
  const [requested, setRequested] = useState([]);
  const [restockItem, setRestockItem] = useState(null);
  const [restockQuantity, setRestockQuantity] = useState('');
  const [restockNote, setRestockNote] = useState('');
  const categories = ['All Items', 'Medication', 'Vaccine', 'Supply'];
  const filtered = category === 'All Items' ? CLINIC_INVENTORY : CLINIC_INVENTORY.filter(item => item.category === category);
  const requestRestock = (item, quantity, note) => {
    setRequested(items => items.includes(item.name) ? items : [...items, item.name]);
    notifySuccess(
      'Restock request submitted',
      `${quantity} ${item.unit} requested for ${item.name}.${note ? ` Note: ${note}` : ''}`,
    );
  };
  const getInventoryStatus = item => {
    if (item.expiry !== 'N/A') {
      const expiryDate = new Date(`${item.expiry}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!Number.isNaN(expiryDate.getTime()) && expiryDate < today) return 'Expired';
      if (!Number.isNaN(expiryDate.getTime()) && (expiryDate.getTime() - today.getTime()) / 86400000 <= 30) return 'Expiring Soon';
    }
    if (item.quantity === 0) return 'Out of Stock';
    return item.status;
  };
  const statusTone = status => ({
    'Healthy Stock': { color: '#005447', dot: '#10b981' },
    'Low Stock': { color: '#a34b00', dot: '#f59e0b' },
    'Critical Stock': { color: '#a34b00', dot: '#f59e0b' },
    'Reorder Soon': { color: '#a34b00', dot: '#f59e0b' },
    'Out of Stock': { color: '#b42318', dot: '#ef4444' },
    'Expired': { color: '#b42318', dot: '#ef4444' },
    'Expiring Soon': { color: '#a34b00', dot: '#f59e0b' },
  }[status] || { color: '#374151', dot: '#94a3b8' });
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '11px 13px', marginBottom: 14, color: '#b45309' }}>
        <span style={{ width: 16, height: 16, display: 'flex', flexShrink: 0 }}>{Icons.trendDown || Icons.refresh}</span>
        <div><div style={{ fontSize: '.76rem', fontWeight: 600 }}>View-Only Access</div><div style={{ marginTop: 4, fontSize: '.72rem' }}>As a doctor you can view stock status and submit restock requests. All stock adjustments are managed by the owner.</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          ['Total Items', CLINIC_INVENTORY.length, '#005447'],
          ['In Stock', CLINIC_INVENTORY.filter(item => item.status === 'Healthy Stock').length, '#16a34a'],
          ['Low / Critical', CLINIC_INVENTORY.filter(item => ['Low Stock', 'Critical Stock'].includes(item.status)).length, '#c2410c'],
          ['Out of Stock', CLINIC_INVENTORY.filter(item => item.status === 'Out of Stock').length, '#dc2626'],
        ].map(([label, value, color]) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 20px' }}>
            <div style={{ color: '#94a3b8', fontSize: '.68rem' }}>{label}</div>
            <div style={{ color, fontSize: '1.45rem', fontWeight: 700, marginTop: 3 }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {categories.map(item => <button key={item} type="button" onClick={() => setCategory(item)} style={{ border: 'none', borderRadius: 8, padding: '7px 12px', background: category === item ? '#005447' : '#eef2f7', color: category === item ? '#fff' : '#64748b', fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>{item}</button>)}
      </div>
      <div style={inventoryTable.wrap}>
      <table style={inventoryTable.table}>
        <thead><tr>{[['Item Name', '25%'], ['Category', '14%'], ['Current Stock', '14%'], ['Expiry', '12%'], ['Status', '16%'], ['Action', '19%']].map(([label, width]) => <th key={label} style={{ ...inventoryTable.heading, width }}>{label}</th>)}</tr></thead>
        <tbody>{filtered.map(item => {
          const status = getInventoryStatus(item);
          const tone = statusTone(status);
          const needsRestock = ['Low Stock', 'Critical Stock', 'Out of Stock', 'Expired', 'Reorder Soon'].includes(status);
          const stockColor = status === 'Expired' || status === 'Out of Stock' ? '#dc2626' : ['Low Stock', 'Critical Stock', 'Reorder Soon'].includes(status) ? '#b45309' : '#111827';
          return <tr key={item.name} style={{ background: ['Expired', 'Out of Stock'].includes(status) ? '#fff0ee' : '#fff' }}>
            <td style={{ ...inventoryTable.cell, fontWeight: 700 }}>{item.name}</td>
            <td style={inventoryTable.cell}><span style={inventoryTable.category}>{item.category}</span></td>
            <td style={{ ...inventoryTable.cell, color: stockColor, fontWeight: 700 }}>{item.stock}</td>
            <td style={inventoryTable.cell}>{item.expiry}</td>
            <td style={inventoryTable.cell}><span style={{ ...inventoryTable.status, color: tone.color }}>{status === 'Expired' ? <i style={inventoryTable.expiredMark}>×</i> : <i style={{ ...inventoryTable.statusDot, background: tone.dot }} />}{status}</span></td>
            <td style={inventoryTable.cell}>{needsRestock
              ? <button type="button" disabled={requested.includes(item.name)} onClick={() => { setRestockItem(item); setRestockQuantity(''); setRestockNote(''); }} style={{ ...inventoryTable.restockButton, ...(requested.includes(item.name) ? inventoryTable.restockSubmitted : {}) }}><span style={inventoryTable.restockIcon}>{Icons.refresh}</span>{requested.includes(item.name) ? 'Request Submitted' : 'Request Restock'}</button>
              : <span style={inventoryTable.emptyAction}>—</span>}</td>
          </tr>;
        })}</tbody>
      </table>
      </div>
      {restockItem && <div style={inventoryTable.backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setRestockItem(null); }}>
        <form style={inventoryTable.dialog} role="dialog" aria-modal="true" aria-labelledby="restock-dialog-title" onSubmit={event => {
          event.preventDefault();
          requestRestock(restockItem, restockQuantity, restockNote.trim());
          setRestockItem(null);
          setRestockQuantity('');
          setRestockNote('');
        }}>
          <div style={inventoryTable.dialogHeader}>
            <h2 id="restock-dialog-title" style={inventoryTable.dialogTitle}>Request Restock</h2>
            <p style={inventoryTable.dialogSubtitle}>{restockItem.name} · currently {restockItem.stock}</p>
          </div>
          <div style={inventoryTable.dialogBody}>
            <label style={inventoryTable.dialogLabel}>Quantity needed<input autoFocus required type="number" min="1" step="1" value={restockQuantity} onChange={event => setRestockQuantity(event.target.value)} placeholder="e.g. 100" style={inventoryTable.dialogInput} /></label>
            <label style={inventoryTable.dialogLabel}>Note for the owner (optional)<textarea value={restockNote} onChange={event => setRestockNote(event.target.value)} placeholder="Any urgency or supplier preference..." rows={3} style={inventoryTable.dialogTextarea} /></label>
          </div>
          <div style={inventoryTable.dialogFooter}>
            <button type="button" onClick={() => setRestockItem(null)} style={inventoryTable.dialogCancel}>Cancel</button>
            <button type="submit" style={inventoryTable.dialogSubmit}>Send Restock Request</button>
          </div>
        </form>
      </div>}
    </div>
  );
}

const inventoryTable = {
  wrap: { width: '100%', overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff' },
  table: { width: '100%', minWidth: 760, borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '.78rem', color: '#111827' },
  heading: { height: 40, padding: '0 16px', borderBottom: '1px solid #e5e7eb', background: '#fbfbfc', color: '#64748b', fontSize: '.7rem', fontWeight: 500, textAlign: 'left' },
  cell: { height: 53, padding: '0 16px', borderBottom: '1px solid #e5e7eb', color: '#111827', fontSize: '.76rem', textAlign: 'left', whiteSpace: 'nowrap' },
  category: { display: 'inline-flex', alignItems: 'center', minHeight: 27, padding: '0 10px', border: '1px solid #e2e8f0', borderRadius: 7, color: '#334155', fontSize: '.7rem' },
  status: { display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: '.75rem' },
  statusDot: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', fontStyle: 'normal' },
  expiredMark: { color: '#dc2626', fontSize: '.9rem', fontStyle: 'normal', fontWeight: 700, lineHeight: 1 },
  restockButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 40, padding: '0 13px', border: '1px solid #e2e8f0', borderRadius: 9, background: '#fff', color: '#111827', fontSize: '.7rem', fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer' },
  restockSubmitted: { borderColor: '#b7e4d7', background: '#e7f5f2', color: '#005447' },
  restockIcon: { display: 'inline-flex', width: 14, height: 14 },
  emptyAction: { color: '#94a3b8' },
  backdrop: { position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,23,42,.45)' },
  dialog: { width: 'min(396px, 100%)', boxSizing: 'border-box', overflow: 'hidden', borderRadius: 14, background: '#fff', boxShadow: '0 18px 50px rgba(15,23,42,.25)' },
  dialogHeader: { padding: '20px 20px 0' },
  dialogTitle: { margin: 0, color: '#111827', fontSize: '1rem', fontWeight: 700 },
  dialogSubtitle: { margin: '5px 0 0', color: '#64748b', fontSize: '.75rem' },
  dialogBody: { display: 'grid', gap: 14, padding: '16px 20px 18px' },
  dialogLabel: { display: 'grid', gap: 7, color: '#111827', fontSize: '.75rem', fontWeight: 600 },
  dialogInput: { width: '100%', height: 44, boxSizing: 'border-box', border: 0, borderRadius: 9, padding: '0 13px', background: '#f1f1f3', color: '#111827', font: 'inherit', fontSize: '.75rem', outlineColor: '#005447' },
  dialogTextarea: { width: '100%', minHeight: 72, boxSizing: 'border-box', resize: 'vertical', border: 0, borderRadius: 9, padding: '12px 13px', background: '#f1f1f3', color: '#111827', font: 'inherit', fontSize: '.75rem', outlineColor: '#005447' },
  dialogFooter: { display: 'grid', gap: 9, padding: '15px 20px 14px', borderTop: '1px solid #e5e7eb' },
  dialogCancel: { minHeight: 45, border: '1px solid #e2e8f0', borderRadius: 9, background: '#fff', color: '#111827', font: 'inherit', fontSize: '.75rem', cursor: 'pointer' },
  dialogSubmit: { minHeight: 45, border: 0, borderRadius: 9, background: '#111318', color: '#fff', font: 'inherit', fontSize: '.75rem', fontWeight: 600, cursor: 'pointer' },
};

const consultationStyles = {
  label: { display: 'flex', flexDirection: 'column', gap: 5, color: '#374151', fontSize: '.72rem', fontWeight: 600, marginBottom: 13 },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderRadius: 7, background: '#f1f1f3', padding: '8px 10px', color: '#374151', fontSize: '.74rem', outline: 'none' },
  choice: { minHeight: 34, padding: '0 11px', border: '1px solid #d8e9e1', borderRadius: 8, background: '#fff', color: '#38534c', fontSize: '.7rem', cursor: 'pointer' },
  choiceSelected: { borderColor: '#005447', background: '#e7f5f2', color: '#005447' },
  addMedicineButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 46, marginBottom: 14, border: '1px dashed #9ddbc8', borderRadius: 9, background: '#e7f5f2', color: '#005447', fontFamily: 'inherit', fontSize: '.74rem', cursor: 'pointer' },
  medicineCard: { marginBottom: 16, padding: 12, border: '1px solid #dcece5', borderRadius: 11, background: '#fff' },
  medicineGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(65px, .7fr) minmax(72px, .7fr) 34px', gap: 8, alignItems: 'end' },
  medicineLabel: { display: 'flex', minWidth: 0, flexDirection: 'column', gap: 5, color: '#374151', fontSize: '.7rem', fontWeight: 600 },
  removeMedicineButton: { display: 'grid', width: 32, height: 32, placeItems: 'center', marginBottom: 2, border: '1px solid #fecaca', borderRadius: 8, background: '#fff7f7', color: '#b42318', cursor: 'pointer' },
  removeMedicineIcon: { display: 'flex', width: 15, height: 15 },
  doseCalculation: { display: 'grid', gridTemplateColumns: 'minmax(120px, .8fr) minmax(0, 1.2fr)', gap: 9, alignItems: 'end', marginTop: 10 },
  doseRateLabel: { display: 'flex', minWidth: 0, flexDirection: 'column', gap: 5, color: '#526663', fontSize: '.66rem', fontWeight: 600 },
  doseRateInput: { width: '100%', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', padding: '7px 9px', color: '#374151', fontSize: '.72rem', outline: 'none' },
  calculatedDose: { padding: '8px 10px', borderRadius: 8, background: '#e7f5f2', color: '#005447', fontSize: '.68rem', lineHeight: 1.4 },
  summaryRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderBottom: '1px solid #e2ebe7' },
  summaryLabel: { color: '#111827', fontSize: '.7rem' },
  summaryValue: { color: '#111827', fontSize: '.72rem', minHeight: 15, textAlign: 'right' },
  summarySection: { padding: '12px 0 4px', borderBottom: '1px solid #e2ebe7' },
  summarySectionTitle: { marginBottom: 4, color: '#111827', fontSize: '.7rem', fontWeight: 700 },
  summaryEmpty: { padding: '8px 0', color: '#111827', fontSize: '.7rem' },
  summaryTotal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 13 },
  summaryTotalLabel: { display: 'block', color: '#111827', fontSize: '.72rem' },
  summaryTotalNote: { display: 'block', marginTop: 3, color: '#111827', fontSize: '.63rem' },
  summaryTotalAmount: { color: '#111827', fontSize: '1rem' },
};

// ── DASHBOARD TAB ──────────────────────────────────────────────────────
function ExportReportsModal({ user, reports, onClose }) {
  const [selected, setSelected] = useState(['owners', 'pets']);
  const [format, setFormat] = useState('csv');
  const toggleReport = report => setSelected(current => current.includes(report) ? current.filter(value => value !== report) : [...current, report]);
  const reportNames = Object.keys(reports);
  const allSelected = selected.length === reportNames.length;
  const exportReport = async () => {
    const rows = [['Report', 'ID', 'Name / Pet', 'Owner', 'Status', 'Date']];
    selected.forEach(report => {
      reports[report].forEach(item => rows.push([
        report,
        item.id || '—',
        item.name || item.pet || item.pet_name || item.type || item.diagnosis || '—',
        item.owner || item.owner_name || '—',
        item.status || '—',
        item.date || item.dateGiven || item.date_given || item.start_time || '—',
      ]));
    });
    if (format === 'csv') {
      const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }));
      link.download = 'clinic-report.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    } else {
      const pdf = new jsPDF({ orientation: 'landscape' });
      pdf.setFontSize(16);
      pdf.text('Clinic Report', 14, 16);
      pdf.setFontSize(8);
      rows.slice(1).forEach((row, index) => pdf.text(row.map(value => String(value)).join(' | ').slice(0, 150), 14, 26 + index * 6));
      pdf.save('clinic-report.pdf');
    }
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      await fetch(`${apiUrl}/audit-trail`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          action: 'report generated',
          table_name: 'clinic_reports',
          new_data: { clinic_id: user.clinic_id, reports: selected, format, record_count: rows.length - 1 },
        }),
      });
    } catch (error) {
      console.error('Unable to record report export in audit trail', error);
    }
    notifySuccess('Clinic report exported successfully!', `${selected.length} report types · ${format.toUpperCase()}`);
    onClose();
  };
  return <OwnerModal onClose={onClose} width={520}>
    <div style={{ color: '#374151' }}>
      <h2 style={modalStyles.title}>Export Clinic Reports</h2>
      <p style={modalStyles.subtitle}>Choose the records and file format for your clinic report.</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 18, color: '#374151', fontSize: '.72rem' }}>
        <button type="button" onClick={() => setSelected(allSelected ? [] : reportNames)} style={{ border: 0, background: 'none', color: '#374151', cursor: 'pointer', padding: 0 }}>{allSelected ? 'Deselect All' : 'Select All'}</button>
      </div>
      <div style={{ display: 'grid', gap: 8, margin: '8px 0 18px' }}>
        {reportNames.map(report => <label key={report} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, color: '#374151', fontSize: '.8rem', cursor: 'pointer' }}><input type="checkbox" checked={selected.includes(report)} onChange={() => toggleReport(report)} />{report[0].toUpperCase() + report.slice(1)} ({reports[report].length})</label>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label style={{ ...modalStyles.label, color: '#374151' }}>Start Date<LabDateTimePicker mode="date" style={{ ...modalStyles.input, color: '#374151' }} /></label>
        <label style={{ ...modalStyles.label, color: '#374151' }}>End Date<LabDateTimePicker mode="date" style={{ ...modalStyles.input, color: '#374151' }} /></label>
      </div>
      <label style={{ ...modalStyles.label, color: '#374151' }}>File format<select value={format} onChange={event => setFormat(event.target.value)} style={{ ...modalStyles.input, color: '#374151' }}><option value="csv">CSV</option><option value="pdf">PDF</option></select></label>
      <div style={modalStyles.footer}><button type="button" onClick={onClose} style={modalStyles.cancel}>Cancel</button><button type="button" onClick={exportReport} disabled={!selected.length} style={{ ...T.primaryBtn, opacity: selected.length ? 1 : .5 }}>Export Report</button></div>
    </div>
  </OwnerModal>;
}

const dashboardStyles = {
  dashboardLink: { border: 0, background: 'transparent', color: '#111827', fontSize: '.76rem', fontWeight: 600, cursor: 'pointer' },
  dashboardTableHeader: { display: 'grid', gridTemplateColumns: '70px 1.1fr 1fr 80px', gap: 9, padding: '8px 0', color: '#668096', fontSize: '.65rem', borderBottom: '1px solid #edf2f5' },
  dashboardTableRow: { display: 'grid', gridTemplateColumns: '70px 1.1fr 1fr 80px', gap: 9, alignItems: 'center', padding: '11px 0', color: '#668096', fontSize: '.7rem', borderBottom: '1px solid #f0f4f6' },
  dashboardMuted: { display: 'block', marginTop: 3, color: '#111827', fontSize: '.72rem' },
  dashboardCount: { marginLeft: 5, padding: '3px 6px', borderRadius: 9, background: '#ef4444', color: '#fff', fontSize: '.65rem' },
  alertRow: { display: 'grid', gridTemplateColumns: '22px 40px minmax(0, 1fr) 62px 76px', gap: 9, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #e7edf1', color: '#111827', fontSize: '.8rem' },
  alertDot: { width: 19, height: 19, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontWeight: 700 },
  alertAvatar: { width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', background: '#e8f3f0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#005447', fontWeight: 700 },
  alertSpecies: { color: '#111827', fontWeight: 500, fontSize: '.68rem' },
  alertTag: { display: 'inline-block', marginLeft: 7, padding: '3px 7px', borderRadius: 10, background: '#fff1f2', color: '#111827', fontSize: '.58rem', fontWeight: 600, verticalAlign: 'middle' },
  alertDetail: { display: 'block', marginTop: 3, color: '#111827', fontSize: '.64rem', lineHeight: 1.25 },
  alertViewButton: { justifySelf: 'end', padding: '6px 10px', border: '1px solid #79b8aa', borderRadius: 6, color: '#005447', background: '#fff', fontSize: '.64rem', fontWeight: 600, whiteSpace: 'nowrap' },
  upcomingRow: { display: 'grid', gridTemplateColumns: '48px minmax(0, 1.15fr) minmax(0, 78px) minmax(0, .85fr) 64px', gap: 7, alignItems: 'center', minHeight: 48, padding: '6px 0', borderBottom: '1px solid #edf2f5', color: '#111827', fontSize: '.68rem' },
  appointmentAvatar: { width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', background: '#e8f3f0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#005447', fontWeight: 700, flexShrink: 0 },
  appointmentPatient: { display: 'flex', minWidth: 0, alignItems: 'center', gap: 7 },
  appointmentPatientText: { display: 'grid', minWidth: 0, gap: 2, lineHeight: 1.15 },
  appointmentOwner: { color: '#111827', fontSize: '.62rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  appointmentType: { justifySelf: 'start', maxWidth: 78, overflow: 'hidden', textOverflow: 'ellipsis', padding: '4px 8px', borderRadius: 12, background: '#e5f5f1', color: '#111827', fontSize: '.6rem', whiteSpace: 'nowrap' },
  appointmentDoctor: { color: '#111827', fontSize: '.62rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  appointmentStatus: { display: 'inline-flex', alignItems: 'center', justifySelf: 'end', gap: 5, color: '#111827', fontSize: '.62rem', whiteSpace: 'nowrap' },
  healthDonut: { width: 112, height: 112, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'conic-gradient(#ef5350 0deg 120deg, #f59e0b 120deg 210deg, #eab308 210deg 285deg, #005447 285deg 360deg)', boxShadow: '0 4px 10px rgba(23,59,84,.12)', flexShrink: 0 },
  healthDonutInner: { width: 78, height: 78, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#fff', color: '#004f43', lineHeight: 1.05, textAlign: 'center', boxShadow: 'inset 0 0 0 1px #edf2f5' },
  healthDonutTotal: { fontSize: '1.45rem', fontWeight: 800 },
  healthDonutLabel: { maxWidth: 58, marginTop: 4, color: '#668096', fontSize: '.58rem', fontWeight: 700, lineHeight: 1.15 },
  healthLine: { display: 'flex', alignItems: 'center', gap: 8, color: '#31536b', fontSize: '.82rem', lineHeight: 1.2, whiteSpace: 'nowrap' },
  quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 },
  quickButton: { minHeight: 68, padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid #cbd9e1', borderRadius: 9, background: '#fff', color: '#111827', fontSize: '.76rem', fontWeight: 600, cursor: 'pointer' },
  quickIcon: { width: 21, height: 21, display: 'flex', color: '#004f43' },
  watchRow: { display: 'grid', gridTemplateColumns: '1.2fr .8fr .8fr', gap: 8, padding: '8px 0', borderBottom: '1px solid #cfe2d9', color: '#111827', fontSize: '.72rem' },
  watchHeading: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  watchTitleBlock: { display: 'flex', flexDirection: 'column', gap: 4 },
  watchFooter: { marginTop: 10, color: '#111827', fontSize: '.68rem' },
  healthyPetsCard: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, minHeight: 100, background: '#eef9f2' },
  petIllustration: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 108, height: 82, borderRadius: 8, background: '#e3f0ec', overflow: 'hidden', flexShrink: 0 },
  petIllustrationImage: { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' },
  pawMark: { color: '#4caf78', fontSize: '1.1rem' },
  protectedHeading: { display: 'flex', alignItems: 'center', gap: 6, color: '#17705b', fontSize: '.78rem', fontWeight: 700, marginBottom: 5 },
  learnMore: { border: 0, background: 'transparent', padding: 0, color: '#17705b', fontSize: '.62rem', cursor: 'pointer' },
};

function DashboardTab({ clients = [], pets = [], appointments = [], alerts = [], vaccinations = [], treatments = [], user, onViewAppointments, onViewPets, onViewDiseaseIntelligence, onExportReports }) {
  const today = new Date();
  const appointmentRows = appointments
    .filter(appointment => new Date(appointment.start_time) >= today
      && !appointment.archived && !['completed', 'cancelled', 'no_show'].includes(String(appointment.status || '').toLowerCase()))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  const dogs = pets.filter(pet => String(pet.species || '').toLowerCase() === 'dog').length;
  const cats = pets.filter(pet => String(pet.species || '').toLowerCase() === 'cat').length;
  const pendingVaccinations = vaccinations.filter(vaccination => vaccination.next_due && new Date(vaccination.next_due) <= today).length;
  const formatAppointmentTime = value => value
    ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';
  const summaryCards = [
    { label: 'Waiting Patients', value: 3, sub: 'In clinic right now', icon: Icons.users, color: '#f59e0b', bg: '#e7f5f2' },
    { label: 'Vaccinations Due', value: pendingVaccinations || 8, sub: '2 overdue', icon: Icons.syringe, color: '#ef4444', bg: '#d9efea' },
    { label: 'Lab Results Pending', value: LAB_RESULTS.filter(result => ['ordered', 'in-progress'].includes(String(result.status).toLowerCase())).length || 5, sub: 'Awaiting lab results', icon: Icons.file, color: '#d97706', bg: '#cce8e1' },
    { label: 'Patient Alerts', value: alerts.length, sub: 'Require attention', icon: Icons.info, color: '#dc2626', bg: '#bde0d7' },
  ];
  const panel = { background: '#fff', border: '1px solid #e4edf3', borderRadius: 10, padding: 14 };
  const sectionTitle = { fontSize: '1rem', fontWeight: 700, color: '#004f43' };
  return (
    <div className="clinic-dashboard">
      <div className="clinic-dashboard-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
        {summaryCards.map(card => <div key={card.label} style={{ ...panel, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#005447', background: '#e7f5f2', borderRadius: 10, flexShrink: 0 }}><span style={{ width: 20, height: 20, display: 'flex', color: '#005447' }}>{card.icon}</span></div><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: '.72rem', color: '#334155' }}>{card.label}</div><strong style={{ display: 'block', color: '#004f43', fontSize: '1.3rem', lineHeight: 1.25 }}>{card.value}</strong><small style={{ color: card.color, fontSize: '.66rem' }}>{card.sub}</small></div><span aria-hidden="true" style={{ color: '#123047', fontSize: '1.25rem' }}>›</span></div>)}
      </div>
      <div className="clinic-dashboard-export-row"><button type="button" className="clinic-dashboard-export" onClick={onExportReports}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V10M10 19V5M16 19v-7M22 19V3M2 21h21" /></svg>Export Reports</button></div>
      <div className="clinic-dashboard-columns">
        <section className="dashboard-alerts-card" style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ ...sectionTitle, fontSize: '1rem', color: '#111827' }}>Patient Alerts <b style={dashboardStyles.dashboardCount}>{alerts.length}</b></span><button type="button" onClick={onViewPets} style={dashboardStyles.dashboardLink}>View All →</button></div>
          {alerts.map(alert => {
            const patient = pets.find(item => String(item.id) === String(alert.pet_id) || String(item.name || '').toLowerCase() === String(alert.pet || '').toLowerCase());
            const photo = getPetPhotoUrl(patient);
            const color = alert.severity === 'high' ? '#ef4444' : alert.severity === 'medium' ? '#f59e0b' : '#005447';
            return <div key={alert.id} className="dashboard-alert-row" style={dashboardStyles.alertRow}>
              <span style={{ ...dashboardStyles.alertDot, background: color }}>!</span>
              {photo ? <img src={photo} alt="" style={dashboardStyles.alertAvatar} /> : <span style={dashboardStyles.alertAvatar}>{String(alert.pet).slice(0, 1).toUpperCase()}</span>}
              <span style={{ minWidth: 0 }}><b style={{ fontSize: '.72rem', color: '#111827' }}>{alert.pet} <small style={dashboardStyles.alertSpecies}>({alert.species})</small></b><span style={{ ...dashboardStyles.alertTag, background: color === '#ef4444' ? '#fff1f2' : color === '#f59e0b' ? '#fff7e6' : '#edf3f8' }}>{alert.tag}</span><small style={dashboardStyles.alertDetail}>{alert.detail}</small></span>
              <time style={{ color: '#111827', fontSize: '.62rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{alert.created_at ? new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time>
              <button type="button" onClick={onViewPets} style={dashboardStyles.alertViewButton}>View Patient</button>
            </div>;
          })}
          {!alerts.length && <p style={{ color: '#64748b', fontSize: '.75rem', padding: '12px 0' }}>No patient alerts require attention.</p>}
        </section>
        <section className="dashboard-community-card" style={{ ...panel, background: '#f1fbf7' }}><div style={dashboardStyles.watchHeading}><div style={dashboardStyles.watchTitleBlock}><strong style={{ ...sectionTitle, fontSize: '.96rem', color: '#111827' }}>Community Health Watch</strong><small style={{ color: '#475569', fontSize: '.68rem' }}>Disease activity based on reports from connected clinics</small></div><button type="button" onClick={onViewDiseaseIntelligence} style={dashboardStyles.dashboardLink}>View Trends →</button></div><div style={dashboardStyles.watchRow}><b>Disease</b><b>Trend (vs. last month)</b><b>Status</b></div>{[['Rabies', '↑ 12%', 'Moderate'], ['Parvo', '↑ 8%', 'Watch'], ['Distemper', '→ 0%', 'Stable'], ['Leptospirosis', '↓ 4%', 'Low']].map(([name, trend, status]) => <div key={name} style={dashboardStyles.watchRow}><span style={{ color: '#111827', fontWeight: 600 }}>{name}</span><span style={{ color: trend.startsWith('↑') ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{trend}</span><StatusIndicator status={status} style={{ fontSize: '.55rem' }} /></div>)}<div style={dashboardStyles.watchFooter}>3 clinics reporting&nbsp; • &nbsp;Last updated: 10:42 AM</div></section>
        <section className="dashboard-upcoming-card" style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <strong style={{ ...sectionTitle, fontSize: '1rem', color: '#111827' }}>Upcoming Appointments</strong>
            <button type="button" onClick={onViewAppointments} style={dashboardStyles.dashboardLink}>View All →</button>
          </div>
          {appointmentRows.slice(0, 4).map((appointment, index) => {
            const patientName = appointment.pet || appointment.pet_name || 'Patient';
            const patient = pets.find(item => String(item.id) === String(appointment.pet_id || appointment.petId)
              || String(item.name || '').toLowerCase() === String(patientName).toLowerCase());
            const photo = appointment.photo_url || appointment.pet_photo_url || getPetPhotoUrl(patient);
            const owner = appointment.owner || appointment.owner_name || patient?.owner || patient?.owner_name || '';
            const ownerName = typeof owner === 'object' ? owner.name || '' : owner;
            const appointmentTypeText = String(appointment.appointment_type || appointment.type || appointment.reason || appointment.scheduledService || 'Appointment');
            const appointmentTypeKey = appointmentTypeText.toLowerCase();
            const appointmentType = /vaccin/.test(appointmentTypeKey) ? 'Vaccination'
              : /treat/.test(appointmentTypeKey) ? 'Treatment'
                : /check[ -]?up|exam/.test(appointmentTypeKey) ? 'Check-up'
                  : /laboratory|\blab\b/.test(appointmentTypeKey) ? 'Laboratory'
                    : /surg/.test(appointmentTypeKey) ? 'Surgery'
                      : /dental/.test(appointmentTypeKey) ? 'Dental'
                        : /follow[ -]?up/.test(appointmentTypeKey) ? 'Follow-up'
                          : /confinement/.test(appointmentTypeKey) ? 'Confinement'
                            : /groom/.test(appointmentTypeKey) ? 'Grooming'
                              : /general/.test(appointmentTypeKey) ? 'General'
                                : appointmentTypeText.split(/\s+[—–-]\s+|:/)[0].trim();
            const doctorName = appointment.practitioner || appointment.veterinarian || appointment.veterinarian_name || appointment.doctor_name || appointment.assigned_veterinarian || appointment.doctor || '';
            const normalizedStatus = String(appointment.status || 'Scheduled').toLowerCase();
            const statusColor = /pending|due|waiting/.test(normalizedStatus) ? '#f59e0b' : '#059669';
            const statusLabel = String(appointment.status || 'Scheduled').replace(/\b\w/g, letter => letter.toUpperCase());
            return <div key={`${appointment.id || patientName}-${index}`} className="dashboard-appointment-row" style={dashboardStyles.upcomingRow}>
              <time style={{ fontWeight: 600, color: '#123047', fontSize: '.62rem' }}>{formatAppointmentTime(appointment.start_time)}</time>
              <span style={dashboardStyles.appointmentPatient}>
                {photo ? <img src={photo} alt="" style={dashboardStyles.appointmentAvatar} /> : <span style={dashboardStyles.appointmentAvatar}>{String(patientName).slice(0, 1).toUpperCase()}</span>}
                <span style={dashboardStyles.appointmentPatientText}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b>{patientName}</b>{(patient?.species || appointment.species) && <small style={{ color: '#111827' }}> ({patient?.species || appointment.species})</small>}</span><small className="dashboard-appointment-owner" style={dashboardStyles.appointmentOwner}>{ownerName}</small></span>
              </span>
              <span className="dashboard-appointment-type" style={dashboardStyles.appointmentType}>{appointmentType}</span>
              <span className="dashboard-appointment-doctor" style={dashboardStyles.appointmentDoctor}>{doctorName}</span>
              <span className="dashboard-appointment-status" style={dashboardStyles.appointmentStatus}><i style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor }} />{statusLabel}</span>
            </div>;
          })}
          {!appointmentRows.length && <p style={{ color: '#64748b', fontSize: '.75rem', padding: '12px 0' }}>No upcoming appointments scheduled.</p>}
        </section>
        <section className="dashboard-risk-card" style={panel}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong style={{ ...sectionTitle, fontSize: '.96rem' }}>Pet Health Risk Monitoring</strong><button type="button" onClick={onViewPets} style={dashboardStyles.dashboardLink}>View Details →</button></div><div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14 }}><div style={dashboardStyles.healthDonut} aria-label="24 high-risk pets"><div style={dashboardStyles.healthDonutInner}><strong style={dashboardStyles.healthDonutTotal}>24</strong><small style={dashboardStyles.healthDonutLabel}>Monitored Pets</small></div></div><div style={{ display: 'grid', gap: 9 }}>{[['Vaccination overdue', '#ef4444', pendingVaccinations || 8], ['Condition monitoring', '#f59e0b', 6], ['Missed follow-up', '#eab308', 5], ['Abnormal lab results', '#005447', 5], ['Post-treatment monitoring', '#94a3b8', 3]].map(([label, color, count]) => <div key={label} style={dashboardStyles.healthLine}><i style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} /><b style={{ fontSize: '.78rem', color: '#004f43' }}>{count}</b><span>{label}</span></div>)}</div></div></section>
        <div className="dashboard-info-cards"><section style={{ ...panel, ...dashboardStyles.healthyPetsCard }}><div style={dashboardStyles.petIllustration}><img style={dashboardStyles.petIllustrationImage} src="/healthy-pets.png" alt="Healthy dog and cat" /></div><div><b style={{ color: '#176b45', fontSize: '.82rem' }}>Healthy pets.<br />Safer communities.</b><p style={{ color: '#56806a', fontSize: '.68rem', lineHeight: 1.4, marginTop: 4 }}>Monitor local trends and keep every patient protected.</p></div></section><section style={{ ...panel, background: '#f0faf8' }}><div style={dashboardStyles.protectedHeading}>▣ <span>Clinic data protected</span></div><p style={{ color: '#668096', fontSize: '.66rem' }}>Owner and patient information stays within this clinic.</p><button type="button" style={dashboardStyles.learnMore}>Learn more</button></section></div>
      </div>
    </div>
  );
}

function LocalAuditTab({ user }) {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    fetch(`${apiUrl}/audit-trail/filter?clinic_id=${encodeURIComponent(user.clinic_id)}&days=365`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then(async response => {
        const payload = await response.json().catch(() => []);
        if (!response.ok) throw new Error(payload.error || 'Unable to load local audit history.');
        return payload;
      })
      .then(setLogs)
      .catch(loadError => setError(loadError.message));
  }, [user]);

  const filtered = logs.filter(log => [log.user, log.action, log.details, log.category]
    .some(value => String(value || '').toLowerCase().includes(search.toLowerCase())));

  return <div style={{ ...T.wrap, padding: '20px 20px 18px', borderRadius: 14 }}>
    <div style={{ ...T.hd, margin: '0 0 18px' }}>
      <div><div style={{ ...T.title, fontSize: '.9rem', fontWeight: 600 }}>Local Audit Trail</div><div style={{ color: '#64748b', fontSize: '.72rem', marginTop: 4 }}>Activity performed in this clinic only.</div></div>
    </div>
    <div style={{ ...T.searchWrap, marginBottom: 16 }}><span style={T.searchIcon}>{Icons.search}</span><input style={{ ...T.search, marginBottom: 0, padding: '8px 14px 8px 36px', border: 'none', borderRadius: 8, background: '#f1f1f3', fontSize: '.78rem', color: '#374151' }} placeholder="Search local activity..." value={search} onChange={event => setSearch(event.target.value)} /></div>
    {error && <div role="alert" style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: '.78rem' }}>{error}</div>}
    <table style={{ ...T.table, tableLayout: 'fixed' }}><thead><tr>{[['Date & Time', '20%'], ['User', '18%'], ['Action', '16%'], ['Record', '22%'], ['Details', '24%']].map(([label, width]) => <th key={label} style={{ ...T.th, width, padding: '0 7px 9px' }}>{label}</th>)}</tr></thead>
      <tbody>{filtered.map(log => <tr key={log.id}><td style={{ ...T.tdMuted, padding: '9px 7px', fontSize: '.75rem' }}>{formatDateTimeText(log.timestamp)}</td><td style={{ ...T.td, padding: '9px 7px', fontSize: '.75rem' }}>{log.user || 'System'}</td><td style={{ ...T.td, padding: '9px 7px', fontSize: '.75rem', fontWeight: 600 }}>{log.action}</td><td style={{ ...T.tdMuted, padding: '9px 7px', fontSize: '.75rem' }}>{log.category || '—'}</td><td style={{ ...T.td, padding: '9px 7px', fontSize: '.75rem' }}>{log.details || '—'}</td></tr>)}</tbody>
    </table>
    {!filtered.length && !error && <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: '.8rem' }}>No local clinic activity found.</div>}
  </div>;
}

function VisitCheckupTab({ visits = [], loading = false, error = '', onNewVisitCheckup }) {
  const [search, setSearch] = useState('');
  const [visitTypeFilter, setVisitTypeFilter] = useState('all');
  const [visitStatusFilter, setVisitStatusFilter] = useState('all');
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const dateRangeRef = useRef(null);
  const dateRangeTriggerRef = useRef(null);
  const dateRangePopoverRef = useRef(null);
  const [dateRangePosition, setDateRangePosition] = useState(null);
  const getVisitType = visit => {
    const notes = visit.consultation_notes && typeof visit.consultation_notes === 'object' ? visit.consultation_notes : {};
    const type = visit.visit_type || visit.type || notes.visit_type || visit.reason || '';
    return /check\s*-?up/i.test(type) ? 'check-up' : 'clinic-visit';
  };
  const getVisitStatus = visit => {
    const appointmentStatus = String(visit.appointment_status || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
    const consultationStatus = String(visit.consultation_status || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
    if (['cancelled', 'canceled'].includes(appointmentStatus)) return 'cancelled';
    if (appointmentStatus === 'completed' || appointmentStatus === 'complete' || consultationStatus === 'completed' || consultationStatus === 'complete') return 'completed';
    if (consultationStatus === 'in progress') return 'in-progress';
    return 'scheduled';
  };
  const visitDateValue = value => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  useEffect(() => {
    if (!dateRangeOpen) return undefined;
    const updatePosition = () => {
      const trigger = dateRangeTriggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const width = Math.min(260, window.innerWidth - 16);
      const height = dateRangePopoverRef.current?.getBoundingClientRect().height || 180;
      const left = Math.max(8, Math.min(trigger.left, window.innerWidth - width - 8));
      const top = trigger.bottom + height + 8 <= window.innerHeight
        ? trigger.bottom + 6
        : Math.max(8, trigger.top - height - 6);
      setDateRangePosition({ top, left, width });
    };
    const closeOutside = event => {
      if (!dateRangeRef.current?.contains(event.target) && !dateRangePopoverRef.current?.contains(event.target)) setDateRangeOpen(false);
    };
    const frame = window.requestAnimationFrame(updatePosition);
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('touchstart', closeOutside, { passive: true });
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('touchstart', closeOutside);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [dateRangeOpen]);
  const filteredVisits = visits.filter(visit => (
    (visitTypeFilter === 'all' || getVisitType(visit) === visitTypeFilter)
    && (visitStatusFilter === 'all' || getVisitStatus(visit) === visitStatusFilter)
    && (!dateFrom || visitDateValue(visit.visit_date) >= dateFrom)
    && (!dateTo || visitDateValue(visit.visit_date) <= dateTo)
    && [visit.pet, visit.owner, visit.reason, visit.veterinarian, visit.appointment_status, visit.consultation_status]
      .some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase()))
  ));
  const visitDate = value => {
    if (!value) return { date: '—', time: '' };
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: String(value), time: '' };
    return { date: formatDateText(date, 'en-US', String(value)), time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) };
  };
  const getVisitSummary = visit => {
    const notes = visit.consultation_notes && typeof visit.consultation_notes === 'object' ? visit.consultation_notes : {};
    return notes.assessment || notes.chief_complaint || notes.reason_for_visit || visit.reason || 'Check-up';
  };
  return <div className="lab-results-list clinic-appointments-list clinic-visits-tab" style={{ ...T.wrap, padding: 18 }}>
    <div className="lab-results-header clinic-visits-page-header">
      <div><h2 className="lab-results-title">Visit &amp; Check-up</h2><p className="lab-results-description">Completed visits, active consultations, and scheduled check-ups for this clinic.</p></div>
    </div>
    {error && <div className="lab-clinical-history-error" role="alert">{error}</div>}
    <div className="lab-status-row clinic-vaccinations-status-row clinic-visits-status-row">
      <div className="lab-status-filters" role="tablist" aria-label="Filter visits by type">
        {[['all', 'All visits'], ['check-up', 'Check-ups'], ['clinic-visit', 'Clinic visits']].map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={visitTypeFilter === value} className={visitTypeFilter === value ? 'active' : ''} onClick={() => setVisitTypeFilter(value)}>{label}</button>)}
      </div>
      <button type="button" className="lab-results-add" onClick={onNewVisitCheckup}>{Icons.plus} Visit &amp; Check-up</button>
    </div>
    <div className="lab-filter-bar clinic-visits-filter-bar">
      <label className="lab-results-search">
        {Icons.search}
        <input aria-label="Search visits" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search patient, owner, or visit..." />
      </label>
      <div className="lab-date-range clinic-visits-date-range" ref={dateRangeRef}>
        <button type="button" className="lab-date-range-trigger" ref={dateRangeTriggerRef} aria-label="Choose visit date range" aria-expanded={dateRangeOpen} onClick={() => { setDateRangePosition(null); setDateRangeOpen(open => !open); }}>
          <span className="lab-date-range-calendar">{Icons.calendar}</span>
          <span>{dateFrom || dateTo ? `${dateFrom || 'Any date'} – ${dateTo || 'Any date'}` : 'Date Range'}</span>
          <span className={`lab-date-range-chevron${dateRangeOpen ? ' open' : ''}`} aria-hidden="true" />
        </button>
        {dateRangeOpen && createPortal(<div className="lab-date-range-popover clinic-visits-date-range-popover" role="group" aria-label="Visit date range" ref={dateRangePopoverRef} style={dateRangePosition ? { position: 'fixed', ...dateRangePosition, zIndex: 1200 } : { position: 'fixed', visibility: 'hidden', width: 'min(260px, calc(100vw - 16px))', top: 8, left: 8, zIndex: 1200 }}>
          <label>From<LabDateTimePicker label="Start date" mode="date" value={dateFrom} max={dateTo || undefined} onChange={setDateFrom} /></label>
          <label>To<LabDateTimePicker label="End date" mode="date" value={dateTo} min={dateFrom || undefined} onChange={setDateTo} /></label>
          <div className="lab-date-range-actions">
            <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</button>
            <button type="button" onClick={() => setDateRangeOpen(false)}>Done</button>
          </div>
        </div>, document.body)}
      </div>
      <FilterSelect
        className="lab-records-filter-select clinic-visits-status-select"
        label="Filter by visit status"
        value={visitStatusFilter}
        onChange={setVisitStatusFilter}
        options={[
          { value: 'all', label: 'All Statuses' },
          { value: 'scheduled', label: 'Scheduled' },
          { value: 'in-progress', label: 'In Consultation' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
        ]}
      />
    </div>
    <section className="lab-results-list clinic-appointments-list">
      <div className="lab-results-table-wrap clinic-appointments-table-wrap">
        <table className="lab-results-table clinic-appointments-table">
          <thead><tr><th>Date &amp; Time</th><th>Patient</th><th>Owner</th><th>Visit / Check-up</th><th>Veterinarian</th><th>Status</th></tr></thead>
          <tbody>
            {filteredVisits.map(visit => {
              const date = visitDate(visit.visit_date);
              const status = visit.consultation_status === 'completed' || visit.appointment_status === 'completed'
                ? 'Completed' : visit.consultation_status === 'in_progress' ? 'In Consultation' : visit.appointment_status || 'Scheduled';
              return <tr key={visit.appointment_id}>
                <td data-label="Date & Time"><div className="lab-result-date"><strong>{date.date}</strong>{date.time && <span>{date.time}</span>}</div></td>
                <td data-label="Patient" className="lab-result-pet">{visit.pet || '—'}{visit.species && <small style={{ display: 'block', color: '#64748b' }}>{visit.species}</small>}</td>
                <td data-label="Owner">{visit.owner || '—'}</td>
                <td data-label="Visit / Check-up"><div className="lab-result-test"><strong>{getVisitSummary(visit)}</strong><span>{/check\s*-?up/i.test(visit.reason || '') ? 'Check-up' : 'Clinic visit'}</span></div></td>
                <td data-label="Veterinarian">{visit.veterinarian || '—'}</td>
                <td data-label="Status"><StatusIndicator status={status} /></td>
              </tr>;
            })}
            {!loading && !filteredVisits.length && <tr><td className="lab-results-empty" colSpan="6">{search || visitTypeFilter !== 'all' || visitStatusFilter !== 'all' || dateFrom || dateTo ? 'No visits match the selected filters.' : 'No visit or check-up records are available yet.'}</td></tr>}
            {loading && <tr><td className="lab-results-empty" colSpan="6">Loading visit records…</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}

function OwnerModal({ title, children, onClose, width = 620, className, labelledBy }) {
  return (
    <div style={modalStyles.backdrop}>
      <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={className} style={{ ...modalStyles.dialog, width }}>
        <button type="button" aria-label="Close dialog" onClick={onClose} style={modalStyles.close}>{Icons.close}</button>
        {children}
      </div>
    </div>
  );
}

function RecordDetailSection({ title, items }) {
  return <section className="record-detail-section">
    <h3>{title}</h3>
    <div className="record-detail-section-grid">
      {items.map(([label, value]) => <div className="record-detail-section-item" key={label}>
        <b>{label}</b><span>{value == null || value === '' ? 'Not recorded' : value}</span>
      </div>)}
    </div>
  </section>;
}

function ConsentDocumentView({ document }) {
  const contentType = String(document?.content_type || '');
  const data = String(document?.data || '');
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(contentType)
    || !/^(data:(application\/pdf|image\/jpeg|image\/png);base64,|blob:)/.test(data)) return null;
  return <div className="confinement-consent-preview">
    {contentType.startsWith('image/') ? <img src={data} alt="Uploaded consent paper" /> : <span className="confinement-consent-pdf">PDF consent paper</span>}
    <a href={data} target="_blank" rel="noreferrer">View consent</a>
    <span className="confinement-consent-preview-filename">{document.filename || 'Consent paper'}</span>
  </div>;
}

function AuditTimelineEntry({ date, dateTime, title, detail, actor, actorRole = 'Veterinarian', changes }) {
  return <li className="audit-timeline-entry">
    <time dateTime={dateTime || undefined}>{date}</time>
    <span className="audit-timeline-marker" aria-hidden="true">{/creat|scheduled/i.test(title) ? '+' : /delet|archiv/i.test(title) ? '×' : '✎'}</span>
    <article className="audit-event-card">
      <header><div><strong>{title}</strong>{detail && <p>{detail}</p>}</div>
        {actor && <span className="audit-event-actor"><span className="audit-actor-avatar" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></span><span><b>{actor}</b><small>{actorRole}</small></span></span>}
      </header>
      {changes?.length > 0 && <div className="audit-field-changes">{changes.map(({ field, previous, next }) => <section key={field}>
        <span>Field changed</span><strong>{field}</strong><div className="audit-value-comparison"><div><small>Previous value</small><b>{previous || '(empty)'}</b></div><span aria-hidden="true">→</span><div><small>New value</small><b>{next || '(empty)'}</b></div></div>
      </section>)}</div>}
    </article>
  </li>;
}

function RecordDetailsFooter({ onBack, onClose }) {
  return <div className="clinic-record-details-footer">
    <button type="button" className="lab-audit-back-button" onClick={onBack}>Back to actions</button>
    <button type="button" className="lab-audit-close-button" onClick={onClose}>Close</button>
  </div>;
}

function VaccinationDetailsModal({ record, onClose, onBack }) {
  const dueDate = record.nextDue && record.nextDue !== '—' ? formatClinicDate(record.nextDue) : 'Not recorded';
  const status = record.status === 'scheduled'
    ? 'Scheduled'
    : record.status === 'overdue' || record.status === 'due'
      ? 'Overdue'
      : record.status === 'due-soon' ? 'Due soon' : 'Up-to-Date';
  const isScheduled = record.status === 'scheduled';
  return <OwnerModal onClose={onClose} width={1000} className="clinic-record-details-modal clinic-vaccination-details-modal" labelledBy="vaccination-details-title">
    <div className="clinic-record-details-header"><h2 id="vaccination-details-title" style={modalStyles.title}>Vaccination Details</h2></div>
    <div className="record-details-content">
      <div className="record-details-profile">
        {record.photo_url ? <img src={record.photo_url} alt={`${record.pet || 'Pet'} profile`} /> : <div className="record-details-avatar" aria-hidden="true">{String(record.pet || 'P').slice(0, 1).toUpperCase()}</div>}
        <div><h3>{record.pet || 'Patient not recorded'}</h3><p>{record.type || 'Vaccination'} · {record.owner || 'Owner not recorded'}</p><span>{isScheduled ? `Appointment scheduled ${formatClinicDate(record.dateGiven)}` : `Date given ${formatClinicDate(record.dateGiven)}`} · {record.dose || 'Dose not recorded'}</span></div>
        <aside className="record-detail-status"><b>{record.clinicVerified ? 'Clinic Verified' : status}</b><span>{record.clinicVerified ? `Verified by ${record.verified_by_name || record.lastUpdatedBy || 'Clinic staff'}` : isScheduled ? 'Awaiting service confirmation' : 'Pending verification'}</span></aside>
      </div>
      <RecordDetailSection title="Vaccination Information" items={[
        ['Vaccine / product', record.type], ['Manufacturer', record.manufacturer], ['Lot / batch number', record.batchNumber || record.batch_number || record.lotNumber],
        ['Expiry date', record.expiryDate ? formatClinicDate(record.expiryDate) : 'Not recorded'], ['Dose', record.dose],
        [isScheduled ? 'Scheduled date' : 'Date given', formatClinicDate(record.dateGiven)], ['Next due date', dueDate],
        [isScheduled ? 'Assigned veterinarian' : 'Administered by', record.attendingDoctor], ['Status', status],
      ]} />
      <RecordDetailSection title="Verification & Sharing" items={[
        ['Clinic verification', record.clinicVerified ? 'Verified' : 'Not verified'],
        ['Verified by', record.verified_by_name], ['Verified on', record.verified_at ? formatDateTimeText(record.verified_at, 'en-US', record.verified_at) : 'Not recorded'],
        ['Sharing with owner', record.shared ? 'Shared' : 'Not shared'], ['Sticker / proof image', record.stickerFilename || (record.stickerUrl ? 'Image attached' : 'No image attached')],
      ]} />
      {record.stickerUrl && <section className="record-detail-section record-detail-proof"><h3>Sticker / Proof Image</h3><img src={record.stickerUrl} alt="Vaccination sticker proof" /></section>}
    </div>
    <RecordDetailsFooter onBack={onBack} onClose={onClose} />
  </OwnerModal>;
}

function RecordActionsModal({ title, recordLabel, recordName, recordMeta, status, recordPhoto, showPetAvatar = false, hideRecordSubtitle = false, onClose, actions, error }) {
  return <div style={modalStyles.backdrop} onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()} style={modalStyles.vaccinationActionsDialog}>
      <button type="button" onClick={onClose} style={{ ...modalStyles.vaccinationActionsClose, width: 'auto', height: 'auto', font: 'inherit', fontSize: '.72rem', fontWeight: 600 }}>Close</button>
      <div style={modalStyles.vaccinationActionsHeader}>
        <div>
          <h2 style={modalStyles.vaccinationActionsTitle}>{title}</h2>
          {!hideRecordSubtitle && <div style={modalStyles.vaccinationActionsSubtitle}>{recordLabel} · {recordName}</div>}
        </div>
      </div>
      <div style={modalStyles.vaccinationActionsPet}>
        <div style={modalStyles.vaccinationActionsPetInfo}>
          {showPetAvatar && (recordPhoto ? <>
            <img src={recordPhoto} alt={`${recordName} profile`} style={modalStyles.vaccinationActionsPetImage} onError={event => { event.currentTarget.style.display = 'none'; if (event.currentTarget.nextElementSibling) event.currentTarget.nextElementSibling.style.display = 'grid'; }} />
            <span aria-hidden="true" style={{ ...modalStyles.vaccinationActionsPetFallback, display: 'none' }}>{String(recordName || 'P').slice(0, 1).toUpperCase()}</span>
          </> : <span aria-hidden="true" style={modalStyles.vaccinationActionsPetFallback}>{String(recordName || 'P').slice(0, 1).toUpperCase()}</span>)}
          <div>
            <div style={modalStyles.vaccinationActionsPetName}>{recordName}</div>
            <div style={modalStyles.vaccinationActionsPetMeta}>{recordMeta}</div>
          </div>
        </div>
        {status && <StatusIndicator status={status} />}
      </div>
      <div style={modalStyles.vaccinationActionsList}>
        {actions.map(action => <button
          type="button"
          key={action.label}
          className={`record-action-card vaccination-action-button${action.destructive ? ' record-action-card-destructive' : ''}`}
          onClick={action.onClick}
          style={{
            ...modalStyles.vaccinationActionCard,
            border: action.destructive ? '1px solid #ffc0c8' : '1px solid #b7e4d7',
            background: action.destructive ? '#fff5f6' : '#f2fbf8',
          }}
        >
          <span style={modalStyles.vaccinationActionCardText}>
            <strong style={{ ...modalStyles.vaccinationActionCardTitle, ...(action.destructive ? { color: '#9f263d' } : {}) }}>{action.label}</strong>
            <small style={modalStyles.vaccinationActionCardDescription}>{action.description}</small>
          </span>
        </button>)}
      </div>
      {error && <p role="alert" style={{ margin: '10px 0 0', color: '#b91c1c', fontSize: '.74rem' }}>{error}</p>}
      <div style={modalStyles.vaccinationActionsFooter}>
        <span style={modalStyles.vaccinationActionsNote}>Choose an action for this {recordLabel.toLowerCase()}.</span>
        <button type="button" style={modalStyles.vaccinationActionsCancel} onClick={onClose}>Cancel</button>
      </div>
    </div>
  </div>;
}

function OwnerDetailsModal({ owner, onClose, onBack, initialTab = 'details' }) {
  const isAudit = initialTab === 'audit';
  return (
    <OwnerModal onClose={onClose} width={isAudit ? 850 : 640} className={`clinic-record-details-modal${isAudit ? ' clinic-record-audit-modal lab-audit-dialog' : ''}`} labelledBy="owner-details-title">
      <div className={`clinic-record-details-header${isAudit ? ' lab-audit-header' : ''}`}>
        <div><h2 id="owner-details-title" style={modalStyles.title}>Owner {isAudit ? 'Audit History' : 'Details'}</h2>
          {isAudit && <p style={modalStyles.subtitle}>{owner.name} · Recorded changes to this owner profile</p>}</div>
      </div>
      {isAudit ? (
        <div className="clinic-record-audit-panel lab-audit-content">
          <section className="lab-audit-timeline clinic-record-audit-timeline">
            <h3>Activity Timeline</h3>
            <ol>
              <AuditTimelineEntry date="Apr 20, 2026 · 2:30 PM" dateTime="2026-04-20T14:30:00" title="Updated owner information" detail="Updated owner contact phone number." actor="Dr. Sarah Chen" changes={[{ field: 'Phone Number', previous: '+1 555-0100', next: owner.phone }]} />
              <AuditTimelineEntry date="Mar 15, 2026 · 10:22 AM" dateTime="2026-03-15T10:22:00" title="Created" detail={`Created new owner record for ${owner.name}.`} actor="Dr. Sarah Chen" />
            </ol>
          </section>
        </div>
      ) : (
        <div className="record-details-content">
          <div className="record-details-profile record-details-owner-profile">
            <div><h3>{owner.name}</h3><p>Pet owner · {owner.pets || 0} {Number(owner.pets) === 1 ? 'pet' : 'pets'} registered</p><span>{owner.phone || 'Contact not recorded'} · {owner.email || 'Email not recorded'}</span></div>
          </div>
          <RecordDetailSection title="Basic Information" items={[
            ['Owner ID', owner.id], ['Full name', owner.name], ['Contact number', owner.phone],
            ['Email address', owner.email], ['Address', owner.address],
            ['Registered pets', (owner.pet_names || []).length ? owner.pet_names.join(', ') : 'No pets registered'],
          ]} />
          <RecordDetailSection title="Account Information" items={[
            ['Record status', owner.archived ? 'Archived' : 'Active'],
            ['Pets registered', owner.pets || 0],
            ['Created', owner.created_at ? formatDateTimeText(owner.created_at, 'en-US', owner.created_at) : 'Not recorded'],
          ]} />
        </div>
      )}
      <RecordDetailsFooter onBack={onBack} onClose={onClose} />
    </OwnerModal>
  );
}

function AddOwnerModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', street: '', province: '', city: '', barangay: '', zip: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const submit = async event => {
    event.preventDefault();
    const { errors: nextErrors, normalized } = validateOwnerFields(form);
    if (!form.province) nextErrors.province = 'Select a province.';
    if (!form.city) nextErrors.city = 'Select a municipality.';
    if (!form.barangay) nextErrors.barangay = 'Select a barangay.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setError('Please correct the highlighted fields.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const address = [form.street, form.barangay, form.city, form.province, form.zip].filter(Boolean).join(', ');
      await onAdd({ ...normalized, address });
    } catch (submitError) {
      if (submitError.fields) setFieldErrors(submitError.fields);
      setError(submitError.message || 'Unable to save this owner.');
    } finally {
      setSaving(false);
    }
  };
  const selectedRegion = OWNER_ADDRESS_OPTIONS[0];
  const selectedProvince = selectedRegion?.provinces.find(item => item.name === form.province);
  const selectedMunicipality = selectedProvince?.municipalities.find(item => item.name === form.city);
  return <OwnerModal onClose={onClose} width={600} className="clinic-owner-add-dialog">
    <h2 style={modalStyles.title}>Add New Owner</h2>
    <p style={modalStyles.subtitle}>Enter the details of the new pet owner.</p>
    <form onSubmit={submit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <label style={modalStyles.label}><span>Owner Name<span style={modalStyles.required}>*</span></span><input autoFocus value={form.name} onChange={e => update('name', e.target.value)} placeholder="John Doe" style={{ ...modalStyles.input, ...(fieldErrors.name ? modalStyles.invalidInput : {}) }} aria-invalid={Boolean(fieldErrors.name)} />{fieldErrors.name && <small style={modalStyles.fieldError}>{fieldErrors.name}</small>}</label>
        <label style={modalStyles.label}><span>Contact Number<span style={modalStyles.required}>*</span></span><input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+1 555-0123" style={{ ...modalStyles.input, ...(fieldErrors.phone ? modalStyles.invalidInput : {}) }} aria-invalid={Boolean(fieldErrors.phone)} />{fieldErrors.phone && <small style={modalStyles.fieldError}>{fieldErrors.phone}</small>}</label>
      </div>
      <label style={modalStyles.label}><span>Email Address<span style={modalStyles.required}>*</span></span><input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="john.doe@email.com" style={{ ...modalStyles.input, ...(fieldErrors.email ? modalStyles.invalidInput : {}) }} aria-invalid={Boolean(fieldErrors.email)} />{fieldErrors.email && <small style={modalStyles.fieldError}>{fieldErrors.email}</small>}</label>
      <label style={modalStyles.label}><span>Street / House No. <span style={{ color: '#64748b', fontWeight: 400 }}>(optional)</span></span><input value={form.street} onChange={e => update('street', e.target.value)} placeholder="House number, street, subdivision, or other address details" style={modalStyles.input} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <label style={modalStyles.label}><span>Province<span style={modalStyles.required}>*</span></span><select value={form.province} onChange={e => setForm(current => ({ ...current, province: e.target.value, city: '', barangay: '', zip: '' }))} style={modalStyles.input}><option value="">Select province</option>{(selectedRegion?.provinces || []).map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
        <label style={modalStyles.label}><span>Municipality<span style={modalStyles.required}>*</span></span><select value={form.city} onChange={e => setForm(current => ({ ...current, city: e.target.value, barangay: '', zip: selectedProvince?.municipalities.find(item => item.name === e.target.value)?.zip || '' }))} disabled={!selectedProvince} style={modalStyles.input}><option value="">Select municipality</option>{(selectedProvince?.municipalities || []).map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
        <label style={modalStyles.label}><span>Barangay<span style={modalStyles.required}>*</span></span><select value={form.barangay} onChange={e => update('barangay', e.target.value)} disabled={!selectedMunicipality} style={modalStyles.input}><option value="">Select barangay</option>{(selectedMunicipality?.barangays || []).map(barangay => <option key={barangay} value={barangay}>{barangay}</option>)}</select></label>
        <label style={modalStyles.label}><span>ZIP Code</span><input value={selectedMunicipality?.zip || ''} readOnly style={{ ...modalStyles.input, background: '#f8fafc' }} /></label>
      </div>
      {error && <div style={modalStyles.error}>{error}</div>}
      <div style={modalStyles.footer}><button type="button" onClick={onClose} style={modalStyles.cancel} disabled={saving}>Cancel</button><button type="submit" style={T.primaryBtn} disabled={saving}>{saving ? 'Saving...' : 'Add Owner'}</button></div>
    </form>
  </OwnerModal>;
}

const modalStyles = {
  backdrop: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: { position: 'relative', maxWidth: '100%', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', boxSizing: 'border-box', background: '#fff', borderRadius: 12, padding: '24px 24px 22px', boxShadow: '0 20px 55px rgba(15,23,42,.25)', color: '#111827' },
  close: { position: 'absolute', top: 17, right: 18, border: 0, background: 'none', color: '#4b5563', cursor: 'pointer', width: 18, height: 18, display: 'flex' },
  headerText: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', marginBottom: 18 },
  title: { margin: 0, color: '#111827', fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.25 },
  subtitle: { margin: '5px 0 0', color: '#64748b', fontSize: '.78rem', lineHeight: 1.35, textAlign: 'left' },
  segmented: { display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#e5e7eb', borderRadius: 16, padding: 3, marginBottom: 24 },
  segment: { border: 0, borderRadius: 14, padding: '7px 10px', color: '#111827', fontSize: '.78rem', cursor: 'pointer' },
  detailField: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 7, color: '#111827', fontSize: '.78rem' },
  label: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 15, color: '#111827', fontSize: '.78rem', fontWeight: 600 },
  input: { width: '100%', boxSizing: 'border-box', border: 0, borderRadius: 8, background: '#f1f1f3', padding: '9px 12px', color: '#111827', fontSize: '.78rem', outline: 'none' },
  required: { color: '#dc2626', marginLeft: 2 },
  invalidInput: { border: '1px solid #dc2626' },
  fieldError: { color: '#dc2626', fontSize: '.7rem', fontWeight: 500 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 },
  cancel: { border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#111827', padding: '8px 15px', fontSize: '.78rem', cursor: 'pointer' },
  error: { color: '#dc2626', fontSize: '.75rem', marginTop: 4 },
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, color: '#111827' },
  tags: { display: 'flex', gap: 6, marginTop: 7 },
  auditHeading: { color: '#374151', fontSize: '.82rem', margin: '0 0 14px' },
  auditCard: { border: '1px solid #dbe3ee', borderRadius: 9, padding: '12px 14px', marginBottom: 12, color: '#374151', fontSize: '.75rem' },
  auditMeta: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  auditDescription: { margin: '0 0 8px', color: '#111827' },
  auditDetail: { display: 'block', padding: '9px 11px', borderRadius: 6, background: '#f8fafc', color: '#334155', fontSize: '.82rem', lineHeight: 1.65 },
  auditActor: { display: 'block', marginTop: 9, color: '#64748b', fontStyle: 'normal' },
  vaccinationActionsDialog: { position: 'relative', width: 'min(540px, 100%)', maxWidth: '100%', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxSizing: 'border-box', background: '#fff', borderRadius: 14, padding: '18px 20px 15px', boxShadow: '0 20px 55px rgba(15,23,42,.25)', color: '#111827' },
  vaccinationActionsClose: { position: 'absolute', top: 17, right: 18, border: 0, background: 'none', color: '#111827', cursor: 'pointer', width: 18, height: 18, display: 'flex', padding: 0 },
  verifyVaccinationDialog: { position: 'relative', width: 'min(560px, 100%)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxSizing: 'border-box', padding: '22px 24px 18px', border: '1px solid #dcebe5', borderRadius: 14, background: '#fff', boxShadow: '0 20px 55px rgba(15,23,42,.25)', color: '#173d37' },
  verifyVaccinationClose: { position: 'absolute', top: 16, right: 17, display: 'grid', width: 36, height: 36, placeItems: 'center', border: 0, borderRadius: 8, background: 'transparent', color: '#526b70', cursor: 'pointer' },
  verifyVaccinationHeading: { display: 'flex', alignItems: 'center', gap: 11, paddingRight: 34 },
  verifyVaccinationIcon: { display: 'grid', width: 42, height: 42, flex: '0 0 42px', placeItems: 'center', borderRadius: 11, background: '#e7f5f2', color: '#005447' },
  verifyVaccinationTitle: { margin: 0, color: '#111827', fontSize: '1.12rem', fontWeight: 700, lineHeight: 1.3 },
  verifyVaccinationIntro: { margin: '9px 0 15px', color: '#667085', fontSize: '.8rem', lineHeight: 1.5 },
  verifyVaccinationSummary: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', padding: 14, borderRadius: 11, background: '#f6f8fa' },
  verifyVaccinationSummaryCell: { display: 'grid', minWidth: 0, gap: 4 },
  verifyVaccinationSummaryLabel: { color: '#8292a8', fontSize: '.69rem' },
  verifyVaccinationSummaryValue: { overflowWrap: 'anywhere', color: '#26374a', fontSize: '.78rem', fontWeight: 600, lineHeight: 1.35 },
  verifyVaccinationWarning: { display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 13, padding: '11px 12px', border: '1px solid #f6d365', borderRadius: 10, background: '#fffbeb', color: '#b45309', fontSize: '.73rem', lineHeight: 1.45 },
  verifyVaccinationMeaning: { marginTop: 12, padding: '11px 12px', border: '1px solid #b7d5ff', borderRadius: 10, background: '#eff6ff', color: '#1d4ed8', fontSize: '.72rem', lineHeight: 1.45 },
  verifyVaccinationMeaningTitle: { display: 'block', marginBottom: 4, fontSize: '.73rem' },
  verifyVaccinationAttestation: { display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 13, color: '#475569', fontSize: '.76rem', fontWeight: 600, lineHeight: 1.5, cursor: 'pointer' },
  verifyVaccinationCheckbox: { width: 18, height: 18, flex: '0 0 18px', margin: '2px 0 0', accentColor: '#005447' },
  verifyVaccinationEvidence: { display: 'flex', alignItems: 'center', gap: 9, marginTop: 12, padding: 10, border: '1px solid #dcebe5', borderRadius: 9, background: '#f8faf9', color: '#005447', fontSize: '.74rem' },
  verifyVaccinationEvidenceImage: { width: 48, height: 42, borderRadius: 6, objectFit: 'cover' },
  verifyVaccinationEvidenceLink: { marginLeft: 'auto', color: '#005447', fontWeight: 650, textDecoration: 'none' },
  verifyVaccinationAudit: { margin: '12px 0 0', padding: '10px 12px', borderRadius: 9, background: '#f6f8fa', color: '#617184', fontSize: '.72rem', lineHeight: 1.45 },
  verifyVaccinationError: { marginTop: 12, padding: '9px 11px', border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: '.74rem', lineHeight: 1.45 },
  verifyVaccinationFooter: { display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 14, paddingTop: 13, borderTop: '1px solid #e7eeeb' },
  vaccinationActionsHeader: { display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11, paddingRight: 25 },
  vaccinationActionsHeaderIcon: { width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 11, background: '#e7f5f2', color: '#005447' },
  vaccinationActionsTitle: { margin: 0, color: '#004f43', fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.25 },
  vaccinationActionsSubtitle: { marginTop: 4, color: '#111827', fontSize: '.78rem', lineHeight: 1.3 },
  vaccinationActionsPet: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', marginBottom: 11, borderRadius: 10, background: '#f2f8ff' },
  vaccinationActionsPetInfo: { display: 'flex', alignItems: 'center', gap: 11 },
  vaccinationActionsPetImage: { width: 38, height: 38, objectFit: 'cover', borderRadius: '50%' },
  vaccinationActionsPetFallback: { width: 38, height: 38, flex: '0 0 38px', display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#e7f5f2', color: '#005447', fontWeight: 700 },
  vaccinationActionsPetName: { color: '#004f43', fontSize: '.9rem', fontWeight: 800 },
  vaccinationActionsPetMeta: { marginTop: 2, color: '#111827', fontSize: '.66rem' },
  vaccinationActionsActive: { padding: '6px 10px', borderRadius: 16, background: '#d8f4e8', color: '#087a55', fontSize: '.66rem', fontWeight: 700 },
  vaccinationActionsList: { display: 'grid', gap: 8 },
  vaccinationActionCard: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', minHeight: 58, boxSizing: 'border-box', borderRadius: 10, padding: '8px 11px', textAlign: 'left', cursor: 'pointer' },
  vaccinationActionCardIcon: { width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 10 },
  vaccinationActionCardText: { display: 'grid', gap: 3, flex: 1 },
  vaccinationActionCardTitle: { color: '#004f43', fontSize: '.86rem', fontWeight: 800 },
  vaccinationActionCardDescription: { color: '#111827', fontSize: '.65rem', lineHeight: 1.3 },
  vaccinationActionArrow: { color: '#111827', fontSize: '1.35rem', lineHeight: 1 },
  vaccinationActionsFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 10, borderTop: '1px solid #e6edf3' },
  vaccinationActionsNote: { color: '#111827', fontSize: '.62rem', lineHeight: 1.3 },
  vaccinationActionsCancel: { border: '1px solid #cfdce9', borderRadius: 7, background: '#fff', color: '#111827', padding: '7px 12px', fontSize: '.7rem', fontWeight: 700, cursor: 'pointer' },
  editVaccinationDialog: { position: 'relative', width: 'min(614px, 100%)', maxWidth: '100%', maxHeight: 'calc(100vh - 68px)', overflowY: 'auto', boxSizing: 'border-box', background: '#fff', borderRadius: 8, padding: '20px 20px 18px', boxShadow: '0 12px 32px rgba(15,23,42,.28)', color: '#111827' },
  editVaccinationTitle: { margin: 0, color: '#111827', fontSize: '1rem', fontWeight: 700, lineHeight: 1.2 },
  editVaccinationIntro: { margin: '6px 0 14px', color: '#52627a', fontSize: '.75rem', lineHeight: 1.45 },
  verifiedNotice: { display: 'grid', gap: 4, marginBottom: 14, padding: '10px 12px', border: '1px solid #86efac', borderRadius: 8, background: '#f0fdf4', color: '#166534', fontSize: '.76rem', lineHeight: 1.35 },
  verifiedNoticeHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  verifiedIcon: { width: 12, height: 12, display: 'inline-flex', marginRight: 5, verticalAlign: 'middle' },
  verificationWarning: { color: '#b45309', fontSize: '.72rem' },
  removeVerification: { border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', color: '#b91c1c', padding: '6px 9px', fontSize: '.68rem', cursor: 'pointer' },
  editVaccinationGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' },
  editVaccinationLabel: { display: 'flex', flexDirection: 'column', gap: 4, color: '#111827', fontSize: '.75rem', fontWeight: 700 },
  editVaccinationInput: { width: '100%', boxSizing: 'border-box', border: 0, borderRadius: 7, background: '#f1f1f3', color: '#1f2937', padding: '8px 9px', fontSize: '.75rem', outline: 'none', minHeight: 33 },
  proofImage: { marginTop: 14, padding: '10px 12px', border: '1px solid #dbe3ee', borderRadius: 9, background: '#f8fafc', color: '#004f43', fontSize: '.68rem' },
  proofIcon: { width: 13, height: 13, display: 'inline-flex', marginRight: 5, verticalAlign: 'middle' },
  proofContent: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 },
  proofPreview: { display: 'grid', placeItems: 'center', alignContent: 'center', width: 67, height: 53, border: '1px solid #cbd5e1', borderRadius: 5, background: 'linear-gradient(135deg, #fff 0 38%, #f7d9e8 38% 48%, #fff 48% 62%, #c8e6f2 62% 72%, #fff 72%)', color: '#475569', fontSize: '.55rem', lineHeight: 1.1 },
  proofPreviewMark: { fontSize: '1.1rem', color: '#7c3aed' },
  proofCaption: { display: 'block', marginBottom: 5, color: '#334155', fontSize: '.62rem' },
  proofButtons: { display: 'flex', gap: 7 },
  smallSecondary: { border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#111827', padding: '5px 8px', fontSize: '.62rem', cursor: 'pointer' },
  editAudit: { marginTop: 13, color: '#005447', fontSize: '.64rem' },
  editAuditEntries: { display: 'grid', gap: 3, marginTop: 7, paddingLeft: 10, borderLeft: '2px solid #dbe3ee', color: '#005447', lineHeight: 1.3 },
  editVaccinationFooter: { display: 'flex', justifyContent: 'flex-end', gap: 7, marginTop: 16 },
  addVaccinationDialog: { position: 'relative', width: 'min(600px, 100%)', maxWidth: '100%', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto', boxSizing: 'border-box', background: '#fff', borderRadius: 8, padding: '22px 24px 20px', boxShadow: '0 12px 32px rgba(15,23,42,.28)', color: '#111827' },
  addVaccinationTitle: { margin: 0, color: '#111827', fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.25 },
  addVaccinationIntro: { margin: '6px 0 14px', color: '#52627a', fontSize: '.72rem', lineHeight: 1.4 },
  addVaccinationGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' },
  addVaccinationLabel: { display: 'flex', flexDirection: 'column', gap: 6, color: '#111827', fontSize: '.7rem', fontWeight: 700 },
  addVaccinationLabelText: { display: 'inline-flex', alignItems: 'center', lineHeight: 1.2 },
  addVaccinationInput: { width: '100%', boxSizing: 'border-box', border: 0, borderRadius: 7, background: '#f1f1f3', color: '#1f2937', padding: '8px 9px', fontSize: '.72rem', outline: 'none', minHeight: 33 },
  captureSticker: { marginTop: 14, padding: '11px 12px', border: '1px solid #dbe3ee', borderRadius: 9, background: '#f8fafc', color: '#004f43', fontSize: '.72rem' },
  captureStickerText: { color: '#52627a', fontSize: '.68rem' },
  captureStickerDescription: { margin: '8px 0 9px', color: '#52627a', fontSize: '.68rem', lineHeight: 1.4 },
  stickerSelected: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 9, borderTop: '1px solid #dbe3ee', color: '#334155', fontSize: '.68rem' },
  stickerPreview: { width: 42, height: 34, objectFit: 'cover', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' },
  removeSticker: { marginLeft: 'auto', border: 0, background: 'transparent', color: '#b91c1c', fontSize: '.66rem', cursor: 'pointer' },
  addVaccinationFooter: { display: 'flex', justifyContent: 'flex-end', gap: 7, marginTop: 16 },
  doctorAppointmentDialog: { position: 'relative', width: 'min(560px, calc(100vw - 24px))', maxWidth: '100%', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto', boxSizing: 'border-box', border: '1px solid #dcebe5', background: '#fff', borderRadius: 10, padding: '16px 16px 14px', boxShadow: '0 18px 50px rgba(15,23,42,.22)', color: '#173d37' },
  doctorAppointmentTitle: { margin: 0, color: '#004f43', fontSize: '1.05rem', fontWeight: 700 },
  doctorAppointmentIntro: { margin: '4px 0 12px', color: '#647c75', fontSize: '.72rem', lineHeight: 1.4 },
  doctorAppointmentGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 10px' },
  doctorAppointmentLabel: { display: 'flex', minWidth: 0, flexDirection: 'column', gap: 4, color: '#1f2937', fontSize: '.7rem', fontWeight: 650 },
  doctorAppointmentInput: { width: '100%', boxSizing: 'border-box', border: '1px solid #dce7e3', borderRadius: 7, background: '#fff', color: '#1f2937', padding: '7px 10px', font: 'inherit', fontSize: '.72rem', outlineColor: '#005447', minHeight: 36 },
  doctorAppointmentNotes: { width: '100%', minHeight: 52, boxSizing: 'border-box', resize: 'vertical', border: '1px solid #dce7e3', borderRadius: 7, background: '#fff', color: '#1f2937', padding: '8px 10px', fontFamily: 'inherit', fontSize: '.72rem', outlineColor: '#005447' },
  doctorAppointmentFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5eee9' },
  doctorAppointmentDisabled: { background: '#d1d5db', color: '#6b7280', cursor: 'not-allowed' },
};

const vaccinationActionButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  minHeight: 48,
  boxSizing: 'border-box',
  border: '1px solid #e2e5eb',
  borderRadius: 8,
  background: '#fff',
  color: '#374151',
  padding: '10px 12px',
  fontSize: '.82rem',
  textAlign: 'left',
  cursor: 'pointer',
};

const vaccinationActionIconStyle = {
  width: 17,
  height: 17,
  display: 'flex',
  flexShrink: 0,
};

function OwnersTab({ owners, user, onOwnersChange }) {
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [ownerDetailsTab, setOwnerDetailsTab] = useState('details');
  const [actionOwner, setActionOwner] = useState(null);
  const [localOwners, setLocalOwners] = useState(null);
  const [archiveError, setArchiveError] = useState('');
  const displayedOwners = localOwners || owners || [];
  const filtered = displayedOwners.filter(o => Boolean(o.archived) === showArchived && [o.id, o.name, o.phone, o.email, o.address].some(value => String(value || '').toLowerCase().includes(search.toLowerCase())));
  const ownerStatusCounts = {
    active: displayedOwners.filter(owner => !owner.archived).length,
    archived: displayedOwners.filter(owner => owner.archived).length,
  };
  const archiveOwner = async owner => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const query = user.clinic_id ? `?clinic_id=${encodeURIComponent(user.clinic_id)}` : '';
    const response = await fetch(`${apiUrl}/clinic-records/clients/${owner.id}/archive${query}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: !owner.archived }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Unable to update the owner record.');
    }
    const saved = await response.json();
    const updatedOwners = displayedOwners.map(item => item.id === owner.id ? { ...item, ...saved } : item);
    setLocalOwners(updatedOwners);
    onOwnersChange?.(updatedOwners);
    notifySuccess(`${saved.name} ${saved.archived ? 'archived' : 'restored'} successfully!`, '');
    return true;
  };
  const addOwner = async owner => {
    if (!user.clinic_id) {
      throw new Error('Your account is not assigned to a clinic. Ask the clinic owner to assign your clinic before adding an owner.');
    }
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    const query = user.clinic_id ? `?clinic_id=${encodeURIComponent(user.clinic_id)}` : '';
    const response = await fetch(`${apiUrl}/clinic-records/clients${query}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(owner),
      headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload.error || Object.values(payload.fields || {})[0];
      const message = response.status === 404
        ? `Owner API route not found at ${apiUrl}. Restart the backend server and reload the admin page.`
        : detail || `Unable to save this owner (HTTP ${response.status}).`;
      const submitError = new Error(message);
      submitError.fields = payload.fields || {};
      throw submitError;
    }
    const updatedOwners = [...displayedOwners.filter(item => String(item.id) !== String(payload.id)), payload];
    setLocalOwners(updatedOwners);
    onOwnersChange?.(updatedOwners);
    setAddOpen(false);
    notifySuccess('New owner added successfully!', `${payload.name} was saved. Phone verification is still pending.`);
  };
  const exportRows = filtered.length ? filtered : displayedOwners;
  const exportCsv = () => {
    const csv = [['Owner ID', 'Name', 'Contact Number', 'Email', 'Address', 'Pets'], ...exportRows.map(o => [o.id, o.name, o.phone, o.email, o.address, o.pets])].map(row => row.map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = 'owners.csv'; link.click(); URL.revokeObjectURL(url); setShowExport(false);
  };
  const exportPdf = () => {
    const pdf = new jsPDF({ orientation: 'landscape' });
    pdf.setFontSize(16); pdf.text('Owners Management', 14, 16); pdf.setFontSize(9);
    pdf.text('Owner ID   Name   Contact Number   Email   Address   Pets', 14, 26);
    exportRows.forEach((owner, index) => pdf.text(`${owner.id}   ${owner.name}   ${owner.phone || '—'}   ${owner.email || '—'}   ${owner.address || '—'}   ${owner.pets || 0}`, 14, 34 + index * 7));
    pdf.save('owners.pdf'); setShowExport(false);
  };
  return <div className="clinic-management-tab" style={{ ...T.wrap, padding: '20px 20px 18px', borderRadius: 14 }}>
    {addOpen && <AddOwnerModal onClose={() => setAddOpen(false)} onAdd={addOwner} />}
  {actionOwner && <RecordActionsModal
    title="Owner Actions"
    recordLabel={`Owner #${actionOwner.id}`}
    recordName={actionOwner.name || 'Owner'}
    hideRecordSubtitle
    recordMeta={`${actionOwner.phone || 'No phone'} · ${actionOwner.email || 'No email'}`}
    onClose={() => setActionOwner(null)}
    error={archiveError}
    actions={[
      { label: 'View Details', description: 'Review the owner profile and linked pets.', onClick: () => { setOwnerDetailsTab('details'); setSelectedOwner(actionOwner); } },
      { label: 'Audit History', description: 'Review recorded changes to this owner profile.', onClick: () => { setOwnerDetailsTab('audit'); setSelectedOwner(actionOwner); } },
      { label: actionOwner.archived ? 'Restore Owner' : 'Archive Owner', description: actionOwner.archived ? 'Return this owner record to the active list.' : 'Move this owner record out of the active list.', destructive: !actionOwner.archived, onClick: async () => {
        try {
          await archiveOwner(actionOwner);
          setArchiveError('');
          setActionOwner(null);
        } catch (error) {
          setArchiveError(error.message || 'Unable to update the owner record.');
        }
      } },
    ]}
  />}
  {selectedOwner && <OwnerDetailsModal
    owner={selectedOwner}
    initialTab={ownerDetailsTab}
    onBack={() => setSelectedOwner(null)}
    onClose={() => { setSelectedOwner(null); setActionOwner(null); }}
  />}
    <div className="lab-results-header">
      <div>
        <h2 className="lab-results-title">Owners Management</h2>
        <p className="lab-results-description">Manage owner profiles, contact details, and linked pets.</p>
      </div>
    </div>
    <div className="lab-status-row clinic-management-status-row clinic-archive-status-row">
      <div className="lab-status-filters" role="tablist" aria-label="Owner record status">
        <button type="button" role="tab" aria-selected={!showArchived} className={!showArchived ? 'active' : ''} onClick={() => setShowArchived(false)}>Active<span>{ownerStatusCounts.active}</span></button>
        <button type="button" role="tab" aria-selected={showArchived} className={showArchived ? 'active' : ''} onClick={() => setShowArchived(true)}>Archived<span>{ownerStatusCounts.archived}</span></button>
      </div>
      <button type="button" className="lab-results-add" onClick={() => setAddOpen(true)}>{Icons.plus} Add New Owner</button>
    </div>
    <label className="lab-results-search clinic-management-search">
      {Icons.search}
      <input type="search" aria-label="Search owners" placeholder="Search owners..." value={search} onChange={event => setSearch(event.target.value)} />
    </label>
    {archiveError && <div role="alert" style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: '.78rem' }}>{archiveError}</div>}
    <section className="lab-results-list clinic-management-list">
      <div className="lab-results-table-wrap">
        <table className="lab-results-table clinic-management-table clinic-owner-record-table">
          <colgroup>
            <col style={{ width: '8%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '31%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '4%' }} />
          </colgroup>
          <thead><tr><th>Owner ID</th><th>Name</th><th>Contact Number</th><th>Email</th><th>Address</th><th>Pets</th><th aria-label="Open owner actions" /></tr></thead>
          <tbody>{filtered.map(o => {
            const openActions = () => { setArchiveError(''); setActionOwner(o); };
            return <tr key={o.id} className="clinic-action-row" tabIndex={0} onClick={openActions} onKeyDown={event => handleClinicActionRowKeyDown(event, openActions)}>
            <td data-label="Owner ID">{o.id}</td>
            <td data-label="Name"><strong className="clinic-management-primary">{o.name || 'Owner name not recorded'}</strong></td>
            <td data-label="Contact Number">{o.phone || 'Phone not recorded'}</td>
            <td data-label="Email">{o.email || 'Email not recorded'}</td>
            <td data-label="Address">{o.address || 'Address not recorded'}</td>
            <td data-label="Pets"><span className="clinic-management-count">{Number(o.pets) || 0} {Number(o.pets) === 1 ? 'pet' : 'pets'}</span></td>
            <td className="clinic-compact-chevron"><button type="button" className="clinic-record-actions-trigger" onClick={event => { event.stopPropagation(); openActions(); }} aria-label={`Open actions for owner ${o.name}`} aria-haspopup="dialog" title={`Owner actions for ${o.name}`}>{Icons.chevronRight}</button></td>
          </tr>;
          })}
          {!filtered.length && <tr><td className="lab-results-empty" colSpan="7">No owners match the selected search.</td></tr>}</tbody>
        </table>
      </div>
    </section>
  </div>;
}

const exportStyles = { item: { display: 'block', width: '100%', border: 0, background: '#fff', color: '#111827', textAlign: 'left', padding: '7px 9px', borderRadius: 5, fontSize: '.75rem', cursor: 'pointer' } };
const archiveToggleStyle = {
  ...T.secondaryBtn,
  padding: '6px 12px',
  fontSize: '.75rem',
};
const archiveToggleActiveStyle = {
  background: '#005447',
  borderColor: '#005447',
  color: '#fff',
};

// ── PETS TAB ───────────────────────────────────────────────────────────
function PetDetailsModal({ pet, onClose, onBack, onUploadPhoto, initialTab = 'details' }) {
  const isAudit = initialTab === 'audit';
  const [photoError, setPhotoError] = useState('');
  const [photoSaving, setPhotoSaving] = useState(false);
  const photoInputRef = useRef(null);
  const handlePhotoSelected = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoError('');
    setPhotoSaving(true);
    try {
      await onUploadPhoto(pet, file);
    } catch (error) {
      setPhotoError(error.message || 'Unable to upload the pet photo.');
    } finally {
      setPhotoSaving(false);
    }
  };
  return <OwnerModal onClose={onClose} width={isAudit ? 850 : 640} className={`clinic-record-details-modal${isAudit ? ' clinic-record-audit-modal lab-audit-dialog' : ''}`} labelledBy="pet-details-title">
    <div className={`clinic-record-details-header${isAudit ? ' lab-audit-header' : ''}`}>
      <div><h2 id="pet-details-title" style={modalStyles.title}>Pet {isAudit ? 'Audit History' : 'Details'}</h2>
        {isAudit && <p style={modalStyles.subtitle}>{pet.name} · Recorded changes to this pet profile</p>}</div>
    </div>
    {!isAudit ? <div className="record-details-content">
      <div className="record-details-profile">
        {pet.photo_url
          ? <img src={pet.photo_url} alt={`${pet.name} profile`} />
          : <div className="record-details-avatar" aria-hidden="true">{pet.name?.trim()?.charAt(0)?.toUpperCase() || '?'}</div>}
        <div>
          <h3>{pet.name}</h3>
          <p>{[pet.species, pet.breed, pet.sex && pet.sex !== 'unknown' ? pet.sex : ''].filter(Boolean).join(' · ')}</p>
          <span>{pet.birth_date ? `Born ${formatDateText(String(pet.birth_date).slice(0, 10))}` : 'Date of birth not recorded'} · {pet.weight || (pet.metadata?.weight ? `${pet.metadata.weight} kg` : 'Weight not recorded')}</span>
          <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoSaving} style={{ ...T.primaryBtn, marginTop: 10, padding: '7px 11px', fontSize: '.75rem' }}>
            {photoSaving ? 'Uploading photo…' : pet.photo_url ? 'Change Photo' : 'Add Photo'}
          </button>
          <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoSelected} style={{ display: 'none' }} />
          <small style={{ display: 'block', marginTop: 5, color: '#64748b', fontSize: '.7rem' }}>JPEG, PNG, or WEBP · up to 1 MB</small>
          {photoError && <div role="alert" style={{ marginTop: 5, color: '#b91c1c', fontSize: '.72rem' }}>{photoError}</div>}
        </div>
        {pet.allergies && pet.allergies !== 'Not recorded' && <aside><b>Known allergies</b><span>{pet.allergies}</span></aside>}
      </div>
      <RecordDetailSection title="Basic Information" items={[
        ['Pet ID', pet.id], ['Species', pet.species], ['Breed', pet.breed],
        ['Gender', pet.sex && pet.sex !== 'unknown' ? pet.sex : 'Not recorded'],
        ['Date of birth', pet.birth_date ? formatDateText(String(pet.birth_date).slice(0, 10)) : 'Not recorded'],
        ['Age', pet.age || calculatePatientAge(pet.birth_date) || 'Not recorded'],
        ['Weight', pet.weight || (pet.metadata?.weight ? `${pet.metadata.weight} kg` : 'Not recorded')], ['Color', pet.color],
      ]} />
      <RecordDetailSection title="Health & Identification" items={[
        ['Known allergies', pet.allergies && pet.allergies !== 'Not recorded' ? pet.allergies : 'None reported'],
        ['Microchip ID', pet.microchip], ['Health status', pet.status || 'Not recorded'],
      ]} />
      <RecordDetailSection title="Owner Information" items={[
        ['Owner', pet.owner], ['Contact number', pet.owner_phone || pet.phone], ['Email', pet.owner_email || pet.email],
      ]} />
    </div> : <div className="clinic-record-audit-panel lab-audit-content">
      <section className="lab-audit-timeline clinic-record-audit-timeline">
        <h3>Activity Timeline</h3>
        <ol>
          <AuditTimelineEntry date="Apr 22, 2026 · 3:45 PM" dateTime="2026-04-22T15:45:00" title="Updated pet information" detail="Updated pet record during checkup." actor="Dr. Sarah Chen" changes={[{ field: 'Weight', previous: '28 kg', next: pet.weight || '30 kg' }]} />
          <AuditTimelineEntry date="Mar 15, 2026 · 10:30 AM" dateTime="2026-03-15T10:30:00" title="Created" detail={`Created new pet record for ${pet.name}.`} actor="Dr. Sarah Chen" />
        </ol>
      </section>
    </div>}
    <RecordDetailsFooter onBack={onBack} onClose={onClose} />
  </OwnerModal>;
}

function AddPetModal({ owners, onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', species: '', breed: '', sex: 'unknown', birth_date: '', weight: '', color: '', microchip: '', allergies: '', age: '', client_id: '', notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const submit = async event => {
    event.preventDefault();
    const errors = {};
    if (!/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(form.name.trim())) errors.name = 'Enter a valid pet name.';
    if (!form.species) errors.species = 'Select a species.';
    if (!form.breed.trim()) errors.breed = 'Enter the breed.';
    if (!form.client_id) errors.client_id = 'Select a registered owner.';
    if (Object.keys(errors).length) { setError(Object.values(errors)[0]); return; }
    setSaving(true); setError('');
    try { await onAdd({ ...form, name: form.name.trim(), breed: form.breed.trim(), notes: form.notes.trim() }); }
    catch (submitError) { setError(submitError.message); }
    finally { setSaving(false); }
  };
  return <OwnerModal onClose={onClose} width={720} className="clinic-pet-add-dialog">
    <h2 style={modalStyles.title}>Add New Pet</h2><p style={modalStyles.subtitle}>Enter the details of the new pet.</p>
    <form onSubmit={submit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <label style={modalStyles.label}><span>Pet Name<span style={modalStyles.required}>*</span></span><input autoFocus value={form.name} onChange={e => update('name', e.target.value)} placeholder="Max" style={modalStyles.input} /></label>
        <label style={modalStyles.label}><span>Species<span style={modalStyles.required}>*</span></span><select value={form.species} onChange={e => update('species', e.target.value)} style={modalStyles.input}><option value="">Select species</option><option>Dog</option><option>Cat</option><option>Bird</option><option>Rabbit</option><option>Other</option></select></label>
        <label style={modalStyles.label}><span>Breed<span style={modalStyles.required}>*</span></span><input value={form.breed} onChange={e => update('breed', e.target.value)} placeholder="Golden Retriever" style={modalStyles.input} /></label>
        <label style={modalStyles.label}>Gender<select value={form.sex} onChange={e => update('sex', e.target.value)} style={modalStyles.input}><option value="unknown">Not recorded</option><option value="male">Male</option><option value="female">Female</option></select></label>
        <label style={modalStyles.label}>Date of birth<LabDateTimePicker mode="date" value={form.birth_date} onChange={birth_date => update('birth_date', birth_date)} style={modalStyles.input} /></label>
        <label style={modalStyles.label}>Weight (kg)<input type="number" min="0" step="0.1" value={form.weight} onChange={e => update('weight', e.target.value)} placeholder="e.g. 5" style={modalStyles.input} /></label>
        <label style={modalStyles.label}>Color<input value={form.color} onChange={e => update('color', e.target.value)} placeholder="White & Brown" style={modalStyles.input} /></label>
        <label style={modalStyles.label}>Microchip ID<input value={form.microchip} onChange={e => update('microchip', e.target.value)} style={modalStyles.input} /></label>
      </div>
      <label style={modalStyles.label}><span>Owner<span style={modalStyles.required}>*</span></span><select value={form.client_id} onChange={e => update('client_id', e.target.value)} style={modalStyles.input}><option value="">Select owner</option>{owners.filter(owner => !owner.archived).map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
      <label style={modalStyles.label}>Known allergies<textarea value={form.allergies} onChange={e => update('allergies', e.target.value)} placeholder="Enter allergies, or leave blank if none reported" style={{ ...modalStyles.input, minHeight: 54, resize: 'vertical' }} /></label>
      <label style={modalStyles.label}>Medical Notes<textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Any relevant medical history..." style={{ ...modalStyles.input, minHeight: 64, resize: 'vertical' }} /></label>
      {error && <div style={modalStyles.error}>{error}</div>}
      <div style={modalStyles.footer}><button type="button" onClick={onClose} style={modalStyles.cancel}>Cancel</button><button type="submit" style={T.primaryBtn} disabled={saving}>{saving ? 'Saving...' : 'Add Pet'}</button></div>
    </form>
  </OwnerModal>;
}

function TransferPetModal({ pet, owners, onClose, onTransfer }) {
  const [clientId, setClientId] = useState('');
  const [error, setError] = useState('');
  const currentOwner = owners.find(owner => String(owner.id) === String(pet.client_id))?.name || pet.owner || '—';
  const submit = async event => {
    event.preventDefault();
    if (!clientId || String(clientId) === String(pet.client_id)) { setError('Select a different registered owner.'); return; }
    try { await onTransfer(pet, clientId); } catch (transferError) { setError(transferError.message); }
  };
  return <OwnerModal onClose={onClose} width={520}>
    <h2 style={modalStyles.title}>Transfer Pet to New Owner</h2><p style={modalStyles.subtitle}>Transfer {pet.name} to a different registered owner.</p>
    <div style={{ margin: '16px 0', padding: '12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, color: '#92400e', fontSize: '.78rem' }}><b>Note:</b> This will update the pet's owner record. All medical history will transfer with the pet.</div>
    <div style={modalStyles.detailField}><b>Current Owner</b><span style={{ width: '100%', padding: '10px', background: '#f8fafc', borderRadius: 7 }}>{currentOwner}</span></div>
    <form onSubmit={submit}><label style={{ ...modalStyles.label, marginTop: 16 }}><span>Transfer To (New Owner)<span style={modalStyles.required}>*</span></span><select value={clientId} onChange={e => setClientId(e.target.value)} style={modalStyles.input}><option value="">Select new owner</option>{owners.filter(owner => !owner.archived && String(owner.id) !== String(pet.client_id)).map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
      {error && <div style={modalStyles.error}>{error}</div>}<div style={modalStyles.footer}><button type="button" onClick={onClose} style={modalStyles.cancel}>Cancel</button><button type="submit" style={T.primaryBtn}>Confirm Transfer</button></div>
    </form>
  </OwnerModal>;
}

function getPetPhotoUrl(pet) {
  return pet?.photo_url || pet?.photoUrl || pet?.profile_photo_url || pet?.avatar_url || '';
}

function handleClinicActionRowKeyDown(event, openActions) {
  if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  openActions();
}

function PetsTab({ pets, owners, user, onPetsChange, onOwnersChange }) {
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [speciesFilter, setSpeciesFilter] = useState('all');
  const [showExport, setShowExport] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  const [petDetailsTab, setPetDetailsTab] = useState('details');
  const [actionPet, setActionPet] = useState(null);
  const [petActionError, setPetActionError] = useState('');
  const [transferPet, setTransferPet] = useState(null);
  const [localPets, setLocalPets] = useState(null);
  const ownerRows = owners || [];
  const displayedPets = localPets || pets || [];
  const petStatusCounts = {
    active: displayedPets.filter(pet => !pet.archived).length,
    archived: displayedPets.filter(pet => pet.archived).length,
  };
  const speciesOptions = [...new Set(displayedPets
    .filter(pet => Boolean(pet.archived) === showArchived)
    .map(pet => String(pet.species || '').trim() || 'Not specified'))]
    .sort((first, second) => first.localeCompare(second));
  const selectedPetRecord = selectedPet
    ? displayedPets.find(pet => String(pet.id) === String(selectedPet.id))
    : null;
  const petDetails = selectedPetRecord
    ? { ...selectedPetRecord, ...selectedPet, photo_url: getPetPhotoUrl(selectedPet) || getPetPhotoUrl(selectedPetRecord) }
    : selectedPet;
  const filtered = displayedPets.filter(p => (
    Boolean(p.archived) === showArchived &&
    (speciesFilter === 'all' || (String(p.species || '').trim() || 'Not specified').toLowerCase() === speciesFilter.toLowerCase()) &&
    [p.id, p.name, p.species, p.breed, p.owner, p.status]
      .some(value => String(value || '').toLowerCase().includes(search.toLowerCase()))
  ));
  const api = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const request = async (url, options) => {
    const response = await fetch(url, options);
    const responseText = await response.text();
    let body = {};
    try {
      body = responseText ? JSON.parse(responseText) : {};
    } catch {
      body = {};
    }
    if (!response.ok) {
      const fieldError = Object.values(body.fields || {}).find(value => typeof value === 'string');
      if (url.includes('/clinic-records/pets/') && url.includes('/photo') && response.status === 404 && !body.error) {
        throw new Error('The API server does not have the pet-photo upload route yet. Restart the backend server, then try again.');
      }
      throw new Error(body.error || fieldError || `Unable to save pet (HTTP ${response.status}).`);
    }
    return body;
  };
  const addPet = async pet => {
    if (!user.clinic_id) throw new Error('Your account is not assigned to a clinic.');
    const saved = await request(`${api}/clinic-records/pets?clinic_id=${user.clinic_id}`, { method: 'POST', headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(pet) });
    const owner = ownerRows.find(item => String(item.id) === String(saved.client_id));
    const savedPet = {
      ...saved,
      age: saved.age || pet.age,
      weight: saved.weight || pet.weight,
      allergies: saved.allergies || saved.metadata?.allergies || pet.allergies || 'Not recorded',
      owner: owner?.name || 'Unknown',
    };
    const updatedPets = [...displayedPets.filter(item => String(item.id) !== String(savedPet.id)), savedPet];
    setLocalPets(updatedPets);
    onPetsChange?.(updatedPets);
    if (owner) onOwnersChange?.(ownerRows.map(item => item.id === owner.id ? { ...item, pets: Number(item.pets || 0) + 1, pet_names: [...new Set([...(item.pet_names || []), savedPet.name])] } : item));
    setAddOpen(false);
    notifySuccess('New pet added successfully!', `${saved.name} was saved in the clinic database.`);
  };
  const uploadPetPhoto = async (pet, file) => {
    if (!user.clinic_id || !user.token) throw new Error('Your account is not assigned to a clinic.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WEBP image.');
    if (file.size > 1_048_576) throw new Error('Choose an image smaller than 1 MB.');
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read the selected image.'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
    const saved = await request(`${api}/clinic-records/pets/${pet.id}/photo?clinic_id=${user.clinic_id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, content_type: file.type, data }),
    });
    const updatedPet = { ...pet, photo_url: saved.photo_url };
    const updatedPets = (localPets || displayedPets).map(item => item.id === pet.id ? updatedPet : item);
    setLocalPets(updatedPets);
    onPetsChange?.(updatedPets);
    setSelectedPet(updatedPet);
    notifySuccess('Pet photo updated', `${pet.name}'s profile photo was saved.`);
  };
  const archivePet = async pet => {
    if (!Number.isInteger(Number(pet.id))) {
      const saved = { ...pet, archived: !pet.archived };
      setLocalPets(displayedPets.map(item => item.id === pet.id ? saved : item));
      notifySuccess(`${pet.name} ${saved.archived ? 'archived' : 'restored'} successfully!`, '');
      return true;
    }
    const saved = await request(`${api}/clinic-records/pets/${pet.id}/archive?clinic_id=${user.clinic_id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: !pet.archived }) });
    const updatedPets = displayedPets.map(item => item.id === pet.id ? { ...item, ...saved } : item);
    setLocalPets(updatedPets);
    onPetsChange?.(updatedPets);
    notifySuccess(`${pet.name} ${saved.archived ? 'archived' : 'restored'} successfully!`, '');
    return true;
  };
  const transfer = async (pet, client_id) => { const saved = await request(`${api}/clinic-records/pets/${pet.id}?clinic_id=${user.clinic_id}`, { method: 'PUT', headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id }) }); const owner = owners.find(item => String(item.id) === String(client_id)); setLocalPets(displayedPets.map(item => item.id === pet.id ? { ...item, ...saved, owner: owner?.name || item.owner, client_id } : item)); setTransferPet(null); notifySuccess('Pet transferred successfully!', `${pet.name} is now registered to ${owner?.name || 'the new owner'}.`); };
  const exportCsv = () => {
    const rows = [['Pet ID', 'Name', 'Species', 'Breed', 'Owner', 'Health Status'],
      ...filtered.map(p => [p.id, p.name, p.species, p.breed, p.owner, p.status])];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `pets-${showArchived ? 'archived' : 'active'}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setShowExport(false);
  };
  const exportPdf = () => {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const columns = [
      ['Pet ID', 14], ['Name', 34], ['Species', 62], ['Breed', 84],
      ['Owner', 132], ['Health Status', 218],
    ];
    const value = item => String(item || '—').replace(/\s+/g, ' ').slice(0, 24);
    pdf.setFontSize(16);
    pdf.text('Pets Management', 14, 16);
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`${showArchived ? 'Archived' : 'Active'} records · ${filtered.length} total`, 14, 22);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    columns.forEach(([label, x]) => pdf.text(label, x, 32));
    pdf.setFont('helvetica', 'normal');
    filtered.forEach((pet, index) => {
      const y = 40 + index * 8;
      if (y > 190) {
        pdf.addPage();
        pdf.setFont('helvetica', 'bold');
        columns.forEach(([label, x]) => pdf.text(label, x, 16));
        pdf.setFont('helvetica', 'normal');
      }
      const rowY = y > 190 ? 24 : y;
      [pet.id, pet.name, pet.species, pet.breed, pet.owner, pet.status]
        .forEach((item, columnIndex) => pdf.text(value(item), columns[columnIndex][1], rowY));
    });
    pdf.save(`pets-${showArchived ? 'archived' : 'active'}.pdf`);
    setShowExport(false);
  };
  return (
    <div className="clinic-management-tab" style={{ ...T.wrap, padding: '20px 20px 18px', borderRadius: 14 }}>
      {addOpen && <AddPetModal owners={ownerRows} onClose={() => setAddOpen(false)} onAdd={addPet} />}
      {actionPet && <RecordActionsModal
        title="Pet Actions"
        recordLabel={`Pet #${actionPet.id}`}
        recordName={actionPet.name || 'Pet'}
        recordMeta={`${actionPet.species || 'Species not recorded'} · ${actionPet.owner || 'Owner not recorded'}`}
        recordPhoto={getPetPhotoUrl(actionPet)}
        showPetAvatar
        onClose={() => { setActionPet(null); setPetDetailsTab('details'); }}
        error={petActionError}
        actions={[
          { label: 'View Details', description: 'Review the pet profile and health information.', onClick: () => { setPetDetailsTab('details'); setSelectedPet(actionPet); } },
          { label: 'Transfer Pet', description: 'Transfer this pet to a different registered owner.', onClick: () => { setTransferPet(actionPet); setActionPet(null); } },
          { label: 'Audit History', description: 'Review recorded changes to this pet profile.', onClick: () => { setPetDetailsTab('audit'); setSelectedPet(actionPet); } },
          { label: actionPet.archived ? 'Restore Pet' : 'Archive Pet', description: actionPet.archived ? 'Return this pet record to the active list.' : 'Move this pet record out of the active list.', destructive: !actionPet.archived, onClick: async () => {
            try {
              await archivePet(actionPet);
              setPetActionError('');
              setActionPet(null);
            } catch (error) {
              setPetActionError(error.message || 'Unable to update the pet record.');
            }
          } },
        ]}
      />}
      {petDetails && <PetDetailsModal
        pet={petDetails}
        initialTab={petDetailsTab}
        onBack={() => setSelectedPet(null)}
        onClose={() => { setSelectedPet(null); setActionPet(null); setPetDetailsTab('details'); }}
        onUploadPhoto={uploadPetPhoto}
      />}
      {transferPet && <TransferPetModal pet={transferPet} owners={ownerRows} onClose={() => setTransferPet(null)} onTransfer={transfer} />}
      <div className="lab-results-header">
        <div>
          <h2 className="lab-results-title">Pets Management</h2>
          <p className="lab-results-description">Manage registered pets, profiles, owners, and health status.</p>
        </div>
      </div>
      <div className="lab-status-row clinic-management-status-row clinic-archive-status-row">
        <div className="lab-status-filters" role="tablist" aria-label="Pet record status">
          <button type="button" role="tab" aria-selected={!showArchived} className={!showArchived ? 'active' : ''} onClick={() => setShowArchived(false)}>Active<span>{petStatusCounts.active}</span></button>
          <button type="button" role="tab" aria-selected={showArchived} className={showArchived ? 'active' : ''} onClick={() => setShowArchived(true)}>Archived<span>{petStatusCounts.archived}</span></button>
        </div>
        <button type="button" className="lab-results-add" onClick={() => setAddOpen(true)}>{Icons.plus} Add New Pet</button>
      </div>
      <div className="lab-filter-bar clinic-pet-filter-bar">
        <label className="lab-results-search clinic-management-search">
          {Icons.search}
          <input type="search" aria-label="Search pets" placeholder="Search pets..." value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <FilterSelect
          label="Filter by species"
          className="lab-records-filter-select"
          value={speciesFilter}
          onChange={setSpeciesFilter}
          options={[{ value: 'all', label: 'All Species' }, ...speciesOptions.map(species => ({ value: species, label: species }))]}
        />
      </div>
      <section className="lab-results-list clinic-management-list">
      <div className="lab-results-table-wrap">
      <table className="lab-results-table clinic-management-table clinic-pet-record-table">
        <colgroup>
          <col style={{ width: '9%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '4%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>Pet ID</th>
            <th>Name</th>
            <th>Species</th>
            <th>Breed</th>
            <th>Owner</th>
            <th>Health Status</th>
            <th aria-label="Open pet actions" />
          </tr>
        </thead>
        <tbody>
          {filtered.map(p => {
            const openActions = () => { setPetActionError(''); setActionPet(p); };
            return <tr key={p.id} className="clinic-action-row" tabIndex={0} onClick={openActions} onKeyDown={event => handleClinicActionRowKeyDown(event, openActions)}>
              <td data-label="Pet ID">{p.id}</td>
              <td data-label="Name"><span className="clinic-pet-table-name">
                {getPetPhotoUrl(p)
                  ? <img src={getPetPhotoUrl(p)} alt="" />
                  : <span className="clinic-pet-table-avatar" aria-hidden="true">{p.name?.trim()?.charAt(0)?.toUpperCase() || '?'}</span>}
                <strong>{p.name || 'Pet name not recorded'}</strong>
              </span></td>
              <td data-label="Species">{p.species || 'Not recorded'}</td>
              <td data-label="Breed">{p.breed || 'Not recorded'}</td>
              <td data-label="Owner">{p.owner || 'Not recorded'}</td>
              <td data-label="Health Status">{p.status || 'Not recorded'}</td>
              <td className="clinic-compact-chevron"><button type="button" className="clinic-record-actions-trigger" onClick={event => { event.stopPropagation(); openActions(); }} aria-label={`Open actions for pet ${p.name}`} aria-haspopup="dialog" title={`Pet actions for ${p.name}`}>{Icons.chevronRight}</button></td>
            </tr>;
          })}
          {!filtered.length && <tr><td className="lab-results-empty" colSpan="7">No pets match the selected search.</td></tr>}
        </tbody>
      </table>
      </div>
      </section>
    </div>
  );
}

// ── APPOINTMENTS TAB ───────────────────────────────────────────────────
function AppointmentsTab({ appointments, pets = [], owners = [], vaccinations = [], user, onAppointmentsChange, onVaccinationsChange, onCreateLabRequest, createVisitRequest }) {
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [localAppointments, setLocalAppointments] = useState(null);
  const [actionAppointment, setActionAppointment] = useState(null);
  const [viewAppointment, setViewAppointment] = useState(null);
  const [historyAppointment, setHistoryAppointment] = useState(null);
  const [appointmentAuditEntries, setAppointmentAuditEntries] = useState([]);
  const [appointmentAuditLoading, setAppointmentAuditLoading] = useState(false);
  const [appointmentAuditError, setAppointmentAuditError] = useState('');
  const [archiveError, setArchiveError] = useState('');
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [initialAppointmentType, setInitialAppointmentType] = useState('');
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [practitionerFilter, setPractitionerFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [clinicVeterinarians, setClinicVeterinarians] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  useEffect(() => {
    if (!createVisitRequest) return;
    setInitialAppointmentType('Check-up');
    setShowNewAppointment(true);
  }, [createVisitRequest]);
  const displayedAppointments = localAppointments || appointments || [];
  const getAppointmentDate = appointment => appointment.start_time || appointment.datetime || '';
  const getAppointmentPractitioner = appointment => (
    appointment.practitioner || appointment.veterinarian || appointment.veterinarian_name || appointment.doctor_name || ''
  );
  const getAppointmentDuration = appointment => {
    if (appointment.duration_minutes || appointment.duration) return appointment.duration_minutes || appointment.duration;
    const start = new Date(appointment.start_time).getTime();
    const end = new Date(appointment.end_time).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end > start
      ? Math.round((end - start) / 60000)
      : null;
  };
  const getAppointmentNoteDetails = appointment => {
    if (appointment.notes && typeof appointment.notes === 'object') return appointment.notes;
    if (typeof appointment.notes !== 'string' || !appointment.notes.trim()) return {};
    try {
      const parsed = JSON.parse(appointment.notes);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return { internal_notes: appointment.notes };
    }
    return { internal_notes: appointment.notes };
  };
  const formatDateTime = appointment => {
    const value = getAppointmentDate(appointment);
    if (!value) return { date: '—', time: '' };
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return { date: String(value), time: '' };
    return {
      date: formatDateText(parsed, 'en-US', String(value)),
      time: parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  };
  useEffect(() => {
    if (!historyAppointment) return undefined;
    const controller = new AbortController();
    setAppointmentAuditEntries([]);
    setAppointmentAuditError('');
    if (!user?.clinic_id || !user?.token) {
      setAppointmentAuditLoading(false);
      setAppointmentAuditError('Sign in to this clinic to load appointment audit history.');
      return () => controller.abort();
    }
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    const query = new URLSearchParams({
      clinic_id: String(user.clinic_id),
      table_name: 'appointments',
      record_id: String(historyAppointment.id),
    });
    setAppointmentAuditLoading(true);
    fetch(`${apiUrl}/audit-trail/filter?${query}`, {
      headers: { Authorization: `Bearer ${user.token}` },
      signal: controller.signal,
    }).then(async response => {
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Unable to load appointment audit history (HTTP ${response.status}).`);
      if (!Array.isArray(payload)) throw new Error('The appointment audit endpoint returned an invalid response.');
      setAppointmentAuditEntries(payload);
    }).catch(error => {
      if (error.name !== 'AbortError') setAppointmentAuditError(error.message || 'Unable to load appointment audit history.');
    }).finally(() => {
      if (!controller.signal.aborted) setAppointmentAuditLoading(false);
    });
    return () => controller.abort();
  }, [historyAppointment, user?.clinic_id, user?.token]);
  const archiveAppointment = async appointment => {
    try {
      if (!Number.isInteger(Number(appointment.id))) {
        const saved = { ...appointment, archived: !appointment.archived };
        setLocalAppointments(displayedAppointments.map(item => item.id === appointment.id ? saved : item));
        setPage(1);
        notifySuccess(`Appointment ${appointment.id} ${saved.archived ? 'archived' : 'restored'} successfully!`, '');
        setArchiveError('');
        return true;
      }
      const saved = await updateClinicRecordArchive({ user, endpoint: '/clinic-records/appointments', record: appointment, label: 'appointment' });
      const updatedAppointments = displayedAppointments.map(item => item.id === appointment.id ? { ...item, ...saved } : item);
      setLocalAppointments(updatedAppointments);
      setPage(1);
      onAppointmentsChange?.(updatedAppointments);
      notifySuccess(`Appointment ${appointment.id} ${saved.archived ? 'archived' : 'restored'} successfully!`, '');
      setArchiveError('');
      return true;
    } catch (error) {
      setArchiveError(error.message || 'Unable to update the appointment record.');
      return false;
    }
  };
  const appointmentRecords = displayedAppointments.filter(appointment => Boolean(appointment.archived) === showArchived);
  const appointmentTypeTabs = [
    ['all', 'All Types'], ['check_up', 'Check-up'], ['vaccination', 'Vaccination'], ['treatment', 'Treatment'],
    ['laboratory', 'Laboratory'], ['surgery', 'Surgery'], ['dental', 'Dental'], ['follow_up', 'Follow-up'],
    ['confinement', 'Confinement'], ['grooming', 'Grooming'], ['general', 'General'],
  ];
  const appointmentTypeCategory = appointment => {
    const type = String(appointment.type || appointment.reason || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (type.includes('vaccin')) return 'vaccination';
    if (type.includes('laborat') || type.includes('lab_test') || type === 'lab') return 'laboratory';
    if (type.includes('surg')) return 'surgery';
    if (type.includes('dental')) return 'dental';
    if (type.includes('treat')) return 'treatment';
    if (type.includes('follow')) return 'follow_up';
    if (type.includes('check') || type.includes('consult')) return 'check_up';
    if (type.includes('confin') || type.includes('inpatient')) return 'confinement';
    if (type.includes('groom')) return 'grooming';
    if (type.includes('general')) return 'general';
    return type;
  };
  const statusCounts = {
    all: appointmentRecords.length,
    upcoming: appointmentRecords.filter(appointment => {
      const date = new Date(getAppointmentDate(appointment));
      return !Number.isNaN(date.getTime()) && date >= new Date(new Date().setHours(0, 0, 0, 0))
        && !['cancelled', 'canceled'].includes(String(appointment.status || '').toLowerCase());
    }).length,
    past: appointmentRecords.filter(appointment => {
      const date = new Date(getAppointmentDate(appointment));
      const status = String(appointment.status || '').toLowerCase();
      return !['cancelled', 'canceled'].includes(status) && !Number.isNaN(date.getTime())
        && (date < new Date(new Date().setHours(0, 0, 0, 0)) || ['completed', 'complete', 'no show', 'no-show'].includes(status));
    }).length,
    cancelled: appointmentRecords.filter(appointment => ['cancelled', 'canceled'].includes(String(appointment.status || '').toLowerCase())).length,
  };
  const filtered = appointmentRecords.filter(appointment => {
    const appointmentDate = new Date(getAppointmentDate(appointment));
    const status = String(appointment.status || '').toLowerCase();
    const isCancelled = ['cancelled', 'canceled'].includes(status);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateValue = Number.isNaN(appointmentDate.getTime())
      ? ''
      : `${appointmentDate.getFullYear()}-${String(appointmentDate.getMonth() + 1).padStart(2, '0')}-${String(appointmentDate.getDate()).padStart(2, '0')}`;
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'cancelled' && isCancelled)
      || (statusFilter === 'upcoming' && !isCancelled && !Number.isNaN(appointmentDate.getTime()) && appointmentDate >= today)
      || (statusFilter === 'past' && !isCancelled && !Number.isNaN(appointmentDate.getTime())
        && (appointmentDate < today || ['completed', 'complete', 'no show', 'no-show'].includes(status)));
    return matchesStatus
      && [appointment.id, appointment.pet, appointment.pet_name, appointment.owner, appointment.owner_name, appointment.type, appointment.reason, appointment.status, getAppointmentPractitioner(appointment)]
        .some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase()))
      && (!dateFrom || dateValue >= dateFrom)
      && (!dateTo || dateValue <= dateTo)
      && (practitionerFilter === 'all' || getAppointmentPractitioner(appointment) === practitionerFilter)
      && (typeFilter === 'all' || appointmentTypeCategory(appointment) === typeFilter);
  }).sort((first, second) => new Date(getAppointmentDate(first)).getTime() - new Date(getAppointmentDate(second)).getTime());
  const practitioners = [...new Set(appointmentRecords.map(getAppointmentPractitioner).filter(Boolean))];
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedAppointments = filtered.slice((page - 1) * pageSize, page * pageSize);
  return (
    <div className="clinic-appointments-tab">
      <div className="lab-results-header">
        <div>
          <h2 className="lab-results-title">Appointments</h2>
          <p className="lab-results-description">Manage and view all scheduled appointments.</p>
        </div>
        <button type="button" className="lab-results-add" onClick={() => { setInitialAppointmentType(''); setShowNewAppointment(true); }}>{Icons.plus} New Appointment</button>
      </div>
      <div className="clinic-appointment-type-tabs" role="tablist" aria-label="Filter appointments by type">
        {appointmentTypeTabs.map(([value, label]) => <button
          key={value}
          type="button"
          role="tab"
          aria-selected={typeFilter === value}
          className={typeFilter === value ? 'active' : ''}
          onClick={() => { setTypeFilter(value); setPage(1); }}
        >{label}</button>)}
      </div>
      <div className="lab-filter-bar clinic-appointments-filters">
        <label className="lab-results-search">
          {Icons.search}
          <input type="search" aria-label="Search appointments" placeholder="Search by patient, owner, or appointment number..." value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
        </label>
        <FilterSelect
          className="clinic-appointment-filter-select"
          label="Filter by veterinarian"
          value={practitionerFilter}
          onChange={value => { setPractitionerFilter(value); setPage(1); }}
          options={[{ value: 'all', label: 'Veterinarian' }, ...practitioners.map(name => ({ value: name, label: name }))]}
        />
        <FilterSelect
          className="clinic-appointment-filter-select"
          label="Filter by appointment status"
          value={statusFilter}
          onChange={value => { setStatusFilter(value); setPage(1); }}
          options={[
            { value: 'all', label: `Status: All (${statusCounts.all})` },
            { value: 'upcoming', label: `Upcoming (${statusCounts.upcoming})` },
            { value: 'past', label: `Past (${statusCounts.past})` },
            { value: 'cancelled', label: `Cancelled (${statusCounts.cancelled})` },
          ]}
        />
        <div className="lab-date-range clinic-appointment-date-range">
          <button
            type="button"
            className="lab-date-range-trigger"
            aria-label="Choose appointment date range"
            aria-expanded={dateRangeOpen}
            onClick={() => setDateRangeOpen(open => !open)}
          >
            <span className="lab-date-range-calendar">{Icons.calendar}</span>
            <span>{dateFrom || dateTo ? `${dateFrom || 'Any date'} – ${dateTo || 'Any date'}` : 'Date Range'}</span>
            <span className={`lab-date-range-chevron${dateRangeOpen ? ' open' : ''}`} aria-hidden="true" />
          </button>
          {dateRangeOpen && <div className="lab-date-range-popover" role="group" aria-label="Appointment date range">
            <label>From<LabDateTimePicker label="Start date" mode="date" value={dateFrom} max={dateTo || undefined} onChange={date => { setDateFrom(date); setPage(1); }} /></label>
            <label>To<LabDateTimePicker label="End date" mode="date" value={dateTo} min={dateFrom || undefined} onChange={date => { setDateTo(date); setPage(1); }} /></label>
            <div className="lab-date-range-actions">
              <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}>Clear</button>
              <button type="button" onClick={() => setDateRangeOpen(false)}>Done</button>
            </div>
          </div>}
        </div>
      </div>
      {archiveError && <div className="lab-clinical-history-error" role="alert">{archiveError}</div>}
      <div className="clinic-archive-toolbar">
          <div className="lab-archive-tabs" role="tablist" aria-label="Active and archived appointments">
            <button type="button" role="tab" aria-selected={!showArchived} className={!showArchived ? 'active' : ''} onClick={() => { setShowArchived(false); setPage(1); }}>Active <span>{displayedAppointments.filter(item => !item.archived).length}</span></button>
            <button type="button" role="tab" aria-selected={showArchived} className={showArchived ? 'active' : ''} onClick={() => { setShowArchived(true); setPage(1); }}>Archived <span>{displayedAppointments.filter(item => item.archived).length}</span></button>
          </div>
      </div>
      <section className="lab-results-list clinic-appointments-list">
        <div className="lab-results-table-wrap clinic-appointments-table-wrap">
          <table className="lab-results-table clinic-appointments-table">
            <thead><tr><th>Date &amp; Time</th><th>Patient</th><th>Owner</th><th>Type</th><th>Veterinarian</th><th>Status</th><th className="clinic-action-heading" aria-label="Row actions" /></tr></thead>
            <tbody>
              {paginatedAppointments.map(appointment => {
                const dateTime = formatDateTime(appointment);
                const duration = getAppointmentDuration(appointment);
                const openActions = () => setActionAppointment(appointment);
                return <tr key={appointment.id} className="clinic-action-row" tabIndex={0} onClick={openActions} onKeyDown={event => handleClinicActionRowKeyDown(event, openActions)}>
                  <td data-label="Date & Time"><div className="lab-result-date"><strong>{dateTime.date}</strong>{dateTime.time && <span>{dateTime.time}</span>}</div></td>
                  <td data-label="Patient" className="lab-result-pet">{appointment.pet || appointment.pet_name || '—'}</td>
                  <td data-label="Owner">{appointment.owner || appointment.owner_name || '—'}</td>
                  <td data-label="Type"><div className="lab-result-test"><strong>{appointment.type || appointment.reason || 'Appointment'}</strong>{duration && <span>({duration} min)</span>}</div></td>
                  <td data-label="Veterinarian">{getAppointmentPractitioner(appointment) || '—'}</td>
                  <td data-label="Status"><StatusIndicator status={appointment.status || 'scheduled'} /></td>
                  <td data-label="Actions" className="lab-result-actions">
                    <button
                      type="button"
                      className="lab-row-action-trigger clinic-record-actions-trigger"
                      onClick={event => { event.stopPropagation(); openActions(); }}
                      aria-label={`Actions for appointment ${appointment.id}`}
                      aria-haspopup="dialog"
                      title={`Appointment actions for ${appointment.id}`}
                    >
                      {Icons.chevronRight}
                    </button>
                  </td>
                </tr>;
              })}
              {!paginatedAppointments.length && <tr><td className="lab-results-empty" colSpan="7">No appointments match the selected search and filters.</td></tr>}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && <div className="lab-results-pagination" aria-label="Appointment pages">
          <button type="button" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>Previous</button>
          <span>Page {page} of {pageCount}</span>
          <button type="button" disabled={page >= pageCount} onClick={() => setPage(current => current + 1)}>Next</button>
        </div>}
      </section>
      {actionAppointment && <RecordActionsModal
        title="Appointment Actions"
        recordLabel={`Appointment #${actionAppointment.id}`}
        recordName={actionAppointment.pet || actionAppointment.pet_name || 'Patient'}
        recordMeta={`${actionAppointment.type || actionAppointment.reason || 'Appointment'} · ${formatDateTime(actionAppointment).date} · ${formatDateTime(actionAppointment).time || 'Time not set'}`}
        recordPhoto={getPetPhotoUrl(actionAppointment) || getPetPhotoUrl(pets.find(pet => String(pet.id) === String(actionAppointment.pet_id || actionAppointment.petId) || pet.name === (actionAppointment.pet || actionAppointment.pet_name)))}
        showPetAvatar
        status={actionAppointment.status || 'scheduled'}
        onClose={() => { setArchiveError(''); setActionAppointment(null); }}
        error={archiveError}
        actions={[
          { label: 'View Details', description: 'Review the patient, schedule, visit reason, and appointment information.', onClick: () => {
            const appointmentPet = pets.find(pet => String(pet.id) === String(actionAppointment.pet_id || actionAppointment.petId)
              || String(pet.name || '').trim().toLowerCase() === String(actionAppointment.pet || actionAppointment.pet_name || '').trim().toLowerCase());
            setViewAppointment({ ...actionAppointment, photo_url: actionAppointment.photo_url || getPetPhotoUrl(appointmentPet) });
            setHistoryAppointment(null);
            setArchiveError('');
            setActionAppointment(null);
          } },
          { label: 'Audit History', description: 'Review the recorded activity and changes for this appointment.', onClick: () => { setHistoryAppointment(actionAppointment); setAppointmentAuditError(''); setActionAppointment(null); } },
          { label: showArchived ? 'Restore Appointment' : 'Archive Appointment', description: showArchived ? 'Return this appointment to the active list.' : 'Move this appointment out of the active list.', destructive: !showArchived, onClick: async () => { if (await archiveAppointment(actionAppointment)) setActionAppointment(null); } },
        ]}
      />}
      {viewAppointment && <OwnerModal onClose={() => { setHistoryAppointment(null); setViewAppointment(null); setActionAppointment(null); }} title="Appointment Details" width={950} className="clinic-record-details-modal clinic-appointment-details" labelledBy="clinic-appointment-details-title">
        <div className="clinic-record-details-header">
          <div className="clinic-appointment-details-heading">
            <h2 id="clinic-appointment-details-title" style={modalStyles.title}>Appointment Details</h2>
          </div>
        </div>
        <div className="record-details-content">
          <div className="record-details-profile record-details-owner-profile">
            {viewAppointment.photo_url
              ? <img src={viewAppointment.photo_url} alt={`${viewAppointment.pet || viewAppointment.pet_name || 'Pet'} profile`} />
              : <div className="record-details-avatar" aria-hidden="true">{String(viewAppointment.pet || viewAppointment.pet_name || '?').trim().charAt(0).toUpperCase()}</div>}
            <div><h3>{viewAppointment.pet || viewAppointment.pet_name || 'Patient not recorded'}</h3><p>{viewAppointment.type || viewAppointment.reason || 'Appointment'} · {viewAppointment.owner || viewAppointment.owner_name || 'Owner not recorded'}</p><span>{formatDateTimeText(getAppointmentDate(viewAppointment), 'en-US', getAppointmentDate(viewAppointment) || 'Date not recorded')} · {getAppointmentPractitioner(viewAppointment) || 'No veterinarian assigned'}</span></div>
          </div>
          <RecordDetailSection title="Appointment Information" items={[
            ['Appointment ID', viewAppointment.id], ['Appointment type', viewAppointment.type || viewAppointment.reason || 'Appointment'],
            ['Date & time', formatDateTimeText(getAppointmentDate(viewAppointment), 'en-US', getAppointmentDate(viewAppointment) || 'Not recorded')],
            ['Duration', getAppointmentDuration(viewAppointment) ? `${getAppointmentDuration(viewAppointment)} minutes` : 'Not recorded'],
            ['Status', <StatusIndicator key="appointment-status" status={viewAppointment.status || 'scheduled'} />],
            ['Veterinarian', getAppointmentPractitioner(viewAppointment)],
          ]} />
          <RecordDetailSection title="Patient & Owner" items={[
            ['Patient', viewAppointment.pet || viewAppointment.pet_name], ['Owner', viewAppointment.owner || viewAppointment.owner_name],
          ]} />
          <RecordDetailSection title="Visit Information" items={[
            ['Reason for visit', getAppointmentNoteDetails(viewAppointment).reason_for_visit || viewAppointment.reason_for_visit],
            ['Internal notes', getAppointmentNoteDetails(viewAppointment).internal_notes],
            ...(getAppointmentNoteDetails(viewAppointment).service_details?.consent_document
              ? [['Consent paper', <ConsentDocumentView key="consent-paper" document={getAppointmentNoteDetails(viewAppointment).service_details.consent_document} />]]
              : []),
            ['Created', viewAppointment.created_at ? formatDateTimeText(viewAppointment.created_at, 'en-US', viewAppointment.created_at) : 'Not recorded'],
            ['Last updated', viewAppointment.updated_at ? formatDateTimeText(viewAppointment.updated_at, 'en-US', viewAppointment.updated_at) : 'Not recorded'],
          ]} />
        </div>
        <div className="clinic-appointment-details-footer">
          <button type="button" className="lab-audit-back-button" onClick={() => { setViewAppointment(null); setActionAppointment(viewAppointment); }}>Back to actions</button>
          <button type="button" className="lab-audit-close-button" onClick={() => { setViewAppointment(null); setActionAppointment(null); }}>Close</button>
        </div>
      </OwnerModal>}
      {historyAppointment && <div className="lab-audit-backdrop" onClick={() => setHistoryAppointment(null)}>
        <div className="lab-audit-dialog" role="dialog" aria-modal="true" aria-labelledby="appointment-audit-title" onClick={event => event.stopPropagation()}>
          <header className="lab-audit-header">
            <div><h2 id="appointment-audit-title">Appointment Audit History</h2><p>{historyAppointment.pet || historyAppointment.pet_name || 'Patient'} · Recorded changes to this appointment</p></div>
            <button type="button" aria-label="Close appointment audit history" onClick={() => setHistoryAppointment(null)}>{Icons.close}</button>
          </header>
          <div className="lab-audit-content">
            <dl className="lab-audit-summary">
              <div><dt>Appointment Type</dt><dd>{historyAppointment.type || historyAppointment.reason || 'Appointment'}</dd></div>
              <div><dt>Date &amp; Time</dt><dd>{formatDateTimeText(getAppointmentDate(historyAppointment), 'en-US', getAppointmentDate(historyAppointment) || '—')}</dd></div>
              <div><dt>Veterinarian</dt><dd>{getAppointmentPractitioner(historyAppointment) || '—'}</dd></div>
              <div><dt>Status</dt><dd><StatusIndicator status={historyAppointment.status || 'scheduled'} /></dd></div>
            </dl>
            <section className="lab-audit-timeline appointment-audit-timeline">
              <h3>Activity Timeline</h3>
              {appointmentAuditLoading && <p className="lab-audit-empty">Loading appointment activity…</p>}
              {appointmentAuditError && <p className="lab-clinical-history-error" role="alert">{appointmentAuditError}</p>}
              {!appointmentAuditLoading && !appointmentAuditError && (appointmentAuditEntries.length
                ? <ol>{appointmentAuditEntries.map((entry, index) => {
                  const oldData = entry.old_data || {};
                  const newData = entry.new_data || {};
                  const changedFields = Object.keys(oldData).filter(key => key !== '_audit' && JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]));
                  const actionLabel = String(entry.action || 'activity').replace(/[_-]+/g, ' ');
                  const description = entry.reason || newData._audit?.reason || (
                    changedFields.length ? `Updated ${changedFields.map(field => field.replace(/_/g, ' ')).join(', ')}.`
                      : `${actionLabel.charAt(0).toUpperCase()}${actionLabel.slice(1)} appointment record.`
                  );
                  return <AuditTimelineEntry key={entry.id || `${entry.timestamp}-${index}`}
                    date={formatDateTimeText(entry.timestamp, 'en-US', entry.timestamp || 'Date unavailable')} dateTime={entry.timestamp}
                    title={`${actionLabel.charAt(0).toUpperCase()}${actionLabel.slice(1)}`} detail={description} actor={entry.user}
                    changes={changedFields.map(field => ({ field: field.replace(/_/g, ' '), previous: oldData[field], next: newData[field] }))} />;
                })}</ol>
                : <p className="lab-audit-empty">No audit activity has been recorded for this appointment.</p>)}
            </section>
          </div>
          <footer className="lab-audit-footer">
            <button type="button" className="lab-audit-back-button" onClick={() => { setActionAppointment(historyAppointment); setHistoryAppointment(null); }}>Back to actions</button>
            <button type="button" className="lab-audit-close-button" onClick={() => setHistoryAppointment(null)}>Close</button>
          </footer>
        </div>
      </div>}
      {showNewAppointment && (
        <DoctorNewAppointmentModal
          pets={pets}
          owners={owners}
          vaccinations={vaccinations}
          appointments={displayedAppointments}
          user={user}
          initialType={initialAppointmentType}
          onCreateLabRequest={onCreateLabRequest}
          onClose={() => { setShowNewAppointment(false); setInitialAppointmentType(''); }}
          onSchedule={async form => {
            if (!user?.clinic_id || !user?.token) throw new Error('Your account is not assigned to a clinic.');
            const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
            const response = await fetch(`${apiUrl}/clinic-records/appointments?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pet_id: form.pet_id,
                client_id: form.client_id,
                practitioner_id: form.practitioner_id || null,
                start_time: new Date(`${form.date}T${form.time}`).toISOString(),
                duration_minutes: form.duration_minutes,
                reason: form.type === 'Vaccination' && form.service_name.trim()
                  ? `Vaccination — ${form.service_name.trim()}`
                  : form.service_name
                    ? `${form.type} — ${form.service_name}`
                    : form.type,
                reason_for_visit: form.reason_for_visit || `${form.type} appointment${form.service_name ? ` — ${form.service_name}` : ''}`,
                workflow_type: form.type,
                workflow_reason: form.reason_for_visit || `${form.type} appointment${form.service_name ? ` — ${form.service_name}` : ''}`,
                parent_appointment_id: form.parent_appointment_id || null,
                notes: {
                  reason_for_visit: form.reason_for_visit || `${form.type} appointment${form.service_name ? ` — ${form.service_name}` : ''}`,
                  internal_notes: form.notes,
                  service_details: form.service_details || {},
                  related_treatment_plan_id: form.related_treatment_plan_id || null,
                  parent_appointment_id: form.parent_appointment_id || null,
                  vaccination_type: form.type === 'Vaccination' ? form.service_name.trim() : '',
                  service_category: form.type,
                  service_name: form.service_name || '',
                  service_catalog_item_id: form.service_catalog_item_id || null,
                },
              }),
            });
            const responseText = await response.text();
            let payload = {};
            try {
              payload = responseText ? JSON.parse(responseText) : {};
            } catch {
              payload = {};
            }
            if (!response.ok) {
              const message = response.status === 404
                ? 'The appointment save endpoint is not available on the running backend. Restart the backend server and try again.'
                : payload.error || `Unable to save the appointment (HTTP ${response.status}).`;
              throw new Error(message);
            }
            if (form.lab_request) {
              await onCreateLabRequest?.({ ...form.lab_request, appointmentId: payload.id, appointment_id: payload.id });
            }
            const updatedAppointments = [payload, ...displayedAppointments];
            setLocalAppointments(updatedAppointments);
            onAppointmentsChange?.(updatedAppointments);
            setShowNewAppointment(false);
            notifySuccess('Appointment scheduled', `${payload.pet} is booked for ${formatDateTimeText(payload.start_time)}.`);
          }}
        />
      )}
    </div>
  );
}

function AppointmentLabTestWizard({ pet, owner, user, testType: initialTestType, testOptions = [], veterinarians = [], date, time, veterinarian, onBack, onClose, onSave }) {
  const [step, setStep] = useState(1);
  const availableTestOptions = [...new Set([...testOptions, initialTestType].filter(Boolean))];
  const [form, setForm] = useState({
    testType: initialTestType || '', indication: '', priority: 'Routine',
    veterinarian: veterinarian || '', orderDateTime: `${date}T${time}`,
    sampleId: '', specimenType: '', specimenTypeOther: '', collectionDate: '', collectionTime: '',
    collectionMethod: '', collectionMethodOther: '', collector: '', notes: '',
  });
  const [testTypeOptionsOpen, setTestTypeOptionsOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [clinicalAlerts, setClinicalAlerts] = useState(null);
  const [clinicalAlertsLoading, setClinicalAlertsLoading] = useState(false);
  const [clinicalAlertsError, setClinicalAlertsError] = useState('');
  const ownerName = owner?.name || (typeof pet?.owner === 'string' ? pet.owner : pet?.owner?.name || pet?.owner_name) || 'Owner not recorded';
  useEffect(() => {
    if (!pet?.id || !user?.token || !user?.clinic_id) return undefined;
    const controller = new AbortController();
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    setClinicalAlertsLoading(true);
    fetch(`${apiUrl}/clinic-records/pets/${encodeURIComponent(pet.id)}/clinical-alerts?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
      headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal,
    }).then(async response => {
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Unable to load patient history (HTTP ${response.status}).`);
      setClinicalAlerts(payload);
      setClinicalAlertsError('');
    }).catch(loadError => {
      if (loadError.name !== 'AbortError') setClinicalAlertsError(loadError.message || 'Unable to load patient history.');
    }).finally(() => { if (!controller.signal.aborted) setClinicalAlertsLoading(false); });
    return () => controller.abort();
  }, [pet?.id, user?.clinic_id, user?.token]);
  const matchingTestOptions = availableTestOptions.filter(test => test.toLowerCase().includes(form.testType.trim().toLowerCase()));
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const otherDetailMissing = (form.specimenType === 'Other' && !form.specimenTypeOther.trim())
    || (form.collectionMethod === 'Other' && !form.collectionMethodOther.trim());
  const advance = event => {
    event.preventDefault();
    setError('');
    if (step === 2 && (!availableTestOptions.includes(form.testType) || !form.veterinarian || !form.orderDateTime || otherDetailMissing)) {
      setError(otherDetailMissing ? 'Enter the details for each field set to Other.' : 'Select an available test type, ordering veterinarian, and order date and time before continuing.');
      return;
    }
    setStep(current => Math.min(3, current + 1));
  };
  const save = async event => {
    event.preventDefault();
    if (!pet || !availableTestOptions.includes(form.testType) || !form.veterinarian || !form.orderDateTime || otherDetailMissing) {
      setError(otherDetailMissing ? 'Enter the details for each field set to Other.' : 'Complete the required patient, test type, ordering veterinarian, and order date and time fields.');
      setStep(2);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        patientId: pet?.id,
        pet: pet?.name || '',
        ...form,
        specimenType: form.specimenType === 'Other' ? form.specimenTypeOther.trim() || 'Other' : form.specimenType,
        collectionMethod: form.collectionMethod === 'Other' ? form.collectionMethodOther.trim() || 'Other' : form.collectionMethod,
        orderDateTime: new Date(form.orderDateTime).toISOString(),
        requestedBy: form.veterinarian,
        createdBy: form.veterinarian,
        lastUpdatedBy: form.veterinarian,
      });
      onClose();
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the lab test request.');
    } finally {
      setSaving(false);
    }
  };

  return <div style={modalStyles.backdrop} onClick={event => { if (event.target === event.currentTarget && !saving) onBack(); }}>
    <ModalDialog as="form" size="large" className="lab-add-test-dialog lab-wizard-dialog" role="dialog" aria-modal="true" aria-labelledby="appointment-lab-wizard-title" onSubmit={step === 3 ? save : advance} style={{ ...modalStyles.dialog, width: '760px', maxWidth: 'calc(100vw - 24px)', height: '767px', maxHeight: 'calc(100dvh - 32px)', overflow: 'hidden', padding: 'clamp(16px, 3vw, 26px)' }}>
      <button type="button" className="lab-add-test-close" onClick={onClose} disabled={saving}>Close</button>
      <header className="lab-wizard-header">
        <div><h2 id="appointment-lab-wizard-title">Add Lab Test</h2><p>Step {step} of 3 · {['Patient', 'Test Details', 'Review & Save'][step - 1]}</p></div>
      </header>
      <ModalStepper className="lab-wizard-steps">{['Patient', 'Test Details', 'Review & Save'].map((label, index) => <li key={label} className={step === index + 1 ? 'active' : step > index + 1 ? 'complete' : ''}><span>{index + 1}</span><strong>{label}</strong></li>)}</ModalStepper>
      <div className="lab-wizard-body">
        {step === 1 && <section className="lab-wizard-section">
          <div className="lab-wizard-patient-summary">
            <div className="lab-wizard-patient-overview">
              {pet?.photo_url ? <img className="lab-wizard-pet-photo" src={pet.photo_url} alt="" /> : <span className="lab-wizard-pet-photo lab-wizard-pet-initial">{pet?.name?.slice(0, 1).toUpperCase() || 'P'}</span>}
              <div className="lab-wizard-patient-identity"><strong>{pet?.name || 'Selected patient'}</strong><span>Patient ID: {pet?.patientId || pet?.displayId || `P-${String(pet?.id || '').padStart(4, '0')}`}</span><span className="lab-wizard-patient-selected">Patient selected</span></div>
              <div className="lab-wizard-patient-fact"><small>Species</small><strong>{pet?.species || 'Not recorded'}</strong></div>
              <div className="lab-wizard-patient-fact"><small>Breed</small><strong>{pet?.breed || 'Not recorded'}</strong></div>
              <div className="lab-wizard-patient-fact"><small>Sex</small><strong>{[pet?.sex || pet?.gender, pet?.reproductive_status || pet?.reproductiveStatus].filter(Boolean).join(' · ') || 'Not recorded'}</strong></div>
              <div className="lab-wizard-patient-fact"><small>Age</small><strong>{pet?.age || (pet?.birth_date || pet?.birthDate ? calculatePatientAge(pet.birth_date || pet.birthDate) : '') || 'Not recorded'}</strong></div>
              <button type="button" onClick={onBack}>Change Patient</button>
            </div>
            <div className="lab-wizard-owner-card"><h4>Owner Information</h4><div className="lab-wizard-owner-details"><span className="lab-wizard-owner-avatar">{ownerName.slice(0, 1).toUpperCase()}</span><div className="lab-wizard-owner-name"><strong>{ownerName}</strong><small>Owner</small></div><div className="lab-wizard-owner-contact"><span>{Icons.phone}<span>{owner?.phone || owner?.phone_number || pet?.ownerPhone || 'Phone not recorded'}</span></span><span>{Icons.mail}<span>{owner?.email || owner?.email_address || pet?.ownerEmail || 'Email not recorded'}</span></span></div></div></div>
            <div className="lab-wizard-additional-patient-details">
              <h4>Clinical Alerts &amp; Relevant History</h4><p className="lab-clinical-history-intro">Relevant information from the patient's existing record</p>
              {clinicalAlertsLoading && <p className="lab-clinical-history-state">Loading the patient's clinical record…</p>}
              {clinicalAlertsError && <p className="lab-clinical-history-error" role="alert">{clinicalAlertsError}</p>}
              {!clinicalAlertsLoading && !clinicalAlertsError && clinicalAlerts && <div className="lab-clinical-history-list"><section><h5>Current Treatments</h5><div className="lab-clinical-history-list-content">{clinicalAlerts.currentTreatments?.length ? <ul>{clinicalAlerts.currentTreatments.map((treatment, index) => <li className="lab-clinical-treatment-item" key={`${treatment.name}-${index}`}><strong>{treatment.name || 'Treatment'}</strong>{treatment.status && <span className="lab-clinical-treatment-status">{treatment.status}</span>}</li>)}</ul> : <p>No current treatments recorded.</p>}</div></section><section><h5>Known Allergies / Adverse Reactions</h5><div className="lab-clinical-history-list-content"><p>{clinicalAlerts.allergiesDocumented ? clinicalAlerts.allergies : 'No allergy information recorded.'}</p></div></section><section><h5>Relevant Medical History</h5><div className="lab-clinical-history-list-content">{clinicalAlerts.medicalHistory?.length ? <ul>{clinicalAlerts.medicalHistory.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p>No relevant medical history recorded.</p>}</div></section></div>}
              {!clinicalAlerts && !clinicalAlertsLoading && !clinicalAlertsError && <p className="lab-clinical-history-state">Patient clinical history is not available.</p>}
              <p className="lab-clinical-history-review">{Icons.info}<span>Review this information before selecting or interpreting a test. Update the patient's record to correct missing or outdated information.</span></p>
              <div className="lab-wizard-additional-patient-content"><dl className="lab-wizard-patient-details"><div><dt>Species</dt><dd>{pet?.species || 'Not recorded'}</dd></div><div><dt>Sex</dt><dd>{pet?.sex || pet?.gender || 'Not recorded'}</dd></div><div><dt>Breed</dt><dd>{pet?.breed || 'Not recorded'}</dd></div><div><dt>Date of Birth</dt><dd>{pet?.birth_date || pet?.birthDate ? `${formatClinicDate(pet.birth_date || pet.birthDate)}${pet?.age ? ` (${pet.age})` : ''}` : pet?.age || 'Not recorded'}</dd></div></dl><p>{Icons.info}<span>This information is pulled from the patient record. To correct it, update the patient record.</span></p></div>
            </div>
          </div>
        </section>}
        {step === 2 && <section className="lab-wizard-section">
          <h3>Test Information</h3>
          <div className="lab-wizard-test-grid">
            <div className="lab-wizard-field lab-wizard-test-type"><span>Test Type <b className="system-required-star">*</b></span><span className="lab-wizard-search-control">{Icons.search}<input className="lab-wizard-search-input" required role="combobox" aria-label="Test Type" aria-autocomplete="list" aria-expanded={testTypeOptionsOpen} value={form.testType} onFocus={() => setTestTypeOptionsOpen(true)} onClick={() => setTestTypeOptionsOpen(true)} onBlur={() => setTestTypeOptionsOpen(false)} onKeyDown={event => { if (event.key === 'Escape') setTestTypeOptionsOpen(false); }} onChange={event => { update('testType', event.target.value); setTestTypeOptionsOpen(true); }} placeholder="Search or select a lab test" autoComplete="off" /></span>{testTypeOptionsOpen && <div className="lab-wizard-test-options" role="listbox" aria-label="Available lab tests">{matchingTestOptions.length ? matchingTestOptions.map(test => <button type="button" role="option" aria-selected={form.testType === test} key={test} onMouseDown={event => event.preventDefault()} onClick={() => { update('testType', test); setTestTypeOptionsOpen(false); }}>{test}</button>) : <p>No matching lab tests.</p>}</div>}</div>
            <fieldset className="lab-wizard-priority"><legend>Priority</legend><div>{['Routine', 'Urgent'].map(value => <button key={value} type="button" aria-pressed={form.priority === value} className={form.priority === value ? 'selected' : ''} onClick={() => update('priority', value)}><span aria-hidden="true" />{value}</button>)}</div></fieldset>
            <label className="lab-wizard-field lab-wizard-field-full"><span>Clinical Indication / Reason for Testing <small>(Optional)</small></span><textarea maxLength={500} rows={2} value={form.indication} onChange={event => update('indication', event.target.value)} placeholder="e.g., vomiting, suspected infection, wellness screening..." /><small>{form.indication.length}/500</small></label>
            <label className="lab-wizard-field"><span>Ordering Veterinarian <b className="system-required-star">*</b></span><FilterSelect className="lab-wizard-filter-select" label="Ordering Veterinarian" value={form.veterinarian} onChange={value => update('veterinarian', value)} options={[{ value: '', label: 'Select veterinarian' }, ...veterinarians.map(value => ({ value, label: value }))]} /></label>
            <div className="lab-wizard-system-field"><span>Test ID</span><strong>Will be generated after saving</strong></div>
            <div className="lab-wizard-system-field lab-wizard-order-date"><span>Order Date &amp; Time</span><LabDateTimePicker className="lab-wizard-date-time" label="Order Date and Time" value={form.orderDateTime} onChange={value => update('orderDateTime', value)} /></div>
          </div>
          <hr className="lab-wizard-divider" /><h3>Specimen &amp; Collection Information</h3>
          <div className="lab-wizard-fields-grid">
            <label className="lab-wizard-field"><span>Specimen Type <small>(Optional)</small></span><FilterSelect className="lab-wizard-filter-select" label="Specimen Type" value={form.specimenType} onChange={value => setForm(current => ({ ...current, specimenType: value, specimenTypeOther: value === 'Other' ? current.specimenTypeOther : '' }))} options={[{ value: '', label: 'Select specimen type' }, ...['Whole blood', 'Serum', 'Plasma', 'Urine', 'Feces', 'Swab', 'Other'].map(value => ({ value, label: value }))]} />{form.specimenType === 'Other' && <input className="lab-wizard-other-detail" aria-label="Specify other specimen type" required value={form.specimenTypeOther} onChange={event => update('specimenTypeOther', event.target.value)} placeholder="Enter specimen type" maxLength={120} />}</label>
            <label className="lab-wizard-field"><span>Collection Date &amp; Time <small>(Optional)</small></span><LabDateTimePicker className="lab-wizard-date-time" label="Collection Date and Time" value={form.collectionDate && form.collectionTime ? `${form.collectionDate}T${form.collectionTime}` : ''} onChange={value => { const [collectionDate = '', collectionTime = ''] = value.split('T'); setForm(current => ({ ...current, collectionDate, collectionTime })); }} /></label>
            <label className="lab-wizard-field"><span>Collection Method / Site <small>(Optional)</small></span><FilterSelect className="lab-wizard-filter-select" label="Collection Method / Site" value={form.collectionMethod} onChange={value => setForm(current => ({ ...current, collectionMethod: value, collectionMethodOther: value === 'Other' ? current.collectionMethodOther : '' }))} options={[{ value: '', label: 'Select method / site' }, ...['Venipuncture', 'Cystocentesis', 'Free catch', 'Fecal collection', 'Swab', 'Other'].map(value => ({ value, label: value }))]} />{form.collectionMethod === 'Other' && <input className="lab-wizard-other-detail" aria-label="Specify other collection method or site" required value={form.collectionMethodOther} onChange={event => update('collectionMethodOther', event.target.value)} placeholder="Describe method or site" maxLength={160} />}</label>
            <label className="lab-wizard-field"><span>Collector <small>(Optional)</small></span><span className="lab-wizard-filter-select-shell">{Icons.user}<FilterSelect className="lab-wizard-filter-select" label="Collector" value={form.collector} onChange={value => update('collector', value)} options={[{ value: '', label: 'Select collector' }, ...veterinarians.map(value => ({ value, label: value }))]} /></span></label>
            <label className="lab-wizard-field lab-wizard-field-full lab-wizard-notes-field"><span>Clinical Notes <small>(Optional)</small></span><textarea className="lab-wizard-notes" maxLength={500} rows={2} value={form.notes} onChange={event => update('notes', event.target.value)} placeholder="Add any relevant notes, such as clinical signs, reason for testing, or special instructions..." /><small>{form.notes.length}/500</small></label>
          </div>
        </section>}
        {step === 3 && <section className="lab-wizard-section">
          <header className="lab-wizard-review-header"><span className="lab-wizard-review-icon">{Icons.clipboard}</span><div><h3>Review &amp; Save</h3><p>Step 3 of 3 · Confirm the information before creating the lab test.</p></div></header>
          <section className="lab-wizard-review-group"><div className="lab-wizard-review-group-heading"><h4>Patient</h4></div><div className="lab-wizard-review-patient">{pet?.photo_url ? <img src={pet.photo_url} alt="" /> : <span className="lab-wizard-review-patient-avatar">{pet?.name?.slice(0, 1).toUpperCase() || 'P'}</span>}<div><strong>{pet?.name || 'Patient not selected'}</strong><span>Patient ID: {pet?.displayId || pet?.id || 'Not available'} · {pet?.species || 'Species not recorded'} · {pet?.sex || 'Sex not recorded'}</span></div></div></section>
          <section className="lab-wizard-review-group"><div className="lab-wizard-review-group-heading"><h4>Test Information</h4><button type="button" onClick={() => setStep(2)}>Edit details</button></div><dl className="lab-wizard-review-list"><div><dt>Test type</dt><dd>{form.testType}</dd></div><div><dt>Priority</dt><dd><span className="lab-wizard-review-priority">{form.priority}</span></dd></div><div><dt>Ordering veterinarian</dt><dd>{form.veterinarian}</dd></div><div><dt>Order date &amp; time</dt><dd>{form.orderDateTime ? new Date(form.orderDateTime).toLocaleString() : 'Not provided'}</dd></div><div><dt>Reason for testing</dt><dd>{form.indication.trim() || 'Not provided'}</dd></div>{form.notes.trim() && <div><dt>Clinical notes</dt><dd>{form.notes.trim()}</dd></div>}</dl></section>
          <section className="lab-wizard-review-group"><div className="lab-wizard-review-group-heading"><h4>Specimen &amp; Collection</h4><button type="button" onClick={() => setStep(2)}>Edit details</button></div><dl className="lab-wizard-review-list"><div><dt>Specimen type</dt><dd>{(form.specimenType === 'Other' ? form.specimenTypeOther.trim() : form.specimenType) || 'To be recorded'}</dd></div><div><dt>Collection date/time</dt><dd>{form.collectionDate && form.collectionTime ? `${formatClinicDate(form.collectionDate)} · ${form.collectionTime}` : 'Not collected yet'}</dd></div>{form.collectionMethod && <div><dt>Collection method / site</dt><dd>{form.collectionMethod === 'Other' ? form.collectionMethodOther.trim() : form.collectionMethod}</dd></div>}<div><dt>Collector</dt><dd>{form.collector || 'Not selected'}</dd></div>{form.sampleId.trim() && <div><dt>Sample ID / Accession</dt><dd>{form.sampleId.trim()}</dd></div>}</dl></section>
          <div className="lab-wizard-review-after-save">{Icons.info}<div><strong>After saving</strong><p>The lab test will appear in the Lab Tests list with its generated test ID and initial status.</p></div></div>
        </section>}
        {error && <div className="lab-wizard-error" role="alert">{error}</div>}
      </div>
      <footer className={`lab-wizard-footer${step === 3 ? ' lab-wizard-review-footer' : ''}`}>
        <button type="button" className="lab-wizard-back" onClick={() => step === 1 ? onBack() : setStep(current => current - 1)} disabled={saving}>{step === 1 ? 'Back' : 'Back'}</button>
        {step < 3 ? <button type="submit" className="lab-wizard-next">Next</button> : <button type="submit" className="lab-wizard-next" disabled={saving}>{saving ? 'Saving...' : 'Add Lab Test'}</button>}
      </footer>
    </ModalDialog>
  </div>;
}

function DoctorNewAppointmentModal({ pets, owners, appointments = [], vaccinations = [], user, onClose, onSchedule, onCreateLabRequest, initialType = '' }) {
  const [form, setForm] = useState({ pet_id: '', client_id: '', date: '', time: '', type: initialType, service_name: '', manufacturer: '', lotNumber: '', expiryDate: '', dose: '', nextDue: '', treatment_plan_title: '', treatment_diagnosis: '', treatment_severity: 'moderate', treatment_follow_up: '', treatment_steps: '', treatment_plan_steps: [{ title: '', due: '' }], treatment_include_medication: false, treatment_medication: { name: '', dosage: '', route: '', frequency: '', quantity: '', instructions: '' }, reason_for_visit: '', notes: '', practitioner_id: '', service_details: {}, parent_appointment_id: '', related_treatment_plan_id: '' });
  const [step, setStep] = useState(1);
  const [confinementStep, setConfinementStep] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [consentPaperFile, setConsentPaperFile] = useState(null);
  const [consentPaperPreviewUrl, setConsentPaperPreviewUrl] = useState('');
  const [labWizardOpen, setLabWizardOpen] = useState(false);
  const [veterinarians, setVeterinarians] = useState([]);
  const [serviceCatalog, setServiceCatalog] = useState([]);
  const [treatmentPlans, setTreatmentPlans] = useState([]);
  const [clinicalHistory, setClinicalHistory] = useState(null);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [servicePickerIndex, setServicePickerIndex] = useState(0);
  const [servicePickerPosition, setServicePickerPosition] = useState(null);
  const [showAllVaccinationHistory, setShowAllVaccinationHistory] = useState(false);
  const servicePickerRef = useRef(null);
  useEffect(() => {
    if (!consentPaperFile) {
      setConsentPaperPreviewUrl('');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(consentPaperFile);
    setConsentPaperPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [consentPaperFile]);
  useEffect(() => {
    if (!user?.clinic_id || !user?.token) {
      setServiceCatalog([]);
      return undefined;
    }
    const controller = new AbortController();
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    const headers = { Authorization: `Bearer ${user.token}` };
    const normalizedRole = String(user.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const seedCatalog = ['owner', 'clinic_owner'].includes(normalizedRole)
      ? fetch(`${apiUrl}/clinic-records/billing-catalog/seed-defaults`, {
        method: 'POST',
        headers,
        signal: controller.signal,
      }).then(async response => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || 'Unable to load the clinic service catalog.');
      })
      : Promise.resolve();
    seedCatalog.then(() => fetch(`${apiUrl}/clinic-records/billing-catalog?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
      headers, signal: controller.signal,
    })).then(async response => {
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload)) throw new Error('Unable to load the clinic service catalog.');
      setServiceCatalog(payload.filter(item => item
        && typeof item.name === 'string'
        && item.name.trim()
        && item.active !== false
        && item.item_type !== 'medication'));
    }).catch(loadError => {
      if (loadError.name !== 'AbortError') setServiceCatalog([]);
    });
    return () => controller.abort();
  }, [user?.clinic_id, user?.token]);
  useEffect(() => {
    if (!user?.clinic_id || !user?.token) {
      setVeterinarians([]);
      return undefined;
    }
    const controller = new AbortController();
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    fetch(`${apiUrl}/clinics/${encodeURIComponent(user.clinic_id)}/staff?status=active`, {
      headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal,
    }).then(async response => {
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload)) throw new Error('Unable to load clinic veterinarians.');
      const staff = payload.filter(member => ['doctor', 'veterinarian', 'assistant_doctor'].includes(
        String(member.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
      ));
      setVeterinarians(staff);
      if (/doctor|veterinarian/i.test(user.role || '') && staff.some(member => String(member.id) === String(user.id))) {
        setForm(current => ({ ...current, practitioner_id: current.practitioner_id || String(user.id) }));
      }
    }).catch(loadError => {
      if (loadError.name !== 'AbortError') setVeterinarians([]);
    });
    return () => controller.abort();
  }, [user?.clinic_id, user?.token, user?.id, user?.role]);
  const activePets = pets.filter(pet => !pet.archived && (!form.client_id || String(pet.client_id) === String(form.client_id)));
  const activeOwners = owners.filter(owner => !owner.archived);
  const selectedPet = pets.find(pet => String(pet.id) === String(form.pet_id));
  const selectedOwner = owners.find(owner => String(owner.id) === String(form.client_id));
  const unavailableAppointmentTimes = getUnavailableAppointmentTimes(appointments, form.date);
  const selectedPetVaccinations = (Array.isArray(vaccinations) ? vaccinations : [])
    .filter(item => item && String(item.pet_id) === String(selectedPet?.id));
  const speciesLabels = { dog: 'Canine', canine: 'Canine', cat: 'Feline', feline: 'Feline', bird: 'Avian', avian: 'Avian', rabbit: 'Rabbit', equine: 'Equine', horse: 'Equine' };
  const selectedPetSpecies = speciesLabels[String(selectedPet?.species || '').toLowerCase()] || selectedPet?.species || 'Species not recorded';
  useEffect(() => {
    if (!selectedPet?.id || !user?.clinic_id || !user?.token) { setClinicalHistory(null); setTreatmentPlans([]); return undefined; }
    const controller = new AbortController();
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    const query = `?clinic_id=${encodeURIComponent(user.clinic_id)}`;
    Promise.all([
      fetch(`${apiUrl}/clinic-records/pets/${encodeURIComponent(selectedPet.id)}/clinical-alerts${query}`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal }).then(response => response.ok ? response.json() : null),
      fetch(`${apiUrl}/clinic-records/treatment-plans${query}`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal }).then(response => response.ok ? response.json() : []),
    ]).then(([history, plans]) => { if (!controller.signal.aborted) { setClinicalHistory(history); setTreatmentPlans(Array.isArray(plans) ? plans.filter(plan => String(plan.pet_id) === String(selectedPet.id)) : []); } }).catch(error => { if (error.name !== 'AbortError') { setClinicalHistory(null); setTreatmentPlans([]); } });
    return () => controller.abort();
  }, [selectedPet?.id, user?.clinic_id, user?.token]);
  const appointmentCategory = form.type;
  const categoryForCatalog = appointmentCategory === 'Check-up' || appointmentCategory === 'Follow-up'
    ? 'Consultation'
    : appointmentCategory;
  const serviceOptions = (Array.isArray(serviceCatalog) ? serviceCatalog : []).filter(item => {
    if (!item || typeof item.name !== 'string' || !item.name.trim()) return false;
    const category = item.category || (item.item_type === 'vaccination' ? 'Vaccination' : item.item_type === 'lab_test' ? 'Laboratory' : item.item_type === 'inpatient' ? 'Confinement' : item.item_type === 'consultation' ? 'Consultation' : 'Treatment');
    if (category !== categoryForCatalog) return false;
    if (appointmentCategory === 'Check-up') return !/follow[- ]?up/i.test(item.name);
    if (appointmentCategory === 'Follow-up') return /follow[- ]?up/i.test(item.name);
    return true;
  });
  const selectedCatalogService = serviceOptions.find(item => item.name.trim().toLowerCase() === form.service_name.trim().toLowerCase());
  const matchingServiceOptions = serviceOptions.filter(item => !form.service_name.trim()
    || item.name.toLowerCase().includes(form.service_name.trim().toLowerCase()));
  useEffect(() => {
    if (!servicePickerOpen) return undefined;
    const reposition = () => {
      const bounds = servicePickerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const viewportHeight = window.innerHeight;
      const maxHeight = Math.min(260, Math.floor(viewportHeight * .42));
      const below = viewportHeight - bounds.bottom - 8;
      const above = bounds.top - 8;
      const openAbove = below < Math.min(maxHeight, 180) && above > below;
      setServicePickerPosition({
        left: bounds.left,
        width: bounds.width,
        top: openAbove ? bounds.top - 5 : bounds.bottom + 5,
        transform: openAbove ? 'translateY(-100%)' : undefined,
        maxHeight: Math.max(90, Math.min(maxHeight, openAbove ? above : below)),
      });
    };
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [servicePickerOpen]);
  const chooseService = item => {
    update('service_name', item.name);
    setServicePickerOpen(false);
  };
  const isWorkflowType = ['Vaccination', 'Treatment', 'Laboratory', 'Surgery', 'Dental', 'Check-up', 'Follow-up', 'Confinement', 'Grooming', 'General'].includes(appointmentCategory);
  const isWorkflowDetailsStep = isWorkflowType && step === 2;
  const servicePlaceholder = {
    'Check-up': 'e.g. General Wellness Check-up',
    Vaccination: 'e.g. Rabies, Dog 5-in-1, FVRCP',
    Surgery: 'Select procedure',
    Dental: 'e.g. Dental Examination, Dental Cleaning',
    Treatment: 'e.g. Wound Dressing, Ear Cleaning',
    'Follow-up': 'e.g. Post-Dental Follow-up, Recheck',
    Confinement: 'e.g. Standard Confinement, Oxygen Support',
    Grooming: 'e.g. Basic Bath, Full Grooming',
    General: 'e.g. Microchipping, Health Certificate',
  }[appointmentCategory] || 'Specify the service';
  const durationByType = { 'check-up': 30, consultation: 30, vaccination: 20, surgery: 120, dental: 60, treatment: 30, laboratory: 30, confinement: 30, 'follow-up': 20, grooming: 30, general: 30 };
  const durationMinutes = durationByType[String(appointmentCategory || '').toLowerCase()] || 30;
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const updateServiceDetail = (key, value) => setForm(current => ({ ...current, service_details: { ...(current.service_details || {}), [key]: value } }));
  const serviceDetail = key => form.service_details?.[key] || '';
  const appointmentBasicsReady = Boolean(form.pet_id && form.client_id && form.date && form.time && form.type);
  const treatmentStepsReady = form.treatment_plan_steps.some(item => item.title.trim()) || Boolean(form.treatment_steps.trim() || form.service_name.trim());
  const treatmentMedicationReady = !form.treatment_include_medication || Boolean(form.treatment_medication.name.trim() && form.treatment_medication.dosage.trim());
  const confinementStepReady = confinementStep === 0 ? Boolean(form.pet_id && form.client_id)
    : confinementStep === 1 ? Boolean(form.service_details?.presenting_complaint?.trim() && form.service_details?.admission_reason?.trim())
      : confinementStep === 2 ? true
        : confinementStep === 3 ? Boolean(form.service_details?.ward && form.service_details?.expected_discharge_at)
          : confinementStep === 4 ? Boolean(form.service_details?.consent_status && form.service_details?.authorized_by && form.service_details?.consent_scope)
            : true;
  const ready = appointmentBasicsReady && (step === 1
    ? true
    : Boolean(form.service_name.trim())
      && (form.type !== 'Vaccination' || Boolean(serviceDetail('reason_category').trim()))
      && (form.type !== 'Treatment' || Boolean(form.related_treatment_plan_id || ((form.treatment_plan_title.trim() || form.service_name.trim()) && form.treatment_diagnosis.trim() && treatmentStepsReady && treatmentMedicationReady)))
      && (form.type !== 'Follow-up' || Boolean(form.parent_appointment_id || form.related_treatment_plan_id))
      && (form.type !== 'Surgery' || Boolean(serviceDetail('diagnosis').trim()))
      && (form.type !== 'Confinement' || confinementStepReady)) && !saving;
  const handleConsentPaperChange = event => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setConsentPaperFile(null);
      setError('Choose a consent paper in PDF, JPG, or PNG format.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setConsentPaperFile(null);
      setError('Choose a consent paper that is 4 MB or smaller.');
      return;
    }
    setConsentPaperFile(file);
    setError('');
  };
  const serviceTextField = (label, key, placeholder, { full = false, readOnly = false, required = false, value = serviceDetail(key), rows = 2, className, gridColumn, gridRow } = {}) => <label className={className} style={{ ...modalStyles.doctorAppointmentLabel, ...(full ? { gridColumn: '1 / -1' } : {}), ...(gridColumn ? { gridColumn } : {}), ...(gridRow ? { gridRow } : {}) }}><span>{label}{required && <span className="doctor-appointment-required" aria-hidden="true">*</span>}</span>{rows === 1
    ? <input readOnly={readOnly} required={required} value={value} onChange={event => updateServiceDetail(key, event.target.value)} placeholder={placeholder} className="doctor-appointment-input" style={modalStyles.doctorAppointmentInput} />
    : <textarea readOnly={readOnly} required={required} value={value} onChange={event => updateServiceDetail(key, event.target.value)} placeholder={placeholder} rows={rows} className="doctor-appointment-input" style={{ ...modalStyles.doctorAppointmentInput, minHeight: 70, padding: '9px 11px', resize: 'vertical', background: readOnly ? '#f8fafc' : '#fff' }} />}</label>;
  const attendingVeterinarianField = <label className="appointment-attending-veterinarian" style={{ ...modalStyles.doctorAppointmentLabel, gridColumn: appointmentCategory === 'General' ? '2' : ['Dental', 'Check-up', 'Follow-up'].includes(appointmentCategory) ? '7 / -1' : '1 / -1' }}><span>{appointmentCategory === 'General' ? 'Attending veterinarian' : 'Attending Veterinarian'}</span><span className="doctor-appointment-control has-chevron"><select value={form.practitioner_id} onChange={event => update('practitioner_id', event.target.value)} className="doctor-appointment-input" style={modalStyles.doctorAppointmentInput}><option value="">Select veterinarian (optional)</option>{veterinarians.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></span></label>;
  const matchingAppointments = (Array.isArray(appointments) ? appointments : [])
    .filter(item => item && String(item.pet_id || item.petId) === String(form.pet_id) && !item.archived && !['cancelled', 'canceled'].includes(String(item.status || '').toLowerCase()));
  const vaccinationHistory = [
    ...selectedPetVaccinations.filter(item => !item.archived).map(item => {
      const rawStatus = String(item.status || '').toLowerCase();
      const date = item.dateGiven || item.date_given || item.date_administered || item.administered_at || item.created_at || '';
      return {
        key: `record-${item.id || `${item.type}-${date}`}`,
        vaccine: item.type || item.vaccine_name || item.vaccine_type || 'Vaccination',
        date,
        dateKey: clinicDateKey(date),
        status: rawStatus === 'scheduled' ? 'Scheduled' : 'Administered',
        appointmentId: item.appointment_id,
      };
    }),
    ...matchingAppointments.filter(item => {
      let notes = item.notes || {};
      if (typeof notes === 'string') { try { notes = JSON.parse(notes); } catch { notes = {}; } }
      const workflowType = item.workflow_type || notes.service_category || '';
      const isVaccination = /vaccin/i.test(String(workflowType)) || /vaccin|rabies/i.test(String(item.reason || item.type || ''));
      const isCancelled = ['cancelled', 'canceled', 'no show', 'no-show'].includes(String(item.status || '').toLowerCase());
      const linkedToRecord = selectedPetVaccinations.some(record => String(record.appointment_id || '') === String(item.id));
      return isVaccination && !isCancelled && !linkedToRecord;
    }).map(item => {
      let notes = item.notes || {};
      if (typeof notes === 'string') { try { notes = JSON.parse(notes); } catch { notes = {}; } }
      const date = item.start_time || item.datetime || '';
      const completed = ['completed', 'complete', 'administered'].includes(String(item.status || '').toLowerCase());
      const reasonText = String(item.reason || item.type || 'Vaccination');
      return {
        key: `appointment-${item.id}`,
        vaccine: notes.vaccination_type || notes.service_name || reasonText.replace(/^vaccination\s*[-:–—]?\s*/i, '') || 'Vaccination',
        date,
        dateKey: clinicDateKey(date),
        status: completed ? 'Administered' : 'Scheduled',
        appointmentId: item.id,
      };
    }),
  ].sort((first, second) => (second.dateKey || '').localeCompare(first.dateKey || ''));
  const normalizedPlannedVaccine = normalizeVaccineName(form.service_name);
  const plannedDateKey = clinicDateKey(form.date);
  const recentAdminDate = new Date(`${plannedDateKey || 'invalid'}T00:00:00`);
  const duplicateVaccineEntry = normalizedPlannedVaccine ? vaccinationHistory.find(item => {
    if (normalizeVaccineName(item.vaccine) !== normalizedPlannedVaccine) return false;
    if (item.status === 'Scheduled') return Boolean(plannedDateKey && item.dateKey === plannedDateKey);
    const historyDate = new Date(`${item.dateKey || 'invalid'}T00:00:00`);
    if (Number.isNaN(historyDate.getTime()) || Number.isNaN(recentAdminDate.getTime())) return false;
    const daysSinceAdministered = Math.floor((recentAdminDate.getTime() - historyDate.getTime()) / 86400000);
    return daysSinceAdministered >= 0 && daysSinceAdministered <= 30;
  }) : null;
  const linkedAppointment = matchingAppointments.find(item => String(item.id) === String(form.parent_appointment_id));
  const linkedTreatmentPlan = treatmentPlans.find(item => String(item.id) === String(form.related_treatment_plan_id));
  const readLinkedInstructions = item => {
    let notes = item?.notes || {};
    if (typeof notes === 'string') { try { notes = JSON.parse(notes); } catch { notes = {}; } }
    return notes.previous_instructions || notes.internal_notes || notes.reason_for_visit || item?.reason || 'No previous instructions recorded.';
  };

  if (labWizardOpen) {
    return <AppointmentLabTestWizard
      pet={selectedPet}
      owner={selectedOwner}
      user={user}
      testType={form.service_name}
      testOptions={[...new Set([...LAB_RESULTS.map(result => result.testType), ...serviceOptions.map(item => item.name)].filter(Boolean))]}
      veterinarians={[...new Set([...veterinarians.map(member => member.name), user?.name].filter(Boolean))]}
      date={form.date}
      time={form.time}
      veterinarian={veterinarians.find(member => String(member.id) === String(form.practitioner_id))?.name || veterinarians[0]?.name || user?.name || ''}
      onBack={() => setLabWizardOpen(false)}
      onClose={onClose}
      onSave={async request => onSchedule({
        ...form,
        type: 'Laboratory',
        service_name: request.testType,
        practitioner_id: form.practitioner_id,
        practitioner_name: request.requestedBy,
        reason_for_visit: request.indication || 'Laboratory testing',
        notes: request.notes || '',
        duration_minutes: durationMinutes,
        lab_request: request,
        pet: selectedPet?.name,
        owner: selectedOwner?.name,
      })}
    />;
  }

  return (
    <div style={modalStyles.backdrop} onClick={onClose}>
      <ModalDialog as="form" size="standard"
        className={`appointment-create-dialog${isWorkflowDetailsStep ? ' appointment-create-dialog--details' : ' appointment-create-dialog--new'}${isWorkflowDetailsStep ? ` appointment-create-dialog--${appointmentCategory.toLowerCase().replace(/[^a-z]+/g, '-')}` : ''}${isWorkflowDetailsStep && ['Dental', 'General'].includes(appointmentCategory) ? ' vi-modal--appt' : ''}${isWorkflowDetailsStep && appointmentCategory === 'Surgery' ? ' appointment-create-dialog--surgery' : ''}${isWorkflowDetailsStep && appointmentCategory === 'Vaccination' ? ' appointment-create-dialog--vaccination' : ''}${isWorkflowDetailsStep && appointmentCategory === 'Confinement' && confinementStep === 1 ? ' appointment-create-dialog--confinement-assessment' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="doctor-new-appointment-title"
        onClick={event => event.stopPropagation()}
        onSubmit={async event => {
          event.preventDefault();
            if (appointmentCategory === 'Laboratory' && step === 1) {
            if (!ready) return;
              setError('');
              setLabWizardOpen(true);
              return;
          }
          if (isWorkflowType && step === 1) {
            if (!ready) return;
            if (appointmentCategory === 'Confinement') setConfinementStep(0);
            setStep(2);
            setError('');
            return;
          }
          if (appointmentCategory === 'Confinement' && step === 2 && confinementStep < 5) {
            if (!ready) { setError(confinementStep === 1 ? 'Enter the admission reason and presenting complaint.' : confinementStep === 3 ? 'Choose a ward and expected discharge date.' : 'Complete the required confinement details.'); return; }
            setConfinementStep(current => Math.min(current + 1, 5));
            setError('');
            return;
          }
          if (!ready) return;
          setSaving(true);
          setError('');
          try {
            let treatmentPlanId = form.related_treatment_plan_id;
            if (appointmentCategory === 'Treatment' && !treatmentPlanId) {
              const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
              const planResponse = await fetch(`${apiUrl}/clinic-records/treatment-plans?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  pet_id: form.pet_id,
                  title: form.treatment_plan_title.trim() || `${form.service_name.trim()} Plan`,
                  diagnosis: form.treatment_diagnosis.trim(),
                  severity: form.treatment_severity,
                  attending_veterinarian_id: form.practitioner_id || null,
                  follow_up: form.treatment_follow_up || null,
                  steps: form.treatment_plan_steps
                    .map((planStep, index) => ({ title: (planStep.title || (index === 0 ? form.treatment_steps || form.service_name : '')).trim(), detail: '', due: planStep.due || (index === 0 ? form.date : null), assignee: veterinarians.find(member => String(member.id) === String(form.practitioner_id))?.name || '' }))
                    .filter(planStep => planStep.title),
                  ...(form.treatment_include_medication ? { prescription: {
                    medication: form.treatment_medication.name.trim(),
                    dosage: form.treatment_medication.dosage.trim(),
                    route: form.treatment_medication.route.trim() || null,
                    frequency: form.treatment_medication.frequency.trim() || null,
                    quantity: form.treatment_medication.quantity.trim() || null,
                  } } : {}),
                }),
              });
              const planPayload = await planResponse.json().catch(() => ({}));
              if (!planResponse.ok || !planPayload.id) throw new Error(planPayload.error || 'Unable to create the treatment plan.');
              treatmentPlanId = String(planPayload.id);
              update('related_treatment_plan_id', treatmentPlanId);
              setTreatmentPlans(current => [planPayload, ...current.filter(item => String(item.id) !== treatmentPlanId)]);
            }
            const appointmentForm = { ...form };
            if (appointmentCategory === 'Confinement' && consentPaperFile) {
              const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Unable to read the selected consent paper.'));
                reader.readAsDataURL(consentPaperFile);
              });
              appointmentForm.service_details = {
                ...(form.service_details || {}),
                consent_document: {
                  filename: consentPaperFile.name,
                  content_type: consentPaperFile.type,
                  data,
                },
              };
            }
            await onSchedule({
              ...appointmentForm,
              related_treatment_plan_id: treatmentPlanId,
              type: appointmentCategory,
              service_name: form.service_name.trim(),
              service_catalog_item_id: selectedCatalogService?.id || null,
              treatment_plan_title: form.treatment_plan_title.trim() || `${form.service_name.trim()} Plan`,
              treatment_diagnosis: form.treatment_diagnosis.trim(),
              treatment_severity: form.treatment_severity,
              treatment_follow_up: form.treatment_follow_up,
              treatment_steps: form.treatment_steps.trim(),
              practitioner_name: veterinarians.find(member => String(member.id) === String(form.practitioner_id))?.name || '',
              vaccination_type: appointmentCategory === 'Vaccination' ? form.service_name.trim() : '',
              vaccination_details: appointmentCategory === 'Vaccination' ? {
                manufacturer: form.manufacturer.trim(), lot_number: form.lotNumber.trim(), expiry_date: form.expiryDate,
                dose: form.dose.trim(), next_due: form.nextDue, administered_by: form.practitioner_id || '',
              } : null,
              duration_minutes: durationMinutes,
              pet: selectedPet?.name,
              owner: selectedOwner?.name,
            });
          } catch (saveError) {
            setError(saveError.message || 'Unable to save the appointment.');
          } finally {
            setSaving(false);
          }
        }}
        style={{ ...modalStyles.doctorAppointmentDialog, ...(isWorkflowDetailsStep ? { width: ['Confinement', 'General'].includes(appointmentCategory) ? 760 : appointmentCategory === 'Grooming' ? 'min(720px, calc(100vw - 32px))' : 'min(620px, calc(100vw - 32px))', maxWidth: 'calc(100vw - 32px)', height: 'auto', boxSizing: 'border-box', maxHeight: ['Confinement', 'Grooming', 'General'].includes(appointmentCategory) ? 'calc(100dvh - 32px)' : 'none', overflowY: ['Confinement', 'Grooming', 'General'].includes(appointmentCategory) ? 'hidden' : 'visible', padding: ['Confinement', 'General'].includes(appointmentCategory) ? '28px 32px 24px' : appointmentCategory === 'Grooming' ? '26px 30px 24px' : '22px 26px 20px' } : {}) }}
      >
        <button type="button" onClick={onClose} style={isWorkflowDetailsStep ? modalStyles.close : { ...modalStyles.vaccinationActionsClose, width: 'auto', height: 'auto', font: 'inherit', fontSize: '.74rem', fontWeight: 600 }}>{isWorkflowDetailsStep ? Icons.close : 'Close'}</button>
        <h2 id="doctor-new-appointment-title" style={isWorkflowDetailsStep ? { ...modalStyles.addVaccinationTitle, color: '#00695c' } : { ...modalStyles.doctorAppointmentTitle, fontSize: '1.1rem' }}>{isWorkflowDetailsStep ? ({ Vaccination: 'Vaccination Appointment Details', Laboratory: 'Lab Test Details', Treatment: 'Treatment Plan Details', Surgery: 'Surgery Details', Dental: 'Dental Visit Details', 'Check-up': 'Check-up Details', 'Follow-up': 'Follow-up Details', Confinement: 'Confinement Admission Details', Grooming: 'Grooming Details', General: 'General Consultation Details' }[appointmentCategory] || `${appointmentCategory} Details`) : 'New Appointment'}</h2>
        <p style={isWorkflowDetailsStep ? { ...modalStyles.addVaccinationIntro, margin: '7px 0 14px', color: '#526b64', fontSize: '.95rem' } : modalStyles.doctorAppointmentIntro}>{isWorkflowDetailsStep ? appointmentCategory === 'Dental' ? 'Record the dental service and what the team needs to know.' : appointmentCategory === 'Vaccination' ? 'Details stay with the appointment until the doctor confirms administration.' : appointmentCategory === 'Surgery' ? 'Schedule the procedure and record the pre-op steps.' : appointmentCategory === 'Laboratory' ? 'Enter the test details for this patient. You can complete the request in the Lab Test tab.' : appointmentCategory === 'Confinement' ? 'Enter the admission details to admit this patient through the appointment workflow.' : appointmentCategory === 'Grooming' ? 'Record the service, the requested style and any handling needs.' : appointmentCategory === 'General' ? 'Record the service and the main concern.' : 'Create a structured care plan and assign follow-up steps to a patient.' : 'Schedule a new appointment for a patient.'}</p>
        {isWorkflowType && appointmentCategory === 'Confinement' && <div className="confinement-step-progress" aria-label={`Confinement admission step ${confinementStep + 1} of 6`}>
          <strong>Step {confinementStep + 1} of 6</strong>
          <div className="confinement-step-progress-items">
            {['Patient & owner', 'Assessment', 'Treatment plan', 'Hospitalization', 'Consent', 'Summary'].map((label, index) => <button type="button" className={index <= confinementStep ? 'is-complete' : ''} aria-current={confinementStep === index ? 'step' : undefined} disabled={index > confinementStep} onClick={() => setConfinementStep(index)} key={label}><span aria-hidden="true" /><small>{label}</small></button>)}
          </div>
        </div>}
        {isWorkflowType && appointmentCategory !== 'Confinement' && <div className="vaccination-stepper" aria-label="Appointment progress"><span className={step === 2 || appointmentBasicsReady ? 'is-complete' : 'is-active'}><span aria-hidden="true">{step === 2 || appointmentBasicsReady ? '✓' : '1'}</span>Appointment</span><span className="vaccination-stepper-connector" aria-hidden="true" /><span className={step === 2 || appointmentBasicsReady ? 'is-active' : 'is-pending'} aria-current={step === 2 || appointmentBasicsReady ? 'step' : undefined}><span aria-hidden="true">2</span>{appointmentCategory === 'Laboratory' ? 'Lab Test' : `${appointmentCategory} details`}</span></div>}
        {isWorkflowDetailsStep && appointmentCategory === 'Laboratory' && <label style={{ ...modalStyles.addVaccinationLabel, gridColumn: '1 / -1', marginBottom: 14 }}><span style={modalStyles.addVaccinationLabelText}>Pet<span style={modalStyles.required}>*</span></span><input readOnly value={selectedPet?.name || ''} style={modalStyles.addVaccinationInput} /></label>}
        <div className={`doctor-appointment-grid${appointmentCategory === 'Treatment' && step === 2 ? ' treatment-plan-workflow-grid' : ''}${appointmentCategory === 'Vaccination' && step === 2 ? ' appointment-vaccination-grid' : ''}`} style={isWorkflowDetailsStep ? { ...modalStyles.addVaccinationGrid, gridTemplateColumns: appointmentCategory === 'Grooming' ? 'repeat(2, minmax(0, 1fr))' : 'repeat(12, minmax(0, 1fr))', gap: appointmentCategory === 'Grooming' ? '14px 16px' : 20 } : modalStyles.doctorAppointmentGrid}>
          {isWorkflowDetailsStep && appointmentCategory === 'Confinement' && <label className="confinement-pet-field" style={modalStyles.addVaccinationLabel}><span style={modalStyles.addVaccinationLabelText}>Pet</span><span className="confinement-pet-card"><span className="confinement-pet-avatar" aria-hidden="true">{selectedPet?.name?.slice(0, 1) || 'P'}</span><span>{selectedPet?.name || 'Patient'}<span className="confinement-pet-species"> · {selectedPetSpecies}</span></span></span></label>}
          {!isWorkflowDetailsStep && <>
          <label style={modalStyles.doctorAppointmentLabel}><span>Pet<span className="doctor-appointment-required">*</span></span>
            <span className="doctor-appointment-control has-chevron">
              <select required value={form.pet_id} onChange={event => {
                const pet = pets.find(item => String(item.id) === event.target.value);
                setForm(current => ({ ...current, pet_id: event.target.value, client_id: pet ? String(pet.client_id) : '', service_details: {}, parent_appointment_id: '', related_treatment_plan_id: '', treatment_plan_title: '', treatment_diagnosis: '', treatment_plan_steps: [{ title: '', due: '' }] }));
                setConsentPaperFile(null);
                setShowAllVaccinationHistory(false);
              }} className="doctor-appointment-input" style={modalStyles.doctorAppointmentInput}>
                <option value="">Select pet</option>{activePets.map(pet => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
              </select>
            </span>
          </label>
          <label style={modalStyles.doctorAppointmentLabel}><span>Owner<span className="doctor-appointment-required">*</span></span>
            <span className="doctor-appointment-control has-chevron">
              <select required value={form.client_id} onChange={event => { setForm(current => ({ ...current, client_id: event.target.value, pet_id: '', service_details: {}, parent_appointment_id: '', related_treatment_plan_id: '', treatment_plan_title: '', treatment_diagnosis: '', treatment_plan_steps: [{ title: '', due: '' }] })); setConsentPaperFile(null); setShowAllVaccinationHistory(false); }} className="doctor-appointment-input" style={modalStyles.doctorAppointmentInput}>
                <option value="">Select owner</option>{activeOwners.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
              </select>
            </span>
          </label>
          <div className="doctor-appointment-owner-hint" style={{ gridColumn: '1 / -1' }}>Auto-fill owner from selected pet</div>
          <label style={modalStyles.doctorAppointmentLabel}><span>Date<span className="doctor-appointment-required">*</span></span>
            <span className="doctor-appointment-control"><LabDateTimePicker mode="date" required value={form.date} onChange={date => setForm(current => ({ ...current, date, time: getUnavailableAppointmentTimes(appointments, date).includes(current.time) ? '' : current.time }))} className="doctor-appointment-input" style={modalStyles.doctorAppointmentInput} /></span>
          </label>
          <label style={modalStyles.doctorAppointmentLabel}><span>Time<span className="doctor-appointment-required">*</span></span>
            <span className="doctor-appointment-control"><LabDateTimePicker mode="time" required value={form.time} unavailableTimes={unavailableAppointmentTimes} unavailableLabel="another appointment" onChange={time => update('time', time)} className="doctor-appointment-input" style={modalStyles.doctorAppointmentInput} /></span>
          </label>
          <label style={modalStyles.doctorAppointmentLabel}><span>Appointment Type<span className="doctor-appointment-required">*</span></span>
            <span className="doctor-appointment-control has-chevron">
              <select required value={form.type} onChange={event => {
                setForm(current => ({
                  ...current,
                  type: event.target.value,
                  service_name: '',
                  service_details: {},
                  parent_appointment_id: '',
                  related_treatment_plan_id: '',
                  treatment_plan_title: '',
                  treatment_diagnosis: '',
                  treatment_plan_steps: [{ title: '', due: '' }],
                }));
                setConfinementStep(0);
              }} className="doctor-appointment-input" style={modalStyles.doctorAppointmentInput}>
                <option value="">Select appointment type</option>
                {['Vaccination', 'Treatment', 'Laboratory', 'Surgery', 'Dental', 'Check-up', 'Follow-up', 'Confinement', 'Grooming', 'General'].map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </span>
          </label>
          {form.type === 'Vaccination' && <label style={modalStyles.doctorAppointmentLabel}>Duration
            <span className="doctor-appointment-control"><input readOnly value={`${durationMinutes} minutes`} className="doctor-appointment-input" style={{ ...modalStyles.doctorAppointmentInput, color: '#64748b' }} /></span>
          </label>}
          </>}
          {isWorkflowDetailsStep && appointmentCategory === 'Vaccination' && <label className="vaccination-product-field" style={modalStyles.addVaccinationLabel}><span style={modalStyles.addVaccinationLabelText}>Planned vaccine / product<span style={modalStyles.required}>*</span></span><span className="doctor-appointment-control service-picker-control vaccination-product-control" ref={servicePickerRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setServicePickerOpen(false); }}>
            <input
              required
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={servicePickerOpen}
              aria-controls="appointment-service-options"
              aria-activedescendant={servicePickerOpen && matchingServiceOptions[servicePickerIndex] ? `appointment-service-option-${matchingServiceOptions[servicePickerIndex].id}` : undefined}
              value={form.service_name}
              onFocus={() => { setServicePickerOpen(true); setServicePickerIndex(0); }}
              onChange={event => { update('service_name', event.target.value); setServicePickerOpen(true); setServicePickerIndex(0); }}
              onKeyDown={event => {
                if (event.key === 'ArrowDown') { event.preventDefault(); setServicePickerOpen(true); setServicePickerIndex(index => Math.min(index + 1, Math.max(0, matchingServiceOptions.length - 1))); }
                if (event.key === 'ArrowUp') { event.preventDefault(); setServicePickerOpen(true); setServicePickerIndex(index => Math.max(0, index - 1)); }
                if (event.key === 'Escape') setServicePickerOpen(false);
                if (event.key === 'Enter' && servicePickerOpen && matchingServiceOptions[servicePickerIndex]) { event.preventDefault(); chooseService(matchingServiceOptions[servicePickerIndex]); }
              }}
              placeholder="Rabies (IMRAB 3TF)"
              className="doctor-appointment-input service-picker-input"
              style={{ ...modalStyles.addVaccinationInput, display: 'block', width: '100%', minWidth: 0, minHeight: 0, height: '100%', maxHeight: 'none', boxSizing: 'border-box', padding: '0 42px 0 14px', border: '1px solid #d9e3de', borderRadius: 10, background: '#f7faf8', color: '#1f2d28', fontSize: '15.5px', fontWeight: 500, lineHeight: 'normal' }}
            />
            <button type="button" className="service-picker-toggle" aria-label="Choose from clinic services" aria-expanded={servicePickerOpen} onMouseDown={event => event.preventDefault()} onClick={() => setServicePickerOpen(open => !open)}><span aria-hidden="true" /></button>
            {servicePickerOpen && servicePickerPosition && createPortal(<div className="service-picker-menu" id="appointment-service-options" role="listbox" aria-label="Available clinic services" style={servicePickerPosition}>
              {matchingServiceOptions.length ? matchingServiceOptions.map((item, index) => <button type="button" role="option" aria-selected={form.service_name === item.name} id={`appointment-service-option-${item.id}`} key={item.id} className={`service-picker-option${servicePickerIndex === index ? ' highlighted' : ''}`} onMouseEnter={() => setServicePickerIndex(index)} onMouseDown={event => event.preventDefault()} onClick={() => chooseService(item)}><strong>{item.name}</strong><span>₱{Number(item.unit_price || 0).toLocaleString('en-PH')} / {item.unit || 'item'}</span></button>) : <div className="service-picker-empty">No matching services in the clinic catalog.</div>}
            </div>, document.body)}
          </span></label>}
          {isWorkflowDetailsStep && appointmentCategory === 'Vaccination' && <label className="vaccination-pet-field"><span>Pet</span><span className="vaccination-patient-card"><span className="vaccination-patient-avatar" aria-hidden="true">{selectedPet?.name?.slice(0, 1) || 'P'}</span><span>{selectedPet?.name || 'Patient not selected'}<span className="vaccination-patient-species"> · {selectedPetSpecies}</span></span></span></label>}
          {isWorkflowDetailsStep && !['Laboratory', 'Vaccination'].includes(appointmentCategory) && <label           className={`${appointmentCategory === 'Surgery' ? 'surgery-procedure-field ' : ''}appointment-service-field`}           style={{ ...modalStyles.doctorAppointmentLabel, gridColumn: appointmentCategory === 'General' ? '1' : ['Dental', 'Check-up', 'Follow-up'].includes(appointmentCategory) ? '1 / 7' : '1 / -1' }}><span>{appointmentCategory === 'Treatment' ? <>Treatment Service<span className="doctor-appointment-required">*</span></> : appointmentCategory === 'Surgery' ? <>Surgical Procedure<span className="doctor-appointment-required">*</span></> : appointmentCategory === 'Dental' ? <>Dental Service<span className="doctor-appointment-required">*</span></> : appointmentCategory === 'Follow-up' ? <>Follow-up Service<span className="doctor-appointment-required">*</span></> : appointmentCategory === 'Check-up' ? <>Check-up Type<span className="doctor-appointment-required">*</span></> : appointmentCategory === 'Grooming' ? <>Grooming Service<span className="doctor-appointment-required">*</span></> : appointmentCategory === 'General' ? <>General Service<span className="doctor-appointment-required">*</span></> : <>Confinement Service<span className="doctor-appointment-required">*</span></>}</span>
            <span className="doctor-appointment-control service-picker-control" ref={servicePickerRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setServicePickerOpen(false); }}>
              <input
                required
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={servicePickerOpen}
                aria-controls="appointment-service-options"
                aria-activedescendant={servicePickerOpen && matchingServiceOptions[servicePickerIndex] ? `appointment-service-option-${matchingServiceOptions[servicePickerIndex].id}` : undefined}
                value={form.service_name}
                onFocus={() => { setServicePickerOpen(true); setServicePickerIndex(0); }}
                onChange={event => { update('service_name', event.target.value); setServicePickerOpen(true); setServicePickerIndex(0); }}
                onKeyDown={event => {
                  if (event.key === 'ArrowDown') { event.preventDefault(); setServicePickerOpen(true); setServicePickerIndex(index => Math.min(index + 1, Math.max(0, matchingServiceOptions.length - 1))); }
                  if (event.key === 'ArrowUp') { event.preventDefault(); setServicePickerOpen(true); setServicePickerIndex(index => Math.max(0, index - 1)); }
                  if (event.key === 'Escape') setServicePickerOpen(false);
                  if (event.key === 'Enter' && servicePickerOpen && matchingServiceOptions[servicePickerIndex]) { event.preventDefault(); chooseService(matchingServiceOptions[servicePickerIndex]); }
                }}
                placeholder={appointmentCategory === 'Vaccination' ? 'Rabies (IMRAB 3TF)' : servicePlaceholder}
                className="doctor-appointment-input service-picker-input"
                style={['Vaccination', 'Confinement'].includes(appointmentCategory) && step === 2 ? modalStyles.addVaccinationInput : modalStyles.doctorAppointmentInput}
              />
              <button type="button" className="service-picker-toggle" aria-label="Choose from clinic services" aria-expanded={servicePickerOpen} onMouseDown={event => event.preventDefault()} onClick={() => setServicePickerOpen(open => !open)}><span aria-hidden="true" /></button>
              {servicePickerOpen && servicePickerPosition && createPortal(<div className="service-picker-menu" id="appointment-service-options" role="listbox" aria-label="Available clinic services" style={servicePickerPosition}>
                {matchingServiceOptions.length ? matchingServiceOptions.map((item, index) => <button
                  type="button"
                  role="option"
                  aria-selected={form.service_name === item.name}
                  id={`appointment-service-option-${item.id}`}
                  key={item.id}
                  className={`service-picker-option${servicePickerIndex === index ? ' highlighted' : ''}`}
                  onMouseEnter={() => setServicePickerIndex(index)}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => chooseService(item)}
                ><strong>{item.name}</strong><span>₱{Number(item.unit_price || 0).toLocaleString('en-PH')} / {item.unit || 'item'}</span></button>) : <div className="service-picker-empty">No matching services in the clinic catalog.</div>}
              </div>, document.body)}
            </span>
          </label>}
          {appointmentCategory === 'Vaccination' && step === 2 && <>
            <div className="vaccination-reason-field">
              <span className="vaccination-reason-label">Reason for vaccination<span style={modalStyles.required}>*</span></span>
              <div className="vaccination-reason-chips" role="group" aria-label="Reason for vaccination">
                {['Routine schedule', 'Booster', 'Risk exposure', 'Boarding or travel', 'Other'].map(reason => <button key={reason} type="button" className={`vaccination-reason-chip${serviceDetail('reason_category') === reason ? ' is-selected' : ''}`} aria-pressed={serviceDetail('reason_category') === reason} onClick={() => updateServiceDetail('reason_category', reason)}>{reason}</button>)}
              </div>
              {serviceDetail('reason_category') === 'Other' && <input aria-label="Optional note about vaccination reason" value={serviceDetail('reason_note')} onChange={event => updateServiceDetail('reason_note', event.target.value)} placeholder="Add a short reason (optional)" className="vaccination-reason-note" />}
            </div>
            <section className="vaccination-history-panel" aria-label="Vaccination history">
              <div className="vaccination-history-heading"><strong>Vaccination history</strong></div>
              {vaccinationHistory.length ? <div className="vaccination-history-rows" role="list">{(showAllVaccinationHistory ? vaccinationHistory : vaccinationHistory.slice(0, 3)).map(entry => <div className="vaccination-history-row" role="listitem" key={entry.key}>
                <div className="vaccination-history-details"><span className="vaccination-history-name">{String(entry.vaccine || 'Vaccination')}</span><time className="vaccination-history-date" dateTime={entry.dateKey || undefined}>{formatShortClinicDate(entry.date)}</time>{duplicateVaccineEntry?.key === entry.key && <span className="vaccination-duplicate-inline" role="status">Possible duplicate booking</span>}</div>
                <span className={`vaccination-history-status${entry.status === 'Administered' ? ' is-administered' : ''}`}>{entry.status}</span>
              </div>)}</div> : <p className="vaccination-history-empty">No vaccination history recorded.</p>}
              {vaccinationHistory.length > 3 && <button type="button" className="vaccination-history-toggle" aria-expanded={showAllVaccinationHistory} onClick={() => setShowAllVaccinationHistory(value => !value)}>{showAllVaccinationHistory ? 'Show less' : 'Show all'}</button>}
            </section>
            <label className="vaccination-booking-notes" style={{ ...modalStyles.addVaccinationLabel, gridColumn: '1 / -1' }}><span style={modalStyles.addVaccinationLabelText}>Booking notes (optional)</span><textarea rows={2} value={form.notes} onChange={event => update('notes', event.target.value)} placeholder="Optional notes for the scheduled vaccination" style={{ ...modalStyles.addVaccinationInput, minHeight: 54, height: 'auto', maxHeight: 90, padding: '8px 10px' }} /></label>
          </>}
          {appointmentCategory === 'Treatment' && step === 2 && <>
            <label className="treatment-plan-patient-field" style={modalStyles.addVaccinationLabel}><span style={modalStyles.addVaccinationLabelText}>Patient (Pet)<span style={modalStyles.required}>*</span></span><input readOnly value={selectedPet?.name || ''} style={{ ...modalStyles.addVaccinationInput, minHeight: 48, border: '1px solid #d8e9e1', background: '#fff', fontSize: '1rem' }} /></label>
            <label className="treatment-plan-existing-field" style={{ ...modalStyles.addVaccinationLabel, gridColumn: '1 / -1' }}><span style={modalStyles.addVaccinationLabelText}>Existing Treatment Plan</span><select value={form.related_treatment_plan_id} onChange={event => update('related_treatment_plan_id', event.target.value)} style={{ ...modalStyles.addVaccinationInput, minHeight: 48, border: '1px solid #d8e9e1', background: '#fff', fontSize: '1rem' }}><option value="">Create a new plan for this care episode</option>{treatmentPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.title} · {plan.status || 'Active'}</option>)}</select><small>Choose an existing plan to avoid creating a duplicate.</small></label>
            {!form.related_treatment_plan_id && <>
            <label className="treatment-plan-title-field" style={modalStyles.addVaccinationLabel}><span style={modalStyles.addVaccinationLabelText}>Plan title<span style={modalStyles.required}>*</span></span><input required value={form.treatment_plan_title || (form.service_name ? `${form.service_name} Plan` : '')} onChange={event => update('treatment_plan_title', event.target.value)} placeholder="e.g. Post-surgery recovery" style={{ ...modalStyles.addVaccinationInput, minHeight: 48, border: '1px solid #d8e9e1', background: '#fff', fontSize: '1rem' }} /></label>
            <label className="treatment-plan-diagnosis-field" style={modalStyles.addVaccinationLabel}><span style={modalStyles.addVaccinationLabelText}>Diagnosis<span style={modalStyles.required}>*</span></span><input required value={form.treatment_diagnosis} onChange={event => update('treatment_diagnosis', event.target.value)} placeholder="Enter diagnosis or reason for care" style={{ ...modalStyles.addVaccinationInput, minHeight: 48, border: '1px solid #d8e9e1', background: '#fff', fontSize: '1rem' }} /></label>
            <label className="treatment-plan-severity-field" style={modalStyles.addVaccinationLabel}><span style={modalStyles.addVaccinationLabelText}>Severity</span><FilterSelect className="treatment-plan-select" label="Severity" value={form.treatment_severity} onChange={value => update('treatment_severity', value)} options={[['mild', 'Mild'], ['moderate', 'Moderate'], ['severe', 'Severe'], ['critical', 'Critical']].map(([value, label]) => ({ value, label }))} /></label>
            <label className="treatment-plan-veterinarian-field" style={modalStyles.addVaccinationLabel}><span style={modalStyles.addVaccinationLabelText}>Attending veterinarian</span><FilterSelect className="treatment-plan-select" label="Attending veterinarian" value={form.practitioner_id} onChange={value => update('practitioner_id', value)} options={[{ value: '', label: 'Select veterinarian' }, ...veterinarians.map(member => ({ value: String(member.id), label: member.name }))]} /></label>
            <label className="treatment-plan-follow-up-field" style={modalStyles.addVaccinationLabel}><span style={modalStyles.addVaccinationLabelText}>Expected follow-up</span><LabDateTimePicker className="treatment-plan-date" mode="date" displayFormat="input" value={form.treatment_follow_up} onChange={date => update('treatment_follow_up', date)} style={{ ...modalStyles.addVaccinationInput, minHeight: 48, border: '1px solid #d8e9e1', background: '#fff', fontSize: '1rem' }} /></label>
            <section className="treatment-plan-steps-section" style={{ gridColumn: '1 / -1', display: 'grid', gap: 10, marginTop: 4 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><div><strong style={{ color: '#193a32', fontSize: '1.1rem' }}>Treatment steps<span style={modalStyles.required}>*</span></strong><p style={{ margin: '4px 0 0', color: '#526b64', fontSize: '.9rem' }}>Add the actions that make up this care plan.</p></div><button type="button" onClick={() => update('treatment_plan_steps', [...form.treatment_plan_steps, { title: '', due: '' }])} style={{ ...modalStyles.cancel, minHeight: 42, padding: '8px 13px', color: '#005447', fontSize: '.9rem' }}>＋ Add step</button></div>
              {form.treatment_plan_steps.map((planStep, index) => <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(145px, .55fr) auto', gap: 9, alignItems: 'center' }}>
                <input aria-label={`Treatment step ${index + 1}`} required={index === 0 || Boolean(planStep.title)} value={planStep.title || (index === 0 ? form.treatment_steps || form.service_name : '')} onChange={event => update('treatment_plan_steps', form.treatment_plan_steps.map((item, stepIndex) => stepIndex === index ? { ...item, title: event.target.value } : item))} placeholder={`Step ${index + 1} · e.g. Initial assessment`} style={{ ...modalStyles.addVaccinationInput, minHeight: 48, border: '1px solid #d8e9e1', background: '#fff', fontSize: '.95rem' }} />
                <LabDateTimePicker className="treatment-plan-date" displayFormat="input" mode="date" label={`Treatment step ${index + 1} due date`} value={planStep.due || (index === 0 ? form.date : '')} onChange={due => update('treatment_plan_steps', form.treatment_plan_steps.map((item, stepIndex) => stepIndex === index ? { ...item, due } : item))} style={{ ...modalStyles.addVaccinationInput, minHeight: 48, border: '1px solid #d8e9e1', background: '#fff', fontSize: '.95rem' }} />
                <button type="button" disabled={form.treatment_plan_steps.length === 1} aria-label={`Remove treatment step ${index + 1}`} onClick={() => update('treatment_plan_steps', form.treatment_plan_steps.filter((_, stepIndex) => stepIndex !== index))} style={{ ...modalStyles.cancel, minWidth: 42, minHeight: 42, padding: 7, color: '#b42318' }}>{Icons.trash}</button>
              </div>)}
            </section>
            <section className="treatment-plan-medication-section" style={{ gridColumn: '1 / -1', display: 'grid', gap: 12, marginTop: 6, padding: 16, border: '1px solid #d8e9e1', borderRadius: 10, background: '#f8fbf9' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#193a32', fontSize: '.95rem', fontWeight: 650, cursor: 'pointer' }}><input type="checkbox" checked={form.treatment_include_medication} onChange={event => update('treatment_include_medication', event.target.checked)} style={{ width: 18, height: 18, accentColor: '#078673' }} />Add a medication prescription to this treatment plan</label>
              {form.treatment_include_medication && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px 14px' }}>{[['Medication*', 'name', 'e.g. Amoxicillin'], ['Dosage*', 'dosage', 'e.g. 250 mg'], ['Route', 'route', 'e.g. Oral'], ['Frequency', 'frequency', 'e.g. Twice daily'], ['Quantity', 'quantity', 'e.g. 14 capsules']].map(([label, key, placeholder]) => <label key={key} style={{ display: 'grid', gap: 6, color: '#193a32', fontSize: '.86rem', fontWeight: 600 }}>{label}<input required={key === 'name' || key === 'dosage'} value={form.treatment_medication[key]} onChange={event => update('treatment_medication', { ...form.treatment_medication, [key]: event.target.value })} placeholder={placeholder} style={{ ...modalStyles.addVaccinationInput, minHeight: 43, border: '1px solid #d8e9e1', background: '#fff', fontSize: '.9rem' }} /></label>)}</div>}
            </section>
            </>}
          </>}
          {appointmentCategory === 'Surgery' && step === 2 && <>
            <div className="surgery-section-heading" role="heading" aria-level="3">Procedure</div>
            {serviceTextField('Reason for Surgery', 'reason', 'Why is the procedure being scheduled?', { className: 'surgery-half-field' })}
            {serviceTextField('Diagnosis / Indication', 'diagnosis', 'Diagnosis or clinical indication', { className: 'surgery-half-field' })}
            <label className="surgery-status-field surgery-preop-field" style={modalStyles.doctorAppointmentLabel}><span>Pre-op assessment</span><span className="surgery-status-options" role="group" aria-label="Preoperative assessment status">{[['pending', 'Pending'], ['cleared', 'Cleared'], ['not_cleared', 'Not cleared']].map(([value, label]) => <button key={value} type="button" aria-pressed={serviceDetail('preoperative_status') === value} onClick={() => updateServiceDetail('preoperative_status', value)}>{label}</button>)}</span></label>
            <label className="surgery-status-field surgery-consent-field" style={modalStyles.doctorAppointmentLabel}><span>Consent</span><span className="surgery-status-options" role="group" aria-label="Consent status">{[['required', 'Required'], ['obtained', 'Obtained'], ['declined', 'Declined']].map(([value, label]) => <button key={value} type="button" aria-pressed={serviceDetail('consent_status') === value} onClick={() => updateServiceDetail('consent_status', value)}>{label}</button>)}</span></label>
            {serviceTextField('Preoperative Notes', 'preoperative_notes', 'Notes for the preoperative assessment', { full: true, className: 'surgery-notes-field' })}
            <div className="surgery-section-heading" role="heading" aria-level="3">Consent &amp; team</div>
            <label className="surgery-related-plan-field" style={modalStyles.doctorAppointmentLabel}><span>Related visit / treatment plan</span><select value={form.related_treatment_plan_id} onChange={event => update('related_treatment_plan_id', event.target.value)} className={`doctor-appointment-input${form.related_treatment_plan_id ? '' : ' surgery-placeholder-value'}`} style={modalStyles.doctorAppointmentInput}><option value="">Optional</option>{treatmentPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.title}</option>)}</select></label>
            <label className="surgery-veterinarian-field" style={modalStyles.doctorAppointmentLabel}><span>Attending Veterinarian</span><span className="doctor-appointment-control has-chevron"><select value={form.practitioner_id} onChange={event => update('practitioner_id', event.target.value)} className={`doctor-appointment-input${form.practitioner_id ? '' : ' surgery-placeholder-value'}`} style={modalStyles.doctorAppointmentInput}><option value="">Select veterinarian (optional)</option>{veterinarians.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></span></label>
          </>}
          {appointmentCategory === 'Dental' && step === 2 && <>
            {serviceTextField('Reason for Visit', 'reason', 'Reason for this dental visit', { className: 'dental-reason-field', gridColumn: '1 / 7', gridRow: '2' })}
            {serviceTextField('Known Dental Concerns', 'concerns', 'Known concerns or symptoms', { className: 'dental-concerns-field', gridColumn: '7 / -1', gridRow: '2' })}
            <label className="dental-history-field" style={{ ...modalStyles.doctorAppointmentLabel, gridColumn: '1 / -1', gridRow: '3' }}><span>Previous Dental History</span><div className="dental-history-box">{(clinicalHistory?.medicalHistory || []).filter(item => /dental|tooth|oral/i.test(item)).join('\n') || 'No linked dental history recorded.'}</div></label>
            <label className="dental-related-plan-field" style={{ ...modalStyles.doctorAppointmentLabel, gridColumn: '1 / 7', gridRow: '4' }}><span>Related Visit / Treatment Plan</span><select value={form.related_treatment_plan_id} onChange={event => update('related_treatment_plan_id', event.target.value)} className="doctor-appointment-input" style={modalStyles.doctorAppointmentInput}><option value="">Select related plan (optional)</option>{treatmentPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.title}</option>)}</select></label>
            <label className="dental-assessment-field" style={{ ...modalStyles.doctorAppointmentLabel, gridColumn: '7 / -1', gridRow: '4' }}><span>Pre-procedure Assessment</span><span className="dental-assessment-chips" role="group" aria-label="Pre-procedure Assessment">{[['pending', 'Pending'], ['required', 'Cleared'], ['not_applicable', 'Not cleared']].map(([value, label]) => <button key={value} type="button" className={serviceDetail('preprocedure_status') === value ? 'is-selected' : ''} aria-pressed={serviceDetail('preprocedure_status') === value} onClick={() => updateServiceDetail('preprocedure_status', value)}>{label}</button>)}</span></label>
            {serviceTextField('Notes', 'notes', 'Booking notes', { full: true, className: 'dental-notes-field', gridColumn: '1 / -1', gridRow: '5' })}{attendingVeterinarianField}
          </>}
          {appointmentCategory === 'Check-up' && step === 2 && <>
            {serviceTextField('Reason for Check-up', 'reason', 'Reason for this check-up', { full: true, className: 'checkup-reason-field' })}
            {serviceTextField('Current Concerns', 'concerns', 'Describe current concerns', { className: 'checkup-concerns-field' })}
            <label className="checkup-history-field" style={{ ...modalStyles.doctorAppointmentLabel, gridColumn: '1 / -1', gridRow: 3 }}><span>Relevant medical history</span><div className="checkup-history-card">{clinicalHistory?.medicalHistory?.length ? <><div className="checkup-history-card-content"><strong>{String(clinicalHistory.medicalHistory[0]).split('\n')[0]}</strong><small>{String(clinicalHistory.medicalHistory[0]).split('\n').slice(1).join(' ') || 'To avoid infection while recovering'}</small></div><span className="checkup-history-status">Active</span></> : <span className="checkup-history-empty">No linked medical history recorded.</span>}</div></label>
            {serviceTextField('Booking Notes', 'notes', 'Notes for the visit', { full: true, className: 'checkup-notes-field' })}{attendingVeterinarianField}
          </>}
          {appointmentCategory === 'Follow-up' && step === 2 && <>
            <label className="followup-original-field" style={{ ...modalStyles.doctorAppointmentLabel, gridColumn: '1 / -1' }}><span>Original Visit / Treatment Plan<span className="doctor-appointment-required">*</span></span><select required value={form.parent_appointment_id} onChange={event => update('parent_appointment_id', event.target.value)} className="doctor-appointment-input" style={modalStyles.doctorAppointmentInput}><option value="">Select original appointment</option>{matchingAppointments.map(item => <option key={item.id} value={item.id}>{formatDateTimeText(item.start_time || item.datetime)} · {item.reason || item.type || 'Appointment'}</option>)}</select></label>
            <label className="followup-related-field" style={modalStyles.doctorAppointmentLabel}><span>Related Treatment Plan</span><select value={form.related_treatment_plan_id} onChange={event => update('related_treatment_plan_id', event.target.value)} className="doctor-appointment-input" style={modalStyles.doctorAppointmentInput}><option value="">Select treatment plan (optional)</option>{treatmentPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.title} · {plan.status}</option>)}</select></label>
            {serviceTextField('Previous Instructions', 'previous_instructions', 'Select an original visit or treatment plan to view instructions', { full: true, readOnly: true, className: 'followup-instructions-field', value: linkedAppointment ? readLinkedInstructions(linkedAppointment) : linkedTreatmentPlan ? `${linkedTreatmentPlan.diagnosis || ''}${Array.isArray(linkedTreatmentPlan.steps) ? `\n${linkedTreatmentPlan.steps.map(item => item.title).filter(Boolean).join('\n')}` : ''}`.trim() || 'No previous instructions recorded.' : 'Select an original visit or treatment plan.' })}
            {serviceTextField('Follow-up Reason', 'reason', 'Reason for follow-up', { className: 'followup-reason-field', gridColumn: '1 / 7' })}
            <label className="followup-date-field" style={modalStyles.doctorAppointmentLabel}><span>Expected follow-up date</span><input type="date" className="followup-date-input" value={serviceDetail('expected_follow_up')} onChange={event => updateServiceDetail('expected_follow_up', event.target.value)} style={modalStyles.doctorAppointmentInput} /></label>
            {serviceTextField('Booking Notes', 'notes', 'Notes for the follow-up', { className: 'followup-notes-field', gridColumn: '7 / -1' })}{attendingVeterinarianField}
          </>}
          {appointmentCategory === 'Grooming' && step === 2 && <>
            {serviceTextField('Requested Style / Haircut', 'style', 'Requested style or haircut', { className: 'grooming-style-field' })}
            <label className="grooming-coat-field"><span>Coat condition</span><span className="grooming-chip-group" role="group" aria-label="Coat condition">{['Normal', 'Tangled', 'Matted', 'Heavy shedding'].map(option => <button key={option} type="button" className={serviceDetail('coat_condition') === option ? 'is-selected' : ''} aria-pressed={serviceDetail('coat_condition') === option} onClick={() => updateServiceDetail('coat_condition', serviceDetail('coat_condition') === option ? '' : option)}>{option}</button>)}</span></label>
            <label className="grooming-handling-field"><span>Special handling</span><span className="grooming-chip-group" role="group" aria-label="Special handling">{['Nervous', 'May bite', 'Sensitive skin', 'Senior or fragile'].map(option => {
              const selectedHandling = String(serviceDetail('handling') || '').split(',').map(value => value.trim()).filter(Boolean);
              const isSelected = selectedHandling.includes(option);
              return <button key={option} type="button" className={isSelected ? 'is-selected' : ''} aria-pressed={isSelected} onClick={() => updateServiceDetail('handling', [...new Set(isSelected ? selectedHandling.filter(value => value !== option) : [...selectedHandling, option])].join(', '))}>{option}</button>;
            })}</span></label>
            {serviceTextField('Additional Grooming Preferences', 'preferences', 'Optional grooming preferences', { className: 'grooming-preferences-field' })}
            <label className="grooming-assigned-field"><span>Assigned groomer <small>(optional)</small></span><select value={serviceDetail('groomer')} onChange={event => updateServiceDetail('groomer', event.target.value)} className="doctor-appointment-input"><option value="">Any available</option>{veterinarians.map(member => <option key={member.id} value={member.name}>{member.name}</option>)}</select></label>
            {serviceTextField('Booking Notes', 'notes', 'Notes for the grooming team', { full: true, className: 'grooming-notes-field' })}
          </>}
          {appointmentCategory === 'General' && step === 2 && <>
            {serviceTextField('Consultation Reason', 'reason', 'Reason for consultation', { className: 'general-reason-field' })}
            {serviceTextField('Main Concern', 'concern', 'Primary concern', { className: 'general-concern-field' })}
            <label className="general-history-field"><span>Relevant medical history</span><div className="general-history-card">{treatmentPlans[0] || clinicalHistory?.medicalHistory?.[0] ? <><div className="general-history-card-content"><strong>{treatmentPlans[0]?.title || String(clinicalHistory?.medicalHistory?.[0] || '').split(' · ')[0]}</strong><small>{treatmentPlans[0]?.diagnosis || String(clinicalHistory?.medicalHistory?.[0] || '').split(' · ').slice(1, -1).join(' · ') || 'Previously recorded for this patient'}</small></div>{treatmentPlans[0]?.status && <span className="general-history-status">{treatmentPlans[0].status}</span>}</> : <span className="general-history-empty">No linked medical history recorded.</span>}</div></label>
            <label className="general-related-plan-field" style={modalStyles.doctorAppointmentLabel}><span>Related Visit / Treatment Plan</span><select value={form.related_treatment_plan_id} onChange={event => update('related_treatment_plan_id', event.target.value)} className="doctor-appointment-input" style={modalStyles.doctorAppointmentInput}><option value="">Select related plan (optional)</option>{treatmentPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.title}</option>)}</select></label>
            {serviceTextField('Booking Notes', 'notes', 'Booking notes', { className: 'general-notes-field' })}{attendingVeterinarianField}
          </>}
          {appointmentCategory === 'Confinement' && step === 2 && <section className="appointment-confinement-workflow" style={{ gridColumn: '1 / -1', display: 'grid', gap: 12 }}>
              {confinementStep === 0 && <div className="confinement-patient-overview"><strong>Patient &amp; owner</strong><div><span>Pet</span><span>{selectedPet?.name || 'Patient'} · {selectedPetSpecies}</span></div><div><span>Owner</span><span>{selectedOwner?.name || 'Owner'}</span></div><div><span>Contact</span><span>{selectedOwner?.phone || selectedOwner?.phone_number || 'Contact not recorded'}</span></div></div>}
            {confinementStep === 1 && <>{serviceTextField('Admission Reason', 'admission_reason', 'Reason for hospitalization', { required: true, className: 'confinement-admission-reason-field' })}<label className="confinement-urgency-field" style={modalStyles.doctorAppointmentLabel}><span>Urgency</span><select value={serviceDetail('urgency_level') || 'Normal'} onChange={event => updateServiceDetail('urgency_level', event.target.value)} className="doctor-appointment-input" style={modalStyles.doctorAppointmentInput}><option>Normal</option><option>Urgent</option><option>Emergency</option></select></label>{serviceTextField('Presenting Complaint', 'presenting_complaint', 'Presenting complaint', { required: true, full: true, className: 'confinement-presenting-complaint-field' })}{serviceTextField('Provisional Diagnosis', 'provisional_diagnosis', 'Provisional diagnosis', { className: 'confinement-provisional-diagnosis-field' })}{serviceTextField('Clinical Assessment', 'initial_assessment', 'Initial clinical assessment', { className: 'confinement-clinical-assessment-field' })}{serviceTextField('Physical Examination / Notes', 'physical_notes', 'Findings and immediate care needs', { full: true, className: 'confinement-physical-notes-field' })}<label className="confinement-weight-field" style={modalStyles.doctorAppointmentLabel}><span>Weight (kg)</span><input type="number" min="0" step="any" value={serviceDetail('patient_weight')} onChange={event => updateServiceDetail('patient_weight', event.target.value)} style={modalStyles.doctorAppointmentInput} /></label><label className="confinement-temperature-field" style={modalStyles.doctorAppointmentLabel}><span>Temperature (°C)</span><input type="number" min="0" step="any" value={serviceDetail('temperature')} onChange={event => updateServiceDetail('temperature', event.target.value)} style={modalStyles.doctorAppointmentInput} /></label>{serviceTextField('Known Allergies', 'known_allergies', '', { readOnly: true, value: clinicalHistory?.allergies || 'None recorded.', rows: 1, className: 'confinement-known-allergies-field' })}{serviceTextField('Relevant Medical History', 'medical_history', 'Loading linked history…', { full: true, readOnly: true, value: clinicalHistory?.medicalHistory?.join('\n') || 'No linked medical history recorded.', className: 'confinement-medical-history-field' })}</>}
            {confinementStep === 2 && <><label style={{ ...modalStyles.doctorAppointmentLabel, gridColumn: '1 / -1' }}><span>Linked Treatment Plan</span><select value={form.related_treatment_plan_id} onChange={event => update('related_treatment_plan_id', event.target.value)} className="doctor-appointment-input" style={modalStyles.doctorAppointmentInput}><option value="">No linked plan</option>{treatmentPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.title} · {plan.status}</option>)}</select></label><p style={{ gridColumn: '1 / -1', color: '#64748b', fontSize: '.75rem' }}>New treatment plans can be created in Treatment Plans; this booking will not create a duplicate plan.</p></>}
            {confinementStep === 3 && <><label className="confinement-ward-field" style={modalStyles.doctorAppointmentLabel}><span>Ward / Cage<span className="doctor-appointment-required">*</span></span><select required value={serviceDetail('ward')} onChange={event => updateServiceDetail('ward', event.target.value)} className="doctor-appointment-input" style={modalStyles.doctorAppointmentInput}><option value="">Select ward / cage</option>{['Ward A - Cage 1', 'Ward A - Cage 2', 'Ward A - Cage 3', 'Ward B - Cage 1', 'Ward B - Cage 2'].map(ward => <option key={ward}>{ward}</option>)}</select></label><label className="confinement-discharge-date-field" style={modalStyles.doctorAppointmentLabel}><span>Expected Discharge Date<span className="doctor-appointment-required">*</span></span><LabDateTimePicker mode="date" value={serviceDetail('expected_discharge_at')} onChange={value => updateServiceDetail('expected_discharge_at', value)} style={modalStyles.doctorAppointmentInput} /></label>{attendingVeterinarianField}</>}
            {confinementStep === 4 && <><label className="confinement-consent-status-field" style={modalStyles.doctorAppointmentLabel}><span>Consent Status<span className="doctor-appointment-required">*</span></span><select required value={serviceDetail('consent_status') || ''} onChange={event => updateServiceDetail('consent_status', event.target.value)} className="doctor-appointment-input" style={modalStyles.doctorAppointmentInput}><option value="">Select consent status</option><option value="obtained">Obtained</option><option value="pending">Pending</option><option value="declined">Declined</option></select></label>{serviceTextField('Authorized By', 'authorized_by', selectedOwner?.name || 'Owner / authorized representative', { required: true, rows: 1, className: 'confinement-authorized-by-field' })}{serviceTextField('Consent Scope', 'consent_scope', 'Hospital admission and inpatient care', { required: true, full: true, className: 'confinement-consent-scope-field' })}{serviceTextField('Consent Notes', 'consent_notes', 'Consent documentation notes', { full: true, className: 'confinement-consent-notes-field' })}<div className="confinement-consent-upload-field"><span className="confinement-consent-upload-label">Signed consent paper <small>Optional · PDF, JPG, or PNG · up to 4 MB</small></span><div className="confinement-consent-upload-actions">{consentPaperFile && <span className="confinement-consent-file-name" title={consentPaperFile.name}>{consentPaperFile.name}</span>}<label className="confinement-consent-upload-button">{consentPaperFile ? 'Replace file' : 'Choose file'}<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={handleConsentPaperChange} /></label>{consentPaperFile && <button type="button" className="confinement-consent-remove-file" onClick={() => setConsentPaperFile(null)}>Remove</button>}</div></div></>}
            {confinementStep === 5 && <div className="confinement-final-summary" style={{ gridColumn: '1 / -1', padding: 14, border: '1px solid #d8e9e1', borderRadius: 9, background: '#f4faf8' }}><strong>Patient Summary</strong><p>{selectedPet?.name} · {selectedOwner?.name}</p><p>{serviceDetail('admission_reason') || 'Confinement'} · {serviceDetail('ward') || 'Ward not assigned'} · Consent: {serviceDetail('consent_status') || 'Not recorded'}</p><small>This creates a scheduled appointment only. Admit the patient through the inpatient admission workflow when the stay is confirmed.</small>{consentPaperFile && <ConsentDocumentView document={{ filename: consentPaperFile.name, content_type: consentPaperFile.type, data: consentPaperPreviewUrl }} />}</div>}
          </section>}
          {!isWorkflowDetailsStep && form.type !== 'Vaccination' && <label style={modalStyles.doctorAppointmentLabel}>Duration
            <span className="doctor-appointment-control"><input readOnly value={form.type ? `${durationMinutes} minutes` : 'Auto based on type'} className="doctor-appointment-input" style={{ ...modalStyles.doctorAppointmentInput, color: '#64748b' }} /></span>
          </label>}
          {!isWorkflowDetailsStep && (form.type !== 'Vaccination' || step === 2) && <label style={appointmentCategory === 'Vaccination' && step === 2 ? modalStyles.addVaccinationLabel : { ...modalStyles.doctorAppointmentLabel, gridColumn: '1 / -1' }}><span style={appointmentCategory === 'Vaccination' && step === 2 ? modalStyles.addVaccinationLabelText : undefined}>{appointmentCategory === 'Vaccination' && step === 2 ? <>Administered By<span style={modalStyles.required}>*</span></> : 'Assigned Veterinarian'}</span>
            <span className="doctor-appointment-control has-chevron">
              <select required={appointmentCategory === 'Vaccination' && step === 2} value={form.practitioner_id} onChange={event => update('practitioner_id', event.target.value)} className="doctor-appointment-input" style={appointmentCategory === 'Vaccination' && step === 2 ? modalStyles.addVaccinationInput : modalStyles.doctorAppointmentInput}>
                <option value="">Select veterinarian (optional)</option>{veterinarians.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </span>
          </label>}
        </div>
        {error && <div role="alert" style={modalStyles.error}>{error}</div>}
        <div className={`appointment-create-footer${isWorkflowDetailsStep && appointmentCategory === 'Surgery' ? ' surgery-appointment-footer' : ''}`} style={isWorkflowDetailsStep && appointmentCategory === 'Surgery' ? { ...modalStyles.addVaccinationFooter, justifyContent: 'flex-end', marginTop: 0 } : isWorkflowDetailsStep ? modalStyles.addVaccinationFooter : modalStyles.doctorAppointmentFooter}>
          {isWorkflowDetailsStep && appointmentCategory === 'Surgery' && !ready && !saving && <span className="surgery-form-hint">{!form.service_name.trim() ? 'Add a surgical procedure to continue.' : !serviceDetail('diagnosis').trim() ? 'Add a diagnosis or indication to continue.' : 'Complete the required surgery details to continue.'}</span>}
          {isWorkflowDetailsStep && appointmentCategory === 'Dental' && !ready && !saving && <span className="dental-form-hint">Choose a dental service to continue</span>}
          {isWorkflowDetailsStep && appointmentCategory === 'General' && !ready && !saving && <span className="general-form-hint">Choose a service to continue</span>}
          {isWorkflowDetailsStep && appointmentCategory === 'Grooming' && !ready && !saving && <span className="grooming-form-hint">Choose a grooming service to continue</span>}
          {isWorkflowDetailsStep && appointmentCategory === 'Confinement' && !ready && !saving && <span className="confinement-form-hint">{confinementStep === 0 ? 'Choose a confinement service to continue' : 'Complete the required confinement details to continue'}</span>}
          {isWorkflowDetailsStep && appointmentCategory === 'Vaccination' && !ready && !saving && <span className="vaccination-form-hint">{!form.service_name.trim() ? 'Choose a planned vaccine to continue.' : !serviceDetail('reason_category').trim() ? 'Choose a reason to continue.' : 'Complete the required details to continue.'}</span>}
          {isWorkflowDetailsStep && appointmentCategory === 'Treatment' && !ready && !saving && <span className="treatment-form-hint">Complete the required details to continue.</span>}
          <button type="button" onClick={() => isWorkflowDetailsStep ? setStep(1) : onClose()} style={modalStyles.cancel}>{isWorkflowDetailsStep ? 'Back' : 'Cancel'}</button>
          <button type="submit" disabled={!ready || saving} style={{ ...T.primaryBtn, padding: '8px 12px', fontSize: '.72rem', borderRadius: 7, ...(ready ? {} : modalStyles.doctorAppointmentDisabled) }}>{saving ? 'Saving...' : isWorkflowType && step === 1 ? 'Next' : appointmentCategory === 'Confinement' ? confinementStep < 5 ? 'Next' : 'Schedule Confinement' : appointmentCategory === 'Laboratory' && step === 2 ? 'Continue to Lab Test' : appointmentCategory === 'Treatment' && step === 2 ? 'Create Plan & Schedule' : 'Schedule Appointment'}</button>
        </div>
      </ModalDialog>
    </div>
  );
}

// ── VACCINATIONS TAB ───────────────────────────────────────────────────
function VaccinationsTab({ vaccinations, appointments = [], user, pets = [], onNavigate, onVaccinationsChange, onOpenAppointments, onAppointmentUpdate, onAppointmentArchive }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [practitionerFilter, setPractitionerFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [clinicVeterinarians, setClinicVeterinarians] = useState([]);
  const [localVaccinations, setLocalVaccinations] = useState(null);
  const [archiveError, setArchiveError] = useState('');
  const [historyVaccination, setHistoryVaccination] = useState(null);
  const [selectedVaccination, setSelectedVaccination] = useState(null);
  const [selectedScheduledAppointment, setSelectedScheduledAppointment] = useState(null);
  const [actionVaccination, setActionVaccination] = useState(null);
  const [verifyVaccination, setVerifyVaccination] = useState(null);
  const [editVaccination, setEditVaccination] = useState(null);
  const [addVaccination, setAddVaccination] = useState(null);
  const [editStickerImage, setEditStickerImage] = useState(null);
  const editStickerUploadRef = useRef(null);
  const [vaccinationError, setVaccinationError] = useState('');
  useEffect(() => {
    if (!user?.clinic_id || !user?.token) {
      setClinicVeterinarians([]);
      return undefined;
    }
    const controller = new AbortController();
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    fetch(`${apiUrl}/clinics/${encodeURIComponent(user.clinic_id)}/staff?status=active`, {
      headers: { Authorization: `Bearer ${user.token}` },
      signal: controller.signal,
    }).then(async response => {
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload)) throw new Error('Unable to load clinic veterinarians.');
      setClinicVeterinarians(payload.filter(member => ['doctor', 'veterinarian', 'assistant_doctor'].includes(
        String(member.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
      )));
    }).catch(error => {
      if (error.name !== 'AbortError') setClinicVeterinarians([]);
    });
    return () => controller.abort();
  }, [user?.clinic_id, user?.token]);
  const commitVaccinations = next => {
    setLocalVaccinations(next);
    onVaccinationsChange?.(next);
  };
  const vaccinationRecords = (localVaccinations || (vaccinations && vaccinations.length > 0
    ? vaccinations.map(v => ({
      ...v,
      id: v.id || v.vaccination_id,
      pet: v.pet || v.pet_name || '—',
      type: v.type || v.vaccine_name || '—',
      dateGiven: v.dateGiven || v.date_given || '—',
      nextDue: v.nextDue || v.next_due || '—',
      attendingDoctor: v.attendingDoctor || v.attending_doctor || v.administered_by || v.by || '—',
      createdBy: v.createdBy || v.created_by || v.administered_by || v.by || '—',
      lastUpdatedBy: v.lastUpdatedBy || v.last_updated_by || v.administered_by || v.by || '—',
      dateCreated: v.dateCreated || v.date_created || v.created_at || '—',
      linkedPatient: v.linkedPatient || v.linked_patient || (v.pet && v.owner ? `${v.pet} (${v.owner})` : v.pet) || '—',
      pet_id: v.pet_id,
      stickerUrl: v.sticker_url || v.stickerUrl || '',
      stickerFilename: v.sticker_filename || v.stickerFilename || '',
      verified_by_name: v.verified_by_name || '',
      verified_at: v.verified_at || '',
      shared: v.shared === true,
      status: normalizeVaccination(v).status,
      clinicVerified: v.clinicVerified ?? v.clinic_verified ?? v.verified ?? false,
    }))
    : appointments.some(appointment => !appointment.archived && /vaccin|rabies/i.test(String(appointment.reason || appointment.type || '')))
      ? []
      : VACCINATIONS));
  const savedVaccinations = vaccinationRecords.map(vaccination => {
    const pet = pets.find(item => String(item.id) === String(vaccination.pet_id));
    return {
      ...vaccination,
      photo_url: vaccination.photo_url || vaccination.pet_photo_url || getPetPhotoUrl(pet) || '',
      petDetails: [pet?.species, pet?.breed].filter(Boolean).join(' · '),
      ownerName: vaccination.owner || vaccination.owner_name || (typeof pet?.owner === 'string' ? pet.owner : pet?.owner?.name) || pet?.owner_name || '',
    };
  });
  const linkedAppointmentIds = new Set(vaccinationRecords.map(item => Number(item.appointment_id)).filter(Number.isInteger));
  const eligibleVaccinationAppointments = appointments.filter(appointment => {
    const appointmentStatus = String(appointment.status || '').toLowerCase();
    const reason = String(appointment.reason || appointment.type || '');
    return !appointment.archived && !linkedAppointmentIds.has(Number(appointment.id)) && /vaccin|rabies/i.test(reason)
      && !['completed', 'complete', 'cancelled', 'canceled', 'no show', 'no-show'].includes(appointmentStatus);
  });
  const scheduledVaccinations = eligibleVaccinationAppointments
    .filter((appointment, index, records) => records.findIndex(candidate => String(candidate.id) === String(appointment.id)) === index)
    .map(appointment => {
    let notes = appointment.notes || {};
    if (typeof notes === 'string') {
      try { notes = JSON.parse(notes); } catch { notes = {}; }
    }
    const vaccineName = String(notes.vaccination_type || notes.vaccine_name || notes.vaccineType || '').trim();
    const vaccineDetails = notes.vaccination_details && typeof notes.vaccination_details === 'object' ? notes.vaccination_details : {};
    const reason = String(appointment.reason || appointment.type || 'Vaccination');
    const scheduledDate = appointment.start_time || appointment.datetime || '';
    return {
      id: `appointment-${appointment.id}`,
      appointmentId: appointment.id,
      dateCreated: appointment.created_at || appointment.start_time,
      createdBy: appointment.practitioner || 'Clinic team',
      lastUpdatedBy: appointment.practitioner || 'Clinic team',
      pet_id: appointment.pet_id,
      pet: appointment.pet || appointment.pet_name || '—',
      owner: appointment.owner || appointment.owner_name || '',
      type: vaccineName || reason.replace(/^vaccination\s*[-:–—]?\s*/i, '') || 'Vaccination',
      dateGiven: scheduledDate,
      nextDue: vaccineDetails.next_due || '',
      manufacturer: vaccineDetails.manufacturer || '',
      lotNumber: vaccineDetails.lot_number || '',
      expiryDate: vaccineDetails.expiry_date || '',
      dose: vaccineDetails.dose || '—',
      attendingDoctor: appointment.practitioner || '—',
      status: new Date(scheduledDate).getTime() < Date.now() ? 'due' : 'scheduled',
      archived: false,
      clinicVerified: false,
      isScheduledAppointment: true,
    };
  });
  const displayedVaccinations = [...savedVaccinations, ...scheduledVaccinations];
  const vaccinationSummaryRecord = selectedScheduledAppointment || selectedVaccination;
  const isScheduledVaccinationSummary = Boolean(
    vaccinationSummaryRecord?.isScheduledAppointment || vaccinationSummaryRecord?.status === 'scheduled'
  );
  const isUsingDemoVaccinations = !localVaccinations && (!vaccinations || vaccinations.length === 0)
    && !appointments.some(appointment => !appointment.archived && /vaccin|rabies/i.test(String(appointment.reason || appointment.type || '')));
  const overdueVaccinations = displayedVaccinations.filter(v => !v.archived && ['overdue', 'due'].includes(normalizeVaccination(v).status));
  const overduePetGroups = [...new Map(overdueVaccinations
    .filter(v => v.pet && v.pet !== '—')
    .map(v => [`${v.pet_id || v.pet}|${v.owner_email || v.owner || ''}`, v])).values()];
  const contactOverdueOwner = () => {
    const overdueRecord = overduePetGroups.length === 1 ? overduePetGroups[0] : null;
    if (overdueRecord && !isUsingDemoVaccinations && onNavigate) {
      const pet = pets.find(item => String(item.id) === String(overdueRecord.pet_id) || item.name === overdueRecord.pet);
      const ownerName = overdueRecord.owner || overdueRecord.owner_name || pet?.owner_name || pet?.owner?.name || pet?.owner || '';
      onNavigate('inbox', {
        id: pet?.id || overdueRecord.pet_id || overdueRecord.id,
        name: ownerName,
        phone: overdueRecord.owner_phone || pet?.owner_phone || pet?.phone || '',
        pet: overdueRecord.pet,
        species: pet?.species || '',
        breed: pet?.breed || '',
        age: pet?.age || '',
        sex: pet?.sex || pet?.gender || '',
        weight: pet?.weight || '',
        staff: user?.name || 'Clinic team',
        assignedTo: user?.name || 'Clinic team',
      });
      return;
    }
    setShowArchived(false);
    setStatusFilter('overdue');
  };
  const archiveVaccination = async vaccination => {
    try {
      const saved = await updateClinicRecordArchive({ user, endpoint: '/clinic-records/vaccinations', record: vaccination, label: 'vaccination' });
      commitVaccinations(displayedVaccinations.map(item => item.id === vaccination.id ? normalizeVaccination({ ...item, ...saved }) : item));
      notifySuccess(`Vaccination ${saved.archived ? 'archived' : 'restored'} successfully!`, '');
      setArchiveError('');
    } catch (error) {
      setArchiveError(error.message || 'Unable to update the vaccination record.');
    }
  };
  const archiveScheduledAppointment = async appointment => {
    try {
      await updateClinicRecordArchive({ user, endpoint: '/clinic-records/appointments', record: { id: appointment.appointmentId, archived: false }, label: 'appointment' });
      onAppointmentArchive?.(appointment.appointmentId);
      setActionVaccination(null);
      notifySuccess('Scheduled vaccination moved to trash', 'The appointment was archived and will no longer appear in Vaccinations.');
    } catch (error) {
      setVaccinationError(error.message || 'Unable to remove this scheduled vaccination.');
    }
  };
  const shareVaccination = async vaccination => {
    try {
      if (!user?.clinic_id || !user?.token) throw new Error('Your account is not assigned to a clinic.');
      if (!vaccination.clinicVerified) throw new Error('Verify this vaccination before sharing it with the owner.');
      if (vaccination.shared) throw new Error('This vaccination has already been shared with the owner.');
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const params = new URLSearchParams({
        clinic_id: user.clinic_id,
        pet_name: vaccination.pet,
        owner_email: vaccination.owner_email || vaccination.email || '',
      });
      const headers = { Authorization: 'Bearer ' + user.token };
      const availableResponse = await fetch(`${apiUrl}/clinic-records/shareable-records?${params.toString()}`, { headers });
      const availableBody = await availableResponse.json().catch(() => ({}));
      if (!availableResponse.ok) throw new Error(availableBody.error || 'Unable to load owner sharing details.');
      const recordId = `vaccine:${vaccination.id}`;
      const available = (availableBody.records || []).find(item => item.id === recordId);
      if (!available || !available.clinicVerified) throw new Error('This verified vaccination is no longer available to share. Refresh the record and try again.');
      if (available.shared) throw new Error('This vaccination has already been shared with the owner.');
      const response = await fetch(`${apiUrl}/clinic-records/shareable-records?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pet_id: availableBody.pet?.id, records: [{ id: recordId }], message: '', notification_requested: false }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to share this vaccination.');
      const saved = { ...vaccination, shared: true, sharedBy: user.name, sharedAt: body.share?.createdAt };
      commitVaccinations(displayedVaccinations.map(item => item.id === vaccination.id ? saved : item));
      setSelectedVaccination(saved);
      notifySuccess('Vaccination shared', `${vaccination.type} is now available in the linked PetWatch account.`);
    } catch (error) {
      setArchiveError(error.message || 'Unable to share this vaccination.');
    }
  };
  const applyVaccinationVerification = payload => {
    const updated = normalizeVaccination({
      ...verifyVaccination,
      ...payload,
      stickerUrl: payload.sticker_url || verifyVaccination?.stickerUrl,
      stickerFilename: payload.sticker_filename || verifyVaccination?.stickerFilename,
    });
    commitVaccinations(displayedVaccinations.map(item => item.id === updated.id ? updated : item));
    setSelectedVaccination(updated);
    setVerifyVaccination(null);
    setActionVaccination(null);
    notifySuccess(`Vaccination ${updated.id} verified successfully!`, 'The clinic record is updated and may now be shared with the owner.');
  };
  const filtered = displayedVaccinations.filter(v => {
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'completed' && ['up-to-date', 'completed'].includes(v.status))
      || v.status === statusFilter
      || (statusFilter === 'overdue' && v.status === 'due');
    const query = search.toLowerCase();
    const dateValue = String(v.dateGiven || '').slice(0, 10);
    return Boolean(v.archived) === showArchived && matchesStatus
      && (!dateFrom || dateValue >= dateFrom)
      && (!dateTo || dateValue <= dateTo)
      && (practitionerFilter === 'all' || v.attendingDoctor === practitionerFilter)
      && (typeFilter === 'all' || String(v.type || '').trim() === typeFilter)
      && [v.id, v.pet, v.type, v.dateGiven, v.nextDue, v.attendingDoctor, v.createdBy, v.lastUpdatedBy, v.dateCreated, v.linkedPatient, v.status, v.batchNumber, v.batch_number, v.lotNumber]
      .some(value => String(value || '').toLowerCase().includes(query));
  });
  const count = status => displayedVaccinations.filter(v => Boolean(v.archived) === showArchived && (status === 'overdue' ? ['overdue', 'due'].includes(v.status) : v.status === status)).length;
  const completedCount = count('up-to-date') + count('completed');
  const vaccinationTypeOptions = [...new Set(
    displayedVaccinations
      .filter(v => Boolean(v.archived) === showArchived)
      .map(v => String(v.type || '').trim())
      .filter(type => type && type !== 'â€”')
  )];
  const vaccinationPractitioners = [...new Set([
    ...clinicVeterinarians.map(member => member.name),
    ...displayedVaccinations.filter(v => Boolean(v.archived) === showArchived).map(v => v.attendingDoctor),
  ].filter(name => name && name !== 'â€”'))];
  const vaccinationPets = pets.map(pet => ({ id: pet.id, name: pet.name }));
  const openAddVaccination = () => {
    setVaccinationError('');
    setAddVaccination({});
  };
  const closeAddVaccination = () => {
    setAddVaccination(null);
  };
  const submitVaccination = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      if (!user?.clinic_id || !user?.token) throw new Error('Your account is not assigned to a clinic.');
      if (!Number.isInteger(Number(data.pet))) throw new Error('Select a registered pet before saving the vaccination.');
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/clinic-records/vaccinations?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pet_id: data.pet,
          vaccine_name: data.type,
          manufacturer: data.manufacturer,
          batch_number: data.lotNumber,
          expiry_date: data.expiryDate || null,
          dose: data.dose,
          date_given: data.dateGiven,
          next_due: data.nextDue || null,
          administered_by: user.id,
          administered_by_name: data.attendingDoctor,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const fieldMessage = payload.fields ? Object.values(payload.fields)[0] : null;
        throw new Error(fieldMessage || payload.error || 'Unable to save the vaccination record.');
      }
      commitVaccinations([...displayedVaccinations, normalizeVaccination(payload)]);
      closeAddVaccination();
      setVaccinationError('');
      notifySuccess('Vaccination added successfully!', 'The record was saved to the clinic database.');
    } catch (error) {
      setVaccinationError(error.message || 'Unable to save the vaccination record.');
    }
  };
  return (
    <div className="clinic-management-tab clinic-vaccinations-tab" style={{ ...T.wrap, width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '20px 20px 18px', borderRadius: 14 }}>
      <div className="lab-results-header clinic-vaccinations-page-header">
        <div>
          <h2 className="lab-results-title">Vaccinations</h2>
        </div>
      </div>
      <div className="lab-status-row clinic-vaccinations-status-row">
        <div className="lab-status-filters" role="tablist" aria-label="Vaccination status">
          {[
            ['all', 'All', displayedVaccinations.filter(v => Boolean(v.archived) === showArchived).length],
            ['overdue', 'Overdue', count('overdue')],
            ['due-soon', 'Due soon', count('due-soon')],
            ['completed', 'Completed', completedCount],
          ].map(([value, label, itemCount]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={statusFilter === value}
              className={statusFilter === value ? 'active' : ''}
              onClick={() => setStatusFilter(value)}
            >
              {label}<span>{itemCount}</span>
            </button>
          ))}
        </div>
        <button type="button" className="lab-results-add" onClick={openAddVaccination}>{Icons.plus} Add Vaccination</button>
      </div>
      <div className="lab-filter-bar clinic-vaccinations-filters">
        <label className="lab-results-search">
          {Icons.search}
          <input type="search" aria-label="Search vaccinations" placeholder="Search vaccine, product or batch..." value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <div className="lab-date-range clinic-vaccination-date-range">
          <button type="button" className="lab-date-range-trigger" aria-label="Choose vaccination date range" aria-expanded={dateRangeOpen} onClick={() => setDateRangeOpen(open => !open)}>
            <span className="lab-date-range-calendar">{Icons.calendar}</span>
            <span>{dateFrom || dateTo ? `${dateFrom || 'Any date'} – ${dateTo || 'Any date'}` : 'Date Range'}</span>
            <span className={`lab-date-range-chevron${dateRangeOpen ? ' open' : ''}`} aria-hidden="true" />
          </button>
          {dateRangeOpen && <div className="lab-date-range-popover" role="group" aria-label="Vaccination date range">
            <label>From<LabDateTimePicker label="Start date" mode="date" value={dateFrom} max={dateTo || undefined} onChange={setDateFrom} /></label>
            <label>To<LabDateTimePicker label="End date" mode="date" value={dateTo} min={dateFrom || undefined} onChange={setDateTo} /></label>
            <div className="lab-date-range-actions">
              <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</button>
              <button type="button" onClick={() => setDateRangeOpen(false)}>Done</button>
            </div>
          </div>}
        </div>
        <FilterSelect
          className="lab-records-filter-select clinic-vaccination-filter-select"
          label="Filter by veterinarian"
          value={practitionerFilter}
          onChange={setPractitionerFilter}
          options={[{ value: 'all', label: 'Veterinarian' }, ...vaccinationPractitioners.map(name => ({ value: name, label: name }))]}
        />
        <FilterSelect
          className="lab-records-filter-select clinic-vaccination-filter-select"
          label="Filter by vaccination type"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[{ value: 'all', label: 'Vaccination Type' }, ...vaccinationTypeOptions.map(type => ({ value: type, label: type }))]}
        />
      </div>
      {archiveError && <div role="alert" style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: '.78rem' }}>{archiveError}</div>}
      {overdueVaccinations.length > 0 && !showArchived && <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 13, padding: '10px 13px', border: '1px solid #efd181', borderRadius: 10, background: '#fff4c9', color: '#86540a', fontSize: '.8rem', lineHeight: 1.5 }}>
        <span>
          <strong>{overdueVaccinations.length} {overdueVaccinations.length === 1 ? 'vaccine is' : 'vaccines are'} overdue:</strong>{' '}
          {overdueVaccinations.map(item => `${item.type} (${item.pet})`).join(', ')}.
          {isUsingDemoVaccinations && <span style={{ marginLeft: 6, fontSize: '.72rem' }}>Demo data</span>}
        </span>
        <button type="button" onClick={contactOverdueOwner} style={{ flex: '0 0 auto', minHeight: 36, padding: '0 12px', border: '1px solid #e3d4aa', borderRadius: 8, background: '#fff', color: '#81500a', font: 'inherit', fontSize: '.75rem', fontWeight: 650, cursor: 'pointer' }}>
          {overduePetGroups.length === 1 && !isUsingDemoVaccinations && onNavigate ? 'Contact owner' : 'View overdue'}
        </button>
      </div>}
      <div className="clinic-archive-toolbar">
        <div className="lab-archive-tabs" role="tablist" aria-label="Active and archived vaccinations">
          <button type="button" role="tab" aria-selected={!showArchived} className={!showArchived ? 'active' : ''} onClick={() => setShowArchived(false)}>Active <span>{displayedVaccinations.filter(item => !item.archived).length}</span></button>
          <button type="button" role="tab" aria-selected={showArchived} className={showArchived ? 'active' : ''} onClick={() => setShowArchived(true)}>Archived <span>{displayedVaccinations.filter(item => item.archived).length}</span></button>
        </div>
      </div>
      <section className="lab-results-list clinic-management-list clinic-vaccinations-list">
      <div className="vaccination-scroll-hint">Select a row to review its details, verification, sticker, audit history, and owner sharing.</div>
      <div className="lab-results-table-wrap vaccination-table-scroll" style={{ width: '100%', minWidth: 0, overflowX: 'auto', overscrollBehaviorX: 'contain' }}>
      <table className="lab-results-table clinic-management-table vaccination-records-table" style={{ ...T.table, width: '100%', minWidth: 1200, tableLayout: 'auto' }}>
        <thead>
          <tr>
            {[
              'Vacc ID', 'Pet', 'Type', 'Date Given',
              'Next Due', 'Status', 'Attending Doctor', 'Clinic Verified', 'Sharing', 'Actions',
            ].map(label => (
              <th key={label} className={label === 'Actions' ? 'clinic-action-heading' : undefined} aria-label={label === 'Actions' ? 'Row actions' : undefined}>{label === 'Actions' ? '' : label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map(v => {
            const openActions = () => setActionVaccination(v);
            return (
            <tr
              key={v.id}
              className="clinic-action-row"
              tabIndex={0}
              onClick={openActions}
              onKeyDown={event => handleClinicActionRowKeyDown(event, openActions)}
            >
              <td style={{ ...T.td, padding: '10px 8px', fontWeight: 600, fontSize: '.72rem', color: '#374151', whiteSpace: 'nowrap' }}>{v.isScheduledAppointment && v.appointmentId != null ? v.appointmentId : v.id}</td>
              <td style={{ ...T.td, padding: '10px 8px', fontSize: '.72rem', color: '#111827', fontWeight: 600 }}>{v.pet}</td>
              <td style={{ ...T.td, padding: '10px 8px', fontSize: '.72rem', color: '#374151' }}><div style={{ whiteSpace: 'nowrap' }}>{v.type}</div>{v.isScheduledAppointment && [v.manufacturer, v.lotNumber, v.expiryDate ? `Expires ${formatClinicDate(v.expiryDate)}` : ''].filter(Boolean).length > 0 && <small style={{ display: 'block', marginTop: 3, color: '#718198', fontSize: '.62rem' }}>{[v.manufacturer, v.lotNumber, v.expiryDate ? `Expires ${formatClinicDate(v.expiryDate)}` : ''].filter(Boolean).join(' · ')}</small>}</td>
              <td style={{ ...T.tdMuted, padding: '10px 8px', fontSize: '.72rem', color: '#374151', whiteSpace: 'nowrap' }}>{v.isScheduledAppointment || v.status === 'scheduled' ? `Scheduled · ${formatClinicDate(v.dateGiven)}` : formatClinicDate(v.dateGiven)}</td>
              <td style={{ ...T.td, padding: '10px 8px', color: v.nextDueColor || (v.status === 'overdue' ? '#ef4444' : v.status === 'due-soon' ? '#f59e0b' : '#16a34a'), fontWeight: 500, fontSize: '.72rem', whiteSpace: 'nowrap' }}>{formatClinicDate(v.nextDue)}</td>
              <td style={{ ...T.td, padding: '10px 8px', whiteSpace: 'nowrap' }}><StatusBadge status={v.status} vaccination /></td>
              <td style={{ ...T.tdMuted, padding: '10px 8px', color: '#374151', fontSize: '.72rem', whiteSpace: 'nowrap' }}>{v.attendingDoctor}</td>
              <td style={{ ...T.td, padding: '10px 8px', whiteSpace: 'nowrap' }}>
                {v.isScheduledAppointment || v.status === 'scheduled' ? <span style={{ color: '#718198', fontSize: '.65rem' }}>Not administered</span> : v.clinicVerified
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#15803d', fontSize: '.65rem', fontWeight: 600 }}><span aria-hidden="true" style={{ width: 8, height: 8, flex: '0 0 8px', borderRadius: '50%', background: '#16a34a' }} />Clinic Verified</span>
                  : <StatusIndicator status="Pending Verification" style={{ fontSize: '.65rem' }} />}
              </td>
              <td style={{ ...T.td, padding: '10px 8px', whiteSpace: 'nowrap' }}>
                <span style={{ display: 'inline-flex', padding: '4px 7px', borderRadius: 99, background: v.shared ? '#e5f7f1' : '#edf4f7', color: v.shared ? '#005447' : '#526c78', fontSize: '.65rem', fontWeight: 650 }}>{v.isScheduledAppointment ? '—' : v.shared ? 'Shared' : 'Not shared'}</span>
              </td>
              <td style={{ ...T.td, padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                <button
                  type="button"
                  className="clinic-record-actions-trigger"
                  onClick={event => { event.stopPropagation(); openActions(); }}
                  aria-label={`Open actions for vaccination ${v.type} for ${v.pet}`}
                  title="Vaccination actions"
                >{Icons.chevronRight}</button>
              </td>
            </tr>
            );
          })}
          {!filtered.length && <tr><td className="lab-results-empty" colSpan="10">No vaccinations match the selected search and filters.</td></tr>}
        </tbody>
      </table>
      </div>
      </section>
      {vaccinationSummaryRecord && <VaccinationDetailsModal
        record={vaccinationSummaryRecord}
        onBack={() => {
          setSelectedScheduledAppointment(null);
          setSelectedVaccination(null);
          setActionVaccination(vaccinationSummaryRecord);
        }}
        onClose={() => {
          setSelectedScheduledAppointment(null);
          setSelectedVaccination(null);
          setActionVaccination(null);
        }}
      />}
      {addVaccination && <div style={modalStyles.backdrop} onClick={closeAddVaccination}>
        <ModalDialog as="form" size="standard" className="clinic-vaccination-add-dialog" role="dialog" aria-modal="true" aria-labelledby="add-vaccination-title" onClick={event => event.stopPropagation()} onSubmit={submitVaccination} style={modalStyles.addVaccinationDialog}>
          <button type="button" aria-label="Close add vaccination" onClick={closeAddVaccination} style={modalStyles.close}>{Icons.close}</button>
          <h2 id="add-vaccination-title" style={modalStyles.addVaccinationTitle}>Add Vaccination Record</h2>
          <p style={modalStyles.addVaccinationIntro}>Enter the vaccination details. You can attach a photo of the physical sticker during verification.</p>
          {vaccinationError && <div role="alert" style={{ gridColumn: '1 / -1', padding: '9px 11px', border: '1px solid #fecaca', borderRadius: 7, background: '#fef2f2', color: '#b91c1c', fontSize: '.74rem' }}>{vaccinationError}</div>}
          <label style={{ ...modalStyles.addVaccinationLabel, gridColumn: '1 / -1', marginBottom: 14 }}><span style={modalStyles.addVaccinationLabelText}>Pet<span style={modalStyles.required}>*</span></span><select name="pet" required defaultValue="" style={modalStyles.addVaccinationInput}><option value="" disabled>Select pet</option>{vaccinationPets.map(pet => <option key={pet.id} value={pet.id}>{pet.name}</option>)}</select></label>
          <div style={modalStyles.addVaccinationGrid}>
            <label style={modalStyles.addVaccinationLabel}><span style={modalStyles.addVaccinationLabelText}>Vaccine / Product Name<span style={modalStyles.required}>*</span></span><input name="type" required placeholder="Rabies (IMRAB 3TF)" style={modalStyles.addVaccinationInput} /></label>
            <label style={modalStyles.addVaccinationLabel}><span style={modalStyles.addVaccinationLabelText}>Manufacturer</span><input name="manufacturer" placeholder="Enter from vaccine label" style={modalStyles.addVaccinationInput} /></label>
            <label style={modalStyles.addVaccinationLabel}><span style={modalStyles.addVaccinationLabelText}>Lot / Batch Number</span><input name="lotNumber" placeholder="Read from the vaccine vial or sticker" style={modalStyles.addVaccinationInput} /><small style={{ color: '#526b64', fontSize: '.66rem' }}>Batch numbers are unique to each product lot and cannot be inferred from the vaccine name.</small></label>
            <label style={modalStyles.addVaccinationLabel}><span style={modalStyles.addVaccinationLabelText}>Expiry Date</span><LabDateTimePicker name="expiryDate" mode="date" style={modalStyles.addVaccinationInput} /><small style={{ color: '#526b64', fontSize: '.66rem' }}>Enter the date printed on this vial or sticker; expiry varies by lot.</small></label>
            <label style={modalStyles.addVaccinationLabel}><span style={modalStyles.addVaccinationLabelText}>Dose</span><input name="dose" placeholder="1 mL IM" style={modalStyles.addVaccinationInput} /></label>
            <label style={modalStyles.addVaccinationLabel}><span style={modalStyles.addVaccinationLabelText}>Date Given<span style={modalStyles.required}>*</span></span><LabDateTimePicker name="dateGiven" mode="date" required style={modalStyles.addVaccinationInput} /></label>
            <label style={modalStyles.addVaccinationLabel}><span style={modalStyles.addVaccinationLabelText}>Next Due Date</span><LabDateTimePicker name="nextDue" mode="date" style={modalStyles.addVaccinationInput} /></label>
            <label style={modalStyles.addVaccinationLabel}><span style={modalStyles.addVaccinationLabelText}>Administered By<span style={modalStyles.required}>*</span></span><input name="attendingDoctor" required placeholder="Dr. Smith" style={modalStyles.addVaccinationInput} /></label>
          </div>
          <div style={modalStyles.addVaccinationFooter}><button type="button" style={modalStyles.cancel} onClick={closeAddVaccination}>Cancel</button><button type="submit" style={{ ...T.primaryBtn, padding: '8px 12px', fontSize: '.68rem', borderRadius: 7 }}>Add Record</button></div>
        </ModalDialog>
      </div>}
      {actionVaccination && <div style={modalStyles.backdrop} onClick={() => setActionVaccination(null)}>
        <div role="dialog" aria-modal="true" aria-labelledby="vaccination-actions-title" onClick={event => event.stopPropagation()} style={modalStyles.vaccinationActionsDialog}>
          <button type="button" onClick={() => setActionVaccination(null)} style={{ ...modalStyles.vaccinationActionsClose, width: 'auto', height: 'auto', font: 'inherit', fontSize: '.72rem', fontWeight: 600 }}>Close</button>
          <div style={modalStyles.vaccinationActionsHeader}>
            <div><h2 id="vaccination-actions-title" style={modalStyles.vaccinationActionsTitle}>Vaccination Actions</h2><div style={modalStyles.vaccinationActionsSubtitle}>{actionVaccination.isScheduledAppointment ? `Appointment ${String(actionVaccination.appointmentId || actionVaccination.id).replace(/^appointment-/, '')}` : actionVaccination.id} — {actionVaccination.type} ({actionVaccination.pet})</div></div>
          </div>
          <div style={modalStyles.vaccinationActionsPet}>
            <div style={modalStyles.vaccinationActionsPetInfo}>{actionVaccination.photo_url ? <>
              <img src={actionVaccination.photo_url} alt={`${actionVaccination.pet || 'Pet'} profile`} style={modalStyles.vaccinationActionsPetImage} onError={event => { event.currentTarget.style.display = 'none'; if (event.currentTarget.nextElementSibling) event.currentTarget.nextElementSibling.style.display = 'grid'; }} />
              <span aria-hidden="true" style={{ ...modalStyles.vaccinationActionsPetImage, display: 'none', placeItems: 'center', background: '#e7f5f2', color: '#005447', fontWeight: 700 }}>{String(actionVaccination.pet || 'P').slice(0, 1).toUpperCase()}</span>
            </> : <span aria-hidden="true" style={{ ...modalStyles.vaccinationActionsPetImage, display: 'grid', placeItems: 'center', background: '#e7f5f2', color: '#005447', fontWeight: 700 }}>{String(actionVaccination.pet || 'P').slice(0, 1).toUpperCase()}</span>}
              <div><div style={modalStyles.vaccinationActionsPetName}>{actionVaccination.pet || 'Selected Pet'}</div><div style={modalStyles.vaccinationActionsPetMeta}>{actionVaccination.isScheduledAppointment ? `Appointment · ${formatClinicDate(actionVaccination.dateGiven)} · Not administered` : `Patient record · ${actionVaccination.dateGiven || 'Vaccination date'} · ${actionVaccination.dose || 'Dose recorded'}`}</div></div></div>
            <StatusIndicator status={actionVaccination.isScheduledAppointment || actionVaccination.status === 'scheduled' ? actionVaccination.status === 'due' ? 'Due' : 'Scheduled' : 'Active'} />
          </div>
          <div style={modalStyles.vaccinationActionsList}>
            <button
              type="button"
              className="record-action-card vaccination-action-button"
              onClick={() => {
                if (actionVaccination.isScheduledAppointment) setSelectedScheduledAppointment(actionVaccination);
                else setSelectedVaccination(actionVaccination);
                setActionVaccination(null);
              }}
              style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #b7e4d7', background: '#f2fbf8' }}
            >
              <span style={modalStyles.vaccinationActionCardText}>
                <strong style={modalStyles.vaccinationActionCardTitle}>View Details</strong>
                <small style={modalStyles.vaccinationActionCardDescription}>See a summary of this vaccination, patient, dates, and recorded vaccine details.</small>
              </span>
            </button>
            {actionVaccination.isScheduledAppointment ? <>
              <button type="button" className="record-action-card vaccination-action-button" onClick={() => setEditVaccination(actionVaccination)} style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #b7e4d7', background: '#f2fbf8' }}><span style={modalStyles.vaccinationActionCardText}><strong style={modalStyles.vaccinationActionCardTitle}>Edit Vaccination</strong><small style={modalStyles.vaccinationActionCardDescription}>Update vaccine details, batch numbers, or next due date.</small></span></button>
              <button type="button" className="record-action-card vaccination-action-button" onClick={() => setHistoryVaccination(actionVaccination)} style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #b7e4d7', background: '#f2fbf8' }}><span style={modalStyles.vaccinationActionCardText}><strong style={modalStyles.vaccinationActionCardTitle}>View Audit History</strong><small style={modalStyles.vaccinationActionCardDescription}>See the appointment history and vaccine details for this pet.</small></span></button>
              <button type="button" className="record-action-card record-action-card-destructive vaccination-action-button" onClick={() => archiveScheduledAppointment(actionVaccination)} style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #ffc0c8', background: '#fff5f6' }}><span style={modalStyles.vaccinationActionCardText}><strong style={modalStyles.vaccinationActionCardTitle}>Archive</strong><small style={modalStyles.vaccinationActionCardDescription}>Archive this scheduled vaccination appointment.</small></span></button>
            </> : <>
            <button type="button" className="record-action-card vaccination-action-button" onClick={() => setEditVaccination(actionVaccination)} style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #b7e4d7', background: '#f2fbf8' }}>
              <span style={modalStyles.vaccinationActionCardText}><strong style={modalStyles.vaccinationActionCardTitle}>Edit Vaccination</strong><small style={modalStyles.vaccinationActionCardDescription}>Update vaccination details, batch numbers, or next due date.</small></span>
            </button>
            <button type="button" className="record-action-card vaccination-action-button" onClick={() => setHistoryVaccination(actionVaccination)} style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #b7e4d7', background: '#f2fbf8' }}>
              <span style={modalStyles.vaccinationActionCardText}><strong style={modalStyles.vaccinationActionCardTitle}>View Audit History</strong><small style={modalStyles.vaccinationActionCardDescription}>See the complete vaccination record and history for this pet.</small></span>
            </button>
            {!actionVaccination.clinicVerified && <button
              type="button"
              className="record-action-card vaccination-action-button"
              onClick={() => {
                setVerifyVaccination(actionVaccination);
                setActionVaccination(null);
              }}
              style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #cbd9e8', background: '#f2fbf8' }}
            >
              <span style={modalStyles.vaccinationActionCardText}><strong style={modalStyles.vaccinationActionCardTitle}>Verify Record</strong><small style={modalStyles.vaccinationActionCardDescription}>Confirm the vaccination is valid and properly logged in the system.</small></span>
            </button>}
            <button type="button" className="record-action-card record-action-card-destructive vaccination-action-button" onClick={() => { archiveVaccination(actionVaccination); setActionVaccination(null); }} style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #ffc0c8', background: '#fff5f6' }}>
              <span style={modalStyles.vaccinationActionCardText}><strong style={modalStyles.vaccinationActionCardTitle}>{showArchived ? 'Restore Vaccination' : 'Archive'}</strong><small style={modalStyles.vaccinationActionCardDescription}>{showArchived ? 'Return this vaccination record to the active list.' : 'Archive this vaccination record.'}</small></span>
            </button>
            </>}
          </div>
          <div style={modalStyles.vaccinationActionsFooter}><span style={modalStyles.vaccinationActionsNote}>{actionVaccination.status === 'scheduled' ? `This vaccination record is saved and linked to appointment ${actionVaccination.appointment_id}. It remains scheduled until the doctor confirms administration.` : actionVaccination.isScheduledAppointment ? 'The vaccination record will be created after the service is confirmed as completed.' : `These actions only affect the selected vaccination record (${actionVaccination.id}).`}</span><button type="button" className="vaccination-actions-cancel" style={modalStyles.vaccinationActionsCancel} onClick={() => setActionVaccination(null)}>Cancel</button></div>
        </div>
      </div>}
      {verifyVaccination && <VaccinationVerificationDialog
        record={verifyVaccination}
        user={user}
        onClose={() => setVerifyVaccination(null)}
        onVerified={applyVaccinationVerification}
        onStickerUploaded={uploaded => {
          commitVaccinations(displayedVaccinations.map(item => item.id === uploaded.id ? normalizeVaccination({ ...item, ...uploaded }) : item));
        }}
      />}
      {historyVaccination && <div className="lab-audit-backdrop" onClick={() => { setHistoryVaccination(null); setActionVaccination(null); }}>
        <div className="lab-audit-dialog vaccination-audit-dialog" role="dialog" aria-modal="true" aria-labelledby="vaccination-audit-title" onClick={event => event.stopPropagation()}>
          <header className="lab-audit-header">
            <div><h2 id="vaccination-audit-title">Vaccination Audit History</h2><p>{historyVaccination.pet || 'Patient'} · Recorded changes to this vaccination</p></div>
            <button type="button" aria-label="Close vaccination audit history" onClick={() => { setHistoryVaccination(null); setActionVaccination(null); }}>{Icons.close}</button>
          </header>
          <div className="lab-audit-content">
            <dl className="lab-audit-summary">
              <div><dt>Created By</dt><dd>{historyVaccination.createdBy || '—'}</dd></div>
              <div><dt>Date Created</dt><dd>{formatClinicDate(historyVaccination.dateCreated) || '—'}</dd></div>
              <div><dt>Last Updated By</dt><dd>{historyVaccination.lastUpdatedBy || '—'}</dd></div>
              <div><dt>Linked Patient</dt><dd>{historyVaccination.linkedPatient || historyVaccination.pet || '—'}</dd></div>
            </dl>
            <section className="lab-audit-timeline vaccination-audit-timeline">
              <h3>Activity Timeline</h3>
              <ol>
              {(historyVaccination.isScheduledAppointment || historyVaccination.status === 'scheduled'
                ? [['Appointment Scheduled', historyVaccination.dateCreated, historyVaccination.createdBy]]
                : [
                    ['Record Created', historyVaccination.dateCreated, historyVaccination.createdBy],
                    ['Vaccination Administered', historyVaccination.dateGiven, historyVaccination.attendingDoctor],
                    ...(historyVaccination.clinicVerified ? [['Clinic Verified', historyVaccination.verified_at || historyVaccination.dateCreated, historyVaccination.verified_by_name || historyVaccination.lastUpdatedBy]] : []),
                ]).map(([event, date, actor]) => <AuditTimelineEntry key={event}
                  date={formatClinicDate(date) || 'Date unavailable'} dateTime={date} title={event}
                  detail={event === 'Record Created' ? 'Vaccination record created.' : event === 'Appointment Scheduled' ? 'Vaccination appointment scheduled.' : event === 'Clinic Verified' ? 'Vaccination details verified by the clinic.' : 'Vaccination administered.'}
                  actor={actor || 'Actor not recorded'} />)}
              </ol>
            </section>
          </div>
          <footer className="lab-audit-footer vaccination-audit-footer">
            <button type="button" className="lab-audit-back-button" onClick={() => setHistoryVaccination(null)}>Back to actions</button>
            <button type="button" className="lab-audit-close-button" onClick={() => { setHistoryVaccination(null); setActionVaccination(null); }}>Close</button>
          </footer>
        </div>
      </div>}
      {editVaccination && <div style={modalStyles.backdrop} onClick={() => setEditVaccination(null)}>
        <form role="dialog" aria-modal="true" aria-labelledby="edit-vaccination-title" onClick={event => event.stopPropagation()} onSubmit={async event => {
          event.preventDefault();
          try {
            const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
            if (editVaccination.isScheduledAppointment) {
              const response = await fetch(`${apiUrl}/clinic-records/appointments/${encodeURIComponent(editVaccination.appointmentId)}\/vaccination-details?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
                method: 'PATCH',
                headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  vaccine_name: editVaccination.type,
                  manufacturer: editVaccination.manufacturer,
                  batch_number: editVaccination.lotNumber || editVaccination.lot,
                  expiry_date: editVaccination.expiryDate || editVaccination.expiry || null,
                  dose: editVaccination.dose,
                  next_due: editVaccination.nextDue || null,
                }),
              });
              const payload = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(payload.error || 'Unable to update the scheduled vaccination.');
              onAppointmentUpdate?.(editVaccination.appointmentId, payload);
              setEditVaccination(null);
              setActionVaccination(null);
              notifySuccess('Scheduled vaccination updated', 'The changes are saved with the appointment.');
              return;
            }
            const response = await fetch(`${apiUrl}/clinic-records/vaccinations/${editVaccination.id}?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
              method: 'PUT',
              headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pet_id: editVaccination.pet_id,
                vaccine_name: editVaccination.type,
                manufacturer: editVaccination.manufacturer,
                batch_number: editVaccination.lotNumber || editVaccination.lot,
                expiry_date: editVaccination.expiryDate || editVaccination.expiry || null,
                dose: editVaccination.dose,
                date_given: editVaccination.dateGiven,
                next_due: editVaccination.nextDue || null,
                administered_by: user.id,
                administered_by_name: editVaccination.attendingDoctor,
              }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              const fieldMessage = payload.fields ? Object.values(payload.fields)[0] : null;
              throw new Error(fieldMessage || payload.error || 'Unable to update the vaccination record.');
            }
            let saved = payload;
            if (editStickerImage) {
              const reader = new FileReader();
              const imageData = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Unable to read the sticker image.'));
                reader.readAsDataURL(editStickerImage);
              });
              const uploadResponse = await fetch(`${apiUrl}/clinic-records/vaccinations/${editVaccination.id}/sticker?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: editStickerImage.name, content_type: editStickerImage.type, data: imageData }),
              });
              const uploadPayload = await uploadResponse.json().catch(() => ({}));
              if (!uploadResponse.ok) throw new Error(uploadPayload.error || 'Unable to save the sticker image.');
              saved = uploadPayload;
            }
            commitVaccinations(displayedVaccinations.map(item => item.id === editVaccination.id ? normalizeVaccination(saved) : item));
            setEditVaccination(null);
            setEditStickerImage(null);
            setVaccinationError('');
            notifySuccess(`Vaccination ${editVaccination.id} updated successfully!`, 'Changes were saved to the clinic database.');
          } catch (error) {
            setVaccinationError(error.message || 'Unable to update the vaccination record.');
          }
        }} style={modalStyles.editVaccinationDialog}>
          <button type="button" aria-label="Close edit vaccination" onClick={() => setEditVaccination(null)} style={modalStyles.close}>{Icons.close}</button>
          <h2 id="edit-vaccination-title" style={modalStyles.editVaccinationTitle}>Edit Vaccination Record</h2>
          <p style={modalStyles.editVaccinationIntro}>{editVaccination.isScheduledAppointment || editVaccination.status === 'scheduled' ? `Update the vaccination details for ${editVaccination.pet}. The record remains scheduled until the veterinarian confirms administration.` : `Update the vaccination details for ${editVaccination.pet}. Changing verified fields will remove the Clinic Verified badge.`}</p>
          {vaccinationError && <div role="alert" style={{ marginBottom: 10, padding: '9px 11px', border: '1px solid #fecaca', borderRadius: 7, background: '#fef2f2', color: '#b91c1c', fontSize: '.74rem' }}>{vaccinationError}</div>}
          {editVaccination.clinicVerified && <div style={modalStyles.verifiedNotice}><div style={modalStyles.verifiedNoticeHeader}><strong><span style={modalStyles.verifiedIcon}>{Icons.shieldCheck}</span>Clinic Verified</strong><button type="button" onClick={async () => {
            try {
              const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
              const response = await fetch(`${apiUrl}/clinic-records/vaccinations/${editVaccination.id}/verification?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
                method: 'PATCH',
                headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ verified: false, reason: 'Verification removed for record correction.' }),
              });
              const payload = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(payload.error || 'Unable to remove verification.');
              commitVaccinations(displayedVaccinations.map(item => item.id === editVaccination.id ? normalizeVaccination({ ...item, ...payload }) : item));
              setEditVaccination(payload);
              notifySuccess('Verification removed.', 'The correction is recorded in the audit trail.');
            } catch (error) {
              setVaccinationError(error.message || 'Unable to remove verification.');
            }
          }} style={modalStyles.removeVerification}>Remove Verification</button></div><span>Happy Paws Veterinary · Verified by {editVaccination.lastUpdatedBy || editVaccination.attendingDoctor || 'Clinic staff'} · {editVaccination.dateCreated || '—'}</span><small style={modalStyles.verificationWarning}>⚠ Changing vaccine name, date, lot number, expiry, dose, or sticker image will automatically remove verification.</small></div>}
          {(editVaccination.isScheduledAppointment || editVaccination.status === 'scheduled') && <div style={{ ...modalStyles.verifiedNotice, borderColor: '#bfdbfe', background: '#eff6ff', color: '#1e3a5f' }}><div style={modalStyles.verifiedNoticeHeader}><strong><span style={{ display: 'inline-flex', width: 18, justifyContent: 'center', color: '#2563eb' }}>●</span>Scheduled Vaccination</strong><StatusBadge status="Scheduled" vaccination /></div><span>Appointment · {formatClinicDate(editVaccination.dateGiven) || 'Date not recorded'} · Assigned to {editVaccination.attendingDoctor || 'a veterinarian'}</span><small style={{ ...modalStyles.verificationWarning, color: '#526b84' }}>The vaccination details are saved. The veterinarian can confirm administration when the service is completed.</small></div>}
          <div style={modalStyles.editVaccinationGrid}>
            <label style={{ ...modalStyles.editVaccinationLabel, gridColumn: '1 / -1' }}>Pet<select value={editVaccination.pet_id || ''} onChange={event => setEditVaccination({ ...editVaccination, pet_id: event.target.value, pet: pets.find(item => String(item.id) === event.target.value)?.name || editVaccination.pet })} style={modalStyles.editVaccinationInput}>{pets.map(pet => <option key={pet.id} value={pet.id}>{pet.name}</option>)}</select></label>
            <label style={modalStyles.editVaccinationLabel}>Vaccine / Product Name<input value={editVaccination.type || ''} onChange={event => setEditVaccination({ ...editVaccination, type: event.target.value })} style={modalStyles.editVaccinationInput} /></label>
            <label style={modalStyles.editVaccinationLabel}>Manufacturer<input value={editVaccination.manufacturer || ''} onChange={event => setEditVaccination({ ...editVaccination, manufacturer: event.target.value })} style={modalStyles.editVaccinationInput} /></label>
            <label style={modalStyles.editVaccinationLabel}>Lot / Batch Number<input value={editVaccination.lotNumber || editVaccination.lot || ''} onChange={event => setEditVaccination({ ...editVaccination, lotNumber: event.target.value })} style={modalStyles.editVaccinationInput} /></label>
            <label style={modalStyles.editVaccinationLabel}>Expiry Date<input value={editVaccination.expiryDate || editVaccination.expiry || ''} onChange={event => setEditVaccination({ ...editVaccination, expiryDate: event.target.value })} style={modalStyles.editVaccinationInput} /></label>
            <label style={modalStyles.editVaccinationLabel}>Dose<input value={editVaccination.dose || ''} onChange={event => setEditVaccination({ ...editVaccination, dose: event.target.value })} style={modalStyles.editVaccinationInput} /></label>
          {editVaccination.isScheduledAppointment || (editVaccination.status === 'scheduled' && !editVaccination.clinicVerified) ? <label style={modalStyles.editVaccinationLabel}><span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>Status<StatusBadge status="Scheduled" vaccination /></span><input readOnly value="Scheduled" style={modalStyles.editVaccinationInput} /></label> : <label style={modalStyles.editVaccinationLabel}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                Status
                <StatusBadge status={editVaccination.status} vaccination />
              </span>
              <select value={editVaccination.status || ''} onChange={event => setEditVaccination({ ...editVaccination, status: event.target.value })} style={modalStyles.editVaccinationInput}>
                <option value="up-to-date">Up to Date</option>
                <option value="due-soon">Due Soon</option>
                <option value="overdue">Overdue</option>
              </select>
            </label>}
            <label style={modalStyles.editVaccinationLabel}>{editVaccination.isScheduledAppointment || (editVaccination.status === 'scheduled' && !editVaccination.clinicVerified) ? 'Scheduled Date' : 'Date Given'}<input readOnly={editVaccination.isScheduledAppointment || (editVaccination.status === 'scheduled' && !editVaccination.clinicVerified)} value={editVaccination.dateGiven || ''} onChange={event => setEditVaccination({ ...editVaccination, dateGiven: event.target.value })} style={modalStyles.editVaccinationInput} /></label>
            <label style={modalStyles.editVaccinationLabel}>Next Due<input value={editVaccination.nextDue || ''} onChange={event => setEditVaccination({ ...editVaccination, nextDue: event.target.value })} style={modalStyles.editVaccinationInput} /></label>
            <label style={{ ...modalStyles.editVaccinationLabel, gridColumn: '1 / -1' }}>{editVaccination.isScheduledAppointment || (editVaccination.status === 'scheduled' && !editVaccination.clinicVerified) ? 'Assigned Veterinarian' : 'Administered By'}<input readOnly={editVaccination.isScheduledAppointment || (editVaccination.status === 'scheduled' && !editVaccination.clinicVerified)} value={editVaccination.attendingDoctor || ''} onChange={event => setEditVaccination({ ...editVaccination, attendingDoctor: event.target.value })} style={modalStyles.editVaccinationInput} /></label>
          </div>
          <div style={modalStyles.proofImage}><strong><span style={modalStyles.proofIcon}>{Icons.clipboard}</span>Sticker / Proof Image</strong>{editVaccination.isScheduledAppointment || (editVaccination.status === 'scheduled' && !editVaccination.clinicVerified) ? <div style={modalStyles.proofContent}><div style={modalStyles.proofPreview}><span style={modalStyles.proofPreviewMark}>▦</span><span>No sticker</span></div><div><span style={modalStyles.proofCaption}>No sticker image uploaded</span><small style={{ display: 'block', marginTop: 5, color: '#526b64', fontSize: '.66rem' }}>Add the proof image after the veterinarian confirms administration.</small></div></div> : <><input ref={editStickerUploadRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => { const file = event.target.files?.[0]; if (file) setEditStickerImage(file); event.target.value = ''; }} style={{ display: 'none' }} /><div style={modalStyles.proofContent}><div style={modalStyles.proofPreview}>{editVaccination.stickerUrl ? <img src={editVaccination.stickerUrl} alt="Current vaccine sticker" style={modalStyles.stickerPreview} /> : <><span style={modalStyles.proofPreviewMark}>▦</span><span>No sticker</span></>}</div><div><span style={modalStyles.proofCaption}>{editStickerImage?.name || editVaccination.stickerFilename || 'Current sticker image'}</span><div style={modalStyles.proofButtons}><button type="button" disabled={!editVaccination.stickerUrl} onClick={() => window.open(editVaccination.stickerUrl, '_blank', 'noopener,noreferrer')} style={modalStyles.smallSecondary}>◉ &nbsp;View Full</button><button type="button" onClick={() => editStickerUploadRef.current?.click()} style={modalStyles.smallSecondary}>↥ &nbsp;Replace</button></div></div></div></>}</div>
          {editVaccination.isScheduledAppointment || editVaccination.status === 'scheduled' ? <details style={modalStyles.editAudit}><summary>Audit Log</summary><div style={modalStyles.editAuditEntries}><div>Appointment Scheduled · {formatClinicDate(editVaccination.dateCreated) || 'Date unavailable'} · {editVaccination.createdBy || 'Clinic team'}</div></div></details> : <details style={modalStyles.editAudit}><summary>Audit Log (5 entries)</summary><div style={modalStyles.editAuditEntries}><div>Sticker Uploaded · {editVaccination.createdBy || 'Clinic staff'} · {editVaccination.dateCreated || '—'}</div><div>Verified · {editVaccination.lastUpdatedBy || 'Clinic staff'} · {editVaccination.dateCreated || '—'}</div><div>Edited · {editVaccination.lastUpdatedBy || 'Clinic staff'} · {editVaccination.dateCreated || '—'}</div><div>Verified · {editVaccination.lastUpdatedBy || 'Clinic staff'} · {editVaccination.dateCreated || '—'}</div></div></details>}
          <div style={modalStyles.editVaccinationFooter}>
            <button type="button" style={modalStyles.cancel} onClick={() => setEditVaccination(null)}>Cancel</button>
            <button type="submit" style={{ ...T.primaryBtn, padding: '8px 12px', fontSize: '.68rem', borderRadius: 7 }}>Save Changes</button>
          </div>
        </form>
      </div>}
    </div>
  );
}

// ── TREATMENTS TAB ─────────────────────────────────────────────────────
export function TreatmentsTab({ treatments, user }) {
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [localTreatments, setLocalTreatments] = useState(null);
  const [archiveError, setArchiveError] = useState('');
  const [actionTreatment, setActionTreatment] = useState(null);
  const [historyTreatment, setHistoryTreatment] = useState(null);
  const [editTreatment, setEditTreatment] = useState(null);
  const [addTreatment, setAddTreatment] = useState(false);
  const [treatmentFormError, setTreatmentFormError] = useState('');
  const sourceTreatments = localTreatments || (treatments && treatments.length > 0 ? treatments : TREATMENTS);
  const displayedTreatments = sourceTreatments.map(t => ({
    ...t,
    id: t.id || t.treatment_id,
    date: t.date || t.issued_at || '—',
    pet: t.pet || t.pet_name || '—',
    attendingDoctor: t.attendingDoctor || t.attending_doctor || t.doctor || '—',
    createdBy: t.createdBy || t.created_by || t.attendingDoctor || t.doctor || '—',
    lastUpdatedBy: t.lastUpdatedBy || t.last_updated_by || t.attendingDoctor || t.doctor || '—',
    dateCreated: t.dateCreated || t.date_created || t.created_at || t.date || '—',
    linkedPatient: t.linkedPatient || t.linked_patient || (t.pet && t.owner ? `${t.pet} (${t.owner})` : t.pet) || '—',
    status: t.status || 'finalized',
  }));
  const archiveTreatment = async treatment => {
    try {
      const saved = await updateClinicRecordArchive({ user, endpoint: '/clinic-records/treatments', record: treatment, label: 'treatment' });
      setLocalTreatments(displayedTreatments.map(item => item.id === treatment.id ? { ...item, ...saved } : item));
      notifySuccess(`Treatment ${saved.archived ? 'archived' : 'restored'} successfully!`, '');
      setArchiveError('');
    } catch (error) {
      setArchiveError(error.message || 'Unable to update the treatment record.');
    }
  };
  const filtered = displayedTreatments.filter(t =>
    Boolean(t.archived) === showArchived && [t.id, t.date, t.pet, t.diagnosis, t.treatment, t.medication, t.cost, t.attendingDoctor, t.createdBy, t.lastUpdatedBy, t.dateCreated, t.linkedPatient, t.status]
      .some(value => String(value || '').toLowerCase().includes(search.toLowerCase()))
  );
  const formatCost = value => {
    if (value === null || value === undefined || value === '') return '—';
    const raw = String(value).replace(/[₱$,\s]/g, '');
    const amount = Number(raw);
    return Number.isFinite(amount) ? `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `₱${String(value).replace(/^\$/, '')}`;
  };
  const treatmentPets = [...new Set(displayedTreatments.map(treatment => treatment.pet).filter(pet => pet && pet !== '—'))];
  const submitTreatment = event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pet = String(form.get('pet') || '').trim();
    const date = String(form.get('date') || '').trim();
    const diagnosis = String(form.get('diagnosis') || '').trim();
    const treatment = String(form.get('treatment') || '').trim();
    const cost = String(form.get('cost') || '').trim();
    if (!pet || !date || !diagnosis || !treatment || !cost) {
      setTreatmentFormError('Complete all required fields before adding the treatment record.');
      return;
    }
    const newTreatment = {
      id: `TRT-${String(Date.now()).slice(-6)}`,
      date,
      pet,
      diagnosis,
      treatment,
      medication: String(form.get('medication') || '').trim() || '—',
      cost,
      attendingDoctor: user?.name || 'Current doctor',
      createdBy: user?.name || 'Current doctor',
      lastUpdatedBy: user?.name || 'Current doctor',
      dateCreated: date,
      linkedPatient: pet,
      status: 'active',
      archived: false,
    };
    setLocalTreatments([newTreatment, ...displayedTreatments]);
    setAddTreatment(false);
    setTreatmentFormError('');
    notifySuccess(`Treatment ${newTreatment.id} added.`, 'The treatment record is now available in Treatments Management.');
  };
  return (
    <div style={{ ...T.wrap, padding: '20px 20px 18px', borderRadius: 14 }}>
      <div style={{ ...T.hd, margin: '0 0 20px' }}>
        <div style={{ ...T.title, fontSize: '.9rem', fontWeight: 600 }}>Treatments Management</div>
        <div style={{ ...T.actions, gap: 8 }}>
          <button type="button" onClick={() => setShowArchived(value => !value)} style={{ ...archiveToggleStyle, ...(showArchived ? archiveToggleActiveStyle : { color: '#374151' }) }}>
            <span style={{ width: 13, height: 13, display: 'flex' }}>{Icons.archive}</span>
            {showArchived ? `Viewing Archived (${displayedTreatments.filter(item => item.archived).length})` : `Show Archived (${displayedTreatments.filter(item => item.archived).length})`}
          </button>
          <button type="button" onClick={() => { setTreatmentFormError(''); setAddTreatment(true); }} style={{ ...T.primaryBtn, padding: '7px 13px', fontSize: '.75rem', borderRadius: 8 }}>
            <span style={{ width: 13, height: 13, display: 'flex' }}>{Icons.plus}</span>
            Add Treatment
          </button>
        </div>
        {archiveError && <div role="alert" style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: '.78rem' }}>{archiveError}</div>}
      </div>
      <div style={{ ...T.searchWrap, marginBottom: 18 }}>
        <span style={T.searchIcon}>{Icons.search}</span>
        <input
          style={{ ...T.search, marginBottom: 0, padding: '8px 14px 8px 36px', border: 'none', borderRadius: 8, background: '#f1f1f3', fontSize: '.78rem', color: '#374151' }}
          placeholder="Search treatments..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <table style={{ ...T.table, tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {[
              ['Treatment ID', '9%'], ['Date', '9%'], ['Pet', '8%'], ['Diagnosis', '12%'],
              ['Treatment', '15%'], ['Medication', '11%'], ['Cost', '8%'], ['Attending Doctor', '13%'],
              ['Status', '8%'], ['Actions', '3%'],
            ].map(([h, width]) => (
              <th key={h} className={h === 'Actions' ? 'clinic-action-heading' : undefined} aria-label={h === 'Actions' ? 'Row actions' : undefined} style={{ ...T.th, width, textTransform: 'none', letterSpacing: 0, color: '#374151', fontSize: '.72rem', padding: h === 'Actions' ? '0 2px 9px' : '0 7px 9px' }}>{h === 'Actions' ? '' : h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map(t => {
            const openActions = () => setActionTreatment(t);
            return <tr key={t.id} className="clinic-action-row" tabIndex={0} onClick={openActions} onKeyDown={event => handleClinicActionRowKeyDown(event, openActions)}>
              <td style={{ ...T.td, padding: '9px 7px', fontWeight: 600, fontSize: '.75rem', color: '#374151' }}>{t.id}</td>
              <td style={{ ...T.tdMuted, padding: '9px 7px', fontSize: '.75rem', color: '#374151' }}>{t.date || t.issued_at || '—'}</td>
              <td style={{ ...T.td, padding: '9px 7px', fontSize: '.75rem', color: '#374151' }}>{t.pet || t.pet_name || '—'}</td>
              <td style={{ ...T.td, padding: '9px 7px', fontSize: '.75rem', color: '#374151' }}>{t.diagnosis || '—'}</td>
              <td style={{ ...T.tdMuted, padding: '9px 7px', fontSize: '.75rem', color: '#374151' }}>{t.treatment || t.description || '—'}</td>
              <td style={{ ...T.tdMuted, padding: '9px 7px', fontSize: '.75rem', color: '#374151' }}>{t.medication || '—'}</td>
              <td style={{ ...T.td, padding: '9px 7px', fontWeight: 600, fontSize: '.75rem', color: '#374151' }}>{formatCost(t.cost || t.amount)}</td>
              <td style={{ ...T.tdMuted, padding: '9px 7px', fontSize: '.75rem', color: '#374151' }}>{t.attendingDoctor}</td>
              <td style={{ ...T.td, padding: '9px 7px', whiteSpace: 'nowrap' }}><StatusBadge status={t.status} /></td>
              <td style={{ ...T.td, padding: '9px 7px', textAlign: 'center' }}>
                <button type="button" className="clinic-record-actions-trigger" onClick={event => { event.stopPropagation(); openActions(); }} aria-label={`Open actions for treatment ${t.id}`} title="Treatment actions">
                  {Icons.chevronRight}
                </button>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
      {addTreatment && <div style={modalStyles.backdrop} onClick={() => setAddTreatment(false)}>
        <ModalDialog as="form" size="standard" role="dialog" aria-modal="true" aria-labelledby="add-treatment-title" onClick={event => event.stopPropagation()} onSubmit={submitTreatment} style={{ ...modalStyles.doctorAppointmentDialog, width: 'min(600px, 100%)', padding: '22px 24px 20px' }}>
          <button type="button" aria-label="Close add treatment" onClick={() => setAddTreatment(false)} style={modalStyles.close}>{Icons.close}</button>
          <h2 id="add-treatment-title" style={{ ...modalStyles.doctorAppointmentTitle, fontSize: '1.1rem' }}>Add Treatment Record</h2>
          <p style={modalStyles.doctorAppointmentIntro}>Enter the treatment details.</p>
          {treatmentFormError && <div role="alert" style={{ marginBottom: 12, padding: '9px 11px', border: '1px solid #fecaca', borderRadius: 7, background: '#fef2f2', color: '#b91c1c', fontSize: '.72rem' }}>{treatmentFormError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
            <label style={modalStyles.doctorAppointmentLabel}><span>Pet<span style={modalStyles.required}>*</span></span><select name="pet" required defaultValue="" style={modalStyles.doctorAppointmentInput}><option value="" disabled>Select pet</option>{treatmentPets.map(pet => <option key={pet} value={pet}>{pet}</option>)}</select></label>
            <label style={modalStyles.doctorAppointmentLabel}><span>Date<span style={modalStyles.required}>*</span></span><LabDateTimePicker name="date" mode="date" required style={modalStyles.doctorAppointmentInput} /></label>
            <label style={{ ...modalStyles.doctorAppointmentLabel, gridColumn: '1 / -1' }}><span>Diagnosis<span style={modalStyles.required}>*</span></span><input name="diagnosis" required placeholder="Routine Checkup" style={modalStyles.doctorAppointmentInput} /></label>
            <label style={{ ...modalStyles.doctorAppointmentLabel, gridColumn: '1 / -1' }}><span>Treatment<span style={modalStyles.required}>*</span></span><textarea name="treatment" required placeholder="Description of treatment..." style={{ ...modalStyles.doctorAppointmentNotes, height: 76 }} /></label>
            <label style={modalStyles.doctorAppointmentLabel}><span>Medication</span><input name="medication" placeholder="Amoxicillin" style={modalStyles.doctorAppointmentInput} /></label>
            <label style={modalStyles.doctorAppointmentLabel}><span>Cost<span style={modalStyles.required}>*</span></span><input name="cost" required inputMode="decimal" placeholder="50.00" style={modalStyles.doctorAppointmentInput} /></label>
          </div>
          <div style={modalStyles.doctorAppointmentFooter}><button type="button" style={modalStyles.cancel} onClick={() => setAddTreatment(false)}>Cancel</button><button type="submit" style={{ ...T.primaryBtn, padding: '8px 13px', fontSize: '.7rem', borderRadius: 7 }}>Add Treatment</button></div>
        </ModalDialog>
      </div>}
      {actionTreatment && <div style={modalStyles.backdrop} onClick={() => setActionTreatment(null)}>
        <div role="dialog" aria-modal="true" aria-labelledby="treatment-actions-title" onClick={event => event.stopPropagation()} style={modalStyles.vaccinationActionsDialog}>
          <button type="button" aria-label="Close treatment actions" onClick={() => setActionTreatment(null)} style={modalStyles.vaccinationActionsClose}>{Icons.close}</button>
          <div style={modalStyles.vaccinationActionsHeader}>
            <div style={modalStyles.vaccinationActionsHeaderIcon}><span style={{ width: 25, height: 25, display: 'flex' }}>{Icons.stethoscope}</span></div>
            <div><h2 id="treatment-actions-title" style={modalStyles.vaccinationActionsTitle}>Treatment Actions</h2><div style={modalStyles.vaccinationActionsSubtitle}>{actionTreatment.id} — {actionTreatment.diagnosis} ({actionTreatment.pet})</div></div>
          </div>
          <div style={modalStyles.vaccinationActionsPet}>
            <div style={modalStyles.vaccinationActionsPetInfo}><img src="/healthy-pets.png" alt="" style={modalStyles.vaccinationActionsPetImage} /><div><div style={modalStyles.vaccinationActionsPetName}>{actionTreatment.pet || 'Selected Pet'}</div><div style={modalStyles.vaccinationActionsPetMeta}>🐾 Patient record&nbsp; • &nbsp;{actionTreatment.diagnosis || 'Clinical treatment'}&nbsp; • &nbsp;{actionTreatment.date || 'Treatment date'}</div></div></div>
            <StatusIndicator status={actionTreatment.status === 'finalized' ? 'Finalized' : 'Active'} />
          </div>
          <div style={modalStyles.vaccinationActionsList}>
            <button type="button" onClick={() => setHistoryTreatment(actionTreatment)} style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #b7e4d7', background: '#f2fbf8' }}><span style={{ ...modalStyles.vaccinationActionCardIcon, background: '#e7f5f2', color: '#005447' }}><span style={{ width: 24, height: 24, display: 'flex' }}>{Icons.clipboard}</span></span><span style={modalStyles.vaccinationActionCardText}><strong style={modalStyles.vaccinationActionCardTitle}>View Audit History</strong><small style={modalStyles.vaccinationActionCardDescription}>See the complete treatment record and history for this pet.</small></span><span style={modalStyles.vaccinationActionArrow}>›</span></button>
            <button type="button" onClick={() => setEditTreatment(actionTreatment)} style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #b7e4d7', background: '#f2fbf8' }}><span style={{ ...modalStyles.vaccinationActionCardIcon, background: '#d9f3ea', color: '#0d8a69' }}><span style={{ width: 23, height: 23, display: 'flex' }}>{Icons.edit}</span></span><span style={modalStyles.vaccinationActionCardText}><strong style={modalStyles.vaccinationActionCardTitle}>Edit Treatment</strong><small style={modalStyles.vaccinationActionCardDescription}>Update diagnosis, treatment details, medication, or cost.</small></span><span style={modalStyles.vaccinationActionArrow}>›</span></button>
            {actionTreatment.status !== 'finalized' && <button type="button" onClick={async () => {
              try {
                const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
                const response = await fetch(`${apiUrl}/clinic-records/treatments/${actionTreatment.id}/finalize?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
                  method: 'PATCH',
                  headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' },
                  body: JSON.stringify({}),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.error || 'Unable to finalize the treatment record.');
                setLocalTreatments(displayedTreatments.map(item => item.id === actionTreatment.id ? { ...item, ...payload, status: 'finalized' } : item));
                setActionTreatment(null);
                setArchiveError('');
                notifySuccess(`Treatment ${actionTreatment.id} finalized successfully!`, 'The record was saved to the clinic database.');
              } catch (error) {
                setArchiveError(error.message || 'Unable to finalize the treatment record.');
              }
            }} style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #cbd9e8', background: '#f2fbf8' }}>
              <span style={{ ...modalStyles.vaccinationActionCardIcon, background: '#e5edf6', color: '#294563' }}><span style={{ width: 23, height: 23, display: 'flex' }}>{Icons.shieldCheck}</span></span><span style={modalStyles.vaccinationActionCardText}><strong style={modalStyles.vaccinationActionCardTitle}>Finalize Record</strong><small style={modalStyles.vaccinationActionCardDescription}>Confirm the treatment is complete and properly logged.</small></span><span style={modalStyles.vaccinationActionArrow}>›</span>
            </button>}
            <button type="button" onClick={() => { archiveTreatment(actionTreatment); setActionTreatment(null); }} style={{ ...modalStyles.vaccinationActionCard, border: '1px solid #ffc0c8', background: '#fff5f6' }}><span style={{ ...modalStyles.vaccinationActionCardIcon, background: '#ffdce1', color: '#c52e4a' }}><span style={{ width: 23, height: 23, display: 'flex' }}>{showArchived ? Icons.refresh : Icons.trash}</span></span><span style={modalStyles.vaccinationActionCardText}><strong style={modalStyles.vaccinationActionCardTitle}>{showArchived ? 'Restore Treatment' : 'Move to Trash'}</strong><small style={modalStyles.vaccinationActionCardDescription}>Remove this treatment record from the system.</small></span><span style={modalStyles.vaccinationActionArrow}>›</span></button>
          </div>
          <div style={modalStyles.vaccinationActionsFooter}><span style={modalStyles.vaccinationActionsNote}>ⓘ &nbsp;These actions only affect the selected treatment record ({actionTreatment.id}).</span><button type="button" style={modalStyles.vaccinationActionsCancel} onClick={() => setActionTreatment(null)}>Cancel</button></div>
        </div>
      </div>}
      {historyTreatment && <div style={modalStyles.backdrop} onClick={() => setHistoryTreatment(null)}>
        <div className="lab-audit-dialog" role="dialog" aria-modal="true" aria-labelledby="treatment-audit-title" onClick={event => event.stopPropagation()}>
          <header className="lab-audit-header">
            <div><h2 id="treatment-audit-title">Treatment Audit History</h2><p>{historyTreatment.pet || 'Patient'} · Recorded changes to this treatment</p></div>
            <button type="button" aria-label="Close treatment audit history" onClick={() => setHistoryTreatment(null)}>{Icons.close}</button>
          </header>
          <div className="lab-audit-content">
            <dl className="lab-audit-summary">
              <div><dt>Created By</dt><dd>{historyTreatment.createdBy || '—'}</dd></div>
              <div><dt>Date Created</dt><dd>{formatClinicDate(historyTreatment.dateCreated) || '—'}</dd></div>
              <div><dt>Last Updated By</dt><dd>{historyTreatment.lastUpdatedBy || '—'}</dd></div>
              <div><dt>Linked Patient</dt><dd>{historyTreatment.linkedPatient || historyTreatment.pet || '—'}</dd></div>
            </dl>
            <section className="lab-audit-timeline treatment-audit-timeline">
              <h3>Activity Timeline</h3>
              <ol>{[
                ['Record Created', historyTreatment.dateCreated, historyTreatment.createdBy],
                ['Treatment Recorded', historyTreatment.date, historyTreatment.attendingDoctor],
                ...(historyTreatment.status === 'finalized' ? [['Record Finalized', historyTreatment.dateCreated, historyTreatment.lastUpdatedBy]] : []),
              ].map(([event, date, actor]) => <AuditTimelineEntry key={event}
                date={formatClinicDate(date) || 'Date unavailable'} dateTime={date} title={event}
                detail={event === 'Record Created' ? 'Treatment record created.' : event === 'Record Finalized' ? 'Treatment record finalized.' : 'Treatment recorded for this patient.'}
                actor={actor || 'Actor not recorded'} />)}</ol>
            </section>
          </div>
          <footer className="lab-audit-footer">
            <button type="button" className="lab-audit-back-button" onClick={() => { setActionTreatment(historyTreatment); setHistoryTreatment(null); }}>Back to actions</button>
            <button type="button" className="lab-audit-close-button" onClick={() => setHistoryTreatment(null)}>Close</button>
          </footer>
        </div>
      </div>}
      {editTreatment && <div style={modalStyles.backdrop} onClick={() => setEditTreatment(null)}>
        <form role="dialog" aria-modal="true" aria-labelledby="edit-treatment-title" onClick={event => event.stopPropagation()} onSubmit={event => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const updated = {
            ...editTreatment,
            diagnosis: String(form.get('diagnosis') || '').trim(),
            treatment: String(form.get('treatment') || '').trim(),
            medication: String(form.get('medication') || '').trim(),
            cost: String(form.get('cost') || '').trim(),
            lastUpdatedBy: user?.name || editTreatment.lastUpdatedBy,
            dateCreated: editTreatment.dateCreated,
          };
          setLocalTreatments(displayedTreatments.map(item => item.id === updated.id ? updated : item));
          setEditTreatment(null);
          setActionTreatment(updated);
          notifySuccess(`Treatment ${updated.id} updated.`, 'The edited values are now reflected in this clinic record.');
        }} style={{ ...modalStyles.dialog, width: 'min(520px, 100%)' }}>
          <button type="button" aria-label="Close edit treatment" onClick={() => setEditTreatment(null)} style={modalStyles.close}>{Icons.close}</button>
          <div style={modalStyles.headerText}><h2 id="edit-treatment-title" style={modalStyles.title}>Edit Treatment</h2><div style={modalStyles.subtitle}>{editTreatment.id} — {editTreatment.pet}</div></div>
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {[
              ['diagnosis', 'Diagnosis', editTreatment.diagnosis],
              ['treatment', 'Treatment', editTreatment.treatment || editTreatment.description],
              ['medication', 'Medication', editTreatment.medication],
              ['cost', 'Cost', editTreatment.cost || editTreatment.amount],
            ].map(([name, label, value]) => <label key={name} style={modalStyles.editVaccinationLabel}><span>{label}</span><input name={name} defaultValue={value || ''} style={modalStyles.editVaccinationInput} /></label>)}
          </div>
          <div style={modalStyles.footer}><button type="button" style={modalStyles.cancel} onClick={() => setEditTreatment(null)}>Cancel</button><button type="submit" style={{ ...T.primaryBtn, padding: '8px 12px', fontSize: '.7rem' }}>Save Changes</button></div>
        </form>
      </div>}
    </div>
  );
}

// ── MAIN LAYOUT ────────────────────────────────────────────────────────
export default function ClinicLayout({ user, onNavigate, initialTab = 'dashboard', initialInvoiceId = null }) {
  const [tab, setTab]           = useState(initialTab);
  const [inpatientPlanRequest, setInpatientPlanRequest] = useState(null);
  const [visitCheckupRequest, setVisitCheckupRequest] = useState(null);
  const [exportReportsOpen, setExportReportsOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clients, setClients] = useState([]);
  const [pets, setPets] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [visits, setVisits] = useState([]);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [visitsError, setVisitsError] = useState('');
  const [dashboardAlerts, setDashboardAlerts] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [treatments, setTreatments] = useState([]);


  const canView = canViewFeature(user.permissions, user.role, 'Pet Profiles');

  useEffect(() => {
    if (!user || !user.token) return;
    if (!canView) return;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const params = new URLSearchParams();
    if (user.clinic_id) params.set('clinic_id', user.clinic_id);
    const query = params.toString() ? `?${params.toString()}` : '';
    const headers = { Authorization: `Bearer ${user.token}` };

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [clientsRes, petsRes, apptsRes, vaccRes, treatsRes, alertsRes, visitsRes] = await Promise.all([
          fetch(`${apiUrl}/clinic-records/clients${query}`, { headers }),
          fetch(`${apiUrl}/clinic-records/pets${query}`, { headers }),
          fetch(`${apiUrl}/clinic-records/appointments${query}`, { headers }),
          fetch(`${apiUrl}/clinic-records/vaccinations${query}`, { headers }),
          fetch(`${apiUrl}/clinic-records/treatments${query}`, { headers }),
          fetch(`${apiUrl}/clinic-records/dashboard/alerts${query}`, { headers }),
          fetch(`${apiUrl}/clinic-records/visits${query}`, { headers }),
        ]);

        if (!clientsRes.ok || !petsRes.ok || !apptsRes.ok || !vaccRes.ok || !treatsRes.ok || !alertsRes.ok || !visitsRes.ok) {
          throw new Error('Failed to load clinic records');
        }

        const [clientsData, petsData, apptsData, vaccData, treatsData, alertsData, visitsData] = await Promise.all([
          clientsRes.json(),
          petsRes.json(),
          apptsRes.json(),
          vaccRes.json(),
          treatsRes.json(),
          alertsRes.json(),
          visitsRes.json(),
        ]);

        setClients(clientsData || []);
        setPets(petsData || []);
        setAppointments(apptsData || []);
        setVaccinations(vaccData || []);
        setTreatments(treatsData || []);
        setDashboardAlerts(alertsData || []);
        setVisits(visitsData || []);
        setVisitsError('');
      } catch (err) {
        console.error(err);
        setError('Unable to load clinic records.');
        setVisitsError('Unable to load clinic visit records.');
      } finally {
        setVisitsLoading(false);
        setLoading(false);
      }
    };

    fetchData();
  }, [user, canView]);

  const tabContent = {
    dashboard:    <DashboardTab clients={clients} pets={pets} appointments={appointments} alerts={dashboardAlerts} vaccinations={vaccinations} treatments={treatments} user={user} onViewAppointments={() => setTab('appointments')} onViewPets={() => setTab('pets')} onViewDiseaseIntelligence={() => onNavigate?.('disease')} onExportReports={() => setExportReportsOpen(true)} />,
    owners:       <OwnersTab owners={clients} user={user} onOwnersChange={setClients} />,
    pets:         <PetsTab pets={pets} owners={clients} user={user} onPetsChange={setPets} onOwnersChange={setClients} />,
    appointments: <AppointmentsTab appointments={appointments} pets={pets} owners={clients} vaccinations={vaccinations} user={user} createVisitRequest={visitCheckupRequest} onAppointmentsChange={setAppointments} onVaccinationsChange={setVaccinations} onCreateLabRequest={async request => {
      if (!user?.clinic_id || !user?.token) throw new Error('Your account is not assigned to a clinic.');
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/clinic-records/lab-tests?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pet_id: request.patientId, ...request }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to save the lab test request.');
      return payload;
    }} />,
    visits: <VisitCheckupTab visits={visits} loading={visitsLoading} error={visitsError} onNewVisitCheckup={() => { setVisitCheckupRequest({ id: Date.now() }); setTab('appointments'); }} />,
    vaccinations: <VaccinationsTab vaccinations={vaccinations} appointments={appointments} pets={pets} user={user} onNavigate={onNavigate} onOpenAppointments={() => setTab('appointments')} onVaccinationsChange={setVaccinations}
      onAppointmentUpdate={(id, saved) => setAppointments(current => current.map(item => String(item.id) === String(id) ? { ...item, reason: saved.reason, notes: saved.notes } : item))}
      onAppointmentArchive={id => setAppointments(current => current.map(item => String(item.id) === String(id) ? { ...item, archived: true } : item))} />,
    plans:         <TreatmentPlansTab user={user} appointments={appointments} standalonePlanRequest={inpatientPlanRequest} onStandalonePlanClose={() => { setInpatientPlanRequest(null); setTab('inpatient'); }} />,
    'lab-results': <LabResultsTab user={user} appointments={appointments} />,
    inpatient:     <InpatientTab user={user} appointments={appointments} onOpenTreatmentPlan={record => { setInpatientPlanRequest({ planId: record.treatment_plan_id }); setTab('plans'); }} />,
    consultation:  <BillingTab user={user} initialInvoiceId={initialInvoiceId} />,
    inventory:     <InventoryTab />,
    
  };

  if (!canView) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f9' }}>
        <div style={{ maxWidth: 520, width: '100%', padding: 32, background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Access denied</h2>
          <p style={{ marginTop: 12, color: '#64748b' }}>You do not have permission to view Clinical Records.</p>
        </div>
      </div>
    );
  }

  const dashboardDate = new Date();
  const dashboardDateAction = tab === 'dashboard' ? <div className="clinic-dashboard-date"><span>{Icons.calendar}</span><div><strong>{dashboardDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong><small>{dashboardDate.toLocaleDateString('en-US', { weekday: 'long' })} · {dashboardDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</small></div></div> : null;

  return (
    <div className="clinic-records-shell" style={{ flex: 1, minWidth: 0, width: '100%', overflowY: 'auto', overflowX: 'hidden', background: '#f4f6f9', fontSize: '14px', color: '#111827' }}>
      <Topbar user={user} title="Local Clinic Records" subtitle="Patient records, vaccinations, treatments, consultations, and lab results" actions={dashboardDateAction} className={tab === 'dashboard' ? 'clinic-dashboard-topbar' : ''} />
      <TabNav active={tab} setTab={setTab} />
      <div className="clinic-records-content" style={{ padding: '20px 28px', minWidth: 0, boxSizing: 'border-box' }}>
        {showBanner && <PrivacyBanner onClose={() => setShowBanner(false)} />}
        {exportReportsOpen && <ExportReportsModal user={user} reports={{ owners: clients, pets, appointments, vaccinations, treatments }} onClose={() => setExportReportsOpen(false)} />}
        {loading && (
          <div style={{ padding: 24, background: '#fff', borderRadius: 14, border: '1px solid #e8ecf0', color: '#64748b' }}>
            Loading clinic records...
          </div>
        )}
        {error && (
          <div style={{ padding: 24, background: '#fee2e2', borderRadius: 14, border: '1px solid #fecaca', color: '#b91c1c' }}>
            {error}
          </div>
        )}
        {!loading && !error && (tabContent[tab] || <ClinicSectionPlaceholder label={TABS.find(item => item.id === tab)?.label || 'Clinic Records'} />)}
      </div>
    </div>
  );
}
