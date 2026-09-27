import assert from 'node:assert/strict';
import test from 'node:test';
import { drawWhale, drawSubmarine } from '../src/aquatic-characters.ts';
import { drawNewt, drawSnowman } from '../src/planet-guests.ts';
import { drawGiantSquid } from '../src/squid.ts';
import { drawIceBear } from '../src/ice-bear.ts';
import { SILLY_ACTIONS } from '../src/character-business.ts';
import { drawCrew } from '../src/crew.ts';

const artists = { whale: drawWhale, submarine: drawSubmarine, newt: drawNewt, snowman: drawSnowman,
  icebear: drawIceBear, squid: drawGiantSquid };
function canvasSpy() {
  const calls = [];
  const saved = [];
  const ctx = new Proxy({ globalAlpha: 1, lineWidth: 1 }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        calls.push([key, ...args]);
        for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${String(key)} contains invalid geometry`);
        if (key === 'arc') assert.ok(args[2] >= 0);
        if (key === 'ellipse') assert.ok(args[2] >= 0 && args[3] >= 0);
        if (key === 'createRadialGradient') assert.ok(args[2] >= 0 && args[5] >= 0);
        if (key === 'createLinearGradient' || key === 'createRadialGradient') {
          const gradient = { kind: key, args, stops: [], addColorStop(offset, colour) {
            assert.ok(Number.isFinite(offset) && offset >= 0 && offset <= 1, 'Gradient stop is in range');
            assert.equal(typeof colour, 'string');
            gradient.stops.push([offset, colour]);
            calls.push(['addColorStop', offset, colour]);
          } };
          return gradient;
        }
        if (key === 'save') saved.push({ ...target });
        if (key === 'restore') {
          assert.ok(saved.length, 'Artist cannot restore the caller’s canvas state');
          for (const name of Object.keys(target)) delete target[name];
          Object.assign(target, saved.pop());
        }
      };
    },
    set(target, key, value) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(key)} must be finite`);
      if (key === 'globalAlpha') assert.ok(value >= 0 && value <= 1, 'Opacity must be valid');
      if (key === 'lineWidth') assert.ok(value > 0, 'Stroke width must be positive');
      calls.push(['set', key, value?.kind ? { kind: value.kind, args: value.args, stops: value.stops.slice() } : value]);
      target[key] = value; return true;
    },
  });
  return { ctx, calls, get depth() { return saved.length; } };
}

test('guest characters draw every field pose at natural world and portrait scales without mutating state', () => {
  for (const [type, draw] of Object.entries(artists)) {
    for (const state of ['idle', 'walking', 'returning', 'running_away', 'running_to', 'waiting', 'inspecting', 'startled', 'rocket_startled', 'squashed',
      'watching', 'cruising', 'surfacing', 'surfaced', 'spouting', 'breathing', 'hatch_peek', 'diving']) {
      for (const direction of [-1, 1]) for (const scale of [1e-8, 38, 80]) {
        const h = canvasSpy();
        const pose = { type, state, direction, stateTimer: 1.2, surfaceAmount: .7,
          reaction: 'apex', spoutParticles: [{ ox: .1, oy: -.5, life: .4 }] };
        const before = structuredClone(pose);
        draw(h.ctx, 100, 200, scale, pose);
        assert.equal(h.depth, 0, `${type} must restore its transformations and clipping`);
        assert.ok(h.calls.some(([name]) => name === 'fill'), `${type} is painted`);
        assert.deepEqual(pose, before, 'Artwork cannot alter simulation or animation state');
      }
    }
  }
});

test('surfacing activities add distinct whale and submarine performances', () => {
  for (const [type, draw, state] of [
    ['whale', drawWhale, 'breathing'],
    ['submarine', drawSubmarine, 'hatch_peek'],
  ]) {
    const idle = canvasSpy(), active = canvasSpy();
    const pose = { type, direction: 1, surfaceAmount: 1, stateTimer: 1 };
    draw(idle.ctx, 0, 0, 80, { ...pose, state: 'surfaced' });
    draw(active.ctx, 0, 0, 80, { ...pose, state });
    assert.notDeepEqual(active.calls, idle.calls);
  }
});

test('the submarine captain leaves the window empty while he is up in the hatch', () => {
  const UNIFORM = '#587e84';
  const fills = calls => calls.filter(([name, key]) => name === 'set' && key === 'fillStyle').map(([, , value]) => value);
  const pose = { type: 'submarine', direction: 1, surfaceAmount: 1, stateTimer: 1 };
  const surfaced = canvasSpy(), peeking = canvasSpy();
  drawSubmarine(surfaced.ctx, 0, 0, 80, { ...pose, state: 'surfaced' });
  drawSubmarine(peeking.ctx, 0, 0, 80, { ...pose, state: 'hatch_peek' });
  assert.ok(fills(surfaced.calls).includes(UNIFORM), 'The captain sits at the window');
  assert.ok(!fills(peeking.calls).includes(UNIFORM), 'Nobody is left at the window');
});

test('the ice bear walks and runs on all fours and preserves its separate frightened pose', () => {
  const draw = pose => { const h = canvasSpy(); drawIceBear(h.ctx, 0, 0, 80, { type: 'icebear', direction: 1, stateTimer: 1.2, ...pose }); return h; };
  for (const state of ['walking', 'returning', 'running_away']) {
    const plain = draw({ state }), stale = draw({ state, upright: true });
    assert.deepEqual(stale.calls, plain.calls, `${state} ignores any old two-legged flag`);
    assert.equal(plain.depth, 0);
  }
  assert.notDeepEqual(draw({ state: 'startled', stateTimer: .3 }).calls, draw({ state: 'walking', stateTimer: .3 }).calls);
});

test('the squid has distinct resting, slithering and startled poses', () => {
  const poses = ['idle', 'walking', 'startled'].map(state => {
    const h = canvasSpy();
    drawGiantSquid(h.ctx, 0, 0, 80, { type: 'squid', state, direction: 1, stateTimer: .2 });
    assert.equal(h.depth, 0);
    return h.calls;
  });
  for (let i = 0; i < poses.length; i++) for (let j = i + 1; j < poses.length; j++) {
    assert.notDeepEqual(poses[i], poses[j], 'Changes of activity are visible');
  }
});

test('new guests preserve finite, balanced, immutable artwork through their full gait and portrait poses', () => {
  for (const [type, draw] of [['icebear', drawIceBear], ['squid', drawGiantSquid]]) {
    for (const state of ['idle', 'walking', 'returning', 'running_away', 'startled', 'rocket_startled', 'squashed', 'celebrating', 'hammering', 'breaking', 'submerged', 'diving', 'emerging']) {
      for (const portrait of [false, true]) {
        for (const direction of [-1, 1]) for (const stateTimer of [0, .15, 1.2, 13.7]) {
          const h = canvasSpy();
          const pose = Object.freeze({ type, state, portrait, direction, stateTimer, reaction: 'escape' });
          const before = { ...pose };
          draw(h.ctx, -20, 60, 80, pose);
          assert.ok(h.calls.some(([name]) => name === 'fill'), `${type}/${state} remains painted`);
          assert.equal(h.depth, 0, `${type}/${state} restores canvas state`);
          assert.deepEqual(pose, before, 'Drawing cannot mutate the animation state');
        }
      }
    }
  }
});

test('guest portraits preserve activity, animation and facing instead of substituting idle', () => {
  for (const [type, draw] of Object.entries(artists)) {
    const pose = { type, state: 'idle', stateTimer: .3, direction: 1, portrait: true, surfaceAmount: .6 };
    const paint = extra => { const h = canvasSpy(); draw(h.ctx, 0, 0, 80, { ...pose, ...extra, surfaceAmount: ['breathing', 'hatch_peek'].includes(extra.state) ? 1 : pose.surfaceAmount }); return h.calls; };
    const idle = paint({});
    const states = type === 'whale' ? ['diving', 'breathing', 'startled', 'squashed']
      : type === 'submarine' ? ['diving', 'hatch_peek', 'startled', 'squashed']
      : ['walking', 'running_away', 'startled', 'squashed'];
    if (type === 'squid') states.push('hammering', 'diving', 'submerged', 'breaking', 'emerging');
    for (const state of states) {
      assert.notDeepEqual(paint({ state }), idle, type + '/' + state + ' shows its current activity');
      if (state !== 'squashed' || type !== 'snowman') {
        assert.notDeepEqual(paint({ state, direction: -1 }), paint({ state }), type + '/' + state + ' respects facing');
      }
    }
    assert.notDeepEqual(paint({ state: 'running_away', stateTimer: .7 }), paint({ state: 'running_away' }), type + ' keeps animating');
  }
});

test('guest binoculars follow left, right and front bearings in the field and portrait', () => {
  for (const type of ['snowman','icebear','submarine']) {
    const draw = artists[type];
    for (const portrait of [false,true]) for (const direction of [-1,1]) for (const yaw of [-1,0,1]) for (const elevation of [-.2,0,1.05]) {
      const h = canvasSpy();
      draw(h.ctx,0,0,80,Object.freeze({type,portrait,direction,state:'watching',stateTimer:1.5,surfaceAmount:1,watchAim:{yaw,elevation}}));
      assert.equal(h.depth,0);
      assert.ok(h.calls.some(([name,key,value]) => name === 'set' && key === 'fillStyle' && value === '#7fabb5'),`${type} visibly holds optics`);
    }
  }
  for(const state of ['idle','watching'])for(const portrait of [false,true]){
    const h=canvasSpy();
    drawNewt(h.ctx,0,0,80,{type:'newt',state,portrait,stateTimer:8,reaction:'apex',watchAim:{yaw:1,elevation:.8},idleLook:{sequence:0,side:1,duration:10,opticsAt:0}});
    assert.ok(!h.calls.some(([name,key,value])=>name==='set'&&key==='fillStyle'&&value==='#7fabb5'),'The newt never draws binoculars');
  }
});

test('all eight silly actions animate in field and close-up, remain finite, and restore canvas state',()=>{
  for(const [type,kind] of Object.entries(SILLY_ACTIONS)){
    const draw=artists[type]||drawCrew;
    for(const portrait of [false,true])for(const direction of [-1,1]){
      const frames=[];
      for(const elapsed of [0,.3,1.5,2.5,4,6.5,8.9]){
        const h=canvasSpy(),pose=Object.freeze({type,state:'business',stateTimer:elapsed,portrait,direction,business:Object.freeze({kind,elapsed,duration:kind==='blueprint'?11:9})});
        draw(h.ctx,0,0,80,pose);assert.equal(h.depth,0);frames.push(h.calls);
      }
      assert.notDeepEqual(frames[1],frames[4],`${kind} has a visible performance`);
      const still=elapsed=>{const h=canvasSpy();draw(h.ctx,0,0,80,{type,state:'business',portrait,direction,reducedMotion:true,business:{kind,elapsed,duration:9}});return h.calls;};
      assert.deepEqual(still(1),still(7),`${kind} respects reduced motion`);
    }
  }
});

test('reduced motion freezes decorative guest animation while keeping recognizable artwork', () => {
  for (const [type, draw] of Object.entries(artists)) {
    for (const state of ['idle', 'walking', 'running_away', 'startled', 'rocket_startled']) {
      for (const options of [{}, { portrait: true }]) {
      const pose = { type, state, direction: 1, surfaceAmount: 1, reducedMotion: true, spoutParticles: [], ...options };
      const first = canvasSpy(), later = canvasSpy();
      draw(first.ctx, 0, 0, 80, { ...pose, stateTimer: 1 });
      draw(later.ctx, 0, 0, 80, { ...pose, stateTimer: 10 });
      assert.deepEqual(later.calls, first.calls, `${type}/${state} should not animate when reduced motion is requested`);
      }
    }
  }
});
