import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterRemarks, GENERIC_REMARKS, PLANET_REMARKS, EVENT_REMARKS, reactionPool } from '../src/character-remarks.ts';
import { ENVIRONMENTS, resolveEnvironment } from '../src/environment.ts';

function seededRandom(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
const world = name => ENVIRONMENTS.find(e => e.name === name);

function checkRounds(draw, expected, rounds = 4) {
  let previous;
  for (let round = 0; round < rounds; round++) {
    const heard = new Set();
    for (let i = 0; i < expected.length; i++) {
      const line = draw();
      assert.notEqual(line, previous, 'No immediate repeats across round boundaries');
      assert.ok(!heard.has(line), 'Hear the full deck before a repeat');
      heard.add(line);
      previous = line;
    }
    assert.deepEqual(heard, new Set(expected));
  }
}

test('every real-world character has 50 bespoke short lines, heard in full before repeating', () => {
  assert.equal(GENERIC_REMARKS.length, 50);
  assert.deepEqual(Object.keys(PLANET_REMARKS).sort(), ENVIRONMENTS.map(e => e.name).sort());
  const all = [...GENERIC_REMARKS];
  for (const environment of ENVIRONMENTS) {
    const expected = PLANET_REMARKS[environment.name];
    assert.equal(expected.length, 50, environment.name);
    assert.ok(Object.isFrozen(expected));
    const remarks = new CharacterRemarks(seededRandom(47));
    checkRounds(() => remarks.next(environment), expected);
    all.push(...expected);
  }
  assert.equal(new Set(all).size, 500, 'World voices do not reuse generic or other-world filler');
  for (const line of all) assert.ok(line.length <= 43, 'Too long for the portrait: ' + line);
});

test('visiting another world preserves the unheard remarks when returning', () => {
  const remarks = new CharacterRemarks(seededRandom(5));
  const earthBefore = Array.from({ length: 17 }, () => remarks.next(world('earth')));
  checkRounds(() => remarks.next(world('moon')), PLANET_REMARKS.moon, 1);
  const earthAfter = Array.from({ length: 33 }, () => remarks.next(world('earth')));
  assert.deepEqual(new Set([...earthBefore, ...earthAfter]), new Set(PLANET_REMARKS.earth));
  assert.equal(new Set([...earthBefore, ...earthAfter]).size, 50);
  remarks.reset();
  checkRounds(() => remarks.next(world('earth')), PLANET_REMARKS.earth, 1);
});

test('a shuffle that would repeat the last line is corrected at the round boundary', () => {
  let draws = 0;
  const remarks = new CharacterRemarks(() => draws++ < 49 ? .999 : 0);
  checkRounds(() => remarks.next(world('earth')), PLANET_REMARKS.earth, 2);
});

test('fictional worlds share a generic-only round while gravity moves between presets', () => {
  const remarks = new CharacterRemarks(seededRandom(9));
  const worlds = [resolveEnvironment(2), resolveEnvironment(9), resolveEnvironment(16),
    { ...world('earth'), name: 'unknown-world', interpolated: false },
    { ...world('earth'), name: 'toString', interpolated: false }];
  assert.ok(worlds.slice(0, 3).every(e => e.interpolated));
  let index = 0;
  checkRounds(() => remarks.next(worlds[index++ % worlds.length]), GENERIC_REMARKS);
});

test('sound and missing-ground jokes stay in environments where they make sense', () => {
  const sound = /\b(sound|noise|noisy|loud|boom|rumble|echo|doorbell|applause|quiet|quieter|voice)\b/i;
  const missingGround = /\b(depths?|deeper|solid ground|clouds below|parking on clouds)\b/i;
  for (const environment of ENVIRONMENTS) {
    const lines = PLANET_REMARKS[environment.name];
    if (environment.surfacePressure === 0) assert.ok(lines.every(line => !sound.test(line)), environment.name);
    if (!environment.isGas) assert.ok(lines.every(line => !missingGround.test(line)), environment.name);
  }
  assert.ok(GENERIC_REMARKS.every(line => !sound.test(line) && !missingGround.test(line)));
});

test('flight reactions rotate independently of idle chatter and cover every event', () => {
  const remarks = new CharacterRemarks(seededRandom(15));
  for (const kind of ['launch', 'apex', 'coast', 'burnout', 'impact', 'escape', 'orbit', 'fizzle']) {
    const pool = reactionPool(kind, world('earth'));
    assert.ok(pool.length >= 6);
    assert.ok(Object.isFrozen(EVENT_REMARKS[kind]));
    for (const line of pool) assert.ok(line.length <= 43, line);
    checkRounds(() => {
      remarks.next(world('earth'));
      return remarks.reaction(kind, world('earth'));
    }, pool, 3);
  }
  assert.equal(remarks.reaction('guidance', world('earth')), undefined);
  assert.equal(remarks.reaction('toString', world('earth')), undefined);
  assert.ok(Object.values(EVENT_REMARKS).flat().every(line => !/view was worth it/i.test(line)));
});

test('launch noise follows the actual atmosphere, including custom worlds and world changes', () => {
  const remarks = new CharacterRemarks(seededRandom(8));
  const earthPool = reactionPool('launch', world('earth'));
  const vacuumPool = reactionPool('launch', world('moon'));
  assert.ok(earthPool.length > vacuumPool.length);
  const soundOnly = earthPool.filter(line => !vacuumPool.includes(line));
  assert.equal(soundOnly.length, 3);
  for (const environment of [world('moon'), world('mercury'),
    { ...world('earth'), interpolated: true, surfacePressure: 0 }]) {
    checkRounds(() => {
      remarks.reaction('launch', world('earth'));
      const line = remarks.reaction('launch', environment);
      assert.ok(!soundOnly.includes(line));
      return line;
    }, vacuumPool, 1);
  }
  assert.deepEqual(reactionPool('launch', resolveEnvironment(9)), earthPool);
});

test('impact reactions distinguish solid surfaces, cloud decks and fictional worlds', () => {
  const base = EVENT_REMARKS.impact;
  const solid = reactionPool('impact', world('venus'));
  const cloud = reactionPool('impact', world('saturn'));
  assert.equal(solid.length, base.length + 4);
  assert.equal(cloud.length, base.length + 4);
  const landOnly = solid.filter(line => !base.includes(line));
  const cloudOnly = cloud.filter(line => !base.includes(line));
  const remarks = new CharacterRemarks(seededRandom(77));
  for (const environment of ENVIRONMENTS) {
    const expected = environment.isGas ? cloud : solid;
    assert.deepEqual(reactionPool('impact', environment), expected);
    for (let i = 0; i < 30; i++) {
      const line = remarks.reaction('impact', environment);
      assert.ok(!(environment.isGas ? landOnly : cloudOnly).includes(line));
    }
  }
  for (const gravity of [2, 9, 16]) {
    const environment = resolveEnvironment(gravity);
    assert.ok(environment.interpolated);
    assert.deepEqual(reactionPool('impact', environment), base);
    checkRounds(() => remarks.reaction('impact', environment), base, 1);
  }
});
