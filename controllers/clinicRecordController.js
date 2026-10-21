const db = require('../config/db');
const dns = require('dns').promises;
const crypto = require('crypto');
const { validateOwnerFields, validateClinicalDates, validateOverrideReason } = require('../validation');
const { logAudit } = require('../utils/audit');
const defaultClinicCatalog = require('../data/defaultClinicCatalog');
const additionalClinicCatalog = require('../data/additionalClinicCatalog');
const ownerCatalog202610 = require('../data/ownerCatalog202610');

const normalizeClinicId = (value) => {
  if (value === undefined || value === null) return null;
  const clinicId = parseInt(value, 10);
  return Number.isNaN(clinicId) ? null : clinicId;
};

const getClinicIdFromRequest = (req) => {
  const explicitClinicId = normalizeClinicId(req.query.clinic_id);
  const userClinicId = normalizeClinicId(req.user && req.user.clinic_id);

  if (explicitClinicId) {
    if (req.user && req.user.role === 'super_admin') return explicitClinicId;
    if (userClinicId && explicitClinicId === userClinicId) return explicitClinicId;
  }

  return userClinicId;
};

const requireClinicId = (req, res) => {
  const clinicId = getClinicIdFromRequest(req);
  if (!clinicId) {
    res.status(400).json({ error: 'Clinic id required for this resource' });
    return null;
  }
  return clinicId;
};

const billingCatalogTypes = new Set(['consultation', 'treatment', 'medication', 'vaccination', 'lab_test', 'inpatient']);
const billingCatalogCategories = new Set([
  'Consultation', 'Treatment', 'Medication', 'Vaccination', 'Laboratory', 'Confinement',
  'Surgery', 'Dental', 'Grooming', 'General', 'Medical Supplies', 'Wound Care',
  'Laboratory Supplies', 'Grooming & Hygiene', 'Surgical Equipment', 'Clinic Accessories',
]);
const defaultCategoryByType = {
  consultation: 'Consultation', treatment: 'Treatment', medication: 'Medication',
  vaccination: 'Vaccination', lab_test: 'Laboratory', inpatient: 'Confinement',
};
const canManageBillingCatalog = role => ['clinic_owner', 'owner', 'super_admin'].includes(String(role || '').toLowerCase());
const canManageClinicalRecords = role => ['doctor', 'assistant_doctor', 'veterinarian', 'clinic_owner', 'owner', 'super_admin']
  .includes(String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_'));

exports.listBillingCatalog = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const includeInactive = req.query.include_inactive === 'true';
    const result = await db.query(
      `SELECT id, clinic_id, item_type, category, name, description, unit, duration, unit_price, active, created_at, updated_at
       FROM clinic_billing_catalog
       WHERE clinic_id = $1 AND ($2::boolean OR active = true)
       ORDER BY item_type, name`,
      [clinicId, includeInactive]
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
};

exports.seedDefaultBillingCatalog = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    if (!canManageBillingCatalog(req.user?.role)) {
      return res.status(403).json({ error: 'Only clinic owners can add the suggested clinic price catalog.' });
    }
    await client.query(`
      CREATE TABLE IF NOT EXISTS clinic_billing_catalog_seeds (
        clinic_id INTEGER NOT NULL,
        seed_key TEXT NOT NULL,
        seeded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (clinic_id, seed_key)
      )
    `);
    await client.query('BEGIN');
    const baseSeed = await client.query(
      `INSERT INTO clinic_billing_catalog_seeds (clinic_id, seed_key)
       VALUES ($1, 'owner-price-list-2026-10')
       ON CONFLICT DO NOTHING
       RETURNING clinic_id`,
      [clinicId]
    );
    let applied = 0;
    if (baseSeed.rowCount) {
      const baseResult = await client.query(
        `INSERT INTO clinic_billing_catalog (clinic_id, item_type, category, name, description, unit, unit_price)
       SELECT $1, item.item_type, item.category, item.name, item.description, item.unit, item.unit_price
       FROM jsonb_to_recordset($2::jsonb) AS item(
         item_type text, category text, name text, description text, unit text, unit_price numeric
       )
       ON CONFLICT (clinic_id, item_type, name) DO UPDATE SET
         category=EXCLUDED.category,
         description=EXCLUDED.description,
         unit=EXCLUDED.unit,
         unit_price=EXCLUDED.unit_price,
         updated_at=now()
       RETURNING id`,
      [clinicId, JSON.stringify(defaultClinicCatalog.map(item => ({
        item_type: item.item_type,
        category: defaultCategoryByType[item.item_type] || 'General',
        name: item.name,
        description: item.description,
        unit: item.unit,
        unit_price: item.price,
      })))]
      );
      applied += baseResult.rowCount;
    }
    const additionalSeed = await client.query(
      `INSERT INTO clinic_billing_catalog_seeds (clinic_id, seed_key)
       VALUES ($1, 'owner-price-list-additions-2026-10')
       ON CONFLICT DO NOTHING
       RETURNING clinic_id`,
      [clinicId]
    );
    if (additionalSeed.rowCount) {
      const additionsResult = await client.query(
        `INSERT INTO clinic_billing_catalog (clinic_id, item_type, category, name, description, unit, unit_price)
         SELECT $1, item.item_type, item.category, item.name, item.description, item.unit, item.unit_price
         FROM jsonb_to_recordset($2::jsonb) AS item(
           item_type text, category text, name text, description text, unit text, unit_price numeric
         )
         ON CONFLICT (clinic_id, item_type, name) DO NOTHING
         RETURNING id`,
        [clinicId, JSON.stringify(additionalClinicCatalog.map(item => ({
          item_type: item.item_type,
          category: item.category,
          name: item.name,
          description: item.description,
          unit: item.unit,
          unit_price: item.price,
        })))]
      );
      applied += additionsResult.rowCount;
    }
    const ownerCatalogSeed = await client.query(
      `INSERT INTO clinic_billing_catalog_seeds (clinic_id, seed_key)
       VALUES ($1, 'owner-catalog-2026-10-21')
       ON CONFLICT DO NOTHING
       RETURNING clinic_id`,
      [clinicId]
    );
    if (ownerCatalogSeed.rowCount) {
      const ownerCatalogResult = await client.query(
        `INSERT INTO clinic_billing_catalog (clinic_id, item_type, category, name, description, unit, unit_price)
         SELECT $1, item.item_type, item.category, item.name, item.description, item.unit, item.unit_price
         FROM jsonb_to_recordset($2::jsonb) AS item(
           sku text, item_type text, category text, name text, description text, unit text, price numeric, unit_price numeric
         )
         WHERE NOT EXISTS (
           SELECT 1
           FROM clinic_billing_catalog existing
           WHERE existing.clinic_id = $1
             AND existing.item_type = item.item_type
             AND LOWER(existing.name) = LOWER(item.name)
         )
         ON CONFLICT (clinic_id, item_type, name) DO NOTHING
         RETURNING id`,
        [clinicId, JSON.stringify(ownerCatalog202610.map(item => ({
          sku: item.sku,
          item_type: item.item_type,
          category: item.category,
          name: item.name,
          description: item.description,
          unit: item.unit,
          price: item.price,
          unit_price: item.price,
        })))]
      );
      applied += ownerCatalogResult.rowCount;
    }
    await client.query('COMMIT');
    return res.json({ added: applied });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally {
    client.release();
  }
};

exports.createBillingCatalogItem = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    if (!canManageBillingCatalog(req.user?.role)) return res.status(403).json({ error: 'Only clinic owners can manage billing prices.' });
    const itemType = String(req.body.item_type || '').trim().toLowerCase();
    const category = String(req.body.category || defaultCategoryByType[itemType] || 'General').trim();
    const name = String(req.body.name || '').trim();
    const unit = String(req.body.unit || 'item').trim() || 'item';
    const rawPrice = req.body.unit_price;
    const price = Number(rawPrice);
    if (!billingCatalogTypes.has(itemType) || !billingCatalogCategories.has(category) || !name || name.length > 160 || !Number.isFinite(price) || price < 0) {
      return res.status(422).json({ error: 'Enter a valid item type, name, and non-negative price.' });
    }
    const result = await db.query(
      `INSERT INTO clinic_billing_catalog (clinic_id, item_type, category, name, description, unit, duration, unit_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (clinic_id, item_type, name) DO NOTHING
       RETURNING id, clinic_id, item_type, category, name, description, unit, duration, unit_price, active, created_at, updated_at`,
      [clinicId, itemType, category, name, String(req.body.description || '').trim() || null, unit,
        String(req.body.duration || '').trim() || null, price]
    );
    if (!result.rows.length) return res.status(409).json({ error: 'An item with this name and type already exists.' });
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
};

exports.updateBillingCatalogItem = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    if (!canManageBillingCatalog(req.user?.role)) return res.status(403).json({ error: 'Only clinic owners can manage billing prices.' });
    const id = Number.parseInt(req.params.id, 10);
    const itemType = String(req.body.item_type || '').trim().toLowerCase();
    const category = String(req.body.category || defaultCategoryByType[itemType] || 'General').trim();
    const name = String(req.body.name || '').trim();
    const unit = String(req.body.unit || 'item').trim() || 'item';
    const price = Number(req.body.unit_price);
    if (!Number.isInteger(id) || id < 1 || !billingCatalogTypes.has(itemType) || !billingCatalogCategories.has(category) || !name || name.length > 160 || !Number.isFinite(price) || price < 0
      || (req.body.active !== undefined && typeof req.body.active !== 'boolean')) {
      return res.status(422).json({ error: 'Enter valid catalog item details.' });
    }
    const result = await db.query(
      `UPDATE clinic_billing_catalog
       SET item_type=$1, category=$2, name=$3, description=$4, unit=$5, duration=$6, unit_price=$7,
           active=COALESCE($8, active), updated_at=now()
       WHERE id=$9 AND clinic_id=$10
       RETURNING id, clinic_id, item_type, category, name, description, unit, duration, unit_price, active, created_at, updated_at`,
      [itemType, category, name, String(req.body.description || '').trim() || null, unit,
        String(req.body.duration || '').trim() || null, price,
        req.body.active === undefined ? null : req.body.active, id, clinicId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Billing catalog item not found.' });
    return res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An item with this name and type already exists.' });
    return next(error);
  }
};

exports.listClients = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;

    const result = await db.query(
      `SELECT c.id,
              c.name,
              c.email,
              c.phone,
              c.address,
              COALESCE((c.metadata->>'archived')::boolean, false) AS archived,
              COALESCE((SELECT COUNT(*) FROM pets p WHERE p.client_id = c.id), 0) AS pets,
              COALESCE((SELECT json_agg(p.name ORDER BY p.name) FROM pets p WHERE p.client_id = c.id), '[]'::json) AS pet_names,
              c.created_at,
              c.updated_at
       FROM clients c
       WHERE c.clinic_id = $1
       ORDER BY c.name ASC`,
      [clinicId]
    );

    res.json(result.rows);
  } catch (e) {
    next(e);
  }
};

exports.createClient = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;

    const { errors, normalized } = validateOwnerFields(req.body);
    const { name, email, phone } = normalized;
    const address = String(req.body.address || '').trim();

    if (Object.keys(errors).length) return res.status(422).json({ error: 'Validation failed', fields: errors });

    const emailDomain = email.split('@')[1];
    let emailDomainVerified = false;
    try {
      emailDomainVerified = (await dns.resolveMx(emailDomain)).length > 0;
    } catch {
      // DNS availability is not a reliable reason to block local clinic records.
      emailDomainVerified = false;
    }

    const duplicate = await db.query(
      `SELECT id, name, email, phone
       FROM clients
       WHERE clinic_id = $1
         AND (
           LOWER(TRIM(email)) = LOWER($2)
           OR right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = right($3, 10)
         )
       LIMIT 1`,
      [clinicId, email, phone]
    );
    if (duplicate.rows.length) {
      const existing = duplicate.rows[0];
      const sameEmail = String(existing.email || '').trim().toLowerCase() === email;
      return res.status(409).json({
        error: sameEmail
          ? 'This email address is already registered to another owner.'
          : 'This contact number is already registered to another owner.',
        fields: { [sameEmail ? 'email' : 'phone']: sameEmail ? 'Use a different email address.' : 'Use a different contact number.' },
      });
    }

    const result = await db.query(
      `INSERT INTO clients (clinic_id, name, email, phone, address, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, clinic_id, name, email, phone, address, metadata, created_at, updated_at`,
      [clinicId, name, email, phone, address || null, JSON.stringify({
        verification: {
          email_domain_verified: emailDomainVerified,
          phone_verified: false,
          status: 'pending_phone_verification',
        },
      })]
    );
    const client = { ...result.rows[0], pets: 0, archived: false };

    await logAudit({
      user_id: req.user && req.user.id ? req.user.id : null,
      role: req.user && req.user.role,
      action: 'create',
      table_name: 'clients',
      record_id: client.id,
      new_data: client,
      reason: 'Owner record created.',
      ip_address: req.ip || req.connection.remoteAddress,
    });

    res.status(201).json(client);
  } catch (e) {
    next(e);
  }
};

exports.archiveClient = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const clientId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(clientId)) return res.status(400).json({ error: 'Invalid owner ID.' });

    const current = await db.query(
      `SELECT id, clinic_id, name, email, phone, address, metadata
       FROM clients WHERE id = $1 AND clinic_id = $2`,
      [clientId, clinicId]
    );
    if (!current.rows.length) return res.status(404).json({ error: 'Owner not found.' });

    const existing = current.rows[0];
    const archived = req.body.archived === true;
    const metadata = { ...(existing.metadata || {}), archived };
    const result = await db.query(
      `UPDATE clients SET metadata = $1, updated_at = now()
       WHERE id = $2 AND clinic_id = $3
       RETURNING id, clinic_id, name, email, phone, address, metadata, updated_at`,
      [JSON.stringify(metadata), clientId, clinicId]
    );
    const client = {
      ...result.rows[0],
      archived,
      pets: Number((await db.query('SELECT COUNT(*) FROM pets WHERE client_id = $1', [clientId])).rows[0].count),
    };

    await db.query(
      `INSERT INTO audit_trail (user_id, action, table_name, record_id, old_data, new_data, ip_address)
       VALUES ($1, $2, 'clients', $3, $4, $5, $6)`,
      [req.user && req.user.id ? req.user.id : null, archived ? 'archive' : 'restore', clientId, JSON.stringify(existing), JSON.stringify(client), req.ip || req.connection.remoteAddress]
    );

    res.json(client);
  } catch (e) {
    next(e);
  }
};

exports.listPets = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;

    const result = await db.query(
      `SELECT p.id,
              p.name,
              p.species,
              p.breed,
              p.sex,
              p.birth_date,
              p.color,
              p.microchip,
              p.notes,
              p.metadata->>'age' AS age,
              p.metadata->>'weight' AS weight,
              p.metadata->>'weight_target' AS weight_target,
              COALESCE(p.metadata->>'allergies', 'Not recorded') AS allergies,
              COALESCE((p.metadata->>'archived')::boolean, false) AS archived,
              profile_photo.url AS photo_url,
              p.client_id,
              c.name AS owner,
              c.phone AS owner_phone,
              c.email AS owner_email,
              p.created_at,
              p.updated_at
       FROM pets p
       LEFT JOIN clients c ON p.client_id = c.id
       LEFT JOIN LATERAL (
         SELECT a.url
         FROM attachments a
         WHERE a.clinic_id = p.clinic_id
           AND a.owner_table = 'pets'
           AND a.owner_id = p.id
           AND a.metadata->>'source' = 'pet_profile_photo'
         ORDER BY a.uploaded_at DESC, a.id DESC
         LIMIT 1
       ) profile_photo ON true
       WHERE p.clinic_id = $1
       ORDER BY p.name ASC`,
      [clinicId]
    );

    res.json(result.rows);
  } catch (e) {
    next(e);
  }
};

exports.uploadPetPhoto = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const petId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(petId) || petId < 1) return res.status(400).json({ error: 'Invalid pet ID.' });

    const petResult = await db.query(
      'SELECT id FROM pets WHERE id = $1 AND clinic_id = $2',
      [petId, clinicId]
    );
    if (!petResult.rows.length) return res.status(404).json({ error: 'Pet not found.' });

    const filename = String(req.body.filename || '').trim().slice(0, 255);
    const contentType = String(req.body.content_type || '').trim().toLowerCase();
    const data = String(req.body.data || '');
    const prefix = `data:${contentType};base64,`;
    if (!filename || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType) || !data.startsWith(prefix)) {
      return res.status(422).json({ error: 'Choose a valid JPEG, PNG, or WEBP pet photo.' });
    }
    const encoded = data.slice(prefix.length);
    if (!encoded || encoded.length > 1_400_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      return res.status(413).json({ error: 'Pet photos must be smaller than 1 MB.' });
    }
    const imageBytes = Buffer.from(encoded, 'base64');
    if (!imageBytes.length || imageBytes.length > 1_048_576) {
      return res.status(413).json({ error: 'Pet photos must be smaller than 1 MB.' });
    }

    const existing = await db.query(
      `SELECT id
       FROM attachments
       WHERE clinic_id = $1 AND owner_table = 'pets' AND owner_id = $2
         AND metadata->>'source' = 'pet_profile_photo'
       ORDER BY uploaded_at DESC, id DESC
       LIMIT 1`,
      [clinicId, petId]
    );
    const metadata = JSON.stringify({ source: 'pet_profile_photo', uploaded_by: req.user.id });
    const saved = existing.rows.length
      ? await db.query(
          `UPDATE attachments
           SET filename = $1, content_type = $2, url = $3, metadata = $4::jsonb, uploaded_at = now()
           WHERE id = $5 AND clinic_id = $6
           RETURNING id, filename, content_type, url, uploaded_at`,
          [filename, contentType, data, metadata, existing.rows[0].id, clinicId]
        )
      : await db.query(
          `INSERT INTO attachments (clinic_id, owner_table, owner_id, filename, content_type, url, metadata)
           VALUES ($1, 'pets', $2, $3, $4, $5, $6::jsonb)
           RETURNING id, filename, content_type, url, uploaded_at`,
          [clinicId, petId, filename, contentType, data, metadata]
        );

    await logAudit({
      user_id: req.user.id,
      role: req.user.role,
      action: 'upload_profile_photo',
      table_name: 'pets',
      record_id: petId,
      reason: 'Pet profile photo uploaded.',
      ip_address: req.ip || req.connection.remoteAddress,
    });
    return res.status(201).json({ photo_url: saved.rows[0].url });
  } catch (error) {
    return next(error);
  }
};

exports.createPet = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const name = String(req.body.name || '').trim();
    const species = String(req.body.species || '').trim();
    const breed = String(req.body.breed || '').trim();
    const notes = String(req.body.notes || '').trim();
    const age = String(req.body.age || '').trim();
    const allergies = String(req.body.allergies || '').trim();
    const sex = ['male', 'female'].includes(String(req.body.sex || '').toLowerCase()) ? String(req.body.sex).toLowerCase() : 'unknown';
    const birthDate = String(req.body.birth_date || '').trim() || null;
    const color = String(req.body.color || '').trim();
    const microchip = String(req.body.microchip || '').trim();
    const weight = String(req.body.weight || '').trim();
    const clientId = Number.parseInt(req.body.client_id, 10);
    const errors = {};
    if (!/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(name)) errors.name = 'Enter a valid pet name.';
    if (!species) errors.species = 'Select a species.';
    if (!breed || breed.length > 80) errors.breed = 'Enter a valid breed.';
    if (!Number.isInteger(clientId)) errors.client_id = 'Select a registered owner.';
    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) errors.birth_date = 'Enter a valid date of birth.';
    if (weight && (!Number.isFinite(Number(weight)) || Number(weight) <= 0)) errors.weight = 'Enter a valid weight.';
    if (Object.keys(errors).length) return res.status(422).json({ error: 'Validation failed', fields: errors });

    const owner = await db.query('SELECT id FROM clients WHERE id = $1 AND clinic_id = $2', [clientId, clinicId]);
    if (!owner.rows.length) return res.status(422).json({ error: 'Selected owner is not registered at this clinic.' });

    const result = await db.query(
      `INSERT INTO pets (clinic_id, client_id, name, species, breed, sex, birth_date, color, microchip, notes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::sex_type, $7, NULLIF($8, ''), NULLIF($9, ''), NULLIF($10, ''),
         jsonb_build_object('allergies', NULLIF($11, ''), 'age', NULLIF($12, ''), 'weight', NULLIF($13, '')::numeric))
       RETURNING id, clinic_id, client_id, name, species, breed, sex, birth_date, color, microchip, notes, metadata, created_at, updated_at`,
      [clinicId, clientId, name, species, breed, sex, birthDate, color, microchip, notes, allergies, age, weight]
    );
    const pet = {
      ...result.rows[0],
      age: age || null,
      weight: weight || null,
      allergies: allergies || 'Not recorded',
      photo_url: null,
      archived: false,
    };
    await logAudit({
      user_id: req.user && req.user.id ? req.user.id : null,
      role: req.user && req.user.role,
      action: 'create',
      table_name: 'pets',
      record_id: pet.id,
      new_data: pet,
      reason: 'Patient record created.',
      ip_address: req.ip || req.connection.remoteAddress,
    });
    res.status(201).json(pet);
  } catch (e) {
    next(e);
  }
};

exports.updatePet = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const petId = Number.parseInt(req.params.id, 10);
    const clientId = Number.parseInt(req.body.client_id, 10);
    if (!Number.isInteger(petId)) return res.status(400).json({ error: 'Invalid pet ID.' });
    const current = await db.query('SELECT * FROM pets WHERE id = $1 AND clinic_id = $2', [petId, clinicId]);
    if (!current.rows.length) return res.status(404).json({ error: 'Pet not found.' });
    const existing = current.rows[0];
    const isTransfer = Number.isInteger(clientId) && clientId !== Number(existing.client_id);
    if (isTransfer || req.body.client_id != null) {
      if (!Number.isInteger(clientId)) return res.status(400).json({ error: 'Invalid owner ID.' });
      const owner = await db.query('SELECT id FROM clients WHERE id = $1 AND clinic_id = $2', [clientId, clinicId]);
      if (!owner.rows.length) return res.status(422).json({ error: 'Selected owner is not registered at this clinic.' });
    }
    const name = String(req.body.name ?? existing.name).trim();
    const species = String(req.body.species ?? existing.species ?? '').trim();
    const breed = String(req.body.breed ?? existing.breed ?? '').trim();
    const sexValue = String(req.body.sex ?? existing.sex ?? 'unknown').toLowerCase();
    const birthDate = req.body.birth_date === undefined ? existing.birth_date : (String(req.body.birth_date || '').trim() || null);
    const color = String(req.body.color ?? existing.color ?? '').trim();
    const microchip = String(req.body.microchip ?? existing.microchip ?? '').trim();
    const notes = String(req.body.notes ?? existing.notes ?? '').trim();
    if (!/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(name)) return res.status(422).json({ error: 'Enter a valid pet name.' });
    if (!species) return res.status(422).json({ error: 'Select a species.' });
    if (!breed || breed.length > 80) return res.status(422).json({ error: 'Enter a valid breed.' });
    if (!['male', 'female', 'unknown'].includes(sexValue)) return res.status(422).json({ error: 'Select a valid gender.' });
    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(birthDate).slice(0, 10))) return res.status(422).json({ error: 'Enter a valid date of birth.' });
    const previousMetadata = existing.metadata || {};
    const metadata = {
      ...previousMetadata,
      age: String(req.body.age ?? previousMetadata.age ?? ''),
      allergies: String(req.body.allergies ?? previousMetadata.allergies ?? ''),
      weight: req.body.weight === undefined ? previousMetadata.weight : String(req.body.weight || ''),
      weight_target: req.body.weight_target === undefined ? previousMetadata.weight_target : String(req.body.weight_target || ''),
      archived: req.body.archived === undefined ? previousMetadata.archived : req.body.archived === true,
    };
    if (metadata.weight && (!Number.isFinite(Number(metadata.weight)) || Number(metadata.weight) <= 0)) return res.status(422).json({ error: 'Enter a valid weight.' });
    const result = await db.query(
      `UPDATE pets SET client_id = $1, name = $2, species = $3, breed = $4, sex = $5::sex_type,
         birth_date = $6, color = NULLIF($7, ''), microchip = NULLIF($8, ''), notes = NULLIF($9, ''),
         metadata = $10::jsonb, updated_at = now()
      WHERE id = $11 AND clinic_id = $12
       RETURNING id, clinic_id, client_id, name, species, breed, sex, birth_date, color, microchip, notes, metadata, updated_at`,
      [Number.isInteger(clientId) ? clientId : existing.client_id, name, species, breed, sexValue, birthDate, color, microchip, notes, JSON.stringify(metadata), petId, clinicId]
    );
    const pet = result.rows[0];
    await db.query(
      `INSERT INTO audit_trail (user_id, action, table_name, record_id, old_data, new_data, ip_address)
      VALUES ($1, $2, 'pets', $3, $4, $5, $6)`,
      [req.user && req.user.id ? req.user.id : null, isTransfer ? 'transfer' : 'update', petId, JSON.stringify(existing), JSON.stringify(pet), req.ip || req.connection.remoteAddress]
    );
    res.json(pet);
  } catch (e) {
    next(e);
  }
};

exports.archivePet = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const petId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(petId)) return res.status(400).json({ error: 'Invalid pet ID.' });
    const current = await db.query('SELECT * FROM pets WHERE id = $1 AND clinic_id = $2', [petId, clinicId]);
    if (!current.rows.length) return res.status(404).json({ error: 'Pet not found.' });
    const archived = req.body.archived === true;
    const metadata = { ...(current.rows[0].metadata || {}), archived };
    const result = await db.query(
      `UPDATE pets SET metadata = $1, updated_at = now()
       WHERE id = $2 AND clinic_id = $3
       RETURNING id, clinic_id, client_id, name, species, breed, notes, metadata, updated_at`,
      [JSON.stringify(metadata), petId, clinicId]
    );
    const pet = { ...result.rows[0], archived };
    await logAudit({
      user_id: req.user && req.user.id ? req.user.id : null,
      role: req.user && req.user.role,
      action: archived ? 'archive' : 'restore',
      table_name: 'pets',
      record_id: petId,
      old_data: current.rows[0],
      new_data: pet,
      reason: String(req.body.reason || '').trim() || 'Pet record status updated.',
      ip_address: req.ip || req.connection.remoteAddress,
    });
    res.json(pet);
  } catch (e) {
    next(e);
  }
};

const archiveClinicRecord = async (req, res, next, tableName, recordLabel) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const recordId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(recordId)) return res.status(400).json({ error: `Invalid ${recordLabel} ID.` });
    const archived = req.body.archived === true;
    const reason = String(req.body.reason || '').trim();

    const current = await db.query(
      `SELECT * FROM ${tableName} WHERE id = $1 AND clinic_id = $2`,
      [recordId, clinicId]
    );
    if (!current.rows.length) return res.status(404).json({ error: `${recordLabel} not found.` });

    const result = await db.query(
      `UPDATE ${tableName}
       SET archived = $1
       WHERE id = $2 AND clinic_id = $3
       RETURNING *`,
      [archived, recordId, clinicId]
    );
    const record = { ...result.rows[0], archived };

    await logAudit({
      user_id: req.user && req.user.id ? req.user.id : null,
      role: req.user && req.user.role,
      action: archived ? 'archive' : 'restore',
      table_name: tableName,
      record_id: recordId,
      old_data: current.rows[0],
      new_data: record,
      reason: reason || 'Record restored.',
      ip_address: req.ip || req.connection.remoteAddress,
    });

    res.json(record);
  } catch (e) {
    next(e);
  }
};

exports.archiveAppointment = (req, res, next) => archiveClinicRecord(req, res, next, 'appointments', 'appointment');
exports.archiveVaccination = (req, res, next) => archiveClinicRecord(req, res, next, 'vaccinations', 'vaccination');
exports.archiveTreatment = (req, res, next) => archiveClinicRecord(req, res, next, 'prescriptions', 'treatment');

exports.finalizeTreatment = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const treatmentId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(treatmentId)) return res.status(400).json({ error: 'Invalid treatment ID.' });
    if (!['doctor', 'clinic_owner', 'super_admin'].includes(String(req.user.role || '').toLowerCase())) {
      return res.status(403).json({ error: 'Only an authorized clinical user can finalize treatment records.' });
    }

    const currentResult = await db.query(
      `SELECT pr.*, p.name AS pet, c.name AS owner, u.name AS issued_by
       FROM prescriptions pr
       LEFT JOIN pets p ON p.id = pr.pet_id
       LEFT JOIN clients c ON c.id = p.client_id
       LEFT JOIN users u ON u.id = pr.issued_by
       WHERE pr.id=$1 AND pr.clinic_id=$2`,
      [treatmentId, clinicId]
    );
    if (!currentResult.rows.length) return res.status(404).json({ error: 'Treatment not found.' });
    const current = currentResult.rows[0];
    if (current.status === 'finalized') return res.json(current);
    if (current.archived) return res.status(409).json({ error: 'Archived treatment records cannot be finalized.' });

    const activeDuplicate = await db.query(
      `SELECT id, medication, dosage, status
       FROM prescriptions
       WHERE clinic_id=$1 AND pet_id=$2 AND id<>$3
         AND LOWER(COALESCE(medication, ''))=LOWER(COALESCE($4, ''))
         AND status IN ('active', 'finalized') AND archived=false`,
      [clinicId, current.pet_id, treatmentId, current.medication]
    );
    if (activeDuplicate.rows.length && !String(req.body.override_reason || '').trim()) {
      return res.status(409).json({
        error: 'Potential duplicate active medication detected.',
        code: 'POTENTIAL_DUPLICATE_MEDICATION',
        potential_duplicates: activeDuplicate.rows,
        requires_override_reason: true,
      });
    }
    const overrideReason = String(req.body.override_reason || '').trim();
    if (activeDuplicate.rows.length && overrideReason.length < 15) {
      return res.status(422).json({ error: 'A clinical reason of at least 15 characters is required for this medication override.' });
    }

    const result = await db.query(
      `UPDATE prescriptions SET status='finalized', metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
       WHERE id=$2 AND clinic_id=$3
       RETURNING *`,
      [JSON.stringify({ finalized_by: req.user.id, finalized_at: new Date().toISOString(), override_reason: overrideReason || null }), treatmentId, clinicId]
    );
    const saved = { ...result.rows[0], pet: current.pet, owner: current.owner, issued_by: current.issued_by };
    await logAudit({
      user_id: req.user.id,
      role: req.user.role,
      action: 'finalize',
      table_name: 'prescriptions',
      record_id: treatmentId,
      old_data: current,
      new_data: saved,
      reason: overrideReason || 'Treatment record finalized.',
      ip_address: req.ip || req.connection.remoteAddress,
    });
    return res.json(saved);
  } catch (e) {
    return next(e);
  }
};

exports.createAppointment = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const petId = Number.parseInt(req.body.pet_id, 10);
    const clientId = Number.parseInt(req.body.client_id, 10);
    const reason = String(req.body.reason || req.body.type || '').trim();
    const notes = req.body.notes && typeof req.body.notes === 'object' && !Array.isArray(req.body.notes)
      ? req.body.notes
      : String(req.body.notes || '').trim();
    const reasonForVisit = String(req.body.reason_for_visit || notes.reason_for_visit || '').trim();
    const workflowType = String(req.body.workflow_type || '').trim() || null;
    const workflowReason = String(req.body.workflow_reason || reasonForVisit || '').trim() || null;
    const parentAppointmentId = req.body.parent_appointment_id == null || req.body.parent_appointment_id === ''
      ? null : Number.parseInt(req.body.parent_appointment_id, 10);
    const relatedTreatmentPlanValue = notes && typeof notes === 'object' && !Array.isArray(notes)
      ? notes.related_treatment_plan_id : null;
    const relatedTreatmentPlanId = relatedTreatmentPlanValue == null || relatedTreatmentPlanValue === ''
      ? null : Number.parseInt(relatedTreatmentPlanValue, 10);
    const startDate = new Date(req.body.start_time);
    const requestedDuration = req.body.duration_minutes == null || req.body.duration_minutes === ''
      ? 30
      : Number.parseInt(req.body.duration_minutes, 10);
    if (!Number.isInteger(requestedDuration) || requestedDuration < 5 || requestedDuration > 1440) {
      return res.status(422).json({ error: 'Appointment duration must be between 5 minutes and 24 hours.' });
    }
    let practitionerId = req.user?.id || null;
    if (Object.prototype.hasOwnProperty.call(req.body, 'practitioner_id')) {
      if (req.body.practitioner_id === '' || req.body.practitioner_id == null) practitionerId = null;
      else {
        practitionerId = Number.parseInt(req.body.practitioner_id, 10);
        if (!Number.isInteger(practitionerId) || practitionerId < 1) {
          return res.status(422).json({ error: 'Select a valid veterinarian.' });
        }
        const veterinarian = await db.query(
          `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
           WHERE u.id = $1 AND u.clinic_id = $2 AND u.is_active = true
             AND lower(replace(replace(r.name, ' ', '_'), '-', '_')) IN ('doctor', 'veterinarian', 'assistant_doctor')`,
          [practitionerId, clinicId]
        );
        if (!veterinarian.rows.length) return res.status(422).json({ error: 'The selected veterinarian is not active clinical staff at this clinic.' });
      }
    }
    if (!Number.isInteger(petId) || !Number.isInteger(clientId)) {
      return res.status(422).json({ error: 'Select a registered pet and owner.' });
    }
    if (!reason) return res.status(422).json({ error: 'Choose an appointment type.' });
    if (req.body.parent_appointment_id != null && req.body.parent_appointment_id !== ''
      && (!Number.isInteger(parentAppointmentId) || parentAppointmentId < 1)) {
      return res.status(422).json({ error: 'Choose a valid original appointment for this follow-up.' });
    }
    if (relatedTreatmentPlanValue != null && relatedTreatmentPlanValue !== ''
      && (!Number.isInteger(relatedTreatmentPlanId) || relatedTreatmentPlanId < 1)) {
      return res.status(422).json({ error: 'Choose a valid related treatment plan.' });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'reason_for_visit') && !reasonForVisit) {
      return res.status(422).json({ error: 'Enter a reason for the visit.' });
    }
    const dateInClinicTimezone = date => new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date);
    if (!req.body.start_time || Number.isNaN(startDate.getTime())
      || dateInClinicTimezone(startDate) < dateInClinicTimezone(new Date())) {
      return res.status(422).json({ error: 'Choose today or a future appointment date.' });
    }

    const petResult = await db.query(
      `SELECT p.id, p.client_id FROM pets p
       WHERE p.id = $1 AND p.clinic_id = $2 AND COALESCE((p.metadata->>'archived')::boolean, false) = false`,
      [petId, clinicId]
    );
    if (!petResult.rows.length) return res.status(422).json({ error: 'Selected pet is not active at this clinic.' });
    if (Number(petResult.rows[0].client_id) !== clientId) {
      return res.status(422).json({ error: 'Selected owner does not match the pet’s registered owner.' });
    }
    if (parentAppointmentId) {
      const parent = await db.query(
        `SELECT id FROM appointments WHERE id=$1 AND clinic_id=$2 AND pet_id=$3 AND COALESCE(archived,false)=false`,
        [parentAppointmentId, clinicId, petId]
      );
      if (!parent.rows.length) return res.status(422).json({ error: 'The original appointment must belong to the selected patient and clinic.' });
    }
    if (relatedTreatmentPlanId) {
      const relatedPlan = await db.query(
        `SELECT id FROM treatment_plans WHERE id=$1 AND clinic_id=$2 AND pet_id=$3`,
        [relatedTreatmentPlanId, clinicId, petId]
      );
      if (!relatedPlan.rows.length) return res.status(422).json({ error: 'The related treatment plan must belong to the selected patient and clinic.' });
    }

    const endDate = new Date(startDate.getTime() + requestedDuration * 60 * 1000);
    const inserted = await db.query(
      `INSERT INTO appointments
         (clinic_id, pet_id, client_id, practitioner_id, status, start_time, end_time, reason, notes,
          workflow_type, workflow_reason, parent_appointment_id)
       VALUES ($1, $2, $3, $4, 'scheduled', $5, $6, $7, $8::jsonb, $9, $10, $11)
       RETURNING id`,
      [clinicId, petId, clientId, practitionerId, startDate.toISOString(), endDate.toISOString(), reason,
        JSON.stringify(notes), workflowType, workflowReason, parentAppointmentId]
    );
    const result = await db.query(
      `SELECT a.id, a.pet_id, a.client_id, a.practitioner_id, a.status, a.start_time, a.end_time,
              a.reason, a.notes, a.parent_appointment_id, a.workflow_type, a.workflow_reason,
              a.archived, a.created_at, a.updated_at,
              p.name AS pet, c.name AS owner, u.name AS practitioner
       FROM appointments a
       LEFT JOIN pets p ON p.id = a.pet_id
       LEFT JOIN clients c ON c.id = a.client_id
       LEFT JOIN users u ON u.id = a.practitioner_id
       WHERE a.id = $1 AND a.clinic_id = $2`,
      [inserted.rows[0].id, clinicId]
    );
    const appointment = {
      ...result.rows[0],
      notes: result.rows[0].notes || '',
      type: reason,
      archived: false,
    };
    await logAudit({
      user_id: req.user?.id || null,
      role: req.user?.role,
      action: 'create',
      table_name: 'appointments',
      record_id: appointment.id,
      new_data: appointment,
      reason: 'Appointment scheduled.',
      ip_address: req.ip || req.connection.remoteAddress,
    });
    return res.status(201).json(appointment);
  } catch (e) {
    next(e);
  }
};

exports.updateScheduledVaccinationAppointment = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const appointmentId = Number.parseInt(req.params.id, 10);
    const vaccineName = String(req.body?.vaccine_name || '').trim();
    const manufacturer = String(req.body?.manufacturer || '').trim();
    const lotNumber = String(req.body?.batch_number || '').trim();
    const expiryDate = req.body?.expiry_date || '';
    const dose = String(req.body?.dose || '').trim();
    const nextDue = req.body?.next_due || '';
    if (!Number.isInteger(appointmentId) || appointmentId < 1 || !vaccineName) {
      return res.status(422).json({ error: 'A valid appointment and vaccine name are required.' });
    }
    if (!isValidClinicalDate(expiryDate) || !isValidClinicalDate(nextDue)) {
      return res.status(422).json({ error: 'Expiry and next due dates must be valid dates.' });
    }
    const currentResult = await db.query(
      `SELECT id, pet_id, reason, notes, status, archived FROM appointments
       WHERE id=$1 AND clinic_id=$2`,
      [appointmentId, clinicId]
    );
    const current = currentResult.rows[0];
    if (!current || current.archived) return res.status(404).json({ error: 'Scheduled vaccination appointment not found.' });
    const appointmentNotes = current.notes && typeof current.notes === 'object' ? current.notes : {};
    if (String(appointmentNotes.service_category || '').toLowerCase() !== 'vaccination') {
      return res.status(409).json({ error: 'This appointment is not a scheduled vaccination.' });
    }
    if (['completed', 'complete', 'cancelled', 'canceled'].includes(String(current.status || '').toLowerCase())) {
      return res.status(409).json({ error: 'Only scheduled vaccinations can be edited here.' });
    }
    const nextNotes = {
      ...appointmentNotes,
      vaccination_type: vaccineName,
      service_name: vaccineName,
      vaccination_details: {
        ...(appointmentNotes.vaccination_details || {}),
        manufacturer: manufacturer || '',
        lot_number: lotNumber || '',
        expiry_date: expiryDate || '',
        dose: dose || '',
        next_due: nextDue || '',
      },
    };
    const reason = `Vaccination — ${vaccineName}`;
    const updated = await db.query(
      `UPDATE appointments SET reason=$1, notes=$2::jsonb, updated_at=now()
       WHERE id=$3 AND clinic_id=$4
       RETURNING id, pet_id, reason, notes, start_time, status`,
      [reason, JSON.stringify(nextNotes), appointmentId, clinicId]
    );
    await logAudit({
      user_id: req.user?.id || null,
      role: req.user?.role || null,
      action: 'update',
      table_name: 'appointments',
      record_id: appointmentId,
      old_data: current,
      new_data: updated.rows[0],
      reason: 'Scheduled vaccination details updated.',
      ip_address: req.ip || req.connection.remoteAddress,
    });
    return res.json(updated.rows[0]);
  } catch (e) {
    return next(e);
  }
};

exports.listAppointments = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;

    const result = await db.query(
      `SELECT a.id,
              a.pet_id,
              CASE
                WHEN LOWER(COALESCE(q.status, '')) = 'waiting' THEN 'checked_in'
                WHEN LOWER(COALESCE(q.status, '')) IN ('in-consultation', 'in_consultation') THEN 'in_consultation'
                WHEN LOWER(COALESCE(a.status::text, '')) = 'scheduled' AND a.start_time < now() THEN 'due'
                ELSE a.status::text
              END AS status,
              a.start_time,
              a.end_time,
              a.reason,
              a.notes,
              a.parent_appointment_id,
              a.workflow_type,
              a.workflow_reason,
              a.original_start_time,
              COALESCE(a.archived, false) AS archived,
              p.name AS pet,
              COALESCE(p.metadata->>'allergies', 'Not recorded') AS known_allergies,
              c.name AS owner,
              u.name AS practitioner,
              related.id AS related_appointment_id,
              related.start_time AS related_start_time,
              related.end_time AS related_end_time,
              related.status AS related_status,
              a.created_at,
              a.updated_at
       FROM appointments a
       LEFT JOIN pets p ON a.pet_id = p.id
       LEFT JOIN clients c ON a.client_id = c.id
       LEFT JOIN users u ON a.practitioner_id = u.id
       LEFT JOIN patient_queue q ON q.appointment_id = a.id
       LEFT JOIN LATERAL (
         SELECT child.id, child.start_time, child.end_time, child.status
         FROM appointments child
         WHERE child.parent_appointment_id = a.id AND child.clinic_id = a.clinic_id
         ORDER BY child.created_at DESC, child.id DESC
         LIMIT 1
       ) related ON true
       WHERE a.clinic_id = $1
       ORDER BY a.start_time DESC`,
      [clinicId]
    );

    res.json(result.rows.map((row) => ({
      ...row,
      notes: row.notes ? (typeof row.notes === 'string' ? row.notes : JSON.stringify(row.notes)) : '',
    })));
  } catch (e) {
    next(e);
  }
};

exports.listVisits = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const result = await db.query(
      `SELECT a.id AS appointment_id, a.pet_id, a.start_time AS visit_date, a.reason,
              a.status AS appointment_status, a.archived,
              p.name AS pet, p.species, c.name AS owner,
              COALESCE(co.doctor_id, a.practitioner_id) AS veterinarian_id,
              COALESCE(doctor.name, assigned.name) AS veterinarian,
              co.id AS consultation_id, co.status AS consultation_status,
              co.notes AS consultation_notes, co.started_at, co.completed_at
       FROM appointments a
       JOIN pets p ON p.id=a.pet_id AND p.clinic_id=a.clinic_id
       LEFT JOIN clients c ON c.id=p.client_id
       LEFT JOIN consultations co ON co.appointment_id=a.id AND co.clinic_id=a.clinic_id
       LEFT JOIN users doctor ON doctor.id=co.doctor_id
       LEFT JOIN users assigned ON assigned.id=a.practitioner_id
       WHERE a.clinic_id=$1 AND (
         co.id IS NOT NULL OR LOWER(COALESCE(a.reason,'')) LIKE '%check%up%'
         OR LOWER(COALESCE(a.status::text,''))='completed'
       )
       ORDER BY a.start_time DESC, a.id DESC`,
      [clinicId]
    );
    return res.json(result.rows);
  } catch (error) { return next(error); }
};

exports.listDashboardAlerts = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const result = await db.query(
      `SELECT * FROM (
         SELECT 'treatment-' || tp.id AS id, tp.pet_id, p.name AS pet, p.species,
                'Treatment follow-up' AS tag,
                COALESCE(tp.title, tp.diagnosis, 'Active treatment plan') AS detail,
                tp.updated_at AS created_at, 'high' AS severity, 'treatment' AS source
         FROM treatment_plans tp JOIN pets p ON p.id=tp.pet_id AND p.clinic_id=tp.clinic_id
         WHERE tp.clinic_id=$1 AND COALESCE(tp.archived,false)=false
           AND LOWER(COALESCE(tp.status,'')) NOT IN ('completed','cancelled','archived')
           AND tp.follow_up IS NOT NULL AND tp.follow_up <= CURRENT_DATE + INTERVAL '7 days'
         UNION ALL
         SELECT 'lab-' || lr.id AS id, lr.pet_id, p.name AS pet, p.species,
                'Lab Result Pending' AS tag,
                COALESCE(lr.test_name, 'Laboratory result') || ' awaiting review' AS detail,
                COALESCE(lr.collected_at, now()) AS created_at,
                CASE WHEN COALESCE((lr.metadata->>'urgent')::boolean,false) THEN 'high' ELSE 'medium' END AS severity,
                'laboratory' AS source
         FROM lab_results lr JOIN pets p ON p.id=lr.pet_id AND p.clinic_id=lr.clinic_id
         WHERE lr.clinic_id=$1 AND COALESCE((lr.metadata->>'archived')::boolean,false)=false
           AND LOWER(COALESCE(lr.metadata->>'status','ordered')) IN ('ordered','in-progress','pending','pending-review')
         UNION ALL
         SELECT 'appointment-' || a.id AS id, a.pet_id, p.name AS pet, p.species,
                'Appointment Due' AS tag, COALESCE(a.reason, 'Scheduled appointment needs attention') AS detail,
                a.start_time AS created_at, 'medium' AS severity, 'appointment' AS source
         FROM appointments a JOIN pets p ON p.id=a.pet_id AND p.clinic_id=a.clinic_id
         WHERE a.clinic_id=$1 AND COALESCE(a.archived,false)=false AND a.start_time < now()
           AND LOWER(COALESCE(a.status::text,'')) IN ('scheduled','pending')
       ) alerts ORDER BY created_at DESC LIMIT 20`,
      [clinicId]
    );
    return res.json(result.rows);
  } catch (error) { return next(error); }
};

exports.createRelatedAppointment = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const parentId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(parentId) || parentId < 1) return res.status(400).json({ error: 'Invalid appointment ID.' });

    const { action, start_time: startTime, reason, visit_type: visitType } = req.body || {};
    if (!['follow_up', 'reschedule', 'rebook'].includes(action)) {
      return res.status(400).json({ error: 'Choose a valid follow-up, reschedule, or rebook action.' });
    }
    const startDate = new Date(startTime);
    if (!startTime || Number.isNaN(startDate.getTime()) || startDate.getTime() <= Date.now()) {
      return res.status(422).json({ error: 'Choose a future date and time for the new appointment.' });
    }
    if (action !== 'reschedule' && (typeof reason !== 'string' || !reason.trim())) {
      return res.status(422).json({ error: 'Enter a reason for the appointment.' });
    }
    if (typeof visitType !== 'string' || !visitType.trim()) {
      return res.status(422).json({ error: 'Choose an appointment type.' });
    }

    await client.query('BEGIN');
    const parentResult = await client.query(
      `SELECT id, clinic_id, pet_id, client_id, practitioner_id, status, start_time, end_time, reason, notes
       FROM appointments WHERE id=$1 AND clinic_id=$2 FOR UPDATE`,
      [parentId, clinicId]
    );
    const parent = parentResult.rows[0];
    if (!parent) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Appointment not found in this clinic.' });
    }
    const parentStatus = String(parent.status || '').toLowerCase();
    const workflowReason = typeof reason === 'string' && reason.trim()
      ? reason.trim()
      : 'Rescheduled by clinic staff.';
    if (action === 'follow_up' && parentStatus !== 'completed') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Follow-up appointments can only be scheduled from a completed appointment.' });
    }
    if (action === 'reschedule' && !['scheduled', 'confirmed', 'pending', 'checked_in', 'no_show', 'rescheduled'].includes(parentStatus)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This appointment cannot be rescheduled from its current status.' });
    }
    if (action === 'rebook' && parentStatus !== 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Only a cancelled appointment can be rebooked.' });
    }

    const durationMs = parent.end_time && parent.start_time
      ? new Date(parent.end_time).getTime() - new Date(parent.start_time).getTime()
      : 30 * 60 * 1000;
    const endTime = new Date(startDate.getTime() + (durationMs > 0 ? durationMs : 30 * 60 * 1000));
    const savedResult = await client.query(
      `INSERT INTO appointments
         (clinic_id, pet_id, client_id, practitioner_id, status, start_time, end_time, reason, notes,
          parent_appointment_id, workflow_type, workflow_reason, original_start_time)
       VALUES ($1,$2,$3,$4,'scheduled',$5,$6,$7,$8::jsonb,$9,$10,$11,$12)
       RETURNING id, clinic_id, pet_id, client_id, practitioner_id, status, start_time, end_time, reason, notes,
                 parent_appointment_id, workflow_type, workflow_reason, original_start_time, created_at`,
      [
        clinicId, parent.pet_id, parent.client_id, parent.practitioner_id || req.user.id,
        startDate.toISOString(), endTime.toISOString(), visitType.trim(),
        JSON.stringify({}),
        parent.id, action, workflowReason, parent.start_time,
      ]
    );

    let updatedParent = parent;
    if (action === 'reschedule') {
      const parentUpdate = await client.query(
        `UPDATE appointments
         SET status='rescheduled', workflow_type='rescheduled', workflow_reason=$1, updated_at=now()
         WHERE id=$2 AND clinic_id=$3
         RETURNING id, status, start_time, end_time, reason, notes`,
        [workflowReason, parent.id, clinicId]
      );
      updatedParent = parentUpdate.rows[0];
    }

    await client.query('COMMIT');
    const saved = savedResult.rows[0];
    const appointmentResult = await db.query(
      `SELECT a.id, a.status, a.start_time, a.end_time, a.reason, a.notes,
              a.parent_appointment_id, a.workflow_type, a.workflow_reason, a.original_start_time,
              p.name AS pet, c.name AS owner, u.name AS practitioner
       FROM appointments a
       LEFT JOIN pets p ON p.id=a.pet_id
       LEFT JOIN clients c ON c.id=a.client_id
       LEFT JOIN users u ON u.id=a.practitioner_id
       WHERE a.id=$1 AND a.clinic_id=$2`,
      [saved.id, clinicId]
    );
    const appointment = appointmentResult.rows[0];
    await logAudit({
      user_id: req.user.id,
      role: req.user.role,
      action: action === 'reschedule' ? 'reschedule' : action === 'rebook' ? 'rebook' : 'schedule_follow_up',
      table_name: 'appointments',
      record_id: saved.id,
      old_data: { parent_appointment_id: parent.id, parent_status: parent.status, parent_start_time: parent.start_time },
      new_data: appointment,
      reason: workflowReason,
      ip_address: req.ip || req.connection.remoteAddress,
    });
    return res.status(201).json({ appointment, parent: updatedParent });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally {
    client.release();
  }
};

const consultationQuery = `
  SELECT co.id, co.clinic_id, co.appointment_id, co.pet_id, co.doctor_id,
         co.status, co.notes, co.owner_visible, co.started_at, co.completed_at,
         co.completed_by, co.created_at, co.updated_at,
         p.name AS pet, c.name AS owner, u.name AS doctor
  FROM consultations co
  LEFT JOIN pets p ON p.id = co.pet_id
  LEFT JOIN clients c ON c.id = p.client_id
  LEFT JOIN users u ON u.id = co.doctor_id
`;

async function getAppointmentForClinic(appointmentId, clinicId) {
  const result = await db.query(
    `SELECT a.id, a.clinic_id, a.pet_id, a.practitioner_id, a.status,
            q.status AS queue_status
     FROM appointments a
     LEFT JOIN patient_queue q ON q.appointment_id = a.id
     WHERE a.id = $1 AND a.clinic_id = $2`,
    [appointmentId, clinicId]
  );
  return result.rows[0] || null;
}

exports.startConsultation = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const appointmentId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(appointmentId)) return res.status(400).json({ error: 'Invalid appointment ID.' });
    const appointment = await getAppointmentForClinic(appointmentId, clinicId);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });
    if (appointment.status === 'completed' || appointment.status === 'cancelled') {
      return res.status(409).json({ error: 'This appointment cannot start a consultation from its current status.' });
    }
    if (appointment.practitioner_id && req.user.role === 'doctor' && appointment.practitioner_id !== req.user.id) {
      return res.status(403).json({ error: 'This appointment is assigned to another doctor.' });
    }

    await client.query('BEGIN');
    const consultation = await client.query(
      `INSERT INTO consultations (clinic_id, appointment_id, pet_id, doctor_id, status)
       VALUES ($1,$2,$3,$4,'in_progress')
       ON CONFLICT (appointment_id) DO UPDATE
       SET status='in_progress', doctor_id=EXCLUDED.doctor_id, updated_at=now()
       RETURNING id`,
      [clinicId, appointmentId, appointment.pet_id, req.user.id]
    );
    await client.query(
      `UPDATE appointments SET status='in_consultation', practitioner_id=COALESCE(practitioner_id,$1), updated_at=now()
       WHERE id=$2 AND clinic_id=$3`,
      [req.user.id, appointmentId, clinicId]
    );
    await client.query(
      `UPDATE patient_queue SET status='in_consultation', updated_at=now()
       WHERE appointment_id=$1 AND clinic_id=$2`,
      [appointmentId, clinicId]
    );
    await client.query('COMMIT');
    const saved = await db.query(`${consultationQuery} WHERE co.id = $1 AND co.clinic_id = $2`, [consultation.rows[0].id, clinicId]);
    await logAudit({
      user_id: req.user.id, role: req.user.role, action: 'start_consultation',
      table_name: 'consultations', record_id: consultation.rows[0].id,
      old_data: { appointment_status: appointment.status, queue_status: appointment.queue_status },
      new_data: saved.rows[0], reason: 'Consultation started.', ip_address: req.ip || req.connection.remoteAddress,
    });
    return res.status(201).json(saved.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    return next(e);
  } finally {
    client.release();
  }
};

exports.getConsultation = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const appointmentId = Number.parseInt(req.params.id, 10);
    const result = await db.query(`${consultationQuery} WHERE co.appointment_id = $1 AND co.clinic_id = $2`, [appointmentId, clinicId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Consultation not found.' });
    return res.json(result.rows[0]);
  } catch (e) {
    return next(e);
  }
};

exports.saveConsultation = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const appointmentId = Number.parseInt(req.params.id, 10);
    const appointment = await getAppointmentForClinic(appointmentId, clinicId);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });
    const notes = req.body && typeof req.body.notes === 'object' && req.body.notes !== null ? req.body.notes : {};
    const ownerVisible = req.body.owner_visible === true;
    const current = await db.query(`${consultationQuery} WHERE co.appointment_id = $1 AND co.clinic_id = $2`, [appointmentId, clinicId]);
    if (!current.rows.length) return res.status(409).json({ error: 'Start the consultation before saving notes.' });
    const result = await db.query(
      `UPDATE consultations SET notes=$1, owner_visible=$2, updated_at=now()
       WHERE appointment_id=$3 AND clinic_id=$4 RETURNING id`,
      [JSON.stringify(notes), ownerVisible, appointmentId, clinicId]
    );
    const saved = await db.query(`${consultationQuery} WHERE co.id = $1 AND co.clinic_id = $2`, [result.rows[0].id, clinicId]);
    await logAudit({
      user_id: req.user.id, role: req.user.role, action: 'update',
      table_name: 'consultations', record_id: result.rows[0].id,
      old_data: current.rows[0], new_data: saved.rows[0], reason: 'Consultation notes saved.',
      ip_address: req.ip || req.connection.remoteAddress,
    });
    return res.json(saved.rows[0]);
  } catch (e) {
    return next(e);
  }
};

exports.completeConsultation = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const appointmentId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(appointmentId) || appointmentId < 1) return res.status(400).json({ error: 'Invalid appointment ID.' });
    await client.query('BEGIN');
    const appointmentResult = await client.query(
      `SELECT id, clinic_id, pet_id, client_id, status, notes AS appointment_notes
       FROM appointments WHERE id=$1 AND clinic_id=$2 FOR UPDATE`,
      [appointmentId, clinicId]
    );
    const current = appointmentResult.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Appointment not found.' });
    }
    const consultationResult = await client.query(
      `SELECT id, status, notes FROM consultations
       WHERE appointment_id=$1 AND clinic_id=$2 FOR UPDATE`,
      [appointmentId, clinicId]
    );
    if (!consultationResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Start the consultation before completing it.' });
    }
    const consultation = consultationResult.rows[0];
    const existingLinkedInvoice = await client.query(
      'SELECT id, total, status FROM invoices WHERE consultation_id=$1 LIMIT 1 FOR UPDATE',
      [consultation.id]
    );
    if (consultation.status === 'completed') {
      await client.query('COMMIT');
      const saved = await db.query(`${consultationQuery} WHERE co.id=$1 AND co.clinic_id=$2`, [consultation.id, clinicId]);
      return res.json({ consultation: saved.rows[0], invoice: existingLinkedInvoice.rows[0] || null });
    }
    const notes = consultation.notes && typeof consultation.notes === 'object' ? consultation.notes : {};
    const appointmentNotes = current.appointment_notes && typeof current.appointment_notes === 'object'
      ? current.appointment_notes
      : {};
    const requestedItems = Array.isArray(notes.billingItems) ? notes.billingItems : [];
    const lineItems = requestedItems.map((item, index) => ({
      catalogId: Number(item?.catalog_item_id),
      quantity: Number(item?.quantity),
      clinicalDetails: String(item?.clinical_details || '').trim().slice(0, 2000),
      index,
    }));
    if (lineItems.some(item => !Number.isInteger(item.catalogId) || item.catalogId < 1
      || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 10000)) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: 'Each invoice item needs an active clinic catalog item and a positive quantity.' });
    }
    let issuedInvoice = null;
    if (lineItems.length) {
      if (!current.client_id || !current.pet_id) {
        await client.query('ROLLBACK');
        return res.status(422).json({ error: 'This appointment must be linked to an owner and patient before billing.' });
      }
      const catalogIds = [...new Set(lineItems.map(item => item.catalogId))];
      const catalogResult = await client.query(
        `SELECT id, item_type, name, unit, unit_price
         FROM clinic_billing_catalog
         WHERE clinic_id=$1 AND active=true AND id=ANY($2::integer[])`,
        [clinicId, catalogIds]
      );
      const catalogById = new Map(catalogResult.rows.map(item => [Number(item.id), item]));
      if (lineItems.some(item => !catalogById.has(item.catalogId))) {
        await client.query('ROLLBACK');
        return res.status(422).json({ error: 'One or more selected items are no longer active in this clinic price catalog.' });
      }
      if (lineItems.some(item => catalogById.get(item.catalogId).item_type === 'inpatient' && item.quantity !== 1)) {
        await client.query('ROLLBACK');
        return res.status(422).json({ error: 'Inpatient items are billed once per day; use a quantity of 1 for the admission day.' });
      }
      const inpatientCatalogIds = lineItems
        .filter(item => catalogById.get(item.catalogId).item_type === 'inpatient')
        .map(item => item.catalogId);
      if (new Set(inpatientCatalogIds).size !== inpatientCatalogIds.length) {
        await client.query('ROLLBACK');
        return res.status(422).json({ error: 'Add an inpatient catalog item only once per consultation; its daily charge continues until discharge.' });
      }
      const existingInvoice = await client.query(
        `SELECT id, status, tax
         FROM invoices
         WHERE appointment_id=$1 AND status IN ('draft', 'issued')
         ORDER BY created_at DESC
         LIMIT 1 FOR UPDATE`,
        [appointmentId]
      );
      let invoiceId = existingInvoice.rows[0]?.id;
      if (!invoiceId) {
        const insertedInvoice = await client.query(
          `INSERT INTO invoices
            (clinic_id, client_id, appointment_id, consultation_id, status, currency, subtotal, tax, total, issued_at)
           VALUES ($1,$2,$3,$4,'issued','PHP',0,0,0,now())
           RETURNING id, total`,
          [clinicId, current.client_id, appointmentId,
            existingLinkedInvoice.rows.length ? null : consultation.id]
        );
        invoiceId = insertedInvoice.rows[0].id;
      } else {
        await client.query(
          `UPDATE invoices SET consultation_id=$1, status='issued', issued_at=COALESCE(issued_at, now()), updated_at=now()
           WHERE id=$2`,
          [consultation.id, invoiceId]
        );
      }
      const inpatientItems = [];
      for (const item of lineItems) {
        const catalogItem = catalogById.get(item.catalogId);
        const unitPrice = Number(catalogItem.unit_price);
        const lineTotalCents = Math.round(unitPrice * item.quantity * 100);
        const description = item.clinicalDetails
          ? `${catalogItem.name} — ${item.clinicalDetails}`
          : catalogItem.name;
        const invoiceItem = await client.query(
          `INSERT INTO invoice_items
            (invoice_id, description, unit_price, quantity, catalog_item_id, item_type)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING id`,
          [invoiceId, description, unitPrice, item.quantity, catalogItem.id, catalogItem.item_type]
        );
        if (catalogItem.item_type === 'treatment') {
          await client.query(
            `INSERT INTO treatment_records
              (clinic_id, pet_id, diagnosis, procedure, outcome, notes, status, performed_at, performed_by, cost)
             VALUES ($1,$2,$3,$4,$5,$6,'completed',now(),$7,$8)`,
            [clinicId, current.pet_id, String(notes.diagnosis || notes.chiefComplaint || 'Consultation').trim(),
              catalogItem.name, String(notes.outcome || '').trim() || null,
              item.clinicalDetails || String(notes.treatment || '').trim() || null, req.user.id || null,
              (lineTotalCents / 100).toFixed(2)]
          );
        } else if (catalogItem.item_type === 'medication') {
          await client.query(
            `INSERT INTO prescriptions
              (pet_id, clinic_id, medication, dosage, quantity, instructions, issued_by, issued_at, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,now(),'active')`,
            [current.pet_id, clinicId, catalogItem.name,
              item.clinicalDetails || String(notes.medications || 'See consultation notes').trim(),
              Number.isInteger(item.quantity) ? item.quantity : null,
              String(notes.followUpInstructions || '').trim() || null, req.user.id || null]
          );
        } else if (catalogItem.item_type === 'vaccination') {
          const vaccinationDetails = appointmentNotes.vaccination_details && typeof appointmentNotes.vaccination_details === 'object'
            ? appointmentNotes.vaccination_details
            : {};
          const linkedScheduled = await client.query(
            `UPDATE vaccinations
             SET status='administered', date_given=CURRENT_DATE, administered_by=$1
             WHERE clinic_id=$2 AND appointment_id=$3 AND status='scheduled'
             RETURNING id`,
            [req.user.id || null, clinicId, appointmentId]
          );
          const duplicate = await client.query(
            `SELECT id FROM vaccinations
             WHERE clinic_id=$1 AND pet_id=$2 AND LOWER(vaccine_name)=LOWER($3)
               AND date_given=CURRENT_DATE AND archived=false LIMIT 1`,
            [clinicId, current.pet_id, catalogItem.name]
          );
          if (!linkedScheduled.rows.length && !duplicate.rows.length) {
            await client.query(
              `INSERT INTO vaccinations
                (pet_id, clinic_id, vaccine_name, date_given, next_due, batch_number, manufacturer,
                 expiry_date, dose, administered_by, notes, status)
               VALUES ($1,$2,$3,CURRENT_DATE,$4,$5,$6,$7,$8,$9,$10,'administered')`,
              [current.pet_id, clinicId, catalogItem.name, vaccinationDetails.next_due || notes.followUpDate || null,
                vaccinationDetails.lot_number || null, vaccinationDetails.manufacturer || null,
                vaccinationDetails.expiry_date || null, vaccinationDetails.dose || null,
                req.user.id || null, item.clinicalDetails || String(notes.vaccinations || '').trim() || null]
            );
          }
        } else if (catalogItem.item_type === 'lab_test') {
          await client.query(
            `INSERT INTO lab_results (pet_id, clinic_id, test_name, results, metadata)
             VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)`,
            [current.pet_id, clinicId, catalogItem.name,
              JSON.stringify({ summary: 'Awaiting laboratory result', measurements: [] }),
              JSON.stringify({ status: 'ordered', requestedBy: req.user.name || 'Clinic veterinarian',
                orderDateTime: new Date().toISOString(), indication: item.clinicalDetails })]
          );
        } else if (catalogItem.item_type === 'inpatient') {
          inpatientItems.push({ catalogItem, invoiceItemId: invoiceItem.rows[0].id });
        }
      }
      const invoiceTotals = await client.query(
        `UPDATE invoices i
         SET subtotal=totals.subtotal, total=totals.subtotal + i.tax, updated_at=now()
         FROM (
           SELECT COALESCE(SUM(line_total), 0) AS subtotal
           FROM invoice_items WHERE invoice_id=$1
         ) totals
         WHERE i.id=$1
         RETURNING id, status, currency, subtotal, tax, total, issued_at`,
        [invoiceId]
      );
      issuedInvoice = invoiceTotals.rows[0];
      for (const inpatient of inpatientItems) {
        await client.query(
          `INSERT INTO clinic_inpatient_stays
            (clinic_id, pet_id, appointment_id, consultation_id, catalog_item_id, invoice_id, daily_price)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (consultation_id, catalog_item_id) DO NOTHING`,
          [clinicId, current.pet_id, appointmentId, consultation.id, inpatient.catalogItem.id,
            invoiceId, inpatient.catalogItem.unit_price]
        );
      }
    } else if (existingLinkedInvoice.rows.length) {
      issuedInvoice = existingLinkedInvoice.rows[0];
    }
    await client.query(
      `UPDATE consultations SET status='completed', completed_at=now(), completed_by=$1, updated_at=now()
       WHERE appointment_id=$2 AND clinic_id=$3`,
      [req.user.id, appointmentId, clinicId]
    );
    await client.query(`UPDATE appointments SET status='completed', updated_at=now() WHERE id=$1 AND clinic_id=$2`, [appointmentId, clinicId]);
    await client.query(
      `UPDATE patient_queue SET status='completed', updated_at=now()
       WHERE appointment_id=$1 AND clinic_id=$2`,
      [appointmentId, clinicId]
    );
    await client.query('COMMIT');
    const saved = await db.query(`${consultationQuery} WHERE co.id = $1 AND co.clinic_id = $2`, [consultation.id, clinicId]);
    await logAudit({
      user_id: req.user.id, role: req.user.role, action: 'complete_consultation',
      table_name: 'consultations', record_id: consultation.id,
      old_data: { appointment: current, consultation },
      new_data: { appointment_status: 'completed', consultation: saved.rows[0], invoice: issuedInvoice },
      reason: String(req.body.reason || '').trim() || 'Consultation completed.',
      ip_address: req.ip || req.connection.remoteAddress,
    });
    return res.json({ consultation: saved.rows[0], invoice: issuedInvoice });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    return next(e);
  } finally {
    client.release();
  }
};

exports.transferAppointment = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const appointmentId = Number.parseInt(req.params.id, 10);
    const toDoctorId = Number.parseInt(req.body.to_doctor_id || req.body.toDoctorId, 10);
    const reason = String(req.body.reason || '').trim();
    const notes = String(req.body.notes || '').trim() || null;
    const urgency = String(req.body.urgency || 'Routine — no rush').trim();
    if (!Number.isInteger(appointmentId) || !Number.isInteger(toDoctorId)) {
      return res.status(422).json({ error: 'A valid appointment and receiving doctor are required.' });
    }
    if (reason.length < 15) return res.status(422).json({ error: 'Enter a clinical handoff reason of at least 15 characters.' });
    const appointment = await getAppointmentForClinic(appointmentId, clinicId);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });
    if (['completed', 'cancelled'].includes(String(appointment.status))) {
      return res.status(409).json({ error: 'Completed or cancelled appointments cannot be transferred.' });
    }
    const doctor = await db.query(
      `SELECT u.id, u.name FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id=$1 AND u.clinic_id=$2
         AND LOWER(COALESCE(r.name, '')) IN ('doctor', 'veterinarian', 'assistant_doctor')`,
      [toDoctorId, clinicId]
    );
    if (!doctor.rows.length) return res.status(422).json({ error: 'The receiving doctor is not available at this clinic.' });
    if (Number.isInteger(req.user.id) && toDoctorId === req.user.id) {
      return res.status(422).json({ error: 'Select a different receiving doctor.' });
    }
    await client.query('BEGIN');
    const transfer = await client.query(
      `INSERT INTO appointment_transfers
       (clinic_id, appointment_id, pet_id, from_doctor_id, to_doctor_id, reason, urgency, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [clinicId, appointmentId, appointment.pet_id, appointment.practitioner_id || req.user.id, toDoctorId, reason, urgency, notes, req.user.id]
    );
    await client.query(
      `UPDATE appointments SET practitioner_id=$1, updated_at=now()
       WHERE id=$2 AND clinic_id=$3`,
      [toDoctorId, appointmentId, clinicId]
    );
    await client.query('COMMIT');
    const saved = await db.query(
      `SELECT t.*, fd.name AS from_doctor, td.name AS to_doctor
       FROM appointment_transfers t
       LEFT JOIN users fd ON fd.id=t.from_doctor_id
       LEFT JOIN users td ON td.id=t.to_doctor_id
       WHERE t.id=$1`,
      [transfer.rows[0].id]
    );
    await logAudit({
      user_id: req.user.id, role: req.user.role, action: 'transfer',
      table_name: 'appointments', record_id: appointmentId,
      old_data: appointment, new_data: { practitioner_id: toDoctorId, transfer: saved.rows[0] },
      reason, ip_address: req.ip || req.connection.remoteAddress,
    });
    return res.status(201).json(saved.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    return next(e);
  } finally {
    client.release();
  }
};

exports.listVaccinations = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;

    const result = await db.query(
      `SELECT v.id,
              v.pet_id,
              v.vaccine_name,
              TO_CHAR(v.date_given, 'YYYY-MM-DD') AS date_given,
              TO_CHAR(v.next_due, 'YYYY-MM-DD') AS next_due,
              v.batch_number,
              v.manufacturer,
              TO_CHAR(v.expiry_date, 'YYYY-MM-DD') AS expiry_date,
              v.dose,
              v.verified,
              v.verified_by,
              v.verified_at,
              verifier.name AS verified_by_name,
              v.verification_reason,
              v.sticker_attachment_id,
              a.url AS sticker_url,
              a.filename AS sticker_filename,
              v.notes,
              v.status,
              v.appointment_id,
              COALESCE(v.archived, false) AS archived,
              p.name AS pet,
              profile_photo.url AS pet_photo_url,
              p.metadata AS pet_metadata,
              c.name AS owner,
              c.email AS owner_email,
              u.name AS administered_by,
              v.created_at
       FROM vaccinations v
       LEFT JOIN pets p ON v.pet_id = p.id
       LEFT JOIN clients c ON p.client_id = c.id
       LEFT JOIN users u ON v.administered_by = u.id
       LEFT JOIN users verifier ON v.verified_by = verifier.id
       LEFT JOIN attachments a ON a.id = v.sticker_attachment_id
       LEFT JOIN LATERAL (
         SELECT profile.url
         FROM attachments profile
         WHERE profile.clinic_id = v.clinic_id
           AND profile.owner_table = 'pets'
           AND profile.owner_id = p.id
           AND profile.metadata->>'source' = 'pet_profile_photo'
         ORDER BY profile.uploaded_at DESC, profile.id DESC
         LIMIT 1
       ) profile_photo ON true
       WHERE v.clinic_id = $1
       ORDER BY v.date_given DESC`,
      [clinicId]
    );

    res.json(result.rows.map(({ pet_metadata: petMetadata, ...row }) => {
      const share = (Array.isArray(petMetadata?.owner_shared_records) ? petMetadata.owner_shared_records : [])
        .find(item => Array.isArray(item.records) && item.records.some(record => record.id === `vaccine:${row.id}`));
      return { ...row, shared: Boolean(share), shared_by: share?.sharedBy || null, shared_at: share?.createdAt || null };
    }));
  } catch (e) {
    next(e);
  }
};

const getVaccinationInput = (body) => ({
  petId: Number.isInteger(Number.parseInt(body.pet_id || body.petId, 10))
    ? Number.parseInt(body.pet_id || body.petId, 10)
    : null,
  vaccineName: String(body.vaccine_name || body.vaccineName || body.type || '').trim(),
  dateGiven: body.date_given || body.dateGiven || null,
  nextDue: body.next_due || body.nextDue || null,
  batchNumber: String(body.batch_number || body.batchNumber || body.lotNumber || '').trim() || null,
  manufacturer: String(body.manufacturer || '').trim() || null,
  expiryDate: body.expiry_date || body.expiryDate || null,
  dose: String(body.dose || '').trim() || null,
  notes: String(body.notes || '').trim() || null,
  administeredBy: Number.isInteger(Number.parseInt(body.administered_by || body.administeredBy, 10))
    ? Number.parseInt(body.administered_by || body.administeredBy, 10)
    : null,
  administeredByName: String(body.administered_by_name || body.administeredByName || body.attendingDoctor || '').trim(),
  overrideReason: String(body.override_reason || body.overrideReason || '').trim(),
  scheduled: body.scheduled === true || String(body.status || '').toLowerCase() === 'scheduled',
  appointmentId: Number.isInteger(Number.parseInt(body.appointment_id || body.appointmentId, 10))
    ? Number.parseInt(body.appointment_id || body.appointmentId, 10) : null,
});

const vaccinationResponseQuery = `
  SELECT v.id, v.pet_id, v.clinic_id, v.vaccine_name,
         TO_CHAR(v.date_given, 'YYYY-MM-DD') AS date_given,
         TO_CHAR(v.next_due, 'YYYY-MM-DD') AS next_due,
         v.batch_number, v.manufacturer, TO_CHAR(v.expiry_date, 'YYYY-MM-DD') AS expiry_date, v.dose, v.notes,
         v.administered_by, u.name AS administered_by_name, v.verified,
         v.status, v.appointment_id,
         v.verified_by, verifier.name AS verified_by_name, v.verified_at, v.verification_reason,
         v.sticker_attachment_id, a.url AS sticker_url, a.filename AS sticker_filename,
         COALESCE(v.archived, false) AS archived,
         v.created_at, p.name AS pet, profile_photo.url AS pet_photo_url, c.name AS owner
  FROM vaccinations v
  LEFT JOIN users u ON v.administered_by = u.id
  LEFT JOIN users verifier ON v.verified_by = verifier.id
  LEFT JOIN pets p ON v.pet_id = p.id
  LEFT JOIN clients c ON p.client_id = c.id
  LEFT JOIN attachments a ON a.id = v.sticker_attachment_id
  LEFT JOIN LATERAL (
    SELECT profile.url
    FROM attachments profile
    WHERE profile.clinic_id = v.clinic_id
      AND profile.owner_table = 'pets'
      AND profile.owner_id = p.id
      AND profile.metadata->>'source' = 'pet_profile_photo'
    ORDER BY profile.uploaded_at DESC, profile.id DESC
    LIMIT 1
  ) profile_photo ON true
`;

async function resolveVaccinationAdministeredBy(input, clinicId) {
  if (Number.isInteger(input.administeredBy)) {
    const user = await db.query(
      'SELECT id, name FROM users WHERE id = $1 AND (clinic_id = $2 OR clinic_id IS NULL)',
      [input.administeredBy, clinicId]
    );
    if (!user.rows.length) return { error: 'The administering user is not assigned to this clinic.' };
    return { id: user.rows[0].id };
  }
  if (!input.administeredByName) return { error: 'Administered by is required.' };
  const user = await db.query(
    `SELECT id FROM users
     WHERE (clinic_id = $1 OR clinic_id IS NULL) AND LOWER(name) = LOWER($2)
     LIMIT 1`,
    [clinicId, input.administeredByName]
  );
  if (!user.rows.length) return { error: 'The administering user could not be found in this clinic.' };
  return { id: user.rows[0].id };
}

function vaccinationDateErrors(input) {
  const errors = validateClinicalDates({
    dateGiven: input.scheduled ? null : input.dateGiven,
    nextDue: input.nextDue,
    administrationDate: input.scheduled ? null : input.dateGiven,
    expiry: input.expiryDate,
  });
  if (!input.vaccineName) errors.vaccineName = 'Vaccine or product name is required.';
  if (!Number.isInteger(input.petId)) errors.petId = 'A valid pet is required.';
  return errors;
}

async function getVaccinationForClinic(id, clinicId) {
  const result = await db.query(`${vaccinationResponseQuery} WHERE v.id = $1 AND v.clinic_id = $2`, [id, clinicId]);
  return result.rows[0] || null;
}

exports.createVaccination = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const input = getVaccinationInput(req.body);
    const errors = vaccinationDateErrors(input);
    if (input.scheduled && !input.appointmentId) errors.appointmentId = 'A scheduled vaccination must be linked to its appointment.';
    const pet = input.petId
      ? await db.query(
        `SELECT p.id, p.name, p.client_id FROM pets p
         JOIN clients c ON c.id = p.client_id AND c.clinic_id = $2
         WHERE p.id = $1 AND p.clinic_id = $2`,
        [input.petId, clinicId]
      )
      : { rows: [] };
    if (!pet.rows.length) errors.petId = 'The selected pet is not registered at this clinic.';
    if (input.scheduled && input.appointmentId && pet.rows.length) {
      const appointment = await db.query(
        `SELECT id FROM appointments
         WHERE id=$1 AND clinic_id=$2 AND pet_id=$3 AND status='scheduled' AND COALESCE(archived,false)=false`,
        [input.appointmentId, clinicId, input.petId]
      );
      if (!appointment.rows.length) errors.appointmentId = 'The linked appointment is not an active appointment for this pet.';
    }
    const administrator = await resolveVaccinationAdministeredBy(input, clinicId);
    if (administrator.error) errors.administeredBy = administrator.error;
    if (Object.keys(errors).length) return res.status(422).json({ error: 'Validation failed', fields: errors });

    const duplicate = await db.query(
      `SELECT id, vaccine_name, date_given, batch_number
       FROM vaccinations
       WHERE clinic_id = $1 AND pet_id = $2 AND archived = false
         AND LOWER(vaccine_name) = LOWER($3)
         AND date_given = $4
         AND COALESCE(batch_number, '') = COALESCE($5, '')`,
      [clinicId, input.petId, input.vaccineName, input.dateGiven, input.batchNumber]
    );
    if (duplicate.rows.length && !input.overrideReason) {
      return res.status(409).json({
        error: 'Potential duplicate vaccination detected.',
        code: 'POTENTIAL_DUPLICATE',
        potential_duplicates: duplicate.rows,
        requires_override_reason: true,
      });
    }
    if (duplicate.rows.length) {
      const overrideError = validateOverrideReason(input.overrideReason);
      if (overrideError || !['doctor', 'clinic_owner', 'super_admin'].includes(req.user.role)) {
        return res.status(422).json({ error: overrideError || 'Only an authorized clinical user can override a duplicate warning.' });
      }
    }

    const result = await db.query(
      `INSERT INTO vaccinations
       (pet_id, clinic_id, vaccine_name, date_given, next_due, batch_number, manufacturer,
        expiry_date, dose, administered_by, notes, status, appointment_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [input.petId, clinicId, input.vaccineName, input.dateGiven, input.nextDue, input.batchNumber,
        input.manufacturer, input.expiryDate, input.dose, administrator.id, input.notes,
        input.scheduled ? 'scheduled' : 'administered', input.appointmentId]
    );
    const vaccination = await getVaccinationForClinic(result.rows[0].id, clinicId);
    await logAudit({
      user_id: req.user.id,
      role: req.user.role,
      action: 'create',
      table_name: 'vaccinations',
      record_id: vaccination.id,
      new_data: vaccination,
      reason: input.overrideReason || 'Vaccination record created.',
      ip_address: req.ip || req.connection.remoteAddress,
    });
    return res.status(201).json(vaccination);
  } catch (e) {
    return next(e);
  }
};

exports.updateVaccination = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid vaccination ID.' });
    const current = await getVaccinationForClinic(id, clinicId);
    if (!current) return res.status(404).json({ error: 'Vaccination not found.' });
    const input = getVaccinationInput({ ...current, ...req.body });
    const errors = vaccinationDateErrors(input);
    const pet = input.petId
      ? await db.query(
        `SELECT p.id FROM pets p JOIN clients c ON c.id = p.client_id AND c.clinic_id = $2
         WHERE p.id = $1 AND p.clinic_id = $2`,
        [input.petId, clinicId]
      )
      : { rows: [] };
    if (!pet.rows.length) errors.petId = 'The selected pet is not registered at this clinic.';
    const administrator = await resolveVaccinationAdministeredBy(input, clinicId);
    if (administrator.error) errors.administeredBy = administrator.error;
    if (Object.keys(errors).length) return res.status(422).json({ error: 'Validation failed', fields: errors });

    const changedVerifiedFields = ['vaccineName', 'dateGiven', 'batchNumber', 'expiryDate', 'dose']
      .some(field => String(input[field] || '') !== String(field === 'vaccineName' ? current.vaccine_name || '' : current[field === 'dateGiven' ? 'date_given' : field === 'batchNumber' ? 'batch_number' : field === 'expiryDate' ? 'expiry_date' : 'dose'] || ''));
    const verified = changedVerifiedFields ? false : Boolean(current.verified);
    const result = await db.query(
      `UPDATE vaccinations
       SET pet_id=$1, vaccine_name=$2, date_given=$3, next_due=$4, batch_number=$5,
           manufacturer=$6, expiry_date=$7, dose=$8, administered_by=$9, notes=$10,
           verified=$11, verified_by=CASE WHEN $11 THEN verified_by ELSE NULL END,
           verified_at=CASE WHEN $11 THEN verified_at ELSE NULL END,
           verification_reason=CASE WHEN $11 THEN verification_reason ELSE NULL END
       WHERE id=$12 AND clinic_id=$13
       RETURNING id`,
      [input.petId, input.vaccineName, input.dateGiven, input.nextDue, input.batchNumber, input.manufacturer,
        input.expiryDate, input.dose, administrator.id, input.notes, verified, id, clinicId]
    );
    const vaccination = await getVaccinationForClinic(result.rows[0].id, clinicId);
    await logAudit({
      user_id: req.user.id,
      role: req.user.role,
      action: 'update',
      table_name: 'vaccinations',
      record_id: id,
      old_data: current,
      new_data: vaccination,
      reason: input.overrideReason || (changedVerifiedFields ? 'Vaccination fields changed; verification removed.' : 'Vaccination record updated.'),
      ip_address: req.ip || req.connection.remoteAddress,
    });
    return res.json(vaccination);
  } catch (e) {
    return next(e);
  }
};

exports.updateVaccinationVerification = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const id = Number.parseInt(req.params.id, 10);
    const current = await getVaccinationForClinic(id, clinicId);
    if (!current) return res.status(404).json({ error: 'Vaccination not found.' });
    const verified = req.body.verified !== false;
    const reason = String(req.body.reason || '').trim();
    if (verified && req.body.attestation_confirmed !== true) {
      return res.status(422).json({ error: 'Confirm the physical sticker and clinic administration before verifying this record.' });
    }
    if (!verified && !reason) return res.status(422).json({ error: 'A reason is required to remove verification.' });
    if (verified && current.verified === true) return res.json(current);
    const result = await db.query(
      `UPDATE vaccinations
       SET verified=$1, verified_by=$2, verified_at=CASE WHEN $1 THEN now() ELSE NULL END,
           verification_reason=$3
       WHERE id=$4 AND clinic_id=$5
       RETURNING id`,
      [verified, verified ? req.user.id : null, reason || 'Record verification removed.', id, clinicId]
    );
    const vaccination = await getVaccinationForClinic(result.rows[0].id, clinicId);
    await logAudit({
      user_id: req.user.id,
      role: req.user.role,
      action: verified ? 'verify' : 'unverify',
      table_name: 'vaccinations',
      record_id: id,
      old_data: current,
      new_data: vaccination,
      reason: reason || 'Vaccination record verified.',
      ip_address: req.ip || req.connection.remoteAddress,
    });
    return res.json(vaccination);
  } catch (e) {
    return next(e);
  }
};

exports.uploadVaccinationSticker = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const id = Number.parseInt(req.params.id, 10);
    const current = await getVaccinationForClinic(id, clinicId);
    if (!current) return res.status(404).json({ error: 'Vaccination not found.' });
    const filename = String(req.body.filename || '').trim();
    const contentType = String(req.body.content_type || '').trim().toLowerCase();
    const data = String(req.body.data || '');
    if (!filename || !/^image\/(jpeg|png|webp|gif)$/.test(contentType) || !data.startsWith(`data:${contentType};base64,`)) {
      return res.status(422).json({ error: 'Upload a valid JPEG, PNG, WEBP, or GIF image.' });
    }
    const encoded = data.slice(data.indexOf(',') + 1);
    if (!encoded || encoded.length > 5 * 1024 * 1024) {
      return res.status(413).json({ error: 'Sticker image must be smaller than 5 MB.' });
    }
    const attachment = await db.query(
      `INSERT INTO attachments (clinic_id, owner_table, owner_id, filename, content_type, url, metadata)
       VALUES ($1, 'vaccinations', $2, $3, $4, $5, $6)
       RETURNING id, filename, content_type, url, uploaded_at`,
      [clinicId, id, filename, contentType, data, JSON.stringify({ source: 'vaccination_sticker', uploaded_by: req.user.id })]
    );
    await db.query(
      'UPDATE vaccinations SET sticker_attachment_id = $1, verified = false, verified_by = NULL, verified_at = NULL, verification_reason = NULL WHERE id = $2 AND clinic_id = $3',
      [attachment.rows[0].id, id, clinicId]
    );
    const saved = await getVaccinationForClinic(id, clinicId);
    await logAudit({
      user_id: req.user.id,
      role: req.user.role,
      action: 'upload_sticker',
      table_name: 'vaccinations',
      record_id: id,
      old_data: current,
      new_data: saved,
      reason: 'Vaccination sticker image uploaded; verification removed.',
      ip_address: req.ip || req.connection.remoteAddress,
    });
    return res.status(201).json(saved);
  } catch (e) {
    return next(e);
  }
};

exports.listPrescriptions = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const petId = req.query.pet_id ? Number(req.query.pet_id) : null;
    const includeArchived = req.query.include_archived === 'true';
    if (req.query.pet_id && (!Number.isInteger(petId) || petId < 1)) {
      return res.status(400).json({ error: 'A valid pet_id is required' });
    }

    const result = await db.query(
      `SELECT pr.id,
              pr.pet_id,
              pr.treatment_plan_id,
              pr.medication,
              pr.dosage,
              pr.route,
              pr.frequency,
              pr.start_date,
              pr.end_date,
              pr.quantity,
              pr.instructions,
              pr.metadata->>'cost' AS cost,
              CASE
                WHEN LOWER(COALESCE(tp.status, '')) = 'completed'
                  AND LOWER(COALESCE(pr.status, 'active')) = 'active' THEN 'completed'
                ELSE pr.status
              END AS status,
              COALESCE(pr.archived, false) AS archived,
              pr.issued_at,
              p.name AS pet,
              c.name AS owner,
              u.name AS issued_by,
              tp.title AS treatment_plan,
              tp.diagnosis AS treatment_plan_diagnosis
       FROM prescriptions pr
       LEFT JOIN pets p ON pr.pet_id = p.id
       LEFT JOIN clients c ON p.client_id = c.id
       LEFT JOIN users u ON pr.issued_by = u.id
       LEFT JOIN treatment_plans tp ON pr.treatment_plan_id = tp.id
       WHERE pr.clinic_id = $1
         AND ($2::integer IS NULL OR pr.pet_id = $2)
         AND ($3::boolean OR COALESCE(pr.archived, false) = false)
       ORDER BY pr.issued_at DESC`,
      [clinicId, petId, includeArchived]
    );

    return res.json(result.rows);
  } catch (e) {
    return next(e);
  }
};

const validatePetForClinic = async (client, petId, clinicId) => {
  const result = await client.query(
    `SELECT id FROM pets
     WHERE id = $1 AND clinic_id = $2
       AND COALESCE((metadata->>'archived')::boolean, false) = false`,
    [petId, clinicId]
  );
  return result.rows.length > 0;
};

const writeClinicalAudit = async (client, req, action, tableName, recordId, newData) => {
  const auditData = {
    ...newData,
    _audit: {
      user_id: req.user?.id || null,
      role: req.user?.role || null,
      recorded_at: new Date().toISOString(),
    },
  };
  await client.query(
    `INSERT INTO audit_trail (user_id, action, table_name, record_id, new_data, ip_address)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [req.user?.id || null, action, tableName, recordId, JSON.stringify(auditData), req.ip || req.connection.remoteAddress]
  );
};

const isValidClinicalDate = (value) => {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

exports.listTreatmentPlans = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const petId = req.query.pet_id ? Number(req.query.pet_id) : null;
    const includeArchived = req.query.include_archived === 'true';
    if (req.query.pet_id && (!Number.isInteger(petId) || petId < 1)) {
      return res.status(400).json({ error: 'A valid pet_id is required' });
    }
    const result = await db.query(
      `SELECT tp.id, tp.pet_id, tp.title, tp.diagnosis, tp.status, tp.severity,
              tp.follow_up, tp.steps, tp.monitoring, tp.notes, tp.clinical_updates, tp.issued_by, tp.created_at, tp.updated_at,
              COALESCE(tp.archived, false) AS archived,
              p.name AS pet, c.name AS owner,
              COALESCE(attending_vet.name, u.name) AS veterinarian,
              tp.attending_veterinarian_id,
              COALESCE(rx.prescriptions, '[]'::jsonb) AS prescriptions
       FROM treatment_plans tp
       JOIN pets p ON p.id = tp.pet_id
       LEFT JOIN clients c ON c.id = p.client_id
       LEFT JOIN users u ON u.id = tp.issued_by
       LEFT JOIN users attending_vet ON attending_vet.id = tp.attending_veterinarian_id
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(jsonb_build_object(
           'id', pr.id, 'medication', pr.medication, 'dosage', pr.dosage,
           'route', pr.route, 'frequency', pr.frequency, 'start_date', pr.start_date,
           'end_date', pr.end_date, 'instructions', pr.instructions, 'status', pr.status
         ) ORDER BY pr.issued_at DESC) AS prescriptions
         FROM prescriptions pr
         WHERE pr.treatment_plan_id = tp.id AND COALESCE(pr.archived, false) = false
       ) rx ON true
       WHERE tp.clinic_id = $1
         AND ($2::integer IS NULL OR tp.pet_id = $2)
         AND ($3::boolean OR COALESCE(tp.archived, false) = false)
       ORDER BY tp.created_at DESC`,
      [clinicId, petId, includeArchived]
    );
    return res.json(result.rows);
  } catch (e) {
    return next(e);
  }
};

exports.archiveTreatmentPlan = (req, res, next) => archiveClinicRecord(req, res, next, 'treatment_plans', 'treatment plan');

exports.addTreatmentPlanNote = async (req, res, next) => {
  let client;
  try {
    client = await db.pool.connect();
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const planId = Number(req.params.id);
    const text = String(req.body?.text || '').trim();
    if (!Number.isInteger(planId) || planId < 1 || !text || text.length > 5000) {
      return res.status(400).json({ error: 'A valid plan id and a note of 1 to 5000 characters are required' });
    }
    await client.query('BEGIN');
    const authorResult = await client.query('SELECT name FROM users WHERE id = $1 AND clinic_id = $2', [req.user?.id || null, clinicId]);
    const note = {
      text,
      date: new Date().toISOString(),
      author: authorResult.rows[0]?.name || 'Clinic team',
    };

    const result = await client.query(
      `UPDATE treatment_plans
       SET notes = COALESCE(notes, '[]'::jsonb) || jsonb_build_array($1::jsonb), updated_at = now()
       WHERE id = $2 AND clinic_id = $3
       RETURNING id, notes`,
      [JSON.stringify(note), planId, clinicId]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Treatment plan not found' });
    }
    await writeClinicalAudit(client, req, 'update', 'treatment_plans', planId, {
      id: planId,
      note_added: note,
      notes: result.rows[0].notes,
    });
    await client.query('COMMIT');
    return res.status(201).json({ note, notes: result.rows[0].notes });
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return next(e);
  } finally {
    if (client) client.release();
  }
};

exports.createTreatmentPlan = async (req, res, next) => {
  let client;
  try {
    client = await db.pool.connect();
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const petId = Number(req.body.pet_id);
    const title = String(req.body.title || '').trim();
    const diagnosis = String(req.body.diagnosis || '').trim();
    const veterinarianId = req.body.attending_veterinarian_id ? Number(req.body.attending_veterinarian_id) : null;
    const steps = Array.isArray(req.body.steps) ? req.body.steps : [];
    const prescription = req.body.prescription || null;
    if (!Number.isInteger(petId) || petId < 1 || !title || !diagnosis || !steps.length
      || steps.some((step) => !String(typeof step === 'string' ? step : step?.title || '').trim())) {
      return res.status(400).json({ error: 'Pet, title, diagnosis, and at least one plan step are required' });
    }
    if (prescription && (!String(prescription.medication || '').trim() || !String(prescription.dosage || '').trim())) {
      return res.status(400).json({ error: 'Medication name and dosage are required for a linked prescription' });
    }
    if (prescription && (!isValidClinicalDate(prescription.start_date) || !isValidClinicalDate(prescription.end_date)
      || (prescription.start_date && prescription.end_date && prescription.start_date > prescription.end_date))) {
      return res.status(400).json({ error: 'Prescription dates must be valid and the end date cannot be before the start date' });
    }
    if (!isValidClinicalDate(req.body.follow_up)) {
      return res.status(400).json({ error: 'Follow-up date must be a valid calendar date' });
    }
    if (req.body.attending_veterinarian_id && (!Number.isInteger(veterinarianId) || veterinarianId < 1)) {
      return res.status(400).json({ error: 'Select a valid attending veterinarian' });
    }
    if (prescription && prescription.pet_id && Number(prescription.pet_id) !== petId) {
      return res.status(400).json({ error: 'The prescription must belong to the plan patient' });
    }
    await client.query('BEGIN');
    if (!await validatePetForClinic(client, petId, clinicId)) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Patient not found in this clinic' });
    }
    if (veterinarianId) {
      const veterinarian = await client.query(
        `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1 AND u.clinic_id = $2 AND u.is_active = true
           AND lower(replace(replace(r.name, ' ', '_'), '-', '_')) IN ('doctor', 'veterinarian', 'assistant_doctor')`,
        [veterinarianId, clinicId]
      );
      if (!veterinarian.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'The selected veterinarian is not active clinical staff at this clinic' });
      }
    }
    const planResult = await client.query(
      `INSERT INTO treatment_plans (clinic_id, pet_id, title, diagnosis, status, severity, follow_up, steps, issued_by, attending_veterinarian_id)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7::jsonb, $8, $9)
       RETURNING *`,
      [clinicId, petId, title, diagnosis, req.body.severity || null, req.body.follow_up || null, JSON.stringify(steps), req.user?.id || null, veterinarianId]
    );
    let savedPrescription = null;
    if (prescription) {
      const prescriptionResult = await client.query(
        `INSERT INTO prescriptions
          (pet_id, clinic_id, medication, dosage, quantity, instructions, issued_by, issued_at, status,
           route, frequency, start_date, end_date, treatment_plan_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), 'active', $8, $9, $10, $11, $12)
         RETURNING id, pet_id, treatment_plan_id, medication, dosage, route, frequency, start_date, end_date, quantity, instructions, status, issued_at`,
        [petId, clinicId, String(prescription.medication).trim(), String(prescription.dosage).trim(),
          prescription.quantity || null, prescription.instructions || null, req.user?.id || null,
          prescription.route || null, prescription.frequency || null, prescription.start_date || null,
          prescription.end_date || null, planResult.rows[0].id]
      );
      savedPrescription = prescriptionResult.rows[0];
      await writeClinicalAudit(client, req, 'create', 'prescriptions', savedPrescription.id, savedPrescription);
    }
    await writeClinicalAudit(client, req, 'create', 'treatment_plans', planResult.rows[0].id, {
      ...planResult.rows[0], prescription_id: savedPrescription?.id || null,
    });
    await client.query('COMMIT');
    return res.status(201).json({ ...planResult.rows[0], prescription: savedPrescription });
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return next(e);
  } finally {
    if (client) client.release();
  }
};

exports.updateTreatmentPlan = async (req, res, next) => {
  let client;
  try {
    client = await db.pool.connect();
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const planId = Number(req.params.id);
    const status = req.body.status === undefined ? null : String(req.body.status);
    const allowedStatuses = ['active', 'completed', 'paused', 'discontinued'];
    const hasMonitoring = Object.prototype.hasOwnProperty.call(req.body, 'monitoring');
    const hasSteps = Object.prototype.hasOwnProperty.call(req.body, 'steps');
    if (!Number.isInteger(planId) || planId < 1
      || (!status && !hasMonitoring && !hasSteps)
      || (status && !allowedStatuses.includes(status))) {
      return res.status(400).json({ error: 'A valid plan id and at least one supported field are required' });
    }
    let steps = null;
    if (hasSteps) {
      if (!Array.isArray(req.body.steps) || req.body.steps.length > 100
        || req.body.steps.some(step => {
          if (typeof step === 'string') return !step.trim() || step.length > 500;
          return !step || typeof step !== 'object' || Array.isArray(step)
            || typeof step.title !== 'string' || !step.title.trim() || step.title.length > 500
            || (step.done !== undefined && typeof step.done !== 'boolean')
            || Object.entries(step).some(([key, value]) => (
              ['title', 'detail', 'date', 'due', 'assignee', 'completedAt'].includes(key)
              && value !== undefined && (typeof value !== 'string' || value.length > 500)
            ));
        })) {
        return res.status(400).json({ error: 'Treatment plan steps must be a list of up to 100 valid steps' });
      }
      steps = req.body.steps;
    }
    let monitoring = null;
    if (hasMonitoring) {
      const allowedMonitoringFields = [
        'temperature', 'temperatureStatus', 'weight', 'hydration', 'appetite',
        'whiteBloodCellCount', 'whiteBloodCellStatus', 'lastUpdatedAt',
        'latestObservation', 'observations',
      ];
      if (!req.body.monitoring || typeof req.body.monitoring !== 'object' || Array.isArray(req.body.monitoring)) {
        return res.status(400).json({ error: 'Monitoring information must be an object' });
      }
      const unknownField = Object.keys(req.body.monitoring).find(field => !allowedMonitoringFields.includes(field));
      if (unknownField) {
        return res.status(400).json({ error: `Unsupported monitoring field: ${unknownField}` });
      }
      monitoring = {};
      for (const field of allowedMonitoringFields) {
        const value = req.body.monitoring[field];
        if (value === undefined) continue;
        if (field === 'observations') {
          const observationFields = [
            'date', 'author', 'text', 'temperature', 'weight', 'hydration',
            'appetite',
          ];
          if (!Array.isArray(value) || value.length > 100) {
            return res.status(400).json({ error: 'Monitoring observations must be a list of no more than 100 entries' });
          }
          const invalidObservation = value.some(observation => (
            !observation || typeof observation !== 'object' || Array.isArray(observation)
            || Object.keys(observation).some(key => !observationFields.includes(key))
            || typeof observation.date !== 'string' || Number.isNaN(Date.parse(observation.date))
            || observationFields.slice(1).some(key => observation[key] !== undefined
              && (typeof observation[key] !== 'string' || observation[key].length > 5000))
          ));
          if (invalidObservation) {
            return res.status(400).json({ error: 'Each monitoring observation must contain a valid date and supported text fields' });
          }
          monitoring[field] = value;
          continue;
        }
        const maximumLength = field === 'latestObservation' ? 5000 : 500;
        if (typeof value !== 'string' || value.length > maximumLength) {
          return res.status(400).json({ error: `Monitoring field ${field} must be text no longer than ${maximumLength} characters` });
        }
        monitoring[field] = value.trim();
      }
      if (monitoring.lastUpdatedAt && Number.isNaN(Date.parse(monitoring.lastUpdatedAt))) {
        return res.status(400).json({ error: 'Monitoring last-updated time must be a valid date' });
      }
    }
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE treatment_plans
       SET status = COALESCE($1, status),
           monitoring = CASE WHEN $2::boolean THEN $3::jsonb ELSE monitoring END,
           steps = CASE WHEN $4::boolean THEN $5::jsonb ELSE steps END,
           updated_at = now()
       WHERE id = $6 AND clinic_id = $7 RETURNING *`,
      [status, hasMonitoring, monitoring === null ? null : JSON.stringify(monitoring), hasSteps,
        steps === null ? null : JSON.stringify(steps), planId, clinicId]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Treatment plan not found' });
    }
    // A plan marked complete closes any medication course still active on that plan.
    // Keep this in the same transaction so the plan and medication list cannot drift.
    if (status === 'completed') {
      const prescriptions = await client.query(
        `UPDATE prescriptions
         SET status = 'completed'
         WHERE treatment_plan_id = $1 AND clinic_id = $2
           AND LOWER(COALESCE(status, 'active')) = 'active'
           AND COALESCE(archived, false) = false
         RETURNING id, pet_id, treatment_plan_id, medication, dosage, status`,
        [planId, clinicId]
      );
      for (const prescription of prescriptions.rows) {
        await writeClinicalAudit(client, req, 'update', 'prescriptions', prescription.id, prescription);
      }
    }
    await writeClinicalAudit(client, req, 'update', 'treatment_plans', planId, result.rows[0]);
    await client.query('COMMIT');
    return res.json(result.rows[0]);
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return next(e);
  } finally {
    if (client) client.release();
  }
};

exports.createPrescription = async (req, res, next) => {
  let client;
  try {
    client = await db.pool.connect();
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const petId = Number(req.body.pet_id);
    const medication = String(req.body.medication || '').trim();
    const dosage = String(req.body.dosage || '').trim();
    if (!Number.isInteger(petId) || petId < 1 || !medication || !dosage) {
      return res.status(400).json({ error: 'Patient, medication name, and dosage are required' });
    }
    if (!isValidClinicalDate(req.body.start_date) || !isValidClinicalDate(req.body.end_date)
      || (req.body.start_date && req.body.end_date && req.body.start_date > req.body.end_date)) {
      return res.status(400).json({ error: 'Prescription dates must be valid and the end date cannot be before the start date' });
    }
    await client.query('BEGIN');
    if (!await validatePetForClinic(client, petId, clinicId)) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Patient not found in this clinic' });
    }
    const planId = req.body.treatment_plan_id ? Number(req.body.treatment_plan_id) : null;
    if (req.body.treatment_plan_id && (!Number.isInteger(planId) || planId < 1)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A valid treatment_plan_id is required' });
    }
    if (planId) {
      const plan = await client.query(
        'SELECT id FROM treatment_plans WHERE id = $1 AND pet_id = $2 AND clinic_id = $3',
        [planId, petId, clinicId]
      );
      if (!plan.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'The selected plan does not belong to this patient and clinic' });
      }
    }
    const result = await client.query(
      `INSERT INTO prescriptions
        (pet_id, clinic_id, medication, dosage, quantity, instructions, issued_by, issued_at, status,
         route, frequency, start_date, end_date, treatment_plan_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), 'active', $8, $9, $10, $11, $12)
       RETURNING id, pet_id, treatment_plan_id, medication, dosage, route, frequency, start_date, end_date, quantity, instructions, status, issued_at`,
      [petId, clinicId, medication, dosage, req.body.quantity || null, req.body.instructions || null,
        req.user?.id || null, req.body.route || null, req.body.frequency || null,
        req.body.start_date || null, req.body.end_date || null, planId]
    );
    await writeClinicalAudit(client, req, 'create', 'prescriptions', result.rows[0].id, result.rows[0]);
    await client.query('COMMIT');
    return res.status(201).json(result.rows[0]);
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return next(e);
  } finally {
    if (client) client.release();
  }
};

exports.listTreatmentRecords = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const petId = req.query.pet_id ? Number(req.query.pet_id) : null;
    if (req.query.pet_id && (!Number.isInteger(petId) || petId < 1)) {
      return res.status(400).json({ error: 'A valid pet_id is required' });
    }
    const result = await db.query(
      `SELECT tr.id, tr.pet_id, tr.treatment_plan_id, tp.title AS treatment_plan,
              tr.diagnosis, tr.procedure, tr.outcome, tr.notes,
              tr.status, tr.performed_at, tr.cost, tr.follow_up_instructions,
              u.name AS veterinarian, p.name AS pet,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'id', pr.id,
                  'administered', trp.administered
                ) ORDER BY pr.issued_at DESC)
                FROM treatment_record_prescriptions trp
                JOIN prescriptions pr ON pr.id = trp.prescription_id
                WHERE trp.treatment_record_id = tr.id
              ), '[]'::json) AS medications
       FROM treatment_records tr
       JOIN pets p ON p.id = tr.pet_id
       LEFT JOIN treatment_plans tp ON tp.id = tr.treatment_plan_id AND tp.clinic_id = tr.clinic_id
       LEFT JOIN users u ON u.id = tr.performed_by
       WHERE tr.clinic_id = $1 AND tr.archived = false
         AND ($2::integer IS NULL OR tr.pet_id = $2)
       ORDER BY tr.performed_at DESC`,
      [clinicId, petId]
    );
    return res.json(result.rows);
  } catch (e) {
    return next(e);
  }
};

exports.createTreatmentRecord = async (req, res, next) => {
  let client;
  try {
    client = await db.pool.connect();
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const petId = Number(req.body.pet_id);
    const treatmentPlanId = req.body.treatment_plan_id ? Number(req.body.treatment_plan_id) : null;
    const diagnosis = String(req.body.diagnosis || '').trim();
    const procedure = String(req.body.procedure || '').trim();
    const performedAt = req.body.performed_at;
    const rawCost = req.body.cost;
    const cost = rawCost === '' || rawCost == null ? null : Number(rawCost);
    const followUpInstructions = String(req.body.follow_up_instructions || '').trim() || null;
    if (req.body.medications !== undefined && !Array.isArray(req.body.medications)) {
      return res.status(400).json({ error: 'Selected medications must be provided as a list' });
    }
    const medications = Array.isArray(req.body.medications) ? req.body.medications : [];
    const validMedicationEntries = medications.every(item => item && typeof item === 'object' && !Array.isArray(item));
    const prescriptionIds = validMedicationEntries ? medications.map(item => Number(item.prescription_id)) : [];
    if (!Number.isInteger(petId) || petId < 1 || !diagnosis || !procedure) {
      return res.status(400).json({ error: 'Patient, diagnosis, and treatment/procedure are required' });
    }
    if (req.body.treatment_plan_id && (!Number.isInteger(treatmentPlanId) || treatmentPlanId < 1)) {
      return res.status(400).json({ error: 'A valid treatment_plan_id is required' });
    }
    if (performedAt && Number.isNaN(Date.parse(performedAt))) {
      return res.status(400).json({ error: 'A valid treatment date is required' });
    }
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      return res.status(400).json({ error: 'Treatment cost must be a non-negative amount' });
    }
    if (!validMedicationEntries || medications.length !== prescriptionIds.length || prescriptionIds.some(id => !Number.isInteger(id) || id < 1)
      || new Set(prescriptionIds).size !== prescriptionIds.length
      || medications.some(item => typeof item.administered !== 'boolean')) {
      return res.status(400).json({ error: 'Selected medications are invalid' });
    }
    await client.query('BEGIN');
    if (!await validatePetForClinic(client, petId, clinicId)) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Patient not found in this clinic' });
    }
    if (treatmentPlanId) {
      const plan = await client.query(
        'SELECT id FROM treatment_plans WHERE id = $1 AND pet_id = $2 AND clinic_id = $3',
        [treatmentPlanId, petId, clinicId]
      );
      if (!plan.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'The selected treatment plan does not belong to this patient and clinic' });
      }
    }
    const result = await client.query(
      `INSERT INTO treatment_records
        (clinic_id, pet_id, treatment_plan_id, diagnosis, procedure, outcome, notes, status, performed_by,
         performed_at, cost, follow_up_instructions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, now()), $11, $12)
       RETURNING *`,
      [clinicId, petId, treatmentPlanId, diagnosis, procedure, req.body.outcome || null, req.body.notes || null,
        req.body.status === 'planned' ? 'planned' : 'completed', req.user?.id || null,
        performedAt || null, cost, followUpInstructions]
    );
    if (medications.length) {
      const linkedPrescriptions = await client.query(
        `SELECT id FROM prescriptions
         WHERE clinic_id = $1 AND pet_id = $2 AND id = ANY($3::integer[])`,
        [clinicId, petId, prescriptionIds]
      );
      if (linkedPrescriptions.rows.length !== prescriptionIds.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Selected medications must belong to this patient and clinic' });
      }
      for (const medication of medications) {
        await client.query(
          `INSERT INTO treatment_record_prescriptions
            (treatment_record_id, prescription_id, administered)
           VALUES ($1, $2, $3)`,
          [result.rows[0].id, Number(medication.prescription_id), medication.administered]
        );
      }
    }
    await writeClinicalAudit(client, req, 'create', 'treatment_records', result.rows[0].id, result.rows[0]);
    await client.query('COMMIT');
    return res.status(201).json(result.rows[0]);
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return next(e);
  } finally {
    if (client) client.release();
  }
};

exports.updateTreatmentRecord = async (req, res, next) => {
  let client;
  try {
    client = await db.pool.connect();
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const recordId = Number(req.params.id);
    const diagnosis = String(req.body.diagnosis || '').trim();
    const procedure = String(req.body.procedure || '').trim();
    const status = String(req.body.status || '');
    const performedAt = req.body.performed_at;
    const costProvided = Object.prototype.hasOwnProperty.call(req.body, 'cost');
    const rawCost = req.body.cost;
    const cost = rawCost === '' || rawCost == null ? null : Number(rawCost);
    const followUpProvided = Object.prototype.hasOwnProperty.call(req.body, 'follow_up_instructions');
    const followUpInstructions = String(req.body.follow_up_instructions || '').trim() || null;
    if (!Number.isInteger(recordId) || recordId < 1 || !diagnosis || !procedure) {
      return res.status(400).json({ error: 'A valid record id, diagnosis, and treatment/procedure are required' });
    }
    if (!['planned', 'active', 'paused', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Treatment status must be planned, active, paused, or completed' });
    }
    if (!performedAt || Number.isNaN(Date.parse(performedAt))) {
      return res.status(400).json({ error: 'A valid treatment date is required' });
    }
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      return res.status(400).json({ error: 'Treatment cost must be a non-negative amount' });
    }

    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE treatment_records
       SET diagnosis = $1,
           procedure = $2,
           outcome = $3,
           notes = $4,
           status = $5,
           performed_at = $6,
           cost = CASE WHEN $9::boolean THEN $7 ELSE cost END,
           follow_up_instructions = CASE WHEN $10::boolean THEN $8 ELSE follow_up_instructions END
       WHERE id = $11 AND clinic_id = $12 AND archived = false
       RETURNING *`,
      [diagnosis, procedure, String(req.body.outcome || '').trim() || null,
        String(req.body.notes || '').trim() || null, status, performedAt, cost, followUpInstructions,
        costProvided, followUpProvided, recordId, clinicId]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Treatment record not found in this clinic' });
    }
    await writeClinicalAudit(client, req, 'update', 'treatment_records', recordId, result.rows[0]);
    await client.query('COMMIT');
    return res.json(result.rows[0]);
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return next(e);
  } finally {
    if (client) client.release();
  }
};

exports.listPatientQueue = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;

    const result = await db.query(
      `SELECT q.id,
              q.position,
              q.status,
              q.checkin_at,
              q.updated_at,
              a.start_time AS appointment_start,
              p.name AS pet,
              c.name AS owner,
              u.name AS practitioner
       FROM patient_queue q
       LEFT JOIN appointments a ON q.appointment_id = a.id
       LEFT JOIN pets p ON q.pet_id = p.id
       LEFT JOIN clients c ON q.client_id = c.id
       LEFT JOIN users u ON a.practitioner_id = u.id
       WHERE q.clinic_id = $1
       ORDER BY q.position ASC`,
      [clinicId]
    );

    res.json(result.rows);
  } catch (e) {
    next(e);
  }
};

exports.accrueInpatientCharges = async (clinicId = null) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const dueStays = await client.query(
      `SELECT s.id, s.clinic_id, s.pet_id, s.appointment_id, s.consultation_id, s.catalog_item_id,
              s.invoice_id, s.daily_price, s.last_charged_on, c.name AS service_name,
              a.client_id
       FROM clinic_inpatient_stays s
       JOIN clinic_billing_catalog c ON c.id=s.catalog_item_id
       JOIN appointments a ON a.id=s.appointment_id
       WHERE s.status='active' AND s.last_charged_on < CURRENT_DATE
         AND ($1::integer IS NULL OR s.clinic_id=$1)
       ORDER BY s.id FOR UPDATE OF s`,
      [clinicId]
    );
    const todayResult = await client.query('SELECT CURRENT_DATE::text AS today');
    const today = todayResult.rows[0].today;
    for (const stay of dueStays.rows) {
      if (!stay.client_id) throw new Error(`Inpatient stay ${stay.id} has no appointment owner for billing.`);
      let chargeDate = new Date(`${stay.last_charged_on}T00:00:00.000Z`);
      while (chargeDate.toISOString().slice(0, 10) < today) {
        chargeDate.setUTCDate(chargeDate.getUTCDate() + 1);
        const date = chargeDate.toISOString().slice(0, 10);
        const invoiceResult = await client.query(
          `SELECT id FROM invoices
           WHERE appointment_id=$1 AND status IN ('draft', 'issued')
           ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
          [stay.appointment_id]
        );
        let invoiceId = invoiceResult.rows[0]?.id;
        if (!invoiceId) {
          const newInvoice = await client.query(
            `INSERT INTO invoices
              (clinic_id, client_id, appointment_id, status, currency, subtotal, tax, total, issued_at)
             VALUES ($1,$2,$3,'issued','PHP',0,0,0,now())
             RETURNING id`,
            [stay.clinic_id, stay.client_id, stay.appointment_id]
          );
          invoiceId = newInvoice.rows[0].id;
        }
        const line = await client.query(
          `INSERT INTO invoice_items
            (invoice_id, description, unit_price, quantity, catalog_item_id, item_type)
           VALUES ($1,$2,$3,1,$4,'inpatient')
           RETURNING id`,
          [invoiceId, `${stay.service_name} — ${date}`, stay.daily_price, stay.catalog_item_id]
        );
        const charge = await client.query(
          `INSERT INTO clinic_inpatient_stay_charges (stay_id, invoice_item_id, charge_date)
           VALUES ($1,$2,$3)
           ON CONFLICT (stay_id, charge_date) DO NOTHING
           RETURNING id`,
          [stay.id, line.rows[0].id, date]
        );
        if (!charge.rows.length) {
          await client.query('DELETE FROM invoice_items WHERE id=$1', [line.rows[0].id]);
        } else {
          await client.query(
            `UPDATE invoices
             SET subtotal=subtotal + $1, total=subtotal + $1 + tax, updated_at=now()
             WHERE id=$2`,
            [stay.daily_price, invoiceId]
          );
          await client.query(
            `UPDATE clinic_inpatient_stays
             SET invoice_id=$1, last_charged_on=$2, updated_at=now()
             WHERE id=$3`,
            [invoiceId, date, stay.id]
          );
        }
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

exports.createInpatientStay = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    if (!canManageClinicalRecords(req.user?.role)) return res.status(403).json({ error: 'Clinical staff access is required to admit a patient.' });
    const petId = Number.parseInt(req.body.pet_id, 10);
    const reason = String(req.body.admission_reason || '').trim();
    const ward = String(req.body.ward || '').trim();
    const consentStatus = String(req.body.consent_status || 'pending').trim().toLowerCase();
    const estimatedCost = req.body.estimated_cost === '' || req.body.estimated_cost === undefined || req.body.estimated_cost === null
      ? null : Number(req.body.estimated_cost);
    const numericField = field => req.body[field] === '' || req.body[field] === undefined || req.body[field] === null ? null : Number(req.body[field]);
    const patientWeight = numericField('patient_weight');
    const temperature = numericField('temperature');
    const heartRate = numericField('heart_rate');
    const respiratoryRate = numericField('respiratory_rate');
    const estimatedAddOns = numericField('estimated_add_ons') ?? 0;
    const authorizedLimit = numericField('authorized_limit');
    const admittedAt = req.body.admitted_at ? new Date(req.body.admitted_at) : new Date();
    const urgencyLevel = String(req.body.urgency_level || 'Normal').trim();
    const presentingComplaint = String(req.body.presenting_complaint || '').trim();
    if (!Number.isInteger(petId) || petId < 1 || !reason || !ward || !presentingComplaint || Number.isNaN(admittedAt.getTime())) {
      return res.status(422).json({ error: 'Patient, admission reason, presenting complaint, ward/cage, and a valid admission date are required.' });
    }
    if (!['pending', 'obtained', 'declined', 'emergency'].includes(consentStatus)
      || !['Normal', 'Urgent', 'Emergency'].includes(urgencyLevel)
      || [estimatedCost, patientWeight, temperature, heartRate, respiratoryRate, estimatedAddOns, authorizedLimit].some(value => value !== null && (!Number.isFinite(value) || value < 0))) {
      return res.status(422).json({ error: 'Enter valid admission details and non-negative clinical and estimate values.' });
    }
    const pet = await db.query('SELECT id FROM pets WHERE id=$1 AND clinic_id=$2', [petId, clinicId]);
    if (!pet.rows.length) return res.status(404).json({ error: 'Patient not found in this clinic.' });
    let planId = req.body.treatment_plan_id ? Number.parseInt(req.body.treatment_plan_id, 10) : null;
    if (planId) {
      const plan = await db.query('SELECT id FROM treatment_plans WHERE id=$1 AND clinic_id=$2 AND pet_id=$3 AND archived=false', [planId, clinicId, petId]);
      if (!plan.rows.length) return res.status(422).json({ error: 'Choose an active treatment plan for this patient.' });
    }
    const doctorId = req.body.attending_veterinarian_id ? Number.parseInt(req.body.attending_veterinarian_id, 10) : null;
    if (doctorId) {
      const doctor = await db.query(
        `SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id
         WHERE u.id=$1 AND u.clinic_id=$2 AND u.is_active=true
           AND lower(replace(replace(r.name, ' ', '_'), '-', '_')) IN ('doctor','veterinarian','assistant_doctor')`,
        [doctorId, clinicId]
      );
      if (!doctor.rows.length) return res.status(422).json({ error: 'Choose a valid attending veterinarian.' });
    }
    const result = await db.query(
      `INSERT INTO clinic_inpatient_stays
        (clinic_id, pet_id, ward, admitted_at, admission_reason, initial_assessment, attending_veterinarian_id,
         treatment_plan_id, expected_discharge_at, admitted_by, consent_status, consent_notes, estimated_cost,
         urgency_level, presenting_complaint, provisional_diagnosis, patient_weight, temperature, heart_rate,
         respiratory_rate, physical_notes, known_allergies, relevant_medical_history, estimated_add_ons, authorized_limit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING id`,
      [clinicId, petId, ward, admittedAt.toISOString(), reason, String(req.body.initial_assessment || '').trim() || null,
        doctorId, planId, req.body.expected_discharge_at || null, req.user?.id || null, consentStatus,
        String(req.body.consent_notes || '').trim() || null, estimatedCost, urgencyLevel, presentingComplaint,
        String(req.body.provisional_diagnosis || '').trim() || null, patientWeight, temperature, heartRate, respiratoryRate,
        String(req.body.physical_notes || '').trim() || null, String(req.body.known_allergies || '').trim() || null,
        String(req.body.relevant_medical_history || '').trim() || null, estimatedAddOns, authorizedLimit]
    );
    return res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    return next(error);
  }
};

exports.listInpatientStays = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const result = await db.query(
      `SELECT s.id, s.pet_id, s.appointment_id, s.admitted_on, s.admitted_at, s.last_charged_on,
              s.status, s.discharged_at, s.daily_price, p.name AS pet, c.name AS owner,
              cat.name AS service_name, s.ward, s.admission_reason, s.initial_assessment,
              s.attending_veterinarian_id, vet.name AS veterinarian, s.treatment_plan_id,
              tp.title AS treatment_plan_title, tp.status AS treatment_plan_status,
              tp.steps AS treatment_plan_steps, tp.follow_up AS treatment_plan_follow_up,
              COALESCE(rx.medications, '[]'::jsonb) AS treatment_plan_medications,
              s.expected_discharge_at, s.discharge_assessment, s.home_instructions,
              s.outstanding_concerns, s.follow_up_recommendations,
              s.consent_status, s.consent_notes, s.estimated_cost, s.urgency_level, s.presenting_complaint,
              s.provisional_diagnosis, s.patient_weight, s.temperature, s.heart_rate, s.respiratory_rate,
              s.physical_notes, s.known_allergies, s.relevant_medical_history, s.estimated_add_ons, s.authorized_limit
       FROM clinic_inpatient_stays s
       JOIN pets p ON p.id=s.pet_id
       LEFT JOIN appointments a ON a.id=s.appointment_id
       LEFT JOIN clients c ON c.id=COALESCE(a.client_id, p.client_id)
       LEFT JOIN clinic_billing_catalog cat ON cat.id=s.catalog_item_id
       LEFT JOIN users vet ON vet.id=s.attending_veterinarian_id
       LEFT JOIN treatment_plans tp ON tp.id=s.treatment_plan_id AND tp.clinic_id=s.clinic_id
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(jsonb_build_object(
           'id', pr.id, 'medication', pr.medication, 'dosage', pr.dosage,
           'route', pr.route, 'frequency', pr.frequency, 'start_date', pr.start_date,
           'end_date', pr.end_date, 'instructions', pr.instructions, 'status', pr.status
         ) ORDER BY pr.issued_at DESC) AS medications
         FROM prescriptions pr
         WHERE pr.treatment_plan_id=tp.id AND pr.clinic_id=s.clinic_id
           AND COALESCE(pr.archived, false)=false
       ) rx ON true
       WHERE s.clinic_id=$1
       ORDER BY CASE WHEN s.status='active' THEN 0 ELSE 1 END, s.admitted_on DESC`,
      [clinicId]
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
};

exports.getInpatientCare = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const stayId = Number.parseInt(req.params.id, 10);
    const stay = await db.query('SELECT id FROM clinic_inpatient_stays WHERE id=$1 AND clinic_id=$2', [stayId, clinicId]);
    if (!stay.rows.length) return res.status(404).json({ error: 'Inpatient stay not found.' });
    const [observations, medications] = await Promise.all([
      db.query(`SELECT o.*, u.name AS recorded_by_name FROM clinic_inpatient_observations o
        LEFT JOIN users u ON u.id=o.recorded_by WHERE o.stay_id=$1 ORDER BY o.observed_at DESC`, [stayId]),
      db.query(`SELECT m.*, u.name AS recorded_by_name FROM clinic_inpatient_medication_administrations m
        LEFT JOIN users u ON u.id=m.recorded_by WHERE m.stay_id=$1 ORDER BY m.event_at DESC`, [stayId]),
    ]);
    return res.json({ observations: observations.rows, medications: medications.rows });
  } catch (error) {
    return next(error);
  }
};

exports.createInpatientObservation = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    if (!canManageClinicalRecords(req.user?.role)) return res.status(403).json({ error: 'Clinical staff access is required to record inpatient observations.' });
    const stayId = Number.parseInt(req.params.id, 10);
    const progress = String(req.body.clinical_progress || '').trim();
    if (!progress) return res.status(422).json({ error: 'Enter clinical progress for this observation.' });
    const validStay = await db.query("SELECT id FROM clinic_inpatient_stays WHERE id=$1 AND clinic_id=$2 AND status='active'", [stayId, clinicId]);
    if (!validStay.rows.length) return res.status(404).json({ error: 'Active inpatient stay not found.' });
    const result = await db.query(
      `INSERT INTO clinic_inpatient_observations
        (stay_id, recorded_by, observed_at, temperature, heart_rate, respiratory_rate, hydration, appetite, pain_assessment, clinical_progress)
       VALUES ($1,$2,COALESCE($3::timestamptz,now()),$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [stayId, req.user?.id || null, req.body.observed_at || null, req.body.temperature || null,
        req.body.heart_rate || null, req.body.respiratory_rate || null,
        String(req.body.hydration || '').trim() || null, String(req.body.appetite || '').trim() || null,
        String(req.body.pain_assessment || '').trim() || null, progress]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
};

exports.createInpatientMedicationAdministration = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    if (!canManageClinicalRecords(req.user?.role)) return res.status(403).json({ error: 'Clinical staff access is required to record medication events.' });
    const stayId = Number.parseInt(req.params.id, 10);
    const medication = String(req.body.medication || '').trim();
    const status = String(req.body.status || '').trim().toLowerCase();
    if (!medication || !['administered', 'missed', 'withheld', 'delayed'].includes(status)) {
      return res.status(422).json({ error: 'Medication and a valid administration status are required.' });
    }
    const validStay = await db.query("SELECT id FROM clinic_inpatient_stays WHERE id=$1 AND clinic_id=$2 AND status='active'", [stayId, clinicId]);
    if (!validStay.rows.length) return res.status(404).json({ error: 'Active inpatient stay not found.' });
    if (req.body.prescription_id) {
      const prescription = await db.query(
        `SELECT rx.id FROM prescriptions rx JOIN clinic_inpatient_stays s ON s.pet_id=rx.pet_id AND s.clinic_id=rx.clinic_id
         WHERE rx.id=$1 AND s.id=$2 AND rx.clinic_id=$3`,
        [req.body.prescription_id, stayId, clinicId]
      );
      if (!prescription.rows.length) return res.status(422).json({ error: 'Medication prescription does not belong to this patient and clinic.' });
    }
    const result = await db.query(
      `INSERT INTO clinic_inpatient_medication_administrations
        (stay_id, prescription_id, medication, dose, status, event_at, recorded_by, notes)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz,now()),$7,$8) RETURNING *`,
      [stayId, req.body.prescription_id || null, medication, String(req.body.dose || '').trim() || null,
        status, req.body.event_at || null, req.user?.id || null, String(req.body.notes || '').trim() || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
};

exports.dischargeInpatientStay = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    if (!canManageClinicalRecords(req.user?.role)) return res.status(403).json({ error: 'Clinical staff access is required to discharge a patient.' });
    const stayId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(stayId) || stayId < 1) return res.status(400).json({ error: 'Invalid inpatient stay ID.' });
    const dischargeAssessment = String(req.body.discharge_assessment || '').trim();
    const homeInstructions = String(req.body.home_instructions || '').trim();
    if (!dischargeAssessment) return res.status(422).json({ error: 'Enter a discharge assessment before discharging this patient.' });
    await exports.accrueInpatientCharges(clinicId);
    await client.query('BEGIN');
    const stay = await client.query(
      `UPDATE clinic_inpatient_stays
       SET status='discharged', discharged_at=COALESCE($3::timestamptz,now()),
           discharge_assessment=$4, home_instructions=$5,
           outstanding_concerns=$6, follow_up_recommendations=$7, updated_at=now()
       WHERE id=$1 AND clinic_id=$2 AND status='active'
       RETURNING id, status, discharged_at, discharge_assessment, home_instructions,
                 outstanding_concerns, follow_up_recommendations`,
      [stayId, clinicId, req.body.discharged_at || null, dischargeAssessment, homeInstructions || null,
        String(req.body.outstanding_concerns || '').trim() || null,
        String(req.body.follow_up_recommendations || '').trim() || null]
    );
    if (!stay.rows.length) {
      await client.query('ROLLBACK');
      const exists = await db.query('SELECT id FROM clinic_inpatient_stays WHERE id=$1 AND clinic_id=$2', [stayId, clinicId]);
      return res.status(exists.rows.length ? 409 : 404).json({
        error: exists.rows.length ? 'This inpatient stay has already been discharged.' : 'Inpatient stay not found.',
      });
    }
    await client.query('COMMIT');
    return res.json(stay.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally {
    client.release();
  }
};

exports.listInvoices = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;

    await exports.accrueInpatientCharges(clinicId);
    const result = await db.query(
      `SELECT i.id,
              i.status,
              i.currency,
              i.subtotal,
              i.tax,
              i.total,
              i.issued_at,
              i.paid_at,
              i.appointment_id,
              i.consultation_id,
              jsonb_build_object(
                'chiefComplaint', co.notes->'chiefComplaint',
                'diagnosis', co.notes->'diagnosis',
                'clinicalFindings', co.notes->'clinicalFindings',
                'treatment', co.notes->'treatment',
                'medications', co.notes->'medications',
                'vaccinations', co.notes->'vaccinations',
                'labTests', co.notes->'labTests',
                'followUpInstructions', co.notes->'followUpInstructions'
              ) AS consultation_notes,
              co.completed_at AS consultation_completed_at,
              u.name AS doctor,
              COALESCE(a.pet_id, (SELECT s.pet_id FROM clinic_inpatient_stays s WHERE s.invoice_id = i.id ORDER BY s.id DESC LIMIT 1)) AS pet_id,
              COALESCE((SELECT SUM(pay.amount) FROM payments pay WHERE pay.invoice_id = i.id), 0) AS amount_paid,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'id', ii.id, 'description', ii.description, 'unit_price', ii.unit_price,
                  'quantity', ii.quantity, 'line_total', ii.line_total, 'item_type', ii.item_type
                ) ORDER BY ii.id)
                FROM invoice_items ii WHERE ii.invoice_id=i.id
              ), '[]'::json) AS items,
              c.name AS owner,
              p.name AS pet
       FROM invoices i
       LEFT JOIN consultations co ON co.id = i.consultation_id
       LEFT JOIN users u ON u.id = co.doctor_id
       LEFT JOIN clients c ON i.client_id = c.id
       LEFT JOIN appointments a ON i.appointment_id = a.id
       LEFT JOIN pets p ON p.id = COALESCE(a.pet_id, (SELECT s.pet_id FROM clinic_inpatient_stays s WHERE s.invoice_id = i.id ORDER BY s.id DESC LIMIT 1))
       WHERE i.clinic_id = $1
       ORDER BY i.issued_at DESC`,
      [clinicId]
    );

    res.json(result.rows);
  } catch (e) {
    next(e);
  }
};

exports.listPayments = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;

    const result = await db.query(
      `SELECT pay.id,
              pay.invoice_id,
              pay.amount,
              pay.method,
              pay.reference,
              pay.paid_at,
              i.status AS invoice_status,
              c.name AS owner,
              p.name AS pet
       FROM payments pay
       LEFT JOIN invoices i ON pay.invoice_id = i.id
       LEFT JOIN appointments a ON i.appointment_id = a.id
       LEFT JOIN pets p ON a.pet_id = p.id
       LEFT JOIN clients c ON i.client_id = c.id
       WHERE pay.clinic_id = $1
       ORDER BY pay.paid_at DESC`,
      [clinicId]
    );

    res.json(result.rows);
  } catch (e) {
    next(e);
  }
};

exports.listReminders = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;

    const result = await db.query(
      `SELECT r.id,
              r.type,
              r.channel,
              r.message,
              r.scheduled_at,
              r.sent_at,
              r.delivered,
              p.name AS pet,
              c.name AS owner,
              c.email,
              c.phone
       FROM reminders r
       LEFT JOIN pets p ON r.pet_id = p.id
       LEFT JOIN clients c ON r.client_id = c.id
       WHERE r.clinic_id = $1
       ORDER BY r.scheduled_at DESC`,
      [clinicId]
    );

    res.json(result.rows);
  } catch (e) {
    next(e);
  }
};

const canShareOwnerRecords = (role) => [
  'doctor',
  'assistant_doctor',
  'veterinarian',
  'clinic_owner',
  'super_admin',
].includes(String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_'));

exports.listShareablePetRecords = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    if (!canShareOwnerRecords(req.user && req.user.role)) {
      return res.status(403).json({ error: 'Only clinical staff can prepare records to share with an owner.' });
    }

    const petName = String(req.query.pet_name || '').trim();
    const ownerEmail = String(req.query.owner_email || '').trim().toLowerCase();
    if (!petName || !ownerEmail) {
      return res.status(422).json({ error: 'Pet name and owner email are required to find the clinic record.' });
    }

    const petResult = await db.query(
      `SELECT p.id, p.name, p.metadata, c.id AS client_id, c.name AS owner, c.email
       FROM pets p
       JOIN clients c ON c.id = p.client_id AND c.clinic_id = p.clinic_id
       WHERE p.clinic_id = $1
         AND LOWER(TRIM(p.name)) = LOWER($2)
         AND LOWER(TRIM(c.email)) = LOWER($3)
         AND COALESCE((p.metadata->>'archived')::boolean, false) = false
       ORDER BY p.id`,
      [clinicId, petName, ownerEmail]
    );
    if (!petResult.rows.length) {
      return res.status(404).json({ error: 'No clinic patient matches this pet name and owner email. Verify the patient and owner records first.' });
    }
    if (petResult.rows.length > 1) {
      return res.status(409).json({ error: 'More than one clinic patient matches these details. Update the patient record so the owner can be identified unambiguously.' });
    }

    const pet = petResult.rows[0];
    const [visits, vaccinations, medications] = await Promise.all([
      db.query(
        `SELECT id, reason, status, start_time, practitioner_id
         FROM appointments
         WHERE clinic_id = $1 AND pet_id = $2 AND COALESCE(archived, false) = false
           AND status = 'completed'
         ORDER BY start_time DESC NULLS LAST, id DESC`,
        [clinicId, pet.id]
      ),
      db.query(
        `SELECT v.id, v.vaccine_name, v.date_given, v.next_due, v.dose,
                v.manufacturer, v.batch_number, v.administered_by,
                v.verified, v.verified_at, verifier.name AS verified_by_name
         FROM vaccinations v
         LEFT JOIN users verifier ON verifier.id = v.verified_by
         WHERE v.clinic_id = $1 AND v.pet_id = $2 AND COALESCE(v.archived, false) = false
         ORDER BY v.date_given DESC NULLS LAST, v.id DESC`,
        [clinicId, pet.id]
      ),
      db.query(
        `SELECT id, medication, dosage, instructions, status, issued_at
         FROM prescriptions
         WHERE clinic_id = $1 AND pet_id = $2 AND COALESCE(archived, false) = false
         ORDER BY issued_at DESC NULLS LAST, id DESC`,
        [clinicId, pet.id]
      ),
    ]);

    const vaccinationShares = new Map(
      (Array.isArray(pet.metadata?.owner_shared_records) ? pet.metadata.owner_shared_records : [])
        .flatMap(share => (Array.isArray(share.records) ? share.records : [])
          .filter(item => item.type === 'vaccine')
          .map(item => [item.id, share]))
    );
    const records = [
      ...visits.rows.map((row) => ({
        id: `visit:${row.id}`,
        type: 'visit',
        category: 'Visit',
        title: row.reason || 'Clinic visit',
        detail: `Visit · ${row.status}`,
        date: row.start_time,
      })),
      ...vaccinations.rows.map((row) => ({
        id: `vaccine:${row.id}`,
        type: 'vaccine',
        category: 'Vaccine',
        title: row.vaccine_name,
        detail: [
          'Vaccination',
          row.dose,
          row.manufacturer,
          row.batch_number ? `Lot ${row.batch_number}` : null,
          row.next_due ? `Next due ${new Date(row.next_due).toLocaleDateString()}` : null,
        ].filter(Boolean).join(' · '),
        date: row.date_given,
        clinicVerified: row.verified === true,
        verifiedBy: row.verified_by_name || null,
        verifiedAt: row.verified_at || null,
        shared: vaccinationShares.has(`vaccine:${row.id}`),
        sharedBy: vaccinationShares.get(`vaccine:${row.id}`)?.sharedBy || null,
        sharedAt: vaccinationShares.get(`vaccine:${row.id}`)?.createdAt || null,
      })),
      ...medications.rows.map((row) => ({
        id: `medication:${row.id}`,
        type: 'medication',
        category: 'Medication',
        title: row.medication,
        detail: [row.dosage, row.instructions].filter(Boolean).join(' · ') || `Prescription · ${row.status}`,
        date: row.issued_at,
      })),
    ];
    return res.json({ pet: { id: pet.id, name: pet.name, owner: pet.owner, email: pet.email }, records });
  } catch (error) {
    return next(error);
  }
};

exports.sharePetRecordsWithOwner = async (req, res, next) => {
  let client;
  try {
    client = await db.pool.connect();
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    if (!canShareOwnerRecords(req.user && req.user.role)) {
      return res.status(403).json({ error: 'Only clinical staff can share records with an owner.' });
    }

    const petId = Number.parseInt(req.body.pet_id, 10);
    const requestedRecords = Array.isArray(req.body.records) ? req.body.records : [];
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!Number.isInteger(petId) || petId < 1) return res.status(422).json({ error: 'A valid patient record is required.' });
    if (!requestedRecords.length || requestedRecords.length > 100) return res.status(422).json({ error: 'Select between 1 and 100 records to share.' });
    if (message.length > 600) return res.status(422).json({ error: 'The owner message must be 600 characters or fewer.' });

    await client.query('BEGIN');
    const petResult = await client.query(
      `SELECT p.id, p.name, p.metadata, c.name AS owner, c.email
       FROM pets p
       JOIN clients c ON c.id = p.client_id AND c.clinic_id = p.clinic_id
       WHERE p.id = $1 AND p.clinic_id = $2
         AND COALESCE((p.metadata->>'archived')::boolean, false) = false
       FOR UPDATE OF p`,
      [petId, clinicId]
    );
    if (!petResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Patient record not found in this clinic.' });
    }
    const pet = petResult.rows[0];
    if (!String(pet.email || '').trim()) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: 'Add the owner email to the clinic record before sharing records.' });
    }

    const selectedIds = [...new Set(requestedRecords.map(item => String(item && item.id || '').trim()))];
    const typedIds = { visit: [], vaccine: [], medication: [] };
    const doctorUpdates = [];
    for (const item of requestedRecords) {
      const id = String(item && item.id || '').trim();
      const separator = id.indexOf(':');
      const type = separator >= 0 ? id.slice(0, separator) : '';
      const sourceId = separator >= 0 ? Number.parseInt(id.slice(separator + 1), 10) : NaN;
      if (type === 'doctor-update' && id.startsWith('doctor-update:')) {
        const title = String(item.title || '').trim();
        const detail = String(item.detail || '').trim();
        const category = String(item.category || 'Doctor update').trim();
        if (!title || title.length > 160 || !detail || detail.length > 3000) {
          await client.query('ROLLBACK');
          return res.status(422).json({ error: 'Doctor updates need a title (up to 160 characters) and details (up to 3,000 characters).' });
        }
        doctorUpdates.push({
          id: `doctor-update:${crypto.randomUUID()}`,
          type: 'doctor-update',
          category,
          title,
          detail,
          date: new Date().toISOString(),
        });
      } else if (Object.prototype.hasOwnProperty.call(typedIds, type) && Number.isInteger(sourceId) && sourceId > 0) {
        typedIds[type].push(sourceId);
      } else {
        await client.query('ROLLBACK');
        return res.status(422).json({ error: 'One of the selected records is not valid.' });
      }
    }

    const [visits, vaccines, medications] = await Promise.all([
      typedIds.visit.length ? client.query(
        `SELECT id, reason, status, start_time
         FROM appointments
         WHERE clinic_id = $1 AND pet_id = $2 AND id = ANY($3::int[])
           AND status = 'completed' AND COALESCE(archived, false) = false`,
        [clinicId, petId, typedIds.visit]
      ) : { rows: [] },
      typedIds.vaccine.length ? client.query(
        `SELECT v.id, v.vaccine_name, v.date_given, v.next_due, v.dose,
                v.manufacturer, v.batch_number, v.verified,
                v.verified_at, verifier.name AS verified_by_name
         FROM vaccinations v
         LEFT JOIN users verifier ON verifier.id = v.verified_by
         WHERE v.clinic_id = $1 AND v.pet_id = $2 AND v.id = ANY($3::int[])
           AND COALESCE(v.archived, false) = false AND v.verified = true`,
        [clinicId, petId, typedIds.vaccine]
      ) : { rows: [] },
      typedIds.medication.length ? client.query(
        `SELECT id, medication, dosage, instructions, status, issued_at
         FROM prescriptions
         WHERE clinic_id = $1 AND pet_id = $2 AND id = ANY($3::int[])
           AND COALESCE(archived, false) = false`,
        [clinicId, petId, typedIds.medication]
      ) : { rows: [] },
    ]);
    if (visits.rows.length !== typedIds.visit.length || vaccines.rows.length !== typedIds.vaccine.length || medications.rows.length !== typedIds.medication.length) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: 'A selected record is no longer available for this patient. Refresh the list and try again.' });
    }

    const records = [
      ...visits.rows.map(row => ({ id: `visit:${row.id}`, type: 'visit', category: 'Visit', title: row.reason || 'Clinic visit', detail: `Visit · ${row.status}`, date: row.start_time })),
      ...vaccines.rows.map(row => ({
        id: `vaccine:${row.id}`,
        type: 'vaccine',
        category: 'Vaccine',
        title: row.vaccine_name,
        detail: [
          'Vaccination',
          row.dose,
          row.manufacturer,
          row.batch_number ? `Lot ${row.batch_number}` : null,
          row.next_due ? `Next due ${new Date(row.next_due).toLocaleDateString()}` : null,
        ].filter(Boolean).join(' · '),
        date: row.date_given,
        clinicVerified: true,
        verifiedBy: row.verified_by_name || null,
        verifiedAt: row.verified_at || null,
      })),
      ...medications.rows.map(row => ({ id: `medication:${row.id}`, type: 'medication', category: 'Medication', title: row.medication, detail: [row.dosage, row.instructions].filter(Boolean).join(' · ') || `Prescription · ${row.status}`, date: row.issued_at })),
      ...doctorUpdates,
    ];
    if (records.length !== selectedIds.length) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: 'Selected records must be unique.' });
    }

    const share = {
      id: `share:${crypto.randomUUID()}`,
      records,
      message,
      notificationRequested: req.body.notification_requested === true,
      createdAt: new Date().toISOString(),
      sharedBy: req.user.name || req.user.email,
    };
    const metadata = pet.metadata && typeof pet.metadata === 'object' ? pet.metadata : {};
    const previousShares = Array.isArray(metadata.owner_shared_records) ? metadata.owner_shared_records : [];
    const result = await client.query(
      `UPDATE pets
       SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('owner_shared_records', $1::jsonb),
           updated_at = now()
       WHERE id = $2 AND clinic_id = $3
       RETURNING id`,
      [JSON.stringify([...previousShares, share]), petId, clinicId]
    );
    await client.query(
      `INSERT INTO audit_trail (user_id, action, table_name, record_id, new_data, ip_address)
       VALUES ($1, 'share', 'pets', $2, $3, $4)`,
      [
        req.user.id || null,
        petId,
        JSON.stringify({
          pet: pet.name,
          owner: pet.owner,
          share_id: share.id,
          record_count: records.length,
          _audit: {
            role: req.user.role,
            recorded_at: share.createdAt,
            reason: 'Selected patient records shared to the linked owner account.',
          },
        }),
        req.ip || req.connection.remoteAddress,
      ]
    );
    await client.query('COMMIT');
    return res.status(201).json({ pet_id: result.rows[0].id, share });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Failed to roll back owner record share transaction', rollbackError);
      }
    }
    return next(error);
  } finally {
    if (client) client.release();
  }
};

exports.listOwnerSharedRecords = async (req, res, next) => {
  try {
    const ownerEmail = String(req.user && req.user.email || '').trim().toLowerCase();
    if (!ownerEmail) return res.status(403).json({ error: 'The signed-in account does not have an email address.' });

    const result = await db.query(
      `SELECT p.id AS pet_id, p.name AS pet_name, p.species, p.breed,
              c.name AS clinic_name,
              p.metadata->'owner_shared_records' AS shares
       FROM clients c
       JOIN pets p ON p.client_id = c.id AND p.clinic_id = c.clinic_id
       LEFT JOIN clinics cl ON cl.id = p.clinic_id
       WHERE LOWER(TRIM(c.email)) = $1
         AND COALESCE((p.metadata->>'archived')::boolean, false) = false
         AND jsonb_typeof(p.metadata->'owner_shared_records') = 'array'
       ORDER BY p.name ASC`,
      [ownerEmail]
    );
    const pets = result.rows.flatMap(row => {
      const shares = Array.isArray(row.shares) ? row.shares : [];
      return shares.filter(share => share && Array.isArray(share.records) && share.records.length).map(share => ({
        petId: row.pet_id,
        petName: row.pet_name,
        species: row.species,
        breed: row.breed,
        clinicName: row.clinic_name || 'Veterinary clinic',
        ...share,
      }));
    });
    return res.json(pets);
  } catch (error) {
    return next(error);
  }
};

const mapLabTest = row => {
  const metadata = row.metadata || {};
  const results = row.results && typeof row.results === 'object' ? row.results : {};
  return {
    id: `LAB-${String(row.id).padStart(3, '0')}`,
    databaseId: row.id,
    patientId: row.pet_id,
    pet: row.pet,
    owner: row.owner,
    testType: row.test_name || '',
    date: metadata.orderDateTime || row.collected_at || row.reported_at,
    laboratory: metadata.laboratory || 'In-house',
    ...metadata,
    summary: results.summary || (metadata.status === 'cancelled' ? 'Test cancelled.' : 'Awaiting laboratory result'),
    status: metadata.status || (row.reported_at ? 'results-ready' : 'ordered'),
    interpretation: results.interpretation || '',
    measurements: Array.isArray(results.measurements) ? results.measurements : [],
    reportAttachmentId: row.report_attachment_id || null,
    fileName: row.report_filename || metadata.fileName || '',
    reportContentType: row.report_content_type || '',
    downloadable: Boolean(row.report_attachment_id || metadata.downloadable),
  };
};

exports.listLabTests = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const petId = req.query.pet_id ? Number(req.query.pet_id) : null;
    if (req.query.pet_id && (!Number.isInteger(petId) || petId < 1)) return res.status(400).json({ error: 'A valid pet_id is required.' });
    const includeArchived = req.query.include_archived === 'true';
    const result = await db.query(
      `SELECT lr.id, lr.pet_id, lr.test_name, lr.results, lr.collected_at, lr.reported_at, lr.metadata,
              p.name AS pet, c.name AS owner,
              report.id AS report_attachment_id, report.filename AS report_filename,
              report.content_type AS report_content_type
       FROM lab_results lr
       JOIN pets p ON p.id = lr.pet_id AND p.clinic_id = lr.clinic_id
       LEFT JOIN clients c ON c.id = p.client_id
       LEFT JOIN LATERAL (
         SELECT a.id, a.filename, a.content_type FROM attachments a
         WHERE a.clinic_id = lr.clinic_id AND a.owner_table = 'lab_results'
           AND a.owner_id = lr.id AND a.metadata->>'source' = 'lab_result_report'
         ORDER BY a.uploaded_at DESC, a.id DESC LIMIT 1
       ) report ON true
       WHERE lr.clinic_id = $1 AND ($2::integer IS NULL OR lr.pet_id = $2)
         AND ($3::boolean OR COALESCE((lr.metadata->>'archived')::boolean, false) = false)
       ORDER BY lr.id DESC`,
      [clinicId, petId, includeArchived]
    );
    return res.json(result.rows.map(mapLabTest));
  } catch (error) { return next(error); }
};

exports.uploadLabReport = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const id = Number(String(req.params.id).replace(/^LAB-/i, ''));
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid lab test ID.' });
    const test = await db.query(
      `SELECT id, pet_id FROM lab_results WHERE id=$1 AND clinic_id=$2`, [id, clinicId]
    );
    if (!test.rows.length) return res.status(404).json({ error: 'Lab test not found.' });

    const filename = String(req.body.filename || '').trim().replace(/[\\/\r\n]/g, '_').slice(0, 255);
    const contentType = String(req.body.content_type || '').trim().toLowerCase();
    const data = String(req.body.data || '');
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const prefix = `data:${contentType};base64,`;
    if (!filename || !allowedTypes.includes(contentType) || !data.startsWith(prefix)) {
      return res.status(422).json({ error: 'Upload a PDF, JPG, or PNG laboratory report.' });
    }
    const encoded = data.slice(prefix.length);
    if (!encoded || encoded.length > 5_600_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      return res.status(413).json({ error: 'Laboratory reports must be 4 MB or smaller.' });
    }
    const bytes = Buffer.from(encoded, 'base64');
    if (!bytes.length || bytes.length > 4_194_304) return res.status(413).json({ error: 'Laboratory reports must be 4 MB or smaller.' });
    const validSignature = contentType === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-'
      : contentType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!validSignature) return res.status(422).json({ error: 'The uploaded file does not match its selected format.' });

    const existing = await db.query(
      `SELECT id FROM attachments WHERE clinic_id=$1 AND owner_table='lab_results'
       AND owner_id=$2 AND metadata->>'source'='lab_result_report'
       ORDER BY uploaded_at DESC, id DESC LIMIT 1`, [clinicId, id]
    );
    const metadata = JSON.stringify({ source: 'lab_result_report', pet_id: test.rows[0].pet_id, uploaded_by: req.user.id });
    const saved = existing.rows.length
      ? await db.query(
          `UPDATE attachments SET filename=$1, content_type=$2, url=$3, metadata=$4::jsonb, uploaded_at=now()
           WHERE id=$5 AND clinic_id=$6 RETURNING id, filename, content_type, uploaded_at`,
          [filename, contentType, data, metadata, existing.rows[0].id, clinicId]
        )
      : await db.query(
          `INSERT INTO attachments (clinic_id, owner_table, owner_id, filename, content_type, url, metadata)
           VALUES ($1, 'lab_results', $2, $3, $4, $5, $6::jsonb)
           RETURNING id, filename, content_type, uploaded_at`,
          [clinicId, id, filename, contentType, data, metadata]
        );
    await logAudit({ user_id: req.user.id, role: req.user.role, action: 'upload_report', table_name: 'lab_results', record_id: id, reason: 'Laboratory report uploaded.', ip_address: req.ip || req.connection.remoteAddress });
    return res.status(201).json({ id: saved.rows[0].id, filename: saved.rows[0].filename, content_type: saved.rows[0].content_type, uploaded_at: saved.rows[0].uploaded_at });
  } catch (error) { return next(error); }
};

exports.listPatientDocuments = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const petId = Number(req.params.id);
    if (!Number.isInteger(petId) || petId < 1) return res.status(400).json({ error: 'Invalid patient ID.' });
    const result = await db.query(
      `SELECT a.id, a.filename, a.content_type, a.uploaded_at, lr.id AS lab_test_id,
              lr.test_name, lr.collected_at, lr.reported_at,
              lr.metadata->>'requestedBy' AS requested_by,
              lr.metadata->>'collector' AS collector,
              lr.metadata->>'lastUpdatedBy' AS result_entered_by,
              COALESCE(NULLIF(lr.results->>'interpretation', ''), NULLIF(lr.metadata->>'interpretation', '')) AS interpretation,
              COALESCE(NULLIF(lr.results->>'summary', ''), NULLIF(lr.metadata->>'summary', '')) AS result_summary,
              u.name AS uploaded_by
       FROM attachments a
       JOIN lab_results lr ON lr.id=a.owner_id AND lr.clinic_id=a.clinic_id
       LEFT JOIN users u ON u.id=(a.metadata->>'uploaded_by')::integer
       WHERE a.clinic_id=$1 AND lr.pet_id=$2 AND a.owner_table='lab_results'
         AND a.metadata->>'source'='lab_result_report'
       ORDER BY a.uploaded_at DESC, a.id DESC`, [clinicId, petId]
    );
    return res.json(result.rows.map(row => ({
      id: row.id, attachmentId: row.id, title: row.filename, fileName: row.filename,
      contentType: row.content_type,
      interpretation: row.interpretation || '', resultSummary: row.result_summary || '',
      requestedBy: row.requested_by || '', collector: row.collector || '',
      resultEnteredBy: row.result_entered_by || '', collectedAt: row.collected_at || null,
      reportedAt: row.reported_at || null,
      fileType: row.content_type === 'application/pdf' ? 'PDF' : row.content_type === 'image/png' ? 'PNG' : 'JPG',
      date: row.uploaded_at,
      doctor: row.uploaded_by || 'Clinic staff', linkedTo: `Lab test ${row.lab_test_id}: ${row.test_name}`,
      status: 'Available', labTestId: `LAB-${String(row.lab_test_id).padStart(3, '0')}`,
      downloadEndpoint: `/clinic-records/attachments/${row.id}/content`,
    })));
  } catch (error) { return next(error); }
};

exports.downloadClinicAttachment = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid attachment ID.' });
    const result = await db.query(
      `SELECT filename, content_type, url FROM attachments
       WHERE id=$1 AND clinic_id=$2 AND owner_table='lab_results'
         AND metadata->>'source'='lab_result_report'`, [id, clinicId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Attachment not found.' });
    const attachment = result.rows[0];
    const prefix = `data:${attachment.content_type};base64,`;
    if (!String(attachment.url || '').startsWith(prefix)) return res.status(404).json({ error: 'Attachment content is unavailable.' });
    const filename = String(attachment.filename || 'lab-report').replace(/["\r\n]/g, '_');
    res.setHeader('Content-Type', attachment.content_type);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(Buffer.from(attachment.url.slice(prefix.length), 'base64'));
  } catch (error) { return next(error); }
};

exports.createLabTest = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const petId = Number(req.body.pet_id);
    const testName = String(req.body.testType || '').trim();
    const veterinarian = String(req.body.requestedBy || '').trim();
    if (!Number.isInteger(petId) || petId < 1 || !testName || !veterinarian) {
      return res.status(422).json({ error: 'A valid patient, test type, and ordering veterinarian are required.' });
    }
    const pet = await db.query(`SELECT id FROM pets WHERE id=$1 AND clinic_id=$2 AND COALESCE((metadata->>'archived')::boolean, false)=false`, [petId, clinicId]);
    if (!pet.rows.length) return res.status(404).json({ error: 'Patient not found in this clinic.' });
    const requestedOrderDateTime = req.body.orderDateTime ? new Date(req.body.orderDateTime) : new Date();
    if (Number.isNaN(requestedOrderDateTime.getTime())) {
      return res.status(422).json({ error: 'A valid order date and time are required.' });
    }
    const orderDateTime = requestedOrderDateTime.toISOString();
    const metadata = { ...req.body, orderDateTime, status: 'ordered', laboratory: 'In-house' };
    delete metadata.pet_id;
    delete metadata.results;
    const result = await db.query(
      `INSERT INTO lab_results (pet_id, clinic_id, test_name, results, metadata)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
       RETURNING id, pet_id, test_name, results, collected_at, reported_at, metadata`,
      [petId, clinicId, testName, JSON.stringify({ summary: 'Awaiting laboratory result', measurements: [] }), JSON.stringify(metadata)]
    );
    const joined = await db.query(`SELECT p.name AS pet, c.name AS owner FROM pets p LEFT JOIN clients c ON c.id=p.client_id WHERE p.id=$1 AND p.clinic_id=$2`, [petId, clinicId]);
    return res.status(201).json(mapLabTest({ ...result.rows[0], ...joined.rows[0] }));
  } catch (error) { return next(error); }
};

exports.updateLabTest = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const id = Number(String(req.params.id).replace(/^LAB-/i, ''));
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid lab test ID.' });
    const current = await db.query(`SELECT * FROM lab_results WHERE id=$1 AND clinic_id=$2`, [id, clinicId]);
    if (!current.rows.length) return res.status(404).json({ error: 'Lab test not found.' });
    const old = current.rows[0];
    const allowed = ['testType', 'indication', 'priority', 'sampleId', 'specimenType', 'collectionDate', 'collectionTime', 'collectionMethod', 'collector', 'notes', 'requestedBy', 'status', 'laboratory', 'summary', 'interpretation', 'measurements', 'resultDate', 'resultTime', 'lastUpdatedBy'];
    const metadata = { ...(old.metadata || {}) };
    allowed.forEach(key => { if (Object.prototype.hasOwnProperty.call(req.body, key)) metadata[key] = req.body[key]; });
    const results = { ...(old.results || {}) };
    ['summary', 'interpretation', 'measurements'].forEach(key => { if (Object.prototype.hasOwnProperty.call(req.body, key)) results[key] = req.body[key]; });
    const testName = String(req.body.testType || old.test_name || '').trim();
    const status = String(metadata.status || 'ordered').toLowerCase();
    const hasResultDate = Boolean(req.body.resultDate);
    const hasResultTime = Boolean(req.body.resultTime);
    if (hasResultDate !== hasResultTime) return res.status(422).json({ error: 'Enter both a result date and time.' });
    let resultDateTime = null;
    if (hasResultDate && hasResultTime) {
      const validResultDate = /^\d{4}-\d{2}-\d{2}$/.test(req.body.resultDate);
      const validResultTime = /^\d{2}:\d{2}$/.test(req.body.resultTime);
      const parsedResultDateTime = new Date(`${req.body.resultDate}T${req.body.resultTime}:00`);
      if (!validResultDate || !validResultTime || Number.isNaN(parsedResultDateTime.getTime())) {
       return res.status(422).json({ error: 'Enter a valid result date and time.' });
      }
      resultDateTime = `${req.body.resultDate}T${req.body.resultTime}:00`;
    }
    const updated = await db.query(
      `UPDATE lab_results SET test_name=$1, results=$2::jsonb,
         collected_at=COALESCE($3::timestamptz, collected_at),
         reported_at=CASE WHEN $4 IN ('results-ready','finalized') THEN COALESCE($8::timestamptz, reported_at, now()) ELSE reported_at END,
         metadata=$5::jsonb
       WHERE id=$6 AND clinic_id=$7
       RETURNING id, pet_id, test_name, results, collected_at, reported_at, metadata`,
      [testName, JSON.stringify(results), req.body.collectionDate && req.body.collectionTime ? `${req.body.collectionDate}T${req.body.collectionTime}:00` : null, status, JSON.stringify(metadata), id, clinicId, resultDateTime]
    );
    const joined = await db.query(`SELECT p.name AS pet, c.name AS owner FROM pets p LEFT JOIN clients c ON c.id=p.client_id WHERE p.id=$1 AND p.clinic_id=$2`, [old.pet_id, clinicId]);
    return res.json(mapLabTest({ ...updated.rows[0], ...joined.rows[0] }));
  } catch (error) { return next(error); }
};

exports.archiveLabTest = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const id = Number(String(req.params.id).replace(/^LAB-/i, ''));
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid lab test ID.' });
    if (typeof req.body.archived !== 'boolean') return res.status(400).json({ error: 'Archived must be true or false.' });

    const current = await db.query(
      `SELECT * FROM lab_results WHERE id=$1 AND clinic_id=$2`,
      [id, clinicId]
    );
    if (!current.rows.length) return res.status(404).json({ error: 'Lab test not found.' });

    const old = current.rows[0];
    const archived = req.body.archived;
    const metadata = { ...(old.metadata || {}), archived };
    const updated = await db.query(
      `UPDATE lab_results SET metadata=$1::jsonb
       WHERE id=$2 AND clinic_id=$3
       RETURNING id, pet_id, test_name, results, collected_at, reported_at, metadata`,
      [JSON.stringify(metadata), id, clinicId]
    );
    const joined = await db.query(
      `SELECT p.name AS pet, c.name AS owner
       FROM pets p LEFT JOIN clients c ON c.id=p.client_id
       WHERE p.id=$1 AND p.clinic_id=$2`,
      [old.pet_id, clinicId]
    );
    const record = mapLabTest({ ...updated.rows[0], ...joined.rows[0] });
    await logAudit({
      user_id: req.user && req.user.id ? req.user.id : null,
      role: req.user && req.user.role,
      action: archived ? 'archive' : 'restore',
      table_name: 'lab_results',
      record_id: id,
      old_data: old,
      new_data: updated.rows[0],
      reason: String(req.body.reason || '').trim() || `Lab test ${archived ? 'archived' : 'restored'}.`,
      ip_address: req.ip || req.connection.remoteAddress,
    });
    return res.json(record);
  } catch (error) { return next(error); }
};

exports.getPatientClinicalAlerts = async (req, res, next) => {
  try {
    const clinicId = requireClinicId(req, res);
    if (!clinicId) return;
    const petId = Number(req.params.id);
    if (!Number.isInteger(petId) || petId < 1) return res.status(400).json({ error: 'Invalid patient ID.' });
    const petResult = await db.query(
      `SELECT id, notes, metadata FROM pets WHERE id=$1 AND clinic_id=$2 AND COALESCE((metadata->>'archived')::boolean, false)=false`,
      [petId, clinicId]
    );
    if (!petResult.rows.length) return res.status(404).json({ error: 'Patient not found in this clinic.' });
    const pet = petResult.rows[0];
    const [prescriptions, plans, records, consultations] = await Promise.all([
      db.query(`SELECT medication, dosage, route, frequency, status, instructions FROM prescriptions WHERE clinic_id=$1 AND pet_id=$2 AND COALESCE(archived,false)=false AND LOWER(COALESCE(status,'active')) NOT IN ('completed','cancelled','discontinued','stopped') ORDER BY issued_at DESC`, [clinicId, petId]),
      db.query(`SELECT diagnosis, title, status FROM treatment_plans WHERE clinic_id=$1 AND pet_id=$2 AND LOWER(status) NOT IN ('completed','cancelled','archived') ORDER BY updated_at DESC`, [clinicId, petId]),
      db.query(`SELECT diagnosis, procedure, outcome, notes, performed_at FROM treatment_records WHERE clinic_id=$1 AND pet_id=$2 AND COALESCE(archived,false)=false ORDER BY performed_at DESC LIMIT 20`, [clinicId, petId]),
      db.query(`SELECT notes, started_at FROM consultations WHERE clinic_id=$1 AND pet_id=$2 ORDER BY started_at DESC LIMIT 20`, [clinicId, petId]),
    ]);
    const allergies = pet.metadata?.allergies || '';
    const history = [
      ...plans.rows.map(item => [item.title, item.diagnosis, item.status].filter(Boolean).join(' · ')),
      ...records.rows.map(item => [item.diagnosis, item.procedure, item.outcome, item.notes].filter(Boolean).join(' · ')),
      ...consultations.rows.map(item => {
        const notes = item.notes && typeof item.notes === 'object' ? item.notes : {};
        const content = Object.entries(notes).filter(([, value]) => typeof value === 'string' && value.trim()).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value.trim()}`);
        return content.length ? `Consultation (${new Date(item.started_at).toLocaleDateString()}): ${content.join(' · ')}` : '';
      }),
      pet.notes,
    ].filter(Boolean);
    return res.json({
      currentTreatments: prescriptions.rows.map(item => ({ name: item.medication, dosage: item.dosage, route: item.route, frequency: item.frequency, status: item.status, notes: item.instructions })),
      allergies: String(allergies).trim(),
      allergiesDocumented: Boolean(String(allergies).trim()) && !/^not recorded$/i.test(String(allergies).trim()),
      medicalHistory: [...new Set(history)],
    });
  } catch (error) { return next(error); }
};
