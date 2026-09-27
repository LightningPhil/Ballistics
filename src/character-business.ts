/** One presentation-time schedule, shared by all worlds. No missed action queues. */
export const SILLY_ACTIONS = {
  golfer:'umbrella', spaceman:'paper-plane', robot:'book', icerobot:'tablet',
  alien:'blueprint', newt:'police-hat', icebear:'ice-cream', snowman:'snowballs',
} as const;
export type SillyKind = typeof SILLY_ACTIONS[keyof typeof SILLY_ACTIONS];
export interface SillyAction { kind:SillyKind; elapsed:number; duration:number }
export interface BusinessClock {
  remaining:number;
  active?:{character:any;state:string;stateTimer:number;direction:number};
}
const choice=(random:()=>number)=>Math.max(0,Math.min(1,random()));
export function createBusinessClock(random=Math.random):BusinessClock { return {remaining:12+16*choice(random)}; }
export function cancelBusiness(clock:BusinessClock) {
  const active=clock.active;if(!active)return;
  const ch=active.character;
  delete ch.business;
  if(ch.state==='business'){ch.state=active.state;ch.stateTimer=active.stateTimer;ch.direction=active.direction;}
  delete clock.active;
}
export function updateBusiness(clock:BusinessClock,ch:any,dt:number,busy:boolean,random=Math.random) {
  dt=Number.isFinite(dt)?Math.max(0,dt):0;
  clock.remaining-=dt;
  if(clock.active&&(clock.active.character!==ch||busy||ch.state==='squashed'))cancelBusiness(clock);
  if(clock.active){
    ch.business.elapsed+=dt;ch.stateTimer=ch.business.elapsed;
    if(ch.business.elapsed>=ch.business.duration)cancelBusiness(clock);
  }
  if(clock.remaining>0)return;
  clock.remaining=45+45*choice(random);
  const kind=SILLY_ACTIONS[ch?.type as keyof typeof SILLY_ACTIONS];
  if(busy||clock.active||!kind||ch.state==='squashed')return;
  clock.active={character:ch,state:ch.state,stateTimer:ch.stateTimer,direction:ch.direction};
  ch.business={kind,elapsed:0,duration:kind==='blueprint'?11:9} satisfies SillyAction;
  ch.state='business';ch.stateTimer=0;ch.direction=1;
  ch.bubbleText=null;ch.bubbleTimer=0;ch.reaction=null;
}

export function businessTime(pose:{business?:SillyAction;reducedMotion?:boolean}) {
  return pose.business ? pose.reducedMotion ? pose.business.duration*.45 : pose.business.elapsed : 0;
}
