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
  kind: 'whale' | 'submarine';
  watching: boolean;
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
  kind?: 'whale' | 'submarine';
  watching?: boolean;
  random?: () => number;
  reducedMotion?: boolean;
}

function cruiseDuration(random: () => number, whale = false) {
  const choice = random();
  const u = Number.isFinite(choice) ? Math.max(0, Math.min(1, choice)) : .5;
  return whale ? 14 + 8 * u : 7 + 4 * u;
}

function eased(t: number) {
  t = Math.max(0, Math.min(1, t));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function altitude(surfaceAmount: number, age: number) {
  return SURFACE_ALTITUDE - (1 - surfaceAmount) * SUBMERGED_DEPTH +
    Math.sin(age * .8) * .025;
}

/** The whale starts swimming beneath the surface; the sub keeps its periscope up. */
export function createCloudGuest(x: number, options: CloudGuestOptions = {}): CloudGuestMotion {
  const homeX = Number.isFinite(x) ? x : 8;
  const kind = options.kind || 'submarine', floor = kind === 'whale' ? 0 : CLOUD_GUEST_SURFACE;
  const duration = cruiseDuration(options.random || Math.random, kind === 'whale');
  return { kind, watching: false, x: homeX, y: altitude(floor, 0), homeX, age: 0,
    surfaceAmount: floor, phase: 'cruising', elapsed: 0,
    duration, fromSurface: floor, cruiseDuration: duration,
    surfaceCount: 0, fleeing: false, fleeDirection: 1, escapeOffset: 0 };
}

/** React to a launch with a brief startled beat, lateral flight from the
 * launcher, then a smooth dive from the exact current pose.
 */
export function diveCloudGuest(motion: CloudGuestMotion, lingerSeconds = 14,
  threatX = 1.5): CloudGuestMotion {
  const linger = Number.isFinite(lingerSeconds) ? Math.max(12, Math.min(30, lingerSeconds)) : 14;
  const source = Number.isFinite(threatX) ? threatX : 1.5;
  return { ...motion, watching: false, phase: 'startled', elapsed: 0, duration: STARTLE_SECONDS,
    fromSurface: motion.surfaceAmount, cruiseDuration: linger, fleeing: true,
    fleeDirection: motion.x >= source ? 1 : -1 };
}

/** Deterministic little events: in each set of three whale surfacings there is
 * one blow and one breath through the blowhole; the submarine opens its hatch.
 */
export function cloudGuestActivity(kind: 'whale' | 'submarine',
  motion: Pick<CloudGuestMotion, 'phase' | 'surfaceCount' | 'elapsed'>): string {
  if (motion.phase !== 'surfaced') return motion.phase;
  const slot = ((Math.max(1, motion.surfaceCount) - 1) % 3 + 3) % 3;
  if (kind === 'whale') {
    if (slot === 0 && motion.elapsed < 2.2) return 'spouting';
    if (slot === 1 && motion.elapsed >= .45 && motion.elapsed < 3.25) return 'breathing';
  } else if (motion.elapsed >= .55 && motion.elapsed < 6.5) {
    return 'hatch_peek';
  }
  return 'surfaced';
}

/** Pure update in presentation seconds. Whales spend most of their time below
 * the surface, with short breathing stops. A watching pilot stays up until landing. */
export function updateCloudGuest(motion: CloudGuestMotion, dt: number,
  options: CloudGuestOptions = {}): CloudGuestMotion {
  const whale = motion.kind === 'whale', floor = whale ? 0 : CLOUD_GUEST_SURFACE;
  const watching = !whale && !!options.watching;
  if (options.reducedMotion) {
    const surface = whale || watching ? 1 : floor;
    return { ...motion, watching, x: motion.homeX, y: altitude(surface, 0), age: 0,
      surfaceAmount: surface, phase: whale || watching ? 'surfaced' : 'cruising', elapsed: 4,
      duration: motion.cruiseDuration, fromSurface: surface,
      fleeing: false, escapeOffset: 0 };
  }
  const random = options.random || Math.random;
  // A resumed background tab should not run through hours of decorative cycles.
  let remaining = Number.isFinite(dt) ? Math.max(0, Math.min(60, dt)) : 0;
  const next = { ...motion, watching, age: motion.age + remaining };
  // A quick duck at launch leaves time to watch even a short cannon flight.
  if (watching && next.phase === 'startled') next.duration = Math.min(next.duration, .45);
  while (remaining > 0) {
    if (watching && !next.fleeing && ['cruising', 'diving'].includes(next.phase)) {
      next.phase = 'surfacing'; next.elapsed = 0; next.duration = .85;
      next.fromSurface = next.surfaceAmount;
    }
    if (watching && next.phase === 'surfaced') {
      next.escapeOffset *= Math.exp(-remaining / 9);
      next.elapsed += remaining; remaining = 0; break;
    }
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
      next.surfaceAmount = next.fromSurface + (1 - next.fromSurface) * eased(next.elapsed / next.duration);
    } else if (next.phase === 'diving') {
      next.surfaceAmount = next.fromSurface + (floor - next.fromSurface) * eased(next.elapsed / next.duration);
    }
    if (next.elapsed < next.duration - 1e-9) break;
    next.elapsed = 0;
    switch (next.phase) {
      case 'cruising':
        next.phase = 'surfacing'; next.duration = RISE_SECONDS; next.fromSurface = floor; break;
      case 'surfacing':
        next.phase = 'surfaced'; next.duration = whale ? 4.5 : next.cruiseDuration;
        next.surfaceAmount = 1; next.surfaceCount += 1; break;
      case 'surfaced':
        next.phase = 'diving'; next.duration = DIVE_SECONDS; next.fromSurface = 1;
        next.cruiseDuration = cruiseDuration(random, whale); break;
      case 'startled':
        next.phase = 'diving'; next.duration = watching ? .65 : DIVE_SECONDS;
        next.fromSurface = next.surfaceAmount; break;
      case 'diving':
        next.phase = 'cruising'; next.duration = next.cruiseDuration;
        next.surfaceAmount = floor; next.fleeing = false; break;
    }
  }
  next.x = next.homeX + Math.sin(next.age * .15) * (whale ? 1.4 : .65) + next.escapeOffset;
  next.y = altitude(next.surfaceAmount, next.age);
  return next;
}
