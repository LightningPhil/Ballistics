import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARGES, MATERIALS, CANNON_SCALES, simulateCannon, sampleCannon, timeAtTravel,
  pressureIndex, speedIndex, newCannonSession, cannonAction } from '../src/wiki/cannon-model.ts';
import { getArticle } from '../src/wiki/content.ts';

test('the classroom model balances released energy with gas, motion and losses',()=>{
  for(const charge of Object.keys(CHARGES)) for(const material of Object.keys(MATERIALS)) {
    const run=simulateCannon({charge,material});
    let x=0,v=0;
    for(const p of run.samples) {
      assert.ok(Object.values(p).every(Number.isFinite));
      assert.ok(p.travel>=x-1e-10 && p.speed>=v-1e-10,`${charge}/${material}: motion is forward`);
      assert.ok(p.pressure>=0&&p.gasEnergy>=0&&p.burned>=0&&p.burned<=1);
      if(p.time<=run.exit.time) {
        const accounted=.5*run.mass*p.speed**2+p.gasEnergy+p.heatLost+p.frictionWork;
        assert.ok(Math.abs(accounted-run.energy*p.burned)<2e-6,`${charge}/${material}: energy balance`);
      }
      x=p.travel;v=p.speed;
    }
    assert.equal(run.exit.travel,1);
    assert.ok(run.peak.time<run.exit.time&&run.peak.speed<run.exit.speed,'speed grows after pressure peaks');
    assert.ok(run.exit.pressure<run.peak.pressure);
    const after=sampleCannon(run,run.exit.time+.3);
    assert.equal(after.speed,run.exit.speed,'the model supplies no thrust after muzzle clearance');
    assert.ok(after.pressure<run.exit.pressure*.05,'remaining gas vents rapidly');
    assert.ok(run.endTime<=CANNON_SCALES.time);
    assert.ok(pressureIndex(run.peak.pressure)<100&&speedIndex(run.exit.speed)<100,'one fixed graph scale contains every preset');
  }
});

test('material and charge comparisons follow the intended physical relationships',()=>{
  for(const charge of Object.keys(CHARGES)) {
    const [stone,iron,lead]=['stone','iron','lead'].map(material=>simulateCannon({charge,material}));
    assert.ok(stone.exit.speed>iron.exit.speed&&iron.exit.speed>lead.exit.speed);
    assert.ok(stone.exit.time<iron.exit.time&&iron.exit.time<lead.exit.time);
    assert.ok(stone.peak.pressure<iron.peak.pressure,'early movement changes the available gas volume');
  }
  for(const material of Object.keys(MATERIALS)) {
    const [small,medium,large]=['small','medium','large'].map(charge=>simulateCannon({charge,material}));
    assert.ok(small.exit.speed<medium.exit.speed&&medium.exit.speed<large.exit.speed);
    assert.ok(small.peak.pressure<medium.peak.pressure&&medium.peak.pressure<large.peak.pressure);
  }
  assert.ok(CHARGES.small.length<CHARGES.medium.length&&CHARGES.medium.length<CHARGES.large.length);
});

test('integration converges and scrubbing stays on the same recorded solution',()=>{
  for(const material of Object.keys(MATERIALS)) {
    const options={charge:'large',material},normal=simulateCannon(options),fine=simulateCannon(options,.0005);
    assert.ok(Math.abs(normal.exit.speed-fine.exit.speed)<1e-5);
    assert.ok(Math.abs(normal.exit.time-fine.exit.time)<1e-5);
    for(const x of [0,.1,.25,.5,.9,1]) {
      const p=sampleCannon(normal,timeAtTravel(normal,x));
      assert.ok(Math.abs(p.travel-x)<1e-8,'travel-axis selection returns the matching time');
    }
    assert.equal(sampleCannon(normal,-1).travel,0);
    assert.equal(sampleCannon(normal,NaN).time,0);
    assert.equal(sampleCannon(normal,1e9).time,normal.endTime);
    assert.deepEqual(options,{charge:'large',material},'integration never mutates the controls');
  }
  for(const step of [NaN,0,-1,1]) assert.throws(()=>simulateCannon({charge:'small',material:'iron'},step));
});

test('exhibit controls follow a finite sequence and replay does not change the experiment',()=>{
  const original=newCannonSession();
  assert.equal(cannonAction(original,{type:'light'}).stage,'empty');
  assert.equal(cannonAction(original,{type:'ball'}).stage,'empty');
  let s=cannonAction(original,{type:'charge'});
  assert.equal(s.stage,'powder');assert.equal(original.stage,'empty');
  s=cannonAction(s,{type:'ball'});assert.equal(s.stage,'loaded');
  s=cannonAction(s,{type:'light'});assert.equal(s.stage,'fuse');assert.equal(s.playing,true);
  s=cannonAction(s,{type:'pause'});assert.equal(s.playing,false);
  s={...s,stage:'shot',time:2,fuse:1};
  const replay=cannonAction(s,{type:'replay'});
  assert.equal(replay.stage,'fuse');assert.equal(replay.time,0);assert.deepEqual(replay.options,s.options);
  const reset=cannonAction(s,{type:'reset'});
  assert.equal(reset.stage,'empty');assert.equal(reset.playing,false);assert.deepEqual(reset.previous,s.options);
});

test('all three cannon readings explain historical propellant and the model boundary',()=>{
  const article=getArticle('cannons');
  assert.ok(article.stats.some(([,value])=>value.includes('1200s')));
  assert.ok(article.sources.some(([label])=>label.includes('Royal Armouries')));
  assert.ok(article.sources.some(([label])=>label.includes('HARP')));
  assert.match(article.levels[0].paragraphs.join(' '),/gunpowder.*rapid burning.*heat.*gas/);
  assert.match(article.levels[1].paragraphs.join(' '),/Falling pressure does not mean falling speed/);
  assert.match(article.levels[2].paragraphs.join(' '),/invented classroom quantities/);
});
