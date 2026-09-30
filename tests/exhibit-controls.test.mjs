import test from 'node:test';
import assert from 'node:assert/strict';
import { ICONS, control, stepButton, stepState, exhibitCue } from '../src/wiki/exhibit-controls.ts';

test('loading steps read as done, then the one to take next, then the ones still to come', () => {
  assert.deepEqual([0, 1, 2].map(i => stepState(i, 0)), ['next', 'later', 'later']);
  assert.deepEqual([0, 1, 2].map(i => stepState(i, 1)), ['done', 'next', 'later']);
  assert.deepEqual([0, 1, 2].map(i => stepState(i, 3)), ['done', 'done', 'done']);
  for (let current = 0; current < 3; current++) assert.equal([0, 1, 2].filter(i => stepState(i, current) === 'next').length, 1);
});

test('exactly one control is cued at each point of an experiment, and none while it plays', () => {
  assert.equal(exhibitCue(true, false, false, false), 'step');
  assert.equal(exhibitCue(false, true, true, false), 'none', 'playing: nothing competes for attention');
  assert.equal(exhibitCue(false, true, false, false), 'play', 'paused part-way');
  assert.equal(exhibitCue(false, true, false, true), 'reset', 'finished: try a new comparison');
  assert.equal(exhibitCue(false, true, true, true), 'reset');
});

test('icons are decorative, so every control is named by its visible label', () => {
  for (const [name, icon] of Object.entries(ICONS)) {
    assert.match(icon, /^<svg class="exhibit-icon"[^>]* aria-hidden="true"/, name);
    assert.ok(!icon.includes('<text'), `${name}: no lettering inside the icon`);
  }
  assert.match(control('play', 'Play'), /<\/svg><span>Play<\/span>$/);
  const step = stepButton('data-action', 'charge', 1, 'Add charge');
  assert.match(step, /data-action="charge"/);
  assert.match(step, /class="exhibit-step-badge" aria-hidden="true"/);
  assert.match(step, /<span>Add charge<\/span><span class="atlas-sr-only" data-step-status><\/span>/);
});
