import {haversine} from './engine.js';

export function initializeEndpoints(route) {
  // Older projects identified A/B by first/last point. Capture those identities once.
  if(route.endpoints===undefined)route.endpoints={home:route.points[0]?.kind==='waypoint'?route.points[0].id:null,destination:route.points.length>1&&route.points.at(-1)?.kind==='waypoint'?route.points.at(-1).id:null};
  if(!route.endpoints||typeof route.endpoints!=='object'||Array.isArray(route.endpoints))throw Error('Invalid route endpoints.');
  for(const role of ['home','destination']){const id=route.endpoints[role];if(id!==null&&(typeof id!=='string'||!route.points.some(p=>p.id===id&&p.kind==='waypoint')))throw Error('Invalid '+role+' endpoint.');}
  if(route.endpoints.home&&route.endpoints.home===route.endpoints.destination)throw Error('Home and destination must be different points.');
  if(route.endpoints.home&&route.points[0]?.id!==route.endpoints.home)throw Error('Home must be the first route point.');
  if(route.endpoints.destination&&route.points.at(-1)?.id!==route.endpoints.destination)throw Error('Destination must be the last route point.');
  return route;
}
export function endpoints(route,required=false) {
  const home=route.points.find(p=>p.id===route.endpoints?.home),destination=route.points.find(p=>p.id===route.endpoints?.destination);
  if(required&&(!home||!destination))throw Error('Set Home (A) and Destination (B) before building a route or adding a trip.');
  if(required&&haversine(home.coord,destination.coord)<1)throw Error('Home and destination must be at least one metre apart.');
  return {home,destination};
}
export function setEndpoint(route,role,point) {
  if(route.endpointsLocked)throw Error('A and B are fixed for this route. Create a new route to use different endpoints.');
  if(!['home','destination'].includes(role))throw Error('Unknown endpoint role.');
  const existing=route.points.find(p=>p.id===route.endpoints[role]);
  if(existing){existing.coord=point.coord;return existing;}
  point.kind='waypoint';point.name=role==='home'?'Home (A)':'Destination (B)';
  route.endpoints[role]=point.id;
  if(role==='home')route.points.unshift(point);else route.points.push(point);
  return point;
}
export function insertIntermediate(route,point,index=route.points.length-1) {
  endpoints(route,true);
  route.points.splice(Math.max(1,Math.min(route.points.length-1,index)),0,point);
}
export function removePoint(route,id) {
  if(route.endpointsLocked&&Object.values(route.endpoints).includes(id))throw Error('A and B are fixed for this route.');
  route.points=route.points.filter(p=>p.id!==id);
  for(const role of ['home','destination'])if(route.endpoints[role]===id)route.endpoints[role]=null;
  for(const t of route.trips)delete t.stops[id];
}
export function directionFolder(direction) {
  if(direction==='outbound')return 'a-to-b';
  if(direction==='return')return 'b-to-a';
  throw Error('Choose A → B or B → A for this trip.');
}
export function recordingPath(entry){return directionFolder(entry.direction)+'/'+entry.filename;}
export function recordingCompletion(route,direction) {
  const {home,destination}=endpoints(route,true);directionFolder(direction);
  const path=route.paths?.[direction];
  if(!path||path.snapped.length!==route.points.length)throw Error('Build the road route for both endpoints first.');
  const from=direction==='outbound'?home:destination,to=direction==='outbound'?destination:home;
  return {reason:'destination_reached',pointId:to.id,label:direction==='outbound'?'Destination (B)':'Home (A)',selectedCoordinate:[...to.coord],coordinate:[...path.snapped.at(-1)],startPointId:from.id};
}
