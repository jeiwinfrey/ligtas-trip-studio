import {geometry,atDistance,seeded,distanceAt,speedAt,movingTimeAt,INTERVAL,haversine} from './engine.js';

export function tripSeconds(trip) {
  const parse=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(s)?Date.parse(s+'+08:00'):NaN;
  const start=parse(trip.departure),end=parse(trip.arrival),duration=(end-start)/1000;
  if(!Number.isFinite(duration)||duration<=0||duration>86400)throw Error('Arrival must be after departure, with a trip duration of at most 24 hours.');
  return {start,end,duration};
}
export function normalizeShape(points) {
  if(!Array.isArray(points)||points.length<2||points.length>1000)throw Error('Use between 2 and 1,000 speed points.');
  const p=points.map(x=>({u:Number(x.u),v:Number(x.v)})).sort((a,b)=>a.u-b.u);
  if(p[0].u!==0||p.at(-1).u!==1||p.some((x,i)=>!Number.isFinite(x.u)||!Number.isFinite(x.v)||x.u<0||x.u>1||x.v<0||x.v>160||(i&&x.u-p[i-1].u<1e-8)))throw Error('Speed points must have unique positions across the trip and speeds from 0 to 160 km/h.');
  return p;
}
export function schedule({coords,trip,stops=[],includeRows=true,completion=null}) {
  const g=geometry(coords),{start,end,duration}=tripSeconds(trip),shape=normalizeShape(trip.profile);
  if(completion&&(!Array.isArray(completion.coordinate)||completion.coordinate.length!==2||completion.coordinate.some(v=>!Number.isFinite(v))||haversine(g.coords.at(-1),completion.coordinate)>1))throw Error('Road geometry does not end at the selected trip destination. Rebuild the route.');
  if(!Number.isInteger(trip.seed)||trip.seed<1||trip.seed>2147483647||!Number.isFinite(trip.speedVariation)||trip.speedVariation<0||trip.speedVariation>40||!Number.isFinite(trip.stopVariation)||trip.stopVariation<0||trip.stopVariation>80)throw Error('Check the seed and speed/stop variation settings.');
  const rng=seeded(trip.seed),stopRng=seeded((trip.seed^0x9e3779b9)>>>0),varied=shape.map(p=>({...p,factor:1+(rng()*2-1)*trip.speedVariation/100}));
  const events=stops.map(s=>{if(!Number.isFinite(s.along)||s.along<0||s.along>g.length+.1||!Number.isFinite(s.duration)||s.duration<0||s.duration>7200)throw Error('Invalid stop location or duration.');const variation=1+(stopRng()*2-1)*trip.stopVariation/100;return {...s,along:Math.min(g.length,s.along),baseDuration:s.duration,duration:s.fixedDuration?s.duration:Math.round(s.duration*variation)};}).filter(e=>!completion||e.along<g.length-1e-6).sort((a,b)=>a.along-b.along);
  const stopSeconds=events.reduce((n,e)=>n+e.duration,0),movingSeconds=duration-stopSeconds;
  if(movingSeconds<=0)throw Error('Stops use the entire trip. Shorten stops or move the arrival later.');
  const profile=varied.map(p=>({t:p.u*movingSeconds,v:p.v*p.factor})),area=distanceAt(profile,movingSeconds);
  if(area<=1e-9)throw Error('Add a positive speed between departure and arrival.');
  const fitFactor=g.length/area;
  for(const p of profile)p.v*=fitFactor;
  const maxSpeed=Math.max(...profile.map(p=>p.v));
  if(completion){const lastMoving=profile.findLastIndex(p=>p.v>0),reachedAt=profile[lastMoving+1]?.t??movingSeconds;if(reachedAt<movingSeconds-1e-3)throw Error('The speed curve reaches the destination before your chosen arrival. Remove the final zero-speed plateau or move arrival earlier.');}
  let waiting=0;
  for(const e of events){e.movingTime=e.along===g.length?movingSeconds:movingTimeAt(profile,e.along);e.onset=e.movingTime+waiting;e.end=e.onset+e.duration;waiting+=e.duration;}
  const elapsedAt=m=>m+events.filter(e=>e.movingTime<=m+1e-8).reduce((n,e)=>n+e.duration,0);
  const movingAt=t=>{let wait=0;for(const e of events){if(t>=e.end)wait+=e.duration;else if(t>=e.onset)return e.movingTime;else break;}return Math.max(0,Math.min(movingSeconds,t-wait));};
  const frameAt=t=>{t=Math.max(0,Math.min(duration,t));const stopped=events.find(e=>t>=e.onset&&t<e.end),moving=movingAt(t),along=t>=duration?g.length:stopped?stopped.along:Math.min(g.length,distanceAt(profile,moving));const coordinate=atDistance(g,along),speed=stopped||t>=duration?0:speedAt(profile,moving);return {t,speed,along,coordinate,stopped:stopped?.id||null};};
  // Graph includes exact event edges plus every GPS observation; the arrival is never padded.
  const times=new Set([0,duration]);for(let t=0;t<=duration;t+=INTERVAL)times.add(t);
  const controls=shape.map((p,i)=>({u:p.u,t:p.u===0?0:p.u===1?duration:elapsedAt(p.u*movingSeconds),speed:profile[i].v,baseSpeed:p.v,factor:varied[i].factor}));
  for(const p of controls)times.add(p.t);
  for(const e of events){times.add(e.onset);times.add(e.end);}
  const curve=[];
  for(const t of [...times].sort((a,b)=>a-b)){
    const startEvent=events.find(e=>Math.abs(e.onset-t)<1e-7&&e.duration>0),endEvent=events.find(e=>Math.abs(e.end-t)<1e-7&&e.duration>0);
    if(startEvent&&!endEvent)curve.push({t,speed:speedAt(profile,startEvent.movingTime)});
    if(endEvent)curve.push({t,speed:0});
    curve.push({t,speed:startEvent?0:endEvent&&t<duration?speedAt(profile,endEvent.movingTime):frameAt(t).speed});
  }
  const rows=[];
  if(includeRows)for(let t=0;t<=duration;t+=INTERVAL){const frame=frameAt(t),[longitude,latitude]=frame.coordinate;rows.push({timestamp:new Date(start+t*1000).toISOString(),latitude:Number(latitude.toFixed(7)),longitude:Number(longitude.toFixed(7))});}
  return {rows,completion:completion?{...completion,reachedAt:new Date(end).toISOString()}:null,duration,arrival:duration,recordedDuration:Math.floor(duration/INTERVAL)*INTERVAL,start:new Date(start).toISOString(),end:new Date(end).toISOString(),distance:g.length,movingSeconds,stopSeconds,events,fitFactor,maxSpeed,seed:trip.seed,controls,curve,profile,frameAt,elapsedAt,movingAt};
}
