CREATE TABLE IF NOT EXISTS clinic_role_permissions (
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  permissions JSONB NOT NULL CHECK(jsonb_typeof(permissions)='object'),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(clinic_id,role_key)
);
ALTER TABLE clinic_role_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clinic_role_permissions FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON clinic_role_permissions FROM anon; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON clinic_role_permissions FROM authenticated; END IF;
END $$;
