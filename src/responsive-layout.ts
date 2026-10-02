import './responsive-layout.css';
import { NozzleRender } from './nozzle_render.ts';

let setupNozzle: HTMLCanvasElement;

/** The same recorded engine sketch is available inside compact rocket setup. */
export function drawSetupNozzle(data: any) {
  if (!isSetupNozzleVisible()) return;
  const width = setupNozzle.clientWidth, height = 204;
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  if (setupNozzle.width !== Math.round(width * ratio) || setupNozzle.height !== Math.round(height * ratio)) {
    setupNozzle.width = Math.round(width * ratio); setupNozzle.height = Math.round(height * ratio);
  }
  const context = setupNozzle.getContext('2d')!;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  NozzleRender.drawPanel(context, width, height, data);
}

export const isSetupNozzleVisible = () => !!setupNozzle?.offsetWidth && setupNozzle.closest<HTMLDetailsElement>('details')!.open;

/** Move the existing controls, keeping their state and event handlers intact.
 * The setup sheet is a disclosure; closing it never pauses or resets a flight. */
export function installResponsiveLayout() {
  const compact = matchMedia('(max-width: 950px)');
  const panel = document.querySelector<HTMLElement>('.control-panel')!;
  const controls = panel.querySelector<HTMLElement>('.controls-scroll')!;
  const actions = panel.querySelector<HTMLElement>('.launch-actions')!;
  const world = document.getElementById('environment-label')!;
  const actionHome = document.createComment('Desktop launch controls');
  actions.before(actionHome);
  controls.id = 'experiment-controls';

  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'setup-toggle';
  toggle.setAttribute('aria-controls', controls.id);
  toggle.innerHTML = '<span>Setup <span class="setup-chevron" aria-hidden="true">⌃</span></span><small></small>';
  panel.querySelector('.mode-toggle')!.after(toggle);

  const heading = document.createElement('div');
  heading.className = 'setup-sheet-heading';
  heading.innerHTML = '<h2>Experiment setup</h2><button type="button">Done <span aria-hidden="true">↓</span></button>';
  controls.prepend(heading);
  const done = heading.querySelector<HTMLButtonElement>('button')!;
  const scrim = document.createElement('div');
  scrim.className = 'setup-scrim'; scrim.hidden = true;
  document.querySelector('.app-container')!.append(scrim);
  let open = false;

  const sketch = document.createElement('details');
  sketch.className = 'lab-details compact-nozzle';
  sketch.innerHTML = '<summary>Nozzle Sketch</summary><div class="details-content"><canvas aria-label="Rocket nozzle sketch. Flow and engine state follow the recorded flight."></canvas></div>';
  document.querySelector('#rocket-panel > details')!.after(sketch);
  setupNozzle = sketch.querySelector('canvas')!;

  function setOpen(value: boolean, restoreFocus = false) {
    open = compact.matches && value;
    const focusInControls = controls.contains(document.activeElement);
    // Move focus before hiding its owner, including during orientation changes.
    if (!open && compact.matches && (restoreFocus || focusInControls)) toggle.focus({ preventScroll: true });
    controls.hidden = compact.matches && !open;
    panel.classList.toggle('setup-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    scrim.hidden = !open;
    if (open) done.focus({ preventScroll: true });
  }

  function syncLayout() {
    const focusOnCompactControl = document.activeElement === toggle || document.activeElement === done;
    if (compact.matches) panel.append(actions);
    else actionHome.after(actions);
    setOpen(false);
    if (!compact.matches && focusOnCompactControl) panel.querySelector<HTMLButtonElement>('.mode-btn.active')!.focus({ preventScroll: true });
  }
  function syncWorld() {
    const name = world.textContent!.split(' · ')[0];
    toggle.querySelector('small')!.textContent = name;
    toggle.setAttribute('aria-label', `Experiment setup · ${name}`);
  }
  toggle.addEventListener('click', () => setOpen(!open));
  done.addEventListener('click', () => setOpen(false, true));
  scrim.addEventListener('click', () => setOpen(false, true));
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open && !event.defaultPrevented) {
      event.preventDefault(); setOpen(false, true);
    }
  });
  actions.addEventListener('click', event => {
    if ((event.target as Element).closest('#btn-fire, #btn-launch')) setOpen(false);
  });
  // Keyboard users moving into the field should not leave a sheet over it.
  document.addEventListener('focusin', event => {
    const target = event.target as Element;
    if (open && !panel.contains(target) && !target.closest('dialog[open], #tooltip')) setOpen(false);
  });
  compact.addEventListener('change', syncLayout);
  // Launch errors can make the dock taller. Keep the sheet's Done button and
  // first controls on screen even in a short landscape viewport.
  const measureDock = () => panel.style.setProperty('--launcher-height', `${panel.offsetHeight}px`);
  new ResizeObserver(measureDock).observe(panel);
  new MutationObserver(syncWorld).observe(world, { childList: true, characterData: true, subtree: true });
  syncWorld(); syncLayout(); measureDock();
}
