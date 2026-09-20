/** Presentation-time motion for Jupiter's whale and Saturn's cloud submarine.
 * x/y are metres in the local world; negative y places a guest just beneath the
 * reference cloud deck. Keep this clock separate from flight time, so changing
 * simulation speed does not hurry their leisurely surfacing.
 */
export const CLOUD_GUEST_SURFACE = .48;
const RISE_SECONDS = 2.5;
const DIVE_SECONDS = 2.5;
const STARTLE_SECONDS = .7;
const SURFACE_ALTITUDE = -.04;
const SUBMERGED_DEPTH = .34;
const MAX_ESCAPE_OFFSET = 1.8;

export interface CloudGuestMotion {
  x: number;
  y: number;
  surfaceAmount: number;
  phase: 'cruising' | 'surfacing' | 'surfaced' | 'startled' | 'diving';
  elapsed: number;
  duration: number;
  fromSurface: number;
  cruiseDuration: number;
  homeX: number;
  age: number;
  surfaceCount: number;
  fleeing: boolean;
  fleeDirection: -1 | 1;
  escapeOffset: number;
}

interface CloudGuestOptions {
  random?: () => number;
  reducedMotion?: boolean;
}

function cruiseDuration(random: () => number) {
  const choice = random();
  return 7 + 4 * (Number.isFinite(choice) ? Math.max(0, Math.min(1, choice)) : .5);
}

function eased(t: number) {
  t = Math.max(0, Math.min(1, t));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function altitude(surfaceAmount: number, age: number) {
  return SURFACE_ALTITUDE - (1 - surfaceAmount) * SUBMERGED_DEPTH +
    Math.sin(age * .8) * .025;
}

/** A guest is recognizable from the first frame; neither creature vanishes. */
export function createCloudGuest(x: number, options: CloudGuestOptions = {}): CloudGuestMotion {
  const homeX = Number.isFinite(x) ? x : 8;
  const duration = cruiseDuration(options.random || Math.random);
  return { x: homeX, y: altitude(CLOUD_GUEST_SURFACE, 0), homeX, age: 0,
    surfaceAmount: CLOUD_GUEST_SURFACE, phase: 'cruising', elapsed: 0,
    duration, fromSurface: CLOUD_GUEST_SURFACE, cruiseDuration: duration,
    surfaceCount: 0, fleeing: false, fleeDirection: 1, escapeOffset: 0 };
}

/** React to a launch with a brief startled beat, lateral flight from the
 * launcher, then a smooth dive from the exact current pose.
 */
export function diveCloudGuest(motion: CloudGuestMotion, lingerSeconds = 14,
  threatX = 1.5): CloudGuestMotion {
  const linger = Number.isFinite(lingerSeconds) ? Math.max(12, Math.min(30, lingerSeconds)) : 14;
  const source = Number.isFinite(threatX) ? threatX : 1.5;
  return { ...motion, phase: 'startled', elapsed: 0, duration: STARTLE_SECONDS,
    fromSurface: motion.surfaceAmount, cruiseDuration: linger, fleeing: true,
    fleeDirection: motion.x >= source ? 1 : -1 };
}

/** Deterministic little events: in each set of three whale surfacings there is
 * one blow and one mouth-breath; the submarine opens its hatch once.
 */
export function cloudGuestActivity(kind: 'whale' | 'submarine',
  motion: Pick<CloudGuestMotion, 'phase' | 'surfaceCount' | 'elapsed'>): string {
  if (motion.phase !== 'surfaced') return motion.phase;
  const slot = ((Math.max(1, motion.surfaceCount) - 1) % 3 + 3) % 3;
  if (kind === 'whale') {
    if (slot === 0 && motion.elapsed < 2.2) return 'spouting';
    if (slot === 1 && motion.elapsed >= .45 && motion.elapsed < 3.25) return 'breathing';
  } else if (slot === 0 && motion.elapsed >= .55 && motion.elapsed < 4.25) {
    return 'hatch_peek';
  }
  return 'surfaced';
}

/** Pure update. Supply real presentation seconds, not accelerated flight time.
 * Equal cruise and surfaced durations plus symmetric transitions keep the guest
 * above/below the visual midpoint for about half of each idle cycle.
 */
export function updateCloudGuest(motion: CloudGuestMotion, dt: number,
  options: CloudGuestOptions = {}): CloudGuestMotion {
  if (options.reducedMotion) {
    return { ...motion, x: motion.homeX, y: altitude(CLOUD_GUEST_SURFACE, 0), age: 0,
      surfaceAmount: CLOUD_GUEST_SURFACE, phase: 'cruising', elapsed: 0,
      duration: motion.cruiseDuration, fromSurface: CLOUD_GUEST_SURFACE,
      fleeing: false, escapeOffset: 0 };
  }
  const random = options.random || Math.random;
  // A resumed background tab should not run through hours of decorative cycles.
  let remaining = Number.isFinite(dt) ? Math.max(0, Math.min(60, dt)) : 0;
  const next = { ...motion, age: motion.age + remaining };
  while (remaining > 0) {
    const step = Math.min(remaining, Math.max(0, next.duration - next.elapsed));
    if (next.fleeing && (next.phase === 'startled' || next.phase === 'diving')) {
      const speed = next.phase === 'startled' ? 1.35 : .42;
      next.escapeOffset = Math.max(-MAX_ESCAPE_OFFSET, Math.min(MAX_ESCAPE_OFFSET,
        next.escapeOffset + next.fleeDirection * speed * step));
    } else if (!next.fleeing && Math.abs(next.escapeOffset) > 1e-6) {
      next.escapeOffset *= Math.exp(-step / 9);
    }
    next.elapsed += step;
    remaining -= step;
    if (next.phase === 'surfacing') {
      next.surfaceAmount = CLOUD_GUEST_SURFACE + (1 - CLOUD_GUEST_SURFACE) * eased(next.elapsed / next.duration);
    } else if (next.phase === 'diving') {
      next.surfaceAmount = next.fromSurface + (CLOUD_GUEST_SURFACE - next.fromSurface) * eased(next.elapsed / next.duration);
    }
    if (next.elapsed < next.duration) break;
    next.elapsed = 0;
    switch (next.phase) {
      case 'cruising':
        next.phase = 'surfacing'; next.duration = RISE_SECONDS; break;
      case 'surfacing':
        next.phase = 'surfaced'; next.duration = next.cruiseDuration;
        next.surfaceAmount = 1; next.surfaceCount += 1; break;
      case 'surfaced':
        next.phase = 'diving'; next.duration = DIVE_SECONDS; next.fromSurface = 1;
        next.cruiseDuration = cruiseDuration(random); break;
      case 'startled':
        next.phase = 'diving'; next.duration = DIVE_SECONDS;
        next.fromSurface = next.surfaceAmount; break;
      case 'diving':
        next.phase = 'cruising'; next.duration = next.cruiseDuration;
        next.surfaceAmount = CLOUD_GUEST_SURFACE; next.fleeing = false; break;
    }
  }
  next.x = next.homeX + Math.sin(next.age * .15) * .65 + next.escapeOffset;
  next.y = altitude(next.surfaceAmount, next.age);
  return next;
}
