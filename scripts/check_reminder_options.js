const db = require('../config/db');
const controller = require('../controllers/reminderController');
(async () => {
  const groups = (await db.query(`SELECT u.clinic_id, r.name AS role, COALESCE(u.is_active,true) AS active, COUNT(*)::int AS count
    FROM users u JOIN roles r ON r.id=u.role_id WHERE u.clinic_id IS NOT NULL
    GROUP BY u.clinic_id,r.name,COALESCE(u.is_active,true) ORDER BY u.clinic_id,r.name`)).rows;
  console.log('Staff role counts:', JSON.stringify(groups));
  for (const clinic of [...new Set(groups.map(row => row.clinic_id))]) {
    let status = 200, body;
    await controller.filters({ user: { role:'owner',clinic_id:clinic }, query:{} }, {status(code){status=code;return this;},json(value){body=value;}}, error=>{throw error;});
    console.log(JSON.stringify({clinic,status,doctors:body?.doctors?.length,appointmentTypes:body?.appointment_types}));
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>db.pool.end());
