const fs=require('node:fs'),path=require('node:path'),db=require('../config/db');
const santaMariaBarangays=require('../config/santaMariaBarangays');
const source=fs.readFileSync(path.join(__dirname,'../scripts/confirmed_surveillance_summary.sql'),'utf8').split('), cells AS (')[0];
// Reuse the canonical finalized/confirmed episode selection. Release fixed weekly
// cells before applying area/search filters, so hidden counts cannot be subtracted.
const query=source+`)
 SELECT e.clinic_id,e.clinic_name,e.disease_key,e.disease,e.species,e.risk_level,
 COALESCE(NULLIF(trim(c.metadata->>'surveillance_area'),''),'Area not configured') AS area,
 to_char(date_trunc('week',e.case_date),'YYYY-MM-DD') AS week,
 count(*)::int AS cases,count(DISTINCT e.pet_id)::int AS patients
 FROM eligible e JOIN clinics c ON c.id=e.clinic_id
 GROUP BY e.clinic_id,e.clinic_name,e.disease_key,e.disease,e.species,e.risk_level,area,week`;
const day=value=>new Date(value+'T00:00:00Z');
const iso=value=>value.toISOString().slice(0,10);
const add=(value,n)=>{const d=day(value);d.setUTCDate(d.getUTCDate()+n);return iso(d);};
const monday=value=>{const d=day(value);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return iso(d);};
const sum=rows=>rows.reduce((n,r)=>n+r.cases,0);
const group=(rows,key)=>{const result=new Map();for(const row of rows){const k=key(row);if(!result.has(k))result.set(k,[]);result.get(k).push(row);}return result;};
function weeklyIncreases(cells, withheld, today) {
 const week=add(monday(today),-7), previous=add(week,-7);
 const key=row=>JSON.stringify([row.disease_key,row.area]);
 const comparable=row=>row.week===week||row.week===previous;
 const protectedGroups=new Set(withheld.filter(comparable).map(key));
 return [...group(cells.filter(row=>comparable(row)&&row.area!=='Area not configured'),key)].flatMap(([id,rows])=>{
  const observed=sum(rows.filter(row=>row.week===week));
  const baseline=sum(rows.filter(row=>row.week===previous));
  if(protectedGroups.has(id)||observed<3||observed-baseline<2||(observed-baseline)*2<baseline)return [];
  const {disease_key,disease,area}=rows[0];
  return [{disease_key,disease,area,period_start:week,period_end:add(week,6),baseline_period_start:previous,baseline_period_end:add(previous,6),
   observed_cases:observed,baseline_cases:baseline,alert_type:'Weekly Case Increase',automatic:true,
   rule_description:'Released confirmed cases rose between the two latest completed reporting weeks.'}];
 });
}
exports.weeklyIncreases=weeklyIncreases;
exports.ensureSchema=()=>db.query(fs.readFileSync(path.join(__dirname,'../scripts/disease_monitoring_schema.sql'),'utf8'));
exports.read=async(user,filters={})=>{
 const days=Number(filters.days??30);if(![30,60,90].includes(days))throw Object.assign(new Error('Choose 30, 60 or 90 days.'),{status:400});
 const isPlatform=String(user.role).toLowerCase()==='super_admin';
 const clinic=isPlatform&&!user.clinic_id?null:Number(user.clinic_id);if(!isPlatform&&(!Number.isInteger(clinic)||clinic<1))throw Object.assign(new Error('Clinic membership required.'),{status:403});
 const membership=await db.query("SELECT id FROM clinics WHERE id=$1 AND NOT COALESCE(archived,false) AND NOT COALESCE((metadata->>'archived')::boolean,false) AND lower(COALESCE(metadata->>'status','active'))='active'",[clinic]);
 if(!isPlatform&&!membership.rows.length)throw Object.assign(new Error('An active clinic is required.'),{status:403});
 const selectedClinic=filters.clinic_id==null?null:Number(filters.clinic_id);
 if(selectedClinic!==null&&(!Number.isInteger(selectedClinic)||selectedClinic<1))throw Object.assign(new Error('Invalid reporting clinic.'),{status:400});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const start=add(today,1-days),previousStart=add(start,-days),catalog=(await db.query('SELECT id AS disease_key,name AS disease FROM monitored_diseases WHERE active ORDER BY name')).rows;
 const minimum=Math.max(3,Number.parseInt(process.env.SURVEILLANCE_MIN_COUNT,10)||3);
 const raw=(await db.query(query,[days+7,selectedClinic,null])).rows;
 const current=[],previous=[],hidden=[];let withheld=false;
 for(const cell of raw){
  const own=cell.clinic_id===clinic,end=add(cell.week,6);
  // Origin users may see their own exact counts. Foreign partial/small cells
  // are withheld across totals, charts, comparisons, exports and alert rules.
  const currentPeriod=cell.week>=start&&cell.week<=today;
  const previousPeriod=cell.week>=previousStart&&end<start;
  const overlapCurrent=cell.week<=today&&end>=start;
  const overlapPrevious=cell.week<start&&end>=previousStart;
  if(!overlapCurrent&&!overlapPrevious)continue;
  const release=own||(cell.patients>=minimum&&cell.cases>=minimum&&((currentPeriod&&end<today)||previousPeriod));
  if(!release){withheld=true;hidden.push({disease_key:cell.disease_key,disease:cell.disease,area:cell.area,clinic_id:cell.clinic_id,clinic_name:cell.clinic_name,week:cell.week});continue;}
  // For origin boundary weeks, obtain exact date-sliced counts separately below.
  if(currentPeriod||own&&overlapCurrent)current.push(cell);
  else if(previousPeriod||own&&overlapPrevious)previous.push(cell);
 }
 // Replace origin buckets with precisely clipped periods, never expose dates of
 // individual cases to network recipients.
 const originSql=source+`) SELECT disease_key,disease,species,risk_level,clinic_id,clinic_name,
 to_char(date_trunc('week',case_date),'YYYY-MM-DD') AS week,
 case_date >= $4::date AS current_period,count(*)::int AS cases
 FROM eligible WHERE clinic_id=$5 AND case_date >= $6::date
 GROUP BY disease_key,disease,species,risk_level,clinic_id,clinic_name,week,current_period`;
 const origin=(await db.query(originSql,[days+7,selectedClinic,null,start,clinic,previousStart])).rows;
 const ownArea=raw.find(r=>r.clinic_id===clinic)?.area||'Area not configured';
 const originCurrent=origin.filter(r=>r.current_period).map(r=>({...r,area:ownArea})),originPrevious=origin.filter(r=>!r.current_period).map(r=>({...r,area:ownArea}));
 const releasedCurrent=[...current.filter(r=>r.clinic_id!==clinic),...originCurrent],releasedPrevious=[...previous.filter(r=>r.clinic_id!==clinic),...originPrevious];
 // Always offer all 24 barangays, including those with no cases. Preserve
 // existing unmapped/legacy areas so saved records and rules remain accessible.
 const areaOptions=[...new Set([...santaMariaBarangays,...[...releasedCurrent,...releasedPrevious,...hidden].map(r=>r.area)])].sort();
 const search=String(filters.search||'').trim().toLowerCase().slice(0,100);
 const matches=r=>(!filters.disease||r.disease_key===filters.disease||r.disease.toLowerCase()===String(filters.disease).toLowerCase())&&(!filters.area||r.area===filters.area)&&(!search||[r.disease,r.area,r.clinic_name].some(v=>v.toLowerCase().includes(search)));
 const cur=releasedCurrent.filter(matches),prev=releasedPrevious.filter(matches);
 const hiddenFiltered=hidden.filter(matches);
 withheld=hiddenFiltered.length>0;
 const clinicOptions=(await db.query("SELECT id,name,COALESCE(NULLIF(trim(metadata->>'surveillance_area'),''),'Area not configured') AS area FROM clinics c WHERE NOT COALESCE(archived,false) AND NOT COALESCE((metadata->>'archived')::boolean,false) AND lower(COALESCE(metadata->>'status','active'))='active' AND EXISTS (SELECT 1 FROM pets p WHERE p.clinic_id=c.id AND NOT COALESCE((p.metadata->>'archived')::boolean,false)) ORDER BY name")).rows;
 const clinicParticipation=clinicOptions.filter(row=>(selectedClinic===null||row.id===selectedClinic)&&(!filters.area||row.area===filters.area)).map(row=>{
  const rows=cur.filter(cell=>cell.clinic_id===row.id),protectedCurrent=hiddenFiltered.some(cell=>cell.clinic_id===row.id&&cell.week<=today&&add(cell.week,6)>=start);
  return {clinic_id:row.id,clinic_name:row.name,area:row.area,cases:protectedCurrent&&!rows.length?null:sum(rows),diseases_reported:protectedCurrent&&!rows.length?null:new Set(rows.map(cell=>cell.disease_key)).size,has_withheld:protectedCurrent};
 });
 // Aggregate only the already released cells. Hidden cells contribute flags,
 // never counts, so drill-downs and exports cannot recover protected cases.
 const caseSummaries=[...group([...cur,...prev,...hiddenFiltered],r=>JSON.stringify([r.disease_key,r.clinic_id,r.area]))].map(([,rows])=>{
  const first=rows[0],match=r=>r.disease_key===first.disease_key&&r.clinic_id===first.clinic_id&&r.area===first.area;
  const currentRows=cur.filter(match),previousRows=prev.filter(match),protectedRows=hiddenFiltered.filter(match);
  const currentHidden=protectedRows.some(r=>r.week<=today&&add(r.week,6)>=start);
  const previousHidden=protectedRows.some(r=>r.week<start&&add(r.week,6)>=previousStart);
  return {disease_key:first.disease_key,disease:first.disease,clinic_id:first.clinic_id,clinic_name:first.clinic_name,area:first.area,cases:currentHidden&&!currentRows.length?null:sum(currentRows),previous_cases:previousHidden?null:sum(previousRows),has_withheld:currentHidden||previousHidden};
 }).sort((a,b)=>(b.cases||0)-(a.cases||0)||a.disease.localeCompare(b.disease));
 const diseases=[...group([...cur,...prev],r=>r.disease_key)].map(([key,rows])=>({disease_key:key,disease:rows[0].disease,cases:sum(cur.filter(r=>r.disease_key===key)),previous_cases:sum(prev.filter(r=>r.disease_key===key)),reporting_clinics:new Set(cur.filter(r=>r.disease_key===key).map(r=>r.clinic_id)).size,reporting_area:[...new Set(cur.filter(r=>r.disease_key===key).map(r=>r.area))].join(', ')}));
 const regions=[...group([...cur,...prev],r=>r.area)].map(([area])=>{const count=sum(cur.filter(r=>r.area===area)),before=sum(prev.filter(r=>r.area===area));return {area,cases:count,previous_cases:before,trend:before===0?(count?'New activity':'—'):count>before?'Increasing':count<before?'Decreasing':'Stable'};});
 for(const area of new Set(hiddenFiltered.filter(r=>r.week<=today&&add(r.week,6)>=start).map(r=>r.area))){const row=regions.find(r=>r.area===area);if(row){row.trend='Partial data';if(!row.cases)row.cases=null;}else regions.push({area,cases:null,previous_cases:null,trend:'Suppressed'});}
 const trend=[];for(let week=monday(start);week<=today;week=add(week,7)){const from=week<start?start:week,to=add(week,6)>today?today:add(week,6),count=sum(cur.filter(r=>r.week===week)),suppressed=hiddenFiltered.some(r=>r.week===week);trend.push({case_date:from,week_start:week,period_end:to,label:`${from.slice(5)} – ${to.slice(5)}`,cases:suppressed&&!count?null:count,suppressed,partial:from!==week||to!==add(week,6)});}
 const rules=(await db.query('SELECT * FROM disease_alert_rules WHERE clinic_id=$1 AND active ORDER BY id',[clinic])).rows;
 const alerts=[];
 if(clinic){
  if(selectedClinic!==null){
   const unfiltered=await exports.read(user,{days});
   alerts.push(...unfiltered.alerts.filter(signal=>signal.automatic&&cur.some(cell=>cell.week===signal.period_start&&cell.disease_key===signal.disease_key&&cell.area===signal.area)));
  }else{
   for(const snapshot of weeklyIncreases([...releasedCurrent,...releasedPrevious],hidden,today)){
    const key='weekly-rise:'+JSON.stringify([snapshot.disease_key,snapshot.area,snapshot.period_start]);
    const [saved]=(await db.query(`INSERT INTO disease_monitoring_alerts(clinic_id,signal_key,snapshot) VALUES($1,$2,$3::jsonb)
     ON CONFLICT(clinic_id,signal_key) DO UPDATE SET snapshot=EXCLUDED.snapshot
     RETURNING id,status,review_notes,reviewed_by,triggered_at,updated_at,(SELECT name FROM users WHERE users.id=disease_monitoring_alerts.reviewed_by) AS reviewed_by_name`,[clinic,key,JSON.stringify(snapshot)])).rows;
    if(cur.some(cell=>cell.week===snapshot.period_start&&cell.disease_key===snapshot.disease_key&&cell.area===snapshot.area))alerts.push({...snapshot,...saved});
   }
  }
 }
 for(const rule of rules){
  for(const [key,rows] of group(cur.filter(r=>r.disease_key===rule.disease_key&&(rule.area==='*'||r.area===rule.area)),r=>`${r.area}|${r.week}`)){
   if(rule.area==='*'&&rules.some(s=>s.disease_key===rule.disease_key&&s.area===rows[0].area))continue;
   const row=rows[0],observed=sum(rows),baselineHidden=hidden.some(r=>r.disease_key===rule.disease_key&&r.area===row.area&&r.week===add(row.week,-7)),baseline=baselineHidden?null:sum([...releasedCurrent,...releasedPrevious].filter(r=>r.disease_key===rule.disease_key&&r.area===row.area&&r.week===add(row.week,-7)));
   if(alerts.some(signal=>signal.automatic&&signal.disease_key===row.disease_key&&signal.area===row.area&&signal.period_start===row.week))continue;
   const thresholdHit=observed>=rule.threshold,growthHit=baseline>0&&rule.growth_percent&&observed>=rule.threshold&&((observed-baseline)/baseline*100)>=rule.growth_percent;
   if(!thresholdHit&&!growthHit)continue;
   const snapshot={disease_key:rule.disease_key,disease:row.disease,area:row.area,period_start:row.week,period_end:add(row.week,6)>today?today:add(row.week,6),observed_cases:observed,baseline_cases:baseline,threshold:rule.threshold,interval_days:7,alert_type:thresholdHit&&growthHit?'Threshold and Growth Increase':growthHit?'Growth Increase':'Threshold Exceeded',severity:growthHit?'High':'Moderate',rule_description:`At least ${rule.threshold} released cases in a calendar week${rule.growth_percent?`; growth signal requires ${rule.growth_percent}% over the preceding week`:''}. Partial weeks are evaluated on cases observed so far.`};
   const signalKey=`${rule.id}:${key}`;
   const saved=(await db.query(`INSERT INTO disease_monitoring_alerts(clinic_id,rule_id,signal_key,snapshot) VALUES($1,$2,$3,$4::jsonb)
    ON CONFLICT(clinic_id,signal_key) DO UPDATE SET snapshot=EXCLUDED.snapshot RETURNING id,status,review_notes,reviewed_by,triggered_at,updated_at,(SELECT name FROM users WHERE users.id=disease_monitoring_alerts.reviewed_by) AS reviewed_by_name`,[clinic,rule.id,signalKey,JSON.stringify(snapshot)])).rows[0];
   alerts.push({...snapshot,...saved});
  }
 }
 alerts.sort((a,b)=>new Date(b.triggered_at)-new Date(a.triggered_at));
 const applicable=rules.filter(r=>r.disease_key===filters.disease&&(r.area===filters.area||r.area==='*'));
 const selectedRules=applicable.some(r=>r.area===filters.area)?applicable.filter(r=>r.area===filters.area):applicable;
 const threshold=selectedRules.length===1?selectedRules[0].threshold:null;
 const notice=`Confirmed and finalized monitored diagnoses only. Counts represent released cases. Your clinic sees its own exact counts; other clinics' calendar-week groups below ${minimum} distinct patients and partial weeks are withheld from totals, charts, comparisons, alerts and exports. Withheld data is never represented as zero.`;
 return {checked_at:new Date().toISOString(),generated_at:new Date().toISOString(),period:{start,end:today,days,previous_start:previousStart,previous_end:add(start,-1),interval:'calendar_week'},date_basis:'Diagnosis episode date (first recorded), for currently finalized and confirmed episodes',area_basis:'Approved reporting barangay assigned to the clinic; not the patient home barangay',clinic_participation:clinicParticipation,clinic_options:clinicOptions,active_clinics:clinicOptions.length,case_summaries:caseSummaries,total_cases:sum(cur),previous_cases:sum(prev),affected_clinics:new Set(cur.map(r=>r.clinic_id)).size,own_clinic_cases:sum(cur.filter(r=>r.clinic_id===clinic)),diseases,disease_options:catalog,area_options:areaOptions,regions,trend,alerts,active_alerts:alerts.filter(a=>a.status!=='resolved').length,rules,threshold:filters.disease&&filters.area?threshold:null,
 clinics:[...group(cur,r=>r.clinic_id)].map(([clinic_id,rows])=>({clinic_id,clinic_name:rows[0].clinic_name,cases:sum(rows)})),
 risk_distribution:[...group(cur,r=>r.risk_level)].map(([risk_level,rows])=>({risk_level,cases:sum(rows)})),
 species_counts:[...group(cur,r=>r.species)].map(([species,rows])=>({species,cases:sum(rows)})),
 monthly_disease_trend:trend.flatMap(t=>diseases.map(d=>({month:t.case_date,disease:d.disease,cases:t.cases===null?null:sum(cur.filter(r=>r.week===t.week_start&&r.disease_key===d.disease_key))}))),
 risk_by_clinic:[...group(cur,r=>r.clinic_id)].map(([,rows])=>({clinic_name:rows[0].clinic_name,...Object.fromEntries(['Low','Moderate','High','Critical'].map(level=>[level.toLowerCase(),sum(rows.filter(r=>r.risk_level===level))]))})),high_risk_cases:[],high_risk_groups:cur.filter(r=>['High','Critical'].includes(r.risk_level)).map(r=>({disease:r.disease,clinic_name:r.clinic_name,risk_level:r.risk_level,case_date:r.week,cases:r.cases})),
 privacy:{minimum_count:minimum,period_granularity:'calendar_week',visibility_scope:'own_clinic_and_protected_network',has_withheld:withheld,notice}};
};
