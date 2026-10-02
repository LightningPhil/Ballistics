import { MOON_FAMILIES, getArticle, type Level } from './content.ts';
import { WORLD_ART } from '../world-art.ts';

export { solarPlate } from './solar-map.ts';
export const beltImage = new URL('../assets/wiki/asteroid-belt.webp', import.meta.url).href;

export function kuiperPlate(level: Level) {
  return `<figure class="atlas-frontier"><p class="atlas-kicker">FOLLOW THE SUN’S FAMILY OUTWARDS</p><div class="atlas-frontier-path">
    <a href="#wiki/asteroid-belt/${level+1}" class="atlas-frontier-belt"><span aria-hidden="true">⠿</span><strong>Main asteroid belt</strong><small>≈2.1–3.3 AU<br>Between Mars and Jupiter</small></a>
    <span class="atlas-frontier-arrow" aria-hidden="true">→</span>
    <a href="#wiki/neptune/${level+1}"><img src="${WORLD_ART.neptune.full}" alt="Neptune" width="100" height="100"><strong>Neptune</strong><small>≈30 AU<br>The outermost planet</small></a>
    <span class="atlas-frontier-arrow" aria-hidden="true">→</span>
    <div class="atlas-frontier-icy"><a href="#wiki/pluto/${level+1}"><img src="${WORLD_ART.pluto.full}" alt="Pluto, a member of the Kuiper Belt" width="70" height="70"><span>Pluto ↗</span></a><strong>Kuiper Belt</strong><small>Main region ≈30–50 AU<br>Icy bodies orbiting the Sun</small></div>
    </div><figcaption>Distances are rounded averages; this sequence compresses space. The Kuiper Belt is a broad region with many different orbits.</figcaption></figure>`;
}

export function asteroidPlate() {
  return `<figure class="atlas-plate"><div class="atlas-belt-image"><img src="${beltImage}" width="1536" height="1024" alt="Illustration of the main asteroid belt between the orbits of Mars and Jupiter, with separate enlarged examples of rocky bodies."><span class="atlas-plate-number">PLATE 02 / THE MAIN ASTEROID BELT</span>
    <span class="atlas-art-label" style="left:28.5%;top:38%">Sun</span><span class="atlas-art-label" style="left:55.8%;top:39%">Mars</span><span class="atlas-art-label" style="left:82%;top:29%">Jupiter</span><span class="atlas-art-label" style="left:30%;top:64%">Main asteroid belt</span><span class="atlas-art-label" style="left:83%;top:88%">Enlarged specimens</span></div><figcaption><span>Rocky remnants between Mars and Jupiter. The specimen view enlarges individual bodies.</span><strong>Not to scale · rocks exaggerated · mostly empty space</strong></figcaption></figure><button type="button" class="atlas-enlarge">View larger illustration ↗</button>`;
}

/** A labelled, selectable family map complements the deliberately compressed
 * artwork. Membership is data, not generated lettering or a moon-count claim. */
export function moonExplorer(selected = 'jupiter', level: Level = 0) {
  const family = MOON_FAMILIES.find(f => f.planet === selected) || MOON_FAMILIES[4];
  const planet = getArticle(family.planet)!;
  return `<section class="atlas-moons" aria-labelledby="atlas-moons-title"><div class="atlas-section-top"><div><p class="atlas-kicker">FOLLOW THE SMALL ORBITS</p><h3 id="atlas-moons-title">Who goes around whom?</h3></div><label>Choose a world<select id="atlas-moon-world">${MOON_FAMILIES.map(f => `<option value="${f.planet}" ${f.planet === family.planet ? 'selected' : ''}>${getArticle(f.planet)!.title.replace(' & the outer frontier', '')}</option>`).join('')}</select></label></div>
    <div class="atlas-family"><a class="atlas-family-parent" href="#wiki/${family.planet}/${level + 1}"><img src="${WORLD_ART[family.planet].full}" alt="" width="100" height="100"><strong>${planet.title.replace(' & the outer frontier', '')}</strong><span>${family.planet === 'pluto' ? 'Dwarf planet' : 'Planet'} → orbits the Sun</span></a>
    <div class="atlas-family-children">${family.moons.length ? family.moons.map(name => {
      const candidate = name === 'The Moon' ? 'moon' : name.toLowerCase();
      const id = getArticle(candidate) ? candidate : '';
      return `<${id ? `a href="#wiki/${id}/${level + 1}"` : 'span'} class="atlas-moon-chip"><span class="atlas-moon-dot" aria-hidden="true"></span>${name}${id ? ' ↗' : ''}</${id ? 'a' : 'span'}>`;
    }).join('') : '<p class="atlas-no-moons">No moons orbit this planet.</p>'}</div></div><p class="atlas-family-note">${family.note} Sizes and moon spacing are illustrative.</p></section>`;
}

export function flightDiagram(type: 'cannons' | 'rockets') {
  const rocket = type === 'rockets';
  return `<figure class="atlas-mechanics"><svg viewBox="0 0 800 285" role="img" aria-labelledby="atlas-mechanics-title atlas-mechanics-desc">
    <title id="atlas-mechanics-title">${rocket ? 'Rocket thrust and exhaust' : 'A launch push and the curved flight after it'}</title>
    <desc id="atlas-mechanics-desc">${rocket ? 'A rocket sends gas backwards through a nozzle. An arrow points forwards for thrust and another backwards for exhaust. No surrounding air is needed.' : 'Gas pressure pushes a projectile out of a barrel and the launcher recoils the other way. After leaving, the projectile follows a curved path under gravity.'}</desc>
    <defs><marker id="atlas-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#ebbd73"/></marker></defs>
    <g fill="none" stroke="#88aaa9" stroke-width="1" opacity=".3"><path d="M30 230H770M30 170H770M30 110H770M30 50H770"/></g>
    ${rocket ? `<g transform="translate(360 135)"><path d="M-90-32H70Q112-30 140 0Q112 30 70 32H-90Z" fill="#f2ede0" stroke="#a0b8b1" stroke-width="3"/><path d="M-40-32L-75-70H-100L-90-20M-40 32L-75 70H-100L-90 20" fill="#bd7651"/><path d="M-90-18L-118-28V28L-90 18" fill="#658b8d" stroke="#b0cac2" stroke-width="3"/><circle cx="58" cy="0" r="17" fill="#27545e" stroke="#b9ccbf" stroke-width="5"/><path d="M-122-18Q-160-42-210 0Q-160 42-122 18" fill="#ebbd73"/><path d="M-123-10Q-152-20-175 0Q-152 20-123 10" fill="#fff3d2"/></g>
      <path d="M525 135H700" stroke="#ebbd73" stroke-width="3" marker-end="url(#atlas-arrow)"/><path d="M125 135H55" stroke="#ebbd73" stroke-width="3" marker-end="url(#atlas-arrow)"/><g fill="#f9efd8"><text x="560" y="110">Thrust forwards</text><text x="42" y="98">Exhaust backwards</text><text x="280" y="245">The engine travels with the rocket.</text></g>`
    : `<g transform="translate(120 191) rotate(-28)"><path d="M-65-25H85V25H-65Z" fill="#507c80" stroke="#b4cdc7" stroke-width="3"/><path d="M-55-18H5V18H-55Z" fill="#e9ae65"/><circle cx="30" cy="0" r="17" fill="#ece6d8"/><path d="M-43 0H1" stroke="#193c42" stroke-width="3" marker-end="url(#atlas-arrow)"/></g><path d="M198 145Q460-60 727 206" fill="none" stroke="#e9c078" stroke-width="3" stroke-dasharray="5 8"/><circle cx="440" cy="53" r="13" fill="#f3eddf"/><path d="M440 78V133" stroke="#ebbd73" stroke-width="3" marker-end="url(#atlas-arrow)"/><path d="M90 233H40" stroke="#ebbd73" stroke-width="3" marker-end="url(#atlas-arrow)"/><g fill="#f9efd8"><text x="33" y="270">Recoil</text><text x="30" y="123">Gas pushes</text><text x="466" y="102">Gravity pulls down</text><text x="466" y="126" class="atlas-svg-small">even at the top of the arc</text><text x="270" y="254">Once it leaves, the launch push is over.</text></g>`}
    </svg><figcaption>Conceptual diagram. ${rocket ? 'Exhaust and rocket gain momentum in opposite directions.' : 'The illustrated arc ignores air resistance, the brief external gas push after the muzzle, and changes in gravity.'}</figcaption></figure><button type="button" class="atlas-enlarge">View larger illustration ↗</button>`;
}
