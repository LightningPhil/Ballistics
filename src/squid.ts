import type { CrewPose } from './crew.ts';

interface GiantSquidPose extends CrewPose {
  portrait?: boolean;
}

type Point = readonly [number, number];
type Curve = readonly [Point, Point, Point, Point];
type RibbonPoint = { x: number; y: number; nx: number; ny: number; width: number };

const INK = '#493647';
const PLUM = '#75485f';
const ROSE = '#b76b7e';
const CORAL = '#dd8e94';
const PEACH = '#efb6a4';
const PAPER = '#fff2d5';
const TAU = Math.PI * 2;

function shape(ctx: CanvasRenderingContext2D, draw: () => void, fill: string, outline = true) {
  ctx.beginPath(); draw(); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (outline) { ctx.strokeStyle = INK; ctx.lineWidth = 1.7; ctx.stroke(); }
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, outline = false, angle = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, angle, 0, TAU);
  ctx.fillStyle = fill; ctx.fill();
  if (outline) { ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke(); }
}

function curveLine(ctx: CanvasRenderingContext2D, curve: Curve, color: string, width: number) {
  ctx.beginPath(); ctx.moveTo(...curve[0]); ctx.bezierCurveTo(...curve[1], ...curve[2], ...curve[3]);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

/** Sample an arm's centreline, keeping the skin and suckers on the same curve. */
function ribbonPoints(curves: readonly Curve[], rootWidth: number, tipWidth: number): RibbonPoint[] {
  const points: RibbonPoint[] = [];
  for (let segment = 0; segment < curves.length; segment++) {
    const [a, b, c, d] = curves[segment];
    for (let step = segment === 0 ? 0 : 1; step <= 22; step++) {
      const t = step / 22, u = 1 - t;
      const x = u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0];
      const y = u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1];
      const dx = 3 * u * u * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t * t * (d[0] - c[0]);
      const dy = 3 * u * u * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t * t * (d[1] - c[1]);
      const length = Math.hypot(dx, dy) || 1;
      const fraction = (segment + t) / curves.length;
      points.push({ x, y, nx: -dy / length, ny: dx / length, width: tipWidth + (rootWidth - tipWidth) * Math.pow(1 - fraction, 1.35) });
    }
  }
  return points;
}

function edgePath(ctx: CanvasRenderingContext2D, points: readonly RibbonPoint[], side: number, widthFactor = 1, reverse = false) {
  const ordered = reverse ? [...points].reverse() : points;
  for (let i = 0; i < ordered.length; i++) {
    const p = ordered[i];
    ctx.lineTo(p.x + p.nx * p.width * side * widthFactor, p.y + p.ny * p.width * side * widthFactor);
  }
}

/** Filled, tapering flesh rather than a bundle of constant-width strokes. */
function arm(ctx: CanvasRenderingContext2D, curves: readonly Curve[], rootWidth: number, fill: string, cups: boolean, tipWidth = .4) {
  const points = ribbonPoints(curves, rootWidth, tipWidth);
  const first = points[0];
  const outline = () => {
    ctx.moveTo(first.x + first.nx * first.width, first.y + first.ny * first.width);
    edgePath(ctx, points, 1); edgePath(ctx, points, -1, 1, true);
  };
  shape(ctx, outline, fill);
  ctx.save();
  ctx.beginPath(); outline(); ctx.closePath(); ctx.clip();
  shape(ctx, () => {
    ctx.moveTo(first.x, first.y); edgePath(ctx, points, .05);
    edgePath(ctx, points, -1, 1, true);
  }, cups ? PEACH : '#975b74', false);
  if (cups) {
    // An underside row follows the curve's normal; none float beside the limb.
    for (const fraction of [.2, .32, .44, .56, .68]) {
      const p = points[Math.round((points.length - 1) * fraction)];
      const radius = Math.min(1.85, p.width * .48);
      const angle = Math.atan2(p.ny, p.nx);
      oval(ctx, p.x - p.nx * p.width * .42, p.y - p.ny * p.width * .42, radius, radius * .7, '#ffe0bd', false, angle);
      oval(ctx, p.x - p.nx * p.width * .42, p.y - p.ny * p.width * .42, radius * .4, radius * .29, '#b57980', false, angle);
    }
  }
  ctx.restore();
}

/** Two long feeding tentacles, each ending in a flattened, sucker-bearing club. */
function feedingTentacle(ctx: CanvasRenderingContext2D, side: number, sway: number, raised: boolean) {
  ctx.save(); ctx.scale(side, 1);
  const tipX = 75 + sway * .35;
  const tipY = (raised ? -56 : -31) + sway * .2;
  arm(ctx, [
    [[16, -48], [44, -53], [50 + sway, -5], [69 + sway * .3, -13]],
    [[69 + sway * .3, -13], [81 + sway * .3, -18], [82 + sway * .3, tipY + 12], [tipX, tipY]],
  ], 3.6, '#ac6b80', false, 1.65);
  ctx.translate(tipX, tipY); ctx.rotate(-.5 + sway * .012);
  shape(ctx, () => {
    ctx.moveTo(-1.7, 3); ctx.bezierCurveTo(-8, -1, -9, -11, -5, -17);
    ctx.bezierCurveTo(-1, -23, 6, -21, 8, -15); ctx.bezierCurveTo(12, -5, 4, -1, 1.7, 3);
  }, CORAL);
  shape(ctx, () => {
    ctx.moveTo(-.5, 0); ctx.bezierCurveTo(-5, -4, -5, -14, 0, -17);
    ctx.bezierCurveTo(5, -19, 7, -12, 4, -7); ctx.quadraticCurveTo(2, -3, -.5, 0);
  }, PEACH, false);
  for (const [x, y, r] of [[0, -5, 1.4], [-1, -9, 1.7], [2.2, -12.5, 1.7], [.5, -16, 1.2]]) {
    oval(ctx, x, y, r, r * .75, PAPER);
    oval(ctx, x, y, r * .42, r * .32, '#b57883');
  }
  ctx.restore();
}

function mantle(ctx: CanvasRenderingContext2D) {
  // Long swept fins grow from the upper mantle, with a thin luminous edge.
  shape(ctx, () => {
    ctx.moveTo(0, -137); ctx.bezierCurveTo(-7, -120, -25, -112, -43, -92);
    ctx.bezierCurveTo(-43, -85, -28, -78, -18, -79); ctx.lineTo(3, -111);
  }, PLUM);
  shape(ctx, () => {
    ctx.moveTo(3, -137); ctx.bezierCurveTo(12, -119, 29, -114, 43, -94);
    ctx.bezierCurveTo(46, -87, 28, -78, 18, -79); ctx.lineTo(-1, -110);
  }, '#996278');
  curveLine(ctx, [[-37, -92], [-25, -90], [-16, -101], [-7, -119]], '#c88697', 2.3);
  curveLine(ctx, [[37, -94], [30, -89], [18, -100], [9, -120]], '#e2a3a7', 2.2);
  // One continuous spear-shaped mantle, with no angular hat-like seam.
  shape(ctx, () => {
    ctx.moveTo(2, -140); ctx.bezierCurveTo(-4, -132, -17, -121, -21, -105);
    ctx.bezierCurveTo(-24, -94, -23, -83, -19, -74);
    ctx.bezierCurveTo(-8, -68, 9, -68, 19, -74);
    ctx.bezierCurveTo(27, -91, 22, -114, 10, -130); ctx.quadraticCurveTo(5, -137, 2, -140);
  }, ROSE);
  shape(ctx, () => {
    ctx.moveTo(2, -137); ctx.bezierCurveTo(9, -119, 16, -90, 7, -72);
    ctx.quadraticCurveTo(16, -71, 19, -75); ctx.bezierCurveTo(26, -95, 19, -121, 2, -137);
  }, '#8b536b', false);
  shape(ctx, () => {
    ctx.moveTo(-1, -129); ctx.bezierCurveTo(-13, -113, -19, -94, -16, -81);
    ctx.bezierCurveTo(-11, -77, -8, -82, -8, -92); ctx.bezierCurveTo(-9, -106, -4, -118, -1, -129);
  }, '#d98692', false);
  curveLine(ctx, [[-3, -122], [-10, -109], [-12, -97], [-11, -90]], '#f2b4a8', 2.1);
  // Sparse freckles suggest living skin without making the small sprite noisy.
  for (const [x, y, r] of [[-16, -95, 1.1], [12, -95, 1.5], [14, -88, 1.2], [9, -103, .9], [-5, -79, 1.2], [9, -79, .9]]) {
    oval(ctx, x, y, r, r * 1.3, '#975970');
  }
  shape(ctx, () => {
    ctx.moveTo(-21, -77); ctx.quadraticCurveTo(-1, -69, 21, -77);
    ctx.lineTo(19, -70); ctx.quadraticCurveTo(0, -63, -20, -70);
  }, '#d18b91');
  curveLine(ctx, [[-17, -73], [-9, -70], [7, -70], [17, -73]], '#f4baa6', 1.5);
}

function face(ctx: CanvasRenderingContext2D, startled: boolean, reaction?: CrewPose['reaction']) {
  shape(ctx, () => {
    ctx.moveTo(-22, -72); ctx.bezierCurveTo(-36, -68, -34, -51, -24, -42);
    ctx.bezierCurveTo(-14, -31, 14, -31, 24, -43); ctx.bezierCurveTo(35, -52, 35, -67, 22, -72);
    ctx.quadraticCurveTo(0, -66, -22, -72);
  }, CORAL);
  shape(ctx, () => {
    ctx.moveTo(-27, -49); ctx.bezierCurveTo(-11, -39, 15, -42, 30, -59);
    ctx.bezierCurveTo(27, -39, 13, -35, -1, -35); ctx.quadraticCurveTo(-18, -35, -27, -49);
  }, '#bc7886', false);
  oval(ctx, -26, -49, 4, 2, '#eead9b');
  oval(ctx, 26, -49, 4, 2, '#eead9b');
  const lookUp = reaction === 'apex' || reaction === 'escape';
  const eyeY = -59;
  for (const side of [-1, 1]) {
    const x = side * 16;
    oval(ctx, x, eyeY + 1, 12.5, startled ? 15.2 : 13.8, '#9b5d74');
    oval(ctx, x, eyeY, 10.6, startled ? 13.5 : 11.9, PAPER, true, side * .07);
    oval(ctx, x + 1.1, eyeY + (lookUp ? -3 : .9), 6.5, startled ? 8.2 : 7.7, '#617d81');
    oval(ctx, x + 1.6, eyeY + (lookUp ? -3 : .9), 4.2, startled ? 6.3 : 6, '#293b43');
    oval(ctx, x -.05, eyeY - 2.2 + (lookUp ? -3 : .9), 1.7, 2.2, '#fffdf0');
    oval(ctx, x + 3.2, eyeY + 3.8 + (lookUp ? -3 : .9), .7, .9, '#b5d6ce');
    curveLine(ctx, [[x - 8, eyeY - 14.5], [x - 3, eyeY - (side < 0 ? 20 : 17)], [x + 4, eyeY - (side < 0 ? 19 : 17)], [x + 8, eyeY - 14]], INK, 1.6);
  }
  // The little beak sits among the arm bases, with an amused cheek crease.
  if (startled) {
    oval(ctx, 1, -40, 3.4, 4.3, '#493647');
    oval(ctx, 1.5, -38.4, 1.8, 1.1, '#e8a19a');
  } else {
    shape(ctx, () => {
      ctx.moveTo(-2, -42); ctx.quadraticCurveTo(1, -45, 4, -42); ctx.lineTo(1, -38);
    }, '#654353', false);
    curveLine(ctx, [[-4, -39.5], [-1, -36], [4, -35.8], [7, -40]], INK, 1.45);
  }
}

/** Ganymede's foot-anchored squid. At s=80: x about -89..89, y -142..5.
 * Eight tapering arms and two longer club tentacles retain separate silhouettes.
 * Portrait face anchor: (0, -61); portrait poses deliberately suppress gait.
 */
export function drawGiantSquid(ctx: CanvasRenderingContext2D, cx: number, footY: number, s: number, char: GiantSquidPose) {
  const t = char.reducedMotion || char.portrait ? 0 : (char.stateTimer || 0);
  const state = char.portrait && char.state === 'squashed' ? 'idle' : char.state;
  const moving = !char.portrait && (state === 'walking' || state === 'returning' || state === 'running_away' || state === 'carrying');
  const running = state === 'running_away';
  const startled = state === 'startled' || state === 'rocket_startled';
  const pace = t * (running ? 9 : moving ? 3.8 : 1.15);
  const reach = Math.sin(pace) * (running ? 5.5 : moving ? 3 : 1);
  const bob = moving ? Math.abs(Math.sin(pace)) * (running ? 2.4 : 1.2) : Math.sin(t * 1.1) * .7;
  ctx.save(); ctx.translate(cx, footY); ctx.scale(s / 80, s / 80);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  oval(ctx, 0, 1, 54, 3.3, 'rgba(56,70,85,.15)');
  ctx.scale(char.direction === -1 ? -1 : 1, 1);
  if (state === 'squashed') {
    // Same complete animal, briefly concertinaed rather than replaced by a blob.
    ctx.translate(0, 1); ctx.scale(1.12, .27);
  } else ctx.translate(0, -bob);
  feedingTentacle(ctx, -1, reach, startled && !char.portrait);
  feedingTentacle(ctx, 1, -reach, startled && !char.portrait);

  // Four rear arms show broad reaches and tight returning curls.
  arm(ctx, [
    [[-18, -46], [-39, -43], [-43 - reach, -12], [-58 - reach, -18]],
    [[-58 - reach, -18], [-68 - reach, -24], [-63 - reach, -38], [-54 - reach, -32]],
  ], 5.6, PLUM, false);
  arm(ctx, [
    [[18, -45], [35, -40], [47 + reach, -11], [59 + reach, -20]],
    [[59 + reach, -20], [65 + reach, -29], [60 + reach, -36], [53 + reach, -31]],
  ], 5.8, PLUM, false);
  arm(ctx, [
    [[-11, -43], [-18, -27], [-39 + reach, -20], [-39 + reach, -8]],
    [[-39 + reach, -8], [-39 + reach, 1], [-25 + reach, 2], [-28 + reach, -7]],
  ], 5.7, '#a66179', true);
  arm(ctx, [
    [[11, -44], [23, -24], [39 - reach, -22], [42 - reach, -9]],
    [[42 - reach, -9], [46 - reach, 1], [29 - reach, 3], [31 - reach, -6]],
  ], 5.7, '#a66179', false);

  // Four front arms: two planted arches and two shorter, loosely curled feelers.
  arm(ctx, [
    [[-17, -44], [-24, -29], [-15 - reach * .4, -14], [-23 - reach * .4, -5]],
    [[-23 - reach * .4, -5], [-33 - reach * .4, 5], [-18 - reach * .4, 7], [-14 - reach * .4, 0]],
  ], 6.4, ROSE, true);
  arm(ctx, [
    [[17, -43], [24, -28], [14 + reach * .4, -12], [23 + reach * .4, -5]],
    [[23 + reach * .4, -5], [31 + reach * .4, 3], [19 + reach * .4, 6], [15 + reach * .4, 0]],
  ], 6.1, ROSE, true);
  arm(ctx, [
    [[-5, -42], [-10, -30], [-2 + reach * .3, -20], [-9 + reach * .3, -14]],
    [[-9 + reach * .3, -14], [-18 + reach * .3, -8], [-5 + reach * .3, -3], [-3 + reach * .3, -10]],
  ], 5.4, CORAL, true);
  arm(ctx, [
    [[6, -43], [14, -32], [4 - reach * .3, -22], [11 - reach * .3, -18]],
    [[11 - reach * .3, -18], [19 - reach * .3, -14], [11 - reach * .3, -7], [6 - reach * .3, -13]],
  ], 5, CORAL, true);
  mantle(ctx);
  face(ctx, startled, char.reaction);
  ctx.restore();
}
