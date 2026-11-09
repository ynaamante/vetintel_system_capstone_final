const assert=require('node:assert/strict'),db=require('../config/db'),connections=require('../controllers/catalogConnections');
const {apply}=require('./setup_service_inventory');
async function main(){
  const client=await db.pool.connect(),query=client.query.bind(client),original=db.query;
  try{
    await query('BEGIN');db.query=query;await connections.ensureSchema();
    const before=(await query('SELECT id,quantity FROM clinic_inventory_items WHERE clinic_id=11 ORDER BY id')).rows;
    const oldLinks=(await query('SELECT * FROM clinic_service_inventory_links WHERE clinic_id=11')).rows;
    const adapter={query:(sql,args)=>query(sql==='BEGIN'?'SAVEPOINT service_setup':sql==='COMMIT'?'RELEASE SAVEPOINT service_setup':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT service_setup':sql,args)};
    assert.equal((await apply(11,adapter)).services,75);
    const catalog=(await query("SELECT * FROM clinic_billing_catalog WHERE clinic_id=11 AND catalog_kind='service' AND replaced_by_source IS NULL ORDER BY source_sku")).rows;
    const rows=await connections.enrich(catalog,11);assert.equal(rows.length,75);assert.ok(rows.every(row=>row.inventory_links.length));
    assert.equal(new Set(rows.flatMap(row=>row.appointment_categories)).size,10);
    for(const link of oldLinks)assert.ok(rows.find(row=>row.id===link.catalog_item_id).inventory_links.some(item=>item.id===link.inventory_item_id));
    for(const code of ['VS-0012','VS-0013','VS-0019','VS-0042','VS-0043'])assert.ok(rows.find(row=>row.source_sku===code).inventory_notes,code+' needs explicit missing-product notes');
    const glucose=rows.find(row=>row.source_sku==='VS-0034');assert.ok(glucose.inventory_links.some(item=>item.sku==='VI-0153'));
    assert.ok(rows.find(row=>row.source_sku==='VS-0070').inventory_links.some(item=>item.sku==='VI-0199'&&item.is_equipment));
    assert.equal((await apply(11,adapter)).added_links,0);
    assert.deepEqual((await query('SELECT id,quantity FROM clinic_inventory_items WHERE clinic_id=11 ORDER BY id')).rows,before);
    console.log('PASS: all 75 services and 10 categories linked, existing assignments preserved, appropriate lab/cage links, missing products identified, equipment distinguished, stock unchanged, repeated setup adds no links. Rolled back.');
  }finally{db.query=original;await query('ROLLBACK');client.release();await db.pool.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
