const assert=require('node:assert/strict'),db=require('../config/db'),records=require('../controllers/clinicRecordController');
async function main(){
  const clinic=11;let invoices;
  await records.listInvoices({user:{id:18,role:'Doctor',clinic_id:clinic},query:{}},{json(data){invoices=data;}},error=>{throw error;});
  assert.ok(Array.isArray(invoices));
  const expected=(await db.query(`SELECT i.id AS invoice_id,v.sticker_attachment_id AS attachment_id
    FROM invoices i LEFT JOIN consultations co ON co.id=i.consultation_id AND co.clinic_id=i.clinic_id
    JOIN vaccinations v ON v.appointment_id=COALESCE(i.appointment_id,co.appointment_id) AND v.clinic_id=i.clinic_id
    JOIN attachments att ON att.id=v.sticker_attachment_id AND att.clinic_id=i.clinic_id AND att.owner_id=v.id
    WHERE i.clinic_id=$1 AND COALESCE(v.archived,false)=false AND att.owner_table='vaccinations' AND att.metadata->>'source'='vaccination_sticker'`,[clinic])).rows;
  assert.ok(expected.length,'Expected an existing invoiced vaccination proof');
  for(const row of expected){const invoice=invoices.find(item=>item.id===row.invoice_id);assert.ok(invoice);const attachment=invoice.attachments.find(item=>item.id===row.attachment_id);assert.ok(attachment,'Missing vaccination proof on invoice '+row.invoice_id);assert.ok(attachment.downloadEndpoint.endsWith('/content'));}
  for(const invoice of invoices){assert.equal(new Set(invoice.attachments.map(item=>item.id)).size,invoice.attachments.length);for(const attachment of invoice.attachments){const saved=(await db.query('SELECT clinic_id FROM attachments WHERE id=$1',[attachment.id])).rows[0];assert.equal(saved.clinic_id,clinic);}}
  console.log(`PASS: ${expected.length} saved vaccination proofs included in visit billing attachments; no duplicates; clinic scope preserved. Read-only check.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.pool.end());
