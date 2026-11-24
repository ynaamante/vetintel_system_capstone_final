CREATE TABLE IF NOT EXISTS disease_alert_rules (
 id SERIAL PRIMARY KEY,clinic_id INTEGER NOT NULL REFERENCES clinics(id),
 disease_key TEXT NOT NULL REFERENCES monitored_diseases(id),area TEXT NOT NULL DEFAULT '*',
 interval_days INTEGER NOT NULL DEFAULT 7 CHECK(interval_days=7),
 threshold INTEGER NOT NULL CHECK(threshold>0),growth_percent INTEGER CHECK(growth_percent>0),
 active BOOLEAN NOT NULL DEFAULT true,updated_by INTEGER REFERENCES users(id),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(clinic_id,disease_key,area)
);
CREATE TABLE IF NOT EXISTS disease_monitoring_alerts (
 id SERIAL PRIMARY KEY,clinic_id INTEGER NOT NULL REFERENCES clinics(id),rule_id INTEGER NOT NULL REFERENCES disease_alert_rules(id),
 signal_key TEXT NOT NULL, snapshot JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','under_review','resolved')),
 review_notes TEXT NOT NULL DEFAULT '',reviewed_by INTEGER REFERENCES users(id),
 triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(clinic_id,signal_key)
);
ALTER TABLE disease_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE disease_monitoring_alerts ALTER COLUMN rule_id DROP NOT NULL;
ALTER TABLE disease_monitoring_alerts ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS disease_alert_deliveries (
 alert_id INTEGER NOT NULL REFERENCES disease_monitoring_alerts(id) ON DELETE CASCADE,
 clinic_id INTEGER NOT NULL REFERENCES clinics(id),
 audience TEXT NOT NULL CHECK(audience IN ('clinic','owners')),
 sent_by INTEGER NOT NULL REFERENCES users(id),
 sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(alert_id,clinic_id,audience)
);
ALTER TABLE disease_alert_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON disease_alert_deliveries FROM PUBLIC;
REVOKE ALL ON disease_alert_rules,disease_monitoring_alerts FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON disease_alert_rules,disease_monitoring_alerts,disease_alert_deliveries FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON disease_alert_rules,disease_monitoring_alerts,disease_alert_deliveries FROM authenticated; END IF;
END $$;
