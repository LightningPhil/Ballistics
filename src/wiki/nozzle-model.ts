/** Classroom nozzle model, deliberately separate from the planetary flight model.
 * Quasi-one-dimensional, calorically perfect gas. Mixture curves are illustrative
 * surrogates, NOT CEA chemistry or measured engine maps. SI internally. */
export const NOZZLE_PROPELLANTS = {
  hydrogen: {name:'Liquid oxygen + hydrogen', short:'Hydrogen', gamma:1.22, cStar:2300, optimum:5.5, min:3, max:8, width:3, note:'Very light exhaust; bulky, very cold fuel tanks.'},
  methane: {name:'Liquid oxygen + methane', short:'Methane', gamma:1.20, cStar:1850, optimum:3.5, min:2, max:5, width:1.8, note:'A compromise between light exhaust and compact fuel storage.'},
  kerosene: {name:'Liquid oxygen + kerosene', short:'Kerosene', gamma:1.20, cStar:1700, optimum:2.6, min:1.5, max:4, width:1.5, note:'Dense fuel makes compact tanks; exhaust is heavier.'},
} as const;
export type NozzlePropellant = keyof typeof NOZZLE_PROPELLANTS;
export interface NozzleSettings {propellant:NozzlePropellant; pressure:number; throat:number; expansion:number; mixture:number; ambient:'air'|'vacuum'}
export const NOZZLE_DEFAULTS:NozzleSettings={propellant:'methane',pressure:100,throat:100,expansion:20,mixture:3.5,ambient:'air'};
export const NOZZLE_LIMITS={pressure:[10,350],throat:[20,300],expansion:[1,200]} as const;
const clip=(n:number,min:number,max:number,fallback:number)=>Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
export function normaliseNozzle(input:NozzleSettings):NozzleSettings {
  const propellant=Object.prototype.hasOwnProperty.call(NOZZLE_PROPELLANTS,input.propellant)?input.propellant:'methane',p=NOZZLE_PROPELLANTS[propellant];
  return {propellant,pressure:clip(input.pressure,10,350,100),throat:clip(input.throat,20,300,100),expansion:clip(input.expansion,1,200,20),mixture:clip(input.mixture,p.min,p.max,p.optimum),ambient:input.ambient==='vacuum'?'vacuum':'air'};
}
export function areaRatio(mach:number,gamma:number) {return 1/mach*Math.pow(2/(gamma+1)*(1+(gamma-1)/2*mach*mach),(gamma+1)/(2*(gamma-1)));}
export function nozzleMach(area:number,gamma:number,supersonic=true) {
  if(area<=1)return 1;
  let lo=supersonic?1:.00001,hi=supersonic?20:1;
  for(let i=0;i<65;i++){const mid=(lo+hi)/2;if((areaRatio(mid,gamma)<area)===supersonic)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
export const pressureRatio=(mach:number,gamma:number)=>Math.pow(1+(gamma-1)/2*mach*mach,-gamma/(gamma-1));
export function nozzlePerformance(input:NozzleSettings) {
  const settings=normaliseNozzle(input),p=NOZZLE_PROPELLANTS[settings.propellant],gamma=p.gamma;
  // This broad smooth penalty demonstrates an optimum without pretending to
  // solve combustion. Holding gamma fixed also makes its limitations explicit.
  const cStar=p.cStar*Math.exp(-.13*((settings.mixture-p.optimum)/p.width)**2);
  const pc=settings.pressure*1e5,pa=settings.ambient==='air'?101325:0,at=Math.PI*(settings.throat/2000)**2;
  const idealMach=nozzleMach(settings.expansion,gamma),idealPe=pc*pressureRatio(idealMach,gamma);
  const separated=pa>0&&idealPe<.4*pa;
  const mach=separated?Math.sqrt(2/(gamma-1)*(Math.pow(.4*pa/pc,-(gamma-1)/gamma)-1)):idealMach;
  const effectiveExpansion=separated?areaRatio(mach,gamma):settings.expansion;
  const pe=pc*pressureRatio(mach,gamma),pr=pe/pc;
  const momentumCf=Math.sqrt(2*gamma*gamma/(gamma-1)*Math.pow(2/(gamma+1),(gamma+1)/(gamma-1))*(1-Math.pow(pr,(gamma-1)/gamma)));
  const cf=momentumCf+(pe-pa)/pc*effectiveExpansion;
  const flow=pc*at/cStar,exhaustSpeed=momentumCf*cStar,thrust=cf*pc*at,isp=thrust/flow/9.80665;
  return {settings,gamma,cStar,pc,pa,at,flow,exhaustSpeed,thrust,isp,pe,idealPe,mach,idealMach,effectiveExpansion,separated,
    exitDiameter:settings.throat*Math.sqrt(settings.expansion),pressureThrust:(pe-pa)*at*effectiveExpansion};
}
/** Best Isp in this bounded teaching model. In vacuum there is no finite ideal
 * optimum without a nozzle mass/length penalty, so use the upper area bound. */
export function optimiseNozzle(input:NozzleSettings,ambient:NozzleSettings['ambient']):NozzleSettings {
  const s=normaliseNozzle({...input,ambient}),p=NOZZLE_PROPELLANTS[s.propellant];
  const mach=ambient==='air'?Math.sqrt(2/(p.gamma-1)*(Math.pow(101325/(s.pressure*1e5),-(p.gamma-1)/p.gamma)-1)):0;
  return normaliseNozzle({...s,mixture:p.optimum,expansion:ambient==='vacuum'?200:areaRatio(mach,p.gamma)});
}
export function chamberPressureTip(pressure:number) {
  if(pressure>=300)return 'Extreme pressure territory. 350 bar is about 350 times a 1-bar atmosphere. It is an illustrative upper limit, above the historical engines compared here. This model does not calculate cooling, pump demands or structural limits.';
  if(pressure>=207)return 'Above the Shuttle main engine’s roughly 207-bar original rated reference. Higher pressure demands more from pumps, cooling and the chamber; none of those engineering costs are modelled here.';
  if(pressure>=78)return 'At or above the Saturn V F-1’s roughly 78-bar reference. Raising pressure mainly increases flow and thrust at a fixed throat. It does not give a proportional rise in exhaust speed.';
  return 'Below the Saturn V F-1’s roughly 78-bar reference. A lower chamber pressure needs a smaller expansion ratio to match sea-level air. Different engine designs cannot be ranked by pressure alone.';
}
