import './fact-dialog.css';
import { explainFact, factLabel, FACT_TOPICS, type FactKey } from './fact-explanations.ts';
import { getPlanetFact, type PlanetFact } from './planet-facts.ts';
import { getWorldArt } from './world-art.ts';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const elephant = `<svg viewBox="0 0 100 72" aria-hidden="true"><path d="M17 42C6 37 6 23 14 22M19 42V62H31V48H51V62H63V42C73 45 77 38 80 32L81 53C82 65 97 65 97 51L91 49C91 55 88 56 88 51L87 28C86 11 72 8 62 17C51 9 25 10 19 24Z" fill="#718e85" stroke="#3e665d" stroke-width="2" stroke-linejoin="round"/><path d="M63 21C43 11 46 43 61 41C68 36 70 27 63 21" fill="#a2b7a7" stroke="#3e665d" stroke-width="2"/><circle cx="78" cy="25" r="2" fill="#263e39"/><path d="M80 36Q74 45 70 38" fill="#fff8e4"/></svg>`;
const numberMarkup = (value: string) => escape(value).replace(/,/g, ',<wbr>');

/** A native second dialog keeps keyboard focus and Escape within the explanation. */
export function installFactExplanations(parent: HTMLDialogElement) {
  const detail = document.createElement('dialog');
  detail.id = 'fact-explanation'; detail.className = 'fact-explanation';
  detail.setAttribute('aria-labelledby', 'fact-explanation-title');
  document.body.append(detail);
  let world: PlanetFact;
  let selected = 0;
  let opener: HTMLButtonElement | undefined;
  function render() {
    const topic = FACT_TOPICS[selected];
    const info = explainFact(world, topic.key);
    detail.dataset.fact = topic.key;
    detail.style.setProperty('--fact-accent', world.accent);
    detail.innerHTML = `<header class="fact-explanation-bar"><button type="button" data-fact-close>← Back to ${escape(world.name)} facts</button><span>${selected + 1} / ${FACT_TOPICS.length}</span><button type="button" class="fact-explanation-close" data-fact-close aria-label="Close explanation">×</button></header>
      <div class="fact-explanation-body"><div class="fact-explanation-heading"><div><p class="fact-explanation-kicker">${escape(world.name)} · ${escape(info.label)}</p><h2 id="fact-explanation-title" tabindex="-1">${escape(info.title)}</h2></div><img src="${getWorldArt(world.id)!.full}" alt="" width="90" height="90"></div>
      <div class="fact-number"><strong>${numberMarkup(info.value)}</strong><span>${escape(info.valueLabel)}</span></div>
      ${info.comparison ? `<div class="fact-comparison">${topic.key === 'mass' ? elephant : '<span class="fact-comparison-mark" aria-hidden="true">≈</span>'}<div><strong>${numberMarkup(info.comparison.value)}</strong><span>${escape(info.comparison.label)}</span></div></div>` : ''}
      <div class="fact-explanation-copy">${info.paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}</div>
      <div class="fact-explanation-sources"><span>Follow the science</span>${info.sources.map(([name, url]) => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(name)} ↗<span class="sr-only"> (opens in a new tab)</span></a>`).join('')}</div></div>
      <nav class="fact-explanation-pager" aria-label="Explore the ten facts"><button type="button" data-fact-step="-1" ${selected === 0 ? 'disabled' : ''}>← Previous fact</button><button type="button" data-fact-step="1" ${selected === FACT_TOPICS.length - 1 ? 'disabled' : ''}>Next: ${escape(selected < FACT_TOPICS.length - 1 ? factLabel(world, FACT_TOPICS[selected + 1].key) : 'all explored')} →</button></nav>`;
  }
  parent.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-fact]');
    if (!button) return;
    const fact = getPlanetFact(parent.querySelector<HTMLElement>('#planet-fact-card')!.dataset.world!);
    const index = FACT_TOPICS.findIndex(t => t.key === button.dataset.fact);
    if (!fact || index < 0) return;
    world = fact; selected = index; opener = button;
    render(); detail.showModal();
    detail.querySelector<HTMLElement>('h2')!.focus({ preventScroll: true });
  });
  detail.addEventListener('click', event => {
    const target = event.target as Element;
    if (target === detail || target.closest('[data-fact-close]')) { detail.close(); return; }
    const step = target.closest<HTMLButtonElement>('[data-fact-step]');
    if (!step) return;
    selected = Math.max(0, Math.min(FACT_TOPICS.length - 1, selected + Number(step.dataset.factStep)));
    render(); detail.querySelector<HTMLElement>('h2')!.focus({ preventScroll: true });
  });
  detail.addEventListener('close', () => { if (parent.open) opener?.focus({ preventScroll: true }); });
  parent.addEventListener('close', () => { if (detail.open) detail.close(); });
}

export function updateFactLabels(parent: HTMLDialogElement, fact: PlanetFact) {
  parent.querySelectorAll<HTMLButtonElement>('[data-fact]').forEach(button => {
    const label = factLabel(fact, button.dataset.fact as FactKey);
    button.querySelector('.fact-tile-label')!.textContent = label;
    button.setAttribute('aria-label', `${label}: ${button.querySelector('strong')!.textContent}. Explain this fact`);
  });
}
