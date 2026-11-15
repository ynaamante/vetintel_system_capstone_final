CREATE TABLE IF NOT EXISTS clinic_restock_requests (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),
  inventory_item_id INTEGER NOT NULL REFERENCES clinic_inventory_items(id),
  requested_by INTEGER NOT NULL REFERENCES users(id),
  quantity INTEGER NOT NULL CHECK(quantity>0),
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','fulfilled','rejected')),
  review_notes TEXT NOT NULL DEFAULT '',
  reviewed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE clinic_restock_requests ADD COLUMN IF NOT EXISTS urgency TEXT NOT NULL DEFAULT 'normal' CHECK(urgency IN ('normal','urgent'));
CREATE UNIQUE INDEX IF NOT EXISTS clinic_restock_requests_open_item_requester
 ON clinic_restock_requests(clinic_id,inventory_item_id,requested_by) WHERE status IN ('pending','approved');
ALTER TABLE clinic_restock_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clinic_restock_requests FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON clinic_restock_requests FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON clinic_restock_requests FROM authenticated; END IF;
END $$;
