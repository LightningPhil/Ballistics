import type { FlightRecord } from './flight.ts';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const smootherstep = (x: number) => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };

/** A continuous target profile between real recorded events. No slow motion.
 * The log-rate spring below limits both acceleration and rate of change. */
export function automaticRate(run: FlightRecord, time: number): number {
  if (run.duration < 18) return 1;
  const times = [...new Set([0, ...run.events.map(e => e.time), run.duration])].sort((a, b) => a - b);
  let start = 0, end = run.duration;
  for (const at of times) { if (at <= time) start = at; else { end = at; break; } }
  const gap = end - start;
  if (gap < 12) return 1;
  const distance = Math.max(0, Math.min(time - start, end - time) - 2);
  const ceiling = Math.min(64, Math.max(1, gap / 9));
  if (run.duration > 90) {
    // Begin a gentle acceleration soon after the moment has registered. Start
    // braking well before the next event; the spring never snaps to this cap.
    const growth = 1 + (ceiling - 1) * smootherstep((time - start - 2) / 6);
    const approach = 1 + Math.max(0, end - time - 3) / 3.5;
    return Math.min(growth, approach);
  }
  return 1 + (ceiling - 1) * smootherstep(distance / Math.max(8, gap * 0.32));
}

export class PlaybackClock {
  time = 0;
  paused = true;
  mode: 'auto' | number = 'auto';
  private logRate = 0;
  private rateVelocity = 0;
  get rate() { return Math.max(1, Math.exp(this.logRate)); }
  load() { this.time = 0; this.logRate = 0; this.rateVelocity = 0; this.paused = false; }
  select(mode: 'auto' | number) { this.mode = mode === 'auto' ? 'auto' : clamp(mode, 1, 64); }
  seek(time: number, duration: number) {
    this.time = clamp(time, 0, duration); this.paused = true; this.logRate = 0; this.rateVelocity = 0;
  }
  advance(wallSeconds: number, run: FlightRecord) {
    if (this.paused) return;
    let remaining = Number.isFinite(wallSeconds) ? Math.max(0, wallSeconds) : 0;
    while (remaining > 1e-8) {
      const dt = Math.min(1 / 120, remaining); remaining -= dt;
      const target = Math.log(this.mode === 'auto' ? automaticRate(run, this.time) : this.mode);
      const acceleration = clamp(3 * (target - this.logRate) - 3.5 * this.rateVelocity, -0.6, 0.6);
      this.rateVelocity = clamp(this.rateVelocity + acceleration * dt, -0.65, 0.65);
      this.logRate = clamp(this.logRate + this.rateVelocity * dt, 0, Math.log(64));
      if (this.logRate === 0 && this.rateVelocity < 0) this.rateVelocity = 0;
      this.time = Math.min(run.duration, this.time + this.rate * dt);
      if (this.time >= run.duration) { this.paused = true; break; }
    }
  }
}
