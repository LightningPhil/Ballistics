import { HOLE_OPEN_SECONDS, HOLE_FREEZE_SECONDS, SQUID_DIVE_SECONDS, SQUID_EMERGE_SECONDS, SQUID_HOLE_RADIUS } from './squid.ts';

/** A hole exists only after the squid starts hammering. Travelling targets are
 * just positions on solid ice, not pre-opened or reusable pools. */
function openIceHole(ch, x) {
  const hole = { x, phase: 'opening', timer: 0, seed: Math.random() * 1000, reserved: true };
  ch.holes.push(hole);
  return hole;
}

function freeze(hole) {
  if (hole) Object.assign(hole, { phase: 'freezing', timer: 0, reserved: false });
}

export function releaseSquidTarget(ch) {
  ch.holeTarget = null;
  // A fright can interrupt a surface hammer swing. Seal the abandoned crack.
  if (ch.state === 'hammering') { freeze(ch.hole); ch.hole = null; }
}

export function headForSquidHole(ch, x: number, state = 'walking') {
  releaseSquidTarget(ch);
  ch.holeTarget = { x };
  ch.direction = x >= ch.x ? 1 : -1;
  // Leave room for the arms: the hammer must strike bare ice ahead of them.
  ch.walkTarget = x - ch.direction * (SQUID_HOLE_RADIUS + .4);
  ch.state = state;
  ch.stateTimer = 0;
  if ((ch.walkTarget - ch.x) * ch.direction <= 0) enterSquidHole(ch);
}

/** Stop at the rim and break the ice before attempting to dive. */
export function enterSquidHole(ch) {
  ch.x = ch.walkTarget;
  ch.hole = openIceHole(ch, ch.holeTarget.x);
  ch.holeTarget = null;
  ch.state = 'hammering';
  ch.stateTimer = 0;
  ch.holeX = ch.hole.x - ch.x;
}

export function beginSquidBreakout(ch) {
  ch.hole = openIceHole(ch, ch.x);
  ch.state = 'breaking';
  ch.stateTimer = 0;
  ch.holeX = 0;
}

export function squidUnderIce(ch) {
  return ch && ch.type === 'squid' && ['diving', 'submerged', 'breaking', 'emerging'].includes(ch.state);
}

/** Called after main advances stateTimer. Holes use the same presentation clock
 * as the hammer, so cracks, the last strike and the dive stay synchronized. */
export function updateSquidHoles(ch, dt: number, freshSpot: (ch: any) => number) {
  if (ch.type !== 'squid' || !ch.holes) return false;
  for (const hole of ch.holes) {
    hole.timer += dt;
    if (hole.phase === 'opening' && hole.timer >= HOLE_OPEN_SECONDS) {
      Object.assign(hole, { phase: 'open', timer: 0 });
    }
  }
  ch.holes = ch.holes.filter(hole => hole.phase !== 'freezing' || hole.timer < HOLE_FREEZE_SECONDS);
  const hole = ch.hole;
  switch (ch.state) {
    case 'hammering':
      if (hole.phase === 'open') {
        ch.state = 'diving'; ch.stateTimer = 0; ch.diveStartX = ch.x;
      }
      return true;
    case 'diving': {
      const p = Math.min(1, ch.stateTimer / SQUID_DIVE_SECONDS);
      const hop = Math.min(1, p / .22);
      ch.x = ch.diveStartX + (hole.x - ch.diveStartX) * hop * hop * (3 - 2 * hop);
      ch.holeX = hole.x - ch.x;
      if (p >= 1) {
        freeze(hole);
        ch.exitX = freshSpot(ch);
        ch.direction = ch.exitX >= ch.x ? 1 : -1;
        ch.hole = null;
        ch.state = 'submerged'; ch.stateTimer = 0; ch.holeX = 0;
      }
      return true;
    }
    case 'submerged':
      ch.x += ch.direction * 1.1 * dt;
      if ((ch.exitX - ch.x) * ch.direction <= 0) {
        ch.x = ch.exitX;
        beginSquidBreakout(ch);
      }
      return true;
    case 'breaking':
      if (hole.phase === 'open') {
        ch.state = 'emerging'; ch.stateTimer = 0; ch.holeX = 0;
      }
      return true;
    case 'emerging': {
      const p = Math.min(1, ch.stateTimer / SQUID_EMERGE_SECONDS);
      const hop = Math.max(0, (p - .66) / .34);
      // Clear both the pool's radius and the trailing tentacles before landing.
      ch.x = hole.x + ch.direction * (SQUID_HOLE_RADIUS + .8) * hop * hop * (3 - 2 * hop);
      ch.holeX = hole.x - ch.x;
      if (p >= 1) {
        freeze(hole);
        ch.hole = null;
        ch.state = 'idle'; ch.stateTimer = 0; ch.holeX = 0;
      }
      return true;
    }
  }
  return false;
}
