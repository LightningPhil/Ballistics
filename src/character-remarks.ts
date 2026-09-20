import type { Environment } from './environment.ts';
import { ROCKY_REMARKS } from './remarks/rocky-worlds.ts';
import { GIANT_REMARKS } from './remarks/giant-worlds.ts';

/** Fictional worlds need jokes that assume neither air nor a particular surface. */
export const GENERIC_REMARKS: readonly string[] = Object.freeze([
  'Gravity has notes.',
  'My ruler has trust issues.',
  'Certified to point at things.',
  'I put the guess in educated guess.',
  'My backup plan is a second eyebrow.',
  'The clipboard makes this official.',
  'I measure twice. Then blame the ruler.',
  'My hat is purely peer-reviewed.',
  'The graph and I need some time apart.',
  'I have questions. The pencil has left.',
  'Please initial all unexpected results.',
  'My notes now require their own notes.',
  'I brought confidence. Wrong size.',
  'The decimal point is doing its best.',
  'A lab coat would only slow the posing.',
  'My qualifications are in the wash.',
  'I can explain roughly half the arrows.',
  'I have a hunch. It needs calibrating.',
  'My optimism is not to scale.',
  'The units are judging me.',
  'I never round down a lunch break.',
  'My best theory is still in pencil.',
  'The margin is where I do my science.',
  'I have been promoted to onlooker.',
  'A bigger notebook counts as progress.',
  'I brought a spare hypothesis.',
  'My risk assessment has a doodle on it.',
  'The calculator wants a second opinion.',
  'I put a question mark on the answer.',
  'My estimates carry artistic licence.',
  'The appendix is mostly crossed fingers.',
  'I named the pencil Chief Engineer.',
  'The plan fits neatly under this cup.',
  'My serious face needs new batteries.',
  'I gave the unknowns temporary names.',
  'I am the control group. Please be kind.',
  'The evidence has requested more snacks.',
  'I keep my doubts in alphabetical order.',
  'Today I am assisting from over here.',
  'The tiny print says: ask someone else.',
  'I dress for the experiment I deserve.',
  'My flowchart has a trapdoor.',
  'This expression means I did the maths.',
  'The result needs a less smug font.',
  'My notes say: draw a better diagram.',
  'I have a certificate in holding this.',
  'The spare plan has gone for a walk.',
  'My calculator wants hazard pay.',
  'My conclusions are wearing slippers.',
  'The next page is where I become useful.',
]);

/** Fifty bespoke lines per character. Imaginary worlds use the generic deck.
 * Sound jokes belong to atmospheres; missing-ground jokes to the giant planets.
 * The giants have no landable surface, but are not gas all the way down.
 */
export const PLANET_REMARKS: Readonly<Record<string, readonly string[]>> =
  Object.freeze({ ...ROCKY_REMARKS, ...GIANT_REMARKS });

/** Event remarks are separate from idle chatter so their timing remains true. */
export const EVENT_REMARKS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  launch: Object.freeze([
    'An elaborate way to post a parcel.',
    'I meant a desk-sized demonstration.',
    'It has left its parking space.',
    'I hope we kept the receipt.',
    'There goes the expensive end.',
    'The engine makes a strong argument.',
  ]),
  apex: Object.freeze([
    'Gravity has called the lift back down.',
    'The upstairs bit is officially over.',
    'Top floor. No gift shop.',
    'Maximum altitude. Minimum shelf space.',
    'The ceiling inspection is complete.',
    'Up has run out of enthusiasm.',
    'Any higher needs another grant.',
    'Nice arc. Shame about the return policy.',
  ]),
  coast: Object.freeze([
    'I should have packed the big sandwich.',
    'My patience needs a larger unit.',
    'Even the clipboard looks impatient.',
    'I could knit a spare rocket by now.',
    'This wait deserves a commemorative mug.',
    'I have counted all my toes. Twice.',
  ]),
  burnout: Object.freeze([
    'Fuel has left the meeting.',
    'The engine has clocked off.',
    'We are now on the gravity tariff.',
    'The fuel gauge is doing minimalist art.',
    'Thrust has used all its annual leave.',
    'The tank is full of former fuel.',
  ]),
  impact: Object.freeze([
    'I am marking that under miscellaneous.',
    'The return journey lacked a handrail.',
    'The experiment has stopped travelling.',
    'I shall file the paperwork from here.',
    'The measuring tape has asked for backup.',
    'Precision delivered. Address approximate.',
  ]),
  escape: Object.freeze([
    'That deposit is not coming back.',
    'Return postage looks unreasonable.',
    'The tracking number just got longer.',
    'Our equipment has emigrated.',
    'A bold way to avoid the washing-up.',
    'I will mark that as remote working.',
  ]),
  orbit: Object.freeze([
    'We have invented the longest queue.',
    'Round trip. Very literal ticket.',
    'The scenic route is now a lifestyle.',
    'Our parcel is doing laps.',
    'We have misplaced the finish line.',
    'The parking meter is going to win.',
  ]),
  fizzle: Object.freeze([
    'The launch pad has retained its tenant.',
    'An ambitious way to stay here.',
    'A very committed ornament.',
    'Flight cancelled. Demonstration of here.',
    'The rocket has chosen local employment.',
    'More lift. Fewer souvenirs.',
  ]),
});

const NOISY_LAUNCH = Object.freeze([
  'The neighbours will be writing to us.',
  'That boom needs its own risk assessment.',
  'Indoor voice, please. Even out here.',
]);
const CLOUD_CONTACT = Object.freeze([
  'Clouds have declined to return it.',
  'Lost property is a long way down.',
  'The retrieval budget just evaporated.',
  'I am not diving after that receipt.',
]);
const SOLID_CONTACT = Object.freeze([
  'The landscape has a new dimple.',
  'Please rake the experiment.',
  'My shovel just resigned.',
  'That will need a bigger plant pot.',
]);

export function reactionPool(kind: string, environment: Environment): readonly string[] | undefined {
  if (!Object.prototype.hasOwnProperty.call(EVENT_REMARKS, kind)) return undefined;
  const lines = EVENT_REMARKS[kind];
  if (kind === 'launch' && environment.surfacePressure > 0) return [...lines, ...NOISY_LAUNCH];
  if (kind === 'impact' && !environment.interpolated) {
    return [...lines, ...(environment.isGas ? CLOUD_CONTACT : SOLID_CONTACT)];
  }
  return lines;
}

/** Each world and eligible event pool retains its own shuffled round, even
 * after visiting another world or replaying. Nothing repeats within a round.
 */
export class CharacterRemarks {
  private bags = new Map<string, string[]>();
  private lastByPool = new Map<string, string>();
  private previous = '';
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  next(environment: Environment): string {
    const lines = !environment.interpolated && Object.prototype.hasOwnProperty.call(PLANET_REMARKS, environment.name)
      ? PLANET_REMARKS[environment.name] : undefined;
    return this.draw(lines ? environment.name : 'generic', lines ?? GENERIC_REMARKS);
  }

  reaction(kind: string, environment: Environment): string | undefined {
    const lines = reactionPool(kind, environment);
    if (!lines) return undefined;
    const policy = kind === 'launch' ? (environment.surfacePressure > 0 ? 'air' : 'vacuum')
      : kind === 'impact' ? (environment.interpolated ? 'custom' : environment.isGas ? 'cloud' : 'solid') : 'any';
    return this.draw('event:' + kind + ':' + policy, lines);
  }

  reset(): void {
    this.bags.clear();
    this.lastByPool.clear();
    this.previous = '';
  }

  private draw(key: string, lines: readonly string[]): string {
    let bag = this.bags.get(key) ?? [];
    // A shared event line may just have been heard in another world's pool.
    if (bag.length === 1 && bag[0] === this.previous) bag = [];
    if (!bag.length) {
      bag = [...lines];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      this.bags.set(key, bag);
    }
    const last = bag.length - 1;
    const poolPrevious = this.lastByPool.get(key);
    if (bag[last] === this.previous || bag[last] === poolPrevious) {
      const replacement = bag.findIndex(line => line !== this.previous && line !== poolPrevious);
      if (replacement >= 0) [bag[replacement], bag[last]] = [bag[last], bag[replacement]];
    }
    this.previous = bag.pop()!;
    this.lastByPool.set(key, this.previous);
    return this.previous;
  }
}
