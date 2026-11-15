WITH latest AS (
  SELECT DISTINCT ON (d.clinic_id,d.pet_id,d.surveillance_episode_id) d.*,
    MIN(d.recorded_at) OVER (PARTITION BY d.clinic_id,d.pet_id,d.surveillance_episode_id) AS episode_date
  FROM patient_diagnoses d
  ORDER BY d.clinic_id,d.pet_id,d.surveillance_episode_id,d.updated_at DESC,d.id DESC
), eligible AS (
  SELECT d.clinic_id,d.pet_id,c.name AS clinic_name,m.id AS disease_key,m.name AS disease,
    COALESCE(NULLIF(p.species,''),'Unknown') AS species,
    (d.episode_date AT TIME ZONE 'Asia/Manila')::date AS case_date,
    CASE lower(COALESCE(d.clinical_assessment->>'severity',''))
      WHEN 'critical' THEN 'Critical' WHEN 'emergency' THEN 'Critical'
      WHEN 'high' THEN 'High' WHEN 'urgent' THEN 'High'
      WHEN 'moderate' THEN 'Moderate' WHEN 'low' THEN 'Low'
      WHEN 'mild' THEN 'Low' WHEN 'normal' THEN 'Low' ELSE 'Unrated' END AS risk_level
  FROM latest d JOIN monitored_diseases m ON m.id=d.monitored_disease_id AND m.active
  JOIN public.clinics c ON c.id=d.clinic_id
  JOIN pets p ON p.id=d.pet_id AND p.clinic_id=d.clinic_id
  WHERE d.record_status='finalized' AND d.case_classification='confirmed'
    AND NOT COALESCE(c.archived,false) AND NOT COALESCE((c.metadata->>'archived')::boolean,false)
    AND lower(COALESCE(c.metadata->>'status','active'))='active'
    AND d.episode_date<=now()
    AND (d.episode_date AT TIME ZONE 'Asia/Manila')::date >= (now() AT TIME ZONE 'Asia/Manila')::date-($1::int*2-1)
    AND ($2::int IS NULL OR d.clinic_id=$2)
    AND ($3::text IS NULL OR m.id=$3 OR lower(m.name)=lower($3))
), cells AS (
  SELECT clinic_id,clinic_name,disease_key,disease,species,risk_level,
    date_trunc('month',case_date)::date AS month,
    case_date >= (now() AT TIME ZONE 'Asia/Manila')::date-($1::int-1) AS current_period,
    COUNT(*)::int AS cases, COUNT(DISTINCT pet_id)::int AS patients
  FROM eligible
  GROUP BY clinic_id,clinic_name,disease_key,disease,species,risk_level,
    date_trunc('month',case_date)::date,
    case_date >= (now() AT TIME ZONE 'Asia/Manila')::date-($1::int-1)
), released AS (
  -- Authorized origin-clinic users can already access their own clinical rows.
  -- Small groups from OTHER clinics remain suppressed in every output.
  SELECT * FROM cells WHERE clinic_id=$5::int OR (cases >= $4::int AND patients >= $4::int)
), diseases AS (
  SELECT disease_key, disease, COALESCE(SUM(cases) FILTER(WHERE current_period),0)::int AS cases,
    COALESCE(SUM(cases) FILTER(WHERE NOT current_period),0)::int AS previous_cases,
    MAX(month) AS last_reported, COUNT(DISTINCT clinic_id) FILTER(WHERE current_period)::int AS reporting_clinics,
    string_agg(DISTINCT clinic_name,', ' ORDER BY clinic_name) FILTER(WHERE current_period) AS reporting_area
  FROM released GROUP BY disease_key,disease
), clinics AS (
  SELECT clinic_id,clinic_name,SUM(cases)::int AS cases FROM released WHERE current_period GROUP BY clinic_id,clinic_name
), trend AS (
  SELECT month AS case_date,SUM(cases)::int AS cases FROM released WHERE current_period GROUP BY month
), monthly AS (
  SELECT month,disease,SUM(cases)::int AS cases FROM released WHERE current_period GROUP BY month,disease
), risks AS (
  SELECT risk_level,SUM(cases)::int AS cases FROM released WHERE current_period GROUP BY risk_level
), clinic_risks AS (
  SELECT clinic_name,
    COALESCE(SUM(cases) FILTER(WHERE risk_level='Low'),0)::int AS low,
    COALESCE(SUM(cases) FILTER(WHERE risk_level='Moderate'),0)::int AS moderate,
    COALESCE(SUM(cases) FILTER(WHERE risk_level='High'),0)::int AS high,
    COALESCE(SUM(cases) FILTER(WHERE risk_level='Critical'),0)::int AS critical
  FROM released WHERE current_period GROUP BY clinic_name
), species_counts AS (
  SELECT species,SUM(cases)::int AS cases FROM released WHERE current_period GROUP BY species
), high_risk_groups AS (
  SELECT disease,clinic_name,risk_level,month AS case_date,SUM(cases)::int AS cases
  FROM released WHERE current_period AND risk_level IN ('High','Critical')
  GROUP BY disease,clinic_name,risk_level,month
), options AS (
  SELECT id,name FROM public.clinics c WHERE NOT COALESCE(archived,false)
    AND NOT COALESCE((metadata->>'archived')::boolean,false) AND lower(COALESCE(metadata->>'status','active'))='active'
    AND EXISTS (SELECT 1 FROM pets p WHERE p.clinic_id=c.id AND NOT COALESCE((p.metadata->>'archived')::boolean,false))
), pet_totals AS (
  SELECT COUNT(*)::int AS active_pets,COUNT(*) FILTER(WHERE EXISTS(
    SELECT 1 FROM vaccinations v WHERE v.pet_id=p.id AND v.clinic_id=p.clinic_id
      AND NOT COALESCE(v.archived,false) AND lower(COALESCE(v.status,'administered'))='administered'
      AND v.next_due>=CURRENT_DATE))::int AS vaccinated
  FROM pets p WHERE p.clinic_id=$5 AND NOT COALESCE((p.metadata->>'archived')::boolean,false)
), vaccine_trend AS (
  SELECT date_trunc('month',date_given)::date AS month,COUNT(*)::int AS records FROM vaccinations
  WHERE clinic_id=$5 AND NOT COALESCE(archived,false) AND lower(COALESCE(status,'administered'))='administered'
    AND date_given>=CURRENT_DATE-INTERVAL '6 months' GROUP BY date_trunc('month',date_given)::date
)
SELECT now() AS checked_at,now() AS generated_at,
  COALESCE((SELECT json_agg(diseases ORDER BY cases DESC NULLS LAST,disease) FROM diseases),'[]') AS diseases,
  COALESCE((SELECT json_agg(clinics ORDER BY cases DESC,clinic_name) FROM clinics),'[]') AS clinics,
  COALESCE((SELECT json_agg(trend ORDER BY case_date) FROM trend),'[]') AS trend,
  COALESCE((SELECT json_agg(monthly ORDER BY month,disease) FROM monthly),'[]') AS monthly_disease_trend,
  COALESCE((SELECT json_agg(risks ORDER BY risk_level) FROM risks),'[]') AS risk_distribution,
  COALESCE((SELECT json_agg(clinic_risks ORDER BY clinic_name) FROM clinic_risks),'[]') AS risk_by_clinic,
  COALESCE((SELECT json_agg(species_counts ORDER BY species) FROM species_counts),'[]') AS species_counts,
  '[]'::json AS high_risk_cases,
  COALESCE((SELECT json_agg(high_risk_groups ORDER BY case_date,disease) FROM high_risk_groups),'[]') AS high_risk_groups,
  COALESCE((SELECT json_agg(options ORDER BY name) FROM options),'[]') AS clinic_options,
  COALESCE((SELECT json_agg(x ORDER BY disease) FROM (SELECT id AS disease_key,name AS disease FROM monitored_diseases WHERE active) x),'[]') AS disease_options,
  COALESCE((SELECT SUM(cases) FROM released WHERE current_period),0)::int AS total_cases,
  COALESCE((SELECT SUM(cases) FROM released WHERE NOT current_period),0)::int AS previous_cases,
  (SELECT COUNT(*)::int FROM clinics) AS affected_clinics,
  (SELECT COUNT(*)::int FROM options) AS active_clinics,
  COALESCE((SELECT SUM(cases) FROM released WHERE current_period AND clinic_id=$5::int),0)::int AS own_clinic_cases,
  (SELECT active_pets FROM pet_totals) AS active_pets,
  (SELECT vaccinated FROM pet_totals) AS pets_with_current_vaccine_record,
  COALESCE((SELECT json_agg(vaccine_trend ORDER BY month) FROM vaccine_trend),'[]') AS vaccination_trend;
