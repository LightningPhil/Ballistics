import test from 'node:test';
import assert from 'node:assert/strict';
import { PROPELLANT_LOADS, PAYLOADS, BURN_RATES, EXHAUST_SPEED, ROCKET_SCALES, ROCKET_PLOTS, simulateRocket, sampleRocket, timeAtPropellantUsed, rocketIndex, newRocketSession, rocketAction } from '../src/wiki/rocket-model.ts';
import { getArticle } from '../src/wiki/content.ts';
const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≈ ${b}`);

test('all classroom rocket presets conserve propellant and coast after exact cutoff',()=>{
  for(const propellant of Object.keys(PROPELLANT_LOADS))for(const payload of Object.keys(PAYLOADS))for(const burn of Object.keys(BURN_RATES)){
    const run=simulateRocket({propellant,payload,burn});let mass=run.startMass,speed=0,distance=0;
    for(const p of run.samples){
      assert.ok(Object.values(p).every(Number.isFinite));
      assert.ok(p.mass<=mass+1e-10&&p.mass>=run.dryMass-1e-10);
      assert.ok(p.speed>=speed-1e-10&&p.distance>=distance-1e-10);
      close(p.mass,run.dryMass+p.remaining);close(p.remaining+run.propellant*p.used,run.propellant);
      for(const q of ['pressure','speed','mass','thrust','acceleration'])assert.ok(rocketIndex(q,p[q])>=0&&rocketIndex(q,p[q])<100);
      if(p.time>=run.burnTime){close(p.flow,0);close(p.thrust,0);close(p.acceleration,0);close(p.speed,run.cutoff.speed);}
      mass=p.mass;speed=p.speed;distance=p.distance;
    }
    close(run.cutoff.remaining,0);close(run.cutoff.mass,run.dryMass);
    close(run.cutoff.speed,EXHAUST_SPEED*Math.log(run.startMass/run.dryMass));
    close(run.samples.at(-1).distance-run.cutoff.distance,run.cutoff.speed*(run.endTime-run.burnTime),1e-7);
    assert.ok(run.endTime<=ROCKET_SCALES.time);
  }
});

test('momentum accounting and changing-mass acceleration agree with the rocket solution',()=>{
  const run=simulateRocket({propellant:'large',payload:'light',burn:'brisk'});
  let exhaustMomentum=0;
  for(let i=1;i<run.samples.length;i++){
    const a=run.samples[i-1],b=run.samples[i],mid=sampleRocket(run,(a.time+b.time)/2);
    const flux=p=>p.flow*(p.speed-EXHAUST_SPEED);
    exhaustMomentum+=(b.time-a.time)*(flux(a)+4*flux(mid)+flux(b))/6;
  }
  close(run.dryMass*run.cutoff.speed+exhaustMomentum,0,1e-6);
  for(const fraction of [.03,.2,.5,.8,.96]){
    const t=run.burnTime*fraction,h=1e-5,p=sampleRocket(run,t),before=sampleRocket(run,t-h),after=sampleRocket(run,t+h);
    close((after.mass-before.mass)/(2*h),-p.flow,1e-7);
    close((after.speed-before.speed)/(2*h),p.acceleration,1e-7);
    close(p.thrust/p.mass,p.acceleration);
  }
});

test('more thrust changes burn duration, while equal mass ratios give equal ideal final speeds',()=>{
  const runs=['gentle','steady','brisk'].map(burn=>simulateRocket({propellant:'medium',payload:'medium',burn}));
  assert.ok(runs[0].burnTime>runs[1].burnTime&&runs[1].burnTime>runs[2].burnTime);
  for(const run of runs)close(run.cutoff.speed,runs[0].cutoff.speed);
  const run=runs[1],early=sampleRocket(run,run.burnTime*.25),late=sampleRocket(run,run.burnTime*.75);
  close(early.thrust,late.thrust);close(early.pressure,late.pressure);
  assert.ok(late.acceleration>early.acceleration&&late.mass<early.mass);
  const velocities=Object.keys(PAYLOADS).map(payload=>simulateRocket({propellant:'medium',payload,burn:'steady'}).cutoff.speed);
  assert.ok(velocities[0]>velocities[1]&&velocities[1]>velocities[2]);
  const loads=Object.keys(PROPELLANT_LOADS).map(propellant=>simulateRocket({propellant,payload:'medium',burn:'steady'}).cutoff.speed);
  assert.ok(loads[0]<loads[1]&&loads[1]<loads[2]);
});

test('scrubbing and propellant-axis inversion stay on the same continuous trajectory',()=>{
  const opts={propellant:'large',payload:'heavy',burn:'gentle'},run=simulateRocket(opts),fine=simulateRocket(opts,.005);
  close(run.cutoff.distance,fine.cutoff.distance,1e-7);
  for(const used of [0,.001,.1,.5,.9,.999,1])close(sampleRocket(run,timeAtPropellantUsed(run,used)).used,used,1e-10);
  close(sampleRocket(run,NaN).time,0);close(sampleRocket(run,-10).time,0);close(sampleRocket(run,1e6).time,run.endTime);
  close(timeAtPropellantUsed(run,1),run.burnTime);close(timeAtPropellantUsed(run,NaN),0);
  for(const step of [NaN,0,-1,1])assert.throws(()=>simulateRocket(opts,step));
  assert.deepEqual(opts,{propellant:'large',payload:'heavy',burn:'gentle'});
  assert.equal(Object.keys(ROCKET_PLOTS).length,3);
});

test('rocket loading, countdown, replay and reset preserve choices without skipping prerequisites',()=>{
  const original=newRocketSession();
  for(const type of ['fill','ignite','replay'])assert.equal(rocketAction(original,{type}).stage,'empty');
  let s=rocketAction(original,{type:'payload'});assert.equal(s.stage,'payload');assert.equal(original.stage,'empty');
  s=rocketAction(s,{type:'fill'});assert.equal(s.stage,'ready');
  s=rocketAction(s,{type:'ignite'});assert.equal(s.stage,'countdown');assert.equal(s.playing,true);
  s=rocketAction(s,{type:'pause'});assert.equal(s.playing,false);
  s={...s,stage:'flight',time:4,countdown:1};
  const replay=rocketAction(s,{type:'replay'});assert.equal(replay.stage,'countdown');assert.equal(replay.time,0);assert.deepEqual(replay.options,s.options);
  const reset=rocketAction(s,{type:'reset'});assert.equal(reset.stage,'empty');assert.equal(reset.playing,false);assert.deepEqual(reset.previous,s.options);
});

test('rocket reading levels connect history, vacuum thrust and the limits of the exhibit',()=>{
  const article=getArticle('rockets');
  assert.match(article.levels[0].paragraphs.join(' '),/Goddard.*1926|1926.*Goddard/);
  assert.match(article.levels[0].paragraphs.join(' '),/oxidiser.*vacuum/);
  assert.match(article.levels[1].paragraphs.join(' '),/same final velocity change/);
  assert.match(article.levels[2].paragraphs.join(' '),/invented classroom quantities/);
  assert.ok(article.sources.some(([title])=>title.includes('Sputnik')));
});
