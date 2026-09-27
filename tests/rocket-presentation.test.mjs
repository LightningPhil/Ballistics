import test from 'node:test';
import assert from 'node:assert/strict';
import { rocketDisplay } from '../src/rocket-presentation.ts';
import { NozzleRender } from '../src/nozzle_render.ts';
const config={propMass:10,MR:3};
const burning=(time)=>({time,mPropInitial:10,mProp:10-time,mass:20-time,MR:3,mdot:1,thrustMagnitude:2000,engineOn:true,outcome:'flight'});

test('tank and flow share ignition, plateau, shutdown and exact recorded cutoff',()=>{
  const ready=rocketDisplay(null,config);assert.equal(ready.fraction,1);assert.equal(ready.output,0);assert.equal(ready.phase,'ready');
  const start=rocketDisplay(burning(0),config,'impact',10),rise=rocketDisplay(burning(.15),config,'impact',10);
  assert.equal(start.output,0);assert.equal(rise.phase,'ignition');assert.ok(rise.output>0&&rise.output<1);
  const mid=rocketDisplay(burning(5),config,'impact',10);assert.equal(mid.fraction,.5);assert.equal(mid.output,1);assert.equal(mid.oxidiserFraction,.75);
  const tail=rocketDisplay(burning(9.9),config,'impact',10);assert.equal(tail.phase,'cutoff');assert.ok(tail.output>0&&tail.output<1);
  const end=rocketDisplay({...burning(10),engineOn:false,mdot:0,thrustMagnitude:0},config,'impact',10);
  assert.equal(end.output,0);assert.equal(end.fraction,0);assert.match(end.label,/empty · coasting/);
  assert.deepEqual(rocketDisplay(burning(5),config,'impact',10),mid,'paused and replayed time is deterministic');
});

test('landing early or failing to lift off retains fuel; flights without a cutoff event still show flow',()=>{
  const landed=rocketDisplay({...burning(2),outcome:'impact'},config,'impact');
  assert.equal(landed.fraction,.8);assert.equal(landed.output,0);assert.equal(landed.phase,'landed');
  const failed=rocketDisplay(burning(0),config,'no-liftoff');assert.equal(failed.fraction,1);assert.equal(failed.output,0);
  assert.equal(rocketDisplay(burning(2),config,'escape').output,1);
  assert.equal(rocketDisplay(null,{propMass:0,MR:0}).fraction,0);
});

function drawNozzle(output,mdot,time){
  const calls=[],gradient={addColorStop(){}};
  const ctx=new Proxy({}, {get(target,key){return key in target?target[key]:(...args)=>{calls.push([key,...args]);if(String(key).includes('Gradient'))return gradient;};},set(target,key,value){target[key]=value;return true;}});
  NozzleRender.draw(ctx,1000,700,{mdot,output,worldTime:time,engineLabel:output?'Engine burning':'Tanks empty · coasting'});return calls;
}
test('nozzle with zero output has no throat glow or moving gas; paused flow is identical',()=>{
  const off=drawNozzle(0,0,8);assert.ok(!off.some(c=>c[0]==='arc'));assert.ok(!off.some(c=>c[0]==='createRadialGradient'));
  assert.ok(off.some(c=>c[0]==='fillText'&&c[1]==='Tanks empty · coasting'));
  assert.ok(!drawNozzle(1,0,8).some(c=>c[0]==='arc'),'zero flow cannot fall back to a positive default');
  const on=drawNozzle(1,5,4);assert.ok(on.some(c=>c[0]==='arc'));
  assert.deepEqual(drawNozzle(1,5,4),on);assert.notDeepEqual(drawNozzle(1,5,4.5),on);
});
