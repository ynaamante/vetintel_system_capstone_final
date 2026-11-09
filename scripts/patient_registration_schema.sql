CREATE TABLE IF NOT EXISTS patient_registration_intakes (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
      owner_data JSONB NOT NULL,
      pet_data JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'Needs review'
        CHECK (status IN ('Needs review', 'Waiting on reception', 'Approved', 'Rejected')),
      correction_note TEXT,
      activity JSONB NOT NULL DEFAULT '[]'::jsonb,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE patient_registration_intakes ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
    ALTER TABLE patient_registration_intakes ADD COLUMN IF NOT EXISTS pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS patient_registration_intakes_submitted_idx
      ON patient_registration_intakes (clinic_id, submitted_by, updated_at DESC);
    CREATE INDEX IF NOT EXISTS patient_registration_intakes_doctor_idx
      ON patient_registration_intakes (clinic_id, assigned_doctor_id, status, updated_at DESC);
    CREATE TABLE IF NOT EXISTS clinic_notifications (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      related_intake_id INTEGER REFERENCES patient_registration_intakes(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      read_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS clinic_notifications_recipient_idx
      ON clinic_notifications (clinic_id, recipient_user_id, created_at DESC);
  