import test from 'node:test';
import assert from 'node:assert/strict';
import {recordingEndpoints,setRecordingEndpoint,lockEndpoints,tripPoints,addTripPoint,removeTripPoint,changeTripDirection,tripCompletion,migrateProject} from '../dist/trip-model.js';
import {setEndpoint,removePoint} from '../dist/route-model.js';
const point=(id,coord,kind='waypoint')=>({id,coord,kind,name:id,duration:60});
function route(){return {id:'r',points:[point('a',[120,18]),point('b',[120.01,18])],endpoints:{home:'a',destination:'b'},endpointsLocked:false,trips:[],paths:null};}
function trip(id='t'){return {id,direction:'outbound',recordingStart:point('s-'+id,[120,18]),recordingEnd:point('e-'+id,[120.01,18]),points:[],stops:{},profile:[{u:0,v:0},{u:.5,v:36},{u:1,v:0}],path:null};}
test('route endpoints are immutable after setup',()=>{const r=route();lockEndpoints(r);assert.throws(()=>setEndpoint(r,'home',point('new',[121,18])),/fixed/);assert.throws(()=>removePoint(r,'b'),/fixed/);assert.deepEqual(r.points.map(p=>p.coord),[[120,18],[120.01,18]]);});
test('adding a trip detour or stop leaves all other trips and fixed A/B unchanged',()=>{const r=route(),first=trip('first'),second=trip('second');r.trips=[first,second];lockEndpoints(r);const before=structuredClone(second),anchors=structuredClone(r.points);addTripPoint(r,first,point('detour',[120.006,18.003]));addTripPoint(r,first,point('pause',[120.004,18],'stop'),0);assert.deepEqual(second,before);assert.deepEqual(r.points,anchors);assert.deepEqual(tripPoints(r,first).map(p=>p.id),['s-first','pause','detour','e-first']);assert.deepEqual(tripPoints(r,second).map(p=>p.id),['s-second','e-second']);});
test('removing or disabling one trip stop leaves other trips untouched',()=>{const r=route(),a=trip('first'),b=trip('second');addTripPoint(r,a,point('s',[120.004,18],'stop'));addTripPoint(r,b,point('s',[120.004,18],'stop'));a.stops.s.enabled=false;assert.deepEqual(tripPoints(r,a).map(p=>p.id),['s-first','e-first']);assert.deepEqual(tripPoints(r,b).map(p=>p.id),['s-second','s','e-second']);removeTripPoint(a,'s');assert.equal(b.points.length,1);assert.equal(b.stops.s.duration,60);});
test('direction labels do not change independently chosen recording points or detours',()=>{const r=route(),a=trip(),b=trip('other');addTripPoint(r,a,point('d1',[120.003,18]));addTripPoint(r,a,point('d2',[120.007,18]));changeTripDirection(a,'return');assert.deepEqual(tripPoints(r,a).map(p=>p.id),['s-t','d1','d2','e-t']);assert.equal(b.direction,'outbound');assert.deepEqual(r.endpoints,{home:'a',destination:'b'});assert.equal(a.path,null);});
test('trip completion identifies its own recording end in either direction',()=>{const r=route(),a=trip();a.path={coords:[[120,18],[120.01,18]],snapped:[[120,18],[120.01,18]]};assert.equal(tripCompletion(r,a).pointId,'e-t');changeTripDirection(a,'return');a.path={coords:[[120.01,18],[120,18]],snapped:[[120.01,18],[120,18]]};assert.equal(tripCompletion(r,a).pointId,'e-t');});
test('legacy shared map points become independent copies in each existing trip',()=>{const r=route(),middle=point('s',[120.005,18],'stop');r.points.splice(1,0,middle);const a=trip('a-trip'),b=trip('b-trip');a.stops.s={enabled:true,duration:90};b.stops.s={enabled:true,duration:30};delete a.points;delete b.points;r.trips=[a,b];r.paths={outbound:{coords:r.points.map(p=>p.coord),snapped:r.points.map(p=>p.coord)},return:{coords:[...r.points].reverse().map(p=>p.coord),snapped:[...r.points].reverse().map(p=>p.coord)}};const source={version:2,server:'https://router.project-osrm.org',routes:[r]},m=migrateProject(source),next=m.routes[0];assert.equal(m.version,4);assert.equal(next.points.length,2);assert.equal(next.endpointsLocked,true);assert.ok(next.trips.every(t=>t.path));next.trips[0].points[0].coord[0]=120.007;next.trips[0].stops.s.duration=200;assert.equal(next.trips[1].points[0].coord[0],120.005);assert.equal(next.trips[1].stops.s.duration,30);assert.equal(source.routes[0].points.length,3);assert.equal(next.paths,null);});

test('recording points are required and changing one trip leaves route and other trips intact',()=>{
 const r=route(),a=trip('one'),b=trip('two'),before=structuredClone(b),anchors=structuredClone(r.points);
 a.recordingStart=null;a.recordingEnd=null;assert.throws(()=>tripPoints(r,a),/recording start/);
 setRecordingEndpoint(a,'start',point('newstart',[120.002,18]));assert.throws(()=>recordingEndpoints(a,true));
 setRecordingEndpoint(a,'end',point('newend',[120.008,18]));assert.deepEqual(tripPoints(r,a).map(p=>p.coord),[[120.002,18],[120.008,18]]);
 assert.deepEqual(r.points,anchors);assert.deepEqual(b,before);assert.throws(()=>setRecordingEndpoint(a,'end',point('same',[120.002,18])),/different/);
 a.path={snapped:[[120.002,18],[120.008,18]],coords:[[120.002,18],[120.008,18]]};assert.equal(tripCompletion(r,a).pointId,'newend');
 setRecordingEndpoint(a,'end',point('changed',[120.009,18]));assert.equal(a.path,null);
});
test('v3 migration preserves old recording positions as independent trip points',()=>{
 const r=route(),a=trip('out'),b=trip('back');b.direction='return';r.trips=[a,b];delete a.recordingStart;delete a.recordingEnd;delete b.recordingStart;delete b.recordingEnd;
 const migrated=migrateProject({version:3,routes:[r]}),next=migrated.routes[0];assert.equal(migrated.version,4);
 assert.deepEqual(next.trips[0].recordingStart.coord,r.points[0].coord);assert.deepEqual(next.trips[1].recordingStart.coord,r.points[1].coord);
 next.trips[0].recordingEnd.coord[0]=121;assert.equal(next.points[1].coord[0],120.01);assert.equal(next.trips[1].recordingStart.coord[0],120.01);
});

test('GPS recording begins and finishes at trip S/E rather than route A/B',async()=>{
 const {schedule}=await import('../dist/scheduled.js');const r=route(),t=trip();
 t.recordingStart=point('s',[120.002,18]);t.recordingEnd=point('e',[120.008,18]);
 t.path={coords:[t.recordingStart.coord,t.recordingEnd.coord],snapped:[t.recordingStart.coord,t.recordingEnd.coord]};
 Object.assign(t,{departure:'2026-10-11T07:00:00',arrival:'2026-10-11T07:10:00',seed:42,speedVariation:0,stopVariation:0});
 const before=schedule({coords:t.path.coords,trip:t,completion:tripCompletion(r,t)});
 assert.deepEqual([before.rows[0].longitude,before.rows[0].latitude],t.recordingStart.coord);
 assert.deepEqual([before.rows.at(-1).longitude,before.rows.at(-1).latitude],t.recordingEnd.coord);
 assert.notDeepEqual(t.recordingEnd.coord,r.points.at(-1).coord);
 changeTripDirection(t,'return');assert.deepEqual(schedule({coords:t.path.coords,trip:t,completion:tripCompletion(r,t)}).rows,before.rows);
});
