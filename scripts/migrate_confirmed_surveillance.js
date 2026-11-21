const db = require('../config/db');
const diagnoses = require('../controllers/patientDiagnosisController');
(async () => {
  try {
    await diagnoses.ensureSchema();
    console.log('Confirmed-surveillance migration committed: disease catalog, private episode identities, write trigger, indexes and RLS.');
  } finally { await db.pool.end(); }
})().catch(error => { console.error('Migration failed and rolled back.',error.code || 'UNKNOWN'); process.exitCode=1; });
