import test from 'node:test';
import assert from 'node:assert/strict';
import { cannonSetupZoom } from '../src/camera.ts';

const viewports = [[320, 220], [360, 280], [390, 320], [768, 220], [1100, 350], [1440, 700]];

// Test the painted barrel corners (including its muzzle band) rather than the
// helper's bounding formula, using the renderer's actual ground placement.
function assertLauncherFits(width, height, ppm, length, angle) {
  const radians = angle * Math.PI / 180;
  const ground = height - Math.max(12, 70 * ppm / 80);
  for (const [along, across] of [[-.45, -.22], [-.45, .22], [length, -.20], [length, .20]]) {
    const x = (1.5 + along * Math.cos(radians) - across * Math.sin(radians)) * ppm;
    const y = ground - (1 + along * Math.sin(radians) + across * Math.cos(radians)) * ppm;
    assert.ok(x >= 0 && x <= width - 24 + 1e-8, `barrel outside width at ${width}×${height}, ${length}m/${angle}°`);
    assert.ok(y >= 24 - 1e-8 && y <= height, `barrel outside height at ${width}×${height}, ${length}m/${angle}°`);
  }
  assert.ok((1.5 + .79) * ppm <= width - 24 + 1e-8, 'carriage must also fit');
}

test('full cannon control range fits on phone and short desktop canvases', () => {
  for (const [width, height] of viewports) {
    for (let tenth = 5; tenth <= 50; tenth++) {
      const length = tenth / 10;
      for (let angle = 5; angle <= 85; angle += 5) {
        const ppm = cannonSetupZoom({ width, height, lengths: [length], angles: [angle] });
        assert.ok(ppm > 0 && ppm <= 80);
        assertLauncherFits(width, height, ppm, length, angle);
      }
    }
  }
});

test('rebuild framing fits every intermediate length and lowered/raised pose', () => {
  for (const [width, height] of viewports) {
    const ppm = cannonSetupZoom({ width, height, lengths: [.5, 3, 5], angles: [20, 45, 85], rebuilding: true });
    for (const length of [.5, 2, 3.5, 5]) {
      for (let angle = 0; angle <= 85; angle += 5) assertLauncherFits(width, height, ppm, length, angle);
    }
  }
});

test('ordinary roomy setups keep the original scale and constrained framing covers both ground-offset branches', () => {
  assert.equal(cannonSetupZoom({ width: 1200, height: 700, lengths: [2], angles: [45] }), 80);
  const standard = cannonSetupZoom({ width: 360, height: 280, lengths: [5], angles: [85] });
  assert.ok(standard > 80 * 12 / 70);
  assertLauncherFits(360, 280, standard, 5, 85);
  const tiny = cannonSetupZoom({ width: 320, height: 100, lengths: [5], angles: [85] });
  assert.ok(tiny < 80 * 12 / 70);
  assertLauncherFits(320, 100, tiny, 5, 85);
});
