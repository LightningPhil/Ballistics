import { Physics } from './physics.ts';
import { RocketPropellants } from './rocket_propellants.ts';
import { RocketPhysics } from './rocket_physics.ts';
import { resolveEnvironment } from './environment.ts';
import { getPlanetFact } from './planet-facts.ts';

/**
 * ============================================================================
 * ui.ts — Control Panel Logic for Launch Lab
 * ============================================================================
 *
 * ROLE:  Manages all DOM controls: mode toggle, cannon sliders, rocket panel,
 *        planet buttons, fire/launch buttons, tooltips, experiment cards,
 *        live telemetry readouts, pre-launch rocket readouts and the energy
 *        bar. Reads from DOM, writes to DOM — never touches the canvas.
 *        It calls the pure physics modules only to compute pre-launch
 *        readouts; recorded flights are owned by main.ts / flight.ts.
 *
 * The `UI` object exported at the bottom is the public surface used by
 * main.ts; everything else in this file is private.
 * ============================================================================
 */

// ── DOM references (populated in init) ─────────────────────────────────────
var sliderAngle, sliderMass, sliderForce, sliderBarrel, sliderGravity;
var valAngle, valMass, valForce, valBarrel, valGravity;
var btnFire, btnClear;
var planetButtons;
var readVelocity, readHeight, readDistance;
var readKE, readPE, readTME;
var energyBarKE, energyBarPE;
var tooltipEl;
var planetFactButton, planetFactButtonLabel, planetFactDialog, planetFactCard;

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
var onExperiment = null;
var activeTooltipAnchor = null;

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
  onExperiment = callbacks.onExperiment || null;

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
  initPlanetFacts();

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
        if (isFlightActive) return;
        var g = parseFloat(btn.getAttribute('data-gravity'));
        sliderGravity.value = g;
        updateSliderDisplay(sliderGravity, valGravity, ' m/s²');
        highlightPlanet(btn.getAttribute('data-planet'));
        if (onGravityChange) onGravityChange(g);
        refreshPreLaunch();
      });
    })(planetButtons[i]);
  }

  // Tooltips
  wireTooltips();

  // Mode toggle buttons
  wireModeToggle();

  // Rocket panel controls
  initRocketPanel();

  document.querySelectorAll<HTMLButtonElement>('[data-experiment]').forEach(function (button) {
    button.addEventListener('click', function () {
      applyExperiment(button.dataset.experiment);
    });
  });

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
  if (isFlightActive || (newMode !== 'cannon' && newMode !== 'rocket')) return;
  // Restoring a recorded flight or applying an experiment card in the current
  // mode must not re-run the mode-switch side effects (range clear, camera).
  if (newMode === currentMode) return;
  currentMode = newMode;
  // Update toggle button highlights
  for (var i = 0; i < modeButtons.length; i++) {
    var btn = modeButtons[i];
    btn.setAttribute('aria-pressed', String(btn.getAttribute('data-mode') === currentMode));
    if (btn.getAttribute('data-mode') === currentMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
  document.getElementById('cannon-actions').hidden = currentMode !== 'cannon';
  document.getElementById('rocket-actions').hidden = currentMode !== 'rocket';
  // Show/hide panels (the [hidden] rule in style.css does the display work)
  cannonPanel.hidden = currentMode !== 'cannon';
  rocketPanel.hidden = currentMode !== 'rocket';
  // Notify main.ts
  if (onModeChange) onModeChange(currentMode);
}

// ── Slider helpers ─────────────────────────────────────────────────────────

function wireSlider(slider, display, unit) {
  slider.addEventListener('input', function () {
    updateSliderDisplay(slider, display, unit);
    // If gravity slider changes, check planet match
    if (slider === sliderGravity) {
      var g = parseFloat(slider.value);
      highlightNearestPlanet(g);
      if (onGravityChange) onGravityChange(g);
      refreshPreLaunch();
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
  { name: 'pluto',   g: .62 },
  { name: 'ganymede', g: 1.428 },
  { name: 'moon',    g: 1.62 },
  { name: 'mercury', g: 3.7 },
  { name: 'mars',    g: 3.72 },
  { name: 'venus',   g: 8.87 },
  { name: 'uranus',  g: 9.01 },
  { name: 'earth',   g: 9.81 },
  { name: 'saturn',  g: 11.19 },
  { name: 'neptune', g: 11.27 },
  { name: 'jupiter', g: 25.92 },
  { name: 'sun',     g: 274 }
];

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
    btn.setAttribute('aria-pressed', String(btn.getAttribute('data-planet') === name));
    if (btn.getAttribute('data-planet') === name) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
  var env = resolveEnvironment(parseFloat(sliderGravity.value));
  var label = document.getElementById('environment-label');
  if (label) label.textContent = (env.interpolated ? 'Custom world' : env.name[0].toUpperCase() + env.name.slice(1)) + ' · ' + env.gravity.toFixed(2) + ' m/s²';
  updatePlanetFactButton(name);
}

function initPlanetFacts() {
  planetFactButton = document.getElementById('planet-fact-button');
  planetFactButtonLabel = document.getElementById('planet-fact-button-label');
  planetFactDialog = document.getElementById('planet-fact-dialog');
  planetFactCard = document.getElementById('planet-fact-card');
  planetFactButton.addEventListener('click', function () {
    const fact = getPlanetFact(planetFactButton.dataset.planet);
    if (!fact) return;
    hideTooltip();
    planetFactCard.dataset.world = fact.id;
    planetFactCard.style.setProperty('--fact-accent', fact.accent);
    const fields = {
      'planet-fact-kind': fact.kind,
      'planet-fact-title': fact.name,
      'planet-fact-tagline': fact.tagline,
      'planet-fact-mass': fact.mass,
      'planet-fact-diameter': fact.diameter,
      'planet-fact-distance': fact.distance,
      'planet-fact-gravity': fact.gravity,
      'planet-fact-day': fact.dayLength,
      'planet-fact-year': fact.yearLength,
      'planet-fact-tilt': fact.axialTilt,
      'planet-fact-temp-average': fact.averageTemp,
      'planet-fact-temp-min': fact.minTemp,
      'planet-fact-temp-max': fact.maxTemp,
      'planet-fact-atmosphere': fact.atmosphere,
      'planet-fact-exploration': fact.exploration,
      'planet-fact-temperature-note': fact.temperatureNote,
    };
    Object.entries(fields).forEach(function ([id, text]) {
      const element = document.getElementById(id);
      if (element) element.textContent = text;
    });
    planetFactDialog.showModal();
  });
  planetFactDialog.addEventListener('click', function (event) {
    if (event.target === planetFactDialog) planetFactDialog.close();
  });
}

function updatePlanetFactButton(name) {
  const fact = getPlanetFact(name);
  if (!planetFactButton || !planetFactButtonLabel) return;
  planetFactButton.disabled = !fact;
  planetFactButton.dataset.planet = fact?.id || '';
  planetFactButtonLabel.textContent = fact ? fact.name + ' fact' : 'World fact';
}

// ── Tooltips ───────────────────────────────────────────────────────────────

function wireTooltips() {
  var triggers = document.querySelectorAll<HTMLElement>('[data-tip]');
  for (var i = 0; i < triggers.length; i++) {
    (function (trigger) {
      if (trigger.dataset.tipWired) return;
      trigger.dataset.tipWired = 'true';
      trigger.setAttribute('aria-describedby', 'tooltip');
      trigger.setAttribute('aria-expanded', 'false');
      // Hover shows a transient tooltip that ignores the pointer, so moving
      // the mouse off the trigger closes it cleanly. Focus or click "pins" it
      // instead: a pinned tooltip accepts pointer events so long content can
      // be scrolled, and only closes on blur, Escape or an outside click.
      trigger.addEventListener('mouseenter', function () {
        if (activeTooltipAnchor === trigger && tooltipEl.classList.contains('pinned')) return;
        showTooltip(trigger, trigger.getAttribute('data-tip'), false);
      });
      trigger.addEventListener('mouseleave', function () {
        if (!tooltipEl.classList.contains('pinned')) hideTooltip();
      });
      trigger.addEventListener('focus', function () {
        showTooltip(trigger, trigger.getAttribute('data-tip'), true);
      });
      trigger.addEventListener('blur', function (event: FocusEvent) {
        // Clicking inside a pinned tooltip (e.g. its scrollbar) moves focus
        // onto the tooltip itself; that is not a dismissal.
        if (event.relatedTarget === tooltipEl) return;
        hideTooltip();
      });
      trigger.addEventListener('click', function (event) {
        event.stopPropagation();
        showTooltip(trigger, trigger.getAttribute('data-tip'), true);
      });
      trigger.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') hideTooltip();
      });
    })(triggers[i]);
  }
  if (!tooltipEl.dataset.wired) {
    tooltipEl.dataset.wired = 'true';
    // Focusable (but not tabbable) so a pinned tooltip can take focus when
    // clicked without the trigger's blur handler dismissing it.
    tooltipEl.tabIndex = -1;
    tooltipEl.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') hideTooltip();
    });
    document.addEventListener('click', function (event) {
      if (tooltipEl.contains(event.target as Node)) return;
      hideTooltip();
    });
    document.addEventListener('scroll', function (event) {
      // Scrolling the tooltip's own overflow must not dismiss it.
      if (event.target === tooltipEl) return;
      hideTooltip();
    }, true);
    window.addEventListener('resize', hideTooltip);
  }
}

function showTooltip(anchor, html, pinned) {
  if (activeTooltipAnchor && activeTooltipAnchor !== anchor) activeTooltipAnchor.setAttribute('aria-expanded', 'false');
  activeTooltipAnchor = anchor;
  anchor.setAttribute('aria-expanded', 'true');
  tooltipEl.innerHTML = html;
  tooltipEl.classList.toggle('pinned', !!pinned);
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
  left = Math.max(12, Math.min(left, window.innerWidth - tipW - 12));
  top = Math.max(12, Math.min(top, window.innerHeight - tipH - 12));

  tooltipEl.style.left = left + 'px';
  tooltipEl.style.top = top + 'px';
}

function hideTooltip() {
  if (activeTooltipAnchor) activeTooltipAnchor.setAttribute('aria-expanded', 'false');
  activeTooltipAnchor = null;
  tooltipEl.classList.remove('pinned');
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
    effToggle.setAttribute('aria-expanded', String(!isOpen));
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
    group.appendChild(opt);
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
  propellantNote.textContent = 'Illustrative performance model. ' + prop.notes.join(' ') +
    ' Mixture ratio changes the tank split; chemistry stays fixed for this pair.';
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
  var environment = resolveEnvironment(parseFloat(sliderGravity.value));
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
    Pa_Pa: environment.surfacePressure,
    environment: environment,
    planetRadius: environment.radius,
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
  var vals = getRocketValues();
  var gravity = parseFloat(sliderGravity.value);
  var pre: any = RocketPhysics.computePreLaunch(vals, gravity);

  // Full-run measurements come from the actual recorded flight. In particular,
  // an arbitrary prediction horizon must never masquerade as a reached apex.
  updatePreLaunchReadouts(pre);
}

function updatePreLaunchReadouts(pre) {
  if (!pre) return;

  readRocketThrust.textContent = formatSI(pre.thrust) + 'N';
  readRocketMdot.textContent = pre.mdot.toFixed(3) + ' kg/s';
  readRocketIsp.textContent = pre.Isp.toFixed(1) + ' s';

  // T/W with colour coding
  readRocketTW.textContent = pre.tw.toFixed(2);
  var canLaunch = pre.canLaunch !== undefined ? pre.canLaunch : pre.tw * Math.sin(getRocketValues().launchAngle * Math.PI / 180) > 1;
  readRocketTW.className = 'readout-value ' + (!canLaunch ? 'rocket-tw-warn' : 'rocket-tw-ok');

  // T/W warning banner & button caution
  if (!canLaunch) {
    twWarning.textContent = pre.flowRegime === 'unchoked'
      ? 'Chamber pressure is too low for choked nozzle flow in this atmosphere. Try higher chamber pressure.'
      : pre.thrust <= 0
        ? 'This nozzle cannot produce thrust in this atmosphere. Try higher chamber pressure or a smaller expansion ratio.'
      : 'Not enough upward thrust for immediate lift-off. Try less mass, more thrust, or a steeper launch.';
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
      : 'After launch';
  }
  if (readRocketPredApo) {
    readRocketPredApo.textContent = (pre.predictedApogee !== undefined)
      ? pre.predictedApogee.toFixed(1) + ' m'
      : 'After launch';
  }
}

// ── Rocket flight readouts (live during flight) ────────────────────────────

function updateRocketReadouts(state, launchX?) {
  if (!state) {
    resetRocketReadouts();
    return;
  }
  var spd = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
  readRocketVelocity.textContent = spd.toFixed(1) + ' m/s';
  readRocketHeight.textContent = Math.max(0, state.y).toFixed(1) + ' m';
  var origin = Number.isFinite(launchX) ? launchX : 0;
  readRocketRange.textContent = (state.x - origin).toFixed(1) + ' m';
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
    var surfaceG = parseFloat(sliderGravity.value) || 9.81;
    var altitude = Math.max(0, state.y);
    var localG = state.planetRadius > 0
      ? surfaceG * Math.pow(state.planetRadius / (state.planetRadius + altitude), 2)
      : surfaceG;
    var tw = state.mass > 0 && state.engineOn
      ? state.thrustMagnitude / (state.mass * localG)
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
  fizzleMessage.textContent = 'Upward thrust / weight was ' + tw.toFixed(2) +
    '. The upward thrust must exceed the weight for immediate lift-off. Try less mass, more thrust, or a steeper angle.';
  fizzleMessage.classList.remove('fizzle-message-hidden');
}

function hideFizzleMessage() {
  if (!fizzleMessage) return;
  fizzleMessage.classList.add('fizzle-message-hidden');
}

// ── Post-flight summary ──────────────────────────────────────────────────────

/**
 * Show the post-flight summary panel with computed results.
 * @param {Object} data { range, maxHeight, flightTime, burnTime, dvTsiolkovsky, dvActual, burnoutSpeed? }
 *   burnoutSpeed is the speed at motor cut-off; omit it when the rocket never
 *   burnt out (dvActual is then used as the fallback).
 */
function showPostFlightSummary(data) {
  if (!postFlightSummary) return;
  readPostRange.textContent = data.range.toFixed(1) + ' m';
  readPostMaxHeight.textContent = data.maxHeight.toFixed(1) + ' m';
  readPostFlightTime.textContent = data.flightTime.toFixed(1) + ' s';
  readPostBurnTime.textContent = Number.isFinite(data.burnTime) ? data.burnTime.toFixed(1) + ' s' : 'No burnout';
  var idealDv = data.dvTsiolkovsky;
  // A collision while powered is not burnout. Keep the missing measurement
  // missing instead of fabricating a zero-speed burnout from the impact state.
  var burnoutSpeed = data.burnoutSpeed !== undefined ? data.burnoutSpeed : data.dvActual;
  readPostDvTsiolkovsky.textContent = Number.isFinite(idealDv) ? idealDv.toFixed(0) + ' m/s' : '—';
  readPostDvActual.textContent = Number.isFinite(burnoutSpeed) ? burnoutSpeed.toFixed(0) + ' m/s' : 'No burnout';
  readPostGravityLoss.textContent = Number.isFinite(idealDv) && Number.isFinite(burnoutSpeed)
    ? (idealDv - burnoutSpeed).toFixed(0) + ' m/s'
    : '—';
  if (readRocketPredRange) readRocketPredRange.textContent = data.range.toFixed(1) + ' m';
  if (readRocketPredApo) readRocketPredApo.textContent = data.maxHeight.toFixed(1) + ' m';
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

function updateReadouts(state, energy, maxTME?) {
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
  readDistance.textContent = state.x.toFixed(1) + ' m';

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

function resetReadouts() {
  updateReadouts(null, null);
}

// ── Flight active state ────────────────────────────────────────────────────

function setFlightActive(active) {
  if (isFlightActive === active) return;
  isFlightActive = active;
  // The :disabled pseudo-class carries the styling; no extra class is needed.
  btnFire.disabled = active;
  if (btnLaunch) btnLaunch.disabled = active;
  // Disable/enable mode toggle during flight
  for (var i = 0; i < modeButtons.length; i++) {
    modeButtons[i].disabled = active;
  }
  // A recorded flight has one immutable setup. Changing gravity or engine
  // controls beneath it would make the labels disagree with the animation.
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
    '.controls-scroll input, .controls-scroll select, .planet-btn, [data-experiment]'
  ).forEach(function (control) { control.disabled = active; });
  var note = document.getElementById('flight-lock-note');
  if (note) note.hidden = !active;
  if (active) hideTooltip();
}

// Restore labels as well as values when replaying a saved configuration.
// These setters notify the same environment/barrel/mode listeners as editing
// the controls. The main loop can suppress scene transitions during restore.
function restoreFlightConfig(mode, config) {
  if (isFlightActive) return;
  setMode(mode);
  var cannonFields = { angle: 'angle', mass: 'mass', force: 'force', barrelLength: 'barrel', gravity: 'gravity' };
  var rocketFields = {
    MR: 'rocket-mr', Pc_bar: 'rocket-pc', epsilon: 'rocket-eps', throatDia_mm: 'rocket-dt',
    dryMass: 'rocket-drymass', propMass: 'rocket-propmass', launchAngle: 'rocket-angle',
    etaC: 'rocket-etac', etaN: 'rocket-etan', pitchEnd: 'rocket-pitch-end',
    pitchT1: 'rocket-pitch-t1', pitchT2: 'rocket-pitch-t2', progradeVmin: 'rocket-prograde-vmin', gravity: 'gravity'
  };
  if (mode === 'rocket' && config.propellantId) {
    rocketPropSelect.value = config.propellantId;
    onPropellantChange();
  }
  var fields = mode === 'rocket' ? rocketFields : cannonFields;
  Object.keys(fields).forEach(function (key) {
    if (!Number.isFinite(config[key])) return;
    var input = document.getElementById('slider-' + fields[key]) as HTMLInputElement;
    if (input) input.value = String(config[key]);
  });
  if (mode === 'rocket' && config.guidanceMode) rocketGuidanceSelect.value = config.guidanceMode;
  updateAllDisplays();
  updateGuidanceSubPanels();
  var gravity = parseFloat(sliderGravity.value);
  highlightNearestPlanet(gravity);
  if (onGravityChange) onGravityChange(gravity);
  if (mode === 'cannon' && onBarrelChange) onBarrelChange(parseFloat(sliderBarrel.value));
  refreshPreLaunch();
}

function updateAllDisplays() {
  [
    [sliderAngle, valAngle, '°'], [sliderMass, valMass, ' kg'], [sliderForce, valForce, ' N'],
    [sliderBarrel, valBarrel, ' m'], [sliderGravity, valGravity, ' m/s²']
  ].forEach(function ([slider, display, unit]) { updateSliderDisplay(slider, display, unit); });
  [
    [sliderRocketMR, valRocketMR, ''], [sliderRocketPc, valRocketPc, ' bar'],
    [sliderRocketEps, valRocketEps, ''], [sliderRocketDt, valRocketDt, ' mm'],
    [sliderRocketDryMass, valRocketDryMass, ' kg'], [sliderRocketPropMass, valRocketPropMass, ' kg'],
    [sliderRocketAngle, valRocketAngle, '°'], [sliderRocketEtaC, valRocketEtaC, ''],
    [sliderRocketEtaN, valRocketEtaN, ''], [sliderPitchEnd, valPitchEnd, '°'],
    [sliderPitchT1, valPitchT1, ' s'], [sliderPitchT2, valPitchT2, ' s'],
    [sliderProgradeVmin, valProgradeVmin, ' m/s'], [sliderRocketZoomMargin, valRocketZoomMargin, ' %'],
    [sliderRocketZoomDuration, valRocketZoomDuration, ' s']
  ].forEach(function ([slider, display, unit]) { updateRocketSliderDisplay(slider, display, unit); });
}

function applyExperiment(id) {
  if (isFlightActive) return;
  var question = '';
  var target = 45;
  var targetKind = 'range';
  var config: any;
  var mode = 'cannon';
  if (id === 'flag') {
    config = { angle: 35, mass: 5, force: 500, barrelLength: 2, gravity: 9.81 };
    question = 'How close can you land to the 45 m flag? Change only the launch angle.';
  } else if (id === 'high-arc') {
    config = { angle: 65, mass: 5, force: 500, barrelLength: 2, gravity: 9.81 };
    target = 35;
    question = 'Can you reach the 35 m flag with two different arcs? Compare their flight times.';
  } else if (id === 'other-world') {
    // Preserve the launcher. Selecting this card changes only the world.
    config = { ...getValues(), gravity: Math.abs(getValues().gravity - 1.62) < .01 ? 9.81 : 1.62 };
    question = 'The same shot, another world. What changed: time, height, or range?';
  } else if (id === 'just-enough') {
    mode = 'rocket';
    config = { propellantId: 'LOX_RP1', MR: 2.56, Pc_bar: 100, epsilon: 20, throatDia_mm: 15,
      dryMass: 100, propMass: 8, launchAngle: 85, guidanceMode: 'fixed', etaC: .95, etaN: .95,
      pitchEnd: 45, pitchT1: 5, pitchT2: 20, progradeVmin: 10, gravity: 9.81 };
    target = 1000;
    targetKind = 'height';
    question = 'Reach the 1 km marker with as little propellant as you can. What is just enough?';
  } else {
    return;
  }
  restoreFlightConfig(mode, config);
  document.querySelectorAll<HTMLButtonElement>('[data-experiment]').forEach(function (button) {
    button.classList.toggle('active', button.dataset.experiment === id);
    button.setAttribute('aria-pressed', String(button.dataset.experiment === id));
  });
  if (onExperiment) onExperiment({ id: id, target: target, targetKind: targetKind, question: question });
}

// ── Expose namespace ──────────────────────────────────────────────────────
export const UI = {
  init: init,
  getValues: getValues,
  restoreFlightConfig: restoreFlightConfig,
  getRocketValues: getRocketValues,
  getRocketZoomSettings: getRocketZoomSettings,
  updateReadouts: updateReadouts,
  updateRocketReadouts: updateRocketReadouts,
  resetRocketReadouts: resetRocketReadouts,
  showPostFlightSummary: showPostFlightSummary,
  hidePostFlightSummary: hidePostFlightSummary,
  showFizzleMessage: showFizzleMessage,
  hideFizzleMessage: hideFizzleMessage,
  refreshPreLaunch: refreshPreLaunch,
  resetReadouts: resetReadouts,
  setFlightActive: setFlightActive,
  highlightNearestPlanet: highlightNearestPlanet
};
