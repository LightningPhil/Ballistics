/** Shared environment for the solver, preview and planet renderer.
 * Pressure is a deliberately simple exponential atmosphere; drag is not modelled.
 * Worlds without a solid surface use a fictional launch platform at the
 * stated reference level.
 * Approximate pressure/scale-height data: NASA NSSDCA planetary fact sheets,
 * https://nssdc.gsfc.nasa.gov/planetary/factsheet/ (accessed September 2026).
 * The radius/gravity pairs retain the app's existing spherical planet model.
 */
export interface Environment {
  name: string;
  gravity: number;
  radius: number;
  surfacePressure: number;
  scaleHeight: number;
  isGas: boolean;
  interpolated: boolean;
}

export const ENVIRONMENTS: readonly Environment[] = Object.freeze([
  { name: 'pluto', gravity: 0.62, radius: 1188300, surfacePressure: 1, scaleHeight: 50000, isGas: false, interpolated: false },
  { name: 'ganymede', gravity: 1.428, radius: 2634100, surfacePressure: 0, scaleHeight: 1, isGas: false, interpolated: false },
  { name: 'moon', gravity: 1.62, radius: 1737400, surfacePressure: 0, scaleHeight: 1, isGas: false, interpolated: false },
  { name: 'mercury', gravity: 3.7, radius: 2439700, surfacePressure: 0, scaleHeight: 1, isGas: false, interpolated: false },
  { name: 'mars', gravity: 3.72, radius: 3389500, surfacePressure: 636, scaleHeight: 11000, isGas: false, interpolated: false },
  { name: 'venus', gravity: 8.87, radius: 6051800, surfacePressure: 9200000, scaleHeight: 15900, isGas: false, interpolated: false },
  { name: 'uranus', gravity: 9.01, radius: 25362000, surfacePressure: 100000, scaleHeight: 27700, isGas: true, interpolated: false },
  { name: 'earth', gravity: 9.81, radius: 6371000, surfacePressure: 101325, scaleHeight: 8500, isGas: false, interpolated: false },
  { name: 'saturn', gravity: 11.19, radius: 58232000, surfacePressure: 100000, scaleHeight: 59500, isGas: true, interpolated: false },
  { name: 'neptune', gravity: 11.27, radius: 24622000, surfacePressure: 100000, scaleHeight: 19700, isGas: true, interpolated: false },
  { name: 'jupiter', gravity: 25.92, radius: 69911000, surfacePressure: 100000, scaleHeight: 27000, isGas: true, interpolated: false },
  { name: 'sun', gravity: 274, radius: 695700000, surfacePressure: 12500, scaleHeight: 150000, isGas: true, interpolated: false },
].map(environment => Object.freeze(environment)));

/** Radius interpolation exactly matches the historical renderer. Intermediate
 * gravity values are explicitly imaginary worlds, including their atmosphere.
 */
export function resolveEnvironment(gravity: number): Environment {
  const g = Number.isFinite(gravity) ? Math.max(0, gravity) : 9.81;
  const last = ENVIRONMENTS[ENVIRONMENTS.length - 1];
  if (g <= ENVIRONMENTS[0].gravity) return { ...ENVIRONMENTS[0], gravity: g, interpolated: g !== ENVIRONMENTS[0].gravity };
  if (g >= last.gravity) return { ...last, gravity: g, interpolated: g !== last.gravity };
  for (let i = 0; i < ENVIRONMENTS.length - 1; i++) {
    const lo = ENVIRONMENTS[i], hi = ENVIRONMENTS[i + 1];
    if (g < lo.gravity || g > hi.gravity) continue;
    if (g === lo.gravity) return { ...lo };
    if (g === hi.gravity) return { ...hi };
    const t = (g - lo.gravity) / (hi.gravity - lo.gravity);
    const nearest = t <= 0.5 ? lo : hi;
    return { ...nearest, gravity: g, interpolated: true,
      radius: lo.radius + (hi.radius - lo.radius) * t,
      surfacePressure: lo.surfacePressure + (hi.surfacePressure - lo.surfacePressure) * t,
      scaleHeight: lo.scaleHeight + (hi.scaleHeight - lo.scaleHeight) * t };
  }
  return { ...ENVIRONMENTS.find(environment => environment.name === 'earth')!, gravity: g };
}

export function pressureAtAltitude(environment: Pick<Environment, 'surfacePressure' | 'scaleHeight'>, altitude: number): number {
  const base = Math.max(0, environment.surfacePressure);
  if (!Number.isFinite(base) || !Number.isFinite(altitude)) return 0;
  return base * Math.exp(-Math.max(0, altitude) / Math.max(1, environment.scaleHeight));
}

export interface OrbitClassification {
  kind: 'powered' | 'returning' | 'orbit' | 'escape' | 'unpowered';
  specificEnergy: number | null;
  periapsisAltitude: number | null;
  apoapsisAltitude: number | null;
  period: number | null;
}

/** Osculating two-body outcome, meaningful only after thrust has ended.
 * A negative-energy ellipse that intersects the ground is a returning flight,
 * not an orbit. An incoming hyperbola is not declared escaped before periapsis.
 */
export function classifyTrajectory(state: any, gravity: number): OrbitClassification {
  const empty: OrbitClassification = { kind: state.engineOn ? 'powered' : 'unpowered', specificEnergy: null, periapsisAltitude: null, apoapsisAltitude: null, period: null };
  const R = state.planetRadius;
  if (state.engineOn || !(R > 0) || !(gravity > 0)) return empty;
  const r = Math.hypot(state.wx, state.wy);
  const v2 = state.wvx * state.wvx + state.wvy * state.wvy;
  const mu = gravity * R * R;
  if (!(r >= R - 0.001) || !Number.isFinite(v2)) return empty;
  const energy = v2 / 2 - mu / r;
  const angularMomentum = state.wx * state.wvy - state.wy * state.wvx;
  const p = angularMomentum * angularMomentum / mu;
  const eccentricity = Math.sqrt(Math.max(0, 1 + 2 * energy * angularMomentum * angularMomentum / (mu * mu)));
  const periapsisAltitude = p / (1 + eccentricity) - R;
  const radialVelocity = (state.wx * state.wvx + state.wy * state.wvy) / r;
  if (energy >= 0) return { ...empty, kind: radialVelocity > 0 ? 'escape' : 'returning', specificEnergy: energy, periapsisAltitude };
  const semiMajor = -mu / (2 * energy);
  return { kind: periapsisAltitude > 1 ? 'orbit' : 'returning', specificEnergy: energy,
    periapsisAltitude, apoapsisAltitude: semiMajor * (1 + eccentricity) - R,
    period: 2 * Math.PI * Math.sqrt(semiMajor * semiMajor * semiMajor / mu) };
}
