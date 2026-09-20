import { Physics } from './physics.ts';
import { RocketPhysics } from './rocket_physics.ts';

export type FlightEvent = { time: number; kind: string; label: string };
export type FlightRecord = {
  id: number; mode: 'cannon' | 'rocket'; config: Readonly<Record<string, any>>;
  samples: any[]; events: FlightEvent[]; duration: number; outcome: string;
  maxHeight: number; minX: number; maxX: number; launchX: number;
};
export const PHYSICS_STEP = 1 / 120;
export const MAX_RECORD_TIME = 21600;
let nextId = 1;

function freezeConfiguration<T>(value: T, seen = new WeakSet<object>()): T {
  if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value)) freezeConfiguration(child, seen);
    Object.freeze(value);
  }
  return value;
}

/** One canonical run; rendering rate never enters either integrator. Yield often
 * so Reset can cancel even a very long orbital/low-thrust experiment. */
export async function recordFlight(mode: FlightRecord['mode'], config: any, initial: any,
  signal?: AbortSignal, options: { maxTime?: number } = {}): Promise<FlightRecord> {
  const saved = freezeConfiguration(structuredClone(config));
  const maxTime = Number.isFinite(options.maxTime) && options.maxTime > 0
    ? Math.min(MAX_RECORD_TIME, options.maxTime) : MAX_RECORD_TIME;
  const run: FlightRecord = { id: nextId++, mode, config: saved, samples: [{ ...initial }],
    events: [{ time: 0, kind: 'launch', label: mode === 'rocket' ? 'Ignition' : 'Launch' }], duration: 0,
    outcome: 'limit', maxHeight: initial.y, minX: initial.x, maxX: initial.x, launchX: initial.x };
  const guidance = mode === 'rocket' ? RocketPhysics.buildGuidance(saved) : null;
  let state = structuredClone(initial), sampleInterval = 0.1, sampleAt = sampleInterval;
  let deadline = performance.now() + 8, classifiedAt: number | null = null;
  let classification = '';
  const eventTimes = new Set<number>([0]);
  const step = (before: any, duration: number) => mode === 'rocket'
    ? RocketPhysics.stepRocket(before, duration, saved.gravity, guidance)
    : Physics.stepProjectile(before, duration, saved.gravity);
  const addEvent = (time: number, kind: string, label: string) => {
    if (Number.isFinite(time) && !run.events.some(e => e.kind === kind && Math.abs(e.time - time) < 0.05))
      run.events.push({ time, kind, label });
  };
  const recordEventState = (before: any, time: number, fields: Record<string, any> = {}) => {
    if (!Number.isFinite(time) || time < before.time) return;
    eventTimes.add(time);
    run.samples.push({ ...step(before, Math.max(0, time - before.time)), ...fields, time });
  };
  for (let i = 0; i < Math.ceil(maxTime / PHYSICS_STEP) && state.time < maxTime; i++) {
    if (signal?.aborted) throw new DOMException('Flight cancelled', 'AbortError');
    const before = state;
    state = step(before, Math.min(PHYSICS_STEP, maxTime - before.time));
    if (![state.x, state.y, state.vx, state.vy, state.time].every(Number.isFinite)) {
      run.outcome = 'invalid'; state = before; break;
    }
    run.maxHeight = Math.max(run.maxHeight, state.y, state.apexHeight ?? 0);
    run.minX = Math.min(run.minX, state.x); run.maxX = Math.max(run.maxX, state.x);
    if (mode === 'rocket' && state.burnoutTime != null && before.burnoutTime == null) {
      addEvent(state.burnoutTime, 'burnout', 'Engine cutoff');
      recordEventState(before, state.burnoutTime, { engineOn: false, mProp: 0, mass: state.mDry,
        thrustMagnitude: 0, mdot: 0, burnoutTime: state.burnoutTime, burnoutSpeed: state.burnoutSpeed });
    }
    if (state.apexTime != null && state.apexTime !== before.apexTime && !state.fizzled) {
      addEvent(state.apexTime, 'apex', 'Highest point');
      recordEventState(before, state.apexTime, { apexTime: state.apexTime, apexHeight: state.apexHeight, vy: 0 });
    }
    if (saved.guidanceMode === 'pitch_program') {
      for (const [time, label] of [[saved.pitchT1, 'Pitch begins'], [saved.pitchT2, 'Pitch complete']] as [number, string][]) {
        if (time > before.time && time <= state.time) {
          addEvent(time, 'guidance', label); recordEventState(before, time);
        }
      }
    }
    if (state.time >= sampleAt) {
      run.samples.push({ ...state }); sampleAt = state.time + sampleInterval;
      if (run.samples.length > 16000) {
        run.samples = run.samples.filter((sample, index) => index % 2 === 0 || eventTimes.has(sample.time));
        sampleInterval *= 2;
      }
    }
    if (state.fizzled || state.outcome === 'no-liftoff') {
      run.outcome = 'no-liftoff'; addEvent(state.time, 'no-liftoff', 'No lift-off'); break;
    }
    if (state.outcome === 'impact') {
      // Keep the final incoming canonical step; contact itself has zero velocity.
      run.samples.push({ ...before });
      run.outcome = 'impact'; addEvent(state.time, 'impact', 'Surface contact'); break;
    }
    if (i % 60 === 0 && (mode === 'cannon' || !state.engineOn)) {
      const info = (mode === 'cannon' ? Physics : RocketPhysics).classifyTrajectory(state, saved.gravity);
      if ((info.kind === 'orbit' || info.kind === 'escape') && classifiedAt === null) {
        classifiedAt = state.time; classification = info.kind;
        addEvent(state.time, info.kind, info.kind === 'orbit' ? 'Orbit established' : 'Escape trajectory');
        eventTimes.add(state.time); run.samples.push({ ...state });
      }
    }
    if (classifiedAt !== null && state.time >= classifiedAt + 20) { run.outcome = classification; break; }
    if (performance.now() >= deadline) {
      await new Promise(resolve => setTimeout(resolve, 0)); deadline = performance.now() + 8;
    }
  }
  if (signal?.aborted) throw new DOMException('Flight cancelled', 'AbortError');
  run.duration = state.time;
  run.samples.push({ ...state });
  // The final state wins equal timestamps, especially a rejected ignition at t=0.
  run.samples = [...new Map(run.samples.map(sample => [sample.time, sample])).values()]
    .sort((a, b) => a.time - b.time);
  for (const event of run.events) {
    if (event.kind === 'apex' && event.time !== state.apexTime) event.label = 'Local high point';
  }
  addEvent(run.duration, 'end', run.outcome === 'limit' ? 'Observation limit' : 'Result');
  run.events.sort((a, b) => a.time - b.time);
  return run;
}

/** Rebuild the state at an inspection time with the same canonical solver used
 * to record the flight. Sparse samples keep long runs compact, but linear
 * interpolation is not valid during a high-mass-ratio burn because rocket
 * velocity varies logarithmically with mass.
 */
function resamplePhysics(run: FlightRecord, start: any, time: number): any | null {
  if ((run.mode !== 'cannon' && run.mode !== 'rocket') ||
      !run.config || !Number.isFinite(run.config.gravity) ||
      !Number.isFinite(start?.time) || start.time > time) return null;
  const guidance = run.mode === 'rocket' ? RocketPhysics.buildGuidance(run.config) : null;
  const advance = (state: any, duration: number) => run.mode === 'rocket'
    ? RocketPhysics.stepRocket(state, duration, run.config.gravity, guidance)
    : Physics.stepProjectile(state, duration, run.config.gravity);
  let state = { ...start };
  while (time - state.time > PHYSICS_STEP + 1e-12) {
    const next = advance(state, PHYSICS_STEP);
    if (!(next.time > state.time)) return null;
    state = next;
  }
  const remainder = time - state.time;
  if (remainder > 1e-12) state = advance(state, remainder);
  return { ...state, time };
}

export function sampleFlight(run: FlightRecord, time: number): any {
  const samples = run.samples;
  if (time >= run.duration) return { ...samples[samples.length - 1] };
  if (time <= 0) return { ...samples[0] };
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (samples[mid].time <= time) lo = mid; else hi = mid; }
  const a = samples[lo], b = samples[hi];
  if (Math.abs(time - a.time) <= 1e-12) return { ...a };
  const physical = resamplePhysics(run, a, time);
  if (physical) return physical;
  const fraction = (time - a.time) / (b.time - a.time);
  const state = { ...a, time };
  // Interpolate toward the incoming contact velocity, never toward the stopped
  // object. The actual contact sample then switches to its terminal state.
  const endpoint = { ...b };
  if (b.outcome === 'impact' && b.impactVx != null && b.impactVy != null) {
    endpoint.vx = b.impactVx; endpoint.vy = b.impactVy;
    if (b.planetRadius > 0) {
      const angle = b.x / b.planetRadius;
      endpoint.wvx = b.impactVx * Math.cos(angle) + b.impactVy * Math.sin(angle);
      endpoint.wvy = -b.impactVx * Math.sin(angle) + b.impactVy * Math.cos(angle);
    }
  }
  if (a.engineOn && !b.engineOn) { endpoint.thrustMagnitude = a.thrustMagnitude; endpoint.mdot = a.mdot; }
  for (const key of ['x', 'y', 'vx', 'vy', 'wx', 'wy', 'wvx', 'wvy', 'mass', 'mProp', 'totalImpulse',
    'idealDeltaV', 'thrustMagnitude', 'mdot', 'Isp', 'Pa_Pa', 'gravityImpulseX', 'gravityImpulseY']) {
    if (typeof a[key] === 'number' && typeof endpoint[key] === 'number') state[key] = a[key] + (endpoint[key] - a[key]) * fraction;
  }
  if (typeof a.theta === 'number' && typeof b.theta === 'number') {
    const difference = (b.theta - a.theta) * Math.PI / 180;
    state.theta = a.theta + Math.atan2(Math.sin(difference), Math.cos(difference)) * 180 / Math.PI * fraction;
  }
  return state;
}

export function compatibleRuns(a: FlightRecord | null, b: FlightRecord | null): boolean {
  return !!a && !!b && a.mode === b.mode && a.config.gravity === b.config.gravity &&
    a.config.planetRadius === b.config.planetRadius;
}

export function describeChanges(a: FlightRecord, b: FlightRecord): string {
  const names = { angle: 'angle', force: 'force', mass: 'mass', barrelLength: 'barrel length',
    gravity: 'gravity', dryMass: 'dry mass', propMass: 'fuel load', launchAngle: 'launch angle',
    propellantId: 'propellant', Pc_bar: 'chamber pressure', throatDia_mm: 'throat', epsilon: 'nozzle',
    MR: 'mixture', etaC: 'combustion efficiency', etaN: 'nozzle efficiency', guidanceMode: 'guidance',
    pitchEnd: 'pitch angle', pitchT1: 'pitch start', pitchT2: 'pitch finish', progradeVmin: 'prograde threshold' };
  const changed = Object.entries(names).filter(([key]) => a.config[key] !== b.config[key]).map(([, name]) => name);
  return changed.length ? `Changed: ${changed.join(', ')}` : 'Same settings — repeat experiment';
}
