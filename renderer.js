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
 *   clear(), drawWorld(), drawCannon(), drawBall(), drawLandedBall()
 *   drawTrajectoryDot(), drawFlag(), drawCrater(), drawGasHole()
 *   drawParticles(), drawMuzzleFlash(), drawShockwave()
 *   toCanvasX(), toCanvasY(), getCannonTipPhys()
 *   isCurrentGas(), getNearestPlanetName(), getPlanets()
 *
 * LOADED BY: <script src="renderer.js"> in index.html (after physics.js)
 * ============================================================================
 */

(function () {
  'use strict';

  // ── Planet Data (sorted by gravity) ────────────────────────────────────────
  var PLANETS = [
    { name:'moon',    g:1.62,  isGas:false,
      skyTop:[5,5,15],       skyMid:[10,10,25],      skyBot:[25,25,45],
      groundTop:[150,148,142], groundBot:[115,113,108],
      subTop:[90,88,83],     subBot:[70,68,63],
      surfEdge:[165,163,158], moundCol:[135,133,128],
      features:'moon' },
    { name:'mercury', g:3.7,   isGas:false,
      skyTop:[8,6,18],       skyMid:[18,14,32],      skyBot:[35,30,48],
      groundTop:[145,130,115], groundBot:[115,100,85],
      subTop:[88,78,63],     subBot:[68,58,48],
      surfEdge:[160,145,130], moundCol:[135,120,105],
      features:'mercury' },
    { name:'mars',    g:3.72,  isGas:false,
      skyTop:[165,105,75],   skyMid:[195,135,100],   skyBot:[215,165,135],
      groundTop:[190,110,68], groundBot:[160,88,52],
      subTop:[130,68,38],    subBot:[100,52,28],
      surfEdge:[205,128,78], moundCol:[180,105,62],
      features:'mars' },
    { name:'uranus',  g:8.69,  isGas:true,
      skyTop:[85,165,190],   skyMid:[105,190,215],   skyBot:[135,205,225],
      groundTop:[75,155,185], groundBot:[55,125,160],
      subTop:[45,105,140],   subBot:[35,85,120],
      surfEdge:[90,170,200], moundCol:[70,150,180],
      features:'icegas' },
    { name:'venus',   g:8.87,  isGas:false,
      skyTop:[195,155,55],   skyMid:[205,170,75],    skyBot:[218,185,100],
      groundTop:[180,128,48], groundBot:[150,105,38],
      subTop:[125,82,28],    subBot:[100,62,20],
      surfEdge:[200,148,58], moundCol:[170,120,42],
      features:'venus' },
    { name:'earth',   g:9.81,  isGas:false,
      skyTop:[93,169,233],   skyMid:[135,206,235],   skyBot:[182,223,247],
      groundTop:[90,154,106], groundBot:[74,124,89],
      subTop:[107,68,35],    subBot:[74,47,21],
      surfEdge:[106,173,122], moundCol:[90,140,100],
      features:'earth' },
    { name:'saturn',  g:10.44, isGas:true,
      skyTop:[195,175,115],  skyMid:[210,195,145],   skyBot:[220,205,160],
      groundTop:[190,170,110], groundBot:[170,150,90],
      subTop:[150,130,75],   subBot:[130,110,58],
      surfEdge:[200,180,125], moundCol:[180,160,100],
      features:'saturn' },
    { name:'neptune', g:11.15, isGas:true,
      skyTop:[18,35,105],    skyMid:[28,55,140],     skyBot:[45,75,165],
      groundTop:[28,48,130], groundBot:[20,38,110],
      subTop:[15,28,90],     subBot:[10,20,68],
      surfEdge:[38,58,140],  moundCol:[25,42,118],
      features:'deepgas' },
    { name:'jupiter', g:24.79, isGas:true,
      skyTop:[200,150,100],  skyMid:[215,170,118],   skyBot:[225,185,140],
      groundTop:[180,128,78], groundBot:[160,108,58],
      subTop:[140,88,42],    subBot:[118,68,28],
      surfEdge:[190,138,88], moundCol:[170,118,68],
      features:'jupiter' }
  ];

  // ── Constants ──────────────────────────────────────────────────────────────
  var DEFAULT_PPM       = 80;
  var MIN_PPM           = 0.1;
  var GROUND_OFFSET     = 70;
  var CANNON_BASE_X_M   = 1.5;
  var CANNON_BASE_Y_M   = 1.0;
  var BARREL_LENGTH_M   = 1.5;
  var BALL_RADIUS_M     = 0.1;

  function setBarrelLength(m) {
    BARREL_LENGTH_M = Math.max(0.4, Math.min(4.0, m));
  }

  // ── State ──────────────────────────────────────────────────────────────────
  var canvas, ctx, W, H, groundY;
  var currentPPM  = DEFAULT_PPM;
  var targetPPM   = DEFAULT_PPM;
  var displayedGravity = 9.81;
  var targetGravity    = 9.81;
  var worldTime = 0;

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
      phase: 0, texture: 'lumpy', shapeVerts: []
    },
    {
      planet: 'mars', name: 'deimos',
      radius: 4, colour: [160, 150, 135],
      orbitPeriod: 60, yFrac: 0.18, yOscillation: 0.03,
      phase: 17.5, texture: 'lumpy', shapeVerts: []
    },
    {
      planet: 'earth', name: 'moon',
      radius: 25, colour: [230, 225, 210],
      orbitPeriod: 120, yFrac: 0.25, yOscillation: 0.02,
      phase: 5, texture: 'moon', shapeVerts: [],
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

  // ── Init & Resize ──────────────────────────────────────────────────────────
  function init(cvs) {
    canvas = cvs;
    ctx = canvas.getContext('2d');
    resize();
    generateFeatures();
    computeEnvironment();
  }

  function resize() {
    var p = canvas.parentElement;
    W = canvas.width  = p.clientWidth;
    H = canvas.height = p.clientHeight;
    groundY = H - GROUND_OFFSET;
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
    targetPPM = Math.max(MIN_PPM, ppm);
  }
  function resetZoom() { targetPPM = DEFAULT_PPM; }

  function setTargetGravity(g) { targetGravity = g; }

  function updateWorld(dt) {
    worldTime += dt;
    var gDiff = targetGravity - displayedGravity;
    if (Math.abs(gDiff) < 0.01) displayedGravity = targetGravity;
    else displayedGravity += gDiff * Math.min(1, dt * 6);

    var zDiff = targetPPM - currentPPM;
    if (Math.abs(zDiff) < 0.05) currentPPM = targetPPM;
    else {
      // Smooth constant-rate zoom — covers ~95% in ~1 second
      currentPPM += zDiff * Math.min(1, dt * 2.5);
    }

    // Recompute groundY based on zoom — when zoomed out, ground moves to bottom
    var zoomRatio = Math.min(1, currentPPM / DEFAULT_PPM);
    groundY = H - Math.max(12, GROUND_OFFSET * zoomRatio);

    computeEnvironment();
  }

  // ── Coordinate Mapping ─────────────────────────────────────────────────────
  function toCanvasX(px) { return px * currentPPM; }
  function toCanvasY(py) { return groundY - py * currentPPM; }

  function getCannonTipPhys(angleDeg) {
    var rad = angleDeg * Math.PI / 180;
    return {
      x: CANNON_BASE_X_M + BARREL_LENGTH_M * Math.cos(rad),
      y: CANNON_BASE_Y_M + BARREL_LENGTH_M * Math.sin(rad)
    };
  }
  function getCannonPivotCanvas() {
    return { x:toCanvasX(CANNON_BASE_X_M), y:toCanvasY(CANNON_BASE_Y_M) };
  }

  // ── Sky ────────────────────────────────────────────────────────────────────
  function drawSky() {
    var grad = ctx.createLinearGradient(0, 0, 0, groundY);
    grad.addColorStop(0,   rgb(env.skyTop));
    grad.addColorStop(0.6, rgb(env.skyMid));
    grad.addColorStop(1,   rgb(env.skyBot));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, groundY);
  }

  // ── Feature Drawing ────────────────────────────────────────────────────────
  function drawPlanetFeatures(planet, alpha) {
    if (alpha < 0.02) return;
    ctx.globalAlpha = alpha;
    switch (planet.features) {
      case 'moon':    drawStars(); drawCraterFieldFeature(); break;
      case 'mercury': drawStars(); drawCraterFieldFeature(); break;
      case 'mars':    drawStars(); drawCelestialBodies('mars'); drawMountains(planet); drawPhobosShadow(); break;
      case 'venus':   drawVolcanicHaze(); break;
      case 'earth':   drawCelestialBodies('earth'); drawClouds(); drawTreeline(); break;
      case 'saturn':  drawSaturnRings(); break;
      case 'icegas':  break;
      case 'deepgas': break;
      case 'jupiter': break;
    }
    ctx.globalAlpha = 1;
  }

  function drawStars() {
    for (var i = 0; i < starData.length; i++) {
      var s = starData[i];
      var twinkle = 0.5 + 0.5*Math.sin(worldTime*2 + i*3.7);
      ctx.fillStyle = 'rgba(255,255,255,'+(s.b*twinkle)+')';
      ctx.beginPath();
      ctx.arc(s.x*W, s.y*groundY, s.r, 0, Math.PI*2);
      ctx.fill();
    }
  }

  function drawClouds() {
    var zr = Math.min(1, currentPPM / DEFAULT_PPM);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (var i = 0; i < cloudData.length; i++) {
      var c = cloudData[i];
      var cx = (c.x + worldTime*0.008) % 1.3 - 0.1;
      var cr = c.r * zr;
      for (var p = 0; p < c.puffs; p++) {
        ctx.beginPath();
        ctx.arc(cx*W + p*cr*0.8, c.y*groundY + (p%2)*cr*0.3,
                cr, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  function drawTreeline() {
    var zr = Math.min(1, currentPPM / DEFAULT_PPM);
    ctx.fillStyle = '#2d5a3a';
    for (var i = 0; i < treeData.length; i++) {
      var t = treeData[i];
      var th = t.h * zr;
      var tw = t.w * zr;
      ctx.beginPath();
      ctx.moveTo(t.x*W - tw/2, groundY);
      ctx.lineTo(t.x*W, groundY - th);
      ctx.lineTo(t.x*W + tw/2, groundY);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawMountains(planet) {
    var zr = Math.min(1, currentPPM / DEFAULT_PPM);
    var col = lerpRGB(planet.groundTop, planet.skyBot, 0.4);
    ctx.fillStyle = rgb(col);
    for (var i = 0; i < mountainData.length; i++) {
      var m = mountainData[i];
      var mx = m.x*W;
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
    var grad = ctx.createLinearGradient(0, groundY*0.5, 0, groundY);
    grad.addColorStop(0, 'rgba(200,150,40,0)');
    grad.addColorStop(0.5, 'rgba(200,150,40,0.08)');
    grad.addColorStop(1, 'rgba(200,130,30,0.2)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, groundY);
  }

  function drawSaturnRings() {
    // From Saturn's surface, rings appear as a luminous band arcing across
    // the entire sky from horizon to horizon — like a colossal stripe overhead.
    //
    // Technique: place the ellipse centre FAR below the canvas so only a
    // small arc segment (the top of the huge ellipse) is visible in the sky
    // area. This gives the "band sweeping past" look, not a full ring.

    ctx.save();
    // Clip to sky so nothing bleeds below the ground line
    ctx.beginPath();
    ctx.rect(0, 0, W, groundY);
    ctx.clip();

    // Slowly rotate where the arc crosses the sky
    var drift = worldTime * 0.015;
    var tilt  = 0.25 + Math.sin(worldTime * 0.04) * 0.12;  // gentle tilt sway

    // Centre sits far below canvas — only the top arc peeks into view
    var cx = W * 0.5 + Math.sin(drift) * W * 0.15;
    var cy = groundY + H * 2.8;
    var baseR = H * 2.9;            // massive radius → gentle arc curvature

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

    for (var i = 0; i < ringDefs.length; i++) {
      var rd = ringDefs[i];
      var r  = baseR + rd.rOff;
      ctx.strokeStyle = 'rgba('+rd.col[0]+','+rd.col[1]+','+rd.col[2]+','+rd.a+')';
      ctx.lineWidth = rd.w;
      ctx.beginPath();
      // Slight eccentricity so the arc isn't perfectly circular
      ctx.ellipse(cx, cy, r, r * 0.97, tilt, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Faint glow along the brightest band
    var glowR = baseR;
    ctx.strokeStyle = 'rgba(230,215,170,0.06)';
    ctx.lineWidth = 40;
    ctx.beginPath();
    ctx.ellipse(cx, cy, glowR, glowR * 0.97, tilt, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // ── Celestial Body Drawing ─────────────────────────────────────────────────
  function drawCelestialBodies(planetName) {
    for (var i = 0; i < celestialBodies.length; i++) {
      var body = celestialBodies[i];
      if (body.planet !== planetName) continue;

      // Compute screen position: wraps across screen with margin off each side
      var xFrac = ((worldTime + body.phase) / body.orbitPeriod) % 1.3 - 0.15;
      var yBase = body.yFrac * groundY;
      var yBob  = Math.sin(worldTime * 0.5 + body.phase) * body.yOscillation * groundY;
      var cx = xFrac * W;
      var cy = yBase + yBob;

      // Skip if fully off screen
      if (cx < -body.radius * 2 || cx > W + body.radius * 2) continue;

      if (body.texture === 'lumpy') {
        drawLumpyMoon(cx, cy, body);
      } else if (body.texture === 'moon') {
        drawEarthMoon(cx, cy, body);
      }
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

      var xFrac = ((worldTime + body.phase) / body.orbitPeriod) % 1.3 - 0.15;
      // Only draw shadow when Phobos is over the visible area
      if (xFrac < -0.05 || xFrac > 1.05) continue;

      var shadowX = xFrac * W;
      var shadowW = 30 + Math.sin(worldTime * 0.8) * 5;
      var shadowH = 6;

      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.beginPath();
      ctx.ellipse(shadowX, groundY + 1, shadowW, shadowH, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCraterFieldFeature() {
    for (var i = 0; i < craterFieldData.length; i++) {
      var c = craterFieldData[i];
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.ellipse(c.x*W, groundY+2, c.r, c.r*0.35, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.ellipse(c.x*W, groundY+1, c.r*0.7, c.r*0.22, 0, 0, Math.PI*2);
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

    var grad = ctx.createLinearGradient(0, groundY, 0, groundY + surfDepth);
    grad.addColorStop(0, rgb(env.groundTop));
    grad.addColorStop(1, rgb(env.groundBot));
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY, W, surfDepth);

    ctx.fillStyle = rgb(env.surfEdge);
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (var x = 0; x <= W; x += 10) {
      ctx.lineTo(x, groundY - edgeAmp*Math.sin(x*0.05) - edgeAmp2*Math.sin(x*0.13));
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
    var grad = ctx.createLinearGradient(0, groundY, 0, H);
    grad.addColorStop(0, rgb(env.groundTop));
    grad.addColorStop(0.5, rgb(env.groundBot));
    grad.addColorStop(1, rgb(env.subBot));
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY-5, W, H-groundY+5);

    ctx.fillStyle = rgb(env.surfEdge);
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (var x = 0; x <= W; x += 8) {
      var turb = Math.sin(x*0.03+worldTime*1.8)*5
               + Math.sin(x*0.07+worldTime*1.3)*3
               + Math.sin(x*0.15+worldTime*2.5)*2;
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
        ctx.lineTo(x2, bandY+shift + Math.sin(x2*s.freq+worldTime*0.7)*s.amp);
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
    var px = toCanvasX(CANNON_BASE_X_M);
    var zr = Math.min(1, currentPPM / DEFAULT_PPM);
    var mw = Math.max(25, 0.9*currentPPM);
    var mh = Math.max(6, mw*0.28);
    ctx.fillStyle = rgb(env.moundCol);
    ctx.beginPath();
    ctx.ellipse(px, groundY, mw, mh, 0, 0, Math.PI*2);
    ctx.fill();
  }

  // ── Cannon (Castle Rampart Fixed Mount) ────────────────────────────────────
  function drawCannon(angleDeg, recoilOffset) {
    var pivCX = toCanvasX(CANNON_BASE_X_M);
    var pivCY = toCanvasY(CANNON_BASE_Y_M);
    var rad = angleDeg * Math.PI / 180;
    var recoil = recoilOffset || 0;
    var s = Math.max(currentPPM, 18); // min visual scale for readability

    // ── Rampart wall ──
    var wallW  = 1.4 * s;
    var wallTop = pivCY;
    var wallBot = groundY;
    var topHW  = wallW * 0.45;
    var botHW  = wallW * 0.55;

    var stoneGrad = ctx.createLinearGradient(0, wallTop, 0, wallBot);
    stoneGrad.addColorStop(0, '#8a8278');
    stoneGrad.addColorStop(0.5, '#7a7268');
    stoneGrad.addColorStop(1, '#6a6258');
    ctx.fillStyle = stoneGrad;
    ctx.beginPath();
    ctx.moveTo(pivCX-topHW, wallTop);
    ctx.lineTo(pivCX+topHW, wallTop);
    ctx.lineTo(pivCX+botHW, wallBot);
    ctx.lineTo(pivCX-botHW, wallBot);
    ctx.closePath();
    ctx.fill();

    // Stone mortar lines
    ctx.strokeStyle = 'rgba(80,70,60,0.5)';
    ctx.lineWidth = 1;
    var blockH = Math.max(7, (wallBot-wallTop)/5);
    for (var row = 0; row < 5; row++) {
      var y = wallTop + blockH*(row+1);
      if (y >= wallBot) break;
      var frac = (y-wallTop)/(wallBot-wallTop);
      var hw = topHW + (botHW-topHW)*frac;
      ctx.beginPath();
      ctx.moveTo(pivCX-hw+2, y);
      ctx.lineTo(pivCX+hw-2, y);
      ctx.stroke();
      var vOff = (row%2) * 0.5;
      var bw = hw*2/3;
      for (var v = 0; v < 3; v++) {
        var vx = pivCX-hw + (v+vOff)*bw;
        if (vx > pivCX-hw+2 && vx < pivCX+hw-2) {
          ctx.beginPath();
          ctx.moveTo(vx, y-blockH+1);
          ctx.lineTo(vx, y);
          ctx.stroke();
        }
      }
    }

    // Crenellation
    var crenW = Math.max(5, wallW*0.14);
    var crenH = Math.max(6, (wallBot-wallTop)*0.15);
    ctx.fillStyle = '#8a8278';
    ctx.fillRect(pivCX-topHW, wallTop-crenH, crenW, crenH);
    ctx.fillRect(pivCX+topHW-crenW, wallTop-crenH, crenW, crenH);
    ctx.strokeStyle = 'rgba(80,70,60,0.5)';
    ctx.strokeRect(pivCX-topHW, wallTop-crenH, crenW, crenH);
    ctx.strokeRect(pivCX+topHW-crenW, wallTop-crenH, crenW, crenH);

    // Platform cap
    ctx.fillStyle = '#908880';
    ctx.fillRect(pivCX-topHW, wallTop, topHW*2, Math.max(3, s*0.04));

    // ── Metal pivot mount ──
    var bracketR = Math.max(8, 0.16*s);
    ctx.fillStyle = '#4a4a4a';
    ctx.beginPath();
    ctx.arc(pivCX, wallTop, bracketR, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = Math.max(1, s*0.015);
    ctx.beginPath();
    ctx.arc(pivCX, wallTop, bracketR, Math.PI, 0);
    ctx.stroke();

    // Pivot bolt
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(pivCX, wallTop, Math.max(3, s*0.04), 0, Math.PI*2);
    ctx.fill();

    // ── Barrel ──
    ctx.save();
    ctx.translate(pivCX, pivCY);
    ctx.rotate(-rad);

    var bLen = BARREL_LENGTH_M * s;
    var bW   = Math.max(9, 0.275*s);
    var tipW = Math.max(6, 0.19*s);
    var bStart = Math.max(-5, -0.12*s) - recoil;

    ctx.beginPath();
    ctx.moveTo(bStart, -bW/2);
    ctx.lineTo(bStart+bLen, -tipW/2);
    ctx.lineTo(bStart+bLen,  tipW/2);
    ctx.lineTo(bStart,  bW/2);
    ctx.closePath();

    var bGrad = ctx.createLinearGradient(0, -bW/2, 0, bW/2);
    bGrad.addColorStop(0, '#555');
    bGrad.addColorStop(0.5, '#2d2d2d');
    bGrad.addColorStop(1, '#444');
    ctx.fillStyle = bGrad;
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = Math.max(1, s*0.018);
    ctx.stroke();

    // Barrel rings
    ctx.strokeStyle = '#666';
    ctx.lineWidth = Math.max(1.5, s*0.022);
    var rSpace = Math.max(12, 0.38*s);
    for (var ring = rSpace*0.5; ring < bLen-5; ring += rSpace) {
      var ringFrac = ring/bLen;
      var rw = bW/2 - (bW-tipW)/2*ringFrac - 1;
      ctx.beginPath();
      ctx.moveTo(bStart+ring, -rw);
      ctx.lineTo(bStart+ring,  rw);
      ctx.stroke();
    }

    // Bore
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(bStart+bLen, 0, Math.max(2.5, tipW/2-2), 0, Math.PI*2);
    ctx.fill();

    // Fuse
    ctx.strokeStyle = '#aa8855';
    ctx.lineWidth = Math.max(1.5, s*0.02);
    var fuseLen = Math.max(8, s*0.12);
    ctx.beginPath();
    ctx.moveTo(bStart, 0);
    ctx.lineTo(bStart-fuseLen, -fuseLen*0.65);
    ctx.stroke();
    ctx.fillStyle = '#ffaa33';
    ctx.beginPath();
    ctx.arc(bStart-fuseLen, -fuseLen*0.65, Math.max(2, s*0.03), 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
  }

  // ── Cannonball ─────────────────────────────────────────────────────────────
  function drawBall(physX, physY, squashX, squashY) {
    var sx = squashX || 1, sy = squashY || 1;
    var cx = toCanvasX(physX), cy = toCanvasY(physY);
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
    ctx.arc(toCanvasX(physX), toCanvasY(physY), r, 0, Math.PI*2);
    ctx.fill();
  }

  // ── Flags ──────────────────────────────────────────────────────────────────
  function drawFlag(physX, shotNumber, springProgress) {
    var baseX = toCanvasX(physX), baseY = groundY;
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
    var cx = toCanvasX(physX), cy = groundY+2;
    var r1 = Math.max(8, 0.2*currentPPM);
    ctx.fillStyle = rgba(env.subBot, 0.8);
    ctx.beginPath(); ctx.ellipse(cx,cy,r1,r1*0.32,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = rgba(env.subTop, 0.6);
    ctx.beginPath(); ctx.ellipse(cx,cy-1,r1*0.7,r1*0.2,0,0,Math.PI*2); ctx.fill();
  }

  // ── Gas Hole (gas giants) ──────────────────────────────────────────────────
  function drawGasHole(physX) {
    var cx = toCanvasX(physX), cy = groundY+2;
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
      ctx.arc(toCanvasX(p.x), toCanvasY(p.y),
              Math.max(1, p.radius*currentPPM/DEFAULT_PPM), 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── Muzzle Flash ───────────────────────────────────────────────────────────
  function drawMuzzleFlash(angleDeg, progress) {
    if (progress <= 0 || progress > 1) return;
    var tip = getCannonTipPhys(angleDeg);
    var tipCX = toCanvasX(tip.x), tipCY = toCanvasY(tip.y);
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
    var cx = toCanvasX(physX);
    var cy = toCanvasY(physY);
    var s = Math.max(18, currentPPM);
    var h = s * 1.35;           // total height in canvas pixels (3x original)
    var t = poseData.timer || 0;
    var dir = poseData.direction || 1;
    var pose = poseData.pose || 'idle';

    var headR = h * 0.1;
    var bodyLen = h * 0.3;
    var legLen = h * 0.28;
    var armLen = h * 0.22;

    ctx.save();
    ctx.translate(cx, cy);

    // ── Pose parameters ──
    var armL = 0, armR = 0, legL = 0, legR = 0, lean = 0, jumpY = 0;

    switch (pose) {
      case 'idle':
        jumpY = Math.sin(t * 3) * 1.5;
        armL = Math.sin(t * 2) * 0.1;
        armR = Math.sin(t * 2 + 0.5) * 0.1;
        break;

      case 'running':
        lean = dir * 0.3;
        legL = Math.sin(t * 14) * 0.7;
        legR = Math.sin(t * 14 + Math.PI) * 0.7;
        armL = Math.sin(t * 14 + Math.PI) * 0.6;
        armR = Math.sin(t * 14) * 0.6;
        break;

      case 'screwing':
        // Both arms forward & rotating (wrench motion toward the barrel above)
        armL = -1.4 + Math.sin(t * 18) * 0.4;
        armR = -1.4 + Math.cos(t * 18) * 0.4;
        lean = Math.sin(t * 8) * 0.08;
        // Slight jump with effort
        jumpY = Math.abs(Math.sin(t * 9)) * 2;
        break;

      case 'carrying':
        // Arms up holding a barrel segment overhead
        armL = -2.5;
        armR = -2.5;
        lean = dir * 0.15;
        legL = Math.sin(t * 10) * 0.5;
        legR = Math.sin(t * 10 + Math.PI) * 0.5;
        break;

      case 'panicked':
        armL = Math.sin(t * 22) * 1.5;
        armR = Math.sin(t * 22 + 1.2) * 1.5;
        legL = Math.sin(t * 16) * 0.5;
        legR = Math.sin(t * 16 + Math.PI) * 0.5;
        jumpY = Math.abs(Math.sin(t * 12)) * h * 0.18;
        lean = Math.sin(t * 10) * 0.2;
        break;

      case 'celebrating':
        armL = -2.2 + Math.sin(t * 8) * 0.3;
        armR = -2.2 + Math.sin(t * 8 + 0.5) * 0.3;
        jumpY = Math.abs(Math.sin(t * 6)) * h * 0.22;
        break;
    }

    ctx.translate(0, -jumpY);

    // ── Hard hat ──
    var headCX = Math.sin(lean) * bodyLen * 0.2;
    var headCY = -(bodyLen + legLen);
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.ellipse(headCX, headCY - headR * 0.6, headR * 1.35, headR * 0.5, 0, Math.PI, 0);
    ctx.fill();
    // Hat brim
    ctx.fillStyle = '#e6b800';
    ctx.fillRect(headCX - headR * 1.4, headCY - headR * 0.25, headR * 2.8, headR * 0.25);

    // ── Head ──
    ctx.fillStyle = '#f5d7a0';
    ctx.beginPath();
    ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#222';
    var eyeOff = dir * headR * 0.3;
    ctx.beginPath();
    ctx.arc(headCX + eyeOff, headCY - headR * 0.1, headR * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Panicked/startled mouth
    if (pose === 'panicked') {
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(headCX + eyeOff * 0.5, headCY + headR * 0.4, headR * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Body (blue overalls) ──
    var neckX = headCX;
    var neckY = headCY + headR;
    var hipX = Math.sin(lean) * bodyLen * 0.3;
    var hipY = -legLen;
    ctx.strokeStyle = '#2255aa';
    ctx.lineWidth = Math.max(2.5, s * 0.035);
    ctx.beginPath();
    ctx.moveTo(neckX, neckY);
    ctx.lineTo(hipX, hipY);
    ctx.stroke();

    // ── Legs ──
    ctx.strokeStyle = '#2255aa';
    ctx.lineWidth = Math.max(2, s * 0.028);
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(hipX + Math.sin(legL) * legLen * 0.55, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(hipX + Math.sin(legR) * legLen * 0.55, 0);
    ctx.stroke();

    // Boots
    ctx.fillStyle = '#554422';
    var bootW = Math.max(3, s * 0.03);
    ctx.fillRect(hipX + Math.sin(legL) * legLen * 0.55 - bootW * 0.5, -bootW * 0.6, bootW, bootW * 0.6);
    ctx.fillRect(hipX + Math.sin(legR) * legLen * 0.55 - bootW * 0.5, -bootW * 0.6, bootW, bootW * 0.6);

    // ── Arms ──
    ctx.strokeStyle = '#f5d7a0';
    ctx.lineWidth = Math.max(1.5, s * 0.022);
    var shX = neckX;
    var shY = neckY + bodyLen * 0.12;
    // Left arm
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(shX + Math.sin(armL) * armLen, shY + Math.cos(armL) * armLen);
    ctx.stroke();
    // Right arm
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(shX + Math.sin(armR) * armLen, shY + Math.cos(armR) * armLen);
    ctx.stroke();

    // Gloves
    ctx.fillStyle = '#cc9922';
    var gloveR = Math.max(1.5, s * 0.02);
    ctx.beginPath();
    ctx.arc(shX + Math.sin(armL) * armLen, shY + Math.cos(armL) * armLen, gloveR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(shX + Math.sin(armR) * armLen, shY + Math.cos(armR) * armLen, gloveR, 0, Math.PI * 2);
    ctx.fill();

    // ── Wrench (when screwing) ──
    if (pose === 'screwing') {
      var wrenchHandX = shX + Math.sin(armL) * armLen;
      var wrenchHandY = shY + Math.cos(armL) * armLen;
      ctx.strokeStyle = '#888';
      ctx.lineWidth = Math.max(1, s * 0.015);
      var wrenchLen = armLen * 0.6;
      var wrenchAng = t * 18;
      ctx.beginPath();
      ctx.moveTo(wrenchHandX, wrenchHandY);
      ctx.lineTo(wrenchHandX + Math.sin(wrenchAng) * wrenchLen,
                 wrenchHandY - Math.abs(Math.cos(wrenchAng)) * wrenchLen);
      ctx.stroke();
      // Wrench head
      ctx.fillStyle = '#999';
      var whx = wrenchHandX + Math.sin(wrenchAng) * wrenchLen;
      var why = wrenchHandY - Math.abs(Math.cos(wrenchAng)) * wrenchLen;
      ctx.fillRect(whx - 2.5, why - 1, 5, 3);
    }

    // ── Barrel segment overhead (when carrying) ──
    if (pose === 'carrying') {
      ctx.fillStyle = '#444';
      var segW = Math.max(12, s * 0.25);
      var segH = Math.max(3, s * 0.05);
      ctx.fillRect(headCX - segW / 2, headCY - headR * 2 - segH, segW, segH);
      // Dark bore circle on end
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(headCX + dir * segW / 2, headCY - headR * 2 - segH / 2, segH * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Sweat drops (when panicked) ──
    if (pose === 'panicked') {
      ctx.fillStyle = 'rgba(100,180,230,0.7)';
      for (var sw = 0; sw < 2; sw++) {
        var swA = t * 8 + sw * 3;
        var swDist = headR * 1.8 + Math.abs(Math.sin(swA)) * headR;
        ctx.beginPath();
        ctx.arc(headCX + Math.cos(swA) * swDist, headCY + Math.sin(swA) * swDist * 0.5 - headR, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
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

  function outlinedEllipse(x, y, rx, ry, fill, outline, lw) {
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
  function dropShadow(x, y, w, h, opacity, tint) {
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
    var cx = toCanvasX(char.x);
    var cy = groundY;
    var s = Math.max(18, currentPPM); // min visual scale so characters stay visible

    switch (char.type) {
      case 'golfer':    drawGolfer(cx, cy, s, char); break;
      case 'alien':     drawAlien(cx, cy, s, char); break;
      case 'spaceman':  drawSpaceman(cx, cy, s, char); break;
      case 'robot':     drawRobot(cx, cy, s, char); break;
      case 'newt':      drawNewt(cx, cy, s, char); break;
      case 'whale':     drawWhale(cx, cy, s, char); break;
      case 'snowman':   drawSnowman(cx, cy, s, char); break;
      case 'submarine': drawSubmarine(cx, cy, s, char); break;
      case 'icerobot':  drawIceRobot(cx, cy, s, char); break;
    }

    // Thought bubble (drawn above head)
    if (char.bubbleText && (char.state === 'idle' || char.state === 'walking' || char.state === 'spouting')) {
      var bubbleYOff = s * 1.7;
      if (char.type === 'submarine') bubbleYOff = s * 1.2;
      else if (char.type === 'newt') bubbleYOff = s * 0.8;
      else if (char.type === 'whale') bubbleYOff = s * 2.0;
      drawThoughtBubble(cx, cy - bubbleYOff, s, char.bubbleText);
    }
  }

  // ── Golfer (Earth) ─────────────────────────────────────────────────────────
  function drawGolfer(cx, cy, s, char) {
    var t  = char.stateTimer;
    var dir = char.direction;
    var h  = s * 1.35;
    var ol = Math.max(1.2, h * 0.012);   // outline width scales with size
    var headR  = h * 0.18;               // BIG cartoon head
    var bodyH  = h * 0.22, bodyW = h * 0.18;
    var legLen = h * 0.26, legW = h * 0.07;
    var armLen = h * 0.20, armW = h * 0.055;
    var shoeW  = h * 0.08, shoeH = h * 0.04;
    var hipY   = 0;                       // hip at ground level (feet extend below)

    ctx.save();
    ctx.translate(cx, cy);

    /* ── squashed ───────────────────────────────────── */
    if (char.state === 'squashed') {
      var sq = Math.min(1, t / 0.8);
      dropShadow(0, 0, h * 0.35, h * 0.04, 0.25);
      outlinedEllipse(0, -h * 0.06, h * 0.3 * (1 + sq * 0.3), h * 0.06 * (1 - sq * 0.5), '#dbc49a', '#6a5030', ol);
      // Stars
      ctx.fillStyle = '#ffdd44';
      for (var si = 0; si < 3; si++) {
        var sa = t * 8 + si * 2.1;
        ctx.beginPath(); ctx.arc(Math.cos(sa) * h * 0.35, -h * 0.18 + Math.sin(sa * 1.3) * h * 0.08, Math.max(2, h * 0.018), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore(); return;
    }

    /* ── animation state ───────────────────────────── */
    var walk = 0, arm = 0, lean = 0, jumpY = 0;
    if (char.state === 'walking' || char.state === 'returning') {
      walk = Math.sin(t * 6) * 0.4; arm = Math.sin(t * 6) * 0.3;
    } else if (char.state === 'startled') {
      jumpY = Math.sin(Math.min(t, 0.5) * Math.PI) * h * 0.5;
      arm = Math.sin(t * 25) * 1.2;
    } else if (char.state === 'running_away') {
      walk = Math.sin(t * 16) * 0.6; arm = Math.sin(t * 16 + Math.PI) * 0.8;
      lean = 0.2 * dir;
    }
    ctx.translate(0, -jumpY);
    ctx.rotate(lean);

    // Drop shadow
    dropShadow(0, 0, h * 0.2, h * 0.03, 0.18);

    /* ── legs ───────────────────────────────────────── */
    var hipX = 0, hipYa = -bodyH * 0.15;
    // Back leg
    var bfx = Math.sin(walk + Math.PI) * legLen * 0.35;
    cartoonLimb(hipX - bodyW * 0.25, hipYa, hipX + bfx - bodyW * 0.1, hipYa + legLen, legW, legW * 0.85, '#556b2f', '#2a3a15', ol);
    // Shoe
    outlinedEllipse(hipX + bfx - bodyW * 0.1, hipYa + legLen + shoeH * 0.2, shoeW, shoeH, '#443322', '#221100', ol);
    // Front leg
    var ffx = Math.sin(walk) * legLen * 0.35;
    cartoonLimb(hipX + bodyW * 0.25, hipYa, hipX + ffx + bodyW * 0.1, hipYa + legLen, legW, legW * 0.85, '#556b2f', '#2a3a15', ol);
    outlinedEllipse(hipX + ffx + bodyW * 0.1, hipYa + legLen + shoeH * 0.2, shoeW, shoeH, '#443322', '#221100', ol);

    /* ── body (polo shirt) ──────────────────────────── */
    var bodyTop = hipYa - bodyH;
    gradientEllipse(0, hipYa - bodyH * 0.5, bodyW, bodyH * 0.55, '#f0eed8', '#d4d0b8', '#6a5030', ol);
    // Red stripe
    ctx.strokeStyle = '#cc4444'; ctx.lineWidth = Math.max(1.5, h * 0.015);
    ctx.beginPath(); ctx.moveTo(-bodyW * 0.85, hipYa - bodyH * 0.25); ctx.lineTo(bodyW * 0.85, hipYa - bodyH * 0.25); ctx.stroke();
    // Collar
    ctx.strokeStyle = '#bab6a0'; ctx.lineWidth = Math.max(1, h * 0.01);
    ctx.beginPath(); ctx.moveTo(-bodyW * 0.2, bodyTop + bodyH * 0.08); ctx.lineTo(0, bodyTop + bodyH * 0.18); ctx.lineTo(bodyW * 0.2, bodyTop + bodyH * 0.08); ctx.stroke();

    /* ── back arm ───────────────────────────────────── */
    var shoulderY = bodyTop + bodyH * 0.18;
    var baX = -dir * bodyW * 0.75;
    var bhX = baX + Math.sin(-arm) * armLen * 0.9;
    var bhY = shoulderY + Math.cos(-arm) * armLen * 0.9;
    cartoonLimb(baX, shoulderY, bhX, bhY, armW, armW * 0.7, '#dbc49a', '#8a7050', ol);
    outlinedCircle(bhX, bhY, armW * 0.45, '#dbc49a', '#8a7050', ol * 0.7); // hand

    /* ── front arm + club ───────────────────────────── */
    var faX = dir * bodyW * 0.75;
    var fhX = faX + Math.sin(arm) * armLen * 0.9;
    var fhY = shoulderY + Math.cos(arm) * armLen * 0.9;
    cartoonLimb(faX, shoulderY, fhX, fhY, armW, armW * 0.7, '#dbc49a', '#8a7050', ol);
    // Golf glove
    outlinedCircle(fhX, fhY, armW * 0.48, '#eee', '#888', ol * 0.7);

    // Golf club
    if (char.state === 'idle' || char.state === 'walking') {
      var cSwing = char.state === 'idle' ? Math.sin(t * 3) * 0.5 : 0.2;
      var cEndX = fhX + Math.sin(cSwing + 0.3) * armLen * 1.3;
      var cEndY = fhY + Math.cos(cSwing + 0.3) * armLen * 1.3;
      ctx.strokeStyle = '#777'; ctx.lineWidth = Math.max(1.5, h * 0.012);
      ctx.beginPath(); ctx.moveTo(fhX, fhY); ctx.lineTo(cEndX, cEndY); ctx.stroke();
      outlinedPath(function() {
        ctx.moveTo(cEndX - 4, cEndY - 1); ctx.lineTo(cEndX + 4, cEndY - 1);
        ctx.lineTo(cEndX + 5, cEndY + 2); ctx.lineTo(cEndX - 3, cEndY + 2); ctx.closePath();
      }, '#555', '#333', ol * 0.6);
    }
    // Club flying off
    if (char.state === 'startled' && t > 0.05) {
      ctx.save();
      ctx.translate(-dir * t * 40, shoulderY - t * 80 + t * t * 120);
      ctx.rotate(t * 12);
      ctx.strokeStyle = '#777'; ctx.lineWidth = Math.max(1.5, h * 0.012);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, armLen * 1.2); ctx.stroke();
      ctx.fillStyle = '#555'; ctx.fillRect(-4, armLen * 1.2, 8, 4);
      ctx.restore();
    }

    /* ── head ───────────────────────────────────────── */
    var headY = bodyTop - headR * 0.4;
    gradientCircle(0, headY, headR, '#eed8b8', '#c4a87a', '#6a5030', ol);
    // Rosy cheeks
    ctx.fillStyle = 'rgba(220,140,120,0.25)';
    ctx.beginPath(); ctx.arc(-headR * 0.45, headY + headR * 0.2, headR * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headR * 0.45, headY + headR * 0.2, headR * 0.18, 0, Math.PI * 2); ctx.fill();
    // Nose
    ctx.fillStyle = '#c4a07a';
    ctx.beginPath(); ctx.arc(dir * headR * 0.1, headY + headR * 0.08, headR * 0.1, 0, Math.PI * 2); ctx.fill();

    // Eyes
    var eyeDir = (char.state === 'running_away') ? -dir : dir;
    var eyeState = (char.state === 'startled' || char.state === 'running_away') ? 'startled'
                 : (char.state === 'idle') ? 'happy' : 'normal';
    cartoonEye(-headR * 0.3, headY - headR * 0.12, headR * 0.22, '#664422', {x: eyeDir, y: 0}, eyeState);
    cartoonEye(headR * 0.3, headY - headR * 0.12, headR * 0.22, '#664422', {x: eyeDir, y: 0}, eyeState);

    // Mouth
    if (char.state === 'startled' || char.state === 'running_away') {
      outlinedCircle(dir * headR * 0.05, headY + headR * 0.42, headR * 0.15, '#422', '#211', ol * 0.6);
    } else {
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = Math.max(1, h * 0.008);
      ctx.beginPath(); ctx.arc(0, headY + headR * 0.25, headR * 0.22, 0.15, Math.PI - 0.15); ctx.stroke();
    }

    /* ── flat cap ───────────────────────────────────── */
    var capY = headY - headR * 0.7;
    if (char.state !== 'startled' || t < 0.1) {
      outlinedPath(function() {
        ctx.moveTo(-headR * 1.1, capY + headR * 0.25);
        ctx.quadraticCurveTo(-headR * 1.15, capY - headR * 0.1, 0, capY - headR * 0.15);
        ctx.quadraticCurveTo(headR * 1.15, capY - headR * 0.1, headR * 1.1, capY + headR * 0.25);
        ctx.closePath();
      }, '#5a4a3a', '#2a1a0a', ol);
      // Brim
      outlinedPath(function() {
        ctx.moveTo(dir * headR * 0.2, capY + headR * 0.22);
        ctx.quadraticCurveTo(dir * headR * 1.3, capY + headR * 0.15, dir * headR * 1.5, capY + headR * 0.35);
        ctx.lineTo(dir * headR * 0.2, capY + headR * 0.35);
        ctx.closePath();
      }, '#4a3a2a', '#2a1a0a', ol);
    }
    // Hat flying off
    if (char.state === 'startled' && t > 0.1) {
      ctx.save();
      ctx.translate(dir * t * 30, capY - t * 60 + t * t * 80);
      ctx.rotate(t * 8);
      outlinedEllipse(0, 0, headR * 1.3, headR * 0.32, '#5a4a3a', '#2a1a0a', ol);
      ctx.restore();
    }

    ctx.restore();
  }

  // ── Alien (Mars) ───────────────────────────────────────────────────────────
  function drawAlien(cx, cy, s, char) {
    var t  = char.stateTimer;
    var dir = char.direction;
    var h  = s * 1.05;
    var bodyR = h * 0.38;
    var ol = Math.max(1.2, h * 0.012);

    ctx.save();
    ctx.translate(cx, cy);

    /* ── squashed ───────────────────────────────────── */
    if (char.state === 'squashed') {
      var sq = Math.min(1, t / 0.8);
      dropShadow(0, 0, bodyR * 1.3, bodyR * 0.08, 0.25);
      outlinedEllipse(0, -bodyR * 0.06, bodyR * 1.4 * (1 + sq * 0.2), bodyR * 0.12 * (1 - sq * 0.4), '#4a8a4a', '#1a4a1a', ol);
      ctx.fillStyle = '#ffdd44';
      for (var si = 0; si < 3; si++) {
        var sa = t * 10 + si * 2.1;
        ctx.beginPath(); ctx.arc(Math.cos(sa) * bodyR, -bodyR * 0.3 + Math.sin(sa * 1.3) * bodyR * 0.15, Math.max(2, h * 0.018), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore(); return;
    }

    /* ── animation ──────────────────────────────────── */
    var wx = 0, wy = 0, bsc = 1, jumpY = 0;
    if (char.state === 'walking' || char.state === 'returning') {
      wx = Math.sin(t * 5) * bodyR * 0.15;
      wy = Math.abs(Math.sin(t * 10)) * bodyR * 0.08;
    } else if (char.state === 'startled') {
      bsc = 1 + Math.sin(t * 15) * 0.12;
      jumpY = Math.sin(Math.min(t, 0.4) * Math.PI) * h * 0.5;
    } else if (char.state === 'running_away') {
      wx = Math.sin(t * 20) * bodyR * 0.3;
      wy = Math.abs(Math.sin(t * 20)) * bodyR * 0.15;
    }
    ctx.translate(wx, -wy - jumpY);

    // Drop shadow
    dropShadow(0, 0, bodyR * 0.55, bodyR * 0.05, 0.18);

    /* ── legs (stubby filled) ──────────────────────── */
    if (char.state === 'running_away') {
      ctx.globalAlpha = 0.35;
      for (var l = 0; l < 6; l++) {
        var la = t * 30 + l * Math.PI / 3;
        cartoonLimb(0, -bodyR * 0.05, Math.cos(la) * bodyR * 0.5, Math.sin(la) * bodyR * 0.2 + bodyR * 0.1, bodyR * 0.14, bodyR * 0.10, '#3a7a3a', '#1a4a1a', ol);
      }
      ctx.globalAlpha = 1;
    } else {
      var lsw = (char.state === 'walking' || char.state === 'returning') ? Math.sin(t * 5) * 0.4 : 0;
      // Feet
      var lfx = -bodyR * 0.25 + Math.sin(lsw) * bodyR * 0.25;
      var rfx = bodyR * 0.25 + Math.sin(lsw + Math.PI) * bodyR * 0.25;
      cartoonLimb(-bodyR * 0.25, -bodyR * 0.08, lfx, bodyR * 0.06, bodyR * 0.14, bodyR * 0.11, '#3a7a3a', '#1a4a1a', ol);
      outlinedEllipse(lfx, bodyR * 0.08, bodyR * 0.11, bodyR * 0.05, '#2a6a2a', '#1a4a1a', ol * 0.7);
      cartoonLimb(bodyR * 0.25, -bodyR * 0.08, rfx, bodyR * 0.06, bodyR * 0.14, bodyR * 0.11, '#3a7a3a', '#1a4a1a', ol);
      outlinedEllipse(rfx, bodyR * 0.08, bodyR * 0.11, bodyR * 0.05, '#2a6a2a', '#1a4a1a', ol * 0.7);
    }

    /* ── body (gradient circle + outline) ──────────── */
    ctx.save();
    ctx.scale(bsc, bsc);
    gradientCircle(0, -bodyR * 0.52, bodyR, '#6abf6a', '#2a5a2a', '#1a3a1a', ol);
    // Belly highlight
    ctx.fillStyle = 'rgba(180,255,180,0.12)';
    ctx.beginPath(); ctx.arc(-bodyR * 0.15, -bodyR * 0.7, bodyR * 0.45, 0, Math.PI * 2); ctx.fill();

    /* ── three eyes ────────────────────────────────── */
    var eyeY = -bodyR * 0.58;
    var eSz  = bodyR * 0.17;
    var eState = (char.state === 'startled') ? 'startled'
               : (char.state === 'running_away') ? 'startled'
               : (char.state === 'idle') ? 'happy' : 'normal';
    var eBig = (char.state === 'startled') ? 1.5 : 1.0;
    cartoonEye(-bodyR * 0.28, eyeY, eSz * eBig, '#aadd00', {x: dir, y: 0}, eState);
    cartoonEye(bodyR * 0.28, eyeY, eSz * eBig, '#aadd00', {x: dir, y: 0}, eState);
    cartoonEye(0, eyeY - bodyR * 0.28, eSz * 0.85 * eBig, '#aadd00', {x: dir, y: -0.3}, eState);

    /* ── mouth ──────────────────────────────────────── */
    if (char.state === 'startled' || char.state === 'running_away') {
      outlinedEllipse(0, -bodyR * 0.2, bodyR * 0.13, bodyR * 0.1, '#1a4a1a', '#0a2a0a', ol * 0.7);
    } else {
      ctx.strokeStyle = '#1a4a1a'; ctx.lineWidth = Math.max(1, ol * 0.7);
      ctx.beginPath(); ctx.arc(0, -bodyR * 0.28, bodyR * 0.18, 0.15, Math.PI - 0.15); ctx.stroke();
    }
    ctx.restore(); // undo body scale

    /* ── tentacle arms (thick Bézier + outline) ───── */
    var aw = (char.state === 'startled') ? Math.sin(t * 20) * 1.0
           : (char.state === 'running_away') ? Math.sin(t * 15) * 0.8
           : Math.sin(t * 2) * 0.25;
    var tw = Math.max(2.5, bodyR * 0.09);
    // Left tentacle
    outlinedPath(function() {
      ctx.moveTo(-bodyR * 0.72, -bodyR * 0.45);
      ctx.quadraticCurveTo(-bodyR * 1.25, -bodyR * 0.65 + Math.sin(aw) * bodyR * 0.4,
                           -bodyR * 1.0, -bodyR * 0.15 + Math.cos(aw) * bodyR * 0.3);
      ctx.lineTo(-bodyR * 0.95, -bodyR * 0.1 + Math.cos(aw) * bodyR * 0.3);
      ctx.quadraticCurveTo(-bodyR * 1.15, -bodyR * 0.55 + Math.sin(aw) * bodyR * 0.35,
                           -bodyR * 0.62, -bodyR * 0.38);
      ctx.closePath();
    }, '#3a7a3a', '#1a4a1a', ol);
    // Suction cups on left
    outlinedCircle(-bodyR * 1.0, -bodyR * 0.12 + Math.cos(aw) * bodyR * 0.3, tw * 0.45, '#55aa55', '#1a4a1a', ol * 0.5);

    // Right tentacle
    outlinedPath(function() {
      ctx.moveTo(bodyR * 0.72, -bodyR * 0.45);
      ctx.quadraticCurveTo(bodyR * 1.25, -bodyR * 0.65 + Math.sin(aw + 1) * bodyR * 0.4,
                           bodyR * 1.0, -bodyR * 0.15 + Math.cos(aw + 1) * bodyR * 0.3);
      ctx.lineTo(bodyR * 0.95, -bodyR * 0.1 + Math.cos(aw + 1) * bodyR * 0.3);
      ctx.quadraticCurveTo(bodyR * 1.15, -bodyR * 0.55 + Math.sin(aw + 1) * bodyR * 0.35,
                           bodyR * 0.62, -bodyR * 0.38);
      ctx.closePath();
    }, '#3a7a3a', '#1a4a1a', ol);
    outlinedCircle(bodyR * 1.0, -bodyR * 0.12 + Math.cos(aw + 1) * bodyR * 0.3, tw * 0.45, '#55aa55', '#1a4a1a', ol * 0.5);

    /* ── antennae (thick stalks + glow bulbs) ──────── */
    var antW = Math.max(2, bodyR * 0.06);
    var antGlow = 0.5 + Math.sin(t * 4) * 0.4;
    // Left antenna
    cartoonLimb(-bodyR * 0.15, -bodyR * 1.3, -bodyR * 0.3, -bodyR * 1.6, antW, antW * 0.5, '#3a7a3a', '#1a4a1a', ol * 0.7);
    gradientCircle(-bodyR * 0.3, -bodyR * 1.62, bodyR * 0.07, '#ccffcc', '#55cc55', '#1a4a1a', ol * 0.6);
    ctx.fillStyle = 'rgba(170,255,170,' + antGlow * 0.3 + ')';
    ctx.beginPath(); ctx.arc(-bodyR * 0.3, -bodyR * 1.62, bodyR * 0.14, 0, Math.PI * 2); ctx.fill();
    // Right antenna
    cartoonLimb(bodyR * 0.15, -bodyR * 1.3, bodyR * 0.3, -bodyR * 1.6, antW, antW * 0.5, '#3a7a3a', '#1a4a1a', ol * 0.7);
    gradientCircle(bodyR * 0.3, -bodyR * 1.62, bodyR * 0.07, '#ccffcc', '#55cc55', '#1a4a1a', ol * 0.6);
    ctx.fillStyle = 'rgba(170,255,170,' + antGlow * 0.3 + ')';
    ctx.beginPath(); ctx.arc(bodyR * 0.3, -bodyR * 1.62, bodyR * 0.14, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  // ── Spaceman (Moon) ────────────────────────────────────────────────────────
  function drawSpaceman(cx, cy, s, char) {
    var t  = char.stateTimer;
    var dir = char.direction;
    var h  = s * 1.5;
    var ol = Math.max(1.2, h * 0.012);
    var helmetR = h * 0.19;
    var bodyW   = h * 0.16, bodyH = h * 0.24;
    var legLen  = h * 0.22, legW = h * 0.065;
    var armLen  = h * 0.20, armW = h * 0.055;
    var bootW   = h * 0.07, bootH = h * 0.04;

    ctx.save();
    ctx.translate(cx, cy);

    /* ── squashed ───────────────────────────────────── */
    if (char.state === 'squashed') {
      var sq = Math.min(1, t / 0.8);
      dropShadow(0, 0, h * 0.35, h * 0.04, 0.25);
      outlinedEllipse(0, -h * 0.05, h * 0.33 * (1 + sq * 0.25), h * 0.06 * (1 - sq * 0.5), '#ddd', '#888', ol);
      outlinedEllipse(0, -h * 0.07, h * 0.12, h * 0.03, '#88ccee', '#558899', ol * 0.6);
      ctx.fillStyle = '#ffdd44';
      for (var si = 0; si < 3; si++) {
        var sa = t * 8 + si * 2.1;
        ctx.beginPath(); ctx.arc(Math.cos(sa) * h * 0.3, -h * 0.2 + Math.sin(sa * 1.3) * h * 0.1, Math.max(2, h * 0.018), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore(); return;
    }

    /* ── animation ──────────────────────────────────── */
    var bounceY = 0, legSw = 0, armSw = 0;
    if (char.state === 'walking' || char.state === 'returning') {
      var rb = Math.sin(t * 3);
      bounceY = Math.max(0, rb) * h * 0.25;
      legSw = Math.sin(t * 3) * 0.35;
      armSw = Math.sin(t * 3 + 0.5) * 0.2;
    } else if (char.state === 'startled') {
      var jt = Math.min(t, 1.0);
      bounceY = (jt * 2.5 - jt * jt * 1.5) * h * 0.8;
      armSw = Math.sin(t * 18) * 1.0;
    } else if (char.state === 'running_away') {
      var lp = (t * 2.5) % 1.0;
      bounceY = Math.sin(lp * Math.PI) * h * 0.7;
      legSw = Math.sin(t * 8) * 0.6;
      armSw = Math.sin(t * 8 + Math.PI) * 0.7;
    }
    ctx.translate(0, -bounceY);

    // Drop shadow
    dropShadow(0, legLen + bootH * 0.3, h * 0.22, h * 0.025, 0.15);

    /* ── legs (filled tubes + boots) ───────────────── */
    var lx1 = -bodyW * 0.55, lx2 = bodyW * 0.55;
    var lfx1 = lx1 + Math.sin(legSw) * legLen * 0.4;
    var lfx2 = lx2 + Math.sin(legSw + Math.PI) * legLen * 0.4;
    cartoonLimb(lx1, 0, lfx1, legLen, legW, legW * 0.9, '#ccc', '#888', ol);
    cartoonLimb(lx2, 0, lfx2, legLen, legW, legW * 0.9, '#ccc', '#888', ol);
    // Boots
    outlinedEllipse(lfx1, legLen + bootH * 0.1, bootW, bootH, '#777', '#444', ol);
    outlinedEllipse(lfx2, legLen + bootH * 0.1, bootW, bootH, '#777', '#444', ol);

    /* ── backpack ───────────────────────────────────── */
    outlinedPath(function() {
      roundRect(-bodyW * 1.25, -bodyH * 0.75, bodyW * 0.4, bodyH * 0.7, h * 0.02);
    }, '#999', '#666', ol);

    /* ── body (suit torso) ──────────────────────────── */
    gradientEllipse(0, -bodyH * 0.42, bodyW * 1.05, bodyH * 0.55, '#e8e8e8', '#b0b0b0', '#777', ol);
    // Red stripe
    ctx.strokeStyle = '#cc4444'; ctx.lineWidth = Math.max(1.5, h * 0.013);
    ctx.beginPath(); ctx.moveTo(-bodyW * 0.9, -bodyH * 0.22); ctx.lineTo(bodyW * 0.9, -bodyH * 0.22); ctx.stroke();
    // Suit collar ring
    outlinedEllipse(0, -bodyH * 0.85, bodyW * 0.5, h * 0.02, '#bbb', '#777', ol * 0.6);

    /* ── arms (filled + gloves) ─────────────────────── */
    var shY = -bodyH * 0.65;
    var laX = -bodyW * 1.05 - Math.cos(armSw) * armLen;
    var laY = shY + Math.sin(armSw) * armLen + armLen * 0.5;
    var raX = bodyW * 1.05 + Math.cos(-armSw) * armLen;
    var raY = shY + Math.sin(-armSw) * armLen + armLen * 0.5;
    cartoonLimb(-bodyW * 1.05, shY, laX, laY, armW, armW * 0.8, '#ddd', '#999', ol);
    cartoonLimb(bodyW * 1.05, shY, raX, raY, armW, armW * 0.8, '#ddd', '#999', ol);
    // Gloves
    outlinedCircle(laX, laY, armW * 0.5, '#eee', '#999', ol * 0.7);
    outlinedCircle(raX, raY, armW * 0.5, '#eee', '#999', ol * 0.7);

    /* ── helmet (big bubble) ────────────────────────── */
    var hY = -bodyH - helmetR * 0.35;
    // Outer shell
    gradientCircle(0, hY, helmetR * 1.15, '#eaeaea', '#b0b0b0', '#777', ol);
    // Visor
    var vG = ctx.createLinearGradient(-helmetR * 0.6, hY - helmetR * 0.3, helmetR * 0.6, hY + helmetR * 0.3);
    vG.addColorStop(0, 'rgba(100,180,230,0.85)');
    vG.addColorStop(0.5, 'rgba(220,200,120,0.7)');
    vG.addColorStop(1, 'rgba(100,180,230,0.85)');
    ctx.fillStyle = vG;
    ctx.beginPath(); ctx.arc(0, hY, helmetR * 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6688aa'; ctx.lineWidth = ol * 0.7;
    ctx.beginPath(); ctx.arc(0, hY, helmetR * 0.75, 0, Math.PI * 2); ctx.stroke();
    // Visor glint
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(-helmetR * 0.25, hY - helmetR * 0.25, helmetR * 0.2, 0, Math.PI * 2); ctx.fill();

    /* ── face through visor ─────────────────────────── */
    if (char.state === 'startled' || char.state === 'running_away') {
      cartoonEye(-helmetR * 0.22, hY - helmetR * 0.05, helmetR * 0.18, '#446688', {x: 0, y: 0}, 'startled');
      cartoonEye(helmetR * 0.22, hY - helmetR * 0.05, helmetR * 0.18, '#446688', {x: 0, y: 0}, 'startled');
      outlinedCircle(0, hY + helmetR * 0.28, helmetR * 0.13, '#333', '#111', ol * 0.5);
      // Sweat drops
      if (char.state === 'startled') {
        ctx.fillStyle = 'rgba(100,180,230,0.6)';
        for (var sw = 0; sw < 3; sw++) {
          var swA = t * 6 + sw * 2.2;
          var swD = helmetR * 1.3 + t * 20;
          ctx.beginPath(); ctx.arc(Math.cos(swA) * swD, hY + Math.sin(swA) * swD * 0.5, Math.max(2, h * 0.014), 0, Math.PI * 2); ctx.fill();
        }
      }
    } else {
      // Calm face — just visor reflection
      cartoonEye(-helmetR * 0.2, hY - helmetR * 0.05, helmetR * 0.14, '#446688', {x: dir, y: 0}, char.state === 'idle' ? 'happy' : 'normal');
      cartoonEye(helmetR * 0.2, hY - helmetR * 0.05, helmetR * 0.14, '#446688', {x: dir, y: 0}, char.state === 'idle' ? 'happy' : 'normal');
      // Gentle smile
      ctx.strokeStyle = '#335566'; ctx.lineWidth = Math.max(1, ol * 0.6);
      ctx.beginPath(); ctx.arc(0, hY + helmetR * 0.15, helmetR * 0.18, 0.15, Math.PI - 0.15); ctx.stroke();
    }

    ctx.restore();
  }

  // ── Robot (Mercury) ────────────────────────────────────────────────────────
  function drawRobot(cx, cy, s, char) {
    var t  = char.stateTimer;
    var dir = char.direction;
    var h  = s * 1.2;
    var ol = Math.max(1.2, h * 0.012);
    var headW = h * 0.18, headH = h * 0.15;
    var bodyW = h * 0.2, bodyH = h * 0.28;
    var legW2 = h * 0.07, legH2 = h * 0.2;
    var armW2 = h * 0.055, armH2 = h * 0.18;
    var footW = legW2 * 1.5, footH = h * 0.035;

    ctx.save();
    ctx.translate(cx, cy);

    /* ── squashed ───────────────────────────────────── */
    if (char.state === 'squashed') {
      var sq = Math.min(1, t / 0.8);
      dropShadow(0, 0, bodyW * 1.4, h * 0.04, 0.25);
      outlinedEllipse(0, -h * 0.04, bodyW * 1.3 * (1 + sq * 0.3), h * 0.04 * (1 - sq * 0.5), '#8a7a65', '#5a4a35', ol);
      ctx.fillStyle = '#aaa';
      for (var bi = 0; bi < 4; bi++) {
        var ba = t * 5 + bi * 1.6, bd = t * 40 + bi * 8;
        ctx.beginPath(); ctx.arc(Math.cos(ba) * bd, -h * 0.1 + Math.sin(ba * 1.3) * bd * 0.5, Math.max(1.5, h * 0.012), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore(); return;
    }

    /* ── animation ──────────────────────────────────── */
    var wc = 0, lean = 0, armAng = 0;
    if (char.state === 'walking' || char.state === 'returning') {
      wc = Math.floor(t * 4) % 2;
      lean = Math.sin(t * 4) * 0.03;
      armAng = Math.sin(t * 4) * 0.15;
    } else if (char.state === 'running_away') {
      wc = Math.floor(t * 14) % 2;
      lean = -0.15 * dir;
      armAng = Math.sin(t * 14) * 0.4;
    } else if (char.state === 'startled') {
      lean = Math.sin(t * 20) * 0.08;
      armAng = -1.2;
    }
    ctx.rotate(lean);

    // Drop shadow
    dropShadow(0, legH2 + footH, h * 0.2, h * 0.025, 0.15);

    /* ── heat shimmer ──────────────────────────────── */
    ctx.strokeStyle = 'rgba(255,200,100,0.12)'; ctx.lineWidth = 1;
    for (var hi = 0; hi < 3; hi++) {
      var hx0 = (hi - 1) * bodyW * 0.8;
      ctx.beginPath();
      for (var hy = 0; hy < 4; hy++) {
        var yy = hy * h * 0.08, xx = hx0 + Math.sin(t * 4 + hy * 1.5 + hi) * 3;
        if (hy === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }

    /* ── legs (filled rectangles + feet) ───────────── */
    var lo1 = wc === 0 ? -legH2 * 0.15 : 0;
    var lo2 = wc === 1 ? -legH2 * 0.15 : 0;
    outlinedPath(function() { roundRect(-bodyW * 0.55, lo1, legW2, legH2 - lo1, h * 0.01); }, '#7a6a55', '#4a3a25', ol);
    outlinedPath(function() { roundRect(bodyW * 0.55 - legW2, lo2, legW2, legH2 - lo2, h * 0.01); }, '#7a6a55', '#4a3a25', ol);
    // Feet
    outlinedPath(function() { roundRect(-bodyW * 0.6, legH2 - footH * 0.2, footW, footH, h * 0.008); }, '#6a5a45', '#3a2a15', ol);
    outlinedPath(function() { roundRect(bodyW * 0.55 - legW2 * 0.5, legH2 - footH * 0.2, footW, footH, h * 0.008); }, '#6a5a45', '#3a2a15', ol);

    /* ── body (boxy with rivets + gauge) ───────────── */
    var bY = -bodyH - legH2 * 0.08;
    gradientEllipse(0, bY + bodyH * 0.5, bodyW * 1.05, bodyH * 0.55, '#9a8a70', '#6a5a45', '#4a3a25', ol);
    // Rivets
    var rr = Math.max(1.5, h * 0.013);
    outlinedCircle(-bodyW * 0.7, bY + bodyH * 0.2, rr, '#bbb', '#777', ol * 0.5);
    outlinedCircle(bodyW * 0.7, bY + bodyH * 0.2, rr, '#bbb', '#777', ol * 0.5);
    outlinedCircle(-bodyW * 0.7, bY + bodyH * 0.8, rr, '#bbb', '#777', ol * 0.5);
    outlinedCircle(bodyW * 0.7, bY + bodyH * 0.8, rr, '#bbb', '#777', ol * 0.5);
    // Chest gauge
    outlinedCircle(0, bY + bodyH * 0.5, bodyW * 0.25, 'rgba(50,50,50,0.15)', '#555', ol * 0.6);
    ctx.strokeStyle = '#cc3333'; ctx.lineWidth = Math.max(1, ol * 0.5);
    var nA = t * 2.5;
    ctx.beginPath(); ctx.moveTo(0, bY + bodyH * 0.5);
    ctx.lineTo(Math.cos(nA) * bodyW * 0.2, bY + bodyH * 0.5 + Math.sin(nA) * bodyW * 0.2); ctx.stroke();

    /* ── arms (with pincers) ───────────────────────── */
    var aY = bY + bodyH * 0.25;
    // Left arm
    ctx.save(); ctx.translate(-bodyW, aY); ctx.rotate(armAng);
    outlinedPath(function() { roundRect(-armW2, 0, armW2, armH2, h * 0.008); }, '#7a6a55', '#4a3a25', ol);
    // Pincer left
    ctx.strokeStyle = '#4a3a25'; ctx.lineWidth = Math.max(1.5, ol);
    ctx.beginPath(); ctx.moveTo(-armW2 * 0.5, armH2); ctx.lineTo(-armW2 * 1.8, armH2 + armH2 * 0.22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-armW2 * 0.5, armH2); ctx.lineTo(armW2 * 0.3, armH2 + armH2 * 0.22); ctx.stroke();
    ctx.restore();
    // Right arm
    ctx.save(); ctx.translate(bodyW, aY); ctx.rotate(-armAng);
    outlinedPath(function() { roundRect(0, 0, armW2, armH2, h * 0.008); }, '#7a6a55', '#4a3a25', ol);
    ctx.strokeStyle = '#4a3a25'; ctx.lineWidth = Math.max(1.5, ol);
    ctx.beginPath(); ctx.moveTo(armW2 * 0.5, armH2); ctx.lineTo(-armW2 * 0.3, armH2 + armH2 * 0.22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(armW2 * 0.5, armH2); ctx.lineTo(armW2 * 1.8, armH2 + armH2 * 0.22); ctx.stroke();
    ctx.restore();

    /* ── head ───────────────────────────────────────── */
    var hYr = bY - headH * 0.1;
    outlinedPath(function() { roundRect(-headW, hYr, headW * 2, headH, h * 0.018); }, '#9a8a75', '#5a4a35', ol);
    // LED eyes
    var blink = Math.floor(t * 2) % 3;
    var lcol = blink === 0 ? '#ff3333' : '#33ff33';
    var rcol = blink === 1 ? '#ff3333' : '#33ff33';
    outlinedCircle(-headW * 0.45, hYr + headH * 0.45, headW * 0.18, lcol, '#333', ol * 0.5);
    outlinedCircle(headW * 0.45, hYr + headH * 0.45, headW * 0.18, rcol, '#333', ol * 0.5);
    // LED glow
    ctx.fillStyle = 'rgba(' + (blink === 0 ? '255,50,50' : '50,255,50') + ',0.15)';
    ctx.beginPath(); ctx.arc(-headW * 0.45, hYr + headH * 0.45, headW * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(' + (blink === 1 ? '255,50,50' : '50,255,50') + ',0.15)';
    ctx.beginPath(); ctx.arc(headW * 0.45, hYr + headH * 0.45, headW * 0.3, 0, Math.PI * 2); ctx.fill();

    /* ── antenna ────────────────────────────────────── */
    var antH = h * 0.1;
    var antBob = (char.state === 'startled') ? Math.sin(t * 25) * antH * 0.5 : Math.sin(t * 3) * antH * 0.15;
    ctx.strokeStyle = '#666'; ctx.lineWidth = Math.max(1.5, ol);
    ctx.beginPath();
    ctx.moveTo(0, hYr);
    ctx.lineTo(-headW * 0.2, hYr - antH * 0.33 + antBob * 0.3);
    ctx.lineTo(headW * 0.2, hYr - antH * 0.66 + antBob * 0.6);
    ctx.lineTo(0, hYr - antH + antBob);
    ctx.stroke();
    gradientCircle(0, hYr - antH + antBob, headW * 0.13, (char.state === 'startled' ? '#ff6666' : '#ffdd44'), (char.state === 'startled' ? '#cc2222' : '#cc9900'), '#444', ol * 0.5);
    // Glow
    ctx.fillStyle = 'rgba(255,220,60,0.15)';
    ctx.beginPath(); ctx.arc(0, hYr - antH + antBob, headW * 0.25, 0, Math.PI * 2); ctx.fill();

    /* ── startled sparks ───────────────────────────── */
    if (char.state === 'startled') {
      ctx.strokeStyle = 'rgba(255,220,60,0.8)'; ctx.lineWidth = Math.max(1, ol * 0.6);
      for (var sk = 0; sk < 4; sk++) {
        var sa2 = t * 8 + sk * 1.57, sd2 = h * 0.2 + Math.sin(t * 12 + sk) * h * 0.1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(sa2) * sd2 * 0.6, hYr - antH * 0.5 + Math.sin(sa2) * sd2 * 0.6);
        ctx.lineTo(Math.cos(sa2) * sd2, hYr - antH * 0.5 + Math.sin(sa2) * sd2); ctx.stroke();
      }
    }

    /* ── running smoke ─────────────────────────────── */
    if (char.state === 'running_away') {
      for (var si2 = 0; si2 < 3; si2++) {
        var sdist = -dir * (si2 + 1) * h * 0.15 + Math.sin(t * 5 + si2) * 3;
        ctx.fillStyle = 'rgba(120,120,120,0.12)';
        ctx.beginPath(); ctx.arc(sdist, legH2 * 0.3, h * 0.04 + si2 * 2, 0, Math.PI * 2); ctx.fill();
      }
    }

    ctx.restore();
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

  // ── Ice Robot (Uranus) ─────────────────────────────────────────────────────
  function drawIceRobot(cx, cy, s, char) {
    var t  = char.stateTimer;
    var dir = char.direction;
    var h  = s * 1.3;
    var ol = Math.max(1.2, h * 0.012);
    var headW = h * 0.14, headH = h * 0.12;
    var bodyW = h * 0.15, bodyH = h * 0.25;
    var uArm = h * 0.12, lArm = h * 0.1;
    var uLeg = h * 0.14, lLeg = h * 0.13;
    var legW0 = h * 0.035, armW0 = h * 0.03;

    ctx.save();
    ctx.translate(cx, cy);

    /* ── squashed (shatter) ─────────────────────────── */
    if (char.state === 'squashed') {
      var sq = Math.min(1, t / 0.6);
      for (var fi = 0; fi < 8; fi++) {
        var fa = fi * 0.785 + t * 2, fd = sq * h * 0.3;
        var fSz = h * 0.04 * (1 - sq * 0.5);
        ctx.save();
        ctx.translate(Math.cos(fa) * fd, -h * 0.3 + Math.sin(fa) * fd);
        ctx.rotate(fa * 2);
        outlinedPath(function() { roundRect(-fSz, -fSz * 0.6, fSz * 2, fSz * 1.2, h * 0.004); }, '#88ccdd', '#5599aa', ol * 0.5);
        ctx.restore();
      }
      if (t > 2) {
        var re = Math.min(1, (t - 2) / 1);
        ctx.globalAlpha = re * 0.5;
        outlinedPath(function() { roundRect(-bodyW, -h * 0.5, bodyW * 2, h * 0.5, h * 0.01); }, '#88ccdd', '#5599aa', ol);
        ctx.globalAlpha = 1;
      }
      ctx.restore(); return;
    }

    /* ── animation ──────────────────────────────────── */
    var legPh = 0, armPh = 0, lean = 0, visorCol = '#00ddff';
    if (char.state === 'walking' || char.state === 'returning') {
      legPh = t * 4; armPh = t * 4 + Math.PI; lean = Math.sin(t * 4) * 0.03;
    } else if (char.state === 'running_away') {
      legPh = t * 12; armPh = t * 12 + Math.PI; lean = 0.15 * dir;
    } else if (char.state === 'startled') {
      visorCol = '#ff3333'; lean = -0.05 * dir;
    } else if (char.state === 'idle') {
      lean = Math.sin(t * 2) * 0.01;
    }
    ctx.rotate(lean);

    // Drop shadow
    dropShadow(0, uLeg + lLeg * 0.9, bodyW * 0.65, h * 0.02, 0.13);

    // Frost particles
    ctx.fillStyle = 'rgba(200,230,255,0.35)';
    for (var fp = 0; fp < 5; fp++) {
      var fpAge = (t * 0.6 + fp * 0.45) % 2;
      var fpx0 = (fp - 2) * bodyW * 0.7;
      var fpy0 = -bodyH * 0.3 + fpAge * h * 0.15;
      ctx.beginPath(); ctx.arc(fpx0 + Math.sin(t + fp) * 2, fpy0, 1 + Math.sin(fp) * 0.5, 0, Math.PI * 2); ctx.fill();
    }

    /* ── digitigrade legs (reverse-jointed, filled) ── */
    for (var li = 0; li < 2; li++) {
      var lx = (li === 0) ? -bodyW * 0.5 : bodyW * 0.5;
      var lPh = legPh + li * Math.PI;
      var knX = lx + Math.sin(lPh) * uLeg * 0.3;
      var knY = uLeg * 0.6;
      var ftX = lx + Math.sin(lPh) * uLeg * 0.15;
      var ftY = uLeg + lLeg * 0.85;
      cartoonLimb(lx, 0, knX, knY, legW0, legW0 * 0.9, '#7aadbb', '#4d8899', ol);
      outlinedCircle(knX, knY, h * 0.016, '#6699aa', '#4d7788', ol * 0.5);
      cartoonLimb(knX, knY, ftX, ftY, legW0 * 0.9, legW0 * 0.7, '#7aadbb', '#4d8899', ol);
      outlinedCircle(ftX, ftY, h * 0.022, '#7aadbb', '#4d8899', ol * 0.5);
    }

    /* ── body (angular tapered torso + frost veins) ── */
    outlinedPath(function() {
      ctx.moveTo(-bodyW, -bodyH);
      ctx.lineTo(bodyW, -bodyH);
      ctx.lineTo(bodyW * 0.7, 0);
      ctx.lineTo(-bodyW * 0.7, 0);
      ctx.closePath();
    }, '#88ccdd', '#4d8899', ol);
    // Ice veins
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = Math.max(0.5, ol * 0.3);
    ctx.beginPath(); ctx.moveTo(-bodyW * 0.3, -bodyH * 0.8); ctx.lineTo(-bodyW * 0.1, -bodyH * 0.4); ctx.lineTo(-bodyW * 0.4, -bodyH * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bodyW * 0.2, -bodyH * 0.9); ctx.lineTo(bodyW * 0.4, -bodyH * 0.5); ctx.lineTo(bodyW * 0.15, -bodyH * 0.2); ctx.stroke();
    // Core glow
    ctx.fillStyle = 'rgba(0,220,255,0.07)';
    ctx.beginPath(); ctx.ellipse(0, -bodyH * 0.5, bodyW * 0.5, bodyH * 0.35, 0, 0, Math.PI * 2); ctx.fill();

    /* ── arms (segmented + claws) ──────────────────── */
    for (var ai = 0; ai < 2; ai++) {
      var ax = ai === 0 ? -bodyW : bodyW;
      var aPh = armPh + ai * Math.PI;
      var aS = ai === 0 ? -1 : 1;
      var shY = -bodyH * 0.85;
      var elX = ax + aS * uArm * 0.5 + Math.sin(aPh) * uArm * 0.3;
      var elY = shY + uArm * 0.7;
      var haX = elX + aS * lArm * 0.3 + Math.sin(aPh + 0.5) * lArm * 0.2;
      var haY = elY + lArm * 0.7;
      cartoonLimb(ax, shY, elX, elY, armW0, armW0 * 0.85, '#7aadbb', '#4d8899', ol);
      outlinedCircle(elX, elY, h * 0.013, '#6699aa', '#4d7788', ol * 0.4);
      cartoonLimb(elX, elY, haX, haY, armW0 * 0.85, armW0 * 0.7, '#7aadbb', '#4d8899', ol);
      // 3-pronged claw
      ctx.strokeStyle = '#5599aa'; ctx.lineWidth = Math.max(1.2, ol * 0.7);
      for (var ci2 = 0; ci2 < 3; ci2++) {
        var ca = (ci2 - 1) * 0.4 + Math.PI * 0.5;
        ctx.beginPath(); ctx.moveTo(haX, haY);
        ctx.lineTo(haX + Math.cos(ca) * h * 0.025 * aS, haY + Math.sin(ca) * h * 0.025); ctx.stroke();
      }
    }

    /* ── head (rounded trapezoid) ──────────────────── */
    var hYi = -bodyH - headH;
    outlinedPath(function() {
      ctx.moveTo(-headW, hYi + headH);
      ctx.lineTo(-headW * 0.7, hYi);
      ctx.lineTo(headW * 0.7, hYi);
      ctx.lineTo(headW, hYi + headH);
      ctx.closePath();
    }, '#88ccdd', '#4d8899', ol);

    /* ── visor (glowing strip + scan) ──────────────── */
    var vY = hYi + headH * 0.4, vW = headW * 1.4, vH = headH * 0.3;
    ctx.fillStyle = visorCol;
    ctx.fillRect(-vW * 0.5, vY, vW, vH);
    ctx.strokeStyle = '#4d8899'; ctx.lineWidth = ol * 0.6;
    ctx.strokeRect(-vW * 0.5, vY, vW, vH);
    // Scanning sweep
    var scX = (Math.sin(t * 2.5) * 0.5 + 0.5) * vW - vW * 0.5;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(scX - vW * 0.08, vY, vW * 0.16, vH);
    // Visor glow
    ctx.fillStyle = visorCol.replace(')', ',0.12)').replace('rgb', 'rgba').replace('#', '');
    // Simpler glow
    ctx.fillStyle = 'rgba(0,220,255,0.08)';
    ctx.beginPath(); ctx.ellipse(0, vY + vH * 0.5, vW * 0.7, vH * 1.5, 0, 0, Math.PI * 2); ctx.fill();

    /* ── startled ice cracks ───────────────────────── */
    if (char.state === 'startled') {
      ctx.strokeStyle = 'rgba(200,230,255,0.45)'; ctx.lineWidth = Math.max(1, ol * 0.5);
      for (var ck = 0; ck < 5; ck++) {
        var ckA = ck * 1.26, ckL = h * 0.1 + Math.sin(t * 3 + ck) * h * 0.03;
        ctx.beginPath(); ctx.moveTo(0, uLeg + lLeg * 0.85);
        ctx.lineTo(Math.cos(ckA) * ckL, uLeg + lLeg * 0.85 + Math.sin(ckA) * ckL * 0.3); ctx.stroke();
      }
    }

    /* ── running frost trail ───────────────────────── */
    if (char.state === 'running_away') {
      ctx.fillStyle = 'rgba(200,230,255,0.18)';
      for (var fi2 = 0; fi2 < 4; fi2++) {
        ctx.beginPath(); ctx.arc(-dir * (fi2 + 1) * h * 0.08, -bodyH * 0.2 + Math.sin(t * 3 + fi2) * h * 0.05, h * 0.02, 0, Math.PI * 2); ctx.fill();
      }
    }

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

  // ── Thought Bubble ─────────────────────────────────────────────────────────
  function drawThoughtBubble(cx, cy, s, text) {
    var bubbleW = Math.max(50, s * 0.6);
    var bubbleH = Math.max(18, s * 0.2);
    var bx = cx + 8;
    var by = cy - bubbleH - 10;

    // Little trailing dots
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(cx + 2, cy - 3, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 5, cy - 8, 3, 0, Math.PI * 2); ctx.fill();

    // Bubble
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(bx + bubbleW * 0.5, by + bubbleH * 0.5, bubbleW * 0.55, bubbleH * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(bx + bubbleW * 0.5, by + bubbleH * 0.5, bubbleW * 0.55, bubbleH * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Text
    ctx.fillStyle = '#333';
    ctx.font = Math.max(8, Math.round(s * 0.09)) + 'px Courier New, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, bx + bubbleW * 0.5, by + bubbleH * 0.6);
    ctx.textAlign = 'left'; // reset
  }

  // ── Shockwave Ring ─────────────────────────────────────────────────────────
  function drawShockwave(physX, progress) {
    if (progress <= 0 || progress > 1) return;
    var cx = toCanvasX(physX), cy = groundY;
    var r = progress * Math.max(25, 0.6*currentPPM);
    ctx.strokeStyle = 'rgba(200,180,140,'+(1-progress)+')';
    ctx.lineWidth = Math.max(1.5, currentPPM*0.025);
    ctx.beginPath();
    ctx.ellipse(cx,cy,r,r*0.35,0,0,Math.PI*2);
    ctx.stroke();
  }

  // ── Composite World Draw ───────────────────────────────────────────────────
  function drawWorld() {
    drawSky();
    if (env.lowerAlpha > 0.02) drawPlanetFeatures(env.lowerPlanet, env.lowerAlpha);
    if (env.upperAlpha > 0.02 && env.upperPlanet !== env.lowerPlanet) {
      drawPlanetFeatures(env.upperPlanet, env.upperAlpha);
    }
    drawGround();
    drawMound();
  }

  function clear() { ctx.clearRect(0, 0, W, H); }

  // ── Public Getters ─────────────────────────────────────────────────────────
  function isCurrentGas()         { return env.isGas; }
  function getNearestPlanetName() { return env.nearestPlanet.name; }
  function getPlanets()           { return PLANETS; }
  function getGroundY()           { return groundY; }
  function getWidth()             { return W; }
  function getHeight()            { return H; }
  function getCurrentPPM()        { return currentPPM; }

  // ── Expose Namespace ──────────────────────────────────────────────────────
  window.Renderer = {
    DEFAULT_PPM:      DEFAULT_PPM,
    CANNON_BASE_X_M:  CANNON_BASE_X_M,
    CANNON_BASE_Y_M:  CANNON_BASE_Y_M,
    BARREL_LENGTH_M:  BARREL_LENGTH_M,
    BALL_RADIUS_M:    BALL_RADIUS_M,
    init: init,
    resize: resize,
    updateWorld: updateWorld,
    setTargetGravity: setTargetGravity,
    setTargetZoom: setTargetZoom,
    resetZoom: resetZoom,
    setBarrelLength: setBarrelLength,
    clear: clear,
    drawWorld: drawWorld,
    drawCannon: drawCannon,
    drawBall: drawBall,
    drawLandedBall: drawLandedBall,
    drawTrajectoryDot: drawTrajectoryDot,
    drawFlag: drawFlag,
    drawCrater: drawCrater,
    drawGasHole: drawGasHole,
    drawParticles: drawParticles,
    drawMuzzleFlash: drawMuzzleFlash,
    drawShockwave: drawShockwave,
    drawCharacter: drawCharacter,
    drawStickman: drawStickman,
    toCanvasX: toCanvasX,
    toCanvasY: toCanvasY,
    getCannonTipPhys: getCannonTipPhys,
    getCannonPivotCanvas: getCannonPivotCanvas,
    isCurrentGas: isCurrentGas,
    getNearestPlanetName: getNearestPlanetName,
    getPlanets: getPlanets,
    getGroundY: getGroundY,
    getWidth: getWidth,
    getHeight: getHeight,
    getCurrentPPM: getCurrentPPM
  };

})();
