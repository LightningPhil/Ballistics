import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseIdleLook, gazeAim, observationAim, beginRocketWatch, updateRocketWatch, clearRocketWatch, rocketWatchAim,
  ROCKET_STARTLE_SECONDS, ROCKET_FLEE_SECONDS } from '../src/crew-watch.ts';

const guest = () => ({ type: 'golfer', x: 8, speed: 1, state: 'idle', direction: -1, visible: true });
const rocket = { x: 0, y: 100 };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('walkers glance before occasionally raising optics, and keep watching flights; swimmers do not', () => {
  for (const type of ['golfer','spaceman','alien','robot','icerobot','snowman','icebear']) {
    const idleLook={sequence:2,side:-1,duration:10,opticsAt:6};
    for(const stateTimer of [0,1,3,5.9])assert.equal(observationAim({type,state:'idle',stateTimer,idleLook}),undefined);
    assert.deepEqual(gazeAim({type,state:'idle',stateTimer:1,idleLook}),{yaw:type==='icebear'?-1:0,elevation:0});
    assert.deepEqual(gazeAim({type,state:'idle',stateTimer:5,idleLook}),{yaw:-1,elevation:0});
    assert.ok(observationAim({type,state:'idle',stateTimer:6,idleLook}));
    const aim = {yaw:-1,elevation:.8};
    assert.deepEqual(observationAim({type,state:'watching',stateTimer:0,watchAim:aim}),aim);
    for (const state of ['running_away','running_to','inspecting','squashed']) assert.equal(observationAim({type,state,stateTimer:3,watchAim:aim}),undefined);
  }
  for (const type of ['whale','squid','newt']) for (const state of ['idle','watching']) {
    assert.equal(observationAim({type,state,stateTimer:8,reaction:'apex',watchAim:{yaw:1,elevation:.8},idleLook:{sequence:0,side:1,duration:10,opticsAt:0}}),undefined);
  }
  assert.ok(observationAim({type:'submarine',state:'hatch_peek',stateTimer:3}));
});

test('idle pauses support all four gaze sequences and some have no binoculars at all',()=>{
  const poses=[0,1,2,3].map(sequence=>[1,7].map(stateTimer=>gazeAim({type:'golfer',state:'idle',stateTimer,idleLook:{sequence,side:1,duration:10,opticsAt:Infinity}}).yaw));
  assert.deepEqual(poses,[[0,0],[1,1],[0,1],[1,0]]);
  assert.equal(chooseIdleLook(()=>.9).opticsAt,Infinity);
  assert.ok(chooseIdleLook(()=>.1).opticsAt>=5);
  const bear=t=>gazeAim({type:'icebear',state:'idle',stateTimer:t,idleLook:{sequence:2,side:1,duration:10,opticsAt:Infinity}}).yaw;
  assert.deepEqual([1,5,6,7,9].map(bear),[1,1,0,1,1],'Bear glances at the viewer briefly, then returns to its surroundings');
});

test('crew run away for ten presentation seconds before watching, then stay planted', () => {
  const ch = guest(); beginRocketWatch(ch, 1.5);
  updateRocketWatch(ch, ROCKET_STARTLE_SECONDS, rocket);
  assert.equal(ch.state, 'running_away'); near(ch.x, 8); near(ch.stateTimer, 0);
  updateRocketWatch(ch, ROCKET_FLEE_SECONDS - .01, rocket);
  assert.equal(ch.state, 'running_away'); assert.equal(ch.watchAim, undefined);
  updateRocketWatch(ch, .01, rocket);
  assert.equal(ch.state, 'watching'); near(ch.x, 43);
  assert.equal(ch.watchAim.yaw, -1); assert.equal(ch.visible, true);
  updateRocketWatch(ch, 20, { x: 100, y: 20 });
  near(ch.x, 43); assert.equal(ch.watchAim.yaw, 1);
});

test('timing is independent of frame size, and paused seeks change aim without advancing the run', () => {
  const a = guest(), b = guest(); beginRocketWatch(a, 1.5); beginRocketWatch(b, 1.5);
  updateRocketWatch(a, 12, rocket);
  for (let i = 0; i < 720; i++) updateRocketWatch(b, 1 / 60, rocket);
  near(a.x, b.x); assert.equal(a.state, b.state); near(a.stateTimer, b.stateTimer);
  const elapsed = a.rocketWatch.elapsed;
  updateRocketWatch(a, 60, { x: 200, y: 10 }, 0, true);
  near(a.rocketWatch.elapsed, elapsed); assert.equal(a.watchAim.yaw, 1);
  const c = guest(); beginRocketWatch(c, 20);
  updateRocketWatch(c, 5, rocket, 0, true);
  near(c.x, 8); assert.equal(c.state, 'rocket_startled');
});

test('impact, reset, replay and seeking into a recording do not leave stale optics or teleport the observer', () => {
  const ch = guest(); beginRocketWatch(ch, 1.5, true);
  updateRocketWatch(ch, 0, rocket, 0, true); near(ch.x, 8); assert.equal(ch.state, 'watching');
  assert.equal(updateRocketWatch(ch, 0, null), false);
  assert.equal(ch.state, 'idle'); assert.equal(ch.watchAim, undefined);
  beginRocketWatch(ch, 1.5); updateRocketWatch(ch, 3, rocket);
  clearRocketWatch(ch); assert.equal(ch.rocketWatch, undefined); assert.equal(ch.state, 'idle');
  beginRocketWatch(ch, 1.5); assert.equal(ch.state, 'rocket_startled'); near(ch.stateTimer, 0);
  ch.state = 'squashed'; updateRocketWatch(ch, 1, rocket); assert.equal(ch.state, 'squashed');
});

test('short flights end the run early, reduced motion still progresses, and non-observers keep their own behavior', () => {
  const ch = guest(); beginRocketWatch(ch, 1.5); updateRocketWatch(ch, 2, rocket);
  updateRocketWatch(ch, 0, null); assert.equal(ch.state, 'idle');
  beginRocketWatch(ch, 1.5); updateRocketWatch(ch, 12, rocket, 0, false, true);
  assert.equal(ch.state, 'watching'); assert.equal(ch.reducedMotion, true);
  for (const type of ['squid', 'whale', 'submarine', 'icebear', 'snowman', 'newt']) {
    const other = { ...guest(), type }; beginRocketWatch(other, 1.5);
    assert.equal(other.rocketWatch, undefined);
  }
});

test('optics follow both sides and altitude in the observer’s tangent plane', () => {
  assert.equal(rocketWatchAim(8, { x: -20, y: 30 }).yaw, -1);
  assert.equal(rocketWatchAim(8, { x: 20, y: 30 }).yaw, 1);
  assert.ok(rocketWatchAim(8, { x: 20, y: 100 }).elevation > rocketWatchAim(8, { x: 20, y: 2 }).elevation);
  assert.ok(rocketWatchAim(0, { x: Math.PI * 100, y: 10 }, 100).elevation < 0);
  const flat = rocketWatchAim(8, rocket), curved = rocketWatchAim(8, rocket, 6.371e6);
  near(flat.elevation, curved.elevation);
});
