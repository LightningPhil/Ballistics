# Launch Lab

A playful physics field station. Launch a cannonball or rocket, watch what happens, change one thing and compare the next flight.

Designed primarily for education on tablets, laptops and desktops. Phone-specific refinements are a later priority.

## Try it

Use **Node.js 24 or later**.

```sh
npm ci
npm run dev
```

Start with **Let it fly** or the ready-to-fly rocket. Both tabs put open flight measurements directly after their launch settings. Rocket engine estimates, workshop controls and guidance follow below. Camera framing is automatic.

## Watch, inspect, compare

- The analogue chronograph displays **simulation time**. Auto uses the complete recording to finish an uninterrupted flight in at most **20 viewing seconds**. Flights of 20 seconds or less stay at **1×**; longer flights start at a suitable speed, build gently, ease slightly near the apex and keep cruising through impact. The speed varies by at most 25%, and Auto can exceed 64× for very long recordings. Manual choices are exactly 1×, 4×, 16× and 64×, taking effect immediately. Pause is a separate inspection action.
- Replay, the time slider and **Next moment** use recorded flight data. Changing viewing speed cannot change the trajectory. Next moment deliberately pauses at an event; Auto does not impose pauses.
- The rocket camera keeps the complete vehicle visible through fast playback, timeline jumps, descent and landing, with clear space around the character close-up and nozzle diagram.
- A compact fuel strip in the rocket measurements shows remaining kilograms and the burn/coast state. The nozzle illustration follows recorded ignition, steady output and shutdown; pausing freezes its flow and rewinding restores the matching tank level. The character close-up sits beneath it. These visual envelopes do not alter the flight physics.
- Ground characters retreat immediately for up to five viewing seconds, or until one second after a shorter flight lands, then watch or run to inspect the landed vehicle. The newt always watches bare-eyed; other walkers use binoculars. Idle pauses vary between sideways glances, looking at the viewer and both in sequence; some lead to binoculars after a longer pause. The bear mainly watches its surroundings, with occasional brief glances towards the viewer. The submarine pilot watches from the hatch. Close-ups follow the same activity and bearing. The whale swims fully submerged between brief, low surfacings, sometimes inhaling or spouting through its blowhole. Ice-hole visitors keep their own swimming behaviour.
- One shared timer offers a silly interlude after 12–28 viewing seconds, then every 45–90 seconds: an unnecessary umbrella, a failed paper-plane throw, a guidebook or folding tablet, a tripod blueprint, a policeman's helmet, ice cream or snowball juggling. Mercury's robot reads pages facing him, with 42 on the outward cover. The astronaut's throw prompts “Does this really need air..?”; the bear concentrates on its cone with a steady elbow. Launching cancels an interlude immediately; opportunities during flight are skipped. The squid, submarine and whale keep their existing actions.
- The previous flight is kept as a ghost. Pin a baseline while trying alternatives. Comparable flights use the same clock and camera; trajectories from different worlds are not overlaid.
- Earth has a decorative golf flag independent of the experiment. The shared top bar centres **Explore the Solar System**, with the clock on the left and **Instruction manual** and **Settings** icons beside the time selector. Playback controls sit beside an uncluttered timeline; routine status announcements remain available to screen readers. Launch and Reset sit directly below the world picker in both tabs and stay within reach when scrolling the setup panel. Settings groups display, sound/characters and comparison controls, and closes with Escape or an outside click. The **Nozzle Sketch** retains the rocket’s current engine state.
- Full-path reveal and direction arrows are optional. Arrows distinguish velocity, thrust and gravity; their lengths are not a force/speed scale.
- Twelve selectable worlds are arranged outwards from the Sun, with Earth’s Moon and Jupiter’s Ganymede immediately after their planets. The picker shows artwork and names; the selected world's gravity appears with its units above the grid. There is no custom-gravity control. Supplied transparent cartoon artwork also appears in the larger fact cards, comparing mass, diameter, solar distance, gravity, day, year/orbit, axial tilt, temperatures, atmosphere and exploration using rounded NASA/JPL values. Both launchers put flight measurements before their advanced controls.
- The character close-up stays at the top right and follows the character’s activity and facing, with 50 bespoke quips for each of the nine established speaking worlds, a 50-line general deck for Ganymede and custom gravity, and varied reactions to flight events. Ganymede has a giant squid that hammers fresh holes from above to dive and from below to emerge, well clear of the launcher; each hole freezes shut after it clears the rim. Pluto’s friendly polar bear, with a frost-dusted white coat, prowls on all fours and only rears up when something startles it; nothing lives on the Sun. Each speaking world remembers its shuffled round when you leave and return.
- Saturn's submarine and Jupiter's whale cruise partly veiled in soft clouds, occasionally surfacing for a clear look. Their relaxed swimming follows real viewing time, independent of flight speed; launch reactions ease them back into the clouds. Their close-ups always stay clear.
- Sound and character remarks have separate switches; silencing remarks leaves the close-up visible. Reduced-motion preferences suppress decorative movement. Hiding the page pauses the flight.
- Saved flights are retained for this browser session, not persisted across reloads.

## Instruction manual

The book button immediately left of Settings opens a separate manual with a topics index and reading pane. It covers the controls, measurements, playback, comparisons and sound, and links to the educational companion for the science behind the cannon and rocket settings. Reading pauses the experiment. The About page introduces Philip Leichauer, and the MIT licence is imported directly from LICENSE so the app and repository always show the same text.

## Explore the Solar System

Every world fact card has ten keyboard- and touch-accessible explanation buttons. The popups turn scientific notation into full tonnes and a clearly defined five-tonne elephant comparison, explain sizes with Earth comparisons, distances with light-travel time, and gravity with an unchanged 10 kg bag. Temperature cards identify their locations and distinguish WMO air records, lunar polar shadows, daytime maps and specific giant-planet atmospheric layers. Original explanatory copy links to NASA and WMO sources; integer arithmetic preserves the zeros in rounded mass values. Each popup supports Escape, focus return and previous/next fact navigation.

The wiki introduces its three explanation levels before every article’s illustration or experiment. Choosing a level jumps within the reading pane to the explanation, where a second compact selector makes comparison easy. Illustrated cannon and rocket cards identify the two flight-science exhibits throughout navigation.

Open **Explore the Solar System** in the centre of the top bar for an educational companion with 18 topics: the Solar System, Sun, eight planets, moon families, the Moon, Ganymede, Pluto, the asteroid and Kuiper belts, cannons and rockets. Each has **First look**, **Explore** and **Go deeper** explanations. Other moons are covered with their parent worlds rather than separate pages. Search also finds concepts inside articles; related links, previous/next page-turn links and browser history connect the topics. Names that are easily misread (Uranus, Ganymede and the Kuiper Belt) show a short **Say it** pronunciation. Reading level is remembered when browser storage is available.

The Solar System map combines a painted star field with original planet artwork, staggered worlds, compact moon orbits, and alternating rounded name-only callouts with faint leaders. Planets have gently normalised sizes and the Sun sits partly beyond the left edge. The Moon and Ganymede have labels and individual pages; other illustrated companions open their parent world's article. Both belts are continuous elliptical bands with scattered particles and labels placed directly on them. A landscape composition serves tablets and larger displays; a separate portrait composition fits narrow reading areas. The Kuiper Belt has its own region beyond Neptune and a three-level article with a distance comparison. The asteroid-belt illustration also has an enlarged view. All maps state their scale limitations; references link to NASA. The atlas contains science explanations rather than application help. Opening it pauses the experiment without changing its settings or recording; returning leaves the flight paused. Everything except external reference pages works in the portable single-file build.

**How a cannon works** combines a short history, three reading levels, museum and research sources, and an interactive bronze cannon cutaway. Students choose illustrative charge presets and equally sized stone, iron or lead balls, then observe ignition, acceleration and gas venting in slow motion. Pressure and speed share a recorded, dimensionless gas-and-motion simulation, with fixed comparison scales, time/travel plots, scrubbing, replay and a previous-experiment overlay. An expanded view places the cannon and chart together on larger displays. Sound is optional; reduced-motion visitors can step through the event. A short Project HARP sidebar connects the history to space research. The model is deliberately uncalibrated: it contains no real propellant data, dimensions, charge masses or weapon-building instructions. See [the exhibit notes](docs/wiki/cannon-exhibit.md) for assumptions and verification.

**How a rocket works** adds a matching interactive spacecraft cutaway, a history timeline and three expanded readings. Students vary payload, propellant and burn rate, then inspect the tanks, chamber, nozzle and plume through a burn and coast. Three graph pairs compare pressure/speed, thrust/acceleration and mass/speed against time or propellant used. The ideal free-space model accounts for changing mass and momentum while making its omissions explicit. Both exhibits pose a question to investigate and guide students with numbered steps: the one action worth taking next glows gold, finished steps show a tick, and **Reset Experiment** lights up once a run ends. They keep their own paused sessions and support an expanded tablet/desktop view. See [the rocket exhibit notes](docs/wiki/rocket-exhibit.md) for its model and verification.

The rocket page also includes an expandable **Advanced nozzle lab**: three propellant pairs, chamber pressure up to 350 bar, throat diameter, expansion and oxidiser/fuel mass ratio, with Auto buttons for air and vacuum. A separate stationary nozzle view shows gas pressure, speed, thrust and specific impulse. Tooltips, historical pressure comparisons and an **Advanced info** tab explain every setting at three depths. The ideal-gas model and illustrative mixture response are labelled clearly. Both wiki exhibits offer quiet, optional classroom audio with browser-audio status: fuse sizzle and cannon effects, or a soft rocket roar. There is no separate sound-test button or confirmation beep.

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

The live site at <https://lightningphil.github.io/Ballistics/> is deployed by `.github/workflows/pages.yml` on every push to `main`: it runs the tests, builds `dist/` and publishes it with `actions/deploy-pages`. The repository's Pages source is set to "GitHub Actions"; the raw `index.html` at the repo root is a Vite dev entry and does not run unbuilt.

## Source map

- `src/physics.ts`, `src/rocket_physics.ts`, `src/rocket_propellants.ts`, `src/environment.ts`: pure scientific model — cannon ballistics, variable-mass rocket solver, illustrative propellant/nozzle performance, planet data and orbit classification. No DOM access; fully covered by the Node tests.
- `src/flight.ts`: immutable settings, canonical recording, event snapshots and replay sampling.
- `src/playback.ts`, `src/flight-deck.ts`: smooth viewing clock, inspection and comparison controls.
- `src/camera.ts`: pure framing maths for the cannon setup zoom and the rocket follow camera.
- `src/main.ts`: experiment lifecycle (record → replay → inspect), presentation effects, character state machine and synthesised sound.
- `src/renderer.ts`, `src/crew.ts`, `src/aquatic-characters.ts`, `src/planet-guests.ts`, `src/cloud-guests.ts`, `src/nozzle_render.ts`: scene and camera, illustrated characters, cloud-guest motion and the engine cutaway. The crew share one two-bone rig with planted-foot gaits; the whale and submarine dip below a foamy crest of their planet's own cloud deck.
- `src/toon.ts`: the shared character kit — ink outline, capsule limbs, two-bone joints, footfall timing, eyes, mouths and comic effects — so every guest looks like one family.
- `src/squid.ts`, `src/squid-life.ts`, `src/ice-bear.ts`: Ganymede's ten-limbed squid and its hammer → dive → swim → hammer → emerge cycle, with each abandoned hole freezing closed; Pluto's frosty polar bear and four-legged gait. Their close-ups follow the current action.
- `src/character-remarks.ts`, `src/remarks/`: the quip pools and shuffled-round selection for every world and flight event.
- `src/wiki/`: educational content, hash navigation, search, reading levels, moon families, accessible illustrations and the responsive atlas. `docs/wiki/artwork.md` records image-generation prompts and asset locations.
- `src/ui.ts`, `src/flight-deck.ts`, `src/world-art.ts`, `src/planet-facts.ts`, `src/world-characters.ts`, `src/gravity-scale.ts`, `index.html`, stylesheets: accessible experiment controls, world artwork, fact cards, the world → character mapping, gravity bounds and responsive layout.

The gravity/radius/atmosphere presets live once, in `ENVIRONMENTS` (`src/environment.ts`); the renderer palette and the picker read from it, and `tests/worlds.test.mjs` checks that `index.html`, the fact cards and the artwork cover exactly that set. Add a world there first.

`solar-system-cartoon-assets/` holds the 1254 px PNG masters of the world artwork. Nothing in the build reads them; `src/assets/worlds/{mini,full}/*.webp` are hand-exported derivatives (64 px and 320 px, transparent) that Vite inlines into the single-file build as data URLs.

Conventions: `strict` is off in `tsconfig.json` because the older presentation modules are loosely typed, but `noUnusedLocals` is on so dead code fails the build. Modules that touch the DOM or canvas export a single namespace object (`Renderer`, `UI`, `NozzleRender`); the model modules export plain functions.

## Documents

`docs/` keeps the design history. Only the first is a current specification; the rest are implemented plans kept for their rationale and each carries a status note at the top.

- `docs/rocket_lab_single_source_of_truth.md` — rocket mechanics reference and the planned CEA propellant-grid schema.
- `docs/nozzle_parametric_geometry_spec.md`, `docs/nozzle.md` — nozzle cutaway design and plan.
- `docs/roundplanets.md`, `docs/rocket_plan.md`, `docs/planet_characters_plan.md`, `docs/characters.md` — historical plans for spherical planets, rocket mode and the characters.

## License

Copyright (c) 2026 Philip Leichauer. Released under the [MIT licence](LICENSE).
