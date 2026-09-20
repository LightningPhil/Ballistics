# Parametric Rocket Nozzle Visualisation
## Geometry Specification for Interactive Educational App
*(Describes what to draw — NOT how to render or implement drawing)*

> **Status:** Design reference for `src/nozzle_render.ts`. Still the intent
> behind the cutaway; where the two differ, the code is authoritative.

---

# 1. Concept

The nozzle shown to the user is not merely a rocket engine graphic.

It is a **parametric compressible-flow system** whose geometry responds directly to physical engine parameters such as:

- Chamber pressure
- Mass flow rate
- Mixture ratio
- Throat area
- Expansion ratio
- Ambient pressure

The geometry must therefore visually communicate:

Chemical energy → chamber pressure  
Chamber pressure → mass flow  
Mass flow → choking at throat  
Choking → supersonic expansion  
Expansion → exhaust velocity  
Velocity → thrust  

All conveyed purely through **shape and scale changes**.

---

# 2. Canonical Regions to Draw

The nozzle system should always be visually decomposed into the following regions:

[ Feed Lines ] → [ Combustion Chamber ] → [ Converging Section ] → [ Throat ] → [ Diverging Section ]

Each represents a physically meaningful control volume and should remain distinct on screen.

| Region | Physical Meaning |
|--------|------------------|
Feed Lines | Propellant mass flow inputs |
Combustion Chamber | Pressure + temperature reservoir |
Converging Section | Acceleration to Mach 1 |
Throat | Choked flow control |
Diverging Section | Supersonic expansion to exhaust velocity |

---

# 3. Feed System Geometry

## 3.1 Fluid Pipes

Each propellant feed should be drawn as:

circular pipe → valve → injector face

### Visual Rule:

Pipe diameter must scale with propellant mass flow rate:

d_pipe ∝ √(ṁ)

So when mixture ratio changes:

- Fuel pipe thickens or thins
- Oxidiser pipe thickens or thins

This allows the user to visually understand:

> Which propellant dominates the mass flow

---

## 3.2 Valves

Each pipe should contain a valve before entering the chamber.

Valve aperture should scale with:

A_v ∝ ṁ

This visually communicates:

> Flow rate into the pressure system is being regulated

---

# 4. Combustion Chamber

The combustion chamber represents a **constant pressure reservoir**.

It should be drawn as:

- A cylindrical or slightly domed cavity
- With internal fill colour representing chamber pressure

Example mapping:

| Pressure | Fill Colour |
|----------|------------|
Low | Dark red |
Medium | Orange |
High | White-yellow |

So increasing:

- Chamber pressure

results in:

- Brighter internal fill

---

## 4.1 Chamber Volume Coupling

Chamber volume should respond to the **characteristic length** relation:

L* = V_c / A_t

Therefore:

- Increasing throat area
- Should visually increase chamber volume

Even if combustion kinetics are not simulated, this enforces correct proportionality between:

- Chamber size
- Throat size

---

# 5. Converging Section

The converging section connects chamber to throat.

Draw as a smooth inward taper.

The taper angle should respond to contraction ratio:

CR = A_c / A_t

Higher contraction ratio:

- Longer taper

Lower contraction ratio:

- Sharper constriction

This visually communicates:

> Flow is being accelerated toward sonic velocity

---

# 6. Throat

The throat is the **critical flow-control location**.

It must:

- Be the narrowest section
- Have radius defined by:

r_t = √(A_t / π)

Changing:

- Target thrust
- Chamber pressure
- Propellant type
- Mass flow rate

should change:

- Throat radius

Reinforcing:

> Thrust is fundamentally controlled by Pc × At

---

# 7. Diverging Section (Expansion Bell)

After the throat, draw an expanding section.

Its exit radius must follow:

r_e = r_t √ε

Where:

ε = A_e / A_t

Increasing expansion ratio should therefore:

- Widen the exit diameter

---

## 7.1 Length Scaling

Nozzle length should scale with expansion ratio:

L_e ∝ r_t (√ε − 1)

So:

| Expansion Ratio | Visual Effect |
|------------------|--------------|
Small | Short, squat nozzle |
Large | Long, flared nozzle |

This conveys:

> Vacuum-optimised nozzles are long because ambient pressure is low

---

# 8. Exit Plane

Exit diameter:

d_e = 2 r_e

Optional:

Plume width may scale with exit Mach number:

M_e ~ ε

Higher expansion ratio:

- Narrower
- Faster plume

---

# 9. Internal Mass Flow Visualisation

Inside the nozzle, draw streamlines where:

- Line density ∝ mass flow rate

Mach number may be represented by colour:

| Mach Number | Colour |
|------------|--------|
Subsonic | Red |
Sonic | Yellow |
Supersonic | Blue |

So flow appears:

- Red in chamber
- Yellow at throat
- Blue in diverging section

This visually communicates choking.

---

# 10. Geometry Response to User Inputs

| User Parameter | Geometry Change |
|--------------|-----------------|
Mixture ratio | Pipe thicknesses |
Chamber pressure | Chamber fill colour |
Throat area | Throat radius |
Expansion ratio | Exit radius |
Expansion ratio | Nozzle length |
Propellant choice | Plume brightness |
Mass flow rate | Streamline density |
Ambient pressure | Plume over/under-expansion |

---

# 11. Visualised Physical Process

The geometry communicates:

Chemical energy → chamber pressure  
Chamber pressure → mass flow  
Mass flow → choking at throat  
Choking → supersonic expansion  
Expansion → exhaust velocity  
Velocity → thrust  

Through:

Shape changes alone

Which is the defining behaviour of a de Laval nozzle.

---

End of document
