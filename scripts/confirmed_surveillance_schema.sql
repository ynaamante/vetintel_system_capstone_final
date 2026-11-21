-- Additive migration. Run after patient_diagnoses_schema.sql, in one transaction.
CREATE TABLE IF NOT EXISTS monitored_diseases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO monitored_diseases(id,name,aliases) VALUES
 ('canine_parvovirus','Canine Parvoviral Enteritis',ARRAY['canine parvoviral enteritis','canine parvovirus','parvovirus','parvo']),
 ('canine_distemper','Canine Distemper',ARRAY['canine distemper','distemper']),
 ('leptospirosis','Leptospirosis',ARRAY['leptospirosis']),
 ('cirdc','Kennel Cough / CIRDC',ARRAY['kennel cough / cirdc','kennel cough','cirdc']),
 ('rabies','Rabies',ARRAY['rabies']),
 ('giardiasis','Giardiasis',ARRAY['giardiasis']),
 ('feline_panleukopenia','Feline Panleukopenia',ARRAY['feline panleukopenia'])
ON CONFLICT (id) DO NOTHING;

-- Preserve existing catalog settings; extend only the reviewed CIRDC aliases.
UPDATE monitored_diseases SET aliases=ARRAY(
  SELECT DISTINCT value FROM unnest(aliases || ARRAY[
    'canine infectious respiratory disease complex',
    'canine infectious respiratory disease complex (cirdc)',
    'kennel cough (cirdc)'
  ]) AS value ORDER BY value
) WHERE id='cirdc';

ALTER TABLE patient_diagnoses ADD COLUMN IF NOT EXISTS monitored_disease_id TEXT REFERENCES monitored_diseases(id);
ALTER TABLE patient_diagnoses ADD COLUMN IF NOT EXISTS surveillance_episode_id UUID;

-- Conservative legacy mapping: exact reviewed aliases only; never fuzzy matching.
UPDATE patient_diagnoses d SET monitored_disease_id=m.id
FROM monitored_diseases m
WHERE d.monitored_disease_id IS NULL AND lower(btrim(d.diagnosis))=ANY(m.aliases);
-- Legacy records on the same patient/disease/Manila reporting day share an episode.
UPDATE patient_diagnoses SET surveillance_episode_id=
  md5(clinic_id::text||':'||pet_id::text||':'||COALESCE(monitored_disease_id,diagnosis)||':'||
      (recorded_at AT TIME ZONE 'Asia/Manila')::date::text)::uuid
WHERE surveillance_episode_id IS NULL;
ALTER TABLE patient_diagnoses ALTER COLUMN surveillance_episode_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS patient_diagnoses_surveillance_episode_idx
  ON patient_diagnoses(clinic_id,pet_id,surveillance_episode_id,updated_at DESC,id DESC);

CREATE OR REPLACE FUNCTION assign_diagnosis_surveillance_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE matched_disease TEXT;
BEGIN
  SELECT id INTO matched_disease FROM monitored_diseases
    WHERE lower(btrim(NEW.diagnosis))=ANY(aliases);
  -- The free-text clinical workflow remains; resolve it once at the write boundary.
  -- Aggregation uses the stored foreign key, never a substring/name comparison.
  NEW.monitored_disease_id := matched_disease;
  IF TG_OP='UPDATE' THEN
    NEW.surveillance_episode_id := OLD.surveillance_episode_id;
    NEW.updated_at := clock_timestamp();
  ELSE
    IF matched_disease IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(hashtextextended(NEW.clinic_id::text||':'||NEW.pet_id::text||':'||matched_disease,0));
      SELECT CASE WHEN d.clinical_status<>'resolved' AND d.case_classification<>'ruled_out'
        THEN d.surveillance_episode_id END INTO NEW.surveillance_episode_id
      FROM (
        SELECT DISTINCT ON (x.surveillance_episode_id) x.* FROM patient_diagnoses x
        WHERE x.clinic_id=NEW.clinic_id AND x.pet_id=NEW.pet_id
        ORDER BY x.surveillance_episode_id,x.updated_at DESC,x.id DESC
      ) d
      WHERE d.monitored_disease_id=matched_disease
      ORDER BY d.updated_at DESC,d.id DESC LIMIT 1;
    END IF;
    NEW.surveillance_episode_id := COALESCE(NEW.surveillance_episode_id,gen_random_uuid());
    NEW.updated_at := clock_timestamp();
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER diagnosis_surveillance_identity
  BEFORE INSERT OR UPDATE ON patient_diagnoses
  FOR EACH ROW EXECUTE FUNCTION assign_diagnosis_surveillance_identity();

-- Custom backend authentication uses a privileged PostgreSQL connection.
-- Supabase browser roles must never read clinical rows or private linkage directly.
ALTER TABLE patient_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitored_diseases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON patient_diagnoses,monitored_diseases FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON patient_diagnoses,monitored_diseases FROM anon;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON patient_diagnoses,monitored_diseases FROM authenticated;
  END IF;
END $$;
