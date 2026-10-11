// GPS simulation is independent of the map and export UI.
export const INTERVAL = 10;
const R = 6371008.8;
export function haversine(a,b) {
  const rad=Math.PI/180, dlat=(b[1]-a[1])*rad, dlon=(b[0]-a[0])*rad;
  const h=Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlon/2)**2;
  return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
export function geometry(coords) {
  if(!Array.isArray(coords)||coords.length<2||coords.some(p=>!Array.isArray(p)||p.length!==2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90)) throw Error('Route geometry is invalid. Rebuild this route.');
  const cumulative=[0]; for(let i=1;i<coords.length;i++) cumulative.push(cumulative[i-1]+haversine(coords[i-1],coords[i]));
  if(cumulative.at(-1)<1) throw Error('Choose two different places for this route.');
  return {coords,cumulative,length:cumulative.at(-1)};
}
export function atDistance(g,d) {
  d=Math.max(0,Math.min(g.length,d)); let lo=0,hi=g.cumulative.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(g.cumulative[mid]<=d)lo=mid;else hi=mid;}
  const span=g.cumulative[hi]-g.cumulative[lo],f=span?(d-g.cumulative[lo])/span:0;
  return [g.coords[lo][0]+f*(g.coords[hi][0]-g.coords[lo][0]),g.coords[lo][1]+f*(g.coords[hi][1]-g.coords[lo][1])];
}
export function project(g,p,minDistance=0) {
  let best={distance:Infinity,along:0,coordinate:g.coords[0]};
  const c=Math.cos(p[1]*Math.PI/180);
  for(let i=1;i<g.coords.length;i++){
    if(g.cumulative[i]<minDistance-0.1)continue;
    const a=g.coords[i-1],b=g.coords[i],dx=(b[0]-a[0])*c,dy=b[1]-a[1];
    let t=Math.max(0,Math.min(1,((p[0]-a[0])*c*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
    const span=g.cumulative[i]-g.cumulative[i-1]; if(span)t=Math.max(t,Math.min(1,(minDistance-g.cumulative[i-1])/span));
    const q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],distance=haversine(p,q);
    if(distance<best.distance)best={distance,along:g.cumulative[i-1]+span*t,coordinate:q};
  }return best;
}
export function normalizeProfile(points) {
  if(!Array.isArray(points)||!points.length)throw Error('Add at least one speed point.');
  const p=points.map(x=>({t:Number(x.t),v:Number(x.v)})).sort((a,b)=>a.t-b.t);
  if(p[0].t!==0||p.some((x,i)=>!Number.isFinite(x.t)||!Number.isFinite(x.v)||x.t<0||x.v<0||x.v>160||(i>0&&x.t===p[i-1].t)))throw Error('Speed points need unique times, a first point at 0 seconds, and speeds between 0 and 160 km/h.');
  return p;
}
export function speedAt(points,t) {
  if(t>=points.at(-1).t)return points.at(-1).v;
  for(let i=1;i<points.length;i++)if(t<=points[i].t){const a=points[i-1],b=points[i];return a.v+(b.v-a.v)*(t-a.t)/(b.t-a.t);}
  return points[0].v;
}
export function distanceAt(points,t,factor=1) {
  let sum=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dt=Math.max(0,Math.min(t,b.t)-a.t);
    if(dt>0)sum+=a.v*dt+(b.v-a.v)*dt*dt/(2*(b.t-a.t));
    if(t<=b.t)return sum*factor/3.6;
  }
  sum+=Math.max(0,t-points.at(-1).t)*points.at(-1).v;
  return sum*factor/3.6;
}
export function movingTimeAt(points,d,factor=1) {
  if(d<=0)return 0;
  let hi=Math.max(1,points.at(-1).t);
  while(distanceAt(points,hi,factor)<d&&hi<86400)hi=Math.min(86400,hi*2);
  if(distanceAt(points,hi,factor)<d)throw Error('The speed profile cannot finish this route within 24 hours. Give the final point a positive speed.');
  let lo=0;for(let i=0;i<64;i++){const mid=(lo+hi)/2;if(distanceAt(points,mid,factor)<d)lo=mid;else hi=mid;}return hi;
}
export function seeded(seed) {let x=(Number(seed)>>>0)||1;return ()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export function simulate({coords,profile,stops=[],start,seed=1,speedVariation=0,stopVariation=0}) {
  const g=geometry(coords),p=normalizeProfile(profile),rng=seeded(seed);
  if(!Number.isFinite(Date.parse(start)))throw Error('Choose a valid recording start time.');
  if(!Number.isFinite(speedVariation)||speedVariation<0||speedVariation>40||!Number.isFinite(stopVariation)||stopVariation<0||stopVariation>80)throw Error('Trip variation is outside the allowed range.');
  const factor=1+(rng()*2-1)*speedVariation/100;
  const events=stops.map(s=>{
    if(!Number.isFinite(s.along)||s.along<0||s.along>g.length+0.1||!Number.isFinite(s.duration)||s.duration<0||s.duration>7200)throw Error('Stop position or duration is invalid.');
    return {...s,along:Math.min(g.length,s.along),duration:Math.round(s.duration*(1+(rng()*2-1)*stopVariation/100))};
  }).sort((a,b)=>a.along-b.along);
  let waiting=0;
  for(const e of events){e.movingTime=movingTimeAt(p,e.along,factor);e.onset=e.movingTime+waiting;e.end=e.onset+e.duration;waiting+=e.duration;}
  const arrival=movingTimeAt(p,g.length,factor)+waiting;
  if(arrival>86400)throw Error('A trip including its stops must fit within 24 hours.');
  // Keep exact ten-second spacing; hold at the destination until the next sample.
  const recordedDuration=Math.ceil((arrival-1e-8)/INTERVAL)*INTERVAL;
  const rows=[];const startMs=Date.parse(start);
  for(let t=0;t<=recordedDuration;t+=INTERVAL){
    let completedWait=0,stop=null;
    for(const e of events){if(t>=e.end)completedWait+=e.duration;else if(t>=e.onset){stop=e;break;}else break;}
    const d=t>=arrival?g.length:stop?stop.along:Math.min(g.length,distanceAt(p,Math.max(0,t-completedWait),factor));
    const [longitude,latitude]=atDistance(g,d);
    rows.push({timestamp:new Date(startMs+t*1000).toISOString(),latitude:Number(latitude.toFixed(7)),longitude:Number(longitude.toFixed(7))});
  }
  return {rows,arrival,recordedDuration,distance:g.length,events,speedFactor:factor,seed};
}
export function encode(rows,format) {
  if(format==='json')return JSON.stringify(rows,null,2)+'\n';
  if(format==='gpx')return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="LIGTAS Trip Studio" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>\n'+rows.map(r=>`<trkpt lat="${r.latitude}" lon="${r.longitude}"><time>${r.timestamp}</time></trkpt>`).join('\n')+'\n</trkseg></trk></gpx>\n';
  return 'timestamp,latitude,longitude\n'+rows.map(r=>`${r.timestamp},${r.latitude},${r.longitude}`).join('\n')+'\n';
}
