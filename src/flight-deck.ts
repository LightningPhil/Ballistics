import './flight-deck.css';
import { compatibleRuns, describeChanges, type FlightRecord } from './flight.ts';
import { PlaybackClock } from './playback.ts';

const reducedMotionQuery = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export function formatTime(seconds: number) {
  const whole = Math.floor(Math.max(0, seconds));
  return `${Math.floor(whole / 60).toString().padStart(2, '0')}:${(whole % 60).toString().padStart(2, '0')}`;
}

export class FlightDeck {
  clock = new PlaybackClock();
  run: FlightRecord | null = null;
  baseline: FlightRecord | null = null;
  pinned = false;
  target = 45;
  ghost = true;
  prediction = false;
  vectors = false;
  sound = false;
  banter = true;
  busy = false;
  private element: HTMLElement;
  private status: HTMLElement;
  private lastStatus = '';
  private previousRuns: Partial<Record<FlightRecord['mode'], FlightRecord>> = {};
  onSeek: () => void = () => {};
  onSound: () => void = () => {};
  onReplay: () => void = () => {};
  constructor(parent: HTMLElement) {
    const el = document.createElement('section');
    el.className = 'flight-deck'; el.setAttribute('aria-label', 'Flight clock and notebook');
    el.innerHTML = `<div class="chronograph" aria-hidden="true"><svg viewBox="0 0 100 100">
      <circle class="clock-bezel" cx="50" cy="50" r="48"/>
      <circle class="clock-face" cx="50" cy="50" r="45"/>
      ${Array.from({length: 60}, (_, i) => `<line class="clock-tick${i % 5 ? '' : ' clock-tick-major'}" transform="rotate(${i * 6} 50 50)" x1="50" y1="${i % 5 ? 8 : 7}" x2="50" y2="${i % 5 ? 10 : 14}"/>`).join('')}
      <text x="50" y="25" text-anchor="middle">60</text><text x="78" y="54" text-anchor="middle">15</text>
      <text x="50" y="85" text-anchor="middle">30</text><text x="22" y="54" text-anchor="middle">45</text>
      <circle class="minute-face" cx="50" cy="64" r="11"/><line id="clock-minute" x1="50" y1="64" x2="50" y2="56"/>
      <line id="clock-hand" x1="50" y1="56" x2="50" y2="16"/><circle class="clock-pin" cx="50" cy="50" r="3"/>
      </svg><span class="clock-legend">sec · 30 min</span></div>
      <div class="flight-instruments"><div class="clock-heading"><span class="eyebrow">FLIGHT TIME</span>
      <output id="flight-time">00:00.0</output><output id="flight-rate">Auto · 1.0×</output></div>
      <div class="flight-controls"><button id="flight-pause" type="button" disabled>Pause</button>
      <button id="flight-replay" type="button" disabled>Replay</button><button id="flight-next" type="button" disabled>Next moment</button>
      <label class="rate-choice">Time <select id="flight-speed" aria-label="Time speed"><option value="auto">Auto</option>
      <option value="1">1×</option><option value="4">4×</option><option value="16">16×</option><option value="64">64×</option></select></label></div>
      <div class="flight-timeline"><label class="timeline-label" for="flight-timeline">Inspect flight <span id="flight-duration">Ready to launch</span></label>
      <input id="flight-timeline" type="range" min="0" max="1" step="0.01" value="0" disabled aria-label="Inspect recorded flight time">
      </div></div>
      <div class="flight-notebook"><p id="flight-status" role="status" aria-live="polite">Pick a launch. Make a prediction. See what happens.</p>
      <div class="notebook-tools"><label>Target <input id="flight-target" type="number" value="45" min="0" max="100000000" step="1" aria-label="Target distance in metres"> m</label>
      <button id="flight-pin" type="button" disabled aria-pressed="false">Pin this flight</button>
      <details><summary>View & sound</summary><div class="view-options">
      <label><input id="flight-ghost" type="checkbox" checked> Previous flight</label>
      <label><input id="flight-prediction" type="checkbox"> Reveal full path</label>
      <label><input id="flight-vectors" type="checkbox"> Motion & force arrows</label>
      <label><input id="flight-sound" type="checkbox"> Sound</label>
      <label><input id="flight-banter" type="checkbox" checked> Character remarks</label>
      </div></details></div><p class="comparison-note" id="flight-comparison">The next flight can be compared with this one.</p></div>`;
    parent.prepend(el); this.element = el; this.status = this.get('flight-status');
    this.button('flight-pause').onclick = () => {
      if (!this.run) return;
      if (this.clock.time >= this.run.duration) { this.replay(); return; }
      this.clock.paused = !this.clock.paused; this.onSeek(); this.update();
    };
    this.button('flight-replay').onclick = () => this.replay();
    this.button('flight-next').onclick = () => {
      if (!this.run) return;
      const next = this.run.events.find(e => e.time > this.clock.time + 0.05);
      if (!next) return;
      this.clock.seek(next.time, this.run.duration); this.message(next.label); this.onSeek(); this.update();
    };
    this.input('flight-timeline').oninput = () => {
      if (!this.run) return;
      this.clock.seek(Number(this.input('flight-timeline').value), this.run.duration); this.onSeek(); this.update();
    };
    this.get<HTMLSelectElement>('flight-speed').onchange = () => {
      const value = this.get<HTMLSelectElement>('flight-speed').value;
      this.clock.select(value === 'auto' ? 'auto' : Number(value)); this.update();
    };
    this.input('flight-target').oninput = () => {
      const value = this.input('flight-target').valueAsNumber;
      if (Number.isFinite(value)) this.target = Math.max(0, Math.min(1e8, value));
      if (this.run && this.clock.time >= this.run.duration) this.showResult();
    };
    this.button('flight-pin').onclick = () => {
      if (!this.run) return;
      this.pinned = !this.pinned; if (this.pinned) this.baseline = this.run;
      else this.baseline = this.previousRuns[this.run.mode] || null;
      this.button('flight-pin').setAttribute('aria-pressed', String(this.pinned));
      this.button('flight-pin').textContent = this.pinned ? 'Unpin baseline' : 'Pin this flight'; this.updateComparison();
    };
    for (const key of ['ghost', 'prediction', 'vectors', 'sound', 'banter'] as const) {
      this.input(`flight-${key}`).onchange = () => { this[key] = this.input(`flight-${key}`).checked; if (key === 'sound') this.onSound(); };
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.clock.paused = true; this.onSeek(); this.update(); }
    });
  }
  private get<T extends HTMLElement = HTMLElement>(id: string): T { return this.element.querySelector(`#${id}`)!; }
  private button(id: string) { return this.get<HTMLButtonElement>(id); }
  private input(id: string) { return this.get<HTMLInputElement>(id); }
  message(text: string) { if (text !== this.lastStatus) { this.status.textContent = text; this.lastStatus = text; } }
  prepare() { this.busy = true; this.clock.paused = true; this.message('Preparing your experiment… Reset is available.'); this.update(); }
  load(run: FlightRecord) {
    if (this.run) this.previousRuns[this.run.mode] = this.run;
    if (!this.pinned) this.baseline = this.previousRuns[run.mode] || null;
    this.run = run; this.busy = false; this.clock.load();
    this.input('flight-timeline').max = String(Math.max(0.01, run.duration));
    this.message(run.mode === 'cannon' ? 'Off it goes. Watch the arc.' : 'Ignition. Watch thrust and weight.');
    this.updateComparison(); this.update();
  }
  reset() { this.busy = false; this.clock.paused = true; this.clock.time = 0;
    this.message('Ready for another experiment. Your recorded flight is kept for replay.'); this.update(); }
  setTarget(value: number, mode: string) {
    this.target = Math.max(0, Math.min(1e8, Math.round(value)));
    this.input('flight-target').value = String(this.target);
    this.input('flight-target').setAttribute('aria-label', mode === 'rocket' ? 'Target height in metres' : 'Target distance in metres');
  }
  replay() {
    if (!this.run || this.busy) return;
    this.clock.load(); this.message('Replay — the same recorded physics.'); this.onReplay(); this.update();
  }
  updateComparison() {
    const note = this.get('flight-comparison');
    if (!this.run || !this.baseline || this.run.id === this.baseline.id) { note.textContent = this.pinned ? 'This flight is your pinned baseline.' : 'Your previous flight will stay as a faint trail.'; return; }
    if (this.run.mode !== this.baseline.mode) { note.textContent = `Your pinned ${this.baseline.mode} flight is kept. Switch launcher to compare it.`; return; }
    const compare = compatibleRuns(this.run, this.baseline);
    note.textContent = `${this.pinned ? 'Pinned baseline' : 'Previous flight'}: ${this.baseline.maxHeight.toFixed(1)} m high · ${formatTime(this.baseline.duration)}. ${describeChanges(this.baseline, this.run)}${compare ? '' : ' · Different world: compare measurements; overlay hidden.'}`;
  }
  showResult() {
    if (!this.run) return;
    const run = this.run, end = run.samples[run.samples.length - 1];
    if (run.outcome === 'no-liftoff') { this.message(end.outcomeReason || 'No lift-off: outward thrust must exceed weight. Try less mass, a steeper angle or more thrust.'); return; }
    if (run.outcome === 'escape') { this.message('Escape trajectory. The unpowered vehicle is heading away with enough energy to leave this world.'); return; }
    if (run.outcome === 'orbit') { this.message('Orbit established: the unpowered path clears the planet. Replay or try another launch.'); return; }
    if (run.outcome !== 'impact') { this.message('Observation ended before a landing or confirmed orbit. Height shown is the highest observed, not a predicted apex. Try a shorter burn.'); return; }
    const measured = run.mode === 'rocket' ? run.maxHeight : end.x;
    const miss = measured - this.target;
    this.message(`${run.mode === 'rocket' ? 'Highest point' : 'Landed'}: ${measured.toFixed(1)} m · ${Math.abs(miss).toFixed(1)} m ${miss < 0 ? 'short of' : 'beyond'} target · ${formatTime(run.duration)} flight.${run.mode === 'rocket' && end.impactSpeed != null ? ` Contact speed ${end.impactSpeed.toFixed(1)} m/s.` : ''}`);
  }
  update() {
    const time = this.clock.time, run = this.run;
    this.get('flight-time').textContent = `${formatTime(time)}.${Math.floor(time * 10) % 10}`;
    this.get('flight-rate').textContent = this.clock.paused && run ? 'Paused' : `${this.clock.mode === 'auto' ? 'Auto · ' : ''}${this.clock.rate.toFixed(1)}×`;
    const reduced = !!reducedMotionQuery?.matches;
    const handTime = reduced ? Math.floor(time) : time;
    this.get('clock-hand').setAttribute('transform', `rotate(${handTime * 6} 50 50)`);
    this.get('clock-minute').setAttribute('transform', `rotate(${handTime / 5} 50 64)`);
    this.get('flight-duration').textContent = run ? `${formatTime(time)} / ${formatTime(run.duration)}` : 'Ready to launch';
    this.input('flight-timeline').value = String(time);
    this.input('flight-timeline').setAttribute('aria-valuetext', `${time.toFixed(1)} seconds of flight`);
    for (const id of ['flight-pause', 'flight-replay', 'flight-pin']) this.button(id).disabled = !run || this.busy;
    this.button('flight-next').disabled = !run || this.busy || time >= run.duration;
    this.input('flight-timeline').disabled = !run || this.busy;
    const finished = !!(run && time >= run.duration);
    this.button('flight-pause').textContent = finished ? 'Finished' : run && this.clock.paused ? 'Resume' : 'Pause';
    this.button('flight-pause').setAttribute('aria-label',
      !run ? 'Pause flight' : finished ? 'Replay finished flight' : this.clock.paused ? 'Resume flight' : 'Pause flight');
  }
}
