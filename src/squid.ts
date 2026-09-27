import type { CrewPose } from './crew.ts';
import {
  TAU, at, blink, clamp, dizzy, eye, finite, footfall, gaitPhase, groundShadow, lerp, line,
  mouth, oval, pen, shape, smooth, surprise, within, type Ctx, type Point,
} from './toon.ts';

interface GiantSquidPose extends CrewPose {
  portrait?: boolean;
  speed?: number;
  /** World metres from the squid to the centre of the hole it is using. */
  holeX?: number;
}

type Curve = readonly [Point, Point, Point, Point];
type RibbonPoint = { x: number; y: number; nx: number; ny: number; width: number };

/** Seconds for the squid to slip down, or climb out of, a hole in the ice. */
export const SQUID_DIVE_SECONDS = 1.4;
export const SQUID_EMERGE_SECONDS = 2.4;
export const SQUID_HOLE_RADIUS = .45;
/** Seconds for the ice to crack and give way, and to skin over and vanish again. */
export const HOLE_OPEN_SECONDS = 1.5;
export const HOLE_FREEZE_SECONDS = 5;

export type IceHolePhase = 'opening' | 'open' | 'freezing';
export interface IceHole { x?: number; phase?: IceHolePhase; timer?: number; seed?: number }

/** Three deliberate swings; the last impact punches through at 1.35 seconds. */
export function hammerStroke(t: number) {
  const phase = Math.min(HOLE_OPEN_SECONDS - .0001, Math.max(0, t)) % .5;
  const angle = phase < .18 ? lerp(1.6, .35, smooth(phase / .18))
    : phase < .35 ? lerp(.35, Math.PI, smooth((phase - .18) / .17))
    : phase < .41 ? Math.PI : lerp(Math.PI, 1.6, smooth((phase - .41) / .09));
  return { angle, impact: phase >= .35 && phase < .41 };
}

/** How far along a hole is: cracks spreading, open water, and a fresh ice skin. */
export function iceHoleLook(hole?: IceHole) {
  const timer = finite(hole?.timer);
  if (hole?.phase === 'opening') {
    const strikes = clamp((Math.floor((timer - .35 + .000001) / .5) + 1) / 3);
    return { crack: strikes, water: smooth((timer - 1.35) / .15), skin: 0, burst: clamp((timer - 1.35) / .15) };
  }
  if (hole?.phase === 'freezing') {
    const p = clamp(timer / HOLE_FREEZE_SECONDS);
    return { crack: 0, water: 1 - smooth(p / .6), skin: 1 - smooth((p - .6) / .4), burst: 0 };
  }
  return { crack: 0, water: 1, skin: 0, burst: 0 };
}

/** Repeatable scatter for a hole's cracks and slabs. */
function noise(seed: number, i: number) {
  const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

const BODY = '#e8854b';
const SHADE = '#c9663b';
const DEEP = '#a95234';
const LIGHT = '#f6aa70';
const BELLY = '#f8d4a2';
const SPOT = '#c65b33';
const SUCKER = '#fde8c6';
const ICE_RIM = '#e4f4f5';
const WATER = '#1f4b5f';
const UNITS_PER_METRE = 80;

/** Sample a limb's centreline so the skin and suckers share one curve. */
function ribbonPoints(curves: readonly Curve[], rootWidth: number, tipWidth: number): RibbonPoint[] {
  const points: RibbonPoint[] = [];
  for (let segment = 0; segment < curves.length; segment++) {
    const [a, b, c, d] = curves[segment];
    for (let step = segment === 0 ? 0 : 1; step <= 14; step++) {
      const t = step / 14, u = 1 - t;
      const x = u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x;
      const y = u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y;
      const dx = 3 * u * u * (b.x - a.x) + 6 * u * t * (c.x - b.x) + 3 * t * t * (d.x - c.x);
      const dy = 3 * u * u * (b.y - a.y) + 6 * u * t * (c.y - b.y) + 3 * t * t * (d.y - c.y);
      const length = Math.hypot(dx, dy) || 1;
      const fraction = (segment + t) / curves.length;
      points.push({ x, y, nx: -dy / length, ny: dx / length, width: tipWidth + (rootWidth - tipWidth) * Math.pow(1 - fraction, 1.2) });
    }
  }
  return points;
}

function edge(ctx: Ctx, points: readonly RibbonPoint[], side: number, reverse = false) {
  const ordered = reverse ? [...points].reverse() : points;
  for (const p of ordered) ctx.lineTo(p.x + p.nx * p.width * side, p.y + p.ny * p.width * side);
}

/** A tapering arm with a pale underside; near arms show a short row of suckers. */
function arm(ctx: Ctx, curves: readonly Curve[], rootWidth: number, far: boolean, underside: 1 | -1) {
  const points = ribbonPoints(curves, rootWidth, 1.2);
  const first = points[0], last = points[points.length - 1];
  const outline = () => {
    ctx.moveTo(first.x + first.nx * first.width, first.y + first.ny * first.width);
    edge(ctx, points, 1);
    ctx.arc(last.x, last.y, last.width, Math.atan2(last.ny, last.nx), Math.atan2(last.ny, last.nx) + Math.PI);
    edge(ctx, points, -1, true);
  };
  shape(ctx, outline, far ? DEEP : BODY);
  if (far) return;
  within(ctx, outline, () => {
    ctx.beginPath(); ctx.moveTo(first.x, first.y);
    edge(ctx, points, underside * .15); edge(ctx, points, underside * 1.4, true); ctx.closePath();
    ctx.fillStyle = BELLY; ctx.fill();
  });
  shape(ctx, outline, 'rgba(0,0,0,0)');
  for (const fraction of [.5, .64, .78]) {
    const p = points[Math.round((points.length - 1) * fraction)];
    const r = Math.min(1.6, p.width * .42);
    oval(ctx, p.x + p.nx * p.width * .5 * underside, p.y + p.ny * p.width * .5 * underside, r, r, SUCKER, false);
  }
}

/** Eight short walking arms fan out on the ice; the stepping ones lift and reach. */
function arms(ctx: Ctx, phase: number, moving: boolean, gather: number, flare: number, curl: number, stride: number, far: boolean) {
  const roots = [-14, -10, -5, -1.5, 1.5, 5, 10, 14];
  for (let i = 0; i < roots.length; i++) {
    const back = i % 2 === 1;
    if (back !== far) continue;
    const rx = roots[i], side = rx < 0 ? -1 : 1;
    const reach = (Math.abs(rx) * 1.6 + 12) * lerp(1, .3, gather);
    const step = moving ? footfall(phase + (i % 4 < 2 ? 0 : .5) + i * .07, stride, 7, .58)
      : { x: 0, y: 0, planted: true, swing: 0, stance: 0 };
    const root = at(rx * .9, -22);
    const knee = at(rx * 1.35 + side * 5 * (1 - gather), -7 - flare * 10);
    const tip = at(rx + side * reach + step.x, -2.5 + step.y - flare * 16);
    const wave = curl * (i % 3 - 1);
    arm(ctx, [
      [root, at(root.x + side * 1.5, root.y + 9), at(knee.x - side * 5, knee.y - 2), knee],
      [knee, at(knee.x + side * 6, knee.y + 5 + flare * 4), at(tip.x - side * 5, tip.y + 2.5), tip],
      [tip, at(tip.x + side * 4, tip.y - .5), at(tip.x + side * 6.5, tip.y - 2 - curl * .6), at(tip.x + side * (7 + wave * .5), tip.y - 4.5 - curl)],
    ], far ? 5.4 : 6.2, far, side < 0 ? -1 : 1);
  }
}

/** The two long feeding tentacles end in flattened, sucker-lined clubs. */
function tentacle(ctx: Ctx, root: Point, tip: Point, sag: number, far: boolean, clubTilt: number) {
  const side = tip.x < root.x ? -1 : 1;
  arm(ctx, [
    [root, at(root.x + side * 4, root.y + 16), at(lerp(root.x, tip.x, .45), -2 + sag), at(lerp(root.x, tip.x, .7), lerp(-3, tip.y, .5) + sag * .4)],
    [at(lerp(root.x, tip.x, .7), lerp(-3, tip.y, .5) + sag * .4), at(lerp(root.x, tip.x, .85), tip.y + 4), at(tip.x - side * 4, tip.y + 2), tip],
  ], 3.4, far, side < 0 ? -1 : 1);
  ctx.save(); ctx.translate(tip.x, tip.y); ctx.rotate(clubTilt); ctx.scale(side, 1);
  shape(ctx, () => {
    ctx.moveTo(-2, 2); ctx.bezierCurveTo(1, -3, 9, -5, 12, -1.5);
    ctx.bezierCurveTo(14, 1.5, 11, 5, 6, 5); ctx.quadraticCurveTo(1, 5, -2, 2);
  }, far ? DEEP : BODY);
  if (!far) for (const x of [3, 6.5, 9.5]) oval(ctx, x, 2.4, 1.2, 1, SUCKER, false);
  ctx.restore();
}

/** A long, tapering mantle that leans back from the head, with two rounded
 * fins wrapped round its tip, as on a real squid. The fins ripple gently. */
function mantle(ctx: Ctx, lean: number, breathe: number, finBeat: number) {
  ctx.save(); ctx.translate(-2, -48); ctx.rotate(lean);
  const length = 50 + breathe;
  const tip = -length;
  const fin = (side: number) => () => {
    const w = side * (23 + finBeat);
    ctx.moveTo(0, tip - 2);
    ctx.bezierCurveTo(side * 8, tip, w - side * 3, tip + 9, w, tip + 14);
    ctx.bezierCurveTo(w + side * 1.5, tip + 17, side * 16, tip + 24, side * 8, tip + 31);
    ctx.lineTo(0, tip + 26);
  };
  for (const side of [-1, 1]) {
    shape(ctx, fin(side), SHADE);
    within(ctx, fin(side), () => {
      line(ctx, () => { ctx.moveTo(side * 3, tip + 1); ctx.bezierCurveTo(side * 10, tip + 2, side * 17, tip + 8, side * 20, tip + 14); }, LIGHT, 2.2);
      for (const k of [.3, .6, .9]) {
        line(ctx, () => { ctx.moveTo(side * 4, tip + 9 + k * 12); ctx.lineTo(side * (12 + k * 6), tip + 8 + k * 10); }, DEEP, 1);
      }
    });
  }
  const cone = () => {
    ctx.moveTo(-20, 8);
    ctx.bezierCurveTo(-21, -14, -13, tip + 16, -4, tip + 2);
    ctx.quadraticCurveTo(0, tip - 6, 4, tip + 2);
    ctx.bezierCurveTo(13, tip + 16, 21, -14, 20, 8);
  };
  shape(ctx, cone, BODY);
  within(ctx, cone, () => {
    shape(ctx, () => {
      ctx.moveTo(6, 10); ctx.bezierCurveTo(12, -12, 8, tip + 18, 2, tip);
      ctx.lineTo(24, tip); ctx.lineTo(24, 10);
    }, SHADE, false);
    line(ctx, () => { ctx.moveTo(-11, 0); ctx.bezierCurveTo(-13, -18, -8, tip + 20, -3, tip + 6); }, LIGHT, 3);
    for (const [x, y, r] of [[-8, -10, 2], [3, -20, 1.7], [-4, -30, 1.5], [7, -5, 1.4], [-10, -24, 1.2], [1, -38, 1.3], [-6, -44, 1]] as const) {
      oval(ctx, x, y * (length / 50), r, r * 1.2, SPOT, false);
    }
  });
  shape(ctx, cone, 'rgba(0,0,0,0)');
  ctx.restore();
}

interface Face { startled: boolean; look: Point; open: number; happy: boolean }

function head(ctx: Ctx, face: Face) {
  const skull = () => {
    ctx.moveTo(-24, -32);
    ctx.bezierCurveTo(-25, -50, -12, -58, 0, -58);
    ctx.bezierCurveTo(13, -58, 25, -50, 24, -32);
    ctx.bezierCurveTo(23, -22, 13, -17, 0, -17);
    ctx.bezierCurveTo(-13, -17, -23, -22, -24, -32);
  };
  shape(ctx, skull, BODY);
  within(ctx, skull, () => {
    oval(ctx, 3, -18, 26, 9, SHADE, false);
    line(ctx, () => { ctx.moveTo(-17, -48); ctx.quadraticCurveTo(-8, -55, 3, -55); }, LIGHT, 3);
  });
  shape(ctx, skull, 'rgba(0,0,0,0)');
  for (const x of [-9.5, 9.5]) {
    eye(ctx, x, -39, 8.2, { look: face.look, wide: face.startled, open: face.open, lid: BODY, iris: '#4f7f8a' });
  }
  if (face.startled) mouth(ctx, 0, -25.5, 6, 'gasp', '#e79a7d');
  else mouth(ctx, 0, -26, face.happy ? 9 : 7, 'smile');
}

function inkPuff(ctx: Ctx, t: number) {
  const age = clamp(t / 1.1);
  if (age <= 0 || age >= 1) return;
  for (const [dx, dy, r, delay] of [[0, 0, 7, 0], [-9, -5, 9, .08], [-19, 2, 11, .16], [-12, 8, 7, .1]] as const) {
    const a = clamp((age - delay) / (1 - delay));
    if (a <= 0) continue;
    oval(ctx, -28 + dx - a * 16, -20 + dy - a * 4, r * (.5 + a), r * (.45 + a * .8), `rgba(47,43,63,${(.7 * (1 - a)).toFixed(3)})`, false);
  }
}

interface Pose {
  t: number; moving: boolean; running: boolean; startled: boolean; speed: number;
  gather: number; lift: number; reducedMotion: boolean; happy: boolean; lookUp: boolean;
  peek?: number;
  hammerX?: number;
}

/** The tentacle grips a wooden handle, and the flat steel head hits the ice.
 * The underwater swing is reversed so it strikes the underside of the sheet. */
function hammer(ctx: Ctx, t: number, x: number, below = false, root = at(3, -21)) {
  const stroke = hammerStroke(t);
  const grip = at(x, below ? 36 : -30);
  arm(ctx, [[root, at(root.x + 18, root.y + (below ? 12 : -12)), at(grip.x - 12, grip.y + 12), grip]], 4, false, 1);
  ctx.save(); ctx.translate(grip.x, grip.y); ctx.rotate(below ? Math.PI - stroke.angle : stroke.angle);
  line(ctx, () => { ctx.moveTo(0, 8); ctx.lineTo(0, -24); }, '#293b43', 5.5);
  line(ctx, () => { ctx.moveTo(0, 7); ctx.lineTo(0, -24); }, '#b9834f', 3);
  shape(ctx, () => ctx.roundRect(-11, -30, 22, 12, 2), '#7797a6');
  line(ctx, () => { ctx.moveTo(-8, -27); ctx.lineTo(7, -27); }, '#e7f4f7', 2);
  ctx.restore();
  oval(ctx, grip.x, grip.y, 5, 3.5, BODY);
  oval(ctx, grip.x + 1, grip.y + 1, 1.5, 1.3, SUCKER, false);
  if (stroke.impact) {
    for (let i = 0; i < 5; i++) {
      const dx = (i - 2) * 7, dy = (below ? 1 : -1) * (7 + (i % 2) * 5);
      line(ctx, () => { ctx.moveTo(x + dx * .4, below ? 6 : 0); ctx.lineTo(x + dx, (below ? 6 : 0) + dy); }, '#eaf9ff', 2.3);
    }
  }
}

function squidBody(ctx: Ctx, pose: Pose) {
  const { t, moving, running, startled } = pose;
  const v = Math.max(.05, pose.speed) * UNITS_PER_METRE * (running ? 3.5 : 1);
  const stride = running ? 16 : 11;
  const phase = moving ? gaitPhase(t, v, stride, .58) : 0;
  const cycle = TAU * phase;
  const jump = startled ? Math.sin(clamp(t / .75) * Math.PI) * 12 : 0;
  const bob = moving ? Math.abs(Math.sin(cycle)) * (running ? 1.2 : .6) : Math.sin(t * 1.3) * .4;
  const flare = startled ? Math.sin(clamp(t / .75) * Math.PI) : 0;
  const curl = moving ? 0 : Math.sin(t * 1.1) * 1.5;
  const lean = running ? -.95 + Math.sin(cycle) * .05 : moving ? -.58 + Math.sin(cycle) * .06 : -.46 + Math.sin(t * .9) * .05;
  // The front tentacle waves hello now and again while the squid rests.
  const waveCycle = t % 9;
  const waving = !moving && !startled && !pose.reducedMotion ? smooth((waveCycle - 5.5) / .4) * (1 - smooth((waveCycle - 7.6) / .4)) : 0;
  const lift = pose.lift;

  ctx.save(); ctx.translate(0, pose.hammerX == null ? -bob - jump - lift : 0);
  if (running) { ctx.translate(0, -2); ctx.rotate(.1); }
  const back = at(-3, -21), front = at(3, -21);
  tentacle(ctx, back, at(-44 - (moving ? Math.sin(cycle) * 4 : 0), -2 + flare * -14), 3, true, -.1);
  arms(ctx, phase, moving, pose.gather, flare, curl, stride, true);
  mantle(ctx, lean * lerp(1, .8, pose.gather) + flare * .1, Math.sin(t * 1.4) * 1.2, Math.sin(t * (moving ? 6 : 2.4)) * 1.4);
  arms(ctx, phase + .5, moving, pose.gather, flare, curl, stride, false);
  const waveTip = at(lerp(46, 34, waving) + Math.sin(t * 7) * 5 * waving, lerp(-2, -66, waving) + flare * -18);
  if (pose.hammerX == null) tentacle(ctx, front, pose.gather > .5 ? at(20, -8) : waveTip, lerp(3, -20, waving), false, lerp(0, -1.2, waving) + Math.sin(t * 7) * .3 * waving);
  const lookX = pose.hammerX != null ? .8 : pose.peek ? pose.peek : moving ? .75 : startled ? 0 : Math.sin(t * .45) * .6;
  head(ctx, { startled: startled || running, look: at(lookX, pose.hammerX != null ? .7 : pose.lookUp ? -.8 : startled ? 0 : .1), open: blink(t, 4.1, 1.3), happy: pose.happy || waving > .5 });
  if (pose.hammerX != null) hammer(ctx, t, pose.hammerX);
  ctx.restore();
  if (startled) { inkPuff(ctx, t); surprise(ctx, 22, -76 - jump, 8, t); }
}

/** The hole's far rim and dark water go behind the squid; its near half in front.
 * A hole cracks open, breaks up into slabs that sink, and later skins over
 * with fresh ice from the rim inwards until nothing is left. */
export function drawIceHole(ctx: Ctx, part: 'back' | 'front', hole?: IceHole) {
  const look = iceHoleLook(hole);
  if (part === 'front' && look.water <= 0) return;
  if (part === 'back') {
    const seed = finite(hole?.seed);
    if (look.crack > 0 && look.water < 1) {
      ctx.save(); ctx.globalAlpha = 1 - look.water;
      for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * TAU + noise(seed, i) * .7;
        const length = look.crack * (22 + noise(seed, i + 10) * 18);
        const crack = () => {
          ctx.moveTo(0, .5);
          for (let k = 1; k <= 3; k++) {
            const r = length * k / 3, jag = (noise(seed, i * 5 + k) - .5) * .6;
            ctx.lineTo(Math.cos(angle + jag) * r, .5 + Math.sin(angle + jag) * r * .24);
          }
        };
        line(ctx, crack, '#ffffff', 2.6);
        line(ctx, crack, '#6f98a6', 1.3);
      }
      ctx.restore();
    }
    if (look.water <= 0 && look.skin <= 0) return;
    const freezing = hole?.phase === 'freezing';
    const size = hole?.phase === 'opening' ? lerp(.55, 1, smooth(look.water * 1.5)) : 1;
    const pool = freezing ? look.water : 1;
    ctx.save();
    if (freezing) ctx.globalAlpha = Math.max(look.water, look.skin);
    oval(ctx, 0, 0, 36 * size, 8.5 * size, ICE_RIM, false);
    if (freezing) {
      // New ice: glassy blue, with needles of frost growing in from the rim.
      oval(ctx, 0, .8, 31, 6.4, '#c3e3ea', false);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + noise(seed, 70 + i) * .3;
        const r0 = 1, r1 = lerp(1, Math.max(pool, .2), .9 + noise(seed, 90 + i) * .1);
        line(ctx, () => {
          ctx.moveTo(Math.cos(a) * 31 * r0, .8 + Math.sin(a) * 6.4 * r0);
          ctx.lineTo(Math.cos(a) * 31 * r1, .8 + Math.sin(a) * 6.4 * r1);
        }, 'rgba(255,255,255,.75)', 1);
      }
      line(ctx, () => { ctx.ellipse(-4, -.5, 18, 2.6, 0, Math.PI * 1.1, Math.PI * 1.7); }, 'rgba(255,255,255,.9)', 1.4);
    }
    if (look.water > 0) {
      oval(ctx, 0, .8, 31 * size * pool, 6.4 * size * pool, WATER, false);
      oval(ctx, 4 * pool, 2.4 * pool, 17 * size * pool, 2.2 * size * pool, '#2f6b80', false);
      if (!freezing) line(ctx, () => { ctx.ellipse(0, .8, 31 * size, 6.4 * size, 0, Math.PI, TAU); }, '#8fb6c1', 1.6);
    }
    if (hole?.phase === 'opening' && look.water > 0) {
      // The broken plug: slabs that tip, drift apart and sink.
      ctx.globalAlpha = 1 - smooth((look.burst - .25) / .75);
      for (let i = 0; i < 4; i++) {
        const a = noise(seed, 30 + i) * TAU, r = 5 + look.burst * 14;
        const x = Math.cos(a) * r, y = .8 + Math.sin(a) * r * .18;
        shape(ctx, () => ctx.ellipse(x, y, 8.5 - i * 1.2, 2.3, (noise(seed, 40 + i) - .5) * .5, 0, TAU), '#e6f5f7', false);
        line(ctx, () => { ctx.moveTo(x - 6 + i, y + 1.3); ctx.lineTo(x + 6 - i, y + 1.3); }, '#8fb6c1', 1);
      }
      ctx.globalAlpha = 1;
      if (look.burst < .6) {
        const b = look.burst / .6;
        for (let i = 0; i < 7; i++) {
          const dx = (noise(seed, 50 + i) - .5) * 56 * b;
          const dy = -Math.sin(Math.PI * b) * (7 + noise(seed, 60 + i) * 12);
          oval(ctx, dx, dy, 1.7, 2.1, 'rgba(236,248,250,.95)', false);
        }
      }
    }
    ctx.restore();
    return;
  }
  shape(ctx, () => {
    ctx.ellipse(0, 0, 36, 8.5, 0, 0, Math.PI);
    ctx.ellipse(0, .8, 31, 6.4, 0, Math.PI, 0, true);
  }, ICE_RIM, false);
  shape(ctx, () => {
    ctx.moveTo(31, .8); ctx.ellipse(0, .8, 31, 6.4, 0, 0, Math.PI);
    ctx.quadraticCurveTo(0, 2, 31, .8);
  }, WATER, false);
  line(ctx, () => { ctx.ellipse(0, 0, 36, 8.5, 0, .15, Math.PI - .15); }, '#b7d6dc', 1.4);
}

/** Only what is above the ice is drawn; the hole's near lip hides the cut. */
function throughHole(ctx: Ctx, sink: number, holeX: number, draw: () => void) {
  ctx.save(); ctx.translate(holeX, 0); drawIceHole(ctx, 'back'); ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.moveTo(-240, 0); ctx.lineTo(240, 0); ctx.lineTo(240, -400); ctx.lineTo(-240, -400); ctx.closePath(); ctx.clip();
  ctx.translate(0, sink);
  draw();
  ctx.restore();
  ctx.save(); ctx.translate(holeX, 0); drawIceHole(ctx, 'front');
  if (sink > 4) {
    for (let i = 0; i < 3; i++) oval(ctx, -14 + i * 13, 1 + (i % 2), 5 - i, 1.6, 'rgba(228,244,245,.8)', false);
  }
  ctx.restore();
}

/** Under the ice the squid is a soft, jetting shadow on its way to another
 * spot. `rise` brings it up under the ice as it breaks through. */
function underIce(ctx: Ctx, t: number, rise = 0, breaking = false, portrait = false) {
  const pulse = (t * 1.2) % 1;
  const squeeze = pulse < .3 ? smooth(pulse / .3) : 1 - smooth((pulse - .3) / .7);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(-200, 6); ctx.lineTo(200, 6); ctx.lineTo(200, 200); ctx.lineTo(-200, 200); ctx.closePath(); ctx.clip();
  ctx.translate(0, lerp(34, 18, rise) + Math.sin(t * 1.7) * 2 * (1 - rise));
  const shadow = portrait ? BODY : 'rgba(22,58,76,.42)';
  // Mantle first, arms trailing: squid jet backwards through the water.
  shape(ctx, () => {
    ctx.moveTo(34, 0);
    ctx.bezierCurveTo(26, -9, 10, -11 + squeeze * 2, -8, -8);
    ctx.lineTo(-8, 8);
    ctx.bezierCurveTo(10, 11 - squeeze * 2, 26, 9, 34, 0);
  }, shadow, false);
  shape(ctx, () => { ctx.moveTo(40, 0); ctx.lineTo(26, -13); ctx.lineTo(20, 0); ctx.lineTo(26, 13); }, shadow, false);
  oval(ctx, -12, 0, 10, 9, shadow, false);
  for (let i = 0; i < 5; i++) {
    const spread = (i - 2) * lerp(4, 1.5, squeeze);
    line(ctx, () => {
      ctx.moveTo(-18, spread * .5);
      ctx.quadraticCurveTo(-32, spread + Math.sin(t * 5 + i) * 2, -46 + squeeze * 6, spread * 1.4);
    }, shadow, 3.5 - Math.abs(i - 2) * .5);
  }
  oval(ctx, -9, -3, 1.6, 1.6, 'rgba(255,253,242,.55)', false);
  if (portrait) {
    eye(ctx, -14, -3, 2.8, { look: at(breaking ? .3 : -.7, breaking ? -.8 : 0), open: blink(t), wide: breaking });
    mouth(ctx, -18, 3, 3, 'smile');
  }
  ctx.restore();
  if (breaking) hammer(ctx, t, 0, true, at(-12, lerp(34, 18, rise)));
}

function squashed(ctx: Ctx, t: number) {
  groundShadow(ctx, 0, 58);
  for (const [x, w] of [[-44, 16], [-26, 12], [26, 12], [44, 16]] as const) oval(ctx, x, -2.5, w, 3, x < 0 ? DEEP : BODY);
  ctx.save(); ctx.translate(-26, -6); ctx.rotate(-1.35); ctx.scale(.9, .35); mantle(ctx, 0, 0, 0); ctx.restore();
  ctx.save(); ctx.translate(4, 2); ctx.scale(1.25, .38);
  head(ctx, { startled: false, look: at(0, 0), open: 0, happy: false });
  ctx.restore();
  dizzy(ctx, 6, -24, 14, t);
}

/** Ganymede's foot-anchored squid, facing right before mirroring.
 * At s=80 the resting squid spans about x -70..62, y -128..4.
 * States beyond the shared set: 'diving' and 'emerging' at a hole, and
 * 'submerged' swimming beneath the ice. Portrait face anchor: (0, -61).
 */
export function drawGiantSquid(ctx: CanvasRenderingContext2D, cx: number, footY: number, s: number, char: GiantSquidPose) {
  const t = char.reducedMotion ? 0 : finite(char.stateTimer);
  const state = char.state || 'idle';
  const moving = ['walking', 'returning', 'running_away', 'carrying'].includes(state);
  const running = moving && state === 'running_away';
  const startled = state === 'startled' || state === 'rocket_startled';
  const pose: Pose = {
    t, moving, running, startled, speed: finite(char.speed, .45), gather: 0, lift: 0,
    reducedMotion: !!char.reducedMotion, happy: char.reaction === 'impact', lookUp: char.reaction === 'apex' || char.reaction === 'escape',
  };
  ctx.save(); ctx.translate(cx, footY); ctx.scale(s / 80, s / 80);
  pen(ctx, 1.9);
  const direction = char.direction === -1 ? -1 : 1;
  ctx.scale(direction, 1);
  if (state === 'squashed') {
    if (char.portrait) ctx.translate(0, -48);
    squashed(ctx, t); ctx.restore(); return;
  }
  if (state === 'submerged' || state === 'breaking') {
    const rise = state === 'breaking' ? smooth(t / HOLE_OPEN_SECONDS * 2) : 0;
    if (char.portrait) {
      ctx.translate(0, -61 - lerp(34, 18, rise) * 1.15); ctx.scale(1.15, 1.15);
      line(ctx, () => { ctx.moveTo(-100, 5); ctx.lineTo(100, 5); }, '#bedee9', 3);
    }
    underIce(ctx, t, rise, state === 'breaking', !!char.portrait); ctx.restore(); return;
  }
  if (state === 'hammering') {
    if (char.portrait) ctx.translate(0, -24);
    squidBody(ctx, { ...pose, hammerX: clamp(finite(char.holeX), -2, 2) * UNITS_PER_METRE * direction });
    ctx.restore(); return;
  }
  if (state === 'diving' || state === 'emerging') {
    const p = clamp(t / (state === 'diving' ? SQUID_DIVE_SECONDS : SQUID_EMERGE_SECONDS));
    const holeX = clamp(finite(char.holeX), -2, 2) * UNITS_PER_METRE * direction;
    let sink: number, gather: number, look = 0;
    if (state === 'diving') {
      // A little crouch and hop into the middle of the hole, arms drawn in,
      // then down it goes: fins last.
      gather = smooth(p / .18);
      sink = smooth((p - .15) / .85) * 150 + 3 * gather * (1 - smooth((p - .15) / .2))
        - Math.sin(Math.PI * clamp(p / .22)) * 9;
    } else {
      // Fin tip first, then a wary peek left and right, then a hop out onto the ice.
      sink = p < .25 ? lerp(160, 58, smooth(p / .25))
        : p < .4 ? lerp(58, 24, smooth((p - .25) / .15))
        : p < .66 ? 24
        : p < .86 ? lerp(24, -10, smooth((p - .66) / .2))
        : lerp(-10, 0, smooth((p - .86) / .14));
      gather = 1 - smooth((p - .7) / .3);
      look = p > .4 && p < .66 ? Math.sin((p - .4) / .26 * TAU) : 0;
    }
    if (char.portrait) {
      // Follow the face through the water instead of freezing it or letting it
      // disappear below the inset. The ice line passes it during the dive.
      ctx.translate(0, -24);
      squidBody(ctx, { ...pose, gather, peek: look, lookUp: state === 'emerging' });
      const waterline = clamp(-sink, -108, 12);
      line(ctx, () => { ctx.moveTo(-90, waterline); ctx.lineTo(90, waterline); }, '#c4e7ee', 3);
      if (sink > 20) {
        for (let i = 0; i < 3; i++) oval(ctx, 28 + i * 5, -42 - i * 10 + Math.sin(t * 5 + i) * 2, 2, 2.5, 'rgba(198,232,243,.65)', false);
      }
      ctx.restore(); return;
    }
    if (sink < 0) groundShadow(ctx, 0, 52 * (1 + sink / 60));
    throughHole(ctx, sink, holeX, () => squidBody(ctx, { ...pose, gather, peek: look }));
    ctx.restore(); return;
  }
  if (char.portrait) ctx.translate(0, -24);
  else groundShadow(ctx, 0, 52);
  squidBody(ctx, pose);
  ctx.restore();
}
