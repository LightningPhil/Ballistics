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
- The character close-up stays at the top right, with 50 bespoke quips for each of the nine worlds, 50 extra lines for custom gravity, and varied reactions to flight events. Each world remembers its shuffled round when you leave and return. Noise jokes require an atmosphere, and missing-ground jokes belong only to worlds without a solid surface.
- Saturn's submarine and Jupiter's whale cruise partly veiled in soft clouds, occasionally surfacing for a clear look. Their relaxed swimming follows real viewing time, independent of flight speed; launch reactions ease them back into the clouds. Their close-ups always stay clear.
- Sound and character remarks have separate switches; silencing remarks leaves the close-up visible. Reduced-motion preferences suppress decorative movement. Hiding the page pauses the flight.
- Saved flights are retained for this browser session, not persisted across reloads.

## Physics and assumptions

The shared solver records a run at a canonical 1/120-second step, with refined event times. Rocket thrust uses logarithmic variable-mass impulse and splits fuel depletion, guidance boundaries and contact. Both modes use spherical, inverse-square gravity and consistent surface-relative energy.

Planet pressure follows an illustrative exponential profile and affects the rocket nozzle; **air resistance is not modelled**. Intermediate gravity settings represent imaginary worlds. Gas giants use a fictional launch platform at the one-bar reference level. Propellant properties are approximate; mixture-ratio changes alter tank proportions, not a chemical-equilibrium performance calculation. The nozzle cutaway illustrates the chosen engine design.

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

- `src/physics.ts`, `src/rocket_physics.ts`, `src/environment.ts`: pure scientific model.
- `src/flight.ts`: immutable settings, canonical recording, event snapshots and replay sampling.
- `src/playback.ts`, `src/flight-deck.ts`: smooth viewing clock, inspection and comparison controls.
- `src/main.ts`: experiment lifecycle and presentation effects.
- `src/renderer.ts`, `src/crew.ts`, `src/aquatic-characters.ts`, `src/planet-guests.ts`, `src/nozzle_render.ts`: scene, illustrated characters and engine cutaway.
- `src/ui.ts`, `index.html`, stylesheets: accessible experiment controls and responsive layout.

## License

This project is proprietary and confidential. All rights reserved. See [LICENSE](LICENSE).
