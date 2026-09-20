import assert from 'node:assert/strict';
import test from 'node:test';
import { drawWhale, drawSubmarine } from '../src/aquatic-characters.ts';
import { drawGiantSquid, drawIceBear, drawNewt, drawSnowman } from '../src/planet-guests.ts';

const artists = { whale: drawWhale, submarine: drawSubmarine, newt: drawNewt, snowman: drawSnowman,
  icebear: drawIceBear, squid: drawGiantSquid };
function canvasSpy() {
  const calls = [];
  const saved = [];
  const ctx = new Proxy({ globalAlpha: 1, lineWidth: 1 }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        calls.push([key, ...args]);
        for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${String(key)} contains invalid geometry`);
        if (key === 'arc') assert.ok(args[2] >= 0);
        if (key === 'ellipse') assert.ok(args[2] >= 0 && args[3] >= 0);
        if (key === 'createRadialGradient') assert.ok(args[2] >= 0 && args[5] >= 0);
        if (key === 'createLinearGradient' || key === 'createRadialGradient') {
          const gradient = { kind: key, args, stops: [], addColorStop(offset, colour) {
            assert.ok(Number.isFinite(offset) && offset >= 0 && offset <= 1, 'Gradient stop is in range');
            assert.equal(typeof colour, 'string');
            gradient.stops.push([offset, colour]);
            calls.push(['addColorStop', offset, colour]);
          } };
          return gradient;
        }
        if (key === 'save') saved.push({ ...target });
        if (key === 'restore') {
          assert.ok(saved.length, 'Artist cannot restore the caller’s canvas state');
          for (const name of Object.keys(target)) delete target[name];
          Object.assign(target, saved.pop());
        }
      };
    },
    set(target, key, value) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(key)} must be finite`);
      if (key === 'globalAlpha') assert.ok(value >= 0 && value <= 1, 'Opacity must be valid');
      if (key === 'lineWidth') assert.ok(value > 0, 'Stroke width must be positive');
      calls.push(['set', key, value?.kind ? { kind: value.kind, args: value.args, stops: value.stops.slice() } : value]);
      target[key] = value; return true;
    },
  });
  return { ctx, calls, get depth() { return saved.length; } };
}

test('guest characters draw every field pose at natural world and portrait scales without mutating state', () => {
  for (const [type, draw] of Object.entries(artists)) {
    for (const state of ['idle', 'walking', 'returning', 'running_away', 'startled', 'rocket_startled', 'squashed',
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
    assert.notDeepEqual(active.calls, idle.calls);
  }
});

test('the ice bear has distinct two-leg and four-leg walking rigs', () => {
  const fourLegged = canvasSpy(), twoLegged = canvasSpy();
  const pose = { type: 'icebear', state: 'walking', direction: 1, stateTimer: 1.2 };
  drawIceBear(fourLegged.ctx, 0, 0, 80, { ...pose, upright: false });
  drawIceBear(twoLegged.ctx, 0, 0, 80, { ...pose, upright: true });
  assert.notDeepEqual(twoLegged.calls, fourLegged.calls);
  assert.equal(fourLegged.depth, 0);
  assert.equal(twoLegged.depth, 0);
});

test('the squid has distinct resting, slithering and startled poses', () => {
  const poses = ['idle', 'walking', 'startled'].map(state => {
    const h = canvasSpy();
    drawGiantSquid(h.ctx, 0, 0, 80, { type: 'squid', state, direction: 1, stateTimer: .2 });
    assert.equal(h.depth, 0);
    return h.calls;
  });
  for (let i = 0; i < poses.length; i++) for (let j = i + 1; j < poses.length; j++) {
    assert.notDeepEqual(poses[i], poses[j], 'Changes of activity are visible');
  }
});

test('new guests preserve finite, balanced, immutable artwork through their full gait and portrait poses', () => {
  for (const [type, draw] of [['icebear', drawIceBear], ['squid', drawGiantSquid]]) {
    for (const state of ['idle', 'walking', 'returning', 'running_away', 'startled', 'rocket_startled', 'squashed', 'celebrating']) {
      for (const upright of [false, true]) for (const portrait of [false, true]) {
        for (const direction of [-1, 1]) for (const stateTimer of [0, .15, 1.2, 13.7]) {
          const h = canvasSpy();
          const pose = Object.freeze({ type, state, upright, portrait, direction, stateTimer, reaction: 'escape' });
          const before = { ...pose };
          draw(h.ctx, -20, 60, 80, pose);
          assert.ok(h.calls.some(([name]) => name === 'fill'), `${type}/${state} remains painted`);
          assert.equal(h.depth, 0, `${type}/${state} restores canvas state`);
          assert.deepEqual(pose, before, 'Drawing cannot mutate the animation state');
        }
      }
    }
  }
});

test('new guest portraits remain steady and recognizable through world gaits, impacts and reactions', () => {
  for (const [type, draw] of [['icebear', drawIceBear], ['squid', drawGiantSquid]]) {
    const baseline = canvasSpy();
    const pose = { type, state: 'idle', stateTimer: 0, direction: 1, portrait: true, upright: false };
    draw(baseline.ctx, 0, 0, 80, pose);
    for (const state of ['walking', 'returning', 'running_away', 'startled', 'rocket_startled', 'squashed', 'off_screen']) {
      const h = canvasSpy();
      draw(h.ctx, 0, 0, 80, { ...pose, state, stateTimer: 8.3, upright: true });
      const transforms = calls => calls.filter(([name]) => ['translate', 'rotate', 'scale', 'transform', 'setTransform'].includes(name));
      assert.deepEqual(transforms(h.calls), transforms(baseline.calls), `${type}/${state} keeps its portrait framing`);
      if (!['startled', 'rocket_startled'].includes(state)) {
        assert.deepEqual(h.calls, baseline.calls, `${type}/${state} keeps its steady portrait pose`);
      }
    }
  }
});

test('reduced motion freezes decorative guest animation while keeping recognizable artwork', () => {
  for (const [type, draw] of Object.entries(artists)) {
    for (const state of ['idle', 'walking', 'running_away', 'startled', 'rocket_startled']) {
      for (const options of [{}, { upright: true }, { portrait: true, upright: true }]) {
      const pose = { type, state, direction: 1, surfaceAmount: 1, reducedMotion: true, spoutParticles: [], ...options };
      const first = canvasSpy(), later = canvasSpy();
      draw(first.ctx, 0, 0, 80, { ...pose, stateTimer: 1 });
      draw(later.ctx, 0, 0, 80, { ...pose, stateTimer: 10 });
      assert.deepEqual(later.calls, first.calls, `${type}/${state} should not animate when reduced motion is requested`);
      }
    }
  }
});
