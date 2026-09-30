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

/** Original educational copy checked against the linked museum, research and
 * NASA references. No live moon counts or mission schedules to become stale. */
export const ARTICLES: Article[] = [
  {
    id: 'solar-system', title: 'Our Solar System', group: 'The big picture', kind: 'A neighbourhood in motion',
    description: 'One star. Eight planets. Countless places to be curious.',
    stats: [['At the centre', 'The Sun'], ['Planets', '8'], ['Age', '≈4.6 billion years']],
    levels: [
      reading('Everything has a journey.', 'The Solar System is the Sun and the worlds travelling around it. The Sun is a star: it makes its own light. Planets shine because they reflect some of that light.', 'The planets, in order from the Sun, are Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune. Moons travel around planets as those planets travel around the Sun. Asteroids, comets and dwarf planets belong to the family too.', 'A moon goes around its parent world; together they also go around the Sun.'),
      reading('Gravity holds the family together.', 'Gravity pulls objects towards each other. A planet also has sideways motion, so it keeps falling around the Sun instead of falling straight into it. That curved journey is an orbit.', 'The four inner planets are rocky. Farther out are two gas giants and two ice giants. The main asteroid belt lies between Mars and Jupiter. Beyond Neptune, the Kuiper Belt contains icy objects, including Pluto. Our maps compress the huge empty spaces so you can see the relationships.', 'An orbit needs both gravity and motion.'),
      { ...reading('A disc became a planetary system.', 'About 4.6 billion years ago, a cloud of gas and dust collapsed. Most material collected in the young Sun; the surrounding rotating disc supplied the building blocks of planets. Collisions, growth and migration helped shape the system we see.', 'Orbits are ellipses, with the Sun near one focus. In the simplest two-body picture, a more distant planet takes longer to orbit. The worlds actually tug on each other too, and the Sun moves around the system’s shared centre of mass.', 'A diagram shows relationships; it cannot show every real size, distance and tilt at once.'), equation: { expression: 'T² ≈ a³', explanation: 'For objects orbiting the Sun: T is the orbital period in Earth years and a is the semi-major axis in astronomical units (AU). One AU is about Earth’s average distance from the Sun.' } },
    ], related: ['sun', 'moons', 'kuiper-belt', 'asteroid-belt'], sources: [...nasa('solar-system/solar-system-facts'), ...nasa('learn/basics-of-space-flight/chapter1-1')],
  },
  {
    id: 'sun', title: 'The Sun', art: 'sun', group: 'Our star & planets', kind: 'Our nearest star',
    description: 'The light, warmth and gravitational heart of our neighbourhood.',
    stats: [['Type', 'Star'], ['Light to Earth', '≈8 min 20 sec'], ['Surface', '≈5,500 °C']],
    levels: [
      reading('A star of our own.', 'The Sun is an enormous glowing ball of very hot material. Its light warms Earth and helps plants grow. It looks much bigger than other stars because it is much closer to us.', 'It has no solid ground to stand on. Even though the Sun is vital to life, looking straight at it can hurt your eyes; ordinary sunglasses do not make that safe.', 'The Sun makes light; planets mostly reflect it.'),
      reading('Powered from within.', 'Deep in the Sun, nuclear fusion joins hydrogen nuclei to make helium and releases energy. This is different from burning fuel in a fire, which is a chemical reaction.', 'Energy travels outwards and eventually escapes as sunlight. The bright layer we usually call the surface is the photosphere. Above it lies an atmosphere, including the very hot, thin corona.', 'The Sun is a nuclear furnace, not a giant campfire.'),
      reading('A balance of opposing effects.', 'Gravity compresses the Sun while pressure in its hot interior resists collapse. This approximate hydrostatic balance lets it remain a stable star for a very long time.', 'Moving, electrically charged material also generates magnetic fields. Twisted fields help produce sunspots, flares and eruptions. The solar wind carries charged particles into space, where they interact with planetary magnetic fields.', 'A star’s gravity, pressure and energy flow work together.'),
    ], related: ['solar-system', 'earth', 'jupiter'], sources: nasa('sun/facts'),
  },
  {
    id: 'mercury', title: 'Mercury', art: 'mercury', group: 'Our star & planets', kind: '01 / Rocky planet',
    description: 'Small, cratered and quick around the Sun.',
    stats: [['Solar distance', '0.39 AU'], ['Year', '88 Earth days'], ['Moons', 'None']],
    levels: [
      reading('The planet nearest the Sun.', 'Mercury is the smallest of the eight planets. Its rocky surface is covered in craters, rather like our Moon. It races around the Sun faster than any other planet.', 'Its sunny side can be extremely hot, while its long nights are bitterly cold. Being closest to the Sun does not make Mercury the hottest planet: that title belongs to Venus.', 'An atmosphere matters as well as distance from the Sun.'),
      reading('Almost no blanket of air.', 'Mercury has only a very thin exosphere. It cannot move much warmth from day to night or protect the surface from impacts the way a thick atmosphere can.', 'Near its poles, some crater floors never receive direct sunlight. Water ice can survive in these permanently shadowed places, even on a world so close to the Sun.', 'Hot sunshine and cold, permanent shadows can exist on the same world.'),
      reading('Two clocks, different answers.', 'Mercury rotates three times for every two trips around the Sun: a 3:2 spin–orbit resonance. Its rotation relative to the stars takes about 59 Earth days.', 'A solar day means noon to the next noon. Combining Mercury’s slow rotation and orbital motion gives a solar day of about 176 Earth days—twice its year.', 'A rotation period and a solar day are different measurements.'),
    ], related: ['venus', 'moon', 'sun'], sources: nasa('mercury/facts'),
  },
  {
    id: 'venus', title: 'Venus', art: 'venus', group: 'Our star & planets', kind: '02 / Rocky planet',
    description: 'A familiar-sized world with a very unfamiliar atmosphere.',
    stats: [['Solar distance', '0.72 AU'], ['Year', '225 Earth days'], ['Moons', 'None']],
    levels: [
      reading('Earth’s scorching neighbour.', 'Venus is nearly Earth’s size, but its surface is far too hot for people. Thick clouds hide the ground, making Venus brilliant in our sky.', 'Its atmosphere holds in so much heat that Venus is hotter than Mercury. There are mountains, plains and volcanoes beneath the clouds.', 'Similar size does not mean similar conditions.'),
      reading('A powerful greenhouse.', 'Venus has a dense atmosphere made mainly of carbon dioxide. It absorbs and re-emits infrared radiation, making it harder for heat to escape to space. This strong greenhouse effect keeps the surface around 464 °C.', 'The clouds contain sulfuric acid, and pressure at the surface is roughly 92 times Earth’s sea-level pressure. A spacecraft has to endure much more than heat alone.', 'Atmospheres change how worlds gain and lose energy.'),
      reading('A planet that spins backwards.', 'Venus rotates very slowly in the opposite direction to most planets. Its sidereal rotation takes about 243 Earth days, longer than its 225-day year.', 'That does not mean a sunrise-to-sunrise day is longer than the year. Rotation and orbital motion combine to make its solar day about 117 Earth days. Radar lets scientists map the ground through its opaque clouds.', 'Always ask whether “day” means rotation or sunrise to sunrise.'),
    ], related: ['earth', 'mercury', 'solar-system'], sources: nasa('venus/venus-facts'),
  },
  {
    id: 'earth', title: 'Earth', art: 'earth', group: 'Our star & planets', kind: '03 / Rocky planet',
    description: 'An ocean world, an airy blanket, and our only home.',
    stats: [['Solar distance', '1 AU'], ['Year', '≈365¼ days'], ['Moon', 'The Moon']],
    levels: [
      reading('The world beneath our feet.', 'Earth has land, oceans and an atmosphere we can breathe. It is the only world where we know life exists. From space, its oceans and clouds make it look blue and white.', 'Earth spins once in about a day and travels around the Sun in about a year. Its Moon comes along for the journey.', 'We live on a moving planet, even when the ground feels still.'),
      reading('Why the seasons change.', 'Earth’s axis is tilted by about 23.4 degrees. As Earth orbits, each hemisphere takes turns leaning towards the Sun. More direct sunshine and longer days bring summer there.', 'The seasons are not caused mainly by Earth moving closer to the Sun. When it is summer in the north, it is winter in the south. Oceans and the atmosphere redistribute heat across the planet.', 'Tilt changes the angle and duration of sunlight.'),
      reading('A connected, changing system.', 'Earth’s rocks, water, air and life exchange matter and energy. Plate tectonics moves the crust; the water cycle carries moisture; greenhouse gases help regulate the escape of heat.', 'Motion in the conducting outer core generates a magnetic field. This interacts with the solar wind, helping shape a protective magnetic environment. Gravity holds the atmosphere close, but its composition is shaped by geology and life too.', 'Earth is a set of interacting systems, not a static ball of rock.'),
    ], related: ['moon', 'venus', 'rockets'], sources: nasa('earth/facts'),
  },
  {
    id: 'mars', title: 'Mars', art: 'mars', group: 'Our star & planets', kind: '04 / Rocky planet',
    description: 'Rust-red deserts with clues to a wetter past.',
    stats: [['Solar distance', '1.52 AU'], ['Year', '687 Earth days'], ['Moons', 'Phobos & Deimos']],
    levels: [
      reading('The red planet.', 'Mars looks reddish because iron-bearing minerals in its dust have oxidised—rather like rust. It has a rocky surface, polar ice and enormous mountains.', 'Its two small moons are Phobos and Deimos. Mars is colder than Earth and has much thinner air, so people could not breathe or walk around there without protection.', 'The colour of a world can tell us about its chemistry.'),
      reading('Reading the landscape.', 'Dry river channels, lake-bed sediments and water-altered minerals suggest liquid water once flowed on Mars. Today, much of its water is frozen.', 'The atmosphere is mainly carbon dioxide but is too thin to keep the surface warm and wet like Earth. Dust storms, seasons and weather still make this a changing world.', 'A dry landscape can preserve evidence of flowing water.'),
      reading('A planet’s history in its rocks.', 'Scientists compare layers, minerals and crater patterns to reconstruct when different environments existed. A habitable environment is a place where life could have survived; it is not evidence that life actually lived there.', 'Mars lost much of its atmosphere over time. Studying its changing climate helps us understand how planets develop different histories despite forming in the same Solar System.', 'Evidence for past habitability is not a discovery of life.'),
    ], related: ['earth', 'asteroid-belt', 'moons'], sources: nasa('mars/facts'),
  },
  {
    id: 'jupiter', title: 'Jupiter', art: 'jupiter', group: 'Our star & planets', kind: '05 / Gas giant',
    description: 'Cloud bands, giant storms and a family of remarkable moons.',
    stats: [['Solar distance', '5.2 AU'], ['Year', '≈12 Earth years'], ['Largest moon', 'Ganymede']],
    levels: [
      reading('The giant of the planets.', 'Jupiter is the largest planet. The stripes we see are bands of clouds, and its famous Great Red Spot is a huge storm.', 'There is no solid surface like Earth’s to land on. Four of its best-known moons are Io, Europa, Ganymede and Callisto. They orbit Jupiter while it orbits the Sun.', 'A planet can be a whole neighbourhood of smaller worlds.'),
      reading('Under the clouds.', 'Jupiter is mostly hydrogen and helium. Far below the clouds, enormous pressure changes the way this material behaves. Going deeper does not lead to an ordinary patch of ground.', 'Its rapid rotation and flowing atmosphere help shape the bands and storms. Io is volcanic, Europa is icy, and Ganymede is larger across than Mercury.', 'The visible clouds are only the outermost view of a giant planet.'),
      reading('Gravity can heat a moon.', 'Io, Europa and Ganymede have linked orbital periods close to 1:2:4. Repeated gravitational tugs help maintain slightly stretched orbits.', 'As a moon travels along such an orbit, changing tidal forces flex it. Internal friction can turn this mechanical energy into heat. Tidal heating is especially dramatic on Io and helps explain why some faraway moons remain active.', 'Sunlight is not the only possible source of warmth inside a world.'),
    ], related: ['ganymede', 'moons', 'saturn'], sources: [...nasa('jupiter/jupiter-facts'), ...nasa('solar-system/moons/facts')],
  },
  {
    id: 'saturn', title: 'Saturn', art: 'saturn', group: 'Our star & planets', kind: '06 / Gas giant',
    description: 'A world framed by countless pieces of ice.',
    stats: [['Solar distance', '9.6 AU'], ['Year', '≈29 Earth years'], ['Featured moons', 'Titan & Enceladus']],
    levels: [
      reading('The planet with the famous rings.', 'Saturn’s rings look like a smooth disc from far away. Up close, they are countless separate pieces, mostly water ice, travelling around the planet.', 'Saturn is a gas giant. It also has many moons, including hazy Titan and bright, icy Enceladus. The rings and moons are separate parts of its family.', 'A ring is a crowd of orbiting particles, not a solid plate.'),
      reading('Extraordinary neighbours.', 'Titan has a thick atmosphere and lakes and seas of liquid methane and ethane. These are not water oceans like Earth’s.', 'Enceladus has a liquid-water ocean beneath its ice. Plumes spray material into space, allowing spacecraft to sample clues about what lies below. Both moons show that “cold” does not mean “uninteresting”.', 'Different liquids can shape different landscapes.'),
      reading('Order inside the rings.', 'Ring particles nearer Saturn generally orbit faster than particles farther away. Their collisions and gravitational interactions with moons create gaps, waves and sharp edges.', 'A moon can repeatedly tug particles at particular orbital resonances. Rings are therefore a living demonstration of orbital mechanics. All four giant planets have rings, although Saturn’s are the most conspicuous.', 'Gravity organises both tiny particles and enormous worlds.'),
    ], related: ['jupiter', 'moons', 'uranus'], sources: [...nasa('saturn/facts'), ...nasa('saturn/moons/facts')],
  },
  {
    id: 'uranus', title: 'Uranus', art: 'uranus', say: 'YOOR-un-us', group: 'Our star & planets', kind: '07 / Ice giant',
    description: 'A pale blue-green world tipped almost onto its side.',
    stats: [['Solar distance', '19.2 AU'], ['Year', '≈84 Earth years'], ['Axial tilt', '≈98°']],
    levels: [
      reading('An unusual way to spin.', 'Uranus spins with its axis almost on its side. Imagine a rolling ball travelling around the Sun rather than an upright spinning top.', 'It looks blue-green partly because methane in its atmosphere absorbs red light. It has rings and many moons, including Titania, Oberon, Ariel, Umbriel and Miranda.', 'The direction a planet spins can shape its seasons.'),
      reading('What is an ice giant?', 'The name refers to the kinds of ingredients thought to be important inside Uranus: water, ammonia and methane, as well as rock and hydrogen and helium.', 'These materials are not necessarily frozen solid inside the planet. High temperatures and pressures make the interior very different from household ice. Uranus’s extreme tilt produces long, unusual seasons.', '“Ice giant” describes a planetary category, not a snow-covered surface.'),
      reading('A magnetic puzzle.', 'Uranus’s magnetic field is strongly tilted relative to its rotation axis and offset from the planet’s centre. The moving conducting material that generates it may occupy a shell inside the planet.', 'Its atmosphere, interior heat and tilted seasons are connected, but much remains uncertain. Scientists combine spacecraft measurements, telescope observations and physical models to test explanations.', 'A good scientific model must explain the observations, including the awkward ones.'),
    ], related: ['neptune', 'saturn', 'moons'], sources: [...nasa('uranus/facts'), ...nasa('uranus/moons/facts')],
  },
  {
    id: 'neptune', title: 'Neptune', art: 'neptune', group: 'Our star & planets', kind: '08 / Ice giant',
    description: 'A distant, windy world at the edge of the planetary line-up.',
    stats: [['Solar distance', '30 AU'], ['Year', '≈165 Earth years'], ['Largest moon', 'Triton']],
    levels: [
      reading('The farthest planet.', 'Neptune is the most distant of the eight planets. Sunlight reaching it is much weaker than the light at Earth, yet its atmosphere has powerful winds and storms.', 'Its largest moon, Triton, travels around Neptune in the opposite direction to the planet’s rotation. Beyond Neptune lie many smaller icy worlds.', 'The planets end at Neptune; the Solar System does not.'),
      reading('Found with mathematics.', 'Neptune was identified after astronomers used unexpected changes in Uranus’s motion to predict another planet’s gravitational pull. Telescopes then found the new world.', 'Neptune is an ice giant, with a deep, hot interior under its atmosphere. Like Uranus, it has rings. Artistic images often show a strong blue; processing and colour choices can exaggerate the difference between the two planets.', 'Gravity can reveal an object before we see it.'),
      reading('A moon travelling the other way.', 'Triton’s retrograde orbit is evidence that it was probably captured rather than forming in a normal disc around Neptune. Capture requires a way to change orbital energy.', 'Its icy surface and thin atmosphere offer clues to the outer Solar System. As elsewhere in astronomy, an origin story is tested using multiple kinds of evidence rather than one striking feature alone.', 'Orbital direction is a clue to a world’s past.'),
    ], related: ['uranus', 'moons', 'kuiper-belt'], sources: [...nasa('neptune/neptune-facts'), ...nasa('neptune/moons')],
  },
  {
    id: 'moons', title: 'Worlds around worlds', group: 'Moons & small worlds', kind: 'The moon families',
    description: 'Follow the small orbits to discover who belongs to whom.',
    stats: [['Earth', 'The Moon'], ['Mars', 'Phobos & Deimos'], ['Largest moon', 'Ganymede']],
    levels: [
      reading('A moon has a parent world.', 'A moon is a natural object travelling around another world. Our Moon goes around Earth. Ganymede goes around Jupiter. Both also travel around the Sun with their parent planets.', 'Mercury and Venus have no moons. The giant planets have large families. Some moons are round worlds; others are small, irregular chunks. The family map below shows selected examples, not every moon.', 'The word “moon” tells you about an orbit, not a size.'),
      reading('Not all moons began alike.', 'Some moons formed from material around a young planet. Others were captured. Earth’s Moon probably formed from debris after a giant impact involving the early Earth.', 'Gravity can stretch and squeeze a moon, affecting its interior. Tidal interactions also tend to slow rotation until the moon shows roughly the same face to its planet, as our Moon does.', 'Moons have different origins and can be active worlds in their own right.'),
      reading('Nested orbits, shared motion.', 'A planet and moon both move around their common centre of mass, called a barycentre. That pair also moves through the Sun’s gravitational field. A moon’s path around the Sun is not a set of tiny isolated circles sitting still in space.', 'Many moons are tidally locked, but they still rotate: one turn relative to the stars per orbit keeps the same face pointing at their parent. Repeated gravitational tugs can also link moon orbits in resonances.', 'Tidally locked does not mean “not spinning”.'),
    ], related: ['moon', 'ganymede', 'jupiter'], sources: [...nasa('solar-system/moons/facts'), ...nasa('saturn/moons'), ...nasa('uranus/moons/facts')],
  },
  {
    id: 'moon', title: 'The Moon', art: 'moon', group: 'Moons & small worlds', kind: 'Earth’s natural satellite',
    description: 'Our nearest companion, with a landscape that remembers.',
    stats: [['Orbits', 'Earth'], ['Mean distance', '384,400 km'], ['Orbit', '≈27.3 days']],
    levels: [
      reading('Borrowed light in the night sky.', 'The Moon does not make its own visible light. It reflects sunlight. As it moves around Earth, we see different amounts of its sunlit half: these are its phases.', 'Its surface has mountains, plains and impact craters. With almost no atmosphere or running water, many marks remain for a very long time.', 'Moon phases are usually about our viewing angle, not Earth’s shadow.'),
      reading('One face, many phases.', 'The Moon rotates once in about the time it takes to orbit Earth, so it keeps roughly the same face towards us. Its far side receives sunlight too; it is not permanently dark.', 'An orbit relative to the stars takes about 27.3 days. The cycle from one new moon to the next takes about 29.5 days because Earth also moves around the Sun.', 'An orbital period and a phase cycle measure different things.'),
      reading('Tides exchange energy.', 'The Moon’s gravity varies across Earth, producing tidal effects together with the Sun. Real ocean tides also depend on coastlines, depth and the shape of ocean basins.', 'Tidal interactions transfer angular momentum between Earth’s spin and the Moon’s orbit. Earth’s rotation slowly decreases and the Moon gradually recedes. The Moon is a close example of processes operating throughout the Solar System.', 'Gravity can change both the spin and orbit of a world.'),
    ], related: ['earth', 'moons', 'ganymede'], sources: nasa('moon/facts'),
  },
  {
    id: 'ganymede', title: 'Ganymede', art: 'ganymede', say: 'GAN-ih-meed', group: 'Moons & small worlds', kind: 'A moon of Jupiter',
    description: 'An icy moon so large it could be mistaken for a planet.',
    stats: [['Orbits', 'Jupiter'], ['Diameter', '≈5,268 km'], ['Orbit', '≈7.2 Earth days']],
    levels: [
      reading('The largest moon.', 'Ganymede is the biggest moon in the Solar System—wider than the planet Mercury. It is still a moon because it orbits Jupiter.', 'Its surface mixes old, dark regions with brighter, grooved terrain. Much of its outer shell is water ice. It is a real world with a history, not simply a dot beside Jupiter.', 'Classification depends on the kind of object and its orbit, not size alone.'),
      reading('Ice above, possibly an ocean below.', 'Measurements provide strong evidence for a salty ocean beneath Ganymede’s icy crust. Scientists infer this from how the moon responds to its magnetic surroundings, rather than from seeing open water.', 'Ganymede also has its own internally generated magnetic field. That makes it unusual among moons and offers clues about moving material deep inside.', 'We can learn about a hidden interior by measuring its effects outside.'),
      reading('Reading the magnetic signals.', 'Jupiter’s changing magnetic environment can induce electrical currents in a conducting ocean. These currents produce a magnetic response that can be compared with observations.', 'Ganymede also generates a field of its own, probably in a liquid, iron-rich core. Separating the internally generated and induced components helps constrain models of its layers. An inferred ocean does not establish that life exists there.', 'Indirect evidence can be powerful, but it still needs careful interpretation.'),
    ], related: ['jupiter', 'moons', 'moon'], sources: nasa('jupiter/jupiter-moons/ganymede/facts'),
  },
  {
    id: 'pluto', title: 'Pluto & the outer frontier', art: 'pluto', group: 'Moons & small worlds', kind: 'Dwarf planet / Kuiper Belt',
    description: 'A small icy world that made the Solar System feel bigger.',
    stats: [['Classification', 'Dwarf planet'], ['Year', '≈248 Earth years'], ['Largest moon', 'Charon']],
    levels: [
      reading('Small does not mean simple.', 'Pluto is a dwarf planet in the Kuiper Belt beyond Neptune. It has mountains of water ice, unusual glaciers and a large moon called Charon.', 'There are eight planets, but far more than eight interesting worlds. Calling Pluto a dwarf planet describes its place in the Solar System; it does not make it less worth exploring.', 'Pluto belongs to a large family of icy outer worlds.'),
      reading('Why “dwarf planet”?', 'Like a planet, a dwarf planet orbits the Sun and is rounded by its own gravity. Unlike a planet, it has not become gravitationally dominant in its orbital neighbourhood. “Cleared” does not mean an orbit is completely empty.', 'Ceres, in the main asteroid belt, is also a dwarf planet. Pluto’s orbit is tilted and more elongated than the major planets’ orbits, so its distance from the Sun varies greatly.', 'A scientific category describes shared properties, not importance.'),
      reading('An orbit protected by timing.', 'Pluto completes roughly two solar orbits for every three made by Neptune. This 3:2 resonance, together with the geometry of its orbit, prevents close encounters despite their overlapping ranges of solar distance.', 'Pluto and Charon orbit a barycentre outside Pluto itself. Their mutual tidal locking means each keeps the same face towards the other. Together they demonstrate how rich the dynamics of small worlds can be.', 'Crossing the same distance from the Sun does not mean colliding.'),
    ], related: ['kuiper-belt', 'moons', 'neptune'], sources: [...nasa('dwarf-planets/pluto/facts'), ...nasa('dwarf-planets/ceres/facts')],
  },
  {
    id: 'kuiper-belt', title: 'The Kuiper Belt', say: 'KY-per belt', group: 'Moons & small worlds', kind: 'Beyond Neptune / icy beginnings',
    description: 'The planets end. The Solar System keeps going.',
    stats: [['Main region', '≈30–50 AU'], ['Familiar member', 'Pluto'], ['Materials', 'Ices & rock']],
    levels: [
      reading('An icy neighbourhood.', 'Beyond Neptune lies a broad region of small, cold worlds called the Kuiper Belt (say “KY-per”). Its objects travel around the Sun. Pluto belongs here, along with many smaller bodies made of ice and rock.', 'Imagine a very wide, very sparse doughnut, not a solid ring or a wall of ice. The dots on our map are enlarged so you can see the region. Far more empty space lies between the real objects. The Kuiper Belt is part of the Solar System, even though it is beyond the eight planets.', 'Neptune is the last planet, not the edge of the Solar System.'),
      reading('Two belts, different ingredients.', 'The main asteroid belt sits between Mars and Jupiter and is mostly rocky. The Kuiper Belt is much farther out: its main region spans roughly 30 to 50 times Earth’s distance from the Sun. Ices can survive there alongside rock.', 'These bodies preserve clues from planet-building. NASA’s New Horizons flew past Pluto in 2015 and Arrokoth in 2019. Arrokoth’s joined lobes offer a close look at how small building blocks could come together gently. Other objects have moons of their own, showing that even a small outer world can have a family.', 'The outer Solar System preserves a different part of our beginnings.'),
      reading('Neptune helped arrange the frontier.', 'The belt contains several orbital populations. Some objects follow relatively circular paths; others occupy resonances with Neptune. Pluto completes two orbits while Neptune completes three. Such repeating timing can keep their encounters safely separated.', 'Neptune also scattered objects onto stretched, tilted paths. The overlapping scattered disc reaches well beyond the main belt and helps supply short-period comets. This region is distinct from the much more distant Oort Cloud, a roughly spherical reservoir associated with long-period comets. A single crisp line cannot represent all these boundaries.', 'A population’s orbits can preserve evidence of the planets’ past motion.'),
    ], related: ['pluto', 'neptune', 'asteroid-belt', 'moons'], sources: [...nasa('solar-system/kuiper-belt'), ...nasa('solar-system/kuiper-belt/facts'), ...nasa('solar-system/kuiper-belt/exploration')],
  },
  {
    id: 'asteroid-belt', title: 'The asteroid belt', group: 'Moons & small worlds', kind: 'Fragments of a beginning',
    description: 'Between Mars and Jupiter, leftovers tell the story of planet-building.',
    stats: [['Location', 'Mars → Jupiter'], ['Main region', '≈2.1–3.3 AU'], ['Largest member', 'Ceres']],
    levels: [
      reading('A very spacious collection.', 'The main asteroid belt is a region where many rocky objects orbit the Sun. It lies mostly between Mars and Jupiter. Its biggest member, Ceres, is rounded and classified as a dwarf planet.', 'It is not a packed obstacle course like the ones in films. Asteroids are usually separated by enormous empty spaces. Our illustrations enlarge the rocks to make them visible.', 'The asteroid belt is mostly empty space.'),
      reading('Pieces left from planet-building.', 'Asteroids preserve material from the early Solar System. In this region, gravitational disturbances—especially from Jupiter—helped prevent the material from assembling into one large planet.', 'The belt contains different kinds of bodies: dark, carbon-rich objects, rocky objects and some rich in metal. Collisions break them apart or rearrange them. The belt is not simply the remains of one exploded planet.', 'Asteroids are samples of a long and complicated construction process.'),
      reading('Gravity sorts the neighbourhood.', 'At certain orbital periods, an asteroid receives repeated tugs from Jupiter at similar points in its orbit. These resonances can make orbits less stable and help produce the sparse regions called Kirkwood gaps.', 'Collisions create families of fragments with related orbits. Some fragments are eventually moved onto paths that cross planetary orbits. Studying compositions and orbit families helps reconstruct the Solar System’s past.', 'A gap can be evidence of an invisible gravitational pattern.'),
    ], related: ['mars', 'jupiter', 'kuiper-belt'], sources: [...nasa('solar-system/asteroids/facts'), ...nasa('dwarf-planets/ceres/facts')],
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
        ], takeaway:'Pressure describes the push now. Speed records the accumulated effect of earlier pushes.',
      },
      {
        heading:'Following the energy through the barrel.',
        paragraphs:[
          'Historians distinguish a surviving object’s date from the invention of a technology. An early cannon proves the idea already existed; it does not prove nobody made one earlier. Our illustration evokes a later muzzle-loading cannon rather than reconstructing the first Chinese examples. The fuse is a visible ignition cue; historical ignition methods varied.',
          'For the science, treat the ball as a moving mass and the gas behind it as an expanding reservoir. Pressure difference across the ball produces force over its area. Integrating the net force through distance gives the increase in kinetic energy. Pressure can peak early while speed continues increasing towards the muzzle.',
          'The exhibit numerically follows a smooth release of heat, gas expansion, work on the ball and small losses. Its charge presets, gas properties and time scale are invented classroom quantities. All balls have the same size and idealised material masses. Relative pressure and speed use fixed comparison scales across experiments; they are not predictions for a historical gun.',
          'Real events also involve non-uniform burning, leakage, friction, heat transfer, deformation, sound and a complicated gas jet. This model stops driving the ball at muzzle clearance and then lets the remaining gas pressure fade. It omits the brief push the external jet can add. That boundary makes the main energy transfer easy to inspect without pretending to reproduce every detail.',
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
      ],takeaway:'The throat controls flow; the bell converts more of the gas’s energy into exhaust motion.'},
      {heading:'Read the nozzle with energy and momentum.',paragraphs:[
        'Our simplified nozzle is a smooth passage with steady flow. We treat the gas as ideal, neglect heat exchange with the walls and use one representative speed and pressure at each cross-section. The throat reaches Mach 1; Mach number means speed divided by the local speed of sound. The diverging section then permits supersonic expansion.',
        'Thrust has two parts. First, the outgoing gas carries momentum at a rate equal to mass flow times exhaust velocity. Second, any difference between exit pressure and surrounding pressure acts across the exit area. Matching those pressures gives the ideal best expansion for fixed chamber conditions in air.',
        'A larger throat at the same pressure passes more gas. A wider bell at the same throat changes expansion and exit speed. These are different effects: a larger engine can have more thrust without getting more impulse from each kilogram of propellant. Specific impulse helps distinguish those ideas.',
        'The travelling experiment’s index scales are invented classroom quantities. The advanced panel instead uses real units and an ideal-gas nozzle calculation, with approximate gas properties and an illustrative mixture curve. Neither includes cooling, pump power, nozzle mass or detailed chemistry. Use Advanced info for each setting, at whichever reading level suits you.',
      ],takeaway:'Mass flow, exhaust speed and exit pressure together determine thrust.',equation:{expression:'F = ṁvₑ + (pₑ − pₐ)Aₑ',explanation:'F is thrust in newtons; ṁ is exhaust mass flow in kg/s; vₑ is exhaust speed in m/s. pₑ and pₐ are exit and ambient pressure in pascals; Aₑ is exit area in m². Here vₑ is the gas speed, not effective exhaust velocity.'}},
    ], related: ['cannons', 'solar-system', 'earth'], sources: [
      ['NASA · A brief history of rockets','https://www.grc.nasa.gov/www/k-12/TRC/Rockets/history_of_rockets.html'],
      ['NASA · Robert Goddard and the 1926 flight','https://science.nasa.gov/earth/earth-observatory/robert-goddard/'],
      ['NASA · Sputnik and the dawn of the space age','https://www.nasa.gov/history/dawn-of-the-space-age/'],
      ['NASA · Rocket propulsion','https://www.grc.nasa.gov/www/k-12/BGP/rocket.html'],
      ['NASA · Rocket thrust and the vacuum','https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/rocket-thrust-equation/'],
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
