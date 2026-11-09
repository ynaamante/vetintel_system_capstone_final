const db = require('../config/db');
const { dateFilters } = require('../utils/dateFilters');

function scope(req, res) {
  const role = String(req.user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!['owner', 'clinic_owner', 'doctor', 'assistant_doctor', 'veterinarian', 'receptionist', 'super_admin'].includes(role)) { res.status(403).json({ error: 'Clinic staff access is required.' }); return null; }
  const id = Number(role === 'super_admin' ? req.query.clinic_id || req.user.clinic_id : req.user.clinic_id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: 'A valid clinic is required.' }); return null; }
  return id;
}
const appointmentType = alias => {
  const category = `COALESCE(NULLIF(${alias}.notes->>'service_category',''), NULLIF(${alias}.notes->>'appointment_type',''),
  CASE WHEN ${alias}.reason ~* 'vaccin|rabies' THEN 'Vaccination' WHEN ${alias}.reason ~* 'follow.?up' THEN 'Follow-up'
  WHEN ${alias}.reason ~* 'lab|blood|cbc' THEN 'Laboratory' WHEN ${alias}.reason ~* 'dental' THEN 'Dental'
  WHEN ${alias}.reason ~* 'surg' THEN 'Surgery' ELSE 'Check-up' END)`;
  return `CASE LOWER(${category}) WHEN 'consultation' THEN 'Check-up' WHEN 'inpatient' THEN 'Confinement'
    WHEN 'lab_test' THEN 'Laboratory' WHEN 'medication' THEN 'Treatment' ELSE ${category} END`;
};
const day = value => value ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)) : '';
function reminderStatus(row, now = new Date()) {
  if (row.sent_at || row.delivered) return 'completed';
  if (!row.scheduled_at || Number.isNaN(new Date(row.scheduled_at).getTime())) return 'scheduled';
  const today = day(now), due = day(row.scheduled_at);
  if (due < today) return 'overdue';
  const difference = (Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
  return difference <= 7 ? 'due-soon' : 'upcoming';
}

async function load(clinicId) {
  const [result, staff, types] = await Promise.all([
    db.query(`WITH due AS (
      SELECT r.id::text AS id, r.pet_id, r.client_id, r.appointment_id, r.type, r.channel, r.message,
        r.scheduled_at, r.sent_at, r.delivered, a.practitioner_id AS doctor_id,
        CASE WHEN a.id IS NOT NULL THEN ${appointmentType('a')} ELSE
          CASE WHEN r.type ~* 'vaccin' THEN 'Vaccination' WHEN r.type ~* 'follow' THEN 'Follow-up' ELSE COALESCE(r.type,'Other') END END AS appointment_type,
        'reminder' AS source
      FROM reminders r LEFT JOIN appointments a ON a.id=r.appointment_id AND a.clinic_id=r.clinic_id
      WHERE r.clinic_id=$1
      UNION ALL
      SELECT 'appointment:' || a.id, a.pet_id, a.client_id, a.id, 'appointment', NULL::text,
        COALESCE(a.reason, 'Scheduled appointment'), a.start_time, NULL::timestamptz, false,
        a.practitioner_id, ${appointmentType('a')}, 'appointment'
      FROM appointments a WHERE a.clinic_id=$1 AND COALESCE(a.archived,false)=false
        AND LOWER(a.status::text) NOT IN ('completed','complete','cancelled','canceled','no_show','no-show','rescheduled')
        AND NOT EXISTS (SELECT 1 FROM reminders r WHERE r.clinic_id=a.clinic_id AND r.appointment_id=a.id)
      UNION ALL
      SELECT 'vaccination:' || v.id, v.pet_id, p.client_id, v.appointment_id, 'vaccination', NULL::text,
        'Next dose due: ' || v.vaccine_name, v.next_due::timestamp AT TIME ZONE 'Asia/Manila', NULL::timestamptz, false,
        v.administered_by, 'Vaccination', 'vaccination'
      FROM vaccinations v JOIN pets p ON p.id=v.pet_id AND p.clinic_id=v.clinic_id
      WHERE v.clinic_id=$1 AND COALESCE(v.archived,false)=false AND v.next_due IS NOT NULL
        AND COALESCE(v.status,'administered') NOT IN ('scheduled','draft','cancelled','canceled')
        AND NOT EXISTS (SELECT 1 FROM vaccinations later WHERE later.clinic_id=v.clinic_id AND later.pet_id=v.pet_id
          AND later.id<>v.id AND LOWER(later.vaccine_name)=LOWER(v.vaccine_name)
          AND COALESCE(later.archived,false)=false AND COALESCE(later.status,'administered')='administered'
          AND later.date_given>=v.next_due)
        AND NOT EXISTS (SELECT 1 FROM reminders r WHERE r.clinic_id=v.clinic_id AND r.pet_id=v.pet_id
          AND r.type ~* 'vaccin' AND (r.scheduled_at AT TIME ZONE 'Asia/Manila')::date=v.next_due)
      UNION ALL
      SELECT 'plan:' || tp.id, tp.pet_id, p.client_id, NULL::integer, 'follow_up', NULL::text,
        'Treatment follow-up: ' || tp.title, tp.follow_up::timestamp AT TIME ZONE 'Asia/Manila', NULL::timestamptz, false,
        COALESCE(tp.attending_veterinarian_id,tp.issued_by), 'Follow-up', 'treatment_plan'
      FROM treatment_plans tp JOIN pets p ON p.id=tp.pet_id AND p.clinic_id=tp.clinic_id
      WHERE tp.clinic_id=$1 AND COALESCE(tp.archived,false)=false AND tp.follow_up IS NOT NULL
        AND LOWER(tp.status) NOT IN ('completed','cancelled','canceled','archived')
        AND NOT EXISTS (SELECT 1 FROM reminders r WHERE r.clinic_id=tp.clinic_id AND r.pet_id=tp.pet_id
          AND r.type ~* 'follow' AND (r.scheduled_at AT TIME ZONE 'Asia/Manila')::date=tp.follow_up)
    ) SELECT due.*, p.name AS pet, c.name AS owner, c.email, c.phone, doctor.name AS doctor,
      profile_photo.id AS pet_photo_attachment_id,
      delivery.status AS notification_status, delivery.channel AS last_reminder_channel,
      delivery.at AS last_reminder_at
    FROM due LEFT JOIN pets p ON p.id=due.pet_id AND p.clinic_id=$1
    LEFT JOIN clients c ON c.id=COALESCE(due.client_id,p.client_id) AND c.clinic_id=$1
    LEFT JOIN users doctor ON doctor.id=due.doctor_id AND doctor.clinic_id=$1
    LEFT JOIN LATERAL (SELECT status,channel,COALESCE(sent_at,created_at) AS at
      FROM clinic_reminder_deliveries WHERE clinic_id=$1 AND reminder_key=due.id
      ORDER BY created_at DESC,id DESC LIMIT 1) delivery ON true
    LEFT JOIN LATERAL (SELECT profile.id FROM attachments profile WHERE profile.clinic_id=$1
      AND profile.owner_table='pets' AND profile.owner_id=p.id
      AND (profile.metadata->>'source'='pet_profile_photo' OR profile.content_type LIKE 'image/%')
      ORDER BY profile.uploaded_at DESC, profile.id DESC LIMIT 1) profile_photo ON true
    WHERE COALESCE((p.metadata->>'archived')::boolean,false)=false
    ORDER BY due.scheduled_at DESC NULLS LAST, due.id`, [clinicId]),
    db.query(`SELECT u.id,u.name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.clinic_id=$1
      AND COALESCE(u.is_active,true) AND LOWER(regexp_replace(trim(r.name),'[[:space:]-]+','_','g')) IN ('doctor','assistant_doctor','veterinarian') ORDER BY u.name`, [clinicId]),
    db.query(`SELECT DISTINCT ${appointmentType('a')} AS appointment_type FROM appointments a WHERE a.clinic_id=$1 AND COALESCE(a.archived,false)=false
      UNION SELECT DISTINCT CASE LOWER(COALESCE(NULLIF(category,''),item_type))
        WHEN 'consultation' THEN 'Check-up' WHEN 'inpatient' THEN 'Confinement' WHEN 'lab_test' THEN 'Laboratory'
        WHEN 'medication' THEN 'Treatment' ELSE COALESCE(NULLIF(category,''),INITCAP(item_type)) END AS appointment_type
      FROM clinic_billing_catalog WHERE clinic_id=$1 AND active=true AND item_type<>'product'
        AND COALESCE(catalog_kind,'service') NOT IN ('product','inventory') AND replaced_by_source IS NULL
      ORDER BY appointment_type`, [clinicId]),
  ]);
  const rows = result.rows.map(row => ({ ...row, id: row.source === 'reminder' ? Number(row.id) : row.id, status: reminderStatus(row) }));
  const doctors = [...new Set([...staff.rows.map(row => row.name), ...rows.map(row => row.doctor)].filter(Boolean))].sort();
  const supportedTypes = ['Check-up', 'Follow-up', 'Vaccination', 'Treatment', 'Laboratory', 'Surgery', 'Dental', 'Confinement', 'Grooming', 'General'];
  const appointmentTypes = [...new Set([...supportedTypes, ...types.rows.map(row => row.appointment_type), ...rows.map(row => row.appointment_type)].filter(Boolean))].sort();
  return { rows, filters: { doctors, appointment_types: appointmentTypes } };
}

exports.list = async (req, res, next) => {
  const clinicId = scope(req, res); if (!clinicId) return;
  let from, to;
  try { ({ from, to } = dateFilters(req.query)); } catch (error) { return res.status(400).json({ error: error.message }); }
  const selectedStatus = req.query.status || 'all';
  if (!['all','overdue','due-soon','upcoming','completed','scheduled'].includes(selectedStatus)) return res.status(400).json({ error: 'Choose a valid reminder status.' });
  try {
    const { rows, filters } = await load(clinicId);
    const counts = rows.reduce((values, row) => { values.all++; values[row.status] = (values[row.status] || 0) + 1; return values; }, { all: 0, overdue: 0, 'due-soon': 0, upcoming: 0, completed: 0 });
    const query = String(req.query.search || '').trim().toLowerCase();
    const doctor = String(req.query.doctor || req.query.doctor_id || 'all');
    const type = String(req.query.appointment_type || 'all').toLowerCase();
    const reminders = rows.filter(row => (selectedStatus === 'all' || row.status === selectedStatus)
      && (doctor === 'all' || row.doctor === doctor || String(row.doctor_id) === doctor)
      && (type === 'all' || String(row.appointment_type).toLowerCase() === type)
      && (!from || row.scheduled_at && new Date(row.scheduled_at) >= new Date(from))
      && (!to || row.scheduled_at && new Date(row.scheduled_at) <= new Date(to))
      && (!query || [row.pet,row.owner,row.email,row.phone,row.doctor,row.appointment_type,row.message].some(value => String(value || '').toLowerCase().includes(query))));
    res.json(req.query.include_filters === 'true' ? { reminders, filters, counts, total: rows.length } : reminders);
  } catch (error) { next(error); }
};
exports.filters = async (req, res, next) => {
  const clinicId = scope(req, res); if (!clinicId) return;
  try { res.json((await load(clinicId)).filters); } catch (error) { next(error); }
};
exports.reminderStatus = reminderStatus;
exports.findReminder = async (clinicId, id) => (await load(clinicId)).rows.find(row => String(row.id) === String(id));
