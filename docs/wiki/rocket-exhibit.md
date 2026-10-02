# Rocket history and science exhibit

The rocket article uses the same interactive exhibit language as the historical cannon lesson. The new cutaway is a schematic liquid-propellant spacecraft, not a reconstruction of Goddard's 1926 vehicle. Its timeline connects medieval Chinese gunpowder rockets, the first successful liquid-propellant flight, and Sputnik 1. NASA history and educational sources are linked in `src/wiki/content.ts`.

## The experiment

Students choose one of three science payload masses, propellant loads and burn rates. They add the payload, fill the tanks with the selected illustrative load, then start a short countdown. Fuel and oxidiser are drawn separately, with moving feed paths, a glowing chamber, gas through the nozzle and an exhaust plume. The camera follows the vehicle. Star drift and optional audio are explanatory effects; sound does not propagate through vacuum.

Pressure/speed, thrust/acceleration and mass/speed can be plotted against model time or the proportion of propellant used. Scales stay fixed across experiments. Reset retains the preceding curves as a dashed comparison; replay repeats the current configuration. Keyboard scrubbing, pointer selection and stepping all inspect the same model history. A reduced-motion preference starts playback paused and suppresses decorative motion.

## Model assumptions

`rocket-model.ts` is a dimensionless ideal free-space demonstration. It supplies no real engine geometry, propellant chemistry, masses or calibrated performance. External gravity, drag, steering and staging are omitted. These omissions are explicit in the lesson: vacuum does not itself mean gravity is absent.

The prescribed outgoing mass-flow history has smooth startup/shutdown ramps and a steady central interval. Its integral is exactly the selected propellant load. Current total mass is structure plus payload plus remaining propellant. With fixed effective exhaust velocity, thrust is flow times effective exhaust velocity, acceleration is thrust divided by current mass, and velocity change follows the ideal rocket equation. Simpson quadrature integrates displacement. The analytic propellant and velocity histories also supply arbitrary inspection times, so changing graph axes never changes the solution.

Chamber pressure is a quasi-steady flow proxy for a fixed nozzle and fixed gas conditions. This is intentionally not a separate combustion or nozzle-flow solver. Pressure, speed, thrust, acceleration and mass each have independent fixed comparison indices. Tank colours and relative tank volumes are schematic, not chemical or mixture information.

At exact cutoff flow, pressure, thrust and acceleration are zero. The vehicle then coasts at constant speed under the model's external-force-free assumptions. Burn-rate comparisons preserve final velocity change when payload, propellant and effective exhaust velocity are unchanged; an actual atmospheric launch would include gravity and drag losses.

## Integration and verification

The wiki stores cannon and rocket sessions independently and pauses them on article changes or closing. The shared `exhibit-focus.ts` moves the current exhibit into its expanded dialog without duplicating SVG IDs, restores it on Escape, and repositions controls when the tablet orientation changes. Disposal cancels animation, aborts event listeners, stops sound and closes audio resources.

Tests cover all 27 presets, finite and monotonic motion, propellant accounting, momentum balance including the expelled mass, differential acceleration, constant-speed coasting, fixed scale bounds, the burn-rate comparison, payload/load ordering, position convergence, propellant-axis inversion and loading/replay/reset transitions. Browser checks cover the illustrated sequence, plots, comparisons, keyboard inspection, navigation and tablet/desktop layouts.

## Advanced nozzle lab

An expandable section in the wiki rocket exhibit provides a separate stationary engine demonstration. It does not silently alter the dimensionless travelling experiment or the planetary flight model. The standard article readings now explain a simplified chamber, throat and expanding nozzle. The Advanced info tab has three original explanations for each of five settings, progressing from roughly age 10–12 to interested pre-degree readers.

The controls are propellant pair (oxygen/hydrogen, oxygen/methane, oxygen/kerosene), absolute chamber pressure (10–350 bar), throat diameter (20–300 mm), exit/throat area ratio (1–200), and oxidiser/fuel mass ratio (bounds depend on the pair). Number fields and sliders are synchronised; tap/focus/hover tooltips explain effects, units and common misconceptions. Settings, expanded state, info topic and reading depth survive wiki navigation during the session.

`nozzle-model.ts` uses a quasi-one-dimensional, calorically perfect gas model with fixed gamma per pair. It solves the area–Mach relation by bisection, applies isentropic pressure ratios, calculates mass flow as Pc At / c*, and includes momentum and exit-pressure terms in thrust. An approximate separation limit uses an effective exit at 0.4 times ambient pressure. The schematic and pressure/speed profile update from those gas-flow relations; a separated-flow profile stops at the estimated useful section. Nozzle shape is schematic, not a contour-design calculation.

The mixture response is explicitly an illustrative surrogate: c* = c*reference × exp(−0.13 × ((O/F − reference ratio) / width)²). The reference values and widths are classroom parameters, not CEA results or measured engine maps. Gamma does not vary with mixture. Mixture alters mass flow and specific impulse while fixed pressure/geometry largely sets thrust. This limitation is stated beside the controls and in the mixture readings.

Auto for air maximises model specific impulse by matching exit pressure to 101325 Pa and choosing the mixture-curve peak. Auto for vacuum chooses that peak and the upper expansion bound of 200. There is no finite ideal vacuum optimum without a nozzle mass/length penalty; the UI explains this explicitly. Both buttons keep pressure and throat diameter. These controls are an exploration of trends, not certified engine predictions.

Pressure comparisons are rounded and qualified: Saturn V F-1 about 78 bar and the original Shuttle main-engine rated reference about 207 bar. The 350-bar slider maximum is an illustrative model limit. The former Raptor V3 test comparison was removed during the October 2026 fact check because its linked primary post could not be retrieved for verification. NASA's *Remembering the Giants* (F-1 characteristics in Appendix C), NASA engine data, specific impulse and nozzle separation research are linked in the panel. The pressure references include PDF page anchors for the relevant data.

New tests check conservation of momentum including pressure thrust, finite values across the control envelope, squared-diameter scaling, pressure scaling in vacuum, both Mach branches, optimiser bounds and performance, invalid inputs, and complete three-level topic content. Browser checks cover numeric entry, sliders, both Auto buttons, tooltip dismissal, all 15 readings, reading-level persistence, and 1024×768 / 768×1024 tablet layouts.

## Audio

Both wiki exhibits use `exhibit-audio.ts`: AudioContext (or the WebKit fallback) is created and resumed on a user gesture; failed starts produce visible feedback. Sound starts with the relevant activity, with no test button or confirmation beep. Filtered noise produces a quiet fuse sizzle; a broader noise filter and low-frequency tone produce a soft rocket roar. The master gain and individual effects are kept low for classroom use. Sound remains opt-in and is an explanatory effect, including in the vacuum illustration. Pause silences the fuse and engine loops; disposal closes the context; muting cancels a pending unlock. Tests exercise these transitions, gain limits and rejected resumes with a fake audio graph. Browser QA cannot confirm the user's system volume or speakers.

The main lab also unlocks its audio context directly from the Sound gesture, before asynchronous flight recording can lose activation. Failed starts report through the flight status. Its quiet engine loop follows the same recorded ignition/shutdown envelope as the nozzle inset and stops when paused or at cutoff. The compact fuel strip in the left-hand flight measurements uses the solver's remaining propellant, including fuel retained after a rejected launch or an early impact.
