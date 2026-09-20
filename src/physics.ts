import { classifyTrajectory } from './environment.ts';

/**
 * ============================================================================
 * physics.ts — Pure Cannon Ballistics for Launch Lab
 * ============================================================================
 *
 * ROLE:  All cannon physics lives here. Every function is PURE — it takes
 *        inputs and returns outputs with zero side-effects, zero DOM access.
 *        Gravity is spherical and inverse-square on a non-rotating world when
 *        a planet radius is supplied; a flat-world fallback is kept for tests.
 *        No drag or wind is modelled.
 *
 * EXPORTS (via the `Physics` object at the bottom):
 *   computeLaunchVelocity(force, mass, barrelLength) → speed (m/s)
 *   createProjectile(x, y, speed, angleDeg, mass, R) → state object
 *   stepProjectile(state, dt, gravity)                → new state, with refined
 *                                                       apex / contact events
 *   computeEnergy(state, gravity)                     → { ke, pe, tme }
 *   predictTrajectory(...)                            → range / height summary
 * ============================================================================
 */

// ── Constants ──────────────────────────────────────────────────────────────
var BARREL_LENGTH = 2.0; // metres — tunable, kept here as engine default

// ── Helpers ────────────────────────────────────────────────────────────────
function degToRad(deg) {
  return deg * Math.PI / 180;
}

// ── Core API ───────────────────────────────────────────────────────────────

/**
 * Work-energy theorem:  ½mv² = F·d   →   v = √(2Fd / m)
 * @param {number} force        Applied force in Newtons
 * @param {number} mass         Mass in kg
 * @param {number} barrelLength Optional override (default 2.0 m)
 * @returns {number} Launch speed in m/s
 */
function computeLaunchVelocity(force, mass, barrelLength) {
  var d = (typeof barrelLength === 'number') ? barrelLength : BARREL_LENGTH;
  if (!Number.isFinite(mass) || mass <= 0) return 0;

  // Clamp invalid/negative inputs so we never take sqrt of a negative value.
  var F = isFinite(force) ? Math.max(0, force) : 0;
  d = isFinite(d) ? Math.max(0, d) : 0;
  var workPerMass = (2 * F * d) / mass;
  if (workPerMass <= 0 || !Number.isFinite(workPerMass)) return 0;

  return Math.sqrt(workPerMass);
}

/**
 * Build an initial projectile state from cannon parameters.
 * Surface coordinates: +x right along surface, +y UP from surface (metres).
 * Internally stores world-space position (planet centre at origin) for
 * radial gravity integration when planetRadius is provided.
 *
 * @param {number} x0       Launch x in metres (surface distance from origin)
 * @param {number} y0       Launch y in metres (height above surface)
 * @param {number} speed    Launch speed (from computeLaunchVelocity)
 * @param {number} angleDeg Barrel angle in degrees from local horizontal
 * @param {number} mass     Ball mass in kg
 * @param {number} [planetRadius] Planet radius in metres (enables radial gravity)
 * @returns {object} Projectile state
 */
function createProjectile(x0, y0, speed, angleDeg, mass, planetRadius?) {
  if (![x0, y0, speed, angleDeg, mass].every(Number.isFinite) || mass <= 0 || speed < 0 || y0 < 0) {
    throw new RangeError('Projectile position, speed, angle and mass must be finite; mass must be positive.');
  }
  var R = (typeof planetRadius === 'number' && planetRadius > 0) ? planetRadius : 0;
  var rad = degToRad(angleDeg);
  const events = {
    outcome: 'flight' as 'flight' | 'impact',
    apexTime: speed * Math.sin(rad) <= 0 ? 0 : null as number | null,
    apexHeight: speed * Math.sin(rad) <= 0 ? y0 : null as number | null,
    impactTime: null as number | null, impactSpeed: null as number | null,
    impactVx: null as number | null, impactVy: null as number | null,
  };

  if (R > 0) {
    // Convert surface coords to world-space (planet centre at origin).
    // Launch site is at angle theta around from the "north pole" (0, R).
    var theta = x0 / R;
    var alt = R + y0;
    var wx = alt * Math.sin(theta);
    var wy = alt * Math.cos(theta);

    // Launch velocity in local frame: local-right is tangent, local-up is radial.
    // Rotate into world frame.
    var localVx = speed * Math.cos(rad);  // along surface (tangent)
    var localVy = speed * Math.sin(rad);  // radially outward
    // Tangent direction at angle theta: (cos(theta), -sin(theta))
    // Radial outward direction: (sin(theta), cos(theta))
    var wvx = localVx * Math.cos(theta) + localVy * Math.sin(theta);
    var wvy = -localVx * Math.sin(theta) + localVy * Math.cos(theta);

    return {
      ...events,
      x: x0, y: y0,
      vx: localVx, vy: localVy,   // surface-frame velocities (for readouts)
      wx: wx, wy: wy,               // world-space position
      wvx: wvx, wvy: wvy,           // world-space velocity
      mass: mass, time: 0, launched: true,
      planetRadius: R
    };
  }

  // Flat-earth fallback (no planetRadius)
  return {
    ...events,
    x: x0, y: y0,
    vx: speed * Math.cos(rad),
    vy: speed * Math.sin(rad),
    wx: 0, wy: 0, wvx: 0, wvy: 0,
    mass: mass, time: 0, launched: true,
    planetRadius: 0
  };
}

/**
 * Advance projectile by dt seconds.
 * When planetRadius > 0, uses radial gravity toward planet centre.
 * Returns a NEW state object — original is untouched.
 *
 * @param {object} state   Current projectile state
 * @param {number} dt      Delta-time in seconds
 * @param {number} gravity Surface gravity magnitude m/s² (positive number)
 * @returns {object} New state
 */
function advanceProjectile(state, dt, gravity) {
  var R = state.planetRadius;

  if (R > 0) {
    // ── Radial gravity integration (world-space) ──
    // mu = g_surface * R^2  (gravitational parameter)
    var mu = gravity * R * R;

    var wx = state.wx;
    var wy = state.wy;
    var wvx = state.wvx;
    var wvy = state.wvy;

    // Distance from planet centre
    var r = Math.sqrt(wx * wx + wy * wy);
    if (r < 1) r = 1; // safety

    // Gravitational acceleration: a = -mu / r^2, directed toward origin
    var aFactor = -mu / (r * r * r); // divides by r^3 to also normalise direction
    var ax = aFactor * wx;
    var ay = aFactor * wy;

    // Velocity Verlet integration (second-order accurate)
    // Half-step velocity
    var hvx = wvx + ax * dt * 0.5;
    var hvy = wvy + ay * dt * 0.5;

    // Full-step position
    var nwx = wx + hvx * dt;
    var nwy = wy + hvy * dt;

    // Recompute acceleration at new position
    var nr = Math.sqrt(nwx * nwx + nwy * nwy);
    if (nr < 1) nr = 1;
    var naFactor = -mu / (nr * nr * nr);
    var nax = naFactor * nwx;
    var nay = naFactor * nwy;

    // Full-step velocity
    var nvx = hvx + nax * dt * 0.5;
    var nvy = hvy + nay * dt * 0.5;

    // Convert back to surface coordinates
    var altitude = nr - R;
    var angle = Math.atan2(nwx, nwy);  // angle from "north pole"
    var oldAngle = state.x / R;
    var surfX = state.x + Math.atan2(Math.sin(angle - oldAngle), Math.cos(angle - oldAngle)) * R;
    var surfY = altitude;

    // Surface-frame velocity (for readouts: tangential and radial components)
    // Radial unit vector at current position: (nwx/nr, nwy/nr)
    // Tangent unit vector: (nwy/nr, -nwx/nr)
    var invNr = 1 / nr;
    var radHat_x = nwx * invNr;
    var radHat_y = nwy * invNr;
    var tanHat_x = nwy * invNr;
    var tanHat_y = -nwx * invNr;
    var surfVx = nvx * tanHat_x + nvy * tanHat_y;  // tangential (along surface)
    var surfVy = nvx * radHat_x + nvy * radHat_y;  // radial (away from surface)

    return {
      x: surfX, y: surfY,
      vx: surfVx, vy: surfVy,
      wx: nwx, wy: nwy,
      wvx: nvx, wvy: nvy,
      mass: state.mass,
      time: state.time + dt,
      launched: true,
      planetRadius: R
    };
  }

  // ── Flat-earth fallback ──
  var newVx = state.vx;
  var newVy = state.vy - gravity * dt;
  return {
    x: state.x + newVx * dt,
    y: state.y + 0.5 * (state.vy + newVy) * dt,
    vx: newVx, vy: newVy,
    wx: 0, wy: 0, wvx: 0, wvy: 0,
    mass: state.mass,
    time: state.time + dt,
    launched: true,
    planetRadius: 0
  };
}

/** Canonical contact and apex events, refined inside the same integration step.
 * Readouts retain incoming velocity separately from the stopped contact state.
 */
function stepProjectile(state, dt, gravity) {
  if (!Number.isFinite(dt) || dt <= 0 || state.outcome === 'impact') return { ...state };
  const g = Number.isFinite(gravity) ? Math.max(0, gravity) : 0;
  let next = { ...state, ...advanceProjectile(state, dt, g) };
  if (state.vy > 0 && next.vy <= 0) {
    let lo = 0, hi = dt;
    for (let i = 0; i < 35; i++) {
      const mid = (lo + hi) / 2;
      if (advanceProjectile(state, mid, g).vy > 0) lo = mid; else hi = mid;
    }
    const apex = advanceProjectile(state, (lo + hi) / 2, g);
    next.apexTime = apex.time;
    next.apexHeight = apex.y;
  }
  if (next.y <= 0 && next.vy < 0) {
    let lo = 0, hi = dt;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (advanceProjectile(state, mid, g).y > 0) lo = mid; else hi = mid;
    }
    const contact = advanceProjectile(state, (lo + hi) / 2, g);
    next = { ...next, ...contact, outcome: 'impact', y: 0,
      impactTime: contact.time, impactSpeed: Math.hypot(contact.vx, contact.vy),
      impactVx: contact.vx, impactVy: contact.vy, vx: 0, vy: 0, wvx: 0, wvy: 0 };
    if (state.planetRadius > 0) {
      const angle = contact.x / state.planetRadius;
      next.wx = state.planetRadius * Math.sin(angle);
      next.wy = state.planetRadius * Math.cos(angle);
    }
  }
  return next;
}

/**
 * Compute kinetic, potential, and total mechanical energy.
 * When planetRadius is available, uses proper gravitational PE.
 */
function computeEnergy(state, gravity) {
  var speedSq = state.vx * state.vx + state.vy * state.vy;
  var ke = 0.5 * state.mass * speedSq;
  // Surface-relative inverse-square potential: mu*m*(1/R - 1/(R+h)).
  // The algebraically equivalent form below avoids subtracting close values.
  const height = Math.max(state.y, 0);
  var pe = state.planetRadius > 0
    ? state.mass * gravity * state.planetRadius * height / (state.planetRadius + height)
    : state.mass * gravity * height;
  return { ke: ke, pe: pe, tme: ke + pe };
}

/**
 * Compute the current speed scalar.
 * @param {object} state
 * @returns {number} speed in m/s
 */
function speed(state) {
  return Math.sqrt(state.vx * state.vx + state.vy * state.vy);
}

/**
 * Predict full trajectory numerically (for zoom planning).
 * Returns range, max height, flight time.
 *
 * @param {number} force        Cannon force (N)
 * @param {number} mass         Ball mass (kg)
 * @param {number} angleDeg     Barrel angle (degrees)
 * @param {number} gravity      Surface gravity (m/s²)
 * @param {number} startX       Launch x (surface metres)
 * @param {number} startY       Launch y (altitude metres)
 * @param {number} barrelLength Barrel length (metres)
 * @param {number} [planetRadius] Planet radius (metres) — enables radial gravity
 */
function predictTrajectory(force, mass, angleDeg, gravity, startX, startY, barrelLength, planetRadius?) {
  var spd = computeLaunchVelocity(force, mass, barrelLength);
  var R = (typeof planetRadius === 'number' && planetRadius > 0) ? planetRadius : 0;

  if (R > 0) {
    // Numeric integration with spherical gravity
    var st = createProjectile(startX, startY, spd, angleDeg, mass, R);
    var dt = 1 / 120;
    var maxTime = 3600;        // 1 hour max
    var maxHeight = startY;
    var t = 0;

    while (t < maxTime) {
      st = stepProjectile(st, dt, gravity);
      maxHeight = Math.max(maxHeight, st.y, st.apexHeight ?? 0);
      if (st.outcome === 'impact') break;
      const classification = classifyTrajectory(st, gravity);
      if (classification.kind === 'orbit' || classification.kind === 'escape') break;
      t += dt;
    }

    const status = st.outcome === 'impact' ? 'impact' : classifyTrajectory(st, gravity).kind;
    return {
      range: Math.abs(st.x),
      maxHeight: maxHeight,
      flightTime: st.time,
      launchSpeed: spd,
      complete: status === 'impact' || status === 'orbit' || status === 'escape',
      status: status === 'returning' ? 'limit' : status,
      apexTime: st.apexTime,
      apexHeight: st.apexHeight
    };
  }

  // Flat-earth analytic fallback
  var rad = degToRad(angleDeg);
  var vx = spd * Math.cos(rad);
  var vy = spd * Math.sin(rad);

  if (!(gravity > 0)) {
    return { range: startX, maxHeight: startY, flightTime: 0, launchSpeed: spd,
      complete: false, status: 'unbounded', apexTime: null, apexHeight: null };
  }

  var disc = vy * vy + 2 * gravity * startY;
  var flightTime = (vy + Math.sqrt(Math.max(0, disc))) / gravity;
  var range = startX + vx * flightTime;
  var vyUp = Math.max(0, vy);
  var maxHeight = startY + (vyUp * vyUp) / (2 * gravity);

  return {
    range: range,
    maxHeight: maxHeight,
    flightTime: flightTime,
    launchSpeed: spd,
    complete: true,
    status: 'impact',
    apexTime: Math.max(0, vy / gravity),
    apexHeight: maxHeight
  };
}

// ── Expose namespace ──────────────────────────────────────────────────────
export const Physics = {
  BARREL_LENGTH: BARREL_LENGTH,
  computeLaunchVelocity: computeLaunchVelocity,
  createProjectile: createProjectile,
  stepProjectile: stepProjectile,
  computeEnergy: computeEnergy,
  predictTrajectory: predictTrajectory,
  classifyTrajectory: classifyTrajectory,
  speed: speed,
  degToRad: degToRad
};
