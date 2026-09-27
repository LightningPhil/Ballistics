import test from 'node:test';
import assert from 'node:assert/strict';
import { SILLY_ACTIONS, cancelBusiness, createBusinessClock, updateBusiness } from '../src/character-business.ts';
const guest=(type='golfer')=>({type,state:'idle',stateTimer:2,direction:-1});
function tick(clock,ch,seconds,busy=false,random=()=>.5){for(let t=0;t<seconds-1e-8;t+=.1)updateBusiness(clock,ch,.1,busy,random);}

test('one shared clock fires within 30 seconds, then spaces opportunities 45–90 seconds apart',()=>{
  for(const random of [()=>0,()=>.5,()=>1]){
    const clock=createBusinessClock(random),ch=guest(),first=clock.remaining;
    assert.ok(first>0&&first<=30);tick(clock,ch,first+.1,false,random);
    assert.equal(ch.business.kind,'umbrella');assert.ok(clock.remaining>=44.9&&clock.remaining<=90);
    const next=clock.remaining;tick(clock,ch,9.1,false,random);
    assert.equal(ch.business,undefined);assert.equal(ch.state,'idle');assert.equal(ch.direction,-1);
    assert.ok(Math.abs(clock.remaining-(next-9.1))<1e-7,'The same clock continues through the performance');
  }
});

test('a delayed frame still advances the viewing-time schedule',()=>{
  const clock=createBusinessClock(()=>1),ch=guest();
  updateBusiness(clock,ch,29,false,()=>0);
  assert.equal(ch.business.kind,'umbrella');assert.equal(clock.remaining,45);
  updateBusiness(clock,ch,10,false);
  assert.equal(ch.business,undefined);assert.equal(clock.remaining,35);
});

test('launch cancels the current action immediately and skipped flight opportunities never queue',()=>{
  const clock=createBusinessClock(()=>0),ch=guest();tick(clock,ch,12.1);
  assert.ok(ch.business);const next=clock.remaining;cancelBusiness(clock);
  assert.equal(ch.business,undefined);assert.equal(ch.state,'idle');assert.equal(clock.remaining,next);
  clock.remaining=.1;updateBusiness(clock,ch,.2,true,()=>0);
  assert.equal(ch.business,undefined);assert.equal(clock.remaining,45);
  tick(clock,ch,10);assert.equal(ch.business,undefined);
  clock.remaining=.1;updateBusiness(clock,ch,.2,false);assert.ok(ch.business);
  updateBusiness(clock,ch,.1,true);assert.equal(ch.business,undefined);
});

test('world switches keep the single schedule, clear the old prop, and leave swimmers alone',()=>{
  const clock=createBusinessClock(()=>0),earth=guest(),mars=guest('alien');tick(clock,earth,12.1);
  const remaining=clock.remaining;updateBusiness(clock,mars,.1,false);
  assert.equal(earth.business,undefined);assert.equal(mars.business,undefined);
  assert.ok(Math.abs(clock.remaining-remaining+.1)<1e-8);
  for(const type of ['squid','submarine','whale']){
    const ch=guest(type),before={...ch};clock.remaining=0;updateBusiness(clock,ch,0,false);
    assert.deepEqual(ch,before);assert.equal(clock.active,undefined);
  }
  assert.equal(Object.keys(SILLY_ACTIONS).length,8);
  for(const [type,kind] of Object.entries(SILLY_ACTIONS)){
    const ch=guest(type);clock.remaining=0;updateBusiness(clock,ch,0,false);
    assert.equal(ch.business.kind,kind);cancelBusiness(clock);
  }
});
