import { cloneElement, useEffect, useMemo, useState } from 'react';
import Topbar from '../components/Topbar';
import StatusIndicator from '../components/StatusIndicator';
import LabDateTimePicker, { getUnavailableAppointmentTimes } from '../components/LabDateTimePicker';
import { ModalDialog } from '../components/ModalDialog';
import { getStatusToneColors } from '../utils/statusTone';
import { Icons } from '../icons';

const formatTime = value => value
  ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  : '—';

const normalizeAppointmentStatus = status => String(status || '').toLowerCase().replace(/[-\s]+/g, '_');
const isDemoAppointment = appointment => String(appointment?.id || '').startsWith('demo-');
const isDateInCurrentMonth = (value, referenceDate = new Date()) => {
  if (!value) return false;
  // The API returns date-only values for clinical dates. Compare those as
  // calendar dates so UTC conversion cannot move a record into another month.
  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return Number(dateOnly[1]) === referenceDate.getFullYear()
    && Number(dateOnly[2]) === referenceDate.getMonth() + 1;
  const date = new Date(value);
  return !Number.isNaN(date.getTime())
    && date.getFullYear() === referenceDate.getFullYear()
    && date.getMonth() === referenceDate.getMonth();
};

const getAppointmentDuration = appointment => {
  const duration = Number(appointment.duration_minutes || appointment.duration);
  if (Number.isFinite(duration) && duration > 0) return `${duration} min`;
  const start = new Date(appointment.start_time).getTime();
  const end = new Date(appointment.end_time).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end > start
    ? `${Math.round((end - start) / 60000)} min`
    : 'Duration not set';
};

const formatLongDate = value => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date not set'
    : date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
};

const formatActivityDate = formatLongDate;

const toDateInputValue = value => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const toTimeInputValue = value => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const formatAppointmentStatus = status => {
  const normalized = String(status || '').toLowerCase().replace(/[-\s]+/g, '_');
  if (normalized === 'checked_in') return 'Checked In — Waiting';
  if (normalized === 'in_consultation') return 'In Consultation';
  return status || 'confirmed';
};

const isMeaningfulText = value => {
  const text = String(value || '').trim();
  if (text.length < 8 || !/[a-z]/i.test(text) || !/[aeiou]/i.test(text)) return false;
  if (/(.)\1{3,}/i.test(text) || /^[^aeiou]+$/i.test(text) || /(asdf|qwer|zxcv|qaz|wsx|edc|rfv|tgb|yhn|ujm|iok|plm)/i.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.every(word => /^[a-z]+([-''][a-z]+)?$/i.test(word) && word.length >= 3 && /[aeiou]/i.test(word));
};

const initialTransferForm = { patient: '', doctor: '', reason: '', urgency: 'Routine — no rush', notes: '' };

const workflowStyles = {
  dialog: { display: 'flex', flexDirection: 'column', width: 'min(520px, 100%)', maxHeight: 'calc(100vh - 24px)', overflow: 'hidden', borderRadius: 18, background: '#fff', boxShadow: '0 18px 50px rgba(15,23,42,.25)' },
  body: { display: 'grid', gap: 20, overflowY: 'auto', padding: '20px 24px 24px' },
  field: { display: 'grid', gap: 9, color: '#193a32', fontSize: '.88rem', fontWeight: 600 },
  dateTime: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  input: { width: '100%', minWidth: 0, height: 56, boxSizing: 'border-box', border: '1px solid #d8e9e1', borderRadius: 13, padding: '0 15px', background: '#fff', color: '#193a32', font: 'inherit', fontWeight: 400, outlineColor: '#78b7a1' },
  textarea: { width: '100%', minHeight: 96, boxSizing: 'border-box', resize: 'vertical', border: '1px solid #d8e9e1', borderRadius: 13, padding: '14px 15px', color: '#193a32', font: 'inherit', fontWeight: 400, outlineColor: '#78b7a1' },
  visitChoices: { display: 'flex', flexWrap: 'wrap', gap: 9 },
  visitButton: { minHeight: 48, padding: '0 16px', border: '1px solid #d8e9e1', borderRadius: 13, background: '#fff', color: '#38534c', fontSize: '.8rem', cursor: 'pointer' },
  visitSelected: { borderColor: '#005447', background: '#e7f5f2', color: '#005447' },
  hint: { margin: '-8px 0 0', color: '#647c75', fontSize: '.76rem', lineHeight: 1.45 },
  error: { padding: '10px 12px', border: '1px solid #fecaca', borderRadius: 9, background: '#fff7f7', color: '#b91c1c', fontSize: '.78rem' },
  footer: { display: 'grid', gap: 10, padding: '16px 24px', borderTop: '1px solid #e2ebe7' },
  backButton: { minHeight: 51, border: '1px solid #d8e9e1', borderRadius: 12, background: '#fff', color: '#005447', font: 'inherit', fontSize: '.8rem', cursor: 'pointer' },
  submitButton: { minHeight: 52, border: 0, borderRadius: 12, background: '#005447', color: '#fff', font: 'inherit', fontSize: '.8rem', fontWeight: 700, cursor: 'pointer' },
};

const statusColor = status => getStatusToneColors(status).dot;

const getDemoScheduleData = practitioner => {
  const today = new Date();
  const at = hours => {
    const date = new Date(today);
    date.setHours(hours, 0, 0, 0);
    return date.toISOString();
  };
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  tomorrow.setHours(10, 30, 0, 0);

  return {
    appointments: [
      { id: 'demo-appointment-1', status: 'confirmed', start_time: at(9), end_time: at(9.5), reason: 'Checkup', notes: 'Annual checkup, check weight', pet: 'Max', owner: 'John Smith', practitioner },
      { id: 'demo-appointment-2', status: 'confirmed', start_time: at(10.5), end_time: at(11), reason: 'Vaccination', notes: 'Distemper booster due', pet: 'Luna', owner: 'Sarah Johnson', practitioner },
      { id: 'demo-appointment-3', status: 'pending', start_time: at(11), end_time: at(11.5), reason: 'Surgery', notes: 'Dental cleaning under anesthesia', pet: 'Charlie', owner: 'Mike Davis', practitioner },
      { id: 'demo-appointment-4', status: 'confirmed', start_time: at(14), end_time: at(14.5), reason: 'Dental', notes: 'Routine dental examination', pet: 'Bella', owner: 'Emma Wilson', practitioner },
      { id: 'demo-appointment-5', status: 'confirmed', start_time: at(15.5), end_time: at(16), reason: 'Follow-up', notes: 'Post-kennel cough follow-up', pet: 'Rocky', owner: 'David Brown', practitioner },
      { id: 'demo-appointment-6', status: 'confirmed', start_time: tomorrow.toISOString(), end_time: new Date(tomorrow.getTime() + 30 * 60000).toISOString(), reason: 'Follow-up', notes: 'Recovery progress review', pet: 'Daisy', owner: 'Lisa Taylor', practitioner },
      { id: 'demo-appointment-7', status: 'checked_in', start_time: at(16.5), end_time: at(17), reason: 'Consultation', notes: 'Reception checked in the patient', pet: 'Milo', owner: 'Ana Garcia', practitioner },
      { id: 'demo-appointment-8', status: 'in_consultation', start_time: at(17.5), end_time: at(18), reason: 'Skin examination', notes: 'Consultation currently in progress', pet: 'Coco', owner: 'Robert Lee', practitioner },
      { id: 'demo-appointment-9', status: 'completed', start_time: at(8), end_time: at(8.5), reason: 'Wellness examination', notes: 'Consultation completed today', pet: 'Buddy', owner: 'Nina Patel', practitioner },
      { id: 'demo-appointment-10', status: 'rescheduled', start_time: at(13), end_time: at(13.5), reason: 'Follow-up', notes: 'Moved to the next available schedule', pet: 'Oliver', owner: 'Grace Kim', practitioner },
      { id: 'demo-appointment-11', status: 'cancelled', start_time: at(18.5), end_time: at(19), reason: 'Vaccination', notes: 'Owner cancelled the appointment', pet: 'Nala', owner: 'Ethan Cruz', practitioner },
      { id: 'demo-appointment-12', status: 'no_show', start_time: at(19.5), end_time: at(20), reason: 'Checkup', notes: 'Patient did not arrive', pet: 'Simba', owner: 'Olivia Reed', practitioner },
    ],
    vaccinations: [
      { id: 'demo-vaccination-1', vaccine_name: 'Rabies', pet: 'Luna', owner: 'John Smith', date_given: today.toISOString(), administered_by: practitioner },
    ],
    treatments: [
      { id: 'demo-treatment-1', medication: 'Amoxicillin', pet: 'Coco', owner: 'John Smith', dosage: '250 mg', status: 'active', issued_at: today.toISOString(), issued_by: practitioner },
    ],
  };
};

const createConsultationForm = (appointment, savedNotes = {}) => ({
  chiefComplaint: appointment.reason || '',
  weight: '', temperature: '', heartRate: '', respiratoryRate: '', hydration: 'Normal',
  vitalSigns: '', clinicalFindings: '', diagnosisStatus: 'Suspected', severity: 'Mild',
  diagnosis: '', treatment: '', outcome: '', medications: '', vaccinations: '',
  labTests: '', followUpDate: '', followUpTime: '', followUpInstructions: '',
  internalNotes: '', ownerSummary: '', attachments: '',
  ...savedNotes,
  billingItems: Array.isArray(savedNotes.billingItems) ? savedNotes.billingItems : [],
});

const CONSULTATION_FIELDS = [
  ['chiefComplaint', 'Chief complaint / reason for visit', 0],
  ['weight', 'Weight (kg)', 0],
  ['temperature', 'Temperature (°C)', 0],
  ['heartRate', 'Heart rate (bpm)', 0],
  ['respiratoryRate', 'Respiratory rate (/min)', 0],
  ['vitalSigns', 'Other vital signs', 0],
  ['clinicalFindings', 'Clinical findings / examination notes', 0],
  ['diagnosis', 'Diagnosis', 0],
  ['treatment', 'Treatment performed', 1],
  ['outcome', 'Outcome / disposition', 1],
  ['medications', 'Medication instructions / details', 1],
  ['vaccinations', 'Vaccination / deworming details', 1],
  ['labTests', 'Lab tests requested / results reviewed', 1],
  ['followUpInstructions', 'Follow-up instructions', 1],
  ['internalNotes', 'Internal clinical notes (private)', 1],
  ['ownerSummary', 'Visit summary for owner', 1],
  ['attachments', 'Attachments / file references', 1],
];
const CONSULTATION_REQUIRED_FIELDS = new Set(['clinicalFindings', 'diagnosis', 'outcome']);

function Badge({ children, tone }) {
  return <span style={{ ...styles.badge, ...tone }}>{children}</span>;
}

export default function MySchedulePage({ user }) {
  const [appointments, setAppointments] = useState([]);
  const [isDemoSchedule, setIsDemoSchedule] = useState(false);
  const [vaccinations, setVaccinations] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [inpatientStays, setInpatientStays] = useState([]);
  const [treatmentPlans, setTreatmentPlans] = useState([]);
  const [clinicDoctors, setClinicDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAppointment, setTransferAppointment] = useState(null);
  const [recordAppointment, setRecordAppointment] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [appointmentWorkflow, setAppointmentWorkflow] = useState(null);
  const [consultationAppointment, setConsultationAppointment] = useState(null);
  const [consultationForm, setConsultationForm] = useState({});
  const [consultationStep, setConsultationStep] = useState(0);
  const [billingCatalog, setBillingCatalog] = useState([]);
  const [billingCatalogLoading, setBillingCatalogLoading] = useState(false);
  const [consultationCompleting, setConsultationCompleting] = useState(false);
  const [showCompletionReview, setShowCompletionReview] = useState(false);
  const [scheduleTab, setScheduleTab] = useState('today');
  const [transferForm, setTransferForm] = useState(initialTransferForm);
  const [transferErrors, setTransferErrors] = useState({});
  const [transferSubmitted, setTransferSubmitted] = useState(false);
  const [transferNotice, setTransferNotice] = useState('');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());
  const [showAllRecentActivities, setShowAllRecentActivities] = useState(false);
  const today = new Date();
  const workflowUnavailableTimes = appointmentWorkflow
    ? getUnavailableAppointmentTimes(
      appointments,
      appointmentWorkflow.date,
      appointmentWorkflow.action === 'reschedule' ? appointmentWorkflow.appointment.id : undefined,
    )
    : [];
  const activeBillingCatalog = billingCatalog.filter(item => item.active);
  const consultationBillItems = Array.isArray(consultationForm.billingItems) ? consultationForm.billingItems : [];
  const consultationBillTotal = consultationBillItems.reduce((total, item) => {
    const catalogItem = activeBillingCatalog.find(entry => String(entry.id) === String(item.catalog_item_id));
    return total + Number(catalogItem?.unit_price || 0) * Number(item.quantity || 0);
  }, 0);
  const updateBillingItem = (index, updates) => setConsultationForm(current => ({
    ...current,
    billingItems: (current.billingItems || []).map((item, itemIndex) => itemIndex === index ? { ...item, ...updates } : item),
  }));
  const addBillingItem = () => setConsultationForm(current => ({
    ...current,
    billingItems: [...(current.billingItems || []), { catalog_item_id: '', quantity: '1', clinical_details: '' }],
  }));
  const removeBillingItem = index => setConsultationForm(current => ({
    ...current,
    billingItems: (current.billingItems || []).filter((_, itemIndex) => itemIndex !== index),
  }));

  useEffect(() => {
    if (!consultationAppointment || isDemoAppointment(consultationAppointment)) {
      setBillingCatalog([]);
      setBillingCatalogLoading(false);
      return;
    }
    const controller = new AbortController();
    const loadCatalog = async () => {
      setBillingCatalogLoading(true);
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiUrl}/clinic-records/billing-catalog`, {
          headers: { Authorization: 'Bearer ' + user.token },
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => []);
        if (!response.ok || !Array.isArray(payload)) throw new Error(payload.error || 'Unable to load clinic service prices.');
        setBillingCatalog(payload);
      } catch (catalogError) {
        if (catalogError.name !== 'AbortError') {
          setBillingCatalog([]);
          setTransferNotice(catalogError.message || 'Unable to load clinic service prices.');
          window.setTimeout(() => setTransferNotice(''), 5000);
        }
      } finally {
        if (!controller.signal.aborted) setBillingCatalogLoading(false);
      }
    };
    loadCatalog();
    return () => controller.abort();
  }, [consultationAppointment, user?.token]);

  useEffect(() => {
    if (!user?.token) return;
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const headers = { Authorization: `Bearer ${user.token}` };
    const clinicQuery = user.clinic_id ? `?clinic_id=${encodeURIComponent(user.clinic_id)}` : '';
    Promise.all([
      fetch(`${apiUrl}/clinic-records/appointments`, { headers }),
      fetch(`${apiUrl}/clinic-records/vaccinations`, { headers }),
      fetch(`${apiUrl}/clinic-records/treatments`, { headers }),
      fetch(`${apiUrl}/users`, { headers }),
      fetch(`${apiUrl}/clinic-records/inpatient-stays${clinicQuery}`, { headers }),
      fetch(`${apiUrl}/clinic-records/treatment-plans${clinicQuery}`, { headers }),
    ]).then(async responses => {
      if (responses.some(response => !response.ok)) throw new Error('Unable to load your schedule.');
      return Promise.all(responses.map(response => response.json()));
    }).then(([appointmentRows, vaccinationRows, treatmentRows, userRows, inpatientRows, planRows]) => {
      const rows = [appointmentRows, vaccinationRows, treatmentRows].map(row => Array.isArray(row) ? row : []);
      setClinicDoctors(Array.isArray(userRows) ? userRows : []);
      setInpatientStays(Array.isArray(inpatientRows) ? inpatientRows : []);
      setTreatmentPlans(Array.isArray(planRows) ? planRows : []);
      const hasRecords = rows.some(row => row.length > 0);
      if (!hasRecords) {
        const demoData = getDemoScheduleData(user.name || 'Doctor');
        const storageKey = `vetintel:demo-schedule:${user.clinic_id || user.id || 'default'}`;
        let savedAppointments = [];
        try {
          const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
          if (Array.isArray(saved)) savedAppointments = saved.filter(isDemoAppointment);
        } catch (storageError) {
          console.warn('Unable to restore the demo schedule from this browser', storageError);
        }
        const appointmentsById = new Map(demoData.appointments.map(item => [String(item.id), item]));
        savedAppointments.forEach(item => appointmentsById.set(String(item.id), item));
        setIsDemoSchedule(true);
        setAppointments([...appointmentsById.values()]);
        setVaccinations(demoData.vaccinations);
        setTreatments(demoData.treatments);
        return;
      }
      setIsDemoSchedule(false);
      setAppointments(rows[0]);
      setVaccinations(rows[1]);
      setTreatments(rows[2]);
    }).catch(loadError => {
      console.error('Failed to load doctor schedule', loadError);
      setError(loadError.message);
    }).finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!isDemoSchedule || !appointments.some(isDemoAppointment)) return;
    const storageKey = `vetintel:demo-schedule:${user?.clinic_id || user?.id || 'default'}`;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(appointments.filter(isDemoAppointment)));
    } catch (storageError) {
      console.error('Unable to persist the demo schedule in this browser', storageError);
      setTransferNotice('Unable to save demo schedule changes in this browser.');
      window.setTimeout(() => setTransferNotice(''), 5000);
    }
  }, [appointments, isDemoSchedule, user?.clinic_id, user?.id]);

  useEffect(() => {
    if (!user?.token) return undefined;

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const headers = { Authorization: `Bearer ${user.token}` };

    const refreshAppointments = async () => {
      try {
        const response = await fetch(`${apiUrl}/clinic-records/appointments`, { headers });
        if (!response.ok) throw new Error('Unable to refresh appointments.');
        const rows = await response.json();
        if (!Array.isArray(rows)) return;

        setAppointments(current => current.map(appointment => {
          const refreshed = rows.find(row => row.id === appointment.id);
          return refreshed ? { ...appointment, ...refreshed } : appointment;
        }));
        setSelectedAppointment(current => {
          if (!current) return current;
          const refreshed = rows.find(row => row.id === current.id);
          return refreshed ? { ...current, ...refreshed } : current;
        });
      } catch (refreshError) {
        console.error('Failed to refresh appointment statuses', refreshError);
      }
    };

    const handleAppointmentUpdate = () => {
      refreshAppointments();
    };
    window.addEventListener('vetintel:appointment-updated', handleAppointmentUpdate);
    const refreshTimer = window.setInterval(refreshAppointments, 5000);

    return () => {
      window.removeEventListener('vetintel:appointment-updated', handleAppointmentUpdate);
      window.clearInterval(refreshTimer);
    };
  }, [user]);

  const myAppointments = useMemo(() => appointments.filter(item => {
    if (!item.practitioner || !user?.name) return true;
    return item.practitioner.toLowerCase() === user.name.toLowerCase();
  }), [appointments, user]);
  const recentClinicalActivities = useMemo(() => [
    ...vaccinations.map(item => ({ ...item, activity: 'Vaccination', detail: item.vaccine_name, activityDate: item.date_given })),
    ...treatments.map(item => ({ ...item, activity: 'Treatment', detail: item.medication, activityDate: item.issued_at })),
  ].sort((left, right) => (Date.parse(right.activityDate || '') || 0) - (Date.parse(left.activityDate || '') || 0)).slice(0, 6), [vaccinations, treatments]);
  const todayAppointments = myAppointments.filter(item => {
    const date = new Date(item.start_time);
    return date.toDateString() === today.toDateString();
  });
  const countableTodayAppointments = todayAppointments.filter(item =>
    ['confirmed', 'scheduled', 'pending'].includes(normalizeAppointmentStatus(item.status))
  );
  const vaccinationsGivenThisMonth = vaccinations.filter(item =>
    !item.archived
    && normalizeAppointmentStatus(item.status) !== 'scheduled'
    && isDateInCurrentMonth(item.date_given || item.dateGiven || item.date, today)
  );
  // The clinic's treatment endpoint contains prescription records, dated by
  // issued_at. Use that recorded date and describe the metric accordingly.
  const treatmentsIssuedThisMonth = treatments.filter(item =>
    !item.archived
    && !['cancelled', 'canceled', 'void', 'archived'].includes(normalizeAppointmentStatus(item.status))
    && isDateInCurrentMonth(item.issued_at || item.issuedAt, today)
  );
  const admittedInpatients = inpatientStays.filter(item =>
    !item.archived && normalizeAppointmentStatus(item.status) === 'active'
  );
  const activeTreatmentPlans = treatmentPlans.filter(item =>
    !item.archived && ['active', 'paused', 'in_progress', 'ongoing'].includes(normalizeAppointmentStatus(item.status || 'active'))
  );
  const activePatientCount = new Set([
    ...admittedInpatients.map(item => item.pet_id || item.pet).filter(Boolean).map(String),
    ...activeTreatmentPlans.map(item => item.pet_id || item.pet).filter(Boolean).map(String),
  ]).size;
  // Keep the patient list populated from the practitioner's appointment
  // records; those records do not necessarily carry an inpatient status or
  // ward assignment. Never invent a status, ward, or cage for display.
  const patients = [...new Map(myAppointments.filter(item => item.pet).map(item => [item.pet, item])).values()].slice(0, 3);
  const scheduleTabs = [
    { id: 'today', label: "Today's Appointments", records: todayAppointments.filter(item => ['confirmed', 'scheduled'].includes(normalizeAppointmentStatus(item.status))) },
    { id: 'pending', label: 'Pending', records: myAppointments.filter(item => normalizeAppointmentStatus(item.status) === 'pending') },
    { id: 'checked_in', label: 'Checked In', records: myAppointments.filter(item => String(item.status || '').toLowerCase() === 'checked_in') },
    { id: 'rescheduled', label: 'Rescheduled', records: myAppointments.filter(item => String(item.status || '').toLowerCase().includes('resched')) },
    { id: 'cancelled', label: 'Cancelled', records: myAppointments.filter(item => String(item.status || '').toLowerCase().includes('cancel')) },
    { id: 'no_show', label: 'No-show', records: myAppointments.filter(item => String(item.status || '').toLowerCase().replace(/[-\s]+/g, '_').includes('no_show')) },
    { id: 'in_consultation', label: 'In Consultation', records: myAppointments.filter(item => String(item.status || '').toLowerCase().replace(/[-\s]+/g, '_').includes('in_consultation')) },
    { id: 'completed', label: 'Completed', records: myAppointments.filter(item => String(item.status || '').toLowerCase() === 'completed') },
  ];
  const activeScheduleTab = scheduleTabs.find(tab => tab.id === scheduleTab) || scheduleTabs[0];
  const selectedCalendarAppointments = myAppointments.filter(item => new Date(item.start_time).toDateString() === selectedCalendarDate.toDateString());
  const receivingDoctors = clinicDoctors
    .filter(item => item.is_active !== false)
    .filter(item => ['doctor', 'assistant_doctor', 'veterinarian'].includes(String(item.role || item.role_name || '').toLowerCase().replace(/[-\s]+/g, '_')))
    .filter(item => {
      const availability = String(item.availability || item.duty_status || item.status || '').toLowerCase().replace(/[-\s]+/g, '_');
      return !availability || ['available', 'on_duty', 'on'].includes(availability);
    })
    .filter(item => String(item.name || '').trim().toLowerCase() !== String(user?.name || '').trim().toLowerCase());
  const updateTransferField = (field, value) => {
    setTransferForm(current => ({ ...current, [field]: value }));
    if (transferSubmitted) setTransferErrors(validateTransferForm({ ...transferForm, [field]: value }));
  };
  const validateTransferForm = form => {
    const nextErrors = {};
    if (!form.patient) nextErrors.patient = 'Select the patient whose care is being transferred.';
    if (!form.doctor) nextErrors.doctor = 'Select a receiving doctor.';
    if (!isMeaningfulText(form.reason)) nextErrors.reason = 'Enter a clear reason with at least two meaningful words.';
    if (form.notes.trim() && !isMeaningfulText(form.notes)) nextErrors.notes = 'Enter meaningful handoff notes or leave this field empty.';
    return nextErrors;
  };
  const closeTransferModal = () => {
    setShowTransferModal(false);
    setSelectedAppointment(current => current || transferAppointment);
    setTransferAppointment(null);
    setTransferForm(initialTransferForm);
    setTransferErrors({});
    setTransferSubmitted(false);
  };
  const openPatientRecord = appointment => {
    setRecordAppointment(appointment);
  };
  const updateAppointmentStatus = (appointment, status) => {
    const updated = { ...appointment, status };
    setAppointments(current => current.map(item => item.id === appointment.id ? updated : item));
    setSelectedAppointment(updated);
    window.dispatchEvent(new CustomEvent('vetintel:appointment-updated', { detail: updated }));
    return updated;
  };
  const openAppointmentWorkflow = (action, appointment) => {
    const start = appointment.start_time ? new Date(appointment.start_time) : null;
    const defaultDate = action === 'follow_up' || !start
      ? new Date(Date.now() + 24 * 60 * 60 * 1000)
      : new Date(start.getTime());
    if (action === 'follow_up') defaultDate.setHours(10, 0, 0, 0);
    setAppointmentWorkflow({
      action,
      appointment,
      visitType: action === 'follow_up' ? 'Follow-up' : appointment.workflow_type === 'follow_up' ? 'Follow-up' : appointment.reason || 'Follow-up',
      date: toDateInputValue(defaultDate),
      time: action === 'follow_up' ? '10:00' : toTimeInputValue(start),
      reason: action === 'follow_up' ? 'Follow-up after visit' : '',
      error: '',
      saving: false,
    });
  };
  const submitAppointmentWorkflow = async event => {
    event.preventDefault();
    if (!appointmentWorkflow || appointmentWorkflow.saving) return;
    const { action, appointment, date, time, reason, visitType } = appointmentWorkflow;
    if (!date || !time || (action !== 'reschedule' && !reason.trim()) || !visitType.trim()) {
      setAppointmentWorkflow(current => ({ ...current, error: 'Enter the appointment type, date, time, and required reason.' }));
      return;
    }
    const startsAt = new Date(`${date}T${time}`);
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      setAppointmentWorkflow(current => ({ ...current, error: 'Choose a future date and time.' }));
      return;
    }
    setAppointmentWorkflow(current => ({ ...current, saving: true, error: '' }));
    try {
      if (isDemoAppointment(appointment)) {
        const replacement = {
          ...appointment,
          id: `demo-appointment-${Date.now()}`,
          status: 'scheduled',
          start_time: startsAt.toISOString(),
          end_time: new Date(startsAt.getTime() + Math.max(
            new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime(),
            30 * 60 * 1000,
          )).toISOString(),
          reason: visitType.trim(),
          notes: '',
          parent_appointment_id: appointment.id,
          workflow_type: action,
          workflow_reason: reason.trim() || 'Rescheduled by clinic staff.',
          original_start_time: appointment.start_time,
        };
        const updatedParent = {
          ...appointment,
          ...(action === 'reschedule' ? { status: 'rescheduled', workflow_type: 'rescheduled', workflow_reason: reason.trim() || 'Rescheduled by clinic staff.' } : {}),
          related_appointment_id: replacement.id,
          related_start_time: replacement.start_time,
          related_end_time: replacement.end_time,
          related_status: replacement.status,
        };
        setAppointments(current => [
          replacement,
          ...current.map(item => String(item.id) === String(appointment.id) ? updatedParent : item),
        ]);
        setSelectedAppointment(replacement);
        setAppointmentWorkflow(null);
        const successMessage = action === 'follow_up'
          ? 'Demo follow-up added to this schedule. It is not saved to the clinic database.'
          : action === 'rebook'
            ? 'Demo appointment rebooked on this schedule. It is not saved to the clinic database.'
            : 'Demo appointment rescheduled on this schedule. It is not saved to the clinic database.';
        setTransferNotice(successMessage);
        window.setTimeout(() => setTransferNotice(''), 5000);
        return;
      }
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/clinic-records/appointments/${appointment.id}/related?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, start_time: startsAt.toISOString(), reason: reason.trim(), visit_type: visitType.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to save the appointment.');
      if (!payload.appointment?.id) throw new Error('The server did not return the new appointment.');
      const replacement = payload.appointment;
      const updatedParent = {
        ...appointment,
        ...payload.parent,
        ...(action === 'reschedule' ? { workflow_type: 'rescheduled', workflow_reason: reason.trim() } : {}),
        related_appointment_id: replacement.id,
        related_start_time: replacement.start_time,
        related_end_time: replacement.end_time,
        related_status: replacement.status,
      };
      setAppointments(current => [
        replacement,
        ...current.map(item => String(item.id) === String(appointment.id) ? updatedParent : item),
      ]);
      setSelectedAppointment(replacement);
      setAppointmentWorkflow(null);
      const successMessage = action === 'follow_up'
        ? 'Follow-up appointment scheduled.'
        : action === 'rebook'
          ? 'Appointment rebooked.'
          : 'Appointment rescheduled.';
      setTransferNotice(successMessage);
      window.setTimeout(() => setTransferNotice(''), 5000);
      window.dispatchEvent(new CustomEvent('vetintel:appointment-updated', { detail: replacement }));
    } catch (workflowError) {
      setAppointmentWorkflow(current => ({ ...current, saving: false, error: workflowError.message || 'Unable to save the appointment.' }));
    }
  };
  const startConsultation = async appointment => {
    const normalized = String(appointment.status || '').toLowerCase().replace(/[-\s]+/g, '_');
    if (normalized !== 'checked_in') return;
    if (!window.confirm(`Start consultation for ${appointment.pet || 'this patient'}?`)) return;
    if (!isDemoAppointment(appointment)) {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      try {
        const response = await fetch(`${apiUrl}/clinic-records/appointments/${appointment.id}/start-consultation?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Unable to start the consultation.');
      } catch (startError) {
        setTransferNotice(startError.message);
        window.setTimeout(() => setTransferNotice(''), 5000);
        return;
      }
    }
    const updated = updateAppointmentStatus(appointment, 'in_consultation');
    setSelectedAppointment(null);
    setConsultationAppointment(updated);
    let savedDraft = {};
    try {
      savedDraft = JSON.parse(window.localStorage.getItem(`vetintel:consultation-draft:${updated.id}`) || '{}').form || {};
    } catch (draftError) {
      console.warn('Unable to restore consultation draft', draftError);
    }
    setConsultationForm(createConsultationForm(updated, savedDraft));
    setConsultationStep(0);
    setTransferNotice(`Dr. ${user?.name || 'Doctor'} has started consultation for ${updated.pet || 'the patient'}.`);
    window.setTimeout(() => setTransferNotice(''), 5000);
  };
  const openActiveConsultation = async appointment => {
    if (isDemoAppointment(appointment)) {
      let savedNotes = {};
      try {
        savedNotes = JSON.parse(window.localStorage.getItem(`vetintel:consultation-draft:${appointment.id}`) || '{}').form || {};
      } catch (draftError) {
        console.warn('Unable to restore demo consultation draft', draftError);
      }
      setConsultationForm(createConsultationForm(appointment, savedNotes));
      setConsultationStep(0);
      setSelectedAppointment(null);
      setConsultationAppointment(appointment);
      return;
    }
    const apiUrl = import.meta.env.VITE_API_URL || '';
    try {
      const response = await fetch(`${apiUrl}/clinic-records/appointments/${appointment.id}/consultation?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to open the active consultation.');
      const savedNotes = typeof payload.notes === 'string' ? JSON.parse(payload.notes || '{}') : payload.notes || {};
      setConsultationForm(createConsultationForm(appointment, savedNotes));
      setConsultationStep(0);
      setSelectedAppointment(null);
      setConsultationAppointment(appointment);
    } catch (consultationError) {
      setTransferNotice(consultationError.message || 'Unable to open the active consultation.');
      window.setTimeout(() => setTransferNotice(''), 5000);
    }
  };
  const updateConsultationField = (field, value) => setConsultationForm(current => ({ ...current, [field]: value }));
  const saveConsultationDraft = async complete => {
    if (complete) {
      const missing = ['diagnosis', 'clinicalFindings', 'outcome'].filter(field => !String(consultationForm[field] || '').trim());
      if (missing.length) {
        setTransferNotice('Complete the diagnosis, clinical findings, and outcome before finishing.');
        window.setTimeout(() => setTransferNotice(''), 5000);
        return;
      }
      setShowCompletionReview(true);
      return;
    }
    if (isDemoAppointment(consultationAppointment)) {
      try {
        window.localStorage.setItem(
          `vetintel:consultation-draft:${consultationAppointment.id}`,
          JSON.stringify({ form: consultationForm }),
        );
      } catch (draftError) {
        console.error('Unable to save demo consultation draft', draftError);
        setTransferNotice('Unable to save the demo consultation draft in this browser.');
        window.setTimeout(() => setTransferNotice(''), 5000);
        return;
      }
      window.dispatchEvent(new CustomEvent('vetintel:consultation-draft-saved', { detail: consultationAppointment }));
      setTransferNotice('Demo consultation draft saved in this browser only; it is not in the clinic database.');
      window.setTimeout(() => setTransferNotice(''), 5000);
      return;
    }
    const apiUrl = import.meta.env.VITE_API_URL || '';
    try {
      const response = await fetch(`${apiUrl}/clinic-records/appointments/${consultationAppointment.id}/consultation?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: consultationForm, owner_visible: Boolean(consultationForm.ownerSummary) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to save the consultation draft.');
    } catch (saveError) {
      setTransferNotice(saveError.message);
      window.setTimeout(() => setTransferNotice(''), 5000);
      return;
    }
    window.dispatchEvent(new CustomEvent('vetintel:consultation-draft-saved', { detail: consultationAppointment }));
    setTransferNotice('Consultation draft saved for authorized clinic users.');
    window.setTimeout(() => setTransferNotice(''), 5000);
  };
  const completeConsultation = async () => {
    if (consultationCompleting) return;
    setConsultationCompleting(true);
    let issuedInvoice = null;
    if (isDemoAppointment(consultationAppointment)) {
      try {
        window.localStorage.setItem(
          `vetintel:consultation-draft:${consultationAppointment.id}`,
          JSON.stringify({ form: consultationForm }),
        );
      } catch (draftError) {
        console.error('Unable to save completed demo consultation', draftError);
        setTransferNotice('Unable to save the demo consultation in this browser.');
        window.setTimeout(() => setTransferNotice(''), 5000);
        setConsultationCompleting(false);
        return;
      }
    } else {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      try {
        const saveResponse = await fetch(`${apiUrl}/clinic-records/appointments/${consultationAppointment.id}/consultation?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
          method: 'PUT',
          headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: consultationForm, owner_visible: Boolean(consultationForm.ownerSummary) }),
        });
        const savePayload = await saveResponse.json().catch(() => ({}));
        if (!saveResponse.ok) throw new Error(savePayload.error || 'Unable to save the consultation.');
        const response = await fetch(`${apiUrl}/clinic-records/appointments/${consultationAppointment.id}/complete-consultation?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Consultation completed.' }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Unable to complete the consultation.');
        issuedInvoice = payload.invoice || null;
      } catch (completeError) {
        setTransferNotice(completeError.message);
        window.setTimeout(() => setTransferNotice(''), 5000);
        setConsultationCompleting(false);
        return;
      }
    }
    const updated = updateAppointmentStatus(consultationAppointment, 'completed');
    setConsultationAppointment(null);
    setShowCompletionReview(false);
    setSelectedAppointment(null);
    setConsultationCompleting(false);
    setTransferNotice(isDemoAppointment(updated)
      ? `Demo consultation for ${updated.pet || 'the patient'} completed on this schedule only; it is not saved to the clinic database.`
      : `Consultation for ${updated.pet || 'the patient'} was completed by Dr. ${user?.name || 'Doctor'}.${issuedInvoice ? ` Invoice #${issuedInvoice.id} was issued for ₱${Number(issuedInvoice.total).toFixed(2)} and is available in Billing & Payments.` : ' No billable items were selected, so no invoice was issued.'}`);
    window.setTimeout(() => setTransferNotice(''), 5000);
  };
  const openTransferForAppointment = appointment => {
    setTransferAppointment(appointment);
    setTransferForm(current => ({ ...initialTransferForm, patient: appointment.pet || '' }));
    setTransferErrors({});
    setTransferSubmitted(false);
    setShowTransferModal(true);
  };
  const openHandoffForPatient = patient => {
    setTransferForm(current => ({ ...initialTransferForm, patient: patient.pet || '' }));
    setTransferErrors({});
    setTransferSubmitted(false);
    setShowTransferModal(true);
  };
  const submitTransfer = async event => {
    event.preventDefault();
    const nextErrors = validateTransferForm(transferForm);
    setTransferErrors(nextErrors);
    setTransferSubmitted(true);
    if (Object.keys(nextErrors).length > 0) return;
    if (transferAppointment) {
      const receivingDoctor = clinicDoctors.find(item => String(item.name || '').trim() === String(transferForm.doctor || '').trim());
      if (!receivingDoctor?.id) {
        setTransferNotice('The receiving doctor could not be found. Refresh the page and try again.');
        window.setTimeout(() => setTransferNotice(''), 5000);
        return;
      }
      const apiUrl = import.meta.env.VITE_API_URL || '';
      try {
        const response = await fetch(`${apiUrl}/clinic-records/appointments/${transferAppointment.id}/transfer?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to_doctor_id: receivingDoctor.id,
            reason: transferForm.reason,
            urgency: transferForm.urgency,
            notes: transferForm.notes,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Unable to transfer the appointment.');
      } catch (transferError) {
        setTransferNotice(transferError.message);
        window.setTimeout(() => setTransferNotice(''), 5000);
        return;
      }
      const updated = { ...transferAppointment, practitioner: transferForm.doctor, transferred_from: user?.name || 'Doctor', transfer_reason: transferForm.reason, handoff_notes: transferForm.notes };
      setAppointments(current => current.map(item => item.id === updated.id ? updated : item));
      window.dispatchEvent(new CustomEvent('vetintel:appointment-transferred', { detail: updated }));
    }
    setTransferNotice(`Patient care for ${transferForm.patient} transferred to ${transferForm.doctor}. Receptionist has been notified.`);
    closeTransferModal();
    setSelectedAppointment(null);
    window.setTimeout(() => setTransferNotice(''), 5000);
  };
  const moveCalendarWeek = offset => {
    setCalendarDate(current => {
      const next = new Date(current);
      next.setDate(next.getDate() + offset * 7);
      return next;
    });
  };
  const resetCalendarToToday = () => {
    setCalendarDate(new Date());
    setSelectedCalendarDate(new Date());
  };
  const calendarWeekStart = new Date(calendarDate);
  calendarWeekStart.setDate(calendarDate.getDate() - calendarDate.getDay());

  return <div style={styles.main}>
    <Topbar user={user} title="My Schedule" subtitle="Your appointments, patients, clinical activity, and patient handoff tools" />
    <div style={styles.page}>
      {isDemoSchedule && <div role="status" style={{ marginBottom: 14, padding: '11px 14px', border: '1px solid #b7e4d7', borderRadius: 9, background: '#e7f5f2', color: '#005447', fontSize: '.8rem' }}>Demo schedule: changes are stored in this browser only and are not saved to clinic records.</div>}
      <section style={styles.hero}>
        <div style={styles.avatar}>{(user?.initials || user?.name || 'DR').slice(0, 2).toUpperCase()}</div>
        <div>
          <h1 style={styles.heroTitle}>{user?.name || 'Doctor'}</h1>
          <div style={styles.heroSub}>{user?.role || 'Doctor'} · {user?.clinic_name || 'Clinic'}</div>
          <div style={styles.heroMeta}><span><i style={styles.heroMetaIcon}>{Icons.calendar}</i>{countableTodayAppointments.length} appointments today</span><span><i style={styles.heroMetaIcon}>{Icons.bed}</i>{admittedInpatients.length} inpatient</span><span><i style={styles.heroMetaIcon}>{Icons.clipboard}</i>{activeTreatmentPlans.length} active plans</span></div>
        </div>
      </section>

      <div style={styles.stats}>
        {[
          [Icons.calendar, '#e7f5f2', "Today's Appointments", countableTodayAppointments.length, 'Confirmed and pending'],
          [Icons.syringe, '#d9efea', 'Vaccinations Given', vaccinationsGivenThisMonth.length, 'Given this month'],
          [Icons.stethoscope, '#cce8e1', 'Treatments Prescribed', treatmentsIssuedThisMonth.length, 'Issued this month'],
          [Icons.activity, '#bde0d7', 'Active Patients', activePatientCount, 'Inpatient + active treatment plans'],
        ].map(([icon, background, label, value, sub]) => <div style={styles.stat} key={label}>
          <span style={{ ...styles.statIcon, background }}>{cloneElement(icon, { width: 17, height: 17 })}</span>
          <div><div style={styles.statLabel}>{label}</div><strong style={styles.statValue}>{value}</strong><small style={styles.statSub}>{sub}</small></div>
        </div>)}
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {loading ? <div style={styles.loading}>Loading your schedule…</div> : <div style={styles.grid}>
        <section style={styles.card}><div style={styles.calendarHeader}><h3 style={styles.heading}>Weekly Calendar</h3><div style={styles.calendarControls}><button type="button" style={styles.iconButton} onClick={() => moveCalendarWeek(-1)} aria-label="Previous week">‹</button><button type="button" style={styles.todayButton} onClick={resetCalendarToToday}>Today</button><button type="button" style={styles.iconButton} onClick={() => moveCalendarWeek(1)} aria-label="Next week">›</button></div></div><div style={styles.week}>
          {Array.from({ length: 7 }, (_, index) => {
            const date = new Date(calendarWeekStart); date.setDate(calendarWeekStart.getDate() + index);
            const count = myAppointments.filter(item => new Date(item.start_time).toDateString() === date.toDateString()).length;
            const isSelectedDay = date.toDateString() === today.toDateString();
            const isSelectedCalendarDay = date.toDateString() === selectedCalendarDate.toDateString();
            return <button type="button" className={`schedule-list-item schedule-calendar-day${isSelectedCalendarDay ? ' schedule-calendar-day-selected' : ''}`} key={date.toISOString()} onClick={() => setSelectedCalendarDate(new Date(date))} style={{ ...styles.day, ...(isSelectedCalendarDay ? styles.selectedDay : {}) }} aria-label={`${count} patients on ${formatLongDate(date)}`}><small>{date.toLocaleDateString([], { weekday: 'short' })}</small><strong>{date.getDate()}</strong>{count > 0 && <em style={styles.appointmentCount}>{count}</em>}</button>;
          })}
        </div><div style={styles.listTitle}>{selectedCalendarDate.toDateString() === today.toDateString() ? `TODAY — ${formatLongDate(selectedCalendarDate)}` : selectedCalendarDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()} — {selectedCalendarAppointments.length} APPOINTMENTS</div><div style={styles.calendarList}>{selectedCalendarAppointments.map(item => <div className="schedule-list-item" style={styles.miniRow} key={item.id}><span style={{ ...styles.dot, background: statusColor(item.status) }} /><div style={styles.miniDetails}><strong style={styles.miniPatient}>{item.pet || 'Patient'}</strong><small style={styles.miniAppointmentDetails}>{formatTime(item.start_time)} · {item.reason || 'Appointment'}</small></div></div>)}</div></section>

        <section style={styles.card}><div style={styles.cardHeader}><h3 style={styles.heading}>Today's Schedule</h3><span style={styles.date}>{today.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span></div><div style={styles.scheduleTabs}>{scheduleTabs.map(tab => <button type="button" key={tab.id} onClick={() => setScheduleTab(tab.id)} style={{ ...styles.scheduleTab, ...(scheduleTab === tab.id ? styles.scheduleTabActive : {}) }}>{tab.label}{tab.records.length > 0 && <span style={styles.scheduleTabCount}>{tab.records.length}</span>}</button>)}</div><div style={styles.scheduleList}>{activeScheduleTab.records.map(item => <button type="button" className="schedule-list-item" style={{ ...styles.appointment, ...styles.appointmentButton }} key={item.id} onClick={() => setSelectedAppointment(item)}><div style={styles.time}>{formatTime(item.start_time)}</div><span style={{ ...styles.timelineDot, borderColor: statusColor(item.status) }} /><div style={styles.appointmentBody}><strong style={styles.appointmentPatient}>{item.pet || 'Patient'}</strong><small style={styles.appointmentOwner}>{item.owner || '—'} · {item.reason || 'Appointment'}</small><StatusIndicator status={item.status || 'confirmed'} /></div></button>)}{!activeScheduleTab.records.length && <div style={styles.emptySchedule}>No {activeScheduleTab.label.toLowerCase()} appointments.</div>}</div></section>

        <section style={styles.card}><h3 style={styles.heading}>My Active Patients</h3>{patients.map(item => <div className="schedule-list-item" style={styles.patient} key={item.pet}><div style={styles.patientDetails}><div style={styles.patientTitle}><strong style={styles.patientName}>{item.pet}</strong><StatusIndicator status={item.status || 'Active'} /></div><small style={styles.patientSubtext}>Owner: {item.owner || '—'}</small></div><button type="button" style={styles.handoff} onClick={() => openHandoffForPatient(item)}><span style={styles.buttonIcon}>{Icons.transfer}</span> Handoff</button></div>)}{!patients.length && <div style={styles.emptySchedule}>No active patients are recorded.</div>}</section>
        <section style={styles.card}>
          <h3 style={styles.heading}>Recent Clinical Activity</h3>
          {(showAllRecentActivities ? recentClinicalActivities : recentClinicalActivities.slice(0, 3)).map(item => (
            <article
              className="schedule-list-item"
              style={{
                marginBottom: 10,
                padding: '12px 13px',
                border: '1px solid #e2e8f0',
                borderLeft: '3px solid #e2e8f0',
                borderRadius: 9,
                background: '#fff',
              }}
              key={`${item.id}-${item.activity}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#475569', fontSize: '.8rem' }}>
                <strong style={{ color: '#1f2937', fontSize: '.88rem' }}>{item.pet || 'Patient'}</strong>
                <Badge tone={{ color: '#08783e', background: '#e7f5ec', border: '1px solid #b7e4d7' }}>{item.activity}</Badge>
              </div>
              <div style={{ height: 1, margin: '10px 0', background: '#dbe4e0' }} />
              <strong style={{ display: 'block', color: '#005447', fontSize: '.88rem' }}>{item.detail || 'Clinical record'}</strong>
              <small style={{ display: 'block', marginTop: 7, color: '#475569', fontSize: '.78rem' }}>{formatActivityDate(item.activityDate)}</small>
              <small style={{ display: 'block', marginTop: 5, color: '#475569', fontSize: '.78rem' }}>Owner: {item.owner || item.pet_owner || '—'}</small>
            </article>
          ))}
          {!recentClinicalActivities.length && <div style={styles.emptySchedule}>No recent clinical activity.</div>}
          {recentClinicalActivities.length > 3 && <button
            type="button"
            aria-expanded={showAllRecentActivities}
            onClick={() => setShowAllRecentActivities(expanded => !expanded)}
            style={{ display: 'block', width: '100%', border: 0, padding: '8px 0 0', background: 'transparent', color: '#005447', font: 'inherit', fontSize: '.78rem', fontWeight: 700, textAlign: 'center', cursor: 'pointer' }}
          >
            {showAllRecentActivities ? 'Show less' : `Show all ${recentClinicalActivities.length} activities`}
          </button>}
        </section>
      </div>}
    </div>
    {transferNotice && <div style={styles.transferToast} role="status"><span style={styles.toastIcon}>{Icons.check}</span><span>{transferNotice}</span></div>}
    {selectedAppointment && (() => {
      const status = normalizeAppointmentStatus(selectedAppointment.status);
      const appointmentId = `APT-${String(selectedAppointment.id || '').replace(/\D/g, '').slice(-3).padStart(3, '0')}`;
      const type = selectedAppointment.appointment_type || selectedAppointment.type || selectedAppointment.service || selectedAppointment.reason || 'Appointment';
      const dateTime = new Date(selectedAppointment.start_time);
      const formattedDate = Number.isNaN(dateTime.getTime())
        ? 'Date not set'
        : dateTime.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
      const details = status === 'completed'
        ? [['Outcome', selectedAppointment.outcome], ['Seen by', selectedAppointment.practitioner || selectedAppointment.completed_by]]
        : status === 'in_consultation'
          ? [['In progress', [selectedAppointment.started_at && `Started ${formatTime(selectedAppointment.started_at)}`, selectedAppointment.practitioner && `by ${selectedAppointment.practitioner}`, selectedAppointment.checked_in_at && `checked in ${formatTime(selectedAppointment.checked_in_at)}`].filter(Boolean).join(' · ')]]
          : status === 'checked_in'
            ? [['Checked in', selectedAppointment.checked_in_at ? `${formatTime(selectedAppointment.checked_in_at)}${selectedAppointment.checked_in_by ? ` by ${selectedAppointment.checked_in_by}` : ''}` : 'Reception checked in the patient']]
            : status === 'rescheduled'
              ? [['New date & time', selectedAppointment.rescheduled_start_time ? `${formatActivityDate(selectedAppointment.rescheduled_start_time)}, ${formatTime(selectedAppointment.rescheduled_start_time)}` : selectedAppointment.new_date_time], ['Reason', selectedAppointment.reschedule_reason]]
              : status === 'cancelled'
                ? [['Cancellation reason', selectedAppointment.cancellation_reason || selectedAppointment.cancel_reason]]
                : status === 'no_show'
                  ? []
                  : [];
      if (selectedAppointment.parent_appointment_id && selectedAppointment.workflow_type) {
        details.push([
          selectedAppointment.workflow_type === 'follow_up' ? 'Scheduled from' : selectedAppointment.workflow_type === 'rebook' ? 'Rebooked from' : 'Rescheduled from',
          selectedAppointment.original_start_time
            ? `${formatActivityDate(selectedAppointment.original_start_time)}, ${formatTime(selectedAppointment.original_start_time)}`
            : `Appointment ${selectedAppointment.parent_appointment_id}`,
        ]);
        if (selectedAppointment.workflow_reason) {
          details.push(['Reason for appointment', selectedAppointment.workflow_reason]);
        }
      }
      if (selectedAppointment.related_appointment_id && status === 'rescheduled') {
        details.push([
          'New appointment',
          `${formatActivityDate(selectedAppointment.related_start_time)}, ${formatTime(selectedAppointment.related_start_time)} · ${String(selectedAppointment.related_status || 'scheduled').replace(/_/g, ' ')}`,
        ]);
      }
      if (selectedAppointment.related_appointment_id && status === 'completed') {
        details.push([
          'Follow-up appointment',
          `${formatActivityDate(selectedAppointment.related_start_time)}, ${formatTime(selectedAppointment.related_start_time)} · ${String(selectedAppointment.related_status || 'scheduled').replace(/_/g, ' ')}`,
        ]);
      }
      if (selectedAppointment.related_appointment_id && status === 'cancelled') {
        details.push([
          'Rebooked appointment',
          `${formatActivityDate(selectedAppointment.related_start_time)}, ${formatTime(selectedAppointment.related_start_time)}`,
        ]);
      }
      const detailPanel = (label, value) => value && <div style={styles.appointmentInfoPanel} key={label}><span style={styles.detailLabel}>{label}</span><p style={styles.notesText}>{value}</p></div>;
      const secondaryButton = (label, onClick, variant = 'outline') => <button type="button" key={label} style={{ ...styles.appointmentSecondaryAction, ...(variant === 'danger' ? styles.appointmentDangerAction : {}) }} onClick={onClick}>{label}</button>;
      const openRecord = () => openPatientRecord(selectedAppointment);
      const transfer = () => openTransferForAppointment(selectedAppointment);
      const primaryButton = (label, onClick, disabled = false) => <button type="button" disabled={disabled} style={{ ...styles.appointmentPrimaryAction, ...(disabled ? styles.appointmentPrimaryDisabled : {}) }} onClick={onClick}>{label}</button>;
      const openRelatedAppointment = () => {
        const relatedAppointment = appointments.find(item => String(item.id) === String(selectedAppointment.related_appointment_id));
        if (!relatedAppointment) {
          setTransferNotice('The linked appointment could not be found. Refresh the schedule and try again.');
          window.setTimeout(() => setTransferNotice(''), 5000);
          return;
        }
        setSelectedAppointment(relatedAppointment);
      };
      let actions;
      if (status === 'confirmed') {
        actions = <>{primaryButton('Check In Patient', () => setTransferNotice('Patient check-in is completed by reception.'))}<div style={styles.appointmentActionRow}>{secondaryButton('View Record', openRecord)}{secondaryButton('Transfer', transfer)}</div>{primaryButton('Start Consultation', () => startConsultation(selectedAppointment), true)}</>;
      } else if (status === 'pending') {
        actions = <>{primaryButton('Confirm Appointment', () => setTransferNotice('Appointment confirmation is handled by reception.'))}<div style={styles.appointmentActionRow}>{secondaryButton('Reschedule', () => openAppointmentWorkflow('reschedule', selectedAppointment))}{secondaryButton('Cancel', () => setTransferNotice('Please contact reception to cancel this appointment.'), 'danger')}</div></>;
      } else if (status === 'scheduled') {
        actions = <>{primaryButton('Reschedule Appointment', () => openAppointmentWorkflow('reschedule', selectedAppointment))}{secondaryButton('View Record', openRecord)}</>;
      } else if (status === 'checked_in') {
        actions = <>{primaryButton('Start Consultation', () => startConsultation(selectedAppointment))}<div style={styles.appointmentActionRow}>{secondaryButton('View Record', openRecord)}{secondaryButton('Transfer', transfer)}</div></>;
      } else if (status === 'in_consultation') {
        actions = <>{primaryButton('Complete Consultation', () => openActiveConsultation(selectedAppointment))}{secondaryButton('Open Treatment Plan', () => setTransferNotice('Open Clinical Records to view this patient’s treatment plan.'))}</>;
      } else if (status === 'completed') {
        actions = <>{primaryButton('View Record', openRecord)}<div style={styles.appointmentActionRow}>{secondaryButton('Schedule Follow-up', () => openAppointmentWorkflow('follow_up', selectedAppointment))}{selectedAppointment.related_appointment_id && secondaryButton('View Follow-up', openRelatedAppointment)}</div></>;
      } else if (status === 'rescheduled') {
        actions = <>{primaryButton('View New Appointment', openRelatedAppointment)}{secondaryButton('View Record', openRecord)}</>;
      } else if (status === 'cancelled') {
        actions = <>{primaryButton(selectedAppointment.related_appointment_id ? 'Rebook Again' : 'Rebook Appointment', () => openAppointmentWorkflow('rebook', selectedAppointment))}<div style={styles.appointmentActionRow}>{selectedAppointment.related_appointment_id && secondaryButton('View New Appointment', openRelatedAppointment)}{secondaryButton('View Record', openRecord)}</div></>;
      } else if (status === 'no_show') {
        actions = <>{primaryButton('Reschedule', () => openAppointmentWorkflow('reschedule', selectedAppointment))}<div style={styles.appointmentActionRow}>{secondaryButton('View Record', openRecord)}{secondaryButton('Mark Cancelled', () => setTransferNotice('Please contact reception to cancel this appointment.'), 'danger')}</div></>;
      } else {
        actions = <>{primaryButton('View Record', openRecord)}{secondaryButton('Transfer', transfer)}</>;
      }
      return <div style={styles.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedAppointment(null); }}>
        <div style={{ ...styles.appointmentModal, width: 'min(520px, 100%)' }} role="dialog" aria-modal="true" aria-labelledby="appointment-details-title">
          <div style={{ ...styles.modalHeader, padding: '20px 22px 15px', marginBottom: 0, borderBottom: '1px solid #e2ebe7' }}><div><h2 id="appointment-details-title" style={styles.modalTitle}>Appointment Details</h2><p style={styles.modalSubtitle}>{appointmentId} · {formattedDate}, {formatTime(selectedAppointment.start_time)}</p></div><button type="button" style={styles.modalClose} onClick={() => setSelectedAppointment(null)} aria-label="Close appointment details">×</button></div>
          <div style={styles.appointmentModalBody}>
            <div style={styles.detailsGrid}>
              <div><span style={styles.detailLabel}>Pet</span><strong style={styles.detailValue}>{selectedAppointment.pet || 'Patient'}</strong></div>
              <div><span style={styles.detailLabel}>Owner</span><strong style={styles.detailValue}>{selectedAppointment.owner || selectedAppointment.pet_owner || '—'}</strong></div>
              <div><span style={styles.detailLabel}>Type</span><span style={styles.detailValue}><Badge tone={{ color: '#193a32', background: '#fff', border: '1px solid #d8e9e1' }}>{type}</Badge></span></div>
              <div><span style={styles.detailLabel}>Status</span><span style={styles.detailValue}><StatusIndicator status={status === 'checked_in' ? 'Checked In' : selectedAppointment.status} /></span></div>
              <div><span style={styles.detailLabel}>◷ &nbsp;Time</span><strong style={styles.detailValue}>{formatTime(selectedAppointment.start_time)} · {getAppointmentDuration(selectedAppointment)}</strong></div>
              <div><span style={styles.detailLabel}>Room</span><strong style={styles.detailValue}>{selectedAppointment.room || selectedAppointment.room_name || 'Room not assigned'}</strong></div>
            </div>
            {detailPanel('Reason for visit', selectedAppointment.visit_reason || selectedAppointment.reason_details || selectedAppointment.reason)}
            {details.map(([label, value]) => detailPanel(label, value))}
            {selectedAppointment.note && detailPanel('Note', selectedAppointment.note)}
            {status === 'confirmed' && <div style={styles.checkInNotice}>⚠ &nbsp; Reception has not checked in this patient yet.</div>}
            {status === 'no_show' && <div style={styles.checkInNotice}>⚠ &nbsp; Patient did not arrive and was not checked in.</div>}
          </div>
          <div style={styles.appointmentModalActions}>{actions}</div>
        </div>
      </div>;
    })()}
    {appointmentWorkflow && <div style={styles.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAppointmentWorkflow(null); }}>
      <form style={workflowStyles.dialog} role="dialog" aria-modal="true" aria-labelledby="appointment-workflow-title" onSubmit={submitAppointmentWorkflow}>
        <div style={{ ...styles.modalHeader, marginBottom: 0, padding: '18px 24px 14px', borderBottom: '1px solid #e2ebe7' }}>
          <div>
            <h2 id="appointment-workflow-title" style={styles.modalTitle}>{appointmentWorkflow.action === 'follow_up' ? 'Schedule Follow-up' : appointmentWorkflow.action === 'rebook' ? 'Rebook Appointment' : 'Reschedule Appointment'}</h2>
            <p style={styles.modalSubtitle}>{appointmentWorkflow.appointment.pet || 'Patient'} · {appointmentWorkflow.appointment.owner || appointmentWorkflow.appointment.pet_owner || '—'}{appointmentWorkflow.action === 'reschedule' ? ` · was ${formatActivityDate(appointmentWorkflow.appointment.start_time)}, ${formatTime(appointmentWorkflow.appointment.start_time)}` : ''}</p>
          </div>
          <button type="button" style={styles.modalClose} onClick={() => setAppointmentWorkflow(null)} aria-label="Close appointment form">×</button>
        </div>
        <div style={workflowStyles.body}>
          <label style={workflowStyles.field}>
            Visit type
            {appointmentWorkflow.action === 'follow_up' ? <div style={workflowStyles.visitChoices}>{['Follow-up', 'Recheck', 'Consultation'].map(type => <button key={type} type="button" aria-pressed={appointmentWorkflow.visitType === type} onClick={() => setAppointmentWorkflow(current => ({ ...current, visitType: type }))} style={{ ...workflowStyles.visitButton, ...(appointmentWorkflow.visitType === type ? workflowStyles.visitSelected : {}) }}>{type}</button>)}</div>
              : <input required value={appointmentWorkflow.visitType} onChange={event => setAppointmentWorkflow(current => ({ ...current, visitType: event.target.value }))} style={workflowStyles.input} />}
          </label>
          <div style={workflowStyles.dateTime}>
            <label style={workflowStyles.field}>Date<LabDateTimePicker mode="date" required min={toDateInputValue(new Date())} value={appointmentWorkflow.date} onChange={date => setAppointmentWorkflow(current => ({ ...current, date, time: getUnavailableAppointmentTimes(appointments, date, current.action === 'reschedule' ? current.appointment.id : undefined).includes(current.time) ? '' : current.time, error: '' }))} style={workflowStyles.input} /></label>
            <label style={workflowStyles.field}>Time<LabDateTimePicker mode="time" required value={appointmentWorkflow.time} unavailableTimes={workflowUnavailableTimes} unavailableLabel="another appointment" onChange={time => setAppointmentWorkflow(current => ({ ...current, time, error: '' }))} style={workflowStyles.input} /></label>
          </div>
          <label style={workflowStyles.field}>
            {appointmentWorkflow.action === 'reschedule' ? 'Reason (optional)' : 'Reason'}
            <textarea value={appointmentWorkflow.reason} onChange={event => setAppointmentWorkflow(current => ({ ...current, reason: event.target.value, error: '' }))} placeholder={appointmentWorkflow.action === 'reschedule' ? 'Why is this appointment being rescheduled?' : 'Add a reason for this appointment'} style={workflowStyles.textarea} />
          </label>
          {appointmentWorkflow.action === 'reschedule' && <p style={workflowStyles.hint}>The original appointment will be marked rescheduled. The new appointment will be linked to it in the schedule.</p>}
          {appointmentWorkflow.error && <div role="alert" style={workflowStyles.error}>{appointmentWorkflow.error}</div>}
        </div>
        <div style={workflowStyles.footer}>
          <button type="button" style={workflowStyles.backButton} onClick={() => setAppointmentWorkflow(null)}>Back</button>
          <button type="submit" disabled={appointmentWorkflow.saving} style={{ ...workflowStyles.submitButton, ...(appointmentWorkflow.saving ? styles.appointmentPrimaryDisabled : {}) }}>
            {appointmentWorkflow.saving ? 'Saving…' : appointmentWorkflow.action === 'follow_up' ? 'Schedule Follow-up' : appointmentWorkflow.action === 'rebook' ? 'Rebook Appointment' : 'Confirm Reschedule'}
          </button>
        </div>
      </form>
    </div>}
    {recordAppointment && <div style={styles.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setRecordAppointment(null); }}>
      <div style={styles.appointmentModal} role="dialog" aria-modal="true" aria-labelledby="patient-record-title">
        <div style={styles.modalHeader}><div><h2 id="patient-record-title" style={styles.modalTitle}>Patient Record</h2><p style={styles.modalSubtitle}>{recordAppointment.pet || 'Patient'} · {recordAppointment.owner || '—'}</p></div><button type="button" style={styles.modalClose} onClick={() => setRecordAppointment(null)} aria-label="Close patient record">×</button></div>
        <div style={styles.detailsGrid}>
          <div><span style={styles.detailLabel}>Patient</span><strong style={styles.detailValue}>{recordAppointment.pet || 'Patient'}</strong></div>
          <div><span style={styles.detailLabel}>Owner</span><strong style={styles.detailValue}>{recordAppointment.owner || '—'}</strong></div>
          <div><span style={styles.detailLabel}>Appointment</span><span style={styles.detailValue}>{recordAppointment.reason || 'Appointment'}</span></div>
          <div><span style={styles.detailLabel}>Practitioner</span><span style={styles.detailValue}>{recordAppointment.practitioner || user?.name || '—'}</span></div>
          <div><span style={styles.detailLabel}>Status</span><span style={styles.detailValue}><StatusIndicator status={recordAppointment.status} /></span></div>
        </div>
        <div style={styles.notesPanel}><span style={styles.detailLabel}>Clinical Notes</span><p style={styles.notesText}>{recordAppointment.notes || 'No clinical notes provided.'}</p></div>
        <div style={styles.modalFooter}><button type="button" style={styles.modalCancel} onClick={() => setRecordAppointment(null)}>Back to Appointment</button></div>
      </div>
    </div>}
    {consultationAppointment && <div className="consultation-modal-backdrop" style={styles.modalOverlay} role="presentation">
      <ModalDialog as="form" size="large" role="dialog" aria-modal="true" aria-labelledby="consultation-form-title" className="consultation-modal-theme" style={styles.consultationModal} onSubmit={event => { event.preventDefault(); saveConsultationDraft(true); }}>
        <div style={styles.modalHeader}><div><h2 id="consultation-form-title" style={styles.modalTitle}>Consultation Form</h2><p style={styles.modalSubtitle}>{consultationAppointment.pet || 'Patient'} · {consultationAppointment.owner || '—'} · Dr. {user?.name || 'Doctor'}</p></div><button type="button" style={styles.modalClose} onClick={() => setConsultationAppointment(null)} aria-label="Close consultation">×</button></div>
        <div className="consultation-modal-context" style={styles.consultationContext}><strong>Service / Procedure: {consultationAppointment.reason || 'Appointment'}</strong><span>{formatTime(consultationAppointment.start_time)} · In Consultation</span></div>
        <div className="consultation-modal-context" style={{ ...styles.consultationContext, marginTop: 8 }}><span>Known allergies</span><strong>{consultationAppointment.known_allergies || 'Not recorded'}</strong></div>
        <div className="consultation-step-bar" style={consultationStyles.stepBar}>
          {['Assessment', 'Care & records', 'Charges'].map((label, index) => <button className={consultationStep === index ? 'consultation-step-active' : 'consultation-step'} key={label} type="button" aria-current={consultationStep === index ? 'step' : undefined} onClick={() => setConsultationStep(index)} style={{ ...consultationStyles.stepButton, ...(consultationStep === index ? consultationStyles.stepButtonActive : {}) }}><span>{index + 1}</span>{label}</button>)}
        </div>
        <p style={{ margin: '10px 0 0', color: '#52645f', fontSize: 13 }}><span aria-hidden="true" style={{ color: '#d83740', fontWeight: 700 }}>*</span> Required to complete consultation</p>
        <div className="consultation-modal-grid" style={styles.consultationGrid}>
          {consultationStep < 2 && CONSULTATION_FIELDS.filter(([, , step]) => step === consultationStep).map(([field, label]) => <label key={field} style={{ ...styles.modalField, gridColumn: ['clinicalFindings', 'treatment', 'outcome', 'medications', 'vaccinations', 'labTests', 'followUpInstructions', 'internalNotes', 'ownerSummary', 'attachments'].includes(field) ? '1 / -1' : undefined }}><span>{label}{CONSULTATION_REQUIRED_FIELDS.has(field) && <span aria-hidden="true" style={{ color: '#d83740', fontWeight: 700, marginLeft: 3 }}>*</span>}</span><textarea aria-required={CONSULTATION_REQUIRED_FIELDS.has(field)} value={consultationForm[field] || ''} onChange={event => updateConsultationField(field, event.target.value)} style={styles.modalTextarea} rows={field === 'clinicalFindings' || field === 'internalNotes' ? 3 : 2} /></label>)}
          {consultationStep === 0 && <>
          <div style={styles.modalField}>
            Hydration
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {['Normal', 'Mild deficit', 'Moderate deficit'].map(value => <button key={value} type="button" aria-pressed={consultationForm.hydration === value} onClick={() => updateConsultationField('hydration', value)} style={{ ...styles.modalActionButton, borderColor: consultationForm.hydration === value ? '#005447' : '#d8e9e1', background: consultationForm.hydration === value ? '#e7f5f2' : '#fff', color: consultationForm.hydration === value ? '#005447' : '#38534c' }}>{value}</button>)}
            </div>
          </div>
          <div style={styles.modalField}>
            Diagnosis status
            <div style={{ display: 'flex', gap: 7 }}>
              {['Suspected', 'Confirmed'].map(value => <button key={value} type="button" aria-pressed={consultationForm.diagnosisStatus === value} onClick={() => updateConsultationField('diagnosisStatus', value)} style={{ ...styles.modalActionButton, borderColor: consultationForm.diagnosisStatus === value ? '#005447' : '#d8e9e1', background: consultationForm.diagnosisStatus === value ? '#e7f5f2' : '#fff', color: consultationForm.diagnosisStatus === value ? '#005447' : '#38534c' }}>{value}</button>)}
            </div>
          </div>
          <div style={styles.modalField}>
            Severity
            <div style={{ display: 'flex', gap: 7 }}>
              {['Mild', 'Moderate', 'Severe'].map(value => <button key={value} type="button" aria-pressed={consultationForm.severity === value} onClick={() => updateConsultationField('severity', value)} style={{ ...styles.modalActionButton, borderColor: consultationForm.severity === value ? '#005447' : '#d8e9e1', background: consultationForm.severity === value ? '#e7f5f2' : '#fff', color: consultationForm.severity === value ? '#005447' : '#38534c' }}>{value}</button>)}
            </div>
          </div>
          </>}
          {consultationStep === 1 && <>
            <label style={styles.modalField}>Follow-up date<LabDateTimePicker mode="date" value={consultationForm.followUpDate || ''} onChange={date => updateConsultationField('followUpDate', date)} style={styles.modalControl} /></label>
            <label style={styles.modalField}>Follow-up time<LabDateTimePicker mode="time" value={consultationForm.followUpTime || ''} onChange={time => updateConsultationField('followUpTime', time)} style={styles.modalControl} /></label>
          </>}
        </div>
        {consultationStep === 2 && <section className="consultation-billing" style={consultationStyles.billing}>
          <div style={consultationStyles.billingHeader}>
            <div><strong>Services and items used</strong><span>Select actual work and products from the clinic's price catalog. The saved clinic price is applied to the bill.</span></div>
            <button type="button" style={consultationStyles.addItem} disabled={!activeBillingCatalog.length} onClick={addBillingItem}>+ Add item</button>
          </div>
          {billingCatalogLoading ? <p style={consultationStyles.billingHint}>Loading clinic prices…</p>
            : !activeBillingCatalog.length ? <div role="alert" style={consultationStyles.billingHint}>No active prices are configured. Ask the clinic owner to add actual prices in Services & Price Catalog before completing a billable consultation.</div>
              : null}
          {(consultationForm.billingItems || []).map((item, index) => {
            const catalogItem = activeBillingCatalog.find(entry => String(entry.id) === String(item.catalog_item_id));
            const lineTotal = Number(catalogItem?.unit_price || 0) * Number(item.quantity || 0);
            return <div className="consultation-bill-row" key={`${item.catalog_item_id}-${index}`} style={consultationStyles.billRow}>
              <label style={styles.modalField}>Service / item
                <select required value={item.catalog_item_id} onChange={event => {
                  const selectedItem = activeBillingCatalog.find(entry => String(entry.id) === event.target.value);
                  updateBillingItem(index, {
                    catalog_item_id: event.target.value,
                    ...(selectedItem?.item_type === 'inpatient' ? { quantity: '1' } : {}),
                  });
                }} style={styles.modalControl}>
                  <option value="">Select priced item</option>
                  {activeBillingCatalog.map(entry => <option key={entry.id} value={entry.id}>{entry.name} · {entry.item_type.replace('_', ' ')}</option>)}
                </select>
              </label>
              <label style={styles.modalField}>Quantity
                <input type="number" min="0.01" step="0.01" required value={item.quantity} disabled={catalogItem?.item_type === 'inpatient'} onChange={event => updateBillingItem(index, { quantity: event.target.value })} style={styles.modalControl} />
              </label>
              <label style={{ ...styles.modalField, gridColumn: '1 / -1' }}>Clinical details (dose, test indication, vaccine batch, or inpatient notes)
                <input value={item.clinical_details || ''} onChange={event => updateBillingItem(index, { clinical_details: event.target.value })} style={styles.modalControl} />
              </label>
              <div className="consultation-bill-amount" style={consultationStyles.billAmount}>{catalogItem ? `₱${Number(catalogItem.unit_price).toFixed(2)} × ${item.quantity || 0} = ₱${lineTotal.toFixed(2)}` : 'Select a catalog item'}<button type="button" onClick={() => removeBillingItem(index)} style={consultationStyles.removeItem}>Remove</button></div>
            </div>;
          })}
          <div className="consultation-bill-total" style={consultationStyles.billTotal}><span>Estimated invoice total</span><strong>₱{consultationBillTotal.toFixed(2)}</strong></div>
          <p style={consultationStyles.billingHint}>Completing this visit issues an itemized invoice in Billing & Payments. Appointment booking itself is not charged again; add the service actually performed here.</p>
        </section>}
        <div style={styles.modalFooter}>
          <button type="button" style={styles.modalCancel} onClick={() => setConsultationAppointment(null)}>Close</button>
          <button type="button" style={styles.modalActionButton} onClick={() => saveConsultationDraft(false)}>Save Draft</button>
          {consultationStep > 0 && <button type="button" style={styles.modalActionButton} onClick={() => setConsultationStep(step => step - 1)}>Back</button>}
          {consultationStep < 2 ? <button type="button" style={styles.modalConfirm} onClick={() => setConsultationStep(step => step + 1)}>Continue</button> : <button type="submit" style={styles.modalConfirm}>Review & Complete</button>}
        </div>
      </ModalDialog>
    </div>}
    {showCompletionReview && consultationAppointment && <div style={styles.modalOverlay} role="presentation">
      <div style={styles.reviewModal} role="dialog" aria-modal="true">
        <div style={styles.modalHeader}><div><h2 style={styles.modalTitle}>Review Consultation</h2><p style={styles.modalSubtitle}>Confirm the information before updating the patient record.</p></div><button type="button" style={styles.modalClose} onClick={() => setShowCompletionReview(false)} aria-label="Close review">×</button></div>
        <div style={styles.reviewSummary}><strong>{consultationAppointment.pet || 'Patient'}</strong><span>Diagnosis: {consultationForm.diagnosis}</span><span>Diagnosis status: {consultationForm.diagnosisStatus} · Severity: {consultationForm.severity}</span><span>Clinical notes: {consultationForm.clinicalFindings}</span>{consultationForm.followUpDate && <span>Follow-up: {consultationForm.followUpDate}{consultationForm.followUpTime ? ` at ${consultationForm.followUpTime}` : ''}</span>}
          {consultationStep === 2 && <><strong>Invoice preview · ₱{consultationBillTotal.toFixed(2)}</strong>{(consultationForm.billingItems || []).map((item, index) => { const catalogItem = activeBillingCatalog.find(entry => String(entry.id) === String(item.catalog_item_id)); return catalogItem ? <span key={`${item.catalog_item_id}-${index}`}>{catalogItem.name} × {item.quantity} · ₱{(Number(catalogItem.unit_price) * Number(item.quantity || 0)).toFixed(2)}</span> : null; })}</>}
          <label><input type="checkbox" defaultChecked /> Share selected visit summary with pet owner</label><label><input type="checkbox" defaultChecked={false} /> Share medication instructions</label><label><input type="checkbox" defaultChecked={false} /> Share vaccination or follow-up update</label></div>
        <div style={styles.modalFooter}><button type="button" style={styles.modalCancel} onClick={() => setShowCompletionReview(false)}>Back</button><button type="button" disabled={consultationCompleting} style={{ ...styles.modalConfirm, ...(consultationCompleting ? { opacity: .6, cursor: 'not-allowed' } : {}) }} onClick={() => { if (window.confirm('Complete consultation, update the patient record, and issue the displayed invoice?')) completeConsultation(); }}>{consultationCompleting ? 'Completing…' : 'Confirm Completion'}</button></div>
      </div>
    </div>}
    {showTransferModal && <div style={styles.modalOverlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeTransferModal(); }}>
      <form style={styles.transferModal} onSubmit={submitTransfer} noValidate>
        <div style={styles.modalHeader}><div><h2 style={styles.modalTitle}>Transfer Patient Care</h2><p style={styles.modalSubtitle}>Transfer ongoing care of a patient to another doctor. The receptionist will be automatically notified and the patient's medical history will transfer with them.</p></div><button type="button" style={styles.modalClose} onClick={closeTransferModal} aria-label="Close transfer dialog">×</button></div>
        <div style={styles.transferNotice}><span style={styles.noticeIcon}>{Icons.bell}</span><span>The receiving doctor and receptionist will receive a notification with the patient's full medical history and current treatment status.</span></div>
        <label style={styles.modalField}>Patient (Pet)<span style={styles.required}>*</span><select value={transferForm.patient} onChange={event => updateTransferField('patient', event.target.value)} style={{ ...styles.modalControl, ...(transferErrors.patient ? styles.invalidControl : {}) }}><option value="">Select patient</option>{patients.map(item => <option key={item.pet} value={item.pet}>{item.pet}</option>)}</select>{transferErrors.patient && <small style={styles.fieldError}>{transferErrors.patient}</small>}</label>
        <label style={styles.modalField}>Transfer To (Doctor)<span style={styles.required}>*</span><select value={transferForm.doctor} onChange={event => updateTransferField('doctor', event.target.value)} style={{ ...styles.modalControl, ...(transferErrors.doctor ? styles.invalidControl : {}) }}><option value="">Select receiving doctor</option>{receivingDoctors.map(doctor => <option key={doctor.id || doctor.name} value={doctor.name}>{doctor.name}</option>)}</select>{transferErrors.doctor && <small style={styles.fieldError}>{transferErrors.doctor}</small>}</label>
        <label style={styles.modalField}>Reason for Transfer<span style={styles.required}>*</span><input value={transferForm.reason} onChange={event => updateTransferField('reason', event.target.value)} placeholder="e.g. Doctor unavailable on scheduled date" style={{ ...styles.modalControl, ...(transferErrors.reason ? styles.invalidControl : {}) }} />{transferErrors.reason && <small style={styles.fieldError}>{transferErrors.reason}</small>}</label>
        <label style={styles.modalField}>Urgency<select value={transferForm.urgency} onChange={event => updateTransferField('urgency', event.target.value)} style={styles.modalControl}><option>Routine — no rush</option><option>Priority — review soon</option><option>Urgent — immediate attention</option></select></label>
        <label style={styles.modalField}>Handoff Notes for Receiving Doctor<textarea value={transferForm.notes} onChange={event => updateTransferField('notes', event.target.value)} placeholder="Current treatment protocol, key observations, pending lab results, anything the receiving doctor needs to know..." style={{ ...styles.modalTextarea, ...(transferErrors.notes ? styles.invalidControl : {}) }} />{transferErrors.notes && <small style={styles.fieldError}>{transferErrors.notes}</small>}</label>
        {transferForm.doctor && <div style={styles.transferConfirmation}><strong>{transferForm.doctor} will receive the full medical history of {transferForm.patient || 'this patient'}</strong> and the receptionist will be notified to update the schedule.</div>}
        <div style={styles.modalFooter}><button type="button" style={styles.modalCancel} onClick={closeTransferModal}>Cancel</button><button type="submit" style={styles.modalConfirm}><span style={styles.buttonIcon}>{Icons.transfer}</span> Confirm Transfer</button></div>
      </form>
    </div>}
  </div>;
}

const consultationStyles = {
  stepBar: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16, paddingBottom: 12, borderBottom: '1px solid #c6d4cf' },
  stepButton: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 11px', border: '1px solid #b8c8c2', borderRadius: 20, background: '#e7ece9', color: '#263e37', font: 'inherit', fontSize: '.76rem', cursor: 'pointer' },
  stepButtonActive: { borderColor: '#003b32', background: '#b8d9d0', color: '#003b32', fontWeight: 700 },
  billing: { display: 'grid', gap: 12, marginTop: 16 },
  billingHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 14, border: '1px solid #b8c8c2', borderRadius: 9, background: '#e5ece9', color: '#102c25' },
  addItem: { flex: '0 0 auto', padding: '8px 12px', border: 0, borderRadius: 7, background: '#003b32', color: '#fff', font: 'inherit', fontSize: '.76rem', fontWeight: 700, cursor: 'pointer' },
  billRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(100px, 1fr)', gap: '0 12px', padding: '12px 14px', border: '1px solid #c7d2ce', borderRadius: 9, background: '#edf1ef' },
  billAmount: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gridColumn: '1 / -1', color: '#003b32', fontSize: '.78rem', fontWeight: 700 },
  removeItem: { padding: '4px 7px', border: 0, background: 'transparent', color: '#b42318', font: 'inherit', fontSize: '.72rem', cursor: 'pointer' },
  billTotal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 8, background: '#bfd9d0', color: '#063b31', fontSize: '.85rem' },
  billingHint: { margin: 0, padding: '10px 12px', border: '1px solid #c6d4cf', borderRadius: 8, background: '#e8eeeb', color: '#344b44', fontSize: '.74rem', lineHeight: 1.45 },
};

const styles = {
  main: { flex: 1, overflowY: 'auto', background: '#f8fafc', fontFamily: "'DM Sans', sans-serif" },
  page: { padding: '24px 26px', color: '#0f172a' },
  hero: { display: 'flex', alignItems: 'center', gap: 14, padding: '22px 24px', borderRadius: 12, background: 'linear-gradient(110deg,#005447,#243d8f)', color: '#fff' },
  avatar: { width: 54, height: 54, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'grid', placeItems: 'center', fontSize: '1.2rem', fontWeight: 700 },
  heroTitle: { margin: 0, fontSize: '1.35rem' }, heroSub: { marginTop: 4, color: '#d8f4e8', fontSize: '.8rem' }, heroMeta: { display: 'flex', gap: 15, marginTop: 12, color: '#e0e7ff', fontSize: '.7rem' }, heroMetaIcon: { display: 'inline-flex', width: 14, height: 14, marginRight: 5, verticalAlign: 'middle' },
  transfer: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', border: 0, borderRadius: 7, background: '#fff', color: '#2551be', fontWeight: 600 }, buttonIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, fontSize: '1rem', lineHeight: 1 }, 
  stats: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, margin: '20px 0' }, stat: { display: 'flex', alignItems: 'center', gap: 10, padding: 18, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 11 }, statIcon: { display: 'grid', placeItems: 'center', flex: '0 0 30px', width: 30, height: 30, borderRadius: 8, color: '#005447' }, statLabel: { color: '#64748b', fontSize: '.72rem' }, statValue: { display: 'block', marginTop: 4, fontSize: '1.25rem' }, statSub: { color: '#9aaaca', fontSize: '.66rem' },
  workspace: { marginBottom: 18, padding: '14px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 11 }, workspaceHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, workspaceTitle: { margin: 0, color: '#334155', fontSize: '.84rem' }, workspaceMeta: { display: 'block', marginTop: 3, color: '#8292ad', fontSize: '.7rem' }, completedMeta: { color: '#8292ad', fontSize: '.7rem' }, workspaceRow: { display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '8px 10px', marginTop: 7, border: '1px solid #f1f5f9', borderRadius: 8, background: '#fafbfc' }, workspacePendingRow: { background: '#fffaf0', borderColor: '#fde68a' }, workspaceCompletedRow: { background: '#f0fdf4', borderColor: '#bbf7d0' }, workspaceDot: { width: 8, height: 8, flex: '0 0 8px', borderRadius: '50%' }, workspaceDetails: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 7, rowGap: 2, minWidth: 0, flex: 1, fontSize: '.76rem' }, workspaceDetailsStrong: { color: '#0f172a', fontSize: '.8rem' }, workspaceDetailsSpan: { color: '#64748b' }, workspaceDetailsEm: { width: '100%', overflow: 'hidden', color: '#718096', fontSize: '.7rem', fontStyle: 'italic', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, workspaceButton: { padding: '6px 9px', border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff', color: '#475569', fontSize: '.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }, workspacePrimaryButton: { padding: '6px 9px', border: 0, borderRadius: 7, background: '#0f1020', color: '#fff', fontSize: '.7rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 18 }, card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 11, padding: 20, minHeight: 160 }, heading: { margin: '0 0 16px', fontSize: '.95rem' }, cardHeader: { display: 'flex', justifyContent: 'space-between' }, calendarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, calendarHeaderHeading: {}, calendarControls: { display: 'flex', alignItems: 'center', gap: 10, marginTop: -14 }, iconButton: { border: 0, background: 'transparent', color: '#8292ad', fontSize: '1.3rem', cursor: 'pointer' }, todayButton: { border: 0, background: 'transparent', color: '#005447', fontSize: '.78rem', cursor: 'pointer' }, date: { color: '#7183a1', fontSize: '.8rem' },
  week: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, borderBottom: '1px solid #e2e8f0', paddingBottom: 15 }, day: { display: 'grid', justifyItems: 'center', gap: 5, padding: '8px 3px', border: 0, color: '#7183a1', background: 'transparent', font: 'inherit', fontSize: '.68rem', borderRadius: 8, cursor: 'pointer' }, selectedDay: { background: '#005447', color: '#fff' }, appointmentCount: { color: '#ef4444', fontSize: '.72rem', fontWeight: 800, lineHeight: 1 },
  listTitle: { margin: '14px 0 9px', color: '#8292ad', fontSize: '.76rem', fontWeight: 700 }, calendarList: { maxHeight: 230, overflowY: 'auto', paddingRight: 4 }, miniRow: { display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box', gap: 10, padding: '9px 10px', marginBottom: 6, border: 0, textAlign: 'left', background: '#f8fafc', borderRadius: 7, cursor: 'pointer' }, dot: { width: 8, height: 8, flex: '0 0 8px', borderRadius: '50%' }, miniDetails: { flex: 1, minWidth: 0 }, miniPatient: { display: 'block', fontSize: '.92rem', lineHeight: 1.25, fontWeight: 700 }, miniAppointmentDetails: { display: 'block', marginTop: 4, color: '#475569', fontSize: '.8rem', lineHeight: 1.35, fontWeight: 400 },
  scheduleTabs: { display: 'flex', flexWrap: 'wrap', gap: 5, margin: '-3px 0 14px', paddingBottom: 10, borderBottom: '1px solid #eef2f7' }, scheduleTab: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 8px', border: 0, borderRadius: 7, background: 'transparent', color: '#64748b', fontSize: '.68rem', cursor: 'pointer' }, scheduleTabActive: { background: '#e7f5f2', color: '#005447', fontWeight: 700 }, scheduleTabCount: { minWidth: 16, padding: '1px 4px', borderRadius: 10, background: '#e2e8f0', color: '#475569', fontSize: '.62rem', textAlign: 'center' }, emptySchedule: { padding: '24px 12px', textAlign: 'center', color: '#64748b', fontSize: '.8rem' },
  appointment: { display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', border: '1px solid #e2e8f0', borderRadius: 11, marginBottom: 8 }, appointmentButton: { width: '100%', boxSizing: 'border-box', textAlign: 'left', background: '#fff', cursor: 'pointer', font: 'inherit' }, time: { width: 54, flex: '0 0 54px', fontWeight: 700, fontSize: '.8rem', color: '#475569' }, timelineDot: { width: 9, height: 9, flex: '0 0 9px', border: '2px solid', borderRadius: '50%' }, appointmentBody: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }, appointmentPatient: { fontSize: '.94rem', fontWeight: 700 }, appointmentOwner: { width: '100%', color: '#475569', fontSize: '.78rem', fontStyle: 'normal' }, appointmentNotes: { width: '100%', color: '#475569', fontSize: '.78rem' }, scheduleActions: { width: '100%', display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 5 }, modalActions: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20 }, modalActionButton: { padding: '8px 11px', border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff', color: '#334155', fontSize: '.76rem', cursor: 'pointer' }, modalPrimaryAction: { padding: '8px 11px', border: 0, borderRadius: 7, background: '#0f1020', color: '#fff', fontSize: '.76rem', fontWeight: 600, cursor: 'pointer' }, disabledAction: { opacity: .5, cursor: 'not-allowed' }, checkInNotice: { marginTop: 16, padding: '10px 12px', border: '1px solid #fde68a', borderRadius: 8, background: '#fffbeb', color: '#92400e', fontSize: '.76rem' }, badge: { display: 'inline-flex', padding: '4px 9px', borderRadius: 7, fontSize: '.72rem', fontWeight: 600 },
  scheduleList: { maxHeight: 220, overflowY: 'auto', paddingRight: 4 },
  patient: { display: 'flex', alignItems: 'center', gap: 11, padding: 11, border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 8 }, patientIcon: { width: 32, height: 32, padding: 7, borderRadius: 7, flex: '0 0 32px' }, patientDetails: { minWidth: 0, flex: 1, fontSize: '.8rem' }, patientTitle: { display: 'flex', alignItems: 'center', gap: 6 }, patientName: { fontSize: '.94rem', fontWeight: 700 }, patientSubtext: { display: 'block', color: '#475569', fontSize: '.8rem', marginTop: 4 }, handoff: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent', color: '#005447', fontSize: '.78rem', cursor: 'pointer' },
  activity: { display: 'flex', gap: 11, marginBottom: 14, padding: 3 }, activityIcon: { width: 32, height: 32, padding: 7, color: '#9333ea', background: '#f3e8ff', borderRadius: 8, flex: '0 0 32px' }, activityDetails: { minWidth: 0, flex: 1, fontSize: '.8rem' }, activityTitle: { display: 'flex', alignItems: 'center', gap: 6 }, activityName: { fontSize: '.94rem', fontWeight: 700 }, activitySubtext: { display: 'block', color: '#475569', fontSize: '.8rem', marginTop: 4 }, table: { width: '100%', fontSize: '.8rem' }, tableRowHeader: { display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr 1.5fr 1.5fr 1fr', gap: 12, padding: '9px 6px', color: '#64748b', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }, tableRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr 1.5fr 1.5fr 1fr', gap: 12, alignItems: 'center', padding: '11px 6px', color: '#475569', borderBottom: '1px solid #eef2f7' },   petTableIcon: { width: 17, height: 17, display: 'inline-block', marginRight: 7, color: '#94a3b8', verticalAlign: 'middle' }, appointmentModal: { display: 'flex', flexDirection: 'column', width: 'min(680px, 100%)', maxHeight: 'calc(100vh - 24px)', overflow: 'hidden', borderRadius: 14, background: '#fff', boxShadow: '0 18px 50px rgba(15,23,42,.25)' }, appointmentModalBody: { overflowY: 'auto', padding: '20px 22px' }, appointmentModalActions: { display: 'grid', gap: 9, padding: '16px 22px', borderTop: '1px solid #e2ebe7', background: '#fff' }, appointmentInfoPanel: { marginTop: 12, padding: '14px 16px', borderRadius: 13, background: '#f3f8f6' }, appointmentActionRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }, appointmentPrimaryAction: { width: '100%', minHeight: 52, padding: '12px 14px', border: 0, borderRadius: 12, background: '#005447', color: '#fff', font: 'inherit', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }, appointmentPrimaryDisabled: { background: '#9bcbbd', cursor: 'not-allowed' }, appointmentSecondaryAction: { width: '100%', minHeight: 49, padding: '11px 13px', border: '1px solid #d8e9e1', borderRadius: 12, background: '#fff', color: '#005447', font: 'inherit', fontSize: '.78rem', cursor: 'pointer' }, appointmentDangerAction: { borderColor: '#fca5a5', color: '#dc2626' },     consultationModal: { width: 'min(760px, 100%)', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', padding: '22px 24px 24px', borderRadius: 10, background: '#e9eeeb', boxShadow: '0 18px 50px rgba(15,23,42,.32)' }, reviewModal: { width: 'min(520px, 100%)', padding: '22px 24px 24px', borderRadius: 10, background: '#fff', boxShadow: '0 18px 50px rgba(15,23,42,.25)' }, consultationContext: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 8, background: '#c8dfd7', color: '#003b32', fontSize: '.76rem' }, consultationGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px', marginTop: 16 }, reviewSummary: { display: 'grid', gap: 10, marginTop: 14, padding: 14, borderRadius: 8, background: '#f8fafc', color: '#334155', fontSize: '.78rem', lineHeight: 1.45 }, detailsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '17px 24px' }, detailLabel: { display: 'block', marginBottom: 6, color: '#526663', fontSize: '.78rem' }, detailValue: { display: 'flex', alignItems: 'center', gap: 6, color: '#102b24', fontSize: '.9rem' }, detailIcon: { display: 'inline-flex', width: 15, height: 15, color: '#475569' }, notesPanel: { marginTop: 16, padding: '13px 12px', borderRadius: 10, background: '#f1f5f9' }, notesText: { margin: 0, color: '#193a32', fontSize: '.88rem', lineHeight: 1.5 }, transferOutline: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 12px', border: '1px solid #86d7b4', borderRadius: 8, background: '#fff', color: '#005447', font: 'inherit', fontSize: '.78rem', cursor: 'pointer' }, transferConfirmation: { marginTop: 4, padding: '13px 12px', border: '1px solid #86efac', borderRadius: 9, background: '#f0fdf4', color: '#166534', fontSize: '.78rem', lineHeight: 1.45 }, transferToast: { position: 'fixed', top: 18, right: 18, zIndex: 120, display: 'flex', alignItems: 'flex-start', gap: 10, width: 'min(355px, calc(100vw - 36px))', padding: '16px 14px', border: '1px solid #e2e8f0', borderRadius: 9, background: '#fff', color: '#111827', boxShadow: '0 8px 24px rgba(15,23,42,.12)', fontSize: '.78rem', lineHeight: 1.45 }, toastIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 17px', width: 17, height: 17, color: '#fff', background: '#111827', borderRadius: '50%' }, modalOverlay: { position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, background: 'rgba(25, 43, 38, .48)' }, transferModal: { width: 'min(520px, 100%)', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', padding: '22px 24px 24px', borderRadius: 10, background: '#fff', boxShadow: '0 18px 50px rgba(15,23,42,.25)' }, modalHeader: { display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 14 }, modalTitle: { margin: 0, fontSize: '1.12rem', fontWeight: 700, color: '#102b24' }, modalSubtitle: { margin: '4px 0 0', maxWidth: 440, color: '#647c75', fontSize: '.82rem', lineHeight: 1.45 }, modalClose: { width: 24, height: 24, padding: 0, border: 0, background: 'transparent', color: '#58716b', fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer' }, transferNotice: { display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 15, padding: '12px 14px', border: '1px solid #b7e4d7', borderRadius: 9, background: '#e7f5f2', color: '#005447', fontSize: '.78rem', lineHeight: 1.45 }, noticeIcon: { flex: '0 0 auto', color: '#005447', fontSize: '1.1rem' }, modalField: { display: 'block', marginBottom: 13, color: '#111827', fontSize: '.78rem', fontWeight: 600 }, required: { marginLeft: 2, color: '#dc2626' }, modalControl: { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, padding: '9px 12px', border: '1px solid transparent', borderRadius: 8, outline: 0, background: '#e2e6e4', color: '#111827', font: 'inherit', fontWeight: 400 }, modalTextarea: { display: 'block', width: '100%', minHeight: 64, boxSizing: 'border-box', marginTop: 5, padding: '10px 12px', border: '1px solid transparent', borderRadius: 8, outline: 0, resize: 'vertical', background: '#e2e6e4', color: '#111827', font: 'inherit', fontWeight: 400, lineHeight: 1.45 }, invalidControl: { border: '1px solid #ef4444', background: '#fff7f7' }, fieldError: { display: 'block', marginTop: 4, color: '#dc2626', fontSize: '.7rem', fontWeight: 500 }, modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }, modalCancel: { padding: '8px 13px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#374151', font: 'inherit', fontSize: '.78rem', cursor: 'pointer' }, modalConfirm: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 12px', border: 0, borderRadius: 8, background: '#003b32', color: '#fff', font: 'inherit', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }, error: { padding: 12, marginBottom: 14, color: '#b91c1c', background: '#fee2e2', borderRadius: 8 }, loading: { padding: 40, textAlign: 'center', color: '#64748b' },
};
