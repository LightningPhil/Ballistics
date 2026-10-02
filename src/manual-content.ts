/** The manual describes controls; the educational companion owns the science. */
export const MANUAL_TOPICS = [
  {
    id: 'start', name: 'Start here', title: 'A little curiosity goes a long way.',
    intro: 'Choose a world, launch something, and see what changes when you try again.',
    body: `<ol class="manual-steps">
      <li><strong>Choose your experiment.</strong><p>Pick <b>Cannon</b> or <b>Rocket</b> in the setup panel. On phones and portrait tablets, use the launcher bar below the field and open <b>Setup</b> to change your experiment. The starting settings are ready to try.</p></li>
      <li><strong>Choose your world.</strong><p>Select a planet, moon or the Sun from the illustrated buttons. The gravity changes with it. The facts button beside the world’s name opens a short introduction.</p></li>
      <li><strong>Let it fly.</strong><p>The launch buttons sit below the world picker on wide screens, or stay in the bottom launcher bar on smaller screens. Use <b>Let it fly</b> for the cannon or <b>Lift off</b> for the rocket. Launching closes compact Setup so you can watch the field. Open Setup again for measurements, then use <b>Reset</b> to change a setting and try again.</p></li>
    </ol>
    <aside class="manual-note"><strong>A useful first experiment</strong><p>Keep the launcher settings the same and try two different worlds. Make a prediction before the second launch.</p></aside>
    <p>The book beside Settings brings you back to this manual. Opening it pauses the scene; use <b>Resume</b> when you return to a flight.</p>`,
  },
  {
    id: 'cannon', name: 'The cannon tab', title: 'Make a change. Watch the arc.',
    intro: 'Start with the two main sliders, then open the extra controls when you want to explore further.',
    body: `<h3>Set up a flight</h3><p><b>Launch angle</b> changes the barrel’s direction. <b>Launch force</b> changes the push in this simplified experiment. Open <b>Ball & barrel</b> for the ball’s mass and the barrel’s length.</p>
    <p>Use <b>Let it fly</b> to launch. The <b>Flight measurements</b> section follows the ball as it travels. Try changing one setting at a time so the difference is easier to understand.</p>
    <h3>Try again</h3><p>Use <b>Reset</b> beside the launch button to unlock the setup controls and keep your settings. Use <b>Reset cannon settings</b> at the top of the cannon setup to restore the starting angle, force, mass and barrel length. Both keep your chosen world and last recording for replay or comparison.</p>
    <aside class="manual-note"><strong>Want to understand the settings?</strong><p>The learning companion explains the history and science, with three reading levels and an interactive cutaway cannon.</p><a href="#wiki/cannons/1">Read How a cannon works <span aria-hidden="true">↗</span></a></aside>`,
  },
  {
    id: 'rocket', name: 'The rocket tab', title: 'From a small hop to a bigger question.',
    intro: 'The initial rocket is ready to launch. You can explore the workshop a little at a time.',
    body: `<h3>Begin with a small hop</h3><p>Adjust the <b>Propellant load</b> and <b>Launch angle</b>, then use <b>Lift off</b>. The fuel strip in <b>Flight measurements</b> shows what remains and when the engine stops. Coasting means the rocket is still moving with the engine off.</p>
    <h3>Open the workshop</h3><p><b>Engine estimates</b> previews the starting performance. <b>Engine & vehicle workshop</b> contains the propellant choice, empty mass, chamber pressure, throat diameter, expansion ratio, mixture ratio and efficiencies. Estimates describe the model; they are not a promise about a real vehicle.</p>
    <h3>Choose how it steers</h3><p>In <b>Guidance</b>, <b>Hold launch angle</b> keeps the original direction. <b>Timed pitch</b> turns towards a chosen angle over a chosen interval. <b>Follow velocity</b> points along the direction of travel once the selected speed is reached.</p>
    <h3>Get back to a reliable starting point</h3><p><b>Reset rocket settings</b> restores the propellant, load, angle, engine, vehicle and guidance controls together. It stops the current flight and keeps your world and cannon settings. The starting rocket can lift off from all planetary presets, including Venus and Jupiter; the Sun’s gravity still defeats it. The <b>Reset</b> beside Lift off clears the flight while keeping your own design.</p>
    <p>The <b>Nozzle Sketch</b> follows ignition, running and shutdown beside the scene on wide screens. On smaller screens, open it inside <b>Setup</b>. Pausing or moving the flight slider also pauses or moves its illustrated flow.</p>
    <aside class="manual-note"><strong>Make sense of the engine controls</strong><p>Visit the rocket lesson for the nozzle explanation and its advanced settings guide. Each topic has three levels, from a first look to a closer study.</p><a href="#wiki/rockets/1">Read How a rocket works <span aria-hidden="true">↗</span></a></aside>`,
  },
  {
    id: 'playback', name: 'Watch & replay', title: 'Take your time with a flight.',
    intro: 'A flight is recorded once. Playback lets you examine that same experiment as often as you like.',
    body: `<dl class="manual-definitions">
      <div><dt>Pause / Resume</dt><dd>Stop at an interesting moment, then carry on from there.</dd></div>
      <div><dt>Inspect flight</dt><dd>Drag the time slider backwards or forwards. It pauses at the time you select; the scene and measurements follow together.</dd></div>
      <div><dt>Next moment</dt><dd>Jump to the next recorded event, such as burnout or landing. Playback pauses there for inspection.</dd></div>
      <div><dt>Replay</dt><dd>Watch the same recorded flight from the beginning, with its original setup.</dd></div>
      <div><dt>Time</dt><dd>Auto fits a complete flight into at most 20 seconds of viewing time, excluding pauses. Short flights stay at real time; longer ones start faster, ease a little near the peak and keep their pace through landing. Choose 1× for fixed real time, or 4×, 16× or 64× for a fixed faster speed. Changing playback speed never changes the physics.</dd></div>
      <div><dt>Reset</dt><dd>Return to the setup so you can make a new experiment. The recording is kept for replay.</dd></div>
    </dl>
    <p>The clock shows <b>time in the experiment</b>, not time spent watching. Opening this manual or the learning companion pauses the lab. Leaving the browser tab also pauses playback.</p>`,
  },
  {
    id: 'measurements', name: 'Read the measurements', title: 'The numbers tell the other half.',
    intro: 'The setup panel follows the moment you are watching, including when you rewind.',
    body: `<h3>During the flight</h3><p>Open <b>Flight measurements</b> for the current values. Speed tells you how fast the object is travelling; height or altitude tells you how far it is above the model’s surface. Distances follow the world’s curved surface.</p>
    <p>The cannon also shows its energy measurements. The rocket shows thrust, changing mass, remaining propellant and engine performance. After a rocket flight, <b>The field notes</b> summarises the result.</p>
    <h3>Before a rocket launch</h3><p><b>Engine estimates</b> updates as you adjust the setup. Watch the app’s lift-off warning: the rocket needs enough upward thrust to overcome its weight. Use the rocket lesson to understand what each engine setting changes.</p>
    <h3>Keep the model in mind</h3><p>Launch Lab uses simplified physics. The flight model leaves out air drag and wind, even on worlds with atmospheres. The artwork, visitors and imaginary launch sites are there for enjoyment; they are not scale drawings.</p>
    <a class="manual-text-link" href="#wiki/rockets/1">Explore the rocket science <span aria-hidden="true">↗</span></a>`,
  },
  {
    id: 'compare', name: 'Compare experiments', title: 'Change one thing. Keep a reference.',
    intro: 'A faint trail helps you see what your next experiment does differently.',
    body: `<ol class="manual-steps"><li><strong>Make a first flight.</strong><p>Open <b>Settings</b> and leave <b>Previous flight</b> switched on to show the comparison trail.</p></li>
    <li><strong>Keep it if you wish.</strong><p>Under <b>Compare experiments</b>, choose <b>Pin this flight</b> to hold on to that recording as a baseline for several trials.</p></li>
    <li><strong>Make a careful change.</strong><p>Use <b>Reset</b>, adjust one setting and launch again. The comparison note in Settings describes what changed.</p></li></ol>
    <p><b>Unpin baseline</b> returns to comparing with the previous flight. Trails from different worlds are not drawn over one another; compare their measurements instead.</p>
    <aside class="manual-note"><strong>A notebook can help</strong><p>Recordings and pinned flights last for this open session. Reloading or closing the app clears them, so jot down results you want to keep.</p></aside>`,
  },
  {
    id: 'settings', name: 'Settings & sound', title: 'Make the lab comfortable.',
    intro: 'The cog beside this book opens the display, sound and comparison options.',
    body: `<h3>Choose what you see</h3><p><b>Previous flight</b> shows the comparison trail. <b>Reveal full path</b> shows the whole recorded trajectory, including the part you have not watched yet. Leave it off if you want to make a prediction first.</p>
    <p><b>Motion & force arrows</b> shows directions such as velocity, thrust and gravity. The arrows’ lengths are not a scale for their strength.</p>
    <h3>Listen quietly, or not at all</h3><p><b>Sound</b> switches on the launch effects. They are deliberately gentle for a classroom. Your device volume still sets the listening level. If nothing plays, check browser or device mute, then switch Sound off and on again.</p>
    <p><b>Character remarks</b> controls the visitors’ written comments independently of sound. Their small distractions are part of the fun.</p>
    <h3>Keyboard and reading</h3><p>Use <kbd>Tab</kbd> to move between controls, <kbd>Enter</kbd> or <kbd>Space</kbd> to activate buttons, and arrow keys to adjust a focused slider. <kbd>Esc</kbd> closes Settings or this manual. The app also respects your device’s reduced-motion preference.</p>`,
  },
  {
    id: 'learning', name: 'Explore & learn', title: 'Follow the question a little further.',
    intro: 'Explore the Solar System is the educational companion, reached from the centre of the top bar.',
    body: `<p>Use its topics index or search to find a world, a moon, a belt of small bodies, or the science behind a launch. Click a world or its name on the illustrated map to open its article.</p>
    <h3>Choose your depth</h3><p><b>First look</b> gives the big idea. <b>Explore</b> adds the how and why. <b>Go deeper</b> introduces the science underneath. You can change levels whenever you like.</p>
    <div class="manual-learning-links"><a href="#wiki/solar-system/1"><strong>Explore the Solar System</strong><span>Worlds, moons, orbits and the belts between them ↗</span></a>
    <a href="#wiki/cannons/1"><strong>How a cannon works</strong><span>History, pressure and an interactive cutaway ↗</span></a>
    <a href="#wiki/rockets/1"><strong>How a rocket works</strong><span>Thrust, nozzles and the engine settings ↗</span></a></div>
    <p>These lessons have their own experiments. Changing them leaves your main lab setup alone. Use <b>Back to the lab</b> when you are ready to return.</p>`,
  },
  {
    id: 'about', name: 'About Launch Lab', title: 'A serious curiosity. A rather silly app.',
    intro: 'Made by Philip Leichauer.',
    body: `<p>A lifelong interest in space, and work in aeronautics, fusion and space, eventually collided with agentic web development. Launch Lab is the rather silly result.</p>
    <p>It is a place to follow a question, try a small experiment and see something unexpected. The physics invites a closer look; the characters occasionally have other ideas.</p>
    <p>The hope is simply that it makes room for a little curiosity, whether you are learning on your own, sharing a tablet or exploring together in a classroom.</p>
    <div class="manual-signature"><span>Philip Leichauer</span><small>Creator of Launch Lab</small></div>
    <p>Launch Lab is shared under the MIT licence. The full text is in the next topic.</p>`,
  },
  {
    id: 'licence', name: 'MIT licence', title: 'Yours to explore and build on.',
    intro: 'Launch Lab is released under the MIT licence, reproduced in full below.',
    body: '<pre class="manual-licence"></pre>',
  },
] as const;
