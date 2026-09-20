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

export type IceBearGait = 'two' | 'four';

/** Pluto's ice bear deliberately alternates gaits rather than relying on chance. */
export function nextIceBearGait(current: IceBearGait = 'four'): IceBearGait {
  return current === 'four' ? 'two' : 'four';
}
