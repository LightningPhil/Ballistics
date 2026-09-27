import test from 'node:test';
import assert from 'node:assert/strict';
import { beginCrewFlight, clearCrewFlight, inspectLanding, updateCrewFlight } from '../src/crew-flight.ts';
const guest=(type='golfer',x=5)=>({type,x,speed:1,state:'idle',stateTimer:0,visible:true,direction:1});
const bounds={left:1,right:12},vehicle={x:30,y:50};
function tick(ch,seconds,target=vehicle,paused=false,reduced=false){for(let t=0;t<seconds-1e-8;t+=.02)updateCrewFlight(ch,.02,target,0,paused,reduced);}

test('all ground walkers flee immediately and stop within the scene for both launch types',()=>{
  for(const type of ['golfer','spaceman','alien','robot','icerobot','icebear','newt','snowman'])for(const mode of ['cannon','rocket']){
    const ch=guest(type);beginCrewFlight(ch,2,mode,bounds);assert.equal(ch.state,'running_away');
    tick(ch,4.9);assert.ok(ch.x<12&&ch.x>5);assert.equal(ch.state,'running_away');assert.equal(ch.watchAim,undefined);
    tick(ch,.1);assert.equal(ch.x,12);assert.equal(ch.visible,true);assert.equal(ch.state,'watching');
    assert.deepEqual(ch.watchTarget,vehicle);assert.equal(ch.watchAim.yaw,1);
    tick(ch,8,{x:-20,y:80});assert.equal(ch.x,12);assert.equal(ch.state,'watching');assert.equal(ch.watchAim.yaw,-1);
  }
  const left=guest('golfer',4);beginCrewFlight(left,8,'cannon',bounds);tick(left,5);assert.equal(left.x,1);assert.equal(left.direction,-1);
});

test('short flights get one extra second of retreat before approaching from either side',()=>{
  for(const mode of ['cannon','rocket'])for(const x of [-40,5,40,100000]){
    const ch=guest();beginCrewFlight(ch,2,mode,bounds);tick(ch,.2);inspectLanding(ch,{x,y:0},mode);
    assert.equal(ch.state,'running_away');tick(ch,.98,null);assert.equal(ch.state,'running_away');
    tick(ch,.02,null);assert.equal(ch.state,'running_to');tick(ch,5.2,null);assert.equal(ch.state,'inspecting');
    assert.ok(Math.abs(ch.x-x)<2);assert.equal(ch.direction,x>=ch.x?1:-1);assert.deepEqual(ch.inspectTarget,{x,y:0});
    const stopped=ch.x;tick(ch,3,null);assert.equal(ch.x,stopped);assert.equal(ch.state,'inspecting');
  }
});

test('retreat duration is min(5 seconds, flight time plus 1), including accelerated short playback',()=>{
  for(const duration of [.2,2,3.7,4,12]){
    const ch=guest();beginCrewFlight(ch,2,'cannon',bounds,false,duration);
    tick(ch,Math.min(duration,4.8));inspectLanding(ch,{x:30},'cannon');
    const expected=Math.min(5,duration+1);
    assert.ok(Math.abs(ch.flightReaction.fleeSeconds-expected)<1e-8);
    const remaining=expected-ch.flightReaction.elapsed;
    tick(ch,remaining+.02,null);assert.equal(ch.state,'running_to');assert.equal(ch.watchAim,undefined);
  }
  const fast=guest();beginCrewFlight(fast,2,'rocket',bounds,false,300);tick(fast,1.5);
  inspectLanding(fast,{x:100},'rocket');assert.ok(Math.abs(fast.flightReaction.fleeSeconds-2.5)<1e-8);
});

test('pause, reduced motion, reset and replay preserve the correct activity and remove stale targets',()=>{
  const ch=guest();beginCrewFlight(ch,2,'rocket',bounds);tick(ch,2,vehicle,true);assert.equal(ch.x,5);
  tick(ch,11,vehicle,false,true);assert.equal(ch.state,'watching');assert.equal(ch.reducedMotion,true);
  inspectLanding(ch,{x:50},'rocket');tick(ch,6,null);assert.equal(ch.state,'inspecting');
  clearCrewFlight(ch,true);assert.equal(ch.x,5);assert.equal(ch.state,'idle');assert.equal(ch.inspectTarget,undefined);assert.equal(ch.watchAim,undefined);
  beginCrewFlight(ch,2,'rocket',bounds,true);updateCrewFlight(ch,0,{x:-10,y:40},0,true);assert.equal(ch.state,'watching');assert.equal(ch.watchAim.yaw,-1);
  updateCrewFlight(ch,0,null);assert.equal(ch.state,'idle');assert.equal(ch.inspectTarget,undefined);
});

test('surface wrapping takes the near path, squashed visitors recover, swimmers keep their lifecycles',()=>{
  const ch=guest('icebear',0);beginCrewFlight(ch,2,'rocket',bounds);ch.state='squashed';ch.stateTimer=0;
  inspectLanding(ch,{x:200*Math.PI-10},'rocket',100);assert.ok(Math.abs(ch.flightReaction.stopX)<10);
  tick(ch,2,null,false,true);assert.equal(ch.state,'squashed');tick(ch,8,null,false,true);assert.equal(ch.state,'inspecting');
  for(const type of ['whale','submarine','squid']){const other=guest(type);beginCrewFlight(other,2,'cannon',bounds);inspectLanding(other,{x:40},'cannon');assert.equal(other.flightReaction,undefined);assert.equal(other.state,'idle');}
});
