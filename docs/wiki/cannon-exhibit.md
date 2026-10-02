# Historical cannon exhibit

The cannon article is a history and science lesson. Its cutaway represents a later muzzle-loading style, not a reconstruction of the earliest Chinese cannon. The three reading levels explain rapid burning, hot gas, pressure, acceleration, expansion and recoil. A brief Project HARP sidebar distinguishes reaching altitude from entering orbit.

## Sources and historical scope

- Royal Armouries, *The Hundred Years’ War*: the 1326 Florence record and changing European cannon forms.
- Tonio Andrade, *Late Medieval Divergences* (2015): evidence for medieval Chinese cannon and the uncertainty around an exact first example.
- Royal Museums Greenwich, historic stone shot collection record.
- UCL, *Characterising cast iron cannonballs from the Mary Rose*: recovered stone, lead, iron and composite shot. The exhibit uses idealised uniform balls rather than reconstructing composite ammunition.
- NASA, Newton’s laws and the HARP/Martlet history.

Working links are kept with the article in `src/wiki/content.ts`. No powder composition, real loading quantities, construction dimensions or operating instructions are supplied.

## Model boundary

`src/wiki/cannon-model.ts` integrates a dimensionless expanding-gas reservoir and a moving mass. A smooth, fixed-duration heat-release curve supplies energy. Gas pressure follows energy divided by available volume; pressure does work on the ball, and small resistance and heat losses remove energy. Motion and pressure therefore affect one another. Material presets change mass at equal illustrated size. Charge presets change invented energy and initial volume; their drawing lengths are SVG units only.

Fourth-order Runge–Kutta integration records the solution. A bounded search resolves muzzle clearance inside the final step. Afterwards pressure decays as the reservoir vents and the ball coasts. This explicitly omits the short external gas push, as well as real propellant burn laws, leakage, deformation and external flight. Recoil, fuse timing and smoke are illustrative effects, not extra physics predictions.

No model value is calibrated to a real cannon. Pressure and speed each have a separate 0–100 index, fixed across all nine presets. Model time has no conversion to seconds. The purpose is to illustrate relationships, particularly rising speed during falling pressure, not to estimate real weapon performance.

## Interaction and rendering

`src/wiki/cannon-exhibit.ts` renders an inline SVG cutaway and chart. The loading state is empty → charge → ball → fuse → shot. Playback, time scrubbing, chart selection, and the “Next moment” control all sample the same recorded solution. The ball fully clears the drawn muzzle at model travel 100%. Travel-axis plots reveal only the observed pressure tail, even though venting samples occupy the same horizontal position.

The expanded dialog moves the existing exhibit node, preserving playback and avoiding duplicate SVG IDs. Escape or “Return to article” restores its original position. Leaving the article disposes listeners, animation frames and audio, and preserves a paused session. Changing reading level updates the explanation in place, preserving the scroll position, focused control and mounted exhibit. Browser visibility changes also pause playback. Optional audio begins only from a user gesture. Reduced-motion mode starts at a paused shot and suppresses carriage movement.

## Verification

The model tests cover every material/charge combination, finite forward motion, the in-barrel energy balance, pressure/speed relationships, exact muzzle travel, post-exit coasting and venting, integration convergence, travel/time sampling, and the loading/replay/reset sequence. Browser checks cover the cutaway, playback controls, comparison overlay, both chart axes, enlarged view, article navigation and tablet layouts.
