import { RocketPropellants } from './rocket_propellants.ts';

/**
 * ============================================================================
 * rocket_physics.js — Continuous-Thrust Rocket Physics Engine
 * ============================================================================
 *
 * ROLE:  All rocket-mode physics calculations. Every function is PURE — takes
 *        inputs and returns outputs with zero side-effects, zero DOM access.
 *        Implements the golden-path per-timestep algorithm from
 *        rocket_lab_single_source_of_truth.md Section 13.
 *
 * DEPENDS ON: rocket_propellants.js (for performance lookup)
 *
 * EXPORTS (via window.RocketPhysics namespace):
 *
 *   Core propulsion:
 *     computeMassFlow(Pc_Pa, At, cStarEff)        → ṁ (kg/s)
 *     computeThrust(CfEff, Pc_Pa, At)             → F (N)
 *     computeIsp(F, mdot, g0)                     → Isp (s)
 *     computeExhaustVelocity(Isp, g0)             → ve (m/s)
 *
 *   Vehicle:
 *     createRocketState(config)                    → initial state object
 *     stepRocket(state, dt, gravity, guidance)     → new state object
 *
 *   Guidance:
 *     guidanceFixed(theta0)                        → guidance object (Mode A)
 *     guidancePitchProgram(theta0, thetaF, t1, t2) → guidance object (Mode B)
 *     guidanceProgradeLock(vMin, fallbackTheta)    → guidance object (Mode C)
 *     buildGuidance(config)                         → guidance from UI config
 *
 *   Derived helpers:
 *     computeDeltaV(Isp, m0, mf, g0)              → Δv (m/s)
 *     computeThrustToWeight(F, m0, g)              → T/W ratio
 *     computeBurnTime(mProp, mdot)                 → t_burn (s)
 *     solveThroatForThrust(Ftarget, CfEff, Pc_Pa) → At (m²)
 *     throatAreaFromDiameter(d_mm)                 → At (m²)
 *     predictTrajectory(config, gravity, options)  → predicted full flight envelope
 *
 * LOADED BY: <script src="rocket_physics.js"> in index.html
 *            (after rocket_propellants.js, before main.js)
 * ============================================================================
 */

// ── Constants ──────────────────────────────────────────────────────────────
var G0 = 9.80665; // standard gravity (m/s²)
var DEG_TO_RAD = Math.PI / 180;
var RAD_TO_DEG = 180 / Math.PI;

// ── Core propulsion equations (Section 3 of spec) ──────────────────────────

/**
 * Mass flow rate through a choked throat.
 *   ṁ = pc · At / c*_eff
 *
 * @param {number} Pc_Pa     Chamber pressure (Pa)
 * @param {number} At        Throat area (m²)
 * @param {number} cStarEff  Effective characteristic velocity (m/s)
 * @returns {number} Mass flow rate (kg/s)
 */
function computeMassFlow(Pc_Pa, At, cStarEff) {
  if (cStarEff <= 0) return 0;
  return (Pc_Pa * At) / cStarEff;
}

/**
 * Thrust from effective Cf, chamber pressure, and throat area.
 *   F = Cf_eff · pc · At
 *
 * @param {number} CfEff  Effective thrust coefficient
 * @param {number} Pc_Pa  Chamber pressure (Pa)
 * @param {number} At     Throat area (m²)
 * @returns {number} Thrust (N)
 */
function computeThrust(CfEff, Pc_Pa, At) {
  return CfEff * Pc_Pa * At;
}

/**
 * Specific impulse.
 *   Isp = F / (ṁ · g0)
 *
 * @param {number} F    Thrust (N)
 * @param {number} mdot Mass flow rate (kg/s)
 * @param {number} [g0] Standard gravity (default 9.80665)
 * @returns {number} Isp (s)
 */
function computeIsp(F, mdot, g0?) {
  g0 = g0 || G0;
  if (mdot <= 0) return 0;
  return F / (mdot * g0);
}

/**
 * Exhaust velocity.
 *   ve = g0 · Isp
 *
 * @param {number} Isp  Specific impulse (s)
 * @param {number} [g0] Standard gravity (default 9.80665)
 * @returns {number} Exhaust velocity (m/s)
 */
function computeExhaustVelocity(Isp, g0?) {
  g0 = g0 || G0;
  return g0 * Isp;
}

// ── Derived helpers ────────────────────────────────────────────────────────

/**
 * Tsiolkovsky rocket equation.
 *   Δv = ve · ln(m0/mf) = g0 · Isp · ln(m0/mf)
 *
 * @param {number} Isp  Specific impulse (s)
 * @param {number} m0   Initial mass (kg)
 * @param {number} mf   Final (dry) mass (kg)
 * @param {number} [g0] Standard gravity
 * @returns {number} Delta-v (m/s)
 */
function computeDeltaV(Isp, m0, mf, g0?) {
  g0 = g0 || G0;
  if (mf <= 0 || m0 <= mf) return 0;
  return g0 * Isp * Math.log(m0 / mf);
}

/**
 * Thrust-to-weight ratio.
 *   T/W = F / (m0 · g)
 *
 * @param {number} F   Thrust (N)
 * @param {number} m0  Vehicle mass (kg)
 * @param {number} g   Local gravity (m/s²)
 * @returns {number} T/W ratio (dimensionless)
 */
function computeThrustToWeight(F, m0, g) {
  if (m0 <= 0 || g <= 0) return 0;
  return F / (m0 * g);
}

/**
 * Estimated burn time (constant thrust).
 *   t_burn = mProp / ṁ
 *
 * @param {number} mProp  Propellant mass (kg)
 * @param {number} mdot   Mass flow rate (kg/s)
 * @returns {number} Burn time (s)
 */
function computeBurnTime(mProp, mdot) {
  if (mdot <= 0) return Infinity;
  return mProp / mdot;
}

/**
 * Solve for throat area given a target thrust.
 *   At = F / (Cf_eff · pc)
 *
 * @param {number} Ftarget  Desired thrust (N)
 * @param {number} CfEff    Effective thrust coefficient
 * @param {number} Pc_Pa    Chamber pressure (Pa)
 * @returns {number} Throat area (m²)
 */
function solveThroatForThrust(Ftarget, CfEff, Pc_Pa) {
  if (CfEff <= 0 || Pc_Pa <= 0) return 0;
  return Ftarget / (CfEff * Pc_Pa);
}

/**
 * Convert throat diameter in mm to throat area in m².
 *
 * @param {number} d_mm  Throat diameter (mm)
 * @returns {number} Throat area (m²)
 */
function throatAreaFromDiameter(d_mm) {
  var r = (d_mm / 1000) / 2; // radius in metres
  return Math.PI * r * r;
}

// ── Guidance modes (Section 5 of spec) ─────────────────────────────────────
//
// Each guidance function returns an object with a `getAngle(state)` method
// that computes the current thrust angle in DEGREES given the rocket state.
//

/**
 * Mode A: Fixed angle — thrust direction is constant.
 *
 * @param {number} theta0  Fixed thrust angle (degrees from +x axis)
 * @returns {{ mode: string, getAngle: function }}
 */
function guidanceFixed(theta0) {
  return {
    mode: 'fixed',
    getAngle: function (/* state */) {
      return theta0;
    }
  };
}

/**
 * Mode B: Pitch program — linear ramp from theta0 to thetaF between t1 and t2.
 *   θ(t) = θ0 + (θf − θ0) · clamp((t − t1) / (t2 − t1), 0, 1)
 *
 * @param {number} theta0  Start angle (deg)
 * @param {number} thetaF  End angle (deg)
 * @param {number} t1      Ramp start time (s)
 * @param {number} t2      Ramp end time (s)
 * @returns {{ mode: string, getAngle: function }}
 */
function guidancePitchProgram(theta0, thetaF, t1, t2) {
  return {
    mode: 'pitch_program',
    getAngle: function (state) {
      var t = state.time;
      if (t2 <= t1) return theta0;
      var frac = (t - t1) / (t2 - t1);
      frac = Math.max(0, Math.min(1, frac)); // clamp
      return theta0 + (thetaF - theta0) * frac;
    }
  };
}

/**
 * Mode C: Prograde lock — orient thrust along velocity vector once speed
 * exceeds vMin. Falls back to fixed angle when speed is below threshold.
 *
 * @param {number} vMin          Speed threshold (m/s)
 * @param {number} fallbackTheta Fallback angle (deg) when speed < vMin
 * @returns {{ mode: string, getAngle: function }}
 */
function guidanceProgradeLock(vMin, fallbackTheta) {
  return {
    mode: 'prograde_lock',
    getAngle: function (state) {
      var speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
      if (speed < vMin) return fallbackTheta;
      var angle = Math.atan2(state.vy, state.vx) * RAD_TO_DEG;
      // Never thrust below horizontal — in a flat-ground sim without orbital
      // mechanics, sub-horizontal thrust just nosedives the rocket.
      return Math.max(0, angle);
    }
  };
}

/**
 * Build a guidance object directly from the user config shape.
 *
 * @param {Object} config  Same object used by createRocketState/getRocketValues
 * @returns {{ mode: string, getAngle: function }}
 */
function buildGuidance(config) {
  if (config.guidanceMode === 'pitch_program') {
    return guidancePitchProgram(
      config.launchAngle,
      config.pitchEnd,
      config.pitchT1,
      config.pitchT2
    );
  }
  if (config.guidanceMode === 'prograde_lock') {
    var vMin = (config.progradeVmin !== undefined) ? config.progradeVmin : 10;
    return guidanceProgradeLock(vMin, config.launchAngle);
  }
  // 'fixed' in UI currently means "gravity turn" behaviour.
  return guidanceProgradeLock(5, config.launchAngle);
}

// ── Rocket state creation ──────────────────────────────────────────────────

/**
 * Create an initial rocket state object from user config.
 *
 * @param {Object} config
 *   propellantId  {string}  Propellant registry ID (e.g. 'LOX_RP1')
 *   MR            {number}  Mixture ratio O/F
 *   Pc_bar        {number}  Chamber pressure (bar)
 *   epsilon       {number}  Expansion ratio (Ae/At)
 *   throatDia_mm  {number}  Throat diameter (mm)
 *   dryMass       {number}  Dry mass (kg)
 *   propMass      {number}  Propellant mass (kg)
 *   launchAngle   {number}  Launch angle (degrees from horizontal)
 *   etaC          {number}  Combustion efficiency (0–1, default 0.95)
 *   etaN          {number}  Nozzle efficiency (0–1, default 0.95)
 *   Pa_Pa         {number}  Ambient pressure (Pa, default 101325)
 *   planetRadius  {number}  Planet radius in metres (enables radial gravity)
 * @returns {Object} Rocket state
 */
function createRocketState(config) {
  var At = throatAreaFromDiameter(config.throatDia_mm);
  var Pc_Pa = config.Pc_bar * 1e5; // bar → Pa
  var etaC = (config.etaC !== undefined) ? config.etaC : 0.95;
  var etaN = (config.etaN !== undefined) ? config.etaN : 0.95;
  var Pa_Pa = (config.Pa_Pa !== undefined) ? config.Pa_Pa : 101325;
  var R = (config.planetRadius && config.planetRadius > 0) ? config.planetRadius : 0;

  // Look up performance at initial conditions
  var perf = RocketPropellants.lookupPerformance(
    config.propellantId, config.MR, Pc_Pa, config.epsilon, Pa_Pa
  );

  var cStarEff = etaC * perf.cStar;
  var CfEff = etaN * perf.Cf;
  var mdot = computeMassFlow(Pc_Pa, At, cStarEff);
  var F = computeThrust(CfEff, Pc_Pa, At);
  var Isp = computeIsp(F, mdot);
  var m0 = config.dryMass + config.propMass;

  return {
    // Position (metres, surface coords: +x along surface, +y up from surface)
    x: 0,
    y: 0,

    // Velocity (m/s, surface frame: tangential and radial)
    vx: 0,
    vy: 0,

    // World-space position and velocity (planet centre at origin)
    wx: 0,
    wy: R > 0 ? R : 0,
    wvx: 0,
    wvy: 0,
    planetRadius: R,

    // Masses (kg)
    mDry: config.dryMass,
    mProp: config.propMass,
    mPropInitial: config.propMass,

    // Engine config (carried for recomputation each step)
    propellantId: config.propellantId,
    MR: config.MR,
    Pc_Pa: Pc_Pa,
    epsilon: config.epsilon,
    At: At,
    etaC: etaC,
    etaN: etaN,
    Pa_Pa: Pa_Pa,

    // Engine state
    engineOn: true,

    // Current computed values (updated each step)
    thrustMagnitude: F,
    mdot: mdot,
    Isp: Isp,

    // Guidance
    theta: config.launchAngle, // current thrust angle (deg from local horizontal)

    // Timing / accumulators
    time: 0,
    totalImpulse: 0,

    // Status flags
    launched: false,
    fizzled: false,

    // Mass (total, for convenience)
    mass: m0
  };
}

// ── Golden-path per-timestep update (Section 13 of spec) ───────────────────

/**
 * Advance rocket state by one timestep.
 * Returns a NEW state object — original is untouched.
 * When state.planetRadius > 0, uses radial gravity in world-space coords.
 *
 * @param {Object} state     Current rocket state
 * @param {number} dt        Timestep (seconds)
 * @param {number} gravity   Surface gravity magnitude (m/s², positive)
 * @param {Object} guidance  Guidance object from guidanceFixed/PitchProgram/ProgradeLock
 * @returns {Object} New rocket state
 */
function stepRocket(state, dt, gravity, guidance) {
  // Clone state (shallow copy — all fields are primitives)
  var s: any = {};
  for (var k in state) {
    if (state.hasOwnProperty(k)) s[k] = state[k];
  }
  s.time += dt;

  // ── 1) Guidance → compute θ (angle from local horizontal in degrees) ──
  s.theta = guidance.getAngle(s);
  var thetaRad = s.theta * DEG_TO_RAD;

  // ── 2) Engine ──
  var F = 0;
  var mdot = 0;
  var Isp = 0;
  var thrustScale = 1;

  if (s.engineOn && s.mProp > 0) {
    // Look up current c* and Cf
    var perf = RocketPropellants.lookupPerformance(
      s.propellantId, s.MR, s.Pc_Pa, s.epsilon, s.Pa_Pa
    );

    var cStarEff = s.etaC * perf.cStar;
    var CfEff = s.etaN * perf.Cf;

    mdot = computeMassFlow(s.Pc_Pa, s.At, cStarEff);
    F = computeThrust(CfEff, s.Pc_Pa, s.At);
    Isp = computeIsp(F, mdot);

    // Deplete propellant
    var consumed = mdot * dt;
    if (consumed >= s.mProp) {
      // Propellant exhausted this step — pro-rate
      var dtActual = s.mProp / mdot;
      consumed = s.mProp;
      // Apply only the burn fraction of thrust to this step's kinematics.
      thrustScale = (dt > 0) ? (dtActual / dt) : 0;
      thrustScale = Math.max(0, Math.min(1, thrustScale));

      // Scale impulse contribution
      s.totalImpulse += F * dtActual;
      s.mProp = 0;
      s.engineOn = false;
    } else {
      s.mProp -= consumed;
      s.totalImpulse += F * dt;
    }
  }

  var effectiveThrust = F * thrustScale;
  s.thrustMagnitude = effectiveThrust;
  s.mdot = mdot;
  s.Isp = Isp;

  // ── 3) Mass ──
  s.mass = s.mDry + s.mProp;

  // ── Fizzle check ──
  // On the very first step (not yet launched), check T/W.
  // If thrust cannot overcome weight, the rocket fizzles on the pad.
  if (!state.launched && !state.fizzled) {
    var tw = computeThrustToWeight(F, s.mass, gravity);
    if (tw < 1.0) {
      // Fizzle: rocket never lifts off
      s.fizzled = true;
      s.engineOn = false;
      s.vx = 0;
      s.vy = 0;
      s.x = 0;
      s.y = 0;
      s.thrustMagnitude = F; // keep last thrust for readouts
      return s;
    }
    s.launched = true;
  }

  // If already fizzled, don't move
  if (s.fizzled) {
    return s;
  }

  var R = s.planetRadius;

  if (R > 0) {
    // ── Radial gravity integration (world-space) ──
    var mu = gravity * R * R; // gravitational parameter

    var wx = s.wx;
    var wy = s.wy;
    var wvx = s.wvx;
    var wvy = s.wvy;

    var r = Math.sqrt(wx * wx + wy * wy);
    if (r < 1) r = 1;
    var invR = 1 / r;

    // Unit vectors at current position
    var radX = wx * invR;   // radial outward
    var radY = wy * invR;
    var tanX = wy * invR;   // tangent (perpendicular, "rightward")
    var tanY = -wx * invR;

    // Thrust acceleration in world-space
    // theta is angle from local horizontal: cos(theta) along tangent, sin(theta) along radial
    var thrustAcc = (s.mass > 0 && effectiveThrust > 0) ? (effectiveThrust / s.mass) : 0;
    var thrustAccTan = thrustAcc * Math.cos(thetaRad);
    var thrustAccRad = thrustAcc * Math.sin(thetaRad);
    var thrustAx = thrustAccTan * tanX + thrustAccRad * radX;
    var thrustAy = thrustAccTan * tanY + thrustAccRad * radY;

    // Gravity acceleration: -mu/r^2 toward origin
    var gravFactor = -mu / (r * r * r);
    var gravAx = gravFactor * wx;
    var gravAy = gravFactor * wy;

    var ax = thrustAx + gravAx;
    var ay = thrustAy + gravAy;

    // Velocity Verlet integration
    var hvx = wvx + ax * dt * 0.5;
    var hvy = wvy + ay * dt * 0.5;
    var nwx = wx + hvx * dt;
    var nwy = wy + hvy * dt;

    var nr = Math.sqrt(nwx * nwx + nwy * nwy);
    if (nr < 1) nr = 1;

    // Recompute acceleration at new position
    var nInvR = 1 / nr;
    var nRadX = nwx * nInvR;
    var nRadY = nwy * nInvR;
    var nTanX = nwy * nInvR;
    var nTanY = -nwx * nInvR;

    // Thrust direction stays the same for this step (no re-guidance mid-step)
    var nThrustAx = thrustAccTan * nTanX + thrustAccRad * nRadX;
    var nThrustAy = thrustAccTan * nTanY + thrustAccRad * nRadY;
    var nGravFactor = -mu / (nr * nr * nr);
    var nGravAx = nGravFactor * nwx;
    var nGravAy = nGravFactor * nwy;
    var nax = nThrustAx + nGravAx;
    var nay = nThrustAy + nGravAy;

    var nvx = hvx + nax * dt * 0.5;
    var nvy = hvy + nay * dt * 0.5;

    // Convert to surface coordinates
    var altitude = nr - R;
    var angle = Math.atan2(nwx, nwy);
    var surfX = angle * R;
    var surfY = altitude;

    // Surface-frame velocity
    var sInvR = 1 / nr;
    var sRadX = nwx * sInvR;
    var sRadY = nwy * sInvR;
    var sTanX = nwy * sInvR;
    var sTanY = -nwx * sInvR;
    var surfVx = nvx * sTanX + nvy * sTanY;  // tangential
    var surfVy = nvx * sRadX + nvy * sRadY;  // radial outward

    s.wx = nwx;
    s.wy = nwy;
    s.wvx = nvx;
    s.wvy = nvy;
    s.x = surfX;
    s.y = surfY;
    s.vx = surfVx;
    s.vy = surfVy;

    // Ground impact check: altitude <= 0 and moving inward
    if (altitude <= 0 && surfVy < 0) {
      // Interpolate exact landing
      if (state.y > 0 && state.y !== s.y) {
        var alpha = state.y / (state.y - s.y);
        s.x = state.x + alpha * (s.x - state.x);
      } else {
        s.x = state.x;
      }
      s.y = 0;
      s.vy = 0;
      s.vx = 0;
      s.engineOn = false;
      // Snap world coords to surface
      var landAngle = s.x / R;
      s.wx = R * Math.sin(landAngle);
      s.wy = R * Math.cos(landAngle);
      s.wvx = 0;
      s.wvy = 0;
    }

    return s;
  }

  // ── Flat-earth fallback ──

  // ── 4) Acceleration ──
  var flatAx, flatAy;
  if (s.mass > 0 && effectiveThrust > 0) {
    flatAx = (effectiveThrust / s.mass) * Math.cos(thetaRad);
    flatAy = (effectiveThrust / s.mass) * Math.sin(thetaRad) - gravity;
  } else {
    flatAx = 0;
    flatAy = -gravity;
  }

  // ── 5) Semi-implicit Euler integration ──
  // v += a·dt
  s.vx += flatAx * dt;
  s.vy += flatAy * dt;
  // r += v·dt  (using updated velocity)
  s.x += s.vx * dt;
  s.y += s.vy * dt;

  // ── 7) Ground impact check ──
  if (s.y <= 0 && s.vy < 0) {
    // Interpolate exact impact x only when crossing from above ground.
    if (state.y > 0 && state.y !== s.y) {
      var alpha = state.y / (state.y - s.y);
      s.x = state.x + alpha * (s.x - state.x);
    } else {
      s.x = state.x;
    }
    s.y = 0;
    s.vy = 0;
    s.vx = 0; // stopped
    s.engineOn = false;
  }

  return s;
}

// ── Pre-launch computation helpers ─────────────────────────────────────────
//
// These compute what the UI needs to show in the pre-launch readouts
// WITHOUT creating or stepping a rocket state.

/**
 * Compute all pre-launch readouts from user config + gravity.
 *
 * @param {Object} config  Same shape as createRocketState config
 * @param {number} gravity Local gravity (m/s²)
 * @returns {Object} { thrust, mdot, Isp, tw, burnTime, deltaV, ve, m0 }
 */
function computePreLaunch(config, gravity) {
  var At = throatAreaFromDiameter(config.throatDia_mm);
  var Pc_Pa = config.Pc_bar * 1e5;
  var etaC = (config.etaC !== undefined) ? config.etaC : 0.95;
  var etaN = (config.etaN !== undefined) ? config.etaN : 0.95;
  var Pa_Pa = (config.Pa_Pa !== undefined) ? config.Pa_Pa : 101325;

  var perf = RocketPropellants.lookupPerformance(
    config.propellantId, config.MR, Pc_Pa, config.epsilon, Pa_Pa
  );

  var cStarEff = etaC * perf.cStar;
  var CfEff = etaN * perf.Cf;
  var mdot = computeMassFlow(Pc_Pa, At, cStarEff);
  var F = computeThrust(CfEff, Pc_Pa, At);
  var Isp = computeIsp(F, mdot);
  var ve = computeExhaustVelocity(Isp);
  var m0 = config.dryMass + config.propMass;
  var mf = config.dryMass;
  var tw = computeThrustToWeight(F, m0, gravity);
  var burnTime = computeBurnTime(config.propMass, mdot);
  var deltaV = computeDeltaV(Isp, m0, mf);

  return {
    thrust: F,
    mdot: mdot,
    Isp: Isp,
    ve: ve,
    tw: tw,
    burnTime: burnTime,
    deltaV: deltaV,
    m0: m0,
    cStar: cStarEff,
    Cf: CfEff,
    At: At,
    Pc_Pa: Pc_Pa
  };
}

/**
 * Numerically predict the complete rocket trajectory from initial settings.
 * Uses the SAME stepRocket integrator as live flight, but at fixed dt.
 *
 * @param {Object} config   Same shape as createRocketState config
 * @param {number} gravity  Local gravity (m/s²)
 * @param {Object} [options]
 *   guidance      {Object} Pre-built guidance object (optional)
 *   dt            {number} Fixed simulation step in seconds (default 1/120)
 *   maxTime       {number} Max simulated seconds before bailing out (default 600)
 *   startX        {number} Launch x position in metres (default 0)
 *   startY        {number} Launch y position in metres (default 0)
 *   planetRadius  {number} Planet radius in metres (enables radial gravity)
 * @returns {Object}
 *   {
 *     fizzled, complete, time, burnTime,
 *     launchX, launchY,
 *     minX, maxX, maxHeight,
 *     downrange, flightTime,
 *     landingX, landingY
 *   }
 */
function predictTrajectory(config, gravity, options) {
  options = options || {};

  var dt = (options.dt && options.dt > 0) ? options.dt : (1 / 120);
  var maxTime = (options.maxTime && options.maxTime > 0) ? options.maxTime : 600;
  var launchX = (typeof options.startX === 'number') ? options.startX : 0;
  var launchY = (typeof options.startY === 'number') ? options.startY : 0;
  var guidance = options.guidance || buildGuidance(config);
  var planetRadius = (typeof options.planetRadius === 'number' && options.planetRadius > 0)
    ? options.planetRadius : (config.planetRadius || 0);

  // Pass planetRadius to the rocket state so stepRocket uses radial gravity
  var configWithRadius = {};
  for (var key in config) {
    if (config.hasOwnProperty(key)) configWithRadius[key] = config[key];
  }
  (configWithRadius as any).planetRadius = planetRadius;

  var state = createRocketState(configWithRadius);
  state.x = launchX;
  state.y = launchY;
  // If planetRadius, update world-space coords to match launch position
  if (planetRadius > 0) {
    var theta0 = launchX / planetRadius;
    var alt0 = planetRadius + launchY;
    state.wx = alt0 * Math.sin(theta0);
    state.wy = alt0 * Math.cos(theta0);
  }

  var minX = launchX;
  var maxX = launchX;
  var maxHeight = Math.max(0, launchY);
  var burnTime = 0;
  var complete = false;

  var maxSteps = Math.max(1, Math.ceil(maxTime / dt));
  for (var i = 0; i < maxSteps; i++) {
    var engineWasOn = state.engineOn;
    state = stepRocket(state, dt, gravity, guidance);

    if (state.fizzled) {
      return {
        fizzled: true,
        complete: true,
        time: state.time,
        burnTime: 0,
        launchX: launchX,
        launchY: launchY,
        minX: launchX,
        maxX: launchX,
        maxHeight: Math.max(0, launchY),
        downrange: 0,
        flightTime: 0,
        landingX: launchX,
        landingY: launchY
      };
    }

    if (state.x < minX) minX = state.x;
    if (state.x > maxX) maxX = state.x;
    if (state.y > maxHeight) maxHeight = state.y;

    if (engineWasOn && !state.engineOn && burnTime === 0) {
      burnTime = state.time;
    }

    // Guard against pathological settings producing non-finite states.
    if (!isFinite(state.x) || !isFinite(state.y) ||
        !isFinite(state.vx) || !isFinite(state.vy)) {
      break;
    }

    if (state.y <= 0 && state.vy <= 0 && state.time > 0.2) {
      complete = true;
      break;
    }
  }

  if (burnTime === 0 && !state.engineOn) {
    burnTime = state.time;
  }

  return {
    fizzled: false,
    complete: complete,
    time: state.time,
    burnTime: burnTime,
    launchX: launchX,
    launchY: launchY,
    minX: minX,
    maxX: maxX,
    maxHeight: Math.max(0, maxHeight),
    downrange: Math.max(0, state.x - launchX),
    flightTime: state.time,
    landingX: state.x,
    landingY: Math.max(0, state.y)
  };
}

// ── Expose namespace ───────────────────────────────────────────────────────
export const RocketPhysics = {
  // Constants
  G0: G0,

  // Core propulsion
  computeMassFlow: computeMassFlow,
  computeThrust: computeThrust,
  computeIsp: computeIsp,
  computeExhaustVelocity: computeExhaustVelocity,

  // Vehicle
  createRocketState: createRocketState,
  stepRocket: stepRocket,

  // Guidance
  guidanceFixed: guidanceFixed,
  guidancePitchProgram: guidancePitchProgram,
  guidanceProgradeLock: guidanceProgradeLock,
  buildGuidance: buildGuidance,

  // Tsiolkovsky comparator
  computeDeltaV: computeDeltaV,

  // Derived helpers
  computeThrustToWeight: computeThrustToWeight,
  computeBurnTime: computeBurnTime,
  solveThroatForThrust: solveThroatForThrust,
  throatAreaFromDiameter: throatAreaFromDiameter,

  // Pre-launch computation
  computePreLaunch: computePreLaunch,
  predictTrajectory: predictTrajectory
};
