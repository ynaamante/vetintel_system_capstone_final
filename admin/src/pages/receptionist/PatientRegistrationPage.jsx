import { useState } from 'react';
import LabDateTimePicker from '../../components/LabDateTimePicker';
import Topbar from '../../components/Topbar';
import StatusIndicator from '../../components/StatusIndicator';
import { Icons } from '../../icons';
import { notifySuccess } from '../../utils/notifications';
import { canViewFeature } from '../../utils/permissionUtils';
import { formatDateTimeText } from '../../utils/dateFormatting';

const STEPS = ['Owner Info', 'Pet Details', 'Attachments', 'Assign Doctor'];
const DOCTORS = [
  { name: 'Dr. Michael Torres', specialty: 'General Practice & Surgery', queue: 3, status: 'Available' },
  { name: 'Dr. Sarah Chen', specialty: 'Internal Medicine', queue: 6, status: 'Busy' },
  { name: 'Dr. Ana Reyes', specialty: 'Dentistry & Radiology', queue: 1, status: 'On Duty' },
  { name: 'Dr. James Lim', specialty: 'Emergency & Critical Care', queue: 0, status: 'Off Duty' },
];
const emptyForm = { ownerName: '', phone: '', email: '', address: '', petName: '', species: '', breed: '', gender: '', dob: '', weight: '', markings: '', allergies: '', history: '' };

export default function PatientRegistrationPage({ user }) {
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState('new');
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [doctor, setDoctor] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const canView = canViewFeature(user.permissions, user.role, 'New Patient Registration');
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const stepComplete = step === 0
    ? Boolean(form.ownerName.trim() && form.phone.trim() && form.email.trim() && form.address.trim())
    : step === 1
      ? Boolean(form.petName.trim() && form.species && form.breed.trim() && form.gender && form.dob && form.weight.trim() && form.markings.trim() && form.allergies.trim() && form.history.trim())
      : step === 2 || step === 3;

  if (!canView) return <div style={s.page}><Topbar user={user} title="New Patient Registration" subtitle="Register a new pet and owner, then send to an available doctor for approval" /><div style={s.error}>You do not have permission to view this page.</div></div>;

  const next = () => {
    setError('');
    if (step === 0 && (!form.ownerName || !form.phone || !form.email)) return setError('Complete the required owner information before continuing.');
    if (step === 1 && (!form.petName || !form.species)) return setError('Complete the required pet information before continuing.');
    setStep(value => Math.min(value + 1, 3));
  };
  const back = () => { setError(''); setStep(value => Math.max(value - 1, 0)); };
  const submit = async () => {
    if (!doctor) return setError('Select an available doctor before sending the registration.');
    if (!user.clinic_id) return setError('Your account is not assigned to a clinic.');
    setSaving(true);
    setError('');
    const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    const headers = { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' };
    try {
      const ownerResponse = await fetch(`${api}/clinic-records/clients?clinic_id=${encodeURIComponent(user.clinic_id)}`, { method: 'POST', headers, body: JSON.stringify({ name: form.ownerName, phone: form.phone, email: form.email, address: form.address }) });
      const owner = await ownerResponse.json().catch(() => ({}));
      if (!ownerResponse.ok) throw new Error(owner.error || Object.values(owner.fields || {})[0] || 'Unable to save the owner.');
      const petResponse = await fetch(`${api}/clinic-records/pets?clinic_id=${encodeURIComponent(user.clinic_id)}`, { method: 'POST', headers, body: JSON.stringify({ name: form.petName, species: form.species, breed: form.breed || 'Not specified', notes: [form.gender, form.dob, form.weight, form.markings, form.allergies, form.history].filter(Boolean).join(' | '), allergies: form.allergies, client_id: owner.id }) });
      const pet = await petResponse.json().catch(() => ({}));
      if (!petResponse.ok) throw new Error(pet.error || Object.values(pet.fields || {})[0] || 'Unable to save the patient.');
      setSubmissions(current => [{ id: `INT-${String(current.length + 1).padStart(3, '0')}`, pet: form.petName, species: form.species, owner: form.ownerName, doctor: doctor.name, status: 'Sent — Pending Approval', submitted: formatDateTimeText(new Date()), ...form }, ...current]);
      setConfirmOpen(false);
      setForm(emptyForm); setFile(null); setDoctor(null); setStep(0); setTab('submissions');
      notifySuccess(`Registration sent to ${doctor.name}`, 'The intake is pending doctor approval.');
    } catch (submitError) {
      setConfirmOpen(false);
      setError(submitError.message || 'Unable to save this registration.');
    } finally { setSaving(false); }
  };

  return <div style={s.page}>
    <Topbar user={user} title="New Patient Registration" subtitle="Register a new pet and owner, then send to an available doctor for approval" />
    <div style={s.content}>
      <div style={s.tabs}><button type="button" onClick={() => setTab('new')} style={{ ...s.tab, ...(tab === 'new' ? s.activeTab : {}) }}>+ New Registration</button><button type="button" onClick={() => setTab('submissions')} style={{ ...s.tab, ...(tab === 'submissions' ? s.activeTab : {}) }}>My Submissions <b style={s.count}>{submissions.length || 1}</b></button></div>
      {tab === 'submissions' ? <SubmissionTable submissions={submissions} onNew={() => { setTab('new'); setStep(0); }} /> : <div style={s.card}>
        <h2 style={s.cardTitle}>New Patient Registration</h2>
        <Stepper step={step} />
        <div style={s.formArea}>{step === 0 && <OwnerStep form={form} update={update} />}
          {step === 1 && <PetStep form={form} update={update} />}
          {step === 2 && <AttachmentStep file={file} setFile={setFile} />}
          {step === 3 && <DoctorStep doctor={doctor} setDoctor={setDoctor} />}
        </div>
        {error && <div style={s.error}>{error}</div>}
        <div style={s.footer}><button type="button" onClick={step === 0 ? () => setForm(emptyForm) : back} style={s.secondary}>{step === 0 ? '‹  Clear Form' : '‹  Back'}</button>{step < 3 ? <button type="button" onClick={next} style={{ ...s.continue, ...(stepComplete ? {} : s.disabledButton) }} disabled={!stepComplete}>Continue  ›</button> : <button type="button" onClick={() => setConfirmOpen(true)} style={{ ...s.continue, ...(doctor ? {} : s.disabledButton) }} disabled={!doctor || saving}>Send to Doctor</button>}</div>
      </div>}
    </div>
    {confirmOpen && <ConfirmModal form={form} doctor={doctor} file={file} onClose={() => setConfirmOpen(false)} onConfirm={submit} saving={saving} />}
  </div>;
}

function Stepper({ step }) { return <div style={s.stepper}>{STEPS.map((label, index) => <div key={label} style={s.stepWrap}><div style={{ ...s.step, ...(index === step ? s.stepActive : {}), ...(index < step ? s.stepDone : {}) }}><span>{index < step ? '✓' : index + 1}</span> {label}</div>{index < STEPS.length - 1 && <div style={{ ...s.line, ...(index < step ? s.lineDone : {}) }} />}</div>)}</div>; }
function OwnerStep({ form, update }) { return <><SectionTitle icon={Icons.users} text="Owner Information" /><div style={s.narrow}><Field label="Full Name*" value={form.ownerName} onChange={v => update('ownerName', v)} placeholder="Maria Santos" /><div style={s.grid}><Field label="Phone*" value={form.phone} onChange={v => update('phone', v)} placeholder="+63 917 000 0000" /><Field label="Email" value={form.email} onChange={v => update('email', v)} placeholder="owner@email.com" /></div><Field label="Address" value={form.address} onChange={v => update('address', v)} placeholder="123 Main St. City" /></div></>; }
function PetStep({ form, update }) { return <><SectionTitle icon={Icons.pet} text="Pet / Patient Details" /><div style={s.narrow}><div style={s.grid}><Field label="Pet Name*" value={form.petName} onChange={v => update('petName', v)} placeholder="Coco" /><Select label="Species*" value={form.species} onChange={v => update('species', v)} options={['Dog', 'Cat', 'Bird', 'Rabbit', 'Other']} /><Field label="Breed" value={form.breed} onChange={v => update('breed', v)} placeholder="Shih Tzu" /><Select label="Gender" value={form.gender} onChange={v => update('gender', v)} options={['Male', 'Female']} /><Field label="Date of Birth" value={form.dob} onChange={v => update('dob', v)} placeholder="dd/mm/yyyy" type="date" /><Field label="Approximate Weight" value={form.weight} onChange={v => update('weight', v)} placeholder="5 kg" /><Field label="Color / Markings" value={form.markings} onChange={v => update('markings', v)} placeholder="White & Brown" /><Field label="Known Allergies" value={form.allergies} onChange={v => update('allergies', v)} placeholder="None reported" /></div><label style={{ ...s.label, marginTop: 2 }}>Medical History / Reason for Visit<textarea value={form.history} onChange={e => update('history', e.target.value)} style={{ ...s.input, minHeight: 55, resize: 'vertical' }} placeholder="Any previous conditions, treatments, or reason for today’s visit..." /></label></div></>; }
function AttachmentStep({ file, setFile }) { return <><SectionTitle icon={Icons.file} text={<>Attachments <span style={{ fontWeight: 400 }}>(Optional)</span></>} /><div style={s.narrow}><p style={s.help}>Upload vaccine cards, previous medical records, or ID documents. Files will be attached to the intake and kept in the patient&apos;s Files &amp; Documents once approved.</p><label style={s.upload}><input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />{file ? <><strong>{file.name}</strong><small>Click to replace file</small></> : <><strong style={s.uploadIcon}>⇧</strong><span>Click to upload a file</span><small>JPG, PNG, PDF — Max 10 MB</small></>}</label></div></>; }
function DoctorStep({ doctor, setDoctor }) { return <><SectionTitle icon={Icons.stethoscope || Icons.users} text="Select Available Doctor" /><div style={s.narrow}>{DOCTORS.map(item => <button type="button" key={item.name} onClick={() => item.status !== 'Busy' && item.status !== 'Off Duty' && setDoctor(item)} style={{ ...s.doctor, ...(doctor?.name === item.name ? s.doctorSelected : {}), opacity: item.status === 'Off Duty' ? .5 : 1 }}><span style={s.avatar}>{item.name.replace('Dr. ', '').split(' ').map(x => x[0]).join('')}</span><span style={s.doctorText}><b>{item.name}</b><small>{item.specialty}</small></span><span style={s.queue}>{item.queue} in queue</span><StatusIndicator status={item.status} /></button>)}</div></>; }
function ConfirmModal({ form, doctor, file, onClose, onConfirm, saving }) { return <div style={s.backdrop}><div style={s.modal} role="dialog" aria-modal="true"><button type="button" aria-label="Close confirmation" onClick={onClose} style={s.close}>×</button><h2 style={s.modalTitle}>Send to Doctor?</h2><p style={s.modalSubtitle}>Once sent, this intake will be locked until the doctor responds.</p><div style={s.summary}><span style={s.summaryItem}>Pet<b style={s.summaryValue}>{form.petName} ({form.species})</b></span><span style={s.summaryItem}>Owner<b style={s.summaryValue}>{form.ownerName}</b></span><span style={s.summaryItem}>Phone<b style={s.summaryValue}>{form.phone}</b></span><span style={s.summaryItem}>Attachments<b style={s.summaryValue}>{file ? '1 file' : '0 files'}</b></span></div><div style={s.selectedDoctor}><div><b style={s.summaryValue}>{doctor?.name}</b><small>{doctor?.specialty}</small></div><em style={{ ...s.available, ...s.status }}>Available</em></div><div style={s.notice}>ⓘ  The intake will be set to “Sent — Pending Approval” and the doctor will be notified immediately.</div><div style={s.modalActions}><button type="button" onClick={onClose} style={s.secondary}>Cancel</button><button type="button" onClick={onConfirm} style={s.confirmButton} disabled={saving}>{saving ? 'Saving...' : 'Confirm & Send'}</button></div></div></div>; }
function SubmissionTable({ submissions, onNew }) { const rows = submissions.length ? submissions : [{ id: 'INT-001', pet: 'No submissions yet', species: '', owner: '—', doctor: '—', submitted: '—', status: 'Draft' }]; return <div style={s.card}><div style={s.submissionHeader}><h2 style={s.cardTitle}>My Submitted Registrations</h2><button type="button" onClick={onNew} style={s.darkButton}>+ New Registration</button></div><table style={s.table}><thead><tr>{['ID', 'Pet', 'Owner', 'Assigned Doctor', 'Submitted', 'Status', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.id}</td><td><b>{row.pet}</b> {row.species && `(${row.species})`}</td><td>{row.owner}</td><td>{row.doctor}</td><td>{row.submitted}</td><td><StatusIndicator status={row.status} /></td><td>◉</td></tr>)}</tbody></table></div>; }
function SectionTitle({ icon, text }) { return <h3 style={s.sectionTitle}><span>{icon}</span>{text}</h3>; }
function Field({ label, value, onChange, placeholder, type = 'text' }) { return <label style={s.label}>{label}{type === 'date' ? <LabDateTimePicker mode="date" value={value} onChange={onChange} style={s.input} /> : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={s.input} />}</label>; }
function Select({ label, value, onChange, options }) { return <label style={s.label}>{label}<select value={value} onChange={e => onChange(e.target.value)} style={s.input}><option value="">Select {label.replace('*', '').toLowerCase()}</option>{options.map(option => <option key={option}>{option}</option>)}</select></label>; }

const s = {
  page: { flex: 1, overflowY: 'auto', background: '#f7f9fc', color: '#172033' }, content: { padding: '22px 24px' }, tabs: { display: 'flex', gap: 8, marginBottom: 16 }, tab: { border: '1px solid #dbe3ee', borderRadius: 8, background: '#fff', color: '#53627a', padding: '8px 12px', fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }, activeTab: { background: '#005447', borderColor: '#005447', color: '#fff' }, count: { display: 'inline-grid', placeItems: 'center', width: 18, height: 18, marginLeft: 5, borderRadius: 9, background: '#f59e0b', color: '#fff', fontSize: '.68rem' }, card: { background: '#fff', border: '1px solid #e3e9f1', borderRadius: 14, padding: '24px 20px 18px', boxShadow: '0 1px 2px rgba(15,23,42,.04)' }, cardTitle: { margin: 0, fontSize: '.92rem', fontWeight: 700 }, stepper: { display: 'flex', alignItems: 'center', margin: '36px 10px 28px', color: '#9aaac0' }, stepWrap: { display: 'flex', alignItems: 'center', flex: 1 }, step: { display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', fontSize: '.73rem', fontWeight: 700 }, stepActive: { background: '#005447', color: '#fff', borderRadius: 9, padding: '8px 10px' }, stepDone: { color: '#005447' }, line: { height: 1, background: '#dbe3ee', flex: 1, margin: '0 10px' }, lineDone: { background: '#005447' }, formArea: { minHeight: 292, borderBottom: '1px solid #edf1f6' }, sectionTitle: { display: 'flex', gap: 8, alignItems: 'center', margin: '0 0 14px', color: '#53627a', fontSize: '.76rem' }, narrow: { maxWidth: 570 }, grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }, label: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14, color: '#182235', fontSize: '.73rem', fontWeight: 500 }, input: { width: '100%', boxSizing: 'border-box', border: 0, borderRadius: 7, background: '#f1f2f5', padding: '9px 11px', color: '#1f2937', fontSize: '.75rem', fontWeight: 400, outline: 'none' }, help: { color: '#53627a', fontSize: '.72rem', lineHeight: 1.45 }, upload: { width: 546, maxWidth: '100%', height: 148, boxSizing: 'border-box', marginTop: 12, paddingTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, border: '2px dashed #cbd9ea', borderRadius: 12, color: '#53627a', cursor: 'pointer', fontSize: '.75rem', fontWeight: 400 }, uploadIcon: { fontSize: '2rem', lineHeight: 1, color: '#c4d1e2', marginBottom: 3 }, footer: { display: 'flex', justifyContent: 'space-between', paddingTop: 16 }, secondary: { border: '1px solid #dbe3ee', borderRadius: 7, background: '#fff', color: '#182235', padding: '7px 11px', fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }, continue: { border: 0, borderRadius: 7, background: '#005447', color: '#fff', padding: '8px 12px', fontSize: '.72rem', fontWeight: 700, cursor: 'pointer' }, disabledButton: { background: '#8d8f9b', cursor: 'not-allowed' }, error: { margin: '12px 0 0', padding: 10, borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: '.75rem' }, doctor: { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 10, marginBottom: 8, textAlign: 'left', border: '1px solid #e1e8f1', borderRadius: 11, background: '#fff', cursor: 'pointer' }, doctorSelected: { border: '2px solid #005447' }, avatar: { width: 31, height: 31, display: 'grid', placeItems: 'center', borderRadius: 50, background: '#e8eef8', color: '#52657e', fontWeight: 700 }, doctorText: { display: 'flex', flexDirection: 'column', flex: 1, gap: 2, fontSize: '.75rem' }, queue: { color: '#53627a', fontSize: '.7rem' }, status: { marginLeft: 'auto', flexShrink: 0, borderRadius: 14, padding: '5px 9px', fontSize: '.68rem', fontStyle: 'normal', fontWeight: 500 }, available: { background: '#dcfce7', color: '#16a34a' }, onduty: { background: '#d8f4e8', color: '#005447' }, busy: { background: '#fef3c7', color: '#d97706' }, submissionHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 24 }, darkButton: { border: 0, borderRadius: 7, background: '#080b18', color: '#fff', padding: '7px 10px', fontSize: '.7rem', fontWeight: 700 }, table: { width: '100%', borderCollapse: 'collapse', color: '#4b5a70', fontSize: '.73rem' }, pending: { padding: '4px 8px', borderRadius: 10, background: '#d8f4e8', color: '#005447' }, backdrop: { position: 'fixed', inset: 0, zIndex: 20, display: 'grid', placeItems: 'center', background: 'rgba(15,23,42,.52)' }, modal: { position: 'relative', width: 490, maxWidth: 'calc(100% - 32px)', padding: 26, borderRadius: 10, background: '#fff', boxShadow: '0 20px 50px rgba(15,23,42,.28)' }, close: { position: 'absolute', top: 12, right: 14, border: 0, background: 'none', fontSize: 21, color: '#64748b', cursor: 'pointer' }, modalTitle: { margin: 0, fontSize: '1.18rem', fontWeight: 700 }, modalSubtitle: { margin: '9px 0 17px', color: '#53627a', fontSize: '.8rem' }, summary: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, padding: 15, borderRadius: 10, background: '#f8fafc', color: '#53627a', fontSize: '.72rem' }, summaryItem: { display: 'flex', flexDirection: 'column', gap: 5, color: '#53627a', fontWeight: 400 }, summaryValue: { color: '#1f2937', fontWeight: 500, fontSize: '.78rem' }, selectedDoctor: { display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 10, margin: '14px 0', padding: 14, border: '1px solid #dbe3ee', borderRadius: 9, fontSize: '.8rem' }, notice: { padding: 12, borderRadius: 9, background: '#e7f5f2', color: '#005447', fontSize: '.76rem', textAlign: 'center' }, modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 17 }, confirmButton: { border: 0, borderRadius: 7, background: '#005447', color: '#fff', padding: '10px 14px', fontSize: '.76rem', fontWeight: 700, cursor: 'pointer' },
};
