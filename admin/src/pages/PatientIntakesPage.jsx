import { useMemo, useState } from 'react';
import Topbar from '../components/Topbar';
import StatusIndicator from '../components/StatusIndicator';
import { Icons } from '../icons';
import { notifySuccess } from '../utils/notifications';
import { formatDateText } from '../utils/dateFormatting';

const INITIAL_INTAKES = [
  {
    id: 'INT-001',
    tag: 'NEW',
    pet: 'Coco',
    owner: 'Maria Santos',
    email: 'maria.santos@email.com',
    species: 'Dog',
    breed: 'Shih Tzu',
    phone: '+63 917 888 1234',
    received: 'September 30, 2026',
    receivedMeta: '9:18 AM',
    submittedBy: 'Emily Rodriguez',
    status: 'Needs review',
    reason: 'First-time visit. Owner reports puppy has been sneezing frequently.',
    ownerAddress: '123 Mabini St, Quezon City',
    age: '5 months',
    gender: 'Male',
    dateOfBirth: '2023-04-10',
    weight: '5 kg',
    color: 'White & Brown',
    allergies: 'None reported',
    attachmentName: 'Coco_Vaccine_Card.jpg',
    attachmentMeta: 'Vaccine card · uploaded by Emily Rodriguez',
    activity: ['Intake submitted by Emily Rodriguez', 'Vaccine card attached'],
  },
  {
    id: 'INT-002',
    tag: 'UPDATED',
    pet: 'Pepper',
    owner: 'Luis Fernandez',
    email: 'luis.fernandez@email.com',
    species: 'Cat',
    breed: 'Scottish Fold',
    phone: '+63 920 777 5678',
    received: 'September 28, 2026',
    receivedMeta: '2:30 PM · by Emily',
    submittedBy: 'Emily Rodriguez',
    status: 'Waiting on reception',
    alert: true,
    reason: 'Updated patient registration submitted for reception review.',
    ownerAddress: 'Makati City, Metro Manila',
    age: '2 years',
    gender: 'Female',
    dateOfBirth: '2024-02-16',
    weight: '4 kg',
    color: 'Gray',
    allergies: 'Not recorded',
    attachmentName: '',
    attachmentMeta: '',
    activity: ['Updated intake submitted by Emily Rodriguez'],
  },
  {
    id: 'INT-003',
    tag: 'APPROVED',
    pet: 'Nala',
    owner: 'Grace Villanueva',
    email: 'grace.villanueva@email.com',
    species: 'Dog',
    breed: 'Golden Retriever',
    phone: '+63 912 333 9999',
    received: 'September 26, 2026',
    receivedMeta: '10:05 AM · by Emily',
    submittedBy: 'Emily Rodriguez',
    status: 'Approved',
    reason: 'Routine wellness visit.',
    ownerAddress: 'Pasig City, Metro Manila',
    age: '4 years',
    gender: 'Female',
    dateOfBirth: '2022-01-09',
    weight: '28 kg',
    color: 'Golden',
    allergies: 'None reported',
    attachmentName: '',
    attachmentMeta: '',
    activity: ['Intake submitted by Emily Rodriguez', 'Registration approved'],
  },
];

const FILTERS = ['All', 'Needs review', 'Waiting on reception', 'Approved', 'Rejected'];
const CORRECTION_REASONS = [
  'Missing vaccine record',
  'Incomplete address',
  'Unclear medical history',
  'Owner contact',
  'Other',
];
const DOCTORS = ['Dr. Yna Amante', 'Dr. Emily Rodriguez', 'Dr. Marco Santos'];

function IntakeStatus({ status }) {
  return <StatusIndicator status={status} style={{ fontSize: '12px', fontWeight: 600 }} />;
}

function FilterIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 6h16M7 12h10m-7 6h4" />
    </svg>
  );
}

function AlertIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 3h.01" /></svg>;
}

export default function PatientIntakesPage({ user }) {
  const [intakes, setIntakes] = useState(INITIAL_INTAKES);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('Newest');
  const [speciesFilter, setSpeciesFilter] = useState('All species');
  const [showFilter, setShowFilter] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionReasons, setCorrectionReasons] = useState([]);
  const [correctionNote, setCorrectionNote] = useState('');
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [assignedDoctor, setAssignedDoctor] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const selected = intakes.find(item => item.id === selectedId);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return intakes
      .filter(item => activeFilter === 'All'
        || (activeFilter === 'Rejected' ? ['Rejected', 'Duplicated'].includes(item.status) : item.status === activeFilter))
      .filter(item => speciesFilter === 'All species' || item.species === speciesFilter)
      .filter(item => !query || [item.id, item.pet, item.owner, item.species, item.breed, item.status]
        .some(value => value.toLowerCase().includes(query)))
      .sort((first, second) => sortOrder === 'Newest'
        ? intakes.indexOf(first) - intakes.indexOf(second)
        : intakes.indexOf(second) - intakes.indexOf(first));
  }, [activeFilter, intakes, search, sortOrder, speciesFilter]);

  const countFor = status => intakes.filter(item => status === 'Rejected'
    ? ['Rejected', 'Duplicated'].includes(item.status)
    : item.status === status).length;
  const updateStatus = (intake, status, message, sendNotification = true) => {
    setIntakes(current => current.map(item => item.id === intake.id
      ? { ...item, status, activity: [message, ...item.activity] }
      : item));
    setShowMoreActions(false);
    if (sendNotification) {
      notifySuccess(message, `${intake.pet}'s registration status is now ${status.toLowerCase()}.`);
    }
  };

  const submitCorrectionRequest = () => {
    if (!selected || correctionReasons.length === 0) return;
    const detail = correctionNote.trim();
    const message = `Correction requested: ${correctionReasons.join(', ')}${detail ? ` — ${detail}` : ''}`;
    updateStatus(selected, 'Waiting on reception', message, false);
    notifySuccess('Correction request sent to reception', `${selected.pet}'s intake was returned to reception. Reason: ${correctionReasons.join(', ')}${detail ? ` — ${detail}` : ''}`);
    setCorrectionReasons([]);
    setCorrectionNote('');
    setShowCorrectionModal(false);
  };

  const markDuplicate = () => {
    if (!selected) return;
    const message = 'Registration marked as duplicate';
    setIntakes(current => current.map(item => item.id === selected.id
      ? { ...item, status: 'Duplicated', tag: 'DUPLICATE', activity: [message, ...item.activity] }
      : item));
    notifySuccess('Duplicate intake reported to reception', `${selected.pet}'s registration (${selected.id}) was marked as duplicated. Reception was notified.`);
    setShowMoreActions(false);
  };

  const toggleCorrectionReason = reason => {
    setCorrectionReasons(current => current.includes(reason)
      ? current.filter(item => item !== reason)
      : [...current, reason]);
  };

  const reassignIntake = () => {
    const reason = reassignReason.trim();
    if (!selected || !assignedDoctor || !reason) return;
    const message = `Intake reassigned to ${assignedDoctor}: ${reason}`;
    setIntakes(current => current.map(item => item.id === selected.id
      ? { ...item, assignedDoctor, activity: [message, ...item.activity] }
      : item));
    notifySuccess('Intake reassigned', `${selected.pet}'s intake was assigned to ${assignedDoctor}. Reason: ${reason}`);
    setAssignedDoctor('');
    setReassignReason('');
    setShowReassignModal(false);
    setShowMoreActions(false);
  };

  const submitRejection = () => {
    if (!selected) return;
    const reason = rejectionReason.trim();
    if (!reason || !rejectionType) return;
    const isDuplicate = rejectionType === 'duplicate';
    const actionText = isDuplicate ? 'marked as a duplicate' : 'rejected';
    const message = isDuplicate
      ? `Registration marked as duplicate: ${reason}`
      : `Registration rejected: ${reason}`;
    setIntakes(current => current.map(item => item.id === selected.id
      ? {
        ...item,
        status: 'Rejected',
        tag: isDuplicate ? 'DUPLICATE' : item.tag,
        rejectionReason: reason,
        activity: [message, ...item.activity],
      }
      : item));
    notifySuccess(
      isDuplicate ? 'Duplicate intake reported to reception' : 'Rejected intake reported to reception',
      `${selected.pet}'s registration was ${actionText}. Reception was notified. Reason: ${reason}`,
    );
    setRejectionType('');
    setRejectionReason('');
    setShowRejectionModal(false);
    setShowMoreActions(false);
  };

  const searchControl = (
    <label className="intake-top-search">
      <span>{Icons.search}</span>
      <input aria-label="Search intakes" placeholder="Search pet, owner, or ID..." value={search} onChange={event => setSearch(event.target.value)} />
    </label>
  );

  return (
    <div className="intake-shell" style={styles.shell}>
      <style>{responsiveStyles}</style>
      <Topbar className="intake-topbar" user={user} title="New Patient Intakes" subtitle="Review and approve new patient registrations submitted by receptionists." actions={searchControl} />
      <main className="intake-content" style={styles.content}>
        <section className="intake-summary" aria-label="Intake summary">
          {[
            ['Needs review', countFor('Needs review'), 'Waiting for your review', '#3d78ff', '#eff4ff', Icons.clock],
            ['Waiting on reception', countFor('Waiting on reception'), 'Sent back to reception', '#c96d08', '#fff7e9', Icons.refresh],
            ['Approved', countFor('Approved'), 'Patient records created', '#15966c', '#eaf8f1', Icons.check],
            ['Rejected', countFor('Rejected'), 'Registrations declined', '#e64c4c', '#fff0f0', Icons.xCircle],
          ].map(([label, value, caption, color, tint, icon]) => (
            <button
              key={label}
              type="button"
              aria-pressed={activeFilter === label}
              onClick={() => setActiveFilter(label)}
              className={`intake-summary-card${activeFilter === label ? ' intake-summary-card-active' : ''}`}
              style={styles.summaryCard}
            >
              <span style={{ ...styles.summaryIcon, color, background: tint }}>{icon}</span>
              <span style={styles.summaryCopy}>
                <span style={styles.summaryLabel}>{label}</span>
                <strong style={styles.summaryValue}>{value}</strong>
                <span style={styles.summaryCaption}>{caption}</span>
              </span>
            </button>
          ))}
        </section>

        <div className="intake-controls">
          <div className="intake-tabs" role="tablist" aria-label="Filter by intake status">
            {FILTERS.map(filter => {
              const count = filter === 'All' ? intakes.length : countFor(filter);
              return (
                <button key={filter} type="button" role="tab" aria-selected={activeFilter === filter} onClick={() => setActiveFilter(filter)} className={`intake-tab${activeFilter === filter ? ' intake-tab-active' : ''}`}>
                  {filter} ({count})
                </button>
              );
            })}
          </div>
          <div className="intake-toolbar">
            <label className="intake-sort">
              <span className="sr-only">Sort intakes</span>
              <select value={sortOrder} onChange={event => setSortOrder(event.target.value)}>
                <option value="Newest">Sort: Newest</option>
                <option value="Oldest">Sort: Oldest</option>
              </select>
            </label>
            <div className="intake-filter-wrap">
              <button type="button" aria-label="Filter by species" aria-expanded={showFilter} className="intake-filter-button" onClick={() => setShowFilter(current => !current)}><FilterIcon /></button>
              {showFilter && (
                <label className="intake-filter-menu">
                  Species
                  <select value={speciesFilter} onChange={event => setSpeciesFilter(event.target.value)}>
                    <option>All species</option><option>Dog</option><option>Cat</option><option>Rabbit</option>
                  </select>
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="intake-table-wrap">
          <table className="intake-table">
            <thead><tr><th>ID</th><th>Pet</th><th>Owner</th><th>Received</th><th>Status</th><th><span className="sr-only">View details</span></th></tr></thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} onClick={() => { setSelectedId(item.id); setShowMoreActions(false); setShowActivity(false); setPreviewAttachment(false); }} className={selectedId === item.id ? 'intake-row-selected' : ''}>
                  <td><span className="intake-id">{item.id}</span></td>
                  <td>
                    <div className="intake-pet-name">
                      <strong>{item.pet}</strong>
                      {item.attachmentName && <span className="intake-listing-indicator">Attachment</span>}
                      {item.alert && <span className="intake-listing-indicator intake-listing-alert">Needs attention</span>}
                    </div>
                    <div className="intake-pet-meta">{item.species} · {item.breed}</div>
                    <div className="intake-pet-meta">{item.age || 'Age not recorded'} · {item.gender || 'Sex not recorded'}</div>
                  </td>
                  <td>
                    <div className="intake-owner">{item.owner}</div>
                    <div className="intake-phone">{item.phone}</div>
                    {item.email && <div className="intake-phone">{item.email}</div>}
                  </td>
                  <td><span className="intake-date">{item.received}</span><span className="intake-received-meta">{item.receivedMeta}</span><span className="intake-received-meta">Submitted by {item.submittedBy || '—'}</span></td>
                  <td><IntakeStatus status={item.status} /></td>
                  <td><button type="button" aria-label={`View ${item.pet} intake details`} className="intake-open" onClick={event => { event.stopPropagation(); setSelectedId(item.id); }}>›</button></td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan="6" className="intake-empty">No patient intakes match your search or filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>

      {selected && (
        <div className="intake-detail-backdrop" aria-hidden="true" onClick={() => { setSelectedId(null); setShowMoreActions(false); setShowActivity(false); setPreviewAttachment(false); }} />
      )}
      {selected && (
        <aside className="intake-detail-panel" role="dialog" aria-modal="false" aria-label={`${selected.pet} intake details`}>
          <header className="intake-detail-head">
            <div className="intake-detail-heading">
              <h2>Intake – {selected.id}</h2>
              <p>Submitted by {selected.submittedBy} · {selected.received} · {selected.receivedMeta.split(' · ')[0]}</p>
              <IntakeStatus status={selected.status} />
            </div>
            <button type="button" aria-label="Close details" onClick={() => { setSelectedId(null); setShowMoreActions(false); setPreviewAttachment(false); }}>{Icons.close}</button>
          </header>
          <div className="intake-detail-body">
            <section className="intake-reason">
              <span>Reason for visit</span>
              <p>{selected.reason}</p>
            </section>
            <section className="intake-detail-section">
              <h3><span>{Icons.user}</span> Owner information</h3>
              <div className="intake-detail-grid">
                <Detail label="Full name" value={selected.owner} />
                <Detail label="Phone" value={selected.phone} link />
                <Detail label="Email" value={selected.email} />
                <Detail label="Address" value={selected.ownerAddress} />
              </div>
            </section>
            <section className="intake-detail-section">
              <h3><span>{Icons.pet}</span> Pet information</h3>
              <div className="intake-detail-grid">
                <Detail label="Pet name" value={selected.pet} />
                <Detail label="Species" value={selected.species} />
                <Detail label="Breed" value={selected.breed} />
                <Detail label="Gender" value={selected.gender} />
                <Detail label="Date of birth" value={formatDateText(selected.dateOfBirth)} />
                <Detail label="Weight" value={selected.weight} />
                <Detail label="Color" value={selected.color} />
                <Detail label="Known allergies" value={selected.allergies} />
              </div>
            </section>
            <section className="intake-detail-section">
              <h3><span>{Icons.file}</span> Attached files</h3>
              {selected.attachmentName
                ? <>
                  <div className="intake-attachment"><span>{Icons.file}</span><div><strong>{selected.attachmentName}</strong><small>{selected.attachmentMeta}</small></div><button type="button" aria-expanded={previewAttachment} onClick={() => setPreviewAttachment(current => !current)}>{previewAttachment ? 'Hide' : 'Preview'}</button></div>
                  {previewAttachment && <div className="intake-file-preview" role="region" aria-label={`Preview of ${selected.attachmentName}`}>Preview of {selected.attachmentName} opens here</div>}
                </>
                : <p className="intake-no-attachment">No files attached.</p>}
            </section>
            <section className="intake-detail-section intake-activity">
              <button type="button" className="intake-activity-toggle" aria-expanded={showActivity} onClick={() => setShowActivity(current => !current)}>
                <h3><span>{Icons.clock}</span> Activity ({selected.activity.length})</h3>
                {showActivity ? '−' : '+'}
              </button>
              {showActivity && selected.activity.map((entry, index) => <p key={`${entry}-${index}`}><i />{entry}</p>)}
            </section>
          </div>
          <footer className={`intake-detail-actions${selected.status === 'Approved' ? ' intake-detail-actions-approved' : ''}`}>
            {selected.status === 'Approved' ? (
              <button type="button" className="intake-approve-button" onClick={() => notifySuccess('Patient record opened', `${selected.pet}'s patient record is ready to view.`)}>Open patient record</button>
            ) : (
              <>
                <div className="intake-more-wrap">
                  <button type="button" className="intake-more-button" onClick={() => setShowMoreActions(current => !current)}>More</button>
                  {showMoreActions && (
                    <div className="intake-more-menu">
                      <button type="button" onClick={() => { setAssignedDoctor(selected.assignedDoctor || ''); setReassignReason(''); setShowReassignModal(true); setShowMoreActions(false); }}>Reassign to another doctor</button>
                      <button type="button" onClick={markDuplicate}>Mark as duplicate</button>
                      <button type="button" className="intake-more-reject" onClick={() => { setRejectionReason(''); setShowRejectionModal(true); setShowMoreActions(false); }}>Reject registration</button>
                    </div>
                  )}
                </div>
                <button type="button" className="intake-correction-button" onClick={() => { setCorrectionReasons([]); setCorrectionNote(''); setShowCorrectionModal(true); }}>Request correction</button>
                <button type="button" className="intake-approve-button" onClick={() => updateStatus(selected, 'Approved', 'Registration approved; patient record created')}><span>{Icons.check}</span> Approve registration</button>
              </>
            )}
          </footer>
        </aside>
      )}
      {showCorrectionModal && selected && (
        <div className="correction-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowCorrectionModal(false); }}>
          <section className="correction-modal" role="dialog" aria-modal="true" aria-labelledby="correction-modal-title">
            <header className="correction-modal-header">
              <div className="correction-modal-title">
                <span><AlertIcon /></span>
                <h2 id="correction-modal-title">Request correction</h2>
              </div>
              <button type="button" aria-label="Close correction request" className="correction-modal-close" onClick={() => setShowCorrectionModal(false)}>{Icons.close}</button>
            </header>
            <p>Tap what is missing. Reception is notified right away.</p>
            <div className="correction-patient-summary">
              <div>
                <strong>{selected.pet}</strong>
                <span>{selected.species} · {selected.breed} · {selected.id}</span>
              </div>
            </div>
            <div className="correction-reason-heading">
              <strong>Correction needed</strong>
              <span>Select all that apply</span>
            </div>
            <div className="correction-reasons" role="group" aria-label="Correction reasons">
              {CORRECTION_REASONS.map(reason => (
                <label key={reason} className="correction-reason-row">
                  <input type="checkbox" checked={correctionReasons.includes(reason)} onChange={() => toggleCorrectionReason(reason)} />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
            <label className="correction-note-label" htmlFor="correction-note">Additional details <span>(optional)</span></label>
            <textarea id="correction-note" className="correction-note" maxLength={500} value={correctionNote} onChange={event => setCorrectionNote(event.target.value)} placeholder="Add a note (optional)" />
            <div className="correction-note-count">{correctionNote.length}/500</div>
            <div className="correction-notification"><span>{Icons.info}</span> Reception will be notified immediately.</div>
            <div className="correction-modal-actions">
              <button type="button" className="correction-cancel" onClick={() => setShowCorrectionModal(false)}>Cancel</button>
              <button type="button" className="correction-submit" disabled={correctionReasons.length === 0} onClick={submitCorrectionRequest}>Send to reception</button>
            </div>
          </section>
        </div>
      )}
      {showReassignModal && selected && (
        <div className="correction-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowReassignModal(false); }}>
          <section className="reassign-modal" role="dialog" aria-modal="true" aria-labelledby="reassign-modal-title">
            <header className="correction-modal-header">
              <div className="reassign-title">
                <span>{Icons.refresh}</span>
                <h2 id="reassign-modal-title">Reassign Intake</h2>
              </div>
              <button type="button" aria-label="Close reassignment" className="correction-modal-close" onClick={() => setShowReassignModal(false)}>{Icons.close}</button>
            </header>
            <p>Transfer this intake to another available doctor. All data will be preserved.</p>
            <label className="reassign-label" htmlFor="reassign-doctor">Transfer To<span className="system-required-star">*</span></label>
            <select id="reassign-doctor" className="reassign-select" value={assignedDoctor} onChange={event => setAssignedDoctor(event.target.value)}>
              <option value="">Select doctor</option>
              {DOCTORS.map(doctor => <option key={doctor}>{doctor}</option>)}
            </select>
            <label className="reassign-label" htmlFor="reassign-reason">Reason for Reassignment<span className="system-required-star">*</span></label>
            <textarea id="reassign-reason" className="reassign-reason" value={reassignReason} onChange={event => setReassignReason(event.target.value)} placeholder="e.g. Outside my specialty area, conflict of interest..." />
            <p className="reassign-audit">{Icons.info}<span>This action will be recorded in the audit log.</span></p>
            <div className="correction-modal-actions">
              <button type="button" className="correction-cancel" onClick={() => setShowReassignModal(false)}>Cancel</button>
              <button type="button" className="reassign-submit" disabled={!assignedDoctor || !reassignReason.trim()} onClick={reassignIntake}><span>{Icons.refresh}</span> Reassign</button>
            </div>
          </section>
        </div>
      )}
      {showRejectionModal && selected && (
        <div className="correction-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowRejectionModal(false); }}>
          <section className="rejection-modal" role="dialog" aria-modal="true" aria-labelledby="rejection-modal-title">
            <header className="correction-modal-header">
              <div className="rejection-title">
                <span>{Icons.xCircle}</span>
                <h2 id="rejection-modal-title">Reject Intake</h2>
              </div>
              <button type="button" aria-label="Close rejection" className="correction-modal-close" onClick={() => setShowRejectionModal(false)}>{Icons.close}</button>
            </header>
            <p>This intake will be permanently rejected. The receptionist will be notified.</p>
            <label className="reassign-label" htmlFor="rejection-reason">Rejection Reason<span className="system-required-star">*</span></label>
            <textarea
              id="rejection-reason"
              className="reassign-reason"
              value={rejectionReason}
              onChange={event => setRejectionReason(event.target.value)}
              placeholder="Enter the reason for rejecting this intake..."
              maxLength={500}
            />
            <div className="correction-modal-actions">
              <button type="button" className="correction-cancel" onClick={() => setShowRejectionModal(false)}>Cancel</button>
              <button type="button" className="rejection-submit" disabled={!rejectionReason.trim()} onClick={submitRejection}><span>{Icons.xCircle}</span> Reject Intake</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, link = false }) {
  return <div className="intake-detail-field"><span>{label}</span><strong className={link ? 'intake-detail-link' : ''}>{value || 'Not provided'}</strong></div>;
}

const responsiveStyles = `
  .intake-topbar > div:first-child p { color: #334155 !important; }
  .intake-content { box-sizing: border-box; width: 100%; padding: 15px 23px 24px; }
  .intake-top-search { display: flex; align-items: center; gap: 9px; width: 226px; height: 37px; box-sizing: border-box; padding: 0 11px; color: #83918e; border: 1px solid #e1e9e7; border-radius: 10px; background: #f8faf9; }
  .intake-top-search > span { display: flex; width: 13px; height: 13px; flex: 0 0 auto; }
  .intake-top-search svg { width: 100%; height: 100%; }
  .intake-top-search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: #253631; font: inherit; font-size: 11px; }
  .intake-top-search input::placeholder { color: #84908d; }
  .intake-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 13px; }
  .intake-summary-card { display: flex; align-items: center; gap: 11px; min-height: 79px; box-sizing: border-box; padding: 12px 14px; border: 1px solid #e2e9e7; border-radius: 12px; background: #fff; color: #111; text-align: left; cursor: pointer; font: inherit; transition: border-color .15s, background .15s, box-shadow .15s; }
  .intake-summary-card-active { border-color: #14856c; background: #eff9f5; box-shadow: 0 0 0 1px #14856c inset; }
  .intake-summary-card > span:last-child { flex: 1; }
  .intake-summary-card > span:first-child { display: grid; place-items: center; width: 36px; height: 36px; flex: 0 0 auto; border-radius: 10px; }
  .intake-summary-card svg { width: 16px; height: 16px; }
  .intake-summary-card > span:last-child { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; }
  .intake-summary-card strong { margin: 2px 0 1px; color: #141c1a; font-size: 17px; line-height: 1.05; }
  .intake-summary-card span span:first-child { color: #1b2420; font-size: 12px; font-weight: 550; }
  .intake-summary-card span span:last-child { color: #303b36; font-size: 11px; white-space: normal; line-height: 1.3; }
  .intake-controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
  .intake-tabs { display: flex; align-items: center; gap: 2px; max-width: 100%; overflow-x: auto; padding: 4px; border-radius: 13px; background: #eef2f2; }
  .intake-tab { flex: 0 0 auto; padding: 9px 12px; border: 0; border-radius: 9px; background: transparent; color: #111; cursor: pointer; font: inherit; font-size: 12px; white-space: nowrap; }
  .intake-tab-active { background: #12836a; color: #fff; box-shadow: 0 1px 3px #1e32291c; font-weight: 700; }
  .intake-toolbar { display: flex; align-items: center; gap: 7px; }
  .intake-sort { position: relative; }
  .intake-sort select { width: 145px; height: 37px; padding: 0 11px; border: 1px solid #dce5e3; border-radius: 9px; background: #fff; color: #293632; font: inherit; font-size: 11px; }
  .intake-filter-wrap { position: relative; }
  .intake-filter-button { display: grid; place-items: center; width: 37px; height: 37px; border: 1px solid #dce5e3; border-radius: 9px; background: #fff; color: #34433e; cursor: pointer; }
  .intake-filter-menu { position: absolute; z-index: 15; top: 44px; right: 0; display: grid; gap: 7px; width: 160px; padding: 12px; border: 1px solid #dce5e3; border-radius: 9px; background: #fff; color: #62716c; box-shadow: 0 8px 22px #1c32251c; font-size: 11px; }
  .intake-filter-menu select { padding: 7px; border: 1px solid #dce5e3; border-radius: 6px; background: #fff; color: #26332f; font: inherit; }
  .intake-table-wrap { overflow-x: auto; border: 1px solid #e2e9e7; border-radius: 12px; background: #fff; }
  .intake-table { width: 100%; min-width: 850px; border-collapse: collapse; text-align: left; }
  .intake-table th { height: 39px; padding: 0 15px; border-bottom: 1px solid #e3eae8; background: #f8faf9; color: #111; font-size: 12px; font-weight: 650; }
  .intake-table th:first-child { width: 90px; }
  .intake-table th:nth-child(2), .intake-table th:nth-child(3) { width: 21%; }
  .intake-table th:nth-child(4) { width: 19%; }
  .intake-table th:nth-child(5) { width: 15%; }
  .intake-table td { height: 84px; padding: 9px 15px; border-bottom: 1px solid #e4eae8; color: #26332f; font-size: 12px; vertical-align: middle; }
  .intake-table th:last-child, .intake-table td:last-child { width: 42px; padding-right: 10px; padding-left: 4px; text-align: right; }
  .intake-table tbody tr:last-child td { border-bottom: 0; }
  .intake-table tbody tr:not(:has(.intake-empty)) { cursor: pointer; }
  .intake-id { display: block; color: #000; font-family: 'DM Sans', sans-serif; font-size: 12px; }
  .intake-tag { display: inline-flex; margin-top: 6px; padding: 3px 8px; border-radius: 10px; font-size: 9px; font-weight: 800; line-height: 1; }
  .intake-tag-new { background: #eaf0ff; color: #3372ff; }
  .intake-tag-updated { background: #ffebc5; color: #a45a00; }
  .intake-tag-approved { background: #cff2dd; color: #118153; }
  .intake-pet-name { display: flex; align-items: center; gap: 5px; margin-bottom: 4px; }
  .intake-pet-name strong { color: #26332f; font-size: 13px; }
  .intake-listing-indicator { margin-left: 6px; color: #72817b; font-size: 11px; font-weight: 600; }
  .intake-listing-alert { color: #c73830; }
  .intake-pet-meta, .intake-phone { margin: 2px 0; color: #000; font-size: 12px; }
  .intake-phone { color: #000; font-size: 11px; }
  .intake-owner { margin: 2px 0; color: #111; font-size: 13px; font-weight: 600; }
  .intake-date { display: block; color: #111; font-size: 13px; }
  .intake-received-meta { display: block; margin-top: 3px; color: #000; font-size: 11px; }
  .intake-open { display: grid; place-items: center; width: 26px; height: 28px; margin-left: auto; border: 0; background: transparent; color: #9aaba7; cursor: pointer; font-size: 24px; line-height: 1; }
  .intake-empty { height: 90px !important; text-align: center; color: #71807b !important; }
  .intake-row-selected td { background: #e8f6f1; }
  .intake-row-selected td:first-child { box-shadow: inset 3px 0 #139675; }
  .intake-detail-backdrop { position: fixed; z-index: 39; inset: 0; background: rgba(15, 38, 42, .18); }
  .intake-detail-panel { position: fixed; z-index: 40; inset: 0 0 0 auto; display: flex; flex-direction: column; width: min(560px, 100vw); box-sizing: border-box; border-left: 1px solid #e2e9e7; background: #fff; color: #111; box-shadow: -10px 0 32px rgba(20, 48, 43, .12); }
  .intake-detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; min-height: 84px; box-sizing: border-box; padding: 17px 17px 12px; border-bottom: 1px solid #e7ecea; }
  .intake-detail-heading { min-width: 0; }
  .intake-detail-heading h2 { margin: 0 0 6px; color: #17221e; font-size: 19px; font-weight: 750; }
  .intake-detail-heading p { margin: 0 0 8px; color: #303b36; font-size: 13px; line-height: 1.45; }
  .intake-detail-heading .status-indicator { padding: 5px 10px; border-radius: 20px; background: #edf3ff; color: #2867ee !important; font-size: 13px !important; }
  .intake-detail-heading .status-indicator-dot { width: 6px; height: 6px; flex-basis: 6px; background: #2867ee !important; }
  .intake-detail-head > button { display: grid; place-items: center; width: 34px; height: 34px; flex: 0 0 auto; border: 1px solid #e2e9e6; border-radius: 9px; background: #fff; color: #34423c; cursor: pointer; }
  .intake-detail-head > button svg { width: 15px; height: 15px; }
  .intake-detail-body { flex: 1; overflow-y: auto; padding: 13px 17px 7px; }
  .intake-reason { margin-bottom: 17px; padding: 12px 13px; border-left: 3px solid #149477; border-radius: 9px; background: #f3f8f6; }
  .intake-reason > span { color: #485650; font-size: 12px; }
  .intake-reason p { margin: 4px 0 0; color: #111; font-size: 15px; font-weight: 550; line-height: 1.45; }
  .intake-detail-section { padding: 0 0 14px; margin-bottom: 14px; border-bottom: 1px solid #e8edeb; }
  .intake-detail-section h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 13px; color: #202d27; font-size: 14px; font-weight: 750; }
  .intake-detail-section h3 > span { display: inline-flex; width: 14px; height: 14px; color: #5e7069; }
  .intake-detail-section h3 svg { width: 100%; height: 100%; }
  .intake-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 12px; row-gap: 12px; }
  .intake-detail-field { display: grid; gap: 4px; min-width: 0; }
  .intake-detail-field > span { color: #414e48; font-size: 12px; }
  .intake-detail-field > strong { color: #111; font-size: 14px; font-weight: 550; overflow-wrap: anywhere; line-height: 1.3; }
  .intake-detail-field > strong.intake-detail-link { color: #2769e9; }
  .intake-attachment { display: flex; align-items: center; gap: 9px; min-width: 0; padding: 10px; border: 1px solid #e4ebe8; border-radius: 10px; background: #f8faf9; }
  .intake-attachment > span { display: flex; width: 17px; height: 17px; flex: 0 0 auto; color: #72827c; }
  .intake-attachment > span svg { width: 100%; height: 100%; }
  .intake-attachment > div { display: grid; flex: 1; min-width: 0; gap: 3px; }
  .intake-attachment strong { overflow: hidden; color: #26342f; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
  .intake-attachment small { color: #394741; font-size: 11px; }
  .intake-attachment button { padding: 4px; border: 0; background: transparent; color: #2867ee; cursor: pointer; font-size: 12px; font-weight: 650; }
  .intake-file-preview { display: grid; place-items: center; min-height: 168px; box-sizing: border-box; margin-top: 9px; padding: 16px; border: 1px dashed #bdcfe5; border-radius: 11px; background: #f8fafc; color: #5d7fae; text-align: center; font-size: 13px; }
  .intake-no-attachment { margin: 0; color: #394741; font-size: 13px; }
  .intake-activity-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0; border: 0; background: transparent; color: #394741; cursor: pointer; font: inherit; font-size: 16px; }
  .intake-activity-toggle h3 { margin: 0; }
  .intake-activity p { display: flex; align-items: flex-start; gap: 8px; margin: 8px 0 0; color: #303b36; font-size: 13px; line-height: 1.45; }
  .intake-activity p i { width: 6px; height: 6px; flex: 0 0 auto; margin-top: 4px; border-radius: 50%; background: #169473; }
  .intake-detail-actions { display: grid; grid-template-columns: 60px minmax(95px, 1fr) minmax(116px, 1fr); gap: 7px; padding: 11px 17px 13px; border-top: 1px solid #e7ecea; background: #fff; }
  .intake-detail-actions-approved { display: block; padding: 12px; }
  .intake-detail-actions-approved .intake-approve-button { width: 100%; min-height: 50px; border-color: #16a34a; border-radius: 10px; background: #16a34a; color: #fff; font-size: 14px; font-weight: 700; }
  .intake-detail-actions button { min-height: 48px; padding: 7px 8px; border: 1px solid #d9e2df; border-radius: 10px; background: #fff; color: #273630; cursor: pointer; font: inherit; font-size: 12px; font-weight: 650; line-height: 1.3; }
  .intake-detail-actions .intake-correction-button { border-color: #efa33a; color: #b96905; }
  .intake-detail-actions .intake-approve-button { display: flex; align-items: center; justify-content: center; gap: 5px; border-color: #139474; background: #139474; color: #fff; }
  .intake-approve-button span { display: flex; width: 12px; height: 12px; }
  .intake-approve-button svg { width: 100%; height: 100%; }
  .intake-more-wrap { position: relative; }
  .intake-more-wrap > button { width: 100%; }
  .intake-more-menu { position: absolute; z-index: 35; left: 0; bottom: calc(100% + 8px); min-width: 224px; padding: 7px 0; border: 1px solid #e0e7e4; border-radius: 12px; background: #fff; box-shadow: 0 8px 24px #18302420; }
  .intake-detail-actions .intake-more-menu button { display: block; width: 100%; min-height: 47px; padding: 12px 17px; border: 0; border-radius: 0; background: #fff; color: #111827; text-align: left; font-size: 14px; font-weight: 500; line-height: 1.35; }
  .intake-detail-actions .intake-more-menu button:hover { background: #f7f9fb; }
  .intake-detail-actions .intake-more-menu .intake-more-reject { color: #dc2626; }
  .reassign-modal { width: min(460px, 100%); box-sizing: border-box; padding: 22px 24px 20px; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; color: #111827; box-shadow: 0 18px 55px rgba(15, 23, 42, .2); }
  .reassign-title { display: flex; align-items: center; gap: 10px; }
  .reassign-title > span { display: inline-flex; width: 19px; height: 19px; color: #647e9e; }
  .reassign-title > span svg { width: 100%; height: 100%; }
  .reassign-modal h2 { margin: 0; color: #111827; font-size: 19px; font-weight: 750; }
  .reassign-modal > p { margin: 7px 0 16px; color: #64748b; font-size: 14px; line-height: 1.45; }
  .reassign-modal .reassign-label { display: block; margin: 0 0 6px; color: #202923; font-size: 13px; font-weight: 650; }
  .reassign-select { display: block; width: 100%; min-height: 42px; box-sizing: border-box; margin: 0 0 15px; padding: 8px 10px; border: 1px solid #dfe5eb; border-radius: 9px; background: #f3f4f6; color: #29352f; font: inherit; font-size: 14px; }
  .reassign-reason { display: block; width: 100%; min-height: 64px; box-sizing: border-box; margin: 0; padding: 10px 11px; border: 1px solid #dfe5eb; border-radius: 9px; outline: none; background: #f3f4f6 !important; color: #111827 !important; caret-color: #111827; color-scheme: light; font: inherit; font-size: 14px; resize: vertical; }
  .reassign-reason::placeholder { color: #748091 !important; opacity: 1; }
  .reassign-audit { display: flex; align-items: center; gap: 7px; margin: 14px 0 0 !important; color: #647b98 !important; font-size: 12px !important; }
  .reassign-audit > svg { width: 14px; height: 14px; flex: 0 0 auto; }
  .reassign-modal .correction-modal-actions { margin-top: 16px; padding-top: 12px; border-top: 1px solid #edf0f2; }
  .rejection-modal { width: min(460px, 100%); box-sizing: border-box; padding: 22px 22px 20px; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; color: #111827; box-shadow: 0 18px 55px rgba(15, 23, 42, .2); }
  .rejection-title { display: flex; align-items: center; gap: 9px; }
  .rejection-title > span { display: inline-flex; width: 19px; height: 19px; color: #e11d48; }
  .rejection-title svg { width: 100%; height: 100%; }
  .rejection-modal h2 { margin: 0; color: #111827; font-size: 18px; font-weight: 700; }
  .rejection-modal > p { margin: 7px 0 16px; color: #667085; font-size: 13px; line-height: 1.45; }
  .rejection-modal .reassign-label { margin-bottom: 7px; }
  .rejection-modal .reassign-reason { min-height: 68px; background: #f3f4f6 !important; }
  .rejection-modal .correction-modal-actions { margin-top: 15px; padding-top: 0; border: 0; }
  .correction-modal-actions .rejection-submit { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-color: #e11d48; background: #e11d48; color: #fff; }
  .correction-modal-actions .rejection-submit > span { display: inline-flex; width: 15px; height: 15px; }
  .correction-modal-actions .rejection-submit svg { width: 100%; height: 100%; }
  .correction-modal-actions .rejection-submit:disabled { cursor: not-allowed; opacity: .5; }
  .correction-modal-actions .reassign-submit { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-color: #10131e; background: #10131e; color: #fff; }
  .correction-modal-actions .reassign-submit > span { display: inline-flex; width: 15px; height: 15px; }
  .correction-modal-actions .reassign-submit svg { width: 100%; height: 100%; }
  .correction-modal-actions .reassign-submit:disabled { cursor: not-allowed; opacity: .5; }
  .correction-modal-backdrop { position: fixed; z-index: 50; inset: 0; display: grid; place-items: center; padding: 16px; background: rgba(15, 23, 42, .28); }
  .correction-modal { width: min(560px, 100%); max-height: min(92vh, 760px); overflow-y: auto; box-sizing: border-box; padding: 22px 24px 20px; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; color: #111827; box-shadow: 0 18px 55px rgba(15, 23, 42, .2); }
  .correction-modal-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .correction-modal-title { display: flex; align-items: center; gap: 10px; }
  .correction-modal-title > span { display: inline-flex; width: 19px; height: 19px; flex: 0 0 auto; color: #f29a00; }
  .correction-modal-title svg { width: 100%; height: 100%; }
  .correction-modal h2 { margin: 0; color: #111827; font-size: 19px; font-weight: 750; }
  .correction-modal-close { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: #68747e; cursor: pointer; }
  .correction-modal-close svg { width: 15px; height: 15px; }
  .correction-modal > p { margin: 6px 0 14px; color: #53615c; font-size: 13px; line-height: 1.45; }
  .correction-patient-summary { display: flex; align-items: center; min-height: 60px; box-sizing: border-box; margin-bottom: 17px; padding: 10px 13px; border: 1px solid #e4ebe8; border-radius: 10px; background: #f5f8f7; }
  .correction-patient-summary > div { display: grid; gap: 4px; }
  .correction-patient-summary strong { color: #1f2c26; font-size: 14px; }
  .correction-patient-summary span { color: #56645e; font-size: 12px; }
  .correction-reason-heading { display: grid; gap: 3px; margin-bottom: 7px; }
  .correction-reason-heading strong { color: #26352f; font-size: 12px; text-transform: uppercase; }
  .correction-reason-heading span { color: #56645e; font-size: 11px; }
  .correction-reasons { display: grid; margin-bottom: 14px; }
  .correction-reason-row { display: flex; align-items: center; gap: 10px; min-height: 35px; border-bottom: 1px solid #e8edeb; color: #17231e; cursor: pointer; font-size: 13px; }
  .correction-reason-row input { width: 16px; height: 16px; margin: 0 2px; accent-color: #12836a; cursor: pointer; }
  .correction-note-label { display: block; margin-bottom: 6px; color: #34423c; font-size: 12px; font-weight: 650; }
  .correction-note-label span { color: #66746f; font-weight: 400; }
  .correction-note { display: block; width: 100%; min-height: 76px; box-sizing: border-box; padding: 11px 12px; border: 1px solid #cbd5e1; border-radius: 10px; outline: none; background: #f3f4f6 !important; color: #111827 !important; caret-color: #111827; color-scheme: light; font: inherit; font-size: 14px; resize: vertical; }
  .correction-note::placeholder { color: #7b8797 !important; opacity: 1; }
  .correction-note:focus { border-color: #16856c; box-shadow: 0 0 0 3px rgba(22, 133, 108, .12); }
  .correction-note-count { margin-top: 4px; color: #71807b; text-align: right; font-size: 10px; }
  .correction-notification { display: flex; align-items: center; gap: 6px; margin-top: 10px; color: #56645e; font-size: 11px; }
  .correction-notification span { display: inline-flex; width: 13px; height: 13px; color: #16836a; }
  .correction-notification svg { width: 100%; height: 100%; }
  .correction-modal-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 17px; padding-top: 12px; border-top: 1px solid #e8edeb; }
  .correction-modal-actions button { min-height: 43px; padding: 9px 16px; border: 1px solid #d6dfec; border-radius: 9px; background: #fff; color: #25313d; cursor: pointer; font: inherit; font-size: 13px; font-weight: 650; }
  .correction-modal-actions .correction-submit { border-color: #13856c; background: #13856c; color: #fff; }
  .correction-modal-actions .correction-submit:disabled { cursor: not-allowed; opacity: .5; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
  @media (max-width: 900px) {
    .intake-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .intake-content { padding: 14px 16px 24px; }
    .intake-detail-panel { width: min(560px, 100vw); box-shadow: -10px 0 32px rgba(20, 48, 43, .12); }
  }
  @media (max-width: 640px) {
    .intake-top-search { display: none; }
    .intake-content { padding: 12px; }
    .intake-controls { align-items: flex-start; flex-direction: column; }
    .intake-toolbar { align-self: flex-end; }
    .intake-tabs { width: 100%; box-sizing: border-box; }
    .correction-modal { padding: 19px; }
    .correction-reasons { gap: 7px; }
    .correction-reasons button { padding: 8px 11px; font-size: 12px; }
    .correction-modal-actions button { padding: 8px 11px; }
  }
`;

const styles = {
  shell: { flex: 1, minWidth: 0, overflowY: 'auto', minHeight: '100%', background: '#fff', color: '#182522' },
  content: {},
  summaryCard: {},
  summaryIcon: {},
  summaryCopy: {},
  summaryLabel: {},
  summaryValue: {},
  summaryCaption: {},
};
