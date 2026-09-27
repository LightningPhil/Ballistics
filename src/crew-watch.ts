/** Presentation-time launch reaction, independent of accelerated flight time. */
export const ROCKET_STARTLE_SECONDS = 1.8;
export const ROCKET_FLEE_SECONDS = 10;

export interface WatchAim {
  /** Screen/world horizontal facing; zero looks directly at the viewer. */
  yaw: -1 | 0 | 1;
  elevation: number;
}
export interface IdleLook { sequence:number; side:-1|1; duration:number; opticsAt:number }
export function chooseIdleLook(random=Math.random):IdleLook {
  return {sequence:Math.min(3,Math.floor(random()*4)),side:random()<.5?-1:1,
    duration:7+random()*4,opticsAt:random()<.38?5+random()*3:Infinity};
}
interface ObserverPose { type:string;state?:string;stateTimer?:number;reducedMotion?:boolean;reaction?:string;watchAim?:WatchAim;idleLook?:IdleLook }
/** A bare-eyed glance uses the same facing rig, without raising any equipment. */
export function gazeAim(pose:ObserverPose):WatchAim|undefined {
  if(pose.state==='watching')return pose.watchAim;
  if((pose.state||'idle')!=='idle'||!pose.idleLook)return;
  const {sequence,side,duration}=pose.idleLook,t=pose.reducedMotion?0:pose.stateTimer||0;
  // The bear mainly watches its surroundings, with just an occasional quick
  // glance towards us instead of holding a frontal stare for half each pause.
  if(pose.type==='icebear')return {yaw:sequence>=2&&t>duration*.55&&t<duration*.55+.9?0:side,elevation:0};
  const second=t>duration*.48;
  const sideways=sequence===1||sequence===2&&second||sequence===3&&!second;
  return {yaw:sideways?side:0,elevation:0};
}

/** The newt watches bare-eyed; other surface guests and the human pilot have optics. */
export function canUseOptics(type: string) {
  return ['golfer', 'spaceman', 'robot', 'icerobot', 'alien', 'snowman', 'icebear', 'submarine', 'worker'].includes(type);
}

export function observationAim(pose: ObserverPose): WatchAim | undefined {
  if (!canUseOptics(pose.type)) return;
  const state = pose.state || 'idle', t = pose.reducedMotion ? 0 : Math.max(0, pose.stateTimer || 0);
  const idleScan = state === 'idle' && pose.type !== 'worker' && !!pose.idleLook && t >= pose.idleLook.opticsAt;
  if (state !== 'watching' && state !== 'hatch_peek' && !(state === 'idle' && pose.reaction === 'apex') && !idleScan) return;
  const yaw = ([0, 1, 0, -1] as const)[Math.floor(t / 2.8) % 4];
  return pose.watchAim || gazeAim(pose) || { yaw, elevation: yaw ? .25 : 0 };
}

export function canWatchRocket(type: string) {
  return ['golfer', 'spaceman', 'robot', 'icerobot', 'alien'].includes(type);
}

/** Bearing in the observer's local tangent plane, including curved worlds. */
export function rocketWatchAim(observerX: number, rocket: { x: number; y: number }, radius = 0): WatchAim {
  let dx = rocket.x - observerX, dy = rocket.y - 1;
  if (radius > 0) {
    const angle = dx / radius;
    dx = (radius + rocket.y) * Math.sin(angle);
    dy = rocket.y - 1 - 2 * (radius + rocket.y) * Math.sin(angle / 2) ** 2;
  }
  return { yaw: dx < 0 ? -1 : 1,
    elevation: Math.max(-.2, Math.min(1.05, Math.atan2(dy, Math.abs(dx)))) };
}

export function beginRocketWatch(ch: any, launchX: number, alreadyWatching = false) {
  if (!canWatchRocket(ch.type) || ch.state === 'squashed') return;
  const direction = ch.x >= launchX ? 1 : -1;
  ch.rocketWatch = { elapsed: alreadyWatching ? ROCKET_STARTLE_SECONDS + ROCKET_FLEE_SECONDS : 0,
    originX: ch.x - (alreadyWatching ? direction * ch.speed * 3.5 * ROCKET_FLEE_SECONDS : 0), direction };
  ch.state = alreadyWatching ? 'watching' : 'rocket_startled';
  ch.stateTimer = 0;
  ch.visible = true;
  delete ch.watchAim;
  delete ch.watchTarget;
}

export function clearRocketWatch(ch: any) {
  if (!ch?.rocketWatch) return;
  delete ch.rocketWatch;
  delete ch.watchAim;
  delete ch.watchTarget;
  if (['watching', 'rocket_startled', 'running_away'].includes(ch.state)) {
    ch.state = 'idle'; ch.stateTimer = 0; ch.visible = true;
  }
}

/** Returns true while this controller owns the character's launch performance. */
export function updateRocketWatch(ch: any, dt: number, rocket: { x: number; y: number } | null,
  radius = 0, paused = false, reducedMotion = false) {
  const watch = ch.rocketWatch;
  if (!watch) return false;
  if (!rocket || ch.state === 'squashed') { clearRocketWatch(ch); return false; }
  if (!paused) watch.elapsed += Math.max(0, Number.isFinite(dt) ? dt : 0);
  const runTime = Math.max(0, watch.elapsed - ROCKET_STARTLE_SECONDS);
  const watching = runTime >= ROCKET_FLEE_SECONDS;
  ch.x = watch.originX + watch.direction * ch.speed * 3.5 * Math.min(ROCKET_FLEE_SECONDS, runTime);
  ch.state = watching ? 'watching' : watch.elapsed < ROCKET_STARTLE_SECONDS ? 'rocket_startled' : 'running_away';
  ch.stateTimer = watching ? runTime - ROCKET_FLEE_SECONDS : watch.elapsed < ROCKET_STARTLE_SECONDS ? watch.elapsed : runTime;
  ch.direction = watch.direction;
  ch.visible = true;
  ch.reducedMotion = reducedMotion;
  ch.watchAim = watching ? rocketWatchAim(ch.x, rocket, radius) : undefined;
  ch.watchTarget = watching ? { x: rocket.x, y: rocket.y } : undefined;
  return true;
}
