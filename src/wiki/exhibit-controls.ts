/** Shared buttons for the hands-on flight exhibits. Each experiment is a short
 * sequence of steps; at any moment one control is cued as the useful next move. */
const svg = (body: string) => `<svg class="exhibit-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
const stroke = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
const speaker = '<path d="M3.5 9.3h3.4L12 5.2v13.6l-5.1-4.1H3.5z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>';

export const ICONS = {
  play: svg('<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.4-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" fill="currentColor"/>'),
  pause: svg('<rect x="6.3" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.7" y="5" width="4" height="14" rx="1.2" fill="currentColor"/>'),
  replay: svg(`<path d="M5.5 5.5v13" ${stroke} stroke-width="2.6"/><path d="M19 6v12a.8.8 0 0 1-1.2.7l-8.6-6a.8.8 0 0 1 0-1.4l8.6-6A.8.8 0 0 1 19 6z" fill="currentColor"/>`),
  next: svg(`<path d="M18.5 5.5v13" ${stroke} stroke-width="2.6"/><path d="M5 6v12a.8.8 0 0 0 1.2.7l8.6-6a.8.8 0 0 0 0-1.4l-8.6-6A.8.8 0 0 0 5 6z" fill="currentColor"/>`),
  reset: svg(`<path d="M4.8 12a7.2 7.2 0 1 0 2.3-5.3" ${stroke} stroke-width="2.4"/><path d="M5 3.6v4.8h4.8" ${stroke} stroke-width="2.4"/>`),
  soundOn: svg(`${speaker}<path d="M15.4 9.2a4 4 0 0 1 0 5.6M18.1 6.6a7.8 7.8 0 0 1 0 10.8" ${stroke} stroke-width="2"/>`),
  soundOff: svg(`${speaker}<path d="M15.6 9.6l4.8 4.8M20.4 9.6l-4.8 4.8" ${stroke} stroke-width="2"/>`),
  expand: svg(`<path d="M14 4h6v6M20 4l-6.3 6.3M10 20H4v-6M4 20l6.3-6.3" ${stroke} stroke-width="2.2"/>`),
  collapse: svg(`<path d="M19.5 10.5h-6v-6M13.5 10.5 20 4M4.5 13.5h6v6M10.5 13.5 4 20" ${stroke} stroke-width="2.2"/>`),
  check: svg(`<path d="M5.5 12.5l4.2 4.2 8.8-9.2" ${stroke} stroke-width="3"/>`),
};
export type ExhibitIcon = keyof typeof ICONS;

export const control = (icon: ExhibitIcon, label: string) => `${ICONS[icon]}<span>${label}</span>`;

/** Controls are redrawn on every animation frame, so unchanged ones are left alone. */
export function setControl(button: HTMLElement, icon: ExhibitIcon, label: string) {
  const key = `${icon}:${label}`;
  if (button.dataset.control === key) return;
  button.dataset.control = key;
  button.innerHTML = control(icon, label);
}

export function stepButton(attribute: string, action: string, number: number, label: string) {
  return `<li><button type="button" class="exhibit-step" ${attribute}="${action}" data-step="later" disabled><span class="exhibit-step-badge" aria-hidden="true"><span>${number}</span>${ICONS.check}</span><span>${label}</span><span class="atlas-sr-only" data-step-status></span></button></li>`;
}

export type StepState = 'done' | 'next' | 'later';
export const stepState = (step: number, current: number): StepState => step < current ? 'done' : step === current ? 'next' : 'later';

/** `current` is the index of the step still to take; every earlier step is done. */
export function markSteps(buttons: HTMLButtonElement[], current: number) {
  buttons.forEach((button, i) => {
    const state = stepState(i, current);
    if (button.dataset.step === state) return;
    button.dataset.step = state;
    button.disabled = state !== 'next';
    button.querySelector('[data-step-status]')!.textContent = state === 'done' ? ' (done)' : '';
  });
}

export type ExhibitCue = 'step' | 'play' | 'reset' | 'none';
/** While loading, the next step is cued; a paused run cues Play; a finished run
 * cues a fresh experiment. Nothing competes for attention while it plays. */
export function exhibitCue(loading: boolean, active: boolean, playing: boolean, finished: boolean): ExhibitCue {
  if (loading) return 'step';
  if (finished) return 'reset';
  return active && !playing ? 'play' : 'none';
}
