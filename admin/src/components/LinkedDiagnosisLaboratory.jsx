import { useId, useState } from 'react';
import LabTestDrawer from './LabTestDrawer';
import { hasAvailableLabResult } from '../utils/diagnosisLaboratory';

export default function LinkedDiagnosisLaboratory({ laboratory, user, showLabel = true }) {
  const id = useId();
  const [selected, setSelected] = useState(null);
  const labs = laboratory.labs || [];
  const current = labs.find(lab => lab.id === selected);
  async function download(lab) {
    const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    const response = await fetch(`${api}/clinic-records/attachments/${encodeURIComponent(lab.reportAttachmentId)}/content?clinic_id=${encodeURIComponent(user.clinic_id)}`, { headers: { Authorization: `Bearer ${user.token}` } });
    if (!response.ok) throw Error('Unable to download laboratory report.');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a'); link.href = url; link.download = lab.fileName || 'laboratory-report'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return <div className="diagnosis-linked-laboratory">
    {showLabel && <label htmlFor={id}>Laboratory Result</label>}
    <textarea id={id} aria-label="Laboratory Result" rows={labs.length > 1 ? 1 : 3} readOnly value={laboratory.text} />
    {laboratory.error && <small role="alert">{laboratory.error}</small>}
    {labs.length > 0 && <details><summary>Open linked tests ({labs.length})</summary><ul>{labs.map(lab => <li key={lab.id}><div><strong>{lab.testType}</strong><small>{lab.id} · {lab.status}{hasAvailableLabResult(lab) && lab.testResult ? ` · ${lab.testResult}` : ''}{lab.verified ? ' · Verified' : ''}</small></div><button type="button" onClick={() => setSelected(lab.id)}>Open result</button></li>)}</ul></details>}
    {labs.length > 1 && <small>Each test keeps its own result. Review the linked tests individually.</small>}
    {current && <LabTestDrawer record={current} initialTab="result" user={user} onClose={() => setSelected(null)} onDownload={() => download(current)} />}
  </div>;
}
