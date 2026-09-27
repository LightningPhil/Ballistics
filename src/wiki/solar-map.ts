import { WORLD_ART } from '../world-art.ts';
import type { Level } from './content.ts';

const background = new URL('../assets/wiki/solar-atlas-background.webp', import.meta.url).href;
type Point = [number, number];
export interface MapBody {
  id: string; name: string; parent?: string; art?: string; colour?: string;
  size: number; wide: Point; tall: Point; wideLabel?: Point; tallLabel?: Point;
}
/** Positions are illustrative, never an ephemeris. Labels, images, hit areas and
 * leaders use the same coordinates. Staggered worlds leave distinct spaces for
 * their compact moon orbits. Only the two simulated moons have callouts/pages. */
export const MAP_BODIES: MapBody[] = [
  { id:'sun', name:'The Sun', art:'sun', size:240, wide:[20,610], tall:[35,140], wideLabel:[110,780], tallLabel:[295,100] },
  { id:'mercury', name:'Mercury', art:'mercury', size:68, wide:[210,555], tall:[265,275], wideLabel:[210,435], tallLabel:[280,195] },
  { id:'venus', name:'Venus', art:'venus', size:84, wide:[330,690], tall:[360,425], wideLabel:[335,800], tallLabel:[515,505] },
  { id:'earth', name:'Earth', art:'earth', size:90, wide:[490,475], tall:[290,630], wideLabel:[490,330], tallLabel:[265,535] },
  { id:'moon', name:'The Moon', parent:'earth', art:'moon', size:34, wide:[575,510], tall:[205,665], wideLabel:[520,595], tallLabel:[140,745] },
  { id:'mars', name:'Mars', art:'mars', size:74, wide:[660,640], tall:[400,840], wideLabel:[655,770], tallLabel:[495,945] },
  { id:'phobos', name:'Phobos', parent:'mars', colour:'#bba18b', size:20, wide:[714,664], tall:[454,864] },
  { id:'jupiter', name:'Jupiter', art:'jupiter', size:146, wide:[890,400], tall:[285,1140], wideLabel:[885,220], tallLabel:[280,1020] },
  { id:'ganymede', name:'Ganymede', parent:'jupiter', art:'ganymede', size:38, wide:[810,448], tall:[365,1188], wideLabel:[795,570], tallLabel:[470,1280] },
  { id:'saturn', name:'Saturn', art:'saturn', size:172, wide:[1100,560], tall:[420,1410], wideLabel:[1100,715], tallLabel:[520,1520] },
  { id:'titan', name:'Titan', parent:'saturn', colour:'#dcb56b', size:29, wide:[1192,596], tall:[512,1446] },
  { id:'uranus', name:'Uranus', art:'uranus', size:108, wide:[1300,350], tall:[290,1660], wideLabel:[1300,215], tallLabel:[280,1550] },
  { id:'titania', name:'Titania', parent:'uranus', colour:'#b7c4c7', size:23, wide:[1224,328], tall:[214,1638] },
  { id:'neptune', name:'Neptune', art:'neptune', size:108, wide:[1490,500], tall:[420,1890], wideLabel:[1490,665], tallLabel:[475,2010] },
  { id:'triton', name:'Triton', parent:'neptune', colour:'#d6c5ba', size:27, wide:[1570,473], tall:[500,1863] },
  { id:'pluto', name:'Pluto', art:'pluto', size:62, wide:[1675,655], tall:[290,2200], wideLabel:[1660,785], tallLabel:[280,2100] },
  { id:'charon', name:'Charon', parent:'pluto', colour:'#bab7b4', size:28, wide:[1615,684], tall:[350,2229] },
];

export const MAP_LAYOUTS = {
  wide: { width:1800, height:1000, sun:[20,610] as Point, flatten:.42, asteroid:[735,825] as Point, kuiper:[1560,1830] as Point, asteroidLabel:[430,880] as Point, kuiperLabel:[1680,395] as Point },
  tall: { width:680, height:2430, sun:[35,140] as Point, flatten:1.7, asteroid:[565,615] as Point, kuiper:[1140,1340] as Point, asteroidLabel:[525,725] as Point, kuiperLabel:[425,2300] as Point },
};
export type MapLayout = keyof typeof MAP_LAYOUTS;
export function solarOrbitRadius(body: MapBody, layout: MapLayout) {
  const { sun, flatten } = MAP_LAYOUTS[layout];
  return Math.hypot(body[layout][0] - sun[0], (body[layout][1] - sun[1]) / flatten);
}
export function labelBox(body: MapBody, layout: MapLayout) {
  const position = body[layout === 'wide' ? 'wideLabel' : 'tallLabel'];
  if (!position) return null;
  const [x,y] = position, width = Math.max(130,body.name.length*18+34);
  return { x:x-width/2, y:y-26, width, height:52 };
}
export function moonOrbit(body: MapBody, layout: MapLayout) {
  const parent = MAP_BODIES.find(p=>p.id===body.parent)!;
  const [x,y] = parent[layout], [mx,my] = body[layout];
  const rx = Math.hypot(mx-x,(my-y)/.65);
  return { x,y,rx,ry:rx*.65 };
}
export function mapDestination(body: MapBody) {
  return body.parent && !body.wideLabel ? body.parent : body.id;
}
function leader(body: MapBody, layout: MapLayout) {
  const [x,y] = body[layout], b = labelBox(body, layout);
  const cx = b.x+b.width/2, cy = b.y+b.height/2, dx = cx-x, dy = cy-y;
  const length = Math.hypot(dx,dy), radius = body.size * .4;
  const edge = Math.min(b.width/2/Math.max(Math.abs(dx),.01), b.height/2/Math.max(Math.abs(dy),.01));
  return `<path class="solar-leader" d="M${x+dx*radius/length} ${y+dy*radius/length}L${cx-dx*edge} ${cy-dy*edge}"/>`;
}
export function beltParticles(layout: MapLayout, region: 'asteroid' | 'kuiper') {
  const config = MAP_LAYOUTS[layout], [min,max] = config[region];
  // Independent angular/radial sequences fill the annulus. Using complementary
  // golden-ratio sequences for both would lock the dots onto one broken spiral.
  return Array.from({length:region === 'asteroid' ? 900 : 1300}, (_,i) => {
    const angle = i*2.3999632297, radius = min+(max-min)*((i*.7548776662466927)%1);
    const x = config.sun[0]+Math.cos(angle)*radius, y = config.sun[1]+Math.sin(angle)*radius*config.flatten;
    return {x,y,rx:1.3+i%3*.55,ry:1+i%2*.5,opacity:.24+(i%5)*.1};
  }).filter(({x,y})=>x>=0 && x<=config.width && y>=0 && y<=config.height);
}
function particles(layout: MapLayout, region: 'asteroid' | 'kuiper') {
  return beltParticles(layout,region).map(p=>`<ellipse cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" rx="${p.rx}" ry="${p.ry}" fill="${region==='asteroid' ? '#c9ae80' : '#a4d2d4'}" opacity="${p.opacity}"/>`).join('');
}
function moonDrawing(body: MapBody, x:number, y:number, prefix:string) {
  const r = body.size/2;
  return `<g transform="translate(${x} ${y})" aria-hidden="true"><ellipse rx="${r}" ry="${body.id==='phobos' ? r*.75 : r}" fill="${body.colour}"/><ellipse rx="${r}" ry="${body.id==='phobos' ? r*.75 : r}" fill="url(#${prefix}-shade)"/><circle cx="${-r*.35}" cy="${-r*.2}" r="${r*.22}" fill="#36474c" opacity=".17"/><circle cx="${r*.25}" cy="${r*.4}" r="${r*.13}" fill="#36474c" opacity=".2"/></g>`;
}
function bodyMarkup(body: MapBody, layout: MapLayout, level:Level, prefix:string) {
  const [x,y] = body[layout], box = labelBox(body,layout), href = `#wiki/${mapDestination(body)}/${level+1}`;
  const parentName = body.parent ? MAP_BODIES.find(p=>p.id===body.parent)!.name : '';
  const drawing = body.art ? `<image href="${WORLD_ART[body.art].full}" x="${x-body.size/2}" y="${y-body.size/2}" width="${body.size}" height="${body.size}" aria-hidden="true"/>` : moonDrawing(body,x,y,prefix);
  return `<g class="solar-object ${body.parent ? 'solar-moon' : 'solar-planet'}" data-body="${body.id}">
    ${box ? leader(body,layout) : ''}
    <a class="solar-body-link" href="${href}" aria-label="${box ? `Explore ${body.name}` : `Explore ${parentName} and its moons`}">
      <circle class="solar-target" cx="${x}" cy="${y}" r="${Math.max(body.size*.5,29)}"/>${drawing}
    </a>
    ${box ? `<a class="solar-label-link" href="${href}" aria-label="Read about ${body.name}"><rect class="solar-callout" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="9"/>
      <text class="solar-label-title" x="${box.x+box.width/2}" y="${box.y+box.height/2}" dominant-baseline="central">${body.name}</text></a>` : ''}
  </g>`;
}
/** A continuous elliptical annulus, with matching inner and outer boundaries.
 * A thick ellipse stroke would have the wrong thickness at the flattened ends. */
function beltPath(layout: MapLayout, region:'asteroid'|'kuiper') {
  const {sun:[x,y],flatten,[region]:[min,max]} = MAP_LAYOUTS[layout];
  return [max,min].map(r=>`M${x+r} ${y}A${r} ${r*flatten} 0 1 0 ${x-r} ${y}A${r} ${r*flatten} 0 1 0 ${x+r} ${y}Z`).join('');
}
function regionMarkup(layout: MapLayout, region:'asteroid'|'kuiper', level:Level) {
  const id = region === 'asteroid' ? 'asteroid-belt' : 'kuiper-belt';
  return `<g class="solar-region solar-${region}"><a href="#wiki/${id}/${level+1}" aria-label="Explore the ${region === 'asteroid' ? 'asteroid belt' : 'Kuiper Belt'}"><path class="solar-belt-target" d="${beltPath(layout,region)}" fill-rule="evenodd"/></a><g aria-hidden="true">${particles(layout,region)}</g></g>`;
}
function regionLabel(layout:MapLayout, region:'asteroid'|'kuiper', level:Level) {
  const [x,y] = MAP_LAYOUTS[layout][region==='asteroid' ? 'asteroidLabel' : 'kuiperLabel'];
  const title = region==='asteroid' ? 'Asteroid belt' : 'Kuiper Belt', width = region==='asteroid' ? 250 : 218;
  return `<a class="solar-label-link solar-region-label" data-region="${region}" href="#wiki/${region}-belt/${level+1}"><rect class="solar-callout" x="${x-width/2}" y="${y-26}" width="${width}" height="52" rx="9"/><text class="solar-label-title" x="${x}" y="${y}" dominant-baseline="central">${title}</text></a>`;
}
function mapSVG(layout:MapLayout, level:Level, instance:string) {
  const {width,height,sun,flatten} = MAP_LAYOUTS[layout], prefix = `solar-${instance}-${layout}`;
  const planets = MAP_BODIES.filter(b=>!b.parent && b.id!=='sun' && b.id!=='pluto');
  const orbits = planets.map(b=> { const rx=solarOrbitRadius(b,layout); return `<ellipse cx="${sun[0]}" cy="${sun[1]}" rx="${rx}" ry="${rx*flatten}"/>`; }).join('');
  const moons = MAP_BODIES.filter(b=>b.parent).map(b=> {
    const {x,y,rx,ry} = moonOrbit(b,layout);
    return `<ellipse data-moon-orbit="${b.id}" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`;
  }).join('');
  return `<svg class="solar-map-svg solar-map-${layout}" viewBox="0 0 ${width} ${height}" role="group" aria-labelledby="${prefix}-title ${prefix}-desc">
    <title id="${prefix}-title">The Solar System, its belts and selected moons</title><desc id="${prefix}-desc">Eight staggered planets orbit the Sun. Compact dashed loops show moons around their parent worlds. The Moon and Ganymede have names and their own articles; other companions lead to their parent world. The continuous asteroid belt lies between Mars and Jupiter. Beyond Neptune is the icy Kuiper Belt, with Pluto. Sizes, distances and orbital shapes are schematic, not to scale.</desc>
    <defs><radialGradient id="${prefix}-shade" cx="28%" cy="25%" r="76%"><stop offset="0" stop-color="#fff5d7" stop-opacity=".3"/><stop offset=".55" stop-color="#142831" stop-opacity="0"/><stop offset="1" stop-color="#102129" stop-opacity=".7"/></radialGradient></defs>
    <image href="${background}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"/>
    <rect width="${width}" height="${height}" fill="#071f2b" opacity=".25" aria-hidden="true"/>
    <g class="solar-sun-orbits" aria-hidden="true">${orbits}</g>
    ${regionMarkup(layout,'asteroid',level)}${regionMarkup(layout,'kuiper',level)}
    <g class="solar-moon-orbits" aria-hidden="true">${moons}</g>
    ${layout==='wide' ? '<text x="52" y="66" class="solar-map-heading">THE SOLAR FAMILY</text><text x="52" y="105" class="solar-map-subheading">One star. Many worlds. Small orbits within larger ones.</text>' : ''}
    ${MAP_BODIES.map(b=>bodyMarkup(b,layout,level,prefix)).join('')}
    ${regionLabel(layout,'asteroid',level)}${regionLabel(layout,'kuiper',level)}
  </svg>`;
}
export function solarPlate(level:Level, instance='article') {
  return `<figure class="atlas-plate atlas-solar-plate"><div class="solar-map-frame">${mapSVG('wide',level,instance)}${mapSVG('tall',level,instance)}</div><figcaption><span class="solar-legend"><span><i></i> Around the Sun</span><span><i></i> Around a parent world</span></span><strong>Not to scale · selected moons · illustrative positions</strong></figcaption><p class="solar-map-hint">Choose a world or its name. The small loops belong to nearby parent worlds; each belt is a sparse region of separate objects.</p></figure><button type="button" class="atlas-enlarge">View larger illustration ↗</button>`;
}
