import test from 'node:test';
import assert from 'node:assert/strict';
import { installChartScrubbing } from '../src/wiki/chart-scrubbing.ts';

function chartGesture(pointerType = 'touch') {
  const chart = new EventTarget(), inspected = [], captured = [];
  chart.setPointerCapture = id => captured.push(id);
  const abort = new AbortController();
  installChartScrubbing(chart, event => inspected.push([event.clientX,event.clientY]), abort.signal);
  const pointer = (type, x, y, extra = {}) => {
    const event = new Event(type);
    Object.assign(event, { pointerType, pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y, ...extra });
    chart.dispatchEvent(event);
  };
  return { pointer, inspected, captured, abort };
}

test('scrolling vertically past a chart leaves playback and its inspected time untouched', () => {
  const h = chartGesture();
  h.pointer('pointerdown', 100, 100);
  h.pointer('pointermove', 102, 103);
  h.pointer('pointermove', 104, 125);
  h.pointer('pointerup', 105, 140);
  assert.deepEqual(h.inspected, []);
  assert.deepEqual(h.captured, []);
});

test('touch taps and horizontal drags inspect the chart, while cancellation never becomes a tap', () => {
  const h = chartGesture();
  h.pointer('pointerdown', 100, 100);
  h.pointer('pointerup', 101, 102);
  assert.deepEqual(h.inspected, [[101,102]]);
  h.pointer('pointerdown', 100, 100);
  h.pointer('pointermove', 120, 103);
  h.pointer('pointermove', 155, 104);
  h.pointer('pointerup', 155, 104);
  assert.deepEqual(h.inspected, [[101,102],[120,103],[155,104]]);
  assert.deepEqual(h.captured, [1]);
  h.pointer('pointerdown', 100, 100);
  h.pointer('pointercancel', 100, 100);
  h.pointer('pointerup', 100, 100);
  assert.equal(h.inspected.length, 3);
});

test('mouse and pen retain immediate scrubbing, ignore unrelated pointers, and dispose with the exhibit', () => {
  for (const type of ['mouse','pen']) {
    const h = chartGesture(type);
    h.pointer('pointerdown', 100, 100);
    h.pointer('pointermove', 125, 110, { pointerId: 2 });
    h.pointer('pointermove', 130, 110);
    h.pointer('pointerup', 130, 110);
    h.pointer('pointermove', 180, 110);
    assert.deepEqual(h.inspected, [[100,100],[130,110]]);
    h.abort.abort();
    h.pointer('pointerdown', 100, 100);
    assert.equal(h.inspected.length, 2);
  }
});
