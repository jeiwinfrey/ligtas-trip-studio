import {seeded} from './engine.js';
export const VEHICLES={
  jeepney:{label:'Jeepney',average:25,spread:.65,persistence:.25},
  modernJeepney:{label:'Modern jeepney',average:30,spread:.48,persistence:.5},
  bus:{label:'Bus',average:40,spread:.35,persistence:.72},
  tricycle:{label:'Tricycle',average:18,spread:.5,persistence:.32}
};
export function vehicleCurve({vehicle,average,seed,duration}){
  const style=VEHICLES[vehicle];
  if(!style||!Number.isFinite(average)||average<1||average>80||!Number.isInteger(seed)||seed<1||seed>2147483647||!Number.isFinite(duration)||duration<=0||duration>86400)throw Error('Choose a vehicle, average from 1–80 km/h, valid seed and trip times.');
  // Controls span the whole driving interval, roughly every ten seconds.
  const count=Math.max(4,Math.min(999,Math.ceil(duration/10))),rng=seeded(seed);
  let previous=1;const points=[{u:0,v:0}];
  for(let i=1;i<count;i++){
    const target=1+(rng()*2-1)*style.spread;
    previous=previous*style.persistence+target*(1-style.persistence);
    points.push({u:i/count,v:previous});
  }
  points.push({u:1,v:0});
  const mean=points.slice(1).reduce((n,p,i)=>n+(p.v+points[i].v)/2*(p.u-points[i].u),0);
  const scale=average/mean;
  if(points.some(p=>p.v*scale>160))throw Error('This average produces a peak above 160 km/h. Lower the average.');
  return points.map(p=>({u:p.u,v:p.v*scale}));
}
export function passengerSeconds(seed,token){
  let hash=2166136261;
  for(const c of String(token))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  return 10+Math.floor(seeded((seed^hash)>>>0)()*21);
}
export function arrivalFromAverage(start,distance,average,stopSeconds){
  if(!Number.isFinite(start)||!Number.isFinite(distance)||distance<=0||!Number.isFinite(average)||average<1||average>80||!Number.isFinite(stopSeconds)||stopSeconds<0)throw Error('Build the trip path and enter a valid average first.');
  const seconds=Math.round(distance*3.6/average)+stopSeconds;
  if(seconds>86400)throw Error('This average requires more than 24 hours. Increase it.');
  return new Date(start+seconds*1000+8*3600000).toISOString().slice(0,19);
}
