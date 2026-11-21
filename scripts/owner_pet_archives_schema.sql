CREATE TABLE IF NOT EXISTS owner_pet_archives (
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK(source IN ('account','clinic')),
  pet_id BIGINT NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,source,pet_id)
);
