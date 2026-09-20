import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterRemarks, GENERIC_REMARKS, PLANET_REMARKS, launchRemark } from '../src/character-remarks.ts';
import { ENVIRONMENTS, resolveEnvironment } from '../src/environment.ts';

function seededRandom(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

test('every real world has 15 short distinct lines and every line is heard before repeating', () => {
  assert.equal(GENERIC_REMARKS.length, 10);
  assert.deepEqual(Object.keys(PLANET_REMARKS).sort(), ENVIRONMENTS.map(e => e.name).sort());
  for (const environment of ENVIRONMENTS) {
    assert.equal(PLANET_REMARKS[environment.name].length, 5);
    const expected = new Set([...GENERIC_REMARKS, ...PLANET_REMARKS[environment.name]]);
    assert.equal(expected.size, 15);
    for (const line of expected) assert.ok(line.length <= 42, `Too long for the portrait: ${line}`);
    const remarks = new CharacterRemarks(seededRandom(47));
    let previous;
    for (let round = 0; round < 6; round++) {
      const heard = new Set();
      for (let i = 0; i < 15; i++) {
        const line = remarks.next(environment);
        assert.notEqual(line, previous, 'Adjacent lines must differ, including round boundaries');
        assert.ok(!heard.has(line), 'No line can repeat before the rest of the deck');
        previous = line;
        heard.add(line);
      }
      assert.deepEqual(heard, expected);
    }
  }
});

test('world changes discard ineligible lines and reset starts a fresh full round', () => {
  const remarks = new CharacterRemarks(() => .999);
  const earth = ENVIRONMENTS.find(e => e.name === 'earth');
  const moon = ENVIRONMENTS.find(e => e.name === 'moon');
  remarks.next(earth);
  remarks.next(earth);
  const lunarRound = Array.from({ length: 15 }, () => remarks.next(moon));
  assert.deepEqual(new Set(lunarRound), new Set([...GENERIC_REMARKS, ...PLANET_REMARKS.moon]));
  remarks.next(moon);
  remarks.reset();
  assert.deepEqual(Array.from({ length: 15 }, () => remarks.next(moon)), lunarRound);
});

test('a shuffle that would repeat the last line is corrected at the bag boundary', () => {
  let draws = 0;
  const remarks = new CharacterRemarks(() => draws++ < 14 ? .999 : 0);
  const environment = ENVIRONMENTS[0];
  const first = Array.from({ length: 15 }, () => remarks.next(environment));
  const second = Array.from({ length: 15 }, () => remarks.next(environment));
  assert.notEqual(second[0], first.at(-1));
  assert.deepEqual(new Set(second), new Set(first));
});

test('fictional worlds share a generic-only round even while gravity moves between presets', () => {
  const remarks = new CharacterRemarks(seededRandom(9));
  const worlds = [resolveEnvironment(2), resolveEnvironment(9), resolveEnvironment(16),
    { ...ENVIRONMENTS[0], name: 'unknown-world', interpolated: false }];
  assert.ok(worlds.slice(0, 3).every(e => e.interpolated));
  const lines = Array.from({ length: 10 }, (_, i) => remarks.next(worlds[i % worlds.length]));
  assert.deepEqual(new Set(lines), new Set(GENERIC_REMARKS));
  const next = remarks.next(worlds[0]);
  assert.notEqual(next, lines.at(-1));
  assert.ok(GENERIC_REMARKS.includes(next));
});

test('sound and missing-ground jokes stay in environments where they make sense', () => {
  const sound = /\b(sound|noise|loud|boom|rumble|echo|doorbell)\b/i;
  const missingGround = /\b(depths?|deeper|solid ground|clouds below|parking on clouds)\b/i;
  for (const environment of ENVIRONMENTS) {
    const lines = [...GENERIC_REMARKS, ...PLANET_REMARKS[environment.name]];
    if (environment.surfacePressure === 0) assert.ok(lines.every(line => !sound.test(line)));
    if (!environment.isGas) assert.ok(lines.every(line => !missingGround.test(line)));
  }
  assert.ok(GENERIC_REMARKS.every(line => !sound.test(line) && !missingGround.test(line)));
});

test('all launch reactions are sampled and airless worlds never receive the noise reaction', () => {
  const sample = environment => new Set(Array.from({ length: 100 }, (_, i) => launchRemark(environment, () => i / 100)));
  const earth = sample(ENVIRONMENTS.find(e => e.name === 'earth'));
  assert.equal(earth.size, 4);
  for (const name of ['moon', 'mercury']) {
    const airless = sample(ENVIRONMENTS.find(e => e.name === name));
    assert.equal(airless.size, 3);
    assert.ok([...airless].every(line => earth.has(line) && !/boom|noise|sound|loud|rumble/i.test(line)));
    const atmosphericOnly = [...earth].filter(line => !airless.has(line));
    assert.equal(atmosphericOnly.length, 1);
    assert.match(atmosphericOnly[0], /boom/i);
  }
  const imaginaryAirless = { ...ENVIRONMENTS.find(e => e.name === 'earth'), surfacePressure: 0, interpolated: true };
  assert.equal(sample(imaginaryAirless).size, 3);
});
