CREATE TABLE IF NOT EXISTS pet_sharing_qr (
  id UUID PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  source_clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pet_sharing_requests (
  id UUID PRIMARY KEY,
  qr_id UUID NOT NULL REFERENCES pet_sharing_qr(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','denied','revoked')),
  request_expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '10 minutes',
  access_expires_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(qr_id,doctor_id)
);
CREATE INDEX IF NOT EXISTS pet_sharing_owner_idx ON pet_sharing_qr(owner_id,created_at DESC);
