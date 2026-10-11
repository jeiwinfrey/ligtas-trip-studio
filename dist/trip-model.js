import {haversine} from './engine.js';
import {endpoints,initializeEndpoints,directionFolder} from './route-model.js';

export function lockEndpoints(route){endpoints(route,true);route.endpointsLocked=true;}
export function recordingEndpoints(trip,required=false){
  const start=trip.recordingStart||null,end=trip.recordingEnd||null;
  if(required&&(!start||!end))throw Error('Set this trip’s recording start and recording end on the map.');
  if(start&&end&&haversine(start.coord,end.coord)<1)throw Error('Recording start and end must be different places.');
  return {start,end};
}
export function setRecordingEndpoint(trip,which,point){
  if(!['start','end'].includes(which))throw Error('Choose recording start or end.');
  const key=which==='start'?'recordingStart':'recordingEnd',other=which==='start'?trip.recordingEnd:trip.recordingStart;
  if(other&&haversine(point.coord,other.coord)<1)throw Error('Recording start and end must be different places.');
  trip[key]=structuredClone(point);trip.path=null;
}
export function tripPoints(route,trip){
  endpoints(route,true);directionFolder(trip.direction);
  const {start,end}=recordingEndpoints(trip,true);
  return [start,...trip.points.filter(p=>p.kind!=='stop'||trip.stops[p.id]?.enabled),end];
}
export function addTripPoint(route,trip,point,index=trip.points.length){
  endpoints(route,true);
  if(point.id===route.endpoints.home||point.id===route.endpoints.destination)throw Error('Route endpoints cannot be changed inside a trip.');
  trip.points.splice(Math.max(0,Math.min(trip.points.length,index)),0,structuredClone(point));
  if(point.kind==='stop')trip.stops[point.id]={enabled:true,duration:point.duration??60};
  trip.path=null;
}
export function removeTripPoint(trip,id){trip.points=trip.points.filter(p=>p.id!==id);delete trip.stops[id];trip.path=null;}
export function changeTripDirection(trip,direction){directionFolder(direction);if(trip.direction!==direction){trip.direction=direction;}}
export function tripCompletion(route,trip){
  const ordered=tripPoints(route,trip),path=trip.path;
  if(!path||path.snapped.length!==ordered.length)throw Error('Update this trip’s road path first.');
  const from=ordered[0],to=ordered.at(-1);
  return {reason:'recording_end_reached',pointId:to.id,label:'Recording end',selectedCoordinate:[...to.coord],coordinate:[...path.snapped.at(-1)],startPointId:from.id};
}
export function migrateProject(source){
  const s=structuredClone(source);
  if(!s||typeof s!=='object')throw Error('Not a supported Trip Studio project.');
  if(s.version===4)return s;
  if(s.version===3){for(const r of s.routes)copyRecordingEndpoints(r);s.version=4;return s;}
  if(![1,2].includes(s.version)||!Array.isArray(s.routes))throw Error('Not a supported Trip Studio project.');
  for(const r of s.routes){
    initializeEndpoints(r);
    const oldPoints=r.points,oldPaths=r.paths,middle=oldPoints.filter(p=>p.id!==r.endpoints.home&&p.id!==r.endpoints.destination);
    r.trips=s.version===1?[]:r.trips;
    for(const t of r.trips){
      t.stops=structuredClone(t.stops);
      t.profile=structuredClone(t.profile);
      t.points=structuredClone(t.direction==='outbound'?middle:[...middle].reverse());
      t.path=oldPaths?.[t.direction]?structuredClone(oldPaths[t.direction]):null;
      // Disabled historical stops used to remain in shared road geometry.
      // Rebuild only those trip paths whose new routing point list differs.
      if(t.points.some(p=>p.kind==='stop'&&!t.stops[p.id]?.enabled))t.path=null;
    }
    r.points=oldPoints.filter(p=>p.id===r.endpoints.home||p.id===r.endpoints.destination);
    r.paths=middle.length?null:oldPaths;
    r.endpointsLocked=!!(r.endpoints.home&&r.endpoints.destination);
  }
  for(const r of s.routes)copyRecordingEndpoints(r);s.version=4;return s;
}

function copyRecordingEndpoints(route){
  const {home,destination}=endpoints(route);
  for(const t of route.trips){
    const start=t.direction==='outbound'?home:destination,end=t.direction==='outbound'?destination:home;
    t.recordingStart=start?{...structuredClone(start),id:t.id.slice(0,70)+'-start',name:'Recording start'}:null;
    t.recordingEnd=end?{...structuredClone(end),id:t.id.slice(0,70)+'-end',name:'Recording end'}:null;
  }
}
