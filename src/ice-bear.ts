import type { CrewPose } from './crew.ts';

/** A fictional, living ice sculpture. All dimensions use an 80 px/m foot anchor. */
export interface IceBearPose extends CrewPose {
  upright?: boolean;
  portrait?: boolean;
}

const INK = '#293e47';
const IVORY = '#f7f6e9';
const LIT = '#fffff4';
const ICE = '#dbeef0';
const SHADE = '#a9d3d9';
const DEEP = '#75aebb';
const EDGE = '#548692';
const TAU = Math.PI * 2;

function shape(ctx: CanvasRenderingContext2D, path: () => void, fill: string, outline = true) {
  ctx.beginPath(); path(); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (outline) { ctx.strokeStyle = INK; ctx.stroke(); }
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, outline = true) {
  shape(ctx, () => ctx.ellipse(x, y, rx, ry, 0, 0, TAU), fill, outline);
}

function stroke(ctx: CanvasRenderingContext2D, path: () => void, color = EDGE, width = 1.5) {
  ctx.save(); ctx.beginPath(); path(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.restore();
}

function plane(ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], color: string) {
  shape(ctx, () => {
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  }, color, false);
}

/** Small bevels and glints, rather than a row of spikes, keep the bear's outline soft. */
function frost(ctx: CanvasRenderingContext2D, x: number, y: number, size = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
  plane(ctx, [[-5, 0], [-2, -5], [3, -6], [6, -2], [3, 3], [-2, 3]], '#e3faf7');
  plane(ctx, [[-2, -5], [0, 0], [-2, 3], [-5, 0]], SHADE);
  stroke(ctx, () => { ctx.moveTo(-2, -4); ctx.lineTo(3, -5); ctx.lineTo(5, -2); }, LIT, 1.4);
  ctx.restore();
}

function paw(ctx: CanvasRenderingContext2D, x: number, y: number, far: boolean) {
  const coat = far ? '#bad8da' : IVORY;
  shape(ctx, () => {
    ctx.moveTo(x - 9, y - 11);
    ctx.bezierCurveTo(x - 6, y - 14, x + 5, y - 12, x + 9, y - 8);
    ctx.bezierCurveTo(x + 16, y - 8, x + 19, y - 3, x + 16, y + 1);
    ctx.quadraticCurveTo(x + 7, y + 5, x - 8, y + 2);
    ctx.quadraticCurveTo(x - 14, y, x - 9, y - 11);
  }, coat);
  plane(ctx, [[x - 10, y - 3], [x + 1, y - 1], [x + 16, y - 2], [x + 15, y + 1], [x + 5, y + 2], [x - 8, y + 1]], far ? '#87b7c1' : '#b8dadd');
  // Three short toe seams stay legible when the whole bear is small.
  for (const dx of [3, 8, 13]) {
    stroke(ctx, () => { ctx.moveTo(x + dx, y - 3); ctx.quadraticCurveTo(x + dx + 1, y - 1, x + dx, y + 1); }, far ? EDGE : '#70939c', 1.1);
  }
  if (!far) stroke(ctx, () => { ctx.moveTo(x - 5, y - 9); ctx.quadraticCurveTo(x + 2, y - 11, x + 7, y - 7); }, LIT, 2.1);
}

/** The ankle moves separately from the hip: paws plant, lift, and reach. */
function leg(ctx: CanvasRenderingContext2D, hipX: number, hipY: number, phase: number, moving: boolean, running: boolean, far: boolean, rear: boolean) {
  const swing = moving ? Math.sin(phase) * (running ? 10 : 6) : 0;
  const lift = moving ? Math.max(0, Math.cos(phase)) * (running ? 5.5 : 3.2) : 0;
  const footX = hipX + swing + (rear ? -3 : 4);
  const footY = (far ? -3 : 0) - lift;
  shape(ctx, () => {
    ctx.moveTo(hipX - 10, hipY);
    ctx.bezierCurveTo(hipX - 14, hipY + 10, footX - 11, footY - 20, footX - 9, footY - 6);
    ctx.quadraticCurveTo(footX - 1, footY - 2, footX + 9, footY - 6);
    ctx.bezierCurveTo(footX + 5, footY - 19, hipX + 13, hipY + 13, hipX + 11, hipY);
  }, far ? '#b9d8dc' : ICE);
  plane(ctx, [[hipX - 8, hipY + 3], [hipX - 1, hipY + 7], [footX - 2, footY - 8], [footX - 8, footY - 7]], far ? '#85b9c3' : SHADE);
  paw(ctx, footX, footY, far);
}

function head(ctx: CanvasRenderingContext2D, x: number, y: number, startled: boolean, reaction?: CrewPose['reaction'], tilt = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);

  // Low, rounded ears and a projecting muzzle are the bear's identifying features.
  oval(ctx, 10, -27, 8, 8.5, ICE);
  oval(ctx, 10, -27, 4.2, 4.6, '#93bbc4', false);
  oval(ctx, -19, -24, 9, 9.5, IVORY);
  oval(ctx, -19, -24, 4.8, 5.2, '#9bbfc5', false);
  oval(ctx, -20, -26, 2.1, 2, '#d8ece7', false);

  shape(ctx, () => {
    ctx.moveTo(-27, -8);
    ctx.bezierCurveTo(-27, -23, -16, -31, -2, -31);
    ctx.bezierCurveTo(11, -32, 21, -26, 23, -16);
    ctx.quadraticCurveTo(27, -9, 29, -3);
    ctx.bezierCurveTo(35, 7, 22, 18, 6, 18);
    ctx.bezierCurveTo(-10, 19, -26, 10, -27, -8);
  }, IVORY);
  plane(ctx, [[-25, -9], [-15, -24], [-9, -10], [-12, 6], [3, 16], [-10, 13], [-22, 4]], ICE);
  plane(ctx, [[-10, 10], [3, 3], [25, 1], [23, 13], [7, 17]], SHADE);
  stroke(ctx, () => { ctx.moveTo(-16, -23); ctx.quadraticCurveTo(-5, -29, 8, -26); }, LIT, 3.1);

  // The muzzle overlaps the cheek, with a broad, soft triangular nose at its tip.
  shape(ctx, () => {
    ctx.moveTo(3, -7);
    ctx.bezierCurveTo(13, -13, 25, -6, 34, -5);
    ctx.bezierCurveTo(43, -5, 46, 1, 42, 8);
    ctx.bezierCurveTo(38, 17, 19, 19, 9, 12);
    ctx.quadraticCurveTo(0, 7, 3, -7);
  }, '#fcf9e9');
  shape(ctx, () => {
    ctx.moveTo(7, 7); ctx.quadraticCurveTo(23, 15, 42, 5);
    ctx.bezierCurveTo(39, 16, 20, 18, 9, 11);
  }, '#cbdfe0', false);
  shape(ctx, () => {
    ctx.moveTo(31, -5);
    ctx.bezierCurveTo(37, -8, 47, -5, 46, 1);
    ctx.quadraticCurveTo(42, 7, 37, 7);
    ctx.quadraticCurveTo(31, 4, 31, -5);
  }, INK, false);
  oval(ctx, 37, -3.2, 4, 1.5, '#668894', false);

  const lookUp = reaction === 'apex' || reaction === 'escape';
  const eyeY = -13 + (lookUp ? -1.5 : 0);
  const sleepy = reaction === 'coast' && !startled;
  oval(ctx, -2, eyeY, startled ? 4.1 : 3.2, startled ? 5.2 : 3.8, INK, false);
  oval(ctx, -3.0, eyeY - 1.3, 1.05, 1.25, LIT, false);
  oval(ctx, 16, eyeY + 0.2, startled ? 2.8 : 2.3, startled ? 3.9 : 3, INK, false);
  oval(ctx, 15.4, eyeY - 0.8, 0.65, 0.8, LIT, false);
  if (sleepy) {
    stroke(ctx, () => { ctx.moveTo(-6, eyeY - 1); ctx.lineTo(2, eyeY - 1); }, IVORY, 3);
    stroke(ctx, () => { ctx.moveTo(13, eyeY - 0.5); ctx.lineTo(18, eyeY - 0.5); }, IVORY, 2.4);
  }
  stroke(ctx, () => {
    ctx.moveTo(-7, startled ? -23 : -20);
    ctx.quadraticCurveTo(-2, startled ? -27 : -22, 4, startled ? -22 : -20);
  }, EDGE, 1.65);
  if (startled) {
    oval(ctx, 24, 12, 4.5, 5, INK, false);
    oval(ctx, 24, 14.5, 2.7, 1.4, '#bca4a0', false);
  } else {
    stroke(ctx, () => { ctx.moveTo(36, 7); ctx.quadraticCurveTo(30, 13, 20, 10); }, INK, 1.65);
    stroke(ctx, () => { ctx.moveTo(20, 9); ctx.lineTo(19, 12); }, INK, 1.25);
  }
  // One carved cheek plane and a pair of freckles supply detail without visual noise.
  stroke(ctx, () => { ctx.moveTo(-20, -2); ctx.lineTo(-16, 3); ctx.lineTo(-11, 4); }, '#b0d0d3', 1.1);
  oval(ctx, 20, 1, 0.8, 0.8, '#9cafac', false);
  oval(ctx, 24, 3, 0.7, 0.7, '#9cafac', false);
  ctx.restore();
}

function quadrupedOutline(ctx: CanvasRenderingContext2D) {
  ctx.moveTo(-55, -39);
  ctx.bezierCurveTo(-59, -55, -50, -72, -34, -74);
  ctx.bezierCurveTo(-22, -77, -17, -69, -8, -75);
  ctx.bezierCurveTo(3, -86, 18, -86, 28, -78);
  ctx.bezierCurveTo(35, -72, 36, -63, 46, -58);
  ctx.quadraticCurveTo(49, -41, 35, -32);
  ctx.bezierCurveTo(24, -24, 5, -24, -4, -28);
  ctx.bezierCurveTo(-20, -23, -47, -22, -55, -39);
}

function quadruped(ctx: CanvasRenderingContext2D, pace: number, moving: boolean, running: boolean, startled: boolean, t: number, reaction?: CrewPose['reaction']) {
  oval(ctx, -56, -48, 7.8, 7.3, ICE);
  stroke(ctx, () => { ctx.moveTo(-60, -50); ctx.quadraticCurveTo(-57, -54, -53, -51); }, LIT, 1.8);
  leg(ctx, -24, -37, pace + Math.PI, moving, running, true, true);
  leg(ctx, 34, -40, pace, moving, running, true, false);
  leg(ctx, -40, -38, pace, moving, running, false, true);
  leg(ctx, 17, -43, pace + Math.PI, moving, running, false, false);

  shape(ctx, () => quadrupedOutline(ctx), IVORY);
  ctx.save(); ctx.beginPath(); quadrupedOutline(ctx); ctx.closePath(); ctx.clip();
  // Three broad translucent planes, clipped to a substantial rounded body.
  plane(ctx, [[-59, -42], [-43, -68], [-26, -62], [-28, -37], [-12, -22], [-53, -22]], ICE);
  plane(ctx, [[-7, -77], [12, -81], [27, -60], [18, -38], [-3, -28], [-17, -38]], '#e3f1ea');
  plane(ctx, [[27, -68], [42, -62], [50, -33], [13, -20], [-5, -28], [18, -39]], SHADE);
  plane(ctx, [[-54, -33], [-35, -30], [-24, -39], [-7, -29], [17, -34], [13, -20], [-54, -18]], '#c4e0df');
  stroke(ctx, () => { ctx.moveTo(-48, -58); ctx.bezierCurveTo(-41, -73, -26, -69, -22, -66); }, LIT, 3);
  stroke(ctx, () => { ctx.moveTo(-4, -76); ctx.quadraticCurveTo(11, -84, 21, -74); }, LIT, 3.7);
  ctx.restore();
  stroke(ctx, () => { ctx.moveTo(-36, -54); ctx.bezierCurveTo(-44, -49, -44, -34, -35, -30); }, '#8fb8bf', 1.8);
  stroke(ctx, () => { ctx.moveTo(19, -59); ctx.quadraticCurveTo(12, -46, 20, -32); }, '#719faa', 1.8);
  frost(ctx, -5, -71, 0.8);
  frost(ctx, -17, -66, 0.42);

  const sniff = !moving && !startled ? Math.sin(t * 0.8) * 1.4 : 0;
  head(ctx, 38, -64 + sniff, startled, reaction, startled ? -0.13 : running ? -0.055 : 0.045);
}

function arm(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, far: boolean, palm: boolean) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  shape(ctx, () => {
    ctx.moveTo(-9, -3);
    ctx.bezierCurveTo(-14, 7, -12, 23, -11, 35);
    ctx.bezierCurveTo(-13, 46, -1, 51, 8, 45);
    ctx.bezierCurveTo(15, 41, 10, 30, 9, 23);
    ctx.quadraticCurveTo(11, 9, 7, -2);
  }, far ? '#b4d4d9' : IVORY);
  plane(ctx, [[-9, 3], [-4, 7], [-4, 30], [5, 43], [-3, 46], [-9, 37]], far ? '#8bb8c2' : ICE);
  stroke(ctx, () => { ctx.moveTo(4, 7); ctx.quadraticCurveTo(7, 16, 5, 26); }, far ? '#cbe6e6' : LIT, 2.3);
  if (palm) {
    oval(ctx, -1, 35, 5.5, 6.5, DEEP, false);
    for (const [px, py] of [[-7, 27], [-2, 25], [4, 27]] as const) oval(ctx, px, py, 1.8, 2.2, DEEP, false);
  } else {
    for (const px of [-4, 1, 6]) stroke(ctx, () => { ctx.moveTo(px, 40); ctx.lineTo(px + 0.3, 44); }, EDGE, 1.1);
  }
  ctx.restore();
}

function upright(ctx: CanvasRenderingContext2D, pace: number, moving: boolean, running: boolean, startled: boolean, reaction?: CrewPose['reaction']) {
  const swing = moving ? Math.sin(pace) : 0;
  oval(ctx, -30, -42, 7, 7, ICE);
  leg(ctx, -18, -38, pace + Math.PI, moving, running, true, false);
  leg(ctx, 17, -37, pace, moving, running, false, false);
  arm(ctx, -26, -95, startled ? 1.2 : 0.1 + swing * 0.2, true, startled);
  const torso = () => {
    ctx.moveTo(-30, -34);
    ctx.bezierCurveTo(-43, -54, -37, -94, -22, -108);
    ctx.bezierCurveTo(-10, -120, 13, -117, 27, -101);
    ctx.bezierCurveTo(37, -86, 41, -55, 30, -35);
    ctx.bezierCurveTo(21, -18, -16, -18, -30, -34);
  };
  shape(ctx, torso, IVORY);
  ctx.save(); ctx.beginPath(); torso(); ctx.closePath(); ctx.clip();
  plane(ctx, [[-31, -93], [-16, -110], [-8, -91], [-18, -62], [-8, -24], [-32, -29], [-40, -63]], ICE);
  plane(ctx, [[17, -105], [38, -85], [32, -42], [16, -25], [7, -40], [18, -67]], '#dcece6');
  plane(ctx, [[-30, -40], [-11, -31], [9, -35], [32, -47], [30, -26], [5, -16], [-23, -23]], SHADE);
  stroke(ctx, () => { ctx.moveTo(-21, -99); ctx.quadraticCurveTo(-9, -111, 3, -106); }, LIT, 3.5);
  stroke(ctx, () => { ctx.moveTo(-10, -76); ctx.bezierCurveTo(3, -83, 20, -72, 22, -55); }, LIT, 3.5);
  ctx.restore();
  // A single bent facet gives the belly depth without turning it into a mosaic.
  stroke(ctx, () => { ctx.moveTo(-21, -55); ctx.lineTo(-17, -42); ctx.lineTo(-7, -36); }, '#afcfd2', 1.2);
  frost(ctx, -16, -92, 0.65);
  arm(ctx, 29, -94, startled ? -1.06 : -0.08 - swing * 0.25, false, startled);
  head(ctx, 6, -118, startled, reaction, startled ? -0.08 : -0.015);
}

function portrait(ctx: CanvasRenderingContext2D) {
  // A dedicated bust makes the face steady and generously framed in the inset.
  shape(ctx, () => {
    ctx.moveTo(-39, 0); ctx.lineTo(-38, -32);
    ctx.bezierCurveTo(-35, -55, -20, -65, -4, -66);
    ctx.bezierCurveTo(18, -65, 35, -49, 39, -26);
    ctx.lineTo(42, 0);
  }, IVORY);
  plane(ctx, [[-34, -40], [-19, -56], [-11, -45], [-17, -18], [-6, 0], [-39, 0]], ICE);
  plane(ctx, [[14, -53], [32, -41], [42, 0], [23, 0], [15, -24]], SHADE);
  frost(ctx, -22, -40, 0.8);
  head(ctx, -8, -75, false);
}

/**
 * Foot-anchored ice bear, facing right before mirroring.
 * Resting quadruped: x -65..86, y -102..5; upright: x -48..61, y -155..5.
 * Startled arms extend to about +/-80. Walking adds at most 13 units of stride/bob.
 * The stable portrait's face centre is (1, -82), with eyes around (-10, -88).
 */
export function drawIceBear(ctx: CanvasRenderingContext2D, cx: number, footY: number, s: number, char: IceBearPose) {
  const t = char.reducedMotion ? 0 : (char.stateTimer || 0);
  const moving = char.state === 'walking' || char.state === 'returning' || char.state === 'running_away' || char.state === 'carrying';
  const startled = char.state === 'startled' || char.state === 'rocket_startled';
  const running = char.state === 'running_away';
  const standing = startled || (moving && !running && !!char.upright);
  const pace = t * (running ? 11 : standing ? 4 : 4.6);
  const bob = char.reducedMotion ? 0 : startled ? Math.sin(Math.min(1, t / 0.7) * Math.PI) * 5
    : moving ? Math.abs(Math.sin(pace)) * (running ? 2.5 : 0.9) : 0;

  ctx.save(); ctx.translate(cx, footY); ctx.scale(s / 80, s / 80);
  ctx.lineWidth = 2.05; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK;
  if (char.portrait) { portrait(ctx); ctx.restore(); return; }
  oval(ctx, 0, 2, standing ? 33 : 55, 3.5, 'rgba(39,70,81,.16)', false);
  ctx.scale(char.direction === -1 ? -1 : 1, 1);

  if (char.state === 'squashed') {
    shape(ctx, () => {
      ctx.moveTo(-59, -4); ctx.quadraticCurveTo(-59, -15, -34, -15);
      ctx.bezierCurveTo(-17, -21, -1, -14, 15, -16);
      ctx.quadraticCurveTo(52, -14, 56, -2);
      ctx.quadraticCurveTo(4, 8, -59, -4);
    }, ICE);
    plane(ctx, [[-50, -4], [-30, -12], [-10, -6], [19, -12], [38, -1], [6, 4], [-31, 2]], SHADE);
    ctx.save(); ctx.translate(29, -5); ctx.scale(0.78, 0.47); head(ctx, 0, 0, false, 'fizzle'); ctx.restore();
    frost(ctx, -30, -10, 0.8); frost(ctx, -50, -4, 0.45);
    ctx.restore(); return;
  }
  ctx.translate(0, -bob);
  if (moving) ctx.rotate(Math.sin(pace) * (running ? 0.035 : standing ? 0.014 : 0.009));
  if (standing) upright(ctx, pace, moving, running, startled, char.reaction);
  else quadruped(ctx, pace, moving, running, startled, t, char.reaction);
  ctx.restore();
}
