import type { PlanetFact } from './planet-facts.ts';

export const FACT_TOPICS = [
  { key: 'mass', label: 'Mass', field: 'mass', question: 'How much stuff is in this world?' },
  { key: 'diameter', label: 'Diameter', field: 'diameter', question: 'How wide is this world?' },
  { key: 'distance', label: 'Distance from Sun', field: 'distance', question: 'How far does sunlight travel?' },
  { key: 'gravity', label: 'Gravity', field: 'gravity', question: 'How strong is the downward pull?' },
  { key: 'tilt', label: 'Axial tilt', field: 'axialTilt', question: 'Does this world lean as it spins?' },
  { key: 'day', label: 'Day length', field: 'dayLength', question: 'How long until another day?' },
  { key: 'year', label: 'Year / orbit', field: 'yearLength', question: 'How long for one trip around?' },
  { key: 'temp-average', label: 'Average temp', field: 'averageTemp', question: 'What does an average temperature tell us?' },
  { key: 'temp-min', label: 'Minimum temp', field: 'minTemp', question: 'Where is it colder?' },
  { key: 'temp-max', label: 'Maximum temp', field: 'maxTemp', question: 'Where is it hotter?' },
] as const;
export type FactKey = typeof FACT_TOPICS[number]['key'];
type Source = readonly [string, string];
export interface FactExplanation {
  title: string; label: string; value: string; valueLabel: string;
  paragraphs: string[]; comparison?: { value: string; label: string };
  sources: Source[];
}
const nasaFacts: Source = ['NASA · Planetary fact sheets', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/'];
const nasaTemperatures: Source = ['NASA · Temperatures across the Solar System', 'https://science.nasa.gov/solar-system/temperatures-across-our-solar-system/'];
const worldSource = (id: string): Source => ['NASA · About this world', `https://science.nasa.gov/${id === 'pluto' ? 'dwarf-planets/pluto' : id === 'ganymede' ? 'jupiter/jupiter-moons/ganymede' : id}/facts/`];
const giants = ['jupiter', 'saturn', 'uranus', 'neptune'];
const format = (number: number) => number.toLocaleString('en-GB', { maximumFractionDigits: 1 });

/** Integer arithmetic keeps all the zeros of a rounded teaching value intact. */
export function massInTonnes(mass: string): bigint {
  const match = /^(\d+)\.(\d+) × 10([⁰¹²³⁴⁵⁶⁷⁸⁹]+) kg$/.exec(mass);
  if (!match) throw new Error(`Unsupported mass: ${mass}`);
  const exponent = Number([...match[3]].map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join(''));
  return BigInt(match[1] + match[2]) * 10n ** BigInt(exponent - match[2].length - 3);
}
export const ELEPHANT_TONNES = 5n;

interface TemperatureStory { label?: string; where: string; story: string; source?: Source }
const temperatures: Record<string, { cold: TemperatureStory; hot: TemperatureStory }> = {
  sun: {
    cold: { label: 'Cool sunspots', where: 'In the dark centres of sunspots', story: 'Magnetic fields can hold back some of the heat rising to the visible surface. These patches look dark beside their brighter surroundings, but would still shine brilliantly by themselves. This is a typical sunspot temperature, not an absolute minimum.', source: ['NASA · Sunspots', 'https://starchild.gsfc.nasa.gov/docs/StarChild/questions/question17.html'] },
    hot: { label: 'Hot core', where: 'Deep in the Sun’s core', story: 'Here, enormous pressure and heat allow hydrogen nuclei to join together. This is nuclear fusion: the source of the Sun’s energy. The visible surface is much cooler; the glowing gas above it, called the corona, can reach millions of degrees too.' },
  },
  mercury: {
    cold: { where: 'On the surface during the long night', story: 'With almost no air to hold warmth or carry it around, the ground loses heat into space. This is an approximate night-time low. Some craters near the poles never see sunlight and can stay even colder, allowing water ice to survive.' },
    hot: { where: 'On sunlit ground near the middle of the day', story: 'The Sun heats the bare rock for a very long time. There is almost no atmosphere to spread the heat to the night side. A kitchen oven is usually far cooler than this!' },
  },
  venus: {
    cold: { label: 'Cool highlands', where: 'In the highest mountain regions, such as Maxwell Montes', story: 'At roughly 10 kilometres above the low plains, the air is less hot. “Cool” is very relative: even here, the temperature is above the melting point of lead. This is an approximate high-altitude surface value, not a weather-station record.', source: ['NASA · Extreme environments report', 'https://solarsystem.nasa.gov/system/downloadable_items/159_Technology_Reports_-EE-Report_FINAL_20072.pdf'] },
    hot: { label: 'Hot lowlands', where: 'On the low plains beneath the thick atmosphere', story: 'The carbon-dioxide atmosphere makes it difficult for heat to escape to space. Low ground stays fiercely hot by day and night. Around 480 °C is an illustrative hot surface value; height matters much more than whether the Sun is up.', source: ['NASA · Venus and its clouds', 'https://nightsky.jpl.nasa.gov/news/190/'] },
  },
  earth: {
    cold: { where: 'Vostok Station, high on Antarctica’s ice sheet', story: 'On 21 July 1983, a thermometer measured −89.2 °C in the air. It was the southern winter, with a long polar night. This is the World Meteorological Organization’s recognised lowest directly measured air temperature; satellite measurements of the ice surface are a different thing.', source: ['WMO · World weather records', 'https://wmo.int/files/records-of-weather-and-climate-extremes-table'] },
    hot: { where: 'Furnace Creek, Death Valley, California, USA', story: 'On 10 July 1913, the air reached 56.7 °C. This dry desert basin lies below sea level and can trap intense summer heat. The World Meteorological Organization recognises it as the highest air-temperature record. Sunlit ground can be hotter still.', source: ['WMO · World weather records', 'https://wmo.int/files/records-of-weather-and-climate-extremes-table'] },
  },
  moon: {
    cold: { where: 'Inside permanently shadowed craters near the poles', story: 'Some deep crater floors never receive direct sunshine. NASA’s Lunar Reconnaissance Orbiter has found temperatures below −246 °C there. They act as cold traps where ice can survive. An ordinary lunar night is cold too, but typically around −173 °C.', source: ['NASA · Weather on the Moon', 'https://science.nasa.gov/moon/weather-on-the-moon/'] },
    hot: { where: 'On ground in full sunlight, especially near the equator', story: 'The surface can reach about 127 °C during the long lunar day. That is hotter than boiling water at Earth’s sea-level pressure. The Moon has almost no atmosphere to soften the change between blazing sunshine and darkness.' },
  },
  mars: {
    cold: { where: 'In the coldest polar conditions', story: 'Mars has long winters and only a thin blanket of air. Temperatures can fall to around −153 °C. Some of the carbon dioxide in the atmosphere freezes onto the winter polar cap as dry ice. This is an approximate extreme, not the temperature of every Martian night.' },
    hot: { where: 'Near the equator on a sunny summer day', story: 'Sun-warmed ground can reach about 20 °C: surprisingly familiar! But the thin air holds very little heat, and temperatures can plunge after sunset. A warm patch of ground does not make the whole planet warm.' },
  },
  ganymede: {
    cold: { label: 'Cool daytime', where: 'In the cooler parts of Galileo’s map of the sunlit surface', story: 'On 26 June 1996, the Galileo spacecraft mapped daytime temperatures from about −183 °C to −113 °C. Even the sunlit ice was bitterly cold. These are the limits of that particular map, not all-time records; the night side can be colder.', source: ['NASA · Galileo’s temperature map', 'https://science.nasa.gov/photojournal/temperature-map-of-ganymede/'] },
    hot: { label: 'Warm daytime', where: 'In the warmer parts of that same sunlit surface map', story: 'Galileo’s warmest mapped areas reached about −113 °C. That is still far colder than a home freezer, usually around −18 °C. Water ice here stays hard; the hidden ocean is far below the frozen surface.', source: ['NASA · Galileo’s temperature map', 'https://science.nasa.gov/photojournal/temperature-map-of-ganymede/'] },
  },
  pluto: {
    cold: { where: 'On Pluto’s frigid, frosty surface', story: 'About −240 °C is the cold end of NASA’s estimated surface range, not a record from a named weather station. Conditions depend on sunlight and Pluto’s very stretched orbit. In colder conditions, gases can freeze out of its thin atmosphere onto the ground.' },
    hot: { where: 'In warmer, sunlit surface conditions', story: 'About −226 °C is the warm end of NASA’s estimated surface range. It is still colder than any natural surface on Earth. When Pluto warms, some nitrogen ice changes straight into gas, helping feed its thin atmosphere.' },
  },
};

export function factLabel(fact: PlanetFact, key: FactKey): string {
  if (key === 'temp-min' || key === 'temp-max') {
    if (giants.includes(fact.id)) return key === 'temp-min' ? 'Cold upper layer' : 'Warmer deep layer';
    return temperatures[fact.id][key === 'temp-min' ? 'cold' : 'hot'].label ?? FACT_TOPICS.find(t => t.key === key)!.label;
  }
  return FACT_TOPICS.find(t => t.key === key)!.label;
}

const dayStories: Record<string, string> = {
  sun: 'The Sun is glowing gas, so it does not turn like a solid ball. Near its equator, a turn takes about 25 Earth days; near its poles it takes about 35. These are rotation times, not days with a sunrise on solid ground.',
  mercury: 'This is noon to the next noon: a solar day. Mercury turns once relative to the stars in about 59 Earth days, but also moves around the Sun. The two motions combine to make one solar day last two Mercury years!',
  venus: 'This is noon to the next noon. Venus turns very slowly and backwards: a turn relative to the stars takes about 243 Earth days. Its movement around the Sun makes the solar day shorter, about 117 Earth days.',
  earth: 'A day here is about 24 hours from one noon to the next. Our spin turns different parts of Earth towards the Sun, then away again. That is why we have daylight and night.',
  moon: 'From one lunar noon to the next takes about 29.5 Earth days: roughly two weeks of daylight followed by two weeks of darkness away from the poles. Its spin relative to the stars takes 27.3 days, the same as its trip around Earth.',
  mars: 'A Martian day is called a sol. It lasts only about 39 minutes longer than ours, so a Mars clock would feel quite familiar. A day and a year measure different motions: spinning and orbiting.',
  jupiter: 'The largest planet spins in less than ten hours. You could fit more than two Jupiter days into one Earth day! Its clouds move at different speeds, so the quoted spin time represents the planet’s bulk rotation.',
  ganymede: 'Ganymede spins once in the same time it takes to orbit Jupiter. That keeps one face pointing towards the planet: tidal locking. This number describes a turn relative to the stars; noon to noon is very slightly longer.',
  saturn: 'A whole turn takes less than half an Earth day. There is no solid ground with a clock on it: scientists infer the spin beneath Saturn’s moving clouds. The time shown is rounded.',
  uranus: 'Uranus turns in about 17 hours, but it leans so far over that its poles can have decades of daylight or darkness. A rotation time does not always tell you how long you must wait for sunrise.',
  neptune: 'A turn takes about 16 hours. Its clouds and fierce winds do not all move together; the number represents the planet’s estimated bulk rotation, rather than one particular cloud.',
  pluto: 'One turn takes almost a week on Earth. Pluto and its large moon Charon always show each other the same faces. From the right place on Pluto, Charon would seem to stay in the same part of the sky.',
};
const tiltStories: Record<string, string> = {
  sun: 'The Sun’s equator leans about 7.25° compared with the plane of Earth’s orbit. For a star at the centre of the system, this reference is more useful than a “year around the Sun”.',
  mercury: 'Mercury is almost upright. Near its poles, the low Sun never reaches the floors of some deep craters. Their permanent shade helps protect ice even so close to the Sun.',
  venus: 'Nearly 180° means almost upside down. Venus spins in the opposite direction to Earth; the Sun would rise in the west. Its thick atmosphere keeps the surface hot through the long days and nights.',
  earth: 'Our lean makes the seasons. When your half of Earth tilts towards the Sun, the days are longer and the sunlight more direct. Six months later the other half gets its turn. Summer is not caused by Earth moving closer to the Sun.',
  moon: 'This 6.7° lean is measured against the Moon’s orbit around Earth. Measured against Earth’s orbit around the Sun, the lean is only about 1.5°. The reference plane matters: small changes in sunlight near the poles help create permanent shadows.',
  mars: 'The lean is similar to Earth’s, so Mars has seasons too. But its year is nearly twice as long, stretching those seasons over more months.',
  jupiter: 'Jupiter is almost upright. Its small lean means the difference between summer and winter sunlight is much smaller than on Earth.',
  ganymede: 'Ganymede is nearly upright compared with its orbit around Jupiter. Its small lean gives much smaller seasonal changes in the angle of sunlight than Earth’s tilt does.',
  saturn: 'Saturn’s lean is similar to Earth’s. As it travels around the Sun, each hemisphere takes its turn facing the sunlight, and the lighting on its rings changes too.',
  uranus: 'Just past 90° means it rolls around the Sun almost on its side. Each pole can spend about 42 Earth years without the Sun setting, followed by about 42 years without it rising.',
  neptune: 'Its lean is similar to Earth’s, so it has seasons. But one orbit lasts about 165 Earth years, so each season lasts roughly four decades!',
  pluto: 'Pluto leans past sideways and spins backwards compared with Earth. Its strong tilt and stretched orbit make extreme, very long seasons.',
};

export function explainFact(fact: PlanetFact, key: FactKey): FactExplanation {
  const topic = FACT_TOPICS.find(t => t.key === key)!;
  const result: FactExplanation = { title: topic.question, label: factLabel(fact, key), value: fact[topic.field], valueLabel: fact.name, paragraphs: [], sources: [nasaFacts, worldSource(fact.id)] };
  if (key === 'mass') {
    const tonnes = massInTonnes(fact.mass);
    result.value = tonnes.toLocaleString('en-GB'); result.valueLabel = 'tonnes, written out in full';
    result.comparison = { value: (tonnes / ELEPHANT_TONNES).toLocaleString('en-GB'), label: 'elephants with the same total mass' };
    result.paragraphs = ['Mass means how much matter — or “stuff” — something contains. One tonne is 1,000 kilograms. All those rocks, gases and other materials add up!', 'Imagine each elephant has a mass of 5 tonnes. Real elephants vary; this is our make-believe measuring unit. We divide the number of tonnes by 5 to count our enormous herd.', `The small tile writes this as ${fact.mass}. That is a compact way to write a huge number. Both versions are approximate: writing out the zeros does not make the measurement more exact.`];
  } else if (key === 'diameter') {
    const km = Number(fact.diameter.replace(/[^\d.]/g, ''));
    result.valueLabel = 'straight across, through the middle';
    result.comparison = { value: fact.id === 'earth' ? '≈ 40,000 km' : `≈ ${format(km / 12_756)} × Earth`, label: fact.id === 'earth' ? 'for a journey all the way around the equator' : 'as wide, using the same ruler' };
    result.paragraphs = ['Imagine cutting an orange in half. A straight line from one edge through the centre to the other edge is its diameter. A trip around the outside is much longer.', giants.includes(fact.id) ? 'For a giant planet, we measure across the atmosphere at a chosen pressure level: there is no solid beach marking the edge. Fast spinning makes these worlds bulge around their equators.' : fact.id === 'sun' ? 'The Sun is about 109 Earths wide. This measurement reaches across the visible glowing layer, called the photosphere; the Sun’s outer atmosphere extends much farther.' : 'The number is rounded. Worlds are not perfectly smooth balls, and many bulge slightly around the equator. A kilometre is 1,000 metres.'];
  } else if (key === 'distance') {
    const km = parseFloat(fact.distance.replace(/,/g, '')) * (fact.distance.includes('billion') ? 1e9 : fact.distance.includes('million') ? 1e6 : 1);
    const minutes = km / 299_792.458 / 60;
    result.valueLabel = fact.id === 'sun' ? 'the Sun is our starting point' : 'average distance from the Sun';
    result.comparison = { value: fact.id === 'sun' ? '≈ 8 minutes 20 seconds' : minutes >= 60 ? `≈ ${format(minutes / 60)} hours` : `≈ ${format(minutes)} minutes`, label: fact.id === 'sun' ? 'for sunlight to reach Earth' : 'for sunlight to reach this world' };
    result.paragraphs = [fact.id === 'sun' ? 'Zero does not mean the Sun is beside us! We are measuring distances outwards from the Sun itself. Earth is about 150 million kilometres away.' : 'Even light takes time to cross space. It travels about 300,000 kilometres every second. The sunlight reaching this world began its journey that many minutes or hours ago.', fact.id === 'moon' ? 'This is the Moon’s distance from the Sun, not from Earth. It travels around the Sun with us. Its average distance from Earth is much smaller: about 384,400 kilometres, or 1.3 light-seconds.' : fact.id === 'ganymede' ? 'This is the distance from the Sun, not from Jupiter. Ganymede travels around the Sun with Jupiter while also orbiting about 1.07 million kilometres from Jupiter’s centre.' : 'Most orbits are stretched circles called ellipses. This rounded average describes the size of the orbit; the distance at a particular moment can be different.'];
  } else if (key === 'gravity') {
    const g = parseFloat(fact.gravity);
    result.valueLabel = 'metres per second of speed gained each second';
    result.comparison = { value: `≈ ${format(10 * g / 9.81)} kg`, label: 'the Earth load that would feel like holding a 10 kg bag here' };
    result.paragraphs = [`Gravity is a pull between objects with mass. Close to this world, a dropped object gains about ${format(g)} metres per second of downward speed every second, if we ignore air and the small change in gravity as it falls.`, 'Your bag would still contain 10 kilograms of stuff. What changes is its weight: how strongly gravity pulls on it. Mass and weight are related, but they are not the same thing.', giants.includes(fact.id) || fact.id === 'sun' ? 'This is an imagined comparison at the reference level used for the world’s size. There is no solid ground to stand on there. The game gives you a pretend launching place.' : 'We use one rounded gravity value for the whole world. In reality, height, latitude and nearby mountains make small differences.'];
  } else if (key === 'tilt') {
    result.valueLabel = 'the lean of the spin axis';
    result.paragraphs = ['Imagine a spinning top. Its axis is the invisible line it spins around. At 0° it stands upright compared with its orbit; at 90° it lies on its side. Past 90°, we describe it as tipped over and spinning backwards.', tiltStories[fact.id]];
  } else if (key === 'day') {
    result.valueLabel = fact.id === 'sun' || fact.id === 'ganymede' ? 'for one rotation' : 'for one day';
    result.paragraphs = [dayStories[fact.id], '“Earth days” lets us compare worlds with the same clock. A solar day measures noon to noon; a rotation measures a turn relative to distant stars. Moving around an orbit can make those two times different.'];
  } else if (key === 'year') {
    result.valueLabel = fact.id === 'moon' ? 'one orbit around Earth' : fact.id === 'ganymede' ? 'one orbit around Jupiter' : fact.id === 'sun' ? 'one orbit around the Milky Way' : 'one orbit around the Sun';
    result.paragraphs = [fact.id === 'sun' ? 'Even our Sun is travelling. It carries the Solar System around the centre of our galaxy, the Milky Way. One enormous lap takes roughly 230 million Earth years.' : fact.id === 'moon' ? 'The Moon completes a lap of Earth in about 27.3 days. Earth and the Moon also travel around the Sun together once each Earth year. The Moon’s phases repeat a little more slowly, in about 29.5 days, because Earth moves along its orbit too.' : fact.id === 'ganymede' ? 'Ganymede makes a lap of Jupiter in just over a week. Together, they take about 11.86 Earth years to circle the Sun. “Orbit” is useful here because a moon has both a parent planet and a journey around the Sun.' : `A year is one complete trip around the Sun. ${fact.name === 'Earth' ? 'Our calendars keep track of Earth’s journey. The extra quarter-day is why we need leap years.' : 'Farther-out planets have longer paths and usually move more slowly, making their years longer.'}`, 'An orbit is a journey held in a curve by gravity. It is different from spinning: a world can turn many times during a single lap.'];
  } else if (key === 'temp-average') {
    result.valueLabel = fact.id === 'sun' ? 'the visible photosphere' : giants.includes(fact.id) ? 'a reference level in the atmosphere' : 'a rounded surface average';
    result.paragraphs = [fact.id === 'sun' ? 'This describes the bright layer we see, called the photosphere. It is not an average of the whole Sun: the core and outer corona are much hotter.' : giants.includes(fact.id) ? 'There is no solid surface here. To compare giant planets, scientists choose an atmospheric level where the pressure is about the same as Earth’s air at sea level: one bar. Higher and deeper layers can be very different.' : 'An average combines many places or conditions into one useful number. It does not mean everywhere feels like this. Day, night, height and seasons can make individual places much warmer or colder.', 'On the Celsius scale, pure water freezes at 0 °C and boils at 100 °C at Earth’s sea-level pressure. A home freezer is usually around −18 °C. These familiar markers help us picture very unfamiliar worlds.'];
    result.sources = [nasaTemperatures, worldSource(fact.id)];
  } else {
    const cold = key === 'temp-min';
    if (giants.includes(fact.id)) {
      result.valueLabel = cold ? 'high in the atmosphere, at 0.1 bar' : 'deeper in the atmosphere, at 1 bar';
      result.paragraphs = [cold ? 'Here the gas pressure is only a tenth of Earth’s sea-level air pressure. This thin, cold layer is high above the deeper atmosphere. There is no frozen ground to stand on.' : 'Farther down, the gas is squeezed more tightly and is warmer. At this reference layer, its pressure is similar to Earth’s air at sea level. Go much deeper and temperatures rise enormously.', 'These are two named atmospheric layers, not the coldest and hottest temperatures anywhere on the planet. There is no single surface weather report for a giant world.', 'A bar measures pressure: the push of gas on its surroundings. Specifying the layer tells us where the temperature belongs.'];
      result.sources = [[`NASA · ${fact.name} atmospheric measurements`, `https://nssdc.gsfc.nasa.gov/planetary/factsheet/${fact.id}fact.html`]];
    } else {
      const story = temperatures[fact.id][cold ? 'cold' : 'hot'];
      result.valueLabel = story.where; result.paragraphs = [story.story];
      result.sources = [story.source ?? worldSource(fact.id)];
    }
  }
  return result;
}
