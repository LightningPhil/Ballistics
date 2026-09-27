/** A dimensionless classroom gas-and-piston model, not an ordnance calculator.
 * No real dimensions, powder masses, burn data or pressure calibration enter it.
 * Heat release raises gas energy; expansion does work on a moving mass. */
export const CHARGES = {
  small: { name:'Small', energy:.75, length:24 },
  medium: { name:'Medium', energy:1, length:32 },
  large: { name:'Large', energy:1.25, length:40 },
} as const;
export const MATERIALS = {
  stone: { name:'Stone', mass:.36, colour:'#b3a991', detail:'Lighter' },
  iron: { name:'Iron', mass:1, colour:'#657d83', detail:'Heavier' },
  lead: { name:'Lead', mass:1.45, colour:'#858a9a', detail:'Heaviest' },
} as const;
export type Charge = keyof typeof CHARGES;
export type Material = keyof typeof MATERIALS;
export interface CannonOptions { charge:Charge; material:Material }
export interface CannonSample {
  time:number; travel:number; speed:number; pressure:number; burned:number;
  gasEnergy:number; heatLost:number; frictionWork:number;
}
export interface CannonRun {
  options:CannonOptions; samples:CannonSample[]; exit:CannonSample;
  peak:CannonSample; endTime:number; mass:number; energy:number;
}
const BURN_TIME=.32, GAMMA=1.3, HEAT_LOSS=.06, RESISTANCE=.012;
const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,v));
const burned=(t:number)=> { const s=clamp(t/BURN_TIME); return s*s*(3-2*s); };
type State=[number,number,number,number,number];

export function simulateCannon(options:CannonOptions, step=.001):CannonRun {
  if (!CHARGES[options.charge] || !MATERIALS[options.material]) throw new Error('Unknown classroom preset');
  if (!Number.isFinite(step) || step<.0001 || step>.01) throw new Error('Invalid integration step');
  const energy=CHARGES[options.charge].energy, mass=MATERIALS[options.material].mass;
  const volume=.16+energy*.035;
  const pressure=(s:State)=>(GAMMA-1)*Math.max(0,s[2])/(volume+Math.max(0,s[0]));
  const rate=(t:number,s:State):State=> {
    const p=pressure(s), v=Math.max(0,s[1]), b=clamp(t/BURN_TIME);
    const heat=energy*6*b*(1-b)/BURN_TIME;
    const resistance=v>0 ? RESISTANCE : Math.min(p,RESISTANCE);
    return [v,(p-resistance)/mass,heat-p*v-HEAT_LOSS*s[2],HEAT_LOSS*s[2],resistance*v];
  };
  const add=(a:State,b:State,k:number)=>a.map((v,i)=>v+b[i]*k) as State;
  const advance=(t:number,s:State,h:number)=> {
    const a=rate(t,s), b=rate(t+h/2,add(s,a,h/2));
    const c=rate(t+h/2,add(s,b,h/2)), d=rate(t+h,add(s,c,h));
    return s.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+d[i])/6) as State;
  };
  const sample=(t:number,s:State):CannonSample=>({time:t,travel:s[0],speed:s[1],pressure:pressure(s),burned:burned(t),gasEnergy:s[2],heatLost:s[3],frictionWork:s[4]});
  const samples:CannonSample[]=[];
  let t=0, s:State=[0,0,0,0,0];
  samples.push(sample(t,s));
  while(s[0]<1 && t<12) {
    let h=Math.min(step,12-t), next=advance(t,s,h);
    if(next[0]>=1) {
      // Resolve muzzle clearance within the integration step.
      let lo=0,hi=h;
      for(let i=0;i<24;i++) { const mid=(lo+hi)/2; if(advance(t,s,mid)[0]<1) lo=mid; else hi=mid; }
      h=(lo+hi)/2; next=advance(t,s,h); next[0]=1;
    }
    s=next; t+=h; samples.push(sample(t,s));
  }
  if(s[0]<1) throw new Error('Classroom shot did not leave the barrel');
  const exit=samples[samples.length-1], peak=samples.reduce((a,b)=>a.pressure>b.pressure?a:b);
  // After clearance the reservoir vents; this deliberately omits the brief
  // external gas interaction. The ball coasts and no longer receives thrust.
  for(let i=1;i<=180;i++) {
    const dt=i/300, decay=Math.exp(-dt*11);
    samples.push({...exit,time:exit.time+dt,travel:1+exit.speed*dt,
      pressure:exit.pressure*decay,gasEnergy:exit.gasEnergy*decay});
  }
  return {options:{...options},samples,exit,peak,endTime:samples[samples.length-1].time,mass,energy};
}

export function sampleCannon(run:CannonRun,time:number):CannonSample {
  const samples=run.samples, t=clamp(Number.isFinite(time)?time:0,0,run.endTime);
  let lo=0,hi=samples.length-1;
  while(lo+1<hi) { const mid=(lo+hi)>>1; if(samples[mid].time<=t) lo=mid; else hi=mid; }
  const a=samples[lo],b=samples[hi],f=(t-a.time)/Math.max(1e-12,b.time-a.time);
  return Object.fromEntries(Object.keys(a).map(key=>[key,a[key]+(b[key]-a[key])*f])) as unknown as CannonSample;
}
export function timeAtTravel(run:CannonRun,travel:number) {
  const x=clamp(travel);
  let lo=0,hi=run.samples.findIndex(p=>p.travel>=1);
  while(lo+1<hi) { const mid=(lo+hi)>>1; if(run.samples[mid].travel<=x) lo=mid; else hi=mid; }
  const a=run.samples[lo],b=run.samples[hi],f=(x-a.travel)/Math.max(1e-12,b.travel-a.travel);
  return a.time+(b.time-a.time)*f;
}

// Shared scales are fixed across all presets, so comparing curves is honest.
const presets=Object.keys(CHARGES).flatMap(charge=>Object.keys(MATERIALS).map(material=>simulateCannon({charge:charge as Charge,material:material as Material})));
export const CANNON_SCALES={
  pressure:Math.max(...presets.map(r=>r.peak.pressure))*1.08,
  speed:Math.max(...presets.map(r=>r.exit.speed))*1.08,
  time:Math.ceil(Math.max(...presets.map(r=>r.endTime))*2)/2,
};
export const pressureIndex=(value:number)=>value/CANNON_SCALES.pressure*100;
export const speedIndex=(value:number)=>value/CANNON_SCALES.speed*100;

export type CannonStage='empty'|'powder'|'loaded'|'fuse'|'shot';
export interface CannonSession {
  options:CannonOptions; stage:CannonStage; time:number; fuse:number; playing:boolean;
  axis:'time'|'travel'; sound:boolean; previous?:CannonOptions;
}
export const newCannonSession=():CannonSession=>({options:{charge:'medium',material:'iron'},stage:'empty',time:0,fuse:0,playing:false,axis:'time',sound:false});
export type CannonAction={type:'charge'|'ball'|'light'|'reset'|'replay'|'pause'};
export function cannonAction(session:CannonSession,action:CannonAction):CannonSession {
  const s={...session,options:{...session.options}};
  if(action.type==='charge' && s.stage==='empty') s.stage='powder';
  if(action.type==='ball' && s.stage==='powder') s.stage='loaded';
  if(action.type==='light' && s.stage==='loaded') { s.stage='fuse'; s.fuse=0; s.playing=true; }
  if(action.type==='pause') s.playing=false;
  if(action.type==='replay' && s.stage==='shot') { s.stage='fuse'; s.fuse=0; s.time=0; s.playing=true; }
  if(action.type==='reset') {
    if(s.stage==='shot') s.previous={...s.options};
    s.stage='empty'; s.time=0; s.fuse=0; s.playing=false;
  }
  return s;
}
