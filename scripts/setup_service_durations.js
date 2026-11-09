const db = require('../config/db');
const { defaultDuration } = require('../controllers/catalogConnections');
async function apply(clinic) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [clinic]);
    const rows = (await client.query("SELECT id,name,category,item_type,duration FROM clinic_billing_catalog WHERE clinic_id=$1 AND catalog_kind='service' AND replaced_by_source IS NULL AND NULLIF(BTRIM(duration),'') IS NULL FOR UPDATE", [clinic])).rows;
    for (const row of rows) await client.query('UPDATE clinic_billing_catalog SET duration=$1,updated_at=now() WHERE id=$2 AND clinic_id=$3', [defaultDuration(row),row.id,clinic]);
    if (rows.length) await client.query("INSERT INTO audit_trail(action,table_name,old_data,new_data) VALUES('setup_service_durations','clinic_billing_catalog',$1::jsonb,$2::jsonb)", [JSON.stringify({clinic_id:clinic,items:rows}),JSON.stringify({clinic_id:clinic,items:rows.map(row=>({id:row.id,duration:defaultDuration(row)}))})]);
    await client.query('COMMIT');
    return {clinic_id:clinic,filled:rows.length};
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {client.release();}
}
exports.apply=apply;
if(require.main===module){const clinic=Number(process.argv[2]);if(!Number.isInteger(clinic)||clinic<1)throw Error('Supply clinic ID');apply(clinic).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.pool.end());}
