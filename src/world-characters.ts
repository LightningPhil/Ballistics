export const WORLD_CHARACTERS: Readonly<Record<string, string | null>> = Object.freeze({
  sun: null,
  mercury: 'robot',
  venus: 'newt',
  earth: 'golfer',
  moon: 'spaceman',
  mars: 'alien',
  jupiter: 'whale',
  ganymede: 'squid',
  saturn: 'submarine',
  uranus: 'icerobot',
  neptune: 'snowman',
  pluto: 'icebear',
});

export function characterForWorld(name: string): string | null {
  return Object.prototype.hasOwnProperty.call(WORLD_CHARACTERS, name)
    ? WORLD_CHARACTERS[name]
    : null;
}
