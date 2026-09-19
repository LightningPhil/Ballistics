import './style.css';
import { FlightDeck } from './flight-deck.ts';
import { recordFlight, sampleFlight, compatibleRuns, type FlightRecord } from './flight.ts';
import { resolveEnvironment } from './environment.ts';
import { Physics } from './physics.ts';
import { RocketPropellants } from './rocket_propellants.ts';
import { RocketPhysics } from './rocket_physics.ts';
import { NozzleRender } from './nozzle_render.ts';
import { Renderer } from './renderer.ts';
import { UI } from './ui.ts';

/**
 * ============================================================================
 * main.js — Entry Point & Animation Loop for Launch Lab
 * ============================================================================
 *
 * ROLE:  Wires Physics, Renderer, and UI together. Owns the animation loop,
 *        game state (active ball / active rocket, shot history, particles),
 *        cannon firing sequence (recoil, flash, sound), rocket flight loop,
 *        impact handling, dynamic zoom system, and gas-giant ball-vanish logic.
 *
 * Both cannon and rocket modes share: planet/gravity, characters, particles,
 * zoom, shots/trajectory-dot history, and the world renderer.
 *
 * DEPENDS ON: physics.js, rocket_propellants.js, rocket_physics.js,
 *             renderer.js, ui.js (all loaded before this)
 * LOADED BY:  <script src="main.js"> in index.html (last script)
 * ============================================================================
 */

let deck: FlightDeck;
let flightBuild: AbortController | null = null;
let viewActive = false;
let endDelivered = false;
let restoring = false;
let lastFlightTime = 0;
let lastCrewRemark = -30;
let crewReactionUntil = 0;
const remarkCounts = new Map<string, number>();
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── State ──────────────────────────────────────────────────────────────────
var canvas;
var currentMode = 'cannon';  // 'cannon' | 'rocket'
var activeBall = null;
var shots = [];              // Landed shot objects
var trajectoryDots = [];
var particles = [];
var maxShots = 8;

// Rocket state (Stage 4+)
var activeRocket = null;     // null | RocketPhysics state object
var rocketLanded = false;    // True after rocket has impacted
var landedRocket = null;     // { x, epsilon, timer, phase: 'flipping'|'door'|'waving' }
var rocketGuidance = null;   // Guidance object (fixed/pitch/prograde)
var rocketDotTimer = 0;      // Trajectory dot timing for rocket
var rocketMaxThrust = 0;     // Initial thrust for exhaust scaling
var rocketFizzleTimer = 0;   // Fizzle animation progress timer
var rocketFizzleDuration = 0; // How long the fizzle burn lasts
var rocketFizzleTW = 0;       // T/W at fizzle for message display
var rocketEngineAudio = null; // Running engine audio nodes
// Flight telemetry tracking (Stage 7)
var rocketMaxHeight = 0;       // Peak altitude during flight
var rocketBurnoutSpeed = 0;    // Speed at engine burnout
var rocketBurnTime = 0;        // Actual burn duration
var rocketDvTsiolkovsky = 0;   // Theoretical delta-v (pre-launch)

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
var currentPlanetRadius = 0;
var launchTME = 0;

// Zoom state
var maxRangeMetres = 0;      // Farthest range seen (persists across shots)
var maxHeightMetres = 2;     // Tallest apex seen (persists across shots)
var DEFAULT_VIEW_TRANSITION_SECONDS = 1.2;
var DEFAULT_CANNON_VIEW_SECONDS = 2.0;   // Slower, smoother zoom for cannon
var DEFAULT_ROCKET_ZOOM_MARGIN = 0.15;
var DEFAULT_CANNON_ZOOM_MARGIN = 0.20;   // Extra breathing room for cannon

// Per-mode zoom memory (saved/restored on mode switch)
var cannonZoomState = { maxRange: 0, maxHeight: 2, ppm: 80, camX: 0, camY: 0 };
var rocketZoomState = { maxRange: 0, maxHeight: 2, ppm: 80, camX: 0, camY: 0 };

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
  var ch: any = {
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

function startleCharacter(isRocket?) {
  if (!activeCharacter || !activeCharacter.visible) return;
  if (activeCharacter.state === 'squashed') return;
  // Whale: if surfaced, dive immediately
  if (activeCharacter.type === 'whale') {
    if (activeCharacter.state === 'surfacing' || activeCharacter.state === 'spouting') {
      activeCharacter.state = 'diving';
      activeCharacter.stateTimer = 0;
      activeCharacter.submergeDuration = isRocket ? 20 + Math.random() * 8 : 12 + Math.random() * 5;
    }
    activeCharacter.bubbleText = null;
    return;
  }
  if (isRocket) {
    // Rocket launches are more dramatic — longer startled hold + thought bubble
    activeCharacter.state = 'rocket_startled';
    activeCharacter.stateTimer = 0;
    var rocketScared = ['RUMBLE!!', 'WHAT THE—!', '*covers ears*', 'SO LOUD!', 'AAAH!!', 'THE GROUND!'];
    activeCharacter.bubbleText = rocketScared[Math.floor(Math.random() * rocketScared.length)];
    activeCharacter.bubbleTimer = 2.0;
  } else {
    activeCharacter.state = 'startled';
    activeCharacter.stateTimer = 0;
    activeCharacter.bubbleText = null;
  }
}

function fizzleReactCharacter() {
  if (!activeCharacter || !activeCharacter.visible) return;
  if (activeCharacter.state === 'squashed') return;
  // Whale: just show a bubble if surfaced
  if (activeCharacter.type === 'whale') {
    if (activeCharacter.state === 'spouting' || activeCharacter.state === 'surfacing') {
      activeCharacter.bubbleText = 'Ha!';
      activeCharacter.bubbleTimer = 2.5;
    }
    return;
  }
  // Laughing reaction — character stops running and mocks the fizzle
  var laughs = ['We have made a heater.', 'More lift. Less luggage.', 'The launch pad remains undefeated.'];
  activeCharacter.state = 'idle';
  activeCharacter.stateTimer = 0;
  activeCharacter.bubbleText = laughs[Math.floor(Math.random() * laughs.length)];
  activeCharacter.bubbleTimer = 3.0;
  activeCharacter.thoughtCooldown = 6 + Math.random() * 5;
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
  var canThink = deck?.banter && !viewActive && (ch.state === 'idle' || ch.state === 'walking' || ch.state === 'spouting');
  if (!ch.bubbleText && canThink) {
    ch.thoughtCooldown -= dt * 0.3;
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

    case 'rocket_startled':
      // Rocket launch: longer startled hold with dramatic shaking
      if (ch.stateTimer > 1.8) {
        ch.state = 'running_away';
        ch.stateTimer = 0;
        ch.direction = (ch.x > (Renderer.TOWER_BASE_X_M || 1.5)) ? 1 : -1;
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
  if (!deck?.sound) return;
  try {
    if (!audioCtx) {
      audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
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
  if (!deck?.sound) return;
  try {
    if (!audioCtx) {
      audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
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
    barrelModDuration   = 0.18 + Math.abs(newLen - barrelOldLen) * 0.04;
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
      var lDur = 0.12;
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
      var rDur = 0.12;
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

/**
 * Generic particle emitter — shared by both cannon and rocket modes.
 * Cannon smoke/impact use the dedicated wrappers below; rocket exhaust
 * (Stage 6) will call this directly.
 *
 * @param {number} x      Physics x-coordinate of emitter origin
 * @param {number} y      Physics y-coordinate of emitter origin
 * @param {Object} opts   Configuration:
 *   count      {number}   Number of particles (default 8)
 *   baseAngle  {number}   Central emission angle in radians (default 0)
 *   spread     {number}   Random spread in radians (default 1.0)
 *   minSpeed   {number}   Min speed (default 1.5)
 *   maxSpeed   {number}   Max speed (default 4)
 *   vyBoost    {number}   Extra vy added to each particle (default 0)
 *   minLife    {number}   Min lifetime in seconds (default 0.5)
 *   maxLife    {number}   Max lifetime / maxLife property (default 1.0)
 *   minRadius  {number}   Min draw radius (default 3)
 *   maxRadius  {number}   Max draw radius (default 6)
 *   colour     {string|function}  Colour or colour-factory (default randomGrey)
 *   gravity    {number}   Per-particle gravity term (default 0)
 */
function createParticlesAt(x, y, opts) {
  opts = opts || {};
  var count = opts.count || 8;
  var baseAng = opts.baseAngle || 0;
  var spreadW = opts.spread !== undefined ? opts.spread : 1.0;
  var minSpd = opts.minSpeed || 1.5;
  var maxSpd = opts.maxSpeed || 4;
  var vyBoost = opts.vyBoost || 0;
  var minLife = opts.minLife || 0.5;
  var maxLife = opts.maxLife || 1.0;
  var minR = opts.minRadius || 3;
  var maxR = opts.maxRadius || 6;
  var grav = opts.gravity !== undefined ? opts.gravity : 0;

  for (var i = 0; i < count; i++) {
    var ang = baseAng + (Math.random() - 0.5) * spreadW;
    var speed = minSpd + Math.random() * (maxSpd - minSpd);
    particles.push({
      x: x, y: y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed + vyBoost,
      life: minLife + Math.random() * (maxLife - minLife),
      maxLife: maxLife,
      radius: minR + Math.random() * (maxR - minR),
      colour: typeof opts.colour === 'function' ? opts.colour() : (opts.colour || randomGrey()),
      gravity: grav
    });
  }
}

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

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ── Zoom computation ───────────────────────────────────────────────────────
function computeNeededZoom(rangeMetres, maxHeightMetres, marginFraction?) {
  var cW = Renderer.getWidth();
  var gY = Renderer.getGroundY();
  marginFraction = (typeof marginFraction === 'number')
    ? Math.max(0, marginFraction)
    : DEFAULT_ROCKET_ZOOM_MARGIN;
  var fitFraction = 1 / (1 + marginFraction);
  rangeMetres = Math.max(1, rangeMetres);

  // Fit width and height with explicit extra margin.
  var horizPPM = (cW * fitFraction) / Math.max(1, rangeMetres);
  // Need max height to fit vertically (in the sky area)
  var vertPPM = (gY * fitFraction) / Math.max(0.5, maxHeightMetres);

  var needed = Math.min(horizPPM, vertPPM);
  // Don't zoom IN beyond default, but allow unlimited zoom OUT
  return Math.min(Renderer.DEFAULT_PPM, Math.max(1e-9, needed));
}

function computeRocketZoomPlan(prediction, marginFraction) {
  if (!prediction) return null;
  var width = Math.max(1, prediction.maxX - prediction.minX);
  var height = Math.max(2, prediction.maxHeight);
  var ppm = computeNeededZoom(width, height, marginFraction);
  var visibleWidth = Renderer.getWidth() / ppm;
  var pad = Math.max(0, (visibleWidth - width) * 0.5);
  var cameraX = prediction.minX - pad;
  return {
    ppm: ppm,
    cameraX: cameraX
  };
}

// ── Firing sequence ────────────────────────────────────────────────────────
async function fire() {
  if (currentMode !== 'cannon' || deck.busy || viewActive && !deck.clock.paused) return;
  pendingFire = false; barrelAnimState = 'idle';
  const vals = UI.getValues();
  const environment = resolveEnvironment(vals.gravity);
  const config = { ...vals, environment, planetRadius: environment.radius };
  Renderer.setBarrelLength(vals.barrelLength);
  barrelDisplayedLen = barrelTargetLen = vals.barrelLength;
  barrelDisplayedAngle = vals.angle;
  const tip = Renderer.getCannonTipPhys(vals.angle);
  const speed = Physics.computeLaunchVelocity(vals.force, vals.mass, vals.barrelLength);
  const initial = Physics.createProjectile(tip.x, tip.y, speed, vals.angle, vals.mass, config.planetRadius);
  await beginFlight('cannon', config, initial);
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
  flightBuild?.abort(); flightBuild = null;
  viewActive = false; endDelivered = false;
  if (deck) deck.reset();
  pendingFire = false; barrelAnimState = 'idle'; barrelAnimTimer = 0;
  const vals = UI.getValues();
  barrelDisplayedLen = barrelTargetLen = vals.barrelLength;
  barrelDisplayedAngle = vals.angle; Renderer.setBarrelLength(vals.barrelLength);
  recoilPhase = 0; recoilOffset = 0; flashProgress = -1;
  shots = [];
  trajectoryDots = [];
  particles = [];
  activeBall = null;
  activeRocket = null;
  rocketLanded = false;
  landedRocket = null;
  rocketGuidance = null;
  rocketFizzleTimer = 0;
  rocketDotTimer = 0;
  rocketMaxHeight = 0;
  rocketBurnoutSpeed = 0;
  rocketBurnTime = 0;
  rocketDvTsiolkovsky = 0;
  totalShotCount = 0;
  maxRangeMetres = 0;
  maxHeightMetres = 2;
  impactShockwaveProgress = -1;
  squashTimer = -1;

  stopEngineLoop();

  // Reset zoom back to default (smooth for cannon, instant for rocket)
  if (currentMode === 'cannon') {
    Renderer.setViewTransitionDuration(DEFAULT_CANNON_VIEW_SECONDS);
  } else {
    Renderer.setViewTransitionDuration(DEFAULT_VIEW_TRANSITION_SECONDS);
  }
  Renderer.resetZoom();
  Renderer.resetCamera();

  // Also reset the current mode's saved zoom state
  if (currentMode === 'cannon') {
    cannonZoomState = { maxRange: 0, maxHeight: 2, ppm: Renderer.DEFAULT_PPM, camX: 0, camY: 0 };
  } else {
    rocketZoomState = { maxRange: 0, maxHeight: 2, ppm: Renderer.DEFAULT_PPM, camX: 0, camY: 0 };
  }

  UI.setFlightActive(false);
  UI.resetReadouts();
  if (currentMode === 'rocket') {
    UI.resetRocketReadouts();
  }
}

// ── Gravity / planet change handler (from UI) ──────────────────────────────
function onGravityChange(g) {
  if (!restoring && deck && (viewActive || shots.length)) clearRange();
  currentGravity = g; currentPlanetRadius = resolveEnvironment(g).radius;
  Renderer.setTargetGravity(g);
  UI.highlightNearestPlanet(g);
  syncCharacterToPlanet();
  // Refresh rocket pre-launch readouts (T/W depends on gravity)
  if (currentMode === 'rocket') UI.refreshPreLaunch();
}

// ── Rocket launch ──────────────────────────────────────────────────────────
async function rocketLaunch() {
  if (currentMode !== 'rocket' || deck.busy || viewActive && !deck.clock.paused) return;
  const gravity = UI.getValues().gravity;
  const environment = resolveEnvironment(gravity);
  const vals = { ...UI.getRocketValues(), gravity, environment, planetRadius: environment.radius };
  const initial = RocketPhysics.createRocketState(vals);
  const pad = Renderer.getRocketPadPosition(vals.launchAngle, vals.epsilon);
  initial.x = pad.x; initial.y = pad.y;
  const theta = initial.x / vals.planetRadius;
  initial.wx = (vals.planetRadius + initial.y) * Math.sin(theta);
  initial.wy = (vals.planetRadius + initial.y) * Math.cos(theta);
  UI.hideFizzleMessage(); UI.hidePostFlightSummary();
  await beginFlight('rocket', vals, initial);
}

function buildGuidance(vals) {
  if (RocketPhysics.buildGuidance) {
    return RocketPhysics.buildGuidance(vals);
  }
  switch (vals.guidanceMode) {
    case 'pitch_program':
      return RocketPhysics.guidancePitchProgram(
        vals.launchAngle, vals.pitchEnd, vals.pitchT1, vals.pitchT2
      );
    case 'prograde_lock':
      return RocketPhysics.guidanceProgradeLock(vals.progradeVmin, vals.launchAngle);
    default: // 'fixed' → gravity turn: thrust follows velocity after rail clearance
      return RocketPhysics.guidanceProgradeLock(5, vals.launchAngle);
  }
}

// ── Rocket landing ────────────────────────────────────────────────────────
function handleRocketLanding(state) {
  const run = deck.run!;
  createImpactParticles(state.x, Renderer.isCurrentGas());
  impactShockwaveProgress = 0; impactShockwaveX = state.x;
  UI.updateRocketReadouts(state);
  UI.showPostFlightSummary({ range: state.x - run.launchX, maxHeight: run.maxHeight,
    flightTime: run.duration, burnTime: state.burnoutTime ?? state.time,
    dvTsiolkovsky: state.idealDeltaV, dvActual: state.burnoutSpeed, burnoutSpeed: state.burnoutSpeed });
  rocketLanded = true;
  landedRocket = { x: state.x, epsilon: state.epsilon, timer: 0, phase: 'impact', impactSpeed: state.impactSpeed };
  activeRocket = null; stopEngineLoop(); UI.setFlightActive(false);
}

// ── Rocket exhaust particles ──────────────────────────────────────────────
function createExhaustParticles(px, py, angleDeg) {
  var rad = (angleDeg + 180) * Math.PI / 180; // opposite to heading
  createParticlesAt(px, py, {
    count: 6,
    baseAngle: rad,
    spread: 0.8,
    minSpeed: 2,
    maxSpeed: 5,
    vyBoost: -0.5,
    minLife: 0.3,
    maxLife: 0.8,
    minRadius: 2,
    maxRadius: 5,
    colour: function () {
      var r = 200 + Math.floor(Math.random() * 55);
      var g = 100 + Math.floor(Math.random() * 80);
      var b = Math.floor(Math.random() * 40);
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    },
    gravity: 3
  });
}

// ── Audio: Rocket ignition rumble ──────────────────────────────────────────
function playIgnitionRumble(volume) {
  if (!deck?.sound) return;
  try {
    if (!audioCtx) {
      audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    }
    var duration = 2.0;
    var sr = audioCtx.sampleRate;
    var len = Math.floor(sr * duration);
    var buf = audioCtx.createBuffer(1, len, sr);
    var data = buf.getChannelData(0);

    // Deep rumble: filtered noise + low sine
    for (var i = 0; i < len; i++) {
      var t = i / sr;
      var noise = (Math.random() * 2 - 1);
      var sine = Math.sin(t * 80 * Math.PI * 2) * 0.4;
      var sine2 = Math.sin(t * 120 * Math.PI * 2) * 0.2;
      // Envelope: attack 0.1s, sustain, decay
      var env = Math.min(1, t / 0.1) * Math.exp(-t / 1.5);
      data[i] = (noise * 0.5 + sine + sine2) * env;
    }

    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    var filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    filter.Q.value = 0.7;
    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime(volume * 0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
  } catch (e) { /* silent fail */ }
}

// ── Audio: Engine running loop ─────────────────────────────────────────────
function startEngineLoop() {
  if (!deck?.sound) return;
  try {
    if (!audioCtx) {
      audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    }
    stopEngineLoop(); // ensure clean start

    // Create looping crackle noise
    var sr = audioCtx.sampleRate;
    var loopDur = 0.5;
    var buf = audioCtx.createBuffer(1, Math.floor(sr * loopDur), sr);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      var t = i / sr;
      var noise = (Math.random() * 2 - 1);
      var rumble = Math.sin(t * 60 * Math.PI * 2) * 0.3;
      data[i] = (noise * 0.4 + rumble) * 0.5;
    }

    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    var filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    var gain = audioCtx.createGain();
    gain.gain.value = 0.12;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();

    rocketEngineAudio = { source: src, gain: gain };
  } catch (e) { /* silent fail */ }
}

function stopEngineLoop() {
  if (rocketEngineAudio) {
    try {
      rocketEngineAudio.gain.gain.setValueAtTime(
        rocketEngineAudio.gain.gain.value, audioCtx.currentTime
      );
      rocketEngineAudio.gain.gain.exponentialRampToValueAtTime(
        0.001, audioCtx.currentTime + 0.3
      );
      var src = rocketEngineAudio.source;
      setTimeout(function () { try { src.stop(); } catch (e) { /* */ } }, 400);
    } catch (e) { /* silent fail */ }
    rocketEngineAudio = null;
  }
}

function playBurnoutSound() {
  if (!deck?.sound) return;
  try {
    if (!audioCtx) return;
    var duration = 0.4;
    var sr = audioCtx.sampleRate;
    var buf = audioCtx.createBuffer(1, Math.floor(sr * duration), sr);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      var t = i / sr;
      // Descending pitch whine
      var freq = 200 * Math.exp(-t * 3);
      data[i] = Math.sin(t * freq * Math.PI * 2) * 0.3 * Math.exp(-t / 0.15);
    }
    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    var gain = audioCtx.createGain();
    gain.gain.value = 0.3;
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
  } catch (e) { /* silent fail */ }
}

// ── Audio: Sad trombone for fizzle end ─────────────────────────────────────
function playSadTrombone() {
  if (!deck?.sound) return;
  try {
    if (!audioCtx) {
      audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    }
    // Classic "wah wah wah wahhh" — four descending tones
    var notes = [392, 370, 349, 294]; // G4, F#4, F4, D4 (approx)
    var durations = [0.25, 0.25, 0.25, 0.6];
    var startOffset = 0;

    for (var n = 0; n < notes.length; n++) {
      (function (freq, dur, offset) {
        var osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        var gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + offset + dur * 0.95);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + offset);
        osc.stop(audioCtx.currentTime + offset + dur);
      })(notes[n], durations[n], startOffset);
      startOffset += durations[n];
    }
  } catch (e) { /* silent fail */ }
}

// ── Fizzle smoke burst ─────────────────────────────────────────────────────
function createFizzleSmoke(px, py) {
  createParticlesAt(px, py, {
    count: 15,
    baseAngle: Math.PI / 2, // upward
    spread: 2.5,
    minSpeed: 0.8,
    maxSpeed: 2.5,
    vyBoost: 1.5,
    minLife: 1.0,
    maxLife: 2.5,
    minRadius: 3,
    maxRadius: 8,
    colour: function () {
      var v = 100 + Math.floor(Math.random() * 80);
      return 'rgba(' + v + ',' + v + ',' + v + ',0.6)';
    },
    gravity: -0.5 // smoke floats up
  });
}

// ── Animation loop ─────────────────────────────────────────────────────────
async function beginFlight(mode: 'cannon' | 'rocket', config: any, initial: any) {
  flightBuild?.abort();
  const controller = new AbortController(); flightBuild = controller;
  viewActive = false; activeBall = null; activeRocket = null; stopEngineLoop();
  deck.prepare(); UI.setFlightActive(true);
  try {
    const run = await recordFlight(mode, config, initial, controller.signal);
    if (controller.signal.aborted) return;
    flightBuild = null; deck.load(run);
    currentGravity = config.gravity; currentPlanetRadius = config.planetRadius;
    launchTME = Physics.computeEnergy(initial, config.gravity).tme;
    rocketMaxThrust = initial.thrustMagnitude || 0;
    viewActive = true; endDelivered = false; lastFlightTime = 0;
    shots = []; particles = []; trajectoryDots = []; landedRocket = null; rocketLanded = false;
    fitRun(run);
    if (run.outcome === 'no-liftoff') {
      deck.clock.time = run.duration; deck.clock.paused = true;
      createFizzleSmoke(initial.x, .2); crewReaction('fizzle');
    } else if (mode === 'cannon') {
      recoilPhase = 1; recoilTimer = 0; flashProgress = 0; flashTimer = 0;
      playCannonBoom(); createSmokeParticles(initial.x, initial.y, config.angle); startleCharacter();
    } else { playIgnitionRumble(1); startleCharacter(true); }
    updateRecordedFlight(0); syncEngineAudio();
  } catch (error) {
    if (controller.signal.aborted) return;
    flightBuild = null; deck.busy = false;
    deck.message('This configuration could not be simulated. Reset or adjust the launch settings.');
    deck.update(); UI.setFlightActive(false); console.error(error);
  }
}

function fitRun(run: FlightRecord) {
  const baseline = compatibleRuns(run, deck.baseline) ? deck.baseline : null;
  maxRangeMetres = Math.max(1, run.maxX, baseline?.maxX || 0) - Math.min(0, run.minX, baseline?.minX || 0);
  maxHeightMetres = Math.max(2, run.maxHeight, baseline?.maxHeight || 0);
  Renderer.resetCamera();
  const margin = run.mode === 'rocket' ? (UI.getRocketZoomSettings().marginPercent / 100) : DEFAULT_CANNON_ZOOM_MARGIN;
  const duration = run.mode === 'rocket' ? UI.getRocketZoomSettings().durationSeconds : DEFAULT_CANNON_VIEW_SECONDS;
  Renderer.setViewTransitionDuration(reducedMotion() ? .01 : duration);
  // Cannon's compact arc is framed as a single experiment. Rockets start close
  // and the camera gradually reveals altitude while keeping the launch visible.
  Renderer.setTargetZoom(run.mode === 'cannon' ? computeNeededZoom(maxRangeMetres, maxHeightMetres, margin) : Renderer.DEFAULT_PPM);
  if (run.mode === 'cannon' && run.minX < 0) Renderer.setCameraTarget(run.minX - 1);
}

function restoreRun() {
  const run = deck.run; if (!run) return;
  flightBuild?.abort(); flightBuild = null; stopEngineLoop();
  restoring = true;
  UI.setFlightActive(false); UI.restoreFlightConfig(run.mode, run.config);
  restoring = false; currentMode = run.mode;
  currentGravity = run.config.gravity; currentPlanetRadius = run.config.planetRadius;
  Renderer.setTargetGravity(currentGravity); Renderer.setBarrelLength(run.config.barrelLength || 2);
  pendingFire = false; barrelAnimState = 'idle';
  launchTME = Physics.computeEnergy(run.samples[0], currentGravity).tme;
  rocketMaxThrust = run.samples[0].thrustMagnitude || 0;
  viewActive = true; endDelivered = false; lastFlightTime = deck.clock.time;
  shots = []; particles = []; landedRocket = null; rocketLanded = false;
  fitRun(run); updateRecordedFlight(0);
}

function syncEngineAudio() {
  const shouldPlay = deck?.sound && viewActive && !deck.clock.paused && activeRocket?.engineOn;
  if (shouldPlay && !rocketEngineAudio) startEngineLoop();
  else if (!shouldPlay) stopEngineLoop();
}

function crewReaction(kind: string) {
  if (!activeCharacter) return;
  activeCharacter.reaction = kind;
  if (kind !== 'coast') crewReactionUntil = performance.now() / 1000 + 4;
  const now = performance.now() / 1000;
  const count = remarkCounts.get(kind) || 0;
  const lines = { coast: 'I brought a folding chair.', apex: 'The view was worth it.',
    impact: 'We need a longer measuring tape.', escape: 'About that return ticket…',
    orbit: 'We may be here a while.', fizzle: 'We have made a heater.' };
  if (deck.banter && now - lastCrewRemark > 8 && count < 2 && lines[kind]) {
    activeCharacter.bubbleText = lines[kind]; activeCharacter.bubbleTimer = 4;
    activeCharacter.thoughtCooldown = 20; lastCrewRemark = now; remarkCounts.set(kind, count + 1);
  }
}

function updateRecordedFlight(dt: number) {
  const run = deck?.run;
  if (!run || !viewActive) { deck?.update(); return; }
  deck.clock.advance(dt, run);
  const time = deck.clock.time;
  const state = sampleFlight(run, time);
  const stride = Math.max(1, Math.ceil(run.samples.length / 2500));
  trajectoryDots = run.samples.filter((s, i) => s.time <= time && i % stride === 0);
  if (currentMode === 'cannon') {
    activeBall = state; activeRocket = null;
    UI.updateReadouts(state, Physics.computeEnergy(state, currentGravity), launchTME);
  } else {
    activeBall = null;
    activeRocket = { ...state, phase: run.outcome === 'no-liftoff' ? 'fizzle_done' : 'flight', maxThrust: rocketMaxThrust };
    UI.updateRocketReadouts(state);
    const settings = UI.getRocketZoomSettings();
    const ppm = computeNeededZoom(Math.max(1, Math.abs(state.x)), Math.max(2, state.y), settings.marginPercent / 100);
    Renderer.setViewTransitionDuration(reducedMotion() ? .01 : settings.durationSeconds);
    if (ppm < Renderer.getCurrentPPM()) Renderer.setTargetZoom(Math.max(ppm, Renderer.getWholePlanetPPM() * .65));
    const blend = 1 - Renderer.getPlanetViewFrac();
    const visibleWidth = Renderer.getWidth() / Renderer.getCurrentPPM();
    Renderer.setCameraTarget((state.x - visibleWidth / 2) * blend);
    const cameraY = state.y + (Renderer.getHeight() / 2 - Renderer.getBaseGroundY()) / Renderer.getCurrentPPM();
    Renderer.setCameraTargetY(Math.max(0, cameraY * blend));
  }
  if (time > lastFlightTime) {
    for (const event of run.events) {
      if (event.time > lastFlightTime && event.time <= time && event.kind !== 'end') {
        deck.message(event.label);
        crewReaction(event.kind);
        if (event.kind === 'burnout') { stopEngineLoop(); playBurnoutSound(); }
      }
    }
    if (deck.clock.rate > 4 && performance.now() / 1000 > crewReactionUntil && activeCharacter?.reaction !== 'coast') crewReaction('coast');
  }
  lastFlightTime = time;
  if (time >= run.duration) {
    if (!endDelivered) {
      endDelivered = true;
      if (run.outcome === 'impact') {
        if (currentMode === 'cannon') handleLanding(state); else handleRocketLanding(state);
        crewReaction('impact');
      } else if (run.outcome === 'no-liftoff') { crewReaction('fizzle'); }
      stopEngineLoop();
      UI.setFlightActive(false); deck.showResult();
    }
    if (run.outcome === 'impact') { activeBall = null; activeRocket = null; }
  } else { endDelivered = false; UI.setFlightActive(true); }
  syncEngineAudio(); deck.update();
}

function drawVectors(state: any) {
  const ctx = canvas.getContext('2d');
  const origin = Renderer.toCanvas(state.x, state.y);
  const surfaceAngle = state.planetRadius > 0 ? state.x / state.planetRadius : 0;
  const arrows = [{ label: 'gravity', angle: -Math.PI / 2, color: '#f0d385' }];
  if (Math.hypot(state.vx, state.vy) > .01) arrows.unshift({ label: 'velocity', angle: Math.atan2(state.vy, state.vx), color: '#94d9ed' });
  if (state.engineOn) arrows.push({ label: 'thrust', angle: state.theta * Math.PI / 180, color: '#eeae8c' });
  ctx.save(); ctx.font = '13px system-ui'; ctx.lineWidth = 2;
  ctx.fillStyle = '#193330'; ctx.fillRect(12, 12, 180, 27);
  ctx.fillStyle = '#fff7e6'; ctx.fillText('Directions · not to scale', 20, 30);
  arrows.forEach((arrow, index) => {
    const angle = arrow.angle - surfaceAngle;
    const dx = Math.cos(angle) * (58 + index * 10), dy = -Math.sin(angle) * (58 + index * 10);
    const x = origin.x + dx, y = origin.y + dy;
    ctx.strokeStyle = arrow.color; ctx.fillStyle = arrow.color;
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(x, y);
    const a = Math.atan2(dy, dx);
    ctx.lineTo(x - 8 * Math.cos(a - .45), y - 8 * Math.sin(a - .45));
    ctx.moveTo(x, y); ctx.lineTo(x - 8 * Math.cos(a + .45), y - 8 * Math.sin(a + .45)); ctx.stroke();
    ctx.strokeStyle = '#193330'; ctx.lineWidth = 3; ctx.strokeText(arrow.label, x + 5, y - 4);
    ctx.fillText(arrow.label, x + 5, y - 4); ctx.lineWidth = 2;
  });
  ctx.restore();
}

function installSceneControls() {
  const controls = document.querySelector('.flight-controls')!;
  const launch = document.createElement('button'); launch.id = 'scene-launch'; launch.textContent = 'Launch';
  launch.onclick = () => { if (currentMode === 'cannon') fire(); else rocketLaunch(); };
  const reset = document.createElement('button'); reset.textContent = 'Reset'; reset.onclick = clearRange;
  controls.prepend(launch, reset);
  let dragging = false;
  canvas.setAttribute('aria-label', 'Physics experiment scene. Drag the target flag or use the target number field.');
  canvas.addEventListener('pointerdown', event => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    const target = Renderer.toCanvas(currentMode === 'cannon' ? deck.target : 0, currentMode === 'rocket' ? deck.target : 0);
    const near = currentMode === 'cannon' ? Math.abs(x - target.x) < 26 && Math.abs(y - target.y) < 65 : Math.abs((Renderer.screenToSurface(x, y).y - deck.target) * Renderer.getCurrentPPM()) < 22;
    if (near) { dragging = true; canvas.setPointerCapture(event.pointerId); event.preventDefault(); }
  });
  canvas.addEventListener('pointermove', event => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const position = Renderer.screenToSurface(event.clientX - rect.left, event.clientY - rect.top);
    deck.setTarget(currentMode === 'cannon' ? position.x : position.y, currentMode);
    if (deck.run && deck.clock.time >= deck.run.duration) deck.showResult();
  });
  canvas.addEventListener('pointerup', () => dragging = false);
  canvas.addEventListener('pointercancel', () => dragging = false);
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const elapsed = Math.max(0, (timestamp - lastTime) / 1000);
  var dt = Math.min(elapsed, 0.05);
  lastTime = timestamp;
  if (document.hidden) { requestAnimationFrame(loop); return; }
  const sceneLaunch = document.getElementById('scene-launch') as HTMLButtonElement;
  if (sceneLaunch) sceneLaunch.disabled = deck.busy || viewActive && !deck.clock.paused;

  // Update renderer world (environment blend + zoom animation)
  Renderer.updateWorld(dt);

  updateRecordedFlight(elapsed);

  // ─── Animations ───
  if (currentMode === 'cannon') {
    updateCannonAnimation(reducedMotion() ? 0 : dt);
    updateBarrelAnimation(dt);
  }
  updateParticles(dt);
  if (reducedMotion()) particles = [];
  updateImpactAnimations(dt);
  if (activeCharacter) activeCharacter.banter = deck.banter;
  updateCharacter(reducedMotion() ? 0 : dt);
  syncCharacterToPlanet();

  // ─── Draw ───
  Renderer.clear();
  Renderer.drawWorld();

  if (deck.run && viewActive) {
    if (deck.ghost && compatibleRuns(deck.run, deck.baseline) && deck.baseline!.id !== deck.run.id) {
      Renderer.drawGhost(deck.baseline!.samples, { label: deck.pinned ? 'Pinned flight' : 'Previous flight' });
      const ghost = sampleFlight(deck.baseline!, Math.min(deck.clock.time, deck.baseline!.duration));
      const point = Renderer.toCanvas(ghost.x, ghost.y), ctx = canvas.getContext('2d');
      ctx.save(); ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 2; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.arc(point.x, point.y, 7, 0, Math.PI*2); ctx.stroke(); ctx.restore();
    }
    if (deck.prediction) Renderer.drawGhost(deck.run.samples, { color: '#e5cf83', label: 'Recorded full path' });
  }
  Renderer.drawTarget(deck.target, currentMode);
  // Trajectory dots
  for (var d = 0; d < trajectoryDots.length; d++) {
    Renderer.drawTrajectoryDot(trajectoryDots[d].x, trajectoryDots[d].y);
  }

  // LOD: skip fine surface detail at whole-planet zoom
  var drawSurfaceDetail = Renderer.getPlanetViewFrac() < 0.5;

  // Landed shots
  if (drawSurfaceDetail) {
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
  }

  // Comic character (behind shockwave and cannon)
  if (activeCharacter) {
    Renderer.drawCharacter(activeCharacter);
  }

  // Shockwave
  if (drawSurfaceDetail && impactShockwaveProgress >= 0 && impactShockwaveProgress <= 1) {
    Renderer.drawShockwave(impactShockwaveX, impactShockwaveProgress);
  }

  // ─── Mode-specific drawing ───
  if (currentMode === 'cannon') {

  // Surface objects — skip at whole-planet zoom
  if (drawSurfaceDetail) {
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
  } // end drawSurfaceDetail

  // Active ball (always visible — it's the projectile)
  if (activeBall) {
    Renderer.drawBall(activeBall.x, activeBall.y, 1, 1);
  }

  } else if (currentMode === 'rocket') {
    // ── Rocket mode drawing (Stage 4) ──
    var rVals = UI.getRocketValues();
    var rAngle = rVals.launchAngle;
    var rEps = rVals.epsilon;

    // Launch tower — skip at whole-planet zoom
    if (drawSurfaceDetail) {
      Renderer.drawLaunchTower(rAngle);
    }

    // Rocket sprite — on pad, in flight, or absent after landing
    if (activeRocket && activeRocket.phase === 'flight') {
      if (activeRocket.engineOn && activeRocket.thrustMagnitude > 0) {
        const thrustFrac = activeRocket.thrustMagnitude / (activeRocket.maxThrust || activeRocket.thrustMagnitude);
        Renderer.drawExhaust(activeRocket.x, activeRocket.y, activeRocket.theta * Math.PI / 180, thrustFrac, rEps);
      }
      Renderer.drawRocket(activeRocket, rAngle, rEps);
    } else if (activeRocket && (activeRocket.phase === 'fizzle' || activeRocket.phase === 'fizzle_done')) {
      // Fizzle: rocket on pad, sputtering
      Renderer.drawRocket({ phase: 'pad' }, rAngle, rEps);
      if (activeRocket.phase === 'fizzle' && activeRocket.mProp > 0) {
        // Show exhaust flame at nozzle on pad during fizzle
        Renderer.drawExhaust(
          Renderer.TOWER_BASE_X_M || 1.5, 0.1,
          rAngle * Math.PI / 180,
          0.5  // half thrust visually — it's sputtering
        );
        Renderer.drawFizzle(
          Renderer.TOWER_BASE_X_M,
          0,
          activeRocket.fizzleProgress || 0
        );
      }
    } else if (landedRocket && drawSurfaceDetail) {
      Renderer.drawCrater(landedRocket.x);
      Renderer.drawRocket({ phase: 'flight', x: landedRocket.x, y: 0.6, theta: 8 }, 8, landedRocket.epsilon);
    } else if (!rocketLanded) {
      // Pre-launch: rocket sitting on the pad
      Renderer.drawRocket({ phase: 'pad' }, rAngle, rEps);
    }
  }

  // ── Nozzle cutaway inset (rocket mode only) ──
  if (currentMode === 'rocket' && typeof NozzleRender !== 'undefined' && Renderer.getWidth() > 680) {
    var nzVals = UI.getRocketValues();
    var nzGravity = currentGravity;
    var nzPre = RocketPhysics.computePreLaunch(nzVals, nzGravity);
    var nzProp = RocketPropellants.getById(nzVals.propellantId);
    var nzPh = nzProp ? nzProp.placeholder : { gamma: 1.2, Tc_K: 3000 };
    var nzCtx = canvas.getContext('2d');
    NozzleRender.draw(nzCtx, Renderer.getWidth(), Renderer.getHeight(), {
      throatDia_mm: nzVals.throatDia_mm,
      epsilon:      nzVals.epsilon,
      Pc_bar:       nzVals.Pc_bar,
      MR:           nzVals.MR,
      At:           nzPre.At,
      mdot:         nzPre.mdot,
      thrust:       nzPre.thrust,
      Isp:          nzPre.Isp,
      cStar:        nzPre.cStar,
      Cf:           nzPre.Cf,
      gamma:        nzPh.gamma,
      Tc_K:         nzPh.Tc_K,
      Pa_Pa:        nzVals.Pa_Pa,
      Pc_Pa:        nzPre.Pc_Pa,
      worldTime:    reducedMotion() ? 0 : timestamp / 1000
    });
  }

  if (deck.vectors && (activeBall || activeRocket)) drawVectors(activeBall || activeRocket);

  // Particles (shared across both modes)
  Renderer.drawParticles(particles);

  requestAnimationFrame(loop);
}

// Helper: convert canvas px back to physics metres (for off-screen check)
function toPhysX(canvasPx) {
  var ppm = Renderer.getCurrentPPM();
  if (ppm <= 0) return 9999;
  // cameraX is implicit in toCanvasX: canvas = (world - cameraX) * ppm
  // -> world = cameraX + canvas/ppm, with cameraX recovered from toCanvasX(0).
  var cameraX = -Renderer.toCanvasX(0) / ppm;
  return cameraX + canvasPx / ppm;
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
    onBarrelChange: onBarrelChange,
    onModeChange: function (mode) {
      if (!restoring && deck) clearRange();
      if (deck && !restoring) deck.setTarget(mode === 'rocket' ? 1000 : 45, mode);
      // Save current mode's zoom state
      var savePPM = Renderer.getCurrentPPM();
      if (currentMode === 'cannon') {
        cannonZoomState = { maxRange: maxRangeMetres, maxHeight: maxHeightMetres, ppm: savePPM, camX: 0, camY: 0 };
      } else {
        rocketZoomState = { maxRange: maxRangeMetres, maxHeight: maxHeightMetres, ppm: savePPM, camX: 0, camY: 0 };
      }

      currentMode = mode;

      // Restore new mode's zoom state
      if (mode === 'cannon') {
        maxRangeMetres = cannonZoomState.maxRange;
        maxHeightMetres = cannonZoomState.maxHeight;
        Renderer.setViewTransitionDuration(DEFAULT_CANNON_VIEW_SECONDS);
        Renderer.setTargetZoom(cannonZoomState.ppm);
        Renderer.resetCamera();
      } else {
        maxRangeMetres = rocketZoomState.maxRange;
        maxHeightMetres = rocketZoomState.maxHeight;
        Renderer.setViewTransitionDuration(DEFAULT_VIEW_TRANSITION_SECONDS);
        Renderer.setZoomImmediate(rocketZoomState.ppm);
        Renderer.resetCamera();
        var tw = Renderer.TOWER_BASE_X_M || 1.5;
        var vw = Renderer.getWidth() / rocketZoomState.ppm;
        Renderer.setCameraImmediate(tw - vw / 2);
      }
    },
    onRocketLaunch: rocketLaunch,
    onRocketClear: clearRange,
    onExperiment: function (experiment) {
      clearRange(); deck.setTarget(experiment.target || (currentMode === 'rocket' ? 1000 : 45), currentMode);
      deck.message(experiment.question);
    }
  });

  deck = new FlightDeck(document.querySelector('.canvas-area')!);
  deck.onSeek = () => {
    if (!deck.run) return;
    if (!viewActive) restoreRun();
    endDelivered = false; lastFlightTime = deck.clock.time;
    stopEngineLoop(); updateRecordedFlight(0); syncEngineAudio();
  };
  deck.onReplay = () => { restoreRun(); syncEngineAudio(); };
  deck.onSound = syncEngineAudio;
  installSceneControls();
  Renderer.resize();
  window.addEventListener('resize', function () {
    Renderer.resize();
    if (viewActive && deck.run) fitRun(deck.run);
  });
  new ResizeObserver(() => {
    if (viewActive && deck.run?.mode === 'cannon') fitRun(deck.run);
  }).observe(canvas);

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
