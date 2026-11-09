const assert=require('node:assert/strict'),db=require('../config/db'),connections=require('../controllers/catalogConnections'),records=require('../controllers/clinicRecordController');
async function main(){
  const connection=await db.pool.connect(),query=connection.query.bind(connection),original=db.query,originalConnect=db.pool.connect;
  try{
    await query('BEGIN');db.query=query;await connections.ensureSchema();
    db.pool.connect=async()=>({query:(sql,args)=>query(sql==='BEGIN'?'SAVEPOINT catalog_link':sql==='COMMIT'?'RELEASE SAVEPOINT catalog_link':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT catalog_link':sql,args),release(){}});
    const invoke=async(handler,role,id,body={})=>{let code=200,data;await handler({user:{id:role==='Owner'?15:18,role,clinic_id:11},params:{id},query:{},body},{status(n){code=n;return this;},json(v){data=v;return this;}},error=>{throw error;});return{code,data};};
    const catalog=(await invoke(records.listBillingCatalog,'Doctor')).data;
    const categories=['Vaccination','Treatment','Laboratory','Surgery','Dental','Check-up','Follow-up','Confinement','Grooming','General'];
    const stock=(await query('SELECT id,quantity FROM clinic_inventory_items WHERE clinic_id=11 AND active ORDER BY id LIMIT 1')).rows[0];
    for(const category of categories){
      const service=catalog.find(item=>item.appointment_categories.includes(category));assert.ok(service,category+' has no service');
      assert.equal((await invoke(connections.update,'Owner',service.id,{inventory_item_ids:[stock.id]})).code,200);
      const visible=(await invoke(records.listBillingCatalog,'Doctor')).data.find(item=>item.id===service.id);
      assert.equal(visible.inventory_links[0].id,stock.id);assert.equal(visible.inventory_links[0].quantity,stock.quantity);
    }
    assert.equal((await invoke(connections.update,'Doctor',catalog[0].id,{inventory_item_ids:[]})).code,403);
    assert.equal((await invoke(connections.update,'Owner',catalog[0].id,{inventory_item_ids:[2147483647]})).code,422);
    assert.equal((await invoke(connections.update,'Owner',catalog[0].id,{inventory_item_ids:[stock.id,stock.id]})).code,422);
    assert.equal((await query('SELECT quantity FROM clinic_inventory_items WHERE id=$1',[stock.id])).rows[0].quantity,stock.quantity);
    console.log('PASS: all 10 doctor categories have owner-priced services; inventory links visible across every category; doctor writes denied; invalid/duplicate stock rejected; linking does not consume stock. All fixtures rolled back.');
  }finally{db.query=original;db.pool.connect=originalConnect;await query('ROLLBACK');connection.release();await db.pool.end();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
