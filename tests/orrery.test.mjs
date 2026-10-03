import test from 'node:test';
import assert from 'node:assert/strict';
import { solveKepler, positionFromElements, positionAt, displayPosition, diameterAt,
  WORLDS, NORMAL_RADII, NORMAL_GAP, footprint, advanceTime, DAY_MS, YEAR_DAYS,
  MIN_DATE, MAX_DATE, J2000 } from '../src/orrery-model.ts';

test('Kepler solver converges across eccentricities, epochs and wrap boundaries',()=>{
  for(const e of [0,.0167,.2056,.2488,.8])for(const m of [-10000,-Math.PI,-.001,0,.001,2,Math.PI,10000]){
    const E=solveKepler(m,e),residual=E-e*Math.sin(E)-m;
    assert.ok(Math.abs(Math.sin(residual))<1e-10);
    assert.ok(Math.cos(residual)>.999999999);
  }
});
test('Ellipses have the Sun at the focus and move faster at perihelion',()=>{
  const a=4,e=.25,orbit=[a,e,0,0,0,0];
  assert.equal(Math.hypot(...positionFromElements(orbit,0)),a*(1-e));
  assert.equal(Math.hypot(...positionFromElements(orbit,Math.PI)),a*(1+e));
  const velocity=m=>{
    const dt=1e-5;
    const before=positionFromElements(orbit,solveKepler(m-dt,e));
    const after=positionFromElements(orbit,solveKepler(m+dt,e));
    return Math.hypot(...after.map((v,i)=>v-before[i]))/(2*dt);
  };
  assert.ok(Math.abs(velocity(0)/velocity(Math.PI)-(1+e)/(1-e))<1e-8);
  const tilted=positionFromElements([1,0,90,0,0,0],Math.PI/2);
  assert.ok(Math.abs(tilted[2]-1)<1e-12,'inclination must lift the orbit out of the ecliptic');
});
test('J2000 Earth agrees with the heliocentric ecliptic reference and stays finite at supported bounds',()=>{
  const earth=WORLDS.find(w=>w.id==='earth');
  const p=positionAt(earth,J2000);
  // The long-term fit is less precise than the short-term J2000 reference.
  assert.ok(Math.abs(p[0]-(-.17717125))<.0001);
  assert.ok(Math.abs(p[1]-.96721448)<.0001);
  assert.ok(Math.abs(p[2])<.00001);
  for(const ms of [MIN_DATE,J2000,MAX_DATE])for(const world of WORLDS){
    const xyz=positionAt(world,ms);assert.ok(xyz.every(Number.isFinite));
    assert.ok(Math.hypot(...xyz)<51);
  }
  const mercury=WORLDS.find(w=>w.id==='mercury');
  const start=positionAt(mercury,J2000),after=positionAt(mercury,J2000+87.969*DAY_MS);
  assert.ok(Math.hypot(...start.map((v,i)=>v-after[i]))<.001,'Mercury completes its orbit in about 88 days');
});
test('Normalised lanes reserve equal edge gaps, including the full Saturn rings and belts',()=>{
  const ids=Object.keys(NORMAL_RADII);
  for(let i=1;i<ids.length;i++){
    const previous=ids[i-1],current=ids[i];
    const gap=NORMAL_RADII[current]-footprint(current)-NORMAL_RADII[previous]-footprint(previous);
    assert.ok(Math.abs(gap-NORMAL_GAP)<1e-12);
  }
  const earth=WORLDS.find(w=>w.id==='earth'),sun=WORLDS[0],jupiter=WORLDS.find(w=>w.id==='jupiter');
  assert.equal(diameterAt(sun,1)/diameterAt(earth,1),3);
  assert.equal(diameterAt(jupiter,1)/diameterAt(earth,1),2);
  assert.ok(Math.abs(diameterAt(earth,0)-.000085269)<1e-8,'physical diameter is in AU, not radius');
  for(const world of WORLDS.slice(1)){
    const real=positionAt(world,J2000),display=displayPosition(real,world.id,1);
    assert.ok(Math.abs(Math.hypot(...display)-NORMAL_RADII[world.id])<1e-10);
    const unrotated=[display[0],-display[2],display[1]],dot=real.reduce((n,v,i)=>n+v*unrotated[i],0);
    assert.ok(Math.abs(dot/(Math.hypot(...real)*Math.hypot(...display))-1)<1e-12,'normalisation preserves the orbital direction');
  }
});
test('One year per minute is independent of frame rate; reversing and date limits are exact',()=>{
  for(const hz of [30,60,144]){
    let time=J2000;
    for(let i=0;i<hz*60;i++)time=advanceTime(time,1/hz,1);
    assert.ok(Math.abs(time-J2000-YEAR_DAYS*DAY_MS)<2);
    assert.ok(Math.abs(advanceTime(time,60,-1)-J2000)<2);
  }
  assert.equal(advanceTime(MAX_DATE-1000,10,100),MAX_DATE);
  assert.equal(advanceTime(MIN_DATE+1000,10,-100),MIN_DATE);
  assert.equal(advanceTime(J2000,60,0),J2000);
});
