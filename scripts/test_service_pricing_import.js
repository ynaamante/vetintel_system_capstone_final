const assert=require('node:assert/strict');
const db=require('../config/db');
const importer=require('../controllers/serviceCatalogImport');
const records=require('../controllers/clinicRecordController');
const source=require('../data/importedServicesPricing.json');
async function main(){
  const connection=await db.pool.connect(),query=connection.query.bind(connection),original=db.query;
  try{
    await query('BEGIN');db.query=query;await importer.ensureSchema();
    const clinic=11;
    const stockBefore=(await query('SELECT row_to_json(i) AS item FROM clinic_inventory_items i WHERE clinic_id=$1 ORDER BY id',[clinic])).rows;
    const otherBefore=(await query('SELECT row_to_json(c) AS item FROM clinic_billing_catalog c WHERE clinic_id<>$1 ORDER BY id',[clinic])).rows;
    await query('DELETE FROM clinic_service_imports WHERE clinic_id=$1',[clinic]);
    const client={query:(sql,args)=>query(sql==='BEGIN'?'SAVEPOINT service_import':sql==='COMMIT'?'RELEASE SAVEPOINT service_import':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT service_import':sql,args)};
    const result=await importer.importServices(clinic,client);assert.equal(result.imported,75);assert.equal(result.fixed_prices,74);
    const rows=(await query("SELECT * FROM clinic_billing_catalog WHERE clinic_id=$1 AND catalog_kind='service' AND active AND replaced_by_source IS NULL ORDER BY source_sku",[clinic])).rows;
    assert.equal(rows.length,75);
    rows.forEach((row,index)=>{const item=source.items[index];for(const key of ['name','category','item_type','unit'])assert.equal(row[key],item[key]);assert.equal(row.unit_price===null?null:Number(row.unit_price),item.unit_price);assert.equal(row.source_sku,item.code);});
    assert.deepEqual((await query('SELECT row_to_json(i) AS item FROM clinic_inventory_items i WHERE clinic_id=$1 ORDER BY id',[clinic])).rows,stockBefore);
    assert.deepEqual((await query('SELECT row_to_json(c) AS item FROM clinic_billing_catalog c WHERE clinic_id<>$1 ORDER BY id',[clinic])).rows,otherBefore);
    for(const role of ['Owner','Doctor']){let data;await records.listBillingCatalog({user:{clinic_id:clinic,role},query:{}},{json(v){data=v;}},e=>{throw e;});assert.equal(data.length,role==='Owner'?280:74);if(role==='Doctor')assert.ok(data.every(item=>item.unit_price!==null));}
    assert.equal((await importer.importServices(clinic,client)).already_imported,true);
    console.log('PASS: 75 exact services, 74 fixed PHP prices, variable booster guarded, owner/doctor catalog access, inventory unchanged, other clinics unchanged, idempotent import. Rolled back.');
  }finally{db.query=original;await query('ROLLBACK');connection.release();await db.pool.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
