export const medicalCategories = ['All', 'Visits', 'Diagnoses', 'Treatments', 'Tests & Results', 'Vaccinations', 'Medications', 'Other'];

export type OwnerMedicalRecord = {
  key: string;
  title: string;
  type: string;
  category: string;
  status: string;
  date?: string;
  dateIsShared?: boolean;
  clinicName: string;
  origin: 'clinic' | 'shared';
  detail?: string;
  sections?: { title: string; fields: { label: string; value: string }[] }[];
  verifiedBy?: string;
  sharedBy?: string;
  sharedAt?: string;
};

export type OwnerMedicalActivity = {
  petId: number;
  petName: string;
  clinicName: string;
  records: OwnerMedicalRecord[];
};
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
export function filterMedicalActivity<T extends OwnerMedicalRecord & { categoryGroup: string }>(records: T[], category: string, search: string) {
  const query = search.trim().toLowerCase();
  return records.filter(record => {
    if (category !== 'All' && record.categoryGroup !== category) return false;
    if (!query) return true;
    const fields = record.sections?.flatMap(section => section.fields.map(field => `${field.label} ${field.value}`)) ?? [];
    return [record.title, record.detail, record.clinicName, record.categoryGroup, record.status, ...fields].join(' ').toLowerCase().includes(query);
  });
}
export const escapeReportHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
