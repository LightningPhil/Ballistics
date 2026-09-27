import { viewingDevice, type CrewPose } from './crew.ts';
import { gazeAim, observationAim } from './crew-watch.ts';
import { businessTime } from './character-business.ts';
import { drawPoliceHat } from './silly-props.ts';
import {
  INK, TAU, clamp, lerp, finite, at, pen, oval, shape, line, roundBox, groundShadow, limb, joint,
  footfall, gaitPhase, blink, eye, mouth, dust, dizzy, surprise, type Ctx, type Point, type Footfall,
} from './toon.ts';

interface GuestPose extends CrewPose {
  portrait?: boolean;
}

const CREAM = '#fff3d9';
const RUST = '#c66643';
const GOLD = '#e8ae53';
const UNITS_PER_METRE = 80;

function isWalking(pose: CrewPose) {
  return pose.state === 'walking' || pose.state === 'returning' || pose.state === 'running_away' || pose.state === 'running_to' || pose.state === 'carrying';
}

function isStartled(pose: CrewPose) {
  return pose.state === 'startled' || pose.state === 'rocket_startled';
}

/** Snowballs, not flat white discs: cool lower edges and tiny packed-snow marks. */
function snowball(ctx: Ctx, x: number, y: number, rx: number, ry: number) {
  oval(ctx, x, y, rx, ry, '#f5f4e9');
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx - .8), Math.max(0, ry - .8), 0, 0, TAU); ctx.clip();
  shape(ctx, () => {
    ctx.moveTo(x - rx, y + ry * .45);
    ctx.bezierCurveTo(x - rx * .15, y + ry * .94, x + rx * .87, y + ry * .48, x + rx * .65, y - ry);
    ctx.lineTo(x + rx + 2, y - ry); ctx.lineTo(x + rx + 2, y + ry + 2); ctx.lineTo(x - rx, y + ry + 2);
  }, '#c9dcdf', false);
  oval(ctx, x - rx * .3, y - ry * .38, rx * .39, ry * .22, '#fffdf2', false);
  for (const [dx, dy, size] of [[-.65, .07, 1], [-.4, .5, .8], [.48, .45, 1.1], [.69, -.03, .7], [-.17, .72, .7]]) {
    oval(ctx, x + dx * rx, y + dy * ry, size, size * .75, '#a5c0c6', false);
  }
  ctx.restore();
}

function knittedCap(ctx: Ctx, x: number, y: number, bobble = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, .72);
  const dome = () => {
    ctx.moveTo(-18, 3); ctx.bezierCurveTo(-21, -15, -8, -27, 6, -22);
    ctx.bezierCurveTo(17, -20, 20, -9, 18, 3);
  };
  shape(ctx, dome, '#568077');
  ctx.save(); ctx.beginPath(); dome(); ctx.closePath(); ctx.clip();
  for (let rib = -12; rib <= 13; rib += 6) {
    line(ctx, () => { ctx.moveTo(rib, -17); ctx.quadraticCurveTo(rib - 2, -9, rib, -2); }, '#76998b', 1.3);
  }
  ctx.restore();
  shape(ctx, () => roundBox(ctx, -21, -2, 42, 10, 4), '#42695f');
  for (let rib = -15; rib <= 15; rib += 5) line(ctx, () => { ctx.moveTo(rib, 0); ctx.lineTo(rib, 5); }, '#86aa96', 1.1);
  oval(ctx, 4 - bobble, -23 - Math.abs(bobble) * .3, 7, 6.5, GOLD);
  oval(ctx, 1.7 - bobble, -25.2 - Math.abs(bobble) * .3, 2.5, 1.8, CREAM, false);
  ctx.restore();
}

function mitten(ctx: Ctx, x: number, y: number, angle: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  shape(ctx, () => {
    ctx.moveTo(-5, 4); ctx.lineTo(-6, -4); ctx.bezierCurveTo(-6, -11, 5, -11, 5, -4);
    ctx.bezierCurveTo(10, -9, 12, -3, 7, 1); ctx.lineTo(5, 6);
  }, RUST);
  line(ctx, () => { ctx.moveTo(-4, 4); ctx.lineTo(4, 5); }, '#e6b47c', 3);
  ctx.restore();
}

/** A twig arm with an elbow, ending in an oversized wool mitten. */
function twigArm(ctx: Ctx, side: number, shoulder: Point, hand: Point) {
  const elbow = joint(shoulder, hand, 13, 13, side > 0 ? 1 : -1);
  const twig = () => { ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(elbow.x, elbow.y); ctx.lineTo(hand.x, hand.y); };
  line(ctx, twig, INK, 5);
  line(ctx, twig, '#ac835b', 2.4);
  const tip = at(lerp(shoulder.x, elbow.x, .55), lerp(shoulder.y, elbow.y, .55));
  line(ctx, () => { ctx.moveTo(tip.x, tip.y); ctx.lineTo(tip.x + side * 4, tip.y - 5); }, INK, 3.6);
  line(ctx, () => { ctx.moveTo(tip.x, tip.y); ctx.lineTo(tip.x + side * 4, tip.y - 5); }, '#ac835b', 1.6);
  mitten(ctx, hand.x, hand.y, side * -.3 + Math.atan2(hand.y - elbow.y, hand.x - elbow.x) * .15);
}

/**
 * Foot-anchored snowman, three-quarter view; bounds at 80 px/m: x -46..46,
 * y -124..2. He travels in squashy hops, landing in little snow puffs; a
 * fright pops his head clean off his shoulders for a moment.
 */
export function drawSnowman(ctx: CanvasRenderingContext2D, cx: number, footY: number, s: number, char: GuestPose) {
  const t = char.business ? businessTime(char) : char.reducedMotion ? 0 : finite(char.stateTimer);
  const juggling=char.business?.kind==='snowballs';
  const moving = isWalking(char);
  const startled = isStartled(char);
  const running = char.state === 'running_away' || char.state === 'running_to';
  const aim = observationAim(char), gaze=aim||gazeAim(char), tilt = gaze?.yaw ? -gaze.elevation : 0;
  const direction = gaze ? gaze.yaw < 0 ? -1 : 1 : char.direction === -1 ? -1 : 1;
  const grip = (side: number) => {
    const x = aim?.yaw ? side < 0 ? 5 : 15 : side * 8, y = 5;
    return at(2 + Math.cos(tilt) * x - Math.sin(tilt) * y, -88 + Math.sin(tilt) * x + Math.cos(tilt) * y);
  };
  ctx.save(); ctx.translate(cx, footY); ctx.scale(s / 80, s / 80);
  pen(ctx, 2);

  if (char.state === 'squashed') {
    groundShadow(ctx, 0, 38);
    oval(ctx, 0, -4, 35, 6, '#dce8e5');
    oval(ctx, -9, -5, 2.3, 2.3, INK, false); oval(ctx, 0, -5, 2.3, 2.3, INK, false);
    shape(ctx, () => { ctx.moveTo(7, -6); ctx.lineTo(30, -3); ctx.lineTo(8, -1); }, '#e78642');
    ctx.save(); ctx.translate(-19, -5); ctx.rotate(-.3); ctx.scale(.7, .7); knittedCap(ctx, 0, 0); ctx.restore();
    dizzy(ctx, 0, -20, 16, t);
    ctx.restore(); return;
  }

  // Hop cycle: squash on landing, stretch at take-off, then a floaty arc.
  const speed = Math.max(.2, finite(char.speed, 1.1)) * (running ? 3.5 : 1);
  const hopLength = running ? 44 : 26;
  const hopPeriod = hopLength / (speed * UNITS_PER_METRE);
  const p = moving ? (t / Math.max(.18, hopPeriod)) % 1 : 0;
  const contact = .26;
  const air = moving && p > contact ? Math.sin(Math.PI * (p - contact) / (1 - contact)) : 0;
  const squash = moving && p <= contact ? Math.sin(Math.PI * p / contact) : 0;
  const hop = air * (running ? 17 : 10);
  const breathe = moving ? 0 : Math.sin(t * 1.9) * .012;
  const stretch = 1 - squash * .16 + air * .06 + breathe;
  // Startled: a jump, and the head pops up off the body before settling back.
  const leap = startled ? Math.sin(clamp(t / .7) * Math.PI) * 7 : 0;
  const pop = startled ? Math.sin(clamp(t / .55) * Math.PI) * 16 : 0;
  const lean = running ? .09 : moving ? .03 : 0;
  const rock = moving ? Math.sin(TAU * p) * (running ? .05 : .03) : Math.sin(t * .7) * .012;

  groundShadow(ctx, 0, 28 * clamp(1 - hop / 45, .6, 1));
  ctx.scale(direction, 1);
  // A puff of snow where he last landed, left behind as he hops on.
  if (moving) dust(ctx, -p * hopLength, 0, p / .6, 7, 'rgba(236,244,246,');
  ctx.translate(0, -hop - leap);
  ctx.rotate(lean + rock);
  ctx.scale(1 / Math.sqrt(stretch), stretch);

  // Twig arms flap for balance in the air and fly up in a fright.
  const raised = startled || char.reaction === 'apex' || char.state === 'celebrating';
  const flap = air * (running ? 14 : 9);
  for (const side of [-1, 1]) {
    const shoulder = at(side * 17, -60);
    const swing = moving ? Math.sin(TAU * p + (side > 0 ? 0 : Math.PI)) * 3 : Math.sin(t * 1.4 + side) * 1.2;
    const hand = raised ? at(side * 34, -84 + (startled ? Math.sin(t * 20 + side) * 3 : 0))
      : at(side * 37, -52 + swing - flap);
    if (side < 0 && !aim && !juggling) twigArm(ctx, side, shoulder, hand);
  }
  snowball(ctx, 0, -23.5, 27, 24);
  snowball(ctx, -1, -55.5, 21, 21);
  for (const [x, y] of [[3, -54], [4, -44], [4, -22]]) {
    oval(ctx, x, y, 3.2, 3, INK, false); oval(ctx, x - .8, y - .8, .85, .75, '#839698', false);
  }

  // Head, scarf and cap ride together; the head lags a touch behind each hop.
  ctx.save();
  const lag = moving ? -Math.cos(TAU * p) * 1.4 : 0;
  ctx.translate(0, -pop + lag);
  if (gaze) { ctx.translate(2,-88); ctx.rotate(tilt); ctx.translate(-2,88); }
  const flutter = moving ? -air * 5 - (running ? 3 : 0) : Math.sin(t * 2) * 1.3;
  shape(ctx, () => {
    ctx.moveTo(-9, -74); ctx.bezierCurveTo(-11, -64, -17 + flutter, -54 - flutter * .6, -11 + flutter * 1.6, -45 - flutter * .8);
    ctx.lineTo(-1 + flutter * 1.6, -47 - flutter * .8); ctx.bezierCurveTo(-5 + flutter, -55, 1, -65, 1, -74);
  }, RUST);
  line(ctx, () => { ctx.moveTo(-12 + flutter, -55); ctx.lineTo(-3 + flutter, -56); }, '#e7b47d', 3);
  snowball(ctx, 0, -85, 18, 18);
  shape(ctx, () => {
    ctx.moveTo(-18, -75); ctx.quadraticCurveTo(0, -68, 18, -76);
    ctx.lineTo(19, -69); ctx.quadraticCurveTo(1, -60, -19, -69);
  }, RUST);
  line(ctx, () => { ctx.moveTo(-15, -71); ctx.quadraticCurveTo(0, -66, 15, -72); }, '#efc997', 2);

  const look = juggling ? at(Math.sin(t*3)*.6,-.8) : char.state === 'inspecting' ? at(.65, .8) : char.reaction === 'apex' || char.reaction === 'escape' ? at(.5, -.9) : gaze?.yaw===0 ? at(0,0) : at(.6, 0);
  const open = startled ? 1 : blink(t, 4.1, .4);
  // Keep a three-quarter face on sideways glances, with both coal eyes visible.
  eye(ctx, gaze?.yaw ? -2 : -3.5, -88, gaze?.yaw ? 2.6 : 2.9, { bean: true, look, open, wide: startled });
  eye(ctx, 8.5, -88.5, 2.9, { bean: true, look, open, wide: startled });
  oval(ctx, -10, -81.5, 3.1, 1.7, '#e7b4a1', false);
  oval(ctx, 14, -81.5, 2.6, 1.6, '#e7b4a1', false);
  if (startled) mouth(ctx, 4, -77.5, 6, 'gasp');
  else for (const [x, y] of [[-3, -78.4], [1, -77], [5, -76.8], [9, -78.1]]) oval(ctx, x, y, 1.15, 1.15, INK, false);
  // The carrot twitches when he sniffs the air.
  const sniff = !moving && !startled ? Math.max(0, Math.sin(t * 9)) * (t % 6 > 5.2 ? 1.2 : 0) : 0;
  shape(ctx, () => {
    ctx.moveTo(3.5, -85.5); ctx.quadraticCurveTo(12, -87 - sniff, 25, -82 - sniff * 1.5);
    ctx.quadraticCurveTo(11, -80, 3.5, -81);
  }, '#ed914b');
  line(ctx, () => { ctx.moveTo(10, -84); ctx.lineTo(9, -81.5); }, '#bf653a', 1);
  knittedCap(ctx, 0, -102, moving ? air * 3 : Math.sin(t * 1.5) * .6);
  ctx.restore();

  if (juggling) {
    for(const side of [-1,1])twigArm(ctx,side,at(side*17,-60),at(side*31,-69-Math.sin(t*4+side)*4));
    const lift=clamp(t/.8)*clamp((9-t)/1.2);
    for(let i=0;i<3;i++){
      const phase=t*.55+i/3,u=phase%1;
      const x=(Math.floor(phase)%2?-1:1)*(-31+62*u);
      snowball(ctx,x,-73-4*u*(1-u)*62*lift,6,6);
    }
  } else if (aim) {
    for (const side of [-1, 1]) twigArm(ctx,side,at(side * 17,-60),grip(side));
    ctx.save(); ctx.translate(2,-88); ctx.rotate(tilt);
    viewingDevice(ctx,aim.yaw !== 0,false,6); ctx.restore();
  } else twigArm(ctx, 1, at(17, -60), raised ? at(34, -84 + (startled ? Math.sin(t * 20 + 1) * 3 : 0))
    : at(37, -52 + (moving ? Math.sin(TAU * p) * 3 : Math.sin(t * 1.4 + 1) * 1.2) - flap));
  if (startled) surprise(ctx, 22, -112 - pop, 12, t);
  ctx.restore();
}

// ── The newt ────────────────────────────────────────────────────────────────

const NEWT = '#df8550';
const NEWT_FAR = '#b86442';

/** A sprawling salamander leg: hip high on the flank, foot planted wide. */
function newtLeg(ctx: Ctx, root: Point, foot: Footfall, baseX: number, fore: boolean, far: boolean, lift: number) {
  const toe = at(root.x + baseX + foot.x, -1.5 + foot.y + lift);
  const knee = joint(root, toe, 10.5, 10.5, fore ? 1 : -1);
  const fill = far ? NEWT_FAR : fore ? '#e79255' : NEWT;
  limb(ctx, [root, knee, toe], [4.8, 3.9, 3.1], fill);
  const spread = foot.planted ? 1 : .7;
  for (const [dx, dy] of [[4.5, -.8], [5, 1.6], [1.4, 2.6]]) oval(ctx, toe.x + dx * spread, toe.y + dy, 2.3, 1.5, fill, true);
}

/** Venus's unmistakably fictional salamander; bounds at 80 px/m: -80..58, -66..3.
 * It scuttles on diagonal pairs of planted feet, swinging its tail. */
export function drawNewt(ctx: CanvasRenderingContext2D, cx: number, footY: number, s: number, char: GuestPose) {
  const t = char.business ? businessTime(char) : char.reducedMotion ? 0 : finite(char.stateTimer);
  const hat=char.business?.kind==='police-hat';
  const moving = isWalking(char);
  const startled = isStartled(char);
  const running = char.state === 'running_away' || char.state === 'running_to';
  const gaze=gazeAim(char), tilt = gaze?.yaw ? -gaze.elevation : 0;
  const direction = gaze ? gaze.yaw < 0 ? -1 : 1 : char.direction === -1 ? -1 : 1;
  ctx.save(); ctx.translate(cx, footY); ctx.scale(s / 80, s / 80);
  pen(ctx, 2);
  groundShadow(ctx, -4, 45, 3);
  ctx.scale(direction, 1);
  if (char.state === 'squashed') {
    oval(ctx, 0, -5, 43, 6, NEWT);
    oval(ctx, 28, -9, 8, 7, CREAM); oval(ctx, 42, -8, 7, 6, CREAM);
    oval(ctx, 29, -8, 2, 2, INK, false); oval(ctx, 43, -7, 2, 2, INK, false);
    line(ctx, () => { ctx.moveTo(27, -2); ctx.quadraticCurveTo(37, 2, 47, -2); });
    dizzy(ctx, 32, -22, 15, t);
    ctx.restore(); return;
  }

  const speed = Math.max(.2, finite(char.speed, 1.1)) * UNITS_PER_METRE * (running ? 3.5 : 1);
  const stride = running ? 30 : 20, duty = running ? .5 : .64, lift = running ? 6 : 4;
  const phase = moving ? gaitPhase(t, speed, stride, duty) : 0;
  const cycle = TAU * phase;
  const still = (x: number): Footfall => ({ x, y: 0, planted: true, swing: 0, stance: .5 });
  // Diagonal pairs move together: near fore with far hind, and so on.
  const gait = (offset: number, x: number) => moving ? footfall(phase + offset, stride, lift, duty) : still(x);
  const nearFore = gait(0, 2), farHind = gait(0, -2), nearHind = gait(.5, 1), farFore = gait(.5, -1);
  const jump = startled ? Math.sin(clamp(t / .6) * Math.PI) * 12 : 0;
  const splay = startled ? Math.sin(clamp(t / .6) * Math.PI) : 0;
  const bob = moving ? Math.cos(cycle * 2) * (running ? .8 : .5) : Math.sin(t * 1.7) * .4;
  const sway = moving ? Math.sin(cycle) * (running ? 7 : 4.5) : Math.sin(t * 1.3) * 2.5;
  const rock = moving ? Math.sin(cycle) * .025 : 0;
  const bodyY = -jump + bob;

  if (running) {
    for (const [foot, x] of [[nearFore, 20], [nearHind, -20]] as const) {
      if (foot.planted) dust(ctx, x + foot.x, 0, foot.stance * .9, 6);
    }
  }
  const legRoot = (x: number, y: number) => at(x, y + bodyY);
  const legLift = -jump * .75 - splay * 3;
  newtLeg(ctx, legRoot(-27, -17), farHind, -4 - splay * 8, false, true, legLift);
  newtLeg(ctx, legRoot(13, -19), farFore, 5 + splay * 8, true, true, legLift);

  ctx.save();
  ctx.translate(0, bodyY);
  ctx.rotate(rock);
  // The tapering, upward-curled tail is part of the silhouette at every scale.
  const tail = sway;
  shape(ctx, () => {
    ctx.moveTo(-23, -38); ctx.bezierCurveTo(-45, -38, -61, -35 + tail * .3, -66, -50 + tail);
    ctx.bezierCurveTo(-71, -63 + tail, -63, -67 + tail, -64, -65 + tail);
    ctx.bezierCurveTo(-85, -61 + tail, -83, -41 + tail * .5, -69, -31 + tail * .3);
    ctx.bezierCurveTo(-57, -22, -44, -21, -25, -18);
  }, '#c56b43');
  line(ctx, () => { ctx.moveTo(-64, -58 + tail); ctx.bezierCurveTo(-76, -46 + tail * .5, -55, -30, -33, -29); }, '#eda35a', 3.5);

  // A long shoulder-to-hip curve separates the salamander from a generic blob.
  shape(ctx, () => {
    ctx.moveTo(-38, -23); ctx.bezierCurveTo(-39, -44, -13, -50, 10, -44);
    ctx.bezierCurveTo(27, -40, 33, -29, 27, -16);
    ctx.bezierCurveTo(21, -6, -6, -10, -20, -10); ctx.bezierCurveTo(-33, -10, -38, -16, -38, -23);
  }, NEWT);
  shape(ctx, () => {
    ctx.moveTo(-31, -19); ctx.bezierCurveTo(-11, -9, 11, -17, 27, -26);
    ctx.bezierCurveTo(32, -13, 10, -9, -16, -11); ctx.quadraticCurveTo(-26, -11, -31, -19);
  }, '#f0c88c', false);
  line(ctx, () => { ctx.moveTo(-29, -33); ctx.bezierCurveTo(-20, -40, -5, -42, 7, -39); }, '#f3ad6a', 3.5);
  for (const [x, y, rx, ry] of [[-24, -32, 4, 3], [-12, -38, 3.6, 2.6], [-5, -27, 4.5, 3], [8, -34, 3, 2.3], [-29, -23, 2, 1.8]]) {
    oval(ctx, x, y, rx, ry, '#9e583c', false);
  }
  ctx.restore();

  newtLeg(ctx, legRoot(-21, -15), nearHind, -3 - splay * 9, false, false, legLift);
  newtLeg(ctx, legRoot(18, -17), nearFore, 6 + splay * 9, true, false, legLift);

  // Head: a broad face, frog-like raised eyes and a blunt snout.
  ctx.save();
  const nod = moving ? Math.sin(cycle * 2 + .8) * .9 : 0;
  const lookUp = char.reaction === 'apex' || char.reaction === 'escape';
  ctx.translate(0, bodyY + nod);
  if (gaze) { ctx.translate(30,-48); ctx.rotate(tilt); ctx.translate(-30,48); }
  else if (lookUp && !moving) { ctx.translate(12, -30); ctx.rotate(-.1); ctx.translate(-12, 30); }
  if (char.state === 'inspecting') { ctx.translate(12, -30); ctx.rotate(.18); ctx.translate(-12, 30); }
  shape(ctx, () => {
    ctx.moveTo(7, -39); ctx.bezierCurveTo(5, -54, 17, -59, 30, -55);
    ctx.bezierCurveTo(42, -54, 54, -45, 55, -34); ctx.bezierCurveTo(58, -19, 43, -13, 28, -16);
    ctx.bezierCurveTo(11, -17, 6, -25, 7, -39);
  }, '#e98b50');
  shape(ctx, () => {
    ctx.moveTo(12, -28); ctx.bezierCurveTo(22, -23, 45, -25, 54, -33);
    ctx.bezierCurveTo(59, -20, 43, -14, 28, -17); ctx.bezierCurveTo(18, -18, 13, -21, 12, -28);
  }, '#f5d3a0', false);
  if (gaze?.yaw) oval(ctx,30,-48,11.5,13,'#ee9a58');
  else {
    oval(ctx, 19, -49, 11, 13, '#ed9858');
    oval(ctx, 40, -45.5, 11.5, 13, '#ee9a58');
  }
  const open = startled ? 1 : blink(t, 3.4, .9);
  const look = char.state === 'inspecting' ? at(.7, .65) : lookUp ? at(.3, -.8) : moving ? at(.6, .1) : gaze?.yaw===0 ? at(0,0) : at(Math.sin(t * .5) > .75 ? -.4 : .3, .1);
  if (gaze?.yaw) eye(ctx,30,-48,9,{look,open,lid:'#ee9a58'});
  else {
    eye(ctx, 20, -49, 8.8, { look, open, wide: startled, lid: '#ed9858' });
    eye(ctx, 41, -45.5, 9, { look, open, wide: startled, lid: '#ee9a58' });
  }
  if (!startled) line(ctx, () => { ctx.moveTo(11, -61); ctx.quadraticCurveTo(18, -65, 24, -61); });
  for (const [x, y] of [[12, -34], [17, -31], [21, -34]]) oval(ctx, x, y, 1.1, 1, '#a8593d', false);
  oval(ctx, 50, -33.5, 1.3, 1, '#9e583c', false);
  if (startled) {
    mouth(ctx, 37, -28, 10, 'gasp', '#e09a7c');
  } else {
    const grin = char.reaction === 'impact';
    line(ctx, () => { ctx.moveTo(23, -27.5); ctx.bezierCurveTo(30, grin ? -18 : -21, 45, grin ? -19 : -22, 50, -28); }, INK, 1.8);
    line(ctx, () => { ctx.moveTo(22, -29); ctx.lineTo(22.5, -26.5); }, INK, 1.6);
    // Now and then a quick tongue flick tastes the Venusian air.
    const flick = !hat && !moving && char.state!=='watching' && t > 0 ? (t % 6.5) - 5.6 : -1;
    if (flick > 0 && flick < .32) {
      const out = Math.sin(Math.PI * flick / .32) * 13;
      line(ctx, () => { ctx.moveTo(50, -27); ctx.quadraticCurveTo(54 + out * .5, -26, 51 + out, -24); }, '#d96a73', 2.6);
      oval(ctx, 51 + out, -24, 2, 1.6, '#d96a73', false);
    }
  }
  if(hat)drawPoliceHat(ctx,28,-68,t);
  ctx.restore();
  if (startled) surprise(ctx, 36, -66 - jump, 13, t);
  ctx.restore();
}
