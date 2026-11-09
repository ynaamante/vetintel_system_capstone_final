import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const defaults=require('../data/appointmentDurationDefaults.json');
const {defaultDuration}=require('../controllers/catalogConnections.js');
const code=fs.readFileSync(new URL('../admin/src/utils/serviceDuration.js',import.meta.url),'utf8').replace(/import defaults from [^;]+;/,'const defaults='+JSON.stringify(defaults)+';');
const {parseServiceDuration,appointmentDuration}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
for(const [input,expected] of [['45 minutes',45],['1 hour 30 minutes',90],['2 hrs',120],['30',30],['',null],['overnight',null],['30 days',null],['0',null],['1441 minutes',null]])assert.equal(parseServiceDuration(input),expected,input);
for(const item of require('../data/importedServicesPricing.json').items){const duration=defaultDuration(item);assert.ok(parseServiceDuration(duration));assert.equal(appointmentDuration({duration},'General'),parseServiceDuration(duration));}
assert.equal(defaultDuration({name:'Follow-up Consultation',category:'Consultation'}),'20 minutes');
assert.equal(appointmentDuration({duration:'45 minutes'},'Surgery'),45);
assert.equal(appointmentDuration(null,'Surgery'),120);
assert.equal(appointmentDuration(null,'Vaccination'),20);
console.log('PASS: all 75 service defaults, selected service overrides type, fallback durations, hours/minutes parsing and invalid durations.');
