import assert from 'node:assert/strict';
import test from 'node:test';
import { NozzleRender } from '../src/nozzle_render.ts';

function nozzleLabels(pressure, overrides = {}) {
  const labels = [];
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    fillText(text) { labels.push(text); },
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
    measureText(text) { return { width: String(text).length * 6 }; },
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  NozzleRender.draw(context, 960, 540, {
    epsilon: 20, Pc_bar: 80, throatDia_mm: 15, mdot: 1,
    MR: 2.56, At: .00018, gamma: 1.2, worldTime: 0, Pa_Pa: pressure,
    ...overrides,
  });
  return labels;
}

test('nozzle identifies vacuum instead of substituting Earth ambient pressure', () => {
  const vacuum = nozzleLabels(0);
  assert.ok(vacuum.includes('vacuum'));
  assert.ok(!vacuum.includes('over-exp'));
  const atmosphere = nozzleLabels(101325);
  assert.ok(atmosphere.includes('over-exp'));
  assert.ok(!atmosphere.includes('vacuum'));
});

test('missing nozzle pressure retains the sea-level design default', () => {
  assert.deepEqual(nozzleLabels(undefined), nozzleLabels(101325));
});

test('nozzle cutaway identifies separated and unchoked flow', () => {
  const separated = nozzleLabels(101325, { flowRegime: 'separated' });
  assert.ok(separated.includes('separated'));
  assert.ok(!separated.includes('over-exp'));
  const unchoked = nozzleLabels(9.2e6, { flowRegime: 'unchoked', mdot: 0 });
  assert.ok(unchoked.includes('not choked'));
  assert.ok(!unchoked.includes('over-exp'));
});
