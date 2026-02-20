/**
 * ============================================================================
 * physics.js — Pure Physics Engine for Matilda's Cannon Lab
 * ============================================================================
 *
 * ROLE:  All physics calculations live here. Every function is PURE — it takes
 *        inputs and returns outputs with zero side-effects, zero DOM access.
 *
 * EXPORTS (via window.Physics namespace):
 *   computeLaunchVelocity(force, mass, barrelLength) → speed (m/s)
 *   createProjectile(x, y, speed, angleDeg, mass)    → state object
 *   stepProjectile(state, dt, gravity)                → new state object
 *   computeEnergy(state, gravity)                     → { ke, pe, tme }
 *
 * LOADED BY: <script src="physics.js"> in index.html (before renderer/ui/main)
 * ============================================================================
 */

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  var BARREL_LENGTH = 2.0; // metres — tunable, kept here as engine default

  // ── Helpers ────────────────────────────────────────────────────────────────
  function degToRad(deg) {
    return deg * Math.PI / 180;
  }

  // ── Core API ───────────────────────────────────────────────────────────────

  /**
   * Work-energy theorem:  ½mv² = F·d   →   v = √(2Fd / m)
   * @param {number} force        Applied force in Newtons
   * @param {number} mass         Mass in kg
   * @param {number} barrelLength Optional override (default 2.0 m)
   * @returns {number} Launch speed in m/s
   */
  function computeLaunchVelocity(force, mass, barrelLength) {
    var d = (typeof barrelLength === 'number') ? barrelLength : BARREL_LENGTH;
    if (mass <= 0) return 0;
    return Math.sqrt(2 * force * d / mass);
  }

  /**
   * Build an initial projectile state from cannon parameters.
   * Physics coordinates: +x right, +y UP (metres).
   *
   * @param {number} x0       Launch x in metres
   * @param {number} y0       Launch y in metres (height above ground)
   * @param {number} speed    Launch speed (from computeLaunchVelocity)
   * @param {number} angleDeg Barrel angle in degrees from horizontal
   * @param {number} mass     Ball mass in kg
   * @returns {object} Projectile state
   */
  function createProjectile(x0, y0, speed, angleDeg, mass) {
    var rad = degToRad(angleDeg);
    return {
      x: x0,
      y: y0,
      vx: speed * Math.cos(rad),
      vy: speed * Math.sin(rad),
      mass: mass,
      time: 0,
      launched: true
    };
  }

  /**
   * Advance projectile by dt seconds (Euler integration).
   * Returns a NEW state object — original is untouched.
   *
   * @param {object} state   Current projectile state
   * @param {number} dt      Delta-time in seconds
   * @param {number} gravity Gravity magnitude m/s² (positive number)
   * @returns {object} New state
   */
  function stepProjectile(state, dt, gravity) {
    var newVx = state.vx;                  // ax = 0
    var newVy = state.vy - gravity * dt;   // ay = -g  (y-up convention)

    return {
      x: state.x + newVx * dt,
      y: state.y + 0.5 * (state.vy + newVy) * dt, // velocity-Verlet: exact for constant g
      vx: newVx,
      vy: newVy,
      mass: state.mass,
      time: state.time + dt,
      launched: true
    };
  }

  /**
   * Compute kinetic, potential, and total mechanical energy.
   *
   * @param {object} state   Projectile state (needs vx, vy, mass, y)
   * @param {number} gravity Gravity magnitude (m/s²)
   * @returns {{ ke: number, pe: number, tme: number }}
   */
  function computeEnergy(state, gravity) {
    var speedSq = state.vx * state.vx + state.vy * state.vy;
    var ke = 0.5 * state.mass * speedSq;
    var pe = state.mass * gravity * Math.max(state.y, 0);
    return { ke: ke, pe: pe, tme: ke + pe };
  }

  /**
   * Compute the current speed scalar.
   * @param {object} state
   * @returns {number} speed in m/s
   */
  function speed(state) {
    return Math.sqrt(state.vx * state.vx + state.vy * state.vy);
  }

  /**
   * Predict full trajectory analytically (for zoom planning).
   * Returns range, max height, flight time.
   */
  function predictTrajectory(force, mass, angleDeg, gravity, startX, startY, barrelLength) {
    var spd = computeLaunchVelocity(force, mass, barrelLength);
    var rad = degToRad(angleDeg);
    var vx = spd * Math.cos(rad);
    var vy = spd * Math.sin(rad);

    // Time to hit ground: startY + vy*t - 0.5*g*t² = 0
    var disc = vy * vy + 2 * gravity * startY;
    var flightTime = (vy + Math.sqrt(Math.max(0, disc))) / gravity;
    var range = startX + vx * flightTime;
    var maxHeight = startY + (vy * vy) / (2 * gravity);

    return {
      range: range,
      maxHeight: maxHeight,
      flightTime: flightTime,
      launchSpeed: spd
    };
  }

  // ── Expose namespace ──────────────────────────────────────────────────────
  window.Physics = {
    BARREL_LENGTH: BARREL_LENGTH,
    computeLaunchVelocity: computeLaunchVelocity,
    createProjectile: createProjectile,
    stepProjectile: stepProjectile,
    computeEnergy: computeEnergy,
    predictTrajectory: predictTrajectory,
    speed: speed,
    degToRad: degToRad
  };

})();
