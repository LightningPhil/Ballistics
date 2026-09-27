import { viewingDevice, type CrewPose } from './crew.ts';
import { gazeAim, observationAim, type WatchAim } from './crew-watch.ts';
import { businessTime } from './character-business.ts';
import { drawIceCream } from './silly-props.ts';
import {
  INK, TAU, add, at, blink, clamp, dizzy, eye, finite, footfall, gaitPhase, groundShadow, joint, lerp, limb, line,
  mouth, oval, pen, shape, smooth, sparkle, surprise, within, type Ctx, type Footfall, type Point,
} from './toon.ts';

/** Pluto's ice bear: a big, gentle polar bear with a frost-dusted coat. Artwork uses
 * an 80 px/m foot anchor, facing right before mirroring. */
interface IceBearPose extends CrewPose {
  portrait?: boolean;
  speed?: number;
}

const HI = '#fbfeff';
const ICE = '#edf7fa';
const MID = '#c9e4ed';
const DEEP = '#a5cfdf';
const FAR = '#c1dce6';
const FAR_DEEP = '#a1c3d2';
const CREASE = '#96bdcc';
const CLAW = '#59717e';
const NOSE = '#223a4b';
const UNITS_PER_METRE = 80;

type Mood = { startled: boolean; sleepy: boolean; lookUp: boolean; open: number; sneeze?: number; look?:Point };

// ── Icy details ─────────────────────────────────────────────────────────────

function cubic(a: Point, b: Point, c: Point, d: Point, u: number): Point {
  const v = 1 - u;
  return at(v * v * v * a.x + 3 * v * v * u * b.x + 3 * v * u * u * c.x + u * u * u * d.x,
    v * v * v * a.y + 3 * v * v * u * b.y + 3 * v * u * u * c.y + u * u * u * d.y);
}

/** A few soft clumps of fur, rather than a saw-toothed crystal silhouette. */
function fringe(ctx: Ctx, a: Point, b: Point, c: Point, d: Point, points: number, depth: number) {
  points = Math.min(points, 3);
  for (let i = 1; i <= points * 2; i++) {
    const u = i / (points * 2);
    const p = cubic(a, b, c, d, u);
    if (i % 2 === 0) { ctx.lineTo(p.x, p.y); continue; }
    const q = cubic(a, b, c, d, Math.min(1, u + .01)), r = cubic(a, b, c, d, Math.max(0, u - .01));
    const length = Math.hypot(q.x - r.x, q.y - r.y) || 1;
    const tx = (q.x - r.x) / length, ty = (q.y - r.y) / length;
    const k = depth * .35;
    const end = cubic(a, b, c, d, Math.min(1, u + 1 / (points * 2)));
    ctx.quadraticCurveTo(p.x + ty * k, p.y - tx * k, end.x, end.y);
  }
}

/** One frozen tuft: a sharp, outlined shard pointing along `angle`. */
function shard(ctx: Ctx, x: number, y: number, angle: number, length: number, width: number, fill: string) {
  const c = Math.cos(angle), s = Math.sin(angle);
  shape(ctx, () => {
    ctx.moveTo(x - s * width, y + c * width);
    ctx.lineTo(x + c * length, y + s * length);
    ctx.lineTo(x + s * width, y - c * width);
  }, fill);
}

/** Light catching in the ice. Static when time is frozen. */
function twinkle(ctx: Ctx, x: number, y: number, size: number, t: number, offset: number) {
  sparkle(ctx, x, y, size * (.55 + .45 * Math.sin(t * 2.3 + offset)), '#ffffff');
}

/** Frosty breath drifting from the nose in Pluto's cold. */
function breath(ctx: Ctx, nose: Point, t: number) {
  const cycle = t % 3.4;
  if (!(t > 0) || cycle > 1.5) return;
  for (let i = 0; i < 3; i++) {
    const k = clamp(cycle / 1.5 * 1.3 - i * .15);
    if (k <= 0 || k >= 1) continue;
    const r = 2 + k * 5 + i;
    oval(ctx, nose.x + 3 + k * 13 + i * 3, nose.y + 1 - k * 7 - i * 2, r, r * .8, `rgba(255,255,255,${(.55 * (1 - k)).toFixed(3)})`, false);
  }
}

// ── Parts ───────────────────────────────────────────────────────────────────

/** Paws are drawn from the wrist or ankle; the sole sits 8 units below it. A
 * positive tilt folds the toes down and back, as a lifting paw does. */
function paw(ctx: Ctx, wrist: Point, tilt: number, far: boolean, hind: boolean) {
  const reach = hind ? 15 : 17;
  ctx.save(); ctx.translate(wrist.x, wrist.y); ctx.rotate(tilt);
  shape(ctx, () => {
    ctx.moveTo(-9, 0);
    ctx.bezierCurveTo(-10, -6, 2, -7, reach - 5, -3);
    ctx.bezierCurveTo(reach + 4, -1, reach + 4, 7, reach - 2, 8);
    ctx.lineTo(-6, 8);
    ctx.quadraticCurveTo(-12, 7, -9, 0);
  }, far ? FAR : ICE);
  for (const x of [reach - 8, reach - 3]) line(ctx, () => { ctx.moveTo(x, 2); ctx.quadraticCurveTo(x + 2, 4, x + 1, 6.5); }, far ? FAR_DEEP : CREASE, 1.1);
  for (const x of [reach - 6, reach - 1, reach + 3]) {
    line(ctx, () => { ctx.moveTo(x, 6); ctx.lineTo(x + 1, 7.4); }, CLAW, 1.3);
  }
  ctx.restore();
}

/** Weight-bearing forelegs and rounded haunches flow into broad, soft paws. */
function leg(ctx: Ctx, top: Point, ankle: Point, front: boolean, far: boolean, tilt: number) {
  const knee = joint(top, ankle, front ? 21 : 24, front ? 25 : 23, front ? 1 : -1);
  const fill = far ? FAR : ICE, shade = far ? FAR_DEEP : DEEP;
  const dx = ankle.x - knee.x, dy = ankle.y - knee.y;
  limb(ctx, [top, knee, ankle], front ? [13, 10, 8.5] : [16, 11, 8.5], fill);
  paw(ctx, ankle, tilt, far, !front);
  line(ctx, () => {
    ctx.moveTo(knee.x - 5, knee.y + 2);
    ctx.quadraticCurveTo(knee.x - 4 + dx * .4, knee.y + dy * .4, ankle.x - 4, ankle.y - 1);
  }, shade, 2);
  if (!far) {
    line(ctx, () => {
      ctx.moveTo(knee.x + 4, knee.y + 2);
      ctx.lineTo(knee.x + 4 + dx * .45, knee.y + 2 + dy * .45);
    }, 'rgba(255,255,255,.85)', 1.3);
  }
  return knee;
}

/** A soft polar-bear face, with a broad muzzle and small round ears. */
function head(ctx: Ctx, x: number, y: number, tilt: number, mood: Mood, scale = 1, front = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(scale, scale);
  const sleepy = mood.sleepy || (mood.sneeze || 0) > .15;
  if (front) {
    // A brief frontal glance; ears sit on either side of the skull.
    for (const ex of [-17, 18]) {
      oval(ctx, ex, -18, 7, 7.5, ICE);
      oval(ctx, ex, -18, 3.8, 4.3, MID, false);
    }
    oval(ctx, 0, 0, 26, 24, iceGradient(ctx, -24, 25));
    oval(ctx, -13, 7, 9, 10, HI, false);
    oval(ctx, 14, 7, 9, 10, HI, false);
    for (const ex of [-10, 11]) {
      eye(ctx, ex, -3, 3.6, { bean: true, look: at(.1, 0), wide: mood.startled, open: mood.open });
      line(ctx, () => { ctx.moveTo(ex - 4, mood.startled ? -12 : -10); ctx.quadraticCurveTo(ex, mood.startled ? -15 : -12, ex + 4, -10); }, CREASE, 1.5);
    }
    oval(ctx, 1, 10, 13, 10, '#ffffff', false);
    oval(ctx, 1, 5.5, 7, 4.6, NOSE);
    oval(ctx, -1, 3.8, 2.2, 1, '#7896a3', false);
    if (mood.startled) mouth(ctx, 1, 16, 7, 'gasp');
    else line(ctx, () => {
      ctx.moveTo(1, 10); ctx.lineTo(1, 13);
      ctx.moveTo(-7, 13); ctx.quadraticCurveTo(-2, 19, 1, 13); ctx.quadraticCurveTo(5, 19, 10, 12);
    }, INK, 1.5);
    // Just a little trapped ice on one cheek, rather than cracks across the face.
    line(ctx, () => { ctx.moveTo(-21, 2); ctx.lineTo(-18, 6); ctx.lineTo(-20, 10); }, '#b7dce8', 1.2);
    sparkle(ctx, -18, 3, 1.8, '#ffffff');
    ctx.restore(); return;
  }
  oval(ctx, 7, -18, 5.5, 6, FAR);
  const skull = () => {
    ctx.moveTo(-18, 9);
    ctx.bezierCurveTo(-24, -3, -17, -20, -3, -21);
    ctx.bezierCurveTo(9, -22, 16, -15, 18, -8);
    ctx.bezierCurveTo(23, -6, 30, -6, 32, -1);
    ctx.bezierCurveTo(35, 7, 28, 12, 17, 13);
    ctx.bezierCurveTo(9, 18, -9, 21, -18, 9);
  };
  shape(ctx, skull, iceGradient(ctx, -22, 20));
  within(ctx, skull, () => {
    oval(ctx, -6, -12, 19, 12, 'rgba(255,255,255,.65)', false);
    oval(ctx, 4, 19, 25, 8, 'rgba(165,207,223,.25)', false);
    oval(ctx, 20, 6, 15, 9, '#ffffff', false);
    oval(ctx, 1, 8, 9, 7, 'rgba(255,255,255,.65)', false);
  });
  oval(ctx, -10, -17, 7, 7.7, ICE);
  oval(ctx, -9.5, -17, 3.7, 4.3, MID, false);
  oval(ctx, 29, -.5, 6, 4.2, NOSE);
  oval(ctx, 27.5, -2, 2, .8, '#7896a3', false);
  if (mood.startled || (mood.sneeze || 0) > .15) mouth(ctx, 23, 11, 7.5, 'gasp', '#dcaba4');
  else line(ctx, () => {
    ctx.moveTo(29, 4); ctx.quadraticCurveTo(28, 11, 20, 10);
    ctx.quadraticCurveTo(15, 10, 13, 7);
  }, INK, 1.6);
  eye(ctx, 9, -6, 3.6, { bean: true, look: mood.look || at(.4, mood.lookUp ? -.7 : .1), wide: mood.startled, open: sleepy ? .1 : mood.open });
  line(ctx, () => {
    ctx.moveTo(4.5, mood.startled ? -16 : -13);
    ctx.quadraticCurveTo(8, mood.startled ? -20 : -16, 13, mood.startled ? -16 : -13.5);
  }, CREASE, 1.5);
  line(ctx, () => { ctx.moveTo(-15, 5); ctx.quadraticCurveTo(-10, 9, -8, 6); }, '#c6e1ea', 1.2);
  ctx.restore();
}

/** Where the tip of the nose is, for the breath. */
function noseTip(x: number, y: number, tilt: number, scale: number) {
  return at(x + Math.cos(tilt) * 33 * scale, y + Math.sin(tilt) * 33 * scale);
}

// ── On all fours ────────────────────────────────────────────────────────────

interface Leg { top: Point; ankle: Point; front: boolean; far: boolean; tilt: number }
interface Frame { hip: Point; shoulder: Point; neck: Point; headTilt: number; legs: Leg[]; tail: number; shake: number }
interface Idle { sniff: number; lookUp: number; shake: number }

/** A brisk lateral-sequence walk or a flexing gallop, feet planted on the ice. */
function quadrupedFrame(t: number, moving: boolean, running: boolean, speed: number, idle: Idle): Frame {
  const v = Math.max(.05, speed) * UNITS_PER_METRE * (running ? 3.5 : 1);
  const duty = running ? .32 : .66;
  const stride = running ? clamp(v * duty * .55, 36, 52) : clamp(v * duty * .8, 24, 46);
  const phase = moving ? gaitPhase(t, v, stride, duty) : 0;
  const cycle = TAU * phase;
  const lift = running ? 17 : 8;
  const offsets = running
    ? { nearHind: 0, farHind: .08, nearFore: .58, farFore: .48 }
    : { nearHind: 0, farHind: .5, nearFore: .25, farFore: .75 };
  let hipDx = 0, hipDy = 0, shoulderDx = 0, shoulderDy = 0;
  if (moving && running) {
    // The spine gathers and stretches; the body stays low and level.
    const flex = Math.sin(cycle + .4);
    hipDx = -flex * 4; shoulderDx = flex * 4;
    hipDy = 4 - Math.max(0, Math.sin(cycle - .3)) * 2.5 - flex;
    shoulderDy = 4 - Math.max(0, Math.sin(cycle + 2.6)) * 2.5 + flex;
  } else if (moving) {
    hipDy = -Math.cos(TAU * (phase * 2 + .1)) * .6;
    shoulderDy = -Math.cos(TAU * (phase * 2 + .35)) * .7;
    hipDx = Math.sin(cycle) * .8; shoulderDx = Math.sin(cycle + 1.6) * .8;
  } else {
    const breathe = Math.sin(t * 1.5) * .6;
    hipDy = -breathe * .4; shoulderDy = -breathe - idle.sniff * 3;
    hipDx = idle.shake * 1.6; shoulderDx = idle.shake * 2.4;
  }
  const hip = at(-34 + hipDx, -48 + hipDy), shoulder = at(24 + shoulderDx, -51 + shoulderDy);
  const still: Footfall = { x: 0, y: 0, planted: true, swing: 0, stance: 0 };
  const legs = ([
    ['farHind', false, true, -27], ['farFore', true, true, 31],
    ['nearHind', false, false, -32], ['nearFore', true, false, 26],
  ] as const).map(([key, front, far, restX]) => {
    const step = moving ? footfall(phase + offsets[key], stride, lift * (front ? 1 : .85), duty) : still;
    const top = front ? add(shoulder, far ? 4 : 0, far ? -1 : 0) : add(hip, far ? 4 : 0, far ? -1 : 0);
    const ankle = at(restX + step.x, -8 + step.y - (far ? 1.5 : 0));
    // Toes stay down as the heel peels away, then fold back through the swing.
    const peel = step.planted ? smooth((step.stance - .8) / .2) * (front ? .3 : .45) : 0;
    const tilt = step.planted ? peel : Math.sin(Math.PI * step.swing) * (front ? .95 : .65) + (1 - step.swing) ** 2 * (front ? .3 : .45);
    return { top, ankle, front, far, tilt };
  });
  const nod = moving ? Math.sin(cycle * 2 + 1.1) * (running ? 1.2 : 1.5) : 0;
  let neck: Point, headTilt: number;
  if (moving && running) {
    neck = add(shoulder, 28, -5 + nod); headTilt = .1;
  } else if (moving) {
    // Polar bears walk with the head carried low, swinging a little.
    neck = add(shoulder, 25, -10 + nod); headTilt = .04 + Math.sin(cycle * 2) * .025;
  } else {
    neck = add(shoulder, lerp(lerp(24, 21, idle.lookUp), 30, idle.sniff), lerp(lerp(-14, -21, idle.lookUp), 13, idle.sniff));
    headTilt = lerp(lerp(-.04, -.32, idle.lookUp), .55, idle.sniff) + idle.shake * .1;
  }
  const tail = moving ? Math.sin(cycle * 2) * .25 : Math.sin(t * 2.1) * .12 + idle.shake * .4;
  return { hip, shoulder, neck, headTilt, legs, tail, shake: idle.shake };
}

/** Rounded rump, heavy shoulders, a deep belly and the polar bear's long neck. */
function bodyOutline(ctx: Ctx, H: Point, S: Point, N: Point) {
  ctx.moveTo(H.x - 23, H.y - 12);
  ctx.bezierCurveTo(H.x - 22, H.y - 33, H.x - 1, H.y - 39, H.x + 19, H.y - 33);
  ctx.bezierCurveTo(H.x + 33, H.y - 29, S.x - 25, S.y - 31, S.x - 12, S.y - 35);
  ctx.bezierCurveTo(S.x + 5, S.y - 38, S.x + 17, S.y - 29, S.x + 21, S.y - 23);
  ctx.bezierCurveTo(S.x + 28, S.y - 17, N.x - 9, N.y - 15, N.x + 4, N.y - 11);
  ctx.lineTo(N.x + 7, N.y + 10);
  ctx.bezierCurveTo(N.x - 2, N.y + 23, S.x + 23, S.y + 9, S.x + 13, S.y + 19);
  ctx.bezierCurveTo(S.x - 7, S.y + 29, H.x + 28, H.y + 28, H.x + 9, H.y + 21);
  ctx.bezierCurveTo(H.x - 12, H.y + 21, H.x - 29, H.y + 7, H.x - 23, H.y - 12);
}

/** Soft blue shade under the white coat, with sparse frost catching the light. */
function bodyFacets(ctx: Ctx, H: Point, S: Point, N: Point, t: number) {
  oval(ctx, H.x + 19, H.y - 26, 44, 14, 'rgba(255,255,255,.55)', false);
  oval(ctx, S.x + 1, S.y - 24, 24, 16, 'rgba(255,255,255,.45)', false);
  shape(ctx, () => {
    ctx.moveTo(H.x - 30, H.y + 8);
    ctx.bezierCurveTo(H.x + 8, H.y + 27, S.x + 2, S.y + 22, N.x, N.y + 10);
    ctx.lineTo(N.x + 5, 0); ctx.lineTo(H.x - 30, 0);
  }, 'rgba(165,207,223,.23)', false);
  // Small clusters suggest frost on fur without splitting the bear into panels.
  for (const [x, y] of [[H.x - 9, H.y - 20], [H.x + 17, H.y - 28], [S.x - 5, S.y - 29]]) {
    line(ctx, () => { ctx.moveTo(x - 3, y + 2); ctx.quadraticCurveTo(x, y + 5, x + 3, y + 1); }, '#d3e9f1', 1.1);
    oval(ctx, x + 2, y - 3, 1, 1.3, '#ffffff', false);
  }
  twinkle(ctx, H.x + 20, H.y - 28, 2.4, t, 0);
  twinkle(ctx, S.x - 5, S.y - 29, 1.9, t, 2.1);
}

function iceGradient(ctx: Ctx, top: number, bottom: number) {
  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, HI);
  gradient.addColorStop(.5, ICE);
  gradient.addColorStop(1, MID);
  return gradient;
}

function quadruped(ctx: Ctx, f: Frame, mood: Mood, t: number, front=false) {
  const { hip: H, shoulder: S, neck: N } = f;
  // The deep belly overlaps the leg roots, keeping the weight in the body.
  for (const l of f.legs.filter(l => l.far)) leg(ctx, l.top, l.ankle, l.front, true, l.tilt);
  const nearHind = f.legs.find(l => !l.far && !l.front)!, nearFore = f.legs.find(l => !l.far && l.front)!;
  const hindKnee = leg(ctx, nearHind.top, nearHind.ankle, false, false, nearHind.tilt);
  const foreElbow = leg(ctx, nearFore.top, nearFore.ankle, true, false, nearFore.tilt);
  ctx.save(); ctx.translate(H.x - 23, H.y - 10); ctx.rotate(f.tail);
  oval(ctx, -3, 0, 7, 6, ICE);
  oval(ctx, -5, -2, 3, 2, HI, false);
  ctx.restore();
  const body = () => bodyOutline(ctx, H, S, N);
  shape(ctx, body, iceGradient(ctx, S.y - 30, H.y + 18));
  within(ctx, body, () => bodyFacets(ctx, H, S, N, t));
  shape(ctx, body, 'rgba(0,0,0,0)');
  // Haunch and shoulder contours follow the near legs as they swing.
  const haunch = clamp((hindKnee.x - H.x) / 30, -1, 1) * 5;
  const shoulderSwing = clamp((foreElbow.x - S.x) / 24, -1, 1) * 4;
  line(ctx, () => {
    ctx.moveTo(H.x - 12, H.y - 16);
    ctx.bezierCurveTo(H.x + 6 + haunch, H.y - 18, H.x + 14 + haunch, H.y - 2, H.x + 9 + haunch, H.y + 12);
  }, CREASE, 1.8);
  line(ctx, () => {
    ctx.moveTo(S.x + 6, S.y - 22);
    ctx.bezierCurveTo(S.x - 8 + shoulderSwing, S.y - 16, S.x - 10 + shoulderSwing, S.y + 2, S.x - 6 + shoulderSwing, S.y + 16);
  }, CREASE, 1.8);
  const hx = N.x + 4, hy = N.y - 2;
  head(ctx, hx, hy, f.headTilt + (mood.sneeze || 0) * .16, mood, 1.2,front);
  const nose = noseTip(hx, hy, f.headTilt, 1.2);
  breath(ctx, nose, t);
  if (mood.sneeze) {
    // One tiny involuntary sneeze after sniffing the snow.
    for (let i = 0; i < 4; i++) {
      const drift = mood.sneeze * (8 + i * 3);
      oval(ctx, nose.x + 4 + drift, nose.y - i * 3, 2 + mood.sneeze * 3, 2,
        `rgba(255,255,255,${(.5 * mood.sneeze).toFixed(3)})`, false);
    }
  }
  if (f.shake !== 0) {
    // Frost flicked off the coat by a good shake.
    for (let i = 0; i < 4; i++) sparkle(ctx, H.x + i * 18 - 6 + f.shake * 8, H.y - 34 - (i % 2) * 7 - Math.abs(f.shake) * 6, 2.2, '#ffffff');
  }
}

// ── Standing up ─────────────────────────────────────────────────────────────

/** A fright: the bear rears up on its hind legs, paws up. It only ever walks on all fours. */
function rearUp(ctx: Ctx, t: number, mood: Mood) {
  const hop = Math.sin(clamp(t / .7) * Math.PI) * 6;
  const H = at(0, -54 - hop);
  groundShadow(ctx, 2, 30);
  for (const far of [true, false]) {
    leg(ctx, add(H, far ? -12 : 12, 0), at(far ? -17 : 16, -8 - (far ? 1.5 : 0) - hop * .6), false, far, 0);
  }
  const shoulderNear = add(H, 19, -48), shoulderFar = add(H, -19, -48);
  const flail = Math.sin(t * 15) * 2;
  const handNear = add(H, 35, -71 + flail), handFar = add(H, -34, -73 - flail);
  const arm = (shoulder: Point, hand: Point, far: boolean) => {
    const elbow = joint(shoulder, hand, 20, 22, far ? -1 : 1);
    limb(ctx, [shoulder, elbow, hand], [10, 8, 7], far ? FAR : ICE);
    oval(ctx, hand.x, hand.y - 2, 9, 10, far ? FAR : ICE);
    oval(ctx, hand.x, hand.y, 4.4, 4, '#8eafbf', false);
    for (const dx of [-4.5, 0, 4.5]) oval(ctx, hand.x + dx, hand.y - 6.5, 1.8, 2, '#8eafbf', false);
    for (const dx of [-3.5, 0, 3.5]) {
      shape(ctx, () => {
        const x = hand.x + dx, y = hand.y - 11;
        ctx.moveTo(x - 1, y); ctx.lineTo(x, y - 2); ctx.lineTo(x + 1, y);
      }, CLAW, false);
    }
  };
  const torso = () => {
    ctx.moveTo(H.x - 23, H.y + 8);
    ctx.bezierCurveTo(H.x - 37, H.y - 9, H.x - 29, H.y - 49, H.x - 16, H.y - 57);
    ctx.bezierCurveTo(H.x - 5, H.y - 65, H.x + 13, H.y - 63, H.x + 23, H.y - 50);
    ctx.bezierCurveTo(H.x + 34, H.y - 30, H.x + 38, H.y - 3, H.x + 25, H.y + 10);
    ctx.bezierCurveTo(H.x + 15, H.y + 20, H.x - 12, H.y + 21, H.x - 23, H.y + 8);
  };
  shape(ctx, torso, iceGradient(ctx, H.y - 66, H.y + 12));
  within(ctx, torso, () => {
    oval(ctx, 2, H.y - 18, 24, 33, 'rgba(255,255,255,.7)', false);
    oval(ctx, 2, H.y + 13, 30, 9, 'rgba(165,207,223,.2)', false);
    twinkle(ctx, H.x - 12, H.y - 40, 2.6, t, .5);
    twinkle(ctx, H.x + 10, H.y - 12, 1.8, t, 3);
  });
  shape(ctx, torso, 'rgba(0,0,0,0)');
  arm(shoulderFar, handFar, true);
  arm(shoulderNear, handNear, false);
  head(ctx, H.x + 2, H.y - 69, -.08, mood, 1.15, true);
  surprise(ctx, H.x + 46, H.y - 98, 9, t);
}

// ── Flattened, and the close-up ─────────────────────────────────────────────

function squashed(ctx: Ctx, t: number) {
  groundShadow(ctx, 0, 64);
  for (const x of [-54, -30, 24, 48]) oval(ctx, x, -3, 10, 3.6, x < 0 ? FAR : ICE);
  const rug = () => {
    ctx.moveTo(-60, -3);
    ctx.bezierCurveTo(-60, -12, -34, -15, -6, -14);
    ctx.bezierCurveTo(22, -14, 50, -12, 54, -3);
    fringe(ctx, at(54, -3), at(30, 2), at(-30, 2), at(-60, -3), 8, 3);
  };
  shape(ctx, rug, iceGradient(ctx, -14, 2));
  within(ctx, rug, () => {
    line(ctx, () => { ctx.moveTo(-40, -12); ctx.lineTo(-20, -4); ctx.lineTo(8, -13); ctx.lineTo(30, -3); }, '#ffffff', 1.3);
  });
  shape(ctx, rug, 'rgba(0,0,0,0)');
  for (const [x, a] of [[-68, 3.6], [64, -.4], [-8, 1.2]] as const) shard(ctx, x, -2, a, 5, 2, MID);
  ctx.save(); ctx.translate(50, -9); ctx.scale(1.05, .5);
  head(ctx, 0, 0, 0, { startled: false, sleepy: true, lookUp: false, open: 1 });
  ctx.restore();
  dizzy(ctx, 58, -24, 13, t);
}

/** Settle on the haunches so both forepaws can hold a pair of field glasses. */
function observingBear(ctx: Ctx, aim: WatchAim, mood: Mood) {
  const side = aim.yaw !== 0, tilt = side ? -aim.elevation : 0;
  groundShadow(ctx,-5,38);
  oval(ctx,-12,-31,29,30,iceGradient(ctx,-64,0));
  oval(ctx,-6,-54,24,33,iceGradient(ctx,-87,-21));
  oval(ctx,0,-78,15,18,ICE,false);
  paw(ctx,at(-22,-8),0,true,true);
  paw(ctx,at(13,-8),0,false,true);
  line(ctx,() => { ctx.moveTo(-23,-45); ctx.quadraticCurveTo(-35,-25,-24,-13); },CREASE,1.5);
  head(ctx,0,-94,tilt,{...mood,sneeze:0,sleepy:false},1.2,!side);
  const eyeX = side ? 10.8 : 1.2, eyeY = side ? -7.2 : -3.6;
  for (const sign of [-1,1]) {
    const gx = eyeX + (side ? sign < 0 ? 5 : 17 : sign * 13), gy = eyeY + 5;
    const hand = at(Math.cos(tilt)*gx-Math.sin(tilt)*gy,-94+Math.sin(tilt)*gx+Math.cos(tilt)*gy);
    const shoulder = at(sign < 0 ? -20 : 14,-64);
    const a=joint(shoulder,hand,25,25,1),b=joint(shoulder,hand,25,25,-1);
    const elbow=sign<0?(a.x<b.x?a:b):(a.x>b.x?a:b);
    limb(ctx,[shoulder,elbow,hand],[10,8,6],sign < 0 ? FAR : ICE);
    oval(ctx,hand.x,hand.y,7.5,6.5,ICE);
    for (const dx of [-3,1,5]) line(ctx,() => { ctx.moveTo(hand.x+dx,hand.y+3); ctx.lineTo(hand.x+dx,hand.y+5); },CLAW,1);
  }
  ctx.save(); ctx.translate(0,-94); ctx.rotate(tilt); ctx.translate(eyeX,eyeY);
  ctx.scale(1.2,1.2); viewingDevice(ctx,side,false,11); ctx.restore();
}

/** A supported elbow and a small lift towards the muzzle, never an IK flip. */
function eatingBear(ctx:Ctx,mood:Mood,t:number) {
  const lick=Math.max(0,Math.sin(t*2)),raise=10*smooth((t-2.7)/.6)+10*smooth((t-5.7)/.6);
  const shoulder=at(14,-64),elbow=at(26,-39-raise*.2),hand=at(35-lick,-52-raise-lick*2);
  groundShadow(ctx,-5,38);
  oval(ctx,-12,-31,29,30,iceGradient(ctx,-64,0));
  oval(ctx,-6,-54,24,33,iceGradient(ctx,-87,-21));
  oval(ctx,0,-78,15,18,ICE,false);
  paw(ctx,at(-22,-8),0,true,true);paw(ctx,at(13,-8),0,false,true);
  line(ctx,()=>{ctx.moveTo(-23,-45);ctx.quadraticCurveTo(-35,-25,-24,-13);},CREASE,1.5);
  // The spare paw rests on the knee. The head stays turned towards the cone.
  limb(ctx,[at(-20,-64),at(-24,-42),at(-15,-29)],[10,8,6],FAR);
  oval(ctx,-15,-29,8,6,FAR);
  head(ctx,0,-94,.035+lick*.02,{...mood,sneeze:0,sleepy:false,look:at(.65,.7)},1.2);
  limb(ctx,[shoulder,elbow,hand],[10,8,6],ICE);
  drawIceCream(ctx,at(hand.x,hand.y-2),t);
  oval(ctx,hand.x-2,hand.y+3,6,5,ICE);
  for(const dx of [-4,0,4])line(ctx,()=>{ctx.moveTo(hand.x+dx-2,hand.y+4);ctx.lineTo(hand.x+dx-2,hand.y+6);},CLAW,1);
  if(lick>.5)line(ctx,()=>{ctx.moveTo(27,-80);ctx.quadraticCurveTo(31,-78,33,-81);},'#e6adaf',3.2);
}

/**
 * Foot-anchored ice bear, facing right before mirroring.
 * On all fours: x about -70..100, y -100..4. Reared up: x -50..60, y -162..4.
 * The portrait camera follows the head around (0, -84), retaining its activity.
 */
export function drawIceBear(ctx: CanvasRenderingContext2D, cx: number, footY: number, s: number, char: IceBearPose) {
  const t = char.business ? businessTime(char) : char.reducedMotion ? 0 : finite(char.stateTimer);
  const state = char.state || 'idle';
  const moving = state === 'walking' || state === 'returning' || state === 'running_away' || state === 'running_to' || state === 'carrying';
  const startled = state === 'startled' || state === 'rocket_startled';
  const running = state === 'running_away' || state === 'running_to';
  const aim = observationAim(char);
  const gaze=aim||gazeAim(char);
  const speed = finite(char.speed, 1.05);
  const cycle = t % 7.8;
  const resting = !moving && !startled && state !== 'inspecting' && t > 0;
  const sneeze = resting && cycle > 3.7 && cycle < 4.25 ? Math.sin((cycle - 3.7) / .55 * Math.PI) : 0;
  const mood: Mood = {
    startled,
    sleepy: char.reaction === 'coast' && !startled && !moving,
    lookUp: char.reaction === 'apex' || char.reaction === 'escape',
    open: blink(t, 4.3, .7),
    sneeze,
  };

  ctx.save(); ctx.translate(cx, footY); ctx.scale(s / 80, s / 80);
  pen(ctx);
  ctx.scale(gaze ? gaze.yaw < 0 ? -1 : 1 : char.direction === -1 ? -1 : 1, 1);
  if (state === 'squashed') {
    if (char.portrait) ctx.translate(-45, -75);
    squashed(ctx, t); ctx.restore(); return;
  }
  if (startled) {
    if (char.portrait) ctx.translate(3, 39);
    rearUp(ctx, t, mood); ctx.restore(); return;
  }
  if (aim) {
    if (char.portrait) ctx.translate(0,10);
    observingBear(ctx,aim,mood); ctx.restore(); return;
  }
  if(char.business?.kind==='ice-cream'){
    if(char.portrait)ctx.translate(0,10);
    eatingBear(ctx,mood,t);ctx.restore();return;
  }

  // Idle bears raise their nose to the air, sniff the ice, and now and then
  // shake the frost from their coat.
  const idle: Idle = {
    sniff: state === 'inspecting' ? 1 : mood.sleepy ? .35 : resting ? smooth((cycle - 1.5) / .6) * (1 - smooth((cycle - 3) / .6)) : 0,
    lookUp: mood.lookUp ? 1 : resting ? smooth((cycle - .2) / .3) * (1 - smooth((cycle - 1) / .4)) * .6 : 0,
    shake: resting && !mood.sleepy && cycle > 5.5 && cycle < 6.3 ? Math.sin((cycle - 5.5) * 32) * Math.sin(Math.PI * (cycle - 5.5) / .8) : 0,
  };
  const frame = quadrupedFrame(t, moving, running, speed, idle);
  // Follow the same head and shoulders as the world rig, including its gait,
  // sniffing, sneezes and direction. Only the camera framing is different.
  if (char.portrait) ctx.translate(-frame.neck.x - 5, -82 - frame.neck.y);
  else groundShadow(ctx, 6, 66);
  quadruped(ctx, frame, mood, t,gaze?.yaw===0);
  ctx.restore();
}
