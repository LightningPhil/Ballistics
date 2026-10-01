/** Touch readers can scroll past a chart without changing the experiment.
 * A tap or horizontal drag inspects it; mouse and pen keep direct scrubbing. */
export function installChartScrubbing(chart: SVGSVGElement, seek: (event: PointerEvent) => void, signal: AbortSignal) {
  let gesture: { id: number; x: number; y: number; dragging: boolean; touch: boolean } | undefined;
  chart.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false, touch: event.pointerType === 'touch' };
    if (!gesture.touch) { chart.setPointerCapture(event.pointerId); seek(event); }
  }, { signal });
  chart.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    if (gesture.touch && !gesture.dragging) {
      const dx = Math.abs(event.clientX - gesture.x), dy = Math.abs(event.clientY - gesture.y);
      if (Math.max(dx, dy) < 8) return;
      if (dy > dx) { gesture = undefined; return; }
      gesture.dragging = true; chart.setPointerCapture(event.pointerId);
    }
    seek(event);
  }, { signal });
  chart.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    if (gesture.touch && !gesture.dragging) seek(event);
    gesture = undefined;
  }, { signal });
  const cancel = () => { gesture = undefined; };
  chart.addEventListener('pointercancel', cancel, { signal });
  chart.addEventListener('lostpointercapture', cancel, { signal });
}
