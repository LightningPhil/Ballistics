import assert from 'node:assert/strict';
import test from 'node:test';
import { Renderer } from '../src/renderer.ts';
import { NozzleRender } from '../src/nozzle_render.ts';

function harness() {
  const calls = [];
  const bounds = { width: 960, height: 540 };
  let resized;
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    measureText: text => ({ width: String(text).length * 6.7 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  }, {
    get(target, name) {
      if (name in target) return target[name];
      return (...args) => {
        calls.push({ name, args });
        for (const arg of args) {
          if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${String(name)}: non-finite coordinate`);
        }
        if (name === 'arc') assert.ok(args[2] >= 0, 'Circle radius must be non-negative');
        if (name === 'ellipse') assert.ok(args[2] >= 0 && args[3] >= 0, 'Ellipse radius must be non-negative');
      };
    },
    set(target, name, value) { target[name] = value; return true; },
  });
  globalThis.window = { devicePixelRatio: 2 };
  globalThis.ResizeObserver = class {
    constructor(callback) { resized = callback; }
    observe() {}
  };
  const canvas = { width: 0, height: 0, getContext: () => context, getBoundingClientRect: () => bounds };
  Renderer.init(canvas);
  Renderer.resetCamera(); Renderer.setZoomImmediate(80); Renderer.updateWorld(0);
  calls.length = 0;
  return { canvas, context, bounds, calls, resizeLayout: () => resized() };
}

test('DPR and changing playback toolbar height preserve CSS coordinates', () => {
  const h = harness();
  assert.equal(h.canvas.width, 1920);
  assert.equal(h.canvas.height, 1080);
  assert.equal(Renderer.getWidth(), 960);
  assert.equal(Renderer.getHeight(), 540);
  h.bounds.height = 410;
  h.resizeLayout();
  assert.equal(h.canvas.height, 820);
  assert.equal(Renderer.getHeight(), 410);
  window.devicePixelRatio = 1;
  Renderer.clear();
  assert.equal(h.canvas.width, 960);
  assert.equal(h.canvas.height, 410);
});

test('target dragging inverts flat and spherical projection, including planet view', () => {
  harness();
  for (const ppm of [80, .00003, 1e-8]) {
    Renderer.setZoomImmediate(ppm); Renderer.updateWorld(0);
    for (const expected of [{ x: 5, y: 10 }, { x: 0, y: 0 }, { x: 6371000, y: 100000 }]) {
      const pixel = Renderer.toCanvas(expected.x, expected.y);
      const actual = Renderer.screenToSurface(pixel.x, pixel.y);
      assert.ok(Math.abs(expected.x - actual.x) < .01, `Surface distance at ${ppm} PPM`);
      assert.ok(Math.abs(expected.y - actual.y) < .01, `Altitude at ${ppm} PPM`);
    }
  }
  const wholePlanet = Renderer.getWholePlanetPPM();
  assert.ok(wholePlanet * 6371000 * 2 < Renderer.getHeight(), 'Planet fits the shorter viewport dimension');
});

test('cannon muzzle follows the full barrel-length range used by launch physics', () => {
  harness();
  for (const length of [.5, 2, 4, 5]) {
    Renderer.setBarrelLength(length);
    for (const angle of [5, 45, 85]) {
      const tip = Renderer.getCannonTipPhys(angle);
      const actualLength = Math.hypot(tip.x - Renderer.CANNON_BASE_X_M, tip.y - Renderer.CANNON_BASE_Y_M);
      assert.ok(Math.abs(actualLength - length) < 1e-10, `${length} m barrel at ${angle} degrees`);
    }
  }
  Renderer.setBarrelLength(2);
});

test('rocket points along commanded thrust and plume begins behind its nozzle', () => {
  const h = harness();
  const state = { phase: 'flight', x: 2, y: 3, theta: 90, vx: 30, vy: -2 };
  Renderer.drawRocket(state, 45, 20);
  const position = h.calls.find(call => call.name === 'translate').args;
  const rotation = h.calls.find(call => call.name === 'rotate').args[0];
  assert.ok(Math.abs(rotation - Math.PI / 2) < 1e-12, 'Nose follows 90-degree thrust even with descending velocity');
  h.calls.length = 0;
  Renderer.drawExhaust(state.x, state.y, Math.PI / 2, 1, 20);
  const exhaust = h.calls.find(call => call.name === 'translate').args;
  assert.ok(Math.abs(exhaust[0] - position[0]) < 1e-10);
  assert.ok(exhaust[1] > position[1], 'Exhaust originates below the upward-pointing rocket');
  assert.ok(Math.abs(exhaust[1] - position[1] - 104) < 1e-10, 'Anchor accounts for half-body plus nozzle length');
});

test('initial recorded rocket and prelaunch sprite share the same centre and nozzle anchor', () => {
  const h = harness();
  for (const angle of [25, 60, 90]) {
    for (const epsilon of [2, 20, 120]) {
      const centre = Renderer.getRocketPadPosition(angle, epsilon);
      h.calls.length = 0;
      Renderer.drawRocket({ phase: 'pad' }, angle, epsilon);
      const pad = h.calls.find(call => call.name === 'translate').args;
      h.calls.length = 0;
      Renderer.drawRocket({ phase: 'flight', ...centre, theta: angle, vx: 0, vy: 0 }, angle, epsilon);
      const flight = h.calls.find(call => call.name === 'translate').args;
      assert.deepEqual(flight, pad, 'Launching does not move the sprite before physics advances');
      h.calls.length = 0;
      Renderer.drawExhaust(centre.x, centre.y, angle * Math.PI / 180, 1, epsilon);
      const nozzle = h.calls.find(call => call.name === 'translate').args;
      const surface = Renderer.toCanvas(Renderer.TOWER_BASE_X_M, .15);
      assert.ok(Math.abs(nozzle[0] - surface.x) < 1e-9, 'Nozzle rests on launch rail');
      assert.ok(Math.abs(nozzle[1] - surface.y) < 1e-9, 'Nozzle rests on pad top');
    }
  }
});

test('character close-up stays visible when silent, muted, or outside the world view', () => {
  const h = harness();
  const character = { type: 'golfer', visible: true, x: 5, state: 'idle', stateTimer: 1, direction: 1 };
  for (const width of [320, 960]) {
    h.bounds.width = width;
    h.resizeLayout();
    for (const ppm of [80, 1e-8]) {
      Renderer.setZoomImmediate(ppm); Renderer.updateWorld(0);
      h.calls.length = 0;
      Renderer.drawSceneNotes(NaN, 'cannon', character);
      const silentPortrait = h.calls.slice();
      assert.ok(silentPortrait.some(call => call.name === 'arc' &&
        call.args[0] === width - 52 && call.args[1] === 90 && call.args[2] === 36), 'Portrait keeps its top-right screen anchor');
      assert.ok(silentPortrait.some(call => call.name === 'translate'), 'Portrait contains the character sprite');
      assert.ok(!silentPortrait.some(call => call.name === 'fillText'), 'Silence has no empty balloon or label');
      for (const extra of [
        { bubbleText: null }, { bubbleText: '' }, { bubbleText: '   ' },
        { banter: false, bubbleText: 'Unheard remark.' },
        { visible: false, x: 1e12 },
      ]) {
        h.calls.length = 0;
        Renderer.drawSceneNotes(NaN, 'cannon', { ...character, ...extra });
        assert.deepEqual(h.calls, silentPortrait, 'World visibility and speech settings do not remove or alter the portrait');
      }
    }
  }
  h.calls.length = 0;
  Renderer.drawSceneNotes(NaN, 'cannon', null);
  assert.equal(h.calls.length, 0, 'No character means no portrait');
});

test('flattened and submerged world characters retain a recognizable close-up without changing world state', () => {
  const h = harness();
  for (const type of ['golfer', 'alien', 'spaceman', 'robot', 'icerobot', 'newt', 'whale', 'submarine', 'snowman']) {
    const character = { type, visible: true, x: 5, state: 'idle', stateTimer: 1, direction: 1, surfaceAmount: 1 };
    h.calls.length = 0;
    Renderer.drawSceneNotes(NaN, 'cannon', character);
    const normalPortrait = h.calls.slice();
    for (const extra of [{ state: 'squashed' }, { visible: false, state: 'running_away' },
      ...(type === 'whale' ? [{ state: 'submerged', surfaceAmount: 0 }, { state: 'diving', surfaceAmount: .2 }] : [])]) {
      const worldCharacter = { ...character, ...extra };
      const original = { ...worldCharacter };
      h.calls.length = 0;
      Renderer.drawSceneNotes(NaN, 'cannon', worldCharacter);
      assert.deepEqual(h.calls, normalPortrait, `${type} remains recognizable`);
      assert.deepEqual(worldCharacter, original, 'Drawing the close-up does not mutate the world character');
    }
  }
});

test('close-up speech only appears when enabled and remains inside the mobile scene', () => {
  const h = harness();
  h.bounds.width = 320; h.resizeLayout();
  const character = { type: 'golfer', visible: false, state: 'idle', stateTimer: 1, direction: 1,
    bubbleText: 'My calculations need a snack.' };
  for (const banter of [undefined, true, false]) {
    h.calls.length = 0;
    Renderer.drawSceneNotes(NaN, 'cannon', { ...character, banter });
    const text = h.calls.filter(call => call.name === 'fillText');
    assert.equal(text.length > 0, banter !== false, 'Remarks can be muted independently of the portrait');
    if (text.length) assert.equal(text.map(call => call.args[0]).join(' '), character.bubbleText);
    for (const { args: [line, x, y] } of text) {
      assert.ok(x >= 0 && x + h.context.measureText(line).width < 218, 'Speech stays inside the scene and left of the portrait');
      assert.ok(y >= 56 && y + 18 <= 126, 'Speech stays beneath the target and above the nozzle view');
    }
  }
});

test('all character reactions and annotations render finite geometry at close and planet scales', () => {
  const { context } = harness();
  for (const ppm of [80, 10, .00003, 1e-8]) {
    Renderer.setZoomImmediate(ppm); Renderer.updateWorld(0);
    Renderer.clear(); Renderer.drawWorld(); Renderer.drawCannon(45, 0);
    Renderer.drawBall(10, 4, 1, 1); Renderer.drawFlag(20, 1, 1); Renderer.drawLaunchTower(85);
    Renderer.drawGhost([{ x: 1, y: 1 }, { x: 100, y: 10 }, { x: 200, y: 0 }]);
    Renderer.drawTarget(20, 'cannon'); Renderer.drawTarget(100, 'rocket');
    for (const type of ['golfer', 'alien', 'spaceman', 'robot', 'icerobot', 'newt', 'whale', 'submarine', 'snowman']) {
      for (const reaction of [undefined, 'coast', 'apex', 'impact', 'escape', 'fizzle']) {
        const character = { type, visible: true, x: 5, state: 'idle', stateTimer: 1, direction: 1,
          reaction, bubbleText: 'Now that is a very long way to walk.', surfaceAmount: 1 };
        Renderer.drawCharacter(character);
        Renderer.drawSceneNotes(20, 'cannon', character);
      }
    }
    for (const pose of ['running', 'carrying', 'screwing', 'panicked', 'celebrating']) {
      Renderer.drawStickman(3, 0, { pose, timer: 1, direction: 1 });
    }
  }
  NozzleRender.draw(context, 960, 540, { epsilon: 20, Pc_bar: 80, throatDia_mm: 45, mdot: 5,
    MR: 2.5, At: .002, worldTime: 1 });
});
