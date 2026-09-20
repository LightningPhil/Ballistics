# Launch Lab

A playful physics field station. Launch a cannonball or rocket, watch what happens, change one thing and compare the next flight.

## Try it

Use **Node.js 24 or later**.

```sh
npm ci
npm run dev
```

Start with **Let it fly** or the ready-to-fly rocket. Four optional experiment cards offer a target, two different arcs, another world, and a fuel-efficient hop. All controls are available from the start; engine and guidance details live in the workshop sections.

## Watch, inspect, compare

- The analogue chronograph displays **simulation time**. Auto builds and sheds speed smoothly around ignition, burnout, guidance changes, apex and contact. It never runs below **1×**. Manual choices are 1×, 4×, 16× and 64×, with smooth transitions. Pause is a separate inspection action.
- Replay, the time slider and **Next moment** use recorded flight data. Changing viewing speed cannot change the trajectory. Next moment deliberately pauses at an event; Auto does not impose pauses.
- The rocket camera keeps the complete vehicle visible through fast playback, timeline jumps, descent and landing, with clear space around the character close-up and nozzle diagram.
- The previous flight is kept as a ghost. Pin a baseline while trying alternatives. Comparable flights use the same clock and camera; trajectories from different worlds are not overlaid.
- Drag the reference flag or height line, or enter its value. Results show how far from the target the flight finished. The target is a measuring aid, not a collision object.
- Full-path reveal and direction arrows are optional. Arrows distinguish velocity, thrust and gravity; their lengths are not a force/speed scale.
- Twelve selectable worlds are arranged outwards from the Sun, with Earth’s Moon and Jupiter’s Ganymede immediately after their planets. Supplied transparent cartoon artwork appears as lightweight picker icons and larger fact-card illustrations. The fixed-size card compares mass, diameter, solar distance, gravity, day, year/orbit, axial tilt, temperatures, atmosphere and exploration using rounded NASA/JPL values.
- The character close-up stays at the top right, with 50 bespoke quips for each of the nine established speaking worlds, a 50-line general deck for Ganymede and custom gravity, and varied reactions to flight events. Ganymede has a giant squid from beneath its grooved ice; Pluto’s quiet, crystalline ice bear alternates between two-legged and four-legged walks; nothing lives on the Sun. Each speaking world remembers its shuffled round when you leave and return.
- Saturn's submarine and Jupiter's whale cruise partly veiled in soft clouds, occasionally surfacing for a clear look. Their relaxed swimming follows real viewing time, independent of flight speed; launch reactions ease them back into the clouds. Their close-ups always stay clear.
- Sound and character remarks have separate switches; silencing remarks leaves the close-up visible. Reduced-motion preferences suppress decorative movement. Hiding the page pauses the flight.
- Saved flights are retained for this browser session, not persisted across reloads.

## Physics and assumptions

The shared solver records a run at a canonical 1/120-second step, with refined event times. Sparse replays are re-evaluated with that solver instead of linearly inventing states between samples; very short cannon flights are re-sampled to retain at least 20 plotted path points. Rocket thrust uses logarithmic variable-mass impulse and splits fuel depletion, guidance boundaries and contact. Both modes use spherical, inverse-square gravity and consistent surface-relative energy.

This is a deliberately simplified universe: worlds are spherical and non-rotating, vehicles are point masses with a prescribed thrust direction, and the reference surface has no terrain. Pressure follows an illustrative exponential profile and affects the rocket nozzle; **air resistance and wind are not modelled**. Intermediate gravity settings represent imaginary worlds. Gas giants use a fictional launch platform at the one-bar reference level; the Sun preset uses an equally fictional platform at its photosphere.

The nozzle uses ideal choked-flow equations plus a conservative Summerfield flow-separation approximation. A chamber pressure too low to choke the throat is treated as engine-off. Propellant properties remain illustrative single-point calibrations; mixture-ratio changes alter tank proportions, not a chemical-equilibrium performance calculation. Engine, tank and structural mass do not scale with the chosen hardware. The nozzle cutaway illustrates the chosen design and labels separated or unchoked operation.

A failed ignition shuts down immediately if outward thrust cannot exceed weight. Burning fuel on the pad until later lift-off is not simulated. An orbit must clear the planet; escape must be unpowered and outgoing. Such flights end after a short observation interval. Other runs are bounded at six simulated hours and report an observation limit honestly.

## Validate and build

```sh
npm test
npm run check
npm run build
npm run preview
```

Tests cover analytical rocket impulse, timestep convergence, exact fuel depletion, radial energy, impact and guidance events, environment parity, orbit/escape classification, recorded replay, cancellation, smooth time changes and renderer geometry. CI runs the tests and both builds on Node 24.

The build creates the web bundle in `dist/` and a portable, self-contained `dist-single/index.html`. The latter is committed and regenerated with source changes; CI also uploads a freshly built copy. Vite uses its native config loader, supported by Node 24.

## Source map

- `src/physics.ts`, `src/rocket_physics.ts`, `src/rocket_propellants.ts`, `src/environment.ts`: pure scientific model — cannon ballistics, variable-mass rocket solver, illustrative propellant/nozzle performance, planet data and orbit classification. No DOM access; fully covered by the Node tests.
- `src/flight.ts`: immutable settings, canonical recording, event snapshots and replay sampling.
- `src/playback.ts`, `src/flight-deck.ts`: smooth viewing clock, inspection and comparison controls.
- `src/camera.ts`: pure framing maths for the cannon setup zoom and the rocket follow camera.
- `src/main.ts`: experiment lifecycle (record → replay → inspect), presentation effects, character state machine and synthesised sound.
- `src/renderer.ts`, `src/crew.ts`, `src/aquatic-characters.ts`, `src/planet-guests.ts`, `src/cloud-guests.ts`, `src/nozzle_render.ts`: scene and camera, illustrated characters, cloud-guest motion and the engine cutaway.
- `src/character-remarks.ts`, `src/remarks/`: the quip pools and shuffled-round selection for every world and flight event.
- `src/ui.ts`, `src/world-art.ts`, `index.html`, stylesheets: accessible experiment controls, optimised world artwork and responsive layout.

Conventions: `strict` is off in `tsconfig.json` because the older presentation modules are loosely typed, but `noUnusedLocals` is on so dead code fails the build. Modules that touch the DOM or canvas export a single namespace object (`Renderer`, `UI`, `NozzleRender`); the model modules export plain functions.

## Documents

`docs/` keeps the design history. Only the first is a current specification; the rest are implemented plans kept for their rationale and each carries a status note at the top.

- `docs/rocket_lab_single_source_of_truth.md` — rocket mechanics reference and the planned CEA propellant-grid schema.
- `docs/nozzle_parametric_geometry_spec.md`, `docs/nozzle.md` — nozzle cutaway design and plan.
- `docs/roundplanets.md`, `docs/rocket_plan.md`, `docs/planet_characters_plan.md`, `docs/characters.md` — historical plans for spherical planets, rocket mode and the characters.

## License

This project is proprietary and confidential. All rights reserved. See [LICENSE](LICENSE).
