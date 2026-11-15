import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '../icons';
import { formatDateText, formatDateTimeText } from '../utils/dateFormatting';
import './labTestDrawer.css';
import LabTestResultPanel from './LabTestResultPanel';

const statusText = status => ({ ordered: 'Ordered', 'in-progress': 'Draft', 'results-ready': 'Results Ready', finalized: 'Finalized', cancelled: 'Cancelled' }[status] || 'Not recorded');
function Badge({ children, positive = false }) { return <span className={`ltd-badge${positive ? ' is-positive' : ''}`}><i />{children}</span>; }
function Card({ title, children, dark = false }) { return <section className={`ltd-card${dark ? ' is-dark' : ''}`}><h3>{title}</h3><div>{children}</div></section>; }
function Field({ label, children }) { return <div className="ltd-field"><dt>{label}</dt><dd>{children || 'Not recorded'}</dd></div>; }

export default function LabTestDrawer({ record, initialTab = 'details', onClose, onBack, onEdit, onDownload, user }) {
  const dialog = useRef(null);
  const content = useRef(null);
  const [tab, setTab] = useState(initialTab);
  const [downloadError, setDownloadError] = useState('');
  const finalized = record.status === 'finalized';
  const verified = record.verified === true;
  const verification = <Badge positive={verified}>{verified ? 'Verified' : 'Not verified'}</Badge>;
  const resultStatus = <Badge positive={finalized}>{statusText(record.status)}</Badge>;
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current.showModal();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => { content.current.scrollTop = 0; }, [tab]);
  function tabKey(event) {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 'details' : event.key === 'End' ? 'result' : tab === 'details' ? 'result' : 'details';
      setTab(next); dialog.current.querySelector(`#ltd-${next}-tab`).focus();
    }
  }
  async function downloadReport() {
    setDownloadError('');
    try { await onDownload(); }
    catch (error) { setDownloadError(error.message || 'Unable to download laboratory report.'); }
  }
  async function viewReport() {
    setDownloadError('');
    try {
      let blob = record.attachment;
      if (!blob) {
        if (!user?.token || !record.reportAttachmentId) throw Error('No uploaded report is available.');
        const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
        const response = await fetch(api + '/clinic-records/attachments/' + encodeURIComponent(record.reportAttachmentId) + '/content?clinic_id=' + encodeURIComponent(user.clinic_id), { headers: { Authorization: 'Bearer ' + user.token } });
        if (!response.ok) throw Error('Unable to open the laboratory report.');
        blob = await response.blob();
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { setDownloadError(error.message || 'Unable to open the laboratory report.'); }
  }
  return createPortal(<dialog ref={dialog} className={`ltd-drawer${tab === 'result' ? ' is-result' : ''}`} aria-labelledby="ltd-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="ltd-header"><div><div className="ltd-title-row">{tab === 'result' && <span className="ltd-result-header-icon">{Icons.clipboard}</span>}<h2 id="ltd-title">Lab Test</h2>{resultStatus}</div><p>{record.id} · {record.testType || 'Laboratory test'}</p></div><button type="button" className="ltd-close" aria-label="Close lab test details" onClick={onClose}>{tab === 'result' ? Icons.close : 'Close'}</button></header>
    <section className="ltd-patient"><div>{tab === 'result' && <span className="ltd-result-avatar">{String(record.pet || 'P').slice(0,1)}</span>}<strong>{record.pet || 'Patient'}</strong><small>{[record.species, record.breed, record.age, record.sex, record.patientId ? `ID: ${String(record.patientId).startsWith('P-') ? record.patientId : `P-${String(record.patientId).padStart(4, '0')}`}` : ''].filter(Boolean).join(' · ')}</small></div><div className="ltd-owner">{tab === 'result' && <span className="ltd-owner-icon">{Icons.user}</span>}<small>Owner</small><strong>{record.owner || 'Not recorded'}</strong>{record.ownerPhone && <small>{record.ownerPhone}</small>}</div></section>
    <div className="ltd-tabs" role="tablist" aria-label="Lab test information">{[['details', 'Test Details', Icons.clipboard], ['result', 'Test Result', Icons.activity]].map(([value, label, icon]) => <button type="button" role="tab" id={`ltd-${value}-tab`} aria-controls={`ltd-${value}-panel`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onKeyDown={tabKey} className={tab === value ? 'active' : ''} key={value} onClick={() => setTab(value)}>{icon}{label}</button>)}</div>
    <div className="ltd-content" ref={content}>
      {tab === 'details' ? <section id="ltd-details-panel" role="tabpanel" aria-labelledby="ltd-details-tab">
        <Card title="Test Information" dark><dl className="ltd-information"><div className="ltd-information-row"><div><Field label="Test Type">{record.testType}</Field><Field label="Laboratory">{record.laboratory || 'In-house'}</Field></div><div><Field label="Date Requested">{formatDateTimeText(record.orderDateTime || record.date)}</Field><Field label="Date Completed">{record.resultDate ? formatDateText(record.resultDate) : 'Not recorded'}</Field></div></div><div className="ltd-information-row"><div><Field label="Requested By">{record.requestedBy}</Field><Field label="Result Status">{resultStatus}</Field></div><div><Field label="Verification Status">{verification}</Field><Field label="Verified By">{verified ? record.verifiedByName || 'Not recorded' : 'Not verified'}</Field><Field label="Date Verified">{verified && record.verifiedAt ? formatDateTimeText(record.verifiedAt) : 'Not verified'}</Field></div></div></dl></Card>
        <Card title="Notes"><p>{record.notes || record.indication || 'No clinical notes recorded.'}</p></Card>
        <Card title="Veterinarian Interpretation"><p>{record.interpretation || 'No interpretation recorded.'}</p></Card>
      </section> : <section id="ltd-result-panel" role="tabpanel" aria-labelledby="ltd-result-tab">
        <LabTestResultPanel key={record.id} record={record} onEdit={onEdit} onView={viewReport} onDownload={downloadReport} />
      </section>}
    {downloadError && <p role="alert" className="ltd-download-error">{downloadError}</p>}
    </div>
    <footer className="ltd-footer">{onBack && <button type="button" onClick={onBack}>Back to Actions</button>}<button type="button" className="ltd-primary" onClick={onClose}>Close</button></footer>
  </dialog>, document.body);
}
