const db = require('../config/db');
const inventory = require('../controllers/inventoryController');
async function main() {
  const clinic = Number(process.argv[2]);
  if (!Number.isInteger(clinic) || clinic < 1) throw new Error('Usage: node scripts/import_pdf_inventory.js CLINIC_ID');
  const target = (await db.query('SELECT id,name FROM clinics WHERE id=$1', [clinic])).rows[0];
  if (!target) throw new Error('Clinic not found');
  await inventory.ensureSchema();
  console.log(JSON.stringify({clinic: target, result: await inventory.replaceFromPdf(clinic)}));
}
main().catch(e => { console.error(e.message); process.exitCode=1; }).finally(() => db.pool.end());
