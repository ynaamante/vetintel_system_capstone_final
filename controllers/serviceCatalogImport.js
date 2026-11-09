const db = require('../config/db');
const {publish} = require('../utils/clinicEvents');
const source = require('../data/importedServicesPricing.json');

exports.ensureSchema = () => db.query(`CREATE TABLE IF NOT EXISTS clinic_service_imports (
  clinic_id INTEGER NOT NULL REFERENCES clinics(id), source_key TEXT NOT NULL,
  filename TEXT NOT NULL, item_count INTEGER NOT NULL, backup_data JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(clinic_id,source_key))`);

exports.importServices = async (clinic, clientOverride) => {
  const client = clientOverride || await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [clinic]);
    const prior = await client.query('SELECT item_count FROM clinic_service_imports WHERE clinic_id=$1 AND source_key=$2', [clinic,source.sha256]);
    if (prior.rows.length) { await client.query('COMMIT'); return {already_imported:true,total:prior.rows[0].item_count}; }
    const backup = await client.query("SELECT * FROM clinic_billing_catalog WHERE clinic_id=$1 AND catalog_kind='service'", [clinic]);
    await client.query('INSERT INTO clinic_service_imports(clinic_id,source_key,filename,item_count,backup_data) VALUES($1,$2,$3,$4,$5::jsonb)', [clinic,source.sha256,source.filename,source.items.length,JSON.stringify(backup.rows)]);
    await client.query("UPDATE clinic_billing_catalog SET active=false,replaced_by_source=$2,updated_at=now() WHERE clinic_id=$1 AND catalog_kind='service'", [clinic,source.sha256]);
    for (const item of source.items) {
      await client.query(`INSERT INTO clinic_billing_catalog(clinic_id,item_type,category,name,description,unit,unit_price,active,catalog_kind,source_key,source_sku,duration)
        VALUES($1,$2,$3,$4,$5,$6,$7,true,'service',$8,$9,$10)
        ON CONFLICT(clinic_id,item_type,name) DO UPDATE SET category=EXCLUDED.category,description=EXCLUDED.description,
          unit=EXCLUDED.unit,unit_price=EXCLUDED.unit_price,active=true,catalog_kind='service',source_key=EXCLUDED.source_key,
          duration=COALESCE(NULLIF(BTRIM(clinic_billing_catalog.duration),''),EXCLUDED.duration),source_sku=EXCLUDED.source_sku,replaced_by_source=NULL,updated_at=now()`,
      [clinic,item.item_type,item.category,item.name,`Mock PHP pricing from ${source.filename}. ${item.source_category}. ${item.price_label}.`,item.unit,item.unit_price,source.sha256,item.code,require('./catalogConnections').defaultDuration(item)]);
    }
    await client.query("INSERT INTO audit_trail(action,table_name,new_data) VALUES('import_service_pricing','clinic_service_imports',$1::jsonb)", [JSON.stringify({clinic_id:clinic,filename:source.filename,items:source.items.length,source_key:source.sha256})]);
    await client.query('COMMIT'); publish(clinic,'catalog');
    return {imported:source.items.length,fixed_prices:source.items.filter(item=>item.unit_price!==null).length,vaccine_dependent:source.items.filter(item=>item.unit_price===null).length};
  } catch(error) { await client.query('ROLLBACK').catch(()=>{}); throw error; }
  finally { if(!clientOverride)client.release(); }
};
