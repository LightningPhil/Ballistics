import test from 'node:test';
import assert from 'node:assert/strict';
import { NOZZLE_DEFAULTS as base, NOZZLE_PROPELLANTS, normaliseNozzle, nozzlePerformance as perf, optimiseNozzle, areaRatio, nozzleMach } from '../src/wiki/nozzle-model.ts';
import { NOZZLE_TOPICS } from '../src/wiki/nozzle-reading.ts';
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol*Math.max(1,Math.abs(b)),`${a} ≈ ${b}`);

test('nozzle flow conserves momentum and pressure thrust across all classroom limits',()=>{
  for(const propellant of Object.keys(NOZZLE_PROPELLANTS))for(const pressure of [10,78,207,350])for(const throat of [20,100,300])for(const expansion of [1,20,200])for(const ambient of ['air','vacuum']){
    const p=perf({...base,propellant,pressure,throat,expansion,ambient});
    for(const key of ['flow','thrust','isp','pe','exhaustSpeed','cStar'])assert.ok(Number.isFinite(p[key])&&p[key]>0,key);
    close(p.flow*p.cStar,p.pc*p.at);close(p.thrust,p.flow*p.exhaustSpeed+p.pressureThrust);close(p.isp,p.thrust/p.flow/9.80665);
    assert.ok(p.effectiveExpansion<=expansion+1e-9);
    if(p.separated){close(p.pe,.4*p.pa);assert.ok(p.effectiveExpansion<expansion);}
  }
});
test('diameter changes area, flow and thrust by its square, not exhaust speed',()=>{
  const a=perf(base),b=perf({...base,throat:base.throat*2});
  close(b.flow/a.flow,4);close(b.thrust/a.thrust,4);close(b.isp,a.isp);close(b.exhaustSpeed,a.exhaustSpeed);
  const c=perf({...base,ambient:'vacuum'}),d=perf({...base,ambient:'vacuum',pressure:200});close(d.flow/c.flow,2);close(d.thrust/c.thrust,2);close(d.isp,c.isp);
});
test('air auto finds the pressure match and best bounded model Isp; vacuum uses the upper bound',()=>{
  for(const propellant of Object.keys(NOZZLE_PROPELLANTS))for(const pressure of [10,100,350])for(const ambient of ['air','vacuum']){
    const before={...base,propellant,pressure,throat:73},auto=optimiseNozzle(before,ambient),best=perf(auto),prop=NOZZLE_PROPELLANTS[propellant];
    assert.equal(auto.pressure,before.pressure);assert.equal(auto.throat,73);assert.equal(auto.ambient,ambient);assert.equal(before.ambient,'air');
    if(ambient==='air')close(best.pe,best.pa);else assert.equal(auto.expansion,200);
    for(const mixture of [prop.min,prop.optimum,prop.max])for(const expansion of [1,5,10,20,50,100,200])assert.ok(perf({...auto,mixture,expansion}).isp<=best.isp+1e-7);
    assert.ok(perf({...auto,mixture:prop.min}).isp<best.isp);
  }
});
test('Mach/area branches and input limits remain finite and physically ordered',()=>{
  for(const gamma of [1.2,1.22])for(const area of [1,2,50,200]){
    const sup=nozzleMach(area,gamma),sub=nozzleMach(area,gamma,false);close(areaRatio(sup,gamma),area);close(areaRatio(sub,gamma),area);assert.ok(sub<=1&&sup>=1);
  }
  const s=normaliseNozzle({...base,pressure:999,throat:-2,expansion:NaN,mixture:Infinity});assert.equal(s.pressure,350);assert.equal(s.throat,20);assert.equal(s.expansion,20);assert.equal(s.mixture,3.5);
  assert.equal(normaliseNozzle({...base,propellant:'__proto__'}).propellant,'methane');
});
test('each advanced setting has three substantial distinct readings and a helpful tooltip',()=>{
  assert.equal(Object.keys(NOZZLE_TOPICS).length,5);
  for(const topic of Object.values(NOZZLE_TOPICS)){assert.equal(topic.levels.length,3);assert.equal(new Set(topic.levels.map(r=>r[0])).size,3);assert.ok(topic.tip.length>100);for(const reading of topic.levels)assert.ok(reading.slice(1).join(' ').length>200);}
});
