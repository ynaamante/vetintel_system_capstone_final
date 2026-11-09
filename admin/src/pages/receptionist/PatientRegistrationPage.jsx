import VisitScreeningFields from '../../components/VisitScreeningFields';

import { useEffect, useMemo, useState } from 'react';
import RegistrationSubmissionDialog from './RegistrationSubmissionDialog';
import { registrationStatusLabel } from '../../utils/registrationActions';
import FilterSelect from '../../components/FilterSelect';
import DateRangeFilter from '../../components/DateRangeFilter';
import LabDateTimePicker from '../../components/LabDateTimePicker';
import Topbar from '../../components/Topbar';
import StatusIndicator from '../../components/StatusIndicator';
import { Icons } from '../../icons';
import { notifySuccess } from '../../utils/notifications';
import { canViewFeature } from '../../utils/permissionUtils';
import { formatDateTimeText } from '../../utils/dateFormatting';
import { announceRegistrationUpdate, watchRegistrationUpdates } from '../../utils/registrationSync';

const STEPS = ['Owner Info', 'Pet Details', 'Attachments', 'Assign Doctor'];
const emptyForm = { ownerName: '', phone: '', email: '', address: '', petName: '', species: '', breed: '', gender: '', dob: '', ageValue: '', ageUnit: 'Months', markings: '', reasonForVisit: '', screeningInputs: { symptoms: [], exposures: [], other_symptom: '', routine_visit: false } };
const getDraftKey = user => `vetintel_patient_registration_draft_${user?.clinic_id || user?.id || 'clinic'}`;
const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');

function authHeaders(user, json = false) {
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}

function mapIntake(row) {
  const owner = row.owner_data || {};
  const pet = row.pet_data || {};
  return {
    intakeId: row.id,
    petId: row.pet_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedBy: row.submitted_by_name,
    activity: Array.isArray(row.activity) ? row.activity : [],
    auditEvents: Array.isArray(row.audit_events) ? row.audit_events : [],
    assignedDoctorId: row.assigned_doctor_id,
    id: `INT-${String(row.id).padStart(5, '0')}`,
    pet: pet.name || '',
    species: pet.species || '',
    owner: owner.name || '',
    doctor: row.assigned_doctor_name || '',
    status: row.status,
    submitted: formatDateTimeText(row.submitted_at || row.created_at),
    submittedAt: row.submitted_at || row.created_at || '',
    correctionNote: row.correction_note || '',
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    form: {
      ...emptyForm,
      ownerName: owner.name || '',
      phone: owner.phone || '',
      email: owner.email || '',
      address: owner.address || '',
      petName: pet.name || '',
      species: pet.species || '',
      breed: pet.breed || '',
      gender: pet.sex || '',
      dob: pet.birth_date || '',
      ageValue: pet.age_value || '',
      ageUnit: pet.age_unit || 'Months',
      markings: pet.color || '',
      reasonForVisit: pet.reason_for_visit || '',
      calculatedScreening: pet.screening || null,
      screeningInputs: pet.screening?.inputs || { symptoms: [], exposures: [], other_symptom: '', routine_visit: false },
    },
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ filename: file.name, content_type: file.type, data: String(reader.result || '') });
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function readRegistrationDraft(user) {
  try {
    const saved = JSON.parse(localStorage.getItem(getDraftKey(user)) || 'null');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

export default function PatientRegistrationPage({ user }) {
  const [initialDraft] = useState(() => readRegistrationDraft(user));
  const [savedDraft, setSavedDraft] = useState(initialDraft.form ? initialDraft : null);
  const [submissionDialogId, setSubmissionDialogId] = useState(null);
  const [step, setStep] = useState(() => Number.isInteger(initialDraft.step) ? Math.min(Math.max(initialDraft.step, 0), 3) : 0);
  const [tab, setTab] = useState('new');
  const [form, setForm] = useState(() => ({ ...emptyForm, ...(initialDraft.form || {}) }));
  const [files, setFiles] = useState([]);
  const [savedAttachments, setSavedAttachments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [doctorLoadError, setDoctorLoadError] = useState('');
  const [doctor, setDoctor] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [submissionTab, setSubmissionTab] = useState('all');
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState('all');
  const [submittedFrom, setSubmittedFrom] = useState('');
  const [submittedTo, setSubmittedTo] = useState('');
  const [editingIntakeId, setEditingIntakeId] = useState(initialDraft.editingIntakeId || null);
  const [correctionNote, setCorrectionNote] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canView = canViewFeature(user.permissions, user.role, 'New Patient Registration');
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const loadIntakes = async () => {
    const rows = await requestJson(`${apiBase}/clinic-records/registration-intakes`, { headers: authHeaders(user) });
    setSubmissions(rows.map(mapIntake));
  };
  const allSubmissions = useMemo(() => savedDraft ? [{
    intakeId: 'local-draft', id: 'DRAFT', status: 'Draft', form: savedDraft.form,
    pet: savedDraft.form?.petName || '', species: savedDraft.form?.species || '',
    owner: savedDraft.form?.ownerName || '', doctor: savedDraft.doctor || '',
    submittedAt: savedDraft.savedAt || '', submitted: savedDraft.savedAt ? formatDateTimeText(savedDraft.savedAt) : 'Saved on this device',
    attachments: [],
  }, ...submissions] : submissions, [savedDraft, submissions]);
  const visibleSubmissions = useMemo(() => {
    const query = submissionSearch.trim().toLowerCase();
    return allSubmissions.filter(row => {
      const status = String(row.status || '').toLowerCase();
      const matchesTab = submissionTab === 'all'
        || (submissionTab === 'pending' && status === 'needs review')
        || (submissionTab === 'approved' && status === 'approved')
        || (submissionTab === 'changes' && status === 'waiting on reception')
        || (submissionTab === 'draft' && status === 'draft')
        || (submissionTab === 'rejected' && ['rejected', 'duplicated'].includes(status));
      const matchesQuery = !query || [row.id, row.pet, row.species, row.owner, row.doctor]
        .some(value => String(value || '').toLowerCase().includes(query));
      const submittedDate = row.submittedAt ? new Date(row.submittedAt) : null;
      const dateValue = submittedDate && !Number.isNaN(submittedDate.getTime())
        ? `${submittedDate.getFullYear()}-${String(submittedDate.getMonth() + 1).padStart(2, '0')}-${String(submittedDate.getDate()).padStart(2, '0')}`
        : '';
      return matchesTab
        && matchesQuery
        && (submissionStatus === 'all' || status === submissionStatus)
        && (!submittedFrom || (dateValue && dateValue >= submittedFrom))
        && (!submittedTo || (dateValue && dateValue <= submittedTo));
    });
  }, [allSubmissions, submissionTab, submissionSearch, submissionStatus, submittedFrom, submittedTo]);
  const submissionCounts = {
    all: allSubmissions.length,
    draft: savedDraft ? 1 : 0,
    rejected: submissions.filter(row => ['Rejected', 'Duplicated'].includes(row.status)).length,
    pending: submissions.filter(row => row.status === 'Needs review').length,
    approved: submissions.filter(row => row.status === 'Approved').length,
    changes: submissions.filter(row => row.status === 'Waiting on reception').length,
  };

  useEffect(() => {
    if (!canView) return undefined;
    let active = true;
    setLoading(true);
    setDoctorLoadError('');
    setLoadError('');
    setDoctors([]);
    Promise.allSettled([
      requestJson(`${apiBase}/clinic-records/registration-doctors`, { headers: authHeaders(user) }),
      requestJson(`${apiBase}/clinic-records/registration-intakes`, { headers: authHeaders(user) }),
    ]).then(([doctorResult, intakeResult]) => {
      if (!active) return;
      if (doctorResult.status === 'fulfilled') {
        setDoctors(doctorResult.value.map(item => ({
          ...item,
          specialty: String(item.role || 'Veterinarian').replace(/_/g, ' '),
          queue: Number(item.pending_count) || 0,
        })));
      } else {
        setDoctorLoadError('Unable to load clinic veterinarians. Please refresh to try again.');
      }
      if (intakeResult.status === 'fulfilled') {
        setSubmissions(intakeResult.value.map(mapIntake));
      } else {
        setLoadError(intakeResult.reason?.message || 'Unable to load registrations.');
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [canView, user?.token, user?.clinic_id]);
  useEffect(() => {
    if (!canView || !user?.token) return undefined;
    let active = true;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const rows = await requestJson(`${apiBase}/clinic-records/registration-intakes`, { headers: authHeaders(user) });
        if (active) {
          setSubmissions(rows.map(mapIntake));
          setLoadError('');
        }
      } catch (error) {
        if (active) setLoadError(error.message || 'Unable to refresh registrations.');
      } finally {
        refreshing = false;
      }
    };
    const stopWatching = watchRegistrationUpdates(refresh);
    return () => { active = false; stopWatching(); };
  }, [canView, user?.token, user?.clinic_id]);
  const saveDraft = () => {
    try {
      const draft = { form, step, doctor: doctor?.name || '', doctorId: doctor?.id, savedAt: new Date().toISOString(), editingIntakeId, correctionNote, savedAttachments };
      localStorage.setItem(getDraftKey(user), JSON.stringify(draft));
      setSavedDraft(draft);
      notifySuccess('Draft saved', 'Your registration progress is saved on this device.');
    } catch {
      setError('Unable to save this draft on this device. Check available browser storage and try again.');
    }
  };
  const cancelRegistration = () => {
    setForm(emptyForm);
    setFiles([]);
    setSavedAttachments([]);
    setDoctor(null);
    setEditingIntakeId(null);
    setCorrectionNote('');
    setStep(0);
    setError('');
    try {
      localStorage.removeItem(getDraftKey(user));
      setSavedDraft(null);
    } catch {
      setError('The registration was cleared, but its saved draft could not be removed from this device.');
    }
  };
  const stepComplete = step === 0
    ? Boolean(form.ownerName.trim() && form.phone.trim() && form.email.trim())
    : step === 1
      ? Boolean(form.petName.trim() && form.species && form.gender && (form.dob || form.ageValue.trim()))
      : step === 2
        ? true
        : Boolean(doctor);

  if (!canView) return <div style={s.page}><Topbar user={user} title="New Patient Registration" subtitle="Register a new pet and owner, then send to an active veterinarian for approval" /><div style={s.error}>You do not have permission to view this page.</div></div>;

  const next = () => {
    setError('');
    if (step === 0 && (!form.ownerName.trim() || !form.phone.trim() || !form.email.trim())) return setError('Complete the required owner information before continuing.');
    if (step === 1 && (!form.petName.trim() || !form.species || !form.gender || (!form.dob && !form.ageValue.trim()))) return setError('Complete the required pet information before continuing.');
    if (step === 3 && !doctor) return setError('Select a veterinarian before continuing.');
    setStep(value => Math.min(value + 1, 3));
  };
  const back = () => { setError(''); setStep(value => Math.max(value - 1, 0)); };
  const submit = async () => {
    if (!doctor) return setError('Select an available doctor before sending the registration.');
    if (!form.ownerName.trim() || !form.phone.trim() || !form.email.trim()
      || !form.petName.trim() || !form.species || !form.gender
      || (!form.dob && !form.ageValue.trim())) {
      return setError('Complete the required owner and patient information before submission.');
    }
    if (files.some(file => !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type))) return setError('Only PDF, JPG, and PNG files can be attached.');
    if (files.some(file => file.size > 10 * 1024 * 1024) || files.reduce((total, file) => total + file.size, 0) > 10 * 1024 * 1024) {
      return setError('Attachments must total 10 MB or less, with no file larger than 10 MB.');
    }
    setSaving(true);
    setError('');
    try {
      const attachments = await Promise.all(files.map(readFileAsDataUrl));
      const payload = {
        assigned_doctor_id: doctor.id,
        owner: { name: form.ownerName, phone: form.phone, email: form.email, address: form.address },
        pet: {
          name: form.petName,
          species: form.species,
          breed: form.breed,
          sex: form.gender,
          birth_date: form.dob,
          age_value: form.ageValue,
          age_unit: form.ageUnit,
          color: form.markings,
          reason_for_visit: (form.reasonForVisit || '').trim(),
          screening_inputs: form.screeningInputs || {},
        },
        attachments,
      };
      const endpoint = editingIntakeId
        ? `${apiBase}/clinic-records/registration-intakes/${editingIntakeId}/resubmit`
        : `${apiBase}/clinic-records/registration-intakes`;
      const saved = await requestJson(endpoint, {
        method: editingIntakeId ? 'PUT' : 'POST',
        headers: authHeaders(user, true),
        body: JSON.stringify(payload),
      });
      if (saved.notification_sent !== true) throw new Error('The system did not confirm delivery of the veterinarian notification. Please retry.');
      announceRegistrationUpdate();
      const wasResubmission = Boolean(editingIntakeId);
      try {
        await loadIntakes();
        setLoadError('');
      } catch {
        setLoadError('The registration was saved and the veterinarian was notified, but the submissions list could not be refreshed.');
      }
      setConfirmOpen(false);
      setForm(emptyForm); setFiles([]); setSavedAttachments([]); setDoctor(null); setStep(0); setTab('submissions');
      setEditingIntakeId(null);
      setCorrectionNote('');
      try {
        localStorage.removeItem(getDraftKey(user));
      setSavedDraft(null);
      } catch {
        setLoadError('The registration was submitted, but its saved draft could not be removed from this device.');
      }
      notifySuccess(wasResubmission ? 'Corrected registration resubmitted' : `Registration sent to ${doctor.name}`, `The registration was saved and ${doctor.name} was notified.`);
    } catch (submitError) {
      setConfirmOpen(false);
      setError(submitError.message || 'Unable to save this registration.');
    } finally { setSaving(false); }
  };
  const editReturnedIntake = intake => {
    if (intake.status !== 'Waiting on reception') return;
    setForm(intake.form);
    setSavedAttachments(intake.attachments);
    setFiles([]);
    setDoctor(doctors.find(item => Number(item.id) === Number(intake.assignedDoctorId)) || null);
    setEditingIntakeId(intake.intakeId);
    setCorrectionNote(intake.correctionNote);
    setStep(0);
    setError('');
    setTab('new');
  };
  const startNewRegistration = () => {
    setForm(emptyForm);
    setFiles([]);
    setSavedAttachments([]);
    setDoctor(null);
    setEditingIntakeId(null);
    setCorrectionNote('');
    setStep(0);
    setError('');
    setTab('new');
  };

  const continueDraft = () => {
    if (!savedDraft) return;
    setForm({ ...emptyForm, ...savedDraft.form });
    setStep(Math.min(Math.max(Number(savedDraft.step) || 0, 0), 3));
    setDoctor(doctors.find(item => item.id === savedDraft.doctorId || item.name === savedDraft.doctor) || null);
    setEditingIntakeId(savedDraft.editingIntakeId || null);
    setSavedAttachments(savedDraft.savedAttachments || []);
    setCorrectionNote(savedDraft.correctionNote || '');
    setFiles([]); setError(''); setTab('new');
  };
  const deleteDraft = () => {
    try {
      localStorage.removeItem(getDraftKey(user)); setSavedDraft(null); return true;
    } catch { setLoadError('Unable to delete the draft on this device.'); return false; }
  };
  const selectedSubmission = allSubmissions.find(row => row.intakeId === submissionDialogId);
  return <div style={s.page}>
    {selectedSubmission && <RegistrationSubmissionDialog key={selectedSubmission.intakeId} row={selectedSubmission} user={user} onClose={() => setSubmissionDialogId(null)} onEdit={editReturnedIntake} onContinue={continueDraft} onDelete={deleteDraft} />}
    <Topbar user={user} title="New Patient Registration" subtitle="Register a new pet and owner, then send to an active veterinarian for approval" />
    <div style={s.content} className="patient-registration-content">
      <div style={s.tabs} className="patient-registration-tabs"><button type="button" className={tab === 'new' ? 'is-active' : ''} onClick={startNewRegistration} style={{ ...s.tab, ...(tab === 'new' ? s.activeTab : {}) }}>＋ New Registration</button><button type="button" className={tab === 'submissions' ? 'is-active' : ''} onClick={() => setTab('submissions')} style={{ ...s.tab, ...(tab === 'submissions' ? s.activeTab : {}) }}>My Submissions <b style={s.count}>{allSubmissions.length}</b></button></div>
      {loadError && <div style={s.error} role="alert">{loadError}</div>}
      {tab === 'submissions' ? <SubmissionTable
        submissions={visibleSubmissions}
        counts={submissionCounts}
        loading={loading}
        activeTab={submissionTab}
        onTabChange={setSubmissionTab}
        search={submissionSearch}
        onSearchChange={setSubmissionSearch}
        status={submissionStatus}
        onStatusChange={setSubmissionStatus}
        dateFrom={submittedFrom}
        onDateFromChange={setSubmittedFrom}
        dateTo={submittedTo}
        onDateToChange={setSubmittedTo}
        onAction={row => setSubmissionDialogId(row.intakeId)}
      /> : <div style={s.card} className="patient-registration-card">
        <Stepper step={step} />
        <div className="patient-registration-body">
          <div className="patient-registration-form-area">
            {step === 0 && <OwnerStep form={form} update={update} />}
            {step === 1 && <PetStep form={form} update={update} user={user} />}
            {step === 2 && <AttachmentStep files={files} setFiles={setFiles} savedAttachments={savedAttachments} />}
            {step === 3 && <DoctorStep doctor={doctor} setDoctor={setDoctor} doctors={doctors} loading={loading} loadError={doctorLoadError} />}
            {error && <div style={s.error}>{error}</div>}
            <div style={s.footer} className="patient-registration-footer">
              {step === 0
                ? <button type="button" onClick={cancelRegistration} style={s.secondary}>Cancel</button>
                : <button type="button" onClick={back} style={s.secondary}>Back</button>}
              <div className="patient-registration-footer-actions">
                <button type="button" onClick={saveDraft} style={s.secondary}>Save as Draft</button>
                {step < 3 ? <button type="button" onClick={next} style={{ ...s.continue, ...(stepComplete ? {} : s.disabledButton) }} disabled={!stepComplete}>Continue</button> : <button type="button" onClick={() => setConfirmOpen(true)} style={{ ...s.continue, ...(doctor ? {} : s.disabledButton) }} disabled={!doctor || saving}>Send to Doctor</button>}
              </div>
            </div>
          </div>
          {step === 3
            ? <RegistrationSummary form={form} doctor={doctor} attachmentCount={files.length + savedAttachments.length} />
            : <RegistrationProgress step={step} />}
        </div>
      </div>}
    </div>
    {confirmOpen && <ConfirmModal form={form} doctor={doctor} attachmentCount={files.length + savedAttachments.length} correctionNote={correctionNote} isResubmission={Boolean(editingIntakeId)} onClose={() => setConfirmOpen(false)} onConfirm={submit} saving={saving} />}
  </div>;
}

function Stepper({ step }) {
  return <div className="patient-registration-stepper">
    {STEPS.map((label, index) => <div key={label} className="patient-registration-step-wrap">
      <div className={`patient-registration-step${index === step ? ' is-active' : ''}${index < step ? ' is-done' : ''}`}>
        <span className="patient-registration-step-number">{index < step ? '✓' : index + 1}</span>
        <span>{label}</span>
      </div>
      {index < STEPS.length - 1 && <div className={`patient-registration-step-line${index < step ? ' is-done' : ''}`} />}
    </div>)}
  </div>;
}
function RegistrationProgress({ step }) {
  const descriptions = [
    "Record the pet owner's details.",
    "Add the pet's information.",
    'Upload relevant documents (optional).',
    'Send the registration to a doctor for review.',
  ];
  return <aside className="patient-registration-progress">
    <div className="patient-registration-progress-header"><h3>Registration Progress</h3><span>Step {step + 1} of {STEPS.length}</span></div>
    <div className="patient-registration-progress-track"><span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
    <ol>{STEPS.map((label, index) => <li key={label} className={index === step ? 'is-active' : index < step ? 'is-done' : ''}>
      <span className="patient-registration-progress-number">{index < step ? '✓' : index + 1}</span>
      <div><strong>{label}</strong><p>{descriptions[index]}</p></div>
    </li>)}</ol>
  </aside>;
}
function OwnerStep({ form, update }) {
  return <div className="patient-registration-owner">
    <SectionTitle text="Owner Information" subtitle="Enter the pet owner's details." />
    <div>
      <Field label="Full Name" required value={form.ownerName} onChange={v => update('ownerName', v)} placeholder="e.g. Maria Santos" />
      <div style={s.grid}>
        <Field label="Phone Number" required value={form.phone} onChange={v => update('phone', v)} placeholder="e.g. +63 917 000 0000" />
        <Field label="Email" required value={form.email} onChange={v => update('email', v)} placeholder="e.g. owner@email.com" />
      </div>
      <Field label="Address" value={form.address} onChange={v => update('address', v)} placeholder="e.g. 123 Main St., Sta. Maria, Bulacan" />
    </div>
  </div>;
}
function PetStep({ form, update, user }) {
  return <>
    <SectionTitle text="Pet Details" subtitle="Enter the pet's information." />
    <div className="patient-registration-pet-details">
      <div style={s.grid} className="patient-registration-pet-grid">
        <Field label="Pet Name" required value={form.petName} onChange={v => update('petName', v)} placeholder="e.g. Coco" />
        <Select label="Species" required value={form.species} onChange={v => update('species', v)} options={['Dog', 'Cat', 'Bird', 'Rabbit', 'Other']} />
        <Field label="Breed" value={form.breed} onChange={v => update('breed', v)} placeholder="e.g. Shih Tzu" />
        <Select label="Sex" required value={form.gender} onChange={v => update('gender', v)} options={['Male', 'Female']} />
        <label className="patient-registration-field patient-registration-age-field">
          <span>Date of Birth / Age<i className="patient-registration-required">*</i></span>
          <div className="patient-registration-age-row">
            <LabDateTimePicker
              className="patient-registration-age-date"
              mode="date"
              label="Date of birth"
              required
              value={form.dob}
              onChange={value => { update('dob', value); if (value) update('ageValue', ''); }}
            />
            <span className="patient-registration-age-or">or</span>
            <input type="number" min="0" step="1" aria-label="Age" placeholder="Age" value={form.ageValue} onChange={e => { update('ageValue', e.target.value); if (e.target.value) update('dob', ''); }} />
            <FilterSelect
              label="Age unit"
              value={form.ageUnit}
              onChange={value => update('ageUnit', value)}
              options={['Months', 'Years'].map(option => ({ value: option, label: option }))}
              className="patient-registration-select patient-registration-age-unit"
            />
          </div>
        </label>
        <div style={{ gridColumn: '1 / -1' }}><Field label="Color / Markings" value={form.markings} onChange={v => update('markings', v)} placeholder="e.g. White with brown spots" /></div>
        <label className="patient-registration-field" style={{ gridColumn: '1 / -1', padding: 12, border: '1px solid #cfe5dc', background: '#f2f9f5', borderRadius: 10 }}>
          <span>Reason for Visit / Reported Symptoms <small>(Optional)</small></span>
          <textarea rows={2} maxLength={1000} value={form.reasonForVisit || ''} onChange={event => update('reasonForVisit', event.target.value)} placeholder="e.g. Vomiting since yesterday, loss of appetite, or possible exposure" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '10px 12px', border: '1px solid #d4e0db', borderRadius: 8, font: 'inherit', fontSize: 13 }} />
          <small style={{ color: '#64748b' }}>Record what the owner reports for the veterinarian to review.</small>
        </label>
        <VisitScreeningFields value={form.screeningInputs} onChange={value=>update('screeningInputs',value)} user={user}/>

      </div>
    </div>
  </>;
}
function AttachmentStep({ files, setFiles, savedAttachments }) {
  const addFiles = selected => {
    if (!selected?.length) return;
    setFiles(current => [...current, ...Array.from(selected)]);
  };
  return <>
    <SectionTitle icon={Icons.file} text={<>Attachments <span style={{ fontWeight: 400 }}>(Optional)</span></>} />
    <div className="patient-registration-attachments">
      <p style={s.help}>Upload vaccine cards, previous medical records, or other relevant documents. Files will be attached to the intake for the reviewing veterinarian.</p>
      <label className="patient-registration-dropzone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(event.dataTransfer.files); }}>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={event => { addFiles(event.target.files); event.target.value = ''; }} />
        <span className="patient-registration-upload-icon" aria-hidden="true">⇧</span>
        <strong>Drag and drop files here, or click to upload</strong>
        <small>Accepted formats: PDF, JPG, PNG · Max size: 10 MB total</small>
      </label>
      {(savedAttachments.length > 0 || files.length > 0) && <>
        <h4 className="patient-registration-files-heading">Uploaded Files ({savedAttachments.length + files.length})</h4>
        <ul className="patient-registration-file-list">
          {savedAttachments.map(file => <li key={`saved-${file.id}`}><span className="patient-registration-file-icon">{file.content_type === 'application/pdf' ? 'PDF' : 'IMG'}</span><span className="patient-registration-file-name"><strong>{file.filename}</strong><small>Already attached to this registration</small></span></li>)}
          {files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`}><span className="patient-registration-file-icon">{file.type === 'application/pdf' ? 'PDF' : 'IMG'}</span><span className="patient-registration-file-name"><strong>{file.name}</strong><small>{(file.size / (1024 * 1024)).toFixed(2)} MB · {file.type.split('/')[1]?.toUpperCase()}</small></span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(current => current.filter((_, fileIndex) => fileIndex !== index))}>×</button></li>)}
        </ul>
      </>}
    </div>
  </>;
}

function DoctorStep({ doctor, setDoctor, doctors, loading, loadError }) {
  return <>
    <SectionTitle text="Assign Reviewing Veterinarian" subtitle="Select a veterinarian to review this registration and verify the patient information." />
    <div className="patient-registration-doctor-list">
      {loading && <p style={s.help}>Loading clinic veterinarians…</p>}
      {!loading && loadError && <p role="alert" className="patient-registration-empty-doctors">{loadError}</p>}{!loading && !loadError && doctors.length === 0 && <p className="patient-registration-empty-doctors">No active veterinarians are assigned to this clinic.</p>}
      {doctors.map(item => <button
        type="button"
        key={item.id}
        aria-pressed={Number(doctor?.id) === Number(item.id)}
        onClick={() => setDoctor(item)}
        className={`patient-registration-doctor-card${Number(doctor?.id) === Number(item.id) ? ' is-selected' : ''}`}
      >
        <span className="patient-registration-doctor-avatar">{item.name.split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase()}</span>
        <span className="patient-registration-doctor-copy"><strong>{item.name}</strong><small>{item.specialty}</small></span>
        <span className="patient-registration-doctor-queue">{item.queue} for review</span>
        <span className="patient-registration-doctor-status"><i />Active</span>
        <span className="patient-registration-doctor-radio" aria-hidden="true" />
      </button>)}
    </div>
  </>;
}

function RegistrationSummary({ form, doctor, attachmentCount }) {
  const petAge = form.dob ? `Born ${form.dob}` : form.ageValue ? `${form.ageValue} ${form.ageUnit.toLowerCase()} old` : 'Age not provided';
  return <aside className="patient-registration-summary">
    <h3>Registration Summary</h3>
    <p>Review the registration details before sending.</p>
    <div className="patient-registration-summary-section">
      <strong>Owner</strong><b>{form.ownerName || 'Owner not entered'}</b>
      <span>{form.phone || 'Phone not entered'} · {form.email || 'Email not entered'}</span>
    </div>
    <div className="patient-registration-summary-section">
      <strong>Pet</strong><b>{form.petName || 'Pet not entered'}</b>
      <span>{[form.species, form.breed, petAge, form.gender].filter(Boolean).join(' · ')}</span>
    </div>
    <div className="patient-registration-summary-section">
      <strong>Attachments</strong><span>{attachmentCount} {attachmentCount === 1 ? 'file' : 'files'}</span>
    </div>
    <div className="patient-registration-summary-vet">
      <strong>Selected Veterinarian</strong>
      <b>{doctor?.name || 'No veterinarian selected'}</b>
      {doctor && <span>{doctor.specialty}</span>}
    </div>
  </aside>;
}

function ConfirmModal({ form, doctor, attachmentCount, correctionNote, isResubmission, onClose, onConfirm, saving }) {
  const petAge = form.dob ? `Born ${form.dob}` : `${form.ageValue} ${form.ageUnit.toLowerCase()} old`;
  return <div style={s.backdrop}>
    <div className="patient-registration-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="registration-confirm-title">
      <button type="button" aria-label="Close confirmation" onClick={onClose} style={s.close}>×</button>
      <h2 id="registration-confirm-title">{isResubmission ? 'Resubmit for Doctor Review?' : 'Send for Doctor Review?'}</h2>
      <p className="patient-registration-confirm-subtitle">Once sent, this registration will be locked while the assigned veterinarian reviews it.</p>
      {isResubmission && correctionNote && <div className="patient-registration-correction-note"><strong>Correction requested</strong><span>{correctionNote}</span></div>}
      <div className="patient-registration-confirm-patient">
        <div><small>Pet</small><strong>{form.petName}</strong><span>{[form.species, form.gender, petAge].filter(Boolean).join(' · ')}</span></div>
        <div><small>Owner</small><strong>{form.ownerName}</strong><span>{form.phone}</span></div>
      </div>
      <div className="patient-registration-confirm-details">
        <div><small>Reviewing Veterinarian</small><strong>{doctor?.name}</strong><span>{doctor?.specialty}</span><em>Active</em></div>
        <div><small>Attachments</small><span>{attachmentCount} {attachmentCount === 1 ? 'file' : 'files'}</span></div>
      </div>
      <div className="patient-registration-confirm-notice">The registration will be marked <strong>Needs review</strong>, and the veterinarian will be notified. You can edit and resubmit it if the veterinarian returns it for correction.</div>
      <div className="patient-registration-confirm-actions">
        <button type="button" onClick={onClose} style={s.secondary}>Cancel</button>
        <button type="button" onClick={onConfirm} style={s.confirmButton} disabled={saving}>{saving ? 'Saving…' : isResubmission ? 'Confirm & Resubmit' : 'Confirm & Send'}</button>
      </div>
    </div>
  </div>;
}

function SubmissionTable({
  submissions,
  counts,
  loading,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  status,
  onStatusChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onAction,
}) {
  const tabs = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'draft', label: 'Drafts', count: counts.draft },
    { id: 'rejected', label: 'Rejected', count: counts.rejected },
    { id: 'pending', label: 'Pending Approval', count: counts.pending },
    { id: 'approved', label: 'Approved', count: counts.approved },
    { id: 'changes', label: 'Changes Requested', count: counts.changes },
  ];
  const statusOptions = [...new Set(['Draft', 'Needs review', 'Approved', 'Waiting on reception', 'Rejected', 'Duplicated', 'Withdrawn'])];

  return <section className="patient-submissions">
    <header className="patient-submissions-header">
      <div>
        <h2>My Submitted Registrations</h2>
        <p>View and track the status of patient registrations you have submitted.</p>
      </div>
    </header>
    <nav className="patient-submissions-tabs" aria-label="Filter registrations by status">
      {tabs.map(item => (
        <button key={item.id} type="button" className={`patient-submissions-tab${activeTab === item.id ? ' is-active' : ''}`} aria-pressed={activeTab === item.id} onClick={() => onTabChange(item.id)}>
          {item.label}{item.id === 'all' && <span>{item.count}</span>}
        </button>
      ))}
    </nav>
    <div className="patient-submissions-filters">
      <label className="patient-submissions-search">
        <span aria-hidden="true">{Icons.search}</span>
        <input aria-label="Search registrations" placeholder="Search registration, pet, owner..." value={search} onChange={event => onSearchChange(event.target.value)} />
      </label>
      <DateRangeFilter label="Submitted date range" dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={onDateFromChange} onDateToChange={onDateToChange} />
      <FilterSelect
        className="patient-submissions-status-filter"
        label="Filter by registration status"
        value={status}
        onChange={onStatusChange}
        options={[
          { value: 'all', label: 'All Statuses' },
          ...statusOptions.map(option => ({ value: option.toLowerCase(), label: registrationStatusLabel(option) })),
        ]}
      />
    </div>
    <div className="patient-registration-submissions-wrap patient-submissions-table-wrap">
      <table className="patient-submissions-table">
        <thead><tr>{['ID', 'Pet', 'Owner', 'Assigned Doctor', 'Submitted', 'Status', ''].map(heading => <th key={heading} aria-label={heading || 'Registration actions'}>{heading}</th>)}</tr></thead>
        <tbody>
          {loading
            ? <tr><td colSpan="7" className="patient-submissions-empty">Loading submitted registrations…</td></tr>
            : submissions.map(row => (
              <tr key={row.intakeId} className="clinic-action-row" tabIndex={0} aria-label={`Open actions for ${row.id}`} aria-haspopup="dialog"
                onClick={() => onAction(row)}
                onKeyDown={event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onAction(row); } }}>
                <td className="patient-submissions-id">{row.id}</td>
                <td><div className="patient-submissions-pet"><div><strong>{row.pet || 'Unnamed pet'}</strong><small>{row.species || 'Species not provided'}</small></div></div></td>
                <td>{row.owner || '—'}</td>
                <td>{row.doctor || '—'}</td>
                <td>{row.submitted || '—'}</td>
                <td><StatusIndicator status={row.status} className={`patient-submissions-status-${getSubmissionStatusTone(row.status)}`} label={getSubmissionStatusLabel(row.status)} /></td>
                <td className="clinic-compact-chevron"><button type="button" className="clinic-record-actions-trigger" onClick={event => { event.stopPropagation(); onAction(row); }} aria-label={`Open actions for ${row.id}`} aria-haspopup="dialog" title={`Registration actions for ${row.id}`}>{Icons.chevronRight}</button></td>
              </tr>
            ))}
          {!loading && !submissions.length && <tr><td colSpan="7" className="patient-submissions-empty">No registrations match these filters.</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}

function getSubmissionStatusLabel(status) { return registrationStatusLabel(status); }

function getSubmissionStatusTone(status) {
  if (status === 'Approved') return 'good';
  if (status === 'Needs review') return 'attention';
  if (status === 'Waiting on reception') return 'attention';
  if (status === 'Rejected' || status === 'Duplicated') return 'urgent';
  return 'inactive';
}
function SectionTitle({ icon, text, subtitle }) { return <div className="patient-registration-section-title">{icon && <span>{icon}</span>}<div><h3>{text}</h3>{subtitle && <p>{subtitle}</p>}</div></div>; }
function Field({ label, value, onChange, placeholder, type = 'text', required = false }) { return <label style={s.label} className="patient-registration-field"><span>{label}{required && <i className="patient-registration-required">*</i>}</span><input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={s.input} /></label>; }
function Select({ label, value, onChange, options, required = false }) {
  const placeholderValue = '__no_selection__';
  return <label style={s.label} className="patient-registration-field">
    <span>{label}{required && <i className="patient-registration-required">*</i>}</span>
    <FilterSelect
      label={label}
      value={value || placeholderValue}
      onChange={nextValue => onChange(nextValue === placeholderValue ? '' : nextValue)}
      options={[
        { value: placeholderValue, label: `Select ${label.toLowerCase()}` },
        ...options.map(option => ({ value: option, label: option })),
      ]}
      className={`patient-registration-select${value ? '' : ' is-placeholder'}`}
    />
  </label>;
}

const s = {
  page: { flex: 1, overflowY: 'auto', background: '#f7f9fc', color: '#172033' }, content: { padding: '22px 24px' }, tabs: { display: 'flex', gap: 8, marginBottom: 16 }, tab: { border: '1px solid #dbe3ee', borderRadius: 8, background: '#fff', color: '#53627a', padding: '8px 12px', fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }, activeTab: { background: '#086b50', borderColor: '#013826', color: '#fff' }, count: { display: 'inline-grid', placeItems: 'center', width: 18, height: 18, marginLeft: 5, borderRadius: 9, background: '#f59e0b', color: '#fff', fontSize: '.68rem' }, card: { background: '#fff', border: '1px solid #e3e9f1', borderRadius: 14, padding: '24px 20px 18px', boxShadow: '0 1px 2px rgba(15,23,42,.04)' }, cardTitle: { margin: 0, fontSize: '.92rem', fontWeight: 700 }, stepper: { display: 'flex', alignItems: 'center', margin: '36px 10px 28px', color: '#9aaac0' }, stepWrap: { display: 'flex', alignItems: 'center', flex: 1 }, step: { display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', fontSize: '.73rem', fontWeight: 700 }, stepActive: { background: '#086b50', color: '#fff', borderRadius: 9, padding: '8px 10px' }, stepDone: { color: '#013826' }, line: { height: 1, background: '#dbe3ee', flex: 1, margin: '0 10px' }, lineDone: { background: '#086b50' }, formArea: { minHeight: 292, borderBottom: '1px solid #edf1f6' }, sectionTitle: { display: 'flex', gap: 8, alignItems: 'center', margin: '0 0 14px', color: '#53627a', fontSize: '.76rem' }, narrow: { maxWidth: 570 }, grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }, label: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14, color: '#182235', fontSize: '.73rem', fontWeight: 500 }, input: { width: '100%', boxSizing: 'border-box', border: 0, borderRadius: 7, background: '#f1f2f5', padding: '9px 11px', color: '#1f2937', fontSize: '.75rem', fontWeight: 400, outline: 'none' }, help: { color: '#53627a', fontSize: '.72rem', lineHeight: 1.45 }, upload: { width: 546, maxWidth: '100%', height: 148, boxSizing: 'border-box', marginTop: 12, paddingTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, border: '2px dashed #cbd9ea', borderRadius: 12, color: '#53627a', cursor: 'pointer', fontSize: '.75rem', fontWeight: 400 }, uploadIcon: { fontSize: '2rem', lineHeight: 1, color: '#c4d1e2', marginBottom: 3 }, footer: { display: 'flex', justifyContent: 'space-between', paddingTop: 16 }, secondary: { border: '1px solid #dbe3ee', borderRadius: 7, background: '#fff', color: '#182235', padding: '7px 11px', fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }, continue: { border: 0, borderRadius: 7, background: '#086b50', color: '#fff', padding: '8px 12px', fontSize: '.72rem', fontWeight: 700, cursor: 'pointer' }, disabledButton: { background: '#8d8f9b', cursor: 'not-allowed' }, error: { margin: '12px 0 0', padding: 10, borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: '.75rem' }, doctor: { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 10, marginBottom: 8, textAlign: 'left', border: '1px solid #e1e8f1', borderRadius: 11, background: '#fff', cursor: 'pointer' }, doctorSelected: { border: '2px solid #013826' }, avatar: { width: 31, height: 31, display: 'grid', placeItems: 'center', borderRadius: 50, background: '#e8eef8', color: '#52657e', fontWeight: 700 }, doctorText: { display: 'flex', flexDirection: 'column', flex: 1, gap: 2, fontSize: '.75rem' }, queue: { color: '#53627a', fontSize: '.7rem' }, status: { marginLeft: 'auto', flexShrink: 0, borderRadius: 14, padding: '5px 9px', fontSize: '.68rem', fontStyle: 'normal', fontWeight: 500 }, available: { background: '#dcfce7', color: '#16a34a' }, onduty: { background: '#d8f4e8', color: '#013826' }, busy: { background: '#fef3c7', color: '#d97706' }, submissionHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 24 }, darkButton: { border: 0, borderRadius: 7, background: '#080b18', color: '#fff', padding: '7px 10px', fontSize: '.7rem', fontWeight: 700 }, table: { width: '100%', borderCollapse: 'collapse', color: '#4b5a70', fontSize: '.73rem' }, pending: { padding: '4px 8px', borderRadius: 10, background: '#d8f4e8', color: '#013826' }, backdrop: { position: 'fixed', inset: 0, zIndex: 20, display: 'grid', placeItems: 'center', background: 'rgba(15,23,42,.52)' }, modal: { position: 'relative', width: 490, maxWidth: 'calc(100% - 32px)', padding: 26, borderRadius: 10, background: '#fff', boxShadow: '0 20px 50px rgba(15,23,42,.28)' }, close: { position: 'absolute', top: 12, right: 14, border: 0, background: 'none', fontSize: 21, color: '#64748b', cursor: 'pointer' }, modalTitle: { margin: 0, fontSize: '1.18rem', fontWeight: 700 }, modalSubtitle: { margin: '9px 0 17px', color: '#53627a', fontSize: '.8rem' }, summary: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, padding: 15, borderRadius: 10, background: '#f8fafc', color: '#53627a', fontSize: '.72rem' }, summaryItem: { display: 'flex', flexDirection: 'column', gap: 5, color: '#53627a', fontWeight: 400 }, summaryValue: { color: '#1f2937', fontWeight: 500, fontSize: '.78rem' }, selectedDoctor: { display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 10, margin: '14px 0', padding: 14, border: '1px solid #dbe3ee', borderRadius: 9, fontSize: '.8rem' }, notice: { padding: 12, borderRadius: 9, background: '#e7f4ec', color: '#013826', fontSize: '.76rem', textAlign: 'center' }, modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 17 }, confirmButton: { border: 0, borderRadius: 7, background: '#086b50', color: '#fff', padding: '10px 14px', fontSize: '.76rem', fontWeight: 700, cursor: 'pointer' },
};
