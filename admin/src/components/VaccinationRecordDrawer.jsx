import { useRef, useState } from 'react';
import StatusIndicator from './StatusIndicator';
import { Icons } from '../icons';
import { formatDateText, formatDateTimeText } from '../utils/dateFormatting';

const styles = {
  backdrop: { position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(15, 38, 42, .18)' },
  panel: { position: 'fixed', zIndex: 40, inset: '0 0 0 auto', display: 'flex', width: 'min(560px, 100vw)', flexDirection: 'column', borderLeft: '1px solid #dce8e5', background: '#fff', color: '#173d37', boxShadow: '-10px 0 32px rgba(20, 48, 43, .12)' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '16px 22px 14px', borderBottom: '1px solid #e1ebe8' },
  back: { display: 'inline-flex', minHeight: 32, alignItems: 'center', gap: 7, margin: '-4px 0 8px', padding: 0, border: 0, background: 'transparent', color: '#087967', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  title: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 9 },
  h2: { margin: 0, color: '#183b36', fontSize: 21, lineHeight: 1.3, letterSpacing: '-.02em' },
  meta: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6, color: '#334155', fontSize: 13 },
  close: { display: 'grid', width: 38, height: 38, flex: '0 0 auto', placeItems: 'center', border: 0, borderRadius: 11, background: '#f0f6f4', color: '#385b55', fontSize: 21, lineHeight: 1, cursor: 'pointer' },
  tabs: { display: 'flex', gap: 4, padding: '0 20px', borderBottom: '1px solid #dfe9e6' },
  tab: { minHeight: 46, padding: '0 14px', border: 0, borderBottom: '2px solid transparent', background: 'transparent', color: '#334155', font: 'inherit', fontSize: 13, fontWeight: 550, cursor: 'pointer', whiteSpace: 'nowrap' },
  body: { flex: 1, overflowY: 'auto', padding: '18px 22px 22px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '17px 20px', padding: '2px 0 18px' },
  field: { display: 'grid', minWidth: 0, gap: 5 },
  label: { color: '#334155', fontSize: 12 },
  value: { overflowWrap: 'anywhere', color: '#203b37', fontSize: 14, fontWeight: 600, lineHeight: 1.4 },
  section: { padding: '16px 0', borderTop: '1px solid #e2ebe8' },
  sectionTitle: { margin: '0 0 8px', color: '#203b37', fontSize: 14, fontWeight: 700 },
  hint: { margin: 0, color: '#334155', fontSize: 13, lineHeight: 1.5 },
  warning: { display: 'flex', gap: 9, margin: '12px 0', padding: 11, border: '1px solid #efd08c', borderRadius: 10, background: '#fffaed', color: '#98600b', fontSize: 13, lineHeight: 1.45 },
  sampleSticker: { position: 'relative', maxWidth: 470, margin: '12px auto', padding: 18, overflow: 'hidden', border: '1px solid #a9c8b2', borderRadius: 12, background: 'linear-gradient(135deg, #f7fff8 0%, #e8f5e9 100%)', color: '#173d37', boxShadow: '0 5px 16px rgba(23, 61, 55, .1)' },
  sampleStickerHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingBottom: 12, borderBottom: '1px dashed #9db9a4' },
  sampleStickerBrand: { color: '#276749', fontSize: 11, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase' },
  sampleStickerDemo: { padding: '4px 7px', border: '1px solid #dba33e', borderRadius: 5, background: '#fff8e6', color: '#8a5800', fontSize: 10, fontWeight: 800, letterSpacing: '.04em' },
  sampleStickerTitle: { margin: '14px 0 3px', color: '#173d37', fontSize: 19, lineHeight: 1.3 },
  sampleStickerSubtitle: { margin: 0, color: '#334155', fontSize: 12 },
  sampleStickerGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginTop: 16 },
  sampleStickerField: { display: 'grid', gap: 3 },
  sampleStickerLabel: { color: '#334155', fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' },
  sampleStickerValue: { overflowWrap: 'anywhere', color: '#234b3e', fontSize: 13, fontWeight: 700 },
  sampleStickerFoot: { marginTop: 15, paddingTop: 10, borderTop: '1px dashed #9db9a4', color: '#334155', fontSize: 11, lineHeight: 1.45 },
  verified: { display: 'flex', gap: 10, margin: '2px 0 14px', padding: '13px 14px', border: '1px solid #c5e5dc', borderRadius: 11, background: '#f0f8f5', color: '#334155', fontSize: 13, lineHeight: 1.5 },
  proofEmpty: { display: 'grid', justifyItems: 'center', gap: 9, marginTop: 2, padding: '32px 18px', border: '1px dashed #b5cbc5', borderRadius: 12, background: '#f8fbfa', textAlign: 'center' },
  proofTitle: { margin: 0, color: '#203b37', fontSize: 14, fontWeight: 700 },
  statusBadge: { display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 24, padding: '0 9px', borderRadius: 999, background: '#dcf8e7', color: '#087b43', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' },
  dueBadge: { display: 'inline-flex', alignItems: 'center', minHeight: 21, padding: '0 8px', borderRadius: 999, background: '#e2f8e9', color: '#087b43', fontSize: 11, fontWeight: 650, whiteSpace: 'nowrap' },
  dueText: { marginLeft: 6, color: '#334155', fontSize: 12, fontWeight: 450 },
  footer: { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '13px 20px', borderTop: '1px solid #e1ebe8', background: '#fff' },
  button: { minHeight: 40, padding: '0 14px', border: '1px solid #d4e2de', borderRadius: 9, background: '#fff', color: '#28544b', font: 'inherit', fontSize: 13, fontWeight: 650, cursor: 'pointer' },
  primary: { borderColor: '#087967', background: '#087967', color: '#fff' },
  disabled: { opacity: .55, cursor: 'not-allowed' },
  timeline: { position: 'relative', display: 'grid', gap: 0, padding: '4px 0 0' },
  timelineItem: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', minHeight: 62 },
  timelineContent: { paddingBottom: 17 },
  timelineEvent: { margin: 0, color: '#203b37', fontSize: 13, fontWeight: 700, lineHeight: 1.4 },
  timelineMeta: { display: 'block', marginTop: 3, color: '#334155', fontSize: 12, lineHeight: 1.4 },
};

const verificationDialogStyles = {
  backdrop: { position: 'fixed', zIndex: 120, inset: 0, display: 'grid', placeItems: 'center', overflowY: 'auto', padding: 20, background: 'rgba(12, 30, 36, .42)' },
  dialog: { position: 'relative', display: 'flex', flexDirection: 'column', width: 'min(560px, 100%)', maxHeight: 'calc(100vh - 40px)', overflow: 'hidden', border: '1px solid #dcebe5', borderRadius: 14, background: '#fff', color: '#173d37', boxShadow: '0 20px 55px rgba(15,23,42,.25)' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, padding: '18px 20px 13px', borderBottom: '1px solid #e4ece9' },
  title: { margin: 0, color: '#173d37', fontSize: 19, lineHeight: 1.3 },
  intro: { margin: '5px 0 0', color: '#607873', fontSize: 13, lineHeight: 1.5 },
  close: { display: 'grid', width: 38, height: 38, flex: '0 0 38px', placeItems: 'center', border: 0, borderRadius: 8, background: '#f2f7f5', color: '#526b70', cursor: 'pointer' },
  body: { overflowY: 'auto', padding: '14px 20px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 15px' },
  field: { display: 'grid', minWidth: 0, gap: 4 },
  label: { color: '#71858a', fontSize: 12 },
  value: { overflowWrap: 'anywhere', color: '#263f46', fontSize: 13, fontWeight: 650 },
  meaning: { marginTop: 14, padding: 12, border: '1px solid #b7d5ff', borderRadius: 9, background: '#eff6ff', color: '#1d4ed8', fontSize: 12, lineHeight: 1.5 },
  upload: { marginTop: 14, padding: 12, border: '1px solid #dce9e6', borderRadius: 9, color: '#38555a', fontSize: 13 },
  uploadControls: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 9 },
  uploadButton: { display: 'inline-flex', minHeight: 36, alignItems: 'center', padding: '0 12px', border: '1px solid #b8d8cf', borderRadius: 7, background: '#f4faf8', color: '#087568', font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  uploadFileName: { minWidth: 0, color: '#526b70', fontSize: 12, overflowWrap: 'anywhere' },
  uploadInput: { position: 'absolute', width: 1, height: 1, padding: 0, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', clipPath: 'inset(50%)' },
  attestation: { display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 14, padding: 12, border: '1px solid #dce9e6', borderRadius: 9, background: '#f8fbfa', color: '#38555a', fontSize: 13, lineHeight: 1.5, cursor: 'pointer' },
  checkbox: { width: 18, height: 18, flex: '0 0 18px', margin: '1px 0 0', accentColor: '#005447' },
  audit: { margin: '12px 0 0', color: '#61777d', fontSize: 12, lineHeight: 1.5 },
  error: { marginTop: 11, color: '#b42318', fontSize: 13 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 9, padding: '12px 20px 16px', borderTop: '1px solid #e6eef1' },
  button: { minHeight: 40, padding: '0 14px', border: '1px solid #cfe3dd', borderRadius: 7, background: '#fff', color: '#087568', font: 'inherit', fontSize: 13, fontWeight: 650, cursor: 'pointer' },
  primary: { borderColor: '#078673', background: '#078673', color: '#fff' },
  disabled: { opacity: .55, cursor: 'not-allowed' },
};

function formatVaccinationDate(value) {
  if (!value || value === 'Not recorded') return value || 'Not recorded';
  return formatDateText(String(value).slice(0, 10), 'en-GB', value);
}

function formatAuditDate(value) {
  if (!value) return 'Date not recorded';
  return formatDateTimeText(value, 'en-GB', formatVaccinationDate(value));
}

function getDueStatus(value) {
  if (!value || value === 'Not recorded' || value === '—') return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.ceil((date.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days < 0) return { label: 'Overdue', detail: `${Math.abs(days)} days overdue`, background: '#fff0ee', color: '#b42318' };
  if (days <= 30) return { label: 'Due soon', detail: days === 0 ? 'due today' : `in ${days} days`, background: '#fff6e5', color: '#9a5a06' };
  const months = Math.max(1, Math.round(days / 30));
  return { label: 'Up to date', detail: `in ${months} month${months === 1 ? '' : 's'}`, background: '#e2f8e9', color: '#087b43' };
}

export function VaccinationVerificationDialog({ record, user, onClose, onVerified, onStickerUploaded }) {
  const [attestation, setAttestation] = useState(false);
  const [stickerFile, setStickerFile] = useState(null);
  const [stickerPreview, setStickerPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const stickerInputRef = useRef(null);
  const existingStickerUrl = record.stickerUrl || record.sticker_url || '';
  const displayedStickerUrl = stickerPreview || existingStickerUrl;

  const submit = async () => {
    if (!attestation) {
      setError('Confirm the physical sticker and clinic administration before verifying this record.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (!user?.clinic_id || !user?.token) throw new Error('Your account is not assigned to a clinic.');
      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      if (stickerFile) {
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unable to read the vaccine sticker image.'));
          reader.onerror = () => reject(new Error('Unable to read the vaccine sticker image.'));
          reader.readAsDataURL(stickerFile);
        });
        const uploadResponse = await fetch(`${apiUrl}/clinic-records/vaccinations/${record.id}/sticker?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: stickerFile.name, content_type: stickerFile.type, data }),
        });
        const uploaded = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) throw new Error(uploaded.error || 'Unable to save the vaccine sticker image.');
        onStickerUploaded?.(uploaded);
      }
      const response = await fetch(`${apiUrl}/clinic-records/vaccinations/${record.id}/verification?clinic_id=${encodeURIComponent(user.clinic_id)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verified: true,
          attestation_confirmed: true,
          reason: 'Clinic staff confirmed the entered vaccination details match the physical sticker and the vaccine administered at the clinic.',
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to verify the vaccination record.');
      onVerified(payload);
    } catch (submitError) {
      setError(submitError.message || 'Unable to verify the vaccination record.');
    } finally {
      setSaving(false);
    }
  };

  return <div style={verificationDialogStyles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="vaccination-verify-title" style={verificationDialogStyles.dialog}>
      <header style={verificationDialogStyles.header}>
        <div><h2 id="vaccination-verify-title" style={verificationDialogStyles.title}>Verify Vaccination Record</h2><p style={verificationDialogStyles.intro}>Compare the entered details against the physical vaccine sticker.</p></div>
        <button type="button" aria-label="Close verification dialog" disabled={saving} onClick={onClose} style={verificationDialogStyles.close}>{Icons.close}</button>
      </header>
      <div style={verificationDialogStyles.body}>
        <div style={verificationDialogStyles.grid}>
          {[
            ['Patient', record.pet || record.pet_name || '—'],
            ['Vaccine / Product', record.type || record.vaccine_name || record.title || '—'],
            ['Date Given', formatVaccinationDate(record.dateGiven || record.date_given || record.date || '—')],
            ['Manufacturer', record.manufacturer || 'Not recorded'],
            ['Lot / Batch Number', record.batch_number || record.lotNumber || 'Not recorded'],
            ['Administered By', record.attendingDoctor || record.administered_by || record.administeredBy || 'Not recorded'],
          ].map(([label, value]) => <div key={label} style={verificationDialogStyles.field}><span style={verificationDialogStyles.label}>{label}</span><strong style={verificationDialogStyles.value}>{value}</strong></div>)}
        </div>
        <div style={verificationDialogStyles.meaning}><strong>What “Clinic Verified” means</strong><br />Clinic staff reviewed the record against the physical sticker and confirmed the vaccine was administered at this clinic. This is a clinic attestation, not independent proof of manufacturer authenticity.</div>
        <div style={verificationDialogStyles.upload}>
          <strong>Vaccination sticker photo <span style={{ color: '#61777d', fontWeight: 400 }}>(optional)</span></strong>
          <p style={{ margin: '4px 0 0', color: '#61777d', fontSize: 12, lineHeight: 1.45 }}>Attach or review a clear photo of the physical vaccine sticker before verifying this record.</p>
          <div style={verificationDialogStyles.uploadControls}>
            <button type="button" disabled={saving} style={{ ...verificationDialogStyles.uploadButton, ...(saving ? verificationDialogStyles.disabled : {}) }} onClick={() => stickerInputRef.current?.click()}>{stickerFile || existingStickerUrl ? 'Replace photo' : 'Choose photo'}</button>
            <span style={verificationDialogStyles.uploadFileName}>{stickerFile ? stickerFile.name : existingStickerUrl ? (record.stickerFilename || record.sticker_filename || 'Saved sticker photo') : 'No file selected'}</span>
          </div>
          <input ref={stickerInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={saving} aria-label="Choose vaccine sticker photo" style={verificationDialogStyles.uploadInput} onChange={event => {
            const file = event.target.files?.[0] || null;
            setStickerFile(file);
            setStickerPreview('');
            if (file) {
              const reader = new FileReader();
              reader.onload = () => setStickerPreview(typeof reader.result === 'string' ? reader.result : '');
              reader.onerror = () => setError('Unable to preview the selected vaccine sticker image.');
              reader.readAsDataURL(file);
            }
            event.target.value = '';
          }} />
          {displayedStickerUrl && <img src={displayedStickerUrl} alt="Vaccination sticker" style={{ display: 'block', width: '100%', maxHeight: 230, marginTop: 10, border: '1px solid #dce9e6', borderRadius: 8, background: '#fff', objectFit: 'contain' }} />}
        </div>
        <label style={verificationDialogStyles.attestation}>
          <input type="checkbox" checked={attestation} disabled={saving} onChange={event => { setAttestation(event.target.checked); setError(''); }} style={verificationDialogStyles.checkbox} />
          <span>I checked the physical vaccine sticker against these details and confirm this vaccine was administered at this clinic.</span>
        </label>
        <p style={verificationDialogStyles.audit}>Verification will be recorded under <strong>{user?.name || user?.full_name || user?.email || 'Signed-in clinic staff'}</strong> at {formatDateTimeText(new Date())}.</p>
        {error && <div role="alert" style={verificationDialogStyles.error}>{error}</div>}
      </div>
      <footer style={verificationDialogStyles.footer}>
        <button type="button" disabled={saving} onClick={onClose} style={verificationDialogStyles.button}>Cancel</button>
        <button type="button" disabled={!attestation || saving} onClick={submit} style={{ ...verificationDialogStyles.button, ...verificationDialogStyles.primary, ...(!attestation || saving ? verificationDialogStyles.disabled : {}) }}>{saving ? 'Verifying…' : 'Confirm Verification'}</button>
      </footer>
    </section>
  </div>;
}

export default function VaccinationRecordDrawer({ record, sourceLabel = 'Vaccinations', isShared = false, isMock = false, onClose, onVerify, onShare }) {
  const [activeTab, setActiveTab] = useState('Details');
  if (!record) return null;
  const verified = record.clinicVerified === true || record.verified === true;
  const stickerUrl = record.stickerUrl || record.sticker_url || '';
  const stickerFilename = record.stickerFilename || record.sticker_filename || '';
  const administerer = record.attendingDoctor || record.administeredBy || record.administered_by_name || 'Not recorded';
  const title = record.type || record.vaccine_name || record.title || 'Vaccination';
  const dateGiven = formatVaccinationDate(record.dateGiven || record.date_given || record.date);
  const nextDue = formatVaccinationDate(record.nextDue || record.next_due);
  const manufacturer = record.manufacturer || 'Not recorded';
  const lot = record.batch_number || record.lotNumber || record.lot || 'Not recorded';
  const dose = record.dose || 'Not recorded';
  const verifiedBy = record.verified_by_name || record.verifiedBy || 'Clinic staff';
  const verifiedAt = record.verified_at || record.verifiedAt;
  const dueStatus = getDueStatus(record.nextDue || record.next_due);
  const audit = [
    ...(record.auditLog || []),
    ...(dateGiven !== 'Not recorded' && !(record.auditLog || []).some(item => /administer/i.test(item.event || ''))
      ? [{ event: 'Vaccination administered', actor: administerer, date: dateGiven }]
      : []),
    ...(verified && !(record.auditLog || []).some(item => /verif/i.test(item.event || ''))
      ? [{ event: 'Clinic verification completed', actor: verifiedBy, date: verifiedAt }]
      : []),
    ...(isShared && !(record.auditLog || []).some(item => /shar/i.test(item.event || ''))
      ? [{ event: 'Shared with owner', actor: record.sharedBy || 'Clinic staff', date: record.sharedAt || record.shared_at }]
      : []),
  ].map(item => ({ ...item, displayDate: formatAuditDate(item.date) })).reverse();

  return <>
    <div style={styles.backdrop} onClick={onClose} />
    <aside className="vaccine-detail-panel" role="dialog" aria-modal="false" aria-label={`${title} vaccination details`} style={styles.panel}>
      <header style={styles.header}>
        <div>
          <div style={styles.title}>
            <h2 style={styles.h2}>{title}</h2>
            {verified
              ? <span style={styles.statusBadge}>Clinic verified</span>
              : <StatusIndicator status="Pending Verification" />}
          </div>
          <div style={styles.meta}>
            {record.pet || record.pet_name || 'Patient not recorded'}
            {dateGiven !== 'Not recorded' && ` · ${dateGiven}`}
            {dose !== 'Not recorded' && ` · ${dose}`}
            {dueStatus && <span style={{ ...styles.dueBadge, background: dueStatus.background, color: dueStatus.color }}>{dueStatus.label}</span>}
          </div>
        </div>
        <button type="button" aria-label="Close vaccination details" onClick={onClose} style={styles.close}>×</button>
      </header>
      <nav aria-label="Vaccination detail sections" style={styles.tabs}>
        {['Details', 'Proof / Sticker', 'History'].map(tab => <button key={tab} type="button" onClick={() => setActiveTab(tab === 'History' ? 'History' : tab)} aria-current={activeTab === (tab === 'History' ? 'History' : tab) ? 'page' : undefined} style={{ ...styles.tab, ...(activeTab === (tab === 'History' ? 'History' : tab) ? { borderBottomColor: '#087967', color: '#004f43', fontWeight: 700 } : {}) }}>{tab}{tab === 'Proof / Sticker' ? ` (${stickerUrl ? 1 : 0})` : tab === 'History' ? ` (${audit.length})` : ''}</button>)}
      </nav>
      <div style={styles.body}>
        {isMock && <div style={styles.warning}><span>i</span><span><strong>Prototype sample.</strong> This record is for demonstration only and is not saved to the clinic database.</span></div>}
        {activeTab === 'Details' && <>
          <div style={styles.grid}>
            {[
              ['Vaccine / Product', title],
              ['Manufacturer', manufacturer],
              ['Lot / Batch Number', lot],
              ['Expiry date', formatVaccinationDate(record.expiryDate || record.expiry_date || 'Not recorded')],
              ['Dose', dose],
              ['Date given', dateGiven],
              ['Next due', <span>{nextDue}{dueStatus && <span style={styles.dueText}>{dueStatus.detail}</span>}</span>],
              ['Administered by', administerer],
              ['Clinic location', record.clinicName || record.clinic_name || 'Current clinic'],
            ].map(([label, value]) => <div key={label} style={styles.field}><span style={styles.label}>{label}</span><strong style={styles.value}>{value || 'Not recorded'}</strong></div>)}
          </div>
          {verified
            ? <div style={styles.verified}><div><strong>Clinic verified</strong><div>Reviewed against the physical vaccine sticker and confirmed as administered at this clinic.</div><div>Verified by {verifiedBy}{verifiedAt ? ` · ${formatAuditDate(verifiedAt)}` : ''}</div></div></div>
            : <div style={styles.warning}><span><strong>Pending verification.</strong> Compare the record with the physical vaccine sticker before sharing it with the owner.</span></div>}
          {!stickerUrl && !isMock && <div style={{ ...styles.warning, alignItems: 'center', justifyContent: 'space-between' }}><span>No sticker photo is attached to this record.</span><button type="button" disabled={isMock || !onVerify} style={styles.button} onClick={onVerify}>Add proof</button></div>}
          <section style={styles.section}><h3 style={styles.sectionTitle}>Notes</h3><p style={styles.hint}>{record.notes || 'No additional notes for this vaccination.'}</p></section>
          <section style={styles.section}><h3 style={styles.sectionTitle}>Sharing with owner</h3><p style={styles.hint}>{isShared ? `Shared with ${record.owner || 'the linked owner'}${record.clinic_name ? ` in the ${record.clinic_name} app` : ' in PetWatch'}.` : verified ? 'This record is verified and ready to share with the owner.' : 'Only clinic-verified vaccinations can be shared with the owner.'}</p></section>
        </>}
        {activeTab === 'Proof / Sticker' && (stickerUrl ? <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Vaccine Sticker / Product Label</h3>
          <a href={stickerUrl} target="_blank" rel="noreferrer"><img src={stickerUrl} alt="Vaccine sticker or product label" style={{ display: 'block', maxWidth: '100%', maxHeight: 340, marginBottom: 9, borderRadius: 8, objectFit: 'contain' }} /></a>
          <p style={styles.hint}>{stickerFilename || 'Attached vaccine sticker'}</p>
        </section> : isMock ? <>
          <div style={styles.sampleSticker}>
            <div style={styles.sampleStickerHeader}>
              <span style={styles.sampleStickerBrand}>{manufacturer}</span>
              <span style={styles.sampleStickerDemo}>DEMO ONLY</span>
            </div>
            <h3 style={styles.sampleStickerTitle}>{title}</h3>
            <p style={styles.sampleStickerSubtitle}>Veterinary vaccine · Sample product label</p>
            <div style={styles.sampleStickerGrid}>
              {[
                ['Patient', record.pet || record.pet_name || 'Sample patient'],
                ['Dose / Route', dose],
                ['Lot / Batch', lot],
                ['Date given', dateGiven],
                ['Expiry date', formatVaccinationDate(record.expiryDate || record.expiry_date)],
                ['Next due', nextDue],
              ].map(([label, value]) => <div key={label} style={styles.sampleStickerField}>
                <span style={styles.sampleStickerLabel}>{label}</span>
                <strong style={styles.sampleStickerValue}>{value || 'Not recorded'}</strong>
              </div>)}
            </div>
            <div style={styles.sampleStickerFoot}>Illustrative UI mockup only. This is not a photograph or proof of an actual vaccine sticker, product, or administration.</div>
          </div>
        </> : <div style={styles.proofEmpty}>
          <h3 style={styles.proofTitle}>No sticker photo yet</h3>
          <p style={styles.hint}>Photograph the vaccine sticker to keep supporting evidence with this record.</p>
          {onVerify && <button type="button" disabled={isMock} style={{ ...styles.button, ...styles.primary, ...(isMock ? styles.disabled : {}) }} onClick={onVerify}>Add proof</button>}
        </div>)}
        {activeTab === 'History' && (audit.length
          ? <div style={styles.timeline}>{audit.map((item, index) => <div key={`${item.event}-${index}`} style={styles.timelineItem}>
            <div style={styles.timelineContent}><p style={styles.timelineEvent}>{item.event}</p><time style={styles.timelineMeta}>{[item.actor, item.displayDate].filter(Boolean).join(' · ')}</time></div>
          </div>)}</div>
          : <p style={styles.hint}>No audit events are available for this vaccination.</p>)}
      </div>
      <footer style={styles.footer}>
        {!verified && <button type="button" disabled={isMock} style={{ ...styles.button, ...styles.primary, ...(isMock ? styles.disabled : {}) }} onClick={onVerify}>Verify Record</button>}
        <button type="button" disabled={!verified || isShared || isMock} onClick={onShare} style={{ ...styles.button, ...(!verified || isShared || isMock ? styles.disabled : {}) }}>{isShared ? 'Already Shared' : 'Share with Owner'}</button>
      </footer>
    </aside>
  </>;
}
