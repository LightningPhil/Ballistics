# Character Art Upgrade — Analysis & Plan

> **Goal:** Replace all 9 characters' primitive-shape drawing code with polished, cartoon-quality canvas art that looks release-ready.

---

## 1. What's Wrong Now (Honest Audit)

I've read every line of every draw function. Here's a frank assessment of each character and the **systemic problems** shared across all of them.

### Per-Character Issues

| Character | Lines | Core Problem |
|-----------|-------|-------------|
| **Golfer** | 178 | Stick-figure with stroke lines for body, legs, arms. No filled limbs. Head is a flat circle — no hair, no expression in idle. Cap is an ellipse + rect. Club is a bare line. |
| **Alien** | 147 | Best of the bunch — body is a gradient-filled circle, eyes are layered (white + pupil). But legs are single stroke lines, tentacles are single quadratic curves with no thickness taper, antenna are thin lines. |
| **Spaceman** | 180 | Rectangular suit (`fillRect`), rectangular backpack, rectangular boots. Helmet is good (gradient visor with glint). But the body below the helmet is pure rectangles — no curvature, no suit folds, no proportion. |
| **Robot** | 178 | Rectangles for everything — head, body, legs, arms, feet. Literally `fillRect` calls. The gauge and rivets are nice details, but the silhouette screams "programmer art." |
| **Newt** | 138 | Single ellipse body, single circle head, stroke-line legs with no joints. Tail is a polyline. Spine spots are tiny dots. The overall shape doesn't read as "newt" — it looks like an orange oval. |
| **Snowman** | 170 | Three circles (good concept, underdeveloped). No smooth overlap between balls. Coal eyes are tiny dots. Twig arms are single stroke lines. Hat is `fillRect`. Scarf is an ellipse + rect stripe — looks like a band-aid. |
| **Submarine** | 193 | Best mechanical character. Ellipse hull, rivets, portholes with face, propeller, periscope — good detail hierarchy. Issues: flat yellow fill (no panel shading), face in porthole is too tiny to read, fins are triangles. |
| **Ice Robot** | 214 | Most detailed. Angular torso, segmented arms, digitigrade legs, visor with scan sweep. But all limbs are stroke lines — no volumetric feel. Torso is a flat-filled trapezoid. Frost vein patterns are barely visible. |
| **Whale** | ~120 | Correct concept (surfacing arc, spout, tail flukes). But body is a plain ellipse with a gradient. No textural detail — no barnacles, no subtle belly-to-back colour transition, no mouth line. Eye is perfunctory. |

### Systemic Problems (Shared Across All Characters)

1. **Stick limbs.** Nearly every character draws arms and legs as `ctx.stroke()` lines — a single-pixel-wide (or 2-3px) line. Real cartoon characters have **filled, shaped limbs** (tapered ovals, rounded rectangles, or Bézier-outlined shapes).

2. **No outlines.** Cartoon characters almost universally have a **dark outline** (1-2px) around their filled shapes. None of the characters do this. Without an outline, the flat fills bleed into the background — especially on gaseous planets where the ground is a soft gradient.

3. **Flat fills, no shading.** Most shapes use a single `fillStyle` colour. The alien body and snowman balls use radial gradients (good), but everything else is flat. Cartoon characters need **at least a 2-stop radial/linear gradient** on every major body part to suggest volume. Highlights and shadow zones are critical.

4. **No soft edges.** The canvas `shadowBlur` / `shadowColor` API can add a soft glow or subtle drop shadow beneath characters for free. Nobody uses it. Characters look like they're pasted on top of the world rather than existing in it.

5. **Circle/rect silhouettes.** Every shape is either `arc()` (circle), `fillRect()` (rectangle), `ellipse()`, or a simple polygon. Actual cartoon bodies are built from **Bézier curves** (`quadraticCurveTo` / `bezierCurveTo`) that create organic, asymmetric, appealing silhouettes. The submarine and whale use a few, others use none.

6. **Proportions don't follow cartoon conventions.** Cartoon characters typically have oversized heads (30-40% of total height), small bodies, and chunky extremities. Most of our characters have head-to-body ratios that are too realistic (head = 10-15% of height), making them look like miniatures rather than cartoon characters.

7. **Eyes lack life.** In cartoons, eyes carry all the emotion. Our characters mostly have single-dot pupils or simple filled circles. They need: larger eye whites, iris colour, a catch-light (white dot highlight), and variation between states (happy squint, startled wide, running focused).

8. **No consistent style.** Each character was written independently with different conventions — some use `ctx.save()/restore()` nesting, others don't; some calculate sizes from `h`, others from `s`; some use gradients, others flat fills. They don't look like they belong in the same game.

---

## 2. What "Good Cartoon Characters" Look Like in Canvas

The target quality level is something like **Angry Birds** characters or **Cut the Rope** — simple enough to be drawn procedurally in canvas, but with enough craft to look charming. Key properties:

1. **Bold dark outline** around every shape (1.5-3px depending on zoom).
2. **Gradient fills** on every major body part — radial for round shapes, linear for elongated ones.
3. **Bézier-curve silhouettes** — no straight-edged rectangles for organic shapes.
4. **Oversized expressive features** — big eyes with catch-lights, wide mouths, exaggerated reactions.
5. **Layered drawing order** — back arm → body → front arm → head → features, creating depth.
6. **Consistent proportions** — big head, compact body, chunky limbs.
7. **Subtle ambient effects** — soft shadow beneath the character, slight outline glow.

---

## 3. Reusable Utility Toolkit

Before rewriting 9 characters, we should build a small set of **shared drawing helpers** that enforce consistency. This avoids each character reinventing the same patterns and ensures a unified style.

### Proposed Helper Functions

```
renderer-helpers (inside the Renderer IIFE):

outlinedCircle(x, y, r, fill, outlineColor, outlineWidth)
  — Draws a filled circle with a dark outline. Used for heads, eyes, body blobs.

outlinedEllipse(x, y, rx, ry, fill, outlineColor, outlineWidth)
  — Same for ellipses (bodies, helmets, hulls).

outlinedPath(pathFn, fill, outlineColor, outlineWidth)
  — Takes a function that builds a path (Bézier curves etc.), fills it, then strokes with the outline.
  — This is the workhorse for complex organic shapes.

gradientCircle(x, y, r, colorTop, colorBottom, outlineColor)
  — Draws a circle with a 2-stop radial gradient (highlight to shadow) + outline.
  — Perfect for heads, snowman balls, alien body.

gradientEllipse(x, y, rx, ry, colorLight, colorDark, outlineColor)
  — Gradient-filled ellipse with outline.

cartoonEye(x, y, size, pupilDir, state)
  — Draws a complete cartoon eye: white sclera, coloured iris, black pupil, white catch-light dot.
  — `pupilDir` = {x, y} to make the eye track movement direction.
  — `state` = 'normal' | 'startled' | 'happy' | 'angry' for expression variants.
  — This single helper will fix the biggest visual problem across all characters.

cartoonLimb(x1, y1, x2, y2, thickness, fill, outlineColor)
  — Draws a tapered rounded-rect limb between two points. Not a line — a filled shape with width.
  — Uses perpendicular offset from the line to create a proper limb outline.

dropShadow(x, y, width, opacity)
  — Draws a soft grey ellipse beneath the character's feet to ground them in the scene.
```

**Why this matters:** With these 8 helpers, rewriting each character becomes **assembling parts from a kit** rather than hand-coding every `beginPath/fill/stroke` sequence. It also guarantees that outlines, gradients, and eye expressions are consistent across all 9 characters without duplicating code.

Estimated size: ~80-120 lines for all helpers combined.

---

## 4. Per-Character Redesign Notes

### 4.1 Golfer (Earth)

**Current:** Stick figure.
**Target:** Stocky cartoon golfer — big round head (flat cap), polo shirt body, chunky legs in plus-fours.

Key changes:
- **Head:** `gradientCircle` with skin tone. Larger (25% of height). Add simple nose (small arc), smile line, rosy cheeks (two pink circles at low opacity).
- **Eyes:** Replace single dot with `cartoonEye` — white with dark pupil and catch-light. Eyes look in movement direction. Startled = giant white circles.
- **Cap:** Build from Bézier path — slightly curved brim, rounded crown. Not an ellipse.
- **Body:** Replace stroke-line torso with `outlinedEllipse` — polo shirt colour (pastel green or white). Add collar detail (two small lines at neck). Red stripe as decorative band.
- **Legs:** Replace stroke lines with `cartoonLimb` calls — khaki plus-fours (wide at knee, narrow at ankle). Shoes as outlined rounded rects.
- **Arms:** `cartoonLimb` — skin-tone upper arms, polo-shirt-colour shoulders. Golf glove on one hand (white circle).
- **Club:** Thicker shaft (2-3px), proper club head shape (small filled Bézier).
- **Ground shadow:** `dropShadow` beneath feet.

### 4.2 Alien (Mars)

**Current:** Green blob with stroke tentacles.
**Target:** Cute round alien — big gradient body, huge expressive 3 eyes, thicker wavy tentacles.

Key changes:
- **Body:** Already has gradient — keep, but add dark outline via `outlinedCircle`. Increase highlight intensity (brighter green spot near top-left).
- **Eyes:** Much larger. Use `cartoonEye` ×3 (each with yellow iris). The third (top) eye should be slightly smaller. In idle, one eye blinks occasionally (draws as a squished arc instead of full circle). In startled, all 3 go huge with tiny pupils.
- **Tentacle arms:** Replace single quadratic curve with **double curves** (two parallel Bézier paths with decreasing width) to give thickness. Or draw as filled shapes using `outlinedPath`. Add sucker-dot details (tiny circles along the underside).
- **Legs:** Replace stroke lines with small filled ovals (stubby feet).
- **Antenna:** Thicker stalks, larger glowing tips. Add a faint radial glow via `shadowBlur`.
- **Mouth:** Add a small curved mouth line (smile when idle, "O" when startled).
- **Ground shadow:** `dropShadow`.

### 4.3 Spaceman (Moon)

**Current:** Rectangular suit, good helmet visor.
**Target:** Cute chibi astronaut — rounder suit, chunky boots, oversized helmet.

Key changes:
- **Helmet:** Already decent — increase size to 35% of total height. Add second glint dot. Thicker outline. The visor gradient is good; intensify it.
- **Suit body:** Replace `fillRect` with `outlinedEllipse` or rounded Bézier shape. Broader shoulders, narrower waist. Keep the red NASA stripe but curve it around the body.
- **Backpack:** Replace rectangle with rounded shape. Add small detail lines (tubes, vents).
- **Legs:** Replace stroke lines with `cartoonLimb` — thick white suit legs. **Boots:** Replace `fillRect` with `outlinedEllipse` — chunky grey moon boots.
- **Arms:** Replace stroke lines with `cartoonLimb` — puffy suit arms. Gloves already circles — make them bigger.
- **Face in visor:** Currently only shown when startled. Add a simple happy face in normal state too (two dots and a curve, seen through the visor tint). This makes the character feel alive at all times.
- **Ground shadow:** `dropShadow`.

### 4.4 Robot (Mercury)

**Current:** All rectangles.
**Target:** Retro tin-toy robot with rounded corners, metallic gradients, chunky proportions.

Key changes:
- **Head:** Replace `fillRect` with rounded rectangle (via `outlinedPath` with arc corners or a helper). Add gradient (metallic sheen — lighter on top, darker on bottom). Eyes stay as LED dots but make them larger with a subtle glow ring.
- **Body:** Rounded rectangle with **metallic gradient** (light left, dark right to suggest cylinder). Keep rivets but make them larger and add a shadow dot beside each one. The chest gauge is a nice detail — make it bigger (15% of body width) and add a glass-cover highlight (semicircle of white at low opacity).
- **Arms:** Replace `fillRect` with rounded tapered shapes. Pincers should be chunkier — two small filled arcs instead of thin stroke lines.
- **Legs:** Replace `fillRect` with rounded rectangles. Bigger feet with flat soles (rounded rects).
- **Antenna:** Keep zigzag but make it thicker (2-3px stroke). Antenna ball larger with radial gradient (yellow highlight). Add subtle glow when startled via `shadowBlur`.
- **Outline:** Dark brown outline around everything (matches the warm Mercury palette).
- **Ground shadow:** `dropShadow`.

### 4.5 Newt (Venus)

**Current:** Orange ellipse, doesn't really look like a newt.
**Target:** Cute chunky salamander with a distinctive silhouette — wide grinning mouth, big googly eyes, visible toes, curly tail.

Key changes:
- **Body:** Replace single ellipse with **Bézier-defined body shape** — wider at the shoulders, tapering toward the tail. Slight belly bulge underneath. Orange-to-red gradient with darker back ridge.
- **Head:** Distinct from body (currently just a circle bump). Build a proper wider head shape — broad and flat (salamander-like). Wide mouth line (cute grin when idle, open "O" when startled).
- **Eyes:** Much larger — 20% of body length each. Use `cartoonEye` with bright yellow iris. Eyes protrude slightly above the head line (like a real newt). Should bulge comically when startled.
- **Legs:** Replace stroke lines with small filled limb shapes. Each leg has 4 visible toes (small dots/ovals at the end). Legs attach at clear shoulder/hip points.
- **Tail:** Replace polyline stroke with a filled, tapered Bézier shape — wide at base, thin and curly at tip. Stripe pattern along the tail (alternating orange/dark bands).
- **Spots:** Larger, fewer, more deliberate. 3 large darker spots along the back with slight gradient.
- **Glow:** Keep the warm-beneath glow, increase opacity slightly. Add it as a proper `shadowColor`/`shadowBlur` on the body fill.
- **Ground shadow:** `dropShadow` (tinted warm orange for Venus).

### 4.6 Snowman (Neptune)

**Current:** Three circles — recognisable concept but flat.
**Target:** Charming, textured snowman with visible snow texture, better accessories.

Key changes:
- **Snow balls:** Already have radial gradients (good). Add a subtle **blue-white speckle texture** — 8-10 tiny white dots at random positions within each ball, drawn at low opacity, to simulate granular snow. Add dark outline.
- **Overlap shadows:** Where each ball sits on the one below, draw a soft shadow crescent (dark arc at the contact point) to sell the 3D stacking.
- **Eyes:** Replace tiny dots with `cartoonEye` — coal-black iris, no white sclera (keep them as coal, but larger and slightly irregular — use small filled polygons instead of circles).
- **Mouth:** Replace dot-row with a proper curved line of larger coal pieces.
- **Carrot nose:** Replace flat triangle with a Bézier-outlined 3D carrot — tapered cone shape with a subtle orange gradient and a tiny green leaf tuft at the base.
- **Arms:** Replace stroke lines with actual **twig branches** — multiple Bézier curves forking from the shoulder point. Brown with slight wood-grain texture (darker streaks).
- **Scarf:** Replace ellipse+rect with a Bézier-path draped scarf — two hanging ends with stripes. Should wrap between head and middle ball and dangle to one side.
- **Hat:** Replace `fillRect` with a proper top hat shape — slightly wider at the top, with a band/ribbon detail. Rounded edges on the brim.
- **Ice crystals:** Already good — increase size slightly and add a faint blue glow.
- **Ground shadow:** `dropShadow`.

### 4.7 Submarine (Saturn)

**Current:** Best mechanical character — decent base.
**Target:** Charming Beatles-style yellow sub with depth, character, and polish.

Key changes:
- **Hull:** Keep ellipse but add **panel shading** — a horizontal gradient (brighter yellow on top, darker mustard on bottom) to suggest a rounded hull. Add a waterline shadow (soft dark band across the lower third). Dark outline.
- **Portholes:** Larger. Each has a thick brass rim (`outlinedCircle` with gold border), glass fill (blue gradient lighter at top = sky reflection). The face-porthole should be 60% bigger with a clearly readable face — use `cartoonEye` ×2 inside.
- **Conning tower:** Replace `fillRect` with a rounded shape. Add a hatch wheel detail (small circle with lines).
- **Periscope:** Thicker, with a proper lens housing (small cylinder at the end, not a tiny rect). Add a lens flare dot.
- **Propeller:** Replace stroke lines with filled blade shapes (small ellipses at angles).
- **Rivets:** Slightly larger, with shadow dots to suggest depth.
- **Fins:** Replace triangles with smoother fin shapes (Bézier curves with rounded tips).
- **Bubbles:** Add a white edge highlight to each bubble (crescent arc inside the circle). Vary sizes more.
- **Ground shadow:** `dropShadow` beneath hull.

### 4.8 Ice Robot (Uranus)

**Current:** Most detailed but still stroke-line limbs and flat trapezoid body.
**Target:** Sleek crystalline mech with volumetric limbs and glowing accents.

Key changes:
- **Body:** Replace flat trapezoid with **Bézier-outline** torso — slightly curved sides, armored panel look. Icy-blue gradient (lighter at chest centre, darker at edges). Add a subtle transparency effect (semi-transparent fill with frost lines visible through it).
- **Head:** Keep trapezoid but round the corners via Bézier or arc. Visor stays but make it taller (30% of head height). Add a scanning "pupil" — a brighter dot that follows movement direction within the visor sweep. Add visor edge glow via `shadowBlur`.
- **Arms:** Replace stroke lines with `cartoonLimb` calls — segmented, tapered, with visible joint spheres. Claws should be 3 small filled Bézier blades, not stroke lines.
- **Legs:** Replace stroke lines with filled segmented digitigrade limbs. Thicker upper leg, thinner lower leg, round ankle joints, flat ski-like feet.
- **Frost veins:** Make them more visible — increase opacity, add branching (each vein forks once). Random positions seeded from character state so they don't shift.
- **Particles:** Larger frost motes with a faint blue glow. Should drift downward and fade.
- **Ground shadow:** `dropShadow` (tinted icy blue).

### 4.9 Whale (Jupiter)

**Current:** Functional but plain — dark ellipse, minimal detail.
**Target:** Majestic cartoon whale — smooth body contours, visible markings, charming spout.

Key changes:
- **Body:** Replace single ellipse + gradient with a **Bézier-curve body outline** — proper whale shape with a dorsal curve, gentle snout taper, and fluked tail. Two-tone: darker blue-grey on top, slightly lighter on the underside visible at the waterline transition. Dark outline.
- **Eye:** Larger, with a white sclera, dark iris, and catch-light. Should convey gentle personality — slightly droopy eyelid when idle, wide open when startled.
- **Mouth line:** Add a long curved mouth line from snout to midway along the body (whales have a visible mouth crease). Slight upward curve = permanent gentle smile.
- **Blowhole:** Slightly larger opening. When active, add a small dark nostril flap detail.
- **Spout:** Replace plain dots with **layered fountains** — a central column of larger droplets plus a misty outer spray (smaller, more transparent dots). At the top, droplets arc outward in a classic whale-spout V shape.
- **Tail flukes:** Replace flat quadratic with Bézier-outlined flukes — proper whale tail shape with a pointed tip on each side and a notch in the centre. Slightly lighter colour on the underside.
- **Surface interaction:** Where the body meets the surface line, draw a few splash/wave shapes (small white Bézier arcs) to sell the "breaking surface" effect.
- **Barnacle details:** 2-3 tiny rough circles on the back (grey, slightly lighter than body) for character.
- **Ground shadow:** Not applicable (whale is in the gas surface), but surface ripples should be more visible.

---

## 5. Implementation Strategy

### 5.1 Approach: Incremental Rewrite In-Place

Each `drawXxx` function gets **replaced entirely** with a new version. No need to change `main.js`, the state machine, `drawCharacter()` dispatch, `CHAR_THOUGHTS`, or any game logic. The function signatures stay identical: `drawXxx(cx, cy, s, char)`.

This is purely a rendering upgrade — the safest kind of change.

### 5.2 Phased Order

| Phase | What | Est. lines | Why this order |
|-------|------|-----------|---------------|
| **0** | Build the shared helper toolkit | ~100 | Everything depends on this. Write once, use everywhere. |
| **1** | Alien (Mars) | ~180 | Already the closest to "good" — smallest delta. Good test that the helpers work. |
| **2** | Golfer (Earth) | ~200 | Earth is the default planet. Users see this first. High impact. |
| **3** | Spaceman (Moon) | ~200 | Popular planet, fun character, good helmet base to build on. |
| **4** | Snowman (Neptune) | ~200 | Recognisable concept, mostly needs texture & accessory polish. |
| **5** | Robot (Mercury) | ~190 | All rects → rounded shapes, metallic gradients. Medium effort. |
| **6** | Submarine (Saturn) | ~210 | Already the best mechanical character — enhancement pass. |
| **7** | Newt (Venus) | ~200 | Needs the most silhouette redesign work (current shape is wrong). |
| **8** | Ice Robot (Uranus) | ~220 | Most detailed, benefits from helpers already being battle-tested. |
| **9** | Whale (Jupiter) | ~180 | Unique behaviour, can't test walk/idle — do last, focus on surfacing art. |

**Total estimated: ~100 (helpers) + ~1,780 (characters) ≈ 1,880 lines of new drawing code,** replacing ~1,540 existing lines. Net growth ~340 lines.

### 5.3 Work Per Character (Template)

Each character rewrite follows this pattern:

1. **Delete** the old `drawXxx` function entirely.
2. **Write new function** using the helper toolkit, following the redesign notes in Section 4.
3. **Test each state:** idle, walking, startled, running_away, squashed, returning. (Whale: submerged, surfacing, spouting, diving, squashed.)
4. **Check zoom levels:** Verify character looks good at default PPM (80), zoomed-out (~5 PPM), and zoomed-in.
5. **Check planet surface:** Verify character sits correctly on its planet's ground/gas surface.

### 5.4 What NOT To Change

- **No state machine changes.** All states, timers, transitions, and thought bubbles stay exactly as they are.
- **No new files.** Helpers go inside the existing Renderer IIFE in `renderer.js`.
- **No external assets.** Everything stays procedural canvas — no images, no SVGs, no sprite sheets.
- **No new dependencies.** Pure vanilla JS + Canvas 2D API.

---

## 6. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Helpers don't cover all cases | Medium | Keep helpers simple and focused. Let individual draw functions do bespoke work where needed — helpers are a convenience, not a straitjacket. |
| Characters look worse at extreme zoom-out | Medium | All sizes derive from `s` (= max(18, currentPPM)). At very small `s`, simplify: skip tiny details like catch-lights and rivets when `s < 25`. Add a conditional early in each function. |
| Bézier curves are hard to get right | Low-Medium | Use reference shape coordinates planned on paper first. Each curve is just 2-3 control points — not complex. The helpers wrap the boilerplate. |
| Performance regression (more draw calls per character) | Low | Only 1 character is visible at a time. Even 200 draw calls per character at 60fps is negligible for a single canvas entity. |
| Inconsistent style between old and new during partial rollout | Low | Rewrite one character at a time, fully. Each is self-contained. |

---

## 7. Summary

The characters currently look like programmer art because they're built from rectangles, stroke lines, and flat fills. Making them look like proper cartoon characters requires:

1. **A small shared toolkit** (8 helper functions, ~100 lines) that enforces outlines, gradients, proper eyes, and filled limbs.
2. **A full rewrite of each draw function** (9 characters, ~200 lines each) using Bézier curves for organic silhouettes, radial gradients for volume, `cartoonEye` for expression, and `cartoonLimb` for proper limbs.
3. **Roughly 10 incremental phases** (helpers + 9 characters), each independently testable.

No game logic, state machines, or file structure changes needed. It's a pure visual polish pass. The estimated scope is ~1,900 lines of new code replacing ~1,500 lines — achievable in focused implementation phases.
