import { RocketPropellants } from './rocket_propellants.ts';

/**
 * ============================================================================
 * nozzle_render.ts — Parametric Nozzle Cutaway Graphic
 * ============================================================================
 *
 * ROLE:  Draws a live, parametric cross-section of the rocket engine nozzle
 *        as an overlay inset on the main canvas (upper right, beneath the
 *        character close-up). Every slider change reshapes the geometry,
 *        teaching how propellant choice, chamber pressure, throat area,
 *        expansion ratio and mixture ratio determine nozzle geometry and
 *        flow behaviour. Only drawn in rocket mode on wide viewports.
 *
 *        Based on: docs/nozzle_parametric_geometry_spec.md
 *        Implementation plan: docs/nozzle.md
 *
 * DEPENDS ON: rocket_propellants.ts (isentropic helpers used for the
 *             expansion-state indicator). Pure drawing — no DOM access.
 *
 * EXPORTS (via the `NozzleRender` object at the bottom):
 *   draw(ctx, canvasW, canvasH, nozzleData)  → void
 * ============================================================================
 */

// ── Layout Constants ─────────────────────────────────────────────────────
var INSET_MARGIN_X = 20;
var INSET_MARGIN_Y = 150; // Leave room for the target readout and character asides.
var INSET_MAX_W    = 320;
var INSET_MAX_H    = 184;
var INSET_W_FRAC   = 0.28;
var CORNER_R       = 8;
var PADDING        = 10;  // internal padding within the inset

// ── Colour Constants ─────────────────────────────────────────────────────
var COL_OX   = '#66aaff';
var COL_FUEL = '#ffaa44';
var COL_CHAMBER_LOW  = [120, 30, 10];
var COL_CHAMBER_MID  = [220, 140, 30];
var COL_CHAMBER_HIGH = [255, 245, 200];
var COL_NOZZLE_WALL  = '#666';
var COL_THROAT_GLOW  = 'rgba(255,255,180,';

// ── Mach colour stops (normalised x: 0=chamber, 1=exit) ─────────────────
var MACH_STOPS = [
  { t: 0.00, r: 255, g:  68, b:  68 },  // red — subsonic chamber
  { t: 0.30, r: 255, g: 136, b:  68 },  // orange — mid convergent
  { t: 0.42, r: 255, g: 221, b:  68 },  // yellow — throat (sonic)
  { t: 0.65, r:  68, g: 170, b: 255 },  // blue — mid divergent
  { t: 1.00, r:  34, g: 102, b: 221 }   // deep blue — exit
];

// ── Helpers ──────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpRGB(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t))
  ];
}

/** 3-stop colour interpolation: low→mid→high over t∈[0,1] */
function chamberColour(t) {
  t = clamp(t, 0, 1);
  if (t < 0.5) {
    return lerpRGB(COL_CHAMBER_LOW, COL_CHAMBER_MID, t * 2);
  }
  return lerpRGB(COL_CHAMBER_MID, COL_CHAMBER_HIGH, (t - 0.5) * 2);
}

/** Sample the Mach colour ramp at normalised position t∈[0,1] */
function machColour(t) {
  t = clamp(t, 0, 1);
  for (var i = 0; i < MACH_STOPS.length - 1; i++) {
    var s0 = MACH_STOPS[i], s1 = MACH_STOPS[i + 1];
    if (t <= s1.t) {
      var f = (t - s0.t) / (s1.t - s0.t);
      return 'rgb(' +
        Math.round(lerp(s0.r, s1.r, f)) + ',' +
        Math.round(lerp(s0.g, s1.g, f)) + ',' +
        Math.round(lerp(s0.b, s1.b, f)) + ')';
    }
  }
  var last = MACH_STOPS[MACH_STOPS.length - 1];
  return 'rgb(' + last.r + ',' + last.g + ',' + last.b + ')';
}

/** Draw a rounded rectangle path (no fill/stroke — just the path) */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Region geometry calculator ───────────────────────────────────────────
//
// Returns an object describing the x-positions and half-heights of each
// nozzle region, all in local coordinates relative to the inset's
// internal drawing area.
//
function computeLayout(d, iw, ih) {
  var At     = d.At || 0.002;
  var eps    = clamp(d.epsilon || 20, 2, 250);
  var MR     = clamp(d.MR || 2.5, 0.5, 15);
  var mdot   = d.mdot || 5;
  var Pc_bar = clamp(d.Pc_bar || 100, 10, 300);

  // ── Region width fractions ──
  var divFrac = 0.28 + 0.10 * clamp((Math.sqrt(eps) - 1) / 12, 0, 1);
  var chamberFrac = 0.20 + 0.04 * clamp(At / 0.005, 0, 1);
  var feedFrac = 0.13;
  var convFrac = 0.11;
  var throatFrac = 0.04;
  var totalUsed = feedFrac + chamberFrac + convFrac + throatFrac + divFrac;
  // Normalise to leave some pad on right for plume
  var scale = 0.90 / totalUsed;
  feedFrac    *= scale;
  chamberFrac *= scale;
  convFrac    *= scale;
  throatFrac  *= scale;
  divFrac     *= scale;

  // ── X positions (left-to-right) ──
  var xFeed     = 0;
  var xChamber  = xFeed + feedFrac * iw;
  var xConvStart = xChamber + chamberFrac * iw;
  var xThroat   = xConvStart + convFrac * iw;
  var xThroatEnd = xThroat + throatFrac * iw;
  var xExit     = xThroatEnd + divFrac * iw;

  // ── Half-heights ──
  var CR = 4;  // contraction ratio (typical)
  var maxHalfH = ih * 0.42;  // leave room for labels/title
  // Throat: minimum visual size
  var throatHalfH = ih * 0.06;
  // Chamber: based on contraction ratio
  var chamberHalfH = throatHalfH * clamp(CR, 2, 8);
  // Exit: based on expansion ratio
  var exitHalfH = throatHalfH * Math.sqrt(eps);
  // Clamp to fit
  var maxNeeded = Math.max(chamberHalfH, exitHalfH);
  if (maxNeeded > maxHalfH) {
    var shrink = maxHalfH / maxNeeded;
    throatHalfH  *= shrink;
    chamberHalfH *= shrink;
    exitHalfH    *= shrink;
  }

  // ── Pipe sizes (from MR) ──
  var basePipeH = chamberHalfH * 0.18;
  var oxH  = basePipeH * Math.sqrt(MR / (1 + MR));
  var fuH  = basePipeH * Math.sqrt(1 / (1 + MR));

  // ── Chamber fill colour ──
  var pT = clamp((Pc_bar - 10) / 290, 0, 1);
  var chamCol = chamberColour(pT);

  return {
    // X positions
    xFeed: xFeed,
    xChamber: xChamber,
    xConvStart: xConvStart,
    xThroat: xThroat,
    xThroatEnd: xThroatEnd,
    xExit: xExit,
    // Half-heights
    throatHalfH: throatHalfH,
    chamberHalfH: chamberHalfH,
    exitHalfH: exitHalfH,
    // Pipes
    oxH: oxH,
    fuH: fuH,
    // Chamber colour
    chamCol: chamCol,
    // Params
    eps: eps,
    MR: MR,
    mdot: mdot,
    Pc_bar: Pc_bar,
    At: At,
    // Inner dims
    iw: iw,
    ih: ih
  };
}

// ── Drawing primitives for each region ───────────────────────────────────

// 3.1 Feed Pipes
function drawFeedPipes(ctx, L, cy) {
  var xEnd = L.xChamber;
  var xStart = L.xFeed;
  var pipeLen = xEnd - xStart;
  var valveX = xEnd - pipeLen * 0.15;

  // Vertical positions: ox on outside, fuel on inside (×2 mirrored)
  var oxY1 = cy - L.chamberHalfH * 0.65;  // top ox
  var fuY1 = cy - L.chamberHalfH * 0.30;  // top fuel
  var fuY2 = cy + L.chamberHalfH * 0.30;  // bottom fuel
  var oxY2 = cy + L.chamberHalfH * 0.65;  // bottom ox

  var pipes = [
    { y: oxY1, h: L.oxH, col: COL_OX },
    { y: fuY1, h: L.fuH, col: COL_FUEL },
    { y: fuY2, h: L.fuH, col: COL_FUEL },
    { y: oxY2, h: L.oxH, col: COL_OX }
  ];

  for (var i = 0; i < pipes.length; i++) {
    var p = pipes[i];
    var ph = Math.max(1.5, p.h);
    // Pipe body
    ctx.fillStyle = p.col;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(xStart + pipeLen * 0.15, p.y - ph, pipeLen * 0.70, ph * 2);
    ctx.globalAlpha = 1;

    // Valve chevron at pipe end
    var va = Math.max(2, ph * 0.8);  // valve aperture half-height
    ctx.strokeStyle = p.col;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(valveX, p.y - va);
    ctx.lineTo(valveX + va * 0.7, p.y);
    ctx.lineTo(valveX, p.y + va);
    ctx.stroke();
  }
}

// 3.2 Combustion Chamber
function drawChamber(ctx, L, cy) {
  var x = L.xChamber;
  var w = L.xConvStart - x;
  var col = L.chamCol;

  // Outer wall
  ctx.fillStyle = COL_NOZZLE_WALL;
  ctx.fillRect(x, cy - L.chamberHalfH - 2, w, L.chamberHalfH * 2 + 4);

  // Inner fill (pressure colour)
  ctx.fillStyle = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
  ctx.fillRect(x + 2, cy - L.chamberHalfH + 2, w - 4, (L.chamberHalfH - 2) * 2);

  // Injector face (left edge detail — small vertical hatches)
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.8;
  var numHatches = 5;
  for (var i = 0; i < numHatches; i++) {
    var hy = cy - L.chamberHalfH * 0.7 + (L.chamberHalfH * 1.4) * (i / (numHatches - 1));
    ctx.beginPath();
    ctx.moveTo(x + 2, hy);
    ctx.lineTo(x + 5, hy);
    ctx.stroke();
  }
}

// 3.3 Converging Section (Bézier taper)
function drawConverging(ctx, L, cy) {
  var x0 = L.xConvStart;
  var x1 = L.xThroat;
  var hTop0 = L.chamberHalfH;
  var hTop1 = L.throatHalfH;
  var dx = x1 - x0;

  // Fill the converging shape with a gradient
  var grad = ctx.createLinearGradient(x0, 0, x1, 0);
  var col = L.chamCol;
  grad.addColorStop(0, 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')');
  grad.addColorStop(1, '#888');

  ctx.fillStyle = grad;
  ctx.beginPath();
  // Top wall (chamber → throat), concave curve
  ctx.moveTo(x0, cy - hTop0);
  ctx.bezierCurveTo(
    x0 + dx * 0.6, cy - hTop0,          // CP1: stay wide longer
    x0 + dx * 0.85, cy - hTop1,          // CP2: curve in sharply near throat
    x1, cy - hTop1                         // End at throat
  );
  // Across to bottom of throat
  ctx.lineTo(x1, cy + hTop1);
  // Bottom wall (throat → chamber), concave curve
  ctx.bezierCurveTo(
    x0 + dx * 0.85, cy + hTop1,
    x0 + dx * 0.6, cy + hTop0,
    x0, cy + hTop0
  );
  ctx.closePath();
  ctx.fill();

  // Wall outline
  ctx.strokeStyle = COL_NOZZLE_WALL;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, cy - hTop0);
  ctx.bezierCurveTo(
    x0 + dx * 0.6, cy - hTop0,
    x0 + dx * 0.85, cy - hTop1,
    x1, cy - hTop1
  );
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x0, cy + hTop0);
  ctx.bezierCurveTo(
    x0 + dx * 0.6, cy + hTop0,
    x0 + dx * 0.85, cy + hTop1,
    x1, cy + hTop1
  );
  ctx.stroke();
}

// 3.4 Throat (narrow band + glow)
function drawThroat(ctx, L, cy) {
  var x0 = L.xThroat;
  var x1 = L.xThroatEnd;
  var hh = L.throatHalfH;
  var xMid = (x0 + x1) / 2;

  // Thin wall bands
  ctx.fillStyle = '#888';
  ctx.fillRect(x0, cy - hh - 1.5, x1 - x0, 1.5);
  ctx.fillRect(x0, cy + hh, x1 - x0, 1.5);

  // Sonic glow
  var glowAlpha = clamp(L.mdot / 50, 0.1, 0.5);
  var glowR = Math.max(hh * 1.5, 6);
  var glow = ctx.createRadialGradient(xMid, cy, 0, xMid, cy, glowR);
  glow.addColorStop(0, COL_THROAT_GLOW + glowAlpha + ')');
  glow.addColorStop(1, COL_THROAT_GLOW + '0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(xMid, cy, glowR, 0, Math.PI * 2);
  ctx.fill();
}

// 3.5 Diverging Section (expansion bell — Bézier flare)
function drawDiverging(ctx, L, cy) {
  var x0 = L.xThroatEnd;
  var x1 = L.xExit;
  var hh0 = L.throatHalfH;
  var hh1 = L.exitHalfH;
  var dx = x1 - x0;

  // Fill with gradient (gray → dark blue-gray)
  var grad = ctx.createLinearGradient(x0, 0, x1, 0);
  grad.addColorStop(0, '#888');
  grad.addColorStop(1, '#445');

  ctx.fillStyle = grad;
  ctx.beginPath();
  // Top wall (throat → exit), Rao-style 80% bell
  ctx.moveTo(x0, cy - hh0);
  ctx.quadraticCurveTo(
    x0 + dx * 0.4, cy - hh1 * 0.85,    // CP: flares out early
    x1, cy - hh1
  );
  // Across exit plane
  ctx.lineTo(x1, cy + hh1);
  // Bottom wall (exit → throat)
  ctx.quadraticCurveTo(
    x0 + dx * 0.4, cy + hh1 * 0.85,
    x0, cy + hh0
  );
  ctx.closePath();
  ctx.fill();

  // Wall outline
  ctx.strokeStyle = COL_NOZZLE_WALL;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, cy - hh0);
  ctx.quadraticCurveTo(x0 + dx * 0.4, cy - hh1 * 0.85, x1, cy - hh1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x0, cy + hh0);
  ctx.quadraticCurveTo(x0 + dx * 0.4, cy + hh1 * 0.85, x1, cy + hh1);
  ctx.stroke();
}

// 3.6 Exit Plume Hint
function drawPlume(ctx, L, cy, d) {
  var x0 = L.xExit;
  var hh = L.exitHalfH;
  var plumeLen = hh * 0.7;
  var plumeHalfW = hh * (1 + 0.1 * Math.sqrt(L.eps));

  // Over/under-expansion adjustment
  var gamma = d.gamma || 1.2;
  var eps = L.eps;
  var Pc_Pa = d.Pc_Pa || (d.Pc_bar || 100) * 1e5;
  // Zero pressure is a real vacuum (Moon/Mercury), not a missing value.
  var Pa_Pa = Math.max(0, d.Pa_Pa ?? 101325);
  var Pe = 0;
  if (RocketPropellants._exitMachFromEpsilon) {
    var Me = RocketPropellants._exitMachFromEpsilon(gamma, Math.max(1.5, eps));
    var pe_pc = RocketPropellants._exitPressureRatio(gamma, Me);
    Pe = pe_pc * Pc_Pa;
  }
  if (!(L.mdot > 0) || d.flowRegime === 'unchoked' || d.flowRegime === 'off') {
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = '#ffb36b';
    ctx.globalAlpha = 0.8;
    ctx.textAlign = 'center';
    ctx.fillText('not choked', x0 + plumeLen * 0.4, cy + Math.max(hh, L.chamberHalfH) + 12);
    ctx.globalAlpha = 1;
    return;
  }
  if (d.flowRegime === 'separated') {
    plumeHalfW *= 0.6;
  } else if (Pe > 0) {
    var ratio = Pa_Pa > 0 ? Pe / Pa_Pa : Infinity;
    if (ratio < 0.95) {
      plumeHalfW *= 0.6;   // over-expanded — shock pinch
    } else if (ratio > 1.05) {
      plumeHalfW *= 1.3;   // under-expanded — wide plume
    }
  }

  // Triangular plume gradient
  var grad = ctx.createLinearGradient(x0, 0, x0 + plumeLen, 0);
  grad.addColorStop(0, 'rgba(255,200,100,0.25)');
  grad.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x0, cy - hh);
  ctx.lineTo(x0 + plumeLen, cy - plumeHalfW * 0.3);
  ctx.lineTo(x0 + plumeLen, cy + plumeHalfW * 0.3);
  ctx.lineTo(x0, cy + hh);
  ctx.closePath();
  ctx.fill();

  // Expansion state label
  if (Pe > 0) {
    var r = Pa_Pa > 0 ? Pe / Pa_Pa : Infinity;
    var label, colour;
    if (d.flowRegime === 'separated') {
      label = 'separated'; colour = '#ff8b61';
    } else if (Pa_Pa === 0) {
      label = 'vacuum'; colour = '#ffaa44';
    } else if (Math.abs(r - 1) < 0.05) {
      label = 'optimal'; colour = '#66dd66';
    } else if (r > 1) {
      label = 'under-exp'; colour = '#ffaa44';
    } else {
      label = 'over-exp'; colour = '#ff6644';
    }
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = colour;
    ctx.globalAlpha = 0.7;
    ctx.textAlign = 'center';
    ctx.fillText(label, x0 + plumeLen * 0.4, cy + Math.max(hh, L.chamberHalfH) + 12);
    ctx.globalAlpha = 1;
  }
}

// ── 4. Streamlines & Animation ───────────────────────────────────────────

/**
 * Get the nozzle half-height at a normalised x position (0 = chamber start,
 * 1 = exit). Uses the same regions as the geometry layout.
 */
function halfHeightAt(L, tNorm) {
  // Define region boundaries in normalised coordinates
  var xChamberNorm = (L.xConvStart - L.xChamber) / (L.xExit - L.xChamber);
  var xThroatNorm  = (L.xThroat - L.xChamber) / (L.xExit - L.xChamber);
  var xThroatEndNorm = (L.xThroatEnd - L.xChamber) / (L.xExit - L.xChamber);

  if (tNorm <= xChamberNorm) {
    return L.chamberHalfH;
  } else if (tNorm <= xThroatNorm) {
    // Converging: smooth interpolation
    var f = (tNorm - xChamberNorm) / (xThroatNorm - xChamberNorm);
    // Use a cubic ease for smooth convergence
    f = f * f * (3 - 2 * f);
    return lerp(L.chamberHalfH, L.throatHalfH, f);
  } else if (tNorm <= xThroatEndNorm) {
    return L.throatHalfH;
  } else {
    // Diverging: smooth interpolation
    var f2 = (tNorm - xThroatEndNorm) / (1 - xThroatEndNorm);
    // Gentle flare (sqrt-ish)
    f2 = Math.sqrt(f2);
    return lerp(L.throatHalfH, L.exitHalfH, f2);
  }
}

function drawStreamlines(ctx, L, cy, worldTime) {
  if (!(L.mdot > 0)) return;
  var numLines = 3 + Math.floor(clamp(L.mdot / 10, 0, 5));
  var nozzleStartX = L.xChamber;
  var nozzleLen = L.xExit - L.xChamber;
  if (nozzleLen < 10) return;

  // Number of segments to draw per streamline
  var segments = 40;
  var FLOW_SPEED = 60; // pixels/second base speed
  var DOTS_PER_LINE = 3;

  for (var i = 0; i < numLines; i++) {
    // Normalised vertical position: -0.75 to +0.75 of available height
    var vFrac = numLines === 1 ? 0 : (2 * i / (numLines - 1) - 1) * 0.75;

    // Draw the streamline as a series of short segments with colour changes
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;

    var prevX = 0, prevY = 0;
    for (var s = 0; s <= segments; s++) {
      var tNorm = s / segments;
      var px = nozzleStartX + tNorm * nozzleLen;
      var hh = halfHeightAt(L, tNorm);
      var py = cy + vFrac * hh;

      if (s > 0) {
        // Colour based on x-position (Mach mapping)
        ctx.strokeStyle = machColour(tNorm);
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
      prevX = px;
      prevY = py;
    }

    // Animated dots sliding along the streamline
    ctx.globalAlpha = 0.85;
    for (var di = 0; di < DOTS_PER_LINE; di++) {
      var phase = (di / DOTS_PER_LINE) + i * 0.17;
      // Speed increases through the nozzle — use a non-linear wrap
      var rawT = ((worldTime * FLOW_SPEED / nozzleLen) + phase) % 1.0;
      // Accelerate through throat: compress time in diverging section
      var dotT = rawT; // keep it simple but slightly accelerate
      if (dotT > 0.5) {
        dotT = 0.5 + (dotT - 0.5) * 1.4;
        if (dotT > 1) dotT -= 1;
      }
      dotT = clamp(dotT, 0, 1);

      var dotX = nozzleStartX + dotT * nozzleLen;
      var dotHH = halfHeightAt(L, dotT);
      var dotY = cy + vFrac * dotHH;

      ctx.fillStyle = machColour(dotT);
      ctx.beginPath();
      ctx.arc(dotX, dotY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}

// ── 5. Annotations & Labels ──────────────────────────────────────────────

function drawLabels(ctx, L, cy, d) {
  var labelY=cy-Math.max(L.chamberHalfH,L.exitHalfH)-9;
  ctx.font='500 11px system-ui, sans-serif';
  ctx.fillStyle='#dbe1d7';ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillText('Chamber',(L.xChamber+L.xConvStart)/2,labelY);
  ctx.fillText('Throat',(L.xThroat+L.xThroatEnd)/2,labelY);
  ctx.fillText('Bell',(L.xThroatEnd+L.xExit)/2,labelY);
  var throat=d.throatDia_mm||50;
  var exit=throat*Math.sqrt(d.epsilon||20);
  ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle='#b9c9c7';
  ctx.font='10px system-ui, sans-serif';
  ctx.fillText('Throat '+Math.round(throat)+' mm  ·  Exit '+Math.round(exit)+' mm',L.xFeed,cy+Math.max(L.chamberHalfH,L.exitHalfH)+24);
}

// ── Main draw function ───────────────────────────────────────────────────

function draw(ctx, canvasW, canvasH, d) {
  if (!d) return;

  // ── Compute inset size & position ──
  var iw = Math.min(INSET_MAX_W, Math.max(260, canvasW * INSET_W_FRAC));
  var ih = INSET_MAX_H;
  // Don't draw if canvas is too small
  if (canvasW < 580 || canvasH < INSET_MARGIN_Y + ih + 20) return;

  var ix = canvasW - iw - INSET_MARGIN_X;
  var iy = INSET_MARGIN_Y;

  ctx.save();

  // ── Backdrop ──
  roundRectPath(ctx, ix, iy, iw, ih, CORNER_R);
  ctx.fillStyle = 'rgba(34,53,62,0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Clip to inset bounds
  roundRectPath(ctx, ix, iy, iw, ih, CORNER_R);
  ctx.clip();

  // ── Title ──
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillStyle = '#f4deb0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Nozzle design · illustrative flow', ix + PADDING, iy + 10);

  // ── Internal coordinate system ──
  // Drawing area within padding
  var drawX = ix + PADDING;
  var drawY = iy + PADDING + 26;  // below title
  var drawW = iw - PADDING * 2;
  var drawH = ih - PADDING * 2 - 49;
  var cy = drawY + drawH / 2;  // centre-line y

  // Compute nozzle layout
  var L = computeLayout(d, drawW, drawH);

  // Offset all L x-positions by drawX
  L.xFeed      += drawX;
  L.xChamber   += drawX;
  L.xConvStart += drawX;
  L.xThroat    += drawX;
  L.xThroatEnd += drawX;
  L.xExit      += drawX;

  // ── Draw regions back-to-front ──
  drawChamber(ctx, L, cy);
  drawConverging(ctx, L, cy);
  drawThroat(ctx, L, cy);
  drawDiverging(ctx, L, cy);
  drawPlume(ctx, L, cy, d);
  drawFeedPipes(ctx, L, cy);

  // ── Streamlines (animated) ──
  var worldTime = d.worldTime || 0;
  drawStreamlines(ctx, L, cy, worldTime);

  // ── Labels & dimensions ──
  drawLabels(ctx, L, cy, d);

  // ── Centre-line (axis of symmetry) ──
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(L.xChamber, cy);
  ctx.lineTo(L.xExit, cy);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

// ── Expose namespace ─────────────────────────────────────────────────────
export const NozzleRender = {
  draw: draw
};
