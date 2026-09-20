export interface CannonSetupFraming {
  width: number;
  height: number;
  lengths: readonly number[];
  angles: readonly number[];
  rebuilding?: boolean;
  defaultPPM?: number;
  baseX?: number;
  baseY?: number;
  margin?: number;
}

/** Fit the whole launcher before a shot, including the horizontal pose used by
 * the barrel crew. The renderer grounds it at H - max(12, 70 * ppm / 80), so
 * both branches of that maximum must satisfy the top-margin constraint.
 */
export function cannonSetupZoom({ width, height, lengths, angles, rebuilding = false,
  defaultPPM = 80, baseX = 1.5, baseY = 1, margin = 24 }: CannonSetupFraming): number {
  const length = Math.max(0.5, ...lengths.filter(Number.isFinite));
  const validAngles = angles.filter(Number.isFinite).map(angle => Math.max(0, Math.min(90, angle)));
  const lowAngle = rebuilding ? 0 : Math.min(90, ...validAngles);
  const highAngle = Math.max(0, ...validAngles);
  // Thickness includes muzzle bands and their outline. The independent bounds
  // stay conservative throughout an animated sweep, not only at its endpoints.
  const barrelPadding = 0.24;
  const right = baseX + Math.max(0.85, length * Math.cos(lowAngle * Math.PI / 180) + barrelPadding);
  const top = baseY + length * Math.sin(highAngle * Math.PI / 180) + barrelPadding;
  return Math.max(0.01, Math.min(defaultPPM,
    (width - margin) / right,
    (height - margin) / (top + 70 / 80),
    (height - margin - 12) / top));
}
