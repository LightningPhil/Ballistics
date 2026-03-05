# Launch Lab

A physics sandbox for exploring projectile motion and rocket propulsion. Fire cannons across different planets or design and launch rockets with real engine parameters.

## Features

- **Cannon Mode** — Adjust angle, force, mass, and barrel length; fire projectiles and observe trajectories, energy conservation, and impact physics.
- **Rocket Mode** — Select propellant combos, configure chamber pressure, nozzle geometry, and vehicle mass; simulate continuous-thrust flight with guidance modes (gravity turn, pitch program, prograde lock).
- **Multi-planet environments** — Moon, Mercury, Mars, Venus, Earth, Jupiter, Saturn, Neptune, Uranus with accurate gravity and unique visual themes.
- **Live telemetry** — Real-time readouts for velocity, altitude, energy, thrust, Isp, Δv, T/W ratio, and more.
- **Nozzle cutaway** — Parametric cross-section overlay showing how engine parameters shape nozzle geometry.

## Project Structure

```
├── index.html              # App shell and DOM structure
├── src/
│   ├── main.ts             # Entry point, animation loop, game state
│   ├── physics.ts          # Cannon projectile physics engine
│   ├── rocket_propellants.ts  # Propellant registry and performance tables
│   ├── rocket_physics.ts   # Continuous-thrust rocket physics engine
│   ├── nozzle_render.ts    # Parametric nozzle cutaway renderer
│   ├── renderer.ts         # Canvas drawing (planets, vehicles, effects)
│   ├── ui.ts               # DOM controls, sliders, readouts, tooltips
│   └── style.css           # All visual styling
├── docs/                   # Design specs and planning docs
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
└── package.json
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens a local dev server with hot module replacement.

### Build

```bash
npm run build
```

Type-checks with `tsc` then builds an optimised bundle into `dist/`.

### Preview

```bash
npm run preview
```

Serves the production build locally.

## Tech Stack

- **TypeScript**
- **Vite**
- **Canvas API** (no framework — all rendering is hand-written)

## License

This project is proprietary and confidential. All rights reserved. See [LICENSE](LICENSE) for details.
