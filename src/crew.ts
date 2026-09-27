/**
 * The launch crew: golfer, alien, spaceman, robots and the barrel workers.
 * One cartoon rig in a 100-unit, foot-anchored space, facing right before
 * mirroring. Legs are two-bone with planted feet, arms swing against them,
 * and each type walks in character: the golfer strolls, the spaceman
 * moon-hops, the alien waddles, the metal robot marches and the round one shuffles.
 */
import {
  INK, PAPER, TAU, clamp, lerp, smooth, finite, at, add, pen, oval, shape, line, within, roundBox,
  groundShadow, limb, joint, footfall, gaitPhase, blink, eye, mouth, dust, speedLines,
  dizzy, surprise, type Ctx, type Point, type Footfall,
} from './toon.ts';
import { gazeAim, observationAim, type IdleLook, type WatchAim } from './crew-watch.ts';
import { businessTime, type SillyAction } from './character-business.ts';
import { drawBusinessProp } from './silly-props.ts';

export type CrewReaction = 'coast' | 'apex' | 'impact' | 'escape' | 'fizzle';

export interface CrewPose {
  type: string;
  state?: string;
  stateTimer?: number;
  direction?: number;
  reaction?: CrewReaction;
  reducedMotion?: boolean;
  /** Walking speed in metres per second; running is 3.5 times this. */
  speed?: number;
  /** Explicit bearing overrides the relaxed left/front/right viewing cycle. */
  watchAim?: WatchAim;
  idleLook?: IdleLook;
  business?: SillyAction;
}

const GREEN = '#608167';
const GOLD = '#e8ae53';
const CREAM = '#e8e7cb';
const UNITS_PER_METRE = 100 / 1.32;

type Style = 'stroll' | 'hop' | 'waddle' | 'march' | 'shuffle';
type Mood = 'smile' | 'gasp' | 'grin' | 'worry';

/** Stride, lift and stance fraction for walking and running. */
const GAITS: Record<Style, { walk: number[]; run: number[] }> = {
  stroll: { walk: [24, 6, .6], run: [40, 13, .36] },
  hop: { walk: [30, 3, .32], run: [50, 4, .3] },
  waddle: { walk: [14, 5, .58], run: [22, 8, .42] },
  march: { walk: [22, 9, .62], run: [34, 12, .42] },
  shuffle: { walk: [20, 3, .65], run: [28, 8, .45] },
};

interface Motion {
  moving: boolean;
  running: boolean;
  near: Footfall;
  far: Footfall;
  cycle: number;
  hipY: number;
  lean: number;
  shake: number;
  swing: number;
  /** Both feet rise with the body during a moon-hop or startled jump. */
  footLift: number;
  period: number;
  duty: number;
  stride: number;
}

interface Face {
  open: number;
  look: Point;
  mood: Mood;
  wide: boolean;
  tilt: number;
}

const stand = (x: number): Footfall => ({ x, y: 0, planted: true, swing: 0, stance: .5 });

function motion(style: Style, state: string, t: number, speed: number, startled: boolean): Motion {
  const moving = ['walking', 'returning', 'running_away', 'running_to', 'carrying'].includes(state);
  const running = state === 'running_away' || state === 'running_to' || state === 'carrying';
  const base: Motion = {
    moving, running, near: stand(6), far: stand(-5), cycle: 0, hipY: -30, lean: 0, shake: 0,
    swing: 0, footLift: 0, period: 1, duty: .6, stride: 0,
  };
  if (startled) {
    // Anticipation crouch, a big leap, a squashy landing, then the shakes.
    const crouch = t < .09 ? smooth(t / .09) : 1 - smooth((t - .09) / .08);
    const air = t > .09 && t < .5 ? Math.sin(Math.PI * (t - .09) / .41) : 0;
    const land = t >= .5 && t < .66 ? Math.sin(Math.PI * (t - .5) / .16) : 0;
    const trembling = t >= .66;
    return { ...base, hipY: -30 + crouch * 4 + land * 3 - air * 14, footLift: -air * 10,
      near: stand(7), far: stand(-7), shake: trembling ? Math.sin(t * 47) * 1.1 : 0,
      lean: -.06 * air };
  }
  if (!moving) {
    return { ...base, hipY: -30 + Math.sin(t * 2.1) * .3 };
  }
  const [stride, lift, duty] = GAITS[style][running ? 'run' : 'walk'];
  const v = Math.max(.2, speed) * UNITS_PER_METRE * (running ? 3.5 : 1);
  const phase = gaitPhase(t, v, stride, duty);
  const period = stride / (duty * v);
  const hop = style === 'hop';
  const near = footfall(phase, stride, lift, duty);
  const far = footfall(phase + (hop ? .05 : .5), stride, lift, duty);
  let bob: number, lean: number, footLift = 0;
  if (hop) {
    // Both boots push off together and the body sails in a low-gravity arc.
    const p = phase - Math.floor(phase);
    const air = p < duty ? 0 : Math.sin(Math.PI * (p - duty) / (1 - duty));
    const squat = p < duty ? Math.sin(Math.PI * p / duty) : 0;
    bob = -air * (running ? 11 : 6) + squat * 1.8;
    footLift = -air * (running ? 9 : 5);
    lean = running ? .12 : .04;
  } else if (running) {
    bob = 1.3 * Math.cos(TAU * 2 * (phase - duty / 2)) - 1;
    lean = style === 'march' ? .07 : style === 'waddle' ? .1 : .17;
  } else {
    bob = -.7 * Math.cos(TAU * 2 * (phase - duty / 2));
    lean = style === 'march' ? 0 : .03;
  }
  return { ...base, near, far, cycle: TAU * phase, hipY: -30 + bob, lean, footLift,
    swing: clamp(-near.x / (stride / 2), -1, 1), period, duty, stride };
}

/** From the leaned, hip-centred body frame into foot-anchored space. */
function world(m: Motion, p: Point): Point {
  const c = Math.cos(m.lean), s = Math.sin(m.lean);
  return { x: m.shake + p.x * c - p.y * s, y: m.hipY + p.x * s + p.y * c };
}

function inBody(ctx: Ctx, m: Motion, draw: () => void) {
  ctx.save(); ctx.translate(m.shake, m.hipY); ctx.rotate(m.lean); draw(); ctx.restore();
}

/** Puffs where running feet strike; they stay where the foot landed. */
function footDust(ctx: Ctx, m: Motion, x: number, foot: Footfall, size: number) {
  if (!m.running || !foot.planted) return;
  dust(ctx, x + foot.x, 0, foot.stance * m.period * m.duty / .35, size);
}

/** A proper club: a straight, rigid shaft, a dark grip and a steel iron head.
 * `grip` is the hand; the head sits at the far end of the shaft. */
function club(ctx: Ctx, grip: Point, angle: number, toe = Math.sin(angle) > 0 ? -1 : 1) {
  const ux = Math.cos(angle), uy = Math.sin(angle);
  const top = at(grip.x - ux * 6, grip.y - uy * 6);
  const neck = at(grip.x + ux * 38, grip.y + uy * 38);
  const grip2 = at(top.x + ux * 12, top.y + uy * 12);
  const shaft = () => { ctx.moveTo(top.x, top.y); ctx.lineTo(neck.x, neck.y); };
  line(ctx, shaft, INK, 3.8);
  line(ctx, shaft, '#c5ced0', 1.8);
  const handle = () => { ctx.moveTo(top.x, top.y); ctx.lineTo(grip2.x, grip2.y); };
  line(ctx, handle, INK, 5.6);
  line(ctx, handle, '#40545b', 3.4);
  ctx.save(); ctx.translate(neck.x, neck.y); ctx.rotate(angle);
  shape(ctx, () => {
    ctx.moveTo(-3, -1.5 * toe);
    ctx.lineTo(-1.5, 8 * toe);
    ctx.quadraticCurveTo(-1, 11.5 * toe, 2.6, 11.5 * toe);
    ctx.quadraticCurveTo(5.4, 11 * toe, 5, 7.5 * toe);
    ctx.lineTo(4.2, 0);
    ctx.quadraticCurveTo(2, -2.2 * toe, -3, -1.5 * toe);
  }, '#dfe5e2');
  line(ctx, () => { ctx.moveTo(1.2, 2.5 * toe); ctx.lineTo(1.8, 8.5 * toe); }, '#9eaaa9', 1.1);
  ctx.restore();
}

/** Props for a stationary reaction, held at the near hand. */
function prop(ctx: Ctx, reaction: CrewReaction, hand: Point, t: number) {
  if (reaction === 'escape') {
    // A clipboard with the sums on it.
    ctx.save(); ctx.translate(hand.x + 2, hand.y + 3); ctx.rotate(-.2);
    shape(ctx, () => roundBox(ctx, -8, -13, 18, 24, 2), PAPER);
    shape(ctx, () => roundBox(ctx, -3, -15, 8, 4, 1.5), '#8c6b47');
    line(ctx, () => { ctx.moveTo(-4, -5); ctx.lineTo(6, -5); ctx.moveTo(-4, 0); ctx.lineTo(5, 0); ctx.moveTo(-4, 5); ctx.lineTo(3, 5); }, '#be7245', 1.4);
    ctx.restore();
  } else if (reaction === 'impact') {
    // A tape measure, its yellow tape curling out to the ground ahead.
    const end = at(hand.x + 30, -1.5);
    const tape = () => { ctx.moveTo(hand.x + 5, hand.y + 3); ctx.quadraticCurveTo(hand.x + 26, hand.y + 4, end.x, end.y); };
    line(ctx, tape, INK, 4.4);
    line(ctx, tape, '#f2cf62', 2.6);
    for (let i = 1; i < 6; i++) {
      const u = i / 6, a = 1 - u;
      const x = a * a * (hand.x + 5) + 2 * a * u * (hand.x + 26) + u * u * end.x;
      const y = a * a * (hand.y + 3) + 2 * a * u * (hand.y + 4) + u * u * end.y;
      oval(ctx, x, y, .7, .7, INK, false);
    }
    line(ctx, () => { ctx.moveTo(end.x - 1, end.y); ctx.lineTo(end.x + 2, end.y - 3); }, INK, 1.8);
    shape(ctx, () => roundBox(ctx, hand.x - 5, hand.y - 3, 13, 12, 4), GOLD);
    oval(ctx, hand.x + 1.5, hand.y + 3, 2.4, 2.4, '#b9853c', false);
  } else if (reaction === 'fizzle') {
    // A consoling cup of tea, still steaming.
    shape(ctx, () => roundBox(ctx, hand.x - 3, hand.y - 2, 13, 13, 3), PAPER);
    line(ctx, () => { ctx.arc(hand.x + 11, hand.y + 4.5, 4, -Math.PI / 2, Math.PI / 2); }, INK, 1.8);
    const drift = Math.sin(t * 2.2) * 1.5;
    line(ctx, () => {
      ctx.moveTo(hand.x + 3, hand.y - 5);
      ctx.bezierCurveTo(hand.x + drift, hand.y - 9, hand.x + 6 + drift, hand.y - 12, hand.x + 3, hand.y - 16);
    }, 'rgba(135,146,138,.8)', 1.5);
  }
}

/** Optics share the eye's origin and tilt, with hands placed in that frame. */
export function viewingDevice(ctx: Ctx, side: boolean, mono: boolean, eyeSpacing = 7) {
  if (side) {
    shape(ctx, () => roundBox(ctx, 0, -5, 22, 10, 3), '#496574');
    oval(ctx, 22, 0, 3.5, 6.5, '#7fabb5');
    line(ctx, () => { ctx.moveTo(5, -3); ctx.lineTo(17, -3); }, '#9cbac0', 1.4);
  } else if (mono) {
    oval(ctx, 0, 0, 12, 12, '#496574');
    oval(ctx, 0, 0, 8.5, 8.5, '#7fabb5');
    oval(ctx, -2.5, -3, 2, 2, PAPER, false);
  } else {
    shape(ctx, () => roundBox(ctx, -11, -4, 22, 8, 3), '#496574');
    for (const x of [-eyeSpacing, eyeSpacing]) {
      oval(ctx, x, 0, 5.6, 6, '#496574');
      oval(ctx, x, 0, 3.5, 4, '#7fabb5');
    }
  }
}

function rotated(p: Point, angle: number): Point {
  return at(p.x * Math.cos(angle) - p.y * Math.sin(angle), p.x * Math.sin(angle) + p.y * Math.cos(angle));
}

// ── Heads ────────────────────────────────────────────────────────────────────
// All heads are drawn around their own centre, facing right in three-quarter view.

/** A plain, open face looking straight out, just turned towards the walk. */
function faceFeatures(ctx: Ctx, face: Face, skinShade: string) {
  const opts = { bean: true, look: face.look, open: face.open, wide: face.wide };
  eye(ctx, -5, -1, 2.9, opts);
  eye(ctx, 9.5, -1, 2.9, opts);
  oval(ctx, 2.5, 6.5, 3.4, 2.5, skinShade, false);
  oval(ctx, -13, 7.5, 3.6, 1.8, 'rgba(223,157,121,.55)', false);
  oval(ctx, 17, 7.5, 3.6, 1.8, 'rgba(223,157,121,.55)', false);
  mouth(ctx, 2.5, 12, face.mood === 'gasp' ? 7.5 : 9, face.mood);
}

function golferHead(ctx: Ctx, face: Face, worker: boolean, lift: number) {
  const skin = '#edb982';
  oval(ctx, -18, 1, 5, 7, skin);
  oval(ctx, -18, 1.5, 2.2, 3.5, '#d89767', false);
  oval(ctx, 1, 0, 22.5, 20.5, skin);
  within(ctx, () => ctx.ellipse(1, 0, 22.5, 20.5, 0, 0, TAU), () => {
    oval(ctx, -6, 14, 26, 9, 'rgba(201,132,90,.25)', false);
  });
  shape(ctx, () => {
    ctx.moveTo(-22, 3); ctx.lineTo(-24, -12); ctx.lineTo(-15, -19); ctx.lineTo(0, -21);
    ctx.lineTo(15, -15); ctx.lineTo(21, -4); ctx.lineTo(14, -9); ctx.lineTo(6, -7);
    ctx.lineTo(8, -12); ctx.lineTo(-7, -8); ctx.lineTo(-14, -11);
  }, worker ? '#5b4030' : '#765139');
  faceFeatures(ctx, face, '#d89767');
  // The cap pops up at a fright but always stays on.
  ctx.save(); ctx.translate(0, -lift);
  if (worker) {
    shape(ctx, () => {
      ctx.moveTo(-24, -9); ctx.bezierCurveTo(-26, -33, 22, -37, 25, -12); ctx.closePath();
    }, GOLD);
    line(ctx, () => { ctx.moveTo(0, -30); ctx.quadraticCurveTo(3, -20, 1, -11); }, '#c98e3c', 2.2);
    shape(ctx, () => roundBox(ctx, -28, -12, 58, 5.5, 2.5), '#d59b44');
  } else {
    shape(ctx, () => {
      ctx.moveTo(-24, -10); ctx.bezierCurveTo(-29, -35, 11, -39, 21, -15);
      ctx.quadraticCurveTo(-1, -20, -24, -10);
    }, GREEN);
    shape(ctx, () => {
      ctx.moveTo(-11, -29); ctx.lineTo(0, -33); ctx.lineTo(13, -25); ctx.lineTo(12, -18); ctx.lineTo(-7, -18);
    }, PAPER);
    shape(ctx, () => {
      ctx.moveTo(-5, -17); ctx.quadraticCurveTo(33, -30, 29, -15);
      ctx.quadraticCurveTo(20, -8, 12, -15);
    }, '#41644d');
    oval(ctx, -3, -35, 2.6, 2.2, '#41644d');
  }
  ctx.restore();
}

/** Side-on, as he walks: one eye, a nose on the profile and the cap brim out front. */
function golferSideHead(ctx: Ctx, face: Face, worker: boolean, lift: number) {
  const skin = '#edb982';
  const skull = () => ctx.ellipse(0, 0, 20.5, 20.5, 0, 0, TAU);
  shape(ctx, skull, skin);
  within(ctx, skull, () => oval(ctx, -4, 14, 24, 9, 'rgba(201,132,90,.25)', false));
  const nose = () => { ctx.moveTo(19, -3.5); ctx.quadraticCurveTo(26.5, .5, 23.5, 5.5); ctx.quadraticCurveTo(21.5, 7.5, 18.5, 5.5); };
  shape(ctx, nose, skin, false);
  line(ctx, nose, INK, 2);
  shape(ctx, () => {
    ctx.moveTo(-3, -19); ctx.bezierCurveTo(-15, -18, -22, -8, -19, 7);
    ctx.lineTo(-15, 3); ctx.lineTo(-13, 8); ctx.lineTo(-10, 1); ctx.lineTo(-7, 3); ctx.lineTo(-8, -6); ctx.lineTo(-1, -9);
  }, worker ? '#5b4030' : '#765139');
  oval(ctx, -4, 2, 4.6, 6, skin);
  oval(ctx, -4, 2.5, 2, 3.4, '#d89767', false);
  eye(ctx, 11.5, -1, 2.9, { bean: true, look: face.look, open: face.open, wide: face.wide });
  oval(ctx, 10, 8, 3.2, 1.7, 'rgba(223,157,121,.55)', false);
  mouth(ctx, 15.5, 12, face.mood === 'gasp' ? 5 : 6, face.mood);
  ctx.save(); ctx.translate(0, -lift);
  if (worker) {
    shape(ctx, () => { ctx.moveTo(-21, -8); ctx.bezierCurveTo(-23, -33, 21, -35, 22, -8); ctx.closePath(); }, GOLD);
    line(ctx, () => { ctx.moveTo(0, -29); ctx.quadraticCurveTo(4, -20, 3, -10); }, '#c98e3c', 2.2);
    shape(ctx, () => roundBox(ctx, -24, -11, 54, 5.5, 2.5), '#d59b44');
  } else {
    shape(ctx, () => {
      ctx.moveTo(-21, -7); ctx.bezierCurveTo(-24, -31, 15, -35, 20, -10);
      ctx.quadraticCurveTo(0, -14, -21, -7);
    }, GREEN);
    shape(ctx, () => {
      ctx.moveTo(5, -30); ctx.bezierCurveTo(13, -27, 18, -20, 19.5, -11); ctx.lineTo(11, -12.3);
      ctx.bezierCurveTo(10.5, -19, 8.5, -25, 5, -30);
    }, PAPER);
    shape(ctx, () => {
      ctx.moveTo(12, -12.5); ctx.quadraticCurveTo(30, -15.5, 34, -10);
      ctx.quadraticCurveTo(28, -6.5, 13, -8.5);
    }, '#41644d');
    oval(ctx, -2, -32, 2.6, 2.2, '#41644d');
  }
  ctx.restore();
}

function spacemanHead(ctx: Ctx, face: Face, t: number, side: boolean) {
  // Antenna with a friendly blinking light, then the rounded helmet shell.
  line(ctx, () => { ctx.moveTo(-8, -21); ctx.lineTo(-11, -32); }, INK, 3.2);
  line(ctx, () => { ctx.moveTo(-8, -21); ctx.lineTo(-11, -32); }, '#b8c1bd', 1.6);
  oval(ctx, -11, -33, 3, 3, Math.sin(t * 3) > .6 ? '#f08a57' : '#c96b48');
  oval(ctx, 0, -1, 26, 23.5, PAPER);
  within(ctx, () => ctx.ellipse(0, -1, 26, 23.5, 0, 0, TAU), () => {
    oval(ctx, -8, 16, 30, 10, 'rgba(163,150,120,.3)', false);
  });
  if (side) {
    // Side-on: the ear unit on the helmet's flank and the visor out front.
    shape(ctx, () => roundBox(ctx, -10, -9, 10, 18, 4), '#96aab1');
    const visor = () => ctx.ellipse(12.5, 0, 13.5, 16, 0, 0, TAU);
    shape(ctx, visor, '#3b5366');
    within(ctx, visor, () => {
      ctx.save(); ctx.translate(9, 3); ctx.scale(.82, .82);
      oval(ctx, 0, 0, 13, 13, '#b77c54', false);
      oval(ctx, 13, 1.5, 3.2, 3, '#a56d48', false);
      shape(ctx, () => { ctx.moveTo(-14, 4); ctx.bezierCurveTo(-15, -14, 6, -17, 12, -7); ctx.lineTo(3, -8); ctx.lineTo(-4, -4); ctx.lineTo(-6, 5); }, '#3c3c3b', false);
      eye(ctx, 6.5, -.5, 2.8, { bean: true, look: face.look, open: face.open, wide: face.wide });
      mouth(ctx, 8.5, 7, 5, face.mood);
      ctx.restore();
      line(ctx, () => { ctx.moveTo(4, -9); ctx.quadraticCurveTo(9, -14, 16, -13); }, 'rgba(215,230,225,.75)', 2.6);
    });
    oval(ctx, 12.5, 0, 13.5, 16, 'rgba(0,0,0,0)');
    return;
  }
  shape(ctx, () => roundBox(ctx, -28, -9, 8, 18, 3), '#96aab1');
  const visor = () => ctx.ellipse(6, 0, 18.5, 16, 0, 0, TAU);
  shape(ctx, visor, '#3b5366');
  within(ctx, visor, () => {
    ctx.save(); ctx.translate(6, 3); ctx.scale(.82, .82);
    oval(ctx, 0, 0, 14, 13, '#b77c54', false);
    shape(ctx, () => { ctx.moveTo(-14, -2); ctx.bezierCurveTo(-13, -17, 15, -16, 15, -2); ctx.lineTo(7, -8); ctx.lineTo(0, -5); ctx.lineTo(-7, -9); }, '#3c3c3b', false);
    eye(ctx, -4, 0, 2.8, { bean: true, look: face.look, open: face.open, wide: face.wide });
    eye(ctx, 7, -.4, 2.8, { bean: true, look: face.look, open: face.open, wide: face.wide });
    mouth(ctx, 2, 7, 7, face.mood);
    ctx.restore();
    line(ctx, () => { ctx.moveTo(-6, -8); ctx.quadraticCurveTo(-2, -13, 5, -14); }, 'rgba(215,230,225,.75)', 2.6);
  });
  oval(ctx, 6, 0, 18.5, 16, 'rgba(0,0,0,0)');
}

const RETRO_METAL = '#aebdc4', ROUND_SHELL = '#edf3ee';
const RETRO_EYE = '#df735e', ROUND_EYE = '#a5cf7d';

function robotMetal(ctx: Ctx, round = false) {
  const fill = ctx.createLinearGradient(-22, -24, 24, 24);
  fill.addColorStop(0, round ? '#fffdf1' : '#dce5e4');
  fill.addColorStop(.42, round ? ROUND_SHELL : RETRO_METAL);
  fill.addColorStop(1, round ? '#b7cdd0' : '#748c9b');
  return fill;
}

/** The old television-inspired machine: a tall slab face, raised centre rib,
 * tired red lamps and a little speaker grille. No shared screen-face rig. */
function retroRobotHead(ctx: Ctx, face: Face, side: boolean) {
  const shell = () => roundBox(ctx, side ? -16 : -20, -24, side ? 34 : 40, 43, 3.5);
  shape(ctx, shell, robotMetal(ctx));
  within(ctx, shell, () => {
    shape(ctx, () => { ctx.moveTo(-21, -24); ctx.lineTo(21, -24); ctx.lineTo(15, -18); ctx.lineTo(-14, -18); }, '#e0e8e5', false);
    shape(ctx, () => ctx.rect(side ? -16 : 15, -18, 5, 40), '#78909e', false);
  });
  const lamp = (x: number, flip: number) => {
    ctx.save(); ctx.translate(x + face.look.x*.6, -1 + face.look.y); ctx.scale(flip, Math.max(.13, face.open));
    shape(ctx, () => {
      ctx.moveTo(-4, face.wide ? -6 : -4);
      ctx.lineTo(5, face.wide ? -3 : 4);
      ctx.lineTo(-5, face.wide ? 5 : 2);
    }, RETRO_EYE);
    ctx.restore();
  };
  if (side) {
    shape(ctx, () => roundBox(ctx, 7, -17, 10, 9, 1), '#3e505a');
    oval(ctx, -10, 1, 4.5, 6.3, '#92a7b0');
    line(ctx, () => { ctx.moveTo(-12, 1); ctx.lineTo(-8, 1); }, '#506772', 1.3);
    lamp(12.5, 1);
    shape(ctx, () => roundBox(ctx, 8, 10, 10, face.mood==='gasp' ? 6 : 3, 1), '#536b76');
    return;
  }
  for (const x of [-15, 5]) shape(ctx, () => roundBox(ctx, x, -17, 11, 8, 1), '#3e505a');
  lamp(-9, -1); lamp(10, 1);
  shape(ctx, () => { ctx.moveTo(-2,-20); ctx.lineTo(3,-20); ctx.lineTo(4,7); ctx.lineTo(0,9); ctx.lineTo(-3,6); }, '#d6e0dd');
  shape(ctx, () => roundBox(ctx, -10, 11, 23, face.mood==='gasp' ? 6 : 3.5, 1), '#536b76');
  for (const x of [-7,-3,1,5,9]) line(ctx, () => { ctx.moveTo(x,12); ctx.lineTo(x,14); }, '#c5d2d3', .8);
  for (const x of [-16,16]) oval(ctx,x,7.5,1,1,'#e9efea',false);
}

/** The film-inspired ice robot: a porcelain globe, low eyelid seam, green
 * triangular lamps and no human mouth. Its head dwarfs the small body. */
function roundRobotHead(ctx: Ctx, face: Face, side: boolean) {
  const rx = side ? 29 : 33;
  const shell = () => ctx.ellipse(0,-1,rx,28,0,0,TAU);
  shape(ctx, shell, robotMetal(ctx,true));
  within(ctx, shell, () => {
    oval(ctx,12,19,30,12,'rgba(86,124,138,.13)',false);
    line(ctx, () => { ctx.moveTo(-20,-17); ctx.quadraticCurveTo(-9,-27,6,-24); }, '#fffdf1', 2.2);
    if (side) {
      line(ctx, () => { ctx.moveTo(7,6); ctx.quadraticCurveTo(18,2,29,3); }, '#344951', 1.5);
      oval(ctx,-12,5,4.3,5.5,'#dae5e3');
      oval(ctx,-12,5,1.5,2.3,'#8ba6b0',false);
    } else line(ctx, () => { ctx.moveTo(-32,8); ctx.quadraticCurveTo(0,0,32,8); }, '#344951', 1.5);
  });
  const lamp = (x:number, flip:number) => {
    ctx.save(); ctx.translate(x+face.look.x*.5,5+face.look.y); ctx.scale(flip,Math.max(.1,face.open));
    shape(ctx, () => {
      ctx.moveTo(-6,-1); ctx.lineTo(6,face.wide ? -1 : 0);
      ctx.lineTo(face.wide ? 3 : 0,face.wide ? 9 : 7); ctx.lineTo(-4,face.wide ? 7 : 2);
    }, ROUND_EYE);
    ctx.restore();
  };
  if (side) lamp(21,1);
  else { lamp(-14,-1); lamp(14,1); }
}

function robotTorso(ctx: Ctx, round: boolean, side: boolean) {
  if (round) {
    // Dark flexible waist between a shoulder carapace and the round abdomen.
    shape(ctx, () => roundBox(ctx,-10,-27,22,29,7),'#344951');
    oval(ctx,side ? 2 : 0,-3,side ? 12 : 16,11,robotMetal(ctx,true));
    shape(ctx, () => {
      ctx.moveTo(side ? -11 : -16,-24); ctx.quadraticCurveTo(0,-29,side ? 12 : 16,-24);
      ctx.lineTo(side ? 13 : 17,-7); ctx.quadraticCurveTo(9,-8,6,-13);
      ctx.lineTo(-5,-13); ctx.quadraticCurveTo(-10,-7,side ? -12 : -17,-7);
    },robotMetal(ctx,true));
    line(ctx, () => { ctx.moveTo(-7,-1); ctx.quadraticCurveTo(0,1,7,-1); }, '#b5dbe0', 2);
    return;
  }
  // Wide metal cabinet, neck bearing, inset instruments and ribbed lower panel.
  shape(ctx, () => roundBox(ctx,-7,-34,15,9,2),'#637c87');
  line(ctx, () => { ctx.moveTo(-6,-31); ctx.lineTo(7,-31); }, '#c5d4d7', 2);
  const left = side ? -14 : -21, width = side ? 30 : 43;
  shape(ctx, () => roundBox(ctx,left,-27,width,33,4),robotMetal(ctx));
  shape(ctx, () => roundBox(ctx,side ? 2 : -10,-23,side ? 11 : 22,19,2),'#45616f');
  shape(ctx, () => roundBox(ctx,side ? 5 : -6,-19,side ? 5 : 14,6,1),'#aac7c0');
  shape(ctx, () => roundBox(ctx,side ? 5 : -6,-10,side ? 5 : 14,4,1),'#c69550');
  for (const y of [-1,3]) line(ctx, () => { ctx.moveTo(left+4,y); ctx.lineTo(left+width-4,y); }, '#657f8b',1.5);
  for (const y of [-20,-14,-8]) oval(ctx,left+4,y,1.3,1.3,'#516c79',false);
}

// ── Humanoids ────────────────────────────────────────────────────────────────

interface Outfit {
  style: Style;
  skin: string;
  sleeve: string;
  hand: string;
  nearHand: string;
  trousers: string;
  shoe: string;
  metal: boolean;
  robot?: 'retro' | 'round';
}

function outfit(type: string): Outfit {
  if (type === 'spaceman') {
    return { style: 'hop', skin: '#b77c54', sleeve: PAPER, hand: '#ddd3bd', nearHand: '#ddd3bd',
      trousers: '#ece3cf', shoe: '#8a979c', metal: false };
  }
  if (type === 'robot' || type === 'icerobot') {
    const round = type === 'icerobot', metal = round ? ROUND_SHELL : RETRO_METAL;
    return { style: round ? 'shuffle' : 'march', skin: metal, sleeve: metal, hand: round ? '#344951' : metal, nearHand: metal,
      trousers: metal, shoe: round ? ROUND_SHELL : '#8298a5', metal: true, robot: round ? 'round' : 'retro' };
  }
  if (type === 'worker') {
    return { style: 'stroll', skin: '#edb982', sleeve: CREAM, hand: '#edb982', nearHand: '#edb982',
      trousers: '#50778b', shoe: '#6b4d36', metal: false };
  }
  return { style: 'stroll', skin: '#edb982', sleeve: CREAM, hand: '#edb982', nearHand: PAPER,
    trousers: '#b99b6a', shoe: PAPER, metal: false };
}

/** The body seen side-on, chest forward, for walking and running. */
function sideTorso(ctx: Ctx, type: string) {
  if (type === 'spaceman') {
    shape(ctx, () => roundBox(ctx, -22, -34, 13, 31, 6), '#b7ab91');
    shape(ctx, () => roundBox(ctx, -13, -31, 28, 35, 10), PAPER);
    shape(ctx, () => roundBox(ctx, 5, -24, 10, 14, 3), '#d6c6a5');
    shape(ctx, () => roundBox(ctx, 7.5, -21.5, 5, 5, 1), '#e39a5e');
    line(ctx, () => { ctx.moveTo(7, -12.5); ctx.lineTo(13, -12.5); }, '#cf7c46', 2);
    shape(ctx, () => roundBox(ctx, -12, 0, 27, 5, 2.5), '#96aab1');
    return;
  }
  if (type === 'robot' || type === 'icerobot') {
    robotTorso(ctx,type==='icerobot',true);
    return;
  }
  const worker = type === 'worker';
  const body = () => roundBox(ctx, -13, -31, 28, 35, 10);
  shape(ctx, body, worker ? '#50778b' : GREEN);
  within(ctx, body, () => {
    oval(ctx, -8, 6, 24, 9, 'rgba(24,45,40,.2)', false);
    if (worker) {
      shape(ctx, () => roundBox(ctx, -16, -12, 34, 6, 1), '#f0b24d', false);
      shape(ctx, () => roundBox(ctx, 4, -28, 10, 13, 3), '#5f8aa0');
      line(ctx, () => { ctx.moveTo(8, -28); ctx.lineTo(5, -31); }, '#3d6072', 2.4);
    } else {
      ctx.save(); ctx.globalAlpha = .34;
      line(ctx, () => { ctx.moveTo(-7, -11); ctx.lineTo(1, -21); ctx.lineTo(9, -11); ctx.lineTo(1, -1); ctx.closePath(); }, INK, 1.1);
      ctx.restore();
    }
  });
  if (!worker) shape(ctx, () => { ctx.moveTo(-5, -31); ctx.lineTo(10, -31); ctx.lineTo(14, -25); ctx.lineTo(8, -27.5); ctx.lineTo(-3, -28); }, PAPER);
}

function torso(ctx: Ctx, type: string) {
  if (type === 'spaceman') {
    shape(ctx, () => roundBox(ctx, -24, -34, 15, 31, 6), '#b7ab91');
    shape(ctx, () => roundBox(ctx, -17, -31, 36, 35, 11), PAPER);
    shape(ctx, () => roundBox(ctx, -4, -24, 21, 14, 3), '#d6c6a5');
    shape(ctx, () => roundBox(ctx, 0, -21, 5.5, 5.5, 1), '#698b98');
    shape(ctx, () => roundBox(ctx, 9, -21, 5.5, 5.5, 1), '#e39a5e');
    line(ctx, () => { ctx.moveTo(1, -12.5); ctx.lineTo(14, -12.5); }, '#cf7c46', 2);
    shape(ctx, () => roundBox(ctx, -16, 0, 34, 5, 2.5), '#96aab1');
    return;
  }
  if (type === 'robot' || type === 'icerobot') {
    robotTorso(ctx,type==='icerobot',false);
    return;
  }
  const worker = type === 'worker';
  const body = () => roundBox(ctx, -17, -31, 36, 35, 11);
  shape(ctx, body, worker ? '#50778b' : GREEN);
  within(ctx, body, () => {
    oval(ctx, -10, 6, 26, 9, 'rgba(24,45,40,.2)', false);
    if (worker) {
      shape(ctx, () => roundBox(ctx, -20, -12, 42, 6, 1), '#f0b24d', false);
      shape(ctx, () => roundBox(ctx, -3, -28, 17, 13, 3), '#5f8aa0');
      line(ctx, () => { ctx.moveTo(-3, -28); ctx.lineTo(-10, -31); ctx.moveTo(14, -28); ctx.lineTo(17, -31); }, '#3d6072', 2.4);
    } else {
      ctx.save(); ctx.globalAlpha = .34;
      line(ctx, () => {
        ctx.moveTo(-12, -11); ctx.lineTo(-4, -21); ctx.lineTo(4, -11); ctx.lineTo(-4, -1); ctx.closePath();
        ctx.moveTo(4, -11); ctx.lineTo(12, -21); ctx.lineTo(20, -11); ctx.lineTo(12, -1); ctx.closePath();
      }, INK, 1.1);
      ctx.restore();
    }
  });
  if (!worker) shape(ctx, () => { ctx.moveTo(-6, -30); ctx.lineTo(4, -20); ctx.lineTo(15, -30); ctx.lineTo(10, -32); ctx.lineTo(4, -26); ctx.lineTo(-1, -32); }, PAPER);
}

function leg(ctx: Ctx, o: Outfit, hip: Point, foot: Point, footTilt: number, near: boolean, frontal: boolean, knee?: Point) {
  const ankle = at(foot.x, foot.y - 4);
  if (o.robot === 'round') {
    const bend = knee || (frontal ? at(lerp(hip.x,ankle.x,.5),lerp(hip.y,ankle.y,.5)) : joint(hip,ankle,12,12,-1));
    const shell = near ? ROUND_SHELL : '#c6d7d7';
    limb(ctx,[hip,bend],[6.4,5.3],shell);
    oval(ctx,bend.x,bend.y,4.8,4.5,'#344951');
    limb(ctx,[add(bend,0,2),ankle],[5.2,4.2],shell);
    ctx.save(); ctx.translate(ankle.x+(frontal ? near ? 1 : -1 : 3),ankle.y+1.5); ctx.rotate(footTilt);
    oval(ctx,0,0,frontal ? 8 : 10,5,shell);
    line(ctx,()=>{ctx.moveTo(-6,2);ctx.quadraticCurveTo(0,4,6,2);},'#95afb4',1.1);
    ctx.restore(); return;
  }
  if (o.metal) {
    // Telescopic piston legs keep a robot's march stiff and mechanical.
    limb(ctx, [hip, ankle], [5.6, 5], near ? o.trousers : '#8da2ad');
    const mid = at(lerp(hip.x, ankle.x, .5), lerp(hip.y, ankle.y, .5));
    oval(ctx, mid.x, mid.y, 6.2, 3.2, '#5d6f73');
    line(ctx,()=>{ctx.moveTo(mid.x-3,mid.y+5);ctx.lineTo(ankle.x-2,ankle.y-3);},'#e0e7e2',1.2);
    ctx.save(); ctx.translate(ankle.x + (frontal ? (near ? 1 : -1) : 3), ankle.y + 2); ctx.rotate(footTilt);
    shape(ctx, () => roundBox(ctx, frontal ? -8 : -10, -4, frontal ? 16 : 21, 8, 3), o.shoe);
    ctx.restore();
    return;
  }
  // A forward-pointing knee is foreshortened in a front view. Using the
  // walking IK here bends both legs sideways and makes the hips look reversed.
  const bend = knee || (frontal
    ? at(lerp(hip.x, ankle.x, .52), lerp(hip.y, ankle.y, .52))
    : joint(hip, ankle, 15, 14.5, -1));
  limb(ctx, [hip, bend, ankle], [5.8, 5.1, 4.5], near ? o.trousers : shadeOf(o.trousers));
  ctx.save(); ctx.translate(ankle.x + (frontal ? (near ? 1.5 : -1.5) : 4), ankle.y + 1.8); ctx.rotate(footTilt);
  oval(ctx, 0, 0, frontal ? 7.5 : o.style === 'hop' ? 9.5 : 8.6, frontal ? 5.2 : o.style === 'hop' ? 5 : 4.3, o.shoe);
  if (o.shoe === PAPER) line(ctx, () => { ctx.moveTo(-5, -1); ctx.lineTo(1, -1); }, '#9aa39c', 1.2);
  ctx.restore();
}

function shadeOf(colour: string) {
  const value = parseInt(colour.slice(1), 16);
  const r = (value >> 16) & 255, g = (value >> 8) & 255, b = value & 255;
  return `rgb(${Math.round(r * .84)},${Math.round(g * .84)},${Math.round(b * .86)})`;
}

const UPPER_ARM = 12.5, FOREARM = 12;

/** Keep a posed hand within arm's length, so arms never stretch. */
function reach(shoulder: Point, hand: Point, max = UPPER_ARM + FOREARM - .6) {
  const dx = hand.x - shoulder.x, dy = hand.y - shoulder.y, d = Math.hypot(dx, dy);
  return d <= max || d < 1e-6 ? hand : at(shoulder.x + dx / d * max, shoulder.y + dy / d * max);
}

function arm(ctx: Ctx, o: Outfit, shoulder: Point, hand: Point, near: boolean, frontal: boolean) {
  const colour = near ? o.sleeve : shadeOf(o.sleeve);
  if (o.metal) {
    const round = o.robot==='round', upper = round ? 15 : UPPER_ARM, lower = round ? 14 : FOREARM;
    const a=joint(shoulder,hand,upper,lower,1), b=joint(shoulder,hand,upper,lower,-1);
    const elbow = frontal ? (near ? a.x>b.x ? a : b : a.x<b.x ? a : b) : a;
    oval(ctx,shoulder.x,shoulder.y,round ? 5 : 6,round ? 5 : 6.5,round ? '#344951' : '#7a919e');
    limb(ctx,[shoulder,elbow],[round ? 5 : 4.5,4],colour);
    oval(ctx,elbow.x,elbow.y,4,4,round ? '#344951' : '#637d89');
    limb(ctx,[add(elbow,0,1),hand],[round ? 4.6 : 3.9,3.2],colour);
    oval(ctx,hand.x,hand.y,round ? 4 : 4.6,4.6,o.hand);
    for (const dx of [-1.5,1.5]) line(ctx,()=>{ctx.moveTo(hand.x+dx,hand.y+1);ctx.lineTo(hand.x+dx,hand.y+4);},round ? '#819b9d' : '#5e7682',.9);
    return;
  }
  // Choose the outside of the arm's bend geometrically. A fixed IK sign
  // flips the elbow inward as soon as the hand rises above the shoulder.
  const a = joint(shoulder, hand, UPPER_ARM, FOREARM, 1);
  const b = joint(shoulder, hand, UPPER_ARM, FOREARM, -1);
  const elbow = frontal ? (near ? (a.x > b.x ? a : b) : (a.x < b.x ? a : b)) : a;
  limb(ctx, [shoulder, elbow, hand], [4.8, 4.2, 3.8], colour);
  if (o.style === 'hop') oval(ctx, hand.x, hand.y, 5.4, 5.8, near ? o.nearHand : shadeOf('#ddd3bd'));
  else oval(ctx, hand.x, hand.y, 4.7, 5.2, near ? o.nearHand : o.hand);
}

interface Cues {
  type: string;
  state: string;
  reaction?: CrewReaction;
  startled: boolean;
  seated: boolean;
  t: number;
  worker: boolean;
  golfer: boolean;
  aim?: WatchAim;
  gaze?: WatchAim;
  business?: SillyAction;
}

function humanoid(ctx: Ctx, outfit: Outfit, m: Motion, face: Face, c: Cues) {
  const { t, state } = c;
  // One orientation for the entire rig: walk/work in profile, pause facing
  // the viewer. Clothing must never choose a different facing from the head.
  const side = m.moving || state === 'screwing' || state === 'inspecting' || !!c.gaze?.yaw || c.business?.kind==='paper-plane';
  const frontal = !side;
  const o = outfit;
  const roundRobot = o.robot==='round', hipSpread = roundRobot ? 6 : 8;
  const nearHip = world(m, side ? at(1, 0) : at(hipSpread, 0)), farHip = world(m, side ? at(-2, 0) : at(-hipSpread, 0));
  const shoulderN = world(m, roundRobot ? side ? c.aim ? at(8,-25) : at(2,-20) : at(13,-20) : side ? c.aim ? at(7, -28) : at(2, -24) : at(17, -23));
  const shoulderF = world(m, roundRobot ? side ? c.aim ? at(3,-25) : at(-2,-21) : at(-13,-20) : side ? c.aim ? at(3, -29) : at(-1, -25) : at(-16, -23));
  const stationaryProp = c.business ? null : c.aim ? 'apex' : !m.moving && !c.startled && !c.seated && c.reaction && c.reaction !== 'coast' ? c.reaction : null;
  const golferCheer = c.golfer && stationaryProp === 'impact';
  const headCentre = at(roundRobot ? side ? 6 : 0 : side ? 3 : 1,
    roundRobot ? c.aim && side ? -40 : -48 : o.robot==='retro' ? c.aim && side ? -44 : -49 : c.aim && side ? -42 : -46);
  const eyeX = side ? roundRobot ? 21 : o.metal ? 12.5 : c.type === 'spaceman' ? 14 : 11.5
    : roundRobot ? 0 : o.metal ? .5 : c.type === 'spaceman' ? 7.2 : 2.25;
  const eyeY = roundRobot ? 5 : -1;
  const headPoint = (p: Point) => {
    const r = rotated(p, face.tilt);
    return world(m, add(headCentre, r.x, r.y));
  };

  // Feet: planted on the ground while in stance, lifting through the swing.
  const footAt = (hip: Point, f: Footfall) => at(hip.x + f.x - m.shake, f.y + m.footLift);
  let nearFoot = footAt(nearHip, m.near), farFoot = footAt(farHip, m.far);
  let nearKnee: Point | undefined, farKnee: Point | undefined;
  if (c.seated) {
    nearKnee = at(nearHip.x + 3, nearHip.y + 6); farKnee = at(farHip.x - 3, farHip.y + 6);
    nearFoot = at(nearKnee.x + 2, 0); farFoot = at(farKnee.x - 2, 0);
  } else if (state === 'screwing') {
    nearKnee = at(nearHip.x + 13, -6); nearFoot = at(nearHip.x + 6, 0);
    farFoot = at(farHip.x - 12, 0);
  }
  const tilt = (f: Footfall) => f.planted ? 0 : -Math.sin(Math.PI * f.swing) * .35 + (f.swing > .85 ? .12 : 0);

  // Hands: swinging against the legs, pumping when running, or posed.
  const swing = m.swing;
  let nearHand: Point, farHand: Point;
  if (m.running && state !== 'carrying') {
    nearHand = add(shoulderN, swing * (frontal ? 9 : 13) + 5, 11 - Math.abs(swing) * 4);
    farHand = add(shoulderF, -swing * (frontal ? 9 : 13) + (frontal ? -3 : 5), 11 - Math.abs(swing) * 4);
  } else if (frontal) {
    // Arms hang at the sides and swing a little with the stride.
    nearHand = add(shoulderN, o.metal ? roundRobot ? 1 : 2 : swing * 6 + 7, o.metal ? roundRobot ? 28 : 23 : 20);
    farHand = add(shoulderF, o.metal ? roundRobot ? -1 : -2 : -swing * 6 - 6, o.metal ? roundRobot ? 28 : 23 : 20);
  } else {
    nearHand = add(shoulderN, swing * 9 + 2, 21);
    farHand = add(shoulderF, -swing * 9 + 1, 21);
  }
  // The club is either in the near hand at an angle, or resting on its own.
  let clubHeld = false, clubAngle = 0, clubRest: Point | null = null, clubBehind = false;
  const toGround = (grip: Point, back = false, clearance = 1.5) => {
    const tip = Math.asin(clamp((-clearance - grip.y) / 38, -1, 1));
    return back ? Math.PI - tip : tip;
  };
  let waggle = 0, waggleK = 0;
  if (c.business) {
    if(c.business.kind==='umbrella'){
      nearHand=world(m,at(23,-25));farHand=world(m,at(-22,-3));
    }else if(c.business.kind==='paper-plane'){
      const toss=clamp((t-2)/.5);
      nearHand=world(m,at(lerp(12,29,toss),lerp(-32,-28,toss)));
      farHand=world(m,at(8,-12));
    }else{
      nearHand=world(m,at(17,-16));farHand=world(m,at(-15,-16));
    }
  } else if (c.startled && t > .06) {
    const flail = Math.sin(t * 22) * 3;
    nearHand = world(m, at(30, -34 + flail)); farHand = world(m, at(-22, -44 - flail));
    if (c.golfer) { clubHeld = true; clubAngle = -1.3 + Math.sin(t * 18) * .15; }
  } else if (state === 'celebrating') {
    const wave = Math.sin(t * 9) * 4;
    nearHand = world(m, at(27, -40 + wave)); farHand = world(m, at(-20, -44 - wave));
  } else if (state === 'panicked') {
    nearHand = world(m, at(25 + Math.cos(t * 11) * 5, -34 + Math.sin(t * 11) * 5));
    farHand = world(m, at(-19 + Math.cos(t * 11 + 2) * 5, -42 + Math.sin(t * 11 + 2) * 5));
  } else if (state === 'carrying') {
    nearHand = world(m, at(21, -9)); farHand = world(m, at(9, -6));
  } else if (state === 'screwing') {
    const turn = Math.sin(t * 8) * .4;
    nearHand = at(28 + 10 * Math.cos(turn) + 20 * Math.sin(turn), -37 + 10 * Math.sin(turn) - 20 * Math.cos(turn));
    farHand = add(nearKnee || nearHip, -2, -3);
  } else if (c.seated) {
    nearHand = add(nearKnee!, -2, -3); farHand = add(farKnee!, -3, -3);
    if (c.golfer) clubRest = at(22, -38);
  } else if (golferCheer) {
    // Triumph: the club held straight up overhead.
    nearHand = world(m, at(32, -34 + Math.sin(t * 6) * 2)); farHand = world(m, at(-21, -44));
    clubHeld = true; clubAngle = -1.6 + Math.sin(t * 6) * .12;
  } else if (stationaryProp === 'apex') {
    const grip = roundRobot ? 14 : 10;
    nearHand = headPoint(at(side ? eyeX - 1 : eyeX + grip, eyeY+(side ? 11 : 9)));
    farHand = headPoint(at(side ? eyeX - 4 : eyeX - grip, eyeY+9));
  } else if (stationaryProp) {
    nearHand = world(m, at(19, -12));
    if (!c.golfer) farHand = world(m, at(-11, -3));
  } else if (c.golfer && m.running) {
    // Fleeing with the club waved overhead: still one straight, rigid club.
    nearHand = world(m, at(28, -38 + Math.sin(m.cycle) * 3));
    clubHeld = true; clubAngle = -1.2 + Math.sin(m.cycle) * .3;
  } else if (c.golfer && m.moving) {
    // Walking between shots: the club carried at his side, head clear of the ground.
    clubHeld = true; clubAngle = toGround(reach(shoulderN, nearHand), false, 9);
  } else if (c.golfer) {
    // Idle: standing square with the club grounded beside him, and a small
    // practice waggle now and then.
    waggleK = ((t + 4) % 9) / 1.8;
    waggle = waggleK < 1 ? Math.sin(Math.PI * waggleK) : 0;
    nearHand = world(m, at(23, -6 - waggle * 3)); farHand = world(m, at(-21, -4));
  }
  if (c.golfer && stationaryProp && !c.aim && !golferCheer) { clubRest = world(m, at(-13, -8)); clubBehind = true; }
  nearHand = reach(shoulderN, nearHand,roundRobot ? 28.5 : UPPER_ARM+FOREARM-.6);
  farHand = reach(shoulderF, farHand,roundRobot ? 28.5 : UPPER_ARM+FOREARM-.6);
  if (c.golfer && !c.business && !c.aim && !clubHeld && !clubRest && !m.moving) {
    clubHeld = true;
    clubAngle = toGround(nearHand) - waggle * (.35 + Math.sin(waggleK * TAU * 1.5) * .25);
  }
  if (clubRest) clubAngle = toGround(clubRest, clubBehind);
  const clubGrip = clubHeld ? nearHand : clubRest;

  const shadowScale = clamp(1 + (m.hipY + 30) / 60, .55, 1.05);
  groundShadow(ctx, 0, 26 * shadowScale);
  if (m.running) speedLines(ctx, -24, -70 - (m.hipY + 30) * .4, 28, t);
  footDust(ctx, m, farHip.x, m.far, 6);
  footDust(ctx, m, nearHip.x, m.near, 7);

  if (side) arm(ctx, o, shoulderF, farHand, false, frontal);
  leg(ctx, o, farHip, farFoot, tilt(m.far), false, frontal, farKnee);
  if (clubGrip && clubBehind) club(ctx, clubGrip, clubAngle);
  leg(ctx, o, nearHip, nearFoot, tilt(m.near), true, frontal, nearKnee);
  inBody(ctx, m, () => {
    if (side) sideTorso(ctx, c.type);
    else torso(ctx, c.type);
    ctx.save();
    const headBob = m.moving ? Math.cos(m.cycle * 2 - .6) * (m.running ? .5 : .3) : 0;
    ctx.translate(headCentre.x, headCentre.y + headBob);
    ctx.rotate(face.tilt);
    const capLift = c.startled ? Math.sin(Math.min(1, t / .9) * Math.PI) * 9 : 0;
    if (c.type === 'spaceman') spacemanHead(ctx, face, t, side);
    else if (roundRobot) roundRobotHead(ctx,face,side);
    else if (o.metal) retroRobotHead(ctx,face,side);
    else if (side) golferSideHead(ctx, face, c.worker, capLift);
    else golferHead(ctx, face, c.worker, capLift);
    if (c.aim) {
      ctx.translate(eyeX, eyeY);
      viewingDevice(ctx, side, false, roundRobot ? 14 : o.metal ? 9.5 : c.type === 'spaceman' ? 5 : 7.25);
    }
    ctx.restore();
  });
  if (frontal) arm(ctx, o, shoulderF, farHand, false, frontal);
  if (stationaryProp && stationaryProp !== 'apex' && !golferCheer) prop(ctx, stationaryProp, nearHand, t);
  if (clubGrip && !clubBehind) club(ctx, clubGrip, clubAngle);
  if (state === 'carrying') {
    // A new barrel section, hugged in front at a run.
    const mid = at((nearHand.x + farHand.x) / 2 + 8, (nearHand.y + farHand.y) / 2 - 5);
    ctx.save(); ctx.translate(mid.x, mid.y); ctx.rotate(m.lean * .5);
    shape(ctx, () => roundBox(ctx, -34, -6.5, 66, 13, 5), '#3c6070');
    shape(ctx, () => roundBox(ctx, -28, -6.5, 5, 13, 1), '#e9bd6b', false);
    shape(ctx, () => roundBox(ctx, 20, -6.5, 5, 13, 1), '#e9bd6b', false);
    line(ctx, () => { ctx.moveTo(-30, -3); ctx.lineTo(28, -3); }, 'rgba(210,230,235,.35)', 2);
    ctx.restore();
  } else if (state === 'screwing') {
    // The spanner turns on the barrel's bolt.
    const turn = Math.sin(t * 8) * .4;
    ctx.save(); ctx.translate(28, -37); ctx.rotate(turn);
    line(ctx, () => { ctx.moveTo(0, 0); ctx.lineTo(10, -20); }, INK, 4.6);
    line(ctx, () => { ctx.moveTo(0, 0); ctx.lineTo(10, -20); }, '#9fb0b3', 2.4);
    shape(ctx, () => { ctx.arc(0, 0, 4.2, -.5, 4.9); ctx.lineTo(0, 0); }, '#9fb0b3');
    ctx.restore();
  }
  arm(ctx, o, shoulderN, nearHand, true, frontal);
  if(c.business)drawBusinessProp(ctx,c.business.kind,t,nearHand,farHand);
  if (c.startled) surprise(ctx, 30, -100 + (m.hipY + 30), 12, t);
  if (state === 'panicked') {
    const drop = (t * 1.6) % 1;
    oval(ctx, 26 + drop * 6, -92 + drop * 10, 2.2, 3, 'rgba(160,210,230,.9)');
  }
}

// ── The alien ───────────────────────────────────────────────────────────────

function alien(ctx: Ctx, m: Motion, face: Face, c: Cues) {
  const { t } = c;
  const skin = '#a5b954';
  const stationaryProp = c.business ? null : c.aim ? 'apex' : !m.moving && !c.startled && !c.seated && c.reaction && c.reaction !== 'coast' ? c.reaction : null;
  // A pear on little boots: it rocks over each planted foot as it waddles.
  const rock = m.moving ? Math.sin(m.cycle) * (m.running ? .045 : .05) : Math.sin(t * 1.6) * .01;
  const squash = m.moving ? 1 + Math.cos(m.cycle * 2) * .014 : 1 + Math.sin(t * 2.1) * .006;
  const lift = m.hipY + 30 + (c.seated ? -22 : 0);
  groundShadow(ctx, 0, 30 * clamp(1 + (m.hipY + 30) / 60, .55, 1.05));
  // On the move it is seen side-on: feet together, the eye out on its front.
  const side = m.moving || c.state === 'inspecting' || !!c.gaze?.yaw;
  const scopeEye = at(side ? 21 : 9, -62);
  const scopePoint = (p: Point) => {
    const r = rotated(p, face.tilt);
    return add(scopeEye, r.x, r.y);
  };
  const footX = side ? 3 : 9;
  if (m.running) speedLines(ctx, -30, -66, 30, t);
  footDust(ctx, m, -footX, m.far, 6); footDust(ctx, m, footX, m.near, 6);
  const boot = (x: number, f: Footfall, colour: string) => {
    const y = c.seated ? -12 : f.y + m.footLift;
    ctx.save(); ctx.translate(x + f.x, y - 4); ctx.rotate(f.planted ? 0 : -Math.sin(Math.PI * f.swing) * .3);
    oval(ctx, 2, 0, 10, 5, colour);
    ctx.restore();
  };
  boot(-footX, c.seated ? stand(5) : m.far, '#879d43');
  ctx.save();
  ctx.translate(m.shake, lift - 8);
  ctx.rotate(rock + m.lean * .6);
  ctx.scale(1 / Math.sqrt(squash), squash);
  ctx.translate(0, 8);
  // Antennae spring behind the bounce.
  const lag = m.moving ? Math.sin(m.cycle * 2 - 1) * 2.5 : Math.sin(t * 2) * 1.5;
  const antennae = side
    ? [[at(-6, -84), at(-14 - lag * .6, -99 + lag * .8)], [at(5, -84), at(-2 - lag * .6, -100 + lag)]] as const
    : [[at(-12, -80), at(-19 - lag * .6, -96 + lag)], [at(13, -80), at(19 - lag * .6, -97 + lag * .8)]] as const;
  for (const [root, tip] of antennae) {
    line(ctx, () => { ctx.moveTo(root.x, root.y); ctx.quadraticCurveTo(root.x, tip.y + 6, tip.x, tip.y); }, INK, 5);
    line(ctx, () => { ctx.moveTo(root.x, root.y); ctx.quadraticCurveTo(root.x, tip.y + 6, tip.x, tip.y); }, skin, 2.6);
    oval(ctx, tip.x, tip.y, 4.8, 5, '#c2ce70');
  }
  // Only a profile hides the far shoulder behind the pear.
  const farShoulder = side ? at(-2, -42) : at(-25, -40), nearShoulder = side ? at(7, -40) : at(28, -38);
  const swing = m.swing;
  let farHand = add(farShoulder, -swing * (side ? 10 : 7) - 4, 15), nearHand = add(nearShoulder, swing * (side ? 10 : 7) + 4, 15);
  if(c.business){farHand=at(-22,-41);nearHand=at(32,-41);}
  else if (c.startled && t > .06) { farHand = add(farShoulder, -10, -20); nearHand = add(nearShoulder, 10, -21 + Math.sin(t * 22) * 3); }
  else if (stationaryProp === 'apex') {
    nearHand = scopePoint(side ? at(4, 10) : at(13, 5));
    farHand = scopePoint(side ? at(1, 8) : at(-13, 5));
  }
  else if (stationaryProp) nearHand = at(30, -40);
  const farArm = () => {
    limb(ctx, [farShoulder, farHand], [3.6, 3.2], '#8fa446');
    oval(ctx, farHand.x, farHand.y, 5, 5, '#8fa446');
  };
  if (side) farArm();
  const body = () => {
    ctx.moveTo(0, -88);
    ctx.bezierCurveTo(-37, -88, -40, -49, -32, -24);
    ctx.bezierCurveTo(-26, -4, 24, -2, 33, -26);
    ctx.bezierCurveTo(43, -52, 31, -87, 0, -88);
  };
  shape(ctx, body, skin);
  within(ctx, body, () => {
    oval(ctx, -10, -6, 36, 13, 'rgba(84,110,40,.28)', false);
    oval(ctx, -14, -74, 9, 5, 'rgba(230,240,180,.45)', false);
    ctx.save(); ctx.globalAlpha = .5;
    [[-24, -64, 3, 5], [-28, -44, 4, 6], [-19, -24, 3, 3], [27, -33, 4, 5], [23, -70, 3, 3]].forEach(([x, y, rx, ry]) => oval(ctx, x, y, rx, ry, '#718c43', false));
    ctx.restore();
  });
  if (!side) farArm();
  if (side) {
    ctx.save(); ctx.translate(21, -62); ctx.scale(.64, 1);
    eye(ctx, 0, 0, 17, { look: face.look, open: face.open, wide: face.wide, iris: '#3f7d74', lid: skin });
    ctx.restore();
    mouth(ctx, 26, -34, 6, face.mood);
  } else {
    eye(ctx, 9, -62, 18, { look: face.look, open: face.open, wide: face.wide, iris: '#3f7d74', lid: skin });
    mouth(ctx, 9, -34, 9, face.mood);
  }
  // The near arm, in front, carries any prop and rocks with the body.
  if (c.aim) {
    ctx.save(); ctx.translate(scopeEye.x, scopeEye.y); ctx.rotate(face.tilt);
    viewingDevice(ctx, side, true); ctx.restore();
  } else if (stationaryProp) prop(ctx, stationaryProp, nearHand, t);
  limb(ctx, [add(nearShoulder, -2, 0), nearHand], [3.8, 3.4], skin);
  oval(ctx, nearHand.x, nearHand.y, 5.6, 5.6, skin);
  if(c.business)drawBusinessProp(ctx,c.business.kind,t,nearHand,farHand);
  ctx.restore();
  boot(footX, c.seated ? stand(13) : m.near, '#a6b954');
  if (c.startled) surprise(ctx, 34, -104 + lift, 12, t);
}

// ── Squashed ────────────────────────────────────────────────────────────────

function squashed(ctx: Ctx, type: string, t: number) {
  groundShadow(ctx, 0, 34);
  const o = outfit(type);
  const wobble = 1 + Math.sin(t * 7) * .04 * Math.max(0, 1 - t / 2);
  ctx.save(); ctx.scale(wobble, 1 / wobble);
  if (type === 'alien') {
    oval(ctx, 0, -5, 34, 7, '#a5b954');
    oval(ctx, 6, -8, 13, 4.5, PAPER);
    line(ctx, () => { ctx.moveTo(1, -10); ctx.lineTo(11, -6); ctx.moveTo(11, -10); ctx.lineTo(1, -6); }, INK, 1.8);
  } else if (o.metal) {
    const round = o.robot==='round';
    oval(ctx,-24,-2.5,10,4,o.shoe); oval(ctx,29,-2.5,10,4,o.shoe);
    oval(ctx,-2,-4,27,5.5,o.trousers);
    if (round) {
      oval(ctx,7,-12,24,10,robotMetal(ctx,true));
      line(ctx,()=>{ctx.moveTo(-14,-9);ctx.quadraticCurveTo(7,-12,28,-9);},'#344951',1.4);
    } else shape(ctx,()=>roundBox(ctx,-11,-16,39,11,2),robotMetal(ctx));
    for (const x of [0,14]) line(ctx,()=>{ctx.moveTo(x-2,-12);ctx.lineTo(x+2,-8);ctx.moveTo(x+2,-12);ctx.lineTo(x-2,-8);},round ? ROUND_EYE : RETRO_EYE,1.6);
  } else {
    oval(ctx, -26, -2.5, 10, 4, o.shoe);
    oval(ctx, 30, -2.5, 10, 4, o.shoe);
    const body = type === 'spaceman' ? PAPER : type === 'worker' ? '#50778b' : GREEN;
    oval(ctx, -2, -5, 27, 6.5, body);
    oval(ctx, 8, -9, 20, 6.5, type === 'spaceman' ? '#3b5366' : o.skin);
    for (const x of [2, 14]) {
      line(ctx, () => { ctx.moveTo(x - 2.5, -11); ctx.lineTo(x + 2.5, -7.5); ctx.moveTo(x + 2.5, -11); ctx.lineTo(x - 2.5, -7.5); },
        type === 'spaceman' ? PAPER : INK, 1.6);
    }
    if (type === 'golfer' || type === 'worker') {
      oval(ctx, 10, -15, 17, 3.5, type === 'worker' ? GOLD : GREEN);
    }
  }
  ctx.restore();
  if (type === 'golfer') club(ctx, at(40, -3), .02, -1);
  dizzy(ctx, 6, -28, 16, t);
}

/** Draw at (x, footY), height in CSS pixels. No state or physics mutation. */
export function drawCrew(ctx: CanvasRenderingContext2D, x: number, footY: number, height: number, pose: CrewPose) {
  const t = pose.business ? businessTime(pose) : pose.reducedMotion ? 0 : finite(pose.stateTimer);
  const state = pose.state || 'idle';
  const reaction = pose.reaction;
  const startled = state === 'startled' || state === 'rocket_startled';
  const type = pose.type;
  const o = type === 'alien' ? outfit('golfer') : outfit(type);
  const style: Style = type === 'alien' ? 'waddle' : o.style;
  const speed = finite(pose.speed, type === 'worker' ? 2.2 : 1.1);
  const moving = ['walking', 'returning', 'running_away', 'running_to', 'carrying'].includes(state);
  const aim = observationAim(pose);
  const gaze=aim||gazeAim(pose);
  const dir = gaze ? gaze.yaw < 0 ? -1 : 1 : pose.direction === -1 ? -1 : 1;
  const seated = !gaze && reaction === 'coast' && !moving && !startled && state === 'idle';

  ctx.save();
  ctx.translate(x, footY);
  ctx.scale(height / 100, height / 100);
  ctx.scale(dir, 1);
  pen(ctx, 2);

  if (state === 'squashed') { squashed(ctx, type, t); ctx.restore(); return; }

  let m = motion(style, state, t, speed, startled);
  if (state === 'celebrating') {
    const hop = Math.abs(Math.sin(t * 6));
    m = { ...m, hipY: -30 - hop * 5, footLift: -hop * 4 };
  } else if (state === 'panicked') {
    // Feet pattering on the spot.
    const patter = footfall(t * 4.5, 6, 4, .5), other = footfall(t * 4.5 + .5, 6, 4, .5);
    m = { ...m, near: { ...patter, x: patter.x + 6 }, far: { ...other, x: other.x - 5 }, hipY: -30 - Math.abs(Math.sin(t * 9)) * .7 };
  } else if (state === 'screwing') {
    m = { ...m, hipY: -25, lean: .22 };
  } else if (state === 'carrying') {
    m = { ...m, lean: .05 };
  } else if (state === 'inspecting') {
    m = { ...m, lean: .16, hipY: m.hipY + 2 };
  }
  if (o.robot==='round') {
    // Short shins and a small body under the heavy head; low foot clearance
    // makes a weary shuffle, while running still has a clear forward lean.
    m = { ...m, hipY:m.hipY+6, lean:m.lean+(moving ? .045 : 0) };
  }

  const scared = startled || state === 'panicked' || (state === 'running_away');
  const lookUp = reaction === 'apex' && !moving && !startled;
  const face: Face = {
    open: startled ? 1 : seated ? Math.min(blink(t, 3.1), .9) : blink(t, 3.7, type.length * .31),
    look: pose.business ? at(.2,.7) : state === 'inspecting' ? at(.75, .8) : lookUp ? at(.4, -.9) : scared ? at(.9, -.2) : moving ? at(.8, 0) : gaze?.yaw===0 ? at(0,0) : at(.4, 0),
    mood: startled || state === 'panicked' ? 'gasp' : state === 'running_away' ? 'worry'
      : reaction === 'fizzle' ? 'worry' : reaction === 'impact' || state === 'celebrating' ? 'grin' : 'smile',
    wide: scared,
    tilt: state === 'inspecting' ? .32 : gaze ? gaze.yaw ? -clamp(finite(gaze.elevation), -.2, 1.05) : 0 : lookUp ? -.14 : moving ? m.lean * -.4 : pose.business ? .1 : 0,
  };
  const cues: Cues = { type, state, reaction, startled, seated, t, worker: type === 'worker', golfer: type === 'golfer', aim, gaze, business:pose.business };

  if (seated) {
    // A stool only arrives during an uneventful coast; it never holds up a launch.
    line(ctx, () => { ctx.moveTo(-19, -23); ctx.lineTo(15, -2); ctx.moveTo(18, -23); ctx.lineTo(-14, -2); }, INK, 5.3);
    line(ctx, () => { ctx.moveTo(-19, -23); ctx.lineTo(15, -2); ctx.moveTo(18, -23); ctx.lineTo(-14, -2); }, '#b88858', 2.3);
    shape(ctx, () => roundBox(ctx, -22, -29, 43, 8, 3), '#d8a956');
  }
  if (type === 'alien') alien(ctx, m, face, cues);
  else humanoid(ctx, o, m, face, cues);
  ctx.restore();
}
