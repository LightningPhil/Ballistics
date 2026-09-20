import type { Environment } from './environment.ts';

/** Shared lines must work on rocky, airless and imaginary worlds alike. */
export const GENERIC_REMARKS: readonly string[] = Object.freeze([
  'Gravity has notes.',
  'My calculations are mostly eyebrows.',
  "I brought a clipboard. We're fine.",
  'Results may contain enthusiasm.',
  'Professional at looking concerned.',
  'I have a very scientific hat.',
  'Can we expense the biscuits?',
  'Confidence: high. Evidence: pending.',
  'Plan B needs a bigger pencil.',
  'Looking busy is part of the method.',
]);

/** Planet jokes checked against NASA Science's planetary fact pages:
 * https://science.nasa.gov/solar-system/planets/ and https://science.nasa.gov/moon/facts/
 * Mercury and the Moon's exospheres cannot carry these audible sound jokes.
 * The giant planets lack a landable surface; they are not gas all the way down.
 */
export const PLANET_REMARKS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  earth: Object.freeze([
    "Fore! That's a technical term.",
    'Nice planet. Excellent biscuit supply.',
    'One small putt. One giant divot.',
    'Air carries sound. Sorry, neighbours.',
    'Nine point eight one. Home sweet home.',
  ]),
  moon: Object.freeze([
    'One small step. Quite a lot of bounce.',
    'My footprints are my autograph.',
    'Lovely craters. Terrible putting green.',
    'Sixth of the weight. Same-sized ego.',
    "No cheese. I've checked.",
  ]),
  mars: Object.freeze([
    'Red dust. Now in every pocket.',
    'Two moons. Terrible at sharing them.',
    'Rust is our signature colour.',
    'The rovers still owe me rent.',
    'Olympus Mons? Bit of a hill.',
  ]),
  mercury: Object.freeze([
    'Day shift: toast. Night shift: ice.',
    'Solar panels? Finally, a perk.',
    'Nearest the Sun. Still not hottest.',
    'Crater inspection: another crater.',
    'Long days. I bill by the hour.',
  ]),
  venus: Object.freeze([
    "Nice sauna. Where's the off switch?",
    'Lead melts here. My plans did too.',
    'Crushing pressure. Still no deadlines.',
    'Cloudy with a chance of more cloudy.',
    'Venus spins backwards. I respect that.',
  ]),
  jupiter: Object.freeze([
    "Great Red Spot. Won't wash out.",
    "No solid ground. I'll stay aboard.",
    'Clouds below. More clouds below those.',
    'Ten-hour days. Finally, short shifts.',
    'Big planet. Bigger personal space.',
  ]),
  saturn: Object.freeze([
    'Nice rings. Mine came in a cereal box.',
    'Parking on clouds. What could go wrong?',
    "Going deeper? I'll supervise from here.",
    'That hexagon is showing off.',
    'All these rings. Still no doorbell.',
  ]),
  uranus: Object.freeze([
    'Sideways planet. Upright attitude.',
    'Ice giant. Skating rink not included.',
    'No solid ground. Cancel the picnic.',
    'Even my circuits want a cardigan.',
    'Blue-green is my professional colour.',
  ]),
  neptune: Object.freeze([
    'Windy? My scarf has applied for orbit.',
    'No solid ground. Mind the gap.',
    'A 165-year wait for birthday cake.',
    'Ice giant. Bring your own snowman.',
    'The Sun looks a bit underqualified.',
  ]),
});

/** A full shuffled round before repeats, with no duplicate at round boundaries.
 * Changing worlds starts a fresh eligible round. All interpolated worlds share
 * the generic round so dragging the gravity slider does not restart it.
 */
export class CharacterRemarks {
  private world = '';
  private bag: string[] = [];
  private previous = '';
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  next(environment: Environment): string {
    const planetLines = !environment.interpolated && Object.prototype.hasOwnProperty.call(PLANET_REMARKS, environment.name)
      ? PLANET_REMARKS[environment.name] : undefined;
    const world = planetLines ? environment.name : 'generic';
    if (world !== this.world) {
      this.world = world;
      this.bag = [];
    }
    if (!this.bag.length) {
      this.bag = [...GENERIC_REMARKS, ...(planetLines ?? [])];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
      const last = this.bag.length - 1;
      if (this.bag[last] === this.previous) {
        [this.bag[0], this.bag[last]] = [this.bag[last], this.bag[0]];
      }
    }
    this.previous = this.bag.pop()!;
    return this.previous;
  }

  reset(): void {
    this.world = '';
    this.bag = [];
    this.previous = '';
  }
}

const LAUNCH_REMARKS = [
  "That's one way to deliver a biscuit.",
  'I meant a little demonstration.',
  'Excellent. The maths has left the room.',
];
const NOISY_LAUNCH_REMARK = 'Lovely boom. Terrible for my nerves.';

/** Launch reactions use the modelled atmosphere, including fictional worlds. */
export function launchRemark(environment: Environment, random: () => number = Math.random): string {
  const choices = environment.surfacePressure > 0
    ? [...LAUNCH_REMARKS, NOISY_LAUNCH_REMARK] : LAUNCH_REMARKS;
  return choices[Math.floor(random() * choices.length)];
}
