import type { FlightRecord } from './flight.ts';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const smootherstep = (x: number) => { x = clamp(x, 0, 1); return clamp(x * x * x * (x * (x * 6 - 15) + 10), 0, 1); };
export const MAX_AUTO_VIEW_SECONDS = 20;

type AutoProfile = { floor: number; variation: number; apex: number; halfWidth: number };
const profiles = new WeakMap<FlightRecord, AutoProfile>();

function autoProfile(run: FlightRecord): AutoProfile {
  let profile = profiles.get(run);
  if (!profile) {
    // The completed recording tells us the duration before the first frame.
    // This floor alone guarantees at most 20 unpaused viewing seconds. Auto
    // can exceed the manual 64× limit for very long recorded experiments.
    const apexEvent = run.events.find(event => event.kind === 'apex' && event.label !== 'Local high point');
    const apex = apexEvent ? clamp(apexEvent.time / run.duration, 0, 1) : 0;
    profile = {
      floor: Math.max(1, run.duration / MAX_AUTO_VIEW_SECONDS),
      variation: clamp((run.duration - MAX_AUTO_VIEW_SECONDS) / MAX_AUTO_VIEW_SECONDS, 0, 1),
      apex,
      // Keep the small dip clear of both launch and impact, even for an
      // unusually early or late peak. A flight without an apex has no dip.
      halfWidth: Math.min(.16, apex * .5, (1 - apex) * .5),
    };
    profiles.set(run, profile);
  }
  return profile;
}

/** A modest change of pace across the whole flight, never a wait at an event.
 * Short flights stay in real time; long flights start at their required speed.
 * Ignition, burnout, guidance changes and impact do not reset that speed. */
export function automaticRate(run: FlightRecord, time: number): number {
  if (run.duration <= MAX_AUTO_VIEW_SECONDS) return 1;
  const profile = autoProfile(run), progress = clamp(time / run.duration, 0, 1);
  const rise = .25 * smootherstep(progress / .18);
  const dip = profile.halfWidth > 0
    ? .15 * (1 - smootherstep(Math.abs(progress - profile.apex) / profile.halfWidth)) : 0;
  return profile.floor * (1 + profile.variation * Math.max(0, rise - dip));
}

export class PlaybackClock {
  time = 0;
  paused = true;
  mode: 'auto' | number = 'auto';
  private run: FlightRecord | null = null;
  get rate() { return this.mode === 'auto' ? (this.run ? automaticRate(this.run, this.time) : 1) : this.mode; }
  load(run: FlightRecord) { this.run = run; this.time = 0; this.paused = false; }
  select(mode: 'auto' | number) { this.mode = mode === 'auto' ? 'auto' : clamp(Number.isFinite(mode) ? mode : 1, 1, 64); }
  seek(time: number, duration: number) {
    this.time = clamp(time, 0, duration); this.paused = true;
  }
  advance(wallSeconds: number, run: FlightRecord) {
    this.run = run;
    if (this.paused) return;
    let remaining = Number.isFinite(wallSeconds) ? Math.max(0, wallSeconds) : 0;
    if (this.mode !== 'auto') {
      // A fixed choice really is fixed, including switching straight to 1×.
      this.time = Math.min(run.duration, this.time + remaining * this.mode);
    } else {
      // Integrate only the viewing clock. RK4 keeps the gentle profile
      // consistent across display frame rates and long/dropped frames.
      while (remaining > 1e-8 && this.time < run.duration) {
        const dt = Math.min(1 / 120, remaining); remaining -= dt;
        const k1 = automaticRate(run, this.time);
        const k2 = automaticRate(run, this.time + k1 * dt / 2);
        const k3 = automaticRate(run, this.time + k2 * dt / 2);
        const k4 = automaticRate(run, this.time + k3 * dt);
        this.time = Math.min(run.duration, this.time + dt * (k1 + 2 * k2 + 2 * k3 + k4) / 6);
      }
    }
    // Floating-point sums can finish a fraction of a nanosecond short. Snap
    // that rounding residue to the exact recorded endpoint in this frame.
    if (run.duration - this.time <= Math.max(1, run.duration) * 1e-12) {
      this.time = run.duration; this.paused = true;
    }
  }
}
