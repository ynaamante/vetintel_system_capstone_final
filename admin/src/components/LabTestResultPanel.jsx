import { useState } from 'react';
import { Icons } from '../icons';
import TestSpecificLabFields from './TestSpecificLabFields';
import { currentTestFields, getLabResultSchema } from '../utils/labResultSchema';
import { formatDateTimeText } from '../utils/dateFormatting';

function ResultCard({ title, children }) {
  return <section className="ltr-card"><h3>{title}</h3><div>{children}</div></section>;
}

function Assessment({ value }) {
  const label = value === 'Normal' ? 'Within Range' : value || 'Not assessed';
  const tone = label === 'Within Range' ? 'normal' : ['High', 'Low'].includes(label) ? 'warning' : label === 'Critical' ? 'critical' : 'unknown';
  return <span className={`ltr-assessment ${tone}`}><span aria-hidden="true">{tone === 'normal' ? '✓' : tone === 'warning' ? '⊖' : tone === 'critical' ? '!' : '·'}</span>{label}</span>;
}

export default function LabTestResultPanel({ record, onEdit, onView, onDownload }) {
  const [expanded, setExpanded] = useState(false);
  const rows = (record.measurements || []).filter(row => row.name || row.parameter || row.value || row.result || row.unit || row.referenceRange);
  const resultSchema = getLabResultSchema(record.testType);
  const visible = expanded ? rows : rows.slice(0, 7);
  const verified = record.verified === true;
  const hasReport = Boolean(record.reportAttachmentId || record.attachment);
  const resultDate = record.resultDate ? (record.resultTime ? `${record.resultDate}T${record.resultTime}` : record.resultDate) : record.reportedAt;
  const compactDate = resultDate && !Number.isNaN(new Date(resultDate).getTime()) ? new Date(resultDate).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not recorded';
  const fileType = record.reportContentType === 'application/pdf' || /\.pdf$/i.test(record.fileName || '') ? 'PDF' : record.reportContentType?.startsWith('image/') ? 'Image' : 'Report';
  const fileSize = record.reportSizeBytes ? `${(record.reportSizeBytes / (1024 * 1024)).toFixed(1)} MB` : null;
  const uploadDate = record.reportUploadedAt ? `Uploaded ${formatDateTimeText(record.reportUploadedAt)}` : null;
  return <>
    <section className={`ltr-verification${verified ? ' is-verified' : ''}`}>
      <span className="ltr-verification-icon" aria-hidden="true">{verified ? '✓' : 'i'}</span>
      <div><strong>{verified ? 'Result Verified' : 'Result Not Verified'}</strong><small>{verified ? [record.verifiedAt ? `Verified on ${formatDateTimeText(record.verifiedAt)}` : 'Verification recorded', record.verifiedByName ? `by ${record.verifiedByName}` : null].filter(Boolean).join(' ') : 'Review and verify the laboratory findings before finalizing.'}</small></div>
      <div className="ltr-banner-actions">{onEdit && <button type="button" onClick={onEdit}>{record.testResult || record.summary && record.summary !== 'Awaiting laboratory result' ? 'Edit Result' : 'Enter Result'}</button>}<button type="button" onClick={onView} disabled={!hasReport}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 3h7v7M21 3 10 14M10 3H3v18h18v-7" /></svg> View Report</button></div>
    </section>
    <div className="ltr-metadata"><div><small>Test Result</small><strong className={`ltr-test-result ${String(record.testResult || '').toLowerCase().replaceAll(' ', '-')}`}>{record.testResult || 'Not recorded'}</strong></div><div><small>Result Date &amp; Time</small><span className="ltr-date">{Icons.calendar}{compactDate}</span></div><div><small>Test Type</small><strong>{record.testType || 'Not recorded'}</strong></div><div><small>Laboratory</small><strong>{record.laboratory || 'In-house'}</strong></div></div>
    <ResultCard title="Result Summary"><p>{record.summary && record.summary !== 'Awaiting laboratory result' ? record.summary : 'No result summary recorded.'}</p></ResultCard>
    {Object.keys(currentTestFields(record)).length > 0 && <ResultCard title={resultSchema.title}><TestSpecificLabFields record={record} readOnly /></ResultCard>}
    {(resultSchema.quantitative || rows.length > 0) && <ResultCard title="Test Result – Analytes and Reference Ranges"><div className="ltr-table-scroll"><table><thead><tr>{['Analyte', 'Result', 'Unit', 'Reference Range', 'Assessment'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{visible.map((row, index) => <tr key={index}><td>{row.name || row.parameter || '—'}</td><td>{row.value ?? row.result ?? '—'}</td><td>{row.unit || '—'}</td><td>{row.referenceRange || '—'}</td><td><Assessment value={row.status || row.interpretation} /></td></tr>)}{!rows.length && <tr><td colSpan={5}>No individual analyte values recorded.</td></tr>}</tbody></table></div>{rows.length > 7 && <button type="button" className="ltr-expand" aria-expanded={expanded} onClick={() => setExpanded(current => !current)}>{expanded ? 'Show fewer analytes' : `Show all analytes (${rows.length - 7} more)`}<span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span></button>}</ResultCard>}
    <ResultCard title="Veterinarian Interpretation"><p>{record.interpretation || 'No interpretation recorded.'}</p></ResultCard>
    <ResultCard title="Uploaded Laboratory Report">{hasReport ? <div className="ltr-report-file">{Icons.file}<div><strong>{record.fileName || record.attachment?.name || 'Laboratory report'}</strong><small>{[fileType, fileSize, uploadDate].filter(Boolean).join(' · ')}</small></div><div className="ltr-report-actions"><button type="button" onClick={onView}>{Icons.eye} View</button><button type="button" onClick={onDownload}>{Icons.download} Download</button></div></div> : <p>No laboratory report attached.</p>}</ResultCard>
  </>;
}
