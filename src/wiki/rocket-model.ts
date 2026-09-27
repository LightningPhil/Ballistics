/** An ideal, dimensionless free-space rocket. These are invented classroom
 * presets, with no real propellant chemistry, dimensions or performance data. */
import type { NozzleSession } from './nozzle-lab.ts';
export const PROPELLANT_LOADS={small:{name:'Small',mass:.8},medium:{name:'Medium',mass:1.4},large:{name:'Large',mass:2}} as const;
export const PAYLOADS={light:{name:'Light instruments',mass:.3},medium:{name:'Science package',mass:.65},heavy:{name:'Heavy observatory',mass:1.2}} as const;
export const BURN_RATES={gentle:{name:'Gentle',flow:.18},steady:{name:'Steady',flow:.3},brisk:{name:'Brisk',flow:.48}} as const;
export type RocketOptions={propellant:keyof typeof PROPELLANT_LOADS;payload:keyof typeof PAYLOADS;burn:keyof typeof BURN_RATES};
export type RocketQuantity='pressure'|'speed'|'thrust'|'acceleration'|'mass';
export type RocketAxis='time'|'used';
export type RocketPlot='pressure-speed'|'thrust-acceleration'|'mass-speed';
export interface RocketSample {time:number;distance:number;mass:number;remaining:number;used:number;flow:number;pressure:number;thrust:number;acceleration:number;speed:number}
export interface RocketRun {options:RocketOptions;samples:RocketSample[];burnTime:number;endTime:number;startMass:number;dryMass:number;propellant:number;cutoff:RocketSample;peakAcceleration:RocketSample}
export const EXHAUST_SPEED=2.4;
const STRUCTURE_MASS=1,RAMP=.12,COAST=2.5;
const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const smooth=(s:number)=>s*s*(3-2*s);
const integral=(s:number)=>s*s*s-.5*s*s*s*s;

function parameters(options:RocketOptions) {
  if(!PROPELLANT_LOADS[options.propellant]||!PAYLOADS[options.payload]||!BURN_RATES[options.burn]) throw new Error('Unknown classroom rocket preset');
  const propellant=PROPELLANT_LOADS[options.propellant].mass,dryMass=STRUCTURE_MASS+PAYLOADS[options.payload].mass,flow=BURN_RATES[options.burn].flow;
  return {propellant,dryMass,startMass:dryMass+propellant,flow,burnTime:propellant/(flow*(1-RAMP))};
}
function stateAt(run:ReturnType<typeof parameters>,time:number):RocketSample {
  const u=clamp(time/run.burnTime);
  const envelope=u<RAMP?smooth(u/RAMP):u>1-RAMP?smooth((1-u)/RAMP):1;
  const area=u<RAMP?RAMP*integral(u/RAMP):u>1-RAMP?1-RAMP-RAMP*integral((1-u)/RAMP):u-RAMP/2;
  const used=clamp(area/(1-RAMP)),remaining=run.propellant*(1-used),mass=run.dryMass+remaining;
  const flow=run.flow*envelope,thrust=EXHAUST_SPEED*flow;
  // At fixed illustrative gas conditions and nozzle, chamber pressure follows
  // gas flow. This is a quasi-steady proxy, not a combustion/nozzle solver.
  return {time,distance:0,mass,remaining,used,flow,pressure:flow,thrust,acceleration:thrust/mass,speed:EXHAUST_SPEED*Math.log(run.startMass/mass)};
}
export function simulateRocket(options:RocketOptions,step=.01):RocketRun {
  if(!Number.isFinite(step)||step<.001||step>.1) throw new Error('Invalid rocket sampling step');
  const p=parameters(options),endTime=p.burnTime+COAST;
  const times=new Set<number>([0,p.burnTime*RAMP,p.burnTime/2,p.burnTime*(1-RAMP),p.burnTime,endTime]);
  for(let t=step;t<endTime;t+=step) times.add(t);
  let previous=stateAt(p,0);
  const samples=[...times].sort((a,b)=>a-b).map(time=>{
    const sample=stateAt(p,time),dt=time-previous.time;
    // Simpson quadrature integrates position; speed is the exact ideal rocket
    // equation evaluated against the same smooth, finite propellant history.
    sample.distance=previous.distance+dt*(previous.speed+4*stateAt(p,(previous.time+time)/2).speed+sample.speed)/6;
    previous=sample;return sample;
  });
  return {options:{...options},samples,...p,endTime,cutoff:samples.find(s=>s.time===p.burnTime)!,peakAcceleration:samples.reduce((a,b)=>a.acceleration>b.acceleration?a:b)};
}
export function sampleRocket(run:RocketRun,time:number):RocketSample {
  const t=Math.max(0,Math.min(run.endTime,Number.isFinite(time)?time:0));
  let lo=0,hi=run.samples.length-1;
  while(lo+1<hi) {const mid=(lo+hi)>>1;if(run.samples[mid].time<=t)lo=mid;else hi=mid;}
  const a=run.samples[lo],b=run.samples[hi],f=(t-a.time)/(b.time-a.time);
  return {...stateAt(parameters(run.options),t),distance:a.distance+(b.distance-a.distance)*f};
}
export function timeAtPropellantUsed(run:RocketRun,fraction:number) {
  const f=clamp(fraction);if(f===0)return 0;if(f===1)return run.burnTime;
  const p=parameters(run.options);let lo=0,hi=run.burnTime;
  for(let i=0;i<45;i++) {const mid=(lo+hi)/2;if(stateAt(p,mid).used<f)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
export const ROCKET_SCALES:Record<RocketQuantity|'time',number>={pressure:.48*1.08,thrust:.48*EXHAUST_SPEED*1.08,speed:EXHAUST_SPEED*Math.log(3.3/1.3)*1.08,acceleration:.48*EXHAUST_SPEED/1.3*1.08,mass:4.2*1.08,time:16};
export const rocketIndex=(quantity:RocketQuantity,value:number)=>value/ROCKET_SCALES[quantity]*100;
export const ROCKET_PLOTS:Record<RocketPlot,{name:string;quantities:[RocketQuantity,RocketQuantity];labels:[string,string]}>= {
  'pressure-speed':{name:'Pressure & speed',quantities:['pressure','speed'],labels:['Chamber pressure','Speed']},
  'thrust-acceleration':{name:'Thrust & acceleration',quantities:['thrust','acceleration'],labels:['Thrust','Acceleration']},
  'mass-speed':{name:'Mass & speed',quantities:['mass','speed'],labels:['Total mass','Speed']},
};
export type RocketStage='empty'|'payload'|'ready'|'countdown'|'flight';
export interface RocketSession {options:RocketOptions;stage:RocketStage;time:number;countdown:number;playing:boolean;axis:RocketAxis;plot:RocketPlot;sound:boolean;previous?:RocketOptions;nozzle?:NozzleSession}
export const newRocketSession=():RocketSession=>({options:{propellant:'medium',payload:'medium',burn:'steady'},stage:'empty',time:0,countdown:0,playing:false,axis:'time',plot:'pressure-speed',sound:false});
export type RocketAction={type:'payload'|'fill'|'ignite'|'reset'|'replay'|'pause'};
export function rocketAction(session:RocketSession,action:RocketAction):RocketSession {
  const s={...session,options:{...session.options}};
  if(action.type==='payload'&&s.stage==='empty')s.stage='payload';
  if(action.type==='fill'&&s.stage==='payload')s.stage='ready';
  if(action.type==='ignite'&&s.stage==='ready'){s.stage='countdown';s.countdown=0;s.playing=true;}
  if(action.type==='pause')s.playing=false;
  if(action.type==='replay'&&s.stage==='flight'){s.stage='countdown';s.countdown=0;s.time=0;s.playing=true;}
  if(action.type==='reset'){if(s.stage==='flight')s.previous={...s.options};s.stage='empty';s.time=0;s.countdown=0;s.playing=false;}
  return s;
}
