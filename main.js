/**
 * ============================================================================
 * main.js — Entry Point & Animation Loop for Matilda's Cannon Lab
 * ============================================================================
 *
 * ROLE:  Wires Physics, Renderer, and UI together. Owns the animation loop,
 *        game state (active ball, shot history, particles), cannon firing
 *        sequence (recoil, flash, sound), impact handling, dynamic zoom
 *        system, and gas-giant ball-vanish logic.
 *
 * DEPENDS ON: physics.js, renderer.js, ui.js (all loaded before this)
 * LOADED BY:  <script src="main.js"> in index.html (last script)
 * ============================================================================
 */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  var canvas;
  var activeBall = null;
  var shots = [];              // Landed shot objects
  var trajectoryDots = [];
  var particles = [];
  var maxShots = 8;

  // Cannon animation
  var recoilOffset = 0;
  var recoilPhase = 0;         // 0=idle, 1=recoiling, 2=returning
  var recoilTimer = 0;
  var flashProgress = -1;
  var flashTimer = 0;

  // Impact animation
  var impactShockwaveProgress = -1;
  var impactShockwaveX = 0;
  var squashTimer = -1;

  // Audio
  var audioCtx = null;

  // Timing
  var lastTime = 0;
  var dotTimer = 0;

  // Physics state
  var currentGravity = 9.81;
  var launchTME = 0;

  // Zoom state
  var maxRangeMetres = 0;      // Farthest range seen (persists across shots)
  var maxHeightMetres = 2;     // Tallest apex seen (persists across shots)

  // ── Barrel-change animation state ──────────────────────────────────────────
  // States: 'idle' → 'lowering' → 'modifying' → 'raising' → 'idle'
  var barrelAnimState   = 'idle';
  var barrelAnimTimer   = 0;
  var barrelOldAngle    = 45;
  var barrelTargetAngle = 45;
  var barrelOldLen      = 1.5;
  var barrelTargetLen   = 1.5;
  var barrelDisplayedLen = 1.5;
  var barrelDisplayedAngle = 45;
  var barrelExtending   = true;
  var barrelModDuration = 0.8;
  var pendingFire       = false;
  var clangCooldown     = 0;

  // ── Comic Character state ────────────────────────────────────────────────
  // One character walks on the planet surface and reacts to cannon fire.
  // Type is chosen based on the nearest planet name.
  var activeCharacter = null;
  var lastCharacterPlanet = null; // track planet to detect changes

  var CHAR_THOUGHTS = {
    golfer:    ['Nice day...', 'Fore!', 'Hmm, 9-iron?', 'Par 3...', 'Tee time!'],
    alien:     ['Gzorp?', 'Beep boop', '*Blinks*', 'Zyx norp!', 'Greetings!'],
    spaceman:  ['Houston...', 'One small...', 'Low grav!', 'Copy that', 'Visor fog!'],
    robot:     ['BEEP BOOP', '01001000', 'SO HOT...', 'SCANNING...', 'ERROR 404'],
    newt:      ['Toasty!', '*lick*', 'Sulphur...', 'Nice lava', 'Hmm, warm'],
    whale:     ['Bluuub', '*spout*', 'Big sky!', 'Gassy...', 'Belly flop?'],
    snowman:   ['Brrr!', 'So cold!', 'Need scarf', 'Icy!', '*shivers*'],
    submarine: ['All clear!', 'Dive! Dive!', 'Ping!', 'Aye aye!', 'Periscope up'],
    icerobot:  ['SCANNING...', 'ICE STABLE', 'COLD OK', '-224\u00b0C', 'PROBE READY']
  };

  function createCharacter(type) {
    // Spawn off screen to the right, walk in
    var spawnX = toPhysX(Renderer.getWidth()) * 0.7 + Math.random() * 5;
    var ch = {
      type: type,
      x: spawnX,
      y: 0,
      state: 'walking',
      stateTimer: 0,
      direction: -1,              // walking left initially (toward cannon)
      visible: true,
      walkTarget: 8 + Math.random() * 15, // target x in metres (somewhere in the field)
      speed: 1.5 + Math.random() * 1.0,   // metres per second
      bubbleText: null,
      bubbleTimer: 0,
      thoughtCooldown: 3 + Math.random() * 5
    };
    // Whale has custom submerge/surface cycle
    if (type === 'whale') {
      ch.state = 'submerged';
      ch.visible = true;
      ch.surfaceAmount = 0;
      ch.spoutParticles = [];
      ch.submergeDuration = 5 + Math.random() * 7;
      ch.x = 8 + Math.random() * 20;
    }
    return ch;
  }

  function startleCharacter() {
    if (!activeCharacter || !activeCharacter.visible) return;
    if (activeCharacter.state === 'squashed') return;
    // Whale: if surfaced, dive immediately
    if (activeCharacter.type === 'whale') {
      if (activeCharacter.state === 'surfacing' || activeCharacter.state === 'spouting') {
        activeCharacter.state = 'diving';
        activeCharacter.stateTimer = 0;
        activeCharacter.submergeDuration = 12 + Math.random() * 5; // stay hidden longer
      }
      activeCharacter.bubbleText = null;
      return;
    }
    activeCharacter.state = 'startled';
    activeCharacter.stateTimer = 0;
    activeCharacter.bubbleText = null;
  }

  function squashCharacter() {
    if (!activeCharacter || !activeCharacter.visible) return;
    activeCharacter.state = 'squashed';
    activeCharacter.stateTimer = 0;
    activeCharacter.bubbleText = null;
  }

  function updateCharacter(dt) {
    if (!activeCharacter) return;
    var ch = activeCharacter;
    ch.stateTimer += dt;

    // Thought-bubble cooldown
    if (ch.bubbleText) {
      ch.bubbleTimer -= dt;
      if (ch.bubbleTimer <= 0) ch.bubbleText = null;
    }
    var canThink = (ch.state === 'idle' || ch.state === 'walking' || ch.state === 'spouting');
    if (!ch.bubbleText && canThink) {
      ch.thoughtCooldown -= dt;
      if (ch.thoughtCooldown <= 0) {
        var pool = CHAR_THOUGHTS[ch.type] || CHAR_THOUGHTS.golfer;
        ch.bubbleText = pool[Math.floor(Math.random() * pool.length)];
        ch.bubbleTimer = 2.5 + Math.random() * 2;
        ch.thoughtCooldown = 8 + Math.random() * 10;
      }
    }

    // ── Whale custom state machine ──
    if (ch.type === 'whale') {
      switch (ch.state) {
        case 'submerged':
          // Hidden, drifting to new position
          if (ch.stateTimer > ch.submergeDuration) {
            ch.x = 6 + Math.random() * 22;
            ch.state = 'surfacing';
            ch.stateTimer = 0;
            ch.visible = true;
          }
          break;
        case 'surfacing':
          ch.surfaceAmount = Math.min(1, ch.stateTimer / 1.5);
          if (ch.stateTimer > 1.5) {
            ch.state = 'spouting';
            ch.stateTimer = 0;
            ch.surfaceAmount = 1;
          }
          break;
        case 'spouting':
          ch.surfaceAmount = 1;
          // Generate spout particles
          if (ch.spoutParticles.length < 10 && Math.random() < 0.4) {
            var ang = -Math.PI * 0.5 + (Math.random() - 0.5) * 0.8;
            ch.spoutParticles.push({
              ox: (Math.random() - 0.5) * 0.3,
              oy: 0,
              vx: Math.cos(ang) * (1.5 + Math.random() * 2),
              vy: Math.sin(ang) * (3 + Math.random() * 2),
              life: 0.8 + Math.random() * 0.4
            });
          }
          if (ch.stateTimer > 1.8) {
            ch.state = 'diving';
            ch.stateTimer = 0;
          }
          break;
        case 'diving':
          ch.surfaceAmount = Math.max(0, 1 - ch.stateTimer / 1.5);
          if (ch.stateTimer > 1.5) {
            ch.state = 'submerged';
            ch.stateTimer = 0;
            ch.surfaceAmount = 0;
            ch.submergeDuration = 5 + Math.random() * 7;
          }
          break;
        case 'squashed':
          ch.surfaceAmount = Math.max(0, 1 - ch.stateTimer / 2);
          if (ch.stateTimer > 3) {
            ch.state = 'submerged';
            ch.stateTimer = 0;
            ch.surfaceAmount = 0;
            ch.submergeDuration = 8 + Math.random() * 5;
          }
          break;
      }
      // Update spout particles
      for (var sp = ch.spoutParticles.length - 1; sp >= 0; sp--) {
        var p = ch.spoutParticles[sp];
        p.ox += p.vx * dt;
        p.oy += p.vy * dt;
        p.vy += 9 * dt; // gravity pulls drops down
        p.life -= dt;
        if (p.life <= 0) ch.spoutParticles.splice(sp, 1);
      }
      return; // skip standard state machine
    }

    switch (ch.state) {
      case 'walking':
        ch.x += ch.direction * ch.speed * dt;
        // Arrived at target?
        if ((ch.direction < 0 && ch.x <= ch.walkTarget) ||
            (ch.direction > 0 && ch.x >= ch.walkTarget)) {
          ch.state = 'idle';
          ch.stateTimer = 0;
          ch.direction = (ch.x > 10) ? -1 : 1; // face toward centre
        }
        break;

      case 'idle':
        // Stay idle for a while, then pick a new walk target
        if (ch.stateTimer > 4 + Math.random() * 4) {
          ch.walkTarget = 6 + Math.random() * 20;
          ch.direction = (ch.walkTarget > ch.x) ? 1 : -1;
          ch.state = 'walking';
          ch.stateTimer = 0;
        }
        break;

      case 'startled':
        // Hold startled pose, then start running away
        if (ch.stateTimer > 0.6) {
          ch.state = 'running_away';
          ch.stateTimer = 0;
          // Run AWAY from cannon (which is at x≈1.5)
          ch.direction = (ch.x > Renderer.CANNON_BASE_X_M) ? 1 : -1;
        }
        break;

      case 'running_away':
        ch.x += ch.direction * ch.speed * 3.5 * dt;
        // Off screen?
        if (ch.x < -2 || ch.x > toPhysX(Renderer.getWidth()) + 5) {
          ch.state = 'off_screen';
          ch.stateTimer = 0;
          ch.visible = false;
        }
        break;

      case 'off_screen':
        // Re-appear after a delay
        if (ch.stateTimer > 4 + Math.random() * 3) {
          ch.state = 'returning';
          ch.stateTimer = 0;
          ch.visible = true;
          // Spawn from opposite side to where they ran off
          ch.x = (ch.direction > 0)
            ? -1
            : toPhysX(Renderer.getWidth()) + 2;
          ch.direction = -ch.direction;
          ch.walkTarget = 8 + Math.random() * 15;
          ch.speed = 1.5 + Math.random() * 1.0;
        }
        break;

      case 'returning':
        ch.x += ch.direction * ch.speed * dt;
        if ((ch.direction < 0 && ch.x <= ch.walkTarget) ||
            (ch.direction > 0 && ch.x >= ch.walkTarget)) {
          ch.state = 'idle';
          ch.stateTimer = 0;
        }
        break;

      case 'squashed':
        // Stay squashed for a while, then go "off_screen" and return
        if (ch.stateTimer > 3) {
          ch.state = 'off_screen';
          ch.stateTimer = 0;
          ch.visible = false;
          ch.direction = 1;
        }
        break;
    }
  }

  /** Detect planet from gravity and spawn correct character type */
  function syncCharacterToPlanet() {
    var name = Renderer.getNearestPlanetName();
    if (name === lastCharacterPlanet) return;
    lastCharacterPlanet = name;

    var type = null;
    if      (name === 'earth')   type = 'golfer';
    else if (name === 'mars')    type = 'alien';
    else if (name === 'moon')    type = 'spaceman';
    else if (name === 'mercury') type = 'robot';
    else if (name === 'venus')   type = 'newt';
    else if (name === 'jupiter') type = 'whale';
    else if (name === 'neptune') type = 'snowman';
    else if (name === 'saturn')  type = 'submarine';
    else if (name === 'uranus')  type = 'icerobot';
    activeCharacter = type ? createCharacter(type) : null;
  }

  // ── Audio: Cannon boom synthesiser ─────────────────────────────────────────
  function playCannonBoom() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      var duration = 0.3;
      var sr = audioCtx.sampleRate;
      var buf = audioCtx.createBuffer(1, Math.floor(sr * duration), sr);
      var data = buf.getChannelData(0);
      for (var i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.05));
      }
      var src = audioCtx.createBufferSource();
      src.buffer = buf;
      var filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      filter.Q.value = 1;
      var gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.6, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      src.start();
    } catch (e) { /* silent fail */ }
  }

  // ── Audio: Metallic clang for barrel modification ──────────────────────────
  function playClangSound() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      var duration = 0.09;
      var sr = audioCtx.sampleRate;
      var buf = audioCtx.createBuffer(1, Math.floor(sr * duration), sr);
      var data = buf.getChannelData(0);
      var freq = 1200 + Math.random() * 500;
      for (var i = 0; i < data.length; i++) {
        var tm = i / sr;
        data[i] = (Math.sin(tm * freq * Math.PI * 2) * 0.5 +
                   (Math.random() * 2 - 1) * 0.25) *
                  Math.exp(-i / (sr * 0.02));
      }
      var src = audioCtx.createBufferSource();
      src.buffer = buf;
      var filter = audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 800;
      var gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      src.start();
    } catch (e) { /* silent fail */ }
  }

  // ── Barrel-change animation ────────────────────────────────────────────────

  /** Called when the barrel-length slider changes value */
  function onBarrelChange(newLen) {
    // Don't animate during active flight — just set directly
    if (activeBall) {
      barrelDisplayedLen = newLen;
      barrelTargetLen = newLen;
      Renderer.setBarrelLength(newLen);
      return;
    }

    // Ignore if value hasn't actually changed
    if (Math.abs(newLen - barrelTargetLen) < 0.01 && barrelAnimState !== 'idle') return;

    var currentAngle = (barrelAnimState !== 'idle')
      ? barrelDisplayedAngle
      : UI.getValues().angle;

    if (barrelAnimState === 'idle') {
      // Start the full lowering → modifying → raising sequence
      barrelOldAngle      = currentAngle;
      barrelTargetAngle   = currentAngle;
      barrelOldLen        = barrelDisplayedLen;
      barrelTargetLen     = newLen;
      barrelExtending     = (newLen > barrelOldLen);
      barrelModDuration   = 0.6 + Math.abs(newLen - barrelOldLen) * 0.4;
      barrelAnimState     = 'lowering';
      barrelAnimTimer     = 0;
      barrelDisplayedAngle = currentAngle;
      clangCooldown       = 0;
    } else if (barrelAnimState === 'lowering' || barrelAnimState === 'modifying') {
      // Update target in-place — animation just adjusts its goal
      barrelTargetLen   = newLen;
      barrelExtending   = (newLen > barrelDisplayedLen);
      barrelModDuration = Math.max(0.4, 0.6 + Math.abs(newLen - barrelDisplayedLen) * 0.3);
      // If we're in modifying, reset timer so the modification gets fresh duration
      if (barrelAnimState === 'modifying') {
        barrelOldLen    = barrelDisplayedLen;
        barrelAnimTimer = 0;
      }
    } else if (barrelAnimState === 'raising') {
      // Go back to lowering from where we are
      barrelOldAngle    = barrelDisplayedAngle;
      barrelTargetLen   = newLen;
      barrelExtending   = (newLen > barrelDisplayedLen);
      barrelModDuration = Math.max(0.4, 0.6 + Math.abs(newLen - barrelDisplayedLen) * 0.3);
      barrelAnimState   = 'lowering';
      barrelAnimTimer   = 0;
    }
  }

  function updateBarrelAnimation(dt) {
    if (barrelAnimState === 'idle') return;

    barrelAnimTimer += dt;
    // Always track the latest angle slider value for the raise-back target
    barrelTargetAngle = UI.getValues().angle;

    switch (barrelAnimState) {

      case 'lowering':
        var lDur = 0.4;
        var lT = Math.min(1, barrelAnimTimer / lDur);
        var easeOut = 1 - (1 - lT) * (1 - lT);
        barrelDisplayedAngle = barrelOldAngle * (1 - easeOut);
        if (lT >= 1) {
          barrelAnimState = 'modifying';
          barrelAnimTimer = 0;
          barrelDisplayedAngle = 0;
          barrelOldLen = barrelDisplayedLen;
          clangCooldown = 0.05;
        }
        break;

      case 'modifying':
        var mT = Math.min(1, barrelAnimTimer / barrelModDuration);
        var smooth = mT * mT * (3 - 2 * mT); // smoothstep
        barrelDisplayedLen = barrelOldLen + (barrelTargetLen - barrelOldLen) * smooth;
        Renderer.setBarrelLength(barrelDisplayedLen);
        barrelDisplayedAngle = 0;
        // Periodic clang sounds
        clangCooldown -= dt;
        if (clangCooldown <= 0 && mT < 0.95) {
          playClangSound();
          clangCooldown = 0.12 + Math.random() * 0.1;
        }
        if (mT >= 1) {
          barrelAnimState = 'raising';
          barrelAnimTimer = 0;
          barrelDisplayedLen = barrelTargetLen;
          Renderer.setBarrelLength(barrelDisplayedLen);
        }
        break;

      case 'raising':
        var rDur = 0.4;
        var rT = Math.min(1, barrelAnimTimer / rDur);
        var easeIn = rT * rT;
        barrelDisplayedAngle = barrelTargetAngle * easeIn;
        if (rT >= 1) {
          barrelAnimState = 'idle';
          barrelDisplayedAngle = barrelTargetAngle;
          // Execute pending fire if user clicked during animation
          if (pendingFire) {
            pendingFire = false;
            fire();
          }
        }
        break;
    }
  }

  /** Procedurally compute barrel crew stickman positions/poses based on anim state */
  function getBarrelCrew() {
    if (barrelAnimState === 'idle') return null;

    var tipX = Renderer.CANNON_BASE_X_M + barrelDisplayedLen;
    var crew = [];

    switch (barrelAnimState) {

      case 'lowering':
        // Stickmen run in from a few metres right of the barrel tip
        var lt = Math.min(1, barrelAnimTimer / 0.4);
        var runEase = lt * lt; // ease-in: start slow, arrive fast
        var startOff = 8; // start 8m to the right of tip
        var run1 = tipX + startOff * (1 - runEase) + 0.3;
        var run2 = tipX + (startOff + 0.6) * (1 - Math.min(1, runEase * 1.1)) + 0.5;
        var run3 = tipX + (startOff + 1.2) * (1 - Math.min(1, runEase * 1.05)) + 0.8;
        crew.push({ x: run1, y: 0, pose: barrelExtending ? 'carrying' : 'running',
                     timer: barrelAnimTimer, direction: -1 });
        crew.push({ x: run2, y: 0, pose: 'running',
                     timer: barrelAnimTimer + 0.3, direction: -1 });
        crew.push({ x: run3, y: 0, pose: 'panicked',
                     timer: barrelAnimTimer, direction: -1 });
        break;

      case 'modifying':
        // Two screwing at the barrel tip, one panicking nearby
        crew.push({ x: tipX + 0.2, y: 0, pose: 'screwing',
                     timer: barrelAnimTimer, direction: -1 });
        crew.push({ x: tipX + 0.6, y: 0, pose: 'screwing',
                     timer: barrelAnimTimer + 0.5, direction: 1 });
        // Third one paces back and forth
        var paceX = tipX + 0.4 + Math.sin(barrelAnimTimer * 4) * 0.6;
        var paceDir = Math.cos(barrelAnimTimer * 4) > 0 ? 1 : -1;
        crew.push({ x: paceX, y: 0, pose: 'panicked',
                     timer: barrelAnimTimer, direction: paceDir });
        break;

      case 'raising':
        var rt = barrelAnimTimer / 0.4;
        if (rt < 0.45) {
          // Brief celebration
          crew.push({ x: tipX + 0.2, y: 0, pose: 'celebrating',
                       timer: barrelAnimTimer, direction: 1 });
          crew.push({ x: tipX + 0.5, y: 0, pose: 'celebrating',
                       timer: barrelAnimTimer + 0.3, direction: -1 });
          crew.push({ x: tipX + 0.8, y: 0, pose: 'celebrating',
                       timer: barrelAnimTimer + 0.6, direction: 1 });
        } else {
          // Running off to the right
          var runOff = (rt - 0.45) * 14;
          crew.push({ x: tipX + 0.2 + runOff, y: 0, pose: 'running',
                       timer: barrelAnimTimer, direction: 1 });
          crew.push({ x: tipX + 0.5 + runOff * 0.88, y: 0, pose: 'running',
                       timer: barrelAnimTimer + 0.2, direction: 1 });
          crew.push({ x: tipX + 0.8 + runOff * 0.75, y: 0, pose: 'panicked',
                       timer: barrelAnimTimer, direction: 1 });
        }
        break;
    }

    return crew;
  }

  // ── Particle helpers ───────────────────────────────────────────────────────
  function createSmokeParticles(tipX, tipY, angleDeg) {
    var rad = angleDeg * Math.PI / 180;
    var count = 12 + Math.floor(Math.random() * 8);
    for (var i = 0; i < count; i++) {
      var spread = (Math.random() - 0.5) * 1.2;
      var speed = 1.5 + Math.random() * 3;
      particles.push({
        x: tipX, y: tipY,
        vx: Math.cos(rad + spread) * speed,
        vy: Math.sin(rad + spread) * speed + 0.5,
        life: 1.0 + Math.random() * 0.4, maxLife: 1.4,
        radius: 4 + Math.random() * 6,
        colour: randomGrey(), gravity: -0.3
      });
    }
  }

  function createImpactParticles(physX, isGas) {
    var count = 8 + Math.floor(Math.random() * 5);
    for (var i = 0; i < count; i++) {
      var ang = Math.PI * 0.15 + Math.random() * Math.PI * 0.7;
      var speed = 2 + Math.random() * 4;
      particles.push({
        x: physX, y: 0.05,
        vx: Math.cos(ang) * speed * (Math.random() > 0.5 ? 1 : -1),
        vy: Math.sin(ang) * speed,
        life: 0.5 + Math.random() * 0.5, maxLife: 1.0,
        radius: 2 + Math.random() * 3,
        colour: isGas ? randomGasColour() : randomBrown(),
        gravity: 12
      });
    }
  }

  function randomGrey() {
    var v = 140 + Math.floor(Math.random() * 80);
    return 'rgb(' + v + ',' + v + ',' + v + ')';
  }
  function randomBrown() {
    return 'rgb(' + (80+Math.floor(Math.random()*50)) + ',' +
                     (40+Math.floor(Math.random()*30)) + ',' +
                     (10+Math.floor(Math.random()*20)) + ')';
  }
  function randomGasColour() {
    // Muted version of environment — just use greyish tones
    var v = 100 + Math.floor(Math.random() * 60);
    return 'rgb(' + v + ',' + (v-20) + ',' + (v-30) + ')';
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt;
      p.vy -= p.gravity * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ── Zoom computation ───────────────────────────────────────────────────────
  function computeNeededZoom(rangeMetres, maxHeightMetres) {
    var cW = Renderer.getWidth();
    var gY = Renderer.getGroundY();
    if (rangeMetres <= 0) return Renderer.DEFAULT_PPM;

    // Need range + generous margin to fit horizontally
    var horizPPM = (cW * 0.85) / (rangeMetres + 1);
    // Need max height to fit vertically (in the sky area)
    var vertPPM = (gY * 0.80) / (maxHeightMetres + 0.5);

    var needed = Math.min(horizPPM, vertPPM);
    // Don't zoom IN beyond default, but allow unlimited zoom OUT
    return Math.min(Renderer.DEFAULT_PPM, Math.max(0.1, needed));
  }

  // ── Firing sequence ────────────────────────────────────────────────────────
  function fire() {
    // If barrel animation is running, queue for later
    if (barrelAnimState !== 'idle') {
      pendingFire = true;
      return;
    }

    var vals = UI.getValues();
    currentGravity = vals.gravity;

    // Update renderer barrel length to match slider
    Renderer.setBarrelLength(vals.barrelLength);

    // Predict trajectory for zoom
    var tip = Renderer.getCannonTipPhys(vals.angle);
    var prediction = Physics.predictTrajectory(
      vals.force, vals.mass, vals.angle, currentGravity,
      tip.x, tip.y, vals.barrelLength
    );

    // Update max range and height (persist until clear)
    maxRangeMetres = Math.max(maxRangeMetres, prediction.range);
    maxHeightMetres = Math.max(maxHeightMetres, prediction.maxHeight, 2);

    // Compute and set zoom
    var neededPPM = computeNeededZoom(maxRangeMetres, maxHeightMetres);
    Renderer.setTargetZoom(neededPPM);

    // Compute launch velocity and create projectile
    var speed = Physics.computeLaunchVelocity(vals.force, vals.mass, vals.barrelLength);
    activeBall = Physics.createProjectile(tip.x, tip.y, speed, vals.angle, vals.mass);

    // Launch TME
    var e = Physics.computeEnergy(activeBall, currentGravity);
    launchTME = e.tme;

    // Reset trail
    trajectoryDots = [];
    dotTimer = 0;

    // Cannon animations
    recoilPhase = 1;
    recoilTimer = 0;
    flashProgress = 0;
    flashTimer = 0;

    playCannonBoom();
    createSmokeParticles(tip.x, tip.y, vals.angle);
    UI.setFlightActive(true);

    startleCharacter();
  }

  // ── Landing ────────────────────────────────────────────────────────────────
  function handleLanding(ball) {
    var landX = ball.x;
    var isGas = Renderer.isCurrentGas();

    if (shots.length >= maxShots) shots.shift();

    shots.push({
      x: landX,
      number: getTotalShotCount(),
      flagSpring: 0,
      isGas: isGas     // remember planet type at landing
    });

    // Impact particles (planet-appropriate colour)
    createImpactParticles(landX, isGas);

    // Shockwave
    impactShockwaveProgress = 0;
    impactShockwaveX = landX;
    squashTimer = 0;

    // Freeze readouts
    var finalState = { x: ball.x, y: 0, vx: 0, vy: 0, mass: ball.mass, time: ball.time };
    var finalEnergy = Physics.computeEnergy(finalState, currentGravity);
    UI.updateReadouts(finalState, finalEnergy, launchTME);

    activeBall = null;
    UI.setFlightActive(false);

    // Check if ball landed on the character
    if (activeCharacter && activeCharacter.visible &&
        activeCharacter.state !== 'squashed' &&
        activeCharacter.state !== 'off_screen') {
      var charHalfW = 1.0; // ~1 metre hit zone
      if (Math.abs(landX - activeCharacter.x) < charHalfW) {
        squashCharacter();
      }
    }
  }

  var totalShotCount = 0;
  function getTotalShotCount() {
    totalShotCount++;
    return totalShotCount;
  }

  // ── Clear range ────────────────────────────────────────────────────────────
  function clearRange() {
    shots = [];
    trajectoryDots = [];
    particles = [];
    activeBall = null;
    totalShotCount = 0;
    maxRangeMetres = 0;
    maxHeightMetres = 2;
    impactShockwaveProgress = -1;
    squashTimer = -1;

    // Reset zoom back to default
    Renderer.resetZoom();

    UI.setFlightActive(false);
    UI.resetReadouts();
  }

  // ── Gravity / planet change handler (from UI) ──────────────────────────────
  function onGravityChange(g) {
    Renderer.setTargetGravity(g);
    UI.highlightNearestPlanet(g);
    syncCharacterToPlanet();
  }

  // ── Animation loop ─────────────────────────────────────────────────────────
  function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    var dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    // Update renderer world (environment blend + zoom animation)
    Renderer.updateWorld(dt);

    // ─── Physics ───
    if (activeBall) {
      activeBall = Physics.stepProjectile(activeBall, dt, currentGravity);

      dotTimer += dt;
      if (dotTimer > 0.05) {
        trajectoryDots.push({ x: activeBall.x, y: activeBall.y });
        dotTimer = 0;
      }

      // In-flight zoom adjustment: if ball exceeds our predicted bounds, zoom out more
      var ballRange = activeBall.x;
      var ballHeight = activeBall.y;
      if (ballRange > maxRangeMetres * 0.85 || ballHeight > maxHeightMetres * 0.85) {
        maxRangeMetres = Math.max(maxRangeMetres, ballRange * 1.2);
        maxHeightMetres = Math.max(maxHeightMetres, ballHeight * 1.2);
        var neededPPM = computeNeededZoom(maxRangeMetres, maxHeightMetres);
        Renderer.setTargetZoom(neededPPM);
      }

      if (activeBall.y <= 0) {
        handleLanding(activeBall);
      } else {
        var energy = Physics.computeEnergy(activeBall, currentGravity);
        UI.updateReadouts(activeBall, energy, launchTME);
      }

      // Off-screen check (with zoomed-out canvas width)
      if (activeBall && toPhysX(Renderer.getWidth() + 200) < activeBall.x) {
        handleLanding(activeBall);
      }
    }

    // ─── Animations ───
    updateCannonAnimation(dt);
    updateBarrelAnimation(dt);
    updateParticles(dt);
    updateImpactAnimations(dt);
    updateCharacter(dt);
    syncCharacterToPlanet();

    // ─── Draw ───
    Renderer.clear();
    Renderer.drawWorld();

    // Trajectory dots
    for (var d = 0; d < trajectoryDots.length; d++) {
      Renderer.drawTrajectoryDot(trajectoryDots[d].x, trajectoryDots[d].y);
    }

    // Landed shots
    for (var s = 0; s < shots.length; s++) {
      var shot = shots[s];
      // Draw crater or gas hole based on what planet was active at landing
      if (shot.isGas) {
        Renderer.drawGasHole(shot.x);
      } else {
        Renderer.drawCrater(shot.x);
        Renderer.drawLandedBall(shot.x);
      }
      if (shot.flagSpring < 1) {
        shot.flagSpring = Math.min(1, shot.flagSpring + dt * 2.5);
      }
      Renderer.drawFlag(shot.x, shot.number, shot.flagSpring);
    }

    // Comic character (behind shockwave and cannon)
    if (activeCharacter) {
      Renderer.drawCharacter(activeCharacter);
    }

    // Shockwave
    if (impactShockwaveProgress >= 0 && impactShockwaveProgress <= 1) {
      Renderer.drawShockwave(impactShockwaveX, impactShockwaveProgress);
    }

    // Barrel crew stickmen (drawn before cannon so they appear behind the barrel)
    var crew = getBarrelCrew();
    if (crew) {
      for (var c = 0; c < crew.length; c++) {
        Renderer.drawStickman(crew[c].x, crew[c].y, crew[c]);
      }
    }

    // Cannon — use animated angle during barrel-change animation
    var cannonAngle = (barrelAnimState !== 'idle') ? barrelDisplayedAngle : UI.getValues().angle;
    Renderer.drawCannon(cannonAngle, recoilOffset);

    // Muzzle flash
    if (flashProgress >= 0 && flashProgress <= 1) {
      Renderer.drawMuzzleFlash(cannonAngle, flashProgress);
    }

    // Active ball
    if (activeBall) {
      Renderer.drawBall(activeBall.x, activeBall.y, 1, 1);
    }

    // Particles
    Renderer.drawParticles(particles);

    requestAnimationFrame(loop);
  }

  // Helper: convert canvas px back to physics metres (for off-screen check)
  function toPhysX(canvasPx) {
    var ppm = Renderer.getCurrentPPM();
    return ppm > 0 ? canvasPx / ppm : 9999;
  }

  // ── Cannon animation ───────────────────────────────────────────────────────
  function updateCannonAnimation(dt) {
    if (recoilPhase === 1) {
      recoilTimer += dt;
      recoilOffset = Math.min(15, recoilTimer / 0.08 * 15);
      if (recoilTimer >= 0.08) { recoilPhase = 2; recoilTimer = 0; }
    } else if (recoilPhase === 2) {
      recoilTimer += dt;
      recoilOffset = 15 * Math.max(0, 1 - recoilTimer / 0.2);
      if (recoilTimer >= 0.2) { recoilPhase = 0; recoilOffset = 0; }
    }
    if (flashProgress >= 0 && flashProgress < 1) {
      flashTimer += dt;
      flashProgress = Math.min(1, flashTimer / 0.06);
    }
  }

  // ── Impact animations ──────────────────────────────────────────────────────
  function updateImpactAnimations(dt) {
    if (impactShockwaveProgress >= 0 && impactShockwaveProgress < 1) {
      impactShockwaveProgress += dt / 0.3;
      if (impactShockwaveProgress > 1) impactShockwaveProgress = 1.01;
    }
    if (squashTimer >= 0 && squashTimer < 0.2) squashTimer += dt;
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  function boot() {
    canvas = document.getElementById('sim-canvas');
    Renderer.init(canvas);

    UI.init({
      onFire: fire,
      onClear: clearRange,
      onGravityChange: onGravityChange,
      onBarrelChange: onBarrelChange
    });

    window.addEventListener('resize', function () { Renderer.resize(); });

    // Sync initial barrel length from slider default
    var initBarrelLen = UI.getValues().barrelLength;
    barrelDisplayedLen = initBarrelLen;
    barrelOldLen = initBarrelLen;
    barrelTargetLen = initBarrelLen;
    Renderer.setBarrelLength(initBarrelLen);

    // Sync initial barrel angle
    var initAngle = UI.getValues().angle;
    barrelOldAngle = initAngle;
    barrelTargetAngle = initAngle;
    barrelDisplayedAngle = initAngle;

    // Spawn initial character for current planet
    syncCharacterToPlanet();

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
