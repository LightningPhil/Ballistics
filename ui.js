/**
 * ============================================================================
 * ui.js — Control Panel Logic for Launch Lab
 * ============================================================================
 *
 * ROLE:  Manages all DOM controls: mode toggle, cannon sliders, rocket panel,
 *        planet buttons, fire/launch buttons, tooltips, live telemetry
 *        readouts, pre-launch rocket readouts, and the energy bar.
 *        Reads from DOM, writes to DOM — but never touches canvas or physics.
 *
 * EXPORTS (via window.UI namespace):
 *   init(callbacks)              — Wire up all event listeners
 *   getValues()                  — Cannon slider values { angle, mass, force, gravity }
 *   getMode()                    — 'cannon' | 'rocket'
 *   getRocketValues()            — Rocket slider values (full config object)
 *   updateReadouts(state, energy)— Push cannon telemetry to DOM
 *   updateRocketReadouts(state)  — Push rocket flight telemetry to DOM
 *   updatePreLaunchReadouts(pre) — Push pre-launch computed values to DOM
 *   resetRocketReadouts()        — Zero-out rocket displays
 *   setFlightActive(bool)        — Enable/disable fire/launch & mode toggle
 *   highlightPlanet(name)        — Set active planet button
 *   resetReadouts()              — Zero-out cannon displays
 *
 * DEPENDS ON: DOM elements defined in index.html,
 *             window.RocketPropellants (for registry data),
 *             window.RocketPhysics (for live pre-launch computation)
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

  // Mode state
  var currentMode = 'cannon'; // 'cannon' | 'rocket'
  var modeButtons;
  var cannonPanel, rocketPanel;

  var onFire = null;
  var onClear = null;
  var onGravityChange = null;
  var onBarrelChange = null;
  var onModeChange = null;
  var isFlightActive = false;  // Track flight state for mode toggle guard
  var onRocketLaunch = null;
  var onRocketClear = null;

  // ── Rocket DOM references (populated in initRocketPanel) ───────────────────
  var rocketPropSelect, propellantNote;
  var sliderRocketMR, sliderRocketPc, sliderRocketEps, sliderRocketDt;
  var sliderRocketDryMass, sliderRocketPropMass, sliderRocketAngle;
  var sliderRocketEtaC, sliderRocketEtaN;
  var rocketGuidanceSelect;
  var sliderPitchEnd, sliderPitchT1, sliderPitchT2, sliderProgradeVmin;
  var sliderRocketZoomMargin, sliderRocketZoomDuration;
  var guidancePitchSub, guidanceProgradeSub;
  var efficiencySection, efficiencyArrow;
  var btnLaunch, btnRocketClear;
  var twWarning, fizzleMessage;
  // Rocket value displays
  var valRocketMR, valRocketPc, valRocketEps, valRocketDt;
  var valRocketDryMass, valRocketPropMass, valRocketAngle;
  var valRocketEtaC, valRocketEtaN;
  var valPitchEnd, valPitchT1, valPitchT2, valProgradeVmin;
  var valRocketZoomMargin, valRocketZoomDuration;
  // Rocket readout elements
  var readRocketThrust, readRocketMdot, readRocketIsp;
  var readRocketTW, readRocketBurn, readRocketDV;
  var readRocketPredRange, readRocketPredApo;
  var readRocketVelocity, readRocketHeight, readRocketRange;
  var readRocketProp, readRocketImpulse;
  // Live flight extended readouts
  var readRocketLiveThrust, readRocketLiveMass, readRocketLiveIsp, readRocketLiveTW;
  // Propellant gauge elements
  var propGaugeOx, propGaugeFuel;
  // Post-flight summary elements
  var postFlightSummary;
  var readPostRange, readPostMaxHeight, readPostFlightTime, readPostBurnTime;
  var readPostDvTsiolkovsky, readPostDvActual, readPostGravityLoss;

  // ── Initialisation ─────────────────────────────────────────────────────────

  function init(callbacks) {
    onFire = callbacks.onFire;
    onClear = callbacks.onClear;
    onGravityChange = callbacks.onGravityChange || null;
    onBarrelChange = callbacks.onBarrelChange || null;
    onModeChange = callbacks.onModeChange || null;
    onRocketLaunch = callbacks.onRocketLaunch || null;
    onRocketClear = callbacks.onRocketClear || null;

    // Mode toggle
    cannonPanel = document.getElementById('cannon-panel');
    rocketPanel = document.getElementById('rocket-panel');
    modeButtons = document.querySelectorAll('.mode-btn');

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

    // Mode toggle buttons
    wireModeToggle();

    // Rocket panel controls
    initRocketPanel();

    // Initial planet highlight
    highlightPlanet('earth');
  }

  // ── Mode toggle ────────────────────────────────────────────────────────────

  function wireModeToggle() {
    for (var i = 0; i < modeButtons.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var newMode = btn.getAttribute('data-mode');
          if (newMode === currentMode) return;
          // Prevent mode switch during active flight
          if (isFlightActive) return;
          setMode(newMode);
        });
      })(modeButtons[i]);
    }
  }

  function setMode(newMode) {
    currentMode = newMode;
    // Update toggle button highlights
    for (var i = 0; i < modeButtons.length; i++) {
      var btn = modeButtons[i];
      if (btn.getAttribute('data-mode') === currentMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
    // Show/hide panels
    if (currentMode === 'cannon') {
      cannonPanel.style.display = '';
      rocketPanel.style.display = 'none';
    } else {
      cannonPanel.style.display = 'none';
      rocketPanel.style.display = 'flex';
    }
    // Notify main.js
    if (onModeChange) onModeChange(currentMode);
  }

  function getMode() {
    return currentMode;
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

  // ── Rocket Panel Initialisation ────────────────────────────────────────────

  function initRocketPanel() {
    // Grab all rocket DOM elements
    rocketPropSelect = document.getElementById('rocket-propellant');
    propellantNote = document.getElementById('propellant-note');

    sliderRocketMR = document.getElementById('slider-rocket-mr');
    sliderRocketPc = document.getElementById('slider-rocket-pc');
    sliderRocketEps = document.getElementById('slider-rocket-eps');
    sliderRocketDt = document.getElementById('slider-rocket-dt');
    sliderRocketDryMass = document.getElementById('slider-rocket-drymass');
    sliderRocketPropMass = document.getElementById('slider-rocket-propmass');
    sliderRocketAngle = document.getElementById('slider-rocket-angle');
    sliderRocketEtaC = document.getElementById('slider-rocket-etac');
    sliderRocketEtaN = document.getElementById('slider-rocket-etan');

    valRocketMR = document.getElementById('val-rocket-mr');
    valRocketPc = document.getElementById('val-rocket-pc');
    valRocketEps = document.getElementById('val-rocket-eps');
    valRocketDt = document.getElementById('val-rocket-dt');
    valRocketDryMass = document.getElementById('val-rocket-drymass');
    valRocketPropMass = document.getElementById('val-rocket-propmass');
    valRocketAngle = document.getElementById('val-rocket-angle');
    valRocketEtaC = document.getElementById('val-rocket-etac');
    valRocketEtaN = document.getElementById('val-rocket-etan');

    rocketGuidanceSelect = document.getElementById('rocket-guidance');
    guidancePitchSub = document.getElementById('guidance-pitch-sub');
    guidanceProgradeSub = document.getElementById('guidance-prograde-sub');

    sliderPitchEnd = document.getElementById('slider-rocket-pitch-end');
    sliderPitchT1 = document.getElementById('slider-rocket-pitch-t1');
    sliderPitchT2 = document.getElementById('slider-rocket-pitch-t2');
    sliderProgradeVmin = document.getElementById('slider-rocket-prograde-vmin');
    sliderRocketZoomMargin = document.getElementById('slider-rocket-zoom-margin');
    sliderRocketZoomDuration = document.getElementById('slider-rocket-zoom-duration');

    valPitchEnd = document.getElementById('val-rocket-pitch-end');
    valPitchT1 = document.getElementById('val-rocket-pitch-t1');
    valPitchT2 = document.getElementById('val-rocket-pitch-t2');
    valProgradeVmin = document.getElementById('val-rocket-prograde-vmin');
    valRocketZoomMargin = document.getElementById('val-rocket-zoom-margin');
    valRocketZoomDuration = document.getElementById('val-rocket-zoom-duration');

    efficiencySection = document.getElementById('efficiency-section');
    efficiencyArrow = document.getElementById('efficiency-arrow');

    btnLaunch = document.getElementById('btn-launch');
    btnRocketClear = document.getElementById('btn-rocket-clear');
    twWarning = document.getElementById('tw-warning');
    fizzleMessage = document.getElementById('fizzle-message');

    // Readout elements
    readRocketThrust = document.getElementById('read-rocket-thrust');
    readRocketMdot = document.getElementById('read-rocket-mdot');
    readRocketIsp = document.getElementById('read-rocket-isp');
    readRocketTW = document.getElementById('read-rocket-tw');
    readRocketBurn = document.getElementById('read-rocket-burn');
    readRocketDV = document.getElementById('read-rocket-dv');
    readRocketPredRange = document.getElementById('read-rocket-pred-range');
    readRocketPredApo = document.getElementById('read-rocket-pred-apogee');
    readRocketVelocity = document.getElementById('read-rocket-velocity');
    readRocketHeight = document.getElementById('read-rocket-height');
    readRocketRange = document.getElementById('read-rocket-range');
    readRocketProp = document.getElementById('read-rocket-prop');
    readRocketImpulse = document.getElementById('read-rocket-impulse');

    // Live flight extended readouts
    readRocketLiveThrust = document.getElementById('read-rocket-live-thrust');
    readRocketLiveMass = document.getElementById('read-rocket-live-mass');
    readRocketLiveIsp = document.getElementById('read-rocket-live-isp');
    readRocketLiveTW = document.getElementById('read-rocket-live-tw');

    // Propellant gauge
    propGaugeOx = document.getElementById('prop-gauge-ox');
    propGaugeFuel = document.getElementById('prop-gauge-fuel');

    // Post-flight summary
    postFlightSummary = document.getElementById('post-flight-summary');
    readPostRange = document.getElementById('read-post-range');
    readPostMaxHeight = document.getElementById('read-post-maxheight');
    readPostFlightTime = document.getElementById('read-post-flighttime');
    readPostBurnTime = document.getElementById('read-post-burntime');
    readPostDvTsiolkovsky = document.getElementById('read-post-dv-tsiolkovsky');
    readPostDvActual = document.getElementById('read-post-dv-actual');
    readPostGravityLoss = document.getElementById('read-post-gravity-loss');

    // Populate propellant dropdown from registry
    populatePropellantDropdown();

    // Wire rocket sliders with live pre-launch update
    wireRocketSlider(sliderRocketMR, valRocketMR, '');
    wireRocketSlider(sliderRocketPc, valRocketPc, ' bar');
    wireRocketSlider(sliderRocketEps, valRocketEps, '');
    wireRocketSlider(sliderRocketDt, valRocketDt, ' mm');
    wireRocketSlider(sliderRocketDryMass, valRocketDryMass, ' kg');
    wireRocketSlider(sliderRocketPropMass, valRocketPropMass, ' kg');
    wireRocketSlider(sliderRocketAngle, valRocketAngle, '°');
    wireRocketSlider(sliderRocketEtaC, valRocketEtaC, '');
    wireRocketSlider(sliderRocketEtaN, valRocketEtaN, '');

    // Guidance sub-panel sliders
    wireRocketSlider(sliderPitchEnd, valPitchEnd, '°');
    wireRocketSlider(sliderPitchT1, valPitchT1, ' s');
    wireRocketSlider(sliderPitchT2, valPitchT2, ' s');
    wireRocketSlider(sliderProgradeVmin, valProgradeVmin, ' m/s');
    wireRocketSlider(sliderRocketZoomMargin, valRocketZoomMargin, ' %');
    wireRocketSlider(sliderRocketZoomDuration, valRocketZoomDuration, ' s');

    // Guidance mode dropdown
    rocketGuidanceSelect.addEventListener('change', function () {
      updateGuidanceSubPanels();
      refreshPreLaunch();
    });

    // Propellant dropdown change
    rocketPropSelect.addEventListener('change', function () {
      onPropellantChange();
      refreshPreLaunch();
    });

    // Efficiency collapse toggle
    var effToggle = document.getElementById('efficiency-toggle');
    effToggle.addEventListener('click', function () {
      var isOpen = !efficiencySection.classList.contains('rocket-efficiency-hidden');
      efficiencySection.classList.toggle('rocket-efficiency-hidden', isOpen);
      efficiencyArrow.classList.toggle('open', !isOpen);
    });

    // Launch button
    btnLaunch.addEventListener('click', function () {
      if (onRocketLaunch && !btnLaunch.disabled) onRocketLaunch();
    });

    // Rocket clear button
    btnRocketClear.addEventListener('click', function () {
      if (onRocketClear) onRocketClear();
    });

    // Set initial slider display values
    updateRocketSliderDisplay(sliderRocketMR, valRocketMR, '');
    updateRocketSliderDisplay(sliderRocketPc, valRocketPc, ' bar');
    updateRocketSliderDisplay(sliderRocketEps, valRocketEps, '');
    updateRocketSliderDisplay(sliderRocketDt, valRocketDt, ' mm');
    updateRocketSliderDisplay(sliderRocketDryMass, valRocketDryMass, ' kg');
    updateRocketSliderDisplay(sliderRocketPropMass, valRocketPropMass, ' kg');
    updateRocketSliderDisplay(sliderRocketAngle, valRocketAngle, '°');
    updateRocketSliderDisplay(sliderRocketEtaC, valRocketEtaC, '');
    updateRocketSliderDisplay(sliderRocketEtaN, valRocketEtaN, '');
    updateRocketSliderDisplay(sliderPitchEnd, valPitchEnd, '°');
    updateRocketSliderDisplay(sliderPitchT1, valPitchT1, ' s');
    updateRocketSliderDisplay(sliderPitchT2, valPitchT2, ' s');
    updateRocketSliderDisplay(sliderProgradeVmin, valProgradeVmin, ' m/s');
    updateRocketSliderDisplay(sliderRocketZoomMargin, valRocketZoomMargin, ' %');
    updateRocketSliderDisplay(sliderRocketZoomDuration, valRocketZoomDuration, ' s');

    // Set initial guidance sub-panel visibility
    updateGuidanceSubPanels();

    // Wire tooltips again to pick up new rocket panel tooltip triggers
    wireTooltips();

    // Initial pre-launch computation
    refreshPreLaunch();
  }

  // ── Propellant dropdown population ─────────────────────────────────────────

  function populatePropellantDropdown() {
    var registry = RocketPropellants.REGISTRY;
    var lastCategory = '';
    for (var i = 0; i < registry.length; i++) {
      var p = registry[i];
      // Add category optgroup
      if (p.category !== lastCategory) {
        var group = document.createElement('optgroup');
        group.label = p.category.charAt(0).toUpperCase() + p.category.slice(1);
        rocketPropSelect.appendChild(group);
        lastCategory = p.category;
      }
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      rocketPropSelect.appendChild(opt);
    }
    // Default to LOX/RP-1
    rocketPropSelect.value = 'LOX_RP1';
    onPropellantChange();
  }

  function onPropellantChange() {
    var prop = RocketPropellants.getById(rocketPropSelect.value);
    if (!prop) return;

    // Update MR slider bounds
    sliderRocketMR.min = prop.MR_bounds[0];
    sliderRocketMR.max = prop.MR_bounds[1];
    // If current value is out of bounds, reset to default
    var curMR = parseFloat(sliderRocketMR.value);
    if (curMR < prop.MR_bounds[0] || curMR > prop.MR_bounds[1]) {
      sliderRocketMR.value = prop.MR_default;
    }
    sliderRocketMR.step = ((prop.MR_bounds[1] - prop.MR_bounds[0]) / 100).toFixed(3);
    updateRocketSliderDisplay(sliderRocketMR, valRocketMR, '');

    // Update info note
    propellantNote.textContent = prop.notes.join(' ');
  }

  // ── Guidance sub-panel toggling ────────────────────────────────────────────

  function updateGuidanceSubPanels() {
    var mode = rocketGuidanceSelect.value;
    if (mode === 'pitch_program') {
      guidancePitchSub.classList.remove('guidance-sub-hidden');
    } else {
      guidancePitchSub.classList.add('guidance-sub-hidden');
    }
    if (mode === 'prograde_lock') {
      guidanceProgradeSub.classList.remove('guidance-sub-hidden');
    } else {
      guidanceProgradeSub.classList.add('guidance-sub-hidden');
    }
  }

  // ── Rocket slider helpers ──────────────────────────────────────────────────

  function wireRocketSlider(slider, display, unit) {
    if (!slider || !display) return;
    slider.addEventListener('input', function () {
      updateRocketSliderDisplay(slider, display, unit);
      refreshPreLaunch();
    });
  }

  function updateRocketSliderDisplay(slider, display, unit) {
    var v = parseFloat(slider.value);
    if (unit === '°') {
      display.textContent = v.toFixed(0) + unit;
    } else if (unit === ' bar' || unit === ' mm' || unit === ' kg' || unit === ' m/s' || unit === ' %') {
      display.textContent = v.toFixed(0) + unit;
    } else if (unit === ' s') {
      display.textContent = v.toFixed(1) + unit;
    } else {
      // No unit — format based on step precision
      var step = parseFloat(slider.step) || 1;
      if (step < 0.1) {
        display.textContent = v.toFixed(2);
      } else if (step < 1) {
        display.textContent = v.toFixed(1);
      } else {
        display.textContent = v.toFixed(0);
      }
    }
  }

  // ── Get rocket values ──────────────────────────────────────────────────────

  function getRocketValues() {
    return {
      propellantId: rocketPropSelect.value,
      MR: parseFloat(sliderRocketMR.value),
      Pc_bar: parseFloat(sliderRocketPc.value),
      epsilon: parseFloat(sliderRocketEps.value),
      throatDia_mm: parseFloat(sliderRocketDt.value),
      dryMass: parseFloat(sliderRocketDryMass.value),
      propMass: parseFloat(sliderRocketPropMass.value),
      launchAngle: parseFloat(sliderRocketAngle.value),
      guidanceMode: rocketGuidanceSelect.value,
      etaC: parseFloat(sliderRocketEtaC.value),
      etaN: parseFloat(sliderRocketEtaN.value),
      Pa_Pa: 101325, // sea level default (could be made configurable later)
      // Guidance sub-parameters
      pitchEnd: parseFloat(sliderPitchEnd.value),
      pitchT1: parseFloat(sliderPitchT1.value),
      pitchT2: parseFloat(sliderPitchT2.value),
      progradeVmin: parseFloat(sliderProgradeVmin.value)
    };
  }

  function getRocketZoomSettings() {
    return {
      marginPercent: sliderRocketZoomMargin ? parseFloat(sliderRocketZoomMargin.value) : 15,
      durationSeconds: sliderRocketZoomDuration ? parseFloat(sliderRocketZoomDuration.value) : 3
    };
  }

  // ── Live pre-launch readout refresh ────────────────────────────────────────

  function refreshPreLaunch() {
    if (typeof RocketPhysics === 'undefined') return;
    var vals = getRocketValues();
    var gravity = parseFloat(sliderGravity.value);
    var pre = RocketPhysics.computePreLaunch(vals, gravity);

    // Predicted full-flight envelope from current settings (pre-launch).
    if (RocketPhysics.predictTrajectory) {
      var guidance = RocketPhysics.buildGuidance
        ? RocketPhysics.buildGuidance(vals)
        : null;
      var pred = RocketPhysics.predictTrajectory(vals, gravity, {
        guidance: guidance,
        dt: 1 / 30,
        maxTime: 180,
        startX: 0,
        startY: 0
      });
      if (pred && !pred.fizzled) {
        pre.predictedRange = Math.max(0, pred.maxX - pred.launchX);
        pre.predictedApogee = Math.max(0, pred.maxHeight);
      } else {
        pre.predictedRange = 0;
        pre.predictedApogee = 0;
      }
    }

    updatePreLaunchReadouts(pre);
  }

  function updatePreLaunchReadouts(pre) {
    if (!pre) return;

    readRocketThrust.textContent = formatSI(pre.thrust) + 'N';
    readRocketMdot.textContent = pre.mdot.toFixed(3) + ' kg/s';
    readRocketIsp.textContent = pre.Isp.toFixed(1) + ' s';

    // T/W with colour coding
    readRocketTW.textContent = pre.tw.toFixed(2);
    readRocketTW.className = 'readout-value ' + (pre.tw < 1 ? 'rocket-tw-warn' : 'rocket-tw-ok');

    // T/W warning banner & button caution
    if (pre.tw < 1) {
      twWarning.classList.remove('tw-warning-hidden');
      btnLaunch.classList.add('caution');
    } else {
      twWarning.classList.add('tw-warning-hidden');
      btnLaunch.classList.remove('caution');
    }

    readRocketBurn.textContent = isFinite(pre.burnTime) ? pre.burnTime.toFixed(1) + ' s' : '---';
    readRocketDV.textContent = pre.deltaV.toFixed(0) + ' m/s';
    if (readRocketPredRange) {
      readRocketPredRange.textContent = (pre.predictedRange !== undefined)
        ? pre.predictedRange.toFixed(1) + ' m'
        : '---';
    }
    if (readRocketPredApo) {
      readRocketPredApo.textContent = (pre.predictedApogee !== undefined)
        ? pre.predictedApogee.toFixed(1) + ' m'
        : '---';
    }
  }

  // ── Rocket flight readouts (live during flight) ────────────────────────────

  function updateRocketReadouts(state) {
    if (!state) {
      resetRocketReadouts();
      return;
    }
    var spd = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
    readRocketVelocity.textContent = spd.toFixed(1) + ' m/s';
    readRocketHeight.textContent = Math.max(0, state.y).toFixed(1) + ' m';
    readRocketRange.textContent = state.x.toFixed(1) + ' m';
    var propPct = state.mPropInitial > 0
      ? ((state.mProp / state.mPropInitial) * 100).toFixed(0)
      : '0';
    readRocketProp.textContent = state.mProp.toFixed(1) + ' / ' + state.mPropInitial.toFixed(1) + ' kg';
    readRocketImpulse.textContent = formatSI(state.totalImpulse) + 'N\u00B7s';

    // Extended live readouts
    if (readRocketLiveThrust) {
      readRocketLiveThrust.textContent = state.engineOn
        ? formatSI(state.thrustMagnitude) + 'N'
        : '0 N';
    }
    if (readRocketLiveMass) {
      readRocketLiveMass.textContent = state.mass.toFixed(1) + ' kg';
    }
    if (readRocketLiveIsp) {
      readRocketLiveIsp.textContent = state.engineOn && state.Isp > 0
        ? state.Isp.toFixed(1) + ' s'
        : '\u2014';
    }
    if (readRocketLiveTW) {
      // T/W needs gravity — use slider value
      var g = parseFloat(sliderGravity.value) || 9.81;
      var tw = state.mass > 0 && state.engineOn
        ? state.thrustMagnitude / (state.mass * g)
        : 0;
      readRocketLiveTW.textContent = tw > 0 ? tw.toFixed(2) : '\u2014';
      readRocketLiveTW.className = 'readout-value ' + (tw > 0 && tw < 1 ? 'rocket-tw-warn' : (tw >= 1 ? 'rocket-tw-ok' : ''));
    }

    // Propellant gauge
    updatePropellantGauge(state);
  }

  function updatePropellantGauge(state) {
    if (!propGaugeOx || !propGaugeFuel) return;
    if (!state || state.mPropInitial <= 0) {
      propGaugeOx.style.width = '0%';
      propGaugeFuel.style.width = '0%';
      return;
    }
    var frac = state.mProp / state.mPropInitial;
    var mr = state.MR || 2.56;
    var oxFrac = mr / (1 + mr);
    var fuelFrac = 1 / (1 + mr);
    propGaugeOx.style.width = (oxFrac * frac * 100).toFixed(1) + '%';
    propGaugeFuel.style.width = (fuelFrac * frac * 100).toFixed(1) + '%';
  }

  function resetRocketReadouts() {
    readRocketVelocity.textContent = '---';
    readRocketHeight.textContent = '---';
    readRocketRange.textContent = '---';
    readRocketProp.textContent = '---';
    readRocketImpulse.textContent = '---';
    if (readRocketLiveThrust) readRocketLiveThrust.textContent = '---';
    if (readRocketLiveMass) readRocketLiveMass.textContent = '---';
    if (readRocketLiveIsp) readRocketLiveIsp.textContent = '---';
    if (readRocketLiveTW) {
      readRocketLiveTW.textContent = '---';
      readRocketLiveTW.className = 'readout-value';
    }
    if (propGaugeOx) propGaugeOx.style.width = '0%';
    if (propGaugeFuel) propGaugeFuel.style.width = '0%';
    hideFizzleMessage();
    hidePostFlightSummary();
  }

  // ── Fizzle message ─────────────────────────────────────────────────────────

  function showFizzleMessage(tw) {
    if (!fizzleMessage) return;
    fizzleMessage.textContent = 'Fizzle! T/W was ' + tw.toFixed(2) +
      ' \u2014 needed \u2265 1.0 to lift off.';
    fizzleMessage.classList.remove('fizzle-message-hidden');
  }

  function hideFizzleMessage() {
    if (!fizzleMessage) return;
    fizzleMessage.classList.add('fizzle-message-hidden');
  }

  // ── Post-flight summary ──────────────────────────────────────────────────────

  /**
   * Show the post-flight summary panel with computed results.
   * @param {Object} data { range, maxHeight, flightTime, burnTime, dvTsiolkovsky, dvActual }
   */
  function showPostFlightSummary(data) {
    if (!postFlightSummary) return;
    readPostRange.textContent = data.range.toFixed(1) + ' m';
    readPostMaxHeight.textContent = data.maxHeight.toFixed(1) + ' m';
    readPostFlightTime.textContent = data.flightTime.toFixed(1) + ' s';
    readPostBurnTime.textContent = data.burnTime.toFixed(1) + ' s';
    readPostDvTsiolkovsky.textContent = data.dvTsiolkovsky.toFixed(0) + ' m/s';
    readPostDvActual.textContent = data.dvActual.toFixed(0) + ' m/s';
    var gravLoss = data.dvTsiolkovsky - data.dvActual;
    readPostGravityLoss.textContent = (gravLoss > 0 ? gravLoss.toFixed(0) : '0') + ' m/s';
    postFlightSummary.classList.remove('post-flight-hidden');
  }

  function hidePostFlightSummary() {
    if (!postFlightSummary) return;
    postFlightSummary.classList.add('post-flight-hidden');
  }

  // ── SI formatting helper ───────────────────────────────────────────────────

  function formatSI(value) {
    if (value >= 1e6) return (value / 1e6).toFixed(2) + ' M';
    if (value >= 1e3) return (value / 1e3).toFixed(1) + ' k';
    return value.toFixed(1) + ' ';
  }

  // ── Get current cannon values ──────────────────────────────────────────────

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
    isFlightActive = active;
    btnFire.disabled = active;
    if (btnLaunch) btnLaunch.disabled = active;
    if (active) {
      btnFire.classList.add('disabled');
      if (btnLaunch) btnLaunch.classList.add('disabled');
    } else {
      btnFire.classList.remove('disabled');
      if (btnLaunch) btnLaunch.classList.remove('disabled');
    }
    // Disable/enable mode toggle during flight
    for (var i = 0; i < modeButtons.length; i++) {
      if (active) {
        modeButtons[i].classList.add('disabled');
      } else {
        modeButtons[i].classList.remove('disabled');
      }
    }
  }

  // ── Expose namespace ──────────────────────────────────────────────────────
  window.UI = {
    init: init,
    getValues: getValues,
    getMode: getMode,
    getRocketValues: getRocketValues,
    getRocketZoomSettings: getRocketZoomSettings,
    updateReadouts: updateReadouts,
    updateRocketReadouts: updateRocketReadouts,
    updatePreLaunchReadouts: updatePreLaunchReadouts,
    resetRocketReadouts: resetRocketReadouts,
    showPostFlightSummary: showPostFlightSummary,
    hidePostFlightSummary: hidePostFlightSummary,
    showFizzleMessage: showFizzleMessage,
    hideFizzleMessage: hideFizzleMessage,
    refreshPreLaunch: refreshPreLaunch,
    freezeReadouts: freezeReadouts,
    resetReadouts: resetReadouts,
    setFlightActive: setFlightActive,
    highlightPlanet: highlightPlanet,
    highlightNearestPlanet: highlightNearestPlanet
  };

})();
