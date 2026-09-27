import { rocketWatchAim } from './crew-watch.ts';

/** Surface walkers retreat for min(5, flight time + 1) seconds, then return. Ice-hole and
 * cloud swimmers retain their own lifecycles. Movement uses presentation time. */
export function isWalkingGuest(type:string) {
  return ['golfer','spaceman','alien','robot','icerobot','newt','snowman','icebear'].includes(type);
}
export interface CrewFlight {
  homeX:number;retreatX:number;elapsed:number;mode:'cannon'|'rocket';
  fleeSeconds:number;pendingLanding?:{target:{x:number;y?:number};mode:'cannon'|'rocket';radius:number};
  stage:'flight'|'approach'|'inspect';target?:{x:number;y:number};stopX?:number;approachSpeed?:number;
}
const clearAim=(ch:any)=>{delete ch.watchAim;delete ch.watchTarget;delete ch.inspectTarget;delete ch.gaitSpeed;};
export function beginCrewFlight(ch:any,launchX:number,mode:'cannon'|'rocket',bounds:{left:number;right:number},alreadyWatching=false,flightSeconds=Infinity) {
  if(!ch||!isWalkingGuest(ch.type))return;
  const away=ch.x>=launchX?1:-1,left=Math.min(bounds.left,bounds.right),right=Math.max(bounds.left,bounds.right);
  const fleeSeconds=alreadyWatching?0:Math.min(5,Math.max(0,flightSeconds)+1);
  const candidate=Math.max(left,Math.min(right,ch.x+away*ch.speed*3.5*fleeSeconds));
  // Never retreat towards the launch just to satisfy a newly changed camera.
  const retreatX=(candidate-ch.x)*away>=0?candidate:ch.x;
  ch.flightReaction={homeX:ch.x,retreatX:alreadyWatching?ch.x:retreatX,elapsed:0,fleeSeconds,mode,stage:'flight'} satisfies CrewFlight;
  clearAim(ch);ch.visible=true;ch.direction=away;ch.reaction=null;
  ch.state=alreadyWatching?'waiting':'running_away';ch.stateTimer=0;
}
export function clearCrewFlight(ch:any,restoreHome=false) {
  if(!ch?.flightReaction)return;
  if(restoreHome)ch.x=ch.flightReaction.homeX;
  delete ch.flightReaction;clearAim(ch);ch.visible=true;
  if(ch.state!=='squashed'){ch.state='idle';ch.stateTimer=0;}
}
export function inspectLanding(ch:any,target:{x:number;y?:number},mode:'cannon'|'rocket',radius=0) {
  if(!ch||!isWalkingGuest(ch.type)||!Number.isFinite(target.x))return;
  const previous:CrewFlight|undefined=ch.flightReaction;
  if(ch.state!=='squashed'&&previous?.stage==='flight'&&previous.elapsed<previous.fleeSeconds){
    // A short flight gets one final second of retreat before the curious return.
    previous.fleeSeconds=Math.min(previous.fleeSeconds,previous.elapsed+1);
    previous.pendingLanding={target:{...target},mode,radius};
    return;
  }
  beginApproach(ch,target,mode,radius);
}
function beginApproach(ch:any,target:{x:number;y?:number},mode:'cannon'|'rocket',radius:number) {
  const previous:CrewFlight|undefined=ch.flightReaction;
  let dx=target.x-ch.x;
  if(radius>0){const circumference=2*Math.PI*radius;dx=((dx+circumference/2)%circumference+circumference)%circumference-circumference/2;}
  const direction=dx>=0?1:-1,gap=(mode==='rocket'?1.6:1.0)+(ch.type==='icebear'?1.2:ch.type==='newt'?.5:0);
  const nearX=ch.x+dx,stopX=nearX-direction*gap,distance=Math.abs(stopX-ch.x);
  ch.flightReaction={homeX:previous?.homeX??ch.x,retreatX:ch.x,elapsed:0,fleeSeconds:0,mode,stage:'approach',target:{x:nearX,y:target.y??0},stopX,
    // At planetary distances this is a theatrical dash, not a walking-speed
    // simulation. A return takes at most five presentation seconds.
    approachSpeed:Math.max(ch.speed*3.5,distance/5)} satisfies CrewFlight;
  clearAim(ch);ch.visible=true;ch.reaction=null;
  if(ch.state!=='squashed'){ch.state='running_to';ch.stateTimer=0;}
  ch.direction=stopX>=ch.x?1:-1;
}
export function updateCrewFlight(ch:any,dt:number,vehicle:{x:number;y:number}|null,radius=0,paused=false,reduced=false) {
  const f:CrewFlight|undefined=ch?.flightReaction;if(!f)return false;
  dt=paused?0:Math.max(0,Number.isFinite(dt)?Math.min(dt,.1):0);ch.reducedMotion=reduced;ch.visible=true;
  if(ch.state==='squashed'){
    f.elapsed+=dt;ch.stateTimer=f.elapsed;
    if(f.elapsed<3)return true;
    ch.state='running_to';ch.stateTimer=0;f.elapsed=0;
  }
  f.elapsed+=dt;
  if(f.stage==='flight'){
    if(!vehicle&&!f.pendingLanding){clearCrewFlight(ch);return false;}
    const delta=f.retreatX-ch.x,secondsLeft=Math.max(dt,f.fleeSeconds-(f.elapsed-dt));
    if(f.elapsed<f.fleeSeconds-1e-8){
      const speed=secondsLeft>0?Math.abs(delta)/secondsLeft:0;
      ch.gaitSpeed=speed/3.5;
      if(Math.abs(delta)>1e-6){ch.direction=delta>=0?1:-1;ch.x+=ch.direction*Math.min(Math.abs(delta),speed*dt);}
      ch.state='running_away';
    }
    else {
      ch.x=f.retreatX;delete ch.gaitSpeed;
      if(f.pendingLanding){const landing=f.pendingLanding;beginApproach(ch,landing.target,landing.mode,landing.radius);return true;}
      ch.state='watching';
      ch.watchAim=rocketWatchAim(ch.x,vehicle!,radius);ch.watchTarget={...vehicle};
    }
    ch.stateTimer=ch.state==='watching'?f.elapsed-f.fleeSeconds:f.elapsed;
  }else if(f.stage==='approach'){
    const delta=f.stopX!-ch.x,step=Math.min(Math.abs(delta),f.approachSpeed!*dt);
    ch.direction=delta>=0?1:-1;ch.x+=ch.direction*step;ch.state='running_to';ch.stateTimer=f.elapsed;
    if(Math.abs(f.stopX!-ch.x)<1e-7){f.stage='inspect';f.elapsed=0;ch.stateTimer=0;}
  }
  if(f.stage==='inspect'){
    ch.state='inspecting';ch.stateTimer=f.elapsed;ch.direction=f.target!.x>=ch.x?1:-1;
    ch.reaction=null;ch.inspectTarget={...f.target};
  }
  return true;
}
