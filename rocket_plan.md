# Launch Lab — Dual-Mode Refactor Plan

> **Goal:** Transform "Matilda's Cannon Lab" into **"Launch Lab"** — a dual-mode physics sandbox with a **Cannon Mode** (existing, untouched) and a new **Rocket Mode** (continuous-thrust flight from a launch tower).
>
> The planet/gravity system, character system, environment rendering, and overall aesthetic remain shared. The two modes swap out the launcher (cannon vs rocket + tower), the physics model, and the control panel.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Stage 0 — Rename & Mode Switcher Shell](#2-stage-0--rename--mode-switcher-shell)
3. [Stage 1 — Refactor Shared Systems](#3-stage-1--refactor-shared-systems)
4. [Stage 2 — Rocket Physics Engine](#4-stage-2--rocket-physics-engine)
5. [Stage 3 — Rocket UI Panel](#5-stage-3--rocket-ui-panel)
6. [Stage 4 — Launch Tower & Rocket Renderer](#6-stage-4--launch-tower--rocket-renderer)
7. [Stage 5 — Rocket Flight Loop & Integration](#7-stage-5--rocket-flight-loop--integration)
8. [Stage 6 — Fizzle / Failure & Exhaust Effects](#8-stage-6--fizzle--failure--exhaust-effects)
9. [Stage 7 — Flight Telemetry & Readouts](#9-stage-7--flight-telemetry--readouts)
10. [Stage 8 — Polish & Teach](#10-stage-8--polish--teach)
11. [Future — Nozzle Cutaway Graphic](#11-future--nozzle-cutaway-graphic)
12. [File Change Map](#12-file-change-map)
13. [Risk & Rollback Notes](#13-risk--rollback-notes)

---

## 1) Architecture Overview

### Current file roles (unchanged for cannon mode)

| File | Role |
|------|------|
| `physics.js` | Pure cannon ballistics (launch velocity, projectile step, energy) |
| `renderer.js` | Canvas drawing: environments, castle cannon, balls, characters, effects |
| `ui.js` | DOM control panel: sliders, planet buttons, readouts, tooltips |
| `main.js` | Entry point, game loop, state machines (cannon anim, characters, barrel crew) |
| `style.css` | All visual styling |
| `index.html` | DOM skeleton |

### New/modified files for dual-mode

| File | Change |
|------|--------|
| `index.html` | Rename title → "Launch Lab". Add mode toggle UI. Add rocket control panel (hidden by default). |
| `style.css` | Add rocket panel styles, mode toggle styles, launch tower colours. |
| `physics.js` | **No changes** to existing functions. Add new `RocketPhysics` namespace alongside `Physics`. |
| `rocket_physics.js` | **New file.** Continuous-thrust flight model per the single-source-of-truth spec. |
| `rocket_propellants.js` | **New file.** Propellant registry, placeholder performance tables, and interpolation. |
| `renderer.js` | Add `drawLaunchTower()`, `drawRocket()`, `drawExhaust()`, `drawFizzle()`. Keep all cannon drawing intact. |
| `ui.js` | Add rocket panel wiring. Keep all cannon panel wiring intact. Expose `getMode()`. |
| `main.js` | Add mode-switching logic. Rocket flight loop alongside cannon flight loop. Both share planet/character/particle systems. |

### Guiding principle: **Cannon mode must remain byte-for-byte unchanged in behaviour.**

All cannon functions, cannon DOM elements, cannon rendering, and cannon physics stay exactly as they are. Rocket mode is additive — new code paths gated behind a `mode === 'rocket'` check.

---

## 2) Stage 0 — Rename & Mode Switcher Shell

**Goal:** Rebrand to "Launch Lab", add a visible mode toggle, and gate existing code behind `mode === 'cannon'` without changing any cannon behaviour.

### Tasks

1. **`index.html`**
   - Change `<title>` from "Matilda's Cannon Lab" to "Launch Lab".
   - Change `.panel-title` text to "Launch Lab".
   - Change `.panel-subtitle` text to "Physics Sandbox".
   - Add a **mode toggle** at the top of the control panel between title and planet grid:
     ```html
     <div class="mode-toggle">
       <button class="mode-btn active" data-mode="cannon">🏰 Cannon</button>
       <button class="mode-btn" data-mode="rocket">🚀 Rocket</button>
     </div>
     ```
   - Add a `<div class="rocket-panel" id="rocket-panel" style="display:none">` section (empty placeholder for now) below the cannon controls.
   - Wrap existing cannon-specific controls (angle, mass, force, barrel length sliders + FIRE + Clear + Flight Data + Energy) in a `<div class="cannon-panel" id="cannon-panel">`.

2. **`style.css`**
   - Add `.mode-toggle` styles (horizontal button group, pill/tab look, matching the existing aesthetic).
   - Add `.cannon-panel`, `.rocket-panel` display rules.

3. **`ui.js`**
   - Add mode toggle listener. On click: swap `active` class, show/hide `.cannon-panel` and `.rocket-panel`.
   - Expose `UI.getMode()` → `'cannon'` | `'rocket'`.
   - Fire/clear buttons only work in cannon mode (rocket gets its own launch button later).

4. **`main.js`**
   - Read `UI.getMode()` at the top of `fire()` — only proceed if `'cannon'`.
   - No other changes yet.

### Acceptance criteria
- App loads as "Launch Lab" with the cannon mode active by default.
- Clicking "Rocket" toggle shows an empty rocket panel, hides cannon controls.
- Clicking "Cannon" restores everything exactly as before.
- All cannon functionality works identically.

---

## 3) Stage 1 — Refactor Shared Systems

**Goal:** Extract planet/gravity, character, and particle systems into clearly shared code paths so both modes can use them without duplication.

### Tasks

1. **Gravity / planet handler** — Already shared (the slider + planet buttons sit above both panels). Ensure gravity changes work regardless of active mode.

2. **Character system** — Already planet-driven, not launcher-driven. Characters should:
   - Still walk the surface in both modes.
   - React (startle/squash) to rocket launches and landings the same way as cannon shots.
   - No character changes needed here — just verify they work when the cannon drawing is hidden.

3. **Particle system** — Generalise smoke/impact particles. The existing `createSmokeParticles()` and `createImpactParticles()` work on physics coordinates. Rockets will add exhaust particles using the same system.

4. **Zoom system** — `computeNeededZoom()` currently uses range and max height. Rockets will produce different trajectory shapes (potentially very tall, narrow trajectories for near-vertical launches). Ensure zoom handles these gracefully. May need to increase vertical weighting.

5. **Renderer entry points** — Add a draw-dispatch in the render loop:
   ```js
   if (mode === 'cannon') {
     Renderer.drawCannon(angle, recoil);
   } else {
     Renderer.drawLaunchTower(angle);
     Renderer.drawRocket(rocketState);
   }
   ```

### Acceptance criteria
- Planet switches, character spawning, particles, and zoom all work identically in both modes.
- Cannon mode is completely unaffected.

---

## 4) Stage 2 — Rocket Physics Engine

**Goal:** Implement the continuous-thrust physics model from `rocket_lab_single_source_of_truth.md`.

### New file: `rocket_physics.js`

Exposes `window.RocketPhysics` namespace:

```js
RocketPhysics = {
  // Core propulsion
  computeMassFlow(pc, At, cStarEff)         // ṁ = pc·At / c*_eff
  computeThrust(CfEff, pc, At)              // F = Cf_eff · pc · At
  computeIsp(F, mdot, g0)                   // Isp = F / (ṁ·g0)
  computeExhaustVelocity(Isp, g0)           // ve = g0 · Isp

  // Vehicle
  createRocketState(config)                 // → initial state object
  stepRocket(state, dt, gravity, guidance)  // → new state (per-timestep update)

  // Guidance
  fixedAngle(theta0)                        // Mode A
  pitchProgram(theta0, thetaF, t1, t2)     // Mode B
  progradeLock(vMin, fallbackTheta)         // Mode C

  // Tsiolkovsky comparator
  computeDeltaV(Isp, m0, mf, g0)           // Δv = ve·ln(m0/mf)

  // Derived helpers
  computeThrustToWeight(F, m0, g)           // T/W = F / (m0·g)
  computeBurnTime(mProp, mdot)              // t_burn = mProp / ṁ
  solveThroatForThrust(Ftarget, CfEff, pc)  // At = F / (Cf·pc)
}
```

### `stepRocket()` — the golden-path algorithm (Section 13 of spec)

Each timestep:
1. Guidance → compute θ, t̂
2. Engine (if on and propellant > 0):
   - Look up c* and CF from propellant data
   - Apply efficiencies: c*_eff = η_c · c*, CF_eff = η_n · CF
   - ṁ = pc · At / c*_eff
   - F = CF_eff · pc · At
   - Deplete propellant: m_prop = max(0, m_prop - ṁ·dt)
   - If m_prop = 0 → engine off
3. m = m_dry + m_prop
4. a_x = (F/m)·cosθ, a_y = (F/m)·sinθ − g
5. Semi-implicit Euler: v += a·dt, r += v·dt
6. Impulse accumulator: I_tot += F·dt
7. Impact check: if y ≤ 0 while descending → compute x_impact, stop

### State object shape

```js
{
  x, y,                    // position (m)
  vx, vy,                  // velocity (m/s)
  mDry,                    // dry mass (kg)
  mProp,                   // remaining propellant (kg)
  mPropInitial,            // initial propellant (kg)
  engineOn: true,          // engine state
  time: 0,                 // elapsed time (s)
  totalImpulse: 0,         // accumulated impulse (N·s)
  theta: 90,               // current thrust angle (deg)
  thrustMagnitude: 0,      // current thrust (N) — for readouts
  mdot: 0,                 // current mass flow (kg/s)
  Isp: 0,                  // current Isp (s)
  launched: false,         // has it left the pad?
  fizzled: false           // did it fail to launch?
}
```

### Acceptance criteria
- Unit-testable in isolation (no DOM).
- `stepRocket` produces correct trajectories matching hand calculations for simple cases.
- Fizzle detection: if T/W < 1 at ignition, rocket never lifts off.

---

## 5) Stage 3 — Rocket UI Panel

**Goal:** Build the rocket control panel with all user-facing parameters.

### DOM structure inside `#rocket-panel`

```
┌─────────────────────────────┐
│  Propellant                 │  ← dropdown (LOX/LH2, LOX/CH4, etc.)
│  Propellant info note       │  ← small italic text from registry
├─────────────────────────────┤
│  Mixture Ratio (O/F)    ▸  │  ← slider (bounds change per propellant)
│  Chamber Pressure (bar) ▸  │  ← slider (10–300 bar)
│  Expansion Ratio (ε)   ▸  │  ← slider (5–200)
│  Throat Diameter (mm)   ▸  │  ← slider (or computed from thrust target)
├─────────────────────────────┤
│  Dry Mass (kg)          ▸  │  ← slider (1–500 kg)
│  Propellant Mass (kg)   ▸  │  ← slider (1–5000 kg)
│  Launch Angle (°)       ▸  │  ← slider (5–90°, default 90°)
├─────────────────────────────┤
│  Guidance Mode          ▸  │  ← dropdown (Fixed / Pitch Program / Prograde Lock)
│  (conditional sub-controls) │
├─────────────────────────────┤
│  Efficiencies (collapsed)   │
│    η_c (combustion)     ▸  │  ← slider (0.8–1.0, default 0.95)
│    η_n (nozzle)         ▸  │  ← slider (0.8–1.0, default 0.95)
├─────────────────────────────┤
│  [🚀 LAUNCH]               │  ← big green button
│  [🧹 Clear Range]          │
├─────────────────────────────┤
│  Pre-launch Readouts:       │
│    Thrust (N)               │
│    Mass flow (kg/s)         │
│    Isp (s)                  │
│    T/W ratio                │
│    Burn time (est.)         │
│    Δv (Tsiolkovsky)         │
├─────────────────────────────┤
│  Flight Data (live):        │
│    Velocity, Height, Range  │
│    Propellant remaining     │
│    Total impulse            │
└─────────────────────────────┘
```

### Key UX details

- **Propellant dropdown** changes the MR slider bounds automatically and shows the info note.
- **Pre-launch readouts** update live as sliders are dragged (before launch). This lets users see T/W < 1 warnings instantly.
- **T/W warning**: If T/W < 1, show a red warning: "⚠ Thrust < Weight — rocket will not lift off!" and the launch button pulses with a caution colour. Launching still works — it just fizzles.
- **Tooltips** (?) on every parameter, same system as cannon mode.
- All sliders use the existing `.slider-row` / `.slider-label-row` classes.

### Implementation in `ui.js`

- Add `initRocketPanel()` called from `UI.init()`.
- Add `UI.getRocketValues()` → `{ propellantId, MR, Pc, epsilon, throatDiameter, dryMass, propMass, launchAngle, guidanceMode, etaC, etaN, ... }`.
- Add `UI.updateRocketReadouts(...)` for live telemetry.
- Add `UI.updatePreLaunchReadouts(...)` for pre-launch computed values.
- Propellant dropdown `onchange` → update MR slider min/max/value, update info note.

### Acceptance criteria
- Switching to rocket mode shows all controls with sensible defaults (LOX/RP-1, 90° launch, 100 bar, ε=20).
- Dragging any slider updates pre-launch readouts in real time.
- T/W < 1 warning appears/disappears correctly.
- Switching back to cannon mode restores cannon panel perfectly.

---

## 6) Stage 4 — Launch Tower & Rocket Renderer

**Goal:** Draw the launch tower and rocket on the canvas, replacing the castle cannon when in rocket mode.

### Launch tower design

The launch tower occupies roughly the same screen area as the castle rampart. It consists of:

1. **Launch pad** — A flat concrete/metal platform sitting on the ground surface. Wider than the rampart base. Drawn as a gradient-filled rectangle with bolt details.

2. **Tower structure** — A lattice/truss tower rising from the pad. Height ~3–4 metres in physics space (scales with PPM like the castle). The tower leans at the user's launch angle.
   - Lattice drawn as two vertical rails with diagonal cross-braces.
   - Colour: industrial orange/red or silver-grey.

3. **Launch rail** — A guide rail running along the tower's face at the launch angle. The rocket sits against this rail before launch.

4. **Flame trench** — A dark depression in the pad beneath the rocket's nozzle. Drawn as a dark rectangle/arc below ground level.

### Rocket design

The rocket is a simple but recognisable shape drawn from geometric primitives:

1. **Nose cone** — Pointed tip (triangle or ogive bezier curve). Colour: white or silver.
2. **Body tube** — Rectangle/rounded-rect. White/silver with a coloured band (the propellant colour hint).
3. **Fins** — 2 small triangular fins at the base (one visible from side view).
4. **Nozzle bell** — Trapezoidal shape at the very bottom, opening wider. Dark grey/black. **Shape responds to expansion ratio** (future hook for cutaway graphic — wider ε = wider bell).

The rocket rides the launch rail and detaches at launch. During flight, it follows the trajectory just like the cannonball does — but drawn as a rocket sprite oriented along the velocity vector (prograde).

### Renderer additions

```js
Renderer.drawLaunchTower(angleDeg)          // Tower + pad + rail + flame trench
Renderer.drawRocket(rocketState, angleDeg)  // Rocket on pad or in flight
Renderer.drawExhaust(physX, physY, theta, thrustLevel)  // Flame + smoke plume
Renderer.drawFizzle(physX, physY, progress) // Sputtering failed ignition
```

### Visual constants (in renderer, tunable)

```js
var TOWER_BASE_X_M  = 1.5;   // Same x as cannon base for camera consistency
var TOWER_BASE_Y_M  = 0;     // Sits on the ground
var TOWER_HEIGHT_M  = 4.0;   // Physics-space height
var ROCKET_LENGTH_M = 2.0;   // Scales with zoom
var ROCKET_WIDTH_M  = 0.4;
var NOZZLE_LENGTH_M = 0.3;   // Varies with expansion ratio (visual only)
```

### Acceptance criteria
- In rocket mode, the castle/cannon is replaced by the launch tower + rocket.
- Tower angle visually matches the launch angle slider.
- Rocket sits on the rail pre-launch.
- Characters can still walk around the base area.
- Drawing scales correctly with zoom.

---

## 7) Stage 5 — Rocket Flight Loop & Integration

**Goal:** Wire the rocket physics into the main game loop for a complete launch-to-landing simulation.

### Launch sequence

1. User clicks LAUNCH.
2. **Pre-launch calculation**: compute thrust, T/W.
3. **If T/W ≥ 1**: Rocket lifts off.
   - Play ignition sound (synthesised rumble — deeper and longer than cannon boom).
   - Create exhaust particles at nozzle.
   - Rocket detaches from rail after clearing the tower (simple: after y > tower height).
   - Begin `stepRocket()` loop each frame.
4. **If T/W < 1**: Rocket fizzles (Stage 6).
5. **During flight**:
   - `stepRocket()` each physics tick.
   - Draw rocket oriented along velocity vector.
   - Draw exhaust plume (scaled to thrust level).
   - Trajectory dots, same as cannon mode.
   - Zoom system tracks trajectory, same logic.
   - At propellant exhaustion → engine off, rocket becomes ballistic (like a cannonball, but still drawn as a rocket).
   - At y ≤ 0 → impact. Reuse impact particles / shockwave / character squash.
6. **Post-flight**: Freeze readouts, show landing flag with distance.

### Changes to `main.js`

```js
// In the loop:
if (mode === 'rocket' && activeRocket) {
  activeRocket = RocketPhysics.stepRocket(activeRocket, dt, currentGravity, guidance);
  // ... dot trail, zoom adjust, impact check (same pattern as cannon) ...
}
```

- Add `activeRocket` state variable (parallel to `activeBall`).
- Add `rocketFire()` function (parallel to `fire()`).
- Impact handling shared: `handleLanding()` works for both (it just needs `state.x`).
- Clear range resets both cannon and rocket state.

### Audio

- Ignition sound: low rumble (filtered noise + sine wave at 60–120 Hz, longer envelope ~2s).
- Engine running: optional looping crackle while thrust > 0.
- Burnout: quick pitch-down.

### Acceptance criteria
- Full rocket launch → flight → landing cycle works.
- Characters react to launch and impact.
- Zoom follows the rocket trajectory.
- Trajectory dots draw correctly.
- Landing flag shows distance.
- Cannon mode still works independently.

---

## 8) Stage 6 — Fizzle / Failure & Exhaust Effects

**Goal:** When T/W < 1, the rocket ignites but can't lift off — it sits on the pad sputtering, burning through propellant, and eventually the engine dies. This is a key educational moment.

### Fizzle behaviour

1. Engine ignites → exhaust flames appear at nozzle.
2. Rocket shakes/vibrates on the pad (small random oscillation in draw position).
3. Thrust readout shows thrust < weight in red.
4. Propellant depletes at the computed ṁ rate.
5. When propellant runs out → engine dies, fizzle smoke, sad trombone sound effect.
6. Readout shows: "Fizzle! T/W was X.XX — needed ≥ 1.0 to lift off."

### Exhaust visual

During normal flight and fizzle:

- **Inner flame**: bright yellow-white cone attached to nozzle, oriented opposite to thrust direction.
- **Outer flame**: orange-red cone, wider and longer than inner.
- **Smoke particles**: grey particles spawned at the flame tip, drift and fade (reuse particle system).
- **Flame length**: proportional to thrust level. At fizzle, the flame is there but the rocket doesn't move.
- **Mach diamonds** (optional visual flair): alternating bright nodes in the exhaust plume at high expansion ratios.

### Shake parameters

```js
var shakeAmplitude = 0.02; // metres — subtle pixel jitter
var shakeFrequency = 30;    // Hz
```

### Acceptance criteria
- Setting a very heavy rocket with a tiny nozzle → fizzle on the pad.
- Exhaust flames render during the fizzle.
- Propellant depletes and engine dies.
- Fizzle message is shown.
- Adjusting parameters to get T/W > 1 → successful launch.

---

## 9) Stage 7 — Flight Telemetry & Readouts

**Goal:** Show rich real-time data during rocket flight, matching the educational spirit of the cannon mode's energy display.

### Live readouts during flight

| Label | Value | Notes |
|-------|-------|-------|
| Velocity | XX.X m/s | Magnitude of velocity vector |
| Height | XX.X m | Current y |
| Downrange | XX.X m | Current x − launch x |
| Thrust | XXXX N | Current thrust (0 after burnout) |
| Mass | XX.X kg | Current total mass |
| Propellant | XX.X / YY.Y kg | Remaining / initial |
| Isp | XXX.X s | Current Isp (or — after burnout) |
| T/W | X.XX | Current thrust-to-weight |
| Total Impulse | XXXXX N·s | Accumulated |

### Post-flight summary

| Label | Value |
|-------|-------|
| Range | XX.X m |
| Max Height | XX.X m |
| Flight Time | XX.X s |
| Burn Time | XX.X s |
| Δv (Tsiolkovsky) | XXX m/s |
| Δv (actual, at burnout) | XXX m/s |
| Gravity loss | XX m/s ← (Tsiolkovsky − actual) |

### Propellant gauge bar

Replace the energy bar with a propellant gauge in rocket mode:
- A horizontal bar showing remaining propellant.
- Oxidizer portion and fuel portion shown in different colours (split by MR).
- Depletes in real time during burn.

### Acceptance criteria
- All readouts update at frame rate during flight.
- Post-flight summary appears after landing.
- Propellant gauge is visually clear and responsive.

---

## 10) Stage 8 — Polish & Teach

**Goal:** Educational tooltips, final visual polish, and edge-case handling.

### Tooltips for every rocket parameter

Same `?` trigger system as cannon mode. Each rocket parameter gets a rich tooltip explaining:
- What the parameter is physically.
- How it affects performance.
- Real-world examples.

Key tooltips:
- **Propellant combo**: What each fuel/oxidiser is, trade-offs.
- **Mixture ratio**: Why there's an optimum, what happens off-optimum.
- **Chamber pressure**: Higher = more thrust density, engineering difficulty.
- **Expansion ratio**: Vacuum vs sea-level nozzle, overexpansion.
- **T/W ratio**: Why > 1 is needed to lift off.
- **Isp**: Efficiency metric, what it means in plain language.
- **Δv and gravity loss**: Why actual Δv < Tsiolkovsky.

### Character reactions to rockets

- Characters should be more dramatically startled by rocket launches (longer rumbling).
- On fizzle, character could have a unique reaction (laughing thought bubble?).

### Edge cases

- Switching modes mid-flight: disable mode toggle while a projectile/rocket is active.
- Very short burns: handle dt overshooting propellant depletion (clamp).
- Extreme zoom: very high rockets might need min-PPM lower than cannon mode's default.

### Acceptance criteria
- Every `?` tooltip is present and informative.
- No crashes on edge cases.
- Mode switch disabled during active simulation.

---

## 11) Future — Nozzle Cutaway Graphic

> **Not implemented in this plan, but architecture should accommodate it.**

### Concept

A small inset diagram (or a panel that appears below the engine parameters) showing a **cross-section of the convergent-divergent nozzle**:

```
        ┌──────────────────────┐
        │    Combustion         │
        │    Chamber            │
        │   ┌──────┐           │
        │   │      │ ← throat  │
        │   │      │   (At)    │
        │    \    /             │
        │     \  /  ← divergent│
        │      \/     section  │
        │      /\              │
        │     /  \             │
        │          ← exit      │
        │            (Ae)      │
        └──────────────────────┘
```

- **Throat diameter** controls the narrowest point.
- **Expansion ratio** controls how wide the exit is relative to throat.
- **Chamber pressure** shown as a colour gradient (hotter = brighter).
- Gas flow direction indicated with small arrows.
- Labels for pc, At, Ae, pe.

### Architecture hooks needed now

- The rocket renderer's nozzle bell shape already varies with expansion ratio → this is the visual basis for the cutaway.
- Propellant data includes pe/pc, gamma, Tc → these will drive the cutaway's internal colouring.
- Reserve a `<div id="nozzle-cutaway">` in the rocket panel (hidden, empty) for future use.

---

## 12) File Change Map

### Files modified

| File | Nature of changes |
|------|------------------|
| `index.html` | Rename title, add mode toggle, wrap cannon controls in `.cannon-panel`, add empty `.rocket-panel` div, load new scripts |
| `style.css` | Mode toggle styles, rocket panel styles, launch button (green), propellant gauge bar, T/W warning badge |
| `ui.js` | Mode switching, rocket panel DOM wiring, `getRocketValues()`, `updateRocketReadouts()`, propellant dropdown logic |
| `main.js` | Mode gate in `fire()`, `rocketFire()`, `activeRocket` state, rocket flight in loop, shared landing/zoom/character/particle calls |
| `renderer.js` | `drawLaunchTower()`, `drawRocket()`, `drawExhaust()`, `drawFizzle()`, nozzle bell shape from ε, tower constants |
| `physics.js` | **Untouched** — cannon physics stay exactly as they are |

### New files

| File | Role |
|------|------|
| `rocket_physics.js` | Continuous-thrust flight model, all equations from spec Sections 3–7, 13 |
| `rocket_propellants.js` | Propellant registry (IDs, names, MR bounds, notes), placeholder c*/CF lookup, runtime interpolation stub |

### Script load order (updated `index.html`)

```html
<script src="physics.js"></script>
<script src="rocket_physics.js"></script>
<script src="rocket_propellants.js"></script>
<script src="renderer.js"></script>
<script src="ui.js"></script>
<script src="main.js"></script>
```

---

## 13) Risk & Rollback Notes

### Risk: Cannon mode regression
- **Mitigation:** Cannon-specific code is wrapped in mode checks. No existing functions are modified, only new call sites are added.
- **Test:** After each stage, manually verify cannon mode works identically: fire at 45°/9.81g/500N/5kg → same range, same animation, same everything.

### Risk: Performance (two physics models loaded)
- **Mitigation:** Only one model's `step` function runs per frame. The inactive model adds zero per-frame cost. File size overhead is ~15–20 KB of JS.

### Risk: Propellant data loading
- **Mitigation:** Start with hardcoded placeholder performance values (simple analytic approximation for c* and CF). CEA grid JSON files can be added later as a drop-in upgrade without changing any runtime code — the interpolation interface stays the same.

### Risk: Scope creep
- **Mitigation:** Each stage is independently shippable. Stage 0–1 are purely structural. Stage 2–3 are backend + UI with no rendering. Stages 4–5 complete the minimum viable rocket mode. Stages 6–8 are polish. The nozzle cutaway is explicitly deferred.

---

## Appendix A: Placeholder Propellant Performance Model

Until CEA grids are available, use a simplified analytic model for c* and CF:

### Characteristic velocity (simplified)
```
c* ≈ c*_ref × f(MR)
```
Where `c*_ref` is a per-propellant constant and `f(MR)` is a bell-curve around the optimum MR (parabolic fit from published data).

### Thrust coefficient (simplified, 1D isentropic)
```
CF ≈ sqrt(2γ²/(γ−1) × (2/(γ+1))^((γ+1)/(γ−1)) × (1−(pe/pc)^((γ−1)/γ))) + (pe−pa)/pc × ε
```
With γ_eff and pe/pc estimated from ε via isentropic relations.

### Placeholder values per propellant

| Propellant | c*_ref (m/s) | γ_eff | Optimal MR | Peak Isp class (s) |
|-----------|-------------|-------|-----------|-------------------|
| LOX/LH2 | 2360 | 1.20 | 5.5 | 450 |
| LOX/CH4 | 1860 | 1.18 | 3.5 | 360 |
| LOX/RP-1 | 1790 | 1.22 | 2.6 | 340 |
| N2O4/MMH | 1720 | 1.24 | 2.0 | 310 |
| N2O4/UDMH | 1680 | 1.24 | 1.65 | 300 |
| N2O4/AZ-50 | 1700 | 1.24 | 1.85 | 305 |
| H2O2/RP-1 | 1450 | 1.26 | 7.0 | 270 |
| IRFNA/RP-1 | 1500 | 1.25 | 5.0 | 260 |

These are rough teaching values. They'll be replaced by interpolated CEA data once grids are generated.

---

## Appendix B: Implementation Order Checklist

```
[ ] Stage 0: Rename + mode toggle shell
    [ ] Rename to "Launch Lab" in HTML/CSS
    [ ] Add mode toggle buttons
    [ ] Wrap cannon controls in .cannon-panel
    [ ] Add empty .rocket-panel
    [ ] Mode switching shows/hides panels
    [ ] Cannon mode unaffected

[ ] Stage 1: Refactor shared systems
    [ ] Verify gravity/planet works in both modes
    [ ] Verify characters work when cannon hidden
    [ ] Add mode-gated draw dispatch in main loop
    [ ] Verify zoom handles tall trajectories

[ ] Stage 2: Rocket physics engine
    [ ] Create rocket_physics.js
    [ ] Implement computeMassFlow, computeThrust, computeIsp
    [ ] Implement createRocketState
    [ ] Implement stepRocket (full golden-path algorithm)
    [ ] Implement guidance modes (fixed, pitch program, prograde lock)
    [ ] Implement computeDeltaV
    [ ] Implement fizzle detection (T/W < 1)
    [ ] Sanity-test with hand calculations

[ ] Stage 3: Rocket UI panel
    [ ] Create rocket_propellants.js with registry
    [ ] Add propellant dropdown to HTML
    [ ] Add all rocket sliders to HTML
    [ ] Add guidance mode dropdown
    [ ] Add LAUNCH button (green)
    [ ] Wire propellant dropdown → MR bounds update
    [ ] Wire all sliders → live pre-launch readouts
    [ ] Add T/W warning display
    [ ] Add tooltips for all parameters
    [ ] Add nozzle-cutaway placeholder div

[ ] Stage 4: Launch tower + rocket renderer
    [ ] drawLaunchTower() — pad, lattice, rail
    [ ] drawRocket() — nose, body, fins, nozzle bell
    [ ] Nozzle bell width responds to expansion ratio
    [ ] Rocket sits on rail at launch angle pre-launch
    [ ] In-flight rocket orients along velocity vector
    [ ] Everything scales with zoom/PPM

[ ] Stage 5: Rocket flight loop
    [ ] rocketFire() function in main.js
    [ ] stepRocket in game loop
    [ ] Trajectory dots during flight
    [ ] Zoom follows rocket trajectory
    [ ] Impact detection and landing
    [ ] Landing flags with distance
    [ ] Ignition sound effect
    [ ] Character startle on launch
    [ ] Character squash on landing hit

[ ] Stage 6: Fizzle + exhaust effects
    [ ] drawExhaust() — inner flame, outer flame, smoke
    [ ] Exhaust scales with thrust level
    [ ] Fizzle: rocket shakes on pad
    [ ] Fizzle: propellant depletes, engine dies
    [ ] Fizzle message displayed
    [ ] Fizzle sound effect (sad trombone / sputter)

[ ] Stage 7: Flight telemetry
    [ ] Live readouts during flight (velocity, height, thrust, mass, etc.)
    [ ] Post-flight summary
    [ ] Propellant gauge bar (oxidiser/fuel split)
    [ ] Δv comparison (Tsiolkovsky vs actual)
    [ ] Gravity loss display

[ ] Stage 8: Polish & teach
    [ ] Complete tooltips for all rocket parameters
    [ ] Disable mode toggle during active flight
    [ ] Edge-case handling (dt overshoot, extreme zoom, etc.)
    [ ] Character fizzle reaction
    [ ] Final visual polish pass
```

---

**End of plan.**
