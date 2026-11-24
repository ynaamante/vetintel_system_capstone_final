WITH clock AS (
 SELECT (now() AT TIME ZONE 'Asia/Manila')::date AS today,
 date_trunc('month',now() AT TIME ZONE 'Asia/Manila')::date AS month
), patients AS (
 SELECT p.id,p.name,p.species,p.breed,p.created_at,c.name AS owner
 FROM pets p LEFT JOIN clients c ON c.id=p.client_id AND c.clinic_id=p.clinic_id
 WHERE p.clinic_id=$1 AND NOT COALESCE((p.metadata->>'archived')::boolean,false)
), bookings AS (
 SELECT a.*,p.name AS pet,p.species,c.name AS owner,u.name AS doctor FROM appointments a
 LEFT JOIN pets p ON p.id=a.pet_id AND p.clinic_id=a.clinic_id
 LEFT JOIN clients c ON c.id=a.client_id AND c.clinic_id=a.clinic_id
 LEFT JOIN users u ON u.id=a.practitioner_id AND u.clinic_id=a.clinic_id
 WHERE a.clinic_id=$1 AND NOT COALESCE(a.archived,false)
), receipts AS (
 SELECT pay.amount,pay.paid_at FROM payments pay JOIN invoices i ON i.id=pay.invoice_id AND i.clinic_id=pay.clinic_id
 WHERE pay.clinic_id=$1 AND lower(i.status::text)<>'void' AND pay.paid_at<=now()
), months AS (
 SELECT generate_series((SELECT month FROM clock)-INTERVAL '3 months',(SELECT month FROM clock),INTERVAL '1 month')::date AS month
), revenue AS (
 SELECT m.month,to_char(m.month,'Mon') AS label,COALESCE(SUM(r.amount),0)::numeric AS revenue
 FROM months m LEFT JOIN receipts r ON date_trunc('month',r.paid_at AT TIME ZONE 'Asia/Manila')::date=m.month GROUP BY m.month ORDER BY m.month
), activity AS (
 SELECT a.id,
 CASE a.action
  WHEN 'create' THEN 'Created '||replace(a.table_name,'_',' ')
  WHEN 'update' THEN 'Updated '||replace(a.table_name,'_',' ')
  WHEN 'complete_consultation' THEN 'Completed consultation'
  WHEN 'start_consultation' THEN 'Started consultation'
  WHEN 'create_diagnosis' THEN 'Added diagnosis'
  WHEN 'update_diagnosis' THEN 'Updated diagnosis'
  WHEN 'request_restock' THEN 'Requested inventory restock'
  ELSE replace(a.action,'_',' ')
 END AS action,a.action AS action_code,a.table_name AS category,a.created_at AS timestamp,u.name AS actor,
 COALESCE(NULLIF(a.new_data #>> '{_audit,role}',''),r.name) AS actor_role
 FROM audit_trail a JOIN users u ON u.id=a.user_id JOIN roles r ON r.id=u.role_id
 WHERE NOT COALESCE(a.archived,false) AND u.clinic_id=$1
 AND regexp_replace(lower(trim(r.name)),'[-\s]+','_','g') IN ('doctor','assistant_doctor','veterinarian','receptionist')
 AND COALESCE(NULLIF(a.new_data->>'clinic_id',''),u.clinic_id::text)=$1::text
 AND COALESCE(NULLIF(a.old_data->>'clinic_id',''),u.clinic_id::text)=$1::text
 AND (a.table_name IS DISTINCT FROM 'appointments' OR NOT EXISTS (
   SELECT 1 FROM appointments other_appointment
   WHERE other_appointment.id::text=a.record_id::text AND other_appointment.clinic_id IS DISTINCT FROM $1
 ))
 ORDER BY a.created_at DESC,a.id DESC LIMIT 100
), today_bookings AS (
 SELECT id,pet,species,owner,doctor,reason,status,start_time FROM bookings
 WHERE (start_time AT TIME ZONE 'Asia/Manila')::date=(SELECT today FROM clock)
 AND lower(status::text) NOT IN ('cancelled','canceled') ORDER BY start_time LIMIT 100
), new_patients AS (
 SELECT p.*, COALESCE(submitter_role.name, creator.role) AS registered_by
 FROM (
   SELECT * FROM patients WHERE (created_at AT TIME ZONE 'Asia/Manila')::date=(SELECT today FROM clock)
   ORDER BY created_at DESC,id DESC LIMIT 100
 ) p
 LEFT JOIN LATERAL (
   SELECT i.submitted_by FROM patient_registration_intakes i
   WHERE i.clinic_id=$1 AND i.pet_id=p.id ORDER BY i.id DESC LIMIT 1
 ) intake ON true
 LEFT JOIN users submitter ON submitter.id=intake.submitted_by AND submitter.clinic_id=$1
 LEFT JOIN roles submitter_role ON submitter_role.id=submitter.role_id
 LEFT JOIN LATERAL (
   SELECT COALESCE(NULLIF(a.new_data #>> '{_audit,role}',''),r.name) AS role
   FROM audit_trail a JOIN users u ON u.id=a.user_id AND u.clinic_id=$1
   LEFT JOIN roles r ON r.id=u.role_id
   WHERE a.table_name='pets' AND a.action='create' AND a.record_id=p.id
     AND NOT COALESCE(a.archived,false)
     AND COALESCE(NULLIF(a.new_data->>'clinic_id',''),u.clinic_id::text)=$1::text
   ORDER BY a.created_at,a.id LIMIT 1
 ) creator ON true
), patient_matches AS (
 SELECT * FROM patients WHERE NULLIF($2::text,'') IS NOT NULL
 AND position(lower($2::text) IN lower(concat_ws(' ',name,species,owner)))>0 ORDER BY name LIMIT 10
)
SELECT now() AS checked_at,
 (SELECT COUNT(*)::int FROM patients) AS total_patients,
 (SELECT COUNT(*)::int FROM patients WHERE created_at>=((SELECT month FROM clock)::timestamp AT TIME ZONE 'Asia/Manila')) AS patients_this_month,
 (SELECT COUNT(*)::int FROM patients WHERE created_at>=(((SELECT month FROM clock)-INTERVAL '1 month') AT TIME ZONE 'Asia/Manila') AND created_at<((SELECT month FROM clock)::timestamp AT TIME ZONE 'Asia/Manila')) AS patients_previous_month,
 (SELECT COUNT(*)::int FROM bookings WHERE (start_time AT TIME ZONE 'Asia/Manila')::date>=(SELECT month FROM clock) AND (start_time AT TIME ZONE 'Asia/Manila')::date<(SELECT month FROM clock)+INTERVAL '1 month') AS appointments_this_month,
 (SELECT COUNT(*)::int FROM bookings WHERE (start_time AT TIME ZONE 'Asia/Manila')::date>=(SELECT month FROM clock)-INTERVAL '1 month' AND (start_time AT TIME ZONE 'Asia/Manila')::date<(SELECT month FROM clock)) AS appointments_previous_month,
 (SELECT COUNT(*)::int FROM bookings WHERE (start_time AT TIME ZONE 'Asia/Manila')::date=(SELECT today FROM clock) AND lower(status::text) NOT IN ('cancelled','canceled')) AS appointments_today,
 (SELECT COUNT(*)::int FROM patients WHERE (created_at AT TIME ZONE 'Asia/Manila')::date=(SELECT today FROM clock)) AS new_patients_today,
 COALESCE((SELECT SUM(amount) FROM receipts WHERE paid_at>=((SELECT month FROM clock)::timestamp AT TIME ZONE 'Asia/Manila')),0)::numeric AS revenue_this_month,
 (SELECT COUNT(*)::int FROM clinic_restock_requests WHERE clinic_id=$1 AND status IN ('pending','approved')) AS pending_restock_requests,
 COALESCE((SELECT json_agg(r ORDER BY r.month) FROM revenue r),'[]') AS revenue,
 COALESCE((SELECT json_agg(activity ORDER BY timestamp DESC) FROM activity),'[]') AS activity,
 COALESCE((SELECT json_agg(today_bookings ORDER BY start_time) FROM today_bookings),'[]') AS today_appointments,
 COALESCE((SELECT json_agg(new_patients ORDER BY created_at DESC) FROM new_patients),'[]') AS new_patients,
 COALESCE((SELECT json_agg(patient_matches ORDER BY name) FROM patient_matches),'[]') AS patient_matches;
