/** Native ranges may jump on touch-down before the browser recognises a scroll.
 * Roll back vertical/cancelled gestures; taps, horizontal drags and keyboards
 * retain the native control behaviour. */
export function protectTouchRange(input: HTMLInputElement) {
  let gesture: { id: number; x: number; y: number; value: string; axis: 'pending' | 'horizontal' | 'vertical' } | null = null;
  let restoring = false;
  const restore = () => {
    if (!gesture || input.value === gesture.value) return;
    input.value = gesture.value;
    restoring = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    restoring = false;
  };
  input.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || !event.isPrimary || input.disabled || gesture) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, value: input.value, axis: 'pending' };
  });
  input.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = Math.abs(event.clientX - gesture.x), dy = Math.abs(event.clientY - gesture.y);
    if (gesture.axis === 'pending' && Math.max(dx, dy) > 8) gesture.axis = dy > dx ? 'vertical' : 'horizontal';
    if (gesture.axis === 'vertical') restore();
  });
  input.addEventListener('input', () => { if (!restoring && gesture?.axis === 'vertical') restore(); });
  input.addEventListener('pointerup', event => {
    if (gesture?.id !== event.pointerId) return;
    if (gesture.axis === 'vertical') restore();
    gesture = null;
  });
  const cancel = (event: PointerEvent) => {
    if (gesture?.id !== event.pointerId) return;
    restore(); gesture = null;
  };
  input.addEventListener('pointercancel', cancel);
  input.addEventListener('lostpointercapture', cancel);
}
