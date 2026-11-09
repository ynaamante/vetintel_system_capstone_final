const db=require('../config/db'),connections=require('../controllers/catalogConnections');
const setup=require('../data/serviceInventorySetup');
exports.apply=async(clinic,client)=>{
  await client.query('BEGIN');
  try{
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)',[clinic]);
    const catalog=(await client.query("SELECT id,source_sku,inventory_notes FROM clinic_billing_catalog WHERE clinic_id=$1 AND catalog_kind='service' AND replaced_by_source IS NULL",[clinic])).rows;
    const stock=(await client.query('SELECT id,sku FROM clinic_inventory_items WHERE clinic_id=$1 AND active',[clinic])).rows;
    const backup=(await client.query('SELECT * FROM clinic_service_inventory_links WHERE clinic_id=$1',[clinic])).rows;
    let added=0;
    for(const entry of setup){
      const service=catalog.find(row=>row.source_sku===entry.service_code);if(!service)throw Error('Missing service '+entry.service_code);
      // Preserve owner assignments; only configure services that have no links yet.
      if(!backup.some(row=>row.catalog_item_id===service.id)){
        for(const sku of entry.inventory_skus){const item=stock.find(row=>row.sku===sku);if(!item)throw Error('Missing inventory '+sku);
          await client.query('INSERT INTO clinic_service_inventory_links(clinic_id,catalog_item_id,inventory_item_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[clinic,service.id,item.id]);added++;}
      }
      if(service.inventory_notes===null&&entry.notes)await client.query('UPDATE clinic_billing_catalog SET inventory_notes=$1,updated_at=now() WHERE id=$2 AND clinic_id=$3',[entry.notes,service.id,clinic]);
    }
    await client.query("INSERT INTO audit_trail(action,table_name,old_data,new_data) VALUES('setup_all_service_inventory','clinic_service_inventory_links',$1::jsonb,$2::jsonb)",[JSON.stringify({clinic_id:clinic,links:backup,notes:catalog}),JSON.stringify({clinic_id:clinic,configured_services:setup.length,added_links:added})]);
    await client.query('COMMIT');return {services:setup.length,added_links:added};
  }catch(e){await client.query('ROLLBACK');throw e;}
};
if(require.main===module){(async()=>{const clinic=Number(process.argv[2]);if(!Number.isInteger(clinic)||clinic<1)throw Error('Supply clinic ID');await connections.ensureSchema();const client=await db.pool.connect();try{console.log(JSON.stringify(await exports.apply(clinic,client)));}finally{client.release();}})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.pool.end());}
