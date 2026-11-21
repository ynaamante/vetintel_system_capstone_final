export const medicalCategories = ['All', 'Visits', 'Diagnoses', 'Treatments', 'Tests & Results', 'Vaccinations', 'Medications', 'Other'];
export function medicalCategory(record: any): string {
  const value = `${record.type || ''} ${record.category || ''}`.toLowerCase();
  if (/vacci|vaccine/.test(value)) return 'Vaccinations';
  if (/diagnos/.test(value)) return 'Diagnoses';
  if (/lab|test|result/.test(value)) return 'Tests & Results';
  if (/medication|prescription/.test(value)) return 'Medications';
  if (/treatment|plan/.test(value)) return 'Treatments';
  if (/visit|consultation/.test(value)) return 'Visits';
  return 'Other';
}
export function medicalActivity(bundles: any[], petId: string): any[] {
  const records = new Map<string, any>();
  const sorted = bundles.filter(b => String(b.petId) === petId).sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  for (const bundle of sorted) for (const item of bundle.records || []) {
    const key = String(item.id);
    if (records.has(key)) continue;
    const status = item.clinicVerified ? 'Verified' : item.status ? String(item.status).replace(/_/g,' ') : item.type === 'visit' && /completed\s*$/i.test(item.detail || '') ? 'Completed' : 'Shared';
    records.set(key, { ...item, key, categoryGroup: medicalCategory(item), status, clinicName: bundle.clinicName, sharedBy: bundle.sharedBy, sharedAt: bundle.createdAt, date: item.date || bundle.createdAt, dateIsShared: !item.date });
  }
  return [...records.values()].sort((a,b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
}
export function filterMedicalActivity(records: any[], category: string, search: string) {
  const query = search.trim().toLowerCase();
  return records.filter(r => (category === 'All' || r.categoryGroup === category) && (!query || `${r.title} ${r.detail || ''} ${r.clinicName || ''} ${r.categoryGroup} ${r.status}`.toLowerCase().includes(query)));
}
export const escapeReportHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
