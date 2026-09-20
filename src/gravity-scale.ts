/** Logarithmic mapping between the custom-gravity slider and m/s².
 *
 * The presets span 0.62 m/s² (Pluto) to 274 m/s² (Sun). On a linear slider
 * every rocky world would sit within the first few pixels, so the slider
 * position is the logarithm of gravity: each step multiplies gravity by the
 * same factor, and Moon → Mars gets as much travel as Jupiter → Sun.
 * Preset buttons bypass this mapping and set the exact value.
 */
export const GRAVITY_MIN = 0.5;
export const GRAVITY_MAX = 300;
/** Slider positions run 0..GRAVITY_SLIDER_STEPS (integers). */
export const GRAVITY_SLIDER_STEPS = 1000;

export function clampGravity(gravity: number): number {
  return Math.min(GRAVITY_MAX, Math.max(GRAVITY_MIN, gravity));
}

export function gravityFromSliderPosition(position: number): number {
  const t = Math.min(1, Math.max(0, position / GRAVITY_SLIDER_STEPS));
  const gravity = GRAVITY_MIN * Math.pow(GRAVITY_MAX / GRAVITY_MIN, t);
  // Two decimals match the readout; presets keep their exact values because
  // they never pass through this function.
  return clampGravity(Math.round(gravity * 100) / 100);
}

export function sliderPositionForGravity(gravity: number): number {
  const g = clampGravity(gravity);
  return Math.round(GRAVITY_SLIDER_STEPS * Math.log(g / GRAVITY_MIN) / Math.log(GRAVITY_MAX / GRAVITY_MIN));
}
