import assert from 'node:assert/strict';
import test from 'node:test';
import { CLOUD_GUEST_SURFACE, cloudGuestActivity, createCloudGuest, diveCloudGuest, updateCloudGuest } from '../src/cloud-guests.ts';
import { drawWhale, drawSubmarine } from '../src/aquatic-characters.ts';

const options = { random: () => .5 };
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `Expected ${actual} to be within ${tolerance} of ${expected}`);

test('submarines remain visible between relaxed, smoothly eased surfacing cycles', () => {
  let guest = createCloudGuest(8, options);
  const observations = [];
  for (let i = 0; i < 60 * 60; i++) {
    const previous = guest;
    guest = updateCloudGuest(guest, 1 / 60, options);
    observations.push(guest);
    assert.ok(guest.surfaceAmount >= CLOUD_GUEST_SURFACE && guest.surfaceAmount <= 1);
    assert.ok(Math.abs(guest.surfaceAmount - previous.surfaceAmount) < .008, 'No sudden reveal or disappearance');
    assert.ok(Math.abs(guest.x - previous.x) < .002, 'Drift must not teleport the guest');
    assert.ok(Math.abs(guest.x - 8) <= .65 && guest.y >= -.25 && guest.y <= 0,
      'Aquatic guests stay just beneath, rather than floating above, the cloud deck');
    assert.notEqual(guest, previous, 'The update must not mutate a caller-owned pose');
  }
  const surfaces = observations.filter((pose, i) => pose.phase === 'surfaced' && observations[i - 1]?.phase !== 'surfaced');
  assert.ok(surfaces.length >= 2);
  near(surfaces[1].age - surfaces[0].age, 23, 1 / 60);
  const firstSurface = observations.findIndex(pose => pose.phase === 'surfaced');
  const firstDive = observations.findIndex((pose, i) => i > firstSurface && pose.phase === 'diving');
  near((firstDive - firstSurface) / 60, 9, 1 / 60);
  // The first and last tiny pieces of a rise are almost stationary, avoiding
  // abrupt speed changes at the cloud line.
  const rising = updateCloudGuest(createCloudGuest(8, options), 9, options);
  near(updateCloudGuest(rising, .01, options).surfaceAmount, CLOUD_GUEST_SURFACE, 1e-6);
  near(updateCloudGuest(rising, 2.49, options).surfaceAmount, 1, 1e-6);
});

test('launch dives preserve the current pose when rising, surfaced or already diving', () => {
  for (const age of [0, 9.2, 10.5, 12, 18, 21.5]) {
    const before = updateCloudGuest(createCloudGuest(9, options), age, options);
    const original = structuredClone(before);
    const diving = diveCloudGuest(before, 20, before.x - 1);
    assert.equal(diving.phase, 'startled');
    assert.equal(diving.surfaceAmount, before.surfaceAmount);
    assert.equal(diving.x, before.x); assert.equal(diving.y, before.y);
    assert.deepEqual(before, original, 'A launch must not edit the existing motion record');
    const fleeing = updateCloudGuest(diving, .35, options);
    assert.equal(fleeing.phase, 'startled');
    assert.ok(fleeing.x > before.x, 'The guest flees away from the launch');
    const after = updateCloudGuest(diving, .71, options);
    assert.equal(after.phase, 'diving');
    assert.ok(after.surfaceAmount <= before.surfaceAmount + 1e-12);
    assert.ok(before.surfaceAmount - after.surfaceAmount < .0001);
    const settled = updateCloudGuest(diving, 4, options);
    assert.equal(settled.phase, 'cruising');
    near(settled.surfaceAmount, CLOUD_GUEST_SURFACE);
  }
});

test('submarines spend about half their idle cycle surfaced', () => {
  let guest = createCloudGuest(8, options);
  let surfaceFrames = 0;
  const frames = 60 * 230;
  const midpoint = (1 + CLOUD_GUEST_SURFACE) / 2;
  for (let i = 0; i < frames; i++) {
    guest = updateCloudGuest(guest, 1 / 60, options);
    if (guest.surfaceAmount >= midpoint) surfaceFrames++;
  }
  const ratio = surfaceFrames / frames;
  assert.ok(ratio > .47 && ratio < .53, `Expected roughly half surfaced, got ${ratio}`);
});

test('whale surfacings alternate a blow, a blowhole breath and a quiet visit; pilots scan on each visit', () => {
  const pose = { phase: 'surfaced', elapsed: 1 };
  assert.deepEqual([1,2,3].map(surfaceCount =>
    cloudGuestActivity('whale', { ...pose, surfaceCount })),
  ['spouting','breathing','surfaced']);
  assert.deepEqual([1,2,3].map(surfaceCount =>
    cloudGuestActivity('submarine', { ...pose, surfaceCount })),
  ['hatch_peek','hatch_peek','hatch_peek']);
  assert.equal(cloudGuestActivity('whale', { ...pose, elapsed: 4, surfaceCount: 1 }), 'surfaced');
  assert.equal(cloudGuestActivity('submarine', { ...pose, elapsed: 7, surfaceCount: 1 }), 'surfaced');
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
    assert.equal(first.x, 6); near(first.y, initial.y);
  }
});

test('whales swim fully below the surface for most of the cycle, with short smooth breathing stops', () => {
  let whale = createCloudGuest(8, { ...options, kind: 'whale' });
  assert.equal(whale.surfaceAmount, 0);
  let submerged = 0, surfaced = 0;
  const visits = new Set();
  for (let frame = 0; frame < 220 * 60; frame++) {
    const before = whale;
    whale = updateCloudGuest(whale, 1 / 60, options);
    if (whale.surfaceAmount === 0) submerged++;
    if (whale.phase === 'surfaced') surfaced++;
    assert.ok(Math.abs(whale.surfaceAmount - before.surfaceAmount) < .014);
    assert.ok(Math.abs(whale.x - before.x) < .004);
    assert.ok(whale.y < 0 && Math.abs(whale.x - 8) <= 1.4);
    visits.add(cloudGuestActivity('whale', whale));
    if (whale.phase !== 'surfaced') assert.ok(!['spouting', 'breathing'].includes(cloudGuestActivity('whale', whale)));
  }
  assert.ok(submerged / (220 * 60) > .6, 'Most of the swim is entirely beneath the surface');
  assert.ok(surfaced / (220 * 60) < .2, 'Only brief surface visits');
  for (const activity of ['spouting', 'breathing', 'surfaced']) assert.ok(visits.has(activity));
  const initial = createCloudGuest(8, { ...options, kind: 'whale' });
  let stepped = initial;
  for (let i = 0; i < 480; i++) stepped = updateCloudGuest(stepped, .1, options);
  const single = updateCloudGuest(initial, 48, options);
  assert.equal(single.phase, stepped.phase);
  for (const key of ['x', 'y', 'surfaceAmount', 'elapsed']) near(single[key], stepped[key], 1e-8);
});

test('the pilot returns after the launch dive and stays up to watch; whales keep swimming', () => {
  let sub = diveCloudGuest(createCloudGuest(8, options));
  const watching = { ...options, watching: true };
  sub = updateCloudGuest(sub, 2.1, watching);
  assert.equal(sub.phase, 'surfaced'); assert.equal(sub.surfaceAmount, 1); assert.equal(sub.fleeing, false);
  const frozen = updateCloudGuest(sub, 0, watching); assert.deepEqual(frozen, sub);
  sub = updateCloudGuest(sub, 30, watching);
  assert.equal(sub.phase, 'surfaced');
  sub = updateCloudGuest(sub, 3, options);
  assert.equal(sub.phase, 'cruising'); assert.equal(sub.surfaceAmount, CLOUD_GUEST_SURFACE);
  const whale = createCloudGuest(8, { ...options, kind: 'whale' });
  assert.deepEqual(updateCloudGuest(whale, 5, watching), updateCloudGuest(whale, 5, options));
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

test('cloud sprites sink into a foamy, misty cloud crest, while portraits stay clear', () => {
  for (const [type, draw] of [['whale', drawWhale], ['submarine', drawSubmarine]]) {
    for (const scale of [.1, 40, 80]) {
      const world = canvasSpy();
      draw(world.ctx, 20, 30, scale, { type, surfaceAmount: CLOUD_GUEST_SURFACE, state: 'submerged', reducedMotion: true });
      assert.ok(world.calls.some(([name]) => name === 'gradient'), 'The field guest swims amongst feathered clouds');
      assert.ok(world.calls.some(([name]) => name === 'clip'), 'Below the cloud tops the deck itself shows');
      assert.ok(world.calls.some(([name]) => name === 'stroke'), 'A submerged state must still paint the recognizable creature');
      assert.ok(!world.calls.some(([name]) => name === 'rect'), 'There must be no rectangular horizon clip');
      assert.deepEqual(world.calls.find(([name]) => name === 'scale'), ['scale', scale / 80, scale / 80]);
    }
    const surfaced = canvasSpy(), submerged = canvasSpy();
    draw(surfaced.ctx, 0, 0, 80, { type, portrait: true, surfaceAmount: 1, state: 'spouting', reducedMotion: true });
    draw(submerged.ctx, 0, 0, 80, { type, portrait: true, surfaceAmount: 0, state: 'submerged', reducedMotion: true });
    assert.ok(!surfaced.calls.some(([name]) => name === 'gradient'), 'Portraits have no cloud veil');
    assert.notDeepEqual(submerged.calls, surfaced.calls, 'Portraits retain the current activity');
    assert.ok(!submerged.calls.some(([name]) => name === 'gradient'), 'Submerged portraits also keep a clear view');
    assert.deepEqual(submerged.calls.filter(([name]) => name === 'clip'), surfaced.calls.filter(([name]) => name === 'clip'), 'Depth adds no cloud clipping to the portrait');
  }
});
