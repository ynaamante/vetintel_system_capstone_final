const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../config/db');
const diagnoses = require('../controllers/patientDiagnosisController');
const intelligence = require('../controllers/diseaseIntelligenceController');

async function main() {
  const client = await db.pool.connect(), query = client.query.bind(client);
  const originalQuery = db.query, originalConnect = db.pool.connect, originalMinimum=process.env.SURVEILLANCE_MIN_COUNT;
  try {
    await query('BEGIN');
    for(let i=0;i<2;i++) for(const file of ['patient_diagnoses_schema.sql','confirmed_surveillance_schema.sql']) await query(fs.readFileSync(path.join(__dirname,file),'utf8'));
    process.env.SURVEILLANCE_MIN_COUNT='3';
    db.query=query;
    db.pool.connect=async()=>({release(){},query:(sql,args)=>query(sql==='BEGIN'?'SAVEPOINT diagnosis_save':sql==='COMMIT'?'RELEASE SAVEPOINT diagnosis_save':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT diagnosis_save':sql,args)});
    const vet=(await query(`SELECT u.id,u.clinic_id FROM users u JOIN roles r ON r.id=u.role_id JOIN clinics c ON c.id=u.clinic_id
      WHERE COALESCE(u.is_active,true) AND NOT COALESCE(c.archived,false) AND NOT COALESCE((c.metadata->>'archived')::boolean,false)
      AND lower(COALESCE(c.metadata->>'status','active'))='active'
      AND lower(regexp_replace(trim(r.name),'[[:space:]-]+','_','g')) IN ('doctor','assistant_doctor','veterinarian') LIMIT 1`)).rows[0];
    assert.ok(vet,'An active clinic veterinarian is required.');
    const user={id:vet.id,clinic_id:vet.clinic_id,role:'doctor'};
    const species=`Surveillance rollback fixture ${Date.now()}`;
    const pets=(await query(`INSERT INTO pets(name,species,clinic_id) VALUES ('Private fixture A',$1,$2),('Private fixture B',$1,$2),('Private fixture C',$1,$2) RETURNING id`,[species,vet.clinic_id])).rows;
    async function invoke(handler,body={},params={},filters={},actor=user) {
      let status=200,data;
      await handler({user:actor,body,params,query:filters},{status(code){status=code;return this;},json(value){data=value;return this;}},error=>{throw error;});
      return {status,data};
    }
    const get=(filters={},actor=user)=>invoke(intelligence.summary,{}, {},{clinic_id:String(vet.clinic_id),...filters},actor);
    // Cross-clinic release requires a complete fixed calendar week.
    const timestamp=(await query("SELECT now()-interval '14 days' AS time")).rows[0].time.toISOString();
    const payload={diagnosis:'Canine Parvoviral Enteritis',case_classification:'suspected',clinical_status:'ongoing',record_status:'finalized',veterinarian_id:vet.id,recorded_at:timestamp,clinical_assessment:{severity:'High'}};
    async function save(pet,body={},id) {
      const result=await invoke(diagnoses.save,{...payload,...body},{id:pet.id,diagnosisId:id});
      assert.ok([200,201].includes(result.status),JSON.stringify(result.data));return result.data;
    }
    // A network-only observer has no originating-clinic exception.
    const networkViewer={role:'super_admin'};
    const parvo=async()=> (await get({disease:'canine_parvovirus'},networkViewer)).data.total_cases;
    const giardia=async()=> (await get({disease:'giardiasis'},networkViewer)).data.total_cases;
    const baseParvo=await parvo(),baseGiardia=await giardia(),records=[];
    const baseOwnParvo=(await get({disease:'canine_parvovirus'})).data.own_clinic_cases;
    for(const pet of pets) records.push(await save(pet));
    assert.equal(await parvo(),baseParvo,'Suspected excluded');
    for(let i=0;i<3;i++) {
      records[i]=await save(pets[i],{case_classification:'confirmed'},records[i].id);
      assert.equal(await parvo(),baseParvo+(i===2?3:0),'Small groups remain suppressed until three distinct patients');
      assert.equal((await get({disease:'canine_parvovirus'})).data.own_clinic_cases,baseOwnParvo+i+1,'Origin clinic sees exact eligible counts immediately');
    }
    assert.equal(await parvo(),baseParvo+3,'Confirmed transitions publish automatically');
    const followup=await save(pets[0],{case_classification:'confirmed'});
    assert.equal(followup.surveillance_episode_id,records[0].surveillance_episode_id);
    await save(pets[0],{case_classification:'confirmed',notes:'Repeated edit'},followup.id);
    assert.equal(await parvo(),baseParvo+3,'Repeated saves/follow-ups count once');
    await save(pets[0],{case_classification:'ruled_out'},followup.id);
    assert.equal(await parvo(),baseParvo,'Withdrawal and remaining small group suppressed');
    assert.ok(!(await get({},networkViewer)).data.species_counts.some(row=>row.species===species));
    await save(pets[0],{case_classification:'confirmed',record_status:'draft'},followup.id);
    assert.equal(await parvo(),baseParvo,'Confirmed drafts excluded');
    await save(pets[0],{case_classification:'confirmed'},followup.id);
    assert.equal(await parvo(),baseParvo+3);
    for(let i=0;i<3;i++) await save(pets[i],{diagnosis:'Giardiasis',case_classification:'confirmed'},i===0?followup.id:records[i].id);
    assert.equal(await parvo(),baseParvo,'Disease change withdraws original contribution');
    assert.equal(await giardia(),baseGiardia+3,'Disease change contributes once');
    await query("UPDATE monitored_diseases SET active=false WHERE id='giardiasis'");
    assert.equal(await giardia(),0,'Inactive disease excluded');
    await query("UPDATE monitored_diseases SET active=true WHERE id='giardiasis'");
    for(const condition of ['Vaccination','Spay','Routine checkup','Non-infectious injury']) assert.equal((await save(pets[0],{diagnosis:condition,case_classification:'confirmed'})).monitored_disease_id,null);
    const baseline=(await get()).data.total_cases;
    db.query=async(sql,args)=>{if(sql.startsWith('WITH latest')) throw Object.assign(new Error('Injected read failure'),{code:'TEST_RETRY'});return query(sql,args);};
    await assert.rejects(()=>get(),/Injected read failure/); db.query=query;
    assert.equal((await get()).data.total_cases,baseline,'Retry does not duplicate contributions');
    const other=(await query("SELECT id FROM clinics WHERE id<>$1 AND NOT COALESCE(archived,false) AND NOT COALESCE((metadata->>'archived')::boolean,false) AND lower(COALESCE(metadata->>'status','active'))='active' LIMIT 1",[vet.clinic_id])).rows[0];
    assert.ok(other,'A second participating clinic is required.');
    const actor={...user,clinic_id:other.id};
    assert.equal((await get({disease:'giardiasis'},actor)).data.total_cases,baseGiardia+3);
    assert.equal((await invoke(diagnoses.list,{}, {id:pets[0].id},{},actor)).status,404);
    assert.equal((await invoke(diagnoses.save,payload,{id:pets[0].id,diagnosisId:followup.id},{},actor)).status,404);
    assert.equal((await get({}, {...user,role:'pet_owner'})).status,403);
    assert.equal((await get({days:'30junk'})).status,400);
    assert.equal((await get({clinic_id:'bad'})).status,400);
    for(const days of [30,60,90]) {
      const s=(await get({days:String(days)})).data;
      for(const rows of [s.diseases,s.clinics,s.risk_distribution,s.trend,s.monthly_disease_trend,s.species_counts]) assert.equal(s.total_cases,rows.reduce((n,r)=>n+(r.cases||0),0));
      assert.deepEqual(s.high_risk_cases,[]);
      for(const forbidden of ['pet_id','surveillance_episode_id','Private fixture','recorded_by','veterinarian_id','owner_name','case_id']) assert.ok(!JSON.stringify(s).includes(forbidden),forbidden);
    }
    const audit=(await query("SELECT count(*)::int AS count FROM audit_trail WHERE table_name='patient_diagnoses' AND record_id=$1",[followup.id])).rows[0];
    assert.ok(audit.count>=4);
    const access=(await query("SELECT has_table_privilege('anon','patient_diagnoses','SELECT') AS anon,has_table_privilege('authenticated','patient_diagnoses','SELECT') AS authenticated")).rows[0];
    assert.deepEqual(access,{anon:false,authenticated:false});
    const differentIllness=await save(pets[0],{case_classification:'confirmed'});
    assert.notEqual(differentIllness.surveillance_episode_id,followup.surveillance_episode_id,'A corrected old disease cannot reuse the superseded episode');
    assert.equal(await giardia(),baseGiardia+3,'Another illness must not overwrite the corrected episode');
    await save(pets[0],{diagnosis:'Giardiasis',case_classification:'confirmed',clinical_status:'resolved'},followup.id);
    const newEpisode=await save(pets[0],{diagnosis:'Giardiasis',case_classification:'confirmed'});
    assert.notEqual(newEpisode.surveillance_episode_id,followup.surveillance_episode_id,'New illness after resolution has a new episode');
    assert.equal(await giardia(),baseGiardia+4,'A genuinely new episode may contribute separately');
    const baseOwnCirdc=(await get({disease:'cirdc'})).data.own_clinic_cases;
    const baseNetworkCirdc=(await get({disease:'cirdc'},networkViewer)).data.total_cases;
    const cirdc=await save(pets[0],{diagnosis:'Canine Infectious Respiratory Disease Complex',case_classification:'confirmed'});
    assert.equal(cirdc.monitored_disease_id,'cirdc','Full CIRDC label resolves to the stable monitored ID');
    const localCirdc=(await get({disease:'cirdc'})).data;
    assert.equal(localCirdc.own_clinic_cases,baseOwnCirdc+1,'Single local confirmed case is visible to its authorized clinic');
    assert.equal((await get({disease:'cirdc'},networkViewer)).data.total_cases,baseNetworkCirdc,'Small groups stay hidden from other clinics');
    const connected=(await query(`SELECT COUNT(*)::int AS count FROM clinics c WHERE NOT COALESCE(c.archived,false)
      AND NOT COALESCE((c.metadata->>'archived')::boolean,false) AND lower(COALESCE(c.metadata->>'status','active'))='active'
      AND EXISTS(SELECT 1 FROM pets p WHERE p.clinic_id=c.id AND NOT COALESCE((p.metadata->>'archived')::boolean,false))`)).rows[0].count;
    assert.equal(localCirdc.active_clinics,connected,'Connected clinics count clinical data connections, not empty registrations');
    console.log('PASS: idempotent migration; real diagnosis saves; confirmed/draft/withdrawal/disease transitions; episode deduplication; routine exclusions; active disease controls; shared protected totals; cross-clinic isolation; retry safety; audit and RLS. All fixtures and schema changes rolled back.');
  } finally {
    db.query=originalQuery;db.pool.connect=originalConnect;
    if(originalMinimum===undefined) delete process.env.SURVEILLANCE_MIN_COUNT; else process.env.SURVEILLANCE_MIN_COUNT=originalMinimum;
    await query('ROLLBACK');client.release();await db.pool.end();
  }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
