import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackClock, automaticRate } from '../src/playback.ts';
import { recordFlight, sampleFlight, compatibleRuns } from '../src/flight.ts';
import { Physics } from '../src/physics.ts';
import { RocketPhysics } from '../src/rocket_physics.ts';
import { resolveEnvironment } from '../src/environment.ts';

const longRun = { duration: 1200, events: [
  {time:0,kind:'launch'}, {time:180,kind:'burnout'}, {time:600,kind:'apex'}, {time:1200,kind:'impact'}
] };
test('playback never enters slow motion; rate transitions stay continuous across frame rates', () => {
  for (const hz of [20, 60, 144]) {
    const clock = new PlaybackClock(); clock.load(); clock.select(64);
    let previous = 1;
    for (let frame = 0; frame < hz * 12; frame++) {
      clock.advance(1 / hz, longRun);
      assert.ok(clock.rate >= 1 && clock.rate <= 64 + 1e-8);
      assert.ok(Math.abs(Math.log(clock.rate / previous)) <= .65 / hz + 1e-6);
      previous = clock.rate;
    }
    assert.ok(clock.rate > 30);
    clock.select(1);
    for (let frame = 0; frame < hz * 12 && !clock.paused; frame++) {
      clock.advance(1 / hz, longRun); assert.ok(clock.rate >= 1);
    }
    assert.equal(clock.mode, 1);
  }
});
test('short flights stay at 1× and automatic targets are continuous at recorded moments', () => {
  assert.equal(automaticRate({duration: 5, events:[]}, 2), 1);
  for (const event of longRun.events) {
    assert.equal(automaticRate(longRun, event.time), 1);
    assert.ok(Math.abs(automaticRate(longRun, event.time - .01) - automaticRate(longRun, event.time + .01)) < .001);
  }
});
test('pause and seek do not advance time, manual choice survives replay', () => {
  const clock = new PlaybackClock(); clock.select(.25); assert.equal(clock.mode, 1);
  clock.select(16); clock.load(); assert.equal(clock.mode, 16);
  clock.seek(600, 1200); clock.advance(.1, longRun);
  assert.equal(clock.time, 600); assert.equal(clock.paused, true);
  clock.seek(9999, 1200); assert.equal(clock.time, 1200);
});
test('a one-second display frame still advances one second at the standard rate', () => {
  const clock = new PlaybackClock(); clock.select(1); clock.load();
  clock.advance(1,longRun);
  assert.ok(Math.abs(clock.time - 1) < 1e-12);
  assert.equal(clock.rate,1);
});
test('recorded cannon path, event seeking and replay share one physics solution', async () => {
  const environment = resolveEnvironment(9.81);
  const config = {gravity:9.81, environment, planetRadius:environment.radius, angle:45,mass:5,force:500,barrelLength:2};
  const initial = Physics.createProjectile(2, 2, 20, 45, 5, environment.radius);
  const run = await recordFlight('cannon', config, initial);
  assert.equal(run.outcome, 'impact');
  assert.ok(run.events.some(e => e.kind === 'apex'));
  const expected = sampleFlight(run, run.duration * .5);
  for (const mode of ['auto',1,16,64]) {
    const clock = new PlaybackClock(); clock.select(mode); clock.load();
    while (!clock.paused) clock.advance(1/60, run);
    assert.deepEqual(sampleFlight(run, clock.time), run.samples.at(-1));
    clock.seek(run.duration*.5,run.duration); assert.deepEqual(sampleFlight(run,clock.time),expected);
  }
  config.gravity = 1.62;
  assert.equal(run.config.gravity, 9.81);
  assert.equal(compatibleRuns(run, {...run,config}),false);
});
test('failed launch finishes immediately and retains fuel; long recording is cancellable', async () => {
  const environment = resolveEnvironment(9.81);
  const config = {gravity:9.81,environment,planetRadius:environment.radius,propellantId:'LOX_RP1',
    MR:2.7,Pc_bar:100,epsilon:20,throatDia_mm:1,dryMass:100,propMass:8,launchAngle:85,
    etaC:.95,etaN:.95,guidanceMode:'fixed'};
  const initial = RocketPhysics.createRocketState(config);
  const run = await recordFlight('rocket',config,initial);
  assert.equal(run.outcome,'no-liftoff'); assert.equal(run.duration,0);
  assert.equal(run.samples.at(-1).mProp,8);
  assert.equal(run.samples.length,1);
  assert.equal(run.samples[0].outcome,'no-liftoff');
  assert.equal(run.samples[0].engineOn,false);
  assert.equal(run.samples[0].fizzled,true);
  assert.deepEqual(sampleFlight(run,0),run.samples[0]);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(recordFlight('rocket',config,initial,controller.signal),{name:'AbortError'});
});

test('recorded event snapshots use solver times, exact apex height and immediate engine-state changes', async () => {
  const environment = resolveEnvironment(9.81);
  const config = {gravity:9.81,environment,planetRadius:environment.radius,propellantId:'LOX_RP1',
    MR:2.56,Pc_bar:100,epsilon:20,throatDia_mm:15,dryMass:100,propMass:8,launchAngle:85,
    etaC:.95,etaN:.95,guidanceMode:'fixed'};
  const run = await recordFlight('rocket',config,RocketPhysics.createRocketState(config));
  const final = run.samples.at(-1);
  const cutoff = run.events.find(event => event.kind === 'burnout');
  const apex = run.events.find(event => event.kind === 'apex');
  assert.equal(cutoff.time,final.burnoutTime);
  assert.equal(apex.time,final.apexTime);
  assert.equal(run.maxHeight,final.apexHeight);
  assert.equal(sampleFlight(run,cutoff.time).engineOn,false);
  assert.equal(sampleFlight(run,cutoff.time).mProp,0);
  assert.equal(sampleFlight(run,cutoff.time - .00001).engineOn,true);
  assert.equal(sampleFlight(run,apex.time).vy,0);
  assert.equal(sampleFlight(run,apex.time).apexTime,apex.time);
  for (const event of [cutoff,apex]) assert.ok(run.samples.some(sample => sample.time === event.time));
  config.environment.surfacePressure = 999;
  assert.equal(run.config.environment.surfacePressure,101325);
  assert.ok(Object.isFrozen(run.config.environment));
});

test('inspection immediately before impact retains incoming velocity instead of fading to a stop', async () => {
  const initial = Physics.createProjectile(0,10,0,90,5);
  const run = await recordFlight('cannon',{gravity:9.81},initial);
  const final = run.samples.at(-1);
  const before = sampleFlight(run,run.duration - .000001);
  assert.ok(before.vy < -13);
  assert.ok(Math.abs(before.vy - final.impactVy) < .0001);
  assert.equal(before.outcome,'flight');
  assert.equal(sampleFlight(run,run.duration).outcome,'impact');
  assert.equal(sampleFlight(run,run.duration).vy,0);
});

test('recorded body attitude crosses the angle wrap smoothly and readouts interpolate', () => {
  const run = { duration:2, samples:[
    {time:0,theta:179,thrustMagnitude:10,Pa_Pa:100,mass:20,mProp:10,engineOn:true},
    {time:2,theta:-179,thrustMagnitude:20,Pa_Pa:50,mass:10,mProp:0,engineOn:true}
  ] };
  const midpoint = sampleFlight(run,1);
  assert.ok(Math.abs(midpoint.theta - 180) < 1e-12);
  assert.equal(midpoint.thrustMagnitude,15);
  assert.equal(midpoint.Pa_Pa,75);
  assert.equal(midpoint.mass,15);
  assert.equal(midpoint.mProp,5);
});

test('a recording already in progress yields so cancellation can interrupt an unbounded flight', async () => {
  const initial = Physics.createProjectile(0,100,10,90,1);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),0);
  try {
    await assert.rejects(recordFlight('cannon',{gravity:0},initial,controller.signal),{name:'AbortError'});
  } finally { clearTimeout(timer); }
});

test('finite observation limits stay explicit and do not create false impact or apex events', async () => {
  const initial = Physics.createProjectile(0,100,10,90,1);
  const run = await recordFlight('cannon',{gravity:0},initial,undefined,{maxTime:.2});
  assert.equal(run.outcome,'limit');
  assert.ok(Math.abs(run.duration - .2) < 1e-12);
  assert.ok(!run.events.some(event => ['apex','impact'].includes(event.kind)));
  assert.ok(run.events.some(event => event.kind === 'end' && event.label === 'Observation limit'));
});

test('safe orbit and outward escape produce bounded observation records without waiting for impact', async () => {
  const environment = resolveEnvironment(9.81);
  const radius = environment.radius, altitude = 100000;
  const circular = Math.sqrt(environment.gravity * radius * radius / (radius + altitude));
  for (const [outcome,speed,angle] of [['orbit',circular,0],['escape',circular * 1.5,90]]) {
    const initial = Physics.createProjectile(0,altitude,speed,angle,1,radius);
    const run = await recordFlight('cannon',{gravity:9.81,planetRadius:radius,environment},initial);
    assert.equal(run.outcome,outcome);
    assert.ok(run.duration >= 20 && run.duration < 21);
    const event = run.events.find(event => event.kind === outcome);
    assert.ok(event);
    assert.ok(run.samples.some(sample => sample.time === event.time));
    assert.ok(!run.events.some(event => event.kind === 'impact'));
  }
});

test('trajectory decimation preserves exact event snapshots on a long returning flight', async () => {
  const initial = Physics.createProjectile(0,2,12000,90,1);
  const run = await recordFlight('cannon',{gravity:9.81},initial);
  assert.equal(run.outcome,'impact');
  assert.ok(run.duration > 2400);
  assert.ok(run.samples.length < 16000);
  const apex = run.events.find(event => event.kind === 'apex');
  assert.ok(run.samples.some(sample => sample.time === apex.time));
  assert.equal(sampleFlight(run,apex.time).vy,0);
  assert.ok(Math.abs(apex.time - 12000 / 9.81) < 1e-6);
});
