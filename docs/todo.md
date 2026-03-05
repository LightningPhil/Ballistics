# Matilda's Cannon Lab — New Planet Characters Plan

> **Goal:** Add a unique comic character to every planet that currently lacks one.
> Characters follow the same state-machine and drawing patterns as the existing golfer (Earth), alien (Mars), and spaceman (Moon).
> All previous features (zoom fix, celestial bodies, comic characters, barrel stickmen) are ✅ DONE.

---

## Current State

| Planet   | Gravity | `isGas` | `features`  | Existing Character | New Character             |
|----------|---------|---------|-------------|-------------------|---------------------------|
| Moon     | 1.62    | false   | `moon`      | ✅ Spaceman        | —                         |
| Mercury  | 3.70    | false   | `mercury`   | —                 | 🤖 Robot                  |
| Mars     | 3.72    | false   | `mars`      | ✅ Alien           | —                         |
| Uranus   | 8.69    | true    | `icegas`    | —                 | 🤖 Different Robot        |
| Venus    | 8.87    | false   | `venus`     | —                 | 🦎 Newt                   |
| Earth    | 9.81    | false   | `earth`     | ✅ Golfer          | —                         |
| Saturn   | 10.44   | true    | `saturn`    | —                 | 🛥️ Submarine              |
| Neptune  | 11.15   | true    | `deepgas`   | —                 | ⛄ Snowman                |
| Jupiter  | 24.79   | true    | `jupiter`   | —                 | 🐋 Whale                  |

---

## Architecture Overview

### What already exists

- **`main.js`**: `syncCharacterToPlanet()` maps planet names → character types via a simple if/else chain. `createCharacter(type)` creates a state object. `updateCharacter(dt)` runs a shared state machine: `walking → idle → startled → running_away → off_screen → returning`. `squashCharacter()` handles cannonball-hit comedy.
- **`renderer.js`**: `drawCharacter(char)` dispatches to `drawGolfer()`, `drawAlien()`, or `drawSpaceman()`. Each draw function receives `(cx, cy, s, char)` where `s = max(18, currentPPM)` and draws at canvas coordinates.
- **Thought bubbles**: `CHAR_THOUGHTS` in `main.js` has a `[type] → string[]` map. `drawThoughtBubble()` renders above the character's head.
- **Gas planets** (`isGas:true`): Uranus, Saturn, Neptune, Jupiter. The "ground" is a gas/cloud surface. Characters on gas planets need to look like they sit *on* the surface visually, even though it's gas. For the whale specifically, it swims *beneath* and surfaces periodically.

### What needs to change

1. **`syncCharacterToPlanet()` in `main.js`** — Extend the if/else to cover all 9 planets.
2. **`createCharacter()` in `main.js`** — New types may need extra state fields (e.g., the whale needs `submerged`, `surfaceTimer`, `spoutTimer`).
3. **`updateCharacter()` in `main.js`** — Whale needs custom state logic (submerge/surface cycle). Others can use the standard state machine.
4. **`drawCharacter()` in `renderer.js`** — Add cases for the 6 new types.
5. **6 new draw functions** in `renderer.js` — one per character.
6. **`CHAR_THOUGHTS`** in `main.js` — Add thought-bubble text for each new type.

---

## Character Designs

### 1. Mercury — Robot (`'robot'`)

**Concept:** A small, boxy retro robot (think 1950s sci-fi tin robot). Antenna on top, square body, blocky arms and legs. Moves in stiff, jerky steps. Heat shimmer lines around it (Mercury is scorching).

**Visual breakdown:**
- **Head:** Small square with two round "eyes" (LEDs — glow red/green). Short zigzag antenna on top.
- **Body:** Larger square/rectangle, rivet dots, a dial/gauge circle on the chest.
- **Arms:** Thin rectangles with pincer-claw hands (two lines forming a V).
- **Legs:** Two thick rectangles, rounded feet. Walk animation is stiff — each leg lifts and plants mechanically.
- **Heat effect:** Wavy vertical lines (`sin` distortion) rising from beneath the robot, subtle transparency.

**Animations:**
| State       | Animation                                                        |
|-------------|------------------------------------------------------------------|
| `idle`      | Antenna bobs, eyes blink alternately, chest gauge needle sweeps. |
| `walking`   | Stiff mechanical steps, arms don't swing much, slight body sway. |
| `startled`  | Antenna springs wildly, eyes flash red, arms shoot up, sparks.   |
| `running`   | Legs become a comically fast piston blur, body tilts back, smoke trail. |
| `squashed`  | Flattens into a rectangle of scrap, springs and bolts fly out.   |

**Thought bubbles:** `['BEEP BOOP', '01001000', 'SO HOT...', 'SCANNING...', 'ERROR 404']`

---

### 2. Venus — Newt (`'newt'`)

**Concept:** A chunky, bright-orange lava newt with stubby legs, big round eyes, and a curled tail. Adapted to Venus's hell-scape — glows slightly, darts around.

**Visual breakdown:**
- **Body:** Elongated oval (horizontal), orange-red gradient with darker spots along the spine.
- **Head:** Rounded bump at the front, two large circular eyes (black pupils, bright yellow irises).
- **Legs:** 4 tiny stubby limbs (two visible from the side), with splayed toes.
- **Tail:** Curled upward in a spiral at the rear, bobs while walking.
- **Glow:** Faint warm-orange aura beneath (lives on volcanic ground).

**Animations:**
| State       | Animation                                                        |
|-------------|------------------------------------------------------------------|
| `idle`      | Tongue flicks out briefly, eyes blink slowly, tail curls/uncurls.|
| `walking`   | Scurries with a wiggle — body undulates side to side, legs paddle.|
| `startled`  | Eyes bulge huge, body puffs up briefly, back arches cat-style.   |
| `running`   | Frantic scurry, legs become a blur, tail streams straight back.  |
| `squashed`  | Flattens like a pancake, tongue dangles out, then "inflates" back.|

**Thought bubbles:** `['Toasty!', '*lick*', 'Sulphur...', 'Nice lava', 'Hmm, warm']`

---

### 3. Jupiter — Whale (`'whale'`)

**Concept:** A huge cartoon whale that mostly swims *beneath* the gas surface. Occasionally its back crests above the surface in a gentle arc, then it spouts a fountain from its blowhole before submerging again. This is the most unique character — it doesn't use the standard walk/idle cycle.

**Visual breakdown:**
- **Body:** Large, smooth, dark blue-grey oval (only the top arc is visible when surfacing). Lighter belly never visible.
- **Eye:** One small, friendly eye near the front (when the head surfaces).
- **Blowhole:** Small round opening on top of the head — spout is a V-shaped fountain of white droplets rising and arcing outward.
- **Tail flukes:** Wide forked tail that breaks the surface briefly as the whale dives.
- **Surface ripples:** Concentric arcs radiating from where the body meets the gas surface.

**Custom state machine (replaces standard walk/idle cycle):**
| State          | Duration  | What happens                                                   |
|----------------|-----------|----------------------------------------------------------------|
| `submerged`    | 5–12 s    | Nothing visible. Whale moves horizontally beneath the surface. |
| `surfacing`    | 1.5 s     | Back slowly arcs up through the surface line — smooth sine curve rising. |
| `spouting`     | 1.5 s     | Body at peak exposure, blowhole emits fountain. Particles rise and fall. |
| `diving`       | 1.5 s     | Body sinks back down, tail flukes flip up and slap the surface.|
| *(repeat)*     |           | Returns to `submerged`, moves to a new x position.             |

**On fire (startled):** If surfaced, whale does a huge tail-slap (splash particles), then dives immediately with a fast downward animation. The blowhole spout goes sideways in surprise. Stays submerged for extra-long (15 s) before returning.

**On squash:** Giant splash erupts from the impact point, whale's back ripples like jelly, then it sinks quickly.

**Thought bubbles:** Only shown when surfaced. `['Bluuub', '*spout*', 'Big sky!', 'Gassy...', 'Belly flop?']`

**Implementation notes:**
- The whale's `y` is always 0 (surface level); the draw function clips below `groundY` to create the illusion of submersion.
- The "exposure" amount (how much back is visible) is driven by `surfaceTimer` using a smooth sine curve.
- The spout particles are temporary — 8–12 small circles launched upward with gravity, drawn in the same frame cycle as the standard particle system or self-contained in the draw function.
- Horizontal movement happens during `submerged` state (invisible), so the whale appears at a different x each time it surfaces.

---

### 4. Neptune — Snowman (`'snowman'`)

**Concept:** A classic three-ball snowman (small/medium/large stacked). Carrot nose, twig arms, top hat. Shivers in Neptune's extreme cold. Ice crystals float around it.

**Visual breakdown:**
- **Body:** Three stacked white circles (bottom = largest, top = smallest = head). Slightly bluish-white gradient for icy feel.
- **Eyes:** Two small coal dots on the head. Mouth: curved line of smaller dots.
- **Nose:** Small orange triangle (carrot) poking out to one side.
- **Arms:** Two brown twig lines sticking out from the middle ball, with 1–2 small branch forks at the ends.
- **Hat:** Black rectangle + brim on top of the head.
- **Scarf:** Small red/stripy curves between head and middle ball.
- **Ice crystals:** 3–4 tiny sparkle shapes (`*`) floating around, using intersecting short lines at angles.

**Animations:**
| State       | Animation                                                        |
|-------------|------------------------------------------------------------------|
| `idle`      | Gentle shiver (rapid tiny horizontal jitter), ice crystals drift.|
| `walking`   | Hops forward (bounces up-down), tilts side to side, hat wobbles. |
| `startled`  | Hat flies off upward, arms flail, body splits apart briefly (balls separate then reassemble). Carrot nose shoots out and returns. |
| `running`   | Rapid rolling — body tilts forward and spins, snow trail puffs behind. |
| `squashed`  | All three balls flatten into one wide disc, hat lands on top, carrot sticks out sideways.|

**Thought bubbles:** `['Brrr!', 'So cold!', 'Need scarf', 'Icy!', '*shivers*']`

---

### 5. Saturn — Submarine (`'submarine'`)

**Concept:** A small yellow cartoon submarine (Beatles-inspired) floating along Saturn's gaseous surface. Periscope poking up, porthole windows with a face peeking out. Bubbles rise from it.

**Visual breakdown:**
- **Hull:** Horizontal oval/capsule shape, bright yellow. Rivets along a centre seam line.
- **Conning tower:** Small rectangle on top with a round periscope extending upward. Periscope has a tiny lens glint.
- **Portholes:** 2–3 small circles along the hull. One has a face peeking out (two eyes and a smile).
- **Propeller:** Small spinning prop at the rear (lines rotating).
- **Bubbles:** A trail of 3–5 circles rising above and behind, drifting upward and fading.
- **Fins:** Small triangular stabilisers at the rear, top and bottom.

**Animations:**
| State       | Animation                                                        |
|-------------|------------------------------------------------------------------|
| `idle`      | Gentle bob up/down (sine wave), propeller spins slowly, bubbles rise. Periscope rotates left/right. |
| `walking`   | Moves horizontally, slight pitch (nose-up/down oscillation), propeller spins faster, more bubbles. |
| `startled`  | Periscope retracts fast, face in porthole goes 😱, sub lurches downward, alarm light (red glow) flashes on tower. |
| `running`   | Propeller becomes a blur, sub tilts nose-down, shoots forward with thick bubble trail, hull rattles (jitter). |
| `squashed`  | Crumples like an accordion, rivets pop out, then springs back with a "boing".|

**Thought bubbles:** `['All clear!', 'Dive! Dive!', 'Ping!', 'Aye aye!', 'Periscope up']`

---

### 6. Uranus — Ice Robot (`'icerobot'`)

**Concept:** Distinct from Mercury's robot — this is a sleek, icy-blue robotic figure with crystalline plating, frost effects, and a visor-style eye strip. Think futuristic probe rather than retro tin toy.

**Visual breakdown:**
- **Head:** Rounded trapezoid, single horizontal visor that glows cyan. No separate eyes — the visor pulses/scans.
- **Body:** Smooth angular torso (tapered from shoulder to waist), icy-blue metallic fill with frost vein patterns (thin white lines).
- **Arms:** Segmented (upper + lower arm with joint circle), ending in 3-pronged claw hands. Slightly translucent.
- **Legs:** Two reverse-jointed legs (digitigrade — like a bird knee), giving an alien mechanical gait. Round feet.
- **Frost effect:** Tiny ice particles shed from joints as it moves — small white dots that fall and fade.
- **Colour palette:** Icy teals and silvers (#88ccdd, #aaddee, #667788) — contrasts with Mercury's warm orangey-brown robot.

**Animations:**
| State       | Animation                                                        |
|-------------|------------------------------------------------------------------|
| `idle`      | Visor scans left-right (glow sweeps), frost particles drift down from shoulders. Slight mechanical breathing (torso expands/contracts). |
| `walking`   | Reverse-jointed digitigrade gait — knees forward, feet plant backward. Smooth, alien-looking stride. Arms swing in opposition. |
| `startled`  | Visor flashes bright red, arms snap to defensive pose (crossed in front), ice cracks radiate beneath feet. Steps back. |
| `running`   | Legs become a rapid scissor motion, body leans far forward, frost trail streams behind. Visor glows bright. |
| `squashed`  | Shatters into angular ice fragments that scatter, then reassembles piece by piece (reverse shatter). |

**Thought bubbles:** `['SCANNING...', 'ICE STABLE', 'COLD OK', '-224°C', 'PROBE READY']`

---

## Implementation Phases

### Phase A: Extend character type mapping (`main.js` — small)
- Update `syncCharacterToPlanet()` to map all 9 planets:
  ```js
  if      (name === 'earth')   type = 'golfer';
  else if (name === 'mars')    type = 'alien';
  else if (name === 'moon')    type = 'spaceman';
  else if (name === 'mercury') type = 'robot';
  else if (name === 'venus')   type = 'newt';
  else if (name === 'jupiter') type = 'whale';
  else if (name === 'neptune') type = 'snowman';
  else if (name === 'saturn')  type = 'submarine';
  else if (name === 'uranus')  type = 'icerobot';
  ```
- Add `CHAR_THOUGHTS` entries for all 6 new types.
- **No draw code yet** — characters will spawn but be invisible until Phase B+.

### Phase B: Standard-behaviour characters — draw functions (`renderer.js` — medium)
Add draw functions for the 5 characters that use the **standard state machine** (walk/idle/startled/running/squashed):
1. `drawRobot(cx, cy, s, char)` — Mercury robot
2. `drawNewt(cx, cy, s, char)` — Venus newt
3. `drawSnowman(cx, cy, s, char)` — Neptune snowman
4. `drawSubmarine(cx, cy, s, char)` — Saturn submarine
5. `drawIceRobot(cx, cy, s, char)` — Uranus ice robot

Also add the switch-cases in `drawCharacter()`:
```js
case 'robot':     drawRobot(cx, cy, s, char); break;
case 'newt':      drawNewt(cx, cy, s, char); break;
case 'snowman':   drawSnowman(cx, cy, s, char); break;
case 'submarine': drawSubmarine(cx, cy, s, char); break;
case 'icerobot':  drawIceRobot(cx, cy, s, char); break;
```

**Do each draw function as a sub-phase to keep edits small:**
- B1: `drawRobot` (Mercury)
- B2: `drawNewt` (Venus)
- B3: `drawSnowman` (Neptune)
- B4: `drawSubmarine` (Saturn)
- B5: `drawIceRobot` (Uranus)

### Phase C: Whale — custom state machine (`main.js` + `renderer.js` — larger)
The whale is unique: it doesn't walk or run. It has its own cycle.

#### C1: Whale state machine in `main.js`
- In `createCharacter()`, if type is `'whale'`, add extra fields:
  ```js
  surfaceAmount: 0,     // 0 = fully submerged, 1 = fully surfaced
  spoutActive: false,
  spoutParticles: []
  ```
- In `updateCharacter()`, add a whale-specific branch:
  - `submerged` → after 5–12 s, pick a new x, transition to `surfacing`.
  - `surfacing` → over 1.5 s, ramp `surfaceAmount` from 0 to 1, then → `spouting`.
  - `spouting` → hold 1.5 s, emit spout particles, then → `diving`.
  - `diving` → over 1.5 s, ramp `surfaceAmount` from 1 to 0, show tail, then → `submerged`.
- Startled: if surfaced, jump to `diving` immediately with extra-long next `submerged` duration.

#### C2: `drawWhale()` in `renderer.js`
- Draw the whale body arc above the ground line, clipped so the bottom is hidden.
- Draw the eye when head region is above surface.
- Draw spout fountain from the blowhole as arcing particles.
- Draw tail flukes during the `diving` state (sine curve flip).
- Draw surface ripples (concentric arcs) where the body meets the ground line.

#### C3: Whale spout particles
- Self-contained in `drawWhale()` or as part of the existing particle system.
- 8–12 tiny white circles launched upward at varying angles, fall back under gravity.
- Only active during `spouting` state.

### Phase D: Polish & edge-cases
- Ensure all characters scale correctly with zoom (they already use `currentPPM`-based scaling).
- Gas-planet characters (whale, submarine, snowman, ice-robot) need to look correct on gas surfaces — no hard ground line. Verify they sit on top of the gradient surface visually.
- Submarine's bubbles and snowman's ice crystals should not persist when the character is off-screen.
- Test planet transitions — characters should fade out and new ones walk in when gravity slider moves between planets.
- Test squash (cannonball landing on character) for all 6 new types.
- Verify thought bubbles appear at the right height for all new characters (may need per-type y-offset).

---

## Files Modified

| Phase | `renderer.js` | `main.js` | `ui.js` | Other |
|-------|:---:|:---:|:---:|:---:|
| A — Type mapping   | — | ✓ | — | — |
| B1 — Robot draw     | ✓ | — | — | — |
| B2 — Newt draw      | ✓ | — | — | — |
| B3 — Snowman draw   | ✓ | — | — | — |
| B4 — Submarine draw | ✓ | — | — | — |
| B5 — Ice Robot draw | ✓ | — | — | — |
| C1 — Whale state    | — | ✓ | — | — |
| C2 — Whale draw     | ✓ | — | — | — |
| C3 — Whale spout    | ✓ | — | — | — |
| D — Polish          | ✓ | ✓ | — | — |

---

## Suggested Implementation Order

1. **Phase A** — Wiring (small, safe, sets up the skeleton)
2. **Phase B1** — Mercury Robot (simplest — boxy geometry, good to establish the pattern)
3. **Phase B2** — Venus Newt (organic shape — tests the approach for non-boxy characters)
4. **Phase B3** — Neptune Snowman (stacked circles — straightforward)
5. **Phase B4** — Saturn Submarine (mechanical but with bubbles — medium complexity)
6. **Phase B5** — Uranus Ice Robot (most detailed standard character)
7. **Phase C1+C2+C3** — Jupiter Whale (custom state machine — save for last)
8. **Phase D** — Final polish
