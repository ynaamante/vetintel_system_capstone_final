const express = require('express');
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');
const db = require('./config/db');
const userModel = require('./models/userModel');
const apiRoutes = require('./routes/api');
const clinicRecords = require('./controllers/clinicRecordController');

dotenv.config();

const app = express();
app.use(express.json({ limit: '6mb' }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const isOwnerRecordShare = req.originalUrl.includes('/clinic-records/shareable-records');
    const isPetPhotoUpload = /^\/api\/clinic-records\/pets\/\d+\/photo(?:\?|$)/.test(req.originalUrl);
    const isLabReportUpload = /^\/api\/clinic-records\/lab-tests\/[^/]+\/report(?:\?|$)/.test(req.originalUrl);
    const isClinicalConsultation = /^\/api\/clinic-records\/appointments\/\d+\/consultation(?:\?|$)/.test(req.originalUrl);
    const bodyPreview = ['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length
      ? isOwnerRecordShare || isPetPhotoUpload || isLabReportUpload || isClinicalConsultation
        ? ` body=[${isPetPhotoUpload ? 'pet photo' : isLabReportUpload ? 'lab report file' : isClinicalConsultation ? 'clinical consultation data' : 'owner record-sharing content'} omitted]`
        : ` body=${JSON.stringify(req.body)}`
      : '';
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms${bodyPreview}`);
  });
  next();
});
// Simple CORS allowing local frontends to connect. Replace with stricter policy in production.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    return res.sendStatus(204);
  }
  next();
});

function stripDatabaseCommands(sql) {
  return sql
    .replace(/^[ \t]*Database:.*$/gim, '')
    .replace(/^[ \t]*DROP\s+DATABASE[\s\S]*?;\s*/gim, '')
    .replace(/^[ \t]*CREATE\s+DATABASE[\s\S]*?;\s*/gim, '')
    .replace(/^[ \t]*\\(?:c|connect).*$/gim, '')
    .replace(/^[ \t]*USE\s+[^;]+;?/gim, '')
    .trim();
}

async function runMigrations() {
  const schemaCandidates = [
    path.join(__dirname, 'Vetinel.sql'),
    path.join(__dirname, 'Vetinel_schema.sql'),
  ];
  let schemaPath = null;
  for (const candidate of schemaCandidates) {
    try {
      await fs.access(candidate);
      schemaPath = candidate;
      break;
    } catch {
      // Try the next supported schema filename.
    }
  }
  if (!schemaPath) {
    console.log('No supported schema file found; skipping startup schema execution.');
    return;
  }
  let sql;
  try {
    sql = await fs.readFile(schemaPath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('Root schema file not found; skipping startup schema execution.');
      return;
    }
    throw e;
  }
  if (!sql.trim()) {
    console.log('Root schema file is empty; skipping startup schema execution.');
    return;
  }

  const sanitizedSql = stripDatabaseCommands(sql);
  if (sanitizedSql.trim() !== sql.trim()) {
    console.log('Stripped database bootstrap commands from startup schema; executing only schema statements against the connected database.');
  }
  if (!sanitizedSql.trim()) {
    console.log('Root schema file contains only database bootstrap commands; skipping execution.');
    return;
  }

  const existingUsersTable = await db.query("SELECT to_regclass('public.users') AS table_name");
  if (existingUsersTable.rows[0]?.table_name) {
    console.log('Database schema already exists; skipping startup schema execution.');
    return;
  }

  console.log(`Executing startup schema from ${schemaPath}`);
  await db.query(sanitizedSql);
  console.log('Startup schema execution completed successfully.');
}

async function runOptionalRoleNormalizer() {
  try {
    if (process.env.RUN_ROLE_NORMALIZER === 'true') {
      console.log('RUN_ROLE_NORMALIZER enabled — running role normalization script');
      const { execSync } = require('child_process');
      execSync('node ./scripts/normalize_roles.js', { stdio: 'inherit' });
      console.log('Role normalization completed');
    }
  } catch (e) {
    console.error('Role normalizer failed', e);
    throw e;
  }
}

async function ensureClinicOwnerColumn() {
  const result = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'clinics' AND column_name = 'owner'
  `);

  if (result.rows.length === 0) {
    await db.query('ALTER TABLE clinics ADD COLUMN owner TEXT');
    console.log('Added missing clinics.owner column');
  }
}

async function ensureRolesSchema() {
  const result = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'is_system_role'
  `);

  if (result.rows.length === 0) {
    await db.query('ALTER TABLE roles ADD COLUMN is_system_role BOOLEAN DEFAULT false');
    console.log('Added missing roles.is_system_role column');
    
    // Mark system roles
    await db.query(`
      UPDATE roles SET is_system_role = true 
      WHERE name IN ('clinic_owner', 'doctor', 'receptionist')
    `);
  }

  const duplicateRoleCheck = await db.query(`
    SELECT lower(name) AS lower_name, COUNT(*)
    FROM roles
    GROUP BY lower(name)
    HAVING COUNT(*) > 1
  `);
  if (duplicateRoleCheck.rows.length === 0) {
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS roles_lower_name_unique ON roles (lower(name))`);
    console.log('Added unique index on lower(roles.name)');
  } else {
    console.log('Skipping lower(name) unique index until duplicate role rows are cleaned up.');
  }
}

async function ensureSettingsSchema() {
  const result = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'settings'
  `);

  const columns = result.rows.map((row) => row.column_name);

  if (!columns.includes('id')) {
    await db.query('ALTER TABLE settings ADD COLUMN id INTEGER');
    await db.query('CREATE SEQUENCE IF NOT EXISTS settings_id_seq');
    await db.query("SELECT setval('settings_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM settings), 0), 1), false)");
    await db.query("UPDATE settings SET id = nextval('settings_id_seq') WHERE id IS NULL");
    await db.query('ALTER SEQUENCE settings_id_seq OWNED BY settings.id');
    await db.query("ALTER TABLE settings ALTER COLUMN id SET DEFAULT nextval('settings_id_seq')");
    await db.query('ALTER TABLE settings ALTER COLUMN id SET NOT NULL');
  }

  if (!columns.includes('clinic_id')) {
    await db.query('ALTER TABLE settings ADD COLUMN clinic_id INTEGER');
  }

  if (!columns.includes('updated_at')) {
    await db.query('ALTER TABLE settings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now()');
  }

  const pk = await db.query(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'settings' AND constraint_type = 'PRIMARY KEY'
  `);
  if (pk.rows.length === 0) {
    await db.query('ALTER TABLE settings ADD PRIMARY KEY (id)');
  }

  const fk = await db.query(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'settings' AND constraint_type = 'FOREIGN KEY'
  `);
  if (fk.rows.every((row) => row.constraint_name !== 'settings_clinic_id_fkey')) {
    await db.query('ALTER TABLE settings ADD CONSTRAINT settings_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE');
  }

  const uniqueConstraint = await db.query(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'settings' AND constraint_type = 'UNIQUE'
  `);
  if (uniqueConstraint.rows.every((row) => row.constraint_name !== 'settings_clinic_key_unique')) {
    try {
      await db.query('ALTER TABLE settings ADD CONSTRAINT settings_clinic_key_unique UNIQUE (clinic_id, key)');
    } catch (e) {
      if (e.code !== '23505') throw e;
    }
  }
}

async function ensureAnnouncementSchema() {
  const result = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'system_announcements'
  `);

  const columns = result.rows.map((row) => row.column_name);

  if (!columns.includes('target_audience')) {
    await db.query('ALTER TABLE system_announcements ADD COLUMN target_audience TEXT DEFAULT \'All\'');
  }

  if (!columns.includes('created_by')) {
    await db.query('ALTER TABLE system_announcements ADD COLUMN created_by INTEGER');
  }
}

async function ensureAuditSchema() {
  const result = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'audit_trail'
  `);

  const columns = result.rows.map((r) => r.column_name);
  if (!columns.includes('archived')) {
    await db.query("ALTER TABLE audit_trail ADD COLUMN archived BOOLEAN DEFAULT false");
    console.log('Added audit_trail.archived column');
  }
}

async function ensureClinicsSchema() {
  const result = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'clinics'
  `);

  const columns = result.rows.map((r) => r.column_name);
  if (!columns.includes('archived')) {
    await db.query("ALTER TABLE clinics ADD COLUMN archived BOOLEAN DEFAULT false");
    console.log('Added clinics.archived column');
  }
}

async function ensureClinicRecordArchiveSchema() {
  for (const tableName of ['appointments', 'vaccinations', 'prescriptions']) {
    const result = await db.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'archived'`,
      [tableName]
    );
    if (!result.rows.length) {
      await db.query(`ALTER TABLE ${tableName} ADD COLUMN archived BOOLEAN DEFAULT false`);
      console.log(`Added ${tableName}.archived column`);
    }
  }
}

async function ensureVaccinationSchema() {
  await db.query(`
    ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS manufacturer TEXT;
    ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS expiry_date DATE;
    ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS dose TEXT;
    ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS verified_by INTEGER;
    ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
    ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS verification_reason TEXT;
    ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS sticker_attachment_id INTEGER;
    ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'administered';
    ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS appointment_id INTEGER;
  `);
}

async function ensureConsultationSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS consultations (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL,
      appointment_id INTEGER NOT NULL UNIQUE,
      pet_id INTEGER,
      doctor_id INTEGER,
      status TEXT NOT NULL DEFAULT 'in_progress',
      notes JSONB NOT NULL DEFAULT '{}'::jsonb,
      owner_visible BOOLEAN NOT NULL DEFAULT false,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ,
      completed_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS consultations_clinic_status_idx
      ON consultations (clinic_id, status);
  `);
}

async function ensureBillingCatalogSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS clinic_billing_catalog (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL CHECK (item_type IN ('consultation', 'treatment', 'medication', 'vaccination', 'lab_test', 'inpatient')),
      name TEXT NOT NULL,
      description TEXT,
      unit TEXT NOT NULL DEFAULT 'item',
      duration TEXT,
      unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (clinic_id, item_type, name)
    );
    ALTER TABLE clinic_billing_catalog ADD COLUMN IF NOT EXISTS duration TEXT;
    ALTER TABLE clinic_billing_catalog ADD COLUMN IF NOT EXISTS category TEXT;
    UPDATE clinic_billing_catalog
      SET category = CASE item_type
        WHEN 'consultation' THEN 'Consultation'
        WHEN 'treatment' THEN 'Treatment'
        WHEN 'medication' THEN 'Medication'
        WHEN 'vaccination' THEN 'Vaccination'
        WHEN 'lab_test' THEN 'Laboratory'
        WHEN 'inpatient' THEN 'Confinement'
        ELSE 'General'
      END
      WHERE category IS NULL OR category = '';
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS consultation_id INTEGER REFERENCES consultations(id) ON DELETE SET NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS invoices_consultation_id_unique
      ON invoices (consultation_id) WHERE consultation_id IS NOT NULL;
    ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS catalog_item_id INTEGER REFERENCES clinic_billing_catalog(id) ON DELETE SET NULL;
    ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS item_type TEXT;
    CREATE TABLE IF NOT EXISTS clinic_inpatient_stays (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
      catalog_item_id INTEGER NOT NULL REFERENCES clinic_billing_catalog(id) ON DELETE RESTRICT,
      invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
      daily_price NUMERIC(12, 2) NOT NULL CHECK (daily_price >= 0),
      admitted_on DATE NOT NULL DEFAULT CURRENT_DATE,
      last_charged_on DATE NOT NULL DEFAULT CURRENT_DATE,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'discharged')),
      discharged_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (consultation_id, catalog_item_id)
    );
    ALTER TABLE clinic_inpatient_stays ALTER COLUMN appointment_id DROP NOT NULL;
    ALTER TABLE clinic_inpatient_stays ALTER COLUMN consultation_id DROP NOT NULL;
    ALTER TABLE clinic_inpatient_stays ALTER COLUMN catalog_item_id DROP NOT NULL;
    ALTER TABLE clinic_inpatient_stays ALTER COLUMN daily_price SET DEFAULT 0;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS ward TEXT;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS admitted_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS admission_reason TEXT;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS initial_assessment TEXT;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS attending_veterinarian_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS treatment_plan_id INTEGER REFERENCES treatment_plans(id) ON DELETE SET NULL;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS expected_discharge_at TIMESTAMPTZ;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS discharge_assessment TEXT;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS home_instructions TEXT;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS outstanding_concerns TEXT;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS follow_up_recommendations TEXT;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS consent_status TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS consent_notes TEXT;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12, 2);
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS urgency_level TEXT NOT NULL DEFAULT 'Normal';
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS presenting_complaint TEXT;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS provisional_diagnosis TEXT;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS patient_weight NUMERIC(8, 2);
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS temperature NUMERIC(5, 2);
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS heart_rate INTEGER;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS respiratory_rate INTEGER;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS physical_notes TEXT;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS known_allergies TEXT;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS relevant_medical_history TEXT;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS estimated_add_ons NUMERIC(12, 2) NOT NULL DEFAULT 0;
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS authorized_limit NUMERIC(12, 2);
    ALTER TABLE clinic_inpatient_stays ADD COLUMN IF NOT EXISTS admitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
    CREATE TABLE IF NOT EXISTS clinic_inpatient_observations (
      id SERIAL PRIMARY KEY,
      stay_id INTEGER NOT NULL REFERENCES clinic_inpatient_stays(id) ON DELETE CASCADE,
      recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      temperature NUMERIC(5,2),
      heart_rate INTEGER,
      respiratory_rate INTEGER,
      hydration TEXT,
      appetite TEXT,
      pain_assessment TEXT,
      clinical_progress TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS clinic_inpatient_observations_stay_idx
      ON clinic_inpatient_observations (stay_id, observed_at DESC);
    CREATE TABLE IF NOT EXISTS clinic_inpatient_medication_administrations (
      id SERIAL PRIMARY KEY,
      stay_id INTEGER NOT NULL REFERENCES clinic_inpatient_stays(id) ON DELETE CASCADE,
      prescription_id INTEGER REFERENCES prescriptions(id) ON DELETE SET NULL,
      medication TEXT NOT NULL,
      dose TEXT,
      status TEXT NOT NULL CHECK (status IN ('administered', 'missed', 'withheld', 'delayed')),
      event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS clinic_inpatient_medications_stay_idx
      ON clinic_inpatient_medication_administrations (stay_id, event_at DESC);
    CREATE INDEX IF NOT EXISTS clinic_inpatient_stays_due_idx
      ON clinic_inpatient_stays (status, last_charged_on);
    CREATE TABLE IF NOT EXISTS clinic_inpatient_stay_charges (
      id SERIAL PRIMARY KEY,
      stay_id INTEGER NOT NULL REFERENCES clinic_inpatient_stays(id) ON DELETE CASCADE,
      invoice_item_id INTEGER NOT NULL REFERENCES invoice_items(id) ON DELETE CASCADE,
      charge_date DATE NOT NULL,
      UNIQUE (stay_id, charge_date)
    );
  `);
}

async function ensureTreatmentPlanSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS treatment_plans (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      diagnosis TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      archived BOOLEAN NOT NULL DEFAULT false,
      severity TEXT,
      follow_up DATE,
      steps JSONB NOT NULL DEFAULT '[]'::jsonb,
      monitoring JSONB,
      notes JSONB NOT NULL DEFAULT '[]'::jsonb,
      clinical_updates JSONB NOT NULL DEFAULT '[]'::jsonb,
      issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      attending_veterinarian_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS attending_veterinarian_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS monitoring JSONB;
    ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS notes JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS clinical_updates JSONB NOT NULL DEFAULT '[]'::jsonb;
    CREATE TABLE IF NOT EXISTS treatment_records (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      treatment_plan_id INTEGER REFERENCES treatment_plans(id) ON DELETE SET NULL,
      diagnosis TEXT NOT NULL,
      procedure TEXT NOT NULL,
      outcome TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      archived BOOLEAN NOT NULL DEFAULT false,
      cost NUMERIC(10, 2),
      follow_up_instructions TEXT
    );
    ALTER TABLE treatment_records ADD COLUMN IF NOT EXISTS cost NUMERIC(10, 2);
    ALTER TABLE treatment_records ADD COLUMN IF NOT EXISTS follow_up_instructions TEXT;
    ALTER TABLE treatment_records ADD COLUMN IF NOT EXISTS treatment_plan_id INTEGER REFERENCES treatment_plans(id) ON DELETE SET NULL;
    CREATE TABLE IF NOT EXISTS treatment_record_prescriptions (
      treatment_record_id INTEGER NOT NULL REFERENCES treatment_records(id) ON DELETE CASCADE,
      prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
      administered BOOLEAN NOT NULL DEFAULT false,
      PRIMARY KEY (treatment_record_id, prescription_id)
    );
    ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS route TEXT;
    ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS frequency TEXT;
    ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS start_date DATE;
    ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS end_date DATE;
    ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS treatment_plan_id INTEGER
      REFERENCES treatment_plans(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS prescriptions_pet_clinic_idx ON prescriptions(clinic_id, pet_id, issued_at DESC);
    CREATE INDEX IF NOT EXISTS treatment_plans_pet_clinic_idx ON treatment_plans(clinic_id, pet_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS treatment_records_pet_clinic_idx ON treatment_records(clinic_id, pet_id, performed_at DESC);
  `);
}

async function ensureTransferSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS appointment_transfers (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL,
      appointment_id INTEGER NOT NULL,
      pet_id INTEGER,
      from_doctor_id INTEGER,
      to_doctor_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'routine',
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'accepted',
      created_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS appointment_transfers_appointment_idx
      ON appointment_transfers (appointment_id, created_at DESC);
  `);
}

async function ensureAppointmentWorkflowSchema() {
  await db.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'rescheduled';
      END IF;
    END $$;
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS parent_appointment_id INTEGER REFERENCES appointments(id);
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS workflow_type TEXT;
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS workflow_reason TEXT;
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS original_start_time TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS appointments_parent_workflow_idx
      ON appointments (parent_appointment_id, created_at DESC)
      WHERE parent_appointment_id IS NOT NULL;
  `);
}

// These tables back the static Super Admin surfaces. Keep this migration additive:
// IF NOT EXISTS means an existing installation (and its data) is never replaced.
async function ensureAdminSurfaceSchema() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS role_requests (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER,
        clinic_name TEXT NOT NULL,
        requested_role TEXT NOT NULL,
        requested_users INTEGER DEFAULT 1,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'Pending',
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        reviewed_by INTEGER,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price TEXT,
        staff_limit INTEGER,
        features JSONB NOT NULL DEFAULT '[]'::jsonb,
        billing_cycle TEXT NOT NULL DEFAULT 'monthly',
        active BOOLEAN NOT NULL DEFAULT true,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS demo_requests (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER,
        clinic_name TEXT NOT NULL,
        contact_name TEXT,
        phone TEXT,
        email TEXT,
        staff_count INTEGER,
        preferred_date DATE,
        preferred_time TEXT,
        address TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'New',
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        assigned_representative TEXT,
        meeting_link TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER,
        sender_name TEXT,
        sender_email TEXT,
        audience TEXT,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS message_replies (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        author_id INTEGER,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS role_requests_status_idx ON role_requests(status);
      CREATE INDEX IF NOT EXISTS demo_requests_status_idx ON demo_requests(status);
      CREATE INDEX IF NOT EXISTS messages_read_idx ON messages(is_read);
    `);
}

async function ensureUserSecuritySchema() {
  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS temporary_password_sent_at TIMESTAMPTZ;
  `);
}

async function seedSuperAdmin() {
  const adminEmail = process.env.SUPERADMIN_EMAIL;
  const adminPassword = process.env.SUPERADMIN_PASSWORD;
  const adminName = process.env.SUPERADMIN_NAME || 'Super Admin';

  if (!adminEmail || !adminPassword) {
    console.warn('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are required to seed the superadmin account. Skipping seeding.');
    return;
  }

  // Ensure the super_admin role exists before creating the account.
  let roleId = null;
  const roleResult = await db.query('SELECT id FROM roles WHERE lower(name) = lower($1) LIMIT 1', ['super_admin']);
  if (roleResult.rows.length > 0) {
    roleId = roleResult.rows[0].id;
  } else {
    const newRole = await db.query(
      'INSERT INTO roles (name, permissions) VALUES ($1, $2) RETURNING id',
      ['super_admin', JSON.stringify({ all: true })]
    );
    roleId = newRole.rows[0].id;
    console.log('Created super_admin role with id', roleId);
  }

  const existing = await db.query('SELECT id, role_id, name FROM users WHERE email = $1', [adminEmail]);
  if (existing.rows.length === 0) {
    await userModel.create({ name: adminName, email: adminEmail, password: adminPassword, role_id: roleId });
    console.log(`Created superadmin account: ${adminEmail}`);
  } else {
    const existingUser = existing.rows[0];
    if (!existingUser.role_id) {
      await db.query('UPDATE users SET role_id = $1 WHERE id = $2', [roleId, existingUser.id]);
      console.log(`Assigned super_admin role to existing superadmin account: ${adminEmail}`);
    }
    if (existingUser.name !== adminName) {
      await db.query('UPDATE users SET name = $1 WHERE id = $2', [adminName, existingUser.id]);
      console.log(`Updated superadmin name for ${adminEmail} to ${adminName}`);
    }
    console.log(`Superadmin account already exists: ${adminEmail}`);
  }
  console.log('super_admin seeding succeeded');
}

app.use('/api', apiRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const port = process.env.PORT || 3000;
(async () => {
  try {
    await runMigrations();
    await ensureClinicOwnerColumn();
    await ensureRolesSchema();
    await ensureSettingsSchema();
    await ensureAnnouncementSchema();
    await ensureAuditSchema();
    await ensureClinicsSchema();
    await ensureClinicRecordArchiveSchema();
    await ensureVaccinationSchema();
    await ensureConsultationSchema();
    await ensureBillingCatalogSchema();
    await ensureTreatmentPlanSchema();
    await ensureTransferSchema();
    await ensureAppointmentWorkflowSchema();
    await ensureAdminSurfaceSchema();
    await ensureUserSecuritySchema();
    // Optionally run a one-time normalizer to dedupe roles if explicitly requested via env var.
    await runOptionalRoleNormalizer();
    await seedSuperAdmin();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      const accrueInpatientCharges = () => clinicRecords.accrueInpatientCharges()
        .catch(error => console.error('Unable to accrue inpatient charges', error));
      accrueInpatientCharges();
      setInterval(accrueInpatientCharges, 60 * 60 * 1000);
    });
  } catch (e) {
    console.error('Failed to start server', e);
    process.exit(1);
  }
})();
