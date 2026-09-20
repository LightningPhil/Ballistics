import type { CrewPose } from './crew.ts';

interface AquaticPose extends CrewPose {
  surfaceAmount?: number;
  portrait?: boolean;
  spoutParticles?: { ox: number; oy: number; life: number }[];
}

const INK = '#293b43';
const CREAM = '#fff3d9';
const BLUE = '#668f9e';
const BLUE_DARK = '#456d80';
const BRASS = '#d6a257';
const RUST = '#bc6749';
const TAU = Math.PI * 2;

/** Local artwork is designed at 80 pixels/metre, with the surface at y=0. */
function ink(ctx: CanvasRenderingContext2D) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = INK;
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, outline = true) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = fill; ctx.fill();
  if (outline) ctx.stroke();
}

function shape(ctx: CanvasRenderingContext2D, fill: string, draw: () => void, outline = true) {
  ctx.beginPath(); draw(); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (outline) ctx.stroke();
}

function stroke(ctx: CanvasRenderingContext2D, draw: () => void, colour = INK, width = 2.2) {
  ctx.strokeStyle = colour; ctx.lineWidth = width;
  ctx.beginPath(); draw(); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, fill: string) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
}

function finite(value: number | undefined, fallback = 0) {
  return Number.isFinite(value) ? value as number : fallback;
}

/** Soft local cloud banks, painted in the same metre scale as their guest.
 * Their feathered overlaps veil the lower hull/body without a hard waterline.
 * Portraits skip these entirely: the little face remains clear at every depth.
 */
function cloudBank(ctx: CanvasRenderingContext2D, surface: number, t: number,
  whale: boolean, foreground: boolean) {
  const hidden = 1 - surface;
  const colour = whale ? '211,171,132' : '218,200,151';
  const drift = Math.sin(t * .38) * 5;
  const puffs = foreground
    ? [[-69,12,49,19],[-27,10,54,26],[23,12,52,30],[65,9,42,20],[2,28,75,25]]
    : [[-64,-15,58,20],[40,-16,64,22],[0,6,102,28]];
  for (let i = 0; i < puffs.length; i++) {
    const [x,y,rx,ry] = puffs[i];
    const opacity = foreground ? .13 + hidden * .84 : .13 + hidden * .3;
    ctx.save();
    ctx.translate(x + drift * (i % 2 ? -1 : 1), y + Math.sin(t * .55 + i) * 1.4);
    ctx.scale(rx, ry);
    const haze = ctx.createRadialGradient(0,0,.04,0,0,1);
    haze.addColorStop(0,`rgba(${colour},${opacity})`);
    haze.addColorStop(.48,`rgba(${colour},${opacity * .8})`);
    haze.addColorStop(1,`rgba(${colour},0)`);
    ctx.fillStyle = haze;
    ctx.beginPath(); ctx.arc(0,0,1,0,TAU); ctx.fill();
    ctx.restore();
  }
}

/**
 * At s=80, the surfaced whale is about 184×112 pixels, x=-110…74, y=-112…0.
 * Its eye is (45,-53); a portrait can crop the tail while retaining the face.
 * surfaceAmount gently lowers it into a feathered cloud bank, never clipping
 * the sprite at a hard horizon or hiding it completely during its idle cycle.
 */
export function drawWhale(ctx: CanvasRenderingContext2D, cx: number, footY: number, s: number, char: AquaticPose) {
  const t = char.reducedMotion ? 0 : finite(char.stateTimer);
  const state = char.portrait ? 'idle' : char.state || 'spouting';
  const direction = char.direction === -1 ? -1 : 1;
  const surface = char.portrait ? 1 : Math.max(.34, Math.min(1, finite(char.surfaceAmount, 1)));
  const startled = state === 'startled' || state === 'rocket_startled';
  const blinking = !char.reducedMotion && t > 0 && t % 4.7 > 4.53;

  ctx.save();
  ctx.translate(cx, footY);
  ctx.scale(s / 80, s / 80);
  ink(ctx);

  if (!char.portrait) cloudBank(ctx, surface, t, true, false);

  ctx.save();
  ctx.translate(0, (1 - surface) * 62);
  ctx.globalAlpha *= .7 + surface * .3;
  ctx.scale(direction, 1);

  if (state === 'squashed') {
    const squash = Math.min(1, t / .7);
    ctx.translate(0, -2);
    ctx.scale(1 + squash * .12, .32 - squash * .1);
  }

  const bob = char.portrait ? 0 : Math.sin(t * 1.8) * 1.7;
  ctx.translate(0, bob - (startled ? 5 : 0));

  // An upswept peduncle and two broad flukes make a whale even in silhouette.
  ctx.save();
  ctx.translate(-57, -36);
  ctx.rotate(Math.sin(t * 1.6) * .045);
  shape(ctx, BLUE_DARK, () => {
    ctx.moveTo(13, 18);
    ctx.bezierCurveTo(-12, 13, -31, -2, -33, -35);
    ctx.bezierCurveTo(-48, -31, -57, -43, -51, -62);
    ctx.bezierCurveTo(-41, -59, -28, -50, -26, -43);
    ctx.bezierCurveTo(-23, -56, -9, -64, 4, -63);
    ctx.bezierCurveTo(4, -43, -8, -34, -22, -33);
    ctx.bezierCurveTo(-21, -6, -4, 1, 13, 0);
  });
  shape(ctx, '#81a5ad', () => {
    ctx.moveTo(-28, -43);
    ctx.quadraticCurveTo(-43, -54, -49, -59);
    ctx.quadraticCurveTo(-44, -41, -31, -39);
  }, false);
  stroke(ctx, () => { ctx.moveTo(-26,-42); ctx.quadraticCurveTo(-15,-53,-2,-58); }, '#a4c1c0', 2.1);
  ctx.restore();

  // Far flipper, almost hidden behind the belly.
  shape(ctx, BLUE_DARK, () => {
    ctx.moveTo(20,-32); ctx.quadraticCurveTo(50,-19,42,-3);
    ctx.quadraticCurveTo(24,-7,13,-25);
  });

  const bodyPath = () => {
    ctx.moveTo(-61,-40);
    ctx.bezierCurveTo(-60,-65,-35,-83,-2,-86);
    ctx.bezierCurveTo(28,-90,60,-78,67,-59);
    ctx.bezierCurveTo(76,-35,66,-11,39,-5);
    ctx.bezierCurveTo(12,2,-33,-4,-48,-19);
    ctx.quadraticCurveTo(-59,-26,-61,-40);
  };
  shape(ctx, BLUE, bodyPath);

  ctx.save(); ctx.beginPath(); bodyPath(); ctx.closePath(); ctx.clip();
  // The warm throat contrasts with the cool back, keeping the smile readable.
  shape(ctx, '#d9e6dc', () => {
    ctx.moveTo(-60,-16);
    ctx.bezierCurveTo(-38,-30,-13,-19,9,-24);
    ctx.bezierCurveTo(27,-28,40,-36,69,-33);
    ctx.lineTo(83,12); ctx.lineTo(-69,12);
  }, false);
  shape(ctx, CREAM, () => {
    ctx.moveTo(-21,-12);
    ctx.bezierCurveTo(4,-7,31,-13,42,-22);
    ctx.quadraticCurveTo(54,-29,71,-28);
    ctx.lineTo(70,7); ctx.lineTo(-28,7);
  }, false);
  for (let i = 0; i < 4; i++) {
    const x = 14 + i * 12;
    stroke(ctx, () => { ctx.moveTo(x,-21 - i * 1.3); ctx.quadraticCurveTo(x-2,-12,x-12,-4); }, '#93ada9', 1.4);
  }
  // Broad painted highlight, not a glossy plastic gradient.
  shape(ctx, '#85a9b2', () => {
    ctx.moveTo(-45,-57); ctx.bezierCurveTo(-21,-81,26,-83,47,-67);
    ctx.bezierCurveTo(22,-77,-14,-69,-38,-51);
  }, false);
  [[-43,-42,3],[-32,-50,2],[-24,-39,2.5]].forEach(([x,y,r]) => oval(ctx,x,y,r,r,'#a0bfbd',false));
  ctx.restore();
  ctx.beginPath(); bodyPath(); ctx.closePath(); ctx.stroke();

  // The near flipper sweeps down, and gives an occasional unhurried wave.
  ctx.save(); ctx.translate(-7,-29);
  ctx.rotate(char.reaction === 'escape' ? -.58 : Math.sin(t * 1.8) * .06);
  shape(ctx, BLUE_DARK, () => {
    ctx.moveTo(-10,-3); ctx.bezierCurveTo(-7,11,12,27,22,24);
    ctx.bezierCurveTo(23,10,8,-2,2,-7);
  });
  stroke(ctx, () => { ctx.moveTo(-3,1); ctx.quadraticCurveTo(4,15,16,20); }, '#83a6af', 2.1);
  ctx.restore();

  oval(ctx,44,-42,9,4.6,'#bb9585',false);
  if (blinking) {
    stroke(ctx, () => { ctx.moveTo(39,-54); ctx.quadraticCurveTo(45,-50,51,-54); }, INK, 2.8);
  } else {
    oval(ctx,45,-55,8.6,startled ? 10 : 9,CREAM);
    const lookY = char.reaction === 'apex' ? -3 : 0;
    oval(ctx,48,-54+lookY,4.3,5.3,INK,false);
    oval(ctx,47,-56+lookY,1.5,1.7,'#fffdf4',false);
  }
  stroke(ctx, () => { ctx.moveTo(38,-68); ctx.quadraticCurveTo(44,-72,51,-67); }, BLUE_DARK, 2.4);
  if (startled) {
    oval(ctx,60,-34,4.5,6.5,INK,false);
  } else {
    stroke(ctx, () => {
      ctx.moveTo(28,-36); ctx.bezierCurveTo(40,-25,58,-25,65,-40);
    }, INK, 2.6);
    stroke(ctx, () => { ctx.moveTo(24,-34); ctx.quadraticCurveTo(28,-39,32,-37); }, INK, 1.8);
  }
  // One understated blowhole; emitted particles are owned by the state machine.
  oval(ctx,8,-83,5,2.2,BLUE_DARK,false);
  stroke(ctx, () => { ctx.moveTo(3,-85); ctx.quadraticCurveTo(8,-89,13,-85); }, '#b8d1ca', 1.6);
  if (state === 'spouting' && surface > .8) {
    stroke(ctx, () => { ctx.moveTo(8,-87); ctx.quadraticCurveTo(9,-103,0,-108); }, '#a5cdd0', 3.7);
    stroke(ctx, () => { ctx.moveTo(9,-94); ctx.quadraticCurveTo(12,-106,20,-102); }, '#cde2db', 3);
    oval(ctx,-1,-110,2.6,3.6,'#cde2db',false);
    oval(ctx,23,-104,2,2.8,'#a5cdd0',false);
  }
  if (!char.reducedMotion && !char.portrait) {
    for (const particle of char.spoutParticles || []) {
      if (!Number.isFinite(particle.ox) || !Number.isFinite(particle.oy) || !Number.isFinite(particle.life)) continue;
      const life = Math.max(0, Math.min(1.2, particle.life));
      if (!life) continue;
      ctx.save(); ctx.globalAlpha = Math.min(.65, life * .8);
      oval(ctx,8 + particle.ox * 80,-86 + particle.oy * 24,1.5 + life * 1.4,2.2 + life * 1.8,'#d2e8e0',false);
      ctx.restore();
    }
  }
  ctx.restore();

  if (!char.portrait) cloudBank(ctx, surface, t, true, true);
  ctx.restore();
}

/**
 * At s=80, vessel bounds are about x=-82…68, y=-89…-2, before ±2px bob.
 * Its captain's large round window is centred at (26,-36).
 */
export function drawSubmarine(ctx: CanvasRenderingContext2D, cx: number, footY: number, s: number, char: AquaticPose) {
  const t = char.reducedMotion ? 0 : finite(char.stateTimer);
  const state = char.portrait ? 'idle' : char.state || 'idle';
  const surface = char.portrait ? 1 : Math.max(.34, Math.min(1, finite(char.surfaceAmount, 1)));
  const direction = char.direction === -1 ? -1 : 1;
  const startled = state === 'startled' || state === 'rocket_startled';
  const swimming = ['walking','returning','running_away'].includes(state);
  const bob = char.portrait ? 0 : Math.sin(t * 1.8) * 1.8;

  ctx.save(); ctx.translate(cx,footY); ctx.scale(s / 80,s / 80); ink(ctx);
  if (!char.portrait) cloudBank(ctx, surface, t, false, false);
  ctx.save();
  ctx.translate(0,(1 - surface) * 54);
  ctx.globalAlpha *= .74 + surface * .26;
  ctx.translate(0,bob - (startled ? 4 : 0));
  ctx.scale(direction,1);
  ctx.rotate(swimming ? Math.sin(t * 2) * .035 : 0);
  if (state === 'squashed') {
    ctx.translate(0,-1); ctx.scale(1.12,.29);
  }

  // A curved rudder and brass screw read clearly at world scale.
  shape(ctx, RUST, () => {
    ctx.moveTo(-43,-40); ctx.quadraticCurveTo(-54,-50,-64,-52);
    ctx.lineTo(-66,-9); ctx.quadraticCurveTo(-51,-12,-43,-23);
  });
  stroke(ctx, () => { ctx.moveTo(-49,-29); ctx.lineTo(-74,-29); }, INK, 5);
  stroke(ctx, () => { ctx.moveTo(-53,-29); ctx.lineTo(-75,-29); }, BRASS, 2.5);
  const propeller = t * (state === 'running_away' ? 12 : swimming ? 7 : 2);
  const bladeSpan = 8 + Math.abs(Math.cos(propeller)) * 5;
  oval(ctx,-75,-29-bladeSpan*.6,4,bladeSpan,BRASS);
  oval(ctx,-75,-29+bladeSpan*.6,4,bladeSpan,'#e9bd72');
  oval(ctx,-75,-29,4,4,INK,false);

  // Periscope retracts when startled; an actual elbow, not an ambiguous stick.
  const retract = startled ? 9 : 0;
  shape(ctx, '#82969a', () => {
    ctx.moveTo(-2,-60); ctx.lineTo(-2,-82+retract);
    ctx.quadraticCurveTo(-2,-87+retract,3,-87+retract);
    ctx.lineTo(17,-87+retract); ctx.lineTo(17,-79+retract);
    ctx.lineTo(6,-79+retract); ctx.lineTo(6,-60);
  });
  box(ctx,14,-89+retract,10,13,4,INK);
  box(ctx,19,-86+retract,5,7,2,'#adcdd1');
  stroke(ctx, () => { ctx.moveTo(1,-78+retract); ctx.lineTo(1,-67); }, '#c6d3cd', 1.7);
  box(ctx,-18,-65,37,23,8,'#d9b471');
  box(ctx,-13,-68,28,7,3,CREAM);
  box(ctx,-9,-60,10,9,3,'#587983');
  stroke(ctx, () => { ctx.moveTo(6,-59); ctx.lineTo(12,-59); ctx.moveTo(6,-55); ctx.lineTo(12,-55); }, '#917344', 1.5);

  const hullPath = () => {
    ctx.moveTo(-52,-42);
    ctx.bezierCurveTo(-33,-61,35,-62,57,-44);
    ctx.bezierCurveTo(74,-32,70,-15,51,-9);
    ctx.bezierCurveTo(25,1,-24,-1,-49,-14);
    ctx.bezierCurveTo(-59,-20,-62,-32,-52,-42);
  };
  shape(ctx,'#e7ba70',hullPath);
  ctx.save(); ctx.beginPath(); hullPath(); ctx.closePath(); ctx.clip();
  shape(ctx,CREAM,() => {
    ctx.moveTo(-66,-24); ctx.quadraticCurveTo(0,-14,74,-26);
    ctx.lineTo(77,7); ctx.lineTo(-68,7);
  },false);
  shape(ctx,'#c6934c',() => {
    ctx.moveTo(-67,-15); ctx.quadraticCurveTo(-9,6,75,-16);
    ctx.lineTo(70,8); ctx.lineTo(-64,8);
  },false);
  stroke(ctx,() => { ctx.moveTo(-55,-24); ctx.quadraticCurveTo(5,-15,67,-25); },'#a47c47',1.5);
  stroke(ctx,() => { ctx.moveTo(-35,-47); ctx.quadraticCurveTo(3,-57,41,-47); },'#ffda97',3.5);
  ctx.restore(); ctx.beginPath(); hullPath(); ctx.closePath(); ctx.stroke();

  // A little observation window and an oversized captain's window give this
  // vessel a readable character, rather than three tiny dots on a capsule.
  oval(ctx,-25,-35,12,12,BRASS);
  oval(ctx,-25,-35,8.8,8.8,'#466b7a');
  stroke(ctx,() => { ctx.moveTo(-29,-40); ctx.lineTo(-22,-42); },'#b7d5d3',2.7);
  oval(ctx,-23,-32,2,2,'#749aa6',false);

  oval(ctx,26,-34,23,23,'#ba8846');
  oval(ctx,26,-34,20,20,CREAM);
  oval(ctx,26,-34,17,17,'#426575');
  ctx.save(); ctx.beginPath(); ctx.arc(26,-34,16.7,0,TAU); ctx.clip();
  // Captain: warm face, very simple eyes, navy uniform and proper peaked cap.
  oval(ctx,26,-14,16,14,'#587e84',false);
  shape(ctx,CREAM,() => { ctx.moveTo(18,-24); ctx.lineTo(26,-15); ctx.lineTo(34,-24); ctx.lineTo(30,-26); ctx.lineTo(26,-21); ctx.lineTo(22,-26); },false);
  oval(ctx,26,-33,11.5,12.5,'#e6b47e');
  oval(ctx,16,-32,2.5,3.5,'#e6b47e',false);
  oval(ctx,36,-32,2.5,3.5,'#e6b47e',false);
  shape(ctx,CREAM,() => {
    ctx.moveTo(14,-41); ctx.quadraticCurveTo(12,-49,26,-49);
    ctx.quadraticCurveTo(40,-49,38,-41); ctx.lineTo(35,-39); ctx.lineTo(17,-39);
  });
  box(ctx,15,-42,23,5,2,INK);
  oval(ctx,27,-45,2,2,BRASS,false);
  const eyeY = char.reaction === 'apex' ? -35 : -33;
  if (char.reaction === 'coast' && !startled) {
    stroke(ctx,() => { ctx.moveTo(20,-33); ctx.lineTo(23,-33); ctx.moveTo(29,-33); ctx.lineTo(32,-33); },INK,1.7);
  } else {
    oval(ctx,22,eyeY,1.5,startled ? 2.9 : 2.1,INK,false);
    oval(ctx,31,eyeY,1.5,startled ? 2.9 : 2.1,INK,false);
  }
  oval(ctx,19,-28,2.6,1.5,'#cd8666',false);
  oval(ctx,34,-28,2.6,1.5,'#cd8666',false);
  if (startled) oval(ctx,27,-26,2.2,3,INK,false);
  else stroke(ctx,() => { ctx.moveTo(23,-26); ctx.quadraticCurveTo(27,char.reaction === 'fizzle' ? -28 : -22,31,-26); },INK,1.6);
  // A short glass reflection is kept away from the face.
  stroke(ctx,() => { ctx.moveTo(15,-44); ctx.quadraticCurveTo(12,-39,12,-35); },'rgba(234,247,235,.55)',2.2);
  ctx.restore();

  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    oval(ctx,26+Math.cos(a)*20.7,-34+Math.sin(a)*20.7,1.3,1.3,INK,false);
  }
  [-44,-34,-16,-5].forEach((x,i) => oval(ctx,x,-16+i*.8,1.5,1.5,'#8b713f',false));
  // Small side fin, hull identification stripes and a friendly amber beacon.
  shape(ctx,RUST,() => {
    ctx.moveTo(-9,-17); ctx.quadraticCurveTo(-8,-3,-27,-3);
    ctx.quadraticCurveTo(-26,-15,-19,-18);
  });
  stroke(ctx,() => { ctx.moveTo(-19,-12); ctx.lineTo(-24,-5); },'#e49a71',1.8);
  stroke(ctx,() => { ctx.moveTo(55,-21); ctx.lineTo(58,-26); ctx.moveTo(59,-20); ctx.lineTo(62,-25); },RUST,2.1);
  oval(ctx,-10,-69,3,3,startled ? '#eb9a59' : '#ba6a48');
  if (startled) {
    stroke(ctx,() => { ctx.moveTo(-17,-74); ctx.lineTo(-20,-77); ctx.moveTo(-10,-77); ctx.lineTo(-10,-81); },'#e2ac55',2.2);
  }
  ctx.restore();
  if (!char.portrait) cloudBank(ctx, surface, t, false, true);
  ctx.restore();
}
