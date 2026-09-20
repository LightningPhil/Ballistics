import { RocketPropellants } from './rocket_propellants.ts';
import { classifyTrajectory, pressureAtAltitude, resolveEnvironment } from './environment.ts';
import type { Environment } from './environment.ts';

/** Pure spherical/flat rocket model. Rendering time never enters this solver.
 * Each powered segment integrates F/m with the logarithmic rocket equation;
 * burnout splits the step into powered and unpowered portions. Gravity uses
 * velocity Verlet and guidance/ambient pressure use midpoint estimates.
 * No drag, planetary rotation, flow separation or mixture chemistry is modelled.
 */
const G0 = 9.80665;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function computeMassFlow(Pc_Pa, At, cStarEff) {
  if (!(cStarEff > 0) || !(Pc_Pa > 0) || !(At > 0)) return 0;
  const flow = Pc_Pa * At / cStarEff;
  return Number.isFinite(flow) ? flow : 0;
}
function computeThrust(CfEff, Pc_Pa, At) {
  const force = CfEff * Pc_Pa * At;
  return Number.isFinite(force) ? Math.max(0, force) : 0;
}
function computeIsp(F, mdot, g0 = G0) {
  return mdot > 0 && g0 > 0 ? F / (mdot * g0) : 0;
}
function computeExhaustVelocity(Isp, g0 = G0) { return g0 * Isp; }
function computeDeltaV(Isp, m0, mf, g0 = G0) {
  return mf > 0 && m0 > mf ? g0 * Isp * Math.log(m0 / mf) : 0;
}
function computeThrustToWeight(F, m0, g) {
  if (!(m0 > 0) || g < 0) return 0;
  return g === 0 ? (F > 0 ? Infinity : 0) : F / (m0 * g);
}
function computeBurnTime(mProp, mdot) { return mdot > 0 ? Math.max(0, mProp) / mdot : Infinity; }
function solveThroatForThrust(Ftarget, CfEff, Pc_Pa) {
  return CfEff > 0 && Pc_Pa > 0 ? Math.max(0, Ftarget) / (CfEff * Pc_Pa) : 0;
}
function throatAreaFromDiameter(d_mm) {
  return Number.isFinite(d_mm) && d_mm > 0 ? Math.PI * (d_mm / 2000) ** 2 : 0;
}

export interface Guidance {
  mode: string;
  getAngle(state: any): number;
  boundaries?: number[];
}
function guidanceFixed(theta0): Guidance { return { mode: 'fixed', getAngle: () => theta0 }; }
function guidancePitchProgram(theta0, thetaF, t1, t2): Guidance {
  return { mode: 'pitch_program', boundaries: [t1, t2], getAngle: state => {
    if (t2 <= t1) return state.time < t1 ? theta0 : thetaF;
    const fraction = Math.max(0, Math.min(1, (state.time - t1) / (t2 - t1)));
    return theta0 + (thetaF - theta0) * fraction;
  } };
}
function guidanceProgradeLock(vMin, fallbackTheta): Guidance {
  return { mode: 'prograde_lock', getAngle: state => {
    if (Math.hypot(state.vx, state.vy) < Math.max(0.001, vMin)) return fallbackTheta;
    return Math.atan2(state.vy, state.vx) * RAD_TO_DEG;
  } };
}
function buildGuidance(config): Guidance {
  if (config.guidanceMode === 'pitch_program') {
    return guidancePitchProgram(config.launchAngle, config.pitchEnd, config.pitchT1, config.pitchT2);
  }
  if (config.guidanceMode === 'prograde_lock') {
    return guidanceProgradeLock(config.progradeVmin ?? 10, config.launchAngle);
  }
  return guidanceFixed(config.launchAngle);
}

function environmentForConfig(config, gravity?): Environment | null {
  if (config.environment) return { ...config.environment };
  // Explicit pressure remains a constant-pressure legacy laboratory option.
  // Normal app runs pass a complete environment so altitude affects thrust.
  if (config.Pa_Pa !== undefined) return null;
  if (Number.isFinite(gravity)) return resolveEnvironment(gravity);
  if (Number.isFinite(config.gravity)) return resolveEnvironment(config.gravity);
  return null;
}
function ambientPressure(state, altitude) {
  return state.environment ? pressureAtAltitude(state.environment, altitude) : state.Pa_Pa;
}
function engineAt(state, altitude) {
  const pressure = ambientPressure(state, altitude);
  const perf = RocketPropellants.lookupPerformance(state.propellantId, state.MR, state.Pc_Pa, state.epsilon, pressure);
  const mdot = perf.choked
    ? computeMassFlow(state.Pc_Pa, state.At, state.etaC * perf.cStar)
    : 0;
  const thrust = computeThrust(state.etaN * perf.Cf, state.Pc_Pa, state.At);
  return { pressure, mdot, thrust, Isp: computeIsp(thrust, mdot),
    flowRegime: perf.flowRegime, effectiveEpsilon: perf.effectiveEpsilon };
}

function createRocketState(config) {
  if (!Number.isFinite(config.dryMass) || config.dryMass <= 0 ||
      !Number.isFinite(config.propMass) || config.propMass < 0 ||
      !Number.isFinite(config.launchAngle)) throw new RangeError('Rocket mass and launch angle must be finite; dry mass must be positive.');
  const environment = environmentForConfig(config);
  const radius = Math.max(0, config.planetRadius ?? environment?.radius ?? 0);
  const state = {
    x: 0, y: 0, vx: 0, vy: 0, wx: 0, wy: radius, wvx: 0, wvy: 0,
    planetRadius: radius, environment,
    mDry: config.dryMass, mProp: config.propMass, mPropInitial: config.propMass,
    propellantId: config.propellantId, MR: config.MR, Pc_Pa: config.Pc_bar * 1e5,
    epsilon: config.epsilon, At: throatAreaFromDiameter(config.throatDia_mm),
    etaC: Math.max(0, Math.min(1, config.etaC ?? 0.95)),
    etaN: Math.max(0, Math.min(1, config.etaN ?? 0.95)),
    Pa_Pa: environment ? environment.surfacePressure : (config.Pa_Pa ?? 101325),
    engineOn: config.propMass > 0, thrustMagnitude: 0, attemptedThrust: 0, mdot: 0, Isp: 0,
    flowRegime: 'off', effectiveEpsilon: 0,
    theta: config.launchAngle, time: 0, totalImpulse: 0, idealDeltaV: 0,
    // Integral of the gravity acceleration vector; retained for honest diagnostics.
    gravityImpulseX: 0, gravityImpulseY: 0,
    launched: false, fizzled: false, mass: config.dryMass + config.propMass,
    outcome: 'flight' as 'flight' | 'impact' | 'no-liftoff', outcomeReason: '',
    burnoutTime: null as number | null, burnoutSpeed: null as number | null,
    apexTime: null as number | null, apexHeight: null as number | null,
    impactTime: null as number | null, impactSpeed: null as number | null,
    impactVx: null as number | null, impactVy: null as number | null,
  };
  const engine = engineAt(state, 0);
  state.thrustMagnitude = state.engineOn ? engine.thrust : 0;
  state.mdot = engine.mdot;
  state.Isp = engine.Isp;
  state.flowRegime = engine.flowRegime;
  state.effectiveEpsilon = engine.effectiveEpsilon;
  return state;
}
export type RocketState = ReturnType<typeof createRocketState>;

/** Local tangential/radial frame and inverse-square gravity in world space. */
function frame(state, gravity) {
  const radius = state.planetRadius;
  if (!(radius > 0)) return { px: state.x, py: state.y, vx: state.vx, vy: state.vy,
    tx: 1, ty: 0, rx: 0, ry: 1, gx: 0, gy: -gravity };
  const r = Math.max(1, Math.hypot(state.wx, state.wy));
  const factor = -gravity * radius * radius / (r * r * r);
  return { px: state.wx, py: state.wy, vx: state.wvx, vy: state.wvy,
    tx: state.wy / r, ty: -state.wx / r, rx: state.wx / r, ry: state.wy / r,
    gx: factor * state.wx, gy: factor * state.wy };
}
function setKinematics(state, px, py, vx, vy) {
  if (!(state.planetRadius > 0)) {
    state.x = px; state.y = py; state.vx = vx; state.vy = vy;
    return;
  }
  const r = Math.max(1, Math.hypot(px, py));
  const angle = Math.atan2(px, py);
  // Unwrap downrange around the planet so an orbit does not jump at longitude pi.
  const oldAngle = state.x / state.planetRadius;
  let delta = angle - oldAngle;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  state.x += delta * state.planetRadius;
  state.y = r - state.planetRadius;
  state.vx = (vx * py - vy * px) / r;
  state.vy = (vx * px + vy * py) / r;
  state.wx = px; state.wy = py; state.wvx = vx; state.wvy = vy;
}
function thrustDirection(state, guidance, gravity) {
  const local = frame(state, gravity);
  const angle = guidance.getAngle(state) * DEG_TO_RAD;
  return { x: Math.cos(angle) * local.tx + Math.sin(angle) * local.rx,
    y: Math.cos(angle) * local.ty + Math.sin(angle) * local.ry };
}

/** Exact constant-direction thrust integrals for linearly decreasing mass.
 * The series prevents cancellation in position when very little fuel burns.
 */
function thrustIntegrals(mass, mdot, thrust, duration) {
  if (!(thrust > 0) || !(mdot > 0) || !(duration > 0)) return { dv: 0, displacement: 0 };
  const fraction = Math.min(1 - Number.EPSILON, mdot * duration / mass);
  const logRatio = -Math.log1p(-fraction);
  const ve = thrust / mdot;
  const positionFraction = fraction < 1e-4
    ? fraction / 2 + fraction * fraction / 6 + fraction ** 3 / 12 + fraction ** 4 / 20
    : 1 - (1 - fraction) * logRatio / fraction;
  return { dv: ve * logRatio, displacement: ve * duration * positionFraction };
}

/** Advance a segment whose duration cannot cross fuel depletion. No events here
 * so bisection can evaluate the identical continuous segment at intermediate t.
 */
function advanceSegment(state, duration, gravity, guidance): RocketState {
  const next = { ...state };
  const local = frame(state, gravity);
  const burning = state.engineOn && state.mProp > 0;
  const initialEngine = engineAt(state, state.y);
  const mdot = burning ? initialEngine.mdot : 0;
  const initialDirection = thrustDirection(state, guidance, gravity);
  const half = duration / 2;
  const firstHalf = thrustIntegrals(state.mass, mdot, burning ? initialEngine.thrust : 0, half);
  const midpoint = { ...state, time: state.time + half };
  setKinematics(midpoint,
    local.px + local.vx * half + 0.5 * local.gx * half * half + initialDirection.x * firstHalf.displacement,
    local.py + local.vy * half + 0.5 * local.gy * half * half + initialDirection.y * firstHalf.displacement,
    local.vx + local.gx * half + initialDirection.x * firstHalf.dv,
    local.vy + local.gy * half + initialDirection.y * firstHalf.dv);
  const engine = burning ? engineAt(state, midpoint.y)
    : { ...initialEngine, thrust: 0, mdot: 0, Isp: 0, flowRegime: 'off' };
  const direction = thrustDirection(midpoint, guidance, gravity);
  const integrals = thrustIntegrals(state.mass, mdot, engine.thrust, duration);
  const px = local.px + local.vx * duration + 0.5 * local.gx * duration * duration + direction.x * integrals.displacement;
  const py = local.py + local.vy * duration + 0.5 * local.gy * duration * duration + direction.y * integrals.displacement;
  setKinematics(next, px, py, local.vx, local.vy);
  const endpoint = frame(next, gravity);
  const gravityX = 0.5 * (local.gx + endpoint.gx) * duration;
  const gravityY = 0.5 * (local.gy + endpoint.gy) * duration;
  // setKinematics unwraps relative to next.x, which is already the endpoint here.
  setKinematics(next, px, py, local.vx + gravityX + direction.x * integrals.dv,
    local.vy + gravityY + direction.y * integrals.dv);
  next.time = state.time + duration;
  next.mProp = Math.max(0, state.mProp - mdot * duration);
  next.mass = state.mDry + next.mProp;
  next.totalImpulse = state.totalImpulse + engine.thrust * duration;
  next.idealDeltaV = state.idealDeltaV + integrals.dv;
  next.gravityImpulseX = state.gravityImpulseX + gravityX;
  next.gravityImpulseY = state.gravityImpulseY + gravityY;
  next.Pa_Pa = ambientPressure(next, next.y);
  next.thrustMagnitude = engine.thrust;
  next.mdot = mdot;
  next.Isp = engine.Isp;
  next.flowRegime = engine.flowRegime;
  next.effectiveEpsilon = engine.effectiveEpsilon;
  next.theta = guidance.getAngle(next);
  return next;
}

function refineEvent(state, duration, gravity, guidance, above: (sample: RocketState) => boolean) {
  let lo = 0, hi = duration;
  for (let i = 0; i < 38; i++) {
    const mid = (lo + hi) / 2;
    if (above(advanceSegment(state, mid, gravity, guidance))) lo = mid; else hi = mid;
  }
  return advanceSegment(state, (lo + hi) / 2, gravity, guidance);
}
function segmentWithEvents(state, duration, gravity, guidance): RocketState {
  let next = advanceSegment(state, duration, gravity, guidance);
  if (state.vy > 0 && next.vy <= 0) {
    const apex = refineEvent(state, duration, gravity, guidance, sample => sample.vy > 0);
    if (next.apexHeight === null || apex.y > next.apexHeight) {
      next.apexTime = apex.time;
      next.apexHeight = apex.y;
    }
  }
  if (next.y <= 0 && next.vy < 0) {
    const contact = refineEvent(state, duration, gravity, guidance, sample => sample.y > 0);
    next = { ...contact, apexTime: next.apexTime, apexHeight: next.apexHeight,
      outcome: 'impact', outcomeReason: 'The rocket reached the surface.', y: 0,
      impactTime: contact.time, impactSpeed: Math.hypot(contact.vx, contact.vy),
      impactVx: contact.vx, impactVy: contact.vy,
      vx: 0, vy: 0, wvx: 0, wvy: 0, engineOn: false, thrustMagnitude: 0, mdot: 0 };
    if (next.planetRadius > 0) {
      const angle = next.x / next.planetRadius;
      next.wx = next.planetRadius * Math.sin(angle);
      next.wy = next.planetRadius * Math.cos(angle);
    }
    next.Pa_Pa = ambientPressure(next, 0);
  }
  return next;
}

function stepRocket(state, dt, gravity, guidance = guidanceFixed(state.theta)): RocketState {
  if (!Number.isFinite(dt) || dt <= 0 || state.outcome === 'impact' || state.fizzled) return { ...state };
  if (!Number.isFinite(gravity) || gravity < 0) throw new RangeError('Gravity must be finite and non-negative.');
  let next: RocketState = { ...state };
  // The standard experiment shuts down immediately if ignition cannot lift it.
  // Burning fuel on the pad until a later liftoff is intentionally not simulated.
  if (!state.launched) {
    const engine = engineAt(state, state.y);
    const upward = engine.thrust * Math.sin(guidance.getAngle(state) * DEG_TO_RAD);
    const localWeight = state.mass * Math.hypot(frame(state, gravity).gx, frame(state, gravity).gy);
    if (!state.engineOn || !(engine.mdot > 0) || !(upward > localWeight)) {
      return { ...state, engineOn: false, fizzled: true, outcome: 'no-liftoff',
        outcomeReason: !state.engineOn ? 'No propellant is available.' :
          'Upward thrust cannot overcome weight at ignition. The engine was shut down; no pad burn is simulated.',
        attemptedThrust: engine.thrust, thrustMagnitude: 0, mdot: 0 };
    }
    next.launched = true;
  }
  let remaining = dt;
  // Split also at explicit pitch-program boundaries. There are at most two,
  // followed by one depletion boundary, so this loop is strictly bounded.
  for (let segment = 0; segment < 8 && remaining > 1e-12; segment++) {
    let duration = remaining;
    let fuelEnd = false;
    if (next.engineOn && next.mProp > 0) {
      const flow = engineAt(next, next.y).mdot;
      if (!(flow > 0)) {
        next.engineOn = false;
        next.thrustMagnitude = 0;
      } else {
        const fuelDuration = next.mProp / flow;
        if (fuelDuration <= duration) { duration = fuelDuration; fuelEnd = true; }
      }
    }
    for (const boundary of guidance.boundaries ?? []) {
      const distance = boundary - next.time;
      if (distance > 1e-10 && distance < duration) { duration = distance; fuelEnd = false; }
    }
    next = segmentWithEvents(next, duration, gravity, guidance);
    if (next.outcome === 'impact') return next;
    if (fuelEnd) {
      next.mProp = 0;
      next.mass = next.mDry;
      next.engineOn = false;
      next.burnoutTime = next.time;
      next.burnoutSpeed = Math.hypot(next.vx, next.vy);
      next.thrustMagnitude = 0;
      next.mdot = 0;
    }
    remaining -= duration;
  }
  return next;
}

function computePreLaunch(config, gravity) {
  const environment = environmentForConfig(config, gravity);
  const state = createRocketState({ ...config, ...(environment ? { environment } : {}) });
  const engine = engineAt(state, 0);
  const mass = state.mass;
  const tw = computeThrustToWeight(engine.thrust, mass, gravity);
  const verticalThrust = engine.thrust * Math.sin(buildGuidance(config).getAngle(state) * DEG_TO_RAD);
  const verticalTw = computeThrustToWeight(Math.max(0, verticalThrust), mass, gravity);
  return { thrust: engine.thrust, mdot: engine.mdot, Isp: engine.Isp,
    ve: computeExhaustVelocity(engine.Isp), tw, verticalTw,
    canLaunch: state.engineOn && engine.mdot > 0 && verticalThrust > mass * gravity,
    burnTime: computeBurnTime(state.mProp, engine.mdot),
    deltaV: computeDeltaV(engine.Isp, mass, state.mDry), m0: mass,
    cStar: engine.mdot > 0 ? state.Pc_Pa * state.At / engine.mdot : 0,
    Cf: state.Pc_Pa * state.At > 0 ? engine.thrust / (state.Pc_Pa * state.At) : 0,
    At: state.At, Pc_Pa: state.Pc_Pa, pressure: engine.pressure,
    flowRegime: engine.flowRegime, effectiveEpsilon: engine.effectiveEpsilon };
}

function predictTrajectory(config, gravity, options: any = {}) {
  const dt = Number.isFinite(options.dt) && options.dt > 0 ? options.dt : 1 / 120;
  const maxTime = Number.isFinite(options.maxTime) && options.maxTime > 0 ? Math.min(86400, options.maxTime) : 3600;
  const launchX = options.startX ?? 0, launchY = options.startY ?? 0;
  const environment = environmentForConfig(config, gravity);
  const planetRadius = options.planetRadius ?? config.planetRadius ?? environment?.radius ?? 0;
  const guidance = options.guidance ?? buildGuidance(config);
  let state = createRocketState({ ...config, environment, planetRadius });
  state.x = launchX; state.y = launchY;
  if (planetRadius > 0) {
    state.wx = (planetRadius + launchY) * Math.sin(launchX / planetRadius);
    state.wy = (planetRadius + launchY) * Math.cos(launchX / planetRadius);
  }
  let minX = launchX, maxX = launchX, maxHeight = Math.max(0, launchY);
  let status = 'limit', complete = false;
  const maxSteps = Math.min(500000, Math.ceil(maxTime / dt));
  for (let i = 0; i < maxSteps && state.time < maxTime; i++) {
    state = stepRocket(state, Math.min(dt, maxTime - state.time), gravity, guidance);
    if (![state.x, state.y, state.vx, state.vy].every(Number.isFinite)) { status = 'invalid'; break; }
    minX = Math.min(minX, state.x); maxX = Math.max(maxX, state.x);
    maxHeight = Math.max(maxHeight, state.y, state.apexHeight ?? 0);
    if (state.outcome !== 'flight') { status = state.outcome; complete = true; break; }
    const classification = classifyTrajectory(state, gravity);
    if (classification.kind === 'orbit' || classification.kind === 'escape') {
      status = classification.kind; complete = true; break;
    }
  }
  return { fizzled: state.fizzled, complete, status, time: state.time,
    burnTime: state.burnoutTime, burnoutSpeed: state.burnoutSpeed,
    apexTime: state.apexTime, apexHeight: state.apexHeight,
    impactTime: state.impactTime, impactSpeed: state.impactSpeed,
    launchX, launchY, minX, maxX, maxHeight,
    downrange: state.x - launchX, flightTime: state.time,
    landingX: state.outcome === 'impact' ? state.x : null,
    landingY: state.outcome === 'impact' ? 0 : null,
    finalState: state, classification: classifyTrajectory(state, gravity) };
}

export const RocketPhysics = {
  G0, computeMassFlow, computeThrust, computeIsp, computeExhaustVelocity,
  createRocketState, stepRocket, guidanceFixed, guidancePitchProgram,
  guidanceProgradeLock, buildGuidance, computeDeltaV, computeThrustToWeight,
  computeBurnTime, solveThroatForThrust, throatAreaFromDiameter,
  computePreLaunch, predictTrajectory, classifyTrajectory,
};
