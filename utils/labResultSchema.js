const schemas = require('../data/labResultSchemas.json');
function schemaFor(testType) {
  return schemas.find(schema => schema.patterns.some(pattern => new RegExp(pattern, 'i').test(String(testType || '')))) || schemas.find(schema => schema.id === 'general');
}
function validateTestSpecificResults(data, testType) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Invalid test-specific results.';
  const schema = schemaFor(testType);
  if (data.testType !== testType || data.schemaId !== schema.id || !data.values || typeof data.values !== 'object' || Array.isArray(data.values)) return 'Test-specific fields must match the selected laboratory test.';
  for (const [key,value] of Object.entries(data.values)) {
    const field = schema.fields.find(item => item.key === key);
    if (!field || typeof value !== 'string' || value.length > 1000 || field.options && value && !field.options.includes(value)) return 'Invalid test-specific field value.';
  }
  return null;
}
module.exports = { schemaFor, validateTestSpecificResults };
