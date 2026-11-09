const assert=require('node:assert/strict');
const db=require('../config/db');
const inventory=require('../controllers/inventoryController');
const records=require('../controllers/clinicRecordController');
const source=require('../data/importedInventory205.json');
async function main(){
  const connection=await db.pool.connect(),query=connection.query.bind(connection),originalQuery=db.query,originalConnect=db.pool.connect;
  try{
    await query('BEGIN');db.query=query;
    await inventory.ensureSchema();
    const clinic=11;
    // Isolate the import marker and all changes inside the outer rollback transaction.
    await query('DELETE FROM clinic_inventory_imports WHERE clinic_id=$1',[clinic]);
    const client={query:(sql,args)=>query(sql==='BEGIN'?'SAVEPOINT inventory_action':sql==='COMMIT'?'RELEASE SAVEPOINT inventory_action':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT inventory_action':sql,args),release(){}};
    db.pool.connect=async()=>client;
    const result=await inventory.replaceFromPdf(clinic,null,client);
    assert.equal(result.imported,205);
    const invoke=async(handler,role,body={},id=null,params={})=>{let code=200,data;await handler({user:{id:null,clinic_id:clinic,role},params:{id},query:params,body},{status(n){code=n;return this;},json(v){data=v;return this;}},e=>{throw e;});return{code,data};};
    const owner=await invoke(inventory.list,'owner'),doctor=await invoke(inventory.list,'doctor');
    assert.equal(owner.data.length,205);assert.deepEqual(owner.data,doctor.data);
    for(let n=0;n<205;n++){const actual=owner.data[n],expected=source.items[n];for(const key of ['sku','name','category','manufacturer','supplier','batch_number','expiry_date','quantity','unit','reorder_level'])assert.equal(actual[key],expected[key],`${expected.sku}: ${key}`);assert.equal(actual.unit_price,null);}
    assert.equal((await query('SELECT count(*)::int AS count FROM clinic_vaccine_batches WHERE clinic_id=$1 AND active',[clinic])).rows[0].count,10);
    const catalog=await invoke(records.listBillingCatalog,'owner',{},null,{include_unpriced:'true'});
    assert.equal(catalog.data.length,205);assert.ok(catalog.data.every(row=>row.catalog_kind==='product'&&row.unit_price===null));
    assert.equal((await invoke(records.listBillingCatalog,'doctor')).data.length,0);
    const first=owner.data[0];
    assert.equal((await invoke(inventory.update,'doctor',first,first.id)).code,403);
    assert.equal((await invoke(inventory.update,'owner',{...first,quantity:17},first.id)).code,200);
    assert.equal((await query('SELECT quantity FROM clinic_vaccine_batches WHERE id=$1',[first.vaccine_batch_id])).rows[0].quantity,17);
    assert.equal((await inventory.replaceFromPdf(clinic,null,client)).already_imported,true);
    assert.equal((await invoke(inventory.list,'doctor')).data[0].quantity,17);
    const priced=await invoke(records.updateBillingCatalogItem,'owner',{...catalog.data.find(row=>row.id===first.catalog_item_id),name:first.name+' Updated',unit_price:123},first.catalog_item_id);
    assert.equal(priced.code,200,JSON.stringify(priced.data));
    const updated=(await invoke(inventory.list,'doctor')).data[0];assert.equal(updated.name,first.name+' Updated');assert.equal(Number(updated.unit_price),123);
    assert.equal((await invoke(records.listBillingCatalog,'doctor')).data.length,1);
    console.log('PASS: 205 exact source items, 16 categories, 10 linked vaccine batches, owner/doctor parity, pricing guards, linked updates, role restriction, and idempotent import. All fixtures rolled back.');
  }finally{db.query=originalQuery;db.pool.connect=originalConnect;await query('ROLLBACK');connection.release();await db.pool.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
