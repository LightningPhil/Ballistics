import { drawCrew } from './crew.ts';
import { drawWhale, drawSubmarine } from './aquatic-characters.ts';
import { drawNewt, drawSnowman } from './planet-guests.ts';
import { drawGiantSquid } from './squid.ts';
import { drawIceBear } from './ice-bear.ts';
import { rocketCameraFraming, type RocketCameraRequest } from './camera.ts';
import { ENVIRONMENTS } from './environment.ts';

/**
 * ============================================================================
 * renderer.ts — Canvas Drawing for Launch Lab
 * ============================================================================
 *
 * ROLE:  Everything drawn on <canvas>. Planet environments (sky, curved
 *        ground, features), the side-elevation cannon, launch tower and
 *        rocket, cannonballs, flags, craters/gas holes, particles, muzzle
 *        flash, shockwave, ghost trails, the target marker and the character
 *        close-up. Owns the camera: dynamic zoom, panning, the planet-view
 *        blend from flat horizon to whole-planet circle, and the rocket
 *        follow camera (framing maths in camera.ts).
 *        Smooth planet-environment crossfade driven by gravity value.
 *
 * Character artwork is split out: crew.ts (barrel crew and the golfer,
 * alien, spaceman and robots), planet-guests.ts (newt, snowman), squid.ts
 * (Ganymede), ice-bear.ts (Pluto) and aquatic-characters.ts (whale,
 * submarine). Nozzle cutaway: nozzle_render.ts.
 *
 * The `Renderer` object exported at the bottom is the public surface used by
 * main.ts and the tests; everything else in this file is private.
 * ============================================================================
 */

// ── Planet Data (sorted by gravity) ────────────────────────────────────────
// Gravity, radius and surface type come from the shared ENVIRONMENTS table so
// the solver and the scenery can never disagree; only the palette lives here.
function world(name: string) {
  const environment = ENVIRONMENTS.find(candidate => candidate.name === name);
  if (!environment) throw new Error('renderer palette for unknown world ' + name);
  return { name: name, g: environment.gravity, radius: environment.radius, isGas: environment.isGas };
}

var PLANETS = [
  { ...world('pluto'),
    skyTop:[5,7,19],        skyMid:[12,14,31],       skyBot:[30,31,49],
    groundTop:[190,181,164], groundBot:[132,121,105],
    subTop:[105,94,82],     subBot:[72,63,57],
    surfEdge:[217,211,197], moundCol:[161,149,132],
    features:'pluto' },
  { ...world('ganymede'),
    skyTop:[4,8,20],         skyMid:[10,20,39],       skyBot:[31,50,69],
    groundTop:[186,216,220], groundBot:[112,158,170],
    subTop:[75,125,143],     subBot:[40,78,104],
    surfEdge:[224,241,239],  moundCol:[140,181,190],
    features:'ganymede' },
  { ...world('moon'),
    skyTop:[5,5,15],       skyMid:[10,10,25],      skyBot:[25,25,45],
    groundTop:[150,148,142], groundBot:[115,113,108],
    subTop:[90,88,83],     subBot:[70,68,63],
    surfEdge:[165,163,158], moundCol:[135,133,128],
    features:'moon' },
  { ...world('mercury'),
    skyTop:[8,6,18],       skyMid:[18,14,32],      skyBot:[35,30,48],
    groundTop:[145,130,115], groundBot:[115,100,85],
    subTop:[88,78,63],     subBot:[68,58,48],
    surfEdge:[160,145,130], moundCol:[135,120,105],
    features:'mercury' },
  { ...world('mars'),
    skyTop:[165,105,75],   skyMid:[195,135,100],   skyBot:[215,165,135],
    groundTop:[190,110,68], groundBot:[160,88,52],
    subTop:[130,68,38],    subBot:[100,52,28],
    surfEdge:[205,128,78], moundCol:[180,105,62],
    features:'mars' },
  { ...world('venus'),
    skyTop:[195,155,55],   skyMid:[205,170,75],    skyBot:[218,185,100],
    groundTop:[180,128,48], groundBot:[150,105,38],
    subTop:[125,82,28],    subBot:[100,62,20],
    surfEdge:[200,148,58], moundCol:[170,120,42],
    features:'venus' },
  { ...world('uranus'),
    skyTop:[85,165,190],   skyMid:[105,190,215],   skyBot:[135,205,225],
    groundTop:[75,155,185], groundBot:[55,125,160],
    subTop:[45,105,140],   subBot:[35,85,120],
    surfEdge:[90,170,200], moundCol:[70,150,180],
    features:'icegas' },
  { ...world('earth'),
    skyTop:[130,176,190],  skyMid:[176,206,211],  skyBot:[228,231,208],
    groundTop:[126,153,110], groundBot:[89,120,86],
    subTop:[126,104,73],   subBot:[83,77,58],
    surfEdge:[167,179,126], moundCol:[116,144,99],
    features:'earth' },
  { ...world('saturn'),
    skyTop:[195,175,115],  skyMid:[210,195,145],   skyBot:[220,205,160],
    groundTop:[190,170,110], groundBot:[170,150,90],
    subTop:[150,130,75],   subBot:[130,110,58],
    surfEdge:[200,180,125], moundCol:[180,160,100],
    features:'saturn' },
  { ...world('neptune'),
    skyTop:[18,35,105],    skyMid:[28,55,140],     skyBot:[45,75,165],
    groundTop:[28,48,130], groundBot:[20,38,110],
    subTop:[15,28,90],     subBot:[10,20,68],
    surfEdge:[38,58,140],  moundCol:[25,42,118],
    features:'deepgas' },
  { ...world('jupiter'),
    skyTop:[200,150,100],  skyMid:[215,170,118],   skyBot:[225,185,140],
    groundTop:[180,128,78], groundBot:[160,108,58],
    subTop:[140,88,42],    subBot:[118,68,28],
    surfEdge:[190,138,88], moundCol:[170,118,68],
    features:'jupiter' },
  { ...world('sun'),
    skyTop:[58,5,8],        skyMid:[164,38,14],      skyBot:[246,128,28],
    groundTop:[255,207,70], groundBot:[210,67,17],
    subTop:[183,48,18],     subBot:[92,13,18],
    surfEdge:[255,232,119], moundCol:[239,139,33],
    features:'sun' }
];

// ── Constants ──────────────────────────────────────────────────────────────
var DEFAULT_PPM       = 80;
var MIN_PPM           = 1e-8;  // Whole planets must fit, including Jupiter.
var GROUND_OFFSET     = 70;
var CANNON_BASE_X_M   = 1.5;
var CANNON_BASE_Y_M   = 1.0;
var BARREL_LENGTH_M   = 1.5;
var BALL_RADIUS_M     = 0.1;

// ── Parallax depth factors (0 = fixed on screen, 1 = moves fully with camera) ──
var PARALLAX_STARS      = 0.03;   // Far sky: stars, celestial bodies, rings
var PARALLAX_CLOUDS     = 0.15;   // Clouds, volcanic haze
var PARALLAX_MOUNTAINS  = 0.35;   // Mountains (behind trees)
var PARALLAX_TREES      = 0.5;    // Treeline (mid-ground)
var PARALLAX_GROUND     = 1.0;    // Ground surface features (crater fields etc.)

function setBarrelLength(m) {
  BARREL_LENGTH_M = Math.max(0.4, Math.min(5.0, m));
}

// ── State ──────────────────────────────────────────────────────────────────
var canvas, ctx, W, H, groundY, baseGroundY;
var pixelRatio = 1;
var currentPPM  = DEFAULT_PPM;
var targetPPM   = DEFAULT_PPM;
var cameraX       = 0;     // world-space X offset for horizontal panning
var targetCameraX = 0;
var cameraY       = 0;     // world-space Y offset for vertical panning (metres)
var targetCameraY = 0;
var viewTransitionDuration = 1.2; // ~95% settle in ~1.2s by default
var rocketCamera: RocketCameraRequest | null = null;
var displayedGravity = 9.81;
var targetGravity    = 9.81;
var worldTime = 0;
var EARTH_PLANET = PLANETS.find(planet => planet.name === 'earth') || PLANETS[0];

// ── Curvature state (Phase 2) ──────────────────────────────────────────────
// When the viewport is wide enough relative to the planet that the ground arc's
// sagitta exceeds ~2 px, we switch from flat rendering to curved rendering.
var curveActive    = false;   // Is curvature currently visible?
var curveRadius    = 0;       // Planet radius in metres (0 = flat fallback)
var curveRadiusPx  = 0;       // Planet radius in screen pixels (R * PPM)
// Planet-centre screen position — used when curvature is active.
// The "camera follow point" (cameraX, cameraY) maps to the screen anchor point,
// and we compute planet-centre relative to that.
var curveCentreX   = 0;       // screen px
var curveCentreY   = 0;       // screen px
var curveCamTheta  = 0;       // camera's angular position on the sphere (radians)

// ── Phase 4: Whole-planet view ─────────────────────────────────────────────
// planetViewFrac smoothly ramps from 0 (ground-level follow) to 1 (whole-planet
// centred) as PPM drops below the threshold where the planet disc fits on screen.
var planetViewFrac = 0;       // 0 = follow mode, 1 = planet-centred mode

// Interpolated environment
var env = {
  skyTop:[93,169,233], skyMid:[135,206,235], skyBot:[182,223,247],
  groundTop:[90,154,106], groundBot:[74,124,89],
  subTop:[107,68,35], subBot:[74,47,21],
  surfEdge:[106,173,122], moundCol:[90,140,100],
  solidness: 1, isGas: false,
  lowerPlanet: EARTH_PLANET, upperPlanet: EARTH_PLANET,
  lowerAlpha: 1, upperAlpha: 0,
  nearestPlanet: EARTH_PLANET
};

// Pre-generated feature data
var starData = [], cloudData = [], treeData = [], mountainData = [];
var gasSwirls = [], craterFieldData = [];

// ── Celestial Bodies ───────────────────────────────────────────────────────
var celestialBodies = [
  {
    planet: 'mars', name: 'phobos',
    radius: 8, colour: [170, 155, 140],
    orbitPeriod: 35, yFrac: 0.30, yOscillation: 0.04,
    phase: 0, texture: 'lumpy', shapeVerts: [],
    // Phase 3: orbital data (real Phobos orbit ~2.77 R_mars)
    orbitRadiusFactor: 2.77, inclination: 0.02
  },
  {
    planet: 'mars', name: 'deimos',
    radius: 4, colour: [160, 150, 135],
    orbitPeriod: 60, yFrac: 0.18, yOscillation: 0.03,
    phase: 17.5, texture: 'lumpy', shapeVerts: [],
    // Phase 3: orbital data (real Deimos orbit ~6.92 R_mars)
    orbitRadiusFactor: 6.92, inclination: 0.03
  },
  {
    planet: 'earth', name: 'moon',
    radius: 25, colour: [230, 225, 210],
    orbitPeriod: 120, yFrac: 0.25, yOscillation: 0.02,
    phase: 5, texture: 'moon', shapeVerts: [],
    // Phase 3: orbital data (real Moon is 60R — compressed to 4.5R for visibility)
    orbitRadiusFactor: 4.5, inclination: 0.09,
    craters: [
      { ax: -0.25, ay: -0.30, r: 0.18 },
      { ax:  0.30, ay: -0.15, r: 0.14 },
      { ax: -0.10, ay:  0.35, r: 0.12 },
      { ax:  0.20, ay:  0.25, r: 0.10 },
      { ax: -0.35, ay:  0.05, r: 0.09 },
      { ax:  0.05, ay: -0.05, r: 0.07 }
    ],
    maria: [
      { ax: -0.15, ay: -0.10, r: 0.30 },
      { ax:  0.20, ay:  0.15, r: 0.22 },
      { ax: -0.05, ay:  0.30, r: 0.18 }
    ]
  }
];

// ── Helpers ────────────────────────────────────────────────────────────────
function lerpRGB(a, b, t) {
  return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
}
function rgb(c) {
  return 'rgb('+Math.round(c[0])+','+Math.round(c[1])+','+Math.round(c[2])+')';
}
function rgba(c, a) {
  return 'rgba('+Math.round(c[0])+','+Math.round(c[1])+','+Math.round(c[2])+','+a+')';
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// Parallax helper: pixel offset for a given depth factor
function parallaxOffset(factor) {
  return cameraX * currentPPM * factor;
}
// Vertical parallax: how much a layer shifts down when the camera rises
function parallaxOffsetY(factor) {
  return cameraY * currentPPM * factor;
}
// Wrap a screen-space x position into the visible range with margin for partial features
function wrapX(x, margin) {
  if (W <= 0) return x;
  margin = margin || 50;
  var total = W + 2 * margin;
  return ((x + margin) % total + total) % total - margin;
}

// ── Init & Resize ──────────────────────────────────────────────────────────
function init(cvs) {
  canvas = cvs;
  ctx = canvas.getContext('2d');
  resize();
  generateFeatures();
  computeEnvironment();
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      var bounds = canvas.getBoundingClientRect();
      if (Math.round(bounds.width) !== W || Math.round(bounds.height) !== H) resize();
    }).observe(canvas);
  }
}

function resize() {
  // Rendering coordinates stay in CSS pixels; only the backing bitmap uses DPR.
  // Read the canvas itself because the playback controls share its parent.
  var bounds = canvas.getBoundingClientRect();
  W = Math.max(1, Math.round(bounds.width));
  H = Math.max(1, Math.round(bounds.height));
  pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * pixelRatio);
  canvas.height = Math.round(H * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  baseGroundY = H - GROUND_OFFSET;
  groundY = baseGroundY + cameraY * currentPPM;
}

// ── Feature Generation ─────────────────────────────────────────────────────
function generateFeatures() {
  var i;
  starData = [];
  for (i = 0; i < 140; i++) {
    starData.push({ x:Math.random(), y:Math.random()*0.8,
                     b:0.4+Math.random()*0.6, r:0.5+Math.random()*1.5 });
  }
  cloudData = [];
  for (i = 0; i < 5; i++) {
    cloudData.push({ x:Math.random()*1.2-0.1, y:0.08+Math.random()*0.22,
                      r:25+Math.random()*35, puffs:3+Math.floor(Math.random()*3) });
  }
  treeData = [];
  var tc = 14+Math.floor(Math.random()*6);
  for (i = 0; i < tc; i++) {
    treeData.push({ x:i/tc+(Math.random()*0.04-0.02),
                     h:35+Math.random()*50, w:18+Math.random()*25 });
  }
  mountainData = [];
  var mc = 8+Math.floor(Math.random()*4);
  for (i = 0; i < mc; i++) {
    mountainData.push({ x:i/mc+(Math.random()*0.06-0.03),
                         h:40+Math.random()*80, w:30+Math.random()*60 });
  }
  craterFieldData = [];
  for (i = 0; i < 20; i++) {
    craterFieldData.push({ x:Math.random(), r:3+Math.random()*8 });
  }
  gasSwirls = [];
  for (i = 0; i < 6; i++) {
    gasSwirls.push({ yFrac:0.12+i*0.14, amp:3+Math.random()*5,
                      freq:0.01+Math.random()*0.02, phase:Math.random()*Math.PI*2,
                      colShift:(Math.random()-0.5)*22 });
  }

  // Generate irregular lumpy shapes for Phobos & Deimos
  for (i = 0; i < celestialBodies.length; i++) {
    var body = celestialBodies[i];
    if (body.texture === 'lumpy') {
      var nVerts = (body.name === 'phobos') ? 10 : 8;
      body.shapeVerts = [];
      for (var v = 0; v < nVerts; v++) {
        var angle = (v / nVerts) * Math.PI * 2;
        var bump = 0.75 + Math.random() * 0.5; // 0.75–1.25 radius multiplier
        body.shapeVerts.push({ a: angle, r: bump });
      }
    }
  }
}

// ── Environment Interpolation ──────────────────────────────────────────────
function findBracket(g) {
  if (g <= PLANETS[0].g) return { lo:PLANETS[0], hi:PLANETS[0], t:0 };
  var last = PLANETS[PLANETS.length-1];
  if (g >= last.g) return { lo:last, hi:last, t:0 };
  for (var i = 0; i < PLANETS.length-1; i++) {
    if (g >= PLANETS[i].g && g <= PLANETS[i+1].g) {
      var t = (g-PLANETS[i].g)/(PLANETS[i+1].g-PLANETS[i].g);
      return { lo:PLANETS[i], hi:PLANETS[i+1], t:t };
    }
  }
  return { lo:PLANETS[0], hi:PLANETS[0], t:0 };
}

function findNearest(g) {
  var best = PLANETS[0], bd = Math.abs(g-best.g);
  for (var i = 1; i < PLANETS.length; i++) {
    var d = Math.abs(g-PLANETS[i].g);
    if (d < bd) { bd = d; best = PLANETS[i]; }
  }
  return best;
}

function computeEnvironment() {
  var b = findBracket(displayedGravity);
  var t = b.t, lo = b.lo, hi = b.hi;

  env.skyTop    = lerpRGB(lo.skyTop,    hi.skyTop,    t);
  env.skyMid    = lerpRGB(lo.skyMid,    hi.skyMid,    t);
  env.skyBot    = lerpRGB(lo.skyBot,    hi.skyBot,    t);
  env.groundTop = lerpRGB(lo.groundTop, hi.groundTop, t);
  env.groundBot = lerpRGB(lo.groundBot, hi.groundBot, t);
  env.subTop    = lerpRGB(lo.subTop,    hi.subTop,    t);
  env.subBot    = lerpRGB(lo.subBot,    hi.subBot,    t);
  env.surfEdge  = lerpRGB(lo.surfEdge,  hi.surfEdge,  t);
  env.moundCol  = lerpRGB(lo.moundCol,  hi.moundCol,  t);

  var loS = lo.isGas ? 0 : 1, hiS = hi.isGas ? 0 : 1;
  env.solidness = loS*(1-t) + hiS*t;

  env.lowerPlanet = lo;
  env.upperPlanet = hi;
  env.lowerAlpha  = 1 - t;
  env.upperAlpha  = t;
  env.nearestPlanet = findNearest(displayedGravity);
  env.isGas = env.nearestPlanet.isGas;
}

// ── Camera / Zoom ──────────────────────────────────────────────────────────
function setTargetZoom(ppm) {
  if (!Number.isFinite(ppm)) return;
  targetPPM = Math.max(MIN_PPM, ppm);
}
function setZoomImmediate(ppm) {
  if (!Number.isFinite(ppm)) return;
  ppm = Math.max(MIN_PPM, ppm);
  currentPPM = ppm;
  targetPPM = ppm;
  // Recompute groundY for the new zoom level
  var zoomRatio = Math.min(1, currentPPM / DEFAULT_PPM);
  baseGroundY = H - Math.max(12, GROUND_OFFSET * zoomRatio);
  groundY = baseGroundY + cameraY * currentPPM;
}
function resetZoom() { targetPPM = DEFAULT_PPM; }

function setCameraTarget(x) { targetCameraX = x; }
function setCameraImmediate(x) { cameraX = x; targetCameraX = x; }
function resetCamera() { rocketCamera = null; targetCameraX = 0; cameraX = 0; targetCameraY = 0; cameraY = 0; }
function setRocketCamera(request: RocketCameraRequest) {
  rocketCamera = request;
  setTargetZoom(rocketCameraFraming(request, W, H, currentPPM, curveActive).targetPPM);
}

/** Zoom anticipates the recorded path, while position follows its current
 * projection. Easing world-space offsets cannot keep up with accelerated time
 * or a seek, and stops working when a whole-planet view centres the planet.
 * Frame the actual vehicle after zoom/curvature update instead. The bounds
 * guard is usually idle; it covers seeks, resizing and rapid attitude changes. */
function applyRocketCamera() {
  if (!rocketCamera) return;
  var framing = rocketCameraFraming(rocketCamera, W, H, currentPPM, curveActive);
  if (currentPPM > framing.maxPPM) {
    currentPPM = framing.maxPPM;
    baseGroundY = H - Math.max(12, GROUND_OFFSET * Math.min(1, currentPPM / DEFAULT_PPM));
    updateCurvature();
    framing = rocketCameraFraming(rocketCamera, W, H, currentPPM, curveActive);
  }
  var point = rocketCamera.state, anchor = framing.anchor;
  cameraX = point.x - anchor.x / currentPPM;
  cameraY = point.y + (anchor.y - baseGroundY) / currentPPM;
  targetCameraX = cameraX; targetCameraY = cameraY;
  groundY = baseGroundY + cameraY * currentPPM;
  if (curveActive) {
    var angle = point.x / curveRadius;
    var radialPixels = (curveRadius + point.y) * currentPPM;
    curveCentreX = anchor.x - radialPixels * Math.sin(angle);
    curveCentreY = anchor.y + radialPixels * Math.cos(angle);
    curveCamTheta = cameraX / curveRadius;
  }
}
function setViewTransitionDuration(seconds) {
  if (!isFinite(seconds)) return;
  viewTransitionDuration = Math.max(0.15, seconds);
}

function setTargetGravity(g) { targetGravity = g; }

function updateWorld(dt) {
  worldTime += dt;
  var gDiff = targetGravity - displayedGravity;
  if (Math.abs(gDiff) < 0.01) displayedGravity = targetGravity;
  else displayedGravity += gDiff * Math.min(1, dt * 6);

  // First-order response where "duration" means ~95% settle time.
  var easingRate = 3 / viewTransitionDuration;

  // Logarithmic zoom interpolation — zoom is multiplicative so log-space
  // easing feels perceptually uniform (avoids the "fast then slow" jolt).
  var zDiff = targetPPM - currentPPM;
  if (currentPPM > 0 && targetPPM > 0) {
    var logCur = Math.log(currentPPM);
    var logTgt = Math.log(targetPPM);
    var logDiff = logTgt - logCur;
    if (Math.abs(logDiff) < 0.001) currentPPM = targetPPM;
    else {
      logCur += logDiff * (1-Math.exp(-Math.max(0,dt)*easingRate));
      currentPPM = Math.exp(logCur);
    }
  } else {
    currentPPM += zDiff * Math.min(1, dt * easingRate);
  }

  // Smooth camera panning
  var camDiff = targetCameraX - cameraX;
  if (Math.abs(camDiff) < 0.01) cameraX = targetCameraX;
  else cameraX += camDiff * Math.min(1, dt * easingRate);

  var camDiffY = targetCameraY - cameraY;
  if (Math.abs(camDiffY) < 0.01) cameraY = targetCameraY;
  else cameraY += camDiffY * Math.min(1, dt * easingRate);

  // Recompute groundY based on zoom and camera Y offset
  var zoomRatio = Math.min(1, currentPPM / DEFAULT_PPM);
  baseGroundY = H - Math.max(12, GROUND_OFFSET * zoomRatio);
  groundY = baseGroundY + cameraY * currentPPM;

  // ── Phase 4: planet-view blend fraction ──
  // As PPM drops toward the whole-planet threshold, planetViewFrac ramps 0→1.
  // The ramp starts at 5× the whole-planet PPM (planet is ~50% of viewport diameter)
  // and reaches 1 at 1× (full planet in viewport).
  // Computed before updateCurvature() so the centre-blend uses the current value.
  var wpPPM = getWholePlanetPPM();
  if (wpPPM > 0) {
    var rampStart = wpPPM * 5;   // begin blend at 5× whole-planet PPM
    var rampEnd   = wpPPM;       // full planet-centred at 1×
    if (currentPPM <= rampStart) {
      // Use log-space for perceptually uniform ramp
      var logStart = Math.log(rampStart);
      var logEnd   = Math.log(rampEnd);
      var logNow   = Math.log(Math.max(currentPPM, rampEnd * 0.5));
      planetViewFrac = clamp((logStart - logNow) / (logStart - logEnd), 0, 1);
    } else {
      planetViewFrac = 0;
    }
  } else {
    planetViewFrac = 0;
  }

  // ── Curvature computation (Phase 2) ──
  updateCurvature();
  applyRocketCamera();

  computeEnvironment();
}

// ── Curvature helpers ──────────────────────────────────────────────────────

/**
 * Recompute curvature state based on current zoom, planet radius, and camera.
 * Called every frame from updateWorld().
 *
 * Sagitta = R_px * (1 - cos(halfAngle)) where halfAngle = (W/2) / R_px.
 * When sagitta >= 2 px, curvature is visible → switch to arc rendering.
 */
function updateCurvature() {
  curveRadius = getPlanetRadius(displayedGravity);
  if (curveRadius <= 0 || currentPPM <= 0 || W <= 0) {
    curveActive = false;
    return;
  }

  curveRadiusPx = curveRadius * currentPPM;

  // Half-angle subtended by half the viewport on the planet surface
  var halfAngle = Math.min(Math.PI,(W * 0.5) / curveRadiusPx);
  // Sagitta: how many pixels the arc dips below a flat line across the viewport
  var sagitta = curveRadiusPx * (1 - Math.cos(halfAngle));

  curveActive = sagitta >= 2 || planetViewFrac > 0;

  if (curveActive) {
    // Camera angular position on sphere: cameraX (metres along surface) → angle
    curveCamTheta = cameraX / curveRadius;

    // Planet centre screen position.
    // We require worldToScreen(cameraX, cameraY) = (0, baseGroundY)
    // where 0 = screen X of camera anchor and baseGroundY = screen Y.
    //
    // worldToScreen gives: sx = pcX + (R+camY)*sin(camTheta)*ppm
    //                      sy = pcY - (R+camY)*cos(camTheta)*ppm
    //
    // Solving for pcX, pcY:
    var camR = (curveRadius + cameraY) * currentPPM;
    curveCentreX = -camR * Math.sin(curveCamTheta);
    curveCentreY = baseGroundY + camR * Math.cos(curveCamTheta);

    // Phase 4: blend planet centre towards screen centre for whole-planet view
    if (planetViewFrac > 0.001) {
      var t = planetViewFrac;
      curveCentreX = curveCentreX * (1 - t) + (W * 0.5) * t;
      curveCentreY = curveCentreY * (1 - t) + (H * 0.5) * t;
    }
  }
}

/**
 * Convert physics coordinates (surface distance, altitude) to screen pixels.
 * When curvature is active, uses polar projection around the planet centre.
 * When flat, uses the original linear mapping.
 *
 * @param {number} physX  Surface distance from origin (metres)
 * @param {number} physY  Altitude above surface (metres)
 * @returns {{ sx: number, sy: number }} Screen coordinates
 */
function worldToScreen(physX, physY) {
  if (!curveActive) {
    return {
      sx: (physX - cameraX) * currentPPM,
      sy: groundY - physY * currentPPM
    };
  }

  // Polar projection using planet-centre screen position (curveCentreX/Y).
  // physX/R = angular position (theta) on the sphere
  // physY = altitude above surface → radial distance = R + physY
  //
  // World-space position relative to planet centre:
  //   wx = (R + physY) * sin(theta)
  //   wy = (R + physY) * cos(theta)
  //
  // The camera offset is already encoded in curveCentreX/Y (planet centre
  // screen position), so we don't subtract camera here.

  var theta = physX / curveRadius;
  var r = curveRadius + physY;

  return {
    sx: curveCentreX + r * Math.sin(theta) * currentPPM,
    sy: curveCentreY - r * Math.cos(theta) * currentPPM
  };
}

/**
 * Surface-normal angle at a given physics X position (radians).
 * This is the rotation needed to tilt a surface object to match the curved ground.
 * Returns 0 when curvature is not active.
 */
function surfaceNormalAngle(physX) {
  if (!curveActive || curveRadius <= 0) return 0;
  // Projection translates the planet centre but never rotates the camera frame.
  // Therefore the local normal uses the absolute surface angle.
  return physX / curveRadius;
}

/**
 * Get the screen Y for ground level (physY=0) at a given physX.
 * In flat mode, this is just groundY. In curved mode, it follows the arc.
 */
function groundYAtPhysX(physX) {
  if (!curveActive) return groundY;
  var pt = worldToScreen(physX, 0);
  return pt.sy;
}

// ── Coordinate Mapping ─────────────────────────────────────────────────────
function toCanvasX(px) {
  if (curveActive) return worldToScreen(px, 0).sx;
  return (px - cameraX) * currentPPM;
}
/** Full curved-aware transform for both coordinates at once. */
function toCanvas(px, py) {
  if (curveActive) {
    var pt = worldToScreen(px, py);
    return { x: pt.sx, y: pt.sy };
  }
  return { x: (px - cameraX) * currentPPM, y: groundY - py * currentPPM };
}

/** Inverse canvas projection, using CSS pixels (e.g. pointer minus canvas rect). */
function screenToSurface(screenX, screenY) {
  if (!curveActive) {
    return { x: cameraX + screenX / currentPPM, y: (groundY - screenY) / currentPPM };
  }
  var dx = screenX - curveCentreX;
  var dy = curveCentreY - screenY;
  var angle = Math.atan2(dx, dy);
  // Choose the surface-distance winding nearest the current camera.
  angle += Math.round((curveCamTheta - angle) / (Math.PI * 2)) * Math.PI * 2;
  return { x: angle * curveRadius, y: Math.hypot(dx, dy) / currentPPM - curveRadius };
}

/** A previous run is a single screen-space dashed path, with no new physics.
 * The flight deck's comparison note identifies it; no label is drawn here. */
function drawGhost(points, options: { color?: string } = {}) {
  if (!points || points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = options.color || (env.skyMid[0] > 100 ? '#566c7b' : '#aec4da');
  ctx.globalAlpha = 0.65;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.setLineDash([6, 7]);
  ctx.beginPath();
  var last = null;
  for (var point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) { last = null; continue; }
    var p = toCanvas(point.x, point.y);
    if (!last) ctx.moveTo(p.x, p.y);
    else if (Math.hypot(p.x - last.x, p.y - last.y) >= 1.5) ctx.lineTo(p.x, p.y);
    else continue;
    last = p;
  }
  ctx.stroke();
  ctx.restore();
}

function drawTarget(value, mode = 'cannon') {
  if (!Number.isFinite(value)) return;
  var rocketMode = mode === 'rocket';
  var point = toCanvas(rocketMode ? TOWER_BASE_X_M : value, rocketMode ? value : 0);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#315d59';
  if (rocketMode) {
    ctx.strokeStyle = 'rgba(236,201,115,.9)';
    ctx.setLineDash([6, 5]);
    if (curveActive) {
      var ring = (curveRadius + value) * currentPPM;
      if (ring > 0) { ctx.beginPath(); ctx.arc(curveCentreX,curveCentreY,ring,0,Math.PI*2);ctx.stroke(); }
    } else {
      ctx.beginPath();ctx.moveTo(0,point.y);ctx.lineTo(W,point.y);ctx.stroke();
    }
    ctx.setLineDash([]);
    // Only show the handle at the real goal, where dragging can hit it.
    if (point.x >= 0 && point.x <= W && point.y >= 0 && point.y <= H) {
      ctx.fillStyle = '#f3cf76';ctx.beginPath();ctx.arc(point.x,point.y,5,0,Math.PI*2);ctx.fill();
    }
  } else {
    if (point.x >= -60 && point.x <= W + 60 && point.y >= -70 && point.y <= H + 70) {
      ctx.translate(point.x,point.y);
      if (curveActive) ctx.rotate(value / curveRadius);
      ctx.fillStyle = 'rgba(33,52,48,.18)';ctx.beginPath();ctx.ellipse(0,0,17,4,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#324b4c';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-49);ctx.stroke();
      ctx.beginPath();ctx.moveTo(1,-48);ctx.quadraticCurveTo(15,-51,29,-43);
      ctx.lineTo(22,-31);ctx.quadraticCurveTo(12,-37,1,-34);ctx.closePath();
      ctx.fillStyle='#e9ae57';ctx.fill();ctx.lineWidth=1.5;ctx.stroke();
      ctx.fillStyle='#fff1c8';ctx.beginPath();ctx.arc(11,-42,3,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
}

/** Screen-space notes stay clear of the target and the running character. */
function drawSceneNotes(value, mode, char) {
  if (Number.isFinite(value)) {
    var rocketMode = mode === 'rocket';
    var point = toCanvas(rocketMode ? TOWER_BASE_X_M : value, rocketMode ? value : 0);
    var distance = Math.abs(value) >= 1000 ? (value / 1000).toFixed(1) + ' km' : Math.round(value) + ' m';
    var direction = point.x > W ? ' →' : point.x < 0 ? ' ←' : point.y < 0 ? ' ↑' : point.y > H ? ' ↓' : '';
    var text = (rocketMode ? 'Height goal · ' : 'Target · ') + distance + direction;
    ctx.save();
    ctx.font = '600 12px system-ui, sans-serif';
    drawAnnotation(text, W - ctx.measureText(text).width - 34, 16);
    ctx.restore();
  }
  if (char) drawCharacterAside(char);
}

function drawAnnotation(text, x, y) {
  ctx.save();ctx.font='600 12px system-ui, sans-serif';
  var width=ctx.measureText(text).width+18;
  ctx.beginPath();ctx.roundRect(clamp(x,5,W-width-5),y,width,25,8);
  ctx.fillStyle='rgba(255,247,228,.94)';ctx.fill();
  ctx.strokeStyle='rgba(40,62,60,.25)';ctx.lineWidth=1;ctx.stroke();
  ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#2c454b';
  ctx.fillText(text,clamp(x,5,W-width-5)+9,y+12.5);ctx.restore();
}

function getCannonTipPhys(angleDeg) {
  var rad = angleDeg * Math.PI / 180;
  return {
    x: CANNON_BASE_X_M + BARREL_LENGTH_M * Math.cos(rad),
    y: CANNON_BASE_Y_M + BARREL_LENGTH_M * Math.sin(rad)
  };
}
// ── Sky ────────────────────────────────────────────────────────────────────
function drawSky() {
  var skyBottom = Math.min(groundY, H);

  // Space transition: when zoomed out enough to see the planet as a disc,
  // the sky fades to space-void black.
  var spaceFrac = 0;
  if (curveActive && curveRadiusPx > 0) {
    // spaceFrac = 0 when planet is huge (flat-looking), 1 when planet is a small disc
    spaceFrac = clamp(1 - curveRadiusPx / (H * 2), 0, 1);
  }

  if (spaceFrac > 0.01) {
    // Fill entire canvas with space black, faded by spaceFrac
    ctx.fillStyle = 'rgba(3,3,8,' + spaceFrac + ')';
    ctx.fillRect(0, 0, W, H);
  }

  // Normal sky gradient (faded out as space takes over)
  if (spaceFrac < 0.99 && skyBottom > 0) {
    ctx.globalAlpha = 1 - spaceFrac;
    var grad = ctx.createLinearGradient(0, 0, 0, skyBottom);
    grad.addColorStop(0,   rgb(env.skyTop));
    grad.addColorStop(0.6, rgb(env.skyMid));
    grad.addColorStop(1,   rgb(env.skyBot));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, skyBottom);
    ctx.globalAlpha = 1;
  }

  // Atmosphere glow around the planet disc when space is visible
  if (spaceFrac > 0.1 && curveRadiusPx > 5) {
    var atmosPx = Math.max(4, curveRadiusPx * 0.02);
    var atmosGrad = ctx.createRadialGradient(
      curveCentreX, curveCentreY, curveRadiusPx,
      curveCentreX, curveCentreY, curveRadiusPx + atmosPx);
    var a = Math.min(1, spaceFrac * 1.5);
    atmosGrad.addColorStop(0, rgba(env.skyBot, 0.5 * a));
    atmosGrad.addColorStop(0.4, rgba(env.skyMid, 0.25 * a));
    atmosGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = atmosGrad;
    ctx.beginPath();
    ctx.arc(curveCentreX, curveCentreY, curveRadiusPx + atmosPx, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Feature Drawing ────────────────────────────────────────────────────────
function drawPlanetFeatures(planet, alpha) {
  if (alpha < 0.02) return;
  ctx.globalAlpha = alpha;

  // LOD: skip surface-level detail when zoomed to whole-planet view
  var skipSurface = planetViewFrac > 0.5;

  switch (planet.features) {
    case 'pluto':   drawStars(); drawPlutoFeatures(planet, skipSurface); break;
    case 'ganymede': drawStars(); drawGanymedeJupiter(); if (!skipSurface) drawGanymedeIce(); break;
    case 'moon':    drawStars(); if (!skipSurface) drawCraterFieldFeature(); break;
    case 'mercury': drawStars(); if (!skipSurface) drawCraterFieldFeature(); break;
    case 'mars':    drawStars(); drawCelestialBodies('mars'); if (!skipSurface) drawMountains(planet); drawPhobosShadow(); break;
    case 'venus':   if (!skipSurface) drawVolcanicHaze(); break;
    case 'earth':   drawCelestialBodies('earth'); if (!skipSurface) { drawClouds(); drawTreeline(); } break;
    case 'saturn':  drawSaturnRings(); break;
    case 'icegas':  break;
    case 'deepgas': break;
    case 'jupiter': break;
    case 'sun':     drawSolarProminences(); break;
  }
  ctx.globalAlpha = 1;
}

function drawStars() {
  var offset = parallaxOffset(PARALLAX_STARS);
  var offsetY = parallaxOffsetY(PARALLAX_STARS);
  for (var i = 0; i < starData.length; i++) {
    var s = starData[i];
    var twinkle = 0.5 + 0.5*Math.sin(worldTime*2 + i*3.7);
    ctx.fillStyle = 'rgba(255,255,255,'+(s.b*twinkle)+')';
    var sx = wrapX(s.x * W - offset, 5);
    var sy = s.y * baseGroundY + offsetY;
    ctx.beginPath();
    ctx.arc(sx, sy, s.r, 0, Math.PI*2);
    ctx.fill();
  }
}

function drawClouds() {
  var zr = Math.min(1, currentPPM / DEFAULT_PPM);
  var offset = parallaxOffset(PARALLAX_CLOUDS);
  var offsetY = parallaxOffsetY(PARALLAX_CLOUDS);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  for (var i = 0; i < cloudData.length; i++) {
    var c = cloudData[i];
    var cx = (c.x + worldTime*0.008) % 1.3 - 0.1;
    var cr = c.r * zr;
    var baseX = wrapX(cx * W - offset, cr * c.puffs);
    var baseY = c.y * baseGroundY + offsetY;
    // Fill the whole silhouette once, without translucent overlap rings.
    ctx.beginPath();
    for (var p = 0; p < c.puffs; p++) {
      var puffX = baseX + p*cr*.8;
      var puffY = baseY + (p%2)*cr*.22;
      var puffR = cr * (p%2 ? .82 : 1);
      ctx.moveTo(puffX+puffR,puffY);
      ctx.arc(puffX,puffY,puffR,0,Math.PI*2);
    }
    ctx.fill();
  }
}

function drawTreeline() {
  var zr = Math.min(1, currentPPM / DEFAULT_PPM);
  var offset = parallaxOffset(PARALLAX_TREES);
  for (var i = 0; i < treeData.length; i++) {
    var t = treeData[i];
    var th = t.h * zr;
    var tw = t.w * zr;
    var tx = wrapX(t.x * W - offset, tw);
    // Branch tiers and quiet colour variation soften the old row of triangles.
    ctx.fillStyle = ['#3d654a','#527459','#345b44'][i%3];
    ctx.beginPath();ctx.moveTo(tx-tw*.45,groundY);
    ctx.lineTo(tx-tw*.23,groundY-th*.32);
    ctx.lineTo(tx-tw*.36,groundY-th*.29);
    ctx.lineTo(tx-tw*.14,groundY-th*.62);
    ctx.lineTo(tx-tw*.25,groundY-th*.58);
    ctx.lineTo(tx,groundY-th);
    ctx.lineTo(tx+tw*.25,groundY-th*.58);
    ctx.lineTo(tx+tw*.14,groundY-th*.62);
    ctx.lineTo(tx+tw*.36,groundY-th*.29);
    ctx.lineTo(tx+tw*.23,groundY-th*.32);
    ctx.lineTo(tx+tw*.45,groundY);ctx.closePath();ctx.fill();
  }
}

function drawMountains(planet) {
  var zr = Math.min(1, currentPPM / DEFAULT_PPM);
  var col = lerpRGB(planet.groundTop, planet.skyBot, 0.4);
  var offset = parallaxOffset(PARALLAX_MOUNTAINS);
  ctx.fillStyle = rgb(col);
  for (var i = 0; i < mountainData.length; i++) {
    var m = mountainData[i];
    var mx = wrapX(m.x * W - offset, m.w * zr);
    var mh = m.h * zr;
    var mw = m.w * zr;
    ctx.beginPath();
    ctx.moveTo(mx - mw, groundY);
    ctx.lineTo(mx - mw*0.3, groundY - mh*0.6);
    ctx.lineTo(mx, groundY - mh);
    ctx.lineTo(mx + mw*0.25, groundY - mh*0.55);
    ctx.lineTo(mx + mw, groundY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawVolcanicHaze() {
  var hazeOffY = parallaxOffsetY(PARALLAX_CLOUDS);
  var hazeTop = baseGroundY * 0.5 + hazeOffY;
  var hazeBot = baseGroundY + hazeOffY;
  var grad = ctx.createLinearGradient(0, hazeTop, 0, hazeBot);
  grad.addColorStop(0, 'rgba(200,150,40,0)');
  grad.addColorStop(0.5, 'rgba(200,150,40,0.08)');
  grad.addColorStop(1, 'rgba(200,130,30,0.2)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, hazeBot);
}

function drawSaturnRings() {
  // Ring band definitions (shared between both modes)
  var ringDefs = [
    { rOff:-42, w:5,  col:[210,195,150], a:0.14 },
    { rOff:-28, w:10, col:[195,180,135], a:0.25 },
    { rOff:-14, w:16, col:[215,200,160], a:0.20 },
    { rOff:  0, w:12, col:[225,212,172], a:0.28 },  // brightest band
    { rOff: 16, w:4,  col:[60,50,35],    a:0.18 },  // Cassini Division (dark)
    { rOff: 22, w:20, col:[200,188,148], a:0.22 },
    { rOff: 44, w:10, col:[185,170,130], a:0.16 },
    { rOff: 58, w:5,  col:[170,158,118], a:0.10 }
  ];

  if (curveActive && curveRadiusPx > 5) {
    // ── Orbital mode: draw actual ring ellipses around the planet disc ──
    // Saturn's rings span ~1.15R (inner D ring) to ~2.27R (outer F ring).
    // Ring defs are centred at ~1.7R with offsets in pixels.
    ctx.save();

    var tilt = 0.25 + Math.sin(worldTime * 0.04) * 0.12;
    var baseRingR = curveRadiusPx * 1.7;  // base ring at 1.7 planetary radii
    // Scale the ring offsets proportionally with zoom
    var offsetScale = curveRadiusPx / 300; // normalise so offsets look right

    for (var i = 0; i < ringDefs.length; i++) {
      var rd = ringDefs[i];
      var r = baseRingR + rd.rOff * offsetScale;
      if (r < curveRadiusPx * 1.05) continue; // don't overlap the planet
      ctx.strokeStyle = 'rgba('+rd.col[0]+','+rd.col[1]+','+rd.col[2]+','+rd.a+')';
      ctx.lineWidth = Math.max(1, rd.w * offsetScale);
      ctx.beginPath();
      ctx.ellipse(curveCentreX, curveCentreY, r, r * 0.35, tilt, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Faint glow
    ctx.strokeStyle = 'rgba(230,215,170,0.04)';
    ctx.lineWidth = Math.max(2, 40 * offsetScale);
    ctx.beginPath();
    ctx.ellipse(curveCentreX, curveCentreY, baseRingR, baseRingR * 0.35, tilt, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
    return;
  }

  // ── Close-zoom mode: original "sky band" technique ──
  // From Saturn's surface, rings appear as a luminous band arcing across
  // the entire sky from horizon to horizon — like a colossal stripe overhead.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, baseGroundY);
  ctx.clip();

  var drift = worldTime * 0.015;
  var tilt2 = 0.25 + Math.sin(worldTime * 0.04) * 0.12;

  var ringsOffset = parallaxOffset(PARALLAX_STARS);
  var ringsOffsetY = parallaxOffsetY(PARALLAX_STARS);
  var cx = W * 0.5 + Math.sin(drift) * W * 0.15 - ringsOffset;
  var cy = baseGroundY + H * 2.8 + ringsOffsetY;
  var baseR = H * 2.9;

  for (var j = 0; j < ringDefs.length; j++) {
    var rd2 = ringDefs[j];
    var r2 = baseR + rd2.rOff;
    ctx.strokeStyle = 'rgba('+rd2.col[0]+','+rd2.col[1]+','+rd2.col[2]+','+rd2.a+')';
    ctx.lineWidth = rd2.w;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r2, r2 * 0.97, tilt2, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(230,215,170,0.06)';
  ctx.lineWidth = 40;
  ctx.beginPath();
  ctx.ellipse(cx, cy, baseR, baseR * 0.97, tilt2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ── Celestial Body Drawing ─────────────────────────────────────────────────
function drawCelestialBodies(planetName) {
  for (var i = 0; i < celestialBodies.length; i++) {
    var body = celestialBodies[i];
    if (body.planet !== planetName) continue;

    var cx, cy, displayR;

    if (curveActive && body.orbitRadiusFactor) {
      // ── Orbital mode: body orbits the planet centre ──
      // Angular position: full revolution per orbitPeriod (artistic speed)
      var orbAngle = ((worldTime + body.phase) / body.orbitPeriod) * Math.PI * 2;
      var incl = body.inclination || 0;

      // Orbit radius in metres, then to screen pixels
      var orbitR = curveRadius * body.orbitRadiusFactor;
      var orbitRPx = orbitR * currentPPM;

      // Position relative to planet centre (2D projection of inclined orbit)
      var orbX = curveCentreX + Math.cos(orbAngle) * orbitRPx;
      var orbY = curveCentreY + Math.sin(orbAngle) * orbitRPx * Math.cos(incl);

      cx = orbX;
      cy = orbY;

      // Scale body radius with zoom: at whole-planet view, ensure minimum visibility
      displayR = Math.max(body.radius, curveRadiusPx * 0.012);
    } else {
      // ── Flat/close-zoom mode: original screen-fraction animation ──
      var offset = parallaxOffset(PARALLAX_STARS);
      var offsetY = parallaxOffsetY(PARALLAX_STARS);
      var xFrac = ((worldTime + body.phase) / body.orbitPeriod) % 1.3 - 0.15;
      var yBase = body.yFrac * baseGroundY + offsetY;
      var yBob  = Math.sin(worldTime * 0.5 + body.phase) * body.yOscillation * baseGroundY;
      cx = xFrac * W - offset;
      cy = yBase + yBob;
      displayR = body.radius;
    }

    // Skip if fully off screen
    if (cx < -displayR * 2 || cx > W + displayR * 2 ||
        cy < -displayR * 2 || cy > H + displayR * 2) continue;

    if (body.texture === 'lumpy') {
      drawLumpyMoon(cx, cy, body, displayR);
    } else if (body.texture === 'moon') {
      drawEarthMoon(cx, cy, body, displayR);
    }
  }
}

/** `r` is the on-screen radius; `body.radius` is the unscaled design size. */
function drawLumpyMoon(cx, cy, body, r) {
  var verts = body.shapeVerts;
  if (!verts || verts.length < 3) return;

  // Slow tumble rotation
  var rot = worldTime * 0.3 + body.phase;

  ctx.save();
  ctx.translate(cx, cy);

  // Shadow (offset slightly down-right)
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  for (var i = 0; i < verts.length; i++) {
    var a = verts[i].a + rot;
    var vr = verts[i].r * r;
    var px = Math.cos(a) * vr + 2;
    var py = Math.sin(a) * vr + 2;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // Main body
  ctx.fillStyle = rgb(body.colour);
  ctx.beginPath();
  for (var j = 0; j < verts.length; j++) {
    var a2 = verts[j].a + rot;
    var vr2 = verts[j].r * r;
    var px2 = Math.cos(a2) * vr2;
    var py2 = Math.sin(a2) * vr2;
    if (j === 0) ctx.moveTo(px2, py2);
    else ctx.lineTo(px2, py2);
  }
  ctx.closePath();
  ctx.fill();

  // Subtle shading — dark on the right side
  var shadeGrad = ctx.createLinearGradient(-r, 0, r, 0);
  shadeGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
  shadeGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
  shadeGrad.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = shadeGrad;
  ctx.beginPath();
  for (var k = 0; k < verts.length; k++) {
    var a3 = verts[k].a + rot;
    var vr3 = verts[k].r * r;
    var px3 = Math.cos(a3) * vr3;
    var py3 = Math.sin(a3) * vr3;
    if (k === 0) ctx.moveTo(px3, py3);
    else ctx.lineTo(px3, py3);
  }
  ctx.closePath();
  ctx.fill();

  // Tiny surface craters (2-3 darker dots)
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (var c = 0; c < 3; c++) {
    var ca = (c * 2.1) + rot * 0.2;
    var cr = r * 0.3;
    ctx.beginPath();
    ctx.arc(Math.cos(ca) * cr, Math.sin(ca) * cr, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawEarthMoon(cx, cy, body, r) {
  ctx.save();
  ctx.translate(cx, cy);

  // ── Soft outer glow (no hard circles — use shadowBlur) ──
  ctx.save();
  ctx.shadowColor = 'rgba(240,235,210,0.35)';
  ctx.shadowBlur = r * 0.8;
  ctx.fillStyle = 'rgba(240,235,210,0.01)';
  ctx.beginPath();
  ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── Main disc — smooth radial gradient for spherical shading ──
  var mainGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.05, 0, 0, r);
  mainGrad.addColorStop(0, 'rgb(248,246,238)');
  mainGrad.addColorStop(0.35, 'rgb(235,230,215)');
  mainGrad.addColorStop(0.7, 'rgb(215,210,195)');
  mainGrad.addColorStop(1, 'rgb(170,165,150)');
  ctx.fillStyle = mainGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Clip all remaining detail to the moon disc
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();

  // ── Maria (dark "seas") — soft large patches, not perfect circles ──
  if (body.maria) {
    for (var m = 0; m < body.maria.length; m++) {
      var ma = body.maria[m];
      var mcx = ma.ax * r * 2;
      var mcy = ma.ay * r * 2;
      var mr = ma.r * r * 2;
      var mariaGrad = ctx.createRadialGradient(mcx, mcy, mr * 0.15, mcx, mcy, mr);
      mariaGrad.addColorStop(0, 'rgba(105,100,92,0.3)');
      mariaGrad.addColorStop(0.6, 'rgba(115,110,100,0.18)');
      mariaGrad.addColorStop(1, 'rgba(130,125,115,0)');
      ctx.fillStyle = mariaGrad;
      ctx.beginPath();
      ctx.arc(mcx, mcy, mr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Craters — subtle indentations with inner shadow + bright rim ──
  if (body.craters) {
    for (var c = 0; c < body.craters.length; c++) {
      var cr = body.craters[c];
      var crx = cr.ax * r * 2;
      var cry = cr.ay * r * 2;
      var crr = cr.r * r * 2;

      // Crater floor — slight darkening with radial gradient
      var craterGrad = ctx.createRadialGradient(crx, cry, crr * 0.1, crx, cry, crr);
      craterGrad.addColorStop(0, 'rgba(130,125,115,0.35)');
      craterGrad.addColorStop(0.7, 'rgba(145,140,130,0.2)');
      craterGrad.addColorStop(1, 'rgba(160,155,145,0)');
      ctx.fillStyle = craterGrad;
      ctx.beginPath();
      ctx.arc(crx, cry, crr, 0, Math.PI * 2);
      ctx.fill();

      // Bright rim on the upper-left (sunlight)
      ctx.strokeStyle = 'rgba(255,252,240,0.3)';
      ctx.lineWidth = Math.max(0.5, crr * 0.12);
      ctx.beginPath();
      ctx.arc(crx, cry, crr * 0.9, Math.PI * 0.85, Math.PI * 1.65);
      ctx.stroke();

      // Shadow on lower-right interior
      ctx.strokeStyle = 'rgba(80,75,65,0.15)';
      ctx.lineWidth = Math.max(0.5, crr * 0.1);
      ctx.beginPath();
      ctx.arc(crx, cry, crr * 0.7, Math.PI * 1.85, Math.PI * 0.55);
      ctx.stroke();
    }
  }

  // ── Fine surface texture — tiny scattered dots for realism ──
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  for (var ti = 0; ti < 20; ti++) {
    // Deterministic positions based on index (no random per frame)
    var ta = ti * 0.618 * Math.PI * 2; // golden angle spacing
    var td = (ti * 0.37 % 1) * r * 0.85;
    var tr2 = 0.5 + (ti % 3) * 0.4;
    ctx.beginPath();
    ctx.arc(Math.cos(ta) * td, Math.sin(ta) * td, tr2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Moon phase — smooth crescent shadow ──
  var phaseCycle = (worldTime * 0.0033) % 1.0;
  var phaseAngle = phaseCycle * Math.PI * 2;
  var shadowOffset = Math.cos(phaseAngle) * r * 1.15;

  // Soft shadow using gradient rather than hard edge
  var phaseGrad = ctx.createLinearGradient(shadowOffset - r * 0.3, 0, shadowOffset + r * 0.3, 0);
  phaseGrad.addColorStop(0, 'rgba(10,10,20,0)');
  phaseGrad.addColorStop(0.4, 'rgba(10,10,20,0.45)');
  phaseGrad.addColorStop(1, 'rgba(10,10,20,0.55)');
  ctx.fillStyle = phaseGrad;
  // Draw the shadow on the unlit half
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI * 0.5, Math.PI * 0.5, false);
  ctx.arc(shadowOffset, 0, r, Math.PI * 0.5, -Math.PI * 0.5, false);
  ctx.closePath();
  ctx.fill();

  ctx.restore(); // undo clip

  // ── Limb darkening (subtle edge shadow all around) ──
  var limbGrad = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r);
  limbGrad.addColorStop(0, 'rgba(0,0,0,0)');
  limbGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = limbGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // ── Specular highlight on the lit side ──
  ctx.fillStyle = 'rgba(255,255,245,0.09)';
  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.28, r * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// Draw a faint shadow on Mars surface when Phobos passes overhead
function drawPhobosShadow() {
  for (var i = 0; i < celestialBodies.length; i++) {
    var body = celestialBodies[i];
    if (body.name !== 'phobos') continue;

    var shadowX, shadowGY;
    var shadowW = 30 + Math.sin(worldTime * 0.8) * 5;
    var shadowH = 6;

    if (curveActive && body.orbitRadiusFactor) {
      // Orbital mode: project Phobos angular position onto the planet surface
      var orbAngle = ((worldTime + body.phase) / body.orbitPeriod) * Math.PI * 2;
      // Shadow is at the surface point directly below the moon
      // Convert orbit angle to surface physX: the orbital angle maps to a point on the surface
      var shadowPhysX = orbAngle * curveRadius;
      shadowX = toCanvasX(shadowPhysX);
      shadowGY = groundYAtPhysX(shadowPhysX);
      // Scale shadow with zoom
      shadowW = Math.max(6, curveRadiusPx * 0.015);
      shadowH = Math.max(2, shadowW * 0.2);
    } else {
      var offset = parallaxOffset(PARALLAX_GROUND);
      var xFrac = ((worldTime + body.phase) / body.orbitPeriod) % 1.3 - 0.15;
      if (xFrac < -0.05 || xFrac > 1.05) continue;
      shadowX = xFrac * W - offset;
      shadowGY = groundY + 1;
    }

    // Skip if fully off screen
    if (shadowX < -shadowW * 2 || shadowX > W + shadowW * 2) continue;

    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowGY, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCraterFieldFeature() {
  var offset = parallaxOffset(PARALLAX_GROUND);
  for (var i = 0; i < craterFieldData.length; i++) {
    var c = craterFieldData[i];
    var cx = wrapX(c.x * W - offset, c.r * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(cx, groundY+2, c.r, c.r*0.35, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.ellipse(cx, groundY+1, c.r*0.7, c.r*0.22, 0, 0, Math.PI*2);
    ctx.fill();
  }
}

function drawPlutoFeatures(planet, skipSurface) {
  if (!skipSurface) {
    drawMountains(planet);
    drawCraterFieldFeature();
    return;
  }
  if (!curveActive || curveRadiusPx < 18) return;
  // A small, soft Tombaugh Regio gives the distant disc Pluto's recognisable heart.
  ctx.save();
  ctx.beginPath();
  ctx.arc(curveCentreX, curveCentreY, curveRadiusPx, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(curveCentreX - curveRadiusPx * .18, curveCentreY - curveRadiusPx * .22);
  ctx.rotate(-.24);
  var size = curveRadiusPx * .26;
  ctx.beginPath();
  ctx.moveTo(0, size * .3);
  ctx.bezierCurveTo(-size * 1.15, -size * .42, -size * .65, -size * 1.25, 0, -size * .62);
  ctx.bezierCurveTo(size * .65, -size * 1.25, size * 1.15, -size * .42, 0, size * .3);
  ctx.fillStyle = 'rgba(237,229,209,.5)';
  ctx.fill();
  ctx.restore();
}

function drawGanymedeJupiter() {
  var r = clamp(Math.min(W, baseGroundY) * .085, 28, 72);
  var offset = parallaxOffset(PARALLAX_STARS);
  var x = W * .79 - offset;
  var y = baseGroundY * .2 + parallaxOffsetY(PARALLAX_STARS);
  ctx.save();
  ctx.shadowColor = 'rgba(225,190,135,.2)';
  ctx.shadowBlur = r * .55;
  ctx.fillStyle = '#cfa783';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  var bands: [number, number, string][] = [
    [-.72, .19, '#e3c7a1'], [-.43, .15, '#a86f58'], [-.2, .19, '#e8d1ad'],
    [.05, .14, '#bd8063'], [.28, .18, '#efd9b5'], [.55, .13, '#9f6857']
  ];
  for (var i = 0; i < bands.length; i++) {
    var band = bands[i];
    ctx.fillStyle = band[2];
    ctx.fillRect(x - r, y + band[0] * r, r * 2, band[1] * r);
  }
  ctx.fillStyle = '#a85845';
  ctx.beginPath(); ctx.ellipse(x + r * .34, y + r * .28, r * .22, r * .095, -.08, 0, Math.PI * 2); ctx.fill();
  var shade = ctx.createLinearGradient(x - r, y, x + r, y);
  shade.addColorStop(0, 'rgba(255,255,255,.18)');
  shade.addColorStop(.55, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(20,18,28,.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(244,224,191,.48)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawGanymedeIce() {
  var offset = parallaxOffset(PARALLAX_GROUND);
  ctx.save();
  ctx.strokeStyle = 'rgba(163,217,226,.5)';
  ctx.fillStyle = 'rgba(205,235,236,.38)';
  ctx.lineWidth = 2;
  for (var i = 0; i < 11; i++) {
    var x = wrapX(i * W / 10 - offset, 35);
    var height = 8 + (i * 7 % 18);
    ctx.beginPath();
    ctx.moveTo(x - 25, groundY + 1);
    ctx.lineTo(x - 10, groundY - height * .35);
    ctx.lineTo(x, groundY - height);
    ctx.lineTo(x + 9, groundY - height * .42);
    ctx.lineTo(x + 25, groundY + 1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(101,166,182,.55)';
  ctx.lineWidth = 1.4;
  for (var j = 0; j < 8; j++) {
    var crackX = wrapX(j * W / 7 + 31 - offset, 25);
    ctx.beginPath();
    ctx.moveTo(crackX, groundY - 1);
    ctx.lineTo(crackX + 7, groundY - 9);
    ctx.lineTo(crackX + 3, groundY - 16);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSolarProminences() {
  ctx.save();
  ctx.lineCap = 'round';
  // Crossfade between the horizon prominences and the rim loops as the view
  // pulls back, so neither pops in or out when curvature first activates.
  var rimAlpha = curveActive && curveRadiusPx > 10 ? Math.min(1, Math.max(0, (planetViewFrac - .1) / .3)) : 0;
  var flatAlpha = 1 - Math.min(1, Math.max(0, planetViewFrac / .3));
  if (rimAlpha > 0) {
    ctx.globalAlpha = rimAlpha;
    for (var i = 0; i < 6; i++) {
      var angle = -Math.PI * .92 + i * Math.PI * .37 + Math.sin(worldTime * .11 + i) * .03;
      var x = curveCentreX + Math.cos(angle) * curveRadiusPx;
      var y = curveCentreY + Math.sin(angle) * curveRadiusPx;
      var loop = Math.max(4, curveRadiusPx * (.08 + (i % 3) * .018));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.strokeStyle = 'rgba(255,193,68,.48)';
      ctx.lineWidth = Math.max(1.5, curveRadiusPx * .012);
      ctx.beginPath();
      ctx.bezierCurveTo(-loop, -loop * .15, -loop * .72, -loop * 1.45, 0, -loop * 1.2);
      ctx.bezierCurveTo(loop * .72, -loop * 1.45, loop, -loop * .15, 0, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (flatAlpha > 0) {
    ctx.globalAlpha = flatAlpha;
    var glow = ctx.createLinearGradient(0, groundY - 105, 0, groundY);
    glow.addColorStop(0, 'rgba(255,188,54,0)');
    glow.addColorStop(1, 'rgba(255,211,91,.35)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, Math.max(0, groundY - 105), W, 105);
    for (var j = 0; j < 5; j++) {
      var baseX = ((j + .35) / 5) * W;
      var height = 21 + (j % 3) * 13 + Math.sin(worldTime * 1.4 + j) * 4;
      ctx.strokeStyle = 'rgba(255,224,116,.45)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(baseX - 15, groundY + 2);
      ctx.bezierCurveTo(baseX - 18, groundY - height, baseX + 18, groundY - height, baseX + 15, groundY + 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ── Ground Drawing ─────────────────────────────────────────────────────────
function drawGround() {
  if (env.solidness > 0.01) drawSolidGround(env.solidness);
  if (env.solidness < 0.99) drawGasGround(1 - env.solidness);
}

function drawSolidGround(alpha) {
  ctx.globalAlpha = alpha;
  var zr = Math.min(1, currentPPM / DEFAULT_PPM);
  var surfDepth = Math.max(8, 40 * zr);
  var edgeAmp = 3 * zr;
  var edgeAmp2 = 2 * zr;

  if (curveActive) {
    // ── Curved ground: planet disc with concentric layers ──
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    // Subsurface fill (deepest layer) — full disc interior
    var subGrad = ctx.createRadialGradient(
      curveCentreX, curveCentreY, curveRadiusPx * 0.85,
      curveCentreX, curveCentreY, curveRadiusPx * 0.98);
    subGrad.addColorStop(0, rgb(env.subBot));
    subGrad.addColorStop(1, rgb(env.subTop));
    ctx.fillStyle = subGrad;
    ctx.beginPath();
    ctx.arc(curveCentreX, curveCentreY, curveRadiusPx, 0, Math.PI * 2);
    ctx.fill();

    // Surface band (annulus from Rpx to Rpx - surfDepthPx)
    var surfGrad = ctx.createRadialGradient(
      curveCentreX, curveCentreY, curveRadiusPx - surfDepth,
      curveCentreX, curveCentreY, curveRadiusPx);
    surfGrad.addColorStop(0, rgb(env.groundBot));
    surfGrad.addColorStop(1, rgb(env.groundTop));
    ctx.fillStyle = surfGrad;
    ctx.beginPath();
    ctx.arc(curveCentreX, curveCentreY, curveRadiusPx, 0, Math.PI * 2);
    ctx.arc(curveCentreX, curveCentreY, Math.max(0, curveRadiusPx - surfDepth), 0, Math.PI * 2, true);
    ctx.fill();

    // Edge ripple — skip at whole-planet zoom (detail invisible)
    if (planetViewFrac < 0.5) {
    var groundOff = parallaxOffset(PARALLAX_GROUND);
    ctx.fillStyle = rgb(env.surfEdge);
    ctx.beginPath();
    var STEP = 10;
    // Use worldToScreen to trace the arc and add ripple in the radial direction
    for (var sx = -STEP; sx <= W + STEP; sx += STEP) {
      // Invert screen X to get approximate physX
      var approxPhysX = cameraX + (sx - 0) / currentPPM;
      var gPt = worldToScreen(approxPhysX, 0);
      // Ripple amplitude in radial direction
      var wx = sx + groundOff;
      var ripple = edgeAmp * Math.sin(wx * 0.05) + edgeAmp2 * Math.sin(wx * 0.13);
      // Normal direction: from planet centre through the surface point
      var nx = gPt.sx - curveCentreX;
      var ny = gPt.sy - curveCentreY;
      var nl = Math.sqrt(nx * nx + ny * ny) || 1;
      nx /= nl; ny /= nl;
      if (sx === -STEP) ctx.moveTo(gPt.sx - nx * ripple, gPt.sy - ny * ripple);
      else ctx.lineTo(gPt.sx - nx * ripple, gPt.sy - ny * ripple);
    }
    // Close the edge ripple band by tracing a thin strip just below surface
    for (var sx2 = W + STEP; sx2 >= -STEP; sx2 -= STEP) {
      var approxPhysX2 = cameraX + (sx2 - 0) / currentPPM;
      var gPt2 = worldToScreen(approxPhysX2, 0);
      var nx2 = gPt2.sx - curveCentreX;
      var ny2 = gPt2.sy - curveCentreY;
      var nl2 = Math.sqrt(nx2 * nx2 + ny2 * ny2) || 1;
      ctx.lineTo(gPt2.sx + (nx2 / nl2) * Math.max(2, 6 * zr), gPt2.sy + (ny2 / nl2) * Math.max(2, 6 * zr));
    }
    ctx.closePath();
    ctx.fill();
    } // end skip edge ripple LOD

    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }

  // ── Flat ground (original) ──
  var grad = ctx.createLinearGradient(0, groundY, 0, groundY + surfDepth);
  grad.addColorStop(0, rgb(env.groundTop));
  grad.addColorStop(1, rgb(env.groundBot));
  ctx.fillStyle = grad;
  ctx.fillRect(0, groundY, W, surfDepth);

  var groundOff = parallaxOffset(PARALLAX_GROUND);
  ctx.fillStyle = rgb(env.surfEdge);
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (var x = 0; x <= W; x += 10) {
    var wx = x + groundOff;
    ctx.lineTo(x, groundY - edgeAmp*Math.sin(wx*0.05) - edgeAmp2*Math.sin(wx*0.13));
  }
  ctx.lineTo(W, groundY + Math.max(2, 6 * zr));
  ctx.lineTo(0, groundY + Math.max(2, 6 * zr));
  ctx.closePath();
  ctx.fill();

  var grad2 = ctx.createLinearGradient(0, groundY + surfDepth, 0, H);
  grad2.addColorStop(0, rgb(env.subTop));
  grad2.addColorStop(1, rgb(env.subBot));
  ctx.fillStyle = grad2;
  ctx.fillRect(0, groundY + surfDepth, W, H - groundY - surfDepth);
  ctx.globalAlpha = 1;
}

function drawGasGround(alpha) {
  ctx.globalAlpha = alpha;

  if (curveActive) {
    // ── Curved gas ground: planet disc with radial gradient ──
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    var gasGrad = ctx.createRadialGradient(
      curveCentreX, curveCentreY, curveRadiusPx * 0.7,
      curveCentreX, curveCentreY, curveRadiusPx);
    gasGrad.addColorStop(0, rgb(env.subBot));
    gasGrad.addColorStop(0.5, rgb(env.groundBot));
    gasGrad.addColorStop(1, rgb(env.groundTop));
    ctx.fillStyle = gasGrad;
    ctx.beginPath();
    ctx.arc(curveCentreX, curveCentreY, curveRadiusPx, 0, Math.PI * 2);
    ctx.fill();

    // Turbulent edge — skip at whole-planet zoom
    if (planetViewFrac < 0.5) {
    var gasGroundOff = parallaxOffset(PARALLAX_GROUND);
    ctx.fillStyle = rgb(env.surfEdge);
    ctx.beginPath();
    var STEP = 8;
    for (var sx = -STEP; sx <= W + STEP; sx += STEP) {
      var approxPhysX = cameraX + (sx - 0) / currentPPM;
      var gPt = worldToScreen(approxPhysX, 0);
      var wx = sx + gasGroundOff;
      var turb = Math.sin(wx * 0.03 + worldTime * 1.8) * 5
               + Math.sin(wx * 0.07 + worldTime * 1.3) * 3
               + Math.sin(wx * 0.15 + worldTime * 2.5) * 2;
      var nx = gPt.sx - curveCentreX;
      var ny = gPt.sy - curveCentreY;
      var nl = Math.sqrt(nx * nx + ny * ny) || 1;
      var px = gPt.sx + (nx / nl) * turb;
      var py = gPt.sy + (ny / nl) * turb;
      if (sx === -STEP) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    // Close back through a thin band inward
    for (var sx2 = W + STEP; sx2 >= -STEP; sx2 -= STEP) {
      var approxPhysX2 = cameraX + (sx2 - 0) / currentPPM;
      var gPt2 = worldToScreen(approxPhysX2, 0);
      var nx2 = gPt2.sx - curveCentreX;
      var ny2 = gPt2.sy - curveCentreY;
      var nl2 = Math.sqrt(nx2 * nx2 + ny2 * ny2) || 1;
      ctx.lineTo(gPt2.sx + (nx2 / nl2) * 12, gPt2.sy + (ny2 / nl2) * 12);
    }
    ctx.closePath();
    ctx.fill();
    } // end skip turbulent edge LOD

    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }

  // ── Flat gas ground (original) ──
  var grad = ctx.createLinearGradient(0, groundY, 0, H);
  grad.addColorStop(0, rgb(env.groundTop));
  grad.addColorStop(0.5, rgb(env.groundBot));
  grad.addColorStop(1, rgb(env.subBot));
  ctx.fillStyle = grad;
  ctx.fillRect(0, groundY-5, W, H-groundY+5);

  var gasGroundOff = parallaxOffset(PARALLAX_GROUND);
  ctx.fillStyle = rgb(env.surfEdge);
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (var x = 0; x <= W; x += 8) {
    var wx = x + gasGroundOff;
    var turb = Math.sin(wx*0.03+worldTime*1.8)*5
             + Math.sin(wx*0.07+worldTime*1.3)*3
             + Math.sin(wx*0.15+worldTime*2.5)*2;
    ctx.lineTo(x, groundY+turb);
  }
  ctx.lineTo(W, groundY+12);
  ctx.lineTo(0, groundY+12);
  ctx.closePath();
  ctx.fill();

  for (var i = 0; i < gasSwirls.length; i++) {
    var s = gasSwirls[i];
    var bandY = groundY + s.yFrac*(H-groundY);
    var shift = Math.sin(worldTime*0.5+s.phase)*2;
    var col = [
      clamp(env.groundTop[0]+s.colShift, 0, 255),
      clamp(env.groundTop[1]+s.colShift, 0, 255),
      clamp(env.groundTop[2]+s.colShift, 0, 255)
    ];
    ctx.fillStyle = rgba(col, 0.25);
    ctx.beginPath();
    ctx.moveTo(0, bandY+shift);
    for (var x2 = 0; x2 <= W; x2 += 10) {
      var wx2 = x2 + gasGroundOff;
      ctx.lineTo(x2, bandY+shift + Math.sin(wx2*s.freq+worldTime*0.7)*s.amp);
    }
    ctx.lineTo(W, bandY+shift+8);
    ctx.lineTo(0, bandY+shift+8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── Cannon Mound ───────────────────────────────────────────────────────────
function drawMound() {
  // LOD: invisible at whole-planet scale
  if (planetViewFrac > 0.5) return;
  var px = toCanvasX(CANNON_BASE_X_M);
  var py = groundYAtPhysX(CANNON_BASE_X_M);
  var mw = Math.max(25, 0.9*currentPPM);
  var mh = Math.max(6, mw*0.28);
  var tilt = surfaceNormalAngle(CANNON_BASE_X_M);
  ctx.fillStyle = rgb(env.moundCol);
  ctx.beginPath();
  ctx.ellipse(px, py, mw, mh, tilt, 0, Math.PI*2);
  ctx.fill();
}

// ── Cannon (side elevation) ───────────────────────────────────────────────
function drawCannon(angleDeg, recoilOffset) {
  var pivot = toCanvas(CANNON_BASE_X_M,CANNON_BASE_Y_M);
  var base = toCanvas(CANNON_BASE_X_M,0);
  var s = currentPPM;
  if (s < 6) {
    ctx.save();ctx.fillStyle='#efc66b';ctx.beginPath();ctx.arc(base.x,base.y,4,0,Math.PI*2);ctx.fill();ctx.restore();return;
  }
  ctx.save();ctx.translate(pivot.x,pivot.y);
  ctx.rotate(surfaceNormalAngle(CANNON_BASE_X_M));
  ctx.strokeStyle='#2d4249';ctx.lineWidth=Math.max(1.5,s*.024);
  ctx.lineCap='round';ctx.lineJoin='round';
  // A sturdy field carriage: warm timber, a cream mounting plate and brass hubs.
  ctx.beginPath();ctx.moveTo(-s*.33,-s*.08);ctx.lineTo(s*.24,-s*.08);
  ctx.lineTo(s*.75,s*.70);ctx.lineTo(-s*.65,s*.70);ctx.closePath();
  var timber=ctx.createLinearGradient(0,-s*.08,0,s*.7);
  timber.addColorStop(0,'#c3a374');timber.addColorStop(1,'#8c6947');
  ctx.fillStyle=timber;ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(-s*.23,s*.12);ctx.lineTo(-s*.4,s*.52);
  ctx.lineTo(s*.47,s*.52);ctx.lineTo(s*.2,s*.12);ctx.closePath();
  ctx.fillStyle='#765c42';ctx.fill();
  ctx.strokeStyle='#d1b180';ctx.lineWidth=Math.max(1,s*.022);
  ctx.beginPath();ctx.moveTo(-s*.1,s*.06);ctx.lineTo(s*.4,s*.61);ctx.stroke();
  ctx.beginPath();ctx.moveTo(s*.11,s*.05);ctx.lineTo(-s*.4,s*.61);ctx.stroke();
  ctx.strokeStyle='#2d4249';ctx.lineWidth=Math.max(1.5,s*.024);
  [-.37,.44].forEach(wx=>{
    var y=s*.63,r=s*.35;
    ctx.beginPath();ctx.arc(wx*s,y,r,0,Math.PI*2);ctx.fillStyle='#445450';ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.arc(wx*s,y,r*.78,0,Math.PI*2);ctx.fillStyle='#617066';ctx.fill();
    ctx.strokeStyle='#d0ac70';ctx.lineWidth=Math.max(1.5,s*.05);ctx.stroke();
    for(var i=0;i<8;i++){
      var t=i*Math.PI/4;
      ctx.strokeStyle='#283e43';ctx.lineWidth=Math.max(1.5,s*.065);
      ctx.beginPath();ctx.moveTo(wx*s,y);ctx.lineTo(wx*s+Math.cos(t)*r*.72,y+Math.sin(t)*r*.72);ctx.stroke();
      ctx.strokeStyle='#d0ac70';ctx.lineWidth=Math.max(1,s*.034);ctx.stroke();
    }
    ctx.strokeStyle='#2d4249';ctx.lineWidth=Math.max(1.5,s*.024);
    ctx.beginPath();ctx.arc(wx*s,y,r*.23,0,Math.PI*2);ctx.fillStyle='#edc775';ctx.fill();ctx.stroke();
    ctx.fillStyle='#52605a';ctx.beginPath();ctx.arc(wx*s,y,r*.07,0,Math.PI*2);ctx.fill();
  });
  ctx.save();ctx.rotate(-angleDeg*Math.PI/180);
  var length=BARREL_LENGTH_M*s;
  var shift=-(recoilOffset||0);
  var start=-s*.25+shift,end=length+shift;
  var rearHalf=s*.195,frontHalf=s*.15;
  var steel=ctx.createLinearGradient(0,-rearHalf,0,rearHalf);
  steel.addColorStop(0,'#64818b');steel.addColorStop(.24,'#3d5d70');
  steel.addColorStop(.7,'#2d485c');steel.addColorStop(1,'#203a4c');
  ctx.beginPath();ctx.moveTo(start,-rearHalf);
  ctx.bezierCurveTo(start-s*.2,-rearHalf,start-s*.2,rearHalf,start,rearHalf);
  ctx.lineTo(end,frontHalf);ctx.lineTo(end,-frontHalf);ctx.closePath();
  ctx.fillStyle=steel;ctx.fill();ctx.stroke();
  ctx.strokeStyle='#9bb0af';ctx.lineWidth=Math.max(.7,s*.012);
  ctx.beginPath();ctx.moveTo(start+s*.09,-rearHalf*.65);
  ctx.lineTo(end-s*.17,-frontHalf*.67);ctx.stroke();

  // Reinforcing bands project as straight strips in a true side view.
  var brass=ctx.createLinearGradient(0,-rearHalf,0,rearHalf);
  brass.addColorStop(0,'#f1d28e');brass.addColorStop(.55,'#d7ac60');brass.addColorStop(1,'#af8146');
  ctx.strokeStyle='#2d4249';ctx.lineWidth=Math.max(1,s*.018);
  [[start+s*.1,s*.09,rearHalf+s*.018],[end-s*.13,s*.13,frontHalf+s*.035]].forEach(band=>{
    ctx.beginPath();ctx.rect(band[0],-band[2],band[1],band[2]*2);
    ctx.fillStyle=brass;ctx.fill();ctx.stroke();
  });
  // The muzzle is edge-on: no ellipse, bore opening or visible end face.
  ctx.lineCap='butt';ctx.strokeStyle='#203744';ctx.lineWidth=Math.max(1,s*.025);
  ctx.beginPath();ctx.moveTo(end,-frontHalf-s*.035);ctx.lineTo(end,frontHalf+s*.035);ctx.stroke();
  ctx.restore();
  ctx.beginPath();ctx.arc(0,0,s*.16,0,Math.PI*2);ctx.fillStyle='#f0c878';ctx.fill();
  ctx.strokeStyle='#304b53';ctx.lineWidth=Math.max(1.5,s*.025);ctx.stroke();
  ctx.beginPath();ctx.arc(0,0,s*.052,0,Math.PI*2);ctx.fillStyle='#304e64';ctx.fill();
  if(s>32){ctx.strokeStyle='#9bb0af';ctx.lineWidth=s*.015;
    ctx.beginPath();ctx.moveTo(-s*.028,-s*.018);ctx.lineTo(s*.028,s*.018);ctx.stroke();}
  ctx.restore();
}

// ── Cannonball ─────────────────────────────────────────────────────────────
function drawBall(physX, physY, squashX, squashY) {
  var sx = squashX || 1, sy = squashY || 1;
  var pt = toCanvas(physX, physY);
  var cx = pt.x, cy = pt.y;
  var r = Math.max(3, BALL_RADIUS_M*currentPPM);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(sx, sy);

  var grad = ctx.createRadialGradient(-r*.3,-r*.35,r*.08,0,0,r);
  grad.addColorStop(0, '#a5b7b7');
  grad.addColorStop(0.45, '#486573');
  grad.addColorStop(1, '#203846');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
  var skyLum = env.skyMid[0]*.299+env.skyMid[1]*.587+env.skyMid[2]*.114;
  ctx.strokeStyle = skyLum < 100 || planetViewFrac > .35 ? '#f2d693' : '#263e49';
  ctx.lineWidth = Math.max(1,r*.12);ctx.stroke();

  ctx.fillStyle = 'rgba(255,250,229,.65)';
  ctx.beginPath();ctx.arc(-r*.3,-r*.35,r*.18,0,Math.PI*2);ctx.fill();

  ctx.restore();
}

function drawLandedBall(physX) { drawBall(physX, 0.02, 1.0, 0.7); }

// ── Trajectory Dots ────────────────────────────────────────────────────────
function getTrailColour() {
  // Pick a colour that contrasts the sky midpoint
  var sm = env.skyMid;
  var lum = sm[0]*0.299 + sm[1]*0.587 + sm[2]*0.114;
  if (lum > 140) {
    // Light sky → dark warm trail
    return [60, 20, 10];
  } else if (lum > 80) {
    // Mid sky → bright orange trail
    return [255, 166, 35];
  } else {
    // Dark sky → bright yellow/white trail
    return [255, 230, 120];
  }
}

function drawTrajectoryDot(physX, physY) {
  var r = Math.max(1.5, currentPPM*0.03);
  var c = getTrailColour();
  ctx.fillStyle = 'rgba('+c[0]+','+c[1]+','+c[2]+',0.6)';
  ctx.beginPath();
  var _td = toCanvas(physX, physY);
  ctx.arc(_td.x, _td.y, r, 0, Math.PI*2);
  ctx.fill();
}

// ── Flags ──────────────────────────────────────────────────────────────────
function drawFlag(physX, shotNumber, springProgress) {
  var position = toCanvas(physX,0);
  var sp = (typeof springProgress === 'number') ? clamp(springProgress,0,1) : 1;
  var maxH = Math.max(22, 0.65*currentPPM);
  var flagH = maxH * sp;
  if (sp < 1) flagH = maxH*(1 - Math.pow(1-sp,3)*Math.cos(sp*Math.PI*3));

  ctx.save();ctx.translate(position.x,position.y);ctx.rotate(surfaceNormalAngle(physX));
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle = '#354d50';
  ctx.lineWidth = Math.max(1.5, currentPPM*0.02);
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-flagH);ctx.stroke();

  if (flagH > 8) {
    var pW = Math.max(16, 0.3*currentPPM);
    var pH = Math.max(12,pW*.62);
    ctx.fillStyle = '#b9674d';
    ctx.beginPath();ctx.moveTo(1,-flagH);
    ctx.lineTo(pW,-flagH+pH*.1);ctx.lineTo(pW*.8,-flagH+pH*.5);
    ctx.lineTo(pW,-flagH+pH*.9);ctx.lineTo(1,-flagH+pH);ctx.closePath();
    ctx.fill();ctx.lineWidth=1;ctx.stroke();
    ctx.strokeStyle='rgba(255,237,198,.45)';
    ctx.beginPath();ctx.moveTo(3,-flagH+2);ctx.lineTo(pW-3,-flagH+pH*.1+2);ctx.stroke();
    if (flagH > 18) {
      ctx.fillStyle = '#fff5d9';
      ctx.font = '600 '+Math.max(8,Math.min(12,currentPPM*.11))+'px system-ui, sans-serif';
      ctx.textAlign = 'center';ctx.textBaseline='middle';
      ctx.fillText(String(shotNumber),pW*.4,-flagH+pH*.52,pW*.62);
    }
  }
  ctx.restore();
}

// ── Craters (solid planets) ────────────────────────────────────────────────
function drawCrater(physX) {
  var cx = toCanvasX(physX), cy = groundYAtPhysX(physX)+2;
  var r1 = Math.max(8, 0.2*currentPPM);
  ctx.fillStyle = rgba(env.subBot, 0.8);
  ctx.beginPath(); ctx.ellipse(cx,cy,r1,r1*0.32,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = rgba(env.subTop, 0.6);
  ctx.beginPath(); ctx.ellipse(cx,cy-1,r1*0.7,r1*0.2,0,0,Math.PI*2); ctx.fill();
}

// ── Gas Hole (gas giants) ──────────────────────────────────────────────────
function drawGasHole(physX) {
  var cx = toCanvasX(physX), cy = groundYAtPhysX(physX)+2;
  var r = Math.max(10, 0.28*currentPPM);

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(cx,cy,r*1.3,r*0.45,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(cx,cy,r*0.8,r*0.3,0,0,Math.PI*2); ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = Math.max(1, currentPPM*0.015);
  for (var i = 0; i < 3; i++) {
    var sr = r*(0.5+i*0.3);
    var sa = worldTime*1.8 + i*Math.PI*0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, sr, sa, sa+Math.PI*0.45);
    ctx.stroke();
  }
}

// ── Particles ──────────────────────────────────────────────────────────────
function drawParticles(particles) {
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    if (p.life <= 0) continue;
    ctx.globalAlpha = Math.max(0, p.life/p.maxLife);
    ctx.fillStyle = p.colour;
    ctx.beginPath();
    var _pp = toCanvas(p.x, p.y);
    ctx.arc(_pp.x, _pp.y,
            Math.max(1, p.radius*currentPPM/DEFAULT_PPM), 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── Muzzle Flash ───────────────────────────────────────────────────────────
function drawMuzzleFlash(angleDeg, progress) {
  if (progress <= 0 || progress > 1) return;
  var tip = getCannonTipPhys(angleDeg);
  var _tp = toCanvas(tip.x, tip.y);
  var tipCX = _tp.x, tipCY = _tp.y;
  var rad = angleDeg * Math.PI / 180;
  var size = (1-progress) * Math.max(15, 0.4*currentPPM) + 5;

  ctx.save();
  ctx.translate(tipCX, tipCY);
  ctx.rotate(-rad);
  ctx.globalAlpha = 1-progress;

  var cols = ['#ffdd44','#ffaa22','#ff6600','#ffdd44','#ff8833'];
  for (var i = 0; i < 5; i++) {
    var a = (i/5)*Math.PI - Math.PI/2;
    ctx.fillStyle = cols[i];
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(Math.cos(a)*size*0.7+size*0.5, Math.sin(a)*size*0.6);
    ctx.lineTo(Math.cos(a+0.3)*size*0.3+size*0.3, Math.sin(a+0.3)*size*0.3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Barrel Crew Stickmen ───────────────────────────────────────────────────
// Tiny construction-worker stickmen that appear during barrel-length changes.
// Each stickman is ~0.76 m tall in physics units. Poses are parametric on timer.

function drawStickman(physX, physY, poseData) {
  if(currentPPM<16)return;
  var point=toCanvas(physX,physY);
  var pose=poseData.pose||'idle';
  var size=currentPPM*.76;
  drawCrew(ctx,point.x,point.y,size,{
    type:'worker',
    state:pose==='running'?'running_away':pose==='panicked'?'startled':pose,
    stateTimer:poseData.timer||0,
    direction:poseData.direction||1
  });
  ctx.save();ctx.translate(point.x,point.y);ctx.scale(size/100,size/100);
  ctx.strokeStyle='#2d4249';ctx.lineWidth=2;ctx.lineCap='round';
  if(pose==='carrying'){
    ctx.beginPath();ctx.roundRect(-34,-118,65,13,3);ctx.fillStyle='#3c6070';ctx.fill();ctx.stroke();
    ctx.fillStyle='#e9bd6b';ctx.fillRect(-28,-118,5,13);ctx.fillRect(20,-118,5,13);
  } else if(pose==='screwing'){
    ctx.save();ctx.translate(28,-37);ctx.rotate(Math.sin((poseData.timer||0)*8)*.4);
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(11,-22);ctx.lineTo(17,-24);ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}


// ── Comic Characters ────────────────────────────────────────────────────────
// Characters walk on solid ground or drift above a cloud deck in physics space.
// State machine is managed by main.ts; renderer just draws based on the state object.

function drawCharacter(char) {
  if (!char || !char.visible) return;

  var position = toCanvas(char.x, Number.isFinite(char.y) ? char.y : 0);
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(surfaceNormalAngle(char.x));
  drawCharacterSprite(0, 0, currentPPM, char);
  ctx.restore();
}

function drawCharacterSprite(cx, cy, s, char) {

  // Normalize rocket_startled to startled for drawing purposes
  // (visually identical, only duration differs — handled in main.ts)
  var drawChar = char;
  if (char.state === 'rocket_startled') {
    drawChar = {};
    for (var k in char) {
      if (char.hasOwnProperty(k)) drawChar[k] = char[k];
    }
    drawChar.state = 'startled';
  }

  var isCrew = ['golfer','alien','spaceman','robot','icerobot'].includes(drawChar.type);
  if (isCrew) {
    drawCrew(ctx,cx,cy,s*1.32,drawChar);
  } else {
    // Guest rigs share the same foot anchor and shrink naturally with the world.
    switch (drawChar.type) {
      case 'newt':      drawNewt(ctx, cx, cy, s, drawChar); break;
      case 'icebear':   drawIceBear(ctx, cx, cy, s, drawChar); break;
      case 'squid':     drawGiantSquid(ctx, cx, cy, s, drawChar); break;
      case 'whale':     drawWhale(ctx, cx, cy, s, drawChar); break;
      case 'snowman':   drawSnowman(ctx, cx, cy, s, drawChar); break;
      case 'submarine': drawSubmarine(ctx, cx, cy, s, drawChar); break;
    }
  }
}


// ── Persistent character close-up, beneath the target readout ────────────────
function drawCharacterAside(char) {
  var speech = typeof char.bubbleText === 'string' ? char.bubbleText.trim() : '';
  if (char.banter !== false && speech) drawCharacterSpeech(speech);

  ctx.save();
  ctx.beginPath();ctx.arc(W-52,90,36,0,Math.PI*2);ctx.clip();
  ctx.fillStyle='rgba(255,249,233,.78)';ctx.fill();
  // Frame faces rather than shrinking wide bodies into the little round window.
  var framing = char.type === 'newt' ? { scale: 68, x: -26.35, footY: 122.3 }
    : char.type === 'snowman' ? { scale: 54, x: 0, footY: 147 }
    : char.type === 'icebear' ? { scale: 72, x: -.9, footY: 163.8 }
    : char.type === 'squid' ? { scale: 62, x: 0, footY: 137.3 }
    : char.type === 'whale' ? { scale: 54, x: -27.7, footY: 124.4 }
    : char.type === 'submarine' ? { scale: 65, x: -21.1, footY: 119.3 }
    : { scale: 43, x: 0, footY: 120 };
  // Keep their face visible even while the world sprite is flattened or out of view.
  var portrait = { ...char, portrait: true,
    state: !char.visible || char.state === 'squashed' ? 'idle' : char.state };
  if (['newt', 'icebear', 'squid', 'whale', 'submarine'].includes(char.type)) portrait.direction = 1;
  if (char.type === 'icebear') portrait.upright = false;
  if (['whale', 'submarine'].includes(char.type)) portrait.surfaceAmount = 1;
  drawCharacterSprite(W-52+framing.x,framing.footY,framing.scale,portrait);
  ctx.restore();
}

function drawCharacterSpeech(speech) {
  ctx.save();
  ctx.font = '500 13px system-ui, sans-serif';
  var maxWidth = Math.min(190, W - 112);
  var lines = [], current = '';
  for (var word of speech.split(/\s+/)) {
    var next = current ? current + ' ' + word : word;
    if (current && ctx.measureText(next).width > maxWidth - 24) {
      lines.push(current); current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  var bubbleW = Math.min(maxWidth,Math.max(64,...lines.map(line=>ctx.measureText(line).width+24)));
  var bubbleH = lines.length*18+18;
  var bx = W - 102 - bubbleW;
  var by = 56;
  ctx.fillStyle='rgba(255,249,233,.97)';
  ctx.strokeStyle='rgba(39,61,61,.55)';ctx.lineWidth=1.5;
  // One outline keeps the speech pointer joined cleanly to the bubble.
  ctx.beginPath();ctx.moveTo(bx+12,by);ctx.lineTo(bx+bubbleW-12,by);
  ctx.quadraticCurveTo(bx+bubbleW,by,bx+bubbleW,by+12);
  ctx.lineTo(bx+bubbleW,by+13);ctx.lineTo(bx+bubbleW+9,by+19);
  ctx.lineTo(bx+bubbleW,by+23);ctx.lineTo(bx+bubbleW,by+bubbleH-12);
  ctx.quadraticCurveTo(bx+bubbleW,by+bubbleH,bx+bubbleW-12,by+bubbleH);
  ctx.lineTo(bx+12,by+bubbleH);ctx.quadraticCurveTo(bx,by+bubbleH,bx,by+bubbleH-12);
  ctx.lineTo(bx,by+12);ctx.quadraticCurveTo(bx,by,bx+12,by);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#2d4145';ctx.textAlign='left';ctx.textBaseline='top';
  lines.forEach((line,i)=>ctx.fillText(line,bx+12,by+9+i*18));
  ctx.restore();
}

// ── Shockwave Ring ─────────────────────────────────────────────────────────
function drawShockwave(physX, progress) {
  if (progress <= 0 || progress > 1) return;
  var cx = toCanvasX(physX), cy = groundYAtPhysX(physX);
  var r = progress * Math.max(25, 0.6*currentPPM);
  ctx.strokeStyle = 'rgba(200,180,140,'+(1-progress)+')';
  ctx.lineWidth = Math.max(1.5, currentPPM*0.025);
  ctx.beginPath();
  ctx.ellipse(cx,cy,r,r*0.35,0,0,Math.PI*2);
  ctx.stroke();
}

// ── Launch Tower & Rocket ────────────────────────────────────────────────

// Visual constants (physics-space metres)
var TOWER_BASE_X_M   = 1.5;   // Same x as cannon base for camera consistency
var TOWER_HEIGHT_M   = 4.0;   // Lattice tower height
var PAD_WIDTH_M      = 2.2;   // Launch pad width
var PAD_HEIGHT_M     = 0.15;  // Launch pad thickness
var ROCKET_LENGTH_M  = 2.0;   // Full rocket nose-to-nozzle
var ROCKET_WIDTH_M   = 0.40;  // Body tube diameter
var NOZZLE_LENGTH_M  = 0.30;  // Base nozzle length (scales with ε)

/** Physical vehicle-centre position while its nozzle rests on the launch pad. */
function getRocketPadPosition(angleDeg, epsilon = 20) {
  var angle = angleDeg * Math.PI / 180;
  var nozzleLength = NOZZLE_LENGTH_M * Math.min(2,Math.max(.6,epsilon/20));
  var centreOffset = ROCKET_LENGTH_M * .5 + nozzleLength;
  return {
    x: TOWER_BASE_X_M + Math.cos(angle) * centreOffset,
    y: PAD_HEIGHT_M + Math.sin(angle) * centreOffset
  };
}

/**
 * drawLaunchTower(angleDeg)
 * Draws: launch pad, lattice truss tower angled at the launch angle,
 *        flame trench, and guide rail.
 */
function drawLaunchTower(angleDeg) {
  var s = currentPPM;
  var _tw = toCanvas(TOWER_BASE_X_M, 0);
  var baseX = _tw.x;
  var baseY = _tw.y;            // ground level
  var rad = angleDeg * Math.PI / 180;

  if (s < 3) {
    ctx.save();ctx.fillStyle='#e5bd6f';ctx.beginPath();
    ctx.arc(baseX,baseY,2.5,0,Math.PI*2);ctx.fill();ctx.restore();return;
  }

  // Surface-normal tilt for curved ground
  var tilt = surfaceNormalAngle(TOWER_BASE_X_M);
  if (tilt !== 0) {
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(tilt);
    ctx.translate(-baseX, -baseY);
  }

  // ── Launch Pad ──
  var padW = PAD_WIDTH_M * s;
  var padH = PAD_HEIGHT_M * s;
  var padGrad = ctx.createLinearGradient(0, baseY - padH, 0, baseY);
  padGrad.addColorStop(0, '#8f9e96');
  padGrad.addColorStop(1, '#536864');
  ctx.fillStyle = padGrad;
  ctx.fillRect(baseX - padW / 2, baseY - padH, padW, padH);
  // Pad edge highlight
  ctx.strokeStyle = '#b0b9a3';
  ctx.lineWidth = 1;
  ctx.strokeRect(baseX - padW / 2, baseY - padH, padW, padH);

  // Bolt details on pad
  ctx.fillStyle = '#d6b979';
  var boltR = s * 0.02;
  var boltY = baseY - padH / 2;
  for (var b = 0; b < 5; b++) {
    var boltX = baseX - padW * 0.4 + (padW * 0.8) * (b / 4);
    ctx.beginPath();
    ctx.arc(boltX, boltY, boltR, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Flame Trench ──
  var trenchW = 0.6 * s;
  var trenchD = 0.12 * s;
  ctx.fillStyle = 'rgba(20,18,15,0.7)';
  ctx.beginPath();
  ctx.ellipse(baseX, baseY + 1, trenchW / 2, trenchD, 0, 0, Math.PI);
  ctx.fill();

  // ── Tower Structure (lattice truss) ──
  var towerH = TOWER_HEIGHT_M * s;
  var railW = Math.max(3, 0.06 * s);      // half-width of lattice at base
  var railTop = Math.max(2, 0.03 * s);     // half-width at top

  ctx.save();
  ctx.translate(baseX, baseY - padH);
  // Rotate tower to point along launch direction
  // Tower is drawn upward (-y local); PI/2 - rad maps launch angle to canvas
  ctx.rotate(Math.PI / 2 - rad);

  // Offset lattice structure to the right of the guide rail
  // so the rocket visually leans against the tower when tilted
  var towerOff = railW * 1.2;

  // Two side rails (offset to the right)
  ctx.strokeStyle = '#b16b4c';
  ctx.lineWidth = Math.max(2, s * 0.035);
  // Left rail (near the guide rail)
  ctx.beginPath();
  ctx.moveTo(-railW + towerOff, 0);
  ctx.lineTo(-railTop + towerOff, -towerH);
  ctx.stroke();
  // Right rail (further right)
  ctx.beginPath();
  ctx.moveTo(railW + towerOff, 0);
  ctx.lineTo(railTop + towerOff, -towerH);
  ctx.stroke();

  // Cross-braces (diagonal lattice, also offset)
  ctx.strokeStyle = '#815c48';
  ctx.lineWidth = Math.max(1, s * 0.018);
  var numBraces = Math.max(4, Math.round(towerH / 25));
  for (var i = 0; i < numBraces; i++) {
    var frac0 = i / numBraces;
    var frac1 = (i + 1) / numBraces;
    var y0 = -towerH * frac0;
    var y1 = -towerH * frac1;
    var lw0 = railW + (railTop - railW) * frac0;
    var lw1 = railW + (railTop - railW) * frac1;
    // Alternating X pattern
    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.moveTo(-lw0 + towerOff, y0);
      ctx.lineTo(lw1 + towerOff, y1);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(lw0 + towerOff, y0);
      ctx.lineTo(-lw1 + towerOff, y1);
      ctx.stroke();
    }
    // Horizontal rung
    var hy = y1;
    var hw = railW + (railTop - railW) * frac1;
    ctx.beginPath();
    ctx.moveTo(-hw + towerOff, hy);
    ctx.lineTo(hw + towerOff, hy);
    ctx.stroke();
  }

  // ── Guide Rail (stays centred for the rocket to sit on) ──
  ctx.strokeStyle = '#e9dfc2';
  ctx.lineWidth = Math.max(1.5, s * 0.025);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -towerH);
  ctx.stroke();

  ctx.restore();
  if (tilt !== 0) ctx.restore();
}

/**
 * drawRocket(rocketState, angleDeg, epsilon)
 * rocketState: null / { phase:'pad' } / { phase:'flight', x, y, vx, vy, ... }
 * angleDeg: launch rail angle (used for 'pad' orientation)
 * epsilon: expansion ratio (for nozzle bell width)
 */
// Fizzle shake parameters
var SHAKE_AMPLITUDE = 0.02; // metres — subtle pixel jitter
var SHAKE_FREQUENCY = 30;   // Hz

function drawRocket(rocketState, angleDeg, epsilon) {
  var s = Math.max(currentPPM, 8);
  var eps = epsilon || 20;
  var phase = rocketState ? rocketState.phase : 'pad';

  var rocketLen = ROCKET_LENGTH_M * s;
  var rocketW = ROCKET_WIDTH_M * s;
  var nozzleLen = NOZZLE_LENGTH_M * s * Math.min(2.0, Math.max(0.6, eps / 20));
  var nozzleExitW = rocketW * 0.4 * Math.min(2.2, Math.max(0.7, Math.sqrt(eps / 10)));
  var nozzleThroatW = rocketW * 0.15;
  var noseLen = rocketLen * 0.22;
  var finLen = rocketLen * 0.18;
  var finH = rocketW * 0.55;

  // Determine position & rotation
  var cx, cy, rot;
  if (phase === 'flight' && rocketState.x !== undefined) {
    var _rp = toCanvas(rocketState.x, rocketState.y);
    cx = _rp.x;
    cy = _rp.y;
    // Attitude follows commanded thrust. Tangential velocity is a different vector.
    var heading = Number.isFinite(rocketState.theta) ? rocketState.theta * Math.PI / 180 : angleDeg * Math.PI / 180;
    rot = Math.PI - heading + surfaceNormalAngle(rocketState.x);
  } else {
    // On the pad / rail
    var rad = angleDeg * Math.PI / 180;
    var padPosition = getRocketPadPosition(angleDeg, eps);
    var _padPt = toCanvas(padPosition.x,padPosition.y);
    cx = _padPt.x;
    cy = _padPt.y;
    rot = Math.PI - rad + surfaceNormalAngle(padPosition.x);

    // ── Fizzle shake: jitter position while on pad ──
    if (phase === 'fizzle') {
      var shakeX = SHAKE_AMPLITUDE * s * Math.sin(worldTime * SHAKE_FREQUENCY * Math.PI * 2);
      var shakeY = SHAKE_AMPLITUDE * s * Math.cos(worldTime * SHAKE_FREQUENCY * Math.PI * 2 * 1.3);
      cx += shakeX;
      cy += shakeY;
    }
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  // Nose is local -x; the nozzle exit is bodyEnd + nozzleLen on local +x.
  var bodyStart = -rocketLen / 2 + noseLen;
  var bodyEnd = rocketLen / 2;

  // ── Fins (drawn first, behind body) ──
  ctx.fillStyle = '#d1844a';
  // Top fin
  ctx.beginPath();
  ctx.moveTo(bodyEnd - finLen, -rocketW / 2);
  ctx.lineTo(bodyEnd, -rocketW / 2);
  ctx.lineTo(bodyEnd - finLen * 0.3, -rocketW / 2 - finH);
  ctx.closePath();
  ctx.fill();
  // Bottom fin
  ctx.beginPath();
  ctx.moveTo(bodyEnd - finLen, rocketW / 2);
  ctx.lineTo(bodyEnd, rocketW / 2);
  ctx.lineTo(bodyEnd - finLen * 0.3, rocketW / 2 + finH);
  ctx.closePath();
  ctx.fill();

  // ── Nozzle bell ──
  ctx.fillStyle = '#354f5c';
  ctx.beginPath();
  ctx.moveTo(bodyEnd, -nozzleThroatW);
  ctx.lineTo(bodyEnd + nozzleLen, -nozzleExitW);
  ctx.lineTo(bodyEnd + nozzleLen, nozzleExitW);
  ctx.lineTo(bodyEnd, nozzleThroatW);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = Math.max(0.5, s * 0.008);
  ctx.stroke();

  // ── Body tube ──
  var bodyGrad = ctx.createLinearGradient(0, -rocketW / 2, 0, rocketW / 2);
  bodyGrad.addColorStop(0, '#fff6df');
  bodyGrad.addColorStop(0.3, '#fffaed');
  bodyGrad.addColorStop(0.7, '#e7ddc4');
  bodyGrad.addColorStop(1, '#c3c4b3');
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(bodyStart, -rocketW / 2, bodyEnd - bodyStart, rocketW);

  // Colour band (visual flair — changes with propellant family hint)
  var bandW = rocketLen * 0.08;
  var bandX = bodyStart + (bodyEnd - bodyStart) * 0.35;
  ctx.fillStyle = '#507481';
  ctx.fillRect(bandX, -rocketW / 2, bandW, rocketW);

  // Body outline
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(0.5, s * 0.008);
  ctx.strokeRect(bodyStart, -rocketW / 2, bodyEnd - bodyStart, rocketW);

  // ── Nose cone (ogive-ish) ──
  var noseGrad = ctx.createLinearGradient(0, -rocketW / 2, 0, rocketW / 2);
  noseGrad.addColorStop(0, '#7592a0');
  noseGrad.addColorStop(0.5, '#4d7184');
  noseGrad.addColorStop(1, '#2d4b5d');
  ctx.fillStyle = noseGrad;
  ctx.beginPath();
  ctx.moveTo(-rocketLen / 2, 0);
  // Bezier ogive shape
  ctx.bezierCurveTo(
    -rocketLen / 2 + noseLen * 0.3, -rocketW * 0.12,
    bodyStart - noseLen * 0.1, -rocketW / 2,
    bodyStart, -rocketW / 2
  );
  ctx.lineTo(bodyStart, rocketW / 2);
  ctx.bezierCurveTo(
    bodyStart - noseLen * 0.1, rocketW / 2,
    -rocketLen / 2 + noseLen * 0.3, rocketW * 0.12,
    -rocketLen / 2, 0
  );
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = Math.max(0.5, s * 0.008);
  ctx.stroke();

  // Nose tip highlight
  ctx.fillStyle = '#e9b765';
  ctx.beginPath();
  ctx.arc(-rocketLen / 2, 0, Math.max(2, rocketW * 0.12), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * drawExhaust(physX, physY, theta, thrustFrac)
 * Draws the engine exhaust plume at the nozzle position, oriented opposite
 * to the rocket's heading (theta in radians, measured from +x axis).
 * thrustFrac: 0-1, 0 = no exhaust, 1 = full thrust.
 */
function drawExhaust(physX, physY, theta, thrustFrac, epsilon = 20) {
  if (thrustFrac <= 0) return;
  var s = Math.max(currentPPM, 8);
  var _ep = toCanvas(physX, physY);
  var nozzleLength = NOZZLE_LENGTH_M * s * Math.min(2,Math.max(.6,epsilon/20));
  var exitOffset = ROCKET_LENGTH_M * s / 2 + nozzleLength;
  // Match drawRocket's nozzle anchor, including the local spherical frame.
  var screenHeading = theta - surfaceNormalAngle(physX);
  var cx = _ep.x - Math.cos(screenHeading) * exitOffset;
  var cy = _ep.y + Math.sin(screenHeading) * exitOffset;

  // Nozzle exit is behind the rocket (opposite to heading)
  var exhaustAngle = screenHeading + Math.PI;

  var plumeLenBase = ROCKET_LENGTH_M * 0.8 * s * thrustFrac;
  var plumeW = ROCKET_WIDTH_M * 0.35 * s;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-exhaustAngle);

  // ── Inner plume (bright core) ──
  var t = worldTime * 12;
  var flicker = 1 + 0.12 * Math.sin(t) + 0.08 * Math.sin(t * 2.7);
  var coreLen = plumeLenBase * 0.7 * flicker;
  var coreW = plumeW * 0.35;

  var coreGrad = ctx.createLinearGradient(0, 0, coreLen, 0);
  coreGrad.addColorStop(0, 'rgba(200,220,255,0.95)');
  coreGrad.addColorStop(0.3, 'rgba(255,255,200,0.85)');
  coreGrad.addColorStop(0.7, 'rgba(255,180,50,0.5)');
  coreGrad.addColorStop(1, 'rgba(255,100,20,0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(coreLen * 0.5, -coreW * flicker, coreLen, 0);
  ctx.quadraticCurveTo(coreLen * 0.5, coreW * flicker, 0, 0);
  ctx.fill();

  // ── Outer plume (fiery glow) ──
  var outerLen = plumeLenBase * flicker;
  var outerW = plumeW * 0.7;
  var outerGrad = ctx.createLinearGradient(0, 0, outerLen, 0);
  outerGrad.addColorStop(0, 'rgba(255,200,100,0.6)');
  outerGrad.addColorStop(0.4, 'rgba(255,120,30,0.35)');
  outerGrad.addColorStop(0.8, 'rgba(200,60,10,0.12)');
  outerGrad.addColorStop(1, 'rgba(100,30,5,0)');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(outerLen * 0.4, -outerW, outerLen, 0);
  ctx.quadraticCurveTo(outerLen * 0.4, outerW, 0, 0);
  ctx.fill();

  // ── Mach diamonds (bright nodes at high expansion ratios) ──
  if (thrustFrac > 0.3) {
    var numDiamonds = Math.min(4, Math.floor(Math.sqrt(thrustFrac * 12)));
    var diamondSpacing = coreLen * 0.22;
    for (var md = 0; md < numDiamonds; md++) {
      var mdX = (md + 1) * diamondSpacing;
      if (mdX > coreLen * 0.9) break;
      var mdR = coreW * 0.5 * (1 - md * 0.18) * flicker;
      var mdAlpha = (0.4 - md * 0.08) * thrustFrac;
      ctx.globalAlpha = Math.max(0, mdAlpha);
      ctx.fillStyle = '#ffffcc';
      // Diamond shape
      ctx.beginPath();
      ctx.moveTo(mdX - mdR * 0.5, 0);
      ctx.lineTo(mdX, -mdR);
      ctx.lineTo(mdX + mdR * 0.5, 0);
      ctx.lineTo(mdX, mdR);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── Smoke trail at plume tip ──
  var smokeX = outerLen * 0.85;
  var smokeR = plumeW * 0.4 * thrustFrac;
  ctx.globalAlpha = 0.15 * thrustFrac;
  ctx.fillStyle = '#aaa';
  ctx.beginPath();
  ctx.arc(smokeX, 0, Math.max(2, smokeR), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}

/**
 * drawFizzle(physX, physY, progress)
 * Sputtering failed ignition. progress: 0→1 over the burn.
 */
function drawFizzle(physX, physY, progress) {
  if (progress <= 0 || progress > 1) return;
  var s = Math.max(currentPPM, 18);
  var _fz = toCanvas(physX, physY);
  var cx = _fz.x;
  var cy = _fz.y;

  var sparks = 5 + Math.floor(progress * 6);
  var sputter = (1 - progress * 0.6);  // diminishes towards end

  ctx.save();
  ctx.translate(cx, cy);

  for (var i = 0; i < sparks; i++) {
    var angle = (i / sparks) * Math.PI * 2 + worldTime * 8 + progress * 5;
    var dist = (5 + Math.random() * 12) * s / 80 * sputter;
    var sx = Math.cos(angle) * dist;
    var sy = Math.sin(angle) * dist * 0.6 + Math.random() * 4;
    var sparkR = Math.max(1, (1.5 + Math.random() * 2) * sputter);

    var alpha = (0.5 + Math.random() * 0.5) * sputter;
    ctx.fillStyle = 'rgba(255,' + Math.floor(120 + Math.random() * 80) + ',0,' + alpha + ')';
    ctx.beginPath();
    ctx.arc(sx, sy, sparkR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Small smoke puff
  ctx.globalAlpha = 0.25 * sputter;
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.arc(0, -3 * s / 80, Math.max(3, 8 * s / 80 * progress), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ── Composite World Draw ───────────────────────────────────────────────────
function drawWorld() {
  drawSky();
  if (!curveActive) {
    // Flat mode: features draw behind the ground (sky objects)
    if (env.lowerAlpha > 0.02) drawPlanetFeatures(env.lowerPlanet, env.lowerAlpha);
    if (env.upperAlpha > 0.02 && env.upperPlanet !== env.lowerPlanet) {
      drawPlanetFeatures(env.upperPlanet, env.upperAlpha);
    }
  }
  drawGround();
  drawMound();
  if (curveActive) {
    // Curved mode: draw orbital features after ground so moons/rings
    // appear in front of the planet disc.
    if (env.lowerAlpha > 0.02) drawPlanetFeatures(env.lowerPlanet, env.lowerAlpha);
    if (env.upperAlpha > 0.02 && env.upperPlanet !== env.lowerPlanet) {
      drawPlanetFeatures(env.upperPlanet, env.upperAlpha);
    }
  }
}

function clear() {
  if (pixelRatio !== Math.max(1, window.devicePixelRatio || 1)) resize();
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
  ctx.clearRect(0,0,W,H);
}

// ── Public Getters ─────────────────────────────────────────────────────────
function isCurrentGas()         { return env.isGas; }

// Return the planet radius for a given surface gravity (interpolated between
// bracket planets, snapped to nearest when close).
function getPlanetRadius(g) {
  var b = findBracket(g);
  if (b.t === 0) return b.lo.radius;
  // Interpolate radius between the two bracketing planets
  return b.lo.radius + (b.hi.radius - b.lo.radius) * b.t;
}
function getGroundY()           { return groundY; }
function getWidth()             { return W; }
function getHeight()            { return H; }
function getCurrentPPM()        { return currentPPM; }

/**
 * Compute the PPM at which the whole planet fits in the viewport.
 * Uses PPM = min(W, H) / (2.5 × R) so the disc fills ~80% of the shorter
 * viewport dimension. Returns 0 if there's no planet radius (flat mode).
 */
function getWholePlanetPPM() {
  var r = getPlanetRadius(displayedGravity);
  if (r <= 0 || W <= 0) return 0;
  return Math.min(W,H) / (2.5 * r);
}

/** Returns the current planet-view blend factor (0 = follow, 1 = planet-centred). */
function getPlanetViewFrac() { return planetViewFrac; }

// ── Expose Namespace ──────────────────────────────────────────────────────
export const Renderer = {
  DEFAULT_PPM:      DEFAULT_PPM,
  CANNON_BASE_X_M:  CANNON_BASE_X_M,
  CANNON_BASE_Y_M:  CANNON_BASE_Y_M,
  TOWER_BASE_X_M:   TOWER_BASE_X_M,
  TOWER_HEIGHT_M:   TOWER_HEIGHT_M,
  init: init,
  resize: resize,
  updateWorld: updateWorld,
  setTargetGravity: setTargetGravity,
  setTargetZoom: setTargetZoom,
  setZoomImmediate: setZoomImmediate,
  resetZoom: resetZoom,
  setViewTransitionDuration: setViewTransitionDuration,
  setCameraTarget: setCameraTarget,
  setCameraImmediate: setCameraImmediate,
  resetCamera: resetCamera,
  setRocketCamera: setRocketCamera,
  setBarrelLength: setBarrelLength,
  clear: clear,
  drawWorld: drawWorld,
  drawCannon: drawCannon,
  drawBall: drawBall,
  drawLandedBall: drawLandedBall,
  drawTrajectoryDot: drawTrajectoryDot,
  drawGhost: drawGhost,
  drawTarget: drawTarget,
  drawSceneNotes: drawSceneNotes,
  drawFlag: drawFlag,
  drawCrater: drawCrater,
  drawGasHole: drawGasHole,
  drawParticles: drawParticles,
  drawMuzzleFlash: drawMuzzleFlash,
  drawShockwave: drawShockwave,
  drawCharacter: drawCharacter,
  drawStickman: drawStickman,
  drawLaunchTower: drawLaunchTower,
  drawRocket: drawRocket,
  drawExhaust: drawExhaust,
  drawFizzle: drawFizzle,
  toCanvasX: toCanvasX,
  toCanvas: toCanvas,
  screenToSurface: screenToSurface,
  getCannonTipPhys: getCannonTipPhys,
  getRocketPadPosition: getRocketPadPosition,
  isCurrentGas: isCurrentGas,
  getGroundY: getGroundY,
  getWidth: getWidth,
  getHeight: getHeight,
  getCurrentPPM: getCurrentPPM,
  getWholePlanetPPM: getWholePlanetPPM,
  getPlanetViewFrac: getPlanetViewFrac
};
