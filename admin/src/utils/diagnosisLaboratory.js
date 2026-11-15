// Display recorded laboratory findings without inferring a clinical diagnosis.
export function linkedDiagnosisLabs(labs, patientId, diagnosisId) {
  if (!diagnosisId) return [];
  return labs.filter(lab => !lab.archived && String(lab.patientId || lab.pet_id) === String(patientId) && String(lab.diagnosis_id) === String(diagnosisId));
}
export function hasAvailableLabResult(lab) {
  return ['results-ready','finalized','completed'].includes(String(lab.status || '').toLowerCase());
}
export function laboratoryResultText(labs) {
  if (!labs.length) return 'Not tested - no linked laboratory tests';
  if (labs.length > 1) {
    const available = labs.filter(hasAvailableLabResult).length;
    const pending = labs.filter(lab => !hasAvailableLabResult(lab) && lab.status !== 'cancelled').length;
    return available + (available === 1 ? ' result available' : ' results available') + (pending ? ' - ' + pending + ' pending' : '');
  }
  return labs.map(lab => {
    const status = String(lab.status || 'ordered').replaceAll('-', ' ');
    const summary = lab.summary && !/^(awaiting laboratory result|test cancelled\.?)$/i.test(lab.summary.trim()) ? lab.summary.trim() : '';
    const findings = [lab.testResult, summary, lab.interpretation, lab.verified === true ? 'Verified' : null].filter(Boolean).join(' - ');
    const fallback = ['ordered', 'in progress', 'pending', 'pending review'].includes(status) ? 'Awaiting laboratory result' : lab.measurements?.length ? 'Results available in laboratory report' : lab.reportAttachmentId ? 'Report attached' : 'No result recorded';
    return (lab.testType || 'Laboratory test') + ': ' + status + ' - ' + (findings || fallback);
  }).join('\n');
}
