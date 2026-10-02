import { RocketPropellants } from './rocket_propellants.ts';

export const CANNON_DEFAULTS = Object.freeze({ angle: 45, mass: 5, force: 500, barrelLength: 2 });
// Enough upward thrust on every planetary preset, including dense Venus air.
// The Sun's gravity still defeats this engine: that remains an experiment.
export const ROCKET_DEFAULTS = Object.freeze({
  propellantId: 'LOX_RP1', MR: 2.56, Pc_bar: 180, epsilon: 20, throatDia_mm: 15,
  dryMass: 100, propMass: 8, launchAngle: 85, guidanceMode: 'fixed',
  etaC: .95, etaN: .95, pitchEnd: 45, pitchT1: 5, pitchT2: 20, progradeVmin: 10,
});

const cannonFields = { angle: 'angle', mass: 'mass', force: 'force', barrelLength: 'barrel' };
const rocketFields = {
  MR: 'rocket-mr', Pc_bar: 'rocket-pc', epsilon: 'rocket-eps', throatDia_mm: 'rocket-dt',
  dryMass: 'rocket-drymass', propMass: 'rocket-propmass', launchAngle: 'rocket-angle',
  etaC: 'rocket-etac', etaN: 'rocket-etan', pitchEnd: 'rocket-pitch-end',
  pitchT1: 'rocket-pitch-t1', pitchT2: 'rocket-pitch-t2', progradeVmin: 'rocket-prograde-vmin',
};

/** Read the old value before changing bounds: native ranges clamp immediately. */
export function setMixtureBounds(input: HTMLInputElement, propellantId: string) {
  const propellant = RocketPropellants.getById(propellantId);
  if (!propellant) return;
  const previous = Number(input.value);
  const [min, max] = propellant.MR_bounds;
  input.min = String(min); input.max = String(max); input.step = '.01';
  input.value = String(Number.isFinite(previous) && previous >= min && previous <= max
    ? previous : propellant.MR_default);
}

/** Settings are scoped to one launcher. World selection is deliberately separate. */
export function applyLaunchSettings(root: Pick<Document, 'querySelector'>, mode: 'cannon' | 'rocket', config: Record<string, any>) {
  if (mode === 'rocket') {
    const propellant = root.querySelector<HTMLSelectElement>('#rocket-propellant')!;
    if (config.propellantId) propellant.value = config.propellantId;
    setMixtureBounds(root.querySelector<HTMLInputElement>('#slider-rocket-mr')!, propellant.value);
    if (config.guidanceMode) root.querySelector<HTMLSelectElement>('#rocket-guidance')!.value = config.guidanceMode;
  }
  const fields = mode === 'cannon' ? cannonFields : rocketFields;
  for (const [key, id] of Object.entries(fields)) {
    if (Number.isFinite(config[key])) root.querySelector<HTMLInputElement>('#slider-' + id)!.value = String(config[key]);
  }
}
