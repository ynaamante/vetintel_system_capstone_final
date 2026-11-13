CREATE TABLE IF NOT EXISTS patient_diagnoses (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  diagnosis TEXT NOT NULL CHECK (length(btrim(diagnosis)) BETWEEN 1 AND 300),
  case_classification TEXT NOT NULL CHECK (case_classification IN ('suspected','probable','confirmed','ruled_out')),
  clinical_status TEXT NOT NULL CHECK (clinical_status IN ('ongoing','under_treatment','resolved')),
  veterinarian_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS patient_diagnoses_patient_date_idx ON patient_diagnoses(clinic_id,pet_id,recorded_at DESC);

ALTER TABLE patient_diagnoses ADD COLUMN IF NOT EXISTS clinical_assessment JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE patient_diagnoses ADD COLUMN IF NOT EXISTS record_status TEXT NOT NULL DEFAULT 'finalized' CHECK (record_status IN ('draft','finalized'));
