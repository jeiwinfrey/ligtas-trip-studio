import test from 'node:test';
import assert from 'node:assert/strict';
import {VEHICLES,vehicleCurve,passengerSeconds,arrivalFromAverage} from '../dist/vehicle.js';
import {schedule} from '../dist/scheduled.js';
for(const vehicle of Object.keys(VEHICLES))test(`${vehicle}: reproducible full curve with requested mean`,()=>{
 const settings={vehicle,average:25,seed:42,duration:1800},p=vehicleCurve(settings);
 assert.deepEqual(p,vehicleCurve(settings));assert.notDeepEqual(p,vehicleCurve({...settings,seed:43}));
 assert.equal(p.length,181);assert.equal(p[0].v,0);assert.equal(p.at(-1).v,0);
 const mean=p.slice(1).reduce((n,x,i)=>n+(x.v+p[i].v)/2*(x.u-p[i].u),0);assert.ok(Math.abs(mean-25)<1e-9);
});
test('styles differ; full day respects control limit',()=>{
 assert.notDeepEqual(vehicleCurve({vehicle:'bus',average:25,seed:42,duration:600}),vehicleCurve({vehicle:'jeepney',average:25,seed:42,duration:600}));
 assert.equal(vehicleCurve({vehicle:'bus',average:25,seed:42,duration:86400}).length,1000);
});
test('seeded passenger durations span inclusive 10–30; no general variation',()=>{
 const values=new Set();for(let seed=1;seed<500;seed++){const s=passengerSeconds(seed,'stop1');assert.equal(s,passengerSeconds(seed,'stop1'));assert.ok(s>=10&&s<=30);values.add(s);}assert.equal(values.size,21);
 const trip={departure:'2026-10-11T07:00:00',arrival:'2026-10-11T07:10:00',seed:42,speedVariation:0,stopVariation:80,profile:[{u:0,v:0},{u:.5,v:30},{u:1,v:0}]};
 const sim=schedule({coords:[[120,18],[120.01,18]],trip,stops:[{id:'p',along:100,duration:30,fixedDuration:true}]});assert.equal(sim.events[0].duration,30);assert.equal(sim.frameAt(sim.events[0].onset+10).speed,0);
});
test('arrival from average includes stop time',()=>{
 assert.equal(arrivalFromAverage(Date.parse('2026-10-11T07:00:00+08:00'),10000,30,60),'2026-10-11T07:21:00');
 assert.throws(()=>arrivalFromAverage(0,1000,0,0));
});
