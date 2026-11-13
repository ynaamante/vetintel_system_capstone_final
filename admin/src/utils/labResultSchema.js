import schemas from '../../../data/labResultSchemas.json' with { type: 'json' };
export function getLabResultSchema(testType) {
  return schemas.find(schema => schema.patterns.some(pattern => new RegExp(pattern, 'i').test(String(testType || '')))) || schemas.find(schema => schema.id === 'general');
}
export function currentTestFields(record) {
  const data = record.testSpecificResults;
  return data?.testType === record.testType && data.schemaId === getLabResultSchema(record.testType).id ? data.values || {} : {};
}
