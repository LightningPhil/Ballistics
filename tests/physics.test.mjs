import test from 'node:test';
import assert from 'node:assert/strict';
import { Physics } from '../src/physics.ts';
import { RocketPhysics } from '../src/rocket_physics.ts';
import { RocketPropellants } from '../src/rocket_propellants.ts';
import { resolveEnvironment, pressureAtAltitude, classifyTrajectory } from '../src/environment.ts';

const config = {
  propellantId: 'LOX_RP1', MR: 2.56, Pc_bar: 100, epsilon: 20,
  throatDia_mm: 15, dryMass: 100, propMass: 8, launchAngle: 85,
  guidanceMode: 'fixed', etaC: 0.95, etaN: 0.95,
};
function near(actual, expected, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`);
}
function vacuumRocket(overrides = {}) {
  return RocketPhysics.createRocketState({ ...config, launchAngle: 90, Pa_Pa: 0, ...overrides });
}

test('vacuum variable-mass impulse agrees with Tsiolkovsky at 20, 60 and 120 Hz, including a dry-mass extreme', () => {
  for (const masses of [{ dryMass: 100, propMass: 8 }, { dryMass: 1, propMass: 500 }]) {
    for (const dt of [1 / 20, 1 / 60, 1 / 120]) {
      let state = vacuumRocket({ ...masses, throatDia_mm: 1500 });
      const expected = state.Isp * RocketPhysics.G0 * Math.log(state.mass / state.mDry);
      let count = 0;
      while (state.engineOn && count++ < 1000) {
        state = RocketPhysics.stepRocket(state, dt, 0, RocketPhysics.guidanceFixed(90));
      }
      assert.equal(state.engineOn, false);
      near(state.vy, expected, expected * 2e-12);
      near(state.idealDeltaV, expected, expected * 2e-12);
      assert.equal(state.mProp, 0);
      assert.equal(state.mass, masses.dryMass);
    }
  }
});

test('a step crossing depletion integrates exact burn displacement and subsequent coast', () => {
  const initial = vacuumRocket({ dryMass: 1, propMass: 500, throatDia_mm: 1500 });
  const burnTime = initial.mProp / initial.mdot;
  const ve = initial.thrustMagnitude / initial.mdot;
  const dv = ve * Math.log(initial.mass / initial.mDry);
  const duration = burnTime + 0.4;
  const expectedY = ve * (burnTime - initial.mDry / initial.mdot * Math.log(initial.mass / initial.mDry)) + dv * 0.4;
  const result = RocketPhysics.stepRocket(initial, duration, 0, RocketPhysics.guidanceFixed(90));
  near(result.burnoutTime, burnTime, 1e-12);
  near(result.burnoutSpeed, dv, 1e-8);
  near(result.time, duration, 1e-12);
  near(result.y, expectedY, 1e-8);
  near(result.totalImpulse, initial.thrustMagnitude * burnTime, 1e-7);
  assert.equal(initial.mProp, 500, 'stepping must not mutate the initial state');
});

test('pad rejection checks upward thrust at initial mass, shuts down immediately and retains fuel', () => {
  const earth = resolveEnvironment(9.81);
  for (const overrides of [{ throatDia_mm: 1 }, { launchAngle: 10 }, { propMass: 0 }]) {
    const initial = RocketPhysics.createRocketState({ ...config, ...overrides, environment: earth });
    const pre = RocketPhysics.computePreLaunch({ ...config, ...overrides, environment: earth }, earth.gravity);
    const result = RocketPhysics.stepRocket(initial, 1000, earth.gravity, RocketPhysics.buildGuidance({ ...config, ...overrides }));
    assert.equal(pre.canLaunch, false);
    assert.equal(result.outcome, 'no-liftoff');
    assert.equal(result.time, 0);
    assert.equal(result.mProp, initial.mProp);
    assert.equal(result.totalImpulse, 0);
    assert.equal(result.thrustMagnitude, 0);
    assert.ok(result.attemptedThrust >= 0);
    assert.equal(result.burnoutTime, null);
    assert.deepEqual(RocketPhysics.stepRocket(result, 1000, earth.gravity), result);
  }
});

test('a powered impact keeps incoming speed and fuel use without inventing burnout', () => {
  const initial = vacuumRocket({ launchAngle: -90 });
  Object.assign(initial, { y: 1, vy: -30, launched: true });
  const result = RocketPhysics.stepRocket(initial, 0.2, 0, RocketPhysics.guidanceFixed(-90));
  assert.equal(result.outcome, 'impact');
  assert.equal(result.burnoutTime, null);
  assert.ok(result.impactTime > 0 && result.impactTime < 1 / 30);
  assert.ok(result.impactSpeed > 30);
  near(result.impactSpeed, -result.impactVy);
  near(initial.mProp - result.mProp, initial.mdot * result.impactTime, 1e-10);
  near(result.totalImpulse, initial.thrustMagnitude * result.impactTime, 1e-7);
  assert.equal(result.vy, 0);
  assert.equal(result.engineOn, false);
});

test('flat ballistic rocket records analytical apex and contact times within a large step', () => {
  const initial = vacuumRocket({ propMass: 0 });
  Object.assign(initial, { y: 10, vy: 20, launched: true });
  const result = RocketPhysics.stepRocket(initial, 8, 9.81);
  const time = (20 + Math.sqrt(20 ** 2 + 2 * 9.81 * 10)) / 9.81;
  near(result.apexTime, 20 / 9.81, 1e-9);
  near(result.apexHeight, 10 + 20 ** 2 / (2 * 9.81), 1e-9);
  near(result.impactTime, time, 1e-9);
  near(result.impactSpeed, Math.sqrt(20 ** 2 + 2 * 9.81 * 10), 1e-8);
});

test('prograde guidance follows descending velocity and fixed means fixed', () => {
  near(RocketPhysics.guidanceProgradeLock(1, 90).getAngle({ vx: 10, vy: -10 }), -45);
  const fixed = RocketPhysics.buildGuidance({ ...config, launchAngle: 83 });
  near(fixed.getAngle({ vx: 100, vy: -100, time: 20 }), 83);
});

test('pitch-program boundaries are integrated identically when an enclosing step is split', () => {
  const initial = vacuumRocket({ propMass: 100 });
  initial.launched = true;
  initial.y = 100;
  const guidance = RocketPhysics.guidancePitchProgram(90, 45, 0.1, 0.2);
  const one = RocketPhysics.stepRocket(initial, 0.3, 0, guidance);
  let split = initial;
  for (let i = 0; i < 3; i++) split = RocketPhysics.stepRocket(split, 0.1, 0, guidance);
  near(one.x, split.x, 1e-10);
  near(one.y, split.y, 1e-10);
  near(one.vx, split.vx, 1e-10);
  near(one.vy, split.vy, 1e-10);
});

test('shared environments preserve radius interpolation and use altitude-dependent planetary pressure', () => {
  const earth = resolveEnvironment(9.81), moon = resolveEnvironment(1.62), mars = resolveEnvironment(3.72);
  assert.equal(earth.radius, 6371000);
  assert.equal(mars.radius, 3389500);
  assert.equal(pressureAtAltitude(moon, 1000), 0);
  assert.equal(pressureAtAltitude(mars, 0), 636);
  near(pressureAtAltitude(earth, earth.scaleHeight), 101325 / Math.E, 1e-10);
  const middle = resolveEnvironment((1.62 + 3.7) / 2);
  near(middle.radius, (1737400 + 2439700) / 2, 1e-8);
  assert.equal(middle.interpolated, true);
  const sea = RocketPhysics.computePreLaunch({ ...config, environment: earth }, 9.81);
  const vacuum = RocketPhysics.computePreLaunch({ ...config, environment: moon }, 1.62);
  assert.ok(vacuum.thrust > sea.thrust);
  const state = RocketPhysics.createRocketState({ ...config, environment: earth });
  Object.assign(state, { launched: true, y: 8500, wy: earth.radius + 8500 });
  const next = RocketPhysics.stepRocket(state, 1 / 120, 9.81);
  assert.ok(next.thrustMagnitude > sea.thrust);
  near(next.Pa_Pa, pressureAtAltitude(earth, next.y), 1e-8);
});

test('giant-world mean gravity and radius imply the reference gravitational parameter', () => {
  for (const [gravity, radius, expectedMu] of [
    [9.01, 25362000, 5.7940e15],
    [11.19, 58232000, 3.7931e16],
    [11.27, 24622000, 6.8351e15],
    [25.92, 69911000, 1.26687e17],
  ]) {
    const environment = resolveEnvironment(gravity);
    assert.equal(environment.radius, radius);
    assert.ok(Math.abs(gravity * radius * radius / expectedMu - 1) < 0.001);
  }
});

test('the nozzle does not invent minimum thrust when ambient pressure prevents operation', () => {
  const ordinary = RocketPropellants.lookupPerformance('LOX_RP1', 2.56, 1e7, 20, 101325);
  const blocked = RocketPropellants.lookupPerformance('LOX_RP1', 2.56, 1e7, 20, 9.2e6);
  const separated = RocketPropellants.lookupPerformance('LOX_RP1', 2.56, 1e7, 200, 101325);
  const unpressurised = RocketPropellants.lookupPerformance('LOX_RP1', 2.56, 0, 20, 0);
  assert.ok(ordinary.Cf > 0);
  assert.equal(ordinary.flowRegime, 'attached');
  assert.equal(blocked.Cf, 0);
  assert.equal(blocked.choked, false);
  assert.equal(blocked.flowRegime, 'unchoked');
  assert.ok(separated.Cf > 0);
  assert.equal(separated.flowRegime, 'separated');
  assert.ok(separated.effectiveEpsilon > 1 && separated.effectiveEpsilon < 200);
  assert.equal(unpressurised.Cf, 0);
  assert.equal(RocketPropellants.lookupPerformance('unknown', 1, 1e7, 20, 0).Cf, 0);

  const venus = resolveEnvironment(8.87);
  const pre = RocketPhysics.computePreLaunch({ ...config, launchAngle: 90, environment: venus }, venus.gravity);
  assert.equal(pre.thrust, 0);
  assert.equal(pre.mdot, 0);
  assert.equal(pre.flowRegime, 'unchoked');
  assert.equal(pre.burnTime, Infinity);
});

test('radial cannon potential energy matches inverse-square gravity and is conserved in flight', () => {
  const radius = 1737400, gravity = 1.62;
  let state = Physics.createProjectile(0, 3, 1200, 55, 5, radius);
  const initialEnergy = Physics.computeEnergy(state, gravity).tme;
  for (let i = 0; i < 12000; i++) state = Physics.stepProjectile(state, 1 / 120, gravity);
  const energy = Physics.computeEnergy(state, gravity);
  near(energy.pe, 5 * gravity * radius * state.y / (radius + state.y), 1e-7);
  assert.ok(Math.abs(energy.tme - initialEnergy) / initialEnergy < 1e-9);
});

test('cannon contact preserves analytical impact velocity and exact event timing', () => {
  const initial = Physics.createProjectile(2, 10, 20, 45, 5);
  const result = Physics.stepProjectile(initial, 10, 9.81);
  const vx = 20 / Math.sqrt(2), vy = vx;
  const time = (vy + Math.sqrt(vy * vy + 2 * 9.81 * 10)) / 9.81;
  near(result.impactTime, time, 1e-9);
  near(result.x, 2 + vx * time, 1e-8);
  near(result.impactSpeed, Math.sqrt(400 + 2 * 9.81 * 10), 1e-8);
  near(result.apexTime, vy / 9.81, 1e-9);
  assert.equal(result.y, 0);
  assert.deepEqual(Physics.stepProjectile(result, 100, 9.81), result);
  assert.equal(initial.time, 0);
});

test('an orbit must clear the planet; escape must be unpowered and outgoing', () => {
  const radius = 6371000, gravity = 9.81, altitude = 100000;
  const circularSpeed = Math.sqrt(gravity * radius * radius / (radius + altitude));
  const orbit = Physics.createProjectile(0, altitude, circularSpeed, 0, 1, radius);
  const orbitClass = classifyTrajectory(orbit, gravity);
  assert.equal(orbitClass.kind, 'orbit');
  near(orbitClass.periapsisAltitude, altitude, 0.2);
  assert.ok(orbitClass.period > 0);
  const lowSpeed = Physics.createProjectile(0, altitude, 1000, 0, 1, radius);
  assert.equal(classifyTrajectory(lowSpeed, gravity).kind, 'returning');
  const escape = Physics.createProjectile(0, altitude, circularSpeed * 1.5, 90, 1, radius);
  assert.equal(classifyTrajectory(escape, gravity).kind, 'escape');
  assert.equal(classifyTrajectory({ ...escape, engineOn: true }, gravity).kind, 'powered');
  assert.equal(classifyTrajectory({ ...escape, wvy: -escape.wvy }, gravity).kind, 'returning');
});

test('downrange remains continuous when a flight crosses the back of the planet', () => {
  const radius = 6371000, gravity = 9.81, altitude = 100000;
  const speed = Math.sqrt(gravity * radius * radius / (radius + altitude));
  const projectile = Physics.createProjectile(Math.PI * radius - 100, altitude, speed, 0, 1, radius);
  const cannonNext = Physics.stepProjectile(projectile, 0.1, gravity);
  assert.ok(cannonNext.x > projectile.x && cannonNext.x < projectile.x + 1000);
  const rocket = { ...vacuumRocket({ propMass: 0, planetRadius: radius }), ...projectile,
    engineOn: false, launched: true };
  const rocketNext = RocketPhysics.stepRocket(rocket, 0.1, gravity);
  assert.ok(rocketNext.x > rocket.x && rocketNext.x < rocket.x + 1000);
  near(rocketNext.x, cannonNext.x, 1e-7);
});

test('short rocket preset converges across integration steps with matching prediction/live configuration', () => {
  const setup = { ...config, environment: resolveEnvironment(9.81) };
  const standard = RocketPhysics.predictTrajectory(setup, 9.81, { dt: 1 / 120 });
  const finer = RocketPhysics.predictTrajectory(setup, 9.81, { dt: 1 / 240 });
  assert.equal(standard.status, 'impact');
  assert.equal(standard.complete, true);
  assert.ok(standard.time < 40 && standard.time > 30);
  near(standard.time, finer.time, 0.00001);
  near(standard.maxHeight, finer.maxHeight, 0.001);
  let live = RocketPhysics.createRocketState(setup);
  while (live.outcome === 'flight') live = RocketPhysics.stepRocket(live, 1 / 120, 9.81, RocketPhysics.buildGuidance(setup));
  assert.deepEqual(live, standard.finalState);
});

test('bounded prediction labels an unfinished ascent as a limit, not an apogee or a landing', () => {
  const result = RocketPhysics.predictTrajectory({ ...config, environment: resolveEnvironment(9.81) }, 9.81, { maxTime: 1 });
  assert.equal(result.complete, false);
  assert.equal(result.status, 'limit');
  assert.equal(result.apexTime, null);
  assert.equal(result.apexHeight, null);
  assert.equal(result.landingX, null);
  assert.ok(Number.isFinite(result.maxHeight));
  const zeroGravity = Physics.predictTrajectory(500, 5, 45, 0, 0, 2, 2);
  assert.equal(zeroGravity.complete, false);
  assert.ok(Number.isFinite(zeroGravity.flightTime));
});
