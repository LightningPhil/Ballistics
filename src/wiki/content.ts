export type Level = 0 | 1 | 2;
export interface Reading {
  heading: string;
  paragraphs: string[];
  takeaway: string;
  equation?: { expression: string; explanation: string };
}
export interface Article {
  id: string; title: string; group: string; kind: string; description: string;
  art?: string;
  /** How to say a name that is often guessed wrongly. */
  say?: string;
  stats: [string, string][];
  levels: [Reading, Reading, Reading];
  related: string[];
  sources: [string, string][];
}

export const LEVELS = [
  { name: 'First look', detail: 'The big idea, simply explained' },
  { name: 'Explore', detail: 'How it works, and why' },
  { name: 'Go deeper', detail: 'More science, step by step' },
] as const;
const nasa = (path: string): [string, string][] => {
  const slug = path.split('/').filter(part => part !== 'facts').pop()!;
  const title = slug === 'chapter1-1' ? 'Basics of space flight' : slug.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
  return [[`NASA · ${title}`, `https://science.nasa.gov/${path}/`]];
};
const reading = (heading: string, first: string, second: string, takeaway: string): Reading => ({ heading, paragraphs: [first, second], takeaway });
const detailedReading = (heading: string, paragraphs: string[], takeaway: string): Reading => ({ heading, paragraphs, takeaway });

/** Original educational copy checked against the linked museum, research and
 * NASA references. No live moon counts or mission schedules to become stale. */
export const ARTICLES: Article[] = [
  {
    id: 'solar-system', title: 'Our Solar System', group: 'The big picture', kind: 'A neighbourhood in motion',
    description: 'One star. Eight planets. Countless places to be curious.',
    stats: [['At the centre', 'The Sun'], ['Planets', '8'], ['Age', '≈4.6 billion years']],
    levels: [
      reading('Everything has a journey.', 'The Solar System is the Sun and the worlds travelling around it. The Sun is a star: it makes its own light. Planets shine because they reflect some of that light.', 'The planets, in order from the Sun, are Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune. Moons travel around planets as those planets travel around the Sun. Asteroids, comets and dwarf planets belong to the family too.', 'A moon goes around its parent world; together they also go around the Sun.'),
      detailedReading('Gravity holds the family together.', [
        'Gravity pulls objects towards each other. A planet also has sideways motion, so it keeps falling around the Sun instead of falling straight into it. The direction of its motion continually changes as gravity bends its path. That curved journey is an orbit.',
        'A planet does not need an engine to keep travelling. In space, motion continues unless a force changes it. Gravity supplies the change in direction; it does not simply stop the planet. Changing an orbit means changing the motion, which is why spacecraft use carefully timed engine burns.',
        'The four inner planets are rocky. Farther out are two gas giants and two ice giants. The main asteroid belt lies between Mars and Jupiter; beyond Neptune, the Kuiper Belt contains icy objects, including Pluto. The spaces between these worlds dwarf their sizes. Our maps compress those spaces so you can see the relationships, rather than mistake the drawing for a scale model.',
      ], 'An orbit needs both gravity and motion.'),
      { ...detailedReading('A disc became a planetary system.', [
        'About 4.6 billion years ago, a cloud of gas and dust collapsed under gravity. As it contracted, its rotation became faster, rather as a spinning skater speeds up by drawing their arms in. Most material collected in the young Sun; a rotating disc around it supplied the building blocks of planets.',
        'Small solids collided and sometimes stuck together. Growing bodies attracted more material, while further collisions and gravitational encounters could break bodies apart or rearrange their orbits. Formation was a changing process: a planet’s present location need not be exactly where all its ingredients first collected.',
        'In a simple two-body model, a bound orbit is an ellipse. The semi-major axis is half the ellipse’s longest width, not the object’s moment-to-moment distance from the Sun. Kepler’s period relation below uses that measure. For a small object with a semi-major axis of 4 AU, T² ≈ 4³ = 64, so its period is about 8 Earth years.',
        'The approximation treats the Sun as overwhelmingly more massive than the orbiting object. More precisely, both bodies orbit their shared centre of mass. In the real Solar System, other worlds also tug on them. Simple laws reveal the main pattern; detailed predictions account for these additional forces and the motion of the Sun itself.',
      ], 'A diagram shows relationships; it cannot show every real size, distance and tilt at once.'), equation: { expression: 'T² ≈ a³', explanation: 'For objects orbiting the Sun: T is the orbital period in Earth years and a is the semi-major axis in astronomical units (AU). One AU is about Earth’s average distance from the Sun. This approximation neglects the orbiting body’s mass and perturbations from other bodies.' } },
    ], related: ['sun', 'moons', 'kuiper-belt', 'asteroid-belt'], sources: [...nasa('solar-system/solar-system-facts'), ...nasa('learn/basics-of-space-flight/chapter1-1'), ...nasa('solar-system/orbits-and-keplers-laws')],
  },
  {
    id: 'sun', title: 'The Sun', art: 'sun', group: 'Our star & planets', kind: 'Our nearest star',
    description: 'The light, warmth and gravitational heart of our neighbourhood.',
    stats: [['Type', 'Star'], ['Light to Earth', '≈8 min 20 sec'], ['Surface', '≈5,500 °C']],
    levels: [
      reading('A star of our own.', 'The Sun is an enormous glowing ball of very hot material. Its light warms Earth and helps plants grow. It looks much bigger than other stars because it is much closer to us.', 'It has no solid ground to stand on. Even though the Sun is vital to life, looking straight at it can hurt your eyes; ordinary sunglasses do not make that safe.', 'The Sun makes light; planets mostly reflect it.'),
      detailedReading('Powered from within.', [
        'Deep in the Sun, nuclear fusion joins hydrogen nuclei to make helium and releases energy. This changes atomic nuclei, unlike a fire’s chemical reactions. The enormous temperature and pressure of the core make fusion possible; the sunlight we receive is energy that has worked its way out of that interior.',
        'That journey is not a straight flight from the core. In the radiative zone, energy passes through many interactions between radiation and matter. Farther out, convection carries energy as hot plasma rises and cooler plasma sinks. Plasma is material containing freely moving charged particles, rather than only intact, neutral atoms.',
        'The bright layer we usually call the surface is the photosphere, where much visible light escapes into space. It is not solid ground. Above it lie atmospheric layers, including the very hot, thin corona. A layer’s temperature tells us about its particles; it does not by itself tell us how much energy that entire layer contains.',
      ], 'The Sun is a nuclear furnace, not a giant campfire.'),
      detailedReading('A balance of opposing effects.', [
        'Gravity pulls the Sun’s material inward. Pressure is greater deeper inside, so the pressure difference across a small parcel of material supplies an outward force. In approximate hydrostatic balance, this offsets gravity. Balance does not mean the Sun has stopped moving: plasma can circulate while the overall star remains steady.',
        'Energy production and energy escape matter too. If a stellar core contracts, compression heats it and can increase fusion; if it expands, it cools. This provides a stabilising response during the Sun’s present stage of life. Stability over human timescales does not mean an unchanging star forever: consuming its fuel gradually changes its interior.',
        'The Sun also rotates at different rates at different latitudes. Moving, electrically conducting plasma and rotation help generate and reshape magnetic fields. Magnetic activity produces relatively cool sunspots and can release energy in flares and eruptions. These are changes in the outer star, not the core suddenly switching its fusion on and off.',
        'Sunlight and the solar wind are different messengers. Light carries electromagnetic energy and takes about eight minutes to reach Earth. The wind is a flow of particles, travelling much more slowly, that carries magnetic fields into space. When this flow encounters Earth’s magnetic environment, it can help produce auroras and disturb conditions around satellites.',
      ], 'A star’s gravity, pressure and energy flow work together.'),
    ], related: ['solar-system', 'earth', 'jupiter'], sources: [...nasa('sun/facts'),
      ['NASA / Marshall · The solar interior', 'https://solarscience.msfc.nasa.gov/interior.shtml'],
      ['OpenStax · Fusion and the Sun’s stabilising feedback', 'https://openstax.org/books/physics/pages/22-4-nuclear-fission-and-fusion'],
    ],
  },
  {
    id: 'mercury', title: 'Mercury', art: 'mercury', group: 'Our star & planets', kind: '01 / Rocky planet',
    description: 'Small, cratered and quick around the Sun.',
    stats: [['Solar distance', '0.39 AU'], ['Year', '88 Earth days'], ['Moons', 'None']],
    levels: [
      reading('The planet nearest the Sun.', 'Mercury is the smallest of the eight planets. Its rocky surface is covered in craters, rather like our Moon. It races around the Sun faster than any other planet.', 'Its sunny side can be extremely hot, while its long nights are bitterly cold. Being closest to the Sun does not make Mercury the hottest planet: that title belongs to Venus.', 'An atmosphere matters as well as distance from the Sun.'),
      detailedReading('Almost no blanket of air.', [
        'Mercury has only a very thin exosphere: its particles are so widely separated that they rarely collide with one another. It does not behave like Earth’s dense, circulating air. Little warmth is carried from the sunlit surface to the night side, and there is no thick atmospheric blanket to slow the loss of heat.',
        'A place on Mercury can spend a long time in daylight, then a long time in darkness. Strong sunshine heats exposed ground, while the long night allows it to cool. The result is an enormous temperature range. Compare this with Venus, where a dense atmosphere changes how energy escapes, making it hotter despite its greater distance from the Sun.',
        'Local geography matters as well. Near Mercury’s poles, some deep crater floors never receive direct sunlight. Water ice can survive in these cold traps. “Close to the Sun” describes the whole planet’s orbit; whether a particular patch receives sunshine depends on its position, the terrain around it and the planet’s tilt.',
      ], 'Hot sunshine and cold, permanent shadows can exist on the same world.'),
      detailedReading('Two clocks, different answers.', [
        'A rotation period measures how long Mercury takes to turn relative to distant stars. A solar day measures the interval between one local noon and the next. These clocks disagree because, while the planet turns, it also travels around the Sun. The direction to the Sun therefore changes during the rotation.',
        'Mercury rotates three times for every two complete orbits: a 3:2 spin–orbit resonance. Its rotation period is about 59 Earth days and its year about 88. Follow two years of motion: Mercury turns three times relative to the stars, but its direction to the Sun also goes around twice. Subtract those two circuits, leaving one full solar-day cycle.',
        'That cycle lasts about 176 Earth days, twice Mercury’s year. The same idea can be expressed as a rate: subtract the orbital rate from the rotation rate to find how quickly the direction to the Sun completes a cycle. Subtract rates, rather than the lengths of the two periods. This distinction also explains why Earth’s rotation relative to the stars is slightly shorter than its familiar solar day.',
        'The resonance describes a long-term pattern, not perfectly uniform motion in Mercury’s sky. Its elliptical orbit changes its orbital speed along the path. Keeping the rotation clock, orbital clock and apparent movement of the Sun separate helps explain this small world without the misleading shortcut that a “day” must always mean one spin.',
      ], 'A rotation period and a solar day are different measurements.'),
    ], related: ['venus', 'moon', 'sun'], sources: nasa('mercury/facts'),
  },
  {
    id: 'venus', title: 'Venus', art: 'venus', group: 'Our star & planets', kind: '02 / Rocky planet',
    description: 'A familiar-sized world with a very unfamiliar atmosphere.',
    stats: [['Solar distance', '0.72 AU'], ['Year', '225 Earth days'], ['Moons', 'None']],
    levels: [
      reading('Earth’s scorching neighbour.', 'Venus is nearly Earth’s size, but its surface is far too hot for people. Thick clouds hide the ground, making Venus brilliant in our sky.', 'Its atmosphere holds in so much heat that Venus is hotter than Mercury. There are mountains, plains and volcanoes beneath the clouds.', 'Similar size does not mean similar conditions.'),
      detailedReading('A powerful greenhouse.', [
        'Venus has a dense atmosphere made mainly of carbon dioxide. Sunlight absorbed by the planet supplies energy; the warmed surface emits infrared radiation. Carbon dioxide absorbs and re-emits some of that radiation, including back towards the ground. A much hotter surface is needed for energy eventually escaping to space to balance energy absorbed.',
        'This strong greenhouse effect keeps the surface around 464 °C. The clouds contain sulfuric acid and reflect a great deal of sunlight, making Venus bright in our sky. Reflective clouds and a hot surface can coexist: reflecting incoming light and restricting outgoing heat are different parts of the planet’s energy budget.',
        'Surface pressure is roughly 92 times Earth’s sea-level pressure. Pressure describes the weight of atmosphere above each area, while composition determines which radiation gases absorb. Both matter, but they are different properties. A spacecraft descending through Venus’s clouds must survive the chemical environment, then extreme heat and pressure near the ground.',
      ], 'Atmospheres change how worlds gain and lose energy.'),
      detailedReading('A planet that spins backwards.', [
        'Venus rotates very slowly in the opposite direction to most planets. This is retrograde rotation. A sidereal rotation, measured against distant stars, takes about 243 Earth days, longer than the 225 days Venus takes to orbit the Sun. A sunrise-to-sunrise day is a different measurement because the direction towards the Sun changes along the orbit.',
        'For Venus, the backwards spin and forward orbital motion add when measuring how quickly the Sun returns to the same direction in the sky. Using rounded values, 1/243 + 1/225 ≈ 1/117. Its solar day is therefore about 117 Earth days. The striking result is a rotation longer than the year but a solar day shorter than either.',
        'Clouds also force us to distinguish what we can see from what is present. Visible-light photographs mostly show the cloud tops. Radar uses radio waves that can penetrate the clouds; echoes reveal the ground’s shape and surface properties. Radar maps and lander measurements provide complementary evidence about a landscape hidden from ordinary cameras.',
        'Venus and Earth are close in size, yet their present environments differ enormously. Size alone cannot determine a planet’s atmosphere or climate. Scientists investigate the history of water, gases, rocks and rotation to understand that divergence. Reconstructing earlier Venus requires models tested against available evidence, rather than assuming that a familiar-sized planet must once have followed Earth’s exact history.',
      ], 'Always ask whether “day” means rotation or sunrise to sunrise.'),
    ], related: ['earth', 'mercury', 'solar-system'], sources: [...nasa('venus/venus-facts'),
      ['ESA · Venus’s surface','https://www.esa.int/Science_Exploration/Space_Science/Venus_Express/Venus_s_surface'],
      ['NASA · Venus’s solar and sidereal days','https://science.nasa.gov/earth/climate-change/nasa-climate-modeling-suggests-venus-may-have-been-habitable/'],
    ],
  },
  {
    id: 'earth', title: 'Earth', art: 'earth', group: 'Our star & planets', kind: '03 / Rocky planet',
    description: 'An ocean world, an airy blanket, and our only home.',
    stats: [['Solar distance', '1 AU'], ['Year', '≈365¼ days'], ['Moon', 'The Moon']],
    levels: [
      reading('The world beneath our feet.', 'Earth has land, oceans and an atmosphere we can breathe. It is the only world where we know life exists. From space, its oceans and clouds make it look blue and white.', 'Earth spins once in about a day and travels around the Sun in about a year. Its Moon comes along for the journey.', 'We live on a moving planet, even when the ground feels still.'),
      detailedReading('Why the seasons change.', [
        'Earth’s axis is tilted by about 23.4 degrees. Its direction stays nearly fixed during one orbit, so the hemispheres take turns leaning towards the Sun. The hemisphere leaning towards it receives more direct sunshine and longer days. Both changes increase the energy received over a day, bringing summer there.',
        'Imagine shining a torch straight onto a table, then tilting it. The angled beam spreads over a larger patch. Sunshine arriving at a lower angle similarly spreads its energy over more ground. A shorter winter day also gives the surface less time to absorb energy before the next night.',
        'When it is summer in the north, it is winter in the south. This opposite timing is a useful check: simply moving Earth closer to the Sun would affect both hemispheres together. Oceans and the atmosphere redistribute heat, while oceans store it and release it gradually. Local weather and the timing of the hottest days therefore depend on more than tilt alone.',
      ], 'Tilt changes the angle and duration of sunlight.'),
      detailedReading('A connected, changing system.', [
        'Earth’s rocks, water, air and life exchange matter and energy. In the water cycle, evaporation transfers water to the atmosphere and uses energy; condensation releases energy as clouds form. Winds and ocean currents move heat between regions. These connections help explain why a change in one part of the planet can affect another far away.',
        'Earth absorbs some incoming sunlight and emits infrared radiation to space. If it absorbs more energy than it loses, the system gains energy; if it loses more, it cools. Greenhouse gases absorb and re-emit infrared radiation. Clouds, ice and other surfaces also change how much sunlight is reflected. Climate depends on both sides of this energy budget.',
        'Different parts respond on different timescales. Air temperatures can change quickly, while oceans can store large amounts of heat. Plate tectonics, weathering and biological activity move carbon between rocks, water and air over a range of timescales. A snapshot of today’s weather is therefore not a complete description of the planet’s longer-term climate.',
        'Motion in the electrically conducting outer core generates Earth’s magnetic field. It changes the paths of many charged particles arriving from space and interacts with the solar wind. Gravity, rather than magnetism, holds the bulk of the atmosphere close. The field, atmosphere and oceans play different roles: understanding the whole Earth means connecting them without treating any one as an explanation for everything.',
      ], 'Earth is a set of interacting systems, not a static ball of rock.'),
    ], related: ['moon', 'venus', 'rockets'], sources: [...nasa('earth/facts'),
      ['NASA Space Place · What causes the seasons?', 'https://spaceplace.nasa.gov/seasons/en/'],
      ['NASA Earth Observatory · Climate and Earth’s energy budget', 'https://science.nasa.gov/earth/earth-observatory/climate-and-earths-energy-budget/'],
    ],
  },
  {
    id: 'mars', title: 'Mars', art: 'mars', group: 'Our star & planets', kind: '04 / Rocky planet',
    description: 'Rust-red deserts with clues to a wetter past.',
    stats: [['Solar distance', '1.52 AU'], ['Year', '687 Earth days'], ['Moons', 'Phobos & Deimos']],
    levels: [
      reading('The red planet.', 'Mars looks reddish because iron-bearing minerals in its dust have oxidised—rather like rust. It has a rocky surface, polar ice and enormous mountains.', 'Its two small moons are Phobos and Deimos. Mars is colder than Earth and has much thinner air, so people could not breathe or walk around there without protection.', 'The colour of a world can tell us about its chemistry.'),
      detailedReading('Reading the landscape.', [
        'Dry river channels, lake-bed sediments and water-altered minerals suggest liquid water once flowed on Mars. These are different kinds of evidence: a channel records erosion, sediment records material being carried and deposited, and a mineral can record a chemical reaction involving water. Agreement between them strengthens the explanation.',
        'At Gale Crater, rover observations reveal layers associated with ancient streams and lakes. Moving water can carry pebbles or sand; finer particles can settle in quieter water. Grain sizes, shapes and the arrangement of layers help scientists work out what an environment was like. The rocks preserve a sequence of changes, rather than a single picture of “wet Mars”.',
        'Today, much of Mars’s water is frozen. Its atmosphere is mainly carbon dioxide, but is too thin to maintain Earth-like warm, wet surface conditions. Dust storms, seasons and weather still change the landscape. Comparing present processes with the preserved rocks helps reveal just how different some earlier Martian environments were.',
      ], 'A dry landscape can preserve evidence of flowing water.'),
      detailedReading('A planet’s history in its rocks.', [
        'Scientists reconstruct Mars’s history by combining clues. Layers can establish which deposits came first; crater patterns help compare the relative ages of surfaces. Minerals reveal conditions under which they formed or changed. An older-looking, heavily cratered surface and a layered lake deposit answer different questions, so neither clue should be asked to tell the entire story.',
        'Orbiters provide the broad map, while rovers inspect small areas in detail. A feature that resembles a river from above becomes more convincing when ground observations reveal water-deposited grains or water-altered minerals. Scientists also consider alternative processes and ask which explanation accounts for the full set of observations.',
        'A habitable environment is one where life could have survived. It is not evidence that life actually lived there. Water, suitable chemistry and an energy source make a place interesting to investigate, but a claim of past life needs additional evidence that non-living processes cannot readily explain.',
        'Mars also lost much of its atmosphere over time. The MAVEN mission measures present-day escape processes, including effects of sunlight and the solar wind. These observations help test reconstructions of earlier loss, but today’s measured rate cannot simply be multiplied across billions of years: the Sun, atmosphere and planet changed. Rocks and measurements of escaping gas together help constrain how climate evolved.',
      ], 'Evidence for past habitability is not a discovery of life.'),
    ], related: ['earth', 'asteroid-belt', 'moons'], sources: [...nasa('mars/facts'),
      ['NASA · A guide to Gale Crater', 'https://science.nasa.gov/resource/a-guide-to-gale-crater/'],
      ['NASA · MAVEN and atmospheric loss', 'https://www.nasa.gov/news-release/nasas-maven-reveals-most-of-mars-atmosphere-was-lost-to-space/'],
    ],
  },
  {
    id: 'jupiter', title: 'Jupiter', art: 'jupiter', group: 'Our star & planets', kind: '05 / Gas giant',
    description: 'Cloud bands, giant storms and a family of remarkable moons.',
    stats: [['Solar distance', '5.2 AU'], ['Year', '≈12 Earth years'], ['Largest moon', 'Ganymede']],
    levels: [
      reading('The giant of the planets.', 'Jupiter is the largest planet. The stripes we see are bands of clouds, and its famous Great Red Spot is a huge storm.', 'There is no solid surface like Earth’s to land on. Four of its best-known moons are Io, Europa, Ganymede and Callisto. They orbit Jupiter while it orbits the Sun.', 'A planet can be a whole neighbourhood of smaller worlds.'),
      detailedReading('Under the clouds.', [
        'Jupiter is mostly hydrogen and helium. The stripes in photographs belong to its atmosphere, not exposed layers of rock. Rapid rotation and atmospheric circulation organise bands of clouds and winds; storms develop within this moving material. A cloud-top photograph shows the weather at the outside of a much larger interior.',
        'Going deeper means encountering increasing pressure and temperature. Hydrogen behaves very differently under these conditions, including liquid and electrically conducting forms at depth. The label “gas giant” does not mean the whole planet is a thin gas, nor does descending eventually reveal an ordinary surface on which a spacecraft could land.',
        'Jupiter’s moons provide a striking comparison. Io has intense volcanic activity, Europa has an icy exterior, and Ganymede is larger across than Mercury. They share a parent planet, but their compositions, interiors and orbital interactions differ. Understanding those differences requires considering where their energy comes from as well as how much sunlight reaches them.',
      ], 'The visible clouds are only the outermost view of a giant planet.'),
      detailedReading('Gravity can heat a moon.', [
        'Io, Europa and Ganymede have orbital periods close to 1:2:4. While Ganymede completes one orbit, Europa makes about two and Io about four. This resonance makes some gravitational interactions repeat in an organised pattern. The moons’ tugs help maintain slightly elliptical orbits instead of allowing tidal effects to make them completely circular.',
        'Gravity from Jupiter is stronger on the near side of a moon than on its far side. This difference produces a tidal distortion. On an elliptical orbit, the distance from Jupiter varies, changing the tidal force. The moon is repeatedly flexed, and internal friction converts some of that mechanical energy into heat.',
        'Io shows this dramatically through its volcanoes. The energy is not created from nothing: tides exchange energy and angular momentum with orbital and rotational motion, while dissipation turns part of the available mechanical energy into heat. Orbital interactions keep the system evolving, rather than providing an unlimited heater.',
        'The same resonance does not heat every moon equally. The amount of flexing depends on distance, orbital shape and the moon’s internal structure; how readily its materials deform also matters. Scientists compare orbital measurements, surface activity and interior models to work out the energy budget. This is why a cold surface far from the Sun does not rule out geological activity or liquid water beneath ice.',
      ], 'Sunlight is not the only possible source of warmth inside a world.'),
    ], related: ['ganymede', 'moons', 'saturn'], sources: [...nasa('jupiter/jupiter-facts'), ...nasa('jupiter/jupiter-moons/ganymede/facts'), ...nasa('jupiter/jupiter-moons/io/facts')],
  },
  {
    id: 'saturn', title: 'Saturn', art: 'saturn', group: 'Our star & planets', kind: '06 / Gas giant',
    description: 'A world framed by countless pieces of ice.',
    stats: [['Solar distance', '9.6 AU'], ['Year', '≈29 Earth years'], ['Featured moons', 'Titan & Enceladus']],
    levels: [
      reading('The planet with the famous rings.', 'Saturn’s rings look like a smooth disc from far away. Up close, they are countless separate pieces, mostly water ice, travelling around the planet.', 'Saturn is a gas giant. It also has many moons, including hazy Titan and bright, icy Enceladus. The rings and moons are separate parts of its family.', 'A ring is a crowd of orbiting particles, not a solid plate.'),
      detailedReading('Extraordinary neighbours.', [
        'Titan has a thick atmosphere and lakes and seas of liquid methane and ethane. Its surface is so cold that water ice behaves as a solid part of the landscape. Methane can evaporate, form clouds and rain, feeding rivers and lakes. Familiar processes operate with unfamiliar materials: a liquid need not be water to carve a channel.',
        'Enceladus presents a different arrangement. A liquid-water ocean lies beneath its icy exterior, and plumes spray material into space. Measurements of plume particles and gases let scientists investigate chemistry below the surface without drilling through the shell. Those samples are clues carried out of a hidden environment, rather than a complete view of the ocean.',
        'The contrast makes Saturn’s moons useful natural experiments. Temperature, composition and sources of internal heat determine which substances can flow and where liquid can persist. Finding water or interesting chemistry makes a place worth studying for habitability, but does not establish life. These moons show how much can happen on worlds whose surfaces look cold from afar.',
      ], 'Different liquids can shape different landscapes.'),
      detailedReading('Order inside the rings.', [
        'Saturn’s rings are collections of independently orbiting particles. They are not a solid disc turning at one speed. In nearly circular orbits, particles closer to Saturn travel faster and complete their circuits sooner. The same orbital principles that govern planets apply here, although Saturn supplies the central gravitational pull.',
        'Kepler’s period relationship gives a useful comparison: around the same central body, doubling an orbit’s radius increases its period by about 2.8 times, not twice. Neighbouring parts of a broad ring therefore continually change their positions relative to one another. Collisions and collective gravitational effects matter as well as each particle’s orbit.',
        'A moon can repeatedly tug ring particles when their periods form a resonance. Imagine a small push delivered at a recurring part of each cycle: its effects can build into a pattern. Depending on the interaction, a moon can drive waves or help maintain a gap or edge. A visible gap need not contain a moon all the way around its circumference.',
        'Scientists use images and measurements of ring patterns to test these gravitational explanations. The rings reveal motion through their structure, even in a still photograph. Their present appearance also reflects collisions and an evolving history, so explaining a pattern and determining the rings’ age are different questions. All four giant planets have rings; Saturn’s particularly conspicuous system makes these processes easier to study.',
      ], 'Gravity organises both tiny particles and enormous worlds.'),
    ], related: ['jupiter', 'moons', 'uranus'], sources: [...nasa('saturn/facts'), ...nasa('saturn/moons/facts'), ...nasa('saturn/moons/titan/facts'), ...nasa('saturn/moons/enceladus')],
  },
  {
    id: 'uranus', title: 'Uranus', art: 'uranus', say: 'YOOR-un-us', group: 'Our star & planets', kind: '07 / Ice giant',
    description: 'A pale blue-green world tipped almost onto its side.',
    stats: [['Solar distance', '19.2 AU'], ['Year', '≈84 Earth years'], ['Axial tilt', '≈98°']],
    levels: [
      reading('An unusual way to spin.', 'Uranus spins with its axis almost on its side. Imagine a spinning top tipped nearly onto its side as it travels around the Sun.', 'It looks blue-green partly because methane in its atmosphere absorbs red light. It has rings and many moons, including Titania, Oberon, Ariel, Umbriel and Miranda.', 'The direction a planet spins can shape its seasons.'),
      detailedReading('What is an ice giant?', [
        'The name refers to the kinds of ingredients thought to be important inside Uranus: water, ammonia and methane, as well as rock and hydrogen and helium. It distinguishes Uranus and Neptune from the more hydrogen-and-helium-dominated Jupiter and Saturn. It does not describe a surface made of familiar snow and ice.',
        'A substance’s state depends on its surroundings. Water frozen in a household freezer is not a good guide to water-rich material at the immense temperatures and pressures inside a planet. Interior models describe dense materials under extreme conditions. The clouds we observe are evidence about the atmosphere, rather than a direct photograph of those deep layers.',
        'Uranus’s roughly 98-degree tilt adds another unusual feature. Over its 84-year orbit, a pole can spend a long stretch facing the Sun and later a long stretch facing away. Near equinox, illumination is distributed differently. The axis keeps broadly the same direction through the orbit; the changing planet–Sun geometry produces its extreme seasonal pattern.',
      ], '“Ice giant” describes a planetary category, not a snow-covered surface.'),
      detailedReading('A magnetic puzzle.', [
        'Uranus’s magnetic field is strongly tilted relative to its rotation axis and offset from its centre. A simple bar magnet placed along the spin axis would therefore fail to describe the observations. The magnetic poles, rotational poles and direction towards the Sun are three different reference directions, especially striking on this already tilted planet.',
        'Planetary magnetic fields can be sustained by motion in electrically conducting material: a dynamo. That does not require every planet to have Earth’s particular arrangement of a conducting outer core. One possibility for Uranus is a dynamo operating in a shell of conducting fluid, rather than throughout a large central region.',
        'The shell is a hypothesis to test, not a layer directly photographed by a spacecraft. Scientists calculate fields that different interior arrangements could produce and compare them with measurements. More than one interior model may fit some observations, so a plausible explanation is not automatically a unique answer.',
        'Other evidence adds constraints. Gravity measurements reflect how mass is distributed; emitted heat constrains the energy escaping; atmospheric observations reveal circulation and seasonal responses. A successful interior model has to account for several of these clues together. Uranus demonstrates how scientific uncertainty can be specific and productive: researchers know some properties well while actively testing what could explain them.',
      ], 'A good scientific model must explain the observations, including the awkward ones.'),
    ], related: ['neptune', 'saturn', 'moons'], sources: [...nasa('uranus/facts'), ...nasa('uranus/moons/facts'),
      ['NASA · Uranus interior and dynamo hypotheses','https://science.nasa.gov/wp-content/uploads/2023/10/uranus-orbiter-and-probe-appendix-c.pdf#page=34'],
    ],
  },
  {
    id: 'neptune', title: 'Neptune', art: 'neptune', group: 'Our star & planets', kind: '08 / Ice giant',
    description: 'A distant, windy world at the edge of the planetary line-up.',
    stats: [['Solar distance', '30 AU'], ['Year', '≈165 Earth years'], ['Largest moon', 'Triton']],
    levels: [
      reading('The farthest planet.', 'Neptune is the most distant of the eight planets. Sunlight reaching it is much weaker than the light at Earth, yet its atmosphere has powerful winds and storms.', 'Its largest moon, Triton, travels around Neptune in the opposite direction to the planet’s rotation. Beyond Neptune lie many smaller icy worlds.', 'The planets end at Neptune; the Solar System does not.'),
      detailedReading('Found with mathematics.', [
        'Astronomers noticed differences between Uranus’s observed motion and predictions based on known gravitational influences. They calculated where an additional planet might account for those differences. Neptune was then found close to a predicted position. The telescope observation tested a mathematical explanation with an independent piece of evidence.',
        'Neptune is an ice giant with hydrogen, helium and methane in its atmosphere. Methane absorbs red light, contributing to a blue-green appearance similar to Uranus. Some familiar images enhance colour and contrast to expose cloud detail. An image can be useful for studying structures without reproducing exactly what a human eye would see.',
        'At roughly 30 AU, sunlight spreads over about 30² = 900 times the area it does at Earth’s distance. Before accounting for atmospheric effects, Neptune receives roughly one nine-hundredth as much solar energy per unit area. Yet strong winds and storms persist: energy escaping from its interior also helps power this distant world’s weather.',
      ], 'Gravity can reveal an object before we see it.'),
      detailedReading('A moon travelling the other way.', [
        'Triton travels around Neptune opposite to the planet’s rotation: a retrograde orbit. A moon assembled in a rotating disc around a young planet would normally inherit that disc’s direction of motion. Triton’s large size and unusual orbit instead provide strong evidence that it was captured from an independent solar orbit.',
        'Capture requires more than a planet simply pulling on a passing object. In an isolated two-body encounter, an unbound object gains speed as it approaches and loses it again as it departs. Gravity bends the path but does not remove the orbital energy needed to make it bound. Some additional interaction must change that energy balance.',
        'One proposed capture route starts with Triton belonging to a binary pair. An encounter with Neptune separates the pair, allowing a companion to escape while Triton becomes bound. This is a modelled physical scenario, not a witnessed event. Tidal interactions can subsequently reshape the captured orbit, so today’s path need not resemble the initial one.',
        'Triton’s icy surface, thin atmosphere and signs of geological activity add a second set of clues. Voyager 2 observed active plumes during its flyby. Its similarities to icy outer worlds support investigating a connection with the Kuiper Belt. Orbital direction and surface properties together build the case; they do not tell us one uniquely established capture date or every step of the process.',
      ], 'Orbital direction is a clue to a world’s past.'),
    ], related: ['uranus', 'moons', 'kuiper-belt'], sources: [...nasa('neptune/neptune-facts'), ...nasa('neptune/moons'),
      ['University of Oxford · The colours of Neptune and Uranus','https://www.ox.ac.uk/news/2024-01-05-new-images-reveal-what-neptune-and-uranus-really-look-0'],
      ...nasa('neptune/moons/triton'),
      ['Agnor & Hamilton · A binary capture model for Triton', 'https://www.nature.com/articles/nature04792'],
      ['NASA · Energy budgets of the ice giants', 'https://science.nasa.gov/missions/hubble/nasa-oxford-discover-warmer-uranus-than-once-thought/'],
    ],
  },
  {
    id: 'moons', title: 'Worlds around worlds', group: 'Moons & small worlds', kind: 'The moon families',
    description: 'Follow the small orbits to discover who belongs to whom.',
    stats: [['Earth', 'The Moon'], ['Mars', 'Phobos & Deimos'], ['Largest moon', 'Ganymede']],
    levels: [
      reading('A moon has a parent world.', 'A moon is a natural object travelling around another world. Our Moon goes around Earth. Ganymede goes around Jupiter. Both also travel around the Sun with their parent planets.', 'Mercury and Venus have no moons. The giant planets have large families. Some moons are round worlds; others are small, irregular chunks. The family map below shows selected examples, not every moon.', 'The word “moon” tells you about an orbit, not a size.'),
      detailedReading('Not all moons began alike.', [
        'Some moons formed from material in a disc around a young planet. Others were captured from independent orbits. Earth’s Moon probably formed from debris after a giant impact involving the early Earth. A moon’s size alone cannot identify which history it followed: scientists also investigate its composition and the shape and direction of its orbit.',
        'A parent planet pulls more strongly on a moon’s near side than its far side. That difference produces tides, which can deform the moon and affect its interior. Tides also alter rotation over time. Many moons eventually turn once per orbit, keeping roughly the same face towards their parent; this is synchronous rotation.',
        'To picture why that still requires spinning, walk around a chair while always facing it. By the time you return to your starting point, you have turned once relative to the room. Moons do the same relative to the stars. Their rotations, tides and varied origins make them worlds with their own histories, rather than passive decorations beside a planet.',
      ], 'Moons have different origins and can be active worlds in their own right.'),
      detailedReading('Nested orbits, shared motion.', [
        'A planet does not remain perfectly still while its moon circles it. Both move around their shared centre of mass, called a barycentre. Imagine balancing two unequal masses on a beam: the balance point lies closer to the heavier mass. For many planet–moon pairs it lies inside the planet, so the planet’s movement is less obvious.',
        'That pair also travels through the Sun’s gravitational field. Describing the moon as orbiting the planet and the pair as orbiting the Sun is useful, but the motions occur together. A moon’s solar path is not a set of isolated circles whose centres stay fixed in space. The observer’s chosen reference frame changes how the same motion is drawn.',
        'Tidal locking is another reminder to choose a reference frame carefully. One turn relative to the stars per orbit keeps the same face towards the parent. Tidal dissipation can slow an initially faster spin and produce this state, but not every moon has reached it. A body’s shape, orbit and interaction history affect the outcome.',
        'Several moons can also form orbital resonances, in which their periods have repeating ratios. Regularly timed gravitational encounters can maintain a pattern or disturb it, depending on the arrangement. Scientists combine these dynamics with surface and composition measurements to investigate origins. Orbital direction is a valuable clue, but a convincing history must explain more than one observed property.',
      ], 'Tidally locked does not mean “not spinning”.'),
    ], related: ['moon', 'ganymede', 'jupiter'], sources: [...nasa('solar-system/moons/facts'), ...nasa('moon/facts'), ...nasa('moon/moon-phases'), ...nasa('moon/tidal-locking'), ...nasa('saturn/moons'), ...nasa('uranus/moons/facts'),
      ['NASA Space Place · What is a barycentre?', 'https://spaceplace.nasa.gov/barycenter/en/'],
    ],
  },
  {
    id: 'moon', title: 'The Moon', art: 'moon', group: 'Moons & small worlds', kind: 'Earth’s natural satellite',
    description: 'Our nearest companion, with a landscape that remembers.',
    stats: [['Orbits', 'Earth'], ['Mean distance', '384,400 km'], ['Orbit', '≈27.3 days']],
    levels: [
      reading('Borrowed light in the night sky.', 'The Moon does not make its own visible light. It reflects sunlight. As it moves around Earth, we see different amounts of its sunlit half: these are its phases.', 'Its surface has mountains, plains and impact craters. With almost no atmosphere or running water, many marks remain for a very long time.', 'Moon phases come from our view of its sunlit half. Earth’s shadow causes lunar eclipses.'),
      detailedReading('One face, many phases.', [
        'The Moon rotates once in about the time it takes to orbit Earth, keeping roughly the same face towards us. That relationship does not determine its phases. Sunlight illuminates half the Moon; as it moves around Earth, we see different fractions of that illuminated half. The far side receives sunshine too and is not permanently dark.',
        'A “first quarter” Moon has completed about a quarter of its phase cycle, while half its visible disc appears lit. The name describes progress through the cycle, not the illuminated fraction of the disc. Near full moon, we see most of the sunlit half; near new moon, that half points mainly away from us.',
        'An orbit relative to the stars takes about 27.3 days, but one new moon to the next takes about 29.5. During the orbit, Earth moves around the Sun, so the Moon must travel a little farther to recover the same Sun–Earth–Moon alignment. Its tilted orbital plane also explains why these alignments do not produce an eclipse every month.',
      ], 'An orbital period and a phase cycle measure different things.'),
      detailedReading('Tides exchange energy.', [
        'The Moon pulls on the whole Earth, but not equally everywhere. Its pull is stronger on the near side and weaker on the far side than at Earth’s centre. Those differences produce tidal deformation. The Sun contributes too; tides depend on the variation of gravity across Earth, rather than simply which body has the strongest total pull.',
        'Around new and full moon, the Sun’s and Moon’s tidal effects reinforce one another, producing spring tides with a larger range. Around the quarter phases, they partly counteract, producing neap tides. Actual high-water times and heights also depend on coastlines, depth and basin shape. A simple two-bulge diagram captures the forcing, not a complete forecast for every harbour.',
        'Tides also exchange angular momentum between Earth’s spin and the Moon’s orbit. Earth currently spins faster than the Moon travels around it. Tidal interactions gradually slow that spin while increasing the Moon’s orbital angular momentum and moving it outward. Some mechanical energy is dissipated as heat; energy and angular momentum are different quantities to keep track of.',
        'Laser-ranging measurements using reflectors on the Moon show a present recession rate of about 3.8 centimetres per year. It would be misleading to extend that rate unchanged into the distant past: continents, ocean basins and Earth’s rotation have changed, affecting tidal dissipation. The nearby Moon lets us measure today’s process precisely while geology helps investigate its longer history.',
      ], 'Gravity can change both the spin and orbit of a world.'),
    ], related: ['earth', 'moons', 'ganymede'], sources: [...nasa('moon/facts'), ...nasa('moon/moon-phases'), ...nasa('moon/eclipses'), ...nasa('moon/tides'),
      ['NASA · Tidal changes in the Moon’s orbit','https://eclipse.gsfc.nasa.gov/LEcat5/secular.html'],
    ],
  },
  {
    id: 'ganymede', title: 'Ganymede', art: 'ganymede', say: 'GAN-ih-meed', group: 'Moons & small worlds', kind: 'A moon of Jupiter',
    description: 'An icy moon so large it could be mistaken for a planet.',
    stats: [['Orbits', 'Jupiter'], ['Mean diameter', '≈5,260 km'], ['Orbit', '≈7.2 Earth days']],
    levels: [
      reading('The largest moon.', 'Ganymede is the biggest moon in the Solar System—wider than the planet Mercury. It is still a moon because it orbits Jupiter.', 'Its surface mixes old, dark regions with brighter, grooved terrain. Much of its outer shell is water ice. It is a real world with a history, not simply a dot beside Jupiter.', 'Classification depends on the kind of object and its orbit, not size alone.'),
      detailedReading('Ice above, possibly an ocean below.', [
        'Measurements provide strong evidence for a salty ocean beneath Ganymede’s icy crust. This is an inference from the moon’s magnetic response, not a photograph of open water. Dissolved salts allow water to conduct electricity, so a hidden ocean can affect magnetic signals measured far above it.',
        'Ganymede also has its own internally generated magnetic field. Charged particles interacting with its magnetic environment produce auroras. As Jupiter’s surrounding field changes, the auroral regions rock back and forth. Hubble observations found less rocking than expected without a conducting ocean; models with an ocean better explain the reduced movement.',
        'An icy exterior therefore does not tell us that every layer beneath is frozen. Temperature and pressure vary with depth, and interior models must fit the magnetic observations as well as other evidence. Ganymede’s size makes it an impressive world, but “moon” still describes its relationship to Jupiter. Neither its size nor a possible ocean makes it automatically another Earth.',
      ], 'We can learn about a hidden interior by measuring its effects outside.'),
      detailedReading('Reading the magnetic signals.', [
        'Ganymede has at least two magnetic effects to disentangle. One is its own field, probably generated by a dynamo in a liquid, iron-rich core. Another is the response induced when Jupiter’s changing magnetic environment interacts with electrically conducting material inside the moon. These effects can exist together; detecting one does not exclude the other.',
        'Electromagnetic induction is the link to an ocean. A changing magnetic field can drive electrical currents in salty water. Those currents generate a secondary field that changes the combined magnetic pattern around Ganymede. Scientists calculate the response expected from different ocean models and compare it with spacecraft and auroral observations.',
        'This is an inverse problem: start with effects outside and work backwards towards possible structures inside. Conductivity, layer thickness and depth can all influence the response. Some combinations can resemble others, so evidence for an ocean is not the same as a uniquely measured blueprint of every layer. Measurements under different conditions help narrow the possibilities.',
        'The inferred ocean also raises separate questions about habitability. Liquid water is one ingredient; usable energy, chemistry and exchanges between layers matter too. Magnetic evidence addresses the presence and properties of conducting material, not organisms. Keeping the observation, the physical explanation and the wider biological question separate makes this indirect evidence more informative rather than less exciting.',
      ], 'Indirect evidence can be powerful, but it still needs careful interpretation.'),
    ], related: ['jupiter', 'moons', 'moon'], sources: [...nasa('jupiter/jupiter-moons/ganymede/facts'),
      ['NASA / JPL · Satellite physical parameters','https://ssd.jpl.nasa.gov/sats/phys_par/'],
      ['NASA / Hubble · Evidence for Ganymede’s underground ocean', 'https://science.nasa.gov/missions/hubble/nasas-hubble-observations-suggest-underground-ocean-on-jupiters-largest-moon/'],
    ],
  },
  {
    id: 'pluto', title: 'Pluto & the outer frontier', art: 'pluto', group: 'Moons & small worlds', kind: 'Dwarf planet / Kuiper Belt',
    description: 'A small icy world that made the Solar System feel bigger.',
    stats: [['Classification', 'Dwarf planet'], ['Year', '≈248 Earth years'], ['Largest moon', 'Charon']],
    levels: [
      reading('Small does not mean simple.', 'Pluto is a dwarf planet belonging to the Kuiper Belt, the icy population around and beyond Neptune. It has mountains of water ice, unusual glaciers and a large moon called Charon.', 'There are eight planets, but far more than eight interesting worlds. Calling Pluto a dwarf planet describes its place in the Solar System; it does not make it less worth exploring.', 'Pluto belongs to a large family of icy outer worlds.'),
      detailedReading('Why “dwarf planet”?', [
        'Like a planet, a dwarf planet orbits the Sun, is rounded by its own gravity and is not a moon. Gravity has overcome the material’s strength enough to produce an approximately round overall shape. This does not require a perfectly smooth sphere: mountains and other surface features can remain.',
        'Unlike a planet, it has not become gravitationally dominant in its orbital neighbourhood. “Cleared” does not mean completely empty; planets can still share their neighbourhoods with smaller bodies. The distinction concerns their dynamical role. Ceres, in the main asteroid belt, is another dwarf planet, showing that the category is not simply a label for distant, icy objects.',
        'Pluto’s orbit is tilted and more elongated than the major planets’ orbits, so its solar distance varies greatly. It is sometimes closer to the Sun than Neptune. Its landscapes are also varied: water ice can form hard mountains while more mobile nitrogen ice forms glaciers. A classification groups certain properties; it does not describe everything a world can do.',
      ], 'A scientific category describes shared properties, not importance.'),
      detailedReading('An orbit protected by timing.', [
        'Pluto completes roughly two solar orbits for every three made by Neptune. This is a 3:2 orbital resonance. Be careful about which body completes which number: Neptune is the faster traveller. The pattern is more than a numerical coincidence, because their recurring gravitational interactions constrain the timing of their relative positions.',
        'Pluto sometimes has a smaller distance from the Sun than Neptune, but sharing a range of distances does not mean occupying the same place. Its orbit is tilted, and the resonance keeps important parts of its journey safely timed relative to Neptune. Position in three dimensions and timing together prevent close encounters; a flat drawing of overlapping distance ranges leaves out crucial information.',
        'Charon supplies a different example of shared motion. It is substantial enough relative to Pluto that their barycentre lies outside Pluto’s surface. Both worlds move around that balance point while the pair travels around the Sun. Calling Charon a moon does not mean Pluto can be treated as motionless in a precise description.',
        'Pluto and Charon are mutually tidally locked, each keeping the same face towards the other. Both still rotate relative to the stars. Stable resonant motion, mutual rotation and a complex surface can coexist on a dwarf planet. Whether an orbit avoids collisions and whether a body dominates its neighbourhood are separate questions, which helps explain why Pluto’s fascinating dynamics do not settle its classification by themselves.',
      ], 'Crossing the same distance from the Sun does not mean colliding.'),
    ], related: ['kuiper-belt', 'moons', 'neptune'], sources: [...nasa('dwarf-planets/pluto/facts'), ...nasa('dwarf-planets/ceres/facts'),
      ['IAU · Definitions of planet and dwarf planet (2006)','https://iauarchive.eso.org/static/resolutions/Resolution_GA26-5-6.pdf'],
      ['NASA / NTRS · Neptune resonances in the Kuiper Belt','https://ntrs.nasa.gov/api/citations/19970021298/downloads/19970021298.pdf'],
      ['NASA · Pluto and Charon’s shared centre of mass','https://www.nasa.gov/history/45-years-ago-astronomers-discover-plutos-moon-charon/'],
    ],
  },
  {
    id: 'kuiper-belt', title: 'The Kuiper Belt', say: 'KY-per belt', group: 'Moons & small worlds', kind: 'Beyond Neptune / icy beginnings',
    description: 'The planets end. The Solar System keeps going.',
    stats: [['Main region', '≈30–50 AU'], ['Familiar member', 'Pluto'], ['Materials', 'Ices & rock']],
    levels: [
      reading('An icy neighbourhood.', 'Beyond Neptune lies a broad region of small, cold worlds called the Kuiper Belt (say “KY-per”). Its objects travel around the Sun. Pluto belongs here, along with many smaller bodies made of ice and rock.', 'Imagine a very wide, very sparse doughnut, not a solid ring or a wall of ice. The dots on our map are enlarged so you can see the region. Far more empty space lies between the real objects. The Kuiper Belt is part of the Solar System, even though it is beyond the eight planets.', 'Neptune is the last planet, not the edge of the Solar System.'),
      detailedReading('Two belts, different ingredients.', [
        'The main asteroid belt lies between Mars and Jupiter and is mostly rocky. The Kuiper Belt is much farther out: its main region spans roughly 30 to 50 times Earth’s distance from the Sun. Colder conditions allow ices to survive alongside rock. These populations preserve different ingredients and conditions from the era of planet-building.',
        'NASA’s New Horizons flew past Pluto in 2015 and Arrokoth in 2019. Arrokoth’s joined lobes offer evidence for small building blocks coming together gently, rather than every stage of growth requiring a violent collision. Close observations show details that a tiny point of light in a telescope cannot reveal.',
        'Some outer objects also have moons. Their shapes, surfaces and companions add clues to their histories, while their orbits reveal interactions with planets. “Leftover” does not mean untouched: collisions and gravitational rearrangement can modify an object after formation. Scientists ask which features preserve early conditions and which record later events before using a small world to explain our beginnings.',
      ], 'The outer Solar System preserves a different part of our beginnings.'),
      detailedReading('Neptune helped arrange the frontier.', [
        'The belt contains several orbital populations. Classical objects include bodies with relatively circular paths; resonant objects have periods linked to Neptune’s. Pluto completes two orbits while Neptune completes three. Such repeating timing can keep encounters safely separated, making an orbit that looks risky in a simplified drawing stable over long periods.',
        'Neptune’s gravitational encounters also scattered objects onto stretched and tilted paths. Models in which the giant planets migrated help explain the arrangement of these populations. Researchers compare many observed orbits with simulated outcomes: one unusual object alone cannot uniquely establish the complete sequence or speed of planetary migration.',
        'The overlapping scattered disc extends well beyond the main belt and helps supply short-period comets. An object can remain cold far out, then become visibly active if gravitational interactions bring it closer to the Sun. Warming allows volatile ices to release gas and carry dust, producing a comet’s surrounding cloud and tails. Orbital history and present activity are therefore connected.',
        'The much more distant Oort Cloud is a different, inferred reservoir associated with long-period comets. Their arrival directions support a broadly spherical population, unlike the belt’s more disc-like arrangement. The cloud has not been directly observed as a whole. These regions are described through populations and evidence, so a single crisp boundary on a map cannot capture every overlapping orbit or evolutionary path.',
      ], 'A population’s orbits can preserve evidence of the planets’ past motion.'),
    ], related: ['pluto', 'neptune', 'asteroid-belt', 'moons'], sources: [...nasa('solar-system/kuiper-belt'), ...nasa('solar-system/kuiper-belt/facts'), ...nasa('solar-system/kuiper-belt/exploration'), ...nasa('solar-system/oort-cloud/facts')],
  },
  {
    id: 'asteroid-belt', title: 'The asteroid belt', group: 'Moons & small worlds', kind: 'Fragments of a beginning',
    description: 'Between Mars and Jupiter, leftovers tell the story of planet-building.',
    stats: [['Location', 'Mars → Jupiter'], ['Main region', '≈2.1–3.3 AU'], ['Largest member', 'Ceres']],
    levels: [
      reading('A very spacious collection.', 'The main asteroid belt is a region where many rocky objects orbit the Sun. It lies mostly between Mars and Jupiter. Its biggest member, Ceres, is rounded and classified as a dwarf planet.', 'It is not a packed obstacle course like the ones in films. Asteroids are usually separated by enormous empty spaces. Our illustrations enlarge the rocks to make them visible.', 'The asteroid belt is mostly empty space.'),
      detailedReading('Pieces left from planet-building.', [
        'Asteroids preserve material from the early Solar System. In the main belt, gravitational disturbances, especially from Jupiter, helped prevent material from assembling into one large planet. The surviving population is not simply the remains of a single exploded world. It records both incomplete growth and later changes.',
        'The belt contains dark, carbon-rich bodies, rocky bodies and some rich in metal. Their materials have different histories. Some parent bodies became hot enough to separate into layers, with denser metal collecting inside; later collisions could expose or disperse that material. Others preserve a different mixture. Composition therefore tells us more than just an asteroid’s present colour.',
        'Collisions continue to break bodies apart and generate fragments. Spacecraft examine surfaces, while studies of reflected light help compare many distant objects. The belt remains very sparse despite its large population: many separate orbits spread through a huge volume are not a packed wall of rocks. Each sample helps investigate a long construction and recycling process.',
      ], 'Asteroids are samples of a long and complicated construction process.'),
      detailedReading('Gravity sorts the neighbourhood.', [
        'An asteroid’s orbital period can form a simple ratio with Jupiter’s. In a 3:1 resonance, for example, the asteroid completes about three orbits during one Jupiter orbit. Repeated gravitational interactions can change the asteroid’s orbital shape. Some resonances make it easier for an orbit to develop close encounters with planets.',
        'These effects help produce Kirkwood gaps: shortages of asteroids at particular semi-major axes, the measure of orbital size used in Kepler’s law. They appear clearly when scientists plot how many asteroids have each orbital size. They are not perfectly empty lanes that every asteroid stays outside at every moment; elongated orbits can pass through the same range of solar distances.',
        'Collisions leave another kind of pattern. Fragments from a disrupted parent can retain related orbital properties, forming an asteroid family. Similar compositions strengthen that interpretation. A group of points in an orbital plot becomes evidence of a shared event when its dynamics and materials agree, rather than simply because the points look close together.',
        'Over time, gravitational interactions and other small effects can move fragments away from their starting orbits. Some reach planet-crossing paths. Explaining today’s belt therefore requires both the processes that group objects and those that disperse them. Gaps and families are complementary records: one reveals gravitational selection, while the other can reveal the breaking apart of earlier bodies.',
      ], 'A gap can be evidence of an invisible gravitational pattern.'),
    ], related: ['mars', 'jupiter', 'kuiper-belt'], sources: [...nasa('solar-system/asteroids/facts'), ...nasa('dwarf-planets/ceres/facts'),
      ...nasa('solar-system/asteroids/4-vesta'),
      ['ESA · Small objects and the main asteroid belt','https://www.esa.int/ESA_Multimedia/Images/2023/11/Small_objects_in_the_Solar_System'],
      ['NASA / JPL · Kirkwood gaps and orbital resonances','https://ssd.jpl.nasa.gov/diagrams/mb_hist.html'],
    ],
  },
  {
    id: 'cannons', title: 'How a cannon works', group: 'The science of flight', kind: 'History / heat / pressure / motion',
    description: 'A medieval invention. A very brief event. A remarkable amount of science.',
    stats: [['Early metal cannon', 'China · late 1200s'], ['European record', 'Florence · 1326'], ['Source of the push', 'Hot gas under pressure']],
    levels: [
      {
        heading:'A fast fire makes a powerful push.',
        paragraphs:[
          'Cannon developed in medieval China. Small metal examples survive from the late 1200s; nobody can confidently name one inventor or the exact first day. Over the following centuries, cannon changed castles, ships and warfare.',
          'Their propellant was gunpowder, also called black powder. Ignition starts very rapid burning, releasing heat and producing gas. Confined behind the ball, that hot gas presses on its back and pushes it hard. The solid ball itself does not need to explode.',
          'The ball gains speed as it travels along the barrel. As the space behind it grows, the gas expands and its pressure eventually falls. At the muzzle, gas rushes out around the departing ball. The cannon recoils backwards; after the brief launch, gravity and the air shape the ball’s flight.',
        ], takeaway:'The ball is pushed by hot gas under pressure. Fast burning supplies the energy.',
      },
      {
        heading:'Why pressure and speed tell different stories.',
        paragraphs:[
          'The early Chinese evidence includes small bronze cannon, not just the large wheeled pieces familiar from films. European records identify cannon in Florence in 1326. An illustration from that period shows a vase-shaped gun firing a bolt. Stone and iron round shot became part of a long, varied history.',
          'Gunpowder burns rapidly rather than releasing all its energy at one mathematical instant. Gas generation first drives pressure upwards. Meanwhile, the moving ball creates more room behind it, and the gas does work as it expands. Eventually expansion wins: pressure falls. The smoke includes tiny particles as well as gas.',
          'Falling pressure does not mean falling speed. As long as the forward force exceeds resistance, the ball keeps accelerating, just less strongly. Compare equal-size balls: stone has less mass than iron, and lead has more. The lighter ball generally leaves faster in this model. Its earlier movement also changes the pressure curve, so the curves are not identical.',
          'The backward push on the cannon is recoil. A heavy cannon moves less than its much lighter ball, while its carriage and the ground also exchange momentum. The escaping gas carries momentum too. The small carriage movement in the illustration is a visual cue, not a calculated recoil measurement.',
          'Try a controlled comparison: keep the charge preset fixed and change only the ball material. Watch both curves, rather than only the final speed. Peak pressure describes one moment; the ball’s final motion depends on the push accumulated over its journey. Each curve has its own relative scale, so their plotted heights cannot be compared as if pressure and speed shared units.',
        ], takeaway:'Pressure describes the push now. Speed records the accumulated effect of earlier pushes.',
      },
      {
        heading:'Following the energy through the barrel.',
        paragraphs:[
          'Historians distinguish a surviving object’s date from the invention of a technology. An early cannon proves the idea already existed; it does not prove nobody made one earlier. Our illustration evokes a later muzzle-loading cannon rather than reconstructing the first Chinese examples. The fuse is a visible ignition cue; historical ignition methods varied.',
          'For the science, treat the ball as a moving mass and the gas behind it as an expanding reservoir. Pressure difference across the ball produces force over its area. Integrating the net force through distance gives the increase in kinetic energy. Pressure can peak early while speed continues increasing towards the muzzle.',
          'Kinetic energy is K = ½mv². For the same mass, doubling speed requires four times the kinetic energy. Force and energy are not interchangeable: force describes the push, while work measures energy transferred as that push acts through distance. A pressure curve against time is therefore not, by itself, a graph of the work delivered to the ball.',
          'The exhibit numerically follows a smooth release of heat, gas expansion, work on the ball and small losses. Its charge presets, gas properties and time scale are invented classroom quantities. All balls have the same size and idealised material masses. Relative pressure and speed use fixed comparison scales across experiments; they are not predictions for a historical gun.',
          'The gas and ball influence each other. A lighter ball begins moving sooner, enlarging the gas volume earlier and changing the subsequent pressure. This is why changing mass cannot be analysed by taking one unchanged pressure curve and merely dividing the force by a new mass. Following both parts of the energy balance explains the linked changes seen in the experiment.',
          'Real events also involve non-uniform burning, leakage, friction, heat transfer, deformation, sound and a complicated gas jet. This model stops driving the ball at muzzle clearance and then lets the remaining gas pressure fade. Its short coast after the muzzle omits gravity, air resistance and the brief push the external jet can add. That boundary makes the main energy transfer easy to inspect without pretending to reproduce every detail.',
        ], takeaway:'A useful model explains a relationship while making its limits visible.',
        equation:{expression:'F = ΔP × A      a = Fnet / m      ΔK = ∫ Fnet dx',explanation:'Pressure difference ΔP acts over area A. Net force changes the velocity of mass m; work over distance changes kinetic energy K. These are general relationships, not dimensions or loading specifications.'},
      },
    ], related: ['rockets', 'earth', 'moon'], sources: [
      ['Royal Armouries · Cannon in the Hundred Years’ War','https://royalarmouries.org/objects-and-stories/stories/the-hundred-years-war-1337-1453'],
      ['Tonio Andrade · Early cannon in China and Europe (research paper)','https://www.tonioandrade.com/_files/ugd/88be10_6d1a981ca79946488ba646c3630d550a.pdf'],
      ['Royal Museums Greenwich · Historic stone shot','https://www.rmg.co.uk/collections/objects/rmgc-object-37115'],
      ['UCL · Material evidence from the Mary Rose (research poster)','https://www.ucl.ac.uk/bartlett/sites/bartlett/files/characterising_cast_iron_cannonballs.pdf'],
      ['NASA · Newton’s laws of motion','https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/newtons-laws-of-motion/'],
      ['NASA · The HARP project and the Martlet','https://pwg.gsfc.nasa.gov/stargaze/Smartlet.htm'],
    ],
  },
  {
    id: 'rockets', title: 'How a rocket works', group: 'The science of flight', kind: 'History / momentum / thrust / discovery',
    description: 'Carry the engine. Send gas backwards. Keep discovering.',
    stats: [['First liquid-propellant flight', 'Goddard · 1926'], ['First artificial satellite', 'Sputnik 1 · 1957'], ['Surrounding air required?', 'No — works in a vacuum']],
    levels: [
      {heading:'A narrow neck. A widening bell. A push.',paragraphs:[
        'Follow the gas through a simple rocket engine. Fuel and an oxidiser meet in the chamber, releasing heat. The hot gas pushes in every direction. The nozzle gives it a way out: through a narrow neck, called the throat, and then a widening bell.',
        'The gas gets faster as it travels through the nozzle. In the bell it spreads out and its pressure falls. Gas rushes backwards, and the rocket gains momentum forwards. The rocket does not push against the surrounding air, so it works in a vacuum too.',
        'The shape matters. A nozzle that suits space may be too wide for air near the ground. Open the Advanced nozzle lab to compare them. For now, remember the three parts: chamber, throat and bell. The liquid-propellant story began with Goddard’s first successful flight in 1926, long before today’s space engines.',
      ],takeaway:'The nozzle turns some of the hot gas’s energy into a fast, directed exhaust.'},
      {heading:'Pressure becomes directed motion.',paragraphs:[
        'Inside a chamber, hot gas has high pressure and moves relatively slowly towards the nozzle. The converging section accelerates it. With enough pressure behind it, gas reaches the local speed of sound at the throat. Engineers call this choked flow: it limits mass flow, but does not stop the gas.',
        'After the throat, the gas can be supersonic—faster than its local speed of sound. Supersonic gas behaves differently from slower flow: a widening passage lets it speed up further. As it expands, its pressure and temperature fall. Part of its thermal energy becomes directed motion.',
        'For a simple nozzle working in air, it helps if the gas leaves at about the pressure outside. Too little expansion leaves useful expansion unfinished. Too much lets outside air squeeze the flow and can make it detach from the wall. In vacuum, larger expansion can help, though real nozzles must still be carried.',
        'The travelling experiment above keeps its nozzle performance fixed. The same propellant and payload give the same final velocity change at different burn rates, under its ideal free-space assumptions. In the Advanced nozzle lab, hold the engine still and inspect the pressure and speed along the gas’s path instead.',
        'Thrust is a force; acceleration also depends on the mass being pushed. As propellant leaves, the rocket becomes lighter, so the same thrust can produce greater acceleration later in a burn. Compare burn rates while holding propellant and payload fixed, then change the payload separately to distinguish these two effects.',
      ],takeaway:'The throat controls flow; the bell converts more of the gas’s energy into exhaust motion.'},
      {heading:'Read the nozzle with energy and momentum.',paragraphs:[
        'Our simplified nozzle is a smooth passage with steady flow. We treat the gas as ideal, neglect heat exchange with the walls and use one representative speed and pressure at each cross-section. The throat reaches Mach 1; Mach number means speed divided by the local speed of sound. The diverging section then permits supersonic expansion.',
        'Thrust has two parts. First, the outgoing gas carries momentum at a rate equal to mass flow times exhaust velocity. Second, any difference between exit pressure and surrounding pressure acts across the exit area. Matching those pressures gives the ideal best expansion for fixed chamber conditions in air.',
        'A larger throat at the same pressure passes more gas. A wider bell at the same throat changes expansion and exit speed. These are different effects: a larger engine can have more thrust without getting more impulse from each kilogram of propellant. Specific impulse helps distinguish those ideas.',
        'For constant effective exhaust velocity, the ideal rocket equation is Δv = vₑff ln(mstart / mend). Effective velocity includes the pressure contribution to thrust and differs from the gas speed in the equation below. The masses include the vehicle and payload as well as remaining propellant. Δv describes the velocity change available under ideal free-space assumptions.',
        'A starting-to-ending mass ratio of 2 gives Δv ≈ 0.693vₑff; a ratio of 4 gives about 1.386vₑff. Doubling that ratio doubles the ideal velocity change in this example, rather than making it four times larger. A real surface launch must also overcome local weight and incurs gravity and drag losses: enough ideal Δv does not by itself guarantee lift-off.',
        'The travelling experiment’s index scales are invented classroom quantities. The advanced panel instead uses real units and an ideal-gas nozzle calculation, with approximate gas properties and an illustrative mixture curve. Neither includes cooling, pump power, nozzle mass or detailed chemistry. Use Advanced info for each setting, at whichever reading level suits you.',
      ],takeaway:'Mass flow, exhaust speed and exit pressure together determine thrust.',equation:{expression:'F = ṁvₑ + (pₑ − pₐ)Aₑ',explanation:'F is thrust in newtons; ṁ is exhaust mass flow in kg/s; vₑ is exhaust speed in m/s. pₑ and pₐ are exit and ambient pressure in pascals; Aₑ is exit area in m². Here vₑ is the gas speed, not effective exhaust velocity.'}},
    ], related: ['cannons', 'solar-system', 'earth'], sources: [
      ['NASA · A brief history of rockets','https://www.grc.nasa.gov/www/k-12/TRC/Rockets/history_of_rockets.html'],
      ['NASA · Robert Goddard and the 1926 flight','https://science.nasa.gov/earth/earth-observatory/robert-goddard/'],
      ['NASA · Sputnik and the dawn of the space age','https://www.nasa.gov/history/dawn-of-the-space-age/'],
      ['NASA · Rocket propulsion','https://www.grc.nasa.gov/www/k-12/BGP/rocket.html'],
      ['NASA · Rocket thrust and the vacuum','https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/rocket-thrust-equation/'],
      ['NASA · Specific impulse','https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/'],
      ['NASA · The ideal rocket equation','https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/'],
      ['NASA · Nozzle design','https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/nozzle-design/'],
    ],
  },
];

export const MOON_FAMILIES = [
  { planet: 'mercury', moons: [], note: 'No natural moons.' },
  { planet: 'venus', moons: [], note: 'No natural moons.' },
  { planet: 'earth', moons: ['The Moon'], note: 'Our nearest celestial neighbour.' },
  { planet: 'mars', moons: ['Phobos', 'Deimos'], note: 'Two small, irregular moons.' },
  { planet: 'jupiter', moons: ['Io', 'Europa', 'Ganymede', 'Callisto'], note: 'The four Galilean moons; Jupiter has many more.' },
  { planet: 'saturn', moons: ['Enceladus', 'Titan'], note: 'Two of Saturn’s many moons.' },
  { planet: 'uranus', moons: ['Miranda', 'Ariel', 'Umbriel', 'Titania', 'Oberon'], note: 'The five major moons; more small moons orbit here.' },
  { planet: 'neptune', moons: ['Triton'], note: 'The largest of Neptune’s moons.' },
  { planet: 'pluto', moons: ['Charon', 'Styx', 'Nix', 'Kerberos', 'Hydra'], note: 'A dwarf planet with five moons.' },
];

export function getArticle(id: string) { return ARTICLES.find(article => article.id === id); }
/** The atlas also reads like a book: each entry leads to the next, and the last back to the first. */
export function articleNeighbours(id: string) {
  const i = ARTICLES.findIndex(article => article.id === id);
  return { previous: i > 0 ? ARTICLES[i - 1] : undefined, next: ARTICLES[(i + 1) % ARTICLES.length], wraps: i === ARTICLES.length - 1 };
}
export function searchArticles(query: string) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return ARTICLES.filter(a => {
    const text = [a.title, a.kind, a.description, ...a.levels.flatMap(l => [l.heading, ...l.paragraphs, l.takeaway])].join(' ').toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}

export function parseWikiHash(hash: string): { id: string; level: Level } | null {
  const match = /^#wiki\/([a-z-]+)(?:\/([123]))?$/.exec(hash);
  return match && getArticle(match[1]) ? { id: match[1], level: (Number(match[2] || 1) - 1) as Level } : null;
}
