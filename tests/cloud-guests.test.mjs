import assert from 'node:assert/strict';
import test from 'node:test';
import { CLOUD_GUEST_SURFACE, createCloudGuest, diveCloudGuest, updateCloudGuest } from '../src/cloud-guests.ts';
import { drawWhale, drawSubmarine } from '../src/aquatic-characters.ts';

const options = { random: () => .5 };
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `Expected ${actual} to be within ${tolerance} of ${expected}`);

test('cloud guests remain visible between relaxed, smoothly eased surfacing cycles', () => {
  let guest = createCloudGuest(8, options);
  const observations = [];
  for (let i = 0; i < 60 * 60; i++) {
    const previous = guest;
    guest = updateCloudGuest(guest, 1 / 60, options);
    observations.push(guest);
    assert.ok(guest.surfaceAmount >= CLOUD_GUEST_SURFACE && guest.surfaceAmount <= 1);
    assert.ok(Math.abs(guest.surfaceAmount - previous.surfaceAmount) < .008, 'No sudden reveal or disappearance');
    assert.ok(Math.abs(guest.x - previous.x) < .002, 'Drift must not teleport the guest');
    assert.ok(Math.abs(guest.x - 8) <= .45 && guest.y >= .315 && guest.y <= .385);
    assert.notEqual(guest, previous, 'The update must not mutate a caller-owned pose');
  }
  const surfaces = observations.filter((pose, i) => pose.phase === 'surfaced' && observations[i - 1]?.phase !== 'surfaced');
  assert.ok(surfaces.length >= 2);
  near(surfaces[1].age - surfaces[0].age, 23.2, 1 / 60);
  const firstSurface = observations.findIndex(pose => pose.phase === 'surfaced');
  const firstDive = observations.findIndex((pose, i) => i > firstSurface && pose.phase === 'diving');
  near((firstDive - firstSurface) / 60, 3.2, 1 / 60);
  // The first and last tiny pieces of a rise are almost stationary, avoiding
  // abrupt speed changes at the cloud line.
  const rising = updateCloudGuest(createCloudGuest(8, options), 14, options);
  near(updateCloudGuest(rising, .01, options).surfaceAmount, CLOUD_GUEST_SURFACE, 3e-7);
  near(updateCloudGuest(rising, 2.99, options).surfaceAmount, 1, 3e-7);
});

test('launch dives preserve the current pose when rising, surfaced or already diving', () => {
  for (const age of [0, 14.2, 15.5, 18, 21, 22.9]) {
    const before = updateCloudGuest(createCloudGuest(9, options), age, options);
    const original = structuredClone(before);
    const diving = diveCloudGuest(before, 20);
    assert.equal(diving.surfaceAmount, before.surfaceAmount);
    assert.equal(diving.x, before.x); assert.equal(diving.y, before.y);
    assert.deepEqual(before, original, 'A launch must not edit the existing motion record');
    const after = updateCloudGuest(diving, .01, options);
    assert.ok(after.surfaceAmount <= before.surfaceAmount + 1e-12);
    assert.ok(before.surfaceAmount - after.surfaceAmount < .000001);
    const settled = updateCloudGuest(diving, 4, options);
    assert.equal(settled.phase, 'cruising');
    near(settled.surfaceAmount, CLOUD_GUEST_SURFACE);
  }
});

test('cloud motion is frame-rate independent and handles a suspended tab without unbounded catch-up', () => {
  const initial = createCloudGuest(7, options);
  const single = updateCloudGuest(initial, 48, options);
  let stepped = initial;
  for (let i = 0; i < 480; i++) stepped = updateCloudGuest(stepped, .1, options);
  assert.equal(single.phase, stepped.phase);
  for (const key of ['x', 'y', 'age', 'elapsed', 'surfaceAmount']) near(single[key], stepped[key], 1e-8);
  assert.deepEqual(updateCloudGuest(initial, 1e20, options), updateCloudGuest(initial, 60, options));
  for (const badDt of [NaN, Infinity, -1]) assert.deepEqual(updateCloudGuest(initial, badDt, options), initial);
});

test('reduced motion keeps a static partial guest at any point in its cycle', () => {
  const initial = createCloudGuest(6, options);
  for (const age of [0, 15, 18, 22]) {
    const moving = updateCloudGuest(initial, age, options);
    const first = updateCloudGuest(moving, 1, { ...options, reducedMotion: true });
    const later = updateCloudGuest(first, 20, { ...options, reducedMotion: true });
    assert.deepEqual(later, first);
    assert.equal(first.surfaceAmount, CLOUD_GUEST_SURFACE);
    assert.equal(first.x, 6); assert.equal(first.y, .35);
  }
});

function canvasSpy() {
  const calls = [];
  const gradient = { addColorStop(...args) { calls.push(['colour', ...args]); } };
  const ctx = new Proxy({ globalAlpha: 1, createRadialGradient(...args) {
    calls.push(['gradient', ...args]); return gradient;
  } }, {
    get(target, name) { return name in target ? target[name] : (...args) => calls.push([name, ...args]); },
    set(target, name, value) { target[name] = value; return true; },
  });
  return { ctx, calls };
}

test('cloud sprites remain painted beneath soft world-scale wisps, while portraits stay clear', () => {
  for (const [type, draw] of [['whale', drawWhale], ['submarine', drawSubmarine]]) {
    for (const scale of [.1, 40, 80]) {
      const world = canvasSpy();
      draw(world.ctx, 20, 30, scale, { type, surfaceAmount: .34, state: 'submerged', reducedMotion: true });
      assert.ok(world.calls.some(([name]) => name === 'gradient'), 'The field guest swims amongst feathered clouds');
      assert.ok(world.calls.some(([name]) => name === 'stroke'), 'A submerged state must still paint the recognizable creature');
      assert.ok(!world.calls.some(([name]) => name === 'rect'), 'There must be no rectangular horizon clip');
      assert.deepEqual(world.calls.find(([name]) => name === 'scale'), ['scale', scale / 80, scale / 80]);
    }
    const surfaced = canvasSpy(), submerged = canvasSpy();
    draw(surfaced.ctx, 0, 0, 80, { type, portrait: true, surfaceAmount: 1, state: 'spouting', reducedMotion: true });
    draw(submerged.ctx, 0, 0, 80, { type, portrait: true, surfaceAmount: 0, state: 'submerged', reducedMotion: true });
    assert.ok(!surfaced.calls.some(([name]) => name === 'gradient'), 'Portraits have no cloud veil');
    assert.deepEqual(submerged.calls, surfaced.calls, 'World depth cannot obscure the persistent close-up');
  }
});
