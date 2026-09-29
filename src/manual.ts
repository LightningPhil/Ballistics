import './manual.css';
import licence from '../LICENSE?raw';
import { MANUAL_TOPICS } from './manual-content.ts';

let dialog: HTMLDialogElement | undefined;
export const isManualOpen = () => !!dialog?.open;

export function installManual(onOpen: () => void) {
  if (dialog) return;
  const book = document.querySelector<HTMLButtonElement>('#open-manual')!;
  const manual = document.createElement('dialog');
  dialog = manual;
  manual.id = 'instruction-manual'; manual.className = 'manual';
  manual.setAttribute('aria-labelledby', 'manual-title');
  manual.innerHTML = `<header class="manual-header"><span class="manual-book" aria-hidden="true">${book.innerHTML}</span><div><p>LAUNCH LAB · FIELD GUIDE</p><h1 id="manual-title">Instruction manual</h1></div><button type="button" class="manual-close"><span aria-hidden="true">↙</span> Back to the lab</button></header>
    <div class="manual-layout"><aside class="manual-index"><h2>Contents</h2><nav aria-label="Manual topics">${MANUAL_TOPICS.map((topic, i) => `<button type="button" data-manual-topic="${i}" aria-controls="manual-page"><span aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>${topic.name}</button>`).join('')}</nav><p class="manual-index-note">A quiet moment to read.<br>Your experiment stays paused.</p></aside>
    <section class="manual-reader" aria-labelledby="manual-page-title"><article id="manual-page"></article></section></div>`;
  document.body.append(manual);
  const reader = manual.querySelector<HTMLElement>('.manual-reader')!;
  const page = manual.querySelector<HTMLElement>('#manual-page')!;
  let selected = 0;

  function render(index: number) {
    selected = index;
    const topic = MANUAL_TOPICS[index];
    page.innerHTML = `<p class="manual-kicker">${topic.id === 'about' || topic.id === 'licence' ? 'THE SMALL PRINT' : 'USING THE LAB'} <span>${String(index + 1).padStart(2, '0')} / ${MANUAL_TOPICS.length}</span></p><h2 id="manual-page-title" tabindex="-1">${topic.title}</h2><p class="manual-intro">${topic.intro}</p><div class="manual-prose">${topic.body}</div><footer class="manual-page-turn">${index > 0 ? `<button type="button" data-manual-topic="${index - 1}"><small>PREVIOUS</small>← ${MANUAL_TOPICS[index - 1].name}</button>` : '<span></span>'}${index < MANUAL_TOPICS.length - 1 ? `<button type="button" data-manual-topic="${index + 1}"><small>NEXT</small>${MANUAL_TOPICS[index + 1].name} →</button>` : '<span></span>'}</footer>`;
    const licenceBlock = page.querySelector('.manual-licence');
    if (licenceBlock) licenceBlock.textContent = licence;
    manual.querySelectorAll<HTMLButtonElement>('.manual-index [data-manual-topic]').forEach(button => {
      if (Number(button.dataset.manualTopic) === index) {
        button.setAttribute('aria-current', 'page');
        button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      else button.removeAttribute('aria-current');
    });
    reader.scrollTop = 0;
    page.querySelector<HTMLElement>('#manual-page-title')!.focus({ preventScroll: true });
  }

  function close(restoreFocus = true) {
    if (!manual.open) return;
    manual.close(); document.body.classList.remove('manual-open');
    if (restoreFocus) book.focus({ preventScroll: true });
  }

  book.onclick = () => {
    manual.showModal(); document.body.classList.add('manual-open');
    onOpen(); render(selected);
  };
  manual.querySelector<HTMLButtonElement>('.manual-close')!.onclick = () => close();
  manual.addEventListener('cancel', event => { event.preventDefault(); close(); });
  manual.addEventListener('click', event => {
    const target = event.target as Element;
    const topic = target.closest<HTMLButtonElement>('[data-manual-topic]');
    if (topic) render(Number(topic.dataset.manualTopic));
    const link = target.closest<HTMLAnchorElement>('a[href^="#wiki/"]');
    if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      // Close before hash navigation opens the companion: only one reading
      // modal owns focus and scroll at a time. The experiment remains paused.
      close(false);
    }
  });
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#wiki/')) close(false);
  });
}
