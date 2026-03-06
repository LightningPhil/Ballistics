# Round Planets — Feasibility Analysis

## The Vision

Replace the current flat ground with actual spherical (circular, in 2D) planets.
Gravity points at the centre of mass. Long cannon shots show gentle curvature;
rockets see dramatic curvature, eventually the whole planet. Moons and rings orbit
the planet on visible timescales.

---

## Difficulty Rating: **Medium-Hard** (but very doable in phases)

It's not a weekend job, but it's not a rewrite either. The physics changes are
straightforward. The hard part is the renderer — specifically, drawing a curved
ground that looks good at every zoom level, from "standing on the surface" all the
way out to "whole planet in view." The good news is that the existing code is
cleanly separated into physics → main-loop → renderer, so changes in one don't
ripple uncontrollably into the others.

---

## What Currently Assumes Flat Earth

### Physics (`physics.ts`)
- Gravity is a scalar applied as constant `−y` acceleration.
- Projectile stepping: `vy -= g * dt`, `y += vy * dt`.
- Trajectory prediction is analytic parabola (`0.5 g t²`).
- Energy: `PE = m g max(y, 0)`.
- Landing: `y ≤ 0`.

### Rocket Physics (`rocket_physics.ts`)
- Same `−y` gravity: `ay = thrust_y/mass − gravity`.
- Semi-implicit Euler in Cartesian x/y.
- Landing: `y ≤ 0 && vy < 0`.
- Guidance angles measured from flat horizontal (`+x`).
- Guidance clamp: `angle ≥ 0°` (never thrust "below horizontal") — only makes
  sense on a flat world.

### Renderer (`renderer.ts`)
- `groundY` is a single horizontal pixel coordinate — the entire ground is a
  flat strip.
- `toCanvasY(py) = groundY − py × ppm` — linear, no curvature.
- Every surface-anchored prop (mound, craters, flags, landed balls, trees,
  mountains) is placed relative to `groundY`.
- Sky is a vertical gradient above `groundY`.

### Main Loop (`main.ts`)
- Landing checks: `activeBall.y <= 0`, `activeRocket.y <= 0`.
- Off-screen checks: compare `x` against canvas width — no notion of "behind
  the planet."
- Camera: purely translational panning + zoom.

---

## What Needs to Change (and How)

### Phase 1 — Spherical Physics (Flat Renderer)

**Goal:** Physics is correct, but the renderer still "flattens" the view near
the launch site. Short shots look identical to today; long shots show trajectories
that curve slightly because gravity was pulling toward centre, not straight down.

1. **Add radius to planet data.** Each planet entry gains a `radius` field (metres):

   | Body | Radius (km) | Surface g |
   |------|-------------|-----------|
   | Moon | 1,737 | 1.62 |
   | Mercury | 2,440 | 3.70 |
   | Mars | 3,390 | 3.72 |
   | Venus | 6,052 | 8.87 |
   | Earth | 6,371 | 9.81 |
   | Uranus | 25,362 | 8.69 |
   | Neptune | 24,622 | 11.15 |
   | Saturn | 58,232 | 10.44 |
   | Jupiter | 69,911 | 24.79 |

   Gravity parameter `μ = g × R²` replaces the scalar `g`.

2. **Position becomes (x, y) relative to planet centre**, where the planet
   centre is at `(0, −R)` in the current coord system (so the launch site
   is still near `(0, 0)` for backwards compatibility). Alternatively, use
   full polar or keep Cartesian with origin at planet centre — either works.

3. **Gravity vector:** `a⃗ = −μ r̂ / |r|²` where `r⃗` = position from planet
   centre. Near the surface this is almost identical to constant `−y`, but at
   altitude or at large range it curves.

4. **Stepping:** Replace `vy -= g*dt` with the vector form. Both physics.ts
   and rocket_physics.ts need this. The integrator stays semi-implicit Euler
   (adequate for visual sim, not mission-critical).

5. **Landing:** `|r⃗| ≤ R` instead of `y ≤ 0`. Surface normal at impact is
   `r̂` — useful later for rendering.

6. **Trajectory prediction:** Cannon analytic parabola becomes invalid for
   long shots. Switch to a numeric integrator (same `stepProjectile` in a
   fast loop, like rocket predictor already does). Parabola can be kept as a
   fast-path when predicted range < 1% of planet circumference.

7. **Energy:** `PE = −μ m / |r|` (gravitational potential). Or keep
   `m g h` as an approximation at small altitudes and switch formulation
   at high zoom-out.

8. **Guidance:** Replace `angle ≥ 0` clamp with "angle relative to local
   horizontal at current position" — local horizontal is perpendicular to
   `r̂`.

**Effort:** ~1–2 sessions. Physics files are self-contained. The renderer
doesn't need to change yet — the main loop can keep mapping "distance along
surface" → x and "altitude above surface" → y into the existing flat renderer.
Trajectories will be subtly more realistic and long-range cannon shots will
curve back down slightly earlier than before.

---

### Phase 2 — Curved Ground Rendering

**Goal:** When zoomed out enough, the ground visibly curves. At extreme
zoom-out (whole-planet view for rockets), you see a circle.

1. **Adaptive ground curvature.** At close zoom (PPM > ~10), ground is
   effectively flat — current drawing code works fine. Below a threshold PPM,
   the renderer draws the ground as an arc of a circle with radius `R × ppm`.

   The transition can be smooth: compute the "sagitta" (height of the arc
   across the viewport width). If sagitta < 2px, draw flat. If sagitta > 2px,
   draw arc. This naturally kicks in for long cannon shots and is always active
   for rockets at altitude.

2. **Coordinate transform.** Replace `toCanvasX/toCanvasY` with a function
   that maps `(θ, altitude)` → screen `(x, y)` where `θ` is angular position
   around the planet. Near the launch site with small θ, this converges to the
   current linear mapping.

3. **Surface props (craters, flags, trees, mountains):** Each has a θ
   position. At close zoom plot them at the current `groundY` with an x
   offset. At far zoom, place them on the arc. The mound is always at the
   launch-site θ.

4. **Sky / atmosphere:** At close zoom, exactly as now. At whole-planet zoom,
   the sky becomes the void of space and the atmosphere is a thin coloured
   band around the planet disc. A radial gradient from planet surface outward
   works well.

5. **Subsurface layers.** Currently drawn as flat bands under `groundY`. On a
   round planet, these become concentric rings (annuli) — easy with
   `ctx.arc()`.

**Effort:** ~2–3 sessions. This is the hardest part because it touches the
most code (every `drawFoo` function). The key insight is to implement ONE
`worldToScreen(θ, alt)` function and route everything through it — rather than
patching every draw call individually.

---

### Phase 3 — Orbiting Celestial Bodies

**Goal:** Moons, rings, and other bodies orbit the planet visually.

Current celestial bodies (`celestialBodies` array) are purely decorative
screen-space animations. For round planets, we want them to orbit the rendered
planet circle.

1. **Orbit data.** Each body gets: `orbitRadius` (metres), `displayPeriod`
   (seconds — deliberately short, maybe 60–180s so they're visible during a
   flight), `phase`, `inclinationAngle`.

2. **Screen position.** Given `worldTime`, compute angular position around
   the planet centre, then project to screen coordinates using the same
   camera transform as the planet itself.

3. **At close zoom** these bodies are far away and appear as sky objects
   crossing overhead — similar to current behavior but now their position
   is physically consistent with the planet's geometry.

4. **At whole-planet zoom** they visibly orbit — small dots or discs circling
   the planet. Rings (Saturn) become actual ellipses around the planet disc.

5. **Orbit speeds.** Real orbital periods are hours to days. For visual
   appeal, compress to 60–180 seconds so a moon visibly traverses the sky
   during a rocket flight. A comment explains the artistic license.

**Effort:** ~1 session. The current decorative system already has most of
the data; it just needs the position calculation changed from "screen-fraction
animation" to "angular orbit projected through camera."

---

### Phase 4 — Camera for Whole-Planet View

**Goal:** Rocket flights can zoom out to show the entire planet, trajectory
curving around it, with smooth zoom from ground-level to orbital view.

1. **Zoom levels.** `PPM` already goes from 80 (ground-level) down to 0.01.
   At approximately `PPM = canvasWidth / (2.5 × R)`, the whole planet fits
   on screen. For the Moon (R=1,737km) on a 1200px canvas that's ~0.00035
   PPM — well within existing MIN_PPM.

2. **Camera centre.** At close zoom, camera tracks the projectile (current
   behavior). At far zoom, camera locks onto the planet centre so the whole
   sphere stays centered and the trajectory arc is visible.

3. **Transition.** Smoothly blend between "follow projectile" and "show planet"
   as zoom level crosses a threshold. Logarithmic zoom interpolation (already
   implemented) will make this buttery smooth.

4. **Trajectory visualisation.** Dotted trail wraps around the planet arc
   beautifully at whole-planet view. Landed markers appear on the surface at
   their θ positions.

**Effort:** ~1 session, mainly tuning transitions and thresholds.

---

## Suggested Implementation Order

```
Phase 1  →  Phase 2  →  Phase 3  →  Phase 4
physics     renderer     orbits     camera
(1–2 days)  (2–3 days)  (1 day)    (1 day)
```

Phase 1 can ship standalone — physics becomes more correct and long cannon
shots subtly curve, but visually everything looks the same at normal zoom.

Phase 2 is the big visual payoff and can be done incrementally:
- First just draw a curved ground-line at low PPM.
- Then move surface props onto the arc.
- Then handle sky/atmosphere transition.

Phase 3 and 4 are the cherry on top and relatively quick once Phase 2's
coordinate transform exists.

---

## Risks & Gotchas

| Risk | Mitigation |
|------|-----------|
| **Performance at extreme zoom-out** — drawing a huge planet circle with surface detail | LOD system: skip trees/craters/surface texture below a PPM threshold; just render a coloured disc |
| **Numeric precision** — planet radii are millions of metres, positions near surface need sub-meter precision | Use altitude-from-surface internally (double precision is fine for 2D canvas sim, we're not doing orbital mechanics at 1cm precision) |
| **Cannon mode looks weird if ground curves visibly** | The curvature threshold ensures ground stays visually flat until zoom is far enough out that curvature is natural-looking |
| **Gravity interpolation between planets breaks** | Currently gravity slider blends visuals between planets. For physics, snap to nearest planet's radius when computing μ, don't interpolate radii |
| **Gas giants have no "surface"** | Already handled — `isGas:true` planets draw a turbulent cloud layer. At round-planet scale, this becomes a fuzzy disc edge instead of a hard circle, which actually looks great |

---

## What Stays the Same

- Planet colour/visual data and interpolation system
- Parallax layering (works at any zoom — layers just need to reference the new
  coordinate transform)
- Cannon mechanics, barrel animation, muzzle flash, recoil
- Rocket engine physics (thrust, mass flow, Isp) — only gravity direction changes
- UI panels, sliders, readouts
- Audio system
- Character system (just needs surface-normal anchoring)

---

## Summary

| Aspect | Difficulty | Notes |
|--------|-----------|-------|
| Radial gravity physics | Easy | Vector gravity, |r| ≤ R landing |
| Numeric trajectory prediction | Easy | Already done for rockets, extend to cannon |
| Curved ground rendering | Medium | One good `worldToScreen()` function |
| Surface props on curved ground | Medium | θ-position + surface normal |
| Whole-planet zoom-out | Easy-Medium | Camera logic + LOD |
| Orbiting moons/rings | Easy | Angular orbit calc |
| **Overall** | **Medium-Hard** | **~5–7 sessions, shippable in phases** |

The architecture is well-suited to this change. The clean separation between
physics, renderer, and main loop means each phase can be built and tested
independently. The biggest single piece of work is the renderer's transition
from flat ground to curved ground, but even that can be done incrementally
with a PPM-based curvature threshold.
