/**
 * Consumes the linked, usable inventory for a billed service inside the
 * caller's transaction. Each linked item is consumed once per billed unit.
 * Lots are used in expiry order so a newer delivery cannot be used first.
 */
async function consumeLinkedInventory(client, { clinicId, catalogItem, quantity, user, ipAddress }) {
  if (catalogItem.item_type === 'vaccination') return [];
  const linked = await client.query(
    `SELECT i.*
     FROM clinic_service_inventory_links link
     JOIN clinic_inventory_items i ON i.id=link.inventory_item_id AND i.clinic_id=link.clinic_id
     WHERE link.clinic_id=$1 AND link.catalog_item_id=$2 AND i.active=true
     ORDER BY i.id FOR UPDATE`,
    [clinicId, catalogItem.id],
  );
  const consumed = [];

  for (const item of linked.rows) {
    if (String(item.category || '').toLowerCase() === 'equipment & assets') continue;
    const lots = await client.query(
      `SELECT id,quantity,unit,lot_number,expiry_date
       FROM clinic_inventory_lots
       WHERE clinic_id=$1 AND inventory_item_id=$2 AND status='available'
         AND quantity>0 AND (expiry_date IS NULL OR expiry_date>=CURRENT_DATE)
       ORDER BY expiry_date NULLS LAST,id FOR UPDATE`,
      [clinicId, item.id],
    );
    const available = lots.rows.reduce((total, lot) => total + Number(lot.quantity || 0), 0);
    if (available < quantity) {
      const error = new Error(`${item.name} has only ${available} ${item.unit} available; ${quantity} ${item.unit} is needed to dispense this service.`);
      error.code = 'INSUFFICIENT_INVENTORY';
      throw error;
    }
    let remaining = quantity;
    const lotUsage = [];
    for (const lot of lots.rows) {
      if (!remaining) break;
      const used = Math.min(remaining, Number(lot.quantity));
      await client.query('UPDATE clinic_inventory_lots SET quantity=quantity-$1,updated_at=now() WHERE id=$2',[used,lot.id]);
      lotUsage.push({ lot_number:lot.lot_number, quantity:used });
      remaining -= used;
    }
    const totals = await client.query('SELECT COALESCE(SUM(quantity),0)::integer AS quantity FROM clinic_inventory_lots WHERE clinic_id=$1 AND inventory_item_id=$2',[clinicId,item.id]);
    const physicalQuantity = Number(totals.rows[0].quantity || 0);
    await client.query('UPDATE clinic_inventory_items SET quantity=$1,updated_at=now() WHERE id=$2 AND clinic_id=$3',[physicalQuantity,item.id,clinicId]);
    if (item.vaccine_batch_id) await client.query('UPDATE clinic_vaccine_batches SET quantity=$1,updated_at=now() WHERE id=$2 AND clinic_id=$3',[physicalQuantity,item.vaccine_batch_id,clinicId]);
    const event = { clinic_id:clinicId, catalog_item_id:catalogItem.id, service_name:catalogItem.name, quantity, unit:item.unit, remaining_quantity:physicalQuantity, lots:lotUsage, _audit:{ role:user?.role || null, recorded_at:new Date().toISOString() } };
    await client.query(`INSERT INTO audit_trail(user_id,action,table_name,record_id,new_data,ip_address)
      VALUES($1,'dispense_inventory','clinic_inventory_items',$2,$3::jsonb,$4)`,[user?.id || null,item.id,JSON.stringify(event),ipAddress || null]);
    consumed.push({ inventory_item_id:item.id, quantity, unit:item.unit, remaining_quantity:physicalQuantity });
  }
  return consumed;
}

module.exports = { consumeLinkedInventory };
