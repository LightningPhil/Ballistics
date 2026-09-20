import assert from 'node:assert/strict';
import test from 'node:test';
import { drawWhale, drawSubmarine } from '../src/aquatic-characters.ts';
import { drawGiantSquid, drawIceBear, drawNewt, drawSnowman } from '../src/planet-guests.ts';

const artists = { whale: drawWhale, submarine: drawSubmarine, newt: drawNewt, snowman: drawSnowman,
  icebear: drawIceBear, squid: drawGiantSquid };
function canvasSpy() {
  const calls = [];
  let depth = 0;
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({ createLinearGradient: () => gradient, createRadialGradient: () => gradient }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        calls.push([key, ...args]);
        for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${String(key)} contains invalid geometry`);
        if (key === 'arc') assert.ok(args[2] >= 0);
        if (key === 'ellipse') assert.ok(args[2] >= 0 && args[3] >= 0);
        if (key === 'save') depth++;
        if (key === 'restore') assert.ok(--depth >= 0, 'Artist cannot restore the caller’s canvas state');
      };
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return { ctx, calls, get depth() { return depth; } };
}

test('guest characters draw every field pose at natural world and portrait scales without mutating state', () => {
  for (const [type, draw] of Object.entries(artists)) {
    for (const state of ['idle', 'walking', 'returning', 'running_away', 'startled', 'squashed',
      'cruising', 'surfacing', 'surfaced', 'spouting', 'breathing', 'hatch_peek', 'diving']) {
      for (const direction of [-1, 1]) for (const scale of [1e-8, 38, 80]) {
        const h = canvasSpy();
        const pose = { type, state, direction, stateTimer: 1.2, surfaceAmount: .7,
          reaction: 'apex', spoutParticles: [{ ox: .1, oy: -.5, life: .4 }] };
        const before = structuredClone(pose);
        draw(h.ctx, 100, 200, scale, pose);
        assert.equal(h.depth, 0, `${type} must restore its transformations and clipping`);
        assert.ok(h.calls.some(([name]) => name === 'fill'), `${type} is painted`);
        assert.deepEqual(pose, before, 'Artwork cannot alter simulation or animation state');
      }
    }
  }
});

test('surfacing activities add distinct whale and submarine performances', () => {
  for (const [type, draw, state] of [
    ['whale', drawWhale, 'breathing'],
    ['submarine', drawSubmarine, 'hatch_peek'],
  ]) {
    const idle = canvasSpy(), active = canvasSpy();
    const pose = { type, direction: 1, surfaceAmount: 1, stateTimer: 1 };
    draw(idle.ctx, 0, 0, 80, { ...pose, state: 'surfaced' });
    draw(active.ctx, 0, 0, 80, { ...pose, state });
    assert.ok(active.calls.length > idle.calls.length, `${state} adds visible artwork`);
    assert.notDeepEqual(active.calls, idle.calls);
  }
});

test('the ice bear has distinct two-leg and four-leg walking rigs', () => {
  const fourLegged = canvasSpy(), twoLegged = canvasSpy();
  const pose = { type: 'icebear', state: 'walking', direction: 1, stateTimer: 1.2 };
  drawIceBear(fourLegged.ctx, 0, 0, 80, { ...pose, upright: false });
  drawIceBear(twoLegged.ctx, 0, 0, 80, { ...pose, upright: true });
  assert.notDeepEqual(twoLegged.calls, fourLegged.calls);
  assert.ok(twoLegged.calls.length > 50, 'upright rig retains detailed crystalline artwork');
  assert.equal(fourLegged.depth, 0);
  assert.equal(twoLegged.depth, 0);
});

test('Ganymede’s giant squid has ten independently curved arms', () => {
  const h = canvasSpy();
  drawGiantSquid(h.ctx, 0, 0, 80,
    { type: 'squid', state: 'walking', direction: 1, stateTimer: 1.2 });
  const curves = h.calls.filter(([name]) => name === 'bezierCurveTo');
  assert.ok(curves.length >= 12, 'eight arms, two feeding tentacles and the head use curved geometry');
  assert.equal(h.depth, 0);
});

test('reduced motion freezes decorative guest animation while keeping recognizable artwork', () => {
  for (const [type, draw] of Object.entries(artists)) {
    for (const state of ['idle', 'walking', 'startled']) {
      const pose = { type, state, direction: 1, surfaceAmount: 1, reducedMotion: true, spoutParticles: [] };
      const first = canvasSpy(), later = canvasSpy();
      draw(first.ctx, 0, 0, 80, { ...pose, stateTimer: 1 });
      draw(later.ctx, 0, 0, 80, { ...pose, stateTimer: 10 });
      assert.deepEqual(later.calls, first.calls, `${type}/${state} should not animate when reduced motion is requested`);
    }
  }
});
