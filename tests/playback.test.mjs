import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackClock, automaticRate, MAX_AUTO_VIEW_SECONDS } from '../src/playback.ts';
import { MIN_CANNON_PATH_POINTS, PHYSICS_STEP, recordFlight, sampleFlight, compatibleRuns } from '../src/flight.ts';
import { Physics } from '../src/physics.ts';
import { RocketPhysics } from '../src/rocket_physics.ts';
import { resolveEnvironment } from '../src/environment.ts';

const longRun = { duration: 1200, events: [
  {time:0,kind:'launch'}, {time:180,kind:'burnout'}, {time:600,kind:'apex'}, {time:1200,kind:'impact'}
] };

test('Auto completes short through six-hour recordings within 20 viewing seconds at varied frame rates', () => {
  for (const duration of [0, .1, 5, 19.99, 20, 20.01, 37.5, 60, 600, 1200, 21600]) {
    const run = { duration, events: [
      {time:0,kind:'launch'}, {time:duration * .07,kind:'burnout'},
      {time:duration * .53,kind:'apex'}, {time:duration,kind:'impact'},
    ] };
    for (const hz of [20, 60, 144]) {
      const clock = new PlaybackClock(); clock.load(run);
      assert.equal(clock.rate, Math.max(1, duration / MAX_AUTO_VIEW_SECONDS), 'start at the planned rate');
      let frames = 0;
      while (!clock.paused && frames < hz * MAX_AUTO_VIEW_SECONDS) {
        clock.advance(1 / hz, run); frames++;
        assert.ok(clock.rate >= Math.max(1, duration / MAX_AUTO_VIEW_SECONDS));
        assert.ok(clock.rate <= Math.max(1, duration / MAX_AUTO_VIEW_SECONDS) * 1.25 + 1e-9);
      }
      assert.equal(clock.time, duration, `${duration}s flight at ${hz} Hz must finish within the budget`);
      assert.equal(clock.paused, true);
    }
  }
  assert.ok(automaticRate({duration:21600,events:[]}, 0) > 64, 'Auto must not inherit the manual speed cap');
});

test('Auto eases modestly at the apex without dropping to real time or braking for impact', () => {
  const clock = new PlaybackClock(); clock.load(longRun);
  let previous = clock.rate, largestChange = 0;
  while (!clock.paused) {
    clock.advance(1 / 60, longRun);
    largestChange = Math.max(largestChange, Math.abs(clock.rate / previous - 1));
    previous = clock.rate;
  }
  assert.ok(largestChange < .005, 'the complete Auto flight has gentle frame-to-frame changes');
  const peak = automaticRate(longRun, 600);
  assert.ok(peak < automaticRate(longRun, 360));
  assert.ok(peak < automaticRate(longRun, 840));
  assert.ok(peak >= automaticRate(longRun, 360) * .85, 'the apex dip is shallow');
  assert.ok(peak > 1);
  for (const time of [1000,1190,1199.99,1200]) {
    assert.equal(automaticRate(longRun,time), automaticRate(longRun,900), 'keep cruising through impact');
  }
  for (const event of longRun.events) {
    assert.ok(Math.abs(automaticRate(longRun,event.time - .01) - automaticRate(longRun,event.time + .01)) < .01);
  }
  const withoutBurnout = { ...longRun, events:longRun.events.filter(e=>e.kind !== 'burnout') };
  for (const time of [0,120,180,240,600,1199]) {
    assert.equal(automaticRate(longRun,time),automaticRate(withoutBurnout,time), 'burnout does not reset the clock');
  }
});

test('Auto handles missing and unusually placed apexes without an endpoint slowdown', () => {
  for (const apex of [null,0,1,50,550,599,600]) {
    const run = { duration:600, events:apex === null ? [] : [{kind:'apex',time:apex}] };
    for (let time=0; time<=600; time+=.5) {
      const rate=automaticRate(run,time);
      assert.ok(Number.isFinite(rate) && rate>=30 && rate<=37.5);
    }
    assert.equal(automaticRate(run,600),37.5);
    assert.ok(automaticRate(run,600)>=automaticRate(run,599.99));
  }
});

test('Auto follows the same clock across frame rates and dropped frames', () => {
  const times = [];
  for (const hz of [20,60,144]) {
    const clock = new PlaybackClock(); clock.load(longRun);
    for (let frame=0; frame<hz*8; frame++) clock.advance(1/hz,longRun);
    times.push(clock.time);
  }
  const dropped = new PlaybackClock(); dropped.load(longRun); dropped.advance(8,longRun);
  for (const time of times) assert.ok(Math.abs(time - dropped.time)<1e-6);
  dropped.advance(12,longRun);
  assert.equal(dropped.time,longRun.duration);
  assert.equal(dropped.paused,true);
});

test('fixed speeds are exact immediately, including 1× after accelerated Auto and on replay', () => {
  const clock = new PlaybackClock(); clock.load(longRun); clock.advance(1,longRun);
  for (const rate of [1,64,1,4,16]) {
    clock.select(rate);
    assert.equal(clock.rate,rate);
    const before=clock.time; clock.advance(.5,longRun);
    assert.ok(Math.abs(clock.time - before - .5*rate)<1e-10);
    clock.load(longRun);
    assert.equal(clock.rate,rate);
    clock.advance(1,longRun);
    assert.equal(clock.time,rate);
  }
  clock.select(.25); assert.equal(clock.mode,1);
  clock.select('auto'); assert.equal(clock.rate,automaticRate(longRun,clock.time));
});

test('pause and seek preserve the recorded time and resume at the appropriate Auto speed', () => {
  const clock = new PlaybackClock(); clock.load(longRun);
  clock.seek(600,longRun.duration);
  assert.equal(clock.rate,automaticRate(longRun,600));
  clock.advance(1,longRun); assert.equal(clock.time,600); assert.equal(clock.paused,true);
  clock.paused=false; clock.advance(.1,longRun); assert.ok(clock.time>606);
  clock.seek(9999,longRun.duration); assert.equal(clock.time,longRun.duration);
  clock.select(16); clock.load(longRun); assert.equal(clock.mode,16);
  clock.seek(300,longRun.duration); assert.equal(clock.rate,16);
  clock.load(longRun); assert.equal(clock.time,0); assert.equal(clock.rate,16);
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
    const clock = new PlaybackClock(); clock.select(mode); clock.load(run);
    while (!clock.paused) clock.advance(1/60, run);
    assert.deepEqual(sampleFlight(run, clock.time), run.samples.at(-1));
    clock.seek(run.duration*.5,run.duration); assert.deepEqual(sampleFlight(run,clock.time),expected);
  }
  config.gravity = 1.62;
  assert.equal(run.config.gravity, 9.81);
  assert.equal(compatibleRuns(run, {...run,config}),false);
});

test('short Sun cannon flights retain at least twenty plotted path points', async () => {
  const environment = resolveEnvironment(274);
  const config = { gravity: environment.gravity, environment, planetRadius: environment.radius,
    angle: 45, mass: 5, force: 500, barrelLength: 2 };
  const initial = Physics.createProjectile(2, 2, 20, 45, 5, environment.radius);
  const run = await recordFlight('cannon', config, initial);
  assert.equal(run.outcome, 'impact');
  assert.ok(run.duration < .5, 'the regression case is a genuinely short high-gravity flight');
  assert.ok(run.samples.length >= MIN_CANNON_PATH_POINTS);
  assert.equal(new Set(run.samples.map(sample => sample.time)).size, run.samples.length);
  assert.deepEqual(run.samples.at(-1), sampleFlight(run, run.duration));
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

test('rocket replay uses the solver between sparse samples during an extreme burn', async () => {
  const environment = resolveEnvironment(9.81);
  const config = { gravity: 9.81, environment, planetRadius: environment.radius,
    propellantId: 'LOX_RP1', MR: 2.56, Pc_bar: 300, epsilon: 20, throatDia_mm: 200,
    dryMass: 1, propMass: 5000, launchAngle: 90, etaC: .95, etaN: .95,
    guidanceMode: 'fixed' };
  const initial = RocketPhysics.createRocketState(config);
  Object.assign(initial, { x: 1.5, y: 1.45,
    wx: (environment.radius + 1.45) * Math.sin(1.5 / environment.radius),
    wy: (environment.radius + 1.45) * Math.cos(1.5 / environment.radius) });
  const run = await recordFlight('rocket', config, initial, undefined, { maxTime: 10 });
  const burnout = run.samples.at(-1).burnoutTime;
  assert.ok(burnout > 9 && burnout < 10);
  const inspectionTime = burnout - .02175;
  const replay = sampleFlight(run, inspectionTime);

  const guidance = RocketPhysics.buildGuidance(config);
  let reference = structuredClone(initial);
  while (inspectionTime - reference.time > PHYSICS_STEP + 1e-12) {
    reference = RocketPhysics.stepRocket(reference, PHYSICS_STEP, config.gravity, guidance);
  }
  reference = RocketPhysics.stepRocket(reference, inspectionTime - reference.time, config.gravity, guidance);
  assert.ok(Math.abs(replay.x - reference.x) < 1e-7);
  assert.ok(Math.abs(replay.y - reference.y) < 1e-7);
  assert.ok(Math.abs(replay.vx - reference.vx) < 1e-7);
  assert.ok(Math.abs(replay.vy - reference.vy) < 1e-7);
  assert.ok(Math.abs(replay.mass - reference.mass) < 1e-9);

  const upperIndex = run.samples.findIndex(sample => sample.time > inspectionTime);
  const lower = run.samples[upperIndex - 1], upper = run.samples[upperIndex];
  const fraction = (inspectionTime - lower.time) / (upper.time - lower.time);
  const linearlyInterpolatedVy = lower.vy + (upper.vy - lower.vy) * fraction;
  assert.ok(Math.abs(linearlyInterpolatedVy - reference.vy) > 1000,
    'the regression case must expose the old sparse linear interpolation error');
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
