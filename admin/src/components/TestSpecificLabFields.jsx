import { currentTestFields, getLabResultSchema } from '../utils/labResultSchema';

export default function TestSpecificLabFields({ record, setRecord, readOnly = false }) {
  const schema = getLabResultSchema(record.testType);
  const values = currentTestFields(record);
  function change(key, value) {
    setRecord(previous => ({ ...previous, testSpecificResults: { schemaId: schema.id, testType: previous.testType, values: { ...currentTestFields(previous), [key]: value } } }));
  }
  if (readOnly) {
    const recorded = schema.fields.filter(field => values[field.key]);
    return recorded.length ? <dl className="lab-specific-values">{recorded.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{values[field.key]}</dd></div>)}</dl> : <p>No additional test-specific findings recorded.</p>;
  }
  return <div className="lab-specific-fields">{schema.fields.map(field => <label key={field.key}>{field.label}{field.kind === 'select' ? <select value={values[field.key] || ''} onChange={event => change(field.key, event.target.value)}><option value="">Select</option>{field.options.map(value => <option key={value}>{value}</option>)}</select> : field.kind === 'textarea' ? <textarea maxLength={1000} rows={3} value={values[field.key] || ''} onChange={event => change(field.key, event.target.value)} /> : <input maxLength={1000} value={values[field.key] || ''} onChange={event => change(field.key, event.target.value)} />}</label>)}</div>;
}
