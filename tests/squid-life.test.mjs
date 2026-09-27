import assert from 'node:assert/strict';
import test from 'node:test';
import { beginSquidBreakout, headForSquidHole, enterSquidHole, releaseSquidTarget, updateSquidHoles } from '../src/squid-life.ts';
import { HOLE_OPEN_SECONDS, HOLE_FREEZE_SECONDS, SQUID_DIVE_SECONDS, SQUID_EMERGE_SECONDS, hammerStroke, iceHoleLook } from '../src/squid.ts';

const squid = () => ({ type: 'squid', holes: [], x: 5, direction: 1, state: 'idle', stateTimer: 0, visible: true });
function tick(ch, seconds) {
  ch.stateTimer += seconds;
  return updateSquidHoles(ch, seconds, () => 9);
}

test('squid breaks out, seals its exit, makes a fresh entrance, dives and breaks out elsewhere', () => {
  const ch = squid();
  beginSquidBreakout(ch);
  const first = ch.hole;
  assert.equal(ch.state, 'breaking');
  tick(ch, HOLE_OPEN_SECONDS - .01);
  assert.equal(ch.state, 'breaking');
  tick(ch, .02);
  assert.equal(ch.state, 'emerging');
  tick(ch, SQUID_EMERGE_SECONDS);
  assert.equal(ch.state, 'idle');
  assert.equal(first.phase, 'freezing');
  assert.equal(first.timer, 0, 'Freezing begins only once the squid clears the rim');
  assert.ok(Math.abs(ch.x - first.x) >= 1.2, 'Even the trailing tentacles land clear of the pool');
  tick(ch, HOLE_FREEZE_SECONDS);
  assert.equal(ch.holes.length, 0, 'The exit closes while the squid is on the surface');
  tick(ch, 30);
  assert.equal(ch.holes.length, 0, 'Holes never open by themselves');
  headForSquidHole(ch, 8);
  assert.equal(ch.holes.length, 0, 'Picking a destination does not open the ice');
  enterSquidHole(ch);
  const entrance = ch.hole;
  assert.equal(ch.state, 'hammering');
  assert.ok(Math.abs(ch.holeX) >= .8, 'The hammer strikes ahead of the feet');
  tick(ch, HOLE_OPEN_SECONDS - .01);
  assert.equal(ch.state, 'hammering', 'Cannot dive before hammering finishes');
  tick(ch, .02);
  assert.equal(ch.state, 'diving');
  tick(ch, SQUID_DIVE_SECONDS);
  assert.equal(ch.state, 'submerged');
  assert.equal(ch.x, 8);
  assert.equal(entrance.phase, 'freezing');
  assert.equal(entrance.timer, 0);
  tick(ch, 2);
  assert.equal(ch.x, 9);
  assert.equal(ch.state, 'breaking', 'Must hammer through fresh ice from below');
  assert.notEqual(ch.hole, entrance);
  tick(ch, HOLE_OPEN_SECONDS);
  assert.equal(ch.state, 'emerging');
  tick(ch, SQUID_EMERGE_SECONDS);
  assert.equal(ch.state, 'idle');
  assert.equal(ch.holes.length, 1, 'Previous entrance has frozen away');
  assert.equal(ch.holes[0].phase, 'freezing');
});

test('an interrupted surface swing abandons and seals the crack, never leaving an open orphan', () => {
  const ch = squid();
  headForSquidHole(ch, 7, 'running_away');
  enterSquidHole(ch);
  tick(ch, .6);
  releaseSquidTarget(ch);
  ch.state = 'startled'; ch.stateTimer = 0;
  assert.equal(ch.hole, null);
  assert.equal(ch.holeTarget, null);
  assert.equal(ch.holes[0].phase, 'freezing');
  tick(ch, HOLE_FREEZE_SECONDS);
  assert.equal(ch.holes.length, 0);
});

test('the three hammer impacts create cracks, with water only after the final blow', () => {
  for (const [t, cracks] of [[.34, 0], [.36, 1 / 3], [.86, 2 / 3], [1.36, 1]]) {
    const look = iceHoleLook({ phase: 'opening', timer: t });
    assert.equal(look.crack, cracks);
    assert.equal(hammerStroke(t).impact, t !== .34);
    if (t < 1.35) assert.equal(look.water, 0);
  }
  assert.equal(iceHoleLook({ phase: 'opening', timer: HOLE_OPEN_SECONDS }).water, 1);
});
