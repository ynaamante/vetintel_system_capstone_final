import { useState } from 'react';
import { formatDateText } from '../utils/dateFormatting';

export default function DiagnosisLabReport({ labs, patientName, user, onClose }) {
  const [id, setId] = useState(labs[0]?.id);
  const [error, setError] = useState('');
  const lab = labs.find(item => item.id === id) || labs[0];
  return <><header className="diagnosis-record-heading"><div><button type="button" className="diagnosis-record-back" onClick={onClose}>← Back to Diagnosis</button><h2>Laboratory Result</h2><p>Full laboratory test details for {patientName}.</p></div></header>{labs.length > 1 && <label className="diagnosis-lab-picker">Laboratory Test<select value={id} onChange={event => setId(event.target.value)}>{labs.map(item => <option key={item.id} value={item.id}>{item.testType} · {item.id}</option>)}</select></label>}{lab && <><section className="diagnosis-record-card"><header><h3>{lab.testType}</h3><span>{lab.id}</span></header><dl className="diagnosis-record-fields">{[['Patient', patientName], ['Status', lab.status], ['Order Date', lab.date ? formatDateText(lab.date) : 'Not recorded'], ['Ordering Veterinarian', lab.requestedBy], ['Laboratory', lab.laboratory], ['Specimen Type', lab.specimenType], ['Reason for Testing', lab.indication], ['Summary', lab.summary], ['Interpretation', lab.interpretation], ['Clinical Notes', lab.notes]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl></section><section className="diagnosis-record-card"><header><h3>Measurements</h3></header><div className="diagnosis-record-table"><table><thead><tr><th>Test / Parameter</th><th>Result</th><th>Unit</th><th>Reference Range</th></tr></thead><tbody>{(lab.measurements || []).map((item, index) => <tr key={index}><td>{item.parameter || item.name || item.test || '—'}</td><td>{item.value ?? item.result ?? '—'}</td><td>{item.unit || '—'}</td><td>{item.referenceRange || item.reference || item.range || '—'}</td></tr>)}{!lab.measurements?.length && <tr><td colSpan="4">No measurements recorded yet.</td></tr>}</tbody></table></div></section>{lab.reportAttachmentId && <button type="button" onClick={async () => {
    try {
      setError('');
      const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
      const response = await fetch(`${api}/clinic-records/attachments/${encodeURIComponent(lab.reportAttachmentId)}/content?clinic_id=${encodeURIComponent(user.clinic_id)}`, { headers: { Authorization: `Bearer ${user.token}` } });
      if (!response.ok) throw Error('Unable to download the laboratory report.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = lab.fileName || 'laboratory-report'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) { setError(error.message); }
  }}>Download Attached Report</button>}{error && <p role="alert">{error}</p>}</>}</>;
}
