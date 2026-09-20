export interface PlanetFact {
  id: string;
  name: string;
  kind: string;
  tagline: string;
  accent: string;
  mass: string;
  diameter: string;
  distance: string;
  gravity: string;
  dayLength: string;
  yearLength: string;
  axialTilt: string;
  averageTemp: string;
  minTemp: string;
  maxTemp: string;
  temperatureNote: string;
  atmosphere: string;
  exploration: string;
}

/** Rounded teaching values from NASA/NSSDC and JPL planetary fact sheets.
 * Giant-planet temperatures refer to their visible/one-bar cloud level.
 */
export const PLANET_FACTS: Readonly<Record<string, PlanetFact>> = Object.freeze({
  sun: {
    id: 'sun', name: 'Sun', kind: 'STAR · G2 V', accent: '#f1a844',
    tagline: 'The star holding the whole Solar System together.',
    mass: '1.988 × 10³⁰ kg', diameter: '1,391,400 km', distance: '0 km',
    gravity: '274 m/s²', dayLength: '25–35 Earth days', yearLength: '≈230m y around galaxy', axialTilt: '7.25°',
    averageTemp: '5,500 °C', minTemp: '4,100 °C', maxTemp: '6,300 °C',
    temperatureNote: 'Photosphere; the corona can exceed 2,000,000 °C.',
    atmosphere: 'No solid surface. Its visible atmosphere is mostly hydrogen and helium: photosphere, chromosphere, then the super-hot corona.',
    exploration: 'No landing is possible. Parker Solar Probe became the first craft to fly through the corona; SOHO and Solar Orbiter keep watch from safer distances.',
  },
  mercury: {
    id: 'mercury', name: 'Mercury', kind: 'ROCKY PLANET', accent: '#9f9485',
    tagline: 'Tiny, speedy and baked by the nearest Sun.',
    mass: '3.30 × 10²³ kg', diameter: '4,879 km', distance: '57.9 million km',
    gravity: '3.70 m/s²', dayLength: '176 Earth days', yearLength: '88 Earth days', axialTilt: '0.034°',
    averageTemp: '167 °C', minTemp: '−180 °C', maxTemp: '430 °C',
    temperatureNote: 'Airless surface: freezing nights and scorching days.',
    atmosphere: 'Almost none—only an extremely thin exosphere of oxygen, sodium, hydrogen, helium and potassium.',
    exploration: 'Mariner 10 made three flybys. MESSENGER became the first orbiter and found water ice in permanently shadowed polar craters. BepiColombo is the next visitor.',
  },
  venus: {
    id: 'venus', name: 'Venus', kind: 'ROCKY PLANET', accent: '#d6ae57',
    tagline: 'Earth-sized, cloud-wrapped and hotter than Mercury.',
    mass: '4.87 × 10²⁴ kg', diameter: '12,104 km', distance: '108.2 million km',
    gravity: '8.87 m/s²', dayLength: '116.8 Earth days', yearLength: '224.7 Earth days', axialTilt: '177.4°',
    averageTemp: '464 °C', minTemp: '438 °C', maxTemp: '482 °C',
    temperatureNote: 'Surface estimates vary mostly with elevation.',
    atmosphere: 'A crushing blanket of carbon dioxide and nitrogen, with sulfuric-acid clouds. Surface pressure is about 92 times Earth’s.',
    exploration: 'Soviet Venera probes returned the first surface pictures. Magellan mapped the planet by radar; Venus Express and Akatsuki studied its restless atmosphere.',
  },
  earth: {
    id: 'earth', name: 'Earth', kind: 'ROCKY PLANET · HOME', accent: '#4f9682',
    tagline: 'The only world known to have oceans and life.',
    mass: '5.97 × 10²⁴ kg', diameter: '12,756 km', distance: '149.6 million km',
    gravity: '9.81 m/s²', dayLength: '24 hours', yearLength: '365.25 days', axialTilt: '23.4°',
    averageTemp: '15 °C', minTemp: '−89 °C', maxTemp: '57 °C',
    temperatureNote: 'Global mean plus recorded near-surface extremes.',
    atmosphere: 'About 78% nitrogen, 21% oxygen, with argon, water vapour, carbon dioxide and traces of other gases.',
    exploration: 'We live here. Thousands of satellites, weather stations, ships and field teams observe Earth continuously; people have occupied orbit since 2000.',
  },
  moon: {
    id: 'moon', name: 'Moon', kind: 'EARTH’S MOON', accent: '#aaa79f',
    tagline: 'Our bright companion—and the only world humans have visited.',
    mass: '7.35 × 10²² kg', diameter: '3,475 km', distance: '149.6 million km*',
    gravity: '1.62 m/s²', dayLength: '29.5 Earth days', yearLength: '27.3 d around Earth', axialTilt: '6.7°',
    averageTemp: '−20 °C', minTemp: '−173 °C', maxTemp: '127 °C',
    temperatureNote: '*Travels around the Sun with Earth; temperatures span lunar night/day.',
    atmosphere: 'Effectively airless, with a vanishingly thin exosphere. With no weather, footprints can last for millions of years.',
    exploration: 'Twenty-four Apollo astronauts travelled to the Moon and twelve walked there. Robotic orbiters and landers from many nations continue the exploration.',
  },
  mars: {
    id: 'mars', name: 'Mars', kind: 'ROCKY PLANET', accent: '#c96d4f',
    tagline: 'A cold desert with giant volcanoes and ancient river valleys.',
    mass: '6.42 × 10²³ kg', diameter: '6,792 km', distance: '228.0 million km',
    gravity: '3.72 m/s²', dayLength: '24 h 39 min', yearLength: '687 Earth days', axialTilt: '25.2°',
    averageTemp: '−65 °C', minTemp: '−125 °C', maxTemp: '20 °C',
    temperatureNote: 'Surface temperatures swing with season, place and time of day.',
    atmosphere: 'Thin carbon dioxide, with nitrogen and argon. Dust hangs in the air and planet-wide storms can hide the surface.',
    exploration: 'Viking made the first long-lived landings. Sojourner, Spirit, Opportunity, Curiosity and Perseverance explored by rover; many orbiters map from above.',
  },
  jupiter: {
    id: 'jupiter', name: 'Jupiter', kind: 'GAS GIANT', accent: '#c58662',
    tagline: 'The largest planet, with storms bigger than Earth.',
    mass: '1.898 × 10²⁷ kg', diameter: '142,984 km', distance: '778.5 million km',
    gravity: '25.92 m/s²', dayLength: '9 h 56 min', yearLength: '11.86 Earth years', axialTilt: '3.1°',
    averageTemp: '−110 °C', minTemp: '≈ −145 °C', maxTemp: '≈ −85 °C',
    temperatureNote: 'Cloud-top/one-bar estimates; there is no solid surface.',
    atmosphere: 'Mostly hydrogen and helium, with ammonia and water clouds. Deeper down, pressure squeezes hydrogen into exotic fluid states.',
    exploration: 'Pioneer and Voyager flew past; Galileo orbited and dropped a probe into the clouds. Juno is mapping the deep interior while Europa Clipper heads to its moon system.',
  },
  ganymede: {
    id: 'ganymede', name: 'Ganymede', kind: 'JUPITER’S ICE MOON', accent: '#75afbb',
    tagline: 'The Solar System’s largest moon, hiding a deep saltwater ocean.',
    mass: '1.482 × 10²³ kg', diameter: '5,268 km', distance: '778.5 million km*',
    gravity: '1.43 m/s²', dayLength: '7.155 Earth days', yearLength: '7.155 d around Jupiter', axialTilt: '0–0.33°',
    averageTemp: '−163 °C', minTemp: '−203 °C', maxTemp: '−121 °C',
    temperatureNote: '*Travels around the Sun with Jupiter; it keeps one face towards Jupiter.',
    atmosphere: 'Almost none—just an extremely thin oxygen exosphere above grooved water ice. A salty ocean may lie beneath roughly 150 km of ice.',
    exploration: 'Pioneer and Voyager flew past; Galileo and Juno returned close-up data. ESA’s JUICE is travelling there to become the first moon-orbiting spacecraft.',
  },
  saturn: {
    id: 'saturn', name: 'Saturn', kind: 'GAS GIANT', accent: '#c6aa6e',
    tagline: 'A pale giant wearing the Solar System’s grandest rings.',
    mass: '5.68 × 10²⁶ kg', diameter: '120,536 km', distance: '1.432 billion km',
    gravity: '11.19 m/s²', dayLength: '10 h 42 min', yearLength: '29.45 Earth years', axialTilt: '26.7°',
    averageTemp: '−140 °C', minTemp: '≈ −191 °C', maxTemp: '≈ −122 °C',
    temperatureNote: 'Cloud-top/one-bar estimates; there is no solid surface.',
    atmosphere: 'Mostly hydrogen and helium, with ammonia-ice clouds. Ferocious winds and a hexagonal north-polar jet circle the planet.',
    exploration: 'Pioneer 11 and the Voyagers flew past. Cassini orbited for 13 years, while its Huygens probe landed on the moon Titan.',
  },
  uranus: {
    id: 'uranus', name: 'Uranus', kind: 'ICE GIANT', accent: '#73b5bb',
    tagline: 'A blue-green world rotating almost completely on its side.',
    mass: '8.68 × 10²⁵ kg', diameter: '51,118 km', distance: '2.867 billion km',
    gravity: '9.01 m/s²', dayLength: '17 h 14 min', yearLength: '84.0 Earth years', axialTilt: '97.8°',
    averageTemp: '−195 °C', minTemp: '≈ −224 °C', maxTemp: '≈ −153 °C',
    temperatureNote: 'Upper-atmosphere estimates; there is no solid surface.',
    atmosphere: 'Hydrogen and helium with methane, which absorbs red light and gives the planet its cyan colour. It has faint rings and icy moons.',
    exploration: 'Voyager 2 is still the only spacecraft to visit, flying past in January 1986 and discovering new moons, rings and a strangely tilted magnetic field.',
  },
  neptune: {
    id: 'neptune', name: 'Neptune', kind: 'ICE GIANT', accent: '#4d72ae',
    tagline: 'The distant blue planet with the fastest winds we know.',
    mass: '1.02 × 10²⁶ kg', diameter: '49,528 km', distance: '4.515 billion km',
    gravity: '11.27 m/s²', dayLength: '16 h 6 min', yearLength: '164.8 Earth years', axialTilt: '28.3°',
    averageTemp: '−200 °C', minTemp: '≈ −218 °C', maxTemp: '≈ −190 °C',
    temperatureNote: 'Upper-atmosphere estimates; there is no solid surface.',
    atmosphere: 'Hydrogen, helium and methane above an ice-rich interior. Dark storms appear and vanish while winds race faster than sound.',
    exploration: 'Voyager 2 made the only close visit in August 1989, revealing rings, storms and active nitrogen geysers on the moon Triton.',
  },
  pluto: {
    id: 'pluto', name: 'Pluto', kind: 'DWARF PLANET', accent: '#b5a999',
    tagline: 'A small, complex ice world with a famous heart-shaped plain.',
    mass: '1.30 × 10²² kg', diameter: '2,376 km', distance: '5.906 billion km',
    gravity: '0.62 m/s²', dayLength: '6.39 Earth days', yearLength: '247.9 Earth years', axialTilt: '119.5°',
    averageTemp: '−232 °C', minTemp: '−240 °C', maxTemp: '−226 °C',
    temperatureNote: 'Surface frost varies through Pluto’s long, eccentric orbit.',
    atmosphere: 'A very thin, seasonal atmosphere of nitrogen with methane and carbon monoxide; it can partly freeze onto the surface.',
    exploration: 'New Horizons made the first and only flyby in July 2015, discovering mountains of water ice, blue atmospheric haze and the vast Sputnik Planitia.',
  },
});

export function getPlanetFact(id: string): PlanetFact | undefined {
  return PLANET_FACTS[id];
}
