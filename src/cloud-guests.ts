/** Presentation-time motion for Jupiter's whale and Saturn's cloud submarine.
 * x/y are metres in the local world; y is altitude above the reference cloud
 * deck, not a depth below a solid surface. Keep this clock separate from flight
 * time, so changing simulation speed does not hurry their leisurely surfacing.
 */
export const CLOUD_GUEST_SURFACE = .34;
const RISE_SECONDS = 3;
const SURFACED_SECONDS = 3.2;
const DIVE_SECONDS = 3;
const CLOUD_ALTITUDE = .35;

export interface CloudGuestMotion {
  x: number;
  y: number;
  surfaceAmount: number;
  phase: 'cruising' | 'surfacing' | 'surfaced' | 'diving';
  elapsed: number;
  duration: number;
  fromSurface: number;
  cruiseDuration: number;
  homeX: number;
  age: number;
}

interface CloudGuestOptions {
  random?: () => number;
  reducedMotion?: boolean;
}

function cruiseDuration(random: () => number) {
  const choice = random();
  return 12 + 4 * (Number.isFinite(choice) ? Math.max(0, Math.min(1, choice)) : .5);
}

function eased(t: number) {
  t = Math.max(0, Math.min(1, t));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** A guest is recognizable from the first frame; neither creature vanishes. */
export function createCloudGuest(x: number, options: CloudGuestOptions = {}): CloudGuestMotion {
  const homeX = Number.isFinite(x) ? x : 8;
  const duration = cruiseDuration(options.random || Math.random);
  return { x: homeX, y: CLOUD_ALTITUDE, homeX, age: 0,
    surfaceAmount: CLOUD_GUEST_SURFACE, phase: 'cruising', elapsed: 0,
    duration, fromSurface: CLOUD_GUEST_SURFACE, cruiseDuration: duration };
}

/** React to a launch by easing down from the exact current pose, even if the
 * guest was still rising. Returning a fresh object avoids hidden state changes.
 */
export function diveCloudGuest(motion: CloudGuestMotion, lingerSeconds = 14): CloudGuestMotion {
  const linger = Number.isFinite(lingerSeconds) ? Math.max(12, Math.min(30, lingerSeconds)) : 14;
  if (motion.surfaceAmount <= CLOUD_GUEST_SURFACE) {
    return { ...motion, phase: 'cruising', elapsed: 0, duration: linger, cruiseDuration: linger };
  }
  return { ...motion, phase: 'diving', elapsed: 0,
    fromSurface: motion.surfaceAmount, duration: DIVE_SECONDS, cruiseDuration: linger };
}

/** Pure update. Supply real presentation seconds, not accelerated flight time.
 * The idle cycle takes 21.2–25.2 seconds, with 3.2 seconds fully surfaced. Quiet
 * lateral drift stays within .45m of the spawn position. Reduced motion keeps
 * a recognizable static partial view; callers can continue captions separately.
 */
export function updateCloudGuest(motion: CloudGuestMotion, dt: number,
  options: CloudGuestOptions = {}): CloudGuestMotion {
  if (options.reducedMotion) {
    return { ...motion, x: motion.homeX, y: CLOUD_ALTITUDE, age: 0,
      surfaceAmount: CLOUD_GUEST_SURFACE, phase: 'cruising', elapsed: 0,
      duration: motion.cruiseDuration, fromSurface: CLOUD_GUEST_SURFACE };
  }
  const random = options.random || Math.random;
  // A resumed background tab should not run through hours of decorative cycles.
  let remaining = Number.isFinite(dt) ? Math.max(0, Math.min(60, dt)) : 0;
  const next = { ...motion, age: motion.age + remaining };
  while (remaining > 0) {
    const step = Math.min(remaining, Math.max(0, next.duration - next.elapsed));
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
        next.phase = 'surfaced'; next.duration = SURFACED_SECONDS; next.surfaceAmount = 1; break;
      case 'surfaced':
        next.phase = 'diving'; next.duration = DIVE_SECONDS; next.fromSurface = 1;
        next.cruiseDuration = cruiseDuration(random); break;
      case 'diving':
        next.phase = 'cruising'; next.duration = next.cruiseDuration;
        next.surfaceAmount = CLOUD_GUEST_SURFACE; break;
    }
  }
  next.x = next.homeX + Math.sin(next.age * .15) * .45;
  next.y = CLOUD_ALTITUDE + Math.sin(next.age * .8) * .035;
  return next;
}
