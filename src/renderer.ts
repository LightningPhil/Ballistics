import { drawCrew } from './crew.ts';

/**
 * ============================================================================
 * renderer.js — Canvas Drawing for Matilda's Cannon Lab
 * ============================================================================
 *
 * ROLE:  Everything drawn on <canvas>. Planet environments (sky, ground,
 *        features), castle-rampart cannon, cannonballs, flags, craters/gas
 *        holes, particles, muzzle flash, shockwave. Dynamic zoom camera.
 *        Smooth planet-environment crossfade driven by gravity value.
 *
 * EXPORTS (via window.Renderer namespace):
 *   init(canvas), resize(), updateWorld(dt)
 *   setTargetGravity(g), setTargetZoom(ppm), resetZoom()
 *   setViewTransitionDuration(seconds)
 *   clear(), drawWorld(), drawCannon(), drawBall(), drawLandedBall()
 *   drawTrajectoryDot(), drawFlag(), drawCrater(), drawGasHole()
 *   drawParticles(), drawMuzzleFlash(), drawShockwave()
 *   drawLaunchTower(), drawRocket(), drawExhaust(), drawFizzle()
 *   toCanvasX(), toCanvasY(), getCannonTipPhys()
 *   isCurrentGas(), getNearestPlanetName(), getPlanets()
 *
 * LOADED BY: <script src="renderer.js"> in index.html (after physics.js)
 * ============================================================================
 */

// ── Planet Data (sorted by gravity) ────────────────────────────────────────
var PLANETS = [
  { name:'moon',    g:1.62,  radius:1737400,  isGas:false,
    skyTop:[5,5,15],       skyMid:[10,10,25],      skyBot:[25,25,45],
    groundTop:[150,148,142], groundBot:[115,113,108],
    subTop:[90,88,83],     subBot:[70,68,63],
    surfEdge:[165,163,158], moundCol:[135,133,128],
    features:'moon' },
  { name:'mercury', g:3.7,   radius:2439700,  isGas:false,
    skyTop:[8,6,18],       skyMid:[18,14,32],      skyBot:[35,30,48],
    groundTop:[145,130,115], groundBot:[115,100,85],
    subTop:[88,78,63],     subBot:[68,58,48],
    surfEdge:[160,145,130], moundCol:[135,120,105],
    features:'mercury' },
  { name:'mars',    g:3.72,  radius:3389500,  isGas:false,
    skyTop:[165,105,75],   skyMid:[195,135,100],   skyBot:[215,165,135],
    groundTop:[190,110,68], groundBot:[160,88,52],
    subTop:[130,68,38],    subBot:[100,52,28],
    surfEdge:[205,128,78], moundCol:[180,105,62],
    features:'mars' },
  { name:'uranus',  g:8.69,  radius:25362000, isGas:true,
    skyTop:[85,165,190],   skyMid:[105,190,215],   skyBot:[135,205,225],
    groundTop:[75,155,185], groundBot:[55,125,160],
    subTop:[45,105,140],   subBot:[35,85,120],
    surfEdge:[90,170,200], moundCol:[70,150,180],
    features:'icegas' },
  { name:'venus',   g:8.87,  radius:6051800,  isGas:false,
    skyTop:[195,155,55],   skyMid:[205,170,75],    skyBot:[218,185,100],
    groundTop:[180,128,48], groundBot:[150,105,38],
    subTop:[125,82,28],    subBot:[100,62,20],
    surfEdge:[200,148,58], moundCol:[170,120,42],
    features:'venus' },
  { name:'earth',   g:9.81,  radius:6371000,  isGas:false,
    skyTop:[130,176,190],  skyMid:[176,206,211],  skyBot:[228,231,208],
    groundTop:[126,153,110], groundBot:[89,120,86],
    subTop:[126,104,73],   subBot:[83,77,58],
    surfEdge:[167,179,126], moundCol:[116,144,99],
    features:'earth' },
  { name:'saturn',  g:10.44, radius:58232000, isGas:true,
    skyTop:[195,175,115],  skyMid:[210,195,145],   skyBot:[220,205,160],
    groundTop:[190,170,110], groundBot:[170,150,90],
    subTop:[150,130,75],   subBot:[130,110,58],
    surfEdge:[200,180,125], moundCol:[180,160,100],
    features:'saturn' },
  { name:'neptune', g:11.15, radius:24622000, isGas:true,
    skyTop:[18,35,105],    skyMid:[28,55,140],     skyBot:[45,75,165],
    groundTop:[28,48,130], groundBot:[20,38,110],
    subTop:[15,28,90],     subBot:[10,20,68],
    surfEdge:[38,58,140],  moundCol:[25,42,118],
    features:'deepgas' },
  { name:'jupiter', g:24.79, radius:69911000, isGas:true,
    skyTop:[200,150,100],  skyMid:[215,170,118],   skyBot:[225,185,140],
    groundTop:[180,128,78], groundBot:[160,108,58],
    subTop:[140,88,42],    subBot:[118,68,28],
    surfEdge:[190,138,88], moundCol:[170,118,68],
    features:'jupiter' }
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
  BARREL_LENGTH_M = Math.max(0.4, Math.min(4.0, m));
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
var displayedGravity = 9.81;
var targetGravity    = 9.81;
var worldTime = 0;

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
  lowerPlanet: PLANETS[5], upperPlanet: PLANETS[5],
  lowerAlpha: 1, upperAlpha: 0,
  nearestPlanet: PLANETS[5]
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
function setCameraTargetY(y) { targetCameraY = Math.max(0, y); }
function setCameraImmediate(x) { cameraX = x; targetCameraX = x; }
function setCameraImmediateY(y) {
  y = Math.max(0, y);
  cameraY = y;
  targetCameraY = y;
  // Recompute groundY so toCanvasY is correct this frame
  groundY = baseGroundY + cameraY * currentPPM;
}
function resetCamera() { targetCameraX = 0; cameraX = 0; targetCameraY = 0; cameraY = 0; }
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
      var logCur   = Math.log(Math.max(currentPPM, rampEnd * 0.5));
      planetViewFrac = clamp((logStart - logCur) / (logStart - logEnd), 0, 1);
    } else {
      planetViewFrac = 0;
    }
  } else {
    planetViewFrac = 0;
  }

  // ── Curvature computation (Phase 2) ──
  updateCurvature();

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
function toCanvasY(py) {
  if (curveActive) return worldToScreen(cameraX, py).sy;
  return groundY - py * currentPPM;
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

/** A previous run is a single screen-space dashed path, with no new physics. */
function drawGhost(points, options = {}) {
  if (!points || points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = options['color'] || (env.skyMid[0] > 100 ? '#566c7b' : '#aec4da');
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
    var markerY = clamp(point.y, 30, H - 35);
    ctx.fillStyle = '#f3cf76';ctx.beginPath();ctx.arc(clamp(point.x,12,W-12),markerY,5,0,Math.PI*2);ctx.fill();
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
  if (char?.visible && char.banter !== false && char.bubbleText) {
    drawCharacterAside(char);
  }
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
function getCannonPivotCanvas() {
  return toCanvas(CANNON_BASE_X_M, CANNON_BASE_Y_M);
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
    case 'moon':    drawStars(); if (!skipSurface) drawCraterFieldFeature(); break;
    case 'mercury': drawStars(); if (!skipSurface) drawCraterFieldFeature(); break;
    case 'mars':    drawStars(); drawCelestialBodies('mars'); if (!skipSurface) drawMountains(planet); drawPhobosShadow(); break;
    case 'venus':   if (!skipSurface) drawVolcanicHaze(); break;
    case 'earth':   drawCelestialBodies('earth'); if (!skipSurface) { drawClouds(); drawTreeline(); } break;
    case 'saturn':  drawSaturnRings(); break;
    case 'icegas':  break;
    case 'deepgas': break;
    case 'jupiter': break;
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
    for (var p = 0; p < c.puffs; p++) {
      ctx.beginPath();
      ctx.arc(baseX + p*cr*0.8, baseY + (p%2)*cr*0.3,
              cr, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

function drawTreeline() {
  var zr = Math.min(1, currentPPM / DEFAULT_PPM);
  var offset = parallaxOffset(PARALLAX_TREES);
  ctx.fillStyle = '#2d5a3a';
  for (var i = 0; i < treeData.length; i++) {
    var t = treeData[i];
    var th = t.h * zr;
    var tw = t.w * zr;
    var tx = wrapX(t.x * W - offset, tw);
    ctx.beginPath();
    ctx.moveTo(tx - tw/2, groundY);
    ctx.lineTo(tx, groundY - th);
    ctx.lineTo(tx + tw/2, groundY);
    ctx.closePath();
    ctx.fill();
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

    // Temporarily override radius for scaled drawing
    var origR = body.radius;
    body.radius = displayR;

    if (body.texture === 'lumpy') {
      drawLumpyMoon(cx, cy, body);
    } else if (body.texture === 'moon') {
      drawEarthMoon(cx, cy, body);
    }

    body.radius = origR;
  }
}

function drawLumpyMoon(cx, cy, body) {
  var r = body.radius;
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

function drawEarthMoon(cx, cy, body) {
  var r = body.radius;

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
  var zr = Math.min(1, currentPPM / DEFAULT_PPM);
  var mw = Math.max(25, 0.9*currentPPM);
  var mh = Math.max(6, mw*0.28);
  var tilt = surfaceNormalAngle(CANNON_BASE_X_M);
  ctx.fillStyle = rgb(env.moundCol);
  ctx.beginPath();
  ctx.ellipse(px, py, mw, mh, tilt, 0, Math.PI*2);
  ctx.fill();
}

// ── Cannon (Castle Rampart Fixed Mount) ────────────────────────────────────
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
  ctx.fillStyle='#99764e';ctx.fill();ctx.stroke();
  ctx.strokeStyle='#cfaf79';ctx.lineWidth=Math.max(1,s*.016);
  ctx.beginPath();ctx.moveTo(-s*.15,s*.14);ctx.lineTo(s*.31,s*.59);ctx.stroke();
  ctx.strokeStyle='#2d4249';ctx.lineWidth=Math.max(1.5,s*.024);
  [-.37,.44].forEach(wx=>{
    var y=s*.63,r=s*.35;
    ctx.beginPath();ctx.arc(wx*s,y,r,0,Math.PI*2);ctx.fillStyle='#4b5754';ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.arc(wx*s,y,r*.77,0,Math.PI*2);ctx.fillStyle='#bb945a';ctx.fill();ctx.stroke();
    for(var i=0;i<8;i++){
      var t=i*Math.PI/4;
      ctx.beginPath();ctx.moveTo(wx*s,y);ctx.lineTo(wx*s+Math.cos(t)*r*.72,y+Math.sin(t)*r*.72);ctx.stroke();
    }
    ctx.beginPath();ctx.arc(wx*s,y,r*.23,0,Math.PI*2);ctx.fillStyle='#edc775';ctx.fill();ctx.stroke();
  });
  ctx.save();ctx.rotate(-angleDeg*Math.PI/180);
  var length=BARREL_LENGTH_M*s;
  var shift=-(recoilOffset||0);
  var start=-s*.25+shift,end=length+shift;
  var width=s*.37;
  ctx.beginPath();ctx.moveTo(start,-width*.52);
  ctx.quadraticCurveTo(start-s*.16,0,start,width*.52);
  ctx.lineTo(end,width*.38);ctx.lineTo(end,-width*.38);ctx.closePath();
  ctx.fillStyle='#304e64';ctx.fill();ctx.stroke();
  ctx.strokeStyle='#78909a';ctx.lineWidth=Math.max(1,s*.028);
  ctx.beginPath();ctx.moveTo(start+s*.06,-width*.29);ctx.lineTo(end-s*.09,-width*.23);ctx.stroke();
  ctx.strokeStyle='#263c48';ctx.lineWidth=Math.max(1,s*.019);
  [start+s*.16,end-s*.09].forEach(rx=>{
    ctx.beginPath();ctx.roundRect(rx-s*.038,-width*.55,s*.076,width*1.1,s*.022);
    ctx.fillStyle='#e7bc6b';ctx.fill();ctx.stroke();
  });
  ctx.beginPath();ctx.ellipse(end,0,s*.05,width*.38,0,0,Math.PI*2);
  ctx.fillStyle='#172e39';ctx.fill();ctx.strokeStyle='#edc778';ctx.lineWidth=Math.max(2,s*.042);ctx.stroke();
  ctx.restore();
  ctx.beginPath();ctx.arc(0,0,s*.16,0,Math.PI*2);ctx.fillStyle='#f0c878';ctx.fill();
  ctx.strokeStyle='#304b53';ctx.lineWidth=Math.max(1.5,s*.025);ctx.stroke();
  ctx.beginPath();ctx.arc(0,0,s*.048,0,Math.PI*2);ctx.fillStyle='#304e64';ctx.fill();
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

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.arc(2,2,r,0,Math.PI*2); ctx.fill();

  var grad = ctx.createRadialGradient(-1,-1,1, 0,0,r);
  grad.addColorStop(0, '#666');
  grad.addColorStop(0.6, '#333');
  grad.addColorStop(1, '#1a1a1a');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.arc(-r*0.25,-r*0.35,r*0.35,0,Math.PI*2); ctx.fill();

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
  var baseX = toCanvasX(physX), baseY = groundYAtPhysX(physX);
  var sp = (typeof springProgress === 'number') ? springProgress : 1;
  var maxH = Math.max(22, 0.65*currentPPM);
  var flagH = maxH * sp;
  if (sp < 1) flagH = maxH*(1 - Math.pow(1-sp,3)*Math.cos(sp*Math.PI*3));

  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = Math.max(1.5, currentPPM*0.02);
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(baseX, baseY-flagH);
  ctx.stroke();

  if (flagH > 8) {
    var pW = Math.max(12, 0.3*currentPPM);
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.moveTo(baseX, baseY-flagH);
    ctx.lineTo(baseX+pW, baseY-flagH+pW*0.3);
    ctx.lineTo(baseX, baseY-flagH+pW*0.6);
    ctx.closePath();
    ctx.fill();

    if (flagH > 18 && currentPPM > 8) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold '+Math.max(7, Math.round(currentPPM*0.11))+'px Courier New,monospace';
      ctx.textAlign = 'center';
      ctx.fillText(shotNumber, baseX+pW*0.5, baseY-flagH+pW*0.45);
    }
  }
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
// Each stickman is ~0.6 m tall in physics units. Poses are parametric on timer.

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

// ── Character Drawing Helpers ────────────────────────────────────────────────
// Shared utility functions that enforce a consistent cartoon style across all
// characters: dark outlines, gradient fills, expressive eyes, volumetric limbs.

var OL = '#222';  // default outline colour
var OW = 1.8;     // default outline width (scales with s)

function outlinedCircle(x, y, r, fill, outline, lw) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = outline || OL; ctx.lineWidth = lw || OW;
  ctx.stroke();
}

function outlinedEllipse(x, y, rx, ry, fill, outline?, lw?) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = outline || OL; ctx.lineWidth = lw || OW;
  ctx.stroke();
}

function outlinedPath(pathFn, fill, outline, lw) {
  ctx.beginPath(); pathFn();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = outline || OL; ctx.lineWidth = lw || OW;
  ctx.stroke();
}

function gradientCircle(x, y, r, cLight, cDark, outline, lw) {
  var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.05, x, y, r);
  g.addColorStop(0, cLight); g.addColorStop(1, cDark);
  outlinedCircle(x, y, r, g, outline, lw);
}

function gradientEllipse(x, y, rx, ry, cLight, cDark, outline, lw) {
  var g = ctx.createRadialGradient(x - rx * 0.25, y - ry * 0.25, Math.min(rx, ry) * 0.05, x, y, Math.max(rx, ry));
  g.addColorStop(0, cLight); g.addColorStop(1, cDark);
  outlinedEllipse(x, y, rx, ry, g, outline, lw);
}

/** Cartoon eye with sclera, iris, pupil and catch-light.
 *  irisColor: e.g. '#44aa44'. pupilDir: {x,y} -1..1. state: 'normal'|'startled'|'happy'|'dead' */
function cartoonEye(x, y, size, irisColor, pupilDir, state) {
  var pd = pupilDir || {x:0, y:0};
  var sc = (state === 'startled') ? 1.4 : (state === 'happy') ? 0.75 : 1;
  var r = size * sc;
  // Sclera with soft outline
  ctx.fillStyle = '#fff';
  if (state === 'happy') {
    // Happy squint — draw as an arc
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.5, 0, Math.PI * 0.1, Math.PI * 0.9);
    ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = Math.max(0.8, r * 0.12);
    ctx.stroke();
    return;
  }
  if (state === 'dead') {
    // X eyes
    ctx.strokeStyle = OL; ctx.lineWidth = Math.max(1, r * 0.2);
    ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.6); ctx.lineTo(x + r * 0.6, y + r * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + r * 0.6, y - r * 0.6); ctx.lineTo(x - r * 0.6, y + r * 0.6); ctx.stroke();
    return;
  }
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = OL; ctx.lineWidth = Math.max(0.8, r * 0.1);
  ctx.stroke();
  // Iris
  var ir = r * 0.55;
  var ix = x + pd.x * r * 0.25, iy = y + pd.y * r * 0.2;
  ctx.fillStyle = irisColor || '#44aa44';
  ctx.beginPath(); ctx.arc(ix, iy, ir, 0, Math.PI * 2); ctx.fill();
  // Pupil
  var pr = ir * 0.55;
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(ix, iy, pr, 0, Math.PI * 2); ctx.fill();
  // Catch-light
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.25, r * 0.2, 0, Math.PI * 2); ctx.fill();
}

/** Draws a filled tapered limb (not a stroke line) between two points. */
function cartoonLimb(x1, y1, x2, y2, w1, w2, fill, outline, lw) {
  var dx = x2 - x1, dy = y2 - y1;
  var len = Math.sqrt(dx * dx + dy * dy) || 1;
  var nx = -dy / len, ny = dx / len; // perpendicular
  ctx.beginPath();
  ctx.moveTo(x1 + nx * w1 * 0.5, y1 + ny * w1 * 0.5);
  ctx.lineTo(x2 + nx * w2 * 0.5, y2 + ny * w2 * 0.5);
  ctx.lineTo(x2 - nx * w2 * 0.5, y2 - ny * w2 * 0.5);
  ctx.lineTo(x1 - nx * w1 * 0.5, y1 - ny * w1 * 0.5);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (outline !== false) {
    ctx.strokeStyle = outline || OL; ctx.lineWidth = lw || OW;
    ctx.stroke();
  }
}

/** Soft elliptical shadow beneath character feet. */
function dropShadow(x, y, w, h, opacity?, tint?) {
  ctx.fillStyle = tint
    ? ('rgba(' + tint + ',' + (opacity || 0.18) + ')')
    : ('rgba(0,0,0,' + (opacity || 0.18) + ')');
  ctx.beginPath();
  ctx.ellipse(x, y, w, h || w * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Rounded rectangle path helper. */
function roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Comic Characters ────────────────────────────────────────────────────────
// Characters walk on the ground and react to cannon fire. Drawn in physics space.
// State machine is managed by main.js; renderer just draws based on the state object.

function drawCharacter(char) {
  if (!char || !char.visible) return;

  var position = toCanvas(char.x, 0);
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(surfaceNormalAngle(char.x));
  drawCharacterSprite(0, 0, currentPPM, char);
  ctx.restore();
}

function drawCharacterSprite(cx, cy, s, char) {

  // Normalize rocket_startled to startled for drawing purposes
  // (visually identical, only duration differs — handled in main.js)
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
    // Scale strokes and animation offsets too, so guests shrink with the world.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s / 80, s / 80);
    switch (drawChar.type) {
      case 'newt':      drawNewt(0, 0, 80, drawChar); break;
      case 'whale':     drawWhale(0, 0, 80, drawChar); break;
      case 'snowman':   drawSnowman(0, 0, 80, drawChar); break;
      case 'submarine': drawSubmarine(0, 0, 80, drawChar); break;
    }
    ctx.restore();
  }
}

// ── Newt (Venus) ───────────────────────────────────────────────────────────
function drawNewt(cx, cy, s, char) {
  var t  = char.stateTimer;
  var dir = char.direction;
  var h  = s * 0.55;
  var ol = Math.max(1.0, h * 0.015);
  var bodyW = h * 0.65, bodyH = h * 0.28;
  var legLen = h * 0.14, legW0 = h * 0.06;
  var eyeR = h * 0.13;
  var tailLen = h * 0.48;

  ctx.save();
  ctx.translate(cx, cy);

  /* ── squashed ───────────────────────────────────── */
  if (char.state === 'squashed') {
    var sq = Math.min(1, t / 0.8);
    dropShadow(0, 0, bodyW * 1.1, bodyH * 0.06, 0.2);
    outlinedEllipse(0, -bodyH * 0.04, bodyW * 1.2 * (1 + sq * 0.2), bodyH * 0.07 * (1 - sq * 0.4), '#cc5500', '#772800', ol);
    ctx.strokeStyle = '#ff3366'; ctx.lineWidth = Math.max(1.5, ol);
    ctx.beginPath(); ctx.moveTo(dir * bodyW * 0.6, -bodyH * 0.03);
    ctx.lineTo(dir * bodyW * 1.0, bodyH * 0.08 + Math.sin(t * 5) * 3); ctx.stroke();
    ctx.restore(); return;
  }

  /* ── animation ──────────────────────────────────── */
  var wiggle = 0, puff = 0, legSpd = 0;
  if (char.state === 'walking' || char.state === 'returning') {
    wiggle = Math.sin(t * 8) * 0.08; legSpd = t * 8;
  } else if (char.state === 'idle') {
    wiggle = Math.sin(t * 1.5) * 0.02;
  } else if (char.state === 'startled') {
    puff = Math.max(0, 1 - t * 2) * 0.4;
    wiggle = Math.sin(t * 20) * 0.15;
  } else if (char.state === 'running_away') {
    wiggle = Math.sin(t * 16) * 0.12; legSpd = t * 20;
  }

  // Warm glow beneath
  ctx.fillStyle = 'rgba(255,140,40,0.08)';
  ctx.beginPath(); ctx.ellipse(0, bodyH * 0.1, bodyW * 0.9, bodyH * 0.4, 0, 0, Math.PI * 2); ctx.fill();

  ctx.rotate(wiggle);
  ctx.scale(dir, 1);

  // Drop shadow
  dropShadow(0, legLen * 0.6, bodyW * 0.55, bodyH * 0.04, 0.14);

  /* ── legs (filled + toes) ──────────────────────── */
  for (var li = 0; li < 2; li++) {
    var lx = li === 0 ? bodyW * 0.4 : -bodyW * 0.3;
    var ph = legSpd + li * Math.PI;
    var fx = lx + Math.sin(ph) * legLen * 0.5;
    var fy = legLen;
    cartoonLimb(lx, -bodyH * 0.1, fx, fy, legW0, legW0 * 0.65, '#aa4400', '#662200', ol);
    // Toes — 3 little filled ovals
    for (var ti2 = -1; ti2 <= 1; ti2++) {
      outlinedEllipse(fx + ti2 * legLen * 0.1, fy + h * 0.01, h * 0.02, h * 0.012, '#cc5500', '#662200', ol * 0.5);
    }
  }

  /* ── tail (filled Bézier ribbon) ───────────────── */
  var tailCurl = (char.state === 'running_away') ? 0.2 : 1.0;
  outlinedPath(function() {
    ctx.moveTo(-bodyW * 0.55, -bodyH * 0.1);
    // Build top edge of tail
    var txA = [], tyA = [];
    for (var t2 = 0; t2 <= 8; t2++) {
      var tf = t2 / 8;
      txA.push(-bodyW * 0.6 - tf * tailLen);
      tyA.push(-bodyH * 0.2 - Math.sin(tf * Math.PI * tailCurl * 1.5) * tailLen * 0.55 * tailCurl + Math.sin(t * 3 + tf * 2) * h * 0.02);
    }
    for (var t3 = 0; t3 < txA.length; t3++) ctx.lineTo(txA[t3], tyA[t3]);
    // Tail tip
    ctx.lineTo(txA[txA.length - 1] - h * 0.02, tyA[tyA.length - 1] + h * 0.02);
    // Bottom edge back
    for (var t4 = txA.length - 1; t4 >= 0; t4--) ctx.lineTo(txA[t4], tyA[t4] + bodyH * 0.22 * (1 - t4 / txA.length));
    ctx.closePath();
  }, '#bb4400', '#662200', ol);

  /* ── body (plump oval + spots) ─────────────────── */
  gradientEllipse(0, -bodyH * 0.3, bodyW * (1 + puff * 0.3), bodyH * (1 + puff), '#dd6600', '#993300', '#662200', ol);
  // Belly highlight
  ctx.fillStyle = 'rgba(255,200,100,0.15)';
  ctx.beginPath(); ctx.ellipse(0, -bodyH * 0.05, bodyW * 0.55, bodyH * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  // Spine spots
  ctx.fillStyle = 'rgba(80,30,0,0.35)';
  for (var sp = 0; sp < 4; sp++) {
    var spx = bodyW * (-0.3 + sp * 0.2);
    ctx.beginPath(); ctx.arc(spx, -bodyH * 0.6, h * 0.032, 0, Math.PI * 2); ctx.fill();
  }

  /* ── head ───────────────────────────────────────── */
  gradientCircle(bodyW * 0.55, -bodyH * 0.35, bodyH * 0.52, '#dd6600', '#993300', '#662200', ol);

  // Eyes — big and bulging
  var eCx = bodyW * 0.6, eCy = -bodyH * 0.58;
  var eSt = (char.state === 'startled') ? 'startled' : (char.state === 'idle' ? 'happy' : 'normal');
  var eSc = (char.state === 'startled') ? 1.4 : 1.0;
  cartoonEye(eCx, eCy, eyeR * eSc, '#ffdd00', {x: 1, y: 0}, eSt);

  /* ── tongue flick (idle) ────────────────────────── */
  if (char.state === 'idle' && Math.sin(t * 1.5) > 0.8) {
    var tL = h * 0.25;
    ctx.strokeStyle = '#ff3366'; ctx.lineWidth = Math.max(1.5, ol);
    ctx.beginPath();
    ctx.moveTo(bodyW * 0.75, -bodyH * 0.2);
    ctx.quadraticCurveTo(bodyW * 0.75 + tL * 0.7, -bodyH * 0.1, bodyW * 0.75 + tL, -bodyH * 0.3);
    ctx.stroke();
    // Forked tip
    ctx.beginPath(); ctx.moveTo(bodyW * 0.75 + tL, -bodyH * 0.3);
    ctx.lineTo(bodyW * 0.75 + tL + h * 0.03, -bodyH * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bodyW * 0.75 + tL, -bodyH * 0.3);
    ctx.lineTo(bodyW * 0.75 + tL + h * 0.03, -bodyH * 0.2); ctx.stroke();
  }

  ctx.restore();
}

// ── Snowman (Neptune) ──────────────────────────────────────────────────────
function drawSnowman(cx, cy, s, char) {
  var t  = char.stateTimer;
  var dir = char.direction;
  var h  = s * 1.3;
  var ol = Math.max(1.2, h * 0.012);
  var botR = h * 0.19;
  var midR = h * 0.14;
  var topR = h * 0.10;

  ctx.save();
  ctx.translate(cx, cy);

  /* ── squashed ───────────────────────────────────── */
  if (char.state === 'squashed') {
    var sq = Math.min(1, t / 0.8);
    dropShadow(0, 0, botR * 1.8, botR * 0.06, 0.22);
    outlinedEllipse(0, -botR * 0.08, botR * 1.9 * (1 + sq * 0.15), botR * 0.13 * (1 - sq * 0.4), '#e8eeff', '#8899bb', ol);
    // Hat on blob
    outlinedPath(function() { roundRect(-topR * 0.6, -botR * 0.3 - topR * 0.3, topR * 1.2, topR * 0.3, h * 0.008); }, '#222', '#000', ol * 0.7);
    // Carrot sideways
    outlinedPath(function() {
      ctx.moveTo(botR * 0.5, -botR * 0.15);
      ctx.lineTo(botR * 1.2, -botR * 0.1);
      ctx.lineTo(botR * 0.5, -botR * 0.05); ctx.closePath();
    }, '#ff8800', '#aa5500', ol * 0.6);
    ctx.restore(); return;
  }

  /* ── animation ──────────────────────────────────── */
  var shiver = 0, bounce = 0, spinA = 0, hatOff = 0;
  if (char.state === 'idle') {
    shiver = Math.sin(t * 30) * 1.5;
  } else if (char.state === 'walking' || char.state === 'returning') {
    bounce = Math.abs(Math.sin(t * 5)) * h * 0.06;
    spinA = Math.sin(t * 5) * 0.08;
  } else if (char.state === 'startled') {
    hatOff = Math.min(t * 3, 1) * h * 0.4;
    shiver = Math.sin(t * 25) * 4;
  } else if (char.state === 'running_away') {
    spinA = t * 8; bounce = Math.abs(Math.sin(t * 6)) * h * 0.04;
  }
  ctx.translate(shiver, -bounce);

  // Ice crystals floating
  ctx.strokeStyle = 'rgba(200,220,255,0.45)'; ctx.lineWidth = Math.max(1, ol * 0.5);
  for (var ic = 0; ic < 4; ic++) {
    var icA = t * 0.8 + ic * 1.57;
    var icD = h * 0.4 + Math.sin(t * 0.5 + ic * 2) * h * 0.1;
    var icx = Math.cos(icA) * icD, icy = -h * 0.4 + Math.sin(icA * 0.7) * h * 0.2;
    var icS = h * 0.025;
    for (var ia = 0; ia < 3; ia++) {
      var iAng = ia * Math.PI / 3 + t * 0.5;
      ctx.beginPath();
      ctx.moveTo(icx + Math.cos(iAng) * icS, icy + Math.sin(iAng) * icS);
      ctx.lineTo(icx - Math.cos(iAng) * icS, icy - Math.sin(iAng) * icS);
      ctx.stroke();
    }
  }

  ctx.rotate(spinA);

  // Drop shadow
  dropShadow(0, 0, botR * 0.7, botR * 0.05, 0.15);

  /* ── bottom ball ───────────────────────────────── */
  gradientCircle(0, -botR, botR, '#f0f4ff', '#b0c0e0', '#8099bb', ol);

  /* ── middle ball ───────────────────────────────── */
  var midY = -botR * 2 - midR + botR * 0.15;
  gradientCircle(0, midY, midR, '#f0f4ff', '#bcc8e4', '#8099bb', ol);

  /* ── buttons ────────────────────────────────────── */
  outlinedCircle(0, midY - midR * 0.15, midR * 0.07, '#222', '#000', ol * 0.4);
  outlinedCircle(0, midY + midR * 0.2, midR * 0.07, '#222', '#000', ol * 0.4);

  /* ── twig arms ──────────────────────────────────── */
  var twigW = Math.max(2, h * 0.022);
  // Left
  cartoonLimb(-midR, midY, -midR - h * 0.15, midY - h * 0.05, twigW, twigW * 0.5, '#6b4226', '#3a2010', ol * 0.7);
  cartoonLimb(-midR - h * 0.12, midY - h * 0.04, -midR - h * 0.17, midY - h * 0.1, twigW * 0.6, twigW * 0.3, '#6b4226', '#3a2010', ol * 0.5);
  // Right
  cartoonLimb(midR, midY, midR + h * 0.15, midY - h * 0.05, twigW, twigW * 0.5, '#6b4226', '#3a2010', ol * 0.7);
  cartoonLimb(midR + h * 0.12, midY - h * 0.04, midR + h * 0.17, midY - h * 0.1, twigW * 0.6, twigW * 0.3, '#6b4226', '#3a2010', ol * 0.5);

  /* ── scarf ──────────────────────────────────────── */
  var scarfY = midY - midR + topR * 0.3;
  outlinedEllipse(0, scarfY, midR * 0.8, topR * 0.25, '#cc2222', '#881111', ol);
  // Stripe
  ctx.fillStyle = '#eeee44';
  ctx.fillRect(-midR * 0.5, scarfY - topR * 0.04, midR * 1.0, topR * 0.08);
  // Dangling end
  outlinedPath(function() {
    ctx.moveTo(midR * 0.2, scarfY + topR * 0.15);
    ctx.quadraticCurveTo(midR * 0.5, scarfY + topR * 0.6, midR * 0.3, scarfY + topR * 0.9);
    ctx.lineTo(midR * 0.15, scarfY + topR * 0.85);
    ctx.quadraticCurveTo(midR * 0.35, scarfY + topR * 0.5, midR * 0.1, scarfY + topR * 0.15);
    ctx.closePath();
  }, '#cc2222', '#881111', ol * 0.6);

  /* ── head ball ──────────────────────────────────── */
  var headY = midY - midR - topR + topR * 0.2;
  gradientCircle(0, headY, topR, '#f0f4ff', '#c4cee8', '#8099bb', ol);

  // Coal eyes
  var eSt = (char.state === 'startled') ? 'startled'
          : (char.state === 'idle') ? 'happy' : 'normal';
  cartoonEye(-topR * 0.32, headY - topR * 0.12, topR * 0.16, '#222', {x: dir, y: 0}, eSt);
  cartoonEye(topR * 0.32, headY - topR * 0.12, topR * 0.16, '#222', {x: dir, y: 0}, eSt);

  // Coal mouth dots
  ctx.fillStyle = '#222';
  for (var mi = 0; mi < 4; mi++) {
    var mx = (mi - 1.5) * topR * 0.2;
    var my = headY + topR * 0.25 + Math.abs(mi - 1.5) * topR * 0.08;
    ctx.beginPath(); ctx.arc(mx, my, topR * 0.06, 0, Math.PI * 2); ctx.fill();
  }

  /* ── carrot nose ────────────────────────────────── */
  outlinedPath(function() {
    ctx.moveTo(dir * topR * 0.15, headY);
    ctx.lineTo(dir * topR * 0.9, headY + topR * 0.1);
    ctx.lineTo(dir * topR * 0.15, headY + topR * 0.2); ctx.closePath();
  }, '#ff8800', '#aa5500', ol * 0.7);

  /* ── top hat (flies off on startled) ───────────── */
  var hatY = headY - topR - hatOff;
  if (char.state === 'startled' && hatOff > 0) {
    ctx.save();
    ctx.translate(dir * hatOff * 0.3, 0);
    ctx.rotate(t * 4 * dir);
  }
  // Brim
  outlinedPath(function() { roundRect(-topR * 0.8, hatY + topR * 0.18, topR * 1.6, topR * 0.12, h * 0.006); }, '#222', '#000', ol);
  // Cylinder
  outlinedPath(function() { roundRect(-topR * 0.5, hatY - topR * 0.4, topR * 1.0, topR * 0.6, h * 0.008); }, '#282828', '#000', ol);
  // Hat band
  ctx.fillStyle = '#cc2222';
  ctx.fillRect(-topR * 0.48, hatY + topR * 0.05, topR * 0.96, topR * 0.1);
  if (char.state === 'startled' && hatOff > 0) ctx.restore();

  /* ── snow trail when running ───────────────────── */
  if (char.state === 'running_away') {
    ctx.fillStyle = 'rgba(220,230,255,0.25)';
    for (var si = 0; si < 3; si++) {
      ctx.beginPath();
      ctx.arc(-dir * (si + 1) * h * 0.12, -botR * 0.5 + Math.sin(t * 4 + si) * botR * 0.3, h * 0.03 + si * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

// ── Submarine (Saturn) ─────────────────────────────────────────────────────
function drawSubmarine(cx, cy, s, char) {
  var t  = char.stateTimer;
  var dir = char.direction;
  var h  = s * 0.9;
  var ol = Math.max(1.0, h * 0.013);
  var hullW = h * 0.5, hullH = h * 0.2;
  var towerW = h * 0.1, towerH = h * 0.12;

  ctx.save();
  ctx.translate(cx, cy);

  /* ── squashed ───────────────────────────────────── */
  if (char.state === 'squashed') {
    var sq = Math.min(1, t / 0.8);
    dropShadow(0, 0, hullW * 0.9, hullH * 0.06, 0.2);
    var crW = hullW * (1 - sq * 0.5);
    for (var ci = 0; ci < 5; ci++) {
      var cx2 = (ci - 2) * crW * 0.35;
      outlinedEllipse(cx2, -hullH * 0.5, crW * 0.12, hullH * (1 + sq) * 0.4, '#ddcc00', '#887700', ol * 0.7);
    }
    ctx.fillStyle = '#888';
    for (var ri = 0; ri < 3; ri++) {
      var ra = t * 6 + ri * 2.2;
      ctx.beginPath(); ctx.arc(Math.cos(ra) * h * 0.3, -hullH + Math.sin(ra * 1.3) * h * 0.2, Math.max(1.5, h * 0.012), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore(); return;
  }

  /* ── animation ──────────────────────────────────── */
  var bob = Math.sin(t * 2.5) * h * 0.03, pitch = 0;
  if (char.state === 'walking' || char.state === 'returning') {
    pitch = Math.sin(t * 2) * 0.05;
  } else if (char.state === 'running_away') {
    pitch = -0.12 * dir; bob = Math.sin(t * 8) * h * 0.01;
  } else if (char.state === 'startled') {
    bob = -h * 0.06;
  }
  ctx.translate(0, bob - hullH * 0.5);
  ctx.rotate(pitch);
  ctx.scale(dir, 1);

  // Bubbles
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (var bi = 0; bi < 4; bi++) {
    var bAge = (t * 0.8 + bi * 0.7) % 2.5;
    var bx = -hullW * 0.3 - bi * hullW * 0.15;
    var by = -hullH - bAge * h * 0.25;
    ctx.beginPath(); ctx.arc(bx + Math.sin(bAge * 3) * 3, by, h * 0.015 + bi * 0.5, 0, Math.PI * 2); ctx.fill();
  }

  /* ── hull (gradient capsule + outline) ─────────── */
  gradientEllipse(0, 0, hullW, hullH, '#eedd22', '#aa9500', '#776600', ol);
  // Centre seam
  ctx.strokeStyle = '#99880088'; ctx.lineWidth = Math.max(1, ol * 0.5);
  ctx.beginPath(); ctx.moveTo(-hullW * 0.92, 0); ctx.lineTo(hullW * 0.92, 0); ctx.stroke();
  // Rivets along seam
  for (var ri2 = 0; ri2 < 6; ri2++) {
    var rx = -hullW * 0.8 + ri2 * hullW * 0.32;
    outlinedCircle(rx, 0, Math.max(1.2, h * 0.008), '#bb9900', '#776600', ol * 0.3);
  }

  /* ── portholes ──────────────────────────────────── */
  for (var pi = 0; pi < 3; pi++) {
    var px = -hullW * 0.4 + pi * hullW * 0.35;
    var pR = hullH * 0.21;
    gradientCircle(px, -hullH * 0.15, pR, '#a8ccee', '#6899bb', '#886600', Math.max(1.5, ol));
    // Glass glint
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.arc(px - pR * 0.25, -hullH * 0.15 - pR * 0.25, pR * 0.25, 0, Math.PI * 2); ctx.fill();
  }

  /* ── face in middle porthole ───────────────────── */
  var fpx = -hullW * 0.4 + hullW * 0.35;
  var fpy = -hullH * 0.15;
  var fR = hullH * 0.12;
  if (char.state === 'startled') {
    cartoonEye(fpx - fR * 0.55, fpy - fR * 0.15, fR * 0.4, '#446688', {x: 0, y: 0}, 'startled');
    cartoonEye(fpx + fR * 0.55, fpy - fR * 0.15, fR * 0.4, '#446688', {x: 0, y: 0}, 'startled');
    outlinedCircle(fpx, fpy + fR * 0.35, fR * 0.25, '#333', '#111', ol * 0.4);
  } else {
    cartoonEye(fpx - fR * 0.45, fpy - fR * 0.1, fR * 0.25, '#446688', {x: 1, y: 0}, char.state === 'idle' ? 'happy' : 'normal');
    cartoonEye(fpx + fR * 0.45, fpy - fR * 0.1, fR * 0.25, '#446688', {x: 1, y: 0}, char.state === 'idle' ? 'happy' : 'normal');
    ctx.strokeStyle = '#335'; ctx.lineWidth = Math.max(1, ol * 0.5);
    ctx.beginPath(); ctx.arc(fpx, fpy + fR * 0.2, fR * 0.3, 0, Math.PI); ctx.stroke();
  }

  /* ── conning tower ──────────────────────────────── */
  outlinedPath(function() { roundRect(-towerW * 0.5, -hullH - towerH, towerW, towerH, h * 0.01); }, '#ccbb00', '#887700', ol);

  /* ── periscope ──────────────────────────────────── */
  var periH = h * 0.12;
  var periRet = (char.state === 'startled') ? Math.min(1, t * 4) * periH * 0.8 : 0;
  var periRot = (char.state === 'idle') ? Math.sin(t * 1.5) * 0.4 : 0;
  ctx.strokeStyle = '#666'; ctx.lineWidth = Math.max(2, ol * 1.2);
  ctx.beginPath();
  ctx.moveTo(0, -hullH - towerH);
  ctx.lineTo(0, -hullH - towerH - periH + periRet); ctx.stroke();
  ctx.save();
  ctx.translate(0, -hullH - towerH - periH + periRet);
  ctx.rotate(periRot);
  outlinedPath(function() { roundRect(-h * 0.02, -h * 0.015, h * 0.05, h * 0.03, h * 0.005); }, '#444', '#222', ol * 0.5);
  gradientCircle(h * 0.03, 0, h * 0.013, '#aaccff', '#6688bb', '#335', ol * 0.4);
  ctx.restore();

  // Alarm light
  if (char.state === 'startled' && Math.sin(t * 15) > 0) {
    ctx.fillStyle = 'rgba(255,40,40,0.55)';
    ctx.beginPath(); ctx.arc(0, -hullH - towerH - h * 0.01, h * 0.025, 0, Math.PI * 2); ctx.fill();
  }

  /* ── rear fins ──────────────────────────────────── */
  outlinedPath(function() {
    ctx.moveTo(-hullW * 0.85, -hullH * 0.3);
    ctx.lineTo(-hullW * 1.05, -hullH * 0.8);
    ctx.lineTo(-hullW * 0.75, -hullH * 0.3); ctx.closePath();
  }, '#ccbb00', '#887700', ol * 0.7);
  outlinedPath(function() {
    ctx.moveTo(-hullW * 0.85, hullH * 0.3);
    ctx.lineTo(-hullW * 1.05, hullH * 0.8);
    ctx.lineTo(-hullW * 0.75, hullH * 0.3); ctx.closePath();
  }, '#ccbb00', '#887700', ol * 0.7);

  /* ── propeller ──────────────────────────────────── */
  var ps = (char.state === 'running_away') ? t * 30 : (char.state === 'walking' || char.state === 'returning') ? t * 8 : t * 3;
  ctx.strokeStyle = '#555'; ctx.lineWidth = Math.max(1.5, h * 0.018);
  for (var pb = 0; pb < 3; pb++) {
    var pa = ps + pb * Math.PI * 2 / 3;
    ctx.beginPath(); ctx.moveTo(-hullW, 0);
    ctx.lineTo(-hullW - Math.cos(pa) * h * 0.06, Math.sin(pa) * h * 0.06); ctx.stroke();
  }
  outlinedCircle(-hullW, 0, h * 0.013, '#777', '#444', ol * 0.4);

  ctx.restore();
}

// ── Whale (Jupiter) ────────────────────────────────────────────────────────
function drawWhale(cx, cy, s, char) {
  var t  = char.stateTimer;
  var h  = s * 2.0;
  var ol = Math.max(1.2, h * 0.01);
  var bodyW = h * 0.5, bodyH = h * 0.2;
  var surf = char.surfaceAmount || 0;

  ctx.save();
  ctx.translate(cx, cy);

  /* ── submerged ripples ──────────────────────────── */
  if (char.state === 'submerged') {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    for (var ri0 = 0; ri0 < 2; ri0++) {
      var rw0 = h * 0.08 + ri0 * h * 0.04;
      ctx.beginPath(); ctx.arc(0, 0, rw0, Math.PI, Math.PI * 2); ctx.stroke();
    }
    ctx.restore(); return;
  }

  /* ── squashed / splash ──────────────────────────── */
  if (char.state === 'squashed') {
    var sq = Math.min(1, t / 2);
    var wobble = Math.sin(t * 15) * (1 - sq) * bodyH * 0.3;
    outlinedEllipse(0, -bodyH * 0.3 * (1 - sq) + wobble, bodyW * (1 + sq * 0.2), Math.max(1, bodyH * 0.3 * (1 - sq * 0.8)), 'rgba(60,80,110,0.5)', 'rgba(30,45,65,0.3)', ol);
    ctx.fillStyle = 'rgba(200,220,255,0.3)';
    for (var si2 = 0; si2 < 6; si2++) {
      var sa2 = si2 * 1.05 - 1.5, sd2 = Math.min(t * 2, 1) * h * 0.25;
      ctx.beginPath(); ctx.arc(Math.cos(sa2) * sd2 * 2, -sd2 + Math.sin(sa2) * sd2 * 0.5, Math.max(2, h * 0.012), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore(); return;
  }

  /* ── surface ripples ────────────────────────────── */
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = Math.max(1, ol * 0.5);
  for (var ri = 0; ri < 3; ri++) {
    var rAge = (t * 0.5 + ri * 0.8) % 2.5;
    var rw = bodyW * 0.4 + rAge * bodyW * 0.4;
    ctx.beginPath(); ctx.arc(0, 0, rw, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }

  /* ── body (gradient ellipse, clipped above water) ─ */
  var peakY = -bodyH * surf;
  ctx.save();
  ctx.beginPath(); ctx.rect(-bodyW * 1.5, -h, bodyW * 3, h); ctx.clip();

  // Main body with gradient + outline
  var wG = ctx.createRadialGradient(-bodyW * 0.15, peakY + bodyH * 0.2, bodyH * 0.15, 0, peakY + bodyH * 0.5, bodyW);
  wG.addColorStop(0, 'rgb(90,115,160)');
  wG.addColorStop(0.5, 'rgb(60,82,120)');
  wG.addColorStop(1, 'rgb(40,55,85)');
  ctx.fillStyle = wG;
  ctx.beginPath(); ctx.ellipse(0, peakY + bodyH * 0.5, bodyW, bodyH, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(25,40,65,0.6)'; ctx.lineWidth = ol;
  ctx.beginPath(); ctx.ellipse(0, peakY + bodyH * 0.5, bodyW, bodyH, 0, 0, Math.PI * 2); ctx.stroke();

  // Belly lightening
  ctx.fillStyle = 'rgba(140,160,200,0.15)';
  ctx.beginPath(); ctx.ellipse(0, peakY + bodyH * 0.7, bodyW * 0.7, bodyH * 0.4, 0, 0, Math.PI * 2); ctx.fill();

  // Specular highlight on back
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.ellipse(-bodyW * 0.1, peakY + bodyH * 0.15, bodyW * 0.4, bodyH * 0.2, -0.2, 0, Math.PI * 2); ctx.fill();

  /* ── eye ────────────────────────────────────────── */
  if (surf > 0.5) {
    var eyeX = bodyW * 0.55, eyeY = peakY + bodyH * 0.15;
    cartoonEye(eyeX, eyeY, bodyH * 0.1, '#334466', {x: 1, y: 0}, 'normal');
  }

  ctx.restore(); // undo clip

  /* ── blowhole ───────────────────────────────────── */
  if (surf > 0.7) {
    var bhX = bodyW * 0.15, bhY = peakY - bodyH * 0.05;
    outlinedEllipse(bhX, bhY, bodyH * 0.06, bodyH * 0.03, 'rgba(40,55,85,0.55)', 'rgba(25,35,55,0.4)', ol * 0.5);
  }

  /* ── spout particles ────────────────────────────── */
  if (char.spoutParticles && char.spoutParticles.length > 0) {
    var bhBx = bodyW * 0.15, bhBy = peakY - bodyH * 0.08;
    for (var sp = 0; sp < char.spoutParticles.length; sp++) {
      var p = char.spoutParticles[sp];
      var pr = 1.5 + p.life * 2.5;
      ctx.fillStyle = 'rgba(200,220,255,' + (0.55 - p.life * 0.2) + ')';
      ctx.beginPath(); ctx.arc(bhBx + p.ox * s, bhBy + p.oy * s * 0.3, pr, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* ── tail flukes (diving) ───────────────────────── */
  if (char.state === 'diving' && surf < 0.6) {
    var tp = 1 - surf / 0.6;
    var tw = bodyW * 0.35 * tp;
    var ty = -bodyH * 0.3 * tp;
    // Left fluke
    outlinedPath(function() {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-tw * 0.5, ty - h * 0.08, -tw, ty);
      ctx.quadraticCurveTo(-tw * 0.3, ty + h * 0.02, 0, 0);
    }, 'rgb(55,75,110)', 'rgba(25,40,65,0.5)', ol);
    // Right fluke
    outlinedPath(function() {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(tw * 0.5, ty - h * 0.08, tw, ty);
      ctx.quadraticCurveTo(tw * 0.3, ty + h * 0.02, 0, 0);
    }, 'rgb(55,75,110)', 'rgba(25,40,65,0.5)', ol);
  }

  ctx.restore();
}

// ── Occasional character aside, beneath the target readout ──────────────────
function drawCharacterAside(char) {
  ctx.save();
  ctx.font = '500 13px system-ui, sans-serif';
  var maxWidth = Math.min(190, W - 112);
  var lines = [], current = '';
  for (var word of String(char.bubbleText).split(/\s+/)) {
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
  ctx.beginPath();ctx.roundRect(bx,by,bubbleW,bubbleH,12);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(bx+bubbleW-1,by+15);
  ctx.lineTo(bx+bubbleW+9,by+22);ctx.lineTo(bx+bubbleW-1,by+28);
  ctx.fill();ctx.stroke();
  ctx.fillStyle='#2d4145';ctx.textAlign='left';ctx.textBaseline='top';
  lines.forEach((line,i)=>ctx.fillText(line,bx+12,by+9+i*18));

  // A duplicate only while speaking; the character keeps moving in the field.
  ctx.beginPath();ctx.arc(W-52,90,36,0,Math.PI*2);ctx.clip();
  ctx.fillStyle='rgba(255,249,233,.78)';ctx.fill();
  var scale = char.type === 'newt' ? 100 : char.type === 'submarine' ? 74 : char.type === 'whale' ? 36 : 43;
  drawCharacterSprite(W-52,120,scale,char);
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
  var s = Math.max(currentPPM, 18);
  var _tw = toCanvas(TOWER_BASE_X_M, 0);
  var baseX = _tw.x;
  var baseY = _tw.y;            // ground level
  var rad = angleDeg * Math.PI / 180;

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
  var padH = Math.max(4, PAD_HEIGHT_M * s);
  var padGrad = ctx.createLinearGradient(0, baseY - padH, 0, baseY);
  padGrad.addColorStop(0, '#888');
  padGrad.addColorStop(1, '#666');
  ctx.fillStyle = padGrad;
  ctx.fillRect(baseX - padW / 2, baseY - padH, padW, padH);
  // Pad edge highlight
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.strokeRect(baseX - padW / 2, baseY - padH, padW, padH);

  // Bolt details on pad
  ctx.fillStyle = '#555';
  var boltR = Math.max(1.5, s * 0.02);
  var boltY = baseY - padH / 2;
  for (var b = 0; b < 5; b++) {
    var boltX = baseX - padW * 0.4 + (padW * 0.8) * (b / 4);
    ctx.beginPath();
    ctx.arc(boltX, boltY, boltR, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Flame Trench ──
  var trenchW = Math.max(10, 0.6 * s);
  var trenchD = Math.max(4, 0.12 * s);
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
  ctx.strokeStyle = '#c04020';  // industrial orange-red
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
  ctx.strokeStyle = '#a03818';
  ctx.lineWidth = Math.max(1, s * 0.018);
  var numBraces = Math.max(4, Math.round(towerH / 25));
  for (var i = 0; i < numBraces; i++) {
    var frac0 = i / numBraces;
    var frac1 = (i + 1) / numBraces;
    var y0 = -towerH * frac0;
    var y1 = -towerH * frac1;
    var lw0 = railW + (railTop - railW) * frac0;
    var rw0 = railW + (railTop - railW) * frac0;
    var lw1 = railW + (railTop - railW) * frac1;
    // Alternating X pattern
    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.moveTo(-lw0 + towerOff, y0);
      ctx.lineTo(lw1 + towerOff, y1);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(rw0 + towerOff, y0);
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
  ctx.strokeStyle = '#ddd';
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
function getNearestPlanetName() { return env.nearestPlanet.name; }
function getPlanets()           { return PLANETS; }

// Return the planet radius for a given surface gravity (interpolated between
// bracket planets, snapped to nearest when close).
function getPlanetRadius(g) {
  var b = findBracket(g);
  if (b.t === 0) return b.lo.radius;
  // Interpolate radius between the two bracketing planets
  return b.lo.radius + (b.hi.radius - b.lo.radius) * b.t;
}
function getGroundY()           { return groundY; }
function getBaseGroundY()       { return baseGroundY; }
function getWidth()             { return W; }
function getHeight()            { return H; }
function getCurrentPPM()        { return currentPPM; }

/**
 * Compute the PPM at which the whole planet fits in the viewport.
 * Uses PPM = canvasWidth / (2.5 × R) so the disc fills ~80% of the width.
 * Returns 0 if there's no planet radius (flat mode).
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
  BARREL_LENGTH_M:  BARREL_LENGTH_M,
  BALL_RADIUS_M:    BALL_RADIUS_M,
  TOWER_BASE_X_M:   TOWER_BASE_X_M,
  TOWER_HEIGHT_M:   TOWER_HEIGHT_M,
  ROCKET_LENGTH_M:  ROCKET_LENGTH_M,
  ROCKET_WIDTH_M:   ROCKET_WIDTH_M,
  init: init,
  resize: resize,
  updateWorld: updateWorld,
  setTargetGravity: setTargetGravity,
  setTargetZoom: setTargetZoom,
  setZoomImmediate: setZoomImmediate,
  resetZoom: resetZoom,
  setViewTransitionDuration: setViewTransitionDuration,
  setCameraTarget: setCameraTarget,
  setCameraTargetY: setCameraTargetY,
  setCameraImmediate: setCameraImmediate,
  setCameraImmediateY: setCameraImmediateY,
  resetCamera: resetCamera,
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
  toCanvasY: toCanvasY,
  toCanvas: toCanvas,
  screenToSurface: screenToSurface,
  getCannonTipPhys: getCannonTipPhys,
  getRocketPadPosition: getRocketPadPosition,
  getCannonPivotCanvas: getCannonPivotCanvas,
  isCurrentGas: isCurrentGas,
  getNearestPlanetName: getNearestPlanetName,
  getPlanets: getPlanets,
  getPlanetRadius: getPlanetRadius,
  getGroundY: getGroundY,
  getBaseGroundY: getBaseGroundY,
  getWidth: getWidth,
  getHeight: getHeight,
  getCurrentPPM: getCurrentPPM,
  getWholePlanetPPM: getWholePlanetPPM,
  getPlanetViewFrac: getPlanetViewFrac
};
