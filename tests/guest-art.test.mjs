import assert from 'node:assert/strict';
import test from 'node:test';
import { drawWhale, drawSubmarine } from '../src/aquatic-characters.ts';
import { drawNewt, drawSnowman } from '../src/planet-guests.ts';

const artists = { whale: drawWhale, submarine: drawSubmarine, newt: drawNewt, snowman: drawSnowman };
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
    for (const state of ['idle', 'walking', 'returning', 'running_away', 'startled', 'squashed', 'surfacing', 'spouting', 'diving']) {
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
