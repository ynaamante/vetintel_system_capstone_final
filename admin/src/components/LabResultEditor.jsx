import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '../icons';
import LabDateTimePicker from './LabDateTimePicker';
import ClinicAttachmentImage from './ClinicAttachmentImage';
import { formatDateText, formatDateTimeText } from '../utils/dateFormatting';
import './labResultEditor.css';
import TestSpecificLabFields from './TestSpecificLabFields';
import { getLabResultSchema } from '../utils/labResultSchema';

const statuses = ['Not assessed', 'Within Range', 'Low', 'High', 'Critical'];
const blank = () => ({ name: '', value: '', unit: '', referenceRange: '', status: 'Not assessed' });
const badgeClass = value => ['Normal', 'Within Range', 'Negative', 'Finalized'].includes(value) ? 'good' : ['High', 'Low', 'Inconclusive'].includes(value) ? 'warning' : value === 'Critical' ? 'danger' : '';

function Section({ title, subtitle, action, children, className = '' }) {
  return <section className={`lr-section ${className}`}><header><div><h3>{title}</h3>{subtitle && <small>{subtitle}</small>}</div>{action}</header><div className="lr-section-body">{children}</div></section>;
}

export default function LabResultEditor({ record, setRecord, user, testTypes = [], onClose, onSave, error, setError, reading, setReading, message, setMessage }) {
  const dialog = useRef(null);
  const content = useRef(null);
  const [step, setStep] = useState('edit');
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const fileInput = useRef(null);
  const change = (key, value) => setRecord(previous => ({ ...previous, [key]: value }));
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current.showModal();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => { if (content.current) content.current.scrollTop = 0; }, [step]);
  const rows = record.measurements || [];
  const resultSchema = getLabResultSchema(record.testType);
  const hasReport = Boolean(record.attachment || record.reportAttachmentId);
  const patientDetails = [record.species, record.breed, record.age, record.sex, record.patientId ? `ID: ${String(record.patientId).startsWith('P-') ? record.patientId : `P-${String(record.patientId).padStart(4, '0')}`}` : ''].filter(Boolean).join(' · ');
  const resultDate = record.resultDate && record.resultTime ? `${record.resultDate}T${record.resultTime}` : '';
  const statusLabel = step === 'verify' || record.status === 'finalized' ? 'Finalized' : record.status === 'in-progress' ? 'Draft' : 'Results Ready';
  const updateRow = (index, key, value) => setRecord(previous => ({ ...previous, measurements: previous.measurements.map((row, i) => i === index ? { ...row, [key]: value } : row) }));
  async function attach(file) {
    if (!file || reading || saving) return;
    setError(''); setMessage('');
    if (file.size > 4 * 1024 * 1024) { setError('Choose a report file that is 4 MB or smaller.'); return; }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) { setError('Upload a PDF, JPG, or PNG laboratory report.'); return; }
    setRecord(previous => ({ ...previous, attachment: file, reportText: '' }));
    setReading(true);
    try {
      const { readLabReport } = await import('../utils/labReportReader');
      const data = await readLabReport(file, setMessage);
      setRecord(previous => ({ ...previous, reportText: data.text, summary: data.summary || previous.summary, interpretation: data.interpretation || previous.interpretation, measurements: data.measurements.length ? data.measurements : previous.measurements }));
      setMessage('Report attached. Review the extracted findings before verifying.');
    } catch (e) { setError(e.message || 'Unable to read report. You can enter findings manually.'); }
    finally { setReading(false); }
  }
  async function openReport(download = false) {
    try {
      let blob = record.attachment;
      if (!blob) {
        const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
        const response = await fetch(`${api}/clinic-records/attachments/${encodeURIComponent(record.reportAttachmentId)}/content?clinic_id=${encodeURIComponent(user.clinic_id)}`, { headers: { Authorization: `Bearer ${user.token}` } });
        if (!response.ok) throw Error('Unable to open the laboratory report.');
        blob = await response.blob();
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url;
      if (download) link.download = record.attachment?.name || record.fileName || 'laboratory-report';
      else { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setError(e.message); }
  }
  async function submit(event) {
    event.preventDefault();
    if (reading || saving) return;
    const action = event.nativeEvent.submitter?.value;
    if (action === 'draft' || (step === 'verify' && verified)) {
      setSaving(true);
      try { await onSave({ action: action === 'draft' ? 'draft' : 'finalize' }); }
      finally { setSaving(false); }
      return;
    }
    if (!record.summary?.trim() || record.summary === 'Awaiting laboratory result' || !record.testResult || !resultDate) { setError('Enter a result summary, test result, and result date and time before verification.'); return; }
    setError(''); setVerified(false); setEditingRow(null); setStep('verify');
  }
  const fileCard = <div className="lr-file-card">{Icons.file}<div><strong>{record.attachment?.name || record.fileName || 'Laboratory report'}</strong><small>{record.attachment ? `${record.attachment.type === 'application/pdf' ? 'PDF' : 'Image'} · ${(record.attachment.size / (1024 * 1024)).toFixed(1)} MB` : 'Uploaded laboratory report'}</small></div><button type="button" onClick={() => openReport(false)}>{Icons.eye} View</button><button type="button" onClick={() => openReport(true)}>{Icons.download} Download</button></div>;
  const valuesTable = (editable = false) => <div className="lr-table-scroll"><table><thead><tr>{['Analyte', 'Result', 'Unit', 'Reference Range', 'Status'].map(label => <th key={label}>{label}</th>)}{editable && <th aria-label="Actions" />}</tr></thead><tbody>{(editable ? rows : rows.slice(0, 3)).map((row, index) => <tr key={index}>{['name', 'value', 'unit', 'referenceRange'].map(key => <td key={key}>{editable && editingRow === index ? <input aria-label={`${key} ${index + 1}`} value={row[key] || ''} onChange={e => updateRow(index, key, e.target.value)} /> : row[key] || '—'}</td>)}<td>{editable && editingRow === index ? <select aria-label={`Status ${index + 1}`} value={row.status || 'Not assessed'} onChange={e => updateRow(index, 'status', e.target.value)}>{[...new Set([...statuses, row.status].filter(Boolean))].map(value => <option key={value}>{value}</option>)}</select> : <span className={`lr-badge ${badgeClass(row.status)}`}>{row.status === 'Normal' ? 'Within Range' : row.status || 'Not assessed'}</span>}</td>{editable && <td className="lr-row-actions"><button type="button" aria-label={`${editingRow === index ? 'Finish editing' : 'Edit'} test value ${index + 1}`} onClick={() => setEditingRow(editingRow === index ? null : index)}>{editingRow === index ? '✓' : Icons.edit}</button><button type="button" className="lr-delete" aria-label={`Remove test value ${index + 1}`} onClick={() => { change('measurements', rows.filter((_, i) => i !== index)); setEditingRow(null); }}>{Icons.trash}</button></td>}</tr>)}{!editable && rows.length > 3 && <tr><td colSpan={5}>...</td></tr>}{!rows.length && <tr><td colSpan={editable ? 6 : 5}>No test values added.</td></tr>}</tbody></table></div>;
  return createPortal(<dialog ref={dialog} className={`lr-dialog ${step === 'verify' ? 'lr-verification' : ''}`} onCancel={e => { e.preventDefault(); if (!saving && !reading) onClose(); }} aria-labelledby="lr-title"><form onSubmit={submit}>
    <div className="lr-dialog-header">
    <button type="button" className="lr-close" aria-label="Close laboratory results" disabled={saving || reading} onClick={onClose}>{Icons.close}</button>
    <header className="lr-heading"><div><h2 id="lr-title">{step === 'verify' ? 'Verify Laboratory Results' : 'Enter Lab Results'}</h2><p>{step === 'verify' ? 'Review and confirm the laboratory test details, extracted results, and uploaded report before finalizing.' : 'Record and review laboratory test findings for this patient.'}</p></div>{step === 'edit' && <div className="lr-meta"><div><small>Lab Test ID</small><strong>{record.id}</strong></div><div><small>Date Ordered</small><strong>{formatDateText(record.orderDateTime || record.date)}</strong></div><span className={`lr-badge ${badgeClass(statusLabel)}`}>● {statusLabel}</span></div>}</header>
    </div>
    <div className="lr-content" ref={content}>
    <section className="lr-patient"><ClinicAttachmentImage attachmentId={record.photo_attachment_id} src={record.photo_url} user={user} alt="Patient" className="lr-avatar" fallback={<span className="lr-avatar">{String(record.pet || 'P').slice(0, 1)}</span>} /><div className="lr-patient-name"><strong>{record.pet || 'Patient'}</strong><small>{patientDetails}</small></div>{step === 'edit' ? <div className="lr-owner">{Icons.user}<div><small>Owner</small><strong>{record.owner || 'Not recorded'}</strong><small>{record.ownerPhone}</small></div></div> : <div className="lr-patient-meta"><div><small>Lab Test ID</small><strong>{record.id}</strong></div><div><small>Lab Test Type</small><strong>{record.testType}</strong></div><div><small>Date Ordered</small><strong>{formatDateText(record.orderDateTime || record.date)}</strong></div></div>}</section>
    {step === 'edit' ? <>
      <div className="lr-top-fields"><label>Lab Test Type <b>*</b><select required value={record.testType} onChange={e => setRecord(previous => ({ ...previous, testType: e.target.value, testResult: '', testSpecificResults: { schemaId: getLabResultSchema(e.target.value).id, testType: e.target.value, values: {} } }))}>{[...new Set([record.testType, ...testTypes].filter(Boolean))].map(value => <option key={value}>{value}</option>)}</select></label><label>Result Status <b>*</b><select value={record.status} onChange={e => change('status', e.target.value)}><option value="in-progress">Draft</option><option value="results-ready">Results Ready</option><option value="finalized">Finalized</option></select><small>Draft = work in progress, Finalized = complete result.</small></label><label>Test Result <b>*</b><select required className="lr-result-select" value={record.testResult || ''} onChange={e => change('testResult', e.target.value)}><option value="">Select result</option>{['Positive', 'Negative', 'Inconclusive', 'Not applicable'].map(value => <option key={value}>{value}</option>)}</select><small>The interpretation of the test (e.g., Positive, Negative, Inconclusive).</small></label><label>Result Date &amp; Time <b>*</b><LabDateTimePicker label="Result Date and Time" value={resultDate} onChange={value => { const [resultDate = '', resultTime = ''] = value.split('T'); setRecord(previous => ({ ...previous, resultDate, resultTime })); }} /></label></div>
      <Section title="Result Summary"><textarea aria-label="Result Summary" rows="2" maxLength={500} value={record.summary === 'Awaiting laboratory result' ? '' : record.summary || ''} onChange={e => change('summary', e.target.value)} /><small className="lr-count">{record.summary === 'Awaiting laboratory result' ? 0 : (record.summary || '').length}/500</small></Section>
      <Section title={resultSchema.title}><TestSpecificLabFields record={record} setRecord={setRecord} /></Section>
      {resultSchema.quantitative ? <><Section title="Test Values and Reference Ranges" subtitle="Enter the individual test values. You can add multiple analytes as needed." action={<button type="button" onClick={() => { change('measurements', [...rows, blank()]); setEditingRow(rows.length); }}>+ Add Test Value</button>}>{valuesTable(true)}</Section></> : rows.some(row => row.name || row.value || row.unit || row.referenceRange) && <details className="lr-additional-values"><summary>Additional reported values</summary>{valuesTable(true)}</details>}
      <Section title="Veterinarian Interpretation" subtitle="Your professional assessment of the results, including clinical relevance."><textarea aria-label="Veterinarian Interpretation" rows="2" maxLength={1000} value={record.interpretation || ''} onChange={e => change('interpretation', e.target.value)} /><small className="lr-count">{(record.interpretation || '').length}/1000</small></Section>
      <Section title="Uploaded Report"><small>Attach the official laboratory report (PDF, JPG, PNG).</small><div className="lr-upload-row">{hasReport && fileCard}<button type="button" className="lr-drop-zone" disabled={reading || saving} onClick={() => fileInput.current.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); attach(e.dataTransfer.files[0]); }}>{Icons.plus}<span>{hasReport ? 'Replace file' : 'Choose file'}<small>or drag and drop</small></span></button><input ref={fileInput} type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={e => { attach(e.target.files[0]); e.target.value = ''; }} /></div><div className="lr-note">{Icons.info} Saved findings appear in this patient's Lab Results. The uploaded report is also linked under Files &amp; Documents.</div></Section>
    </> : <>
      <Section title="Laboratory Result Details"><div className="lr-verify-fields"><label>Result Status<output className="lr-result-select">Finalized</output></label><label>Test Result<output className="lr-result-select">{record.testResult}</output></label><label>Result Date &amp; Time<output>{resultDate ? formatDateTimeText(resultDate) : 'Not recorded'}</output></label></div></Section>
      <div className="lr-verify-grid"><Section title="Result Summary"><p>{record.summary}</p></Section><Section title="Veterinarian Interpretation"><p>{record.interpretation || 'Not recorded'}</p></Section><Section title={resultSchema.title}><TestSpecificLabFields record={record} readOnly />{resultSchema.quantitative && valuesTable()}{!resultSchema.quantitative && rows.some(row => row.name || row.value) && <details><summary>Additional reported values</summary>{valuesTable()}</details>}</Section><Section title="Uploaded Laboratory Report">{hasReport ? fileCard : <p>No laboratory report attached.</p>}</Section></div>
      <label className="lr-attestation"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} />I have reviewed and verified that the laboratory test information, extracted results, values, interpretation, and uploaded report are accurate and complete.</label>
    </>}
    {reading && <p role="status" className="lr-note">Reading laboratory report...</p>}{message && <p role="status" className="lr-note">{message}</p>}{error && <p className="lr-error" role="alert">{error}</p>}
    </div>
    <footer className="lr-footer">{step === 'verify' ? <><button type="button" disabled={saving} onClick={() => { setStep('edit'); setVerified(false); }}>Back to Edit</button><button className="lr-primary" type="submit" value="finalize" disabled={!verified || saving || reading}>{saving ? 'Finalizing...' : 'Confirm & Finalize'}</button></> : <><button type="button" disabled={saving || reading} onClick={onClose}>Cancel</button><button type="submit" value="draft" formNoValidate disabled={saving || reading}>Save as Draft</button><button className="lr-primary" type="submit" value="verify" disabled={saving || reading}>{saving ? 'Saving...' : 'Verify Results'}</button></>}</footer>
  </form></dialog>, document.body);
}
