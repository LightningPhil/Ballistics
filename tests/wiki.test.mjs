import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTICLES, LEVELS, MOON_FAMILIES, articleNeighbours, getArticle, parseWikiHash, searchArticles } from '../src/wiki/content.ts';
import { MAP_BODIES, MAP_LAYOUTS, labelBox, solarOrbitRadius, moonOrbit, mapDestination, beltParticles, solarPlate } from '../src/wiki/solar-map.ts';

test('every atlas topic has three substantial, distinct explanations and valid connections', () => {
  assert.equal(new Set(ARTICLES.map(a => a.id)).size, ARTICLES.length);
  assert.equal(LEVELS.length, 3);
  for (const article of ARTICLES) {
    assert.equal(article.levels.length, 3, article.id);
    assert.equal(new Set(article.levels.map(l => l.paragraphs.join(' '))).size, 3, article.id);
    for (const reading of article.levels) {
      assert.ok(reading.paragraphs.length >= 2 && reading.paragraphs.every(p => p.trim().length > 0), `${article.id}: no missing explanations`);
      assert.ok(reading.heading && reading.takeaway);
    }
    for (const id of article.related) assert.ok(getArticle(id), `${article.id} has no broken related links`);
    for (const [, url] of article.sources) assert.equal(new URL(url).protocol, 'https:');
  }
});

test('the atlas contains all eight planets, separate moons, and all requested science topics', () => {
  const planets = ARTICLES.filter(a => a.kind.match(/^0[1-8] \/ /));
  assert.deepEqual(planets.map(a => a.id), ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
  for (const id of ['solar-system', 'sun', 'moon', 'ganymede', 'pluto', 'asteroid-belt', 'kuiper-belt', 'cannons', 'rockets']) assert.ok(getArticle(id));
  assert.deepEqual(MOON_FAMILIES.find(f => f.planet === 'earth').moons, ['The Moon']);
  assert.ok(MOON_FAMILIES.find(f => f.planet === 'jupiter').moons.includes('Ganymede'));
  for (const id of ['mercury', 'venus']) assert.deepEqual(MOON_FAMILIES.find(f => f.planet === id).moons, []);
  assert.ok(getArticle('pluto').kind.includes('Dwarf planet'));
  for (const id of ['phobos','titan','titania','triton','charon']) assert.equal(getArticle(id),undefined,`${id} is covered with its parent, without a separate page`);
});

test('both map compositions preserve orbital order, belt placement and moon families', () => {
  for (const layout of ['wide','tall']) {
    const config = MAP_LAYOUTS[layout];
    const planets = MAP_BODIES.filter(b => !b.parent && !['sun','pluto'].includes(b.id));
    const radii = planets.map(b => solarOrbitRadius(b,layout));
    assert.deepEqual(radii, [...radii].sort((a,b)=>a-b), `${layout}: planets stay in solar order`);
    assert.ok(radii[3] < config.asteroid[0] && config.asteroid[1] < radii[4]);
    assert.ok(radii[7] < config.kuiper[0]);
    const plutoRadius = solarOrbitRadius(MAP_BODIES.find(b=>b.id==='pluto'),layout);
    assert.ok(plutoRadius > config.kuiper[0] && plutoRadius < config.kuiper[1]);
    const phases = [];
    for (const moon of MAP_BODIES.filter(b=>b.parent)) {
      assert.ok(MOON_FAMILIES.find(f=>f.planet===moon.parent).moons.includes(moon.name));
      const parent = MAP_BODIES.find(b=>b.id===moon.parent);
      const [mx,my] = moon[layout], [px,py] = parent[layout];
      assert.ok(Math.hypot(mx-px,my-py) < 180, `${moon.id}: remains near its parent`);
      phases.push(Math.sign((mx-px)*(px-config.sun[0])+(my-py)*(py-config.sun[1])));
    }
    assert.ok(phases.includes(-1) && phases.includes(1), `${layout}: moons occupy both sunward and outward positions`);
  }
});

test('map callouts alternate, fit each canvas, and do not overlap other callouts or bodies', () => {
  for (const layout of ['wide','tall']) {
    const {width,height} = MAP_LAYOUTS[layout];
    const planets = MAP_BODIES.filter(b=>!b.parent && !['sun','pluto'].includes(b.id));
    planets.forEach((b,i)=>assert.equal(Math.sign(labelBox(b,layout).y+26-b[layout][1]),i%2 ? 1 : -1));
    const labelled = MAP_BODIES.filter(b=>labelBox(b,layout));
    for (let i=0;i<labelled.length;i++) {
      const body = labelled[i], box = labelBox(body,layout);
      assert.ok(box.x>=0 && box.y>=0 && box.x+box.width<=width && box.y+box.height<=height, body.id);
      for (let j=i+1;j<labelled.length;j++) {
        const other = labelBox(labelled[j],layout);
        const overlaps = box.x<other.x+other.width && box.x+box.width>other.x && box.y<other.y+other.height && box.y+box.height>other.y;
        assert.equal(overlaps,false,`${layout}: ${body.id}/${labelled[j].id} labels`);
      }
      for (const other of MAP_BODIES) {
        const [x,y] = other[layout];
        const dx = x-Math.max(box.x,Math.min(x,box.x+box.width));
        const dy = y-Math.max(box.y,Math.min(y,box.y+box.height));
        assert.ok(Math.hypot(dx,dy)>other.size*.5,`${layout}: ${body.id} label covers ${other.id}`);
      }
    }
  }
});

test('compact moon orbits have clear space between families and do not cross other worlds', () => {
  const moons = MAP_BODIES.filter(b=>b.parent);
  for (const layout of ['wide','tall']) {
    for (let i=0;i<moons.length;i++) {
      const a=moonOrbit(moons[i],layout);
      assert.ok(a.rx<115,`${layout}: ${moons[i].id} stays compact`);
      for (let j=i+1;j<moons.length;j++) {
        const b=moonOrbit(moons[j],layout);
        assert.ok(Math.abs(a.x-b.x)>a.rx+b.rx+4 || Math.abs(a.y-b.y)>a.ry+b.ry+4,
          `${layout}: ${moons[i].parent}/${moons[j].parent} moon paths need separate space`);
      }
      for (const world of MAP_BODIES.filter(b=>!b.parent && b.id!==moons[i].parent)) {
        for(let step=0;step<360;step++) {
          const angle=step*Math.PI/180, [x,y]=world[layout];
          assert.ok(Math.hypot(x-a.x-a.rx*Math.cos(angle),y-a.y-a.ry*Math.sin(angle))>world.size/2+3,
            `${layout}: ${moons[i].parent}'s moon path crosses ${world.id}`);
        }
      }
    }
  }
});

test('belts form closed annuli with their name-only labels directly on the region', () => {
  const html=solarPlate(0);
  const bands=[...html.matchAll(/<path class="solar-belt-target" d="([^"]+)" fill-rule="evenodd"/g)];
  assert.equal(bands.length,4);
  for (const [,path] of bands) assert.equal((path.match(/Z/g)||[]).length,2,'inner and outer contours both close');
  assert.ok(!html.includes('solar-label-kind'));
  for (const layout of ['wide','tall']) {
    const {sun,flatten}=MAP_LAYOUTS[layout];
    for(const region of ['asteroid','kuiper']) {
      const [x,y]=MAP_LAYOUTS[layout][`${region}Label`], [min,max]=MAP_LAYOUTS[layout][region];
      const r=Math.hypot(x-sun[0],(y-sun[1])/flatten);
      assert.ok(r>min&&r<max,`${layout}: ${region} label sits on its belt`);
    }
  }
  assert.deepEqual(MAP_BODIES.filter(b=>b.parent&&b.wideLabel).map(b=>b.id),['moon','ganymede']);
});

test('belt particles fill the width of the band at every visible angle instead of forming a spiral', () => {
  const {sun,flatten}=MAP_LAYOUTS.wide;
  for(const region of ['asteroid','kuiper']) {
    const [min,max]=MAP_LAYOUTS.wide[region];
    const particles=beltParticles('wide',region).map(({x,y})=>({
      angle:Math.atan2((y-sun[1])/flatten,x-sun[0]),
      radius:Math.hypot(x-sun[0],(y-sun[1])/flatten),
    }));
    // The forward arc is fully visible in both bands over these sectors.
    for (let start=-30;start<30;start+=10) {
      const radii=particles.filter(p=>p.angle>=start*Math.PI/180 && p.angle<(start+10)*Math.PI/180).map(p=>p.radius);
      assert.ok(radii.length>=15,`${region}: no empty angular sector`);
      assert.ok(Math.max(...radii)-Math.min(...radii)>(max-min)*.7,`${region}: particles occupy the band, not one spiral thread`);
    }
  }
});

test('every body and name has the same valid article destination at all levels, including enlarged maps', () => {
  for (const level of [0,1,2]) {
    const html = solarPlate(level);
    for (const body of MAP_BODIES) {
      const destination=mapDestination(body);
      assert.ok(getArticle(destination),body.id);
      const groups=html.split('<g class="solar-object ').filter(g=>g.slice(0,90).includes(`data-body="${body.id}"`));
      assert.equal(groups.length,2);
      for (const group of groups) {
        const links=[...group.split('</svg>')[0].matchAll(/href="#wiki\/([^/]+)\/([1-3])"/g)];
        // Region labels follow the last body, outside its group.
        const own=links.filter(([,id])=>!id.endsWith('-belt'));
        assert.equal(own.length,body.wideLabel?2:1,`${body.id}: matching body/name links only when named`);
        for (const [,id,l] of own) { assert.equal(id,destination); assert.equal(Number(l),level+1); }
      }
      if (!body.wideLabel) {
        assert.ok(!html.includes(`>${body.name}</text>`));
        assert.ok(!html.includes(`href="#wiki/${body.id}/`));
      }
    }
    const full = html+solarPlate(level,'enlarged');
    const ids = [...full.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(new Set(ids).size,ids.length,'enlarged maps have unique SVG IDs');
  }
});

test('turning the pages visits every entry once, in atlas order, then returns to the start', () => {
  const first = ARTICLES[0];
  assert.equal(articleNeighbours(first.id).previous, undefined);
  const visited = [];
  let id = first.id;
  do {
    visited.push(id);
    const { next, wraps } = articleNeighbours(id);
    assert.equal(wraps, next === first, `${id}: only the last entry leads back to the start`);
    if (!wraps) assert.equal(articleNeighbours(next.id).previous.id, id, `${id}: previous undoes next`);
    id = next.id;
  } while (id !== first.id && visited.length <= ARTICLES.length);
  assert.deepEqual(visited, ARTICLES.map(a => a.id));
});

test('pronunciation help is short and only offered where a name is easily misread', () => {
  const said = ARTICLES.filter(a => a.say);
  assert.deepEqual(said.map(a => a.id), ['uranus', 'ganymede', 'kuiper-belt']);
  for (const a of said) assert.match(a.say, /^[A-Za-z]+(-[A-Za-z]+)+( [a-z]+)?$/, a.id);
});

test('search finds scientific ideas inside explanations as well as titles', () => {
  assert.ok(searchArticles('recoil').some(a => a.id === 'cannons'));
  assert.ok(searchArticles('magnetic ocean').some(a => a.id === 'ganymede'));
  assert.ok(searchArticles('  TITAN  ').some(a => a.id === 'saturn'));
  assert.equal(searchArticles('no-such-topic-zzzz').length, 0);
  assert.equal(searchArticles('').length, ARTICLES.length);
});

test('deep links validate topics and levels without treating arbitrary hashes as wiki pages', () => {
  assert.deepEqual(parseWikiHash('#wiki/rockets/3'), { id: 'rockets', level: 2 });
  assert.deepEqual(parseWikiHash('#wiki/earth'), { id: 'earth', level: 0 });
  for (const hash of ['#scene', '#wiki/missing/1', '#wiki/earth/9', '#wiki/<script>/1', '#wiki/earth/0', '#wiki/earth/1/other']) assert.equal(parseWikiHash(hash), null);
});
