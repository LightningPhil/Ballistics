# Orrery surface artwork

Thirteen original equirectangular surface illustrations generated with the built-in imagegen tool on 2026-10-03: Sun, Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, Moon, Ganymede and Charon.

## Assets and resolution

Final assets live in `src/assets/orrery/`. Each body has a 512×256 overview WebP and a 2048×1024 close-up WebP. The generation tool returned 1774×887 originals; the 2K variants are Lanczos resamples, not additional measured surface detail. All packaged artwork is local and works in the standalone build.

Three.js uses sRGB albedo, anisotropic filtering and trilinear GPU mipmaps. Overview maps load when the Orrery opens. Close-up maps load when a visible body spans 96 physical pixels, remain active until it falls below 64 pixels, and release GPU storage after 15 seconds away. The original maps are illustrative, not spacecraft mosaics or accurate cartography. Planetary shading remains ambient/studio-lit.

`tools/orrery-texture-sources.json` records the complete generation prompts and original filenames. To re-export with Pillow, run `python tools/prepare-orrery-textures.py PATH_TO_GENERATED_ORIGINALS`. Only resampling and WebP encoding are performed by that script.

## Satellite motion

Moon, Ganymede and Charon use representative circular orbits with measured mean distances and periods from [JPL satellite mean elements](https://ssd.jpl.nasa.gov/sats/elem/) and diameters from [JPL physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/). Phases and orbital planes are illustrative; these are not date-accurate satellite ephemerides. Their surfaces rotate synchronously with the representative orbit. Normalised planet lanes reserve the complete moon system's footprint to retain clear gaps.
