import assert from 'node:assert/strict';
import test from 'node:test';
import { drawCrew } from '../src/crew.ts';
import { drawGiantSquid, drawIceHole, iceHoleLook, HOLE_FREEZE_SECONDS, HOLE_OPEN_SECONDS } from '../src/squid.ts';

const gradient = { addColorStop() {} };
function canvasSpy() {
  const calls = [];
  let depth = 0;
  const ctx = new Proxy({ globalAlpha: 1, lineWidth: 1 }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        calls.push([key, ...args]);
        for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${String(key)} has finite geometry`);
        if (key === 'arc') assert.ok(args[2] >= 0);
        if (key === 'ellipse') assert.ok(args[2] >= 0 && args[3] >= 0);
        if (key === 'save') depth++;
        if (key === 'restore') { depth--; assert.ok(depth >= 0, 'Artist cannot restore the caller’s state'); }
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return gradient;
      };
    },
    set(target, key, value) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(key)} must be finite`);
      calls.push(['set', key, value]);
      target[key] = value; return true;
    },
  });
  return { ctx, calls, get depth() { return depth; } };
}

const strokes = (calls, colour) => calls.some(([name, key, value]) => name === 'set' && key === 'strokeStyle' && value === colour);
const CLUB_SHAFT = '#c5ced0';
const TAPE = '#f2cf62';

test('viewing poses turn head and optics together, independently of the previous walking direction', () => {
  for (const type of ['golfer', 'spaceman', 'robot', 'icerobot', 'worker', 'alien']) {
    for (const yaw of [-1, 0, 1]) for (const elevation of [-.2, 0, .55, 1.05]) {
      const poses = [];
      for (const direction of [-1, 1]) {
        const h = canvasSpy();
        drawCrew(h.ctx, 0, 0, 100, Object.freeze({ type, state: 'watching', stateTimer: 0, direction,
          watchAim: Object.freeze({ yaw, elevation }) }));
        assert.equal(h.depth, 0);
        assert.ok(h.calls.some(([name, key, value]) => name === 'set' && key === 'fillStyle' && value === '#7fabb5'));
        poses.push(h.calls);
      }
      assert.deepEqual(poses[0], poses[1], `${type}'s optics follow the target, not the last step`);
    }
  }
});

test('every crew member draws every pose with finite, balanced artwork and no state changes', () => {
  for (const type of ['golfer', 'alien', 'spaceman', 'robot', 'icerobot', 'worker']) {
    for (const state of ['idle', 'walking', 'returning', 'running_away', 'running_to', 'waiting', 'inspecting', 'startled', 'rocket_startled', 'squashed',
      'carrying', 'screwing', 'celebrating', 'panicked']) {
      for (const reaction of [undefined, 'coast', 'apex', 'impact', 'escape', 'fizzle']) {
        for (const stateTimer of [0, .05, .3, 1.2, 13.7]) for (const direction of [-1, 1]) {
          const h = canvasSpy();
          const pose = Object.freeze({ type, state, reaction, stateTimer, direction, speed: 1.1 });
          drawCrew(h.ctx, 40, 90, 60, pose);
          assert.equal(h.depth, 0, `${type}/${state} restores its canvas state`);
          assert.ok(h.calls.some(([name]) => name === 'fill'), `${type}/${state} is painted`);
          assert.ok(!h.calls.some(([name]) => name === 'roundRect'), `${type}/${state} leaves no stray ink dots`);
        }
      }
    }
  }
});

test('the golfer puts his club away for binoculars, and reaction props wait until he stands still', () => {
  for (const state of ['idle', 'watching', 'walking', 'returning', 'running_away', 'startled', 'rocket_startled', 'squashed']) {
    for (const reaction of [undefined, 'coast', 'apex', 'impact', 'escape', 'fizzle']) {
      for (const stateTimer of [0, .2, .7, 3.3]) {
        const h = canvasSpy();
        drawCrew(h.ctx, 0, 0, 100, { type: 'golfer', state, reaction, stateTimer, direction: 1, speed: 1.1 });
        const binoculars = state === 'watching' || (state === 'idle' && reaction === 'apex');
        assert.equal(strokes(h.calls, CLUB_SHAFT), !binoculars, `golfer/${state}/${reaction} only puts the club away to watch`);
        const moving = ['walking', 'returning', 'running_away'].includes(state);
        if (moving || state === 'squashed' || state.includes('startled')) {
          assert.ok(!strokes(h.calls, TAPE), `golfer/${state}/${reaction} has no tape measure to trail`);
        }
      }
    }
  }
});

test('the crew walk and run side-on, showing one eye, and face out again when they stop', () => {
  const GLINT = '#fffdf2';
  const eyes = calls => calls.filter(([name, key, value]) => name === 'set' && key === 'fillStyle' && value === GLINT).length;
  for (const type of ['golfer', 'spaceman', 'worker']) {
    const draw = state => { const h = canvasSpy(); drawCrew(h.ctx, 0, 0, 100, { type, state, stateTimer: .3, direction: 1 }); return eyes(h.calls); };
    assert.equal(draw('idle'), 2, `${type} faces out while standing`);
    for (const state of ['walking', 'returning', 'running_away']) assert.equal(draw(state), 1, `${type}/${state} is in profile`);
  }
});

test('other crew still measure a landing with the tape while standing', () => {
  const h = canvasSpy();
  drawCrew(h.ctx, 0, 0, 100, { type: 'alien', state: 'idle', reaction: 'impact', stateTimer: 1, direction: 1 });
  assert.ok(strokes(h.calls, TAPE));
});

test('the two robots have distinct geometry, not just different paint, throughout their activities', () => {
  const geometry = (type, pose) => {
    const h=canvasSpy(); drawCrew(h.ctx,0,0,100,{type,direction:1,stateTimer:.8,...pose});
    return h.calls.filter(([name])=>['moveTo','lineTo','arcTo','ellipse','arc','bezierCurveTo','quadraticCurveTo'].includes(name));
  };
  for (const state of ['idle','walking','running_away','startled','squashed']) {
    assert.notDeepEqual(geometry('robot',{state}),geometry('icerobot',{state}),state);
  }
  for (const yaw of [-1,0,1]) {
    const pose={state:'watching',watchAim:{yaw,elevation:.6}};
    assert.notDeepEqual(geometry('robot',pose),geometry('icerobot',pose),`watching ${yaw}`);
  }
});

test('robot eye lamps follow the same front/profile orientation as their bodies', () => {
  for (const [type,colour] of [['robot','#df735e'],['icerobot','#a5cf7d']]) {
    for (const state of ['idle','startled','walking','returning','running_away']) {
      const h=canvasSpy(); drawCrew(h.ctx,0,0,100,{type,state,stateTimer:.8,direction:-1});
      const lamps=h.calls.filter(([name,key,value])=>name==='set'&&key==='fillStyle'&&value===colour).length;
      assert.equal(lamps,['idle','startled'].includes(state)?2:1,`${type}/${state}`);
    }
  }
});

test('a diving squid hops into a hole that stays put in the world', () => {
  for (const direction of [-1, 1]) {
    const h = canvasSpy();
    drawGiantSquid(h.ctx, 0, 0, 80, { type: 'squid', state: 'diving', stateTimer: .1, direction, holeX: .3 });
    const translates = h.calls.filter(([name]) => name === 'translate').map(([, x]) => x);
    assert.ok(translates.includes(.3 * 80 * direction), 'The hole is drawn at its own place, not under the squid');
    assert.equal(h.depth, 0);
  }
});

test('an ice hole cracks open, stays open, then freezes over and vanishes', () => {
  const look = (phase, timer) => iceHoleLook({ phase, timer });
  assert.deepEqual(look('opening', 0), { crack: 0, water: 0, skin: 0, burst: 0 });
  assert.equal(look('opening', HOLE_OPEN_SECONDS).water, 1);
  assert.deepEqual(look('open', 30), { crack: 0, water: 1, skin: 0, burst: 0 });
  assert.deepEqual(look('freezing', HOLE_FREEZE_SECONDS), { crack: 0, water: 0, skin: 0, burst: 0 });
  let water = 0, cover = 1;
  for (let i = 0; i <= 20; i++) {
    const opening = look('opening', HOLE_OPEN_SECONDS * i / 20);
    assert.ok(opening.water >= water, 'Water only spreads while the ice gives way');
    water = opening.water;
    const freezing = look('freezing', HOLE_FREEZE_SECONDS * i / 20);
    const left = Math.max(freezing.water, freezing.skin);
    assert.ok(left <= cover, 'A freezing hole only ever fades');
    cover = left;
  }
});

test('ice holes draw finite, balanced artwork in every phase and nothing once frozen over', () => {
  for (const phase of ['opening', 'open', 'freezing']) {
    for (const timer of [0, .3, .8, 1.2, 2.5, 4, 5, 9]) {
      for (const part of ['back', 'front']) {
        const h = canvasSpy();
        drawIceHole(h.ctx, part, { phase, timer, seed: 4 });
        assert.equal(h.depth, 0, `${phase}/${timer}/${part} restores its canvas state`);
      }
    }
  }
  for (const hole of [{ phase: 'opening', timer: 0 }, { phase: 'freezing', timer: HOLE_FREEZE_SECONDS }]) {
    const h = canvasSpy();
    drawIceHole(h.ctx, 'back', hole);
    assert.ok(!h.calls.some(([name]) => name === 'fill' || name === 'stroke'), `${hole.phase} leaves unbroken ice`);
  }
});
