/**
 * ============================================================================
 * ui.js — Control Panel Logic for Matilda's Cannon Lab
 * ============================================================================
 *
 * ROLE:  Manages all DOM controls: sliders, planet buttons, fire/reset buttons,
 *        tooltips, live telemetry readouts, and the energy bar visualisation.
 *        Reads from DOM, writes to DOM — but never touches canvas or physics.
 *
 * EXPORTS (via window.UI namespace):
 *   init(callbacks)        — Wire up all event listeners
 *   getValues()            — Current slider values { angle, mass, force, gravity }
 *   updateReadouts(state, energy)  — Push telemetry numbers to DOM
 *   setFlightActive(bool)  — Enable/disable fire button
 *   highlightPlanet(name)  — Set active planet button
 *   resetReadouts()        — Zero-out displays
 *
 * DEPENDS ON: DOM elements defined in index.html
 * LOADED BY:  <script src="ui.js"> in index.html (after renderer.js)
 * ============================================================================
 */

(function () {
  'use strict';

  // ── DOM references (populated in init) ─────────────────────────────────────
  var sliderAngle, sliderMass, sliderForce, sliderBarrel, sliderGravity;
  var valAngle, valMass, valForce, valBarrel, valGravity;
  var btnFire, btnClear;
  var planetButtons;
  var readVelocity, readHeight, readDistance;
  var readKE, readPE, readTME;
  var energyBarKE, energyBarPE, energyBarContainer;
  var flightDataSection;
  var tooltipEl;

  var onFire = null;
  var onClear = null;
  var onGravityChange = null;
  var onBarrelChange = null;

  // ── Initialisation ─────────────────────────────────────────────────────────

  function init(callbacks) {
    onFire = callbacks.onFire;
    onClear = callbacks.onClear;
    onGravityChange = callbacks.onGravityChange || null;
    onBarrelChange = callbacks.onBarrelChange || null;

    // Sliders
    sliderAngle = document.getElementById('slider-angle');
    sliderMass = document.getElementById('slider-mass');
    sliderForce = document.getElementById('slider-force');
    sliderBarrel = document.getElementById('slider-barrel');
    sliderGravity = document.getElementById('slider-gravity');

    // Value readouts next to sliders
    valAngle = document.getElementById('val-angle');
    valMass = document.getElementById('val-mass');
    valForce = document.getElementById('val-force');
    valBarrel = document.getElementById('val-barrel');
    valGravity = document.getElementById('val-gravity');

    // Buttons
    btnFire = document.getElementById('btn-fire');
    btnClear = document.getElementById('btn-clear');

    // Planet buttons
    planetButtons = document.querySelectorAll('.planet-btn');

    // Telemetry
    readVelocity = document.getElementById('read-velocity');
    readHeight = document.getElementById('read-height');
    readDistance = document.getElementById('read-distance');
    readKE = document.getElementById('read-ke');
    readPE = document.getElementById('read-pe');
    readTME = document.getElementById('read-tme');

    // Energy bar
    energyBarKE = document.getElementById('energy-bar-ke');
    energyBarPE = document.getElementById('energy-bar-pe');
    energyBarContainer = document.getElementById('energy-bar');

    // Flight data section
    flightDataSection = document.getElementById('flight-data');

    // Tooltip element
    tooltipEl = document.getElementById('tooltip');

    // Wire up slider live updates
    wireSlider(sliderAngle, valAngle, '°');
    wireSlider(sliderMass, valMass, ' kg');
    wireSlider(sliderForce, valForce, ' N');
    wireSlider(sliderBarrel, valBarrel, ' m');
    wireSlider(sliderGravity, valGravity, ' m/s²');

    // Set initial display values
    updateSliderDisplay(sliderAngle, valAngle, '°');
    updateSliderDisplay(sliderMass, valMass, ' kg');
    updateSliderDisplay(sliderForce, valForce, ' N');
    updateSliderDisplay(sliderBarrel, valBarrel, ' m');
    updateSliderDisplay(sliderGravity, valGravity, ' m/s²');

    // Fire button
    btnFire.addEventListener('click', function () {
      if (onFire && !btnFire.disabled) onFire();
    });

    // Clear button
    btnClear.addEventListener('click', function () {
      if (onClear) onClear();
    });

    // Planet buttons
    for (var i = 0; i < planetButtons.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var g = parseFloat(btn.getAttribute('data-gravity'));
          sliderGravity.value = g;
          updateSliderDisplay(sliderGravity, valGravity, ' m/s²');
          highlightPlanet(btn.getAttribute('data-planet'));
          if (onGravityChange) onGravityChange(g);
        });
      })(planetButtons[i]);
    }

    // Tooltips
    wireTooltips();

    // Initial planet highlight
    highlightPlanet('earth');
  }

  // ── Slider helpers ─────────────────────────────────────────────────────────

  function wireSlider(slider, display, unit) {
    slider.addEventListener('input', function () {
      updateSliderDisplay(slider, display, unit);
      // If gravity slider changes, check planet match
      if (slider === sliderGravity) {
        var g = parseFloat(slider.value);
        matchPlanet(g);
        if (onGravityChange) onGravityChange(g);
      }
      // If barrel slider changes, trigger barrel animation
      if (slider === sliderBarrel) {
        if (onBarrelChange) onBarrelChange(parseFloat(slider.value));
      }
    });
  }

  function updateSliderDisplay(slider, display, unit) {
    var v = parseFloat(slider.value);
    // Format nicely
    if (unit === '°') {
      display.textContent = v.toFixed(0) + unit;
    } else if (unit === ' m/s²') {
      display.textContent = v.toFixed(2) + unit;
    } else if (unit === ' N') {
      display.textContent = v.toFixed(0) + unit;
    } else {
      display.textContent = v.toFixed(1) + unit;
    }
  }

  var PLANET_GRAVITY_MAP = [
    { name: 'moon',    g: 1.62 },
    { name: 'mercury', g: 3.7 },
    { name: 'mars',    g: 3.72 },
    { name: 'uranus',  g: 8.69 },
    { name: 'venus',   g: 8.87 },
    { name: 'earth',   g: 9.81 },
    { name: 'saturn',  g: 10.44 },
    { name: 'neptune', g: 11.15 },
    { name: 'jupiter', g: 24.79 }
  ];

  function matchPlanet(g) {
    highlightPlanet(findClosestPlanetName(g));
  }

  function findClosestPlanetName(g) {
    var best = PLANET_GRAVITY_MAP[0], bd = Math.abs(g - best.g);
    for (var i = 1; i < PLANET_GRAVITY_MAP.length; i++) {
      var d = Math.abs(g - PLANET_GRAVITY_MAP[i].g);
      if (d < bd) { bd = d; best = PLANET_GRAVITY_MAP[i]; }
    }
    return best.name;
  }

  function highlightNearestPlanet(g) {
    highlightPlanet(findClosestPlanetName(g));
  }

  // ── Planet buttons ─────────────────────────────────────────────────────────

  function highlightPlanet(name) {
    for (var i = 0; i < planetButtons.length; i++) {
      var btn = planetButtons[i];
      if (btn.getAttribute('data-planet') === name) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }

  // ── Tooltips ───────────────────────────────────────────────────────────────

  function wireTooltips() {
    var triggers = document.querySelectorAll('[data-tip]');
    for (var i = 0; i < triggers.length; i++) {
      (function (trigger) {
        trigger.addEventListener('mouseenter', function (e) {
          var html = trigger.getAttribute('data-tip');
          showTooltip(trigger, html);
        });
        trigger.addEventListener('mouseleave', function () {
          hideTooltip();
        });
      })(triggers[i]);
    }
  }

  function showTooltip(anchor, html) {
    tooltipEl.innerHTML = html;
    tooltipEl.style.display = 'block';

    // Position near anchor
    var rect = anchor.getBoundingClientRect();
    var tipW = tooltipEl.offsetWidth;
    var tipH = tooltipEl.offsetHeight;

    var left = rect.right + 8;
    var top = rect.top - tipH / 2 + rect.height / 2;

    // Keep on screen
    if (left + tipW > window.innerWidth - 10) {
      left = rect.left - tipW - 8;
    }
    if (top < 5) top = 5;
    if (top + tipH > window.innerHeight - 5) {
      top = window.innerHeight - tipH - 5;
    }

    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = top + 'px';
  }

  function hideTooltip() {
    tooltipEl.style.display = 'none';
  }

  // ── Get current values ─────────────────────────────────────────────────────

  function getValues() {
    return {
      angle: parseFloat(sliderAngle.value),
      mass: parseFloat(sliderMass.value),
      force: parseFloat(sliderForce.value),
      barrelLength: parseFloat(sliderBarrel.value),
      gravity: parseFloat(sliderGravity.value)
    };
  }

  // ── Update telemetry readouts ──────────────────────────────────────────────

  function updateReadouts(state, energy, maxTME) {
    if (!state) {
      readVelocity.textContent = '---';
      readHeight.textContent = '---';
      readDistance.textContent = '---';
      readKE.textContent = '---';
      readPE.textContent = '---';
      readTME.textContent = '---';
      energyBarKE.style.width = '0%';
      energyBarPE.style.width = '0%';
      return;
    }

    var spd = Physics.speed(state);
    readVelocity.textContent = spd.toFixed(1) + ' m/s';
    readHeight.textContent = Math.max(0, state.y).toFixed(1) + ' m';
    readDistance.textContent = (state.x - (Renderer.CANNON_BASE_X_M || 1.5)).toFixed(1) + ' m';

    if (energy) {
      readKE.textContent = energy.ke.toFixed(0) + ' J';
      readPE.textContent = energy.pe.toFixed(0) + ' J';
      readTME.textContent = energy.tme.toFixed(0) + ' J';

      // Energy bar: divide by launch TME so bar shows conservation visually
      var denom = (maxTME && maxTME > 0) ? maxTME : energy.tme;
      if (denom > 0) {
        var kePct = Math.min(100, (energy.ke / denom) * 100);
        var pePct = Math.min(100, (energy.pe / denom) * 100);
        energyBarKE.style.width = kePct + '%';
        energyBarPE.style.width = pePct + '%';
      }
    }
  }

  function freezeReadouts() {
    // Just stop updating — values remain as they are
  }

  function resetReadouts() {
    updateReadouts(null, null);
  }

  // ── Flight active state ────────────────────────────────────────────────────

  function setFlightActive(active) {
    btnFire.disabled = active;
    if (active) {
      btnFire.classList.add('disabled');
    } else {
      btnFire.classList.remove('disabled');
    }
  }

  // ── Expose namespace ──────────────────────────────────────────────────────
  window.UI = {
    init: init,
    getValues: getValues,
    updateReadouts: updateReadouts,
    freezeReadouts: freezeReadouts,
    resetReadouts: resetReadouts,
    setFlightActive: setFlightActive,
    highlightPlanet: highlightPlanet,
    highlightNearestPlanet: highlightNearestPlanet
  };

})();
