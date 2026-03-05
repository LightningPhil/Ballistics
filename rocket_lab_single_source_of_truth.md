# Rocket Lab Web App
## Single Source of Truth: Mechanics + Propellant Reference + Data Schema (No-Atmosphere Flight)

This document is the **canonical specification** for a browser-based “Rocket Lab” sandbox. It defines **exact mechanics** (propulsion + mass + trajectory) and a **propellant performance data model** suitable for fast runtime interpolation (precomputed from NASA CEA / RocketCEA).  
**Aesthetics are explicitly out of scope.**

---

## 0) Scope and guiding choices

### What we simulate
- **2D point-mass rocket** with position \((x,y)\), velocity \((v_x,v_y)\), and mass \(m(t)\).
- **Thrust** acts along a direction \(\hat{\mathbf{t}}(t)\) determined by launch angle or a simple guidance rule.
- **Uniform constant gravity** downward: \(g\) (default \(9.80665\ \mathrm{m/s^2}\)).
- **No aerodynamic forces**: no drag, no lift, no winds. (We still keep ambient pressure \(p_a\) as a nozzle-performance knob for teaching.)

### What we compute from propellant + nozzle
We compute \(c^*\) (characteristic velocity), \(C_F\) (thrust coefficient), \(I_{sp}\), and optionally \(p_e/p_c\), \(T_c\), effective \(\gamma\), etc., via **precomputed tables** derived from NASA CEA (recommended). CEA explicitly provides rocket performance quantities including \(c^*\) and \(I_{sp}\), with equilibrium vs frozen expansion options.

### Canonical decomposition (engine performance)
\[
\dot m = \frac{p_c A_t}{c^*},\qquad
F = C_F\,p_c A_t,\qquad
I_{sp} = \frac{F}{\dot m g_0}=\frac{C_F c^*}{g_0}
\]

This decomposition is the app’s “physics spine”. Everything else plugs into it.

---

## 1) User-facing parameter set

### Environment
- Gravity \(g\) (m/s²)
- Ambient pressure \(p_a\) (Pa)
  - For “vacuum nozzle performance”, set \(p_a=0\).
  - For “sea-level nozzle performance”, set \(p_a=101325\ \mathrm{Pa}\).

### Vehicle
- Dry mass \(m_{dry}\) (kg)
- Propellant mass \(m_{prop,0}\) (kg)
- Initial position \((x_0, y_0)\), with \(y_0=0\)
- Initial velocity \((v_{x0}, v_{y0})\) (usually 0)
- Launch angle \(\theta_0\) (deg or rad; pick one unit in UI and convert internally)

### Guidance / steering (thrust direction)
- Mode A: **Fixed angle** \(\theta(t)=\theta_0\)
- Mode B: **Pitch program** ramp \(\theta(t)\) from \(\theta_0\) to \(\theta_f\)
- Mode C: **Prograde lock** (“toy autopilot”) once speed exceeds \(v_{min}\)

### Engine / nozzle
- Propellant combo (from a predefined set; see Section 2)
- Mixture ratio \(MR = O/F\) (oxidizer-to-fuel **by mass**)
- Chamber pressure \(p_c\) (Pa)
- Expansion ratio \(\varepsilon = A_e/A_t\)
- Throat area \(A_t\) (m²) **or** throat diameter \(d_t\)
- Efficiencies (optional but very useful)
  - Combustion efficiency \(\eta_c\) (scales \(c^*\))
  - Nozzle efficiency \(\eta_n\) (scales \(C_F\))
- Throttle (optional)
  - Throttle fraction \(\tau(t)\in[0,1]\) (default 1)

### Burn termination
- “Burn until propellant exhausted” (default)
- or “Fixed burn time” \(t_{burn}\)

---

## 2) Propellant reference set (fuel/oxidizer info + bounds)

This section defines the **initial propellant library** and the **default slider bounds**. Your runtime truth should come from CEA-derived grids.

> Note on naming:
> - **LOX** = liquid oxygen  
> - **LH2** = liquid hydrogen  
> - **CH4** = methane  
> - **RP‑1** = rocket-grade kerosene  
> - **N2O4** = dinitrogen tetroxide  
> - **MMH** = monomethylhydrazine  
> - **UDMH** = unsymmetrical dimethylhydrazine  
> - **Aerozine‑50** = 50/50 hydrazine + UDMH (storable hypergolic blend)  
> - **H2O2** = hydrogen peroxide (concentration matters)  
> - **IRFNA** = inhibited red fuming nitric acid (storable oxidizer)

### 2.1 Cryogenic oxygen + fuels
#### LOX/LH2
- **Traits**: Highest chemical Isp class; low density LH2; cryogenic storage and insulation.
- **Typical MR behavior**: Many engines run **oxidizer-richer than peak-Isp** for cooling/cycle reasons.
- **Default MR bounds**: **4.5 → 6.5**
- **Notes to show in UI**: “Very high Isp, low density fuel, large tanks; good vacuum performance.”

#### LOX/CH4
- **Traits**: Cryogenic but denser than LH2; clean combustion; good compromise.
- **Default MR bounds**: **3.0 → 4.0**
- **UI note**: “Mid-high Isp; denser than LH2; good for reusability/cleaner operation.”

#### LOX/RP‑1 (kerosene)
- **Traits**: Dense and practical; strong sea-level booster propellant; lower vacuum Isp than CH4/LH2.
- **Default MR bounds**: **2.2 → 2.9**
- **UI note**: “Great liftoff thrust for given tank size; lower Isp than CH4/LH2.”

### 2.2 Storables / hypergolics
#### N2O4/MMH
- **Traits**: Storable; hypergolic ignition; common for spacecraft and restartable engines.
- **Default MR bounds**: **1.8 → 2.3**
- **UI note**: “Lower Isp than cryogenics; excellent storability and ignition reliability.”

#### N2O4/UDMH
- **Traits**: Storable; hypergolic; historically common.
- **Default MR bounds**: **1.4 → 1.9**

#### N2O4/Aerozine‑50
- **Traits**: Storable hypergolic blend; historic usage for temperature handling/storage robustness.
- **Default MR bounds**: **1.6 → 2.1**

### 2.3 “Other educational” propellants
#### H2O2/RP‑1 (High-test peroxide + kerosene)
- **Traits**: Lower Isp than LOX systems; oxidizer concentration (e.g., 85–98%) affects performance strongly.
- **Default MR bounds**: **6 → 8** (teaching range; refine after grid generation)
- **UI note**: “Interesting ‘simpler oxidizer’ trade; performance depends on concentration.”

#### IRFNA/RP‑1
- **Traits**: Storable oxidizer pairing; lower performance; unpleasant handling; historically important.
- **Default MR bounds**: **4 → 6** (broad teaching range)

### 2.4 “Performance anchors” (sanity checks, not the model)
Use published tabulated performance (e.g., from standard rocket propulsion texts) as **sanity checks** and for “expected class” hints, but **do not** use them as the runtime engine model. The runtime model comes from the precomputed CEA grid (Section 8–11).

---

## 3) Propulsion model (canonical runtime equations)

### 3.1 Effective characteristic velocity
\[
c^*_{eff}=\eta_c\,c^*(MR,p_c)
\]

### 3.2 Mass flow (choked throat)
\[
\dot m = \frac{p_c A_t}{c^*_{eff}}
\]

### 3.3 Effective thrust coefficient
\[
C_{F,eff}=\eta_n\,C_F(MR,p_c,\varepsilon,p_a,\text{eq/frozen})
\]

### 3.4 Thrust
\[
F = C_{F,eff}\,p_c A_t
\]

### 3.5 Isp and exhaust velocity
\[
I_{sp} = \frac{F}{\dot m g_0},\qquad v_e = g_0 I_{sp}
\]

### 3.6 Total impulse
Two equivalent computations:
1) Integrate thrust:
\[
I_{tot} = \int_0^{t_{end}} F(t)\,dt
\]
2) Integrate mass flow and Isp:
\[
I_{tot}=g_0 \int_0^{t_{end}} I_{sp}(t)\,\dot m(t)\,dt
\]

### 3.7 Propellant depletion + mass
\[
\frac{dm_{prop}}{dt}=-\dot m,\qquad m(t)=m_{dry}+m_{prop}(t)
\]

### 3.8 Mixture bookkeeping (tank gauges)
Given \(MR=O/F\):
\[
\dot m_O=\frac{MR}{1+MR}\dot m,\qquad
\dot m_F=\frac{1}{1+MR}\dot m
\]

---

## 4) Flight dynamics (flat world, no drag)

### 4.1 Thrust direction
Define thrust direction unit vector using \(\theta\) from +x axis:
\[
\hat{\mathbf{t}} = (\cos\theta,\sin\theta)
\]

### 4.2 Forces
\[
\mathbf{F_T}=F\hat{\mathbf{t}},\qquad
\mathbf{F_g}=(0,-mg)
\]

### 4.3 Acceleration
\[
\mathbf{a}=\frac{\mathbf{F_T}+\mathbf{F_g}}{m}
\]
Components:
\[
a_x=\frac{F}{m}\cos\theta,\qquad
a_y=\frac{F}{m}\sin\theta - g
\]

### 4.4 Numerical integration (recommended)
Use **semi-implicit Euler**:
1) \( \mathbf{v}_{n+1}=\mathbf{v}_n+\mathbf{a}_n\Delta t\)
2) \( \mathbf{r}_{n+1}=\mathbf{r}_n+\mathbf{v}_{n+1}\Delta t\)

Suggested timestep:
- \(\Delta t = 1/120\ \mathrm{s}\) for smooth animation; decouple render and physics if desired.

### 4.5 Ground contact / impact
If \(y_{n+1}<0\) while descending, compute impact fraction:
\[
\alpha=\frac{y_n}{y_n-y_{n+1}}
\]
\[
x_{impact}=x_n+\alpha(x_{n+1}-x_n)
\]
Stop simulation and report range.

---

## 5) Guidance modes (mechanics)

### Mode A: Fixed angle
\[
\theta(t)=\theta_0
\]

### Mode B: Pitch program (linear ramp)
Ramp \(\theta\) from \(\theta_0\) to \(\theta_f\) between \(t_1\) and \(t_2\):
\[
\theta(t)=\theta_0+(\theta_f-\theta_0)\,\mathrm{clamp}\!\left(\frac{t-t_1}{t_2-t_1},0,1\right)
\]

### Mode C: Prograde lock (toy)
After \(\|\mathbf{v}\|>v_{min}\):
\[
\hat{\mathbf{t}}=\frac{\mathbf{v}}{\|\mathbf{v}\|}
\]
Fallback to fixed \(\theta\) if \(\|\mathbf{v}\|\) is near zero.

---

## 6) Rocket equation module (Δv intuition)

Include the Tsiolkovsky rocket equation as a comparator (ideal, no gravity loss):

\[
\Delta v = v_e\ln\left(\frac{m_0}{m_f}\right)
\quad\text{where}\quad
v_e=g_0 I_{sp}
\]
\[
m_0=m_{dry}+m_{prop,0},\qquad m_f=m_{dry}
\]

Display alongside the integrated burnout velocity magnitude \(\|\mathbf{v}(t_{cutoff})\|\). Their difference is primarily gravity loss in this drag-free model.

---

## 7) Engine operating modes (user experience without breaking physics)

### Mode 1: User sets \(p_c\) and \(A_t\)
Compute:
\[
\dot m = \frac{p_c A_t}{c^*_{eff}},\qquad F = C_{F,eff}p_c A_t
\]
Burn time (if constant):
\[
t_{burn}=\frac{m_{prop,0}}{\dot m}
\]

### Mode 2: User sets thrust target \(F_{target}\)
Solve for throat area:
\[
A_t = \frac{F_{target}}{C_{F,eff}p_c}
\]
Then compute \(\dot m\), burn time.

### Mode 3: Throttle
Simplest consistent throttle: scale chamber pressure:
\[
p_c(t)=\tau(t)\,p_{c,nom}
\]
Recompute \(\dot m(t)\) and \(F(t)\) each step using the same canonical equations.

---

## 8) CEA-derived performance tables: runtime strategy

### 8.1 Why precompute
NASA CEA is a strong reference for equilibrium chemistry and rocket performance output. Running it in-browser is not desirable; instead:
- Generate grids offline (CEA or RocketCEA wrapper).
- Package as compact JSON (or binary) files.
- Interpolate at runtime.

### 8.2 What the grid must provide
At minimum, per grid point:
- \(c^*\) (m/s)
- \(C_F\) (dimensionless) **or** \(I_{sp}\) (s)

Recommended additional (optional) values for UI/teaching:
- chamber temperature \(T_c\) (K)
- exit pressure ratio \(p_e/p_c\)
- effective \(\gamma\) / molecular weight
- flags for likely overexpansion regime (heuristic only)

### 8.3 Equilibrium vs frozen
Store both datasets (two “expansion models”). Allow toggle:
- Equilibrium expansion tends to be slightly more optimistic early in expansion; frozen can be more realistic for fast expansions.

---

## 9) Concrete grid plan (per propellant)

Design goal: stable interpolation without artifacts near optimum MR, and reasonable file sizes.

### 9.1 Common axes
Use consistent axes across propellants where possible.

#### Chamber pressure axis \(p_c\) (bar)
Default set:
- **10, 20, 40, 70, 100, 150, 200, 300 bar** (8 points)

#### Expansion ratio axis \(\varepsilon=A_e/A_t\)
Default set:
- **5, 10, 20, 40, 60, 100, 150, 200** (8 points)

#### Ambient pressure axis \(p_a\)
At minimum:
- **0 Pa**, **101325 Pa** (2 points)

#### Expansion model
- **equilibrium**, **frozen** (2 datasets)

### 9.2 Mixture-ratio axis \(MR\) per propellant
Recommended sampling (denser where performance is steep vs MR):

- **LOX/LH2**: MR 4.0 → 7.0, **41 points**
- **LOX/CH4**: MR 2.8 → 4.3, **31 points**
- **LOX/RP‑1**: MR 2.0 → 3.2, **31 points**
- **N2O4/MMH**: MR 1.6 → 2.6, **25 points**
- **N2O4/UDMH**: MR 1.2 → 2.1, **25 points**
- **N2O4/AZ‑50**: MR 1.3 → 2.3, **25 points**
- **H2O2/RP‑1**: MR 5.0 → 9.0, **25 points**  
  *(treat peroxide concentration as separate propellant IDs)*
- **IRFNA/RP‑1**: MR 3.0 → 7.0, **25 points**

**File size sanity:**  
Example dataset (31×8×8×2 points) storing float32 cStar and Cf → ~31 kB of raw float data (+ JSON overhead). Very manageable.

### 9.3 Clamping + warnings
At runtime:
- Clamp user inputs to grid bounds.
- Warn when clamped (e.g., “Pc clamped to 300 bar; outside dataset”).

---

## 10) JSON schema for performance tables (runtime-friendly)

This schema supports:
- fast fetch
- compact storage
- simple interpolation

### 10.1 File layout
One file per propellant per expansion model containing both ambient pressures:
- `LOX_LH2_equilibrium.json`
- `LOX_LH2_frozen.json`
- etc.

### 10.2 Canonical JSON structure
```json
{
  "schema_version": "1.0",
  "propellant_id": "LOX_LH2",
  "propellant_name": "LOX/LH2",
  "expansion_model": "equilibrium",
  "axes": {
    "MR":   [4.0, 4.05, 4.10, "..."],
    "Pc_Pa": [1000000, 2000000, "..."],
    "eps":  [5, 10, 20, 40, 60, 100, 150, 200],
    "Pa_Pa": [0, 101325]
  },
  "fields": {
    "cStar_mps": {
      "units": "m/s",
      "shape": ["Pa_Pa", "eps", "Pc_Pa", "MR"],
      "data_f32": "BASE64_ENCODED_LITTLE_ENDIAN_FLOAT32"
    },
    "Cf": {
      "units": "dimensionless",
      "shape": ["Pa_Pa", "eps", "Pc_Pa", "MR"],
      "data_f32": "BASE64_ENCODED_LITTLE_ENDIAN_FLOAT32"
    }
  },
  "optional_fields": {
    "Tc_K": { "shape": ["Pc_Pa", "MR"], "data_f32": "..." },
    "pe_over_pc": { "shape": ["Pa_Pa", "eps", "Pc_Pa", "MR"], "data_f32": "..." },
    "gamma_eff": { "shape": ["Pc_Pa", "MR"], "data_f32": "..." },
    "molWt_gmol": { "shape": ["Pc_Pa", "MR"], "data_f32": "..." }
  },
  "meta": {
    "generated_by": "CEA/RocketCEA grid generator",
    "date_utc": "YYYY-MM-DD",
    "notes": "Any notes about propellant assumptions, e.g., H2O2 concentration."
  }
}
```

### 10.3 Canonical indexing order
Fix indexing so the last axis (MR) is contiguous:
- fastest: MR
- then Pc
- then eps
- then Pa

Linear index:
\[
i = (((i_{Pa}N_\varepsilon + i_{\varepsilon})N_{Pc} + i_{Pc})N_{MR} + i_{MR})
\]

---

## 11) Runtime interpolation (canonical)

Use trilinear interpolation in \((MR, Pc, eps)\), with optional linear interpolation in \(p_a\) between vacuum and 1 atm tables.

### Steps
1) Find bracket indices for each axis:
   - \(MR_{i0}\le MR \le MR_{i1}\)
   - \(Pc_{j0}\le Pc \le Pc_{j1}\)
   - \(\varepsilon_{k0}\le \varepsilon \le \varepsilon_{k1}\)
2) Normalized coordinates:
\[
u=\frac{MR-MR_{i0}}{MR_{i1}-MR_{i0}},\quad
v=\frac{Pc-Pc_{j0}}{Pc_{j1}-Pc_{j0}},\quad
w=\frac{\varepsilon-\varepsilon_{k0}}{\varepsilon_{k1}-\varepsilon_{k0}}
\]
3) Interpolate 8 corners for each field (cStar and Cf)
4) Ambient interpolation (optional teaching approximation):
\[
s=\mathrm{clamp}\left(\frac{p_a}{101325},0,1\right)
\]
\[
X(p_a)= (1-s)X_{vac} + sX_{1atm}
\]

---

## 12) Outputs (mechanics-only)

Real-time readouts / graphs:
- Thrust \(F(t)\)
- Mass flow \(\dot m(t)\)
- Specific impulse \(I_{sp}(t)\)
- Remaining propellant \(m_{prop}(t)\) + oxidizer/fuel split (if shown)
- Vehicle mass \(m(t)\)
- Liftoff thrust-to-weight:
\[
T/W = \frac{F(0)}{m_0 g}
\]
- Total impulse accumulator:
\[
I_{tot}\leftarrow I_{tot}+F\Delta t
\]
- Trajectory \(x(t), y(t)\), apogee, time-to-apogee, range
- Rocket equation \(\Delta v\) vs integrated burnout speed

---

## 13) Golden-path per-timestep update (the canonical algorithm)

At each step \(n \to n+1\):

1) **Guidance**: compute \(\theta_n\), \(\hat{\mathbf{t}}_n\)  
2) **Engine** (if on and propellant remains):
   - lookup/interpolate \(c^*\) and \(C_F\) for (propellant, MR, \(p_c\), \(\varepsilon\), \(p_a\), eq/frozen)
   - apply efficiencies:
     \[
     c^*_{eff}=\eta_c c^*,\quad C_{F,eff}=\eta_n C_F
     \]
   - compute:
     \[
     \dot m_n = \frac{p_c A_t}{c^*_{eff}},\quad F_n = C_{F,eff} p_c A_t
     \]
   - deplete:
     \[
     m_{prop}\leftarrow \max(0, m_{prop}-\dot m_n\Delta t)
     \]
   - if \(m_{prop}=0\): engine off
3) **Mass**: \(m = m_{dry}+m_{prop}\)
4) **Acceleration**:
   \[
   a_x=\frac{F}{m}\cos\theta,\quad a_y=\frac{F}{m}\sin\theta-g
   \]
5) **Integrate** (semi-implicit Euler):
   - \(v\leftarrow v+a\Delta t\)
   - \(r\leftarrow r+v\Delta t\)
6) **Impulse accumulation**:
   - \(I_{tot}\leftarrow I_{tot}+F\Delta t\)
7) **Impact check**:
   - if \(y\le 0\) while descending: compute \(x_{impact}\) and stop

**This is the single source of truth for the simulation.** UI and rendering must call into this without altering it.

---

## 14) Extension hooks (future, non-breaking)
- Add drag by introducing \(\mathbf{F_D}=-\tfrac12\rho C_D A \|\mathbf{v}\|\mathbf{v}\) (then atmosphere matters).
- Add varying gravity \(g(y)\).
- Add staging (multiple \(m_{dry}\), \(m_{prop}\), engine sets).
- Add curved Earth/orbit (switch to inertial frame and central gravity).

---

## Appendix A: Propellant variants to treat as separate IDs
Some things should be separate propellant IDs rather than axes:
- H2O2 concentration (e.g., `H2O2_85`, `H2O2_90`, `H2O2_98`)
- RP‑1 vs generic kerosene approximations
- Different nitric acid formulations (IRFNA variants)

---

## Appendix B: Minimal in-app propellant registry JSON (metadata + bounds)
```json
{
  "propellants": [
    {
      "id": "LOX_LH2",
      "name": "LOX/LH2",
      "category": "cryogenic",
      "MR_bounds": [4.5, 6.5],
      "Pc_bar_bounds": [10, 300],
      "eps_bounds": [5, 200],
      "notes": [
        "Highest Isp class; very low density LH2; large tanks",
        "Many engines run MR ~5.5–6.0 for cooling/cycle reasons"
      ],
      "datasets": {
        "equilibrium": "LOX_LH2_equilibrium.json",
        "frozen": "LOX_LH2_frozen.json"
      }
    }
  ]
}
```

---

**End of document.**
