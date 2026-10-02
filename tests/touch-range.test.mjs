import test from 'node:test';
import assert from 'node:assert/strict';
import { protectTouchRange } from '../src/touch-range.ts';

function range(pointerType = 'touch') {
  const input = new EventTarget(); input.value = '8'; input.disabled = false;
  protectTouchRange(input);
  const readouts = [];
  input.addEventListener('input', () => readouts.push(input.value));
  const pointer = (type, x, y, extra = {}) => {
    const event = new Event(type);
    Object.assign(event, { pointerType, pointerId:1, isPrimary:true, clientX:x, clientY:y, ...extra });
    input.dispatchEvent(event);
  };
  const edit = value => { input.value = String(value); input.dispatchEvent(new Event('input')); };
  return { input, readouts, pointer, edit };
}

test('vertical scrolling across a range cannot leave extra fuel or mass in the experiment', () => {
  const h = range();
  h.pointer('pointerdown',150,200); h.edit(2500); // native touch-down jump
  h.pointer('pointermove',152,225);
  assert.equal(h.input.value,'8');
  h.edit(2700);
  assert.equal(h.input.value,'8');
  assert.equal(h.readouts.at(-1),'8');
  h.pointer('pointercancel',152,240);
  assert.equal(h.input.value,'8');
  h.edit(12); // subsequent keyboard edits still work
  assert.equal(h.input.value,'12');
});

test('touch taps and horizontal drags retain native adjustment', () => {
  const h = range();
  h.pointer('pointerdown',150,200); h.edit(15); h.pointer('pointerup',150,200);
  assert.equal(h.input.value,'15');
  h.pointer('pointerdown',150,200); h.edit(20); h.pointer('pointermove',190,202);
  h.edit(30); h.pointer('pointermove',170,250); // drift after deliberately grabbing the slider
  h.pointer('pointerup',170,250); h.pointer('lostpointercapture',170,250);
  assert.equal(h.input.value,'30');
});

test('cancelled touches and lost capture restore settings, while other pointers do not interfere', () => {
  for (const type of ['pointercancel','lostpointercapture']) {
    const h = range(); h.pointer('pointerdown',150,200); h.edit(3000);
    h.pointer(type,150,200,{pointerId:2}); assert.equal(h.input.value,'3000');
    h.pointer(type,150,200); assert.equal(h.input.value,'8');
  }
  for (const pointerType of ['mouse','pen']) {
    const h = range(pointerType); h.pointer('pointerdown',150,200); h.edit(25);
    h.pointer('pointermove',152,260); h.pointer('pointerup',152,260);
    assert.equal(h.input.value,'25');
  }
});
