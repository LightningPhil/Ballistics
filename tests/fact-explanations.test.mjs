import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANET_FACTS } from '../src/planet-facts.ts';
import { ELEPHANT_TONNES, FACT_TOPICS, explainFact, factLabel, massInTonnes } from '../src/fact-explanations.ts';

test('every world offers a useful explanation and sources for all ten facts', () => {
  assert.equal(FACT_TOPICS.length, 10);
  assert.equal(new Set(FACT_TOPICS.map(t => t.key)).size, 10);
  for (const fact of Object.values(PLANET_FACTS)) {
    for (const { key } of FACT_TOPICS) {
      const info = explainFact(fact, key);
      assert.ok(info.title && info.label && info.value && info.valueLabel, `${fact.id}/${key}`);
      assert.ok(info.paragraphs.join(' ').length > 130, `${fact.id}/${key} needs an explanation`);
      assert.ok(info.sources.length);
      for (const [name, url] of info.sources) {
        assert.ok(name.length > 4);
        assert.equal(new URL(url).protocol, 'https:');
      }
      assert.doesNotMatch(JSON.stringify(info), /undefined|NaN|Infinity/);
    }
  }
});

test('tonnes and elephant counts preserve every digit without floating-point artefacts', () => {
  assert.equal(massInTonnes(PLANET_FACTS.earth.mass), 5_970_000_000_000_000_000_000n);
  assert.equal(massInTonnes(PLANET_FACTS.sun.mass), 1_988_000_000_000_000_000_000_000_000n);
  const earth = explainFact(PLANET_FACTS.earth, 'mass');
  assert.equal(earth.value, '5,970,000,000,000,000,000,000');
  assert.equal(earth.comparison.value, '1,194,000,000,000,000,000,000');
  for (const fact of Object.values(PLANET_FACTS)) {
    const info = explainFact(fact, 'mass');
    assert.match(info.value, /^\d{1,3}(,\d{3})+$/);
    assert.equal(BigInt(info.comparison.value.replaceAll(',', '')) * ELEPHANT_TONNES, massInTonnes(fact.mass));
    assert.match(info.paragraphs.join(' '), /5 tonnes/);
    assert.match(info.paragraphs.join(' '), /approximate/);
  }
});

test('temperatures identify a place and distinguish weather records from named atmospheric layers', () => {
  assert.match(explainFact(PLANET_FACTS.earth, 'temp-min').valueLabel, /Vostok.*Antarctica/);
  assert.match(explainFact(PLANET_FACTS.earth, 'temp-max').valueLabel, /Furnace Creek.*Death Valley/);
  assert.equal(PLANET_FACTS.earth.minTemp, '−89.2 °C');
  assert.equal(PLANET_FACTS.earth.maxTemp, '56.7 °C');
  assert.match(explainFact(PLANET_FACTS.moon, 'temp-min').valueLabel, /shadowed craters/);
  assert.match(explainFact(PLANET_FACTS.sun, 'temp-max').valueLabel, /core/);
  for (const id of ['jupiter', 'saturn', 'uranus', 'neptune']) {
    for (const key of ['temp-min', 'temp-max']) {
      const info = explainFact(PLANET_FACTS[id], key);
      assert.match(info.valueLabel, key === 'temp-min' ? /0\.1 bar/ : /1 bar/);
      assert.match(info.paragraphs.join(' '), /not the coldest and hottest/);
      assert.doesNotMatch(factLabel(PLANET_FACTS[id], key), /Minimum|Maximum/);
    }
  }
});

test('comparisons distinguish solar distance, moon orbits and solar days from rotation', () => {
  assert.equal(explainFact(PLANET_FACTS.earth, 'distance').comparison.value, '≈ 8.3 minutes');
  assert.equal(explainFact(PLANET_FACTS.pluto, 'distance').comparison.value, '≈ 5.5 hours');
  assert.match(explainFact(PLANET_FACTS.moon, 'distance').paragraphs.join(' '), /not from Earth/);
  assert.match(explainFact(PLANET_FACTS.ganymede, 'year').valueLabel, /Jupiter/);
  assert.match(explainFact(PLANET_FACTS.venus, 'day').paragraphs.join(' '), /243/);
  assert.match(explainFact(PLANET_FACTS.moon, 'tilt').paragraphs.join(' '), /reference plane/);
  assert.equal(explainFact(PLANET_FACTS.moon, 'gravity').comparison.value, '≈ 1.7 kg');
  assert.match(explainFact(PLANET_FACTS.moon, 'gravity').paragraphs.join(' '), /still contain 10 kilograms/);
});
