const assert = require('node:assert/strict');
const db = require('../config/db');
const audit = require('../controllers/auditController');
async function main() {
  const client = await db.pool.connect();
  const original = db.query;
  try {
    await client.query('BEGIN');
    db.query = client.query.bind(client);
    const user = (await db.query('SELECT id,clinic_id FROM users WHERE clinic_id IS NOT NULL LIMIT 1')).rows[0];
    assert.ok(user, 'Clinic user required');
    const event = async clinic => (await db.query(`INSERT INTO audit_trail(user_id,action,table_name,new_data)
      VALUES($1,'owner_audit_test','test',$2::jsonb) RETURNING id`, [user.id,JSON.stringify({clinic_id:clinic})])).rows[0].id;
    const own = await event(user.clinic_id);
    const foreign = await event(2147483647);
    const invoke = async (query={},role='owner') => {
      let status=200,body;
      await audit.getByFilter({user:{...user,role},query},{status(value){status=value;return this;},json(value){body=value;}},error=>{throw error;});
      return {status,body};
    };
    const result = await invoke({paged:'true',days:'7',clinic_id:2147483647,action:'owner_audit_test'});
    assert.equal(result.status,200);
    assert.ok(result.body.rows.some(row=>row.id===own));
    assert.ok(!result.body.rows.some(row=>row.id===foreign));
    assert.equal((await invoke({days:'invalid'})).status,422);
    assert.equal((await invoke({before_id:'bad'})).status,422);
    assert.equal((await invoke({},'pet_owner')).status,403);
    const before = await invoke({paged:'true',before_id:String(own),action:'owner_audit_test'});
    assert.ok(before.body.rows.every(row=>Number(row.id)<Number(own)));
    assert.ok(Array.isArray((await invoke({action:'owner_audit_test'})).body));
    console.log('PASS: owner clinic isolation, spoofed clinic ignored, cursor pagination, date validation, unauthorized access and legacy response.');
  } finally { db.query=original; await client.query('ROLLBACK'); client.release(); await db.pool.end(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
