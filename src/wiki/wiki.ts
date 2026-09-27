import './wiki.css';
import { ARTICLES, LEVELS, getArticle, parseWikiHash, searchArticles, type Level, type Article } from './content.ts';
import { solarPlate, asteroidPlate, kuiperPlate, moonExplorer } from './diagrams.ts';
import { WORLD_ART } from '../world-art.ts';
import { cannonExhibitMarkup, mountCannonExhibit } from './cannon-exhibit.ts';
import type { CannonSession } from './cannon-model.ts';
import { rocketExhibitMarkup, mountRocketExhibit } from './rocket-exhibit.ts';
import type { RocketSession } from './rocket-model.ts';

let dialog: HTMLDialogElement | undefined;
export const isWikiOpen = () => !!dialog?.open;
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Self-contained reading space. Opening it pauses the lab through a callback;
 * the wiki never changes a world, launcher setting, or recorded experiment. */
export function installWiki(onVisibilityChange: (open: boolean) => void) {
  if (dialog) return;
  let article = getArticle('solar-system')!, level: Level = 0, oldHash = '', oldTitle = document.title;
  let family = 'jupiter';
  let cannonSession:CannonSession|undefined, disposeExhibit:(()=>void)|undefined;
  let rocketSession:RocketSession|undefined;
  try { const saved = Number(localStorage.getItem('launch-lab-reading-level')); if ([0, 1, 2].includes(saved)) level = saved as Level; } catch { /* Storage is optional, including file:// builds. */ }
  dialog = document.createElement('dialog');
  dialog.className = 'atlas'; dialog.id = 'educational-wiki'; dialog.setAttribute('aria-label', 'Explore the Solar System, educational companion');
  dialog.innerHTML = `<header class="atlas-topbar"><button class="atlas-menu" type="button" aria-label="Show topics" aria-expanded="false" aria-controls="atlas-navigation">☰</button>
    <a class="atlas-brand" href="#wiki/solar-system/${level + 1}"><span class="atlas-brand-orbit" aria-hidden="true">✧</span><span>Explore the Solar System<small>A LAUNCH LAB COMPANION</small></span></a><span class="atlas-top-note">A little further into the universe.</span>
    <button class="atlas-close" type="button"><span aria-hidden="true">↙</span> Back to the lab</button></header>
    <div class="atlas-layout"><aside id="atlas-navigation" class="atlas-navigation" aria-label="Atlas topics"><label class="atlas-search"><span>Find something curious</span><input type="search" id="atlas-search" placeholder="Planets, moons, motion…" autocomplete="off"></label><p class="atlas-search-status" role="status" aria-live="polite"></p><nav class="atlas-topics" aria-label="Educational articles"></nav><div class="atlas-nav-foot"><span aria-hidden="true">✦</span> The same universe.<br>Three ways to understand it.</div></aside>
    <main class="atlas-main" tabindex="-1" aria-labelledby="atlas-title"></main></div>`;
  document.body.append(dialog);
  const zoom = document.createElement('dialog');
  zoom.className = 'atlas-lightbox'; zoom.setAttribute('aria-label', 'Enlarged atlas illustration');
  document.body.append(zoom);
  const main = dialog.querySelector<HTMLElement>('.atlas-main')!;
  const search = dialog.querySelector<HTMLInputElement>('#atlas-search')!;
  const nav = dialog.querySelector<HTMLElement>('.atlas-topics')!;
  const menu = dialog.querySelector<HTMLButtonElement>('.atlas-menu')!;
  const openButton = document.querySelector<HTMLButtonElement>('#open-wiki')!;
  const menuState = (open: boolean) => {
    dialog!.classList.toggle('atlas-menu-open', open);
    menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Hide topics' : 'Show topics');
  };
  function renderNav() {
    const matches = searchArticles(search.value);
    const groups = [...new Set(ARTICLES.map(a => a.group))];
    nav.innerHTML = groups.map(group => {
      const items = matches.filter(a => a.group === group);
      return items.length ? `<section><h2>${group}</h2>${items.map(a => `<a href="#wiki/${a.id}/${level + 1}" ${a.id === article.id ? 'aria-current="page"' : ''}>${a.art ? `<img src="${WORLD_ART[a.art].mini}" alt="" width="26" height="26">` : `<span class="atlas-topic-symbol" aria-hidden="true">${a.id === 'rockets' ? '↑' : a.id === 'cannons' ? '↗' : a.id === 'asteroid-belt' ? '⠿' : '◎'}</span>`}<span>${a.title}</span></a>`).join('')}</section>` : '';
    }).join('') || '<p class="atlas-empty">No topics found. Try “ice”, “gravity” or “moons”.</p>';
    dialog!.querySelector('.atlas-search-status')!.textContent = search.value.trim() ? `${matches.length} ${matches.length === 1 ? 'topic' : 'topics'} found` : '';
  }
  function relatedCard(a: Article) {
    return `<a class="atlas-related-card" href="#wiki/${a.id}/${level + 1}">${a.art ? `<img src="${WORLD_ART[a.art].full}" alt="" width="68" height="68" loading="lazy">` : `<span class="atlas-related-symbol" aria-hidden="true">${a.id === 'rockets' ? '↑' : a.id === 'cannons' ? '↗' : '◎'}</span>`}<span><small>${a.group}</small><strong>${a.title}</strong></span><span aria-hidden="true">↗</span></a>`;
  }
  function render(focus = true, keepScroll = false) {
    disposeExhibit?.(); disposeExhibit=undefined;
    const scroll = main.scrollTop;
    const reading = article.levels[level];
    const number = String(ARTICLES.indexOf(article) + 1).padStart(2, '0');
    const illustration = article.id === 'solar-system' ? solarPlate(level) : article.id === 'kuiper-belt' ? kuiperPlate(level) : article.id === 'asteroid-belt' ? asteroidPlate()
      : article.id === 'cannons' ? cannonExhibitMarkup() : article.id === 'rockets' ? rocketExhibitMarkup() : '';
    main.innerHTML = `<article class="atlas-article" data-topic="${article.id}">
      <div class="atlas-breadcrumb"><a href="#wiki/solar-system/${level + 1}">Atlas</a><span aria-hidden="true">/</span><span>${article.group}</span><span class="atlas-index">ENTRY ${number} / ${ARTICLES.length}</span></div>
      <header class="atlas-hero ${article.art ? 'atlas-world-hero' : ''}"><div class="atlas-hero-copy"><p class="atlas-kicker">${article.kind}</p><h1 id="atlas-title" tabindex="-1">${article.title}</h1><p class="atlas-deck">${article.description}</p></div>${article.art ? `<div class="atlas-world-art"><span class="atlas-world-orbit" aria-hidden="true"></span><img src="${WORLD_ART[article.art].full}" alt="Illustration of ${article.title.replace(' & the outer frontier', '')}" width="320" height="320"><span class="atlas-world-caption">A WORLD WORTH KNOWING</span></div>` : ''}</header>
      ${illustration}
      <dl class="atlas-facts">${article.stats.map(([name, value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join('')}</dl>
      ${article.stats.some(([, value]) => value.includes('AU')) ? '<p class="atlas-units">An astronomical unit (AU) is about Earth’s average distance from the Sun: 150 million kilometres. Solar distances here are rounded averages.</p>' : ''}
      <section class="atlas-reading" aria-label="Choose a reading level"><div class="atlas-reading-label"><span>CHOOSE YOUR DEPTH</span><small>Every level tells the same story.</small></div><div class="atlas-levels" role="group" aria-label="Reading level">${LEVELS.map((l, i) => `<button type="button" data-level="${i}" aria-pressed="${level === i}" aria-controls="atlas-reading-content"><span class="atlas-level-number">0${i + 1}</span><span><strong>${l.name}</strong><small>${l.detail}</small></span></button>`).join('')}</div></section>
      <div class="atlas-prose-layout" id="atlas-reading-content"><section class="atlas-prose" aria-labelledby="atlas-reading-heading"><p class="atlas-kicker">${LEVELS[level].name} / ${Math.max(1, Math.ceil(reading.paragraphs.join(' ').split(/\s+/).length / 180))} MIN READ</p><h2 id="atlas-reading-heading">${reading.heading}</h2>${reading.paragraphs.map(p => `<p>${p}</p>`).join('')}${reading.equation ? `<div class="atlas-equation"><span>THE RELATIONSHIP</span><p>${reading.equation.expression}</p><small>${reading.equation.explanation}</small></div>` : ''}</section><aside class="atlas-takeaway"><span aria-hidden="true">✧</span><p class="atlas-kicker">ONE THING TO REMEMBER</p><p>${reading.takeaway}</p></aside></div>
      ${['solar-system', 'moons', 'jupiter', 'saturn', 'uranus', 'neptune', 'earth', 'mars', 'pluto'].includes(article.id) ? moonExplorer(['solar-system', 'moons'].includes(article.id) ? family : article.id, level) : ''}
      ${article.id === 'solar-system' ? `<section class="atlas-world-shelf"><div class="atlas-section-top"><div><p class="atlas-kicker">EIGHT PLANETS, ENDLESS QUESTIONS</p><h3>Choose your next stop.</h3></div></div><div class="atlas-planet-shelf">${ARTICLES.filter(a => a.group === 'Our star & planets' && a.id !== 'sun').map(a => `<a href="#wiki/${a.id}/${level + 1}"><img src="${WORLD_ART[a.id].full}" alt="" width="100" height="100" loading="lazy"><strong>${a.title}</strong><small>${a.kind.split(' / ')[1]}</small></a>`).join('')}</div></section>` : ''}
      <section class="atlas-related"><p class="atlas-kicker">KEEP FOLLOWING YOUR CURIOSITY</p><h3>Everything connects.</h3><div>${article.related.map(id => relatedCard(getArticle(id)!)).join('')}</div></section>
      <footer class="atlas-sources"><div><strong>Keep exploring, with trusted sources.</strong><p>Original explanations, checked against the linked sources. Values are rounded for learning; illustrations are not to scale.</p></div><ul>${article.sources.map(([name, url]) => `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${escape(name)} <span aria-hidden="true">↗</span><span class="atlas-sr-only"> (opens in a new tab)</span></a></li>`).join('')}</ul><span class="atlas-end-mark" aria-hidden="true">✦</span></footer>
      </article>`;
    if(article.id==='cannons') {
      const exhibit=mountCannonExhibit(main.querySelector<HTMLElement>('.cannon-exhibit')!,cannonSession);
      disposeExhibit=()=>{cannonSession=exhibit.dispose();};
    }
    if(article.id==='rockets') {
      const exhibit=mountRocketExhibit(main.querySelector<HTMLElement>('.rocket-exhibit')!,rocketSession);
      disposeExhibit=()=>{rocketSession=exhibit.dispose();};
    }
    renderNav();
    dialog!.querySelector<HTMLAnchorElement>('.atlas-brand')!.href = `#wiki/solar-system/${level + 1}`;
    document.title = `${article.title} · Explore the Solar System`;
    main.scrollTop = keepScroll ? scroll : 0;
    if (focus) main.querySelector<HTMLElement>('#atlas-title')!.focus({ preventScroll: true });
  }
  function open() {
    if (dialog!.open) return;
    oldTitle = document.title;
    if (!location.hash.startsWith('#wiki/')) oldHash = location.hash;
    dialog!.showModal(); document.body.classList.add('atlas-open'); onVisibilityChange(true);
  }
  function close() {
    if (!dialog!.open) return;
    disposeExhibit?.(); disposeExhibit=undefined;
    if (zoom.open) zoom.close();
    dialog!.close(); document.body.classList.remove('atlas-open'); menuState(false); onVisibilityChange(false);
    document.title = oldTitle;
    if (location.hash.startsWith('#wiki/')) history.replaceState(null, '', `${location.pathname}${location.search}${oldHash}`);
    openButton.focus({ preventScroll: true });
  }
  function route() {
    if (zoom.open) zoom.close();
    const state = parseWikiHash(location.hash);
    if (!state) { if (dialog!.open) close(); return; }
    const sameArticle = dialog!.open && article.id === state.id;
    open(); article = getArticle(state.id)!; level = state.level;
    try { localStorage.setItem('launch-lab-reading-level', String(level)); } catch { /* Optional. */ }
    render(!sameArticle, sameArticle);
    if (sameArticle) main.querySelector<HTMLButtonElement>(`[data-level="${level}"]`)?.focus({ preventScroll: true });
    menuState(false);
  }
  openButton.onclick = () => {
    oldHash = location.hash.startsWith('#wiki/') ? '' : location.hash;
    const target = `#wiki/${article.id}/${level + 1}`;
    if (location.hash === target) route();
    else location.hash = target;
  };
  dialog.querySelector<HTMLButtonElement>('.atlas-close')!.onclick = close;
  zoom.addEventListener('click', event => {
    const link = (event.target as Element).closest('a');
    if (link?.getAttribute('href') === location.hash) zoom.close();
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  menu.onclick = () => menuState(!dialog!.classList.contains('atlas-menu-open'));
  search.oninput = renderNav;
  main.addEventListener('click', event => {
    if ((event.target as Element).closest('.atlas-enlarge')) {
      const solar = main.querySelector('.atlas-solar-plate');
      zoom.classList.toggle('atlas-solar-lightbox', !!solar);
      zoom.innerHTML = `<header><strong>${article.title}</strong><span>Scroll to explore · not to scale</span><button type="button" aria-label="Close enlarged illustration">×</button></header><div class="atlas-lightbox-scroll">${solar ? solarPlate(level, 'enlarged') : main.querySelector('.atlas-plate, .atlas-mechanics')!.outerHTML}</div>`;
      zoom.querySelector('button')!.onclick = () => zoom.close();
      zoom.showModal();
      return;
    }
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-level]');
    if (button) location.hash = `wiki/${article.id}/${Number(button.dataset.level) + 1}`;
  });
  main.addEventListener('change', event => {
    const select = event.target as HTMLSelectElement;
    if (select.id !== 'atlas-moon-world') return;
    family = select.value;
    const container = main.querySelector('.atlas-moons')!;
    container.outerHTML = moonExplorer(family, level);
    main.querySelector<HTMLSelectElement>('#atlas-moon-world')!.focus({ preventScroll: true });
  });
  window.addEventListener('hashchange', route);
  renderNav(); route();
}
