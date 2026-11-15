const db = require('../config/db');
(async () => {
  try {
    const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%disease%' OR table_name ILIKE '%diagnos%' OR table_name IN ('clinics','pets')) ORDER BY table_name");
    console.log('Relevant tables:', tables.rows);
    const columns = await db.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND (table_name ILIKE '%disease%' OR table_name='patient_diagnoses') ORDER BY table_name,ordinal_position");
    console.log('Columns:', columns.rows);
    const security = await db.query("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN ('patient_diagnoses','pets','clinics')");
    console.log('RLS:', security.rows);
    console.log('Pet required columns:', (await db.query("SELECT column_name,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='pets' AND is_nullable='NO'")).rows);
    console.log('Backend role:', (await db.query("SELECT r.rolbypassrls,r.rolsuper,current_user=(SELECT tableowner FROM pg_tables WHERE schemaname='public' AND tablename='patient_diagnoses') AS owns_diagnoses FROM pg_roles r WHERE rolname=current_user")).rows);
    console.log('Connection:', { supabase: /supabase/i.test(process.env.DB_HOST || ''), directPostgres: true });
  } finally { await db.pool.end(); }
})().catch(() => { console.error('Schema inspection failed; check database connectivity.'); process.exitCode=1; });
