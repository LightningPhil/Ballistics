/** Recorded-flight display data. The short ignition/shutdown envelopes affect
 * illustration and audio only; they never change the canonical flight solver. */
export type EnginePhase = 'ready'|'ignition'|'burning'|'cutoff'|'coasting'|'landed'|'no-liftoff';
export interface RocketDisplay {
  remaining:number; total:number; fraction:number; oxidiserFraction:number;
  output:number; phase:EnginePhase; label:string; time:number;
}
const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const smooth=(v:number)=>{const x=clamp(v);return x*x*(3-2*x);};
export function rocketDisplay(state:any|null,config:{propMass:number;MR:number},
  outcome?:string,burnoutTime?:number):RocketDisplay {
  const total=Math.max(0,Number(state?.mPropInitial??config.propMass)||0);
  const remaining=Math.max(0,Math.min(total,Number(state?.mProp??total)||0));
  const fraction=total>0?clamp(remaining/total):0,ratio=Math.max(0,Number(state?.MR??config.MR)||0);
  const time=Math.max(0,Number(state?.time)||0);
  let phase:EnginePhase='ready',output=0;
  if(state){
    if(outcome==='no-liftoff')phase='no-liftoff';
    else if(state.outcome==='impact')phase='landed';
    else if(state.engineOn&&remaining>0&&state.mdot>0&&state.thrustMagnitude>0){
      const burn=Number.isFinite(burnoutTime)?Math.max(0,burnoutTime):Infinity;
      const rise=Math.min(.35,burn*.12),fall=Math.min(.22,burn*.08);
      const attack=rise>0?smooth(time/rise):1;
      const release=Number.isFinite(burn)&&fall>0?smooth((burn-time)/fall):1;
      output=attack*release;phase=attack<1?'ignition':release<1?'cutoff':'burning';
    }else phase='coasting';
  }
  const label=phase==='ready'?'Tanks ready':phase==='ignition'?'Ignition':phase==='burning'?'Engine burning':phase==='cutoff'?'Engine shutting down':phase==='no-liftoff'?'No lift-off · propellant retained':phase==='landed'?'Landed · engine off':remaining<=1e-8?'Tanks empty · coasting':'Engine off · coasting';
  return {total,remaining,fraction,oxidiserFraction:ratio/(1+ratio),output,phase,label,time};
}
