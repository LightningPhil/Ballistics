import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../src/renderer.ts';
import { rocketCameraViewport } from '../src/camera.ts';
import { recordFlight, sampleFlight } from '../src/flight.ts';
import { PlaybackClock } from '../src/playback.ts';
import { RocketPhysics } from '../src/rocket_physics.ts';
import { Physics } from '../src/physics.ts';
import { resolveEnvironment } from '../src/environment.ts';

function scene(width = 938, height = 480) {
  const bounds = { width, height }, points = [], stack = [];
  let matrix = [1, 0, 0, 1, 0, 0], resize;
  const point = (x, y) => points.push({ x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5] });
  const rectangle = (x, y, width, height) => {
    point(x, y); point(x + width, y); point(x, y + height); point(x + width, y + height);
  };
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    save() { stack.push([...matrix]); }, restore() { matrix = stack.pop(); },
    setTransform() { matrix = [1, 0, 0, 1, 0, 0]; },
    translate(x, y) { matrix[4] += matrix[0] * x + matrix[2] * y; matrix[5] += matrix[1] * x + matrix[3] * y; },
    rotate(angle) {
      const [a, b, c, d] = matrix, cos = Math.cos(angle), sin = Math.sin(angle);
      matrix[0] = a * cos + c * sin; matrix[1] = b * cos + d * sin;
      matrix[2] = c * cos - a * sin; matrix[3] = d * cos - b * sin;
    },
    moveTo: point, lineTo: point,
    bezierCurveTo(...values) { for (let i = 0; i < values.length; i += 2) point(values[i], values[i + 1]); },
    arc(x, y, r) { for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) point(x + Math.cos(a) * r, y + Math.sin(a) * r); },
    fillRect: rectangle, strokeRect: rectangle,
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
  }, { get(target, key) { return target[key] || (() => {}); } });
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.ResizeObserver = class { constructor(callback) { resize = callback; } observe() {} };
  Renderer.init({ getContext: () => context, getBoundingClientRect: () => bounds });
  Renderer.resetCamera(); Renderer.setZoomImmediate(80);
  return { bounds, points, resize: (width, height) => { Object.assign(bounds, { width, height }); resize(); } };
}

const config = (gravity = 9.81, overrides = {}) => {
  const environment = resolveEnvironment(gravity);
  return { gravity, environment, planetRadius: environment.radius, propellantId: 'LOX_RP1', MR: 2.56,
    Pc_bar: 100, epsilon: 20, throatDia_mm: 15, dryMass: 100, propMass: 8, launchAngle: 85,
    etaC: .95, etaN: .95, guidanceMode: 'fixed', ...overrides };
};

function paintFrame(h, run, time, rate, dt = 1 / 60, duration = 3) {
  let state = sampleFlight(run, time);
  if (time >= run.duration && run.outcome === 'impact') state = { ...state, y: .6, theta: 8 };
  const horizon = Math.max(.4, duration * .6) * rate;
  Renderer.setViewTransitionDuration(duration);
  Renderer.setRocketCamera({ state,
    ahead: Array.from({ length: 5 }, (_, i) => sampleFlight(run, time + horizon * (i + 1) / 5)),
    launchX: run.launchX, radius: run.config.planetRadius, epsilon: run.config.epsilon, margin: .15 });
  Renderer.updateWorld(dt);
  h.points.length = 0;
  Renderer.drawRocket({ ...state, phase: 'flight' }, run.config.launchAngle, run.config.epsilon);
  const area = rocketCameraViewport(h.bounds.width, h.bounds.height);
  assert.ok(h.points.length > 30, 'check the actual nose, body, fins and nozzle drawing');
  for (const p of h.points) {
    assert.ok(Number.isFinite(p.x) && p.x >= area.left - 1e-5 && p.x <= area.right + 1e-5,
      `horizontal clipping/overlay at t=${time}, ${h.bounds.width}×${h.bounds.height}: ${p.x}`);
    assert.ok(Number.isFinite(p.y) && p.y >= area.top - 1e-5 && p.y <= area.bottom + 1e-5,
      `vertical clipping/overlay at t=${time}, ${h.bounds.width}×${h.bounds.height}: ${p.y}`);
  }
  const paintedSize = Math.max(Math.max(...h.points.map(p => p.x)) - Math.min(...h.points.map(p => p.x)),
    Math.max(...h.points.map(p => p.y)) - Math.min(...h.points.map(p => p.y)));
  assert.ok(paintedSize >= 12, 'distant rocket remains a visible vehicle, not a point');
}

test('recorded default rocket stays fully visible throughout flight, contact and next-moment seeking', async () => {
  const setup = config(), run = await recordFlight('rocket', setup, RocketPhysics.createRocketState(setup));
  assert.equal(run.outcome, 'impact'); assert.ok(run.duration > 37 && run.duration < 38);
  for (const [width, height] of [[938, 480], [320, 260], [390, 390], [768, 220]]) {
    const h = scene(width, height);
    Renderer.setTargetGravity(setup.gravity); Renderer.updateWorld(10);
    for (let time = 0; time < run.duration; time += 1 / 60) paintFrame(h, run, time, 1);
    paintFrame(h, run, run.duration, 1);
    for (const time of [0, ...run.events.map(e => e.time), 0, run.duration * .37]) paintFrame(h, run, time, 1, 0);
  }
});

test('long recorded returning flight remains visible through Auto/64×, curvature and planet view', async () => {
  const setup = config(1.62, { propMass: 100 });
  const run = await recordFlight('rocket', setup, RocketPhysics.createRocketState(setup));
  assert.equal(run.outcome, 'impact'); assert.ok(run.maxHeight > setup.planetRadius);
  for (const mode of ['auto', 64]) {
    const h = scene(938, 480), clock = new PlaybackClock();
    Renderer.setTargetGravity(setup.gravity); Renderer.updateWorld(10);
    clock.load(); clock.select(mode);
    let minimumPPM = 80, frames = 0;
    while (!clock.paused && frames++ < 100000) {
      clock.advance(1 / 20, run);
      paintFrame(h, run, clock.time, clock.rate, 1 / 20, 8);
      minimumPPM = Math.min(minimumPPM, Renderer.getCurrentPPM());
    }
    assert.ok(clock.paused && clock.time === run.duration);
    assert.ok(minimumPPM < .0001, 'exercise the curved/planet projection');
    for (const time of [run.duration, 0, run.duration * .5, run.duration * .1, 0]) {
      h.resize(320, 260); paintFrame(h, run, time, 1, 0);
      h.resize(1200, 700); paintFrame(h, run, time, 1, 0);
    }
  }
});

test('far escaping rocket has no planet-scale zoom floor and stays visible after direct seeks', async () => {
  const setup = config(1.62, { propMass: 0, epsilon: 120 });
  const initial = { ...RocketPhysics.createRocketState(setup),
    ...Physics.createProjectile(0, 100, 1000000, 85, 100, setup.planetRadius),
    theta: 85, launched: true, engineOn: false };
  const run = await recordFlight('rocket', setup, initial);
  assert.equal(run.outcome, 'escape'); assert.ok(run.maxHeight > 10 * setup.planetRadius);
  const h = scene(); Renderer.setTargetGravity(setup.gravity); Renderer.updateWorld(10);
  for (let frame = 0; frame < 600; frame++) paintFrame(h, run, run.duration, 64);
  assert.ok(Renderer.getCurrentPPM() < Renderer.getWholePlanetPPM() * .3);
  for (const [width, height] of [[320, 260], [938, 480], [700, 240]]) {
    h.resize(width, height);
    for (const time of [0, run.duration, run.duration * .5, .05]) paintFrame(h, run, time, 64, 0);
  }
});

test('negative downrange, shallow attitudes and sub-surface points fit at every projection scale', () => {
  const setup = config();
  for (const [width, height] of [[320, 260], [938, 480], [768, 220]]) {
    const h = scene(width, height); Renderer.setTargetGravity(setup.gravity); Renderer.updateWorld(10);
    for (const ppm of [80, .01, .0001, 1e-8]) {
      Renderer.setZoomImmediate(ppm);
      for (const x of [-10, -100000, -9 * setup.planetRadius, 9 * setup.planetRadius]) {
        for (const y of [-100, 0, 100, 8 * setup.planetRadius]) {
          for (const theta of [-175, -90, 0, 5, 90, 175]) {
            const state = { x, y, theta, time: 0 };
            const run = { config: { ...setup, epsilon: 120 }, launchX: 1.5, samples: [state], duration: 0, outcome: 'limit' };
            paintFrame(h, run, 0, 64, 0);
          }
        }
      }
    }
  }
});
