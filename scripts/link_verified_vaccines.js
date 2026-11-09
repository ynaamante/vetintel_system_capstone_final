const db=require('../config/db');
const {publish}=require('../utils/clinicEvents');
// Exact products from the supplied mock inventory; manufacturer references preserve match provenance.
const mappings=[
  ['VS-0010','VI-0001','https://www.msd-animal-health.ph/products/nobivac-rabies/'],
  ['VS-0021','VI-0001','https://www.msd-animal-health.ph/products/nobivac-rabies/'],
  ['VS-0011','VI-0002','https://www.msd-animal-health.ph/products/nobivac-dhppi/'],
  ['VS-0014','VI-0004','https://www.msd-animal-health.co.in/species/companion-animals/'],
  ['VS-0015','VI-0003','https://www.msd-animal-health.co.in/species/companion-animals/'],
  ['VS-0016','VI-0005','https://www.msd-animal-health.ph/products/nobivac-kc/'],
  ['VS-0017','VI-0007','https://www.msd-animal-health.co.in/species/companion-animals/'],
  ['VS-0018','VI-0009','https://ph.virbac.com/products/biologics/leucofeligen-felvrcp'],
];
async function main(){
  const clinic=Number(process.argv[2]);if(!Number.isInteger(clinic)||clinic<1)throw Error('Supply clinic ID');
  const client=await db.pool.connect();
  try{
    await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock($1::bigint)',[clinic]);
    const linked=[];
    for(const [serviceCode,sku,reference] of mappings){
      const pair=(await client.query(`SELECT c.id AS service_id,c.name AS service,i.id AS inventory_id,i.name AS product,
        COALESCE(v.quantity,i.quantity) AS quantity,i.unit
        FROM clinic_billing_catalog c JOIN clinic_inventory_items i ON i.clinic_id=c.clinic_id
        LEFT JOIN clinic_vaccine_batches v ON v.id=i.vaccine_batch_id AND v.clinic_id=i.clinic_id
        WHERE c.clinic_id=$1 AND c.source_sku=$2 AND i.sku=$3 AND c.active AND i.active AND c.replaced_by_source IS NULL AND c.catalog_kind='service'`,[clinic,serviceCode,sku])).rows;
      if(pair.length!==1)throw Error('Expected one exact source match: '+serviceCode+' / '+sku);
      const row=pair[0];
      const existing=await client.query('SELECT 1 FROM clinic_service_inventory_links WHERE clinic_id=$1 AND catalog_item_id=$2',[clinic,row.service_id]);
      if(existing.rows.length){linked.push({...row,preserved_existing:true});continue;}
      await client.query('INSERT INTO clinic_service_inventory_links(clinic_id,catalog_item_id,inventory_item_id) VALUES($1,$2,$3)',[clinic,row.service_id,row.inventory_id]);
      await client.query("INSERT INTO audit_trail(action,table_name,record_id,new_data) VALUES('link_verified_vaccine','clinic_billing_catalog',$1,$2::jsonb)",[row.service_id,JSON.stringify({clinic_id:clinic,inventory_item_id:row.inventory_id,reference})]);
      linked.push(row);
    }
    await client.query('COMMIT');publish(clinic,'catalog');console.log(JSON.stringify({clinic_id:clinic,linked},null,2));
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.pool.end());
