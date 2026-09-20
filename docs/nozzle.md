# Nozzle Cutaway Graphic — Implementation Plan

> **Status:** Implemented in `src/nozzle_render.ts` (ES module, not the
> `window.NozzleRender` IIFE described below). Historical plan; the inset now
> sits beneath the character close-up rather than at the very top-right, and
> the flow-regime labels (separated / unchoked) come from
> `RocketPropellants.lookupPerformance`.
>
> **Goal:** A live, parametric, cross-section diagram of the engine drawn on
> the main canvas in the **top-right corner** of the simulation pane (right
> pane). Every slider change instantly reshapes the geometry, teaching the
> user how propellant choice, chamber pressure, throat area, expansion ratio,
> and mixture ratio determine nozzle geometry and flow behaviour.
>
> Based on: `nozzle_parametric_geometry_spec.md`

---

## 0. Guiding Principles

| Principle | Detail |
|-----------|--------|
| **Canvas overlay** | Draw directly on the main `<canvas id="sim-canvas">` in screen-space (pixel coords, not physics metres). No extra DOM element or second canvas needed. |
| **Top-right inset** | Positioned with a configurable margin (e.g. 20 px) from top-right of the canvas. Sized to ~280×180 px (scales with canvas height). |
| **Rocket-mode only** | Only drawn when `currentMode === 'rocket'`. Hidden in cannon mode. |
| **Every frame** | Re-drawn each `loop()` tick so it reacts instantly to slider drags. |
| **Self-contained** | New file `nozzle_render.js` (IIFE, `window.NozzleRender` namespace). Zero DOM access. Receives a canvas 2D context + data object and draws. |
| **Semi-transparent backdrop** | A rounded-rect panel with 70% opacity dark background so it doesn't fight the simulation scene behind it. |

---

## 1. New File: `nozzle_render.js`

### 1.1 Responsibility

All Canvas 2D drawing for the nozzle cutaway inset. Pure rendering — takes
data in, draws pixels out, no side-effects.

### 1.2 Namespace Exports

```
window.NozzleRender = {
  draw: draw   // (ctx, canvasW, canvasH, nozzleData) → void
};
```

### 1.3 Input Data Object (`nozzleData`)

Built by the caller (main.js) every frame from `UI.getRocketValues()` +
`RocketPhysics.computePreLaunch()` + `RocketPropellants.getById()`:

```js
{
  // Geometry inputs
  throatDia_mm:  50,      // slider value
  epsilon:       20,      // expansion ratio Ae/At
  Pc_bar:        100,     // chamber pressure (bar)
  MR:            2.56,    // mixture ratio O/F

  // Derived (from computePreLaunch)
  At:            0.00196, // throat area m²
  mdot:          12.5,    // mass flow kg/s
  thrust:        25000,   // N
  Isp:           310,     // s
  cStar:         1750,    // m/s
  Cf:            1.8,     // thrust coefficient

  // Propellant properties
  gamma:         1.18,    // ratio of specific heats
  Tc_K:          3600,    // chamber temperature K

  // Ambient
  Pa_Pa:         101325,  // ambient pressure
  Pc_Pa:         10000000 // chamber pressure in Pa
}
```

### 1.4 Load Order

```html
<!-- in index.html, after rocket_propellants.js, before renderer.js -->
<script src="nozzle_render.js"></script>
```

This keeps it independent but available before the render loop runs.

---

## 2. Geometry Layout (Screen-Space)

The cutaway is drawn **left-to-right** inside a bounding box:

```
┌──────────────────────────────────────────────────────┐
│ FEED     │ COMBUSTION   │ CONV │ THROAT │  DIVERGE   │
│ PIPES    │ CHAMBER      │      │        │  (BELL)    │
│  ox ───▷ │█████████████ │  ╲   │ ║      │  ╱         │
│  fu ───▷ │█████████████ │   ╲  │ ║      │ ╱          │
│          │█████████████ │    ╲ │ ║      │╱           │
│          │              │     ╲│        │            │
│          │              │     ╱│        │╲           │
│  fu ───▷ │█████████████ │    ╱ │ ║      │ ╲          │
│  ox ───▷ │█████████████ │   ╱  │ ║      │  ╲         │
│          │█████████████ │  ╱   │ ║      │   ╲        │
└──────────────────────────────────────────────────────┘
                     centre-line (axis of symmetry)
```

### 2.1 Bounding Box

```
INSET_MARGIN_X  = 20 px from right edge
INSET_MARGIN_Y  = 20 px from top edge
INSET_W         = min(300, canvasW * 0.28)
INSET_H         = min(200, canvasH * 0.22)
```

Corners rounded 8 px, filled `rgba(15, 15, 25, 0.72)`, 1 px bright border
(`rgba(255,255,255,0.15)`).

### 2.2 Region Widths (fractions of INSET_W)

| Region | Fraction of usable width | Notes |
|--------|--------------------------|-------|
| Feed pipes | 0.14 | Fixed proportion |
| Chamber | 0.22 | Grows slightly with L* |
| Converging | 0.12 | Grows with contraction ratio |
| Throat | 0.04 | Always narrow band |
| Diverging | 0.38 | Grows with √ε |
| Right pad | 0.10 | Space for exit plume hint |

The diverging section length scales as:

```
divFrac = 0.28 + 0.10 * clamp((√ε − 1) / 12, 0, 1)
```

Other regions compress slightly to accommodate.

### 2.3 Vertical Scaling (Half-Heights)

All radii are normalised to fit within half the inset height, with the
**throat** as the narrowest point.

```
throatHalfH  = INSET_H * 0.06               // minimum visual throat
chamberHalfH = throatHalfH * clamp(CR, 2, 8) // contraction ratio
exitHalfH    = throatHalfH * √ε              // expansion ratio
```

Where contraction ratio `CR` is fixed at 4 (typical) or derived from
`Ac/At` if we want to couple it to L*.

All values are clamped so nothing overflows the inset.

---

## 3. Drawing Each Region

### 3.1 Feed Pipes (Spec §3)

Two pairs of small horizontal lines (oxidiser on top, fuel on bottom)
entering the chamber from the left.

```
Pipe half-height:
  oxH = basePipeH * √( MR / (1 + MR) )     // ox fraction of total ṁ
  fuH = basePipeH * √( 1 / (1 + MR) )       // fuel fraction
```

- Pipe colour: oxidiser = `#66aaff` (pale blue), fuel = `#ffaa44` (orange)
  — matches the propellant gauge bar colour scheme
- Small **valve chevron** (two angled lines forming a ▷ shape) at the
  right end of each pipe, whose opening angle widens with ṁ

### 3.2 Combustion Chamber (Spec §4)

Rectangular region, full `chamberHalfH` height.

#### Fill Colour (pressure mapping)

```
t = clamp((Pc_bar − 10) / 290, 0, 1)

Low  (t≈0):  dark red    rgb(120, 30, 10)
Mid  (t≈0.5): orange     rgb(220, 140, 30)
High (t≈1):  white-yellow rgb(255, 245, 200)
```

Linear RGB interpolation through 3 colour stops.

#### Chamber Length Coupling (Spec §4.1)

The chamber width fraction adjusts slightly with At:

```
chamberFrac = 0.20 + 0.04 * clamp(At / 0.005, 0, 1)
```

This gives a visually subtle L*-like coupling: bigger throat → bigger
chamber.

### 3.3 Converging Section (Spec §5)

A smooth taper from `chamberHalfH` down to `throatHalfH`.

Drawn as two cubic Bézier curves (top and bottom), producing a gentle
concave contour:

```
topBezier:  (xChamberEnd, -chamberHalfH) → (xThroat, -throatHalfH)
botBezier:  (xChamberEnd, +chamberHalfH) → (xThroat, +throatHalfH)
```

Control points bias the curve towards the chamber side so the contour
accelerates towards the throat (physically correct).

Fill with a gradient transitioning from chamber colour to throat colour
(neutral gray `#888`).

### 3.4 Throat (Spec §6)

A thin vertical band at the narrowest point.

- Drawn as two short vertical lines at `throatHalfH`
- A subtle **glow ring** (radial gradient, yellow-white, low alpha)
  indicates the sonic condition — this is the "choke point" visual cue

```
Throat glow opacity = clamp(mdot / 50, 0.1, 0.5)  // brighter at high flow
```

### 3.5 Diverging Section — Expansion Bell (Spec §7)

A flaring bell from `throatHalfH` to `exitHalfH`.

Drawn as two quadratic Bézier curves (top and bottom) with an 80% bell
contour approximation:

```
topBezier:  (xThroat, -throatHalfH) → (xExit, -exitHalfH)
botBezier:  (xThroat, +throatHalfH) → (xExit, +exitHalfH)
```

Control point at ~40% of the bell length, positioned to give a gentle
parabolic flare (Rao-style approximation).

Fill with a gradient from gray (#888 at throat) to dark blue-gray (#445 at
exit), suggesting supersonic expansion cooling.

### 3.6 Exit Plume Hint (Spec §8)

A subtle transparent triangular plume extending rightward from the exit
plane.

```
plumeLen  = exitHalfH * 0.6                   // short hint, not a full exhaust
plumeHalfW = exitHalfH * (1 + 0.1 * √ε)
```

Gradient from `rgba(255,200,100,0.25)` at exit to fully transparent.

If **over-expanded** (`Pe < Pa`), plume narrows (shock pinch):
```
if (Pe < Pa) plumeHalfW *= 0.6;  // pinched plume
```

If **under-expanded** (`Pe > Pa`), plume widens:
```
if (Pe > Pa) plumeHalfW *= 1.3;  // wide plume
```

---

## 4. Internal Flow Streamlines (Spec §9)

Animated horizontal streamlines inside the nozzle from chamber to exit.

### 4.1 Line Count

```
numLines = 3 + Math.floor(clamp(mdot / 10, 0, 5))   // 3–8 lines
```

Lines are evenly spaced vertically within the flow cross-section, converging
through the throat and diverging at the exit.

### 4.2 Y-Position per Line

At any x-station, the available flow half-height `h(x)` is:
- `chamberHalfH` in the chamber
- Interpolated through the convergent section
- `throatHalfH` at the throat
- Interpolated through the divergent section

Each streamline `i` of `N` sits at:

```
y_i(x) = h(x) * (2*i/(N-1) - 1) * 0.85    // 85% fill to leave wall margin
```

### 4.3 Mach Colour Mapping

Colour transitions along x:

| Station | Mach Approximation | Colour |
|---------|-------------------|--------|
| Chamber | ~0 (stagnation) | `#ff4444` (red) |
| Mid-convergent | ~0.5 | `#ff8844` (orange) |
| Throat | 1.0 (sonic) | `#ffdd44` (yellow) |
| Mid-divergent | ~2–4 | `#44aaff` (blue) |
| Exit | Me (from ε) | `#2266dd` (deep blue) |

Implemented as a colour-stop lookup along normalised x-position within the
nozzle (chamber→exit = 0→1).

### 4.4 Animation

Streamlines have small "particle dots" that translate rightward:

```
dotX = (worldTime * FLOW_SPEED + linePhaseOffset) % totalNozzleLen
```

`FLOW_SPEED` varies with Mach — faster in diverging section.

Each streamline draws 2–3 dots (small circles, r=1.5 px, full colour)
sliding along the path. This gives the impression of flow accelerating
through the throat.

---

## 5. Annotations & Labels

### 5.1 Region Labels (small, subtle)

Tiny text labels above/below the inset (or inside with low alpha):

```
"Chamber"  "Throat"  "Bell"
```

Font: 9 px sans-serif, rgba(255,255,255,0.35). Positioned at the centre of
each region.

### 5.2 Key Dimension Callouts

Two dimension lines with arrows, drawn only if there's space:

1. **Throat diameter**: small vertical dimension line at the throat
   with label `"dt = XX mm"`
2. **Exit diameter**: vertical dimension line at the exit
   with label `"de = XX mm"` (computed as `dt × √ε`)

Font: 8 px, `rgba(200,200,255,0.5)`.

### 5.3 Title

Top-left of inset: **"Engine Cutaway"** in 10 px, `rgba(255,255,255,0.5)`.

---

## 6. Expansion State Indicator (Over/Under)

Below the exit plane, a small text label:

```
Pe > Pa → "under-expanded" (orange)
Pe ≈ Pa → "optimally expanded" (green)
Pe < Pa → "over-expanded" (red)
```

Computed from:
```js
var Me = RocketPropellants._exitMachFromEpsilon(gamma, epsilon);
var pe_pc = RocketPropellants._exitPressureRatio(gamma, Me);
var Pe = pe_pc * Pc_Pa;
var ratio = Pe / Pa_Pa;
```

Threshold: `|ratio − 1| < 0.05` → optimal.

---

## 7. Implementation Stages

### Stage N-1: Scaffold & Backdrop

**Files touched:** `nozzle_render.js` (new), `index.html`, `main.js`

1. Create `nozzle_render.js` with the IIFE skeleton and `draw()` stub.
2. Add `<script src="nozzle_render.js">` to `index.html` after
   `rocket_propellants.js` and before `renderer.js`.
3. In `main.js` render section (rocket branch, after other drawing), build
   the `nozzleData` object and call `NozzleRender.draw(ctx, W, H, data)`.
4. Implement the dark rounded-rect backdrop + "Engine Cutaway" title.

**Acceptance:** A translucent rounded box appears top-right in rocket mode,
disappears in cannon mode.

### Stage N-2: Static Geometry — Chamber, Throat, Bell

**Files touched:** `nozzle_render.js`

1. Draw the combustion chamber rectangle with pressure-mapped fill colour.
2. Draw the converging Bézier taper.
3. Draw the throat band with glow ring.
4. Draw the diverging Bézier bell.
5. Verify that changing `epsilon`, `Pc_bar`, `throatDia_mm` sliders visibly
   reshapes the geometry in real time.

**Acceptance:** Moving the expansion ratio slider makes the bell wider/longer.
Changing chamber pressure changes the chamber fill colour.

### Stage N-3: Feed Pipes, Valves & Exit Plume

**Files touched:** `nozzle_render.js`

1. Draw oxidiser + fuel feed pipes with MR-responsive thicknesses.
2. Draw valve chevrons at pipe ends (aperture ∝ ṁ).
3. Draw the exit plume hint (triangular gradient) with over/under-expansion
   width adjustment.
4. Add the expansion state label below exit plane.

**Acceptance:** Changing mixture ratio visibly changes pipe thickness balance.
Changing expansion ratio or ambient pressure changes plume width and the
over/under label.

### Stage N-4: Streamlines & Animation

**Files touched:** `nozzle_render.js`, `main.js` (pass `worldTime`)

1. Pass `worldTime` (renderer's animation clock) into `nozzleData`.
2. Compute streamline paths (y-position varying with x through the nozzle).
3. Draw coloured streamlines with Mach colour gradient (red → yellow → blue).
4. Animate 2–3 particle dots sliding along each streamline.
5. Scale line count with mass flow rate.

**Acceptance:** Animated dots flow from chamber through throat to exit.
Colour shifts from red to yellow at throat to blue in the bell. Higher mass
flow = more streamlines.

### Stage N-5: Annotations & Polish

**Files touched:** `nozzle_render.js`, `style.css` (minor)

1. Add region labels ("Chamber", "Throat", "Bell").
2. Add throat & exit diameter dimension callouts.
3. Fine-tune all colours, line widths, alpha values for readability.
4. Ensure the inset scales gracefully on small viewports (hide labels below
   a size threshold, shrink inset proportionally).
5. Test with all 8 propellants, extreme slider values, rapid slider dragging.

**Acceptance:** Clean, polished mini-diagram that is informative without being
cluttered. Scales down gracefully. No visual glitches at extreme values.

---

## 8. Data Flow Diagram

```
  Slider change
       │
       ▼
  UI.getRocketValues()  ──→  { Pc_bar, epsilon, throatDia_mm, MR, propellantId, etaC, etaN, Pa_Pa }
       │
       ▼
  RocketPhysics.computePreLaunch(vals, gravity)  ──→  { At, mdot, thrust, Isp, cStar, Cf, Pc_Pa }
       │
       ▼
  RocketPropellants.getById(id).placeholder  ──→  { gamma, Tc_K }
       │
       ▼
  Build nozzleData = { ...vals, ...prelaunch, gamma, Tc_K }
       │
       ▼
  NozzleRender.draw(ctx, canvasW, canvasH, nozzleData)
       │
       ▼
  Canvas pixels (top-right inset)
```

This runs every frame inside `loop()`, so the diagram is always in sync.

To avoid recomputing `computePreLaunch` twice, main.js should cache the
pre-launch result when it's computed for the readouts and pass the same
object to the nozzle renderer.

---

## 9. Key Equations Reference

All from the spec, implemented in `nozzle_render.js` purely for geometry
scaling (not physics simulation):

| Quantity | Formula | Used For |
|----------|---------|----------|
| Throat radius | `r_t = √(At / π)` | Throat half-height scaling |
| Exit radius | `r_e = r_t × √ε` | Exit half-height scaling |
| Bell length | `L_e ∝ r_t × (√ε − 1)` | Diverging section width |
| Ox pipe half-h | `∝ √(MR / (1+MR))` | Oxidiser pipe thickness |
| Fuel pipe half-h | `∝ √(1 / (1+MR))` | Fuel pipe thickness |
| Chamber colour | `lerp3(darkRed, orange, whiteYellow, Pc_bar)` | Chamber fill |
| Streamline count | `3 + floor(mdot/10)` | Flow density |
| Exit Mach | `solved from ε` | Mach colour position |
| Exit pressure | `Pe = Pc × (pe/pc ratio)` | Over/under-expansion |

---

## 10. Files Modified Summary

| File | Change |
|------|--------|
| **`nozzle_render.js`** | **NEW** — All nozzle cutaway drawing code |
| `index.html` | Add `<script src="nozzle_render.js">` after `rocket_propellants.js` |
| `main.js` | Build `nozzleData`, call `NozzleRender.draw()` in render loop |
| `style.css` | Remove the old `#nozzle-cutaway { display: none }` placeholder (no longer needed — we draw on canvas) |

No changes to `renderer.js`, `ui.js`, `physics.js`, `rocket_physics.js`, or
`rocket_propellants.js`.

---

## 11. Performance Notes

- All drawing uses basic Canvas 2D primitives (fillRect, bezierCurveTo,
  arc, linearGradient). No images or heavy computation.
- Streamline animation uses `worldTime` modulo, not particle arrays.
- The inset is ~300×200 px — negligible vs the full canvas.
- `computePreLaunch()` is already called every slider change for readouts;
  we reuse its output (no extra cost).

---

## 12. Future Extensions

These are **not** part of this plan but could be added later:

- **Click to expand**: tap the inset to show a full-screen overlay with
  more detail and numeric annotations
- **Injector face detail**: show spray patterns on the chamber injector wall
- **Thermal gradient**: colour the nozzle walls with a temperature gradient
- **Film cooling band**: show a fuel-rich layer near the wall in the throat
- **Interactive highlight**: hover over a region to see its tooltip on the
  main tooltip system
