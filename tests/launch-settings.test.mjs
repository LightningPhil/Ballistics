import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLaunchSettings, CANNON_DEFAULTS, ROCKET_DEFAULTS, setMixtureBounds } from '../src/launch-settings.ts';
import { RocketPhysics } from '../src/rocket_physics.ts';
import { Physics } from '../src/physics.ts';
import { ENVIRONMENTS, resolveEnvironment } from '../src/environment.ts';
import { recordFlight } from '../src/flight.ts';

// Model the important native range behaviour: assigning bounds can clamp value
// before the application gets to read it (the propellant-switch regression).
class Range {
  _value = '0'; _min = '0'; _max = '10000'; step = 'any';
  get value() { return this._value; }
  set value(value) { this._value = String(Math.max(Number(this.min), Math.min(Number(this.max), Number(value)))); }
  get min() { return this._min; }
  set min(value) { this._min = value; this.value = this.value; }
  get max() { return this._max; }
  set max(value) { this._max = value; this.value = this.value; }
}
function controls() {
  const nodes = new Map();
  const root = { querySelector(id) {
    if (!nodes.has(id)) nodes.set(id, id === '#rocket-propellant' ? { value:'LOX_RP1' }
      : id === '#rocket-guidance' ? { value:'fixed' } : new Range());
    return nodes.get(id);
  } };
  applyLaunchSettings(root, 'cannon', CANNON_DEFAULTS);
  applyLaunchSettings(root, 'rocket', ROCKET_DEFAULTS);
  return { root, nodes, value: id => root.querySelector(id).value };
}

test('cannon edits and resets cannot change the rocket or chosen world', () => {
  const h = controls();
  const rocket = [...h.nodes].filter(([id]) => id.includes('rocket')).map(([id, node]) => [id,node.value]);
  const world = resolveEnvironment(9.81);
  applyLaunchSettings(h.root, 'cannon', { angle:5, mass:20, force:5000, barrelLength:5, gravity:274 });
  applyLaunchSettings(h.root, 'cannon', CANNON_DEFAULTS);
  assert.deepEqual(rocket, [...h.nodes].filter(([id]) => id.includes('rocket')).map(([id,node]) => [id,node.value]));
  assert.equal(world.name, 'earth');
  assert.equal(h.nodes.has('#slider-gravity'), false, 'settings restoration does not select a world');
  assert.equal(h.value('#slider-angle'), '45');
  assert.equal(h.value('#slider-barrel'), '2');
});

test('rocket reset restores hidden workshop and guidance settings without changing the cannon', () => {
  const h = controls();
  applyLaunchSettings(h.root, 'cannon', { angle:7, mass:19, force:90, barrelLength:.5 });
  applyLaunchSettings(h.root, 'rocket', { ...ROCKET_DEFAULTS, propellantId:'LOX_LH2', MR:6.2,
    dryMass:5000, propMass:4000, launchAngle:5, Pc_bar:10, throatDia_mm:5,
    epsilon:200, etaC:.8, etaN:.8, guidanceMode:'pitch_program', pitchEnd:0, pitchT1:0, pitchT2:1, progradeVmin:100 });
  applyLaunchSettings(h.root, 'rocket', ROCKET_DEFAULTS);
  assert.equal(h.value('#rocket-propellant'), 'LOX_RP1');
  assert.equal(h.value('#slider-rocket-mr'), '2.56');
  assert.equal(h.value('#rocket-guidance'), 'fixed');
  assert.equal(h.value('#slider-rocket-drymass'), '100');
  assert.equal(h.value('#slider-rocket-pc'), '180');
  assert.equal(h.value('#slider-rocket-pitch-t1'), '5');
  assert.equal(h.value('#slider-rocket-pitch-t2'), '20');
  assert.equal(h.value('#slider-rocket-prograde-vmin'), '10');
  assert.equal(h.value('#slider-angle'), '7');
  assert.equal(h.value('#slider-mass'), '19');
});

test('switching propellant selects its useful mixture default before native range clamping', () => {
  const input = new Range(); input.value = '2.56';
  setMixtureBounds(input, 'LOX_LH2');
  assert.equal(input.value, '5.5', 'do not silently keep the clamped 4.5 boundary');
  input.value = '6.17';
  setMixtureBounds(input, 'LOX_LH2');
  assert.equal(input.value, '6.17', 'preserve a valid user/recorded mixture');
  setMixtureBounds(input, 'LOX_RP1');
  assert.equal(input.value, '2.56', 'restore the RP-1 default rather than the clamped maximum');
  assert.equal(input.step, '.01');
});

test('reset rocket takes off on all planetary presets, while the Sun still defeats it', () => {
  for (const environment of ENVIRONMENTS) {
    const config = { ...ROCKET_DEFAULTS, environment, gravity:environment.gravity, planetRadius:environment.radius };
    const pre = RocketPhysics.computePreLaunch(config, environment.gravity);
    const first = RocketPhysics.stepRocket(RocketPhysics.createRocketState(config), 1/120,
      environment.gravity, RocketPhysics.buildGuidance(config));
    assert.equal(pre.canLaunch, environment.name !== 'sun', environment.name);
    assert.equal(first.launched, environment.name !== 'sun', environment.name);
    if (environment.name === 'sun') assert.equal(first.outcome, 'no-liftoff');
    else { assert.ok(first.vy > 0, environment.name); assert.ok(pre.verticalTw > 1.8, environment.name); }
  }
});

test('default Earth recordings still fly and land after extreme cannon experiments', async () => {
  const environment = resolveEnvironment(9.81);
  const extreme = { angle:85, mass:20, force:5000, barrelLength:5, gravity:9.81, planetRadius:environment.radius, environment };
  await recordFlight('cannon', extreme, Physics.createProjectile(2,1,
    Physics.computeLaunchVelocity(extreme.force,extreme.mass,extreme.barrelLength), extreme.angle, extreme.mass, environment.radius));
  const config = { ...ROCKET_DEFAULTS, gravity:9.81, environment, planetRadius:environment.radius };
  const run = await recordFlight('rocket', config, RocketPhysics.createRocketState(config));
  assert.equal(run.outcome, 'impact');
  assert.ok(run.maxHeight > 100);
  assert.ok(run.events.some(event => event.kind === 'burnout'));
  assert.equal(run.samples.at(-1).mProp, 0);
});
