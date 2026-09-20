import type { CrewPose } from './crew.ts';
export { drawGiantSquid } from './squid.ts';
export { drawIceBear } from './ice-bear.ts';

const INK = '#293b43';
const CREAM = '#fff3d9';
const RUST = '#c66643';
const GOLD = '#e8ae53';
const TAU = Math.PI * 2;

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, outline = true) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = fill; ctx.fill();
  if (outline) { ctx.strokeStyle = INK; ctx.stroke(); }
}

function shape(ctx: CanvasRenderingContext2D, path: () => void, fill: string, outline = true) {
  ctx.beginPath(); path(); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (outline) { ctx.strokeStyle = INK; ctx.stroke(); }
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number, color: string) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = INK;
}

function isWalking(pose: CrewPose) {
  return pose.state === 'walking' || pose.state === 'returning' || pose.state === 'running_away' || pose.state === 'carrying';
}

function isStartled(pose: CrewPose) {
  return pose.state === 'startled' || pose.state === 'rocket_startled';
}

/** Snowballs, not flat white discs: cool lower edges and tiny packed-snow marks. */
function snowball(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ellipse(ctx, x, y, rx, ry, '#f5f4e9');
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y, rx - 0.8, ry - 0.8, 0, 0, TAU); ctx.clip();
  shape(ctx, () => {
    ctx.moveTo(x - rx, y + ry * 0.45);
    ctx.bezierCurveTo(x - rx * 0.15, y + ry * 0.94, x + rx * 0.87, y + ry * 0.48, x + rx * 0.65, y - ry);
    ctx.lineTo(x + rx + 2, y - ry); ctx.lineTo(x + rx + 2, y + ry + 2); ctx.lineTo(x - rx, y + ry + 2);
  }, '#c9dcdf', false);
  ellipse(ctx, x - rx * 0.3, y - ry * 0.38, rx * 0.39, ry * 0.22, '#fffdf2', false);
  for (const [dx, dy, size] of [[-0.65, 0.07, 1], [-0.4, 0.5, 0.8], [0.48, 0.45, 1.1], [0.69, -0.03, 0.7], [-0.17, 0.72, 0.7]]) {
    ellipse(ctx, x + dx * rx, y + dy * ry, size, size * 0.75, '#a5c0c6', false);
  }
  ctx.restore();
}

function knittedCap(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.72);
  shape(ctx, () => {
    ctx.moveTo(-18, 3); ctx.bezierCurveTo(-21, -15, -8, -27, 6, -22);
    ctx.bezierCurveTo(17, -20, 20, -9, 18, 3);
  }, '#568077');
  ctx.save(); ctx.beginPath(); ctx.rect(-16, -24, 32, 23); ctx.clip();
  for (let x = -12; x <= 13; x += 6) {
    ctx.beginPath(); ctx.moveTo(x, -17); ctx.quadraticCurveTo(x - 2, -9, x, -2);
    ctx.strokeStyle = '#76998b'; ctx.lineWidth = 1.3; ctx.stroke();
  }
  ctx.restore(); ctx.lineWidth = 2;
  shape(ctx, () => ctx.roundRect(-21, -2, 42, 10, 4), '#42695f');
  for (let x = -15; x <= 15; x += 5) line(ctx, x, 0, x, 5, 1.1, '#86aa96');
  ellipse(ctx, 4, -23, 7, 6.5, GOLD);
  ellipse(ctx, 1.7, -25.2, 2.5, 1.8, CREAM, false);
  ctx.restore();
}

/** Foot-anchored snowman; nominal bounds at 80 px/m: x -46..46, y -124..2. */
export function drawSnowman(ctx: CanvasRenderingContext2D, cx: number, footY: number, s: number, char: CrewPose) {
  const t = char.reducedMotion ? 0 : (char.stateTimer || 0);
  const moving = isWalking(char);
  const startled = isStartled(char);
  const running = char.state === 'running_away';
  const direction = char.direction === -1 ? -1 : 1;
  const phase = t * (running ? 10 : 5);
  const hop = char.reducedMotion ? 0 : startled ? Math.sin(Math.min(1, t / 0.7) * Math.PI) * 5 : moving ? Math.abs(Math.sin(phase)) * 3 : 0;
  ctx.save(); ctx.translate(cx, footY); ctx.scale(s / 80, s / 80);
  ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
  ellipse(ctx, 0, 0, 27, 3, 'rgba(35,48,43,.15)', false);
  if (char.state === 'squashed') {
    ellipse(ctx, 0, -4, 35, 6, '#dce8e5');
    ellipse(ctx, -9, -5, 2.3, 2.3, INK, false); ellipse(ctx, 0, -5, 2.3, 2.3, INK, false);
    shape(ctx, () => { ctx.moveTo(7, -6); ctx.lineTo(30, -3); ctx.lineTo(8, -1); }, '#e78642');
    ctx.save(); ctx.translate(-19, -5); ctx.rotate(-0.3); ctx.scale(0.7, 0.7); knittedCap(ctx, 0, 0); ctx.restore();
    ctx.restore(); return;
  }
  ctx.translate(0, -hop);
  if (moving) ctx.rotate(Math.sin(phase) * (running ? 0.065 : 0.035));

  // The twig elbows stay visible between the snow and the oversized wool mittens.
  const raised = startled || char.reaction === 'apex' || char.state === 'celebrating';
  for (const side of [-1, 1]) {
    const handY = raised ? -76 : -53 + (moving ? Math.sin(phase + side) * 3 : 0);
    const elbowX = side * 29;
    line(ctx, side * 17, -60, elbowX, -57, 5, INK);
    line(ctx, elbowX, -57, side * 38, handY, 4, INK);
    line(ctx, side * 17, -60, elbowX, -57, 2.5, '#ac835b');
    line(ctx, elbowX, -57, side * 38, handY, 2, '#ac835b');
    ctx.save(); ctx.translate(side * 38, handY); ctx.rotate(side * -0.3);
    shape(ctx, () => {
      ctx.moveTo(-5, 4); ctx.lineTo(-6, -4); ctx.bezierCurveTo(-6, -11, 5, -11, 5, -4);
      ctx.bezierCurveTo(10, -9, 12, -3, 7, 1); ctx.lineTo(5, 6);
    }, RUST);
    line(ctx, -4, 4, 4, 5, 3, '#e6b47c'); ctx.restore();
  }
  snowball(ctx, 0, -23.5, 27, 24);
  snowball(ctx, -1, -55.5, 21, 21);
  snowball(ctx, 0, -85, 18, 18);

  // A broad scarf with a separate knitted tail gives the silhouette some swagger.
  const flutter = moving ? Math.sin(phase) * 3 : Math.sin(t * 2) * 1.3;
  shape(ctx, () => {
    ctx.moveTo(-9, -74); ctx.bezierCurveTo(-11, -64, -17 + flutter, -54, -11 + flutter, -45);
    ctx.lineTo(-1 + flutter, -47); ctx.bezierCurveTo(-5 + flutter, -55, 1, -65, 1, -74);
  }, RUST);
  line(ctx, -12 + flutter, -55, -3 + flutter, -56, 3, '#e7b47d');
  for (let i = 0; i < 4; i++) line(ctx, -10 + flutter + i * 2.5, -46, -10 + flutter + i * 2.5, -42, 1.2, RUST);
  shape(ctx, () => {
    ctx.moveTo(-18, -75); ctx.quadraticCurveTo(0, -68, 18, -76);
    ctx.lineTo(19, -69); ctx.quadraticCurveTo(1, -60, -19, -69);
  }, RUST);
  ctx.beginPath(); ctx.moveTo(-15, -71); ctx.quadraticCurveTo(0, -66, 15, -72);
  ctx.lineWidth = 2; ctx.strokeStyle = '#efc997'; ctx.stroke();

  for (const [x, y] of [[3, -54], [4, -44], [4, -22]]) {
    ellipse(ctx, x, y, 3.2, 3, INK, false); ellipse(ctx, x - 0.8, y - 0.8, 0.85, 0.75, '#839698', false);
  }
  const glance = char.reaction === 'apex' || char.reaction === 'escape' ? -1.2 : 0;
  for (const x of [-6.5, 6.5]) {
    ellipse(ctx, x + direction * 0.7, -88 + glance, 2.6, startled ? 3.8 : 3, INK, false);
    ellipse(ctx, x + direction * 0.7 - 0.6, -89.1 + glance, 0.8, 0.8, '#fffdf2', false);
  }
  ellipse(ctx, -12, -82, 3.1, 1.7, '#e7b4a1', false);
  ellipse(ctx, 12, -82, 3.1, 1.7, '#e7b4a1', false);
  if (startled) ellipse(ctx, 1, -76.5, 3.3, 4, INK, false);
  else for (const [x, y] of [[-6, -78.8], [-2, -77.1], [2, -76.8], [6, -78.1]]) ellipse(ctx, x, y, 1.15, 1.15, INK, false);
  shape(ctx, () => {
    ctx.moveTo(direction * 0.5, -85.5); ctx.quadraticCurveTo(direction * 9, -87, direction * 22, -81.5);
    ctx.quadraticCurveTo(direction * 8, -80, direction * 0.5, -81);
  }, '#ed914b');
  line(ctx, direction * 7, -84, direction * 6, -81.5, 1, '#bf653a');
  knittedCap(ctx, 0, -102);
  ctx.restore();
}

function newtFoot(ctx: CanvasRenderingContext2D, x: number, y: number, stride: number, fill: string) {
  shape(ctx, () => {
    ctx.moveTo(x - 4, y - 16); ctx.quadraticCurveTo(x - 9, y - 6, x - 5 + stride, y - 2);
    ctx.lineTo(x - 9 + stride, y + 1); ctx.quadraticCurveTo(x - 9 + stride, y + 4, x - 3 + stride, y + 2);
    ctx.quadraticCurveTo(x - 1 + stride, y + 5, x + 2 + stride, y + 2);
    ctx.quadraticCurveTo(x + 11 + stride, y + 4, x + 9 + stride, y);
    ctx.lineTo(x + 3 + stride, y - 4); ctx.quadraticCurveTo(x + 2, y - 10, x + 5, y - 14);
  }, fill);
}

/** Venus's unmistakably fictional salamander; bounds at 80 px/m: -80..58, -66..3. */
export function drawNewt(ctx: CanvasRenderingContext2D, cx: number, footY: number, s: number, char: CrewPose) {
  const t = char.reducedMotion ? 0 : (char.stateTimer || 0);
  const moving = isWalking(char);
  const startled = isStartled(char);
  const running = char.state === 'running_away';
  const direction = char.direction === -1 ? -1 : 1;
  const stride = moving ? Math.sin(t * (running ? 14 : 6)) * 4 : 0;
  const tailSway = char.reducedMotion ? 0 : Math.sin(t * (moving ? 5 : 1.8)) * 3;
  const jump = char.reducedMotion || !startled ? 0 : Math.sin(Math.min(1, t / 0.6) * Math.PI) * 5;
  ctx.save(); ctx.translate(cx, footY); ctx.scale(s / 80, s / 80);
  ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK;
  ellipse(ctx, -4, 1, 45, 3, 'rgba(35,48,43,.15)', false);
  ctx.scale(direction, 1);
  if (char.state === 'squashed') {
    ellipse(ctx, 0, -5, 43, 6, '#df8650');
    ellipse(ctx, 28, -9, 8, 7, CREAM); ellipse(ctx, 42, -8, 7, 6, CREAM);
    ellipse(ctx, 29, -8, 2, 2, INK, false); ellipse(ctx, 43, -7, 2, 2, INK, false);
    ctx.beginPath(); ctx.moveTo(27, -2); ctx.quadraticCurveTo(37, 2, 47, -2); ctx.stroke();
    ctx.restore(); return;
  }
  ctx.translate(0, -jump - (moving ? Math.abs(stride) * 0.3 : 0));

  // The tapering, upward-curled tail is part of the silhouette at every scale.
  shape(ctx, () => {
    ctx.moveTo(-23, -38); ctx.bezierCurveTo(-45, -38, -61, -35, -66, -50 + tailSway);
    ctx.bezierCurveTo(-71, -63 + tailSway, -63, -67 + tailSway, -64, -65 + tailSway);
    ctx.bezierCurveTo(-85, -61 + tailSway, -83, -41, -69, -31);
    ctx.bezierCurveTo(-57, -22, -44, -21, -25, -18);
  }, '#c56b43');
  ctx.beginPath(); ctx.moveTo(-64, -58 + tailSway); ctx.bezierCurveTo(-76, -46, -55, -30, -33, -29);
  ctx.strokeStyle = '#eda35a'; ctx.lineWidth = 3.5; ctx.stroke(); ctx.lineWidth = 2;
  newtFoot(ctx, -26, -6, -stride, '#b86442');
  newtFoot(ctx, 15, -6, stride, '#b86442');

  // A long shoulder-to-hip curve separates the salamander from a generic blob.
  shape(ctx, () => {
    ctx.moveTo(-38, -23); ctx.bezierCurveTo(-39, -44, -13, -50, 10, -44);
    ctx.bezierCurveTo(27, -40, 33, -29, 27, -16);
    ctx.bezierCurveTo(21, -6, -6, -10, -20, -10); ctx.bezierCurveTo(-33, -10, -38, -16, -38, -23);
  }, '#df8550');
  shape(ctx, () => {
    ctx.moveTo(-31, -19); ctx.bezierCurveTo(-11, -9, 11, -17, 27, -26);
    ctx.bezierCurveTo(32, -13, 10, -9, -16, -11); ctx.quadraticCurveTo(-26, -11, -31, -19);
  }, '#f0c88c', false);
  ctx.beginPath(); ctx.moveTo(-29, -33); ctx.bezierCurveTo(-20, -40, -5, -42, 7, -39);
  ctx.strokeStyle = '#f3ad6a'; ctx.lineWidth = 3.5; ctx.stroke(); ctx.lineWidth = 2;
  for (const [x, y, rx, ry] of [[-24, -32, 4, 3], [-12, -38, 3.6, 2.6], [-5, -27, 4.5, 3], [8, -34, 3, 2.3], [-29, -23, 2, 1.8]]) {
    ellipse(ctx, x, y, rx, ry, '#9e583c', false);
  }
  newtFoot(ctx, -21, -1, stride, '#df8550');
  newtFoot(ctx, 18, -1, -stride, '#e79255');

  // A broad face, frog-like raised eyes and a blunt snout read as a friendly newt.
  shape(ctx, () => {
    ctx.moveTo(7, -39); ctx.bezierCurveTo(5, -54, 17, -59, 30, -55);
    ctx.bezierCurveTo(42, -54, 54, -45, 55, -34); ctx.bezierCurveTo(58, -19, 43, -13, 28, -16);
    ctx.bezierCurveTo(11, -17, 6, -25, 7, -39);
  }, '#e98b50');
  shape(ctx, () => {
    ctx.moveTo(12, -28); ctx.bezierCurveTo(22, -23, 45, -25, 54, -33);
    ctx.bezierCurveTo(59, -20, 43, -14, 28, -17); ctx.bezierCurveTo(18, -18, 13, -21, 12, -28);
  }, '#f5d3a0', false);
  ellipse(ctx, 19, -49, 11, 13, '#ed9858');
  ellipse(ctx, 40, -45.5, 11.5, 13, '#ee9a58');
  ellipse(ctx, 19.5, -49, 8.4, startled ? 10.7 : 9.6, CREAM);
  ellipse(ctx, 40.5, -45.5, 8.7, startled ? 10.8 : 9.6, CREAM);
  const lookY = char.reaction === 'apex' || char.reaction === 'escape' ? -2.5 : 0;
  for (const [x, y] of [[22, -48], [43, -44.5]]) {
    ellipse(ctx, x, y + lookY, 4, startled ? 5.8 : 5, INK, false);
    ellipse(ctx, x - 1.2, y - 2 + lookY, 1.35, 1.7, '#fffdf2', false);
  }
  if (!startled) {
    ctx.beginPath(); ctx.moveTo(11, -60); ctx.quadraticCurveTo(18, -64, 24, -60);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  }
  for (const [x, y] of [[12, -34], [17, -31], [21, -34]]) ellipse(ctx, x, y, 1.1, 1, '#a8593d', false);
  ellipse(ctx, 50, -33.5, 1.3, 1, '#9e583c', false);
  if (startled) {
    ellipse(ctx, 37, -26.5, 5, 5.8, '#69443c');
    ellipse(ctx, 37.5, -23.8, 3, 1.7, '#e09a7c', false);
  } else {
    ctx.beginPath(); ctx.moveTo(23, -27.5); ctx.bezierCurveTo(30, -21, 45, -22, 50, -28);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
    line(ctx, 22, -29, 22.5, -26.5, 1.6, INK);
  }
  ctx.restore();
}
