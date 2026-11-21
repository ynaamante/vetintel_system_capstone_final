const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../petwatch-rn/node_modules/typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../petwatch-rn/src/services/petPhoto.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const saved = 'data:image/jpeg;base64,saved-photo';
let persisted = saved, uploadFails = false;
const calls = [];
const api = {
  ownerCareApi: {
    uploadPhoto: async (...args) => { calls.push(['upload', ...args]); if (uploadFails) throw new Error('Upload failed'); return { photo_url: saved }; },
    overview: async () => { calls.push(['clinic-read']); return { clinicPets: [{ id: 7, photo_url: persisted }] }; },
  },
  petsApi: { getById: async id => { calls.push(['personal-read', id]); return { id, photo_url: persisted }; } },
};
const moduleValue = { exports: {} };
new Function('require', 'module', 'exports', compiled)(() => api, moduleValue, moduleValue.exports);
(async () => {
  const save = moduleValue.exports.savePetPhoto;
  const clinic = await save('7', true, saved, 'session');
  assert.equal(clinic.source, 'clinic');
  assert.equal(clinic.photo_url, saved);
  assert.equal(calls[1][0], 'clinic-read', 'Upload success is verified by reading the saved profile.');
  calls.length = 0;
  assert.equal((await save('9', false, saved, 'session')).source, 'account');
  assert.deepEqual(calls[1], ['personal-read', '9']);
  persisted = 'old-photo';
  await assert.rejects(save('7', true, saved, 'session'), /could not verify/);
  uploadFails = true;
  await assert.rejects(save('7', true, saved, 'session'), /Upload failed/);
  console.log('PASS: clinic and personal photo read-back verification; stale persistence and failed uploads cannot report success.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
