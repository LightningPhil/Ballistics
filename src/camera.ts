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

export interface RocketCameraPoint { x: number; y: number; theta?: number }
export interface RocketCameraRequest {
  state: RocketCameraPoint;
  ahead: readonly RocketCameraPoint[];
  launchX: number;
  radius: number;
  epsilon: number;
  margin: number;
}

/** The permanent portrait/captions occupy the upper right. On phones the clear
 * area is below them; wider screens also reserve the nozzle diagram column. */
export function rocketCameraViewport(width: number, height: number) {
  const left = 18, right = width > 680 ? width - Math.max(310, Math.min(320, width * .28)) - 34 : width - 18;
  const top = width > 680 ? 18 : Math.min(132, height * .52);
  return { left, top, right, bottom: height - 16 };
}

/** Radius encloses the painted nose, fins and longest nozzle at every attitude,
 * including the minimum-size distant vehicle. Exhaust may extend beyond it. */
export function rocketSpriteRadius(ppm: number, epsilon: number) {
  const nozzle = .3 * Math.min(2, Math.max(.6, epsilon / 20));
  return Math.hypot(1 + nozzle, .42) * Math.max(8, ppm) + 3;
}

export function rocketCameraFraming(request: RocketCameraRequest, width: number, height: number,
  currentPPM: number, curved: boolean) {
  const area = rocketCameraViewport(width, height);
  const spanX = Math.max(1, area.right - area.left), spanY = Math.max(1, area.bottom - area.top);
  const radiusPerMetre = (rocketSpriteRadius(80, request.epsilon) - 3) / 80;
  const maxPPM = Math.max(1e-8, Math.min(80, (Math.min(spanX, spanY) / 2 - 7) / radiusPerMetre));
  const project = (point: RocketCameraPoint) => {
    if (!curved || request.radius <= 0) return point;
    const angle = point.x / request.radius;
    // The difference-of-cosines form avoids subtracting planetary radii when
    // the rocket is only centimetres above its launch pad.
    return { x: (request.radius + point.y) * Math.sin(angle),
      y: point.y * Math.cos(angle) - 2 * request.radius * Math.sin(angle / 2) ** 2 };
  };
  const points = [{ x: request.launchX, y: 0 }, request.state, ...request.ahead].map(project);
  // Far from the surface, include the planet as context without imposing a
  // zoom floor: escape trajectories can be many planetary radii away.
  if (curved && request.radius > 0) {
    const extent = Math.max(...points.map(p => Math.hypot(p.x, p.y)));
    const progress = Math.max(0, Math.min(1, (extent / request.radius - .5) / .75));
    const reveal = progress * progress * (3 - 2 * progress);
    points.push({ x: -request.radius * reveal, y: -2 * request.radius * reveal },
      { x: request.radius * reveal, y: 0 });
  }
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
  const minimumSprite = rocketSpriteRadius(8, request.epsilon);
  const extra = 1 + Math.max(.08, request.margin);
  const targetPPM = Math.max(1e-8, Math.min(maxPPM,
    (spanX - 2 * minimumSprite) / Math.max(1, (maxX - minX) * extra),
    (spanY - 2 * minimumSprite) / Math.max(1, (maxY - minY) * extra)));
  const ppm = Math.min(maxPPM, currentPPM);
  const point = project(request.state), sprite = rocketSpriteRadius(ppm, request.epsilon);
  // A soft bound anticipates the edges instead of letting the vehicle reach a
  // hard clipping boundary and then abruptly hauling the camera after it.
  const softBound = (value: number, min: number, max: number) => {
    const middle = (min + max) / 2, half = Math.max(1e-8, (max - min) / 2);
    return middle + half * Math.tanh((value - middle) / half);
  };
  return { targetPPM, maxPPM, anchor: {
    x: softBound((area.left + area.right) / 2 + (point.x - (minX + maxX) / 2) * ppm,
      area.left + sprite, area.right - sprite),
    y: softBound((area.top + area.bottom) / 2 - (point.y - (minY + maxY) / 2) * ppm,
      area.top + sprite, area.bottom - sprite)
  } };
}
