const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const db=require('../config/db'),policy=require('../utils/rolePermissions'),auth=require('../middleware/auth');
const {chromium}=require(path.join(process.argv[2],'node_modules/playwright'));
(async()=>{
 let browser;
 try{
  const users=(await db.query(`SELECT u.id,u.clinic_id,r.name AS role,(SELECT count(*) FROM pets p WHERE p.clinic_id=u.clinic_id) AS patient_count
   FROM users u JOIN roles r ON r.id=u.role_id WHERE COALESCE(u.is_active,true) AND u.clinic_id IS NOT NULL ORDER BY patient_count DESC,u.id`)).rows;
  const actor=users.find(user=>policy.profile(user.role)==='owner');assert.ok(actor);
  const token=auth.signUserToken({...actor,exp:Date.now()+300000});
  let expectedResponse;
  for(let attempt=0;attempt<30;attempt++){
   try{expectedResponse=await fetch('http://localhost:3000/api/owner-monitoring/overview',{headers:{Authorization:`Bearer ${token}`}});break;}
   catch(error){if(attempt===29)throw error;await new Promise(resolve=>setTimeout(resolve,500));}
  }
  assert.equal(expectedResponse.status,200);const expected=await expectedResponse.json();
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:430,height:932}]]){
   const context=await browser.newContext({viewport});
   await context.addInitScript(value=>localStorage.setItem('vetintel_token',value),token);
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:4179');
   await page.locator('.sidebar-nav-item').filter({hasText:'Clinic Overview'}).or(page.locator('.sidebar-nav-item[title="Clinic Overview"]')).click({force:true});
   await page.locator('.co-stats article').first().locator('strong').filter({hasText:Number(expected.total_patients).toLocaleString()}).waitFor();
   assert.equal(await page.locator('.co-stats article').count(),4);
   assert.equal(await page.locator('.co-page .co-error').count(),0);
   const request=page.waitForResponse(response=>response.url().includes('/owner-monitoring/overview')&&response.status()===200);
   await page.getByLabel('Search patients, items, or requests').fill('unlikely-test-match');await request;
   const cleared=page.waitForResponse(response=>response.url().endsWith('/owner-monitoring/overview?search=')&&response.status()===200);
   await page.getByLabel('Search patients, items, or requests').fill('');await cleared;
   await page.locator('.co-updated').waitFor();
   assert.equal(await page.getByRole('button',{name:'Manage Requests',exact:false}).count(),0);
   const requestRow=page.locator('.co-restock tbody tr[tabindex]').first();
   if(await requestRow.count()){
    await requestRow.locator('td').first().click();
    await page.getByRole('heading',{name:'Restock Request Details',exact:true}).waitFor();
    assert.equal(await page.locator('.rs-metrics>div').count(),4);
    await page.screenshot({path:path.join(__dirname,`../tmp/restock-details-${name}.png`),fullPage:true});
    await page.getByRole('button',{name:'Close dialog',exact:true}).click();
    await requestRow.focus();await page.keyboard.press('Enter');
    await page.getByRole('heading',{name:'Restock Request Details',exact:true}).waitFor();
    await page.getByRole('button',{name:'Close dialog',exact:true}).click();
   }
   await page.getByRole('button',{name:'Today’s Appointments',exact:false}).click();
   await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
   await page.getByRole('button',{name:'View All',exact:true}).click();
   await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
   await page.waitForTimeout(800);
   await page.screenshot({path:path.join(__dirname,`../tmp/owner-overview-${name}.png`),fullPage:true});
   const overflow=await page.locator('.co-page').evaluate(element=>element.scrollWidth>element.clientWidth+2);
   assert.equal(overflow,false,`${name} page must not overflow horizontally`);assert.deepEqual(errors,[]);
   console.log(`PASS ${name}: live patient total, four cards, request/activity/appointment dialogs, search, no page errors or horizontal overflow.`);
   await context.close();
  }
 }finally{if(browser)await browser.close();await db.pool.end();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
