export interface WorldArt {
  mini: string;
  full: string;
}

/** Optimised transparent derivatives of the supplied 1254 px cartoon artwork. */
export const WORLD_ART: Readonly<Record<string, WorldArt>> = Object.freeze({
  sun: {
    mini: new URL('./assets/worlds/mini/sun.webp', import.meta.url).href,
    full: new URL('./assets/worlds/full/sun.webp', import.meta.url).href,
  },
  mercury: {
    mini: new URL('./assets/worlds/mini/mercury.webp', import.meta.url).href,
    full: new URL('./assets/worlds/full/mercury.webp', import.meta.url).href,
  },
  venus: {
    mini: new URL('./assets/worlds/mini/venus.webp', import.meta.url).href,
    full: new URL('./assets/worlds/full/venus.webp', import.meta.url).href,
  },
  earth: {
    mini: new URL('./assets/worlds/mini/earth.webp', import.meta.url).href,
    full: new URL('./assets/worlds/full/earth.webp', import.meta.url).href,
  },
  moon: {
    mini: new URL('./assets/worlds/mini/moon.webp', import.meta.url).href,
    full: new URL('./assets/worlds/full/moon.webp', import.meta.url).href,
  },
  mars: {
    mini: new URL('./assets/worlds/mini/mars.webp', import.meta.url).href,
    full: new URL('./assets/worlds/full/mars.webp', import.meta.url).href,
  },
  jupiter: {
    mini: new URL('./assets/worlds/mini/jupiter.webp', import.meta.url).href,
    full: new URL('./assets/worlds/full/jupiter.webp', import.meta.url).href,
  },
  ganymede: {
    mini: new URL('./assets/worlds/mini/ganymede.webp', import.meta.url).href,
    full: new URL('./assets/worlds/full/ganymede.webp', import.meta.url).href,
  },
  saturn: {
    mini: new URL('./assets/worlds/mini/saturn.webp', import.meta.url).href,
    full: new URL('./assets/worlds/full/saturn.webp', import.meta.url).href,
  },
  uranus: {
    mini: new URL('./assets/worlds/mini/uranus.webp', import.meta.url).href,
    full: new URL('./assets/worlds/full/uranus.webp', import.meta.url).href,
  },
  neptune: {
    mini: new URL('./assets/worlds/mini/neptune.webp', import.meta.url).href,
    full: new URL('./assets/worlds/full/neptune.webp', import.meta.url).href,
  },
  pluto: {
    mini: new URL('./assets/worlds/mini/pluto.webp', import.meta.url).href,
    full: new URL('./assets/worlds/full/pluto.webp', import.meta.url).href,
  },
});

export function getWorldArt(id: string): WorldArt | undefined {
  return WORLD_ART[id];
}
