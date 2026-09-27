/**
 * The shared cartoon kit. Every character is drawn with the same ink, outline
 * weight, eye, limb and gait so they read as one family at any zoom.
 */
export type Ctx = CanvasRenderingContext2D;
export interface Point { x: number; y: number }

export const INK = '#293b43';
export const PAPER = '#fff3d9';
export const GLINT = '#fffdf2';
export const SHADOW = 'rgba(35,48,43,.16)';
export const TAU = Math.PI * 2;

export const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const finite = (value: number | undefined, fallback = 0) => Number.isFinite(value) ? value as number : fallback;
export const at = (x: number, y: number): Point => ({ x, y });
export const add = (p: Point, x: number, y: number): Point => ({ x: p.x + x, y: p.y + y });

/** Every artist starts from the same pen. */
export function pen(ctx: Ctx, width = 2.1) {
  ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
}

export type Fill = string | CanvasGradient;

export function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: Fill, outline = true, rotation = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rotation, 0, TAU);
  ctx.fillStyle = fill; ctx.fill();
  if (outline) { ctx.strokeStyle = INK; ctx.stroke(); }
}

export function shape(ctx: Ctx, path: () => void, fill: Fill, outline = true) {
  ctx.beginPath(); path(); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (outline) { ctx.strokeStyle = INK; ctx.stroke(); }
}

/** A rounded-rectangle path. Unlike `ctx.roundRect`, it leaves no one-point
 * subpath behind, which the closing stroke in `shape` would ink as a dot. */
export function roundBox(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export function line(ctx: Ctx, path: () => void, colour = INK, width = 2) {
  ctx.save(); ctx.beginPath(); path();
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke(); ctx.restore();
}

/** Paint inside an existing silhouette only: shading, bellies and highlights. */
export function within(ctx: Ctx, path: () => void, paint: () => void) {
  ctx.save(); ctx.beginPath(); path(); ctx.closePath(); ctx.clip(); paint(); ctx.restore();
}

export function groundShadow(ctx: Ctx, x: number, rx: number, ry = rx * .12) {
  oval(ctx, x, 1, rx, ry, SHADOW, false);
}

/** Two circles joined by their outer tangents: one tapered limb segment. */
function capsule(ctx: Ctx, a: Point, ra: number, b: Point, rb: number) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  if (d <= Math.abs(ra - rb) + 1e-6) {
    const big = ra >= rb ? a : b, r = Math.max(ra, rb);
    ctx.moveTo(big.x + r, big.y); ctx.arc(big.x, big.y, r, 0, TAU); return;
  }
  const angle = Math.atan2(dy, dx), beta = Math.acos(clamp((ra - rb) / d, -1, 1));
  ctx.moveTo(a.x + ra * Math.cos(angle + beta), a.y + ra * Math.sin(angle + beta));
  ctx.arc(a.x, a.y, ra, angle + beta, angle - beta + TAU);
  ctx.arc(b.x, b.y, rb, angle - beta, angle + beta);
  ctx.closePath();
}

/** A jointed, tapering limb. Outlines go down first and fills on top, so the
 * joints read as one continuous shape rather than a stack of sausages. */
export function limb(ctx: Ctx, points: readonly Point[], radii: readonly number[], fill: Fill, outline = true) {
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i < points.length - 1; i++) capsule(ctx, points[i], radii[i], points[i + 1], radii[i + 1]);
  };
  if (outline) {
    const width = ctx.lineWidth;
    path(); ctx.lineWidth = width * 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = width;
  }
  path(); ctx.fillStyle = fill; ctx.fill();
}

/** Two-bone joint. For a right-facing character, bend -1 puts the joint in
 * front of the hip→foot line (a knee); +1 puts it behind (an elbow). */
export function joint(a: Point, b: Point, upper: number, lower: number, bend: number): Point {
  const dx = b.x - a.x, dy = b.y - a.y;
  const reach = clamp(Math.hypot(dx, dy), Math.abs(upper - lower) + 1e-3, upper + lower - 1e-3);
  const cos = (upper * upper + reach * reach - lower * lower) / (2 * upper * reach);
  const angle = Math.atan2(dy, dx) + bend * Math.acos(clamp(cos, -1, 1));
  return { x: a.x + Math.cos(angle) * upper, y: a.y + Math.sin(angle) * upper };
}

export interface Footfall { x: number; y: number; planted: boolean; swing: number; stance: number }

/** One foot's path relative to its hip for a gait cycle. While planted it slides
 * back at exactly body speed, so it stays put on the ground; then it lifts,
 * arcs forward and plants again. */
export function footfall(phase: number, stride: number, lift: number, duty = .6): Footfall {
  const p = phase - Math.floor(phase);
  if (p < duty) {
    const u = p / duty;
    return { x: stride * (.5 - u), y: 0, planted: true, swing: 0, stance: u };
  }
  const v = (p - duty) / (1 - duty);
  return { x: stride * (smooth(v) - .5), y: -lift * Math.sin(Math.PI * v), planted: false, swing: v, stance: 0 };
}

/** Cycle position for a gait whose planted feet match the ground speed. */
export function gaitPhase(t: number, unitsPerSecond: number, stride: number, duty: number) {
  const period = stride / Math.max(1e-6, duty * unitsPerSecond);
  return t / Math.max(.05, period);
}

/** Eyelid opening: a quick blink every few seconds, open when time is frozen. */
export function blink(t: number, period = 3.9, offset = 0) {
  if (!(t > 0)) return 1;
  const p = (t + offset) % period;
  return p > period - .13 ? .08 : 1;
}

export interface EyeOptions {
  look?: Point;
  open?: number;
  wide?: boolean;
  lid?: string;
  iris?: string;
  bean?: boolean;
}

/** The family eye. Beans for humans and bears; a white eye with iris for
 * creatures whose eyes carry the whole face. Blinks close to a soft arc. */
export function eye(ctx: Ctx, x: number, y: number, size: number, options: EyeOptions = {}) {
  const look = options.look || { x: 0, y: 0 };
  const open = clamp(options.open ?? 1);
  if (open < .3) {
    line(ctx, () => { ctx.moveTo(x - size * .9, y); ctx.quadraticCurveTo(x, y + size * .55, x + size * .9, y); }, INK, Math.max(1.2, size * .42));
    return;
  }
  if (options.bean) {
    const ry = size * (options.wide ? 1.45 : 1.15);
    oval(ctx, x + look.x * size * .25, y + look.y * size * .2, size * .78, ry, INK, false);
    oval(ctx, x + look.x * size * .25 - size * .25, y + look.y * size * .2 - ry * .38, size * .3, size * .34, GLINT, false);
    return;
  }
  const rx = size * (options.wide ? 1.08 : 1), ry = size * (options.wide ? 1.25 : 1.08);
  oval(ctx, x, y, rx, ry, PAPER);
  const pupil = size * (options.wide ? .42 : .56);
  const px = x + look.x * (rx - pupil) * .8, py = y + look.y * (ry - pupil) * .8;
  if (options.iris) oval(ctx, px, py, pupil * 1.32, pupil * 1.38, options.iris, false);
  oval(ctx, px, py, pupil, pupil * 1.08, INK, false);
  oval(ctx, px - pupil * .38, py - pupil * .42, pupil * .38, pupil * .38, GLINT, false);
  if (options.lid && open < 1) {
    within(ctx, () => ctx.ellipse(x, y, rx, ry, 0, 0, TAU), () => {
      const edge = y - ry - 1 + (ry * 2 + 2) * (1 - open);
      shape(ctx, () => {
        ctx.moveTo(x - rx - 1, y - ry - 1); ctx.lineTo(x + rx + 1, y - ry - 1);
        ctx.lineTo(x + rx + 1, edge); ctx.quadraticCurveTo(x, edge + ry * .3, x - rx - 1, edge);
      }, options.lid!, false);
    });
    oval(ctx, x, y, rx, ry, 'rgba(0,0,0,0)');
  }
}

/** A small curved mouth: smile, gasp or wobbly worry. */
export function mouth(ctx: Ctx, x: number, y: number, width: number, mood: 'smile' | 'gasp' | 'worry' | 'grin' = 'smile', tongue = '#d98972') {
  if (mood === 'gasp') {
    oval(ctx, x, y + width * .15, width * .42, width * .56, '#633d36');
    oval(ctx, x, y + width * .45, width * .26, width * .16, tongue, false);
  } else if (mood === 'grin') {
    shape(ctx, () => {
      ctx.moveTo(x - width * .6, y - width * .1);
      ctx.quadraticCurveTo(x, y + width * .75, x + width * .6, y - width * .1);
      ctx.quadraticCurveTo(x, y + width * .12, x - width * .6, y - width * .1);
    }, '#633d36');
  } else {
    const curve = mood === 'worry' ? -width * .35 : width * .5;
    line(ctx, () => { ctx.moveTo(x - width * .5, y); ctx.quadraticCurveTo(x, y + curve, x + width * .5, y); }, INK, Math.max(1.2, width * .17));
  }
}

/** Kicked-up dust where a running foot lands; it stays put in the world. */
export function dust(ctx: Ctx, x: number, y: number, age: number, size: number, colour = 'rgba(245,236,214,') {
  const a = clamp(age);
  if (a <= 0 || a >= 1) return;
  for (let i = 0; i < 3; i++) {
    const r = size * (.35 + a * .75) * (1 - i * .18);
    oval(ctx, x - i * size * .55 - a * size * .6, y - r * .55 - i * size * .15, r, r * .8, `${colour}${(.55 * (1 - a)).toFixed(3)})`, false);
  }
}

/** Short comic motion streaks behind a fast runner. */
export function speedLines(ctx: Ctx, x: number, y: number, length: number, t: number, count = 3) {
  for (let i = 0; i < count; i++) {
    const shift = ((t * 3 + i * .37) % 1) * length * .5;
    line(ctx, () => { ctx.moveTo(x - shift, y + i * length * .22); ctx.lineTo(x - shift - length * (.55 - i * .1), y + i * length * .22); },
      'rgba(255,255,255,.55)', Math.max(1, length * .05));
  }
}

/** A tiny four-point sparkle, used for surprise and for Pluto's frost. */
export function sparkle(ctx: Ctx, x: number, y: number, size: number, colour = '#fffdf2') {
  shape(ctx, () => {
    ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x + size * .18, y - size * .18, x + size, y);
    ctx.quadraticCurveTo(x + size * .18, y + size * .18, x, y + size);
    ctx.quadraticCurveTo(x - size * .18, y + size * .18, x - size, y);
    ctx.quadraticCurveTo(x - size * .18, y - size * .18, x, y - size);
  }, colour, false);
}

/** Three little stars circling a flattened character. */
export function dizzy(ctx: Ctx, x: number, y: number, radius: number, t: number, colour = '#e8ae53') {
  for (let i = 0; i < 3; i++) {
    const angle = t * 2.4 + i * TAU / 3;
    sparkle(ctx, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * .3, radius * .24, colour);
  }
}

/** Startle marks: the same three flicks for every character. */
export function surprise(ctx: Ctx, x: number, y: number, size: number, t: number) {
  const pop = 1 + Math.sin(clamp(t / .35) * Math.PI) * .25;
  for (const [angle, length] of [[-1.05, 1], [-.45, .8], [-1.65, .75]] as const) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    line(ctx, () => {
      ctx.moveTo(x + cos * size * .5, y + sin * size * .5);
      ctx.lineTo(x + cos * size * (.5 + length * pop), y + sin * size * (.5 + length * pop));
    }, '#e8ae53', Math.max(1.5, size * .22));
  }
}
