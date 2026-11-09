const db = require('../config/db');
const { publish } = require('../utils/clinicEvents');
const { VOID_REASONS } = require('../utils/invoiceVoidPolicy');

exports.options = (req, res) => res.json({ void_reasons: VOID_REASONS });

exports.voidDecision = async (req, res, next) => {
  const role = String(req.user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!['doctor', 'assistant_doctor', 'veterinarian'].includes(role)) return res.status(403).json({ error: 'Only clinical staff can approve or reject a void request.' });
  const clinicId = Number(req.user.clinic_id), id = Number(req.params.id);
  const decision = req.body.decision;
  const reason = String(req.body.reason || '').trim();
  if (!Number.isInteger(clinicId) || clinicId < 1 || !Number.isInteger(id) || id < 1 || !['approve', 'reject'].includes(decision) || reason.length > 1000 || (decision === 'reject' && !reason)) return res.status(400).json({ error: 'Choose approve or reject and include a reason when rejecting.' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const invoice = (await client.query('SELECT * FROM invoices WHERE id=$1 AND clinic_id=$2 FOR UPDATE', [id, clinicId])).rows[0];
    if (!invoice) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Invoice not found for this clinic.' }); }
    const previous = invoice.metadata || {};
    // Older invoices were voided immediately; allow a first clinical decision on
    // those records, but never reverse a completed decision or linked replacement.
    const legacy = invoice.status === 'void' && !previous.void_request_status;
    if (previous.void_request_status !== 'pending' && !legacy) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This void request has already been decided or is not pending.' }); }
    if (decision === 'reject' && (previous.replacement_invoice_id || previous.retained_invoice_id || previous.replaces_invoice_id)) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This void is linked to another invoice and cannot be reversed.' }); }
    const paid = Number((await client.query('SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE invoice_id=$1 AND clinic_id=$2', [id, clinicId])).rows[0].paid);
    if (paid > 0) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'A void decision cannot change an invoice with recorded payments.' }); }
    const approved = decision === 'approve';
    const at = new Date().toISOString();
    const event = { action: approved ? 'void_approved' : 'void_rejected', label: approved ? 'Void request approved by doctor' : 'Void request rejected by doctor', actor_id: req.user.id, actor: req.user.name || role, at, ...(reason ? { reason } : {}) };
    const status = approved ? 'void' : (['draft','issued','overdue'].includes(previous.void_previous_status) ? previous.void_previous_status : 'issued');
    const metadata = { ...previous, void_request_status: approved ? 'approved' : 'rejected', void_decided_by: req.user.id, void_decided_at: at, void_decision_reason: reason, billing_review_status: approved ? 'void' : (['pending','issued','returned'].includes(previous.void_previous_review_status) ? previous.void_previous_review_status : 'pending'), billing_activity: [...(Array.isArray(previous.billing_activity) ? previous.billing_activity : []), event] };
    if (approved && previous.void_related_invoice_id) {
      const linked = (await client.query('SELECT * FROM invoices WHERE id=$1 AND clinic_id=$2 FOR UPDATE', [previous.void_related_invoice_id, clinicId])).rows[0];
      if (!linked || linked.id === id || linked.status === 'void' || ['returned','void_requested'].includes(linked.metadata?.billing_review_status) || linked.metadata?.void_request_status === 'pending') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'The linked invoice is no longer valid. Reject this request so reception can submit a new one.' }); }
      if (previous.void_reason_code === 'duplicate_invoice' && (String(linked.client_id) !== String(invoice.client_id) || (invoice.appointment_id && String(linked.appointment_id) !== String(invoice.appointment_id)) || (invoice.consultation_id && String(linked.consultation_id) !== String(invoice.consultation_id)))) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'The retained invoice must belong to the same client and visit.' }); }
      if (previous.void_reason_code === 'invoice_replaced' && linked.metadata?.replaces_invoice_id && Number(linked.metadata.replaces_invoice_id) !== id) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'The replacement is already linked to another invoice.' }); }
      metadata[previous.void_reason_code === 'duplicate_invoice' ? 'retained_invoice_id' : 'replacement_invoice_id'] = linked.id;
      if (previous.void_reason_code === 'invoice_replaced') await client.query("UPDATE invoices SET metadata=COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('replaces_invoice_id',$2::integer),updated_at=now() WHERE id=$1 AND clinic_id=$3", [linked.id, id, clinicId]);
    }
    const updated = (await client.query('UPDATE invoices SET status=$3::invoice_status,metadata=$4::jsonb,updated_at=now() WHERE id=$1 AND clinic_id=$2 RETURNING id,status,metadata,total,issued_at', [id, clinicId, status, JSON.stringify(metadata)])).rows[0];
    await client.query("INSERT INTO audit_trail(user_id,action,table_name,record_id,old_data,new_data,ip_address) VALUES($1,$2,'invoices',$3,$4::jsonb,$5::jsonb,$6)", [req.user.id, event.action, id, JSON.stringify(invoice), JSON.stringify(updated), req.ip]);
    await notifyStaff(client, invoice, 'receptionist', approved ? 'Void request approved' : 'Void request rejected', `Invoice #${id}: ${approved ? 'The doctor approved the void.' : 'The doctor rejected the void. ' + reason}`);
    await client.query('COMMIT');
    publish(clinicId, 'billing');
    return res.json(updated);
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); next(error); } finally { client.release(); }
};

async function notifyStaff(client, invoice, kind, title, text) {
  const target = kind === 'doctor' ? (await client.query(`SELECT COALESCE(co.doctor_id,a.practitioner_id,
    CASE WHEN i.metadata->>'sent_to_reception_by' ~ '^[0-9]+$' THEN (i.metadata->>'sent_to_reception_by')::integer END) AS id
    FROM invoices i LEFT JOIN consultations co ON co.id=i.consultation_id AND co.clinic_id=i.clinic_id
    LEFT JOIN appointments a ON a.id=COALESCE(i.appointment_id,co.appointment_id) AND a.clinic_id=i.clinic_id WHERE i.id=$1`, [invoice.id])).rows[0]?.id : null;
  await client.query(`INSERT INTO clinic_notifications(clinic_id,recipient_user_id,title,text)
    SELECT u.clinic_id,u.id,$3,$4 FROM users u JOIN roles r ON r.id=u.role_id
    WHERE u.clinic_id=$1 AND COALESCE(u.is_active,true)
    AND lower(replace(replace(r.name,' ','_'),'-','_'))=ANY($2::text[])
    AND ($5::integer IS NULL OR u.id=$5)`, [invoice.clinic_id, kind === 'doctor' ? ['doctor','assistant_doctor','veterinarian'] : ['receptionist'], title, text, target || null]);
}

exports.paymentQr = async (req, res, next) => {
  const role = String(req.user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!['receptionist', 'owner', 'clinic_owner', 'super_admin'].includes(role)) return res.status(403).json({ error: 'Billing staff access is required.' });
  const clinicId = Number(role === 'super_admin' ? req.query.clinic_id : req.user?.clinic_id);
  if (!Number.isInteger(clinicId) || clinicId < 1) return res.status(400).json({ error: 'A valid clinic is required.' });
  try {
    const setting = (await db.query("SELECT value FROM settings WHERE clinic_id=$1 AND key='payment_qr' LIMIT 1", [clinicId])).rows[0]?.value;
    const method = req.query.method || 'qr_ph';
    const selected = setting?.methods && Object.hasOwn(setting.methods, method) ? setting.methods[method] : method === 'qr_ph' ? setting : null;
    const imageUrl = selected?.image_url;
    if (!imageUrl || !/^(https?:\/\/|\/(?!\/)|data:image\/(png|jpeg|webp);base64,)/i.test(imageUrl)) return res.json({ configured: false });
    res.json({ configured: true, image_url: imageUrl, account_name: selected.account_name || null });
  } catch (error) { next(error); }
};

exports.savePaymentQr = async (req, res, next) => {
  const role = String(req.user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!['owner', 'clinic_owner', 'super_admin'].includes(role)) return res.status(403).json({ error: 'Only clinic owners can configure payment QR codes.' });
  const clinicId = Number(role === 'super_admin' ? req.query.clinic_id : req.user?.clinic_id);
  if (!Number.isInteger(clinicId) || clinicId < 1) return res.status(400).json({ error: 'A valid clinic is required.' });
  const { method, image_url: image } = req.body;
  if (!['qr_ph', 'gcash', 'maya', 'bank_transfer'].includes(method)) return res.status(400).json({ error: 'Unsupported QR payment method.' });
  if (image !== null && (typeof image !== 'string' || image.length > 2800000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image))) return res.status(400).json({ error: 'Upload a PNG, JPEG, or WebP image under 2 MB.' });
  const entry = image === null ? null : { image_url: image, account_name: String(req.body.account_name || '').trim().slice(0, 150) };
  try {
    await db.query(`INSERT INTO settings (clinic_id, key, value) VALUES ($1, 'payment_qr', jsonb_build_object('methods', jsonb_build_object($2::text, $3::jsonb)))
      ON CONFLICT (clinic_id, key) DO UPDATE SET value = jsonb_set(settings.value, '{methods}', COALESCE(settings.value->'methods', '{}'::jsonb) || jsonb_build_object($2::text, $3::jsonb)), updated_at = now()`, [clinicId, method, JSON.stringify(entry)]);
    res.json({ success: true });
  } catch (error) { next(error); }
};

exports.review = async (req, res, next) => {
  const role = String(req.user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!['receptionist', 'owner', 'clinic_owner', 'super_admin'].includes(role)) return res.status(403).json({ error: 'Billing staff access is required.' });
  const clinicId = Number(role === 'super_admin' ? req.query.clinic_id : req.user?.clinic_id);
  const id = Number(req.params.id);
  const action = req.body.action;
  const reason = String(req.body.reason || '').trim().slice(0, 1000);
  const voidPolicy = action === 'void' ? VOID_REASONS.find(option => option.code === req.body.reason_code) : null;
  if (!Number.isInteger(clinicId) || clinicId < 1 || !Number.isInteger(id) || id < 1 || !['issue', 'return', 'void'].includes(action)) return res.status(400).json({ error: 'A valid clinic, invoice and review action are required.' });
  if (['return', 'void'].includes(action) && !reason) return res.status(400).json({ error: 'Enter a reason for this action.' });
  if (action === 'void') {
    if (!voidPolicy) return res.status(400).json({ error: 'Select a supported reason for voiding this invoice.' });
    if (req.body.can_be_corrected !== false || req.body.entire_invoice_invalid !== true) return res.status(409).json({ error: 'Correctable bills and invoices with valid charges must use Request Correction instead of Void.' });
    if (voidPolicy.noCharges && req.body.no_charges_owed !== true) return res.status(409).json({ error: 'This void reason requires confirmation that no legitimate charges are owed. Otherwise use Request Correction.' });
    if (voidPolicy.relatedInvoice && (!Number.isInteger(Number(req.body.related_invoice_id)) || Number(req.body.related_invoice_id) < 1 || Number(req.body.related_invoice_id) === id)) return res.status(400).json({ error: 'Select the correct invoice to retain or the existing replacement invoice.' });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const invoice = (await client.query('SELECT * FROM invoices WHERE id=$1 AND clinic_id=$2 FOR UPDATE', [id, clinicId])).rows[0];
    if (!invoice) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Invoice not found for this clinic.' }); }
    const paid = Number((await client.query('SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE invoice_id=$1 AND clinic_id=$2', [id, clinicId])).rows[0].paid);
    if (action === 'issue' && invoice.metadata?.billing_review_status === 'returned') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'The doctor must correct and resubmit this bill before it can be issued.' }); }
    if (invoice.metadata?.void_request_status === 'pending') { await client.query('ROLLBACK'); return res.status(409).json({error:'This invoice is awaiting the doctor?s void decision.'}); }
    if (invoice.status === 'void' || paid > 0) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Invoices that are void or have recorded payments cannot be changed through review.' }); }
    let relatedInvoice;
    if (voidPolicy?.relatedInvoice) {
      relatedInvoice = (await client.query('SELECT * FROM invoices WHERE id=$1 AND clinic_id=$2 FOR UPDATE', [Number(req.body.related_invoice_id),clinicId])).rows[0];
      if (!relatedInvoice || relatedInvoice.status === 'void' || ['returned','void_requested'].includes(relatedInvoice.metadata?.billing_review_status)) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'The linked invoice must be a valid invoice in this clinic.' }); }
      if (voidPolicy.code === 'invoice_replaced' && relatedInvoice.metadata?.replaces_invoice_id && relatedInvoice.metadata.replaces_invoice_id !== id) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'That replacement is already linked to another original invoice.' }); }
      if (voidPolicy.code === 'duplicate_invoice' && (String(relatedInvoice.client_id) !== String(invoice.client_id) || (invoice.appointment_id && String(relatedInvoice.appointment_id) !== String(invoice.appointment_id)) || (invoice.consultation_id && String(relatedInvoice.consultation_id) !== String(invoice.consultation_id)))) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Retain the correct invoice for the same client and consultation or visit.' }); }
      if (relatedInvoice.metadata?.replacement_invoice_id === id || relatedInvoice.metadata?.retained_invoice_id === id) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'These invoices cannot reference each other as replacements.' }); }
    }
    const reviewStatus = { issue: 'issued', return: 'returned', void: 'void_requested' }[action];
    if (invoice.metadata?.billing_review_status === reviewStatus) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This review action has already been completed.' }); }
    const event = { action, label: { issue: 'Invoice issued by receptionist', return: 'Returned for correction', void: 'Invoice void requested' }[action], actor_id: req.user.id, actor: req.user.name || role, at: new Date().toISOString(), ...(reason ? { reason } : {}) };
    const history = Array.isArray(invoice.metadata?.billing_activity) ? invoice.metadata.billing_activity : [];
    const metadata = { ...invoice.metadata, billing_review_status: reviewStatus, billing_reviewed_by: req.user.id, billing_reviewed_at: event.at, billing_activity: [...history, event], ...(reason ? { billing_review_reason: reason } : {}) };
    if (voidPolicy) {
      Object.assign(metadata, {void_request_status:'pending',void_requested_by:req.user.id,void_requested_at:event.at,void_previous_status:invoice.status,void_previous_review_status:invoice.metadata?.billing_review_status || 'pending',void_related_invoice_id:relatedInvoice?.id || null});
      Object.assign(metadata, { void_reason_code: voidPolicy.code, void_reason_label: voidPolicy.label, void_scope: 'entire_invoice', can_be_corrected: false, replacement_allowed: !!voidPolicy.replacement, ...(voidPolicy.noCharges ? { no_charges_owed: true } : {}) });
      event.reason_code = voidPolicy.code;

    }
    const updated = (await client.query(`UPDATE invoices SET status=$3::invoice_status, metadata=$4::jsonb,
      issued_at=CASE WHEN $5='issue' THEN COALESCE(issued_at,now()) ELSE issued_at END, updated_at=now()
      WHERE id=$1 AND clinic_id=$2 RETURNING id,status,metadata,issued_at,total`, [id, clinicId, action === 'void' ? invoice.status : action === 'return' ? 'draft' : 'issued', JSON.stringify(metadata), action])).rows[0];
    await client.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,old_data,new_data,ip_address)
      VALUES($1,$2,'invoices',$3,$4::jsonb,$5::jsonb,$6)`, [req.user.id, `invoice_review_${action}`, id, JSON.stringify(invoice), JSON.stringify(updated), req.ip]);
    if (['return', 'void'].includes(action)) {
      const ref = `INV-${String(invoice.issued_at ? new Date(invoice.issued_at).getFullYear() : new Date().getFullYear())}-${String(id).padStart(4,'0')}`;
      await notifyStaff(client, invoice, 'doctor', action === 'return' ? 'Billing needs correction' : 'Invoice void request from reception', `${ref}: ${reason}`);
    }
    await client.query('COMMIT');
    publish(clinicId, 'billing');
    res.json(updated);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally { client.release(); }
};

exports.correct = async (req, res, next) => {
  const role = String(req.user?.role || '').trim().toLowerCase().replace(/[\s-]+/g,'_');
  if (!['doctor','assistant_doctor','veterinarian'].includes(role)) return res.status(403).json({ error: 'Only clinical staff can correct and resubmit a bill.' });
  const clinicId = Number(req.user.clinic_id), id = Number(req.params.id);
  const note = String(req.body.note || '').trim().slice(0,1000);
  const activityNote = note || 'Billing summary updated.';
  const details = req.body.visit_details;
  const detailKeys = ['doctor','appointment_type','visit_date','appointment_status'];
  if (details !== undefined && (!details || typeof details !== 'object' || Array.isArray(details) || detailKeys.some(key=>typeof details[key] !== 'string' || details[key].length>200) || !/^\d{4}-\d{2}-\d{2}$/.test(details.visit_date) || !Number.isFinite(Date.parse(details.visit_date)))) return res.status(400).json({error:'Provide valid visit details.'});
  const removedAttachments = req.body.removed_attachment_ids || [];
  const uploads = req.body.attachments || [];
  if (!Array.isArray(removedAttachments) || removedAttachments.length>100 || removedAttachments.some(id=>!Number.isInteger(id)||id<1) || !Array.isArray(uploads) || uploads.length>3) return res.status(400).json({error:'Invalid invoice attachments.'});
  for (const file of uploads) {
    if (!file || typeof file!=='object') return res.status(400).json({error:'Invalid attachment.'});
    const prefix='data:'+file.content_type+';base64,';
    if (!['application/pdf','image/jpeg','image/png'].includes(file.content_type) || typeof file.filename!=='string' || !file.filename.trim() || file.filename.length>255 || typeof file.data!=='string' || !file.data.startsWith(prefix)) return res.status(400).json({error:'Choose PDF, JPG, or PNG attachments.'});
    const encoded=file.data.slice(prefix.length);
    if (!encoded || encoded.length>5600000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return res.status(400).json({error:'Attachments must be 4 MB or smaller.'});
    const bytes=Buffer.from(encoded,'base64');
    const valid=file.content_type==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':file.content_type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===255&&bytes[1]===216;
    if (!valid || !bytes.length || bytes.length>4194304) return res.status(400).json({error:'Attachment format or size is invalid.'});
  }
  const items = req.body.items;
  const tax = Number(req.body.tax || 0);
  const summaryKeys = ['chiefComplaint','diagnosis','clinicalFindings','plan'];
  const summary = req.body.clinical_summary;
  if (summary !== undefined && (!summary || typeof summary !== 'object' || Array.isArray(summary) || summaryKeys.some(key => typeof summary[key] !== 'string' || summary[key].length > 10000))) return res.status(400).json({ error: 'Provide a valid clinical summary.' });
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(clinicId) || clinicId < 1 || !Array.isArray(items) || !items.length || items.length > 100 || !Number.isFinite(tax) || tax < 0 || tax > 1000000) return res.status(400).json({ error: 'Provide invoice items and valid tax.' });
  if (items.some(item=>!item || typeof item!=='object')) return res.status(400).json({error:'Each charge needs valid item details.'});
  const lines = items.map(item => ({ id: Number(item.id), description: String(item.description || '').trim().slice(0,500), quantity: Number(item.quantity), unit_price: Number(item.unit_price), ...(item.item_type !== undefined ? {item_type:String(item.item_type)} : {}) }));
  if (lines.some(line => line.item_type !== undefined && !['consultation','treatment','medication','vaccination','lab_test','inpatient','product'].includes(line.item_type))) return res.status(400).json({error:'Select a valid charge type.'});
  const twoDecimals = value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
  if (!twoDecimals(tax) || lines.some(line => !twoDecimals(line.quantity) || !twoDecimals(line.unit_price))) return res.status(400).json({ error: 'Quantities, prices and tax must have at most two decimal places.' });
  if (new Set(lines.map(line => line.id)).size !== lines.length || lines.some(line => !Number.isInteger(line.id) || !line.description || !Number.isFinite(line.quantity) || line.quantity <= 0 || line.quantity > 10000 || !Number.isFinite(line.unit_price) || line.unit_price < 0 || line.unit_price > 1000000)) return res.status(400).json({ error: 'Each charge needs a valid item, description, quantity and nonnegative price.' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const invoice = (await client.query('SELECT * FROM invoices WHERE id=$1 AND clinic_id=$2 FOR UPDATE',[id,clinicId])).rows[0];
    if (!invoice) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Invoice not found for this clinic.' }); }
    if(invoice.metadata?.void_request_status === 'pending') {await client.query('ROLLBACK');return res.status(409).json({error:'Decide the void request before correcting this invoice.'});}
    const voided = invoice.status === 'void';
    const replacementPolicy = VOID_REASONS.find(option => option.code === invoice.metadata?.void_reason_code);
    const paid = Number((await client.query('SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE invoice_id=$1',[id])).rows[0].paid);
    if (paid > 0 || (!voided && invoice.metadata?.billing_review_status !== 'returned') || invoice.metadata?.replacement_invoice_id) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Only unpaid returned bills or voided bills without a replacement can be corrected.' }); }
    if (voided && !replacementPolicy?.replacement) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This void reason does not allow creating a replacement through correction. Keep the valid retained invoice, or leave the invalid invoice voided.' }); }
    let replacementVisit;
    if (voided) {
      const targetAppointmentId = Number(req.body.target_appointment_id);
      if (!Number.isInteger(targetAppointmentId) || targetAppointmentId < 1) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Select the correct patient and visit for the replacement invoice.' }); }
      replacementVisit = (await client.query(`SELECT a.*,p.client_id AS pet_client_id,
        (SELECT c.id FROM consultations c WHERE c.appointment_id=a.id AND c.clinic_id=a.clinic_id ORDER BY c.id DESC LIMIT 1) AS consultation_id
        FROM appointments a JOIN pets p ON p.id=a.pet_id AND p.clinic_id=a.clinic_id
        WHERE a.id=$1 AND a.clinic_id=$2`,[targetAppointmentId,clinicId])).rows[0];
      if (!replacementVisit || !replacementVisit.pet_client_id || ['cancelled','canceled','no_show'].includes(String(replacementVisit.status).toLowerCase())) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Choose a valid patient visit with a client and billable services.' }); }
      const originalPetId = invoice.metadata?.pet_id || (invoice.appointment_id ? (await client.query('SELECT pet_id FROM appointments WHERE id=$1 AND clinic_id=$2',[invoice.appointment_id,clinicId])).rows[0]?.pet_id : null);
      if (replacementPolicy.code === 'wrong_patient' && String(originalPetId) === String(replacementVisit.pet_id)) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'A wrong-patient replacement must select the correct different patient.' }); }
      if (replacementPolicy.code === 'incorrect_billing_record' && String(invoice.appointment_id) === String(targetAppointmentId)) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Choose the correct different visit for an invalid billing record. For charge changes on this visit, use Request Correction.' }); }
    }
    let correctedPetId;
    if (!voided && req.body.target_appointment_id && Number(req.body.target_appointment_id)!==Number(invoice.appointment_id)) {
      const visitId=Number(req.body.target_appointment_id);
      if (!Number.isInteger(visitId) || visitId<1) {await client.query('ROLLBACK');return res.status(400).json({error:'Choose a valid patient visit.'});}
      const visit=(await client.query("SELECT a.id,a.pet_id,p.client_id,(SELECT co.id FROM consultations co WHERE co.appointment_id=a.id AND co.clinic_id=a.clinic_id ORDER BY co.id DESC LIMIT 1) AS consultation_id FROM appointments a JOIN pets p ON p.id=a.pet_id AND p.clinic_id=a.clinic_id WHERE a.id=$1 AND a.clinic_id=$2 AND a.status::text NOT IN ('cancelled','canceled','no_show')",[visitId,clinicId])).rows[0];
      if (!visit || !visit.client_id) {await client.query('ROLLBACK');return res.status(400).json({error:'Choose a patient visit in this clinic with a registered owner.'});}
      await client.query('UPDATE invoices SET appointment_id=$2,consultation_id=$3,client_id=$4 WHERE id=$1',[id,visit.id,visit.consultation_id,visit.client_id]);
      correctedPetId=visit.pet_id;
    }
    const originalLines = (await client.query('SELECT * FROM invoice_items WHERE invoice_id=$1 ORDER BY id',[id])).rows;
    if ((voided && (lines.length !== originalLines.length || lines.some(line=>!originalLines.some(original=>original.id===line.id)))) || lines.some(line=>line.id>0 && !originalLines.some(original=>original.id===line.id))) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Correction must include each existing invoice charge.' }); }
    const subtotal = lines.reduce((sum,line) => sum + Math.round(line.quantity * line.unit_price * 100),0) / 100;
    const total = Math.round((subtotal + tax)*100)/100;
    if (total > 9999999999.99) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Invoice total is too large.' }); }
    const event = { action:'correct', label: voided ? 'Corrected replacement sent to reception' : 'Corrected bill sent to reception', actor_id:req.user.id, actor:req.user.name || role, at:new Date().toISOString(), reason:activityNote };
    const metadata = { ...invoice.metadata, billing_review_status:'pending', sent_to_reception:true, sent_to_reception_at:event.at, sent_to_reception_by:req.user.id, billing_activity:[...(Array.isArray(invoice.metadata?.billing_activity)?invoice.metadata.billing_activity:[]),event], correction_note:note };
    if (correctedPetId) {metadata.pet_id=correctedPetId;delete metadata.lab_test_id;}
    if (!voided && summary) metadata.invoice_clinical_summary = Object.fromEntries(summaryKeys.map(key => [key, summary[key].trim()]));
    if (!voided && details) metadata.billing_visit_details = Object.fromEntries(detailKeys.map(key=>[key,details[key].trim()]));
    if (!voided) metadata.hidden_invoice_attachment_ids = [...new Set([...(Array.isArray(metadata.hidden_invoice_attachment_ids)?metadata.hidden_invoice_attachment_ids:[]),...removedAttachments])];
    delete metadata.replacement_invoice_id;
    let targetId=id;
    if (voided) {
      for (const key of Object.keys(metadata).filter(key=>key.startsWith('void_'))) delete metadata[key];
      for (const key of ['invoice_clinical_summary','billing_visit_details','hidden_invoice_attachment_ids','void_reason_code','void_reason_label','void_scope','can_be_corrected','no_charges_owed','replacement_allowed','retained_invoice_id','lab_test_id','due_date','owner_communication']) delete metadata[key];
      metadata.pet_id = replacementVisit.pet_id;
      metadata.replaces_invoice_id=id;
      targetId=(await client.query(`INSERT INTO invoices(clinic_id,client_id,appointment_id,consultation_id,status,currency,subtotal,tax,total,issued_at,metadata)
        VALUES($1,$2,$3,$4,'issued',$5,$6,$7,$8,now(),$9::jsonb) RETURNING id`,[clinicId,replacementVisit.pet_client_id,replacementVisit.id,replacementVisit.consultation_id,invoice.currency,subtotal,tax,total,JSON.stringify(metadata)])).rows[0].id;
      await client.query("UPDATE invoices SET metadata=metadata || jsonb_build_object('replacement_invoice_id',$2::integer),updated_at=now() WHERE id=$1",[id,targetId]);
    } else await client.query("UPDATE invoices SET subtotal=$2,tax=$3,total=$4,status='issued',metadata=$5::jsonb,updated_at=now() WHERE id=$1",[id,subtotal,tax,total,JSON.stringify(metadata)]);
    if (!voided) await client.query('DELETE FROM invoice_items WHERE invoice_id=$1 AND NOT (id=ANY($2::integer[]))',[id,lines.filter(line=>line.id>0).map(line=>line.id)]);
    for (const line of lines) {
      const original=originalLines.find(item => item.id===line.id);
      if (voided) await client.query('INSERT INTO invoice_items(invoice_id,item_type,catalog_item_id,description,quantity,unit_price) VALUES($1,$2,$3,$4,$5,$6)',[targetId,original.item_type,original.catalog_item_id,line.description,line.quantity,line.unit_price]);
      else if (line.id<=0) await client.query('INSERT INTO invoice_items(invoice_id,item_type,description,quantity,unit_price) VALUES($1,$2,$3,$4,$5)',[targetId,line.item_type || 'consultation',line.description,line.quantity,line.unit_price]);
      else await client.query('UPDATE invoice_items SET description=$2,quantity=$3,unit_price=$4,item_type=$6 WHERE id=$1 AND invoice_id=$5',[line.id,line.description,line.quantity,line.unit_price,id,line.item_type || original.item_type]);
    }
    if (!voided) for (const file of uploads) await client.query("INSERT INTO attachments(clinic_id,owner_table,owner_id,filename,content_type,url,metadata) VALUES($1,'invoices',$2,$3,$4,$5,$6::jsonb)",[clinicId,targetId,file.filename.trim().replace(/[\\/\r\n]/g,'_'),file.content_type,file.data,JSON.stringify({source:'invoice_attachment',uploaded_by:req.user.id})]);
    await client.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,old_data,new_data,ip_address) VALUES($1,'correct_invoice','invoices',$2,$3::jsonb,$4::jsonb,$5)`,[req.user.id,targetId,JSON.stringify({invoice,items:originalLines}),JSON.stringify({items:lines,total,metadata}),req.ip]);
    await notifyStaff(client,{...invoice,id:targetId},'receptionist','Corrected bill ready for review',`Invoice #${targetId} was corrected and resubmitted. ${note}`);
    const result=(await client.query(`SELECT i.*,p.name AS pet,p.id AS pet_id,c.name AS owner,u.name AS doctor,
      COALESCE((SELECT json_agg(ii ORDER BY ii.id) FROM invoice_items ii WHERE ii.invoice_id=i.id),'[]'::json) AS items
      FROM invoices i LEFT JOIN appointments a ON a.id=i.appointment_id AND a.clinic_id=i.clinic_id
      LEFT JOIN pets p ON p.id=a.pet_id AND p.clinic_id=i.clinic_id LEFT JOIN clients c ON c.id=i.client_id AND c.clinic_id=i.clinic_id
      LEFT JOIN users u ON u.id=a.practitioner_id WHERE i.id=$1`,[targetId])).rows[0];
    await client.query('COMMIT'); publish(clinicId,'billing'); res.json({ invoice:{...result,...(!voided && metadata.billing_visit_details?metadata.billing_visit_details:{}),...(!voided && metadata.invoice_clinical_summary?{consultation_notes:metadata.invoice_clinical_summary}:{})}, original_invoice_id:id, replacement:voided });
  } catch(error) { await client.query('ROLLBACK').catch(()=>{}); next(error); } finally { client.release(); }
};
