const db=require('../config/db');
const importer=require('../controllers/serviceCatalogImport');
async function main(){
  const clinic=Number(process.argv[2]);
  if(!Number.isInteger(clinic)||clinic<1)throw new Error('Usage: node scripts/import_pdf_services.js CLINIC_ID');
  const target=(await db.query('SELECT id,name FROM clinics WHERE id=$1',[clinic])).rows[0];
  if(!target)throw new Error('Clinic not found');
  await importer.ensureSchema();
  console.log(JSON.stringify({clinic:target,result:await importer.importServices(clinic)}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.pool.end());
