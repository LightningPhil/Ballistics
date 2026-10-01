import './cannon-exhibit.css';
import './rocket-exhibit.css';
import { installChartScrubbing } from './chart-scrubbing.ts';
import { exhibitFocus } from './exhibit-focus.ts';
import { ExhibitAudio } from './exhibit-audio.ts';
import { nozzleLabMarkup, mountNozzleLab } from './nozzle-lab.ts';
import { control, setControl, stepButton, markSteps, exhibitCue } from './exhibit-controls.ts';
import { PROPELLANT_LOADS, PAYLOADS, BURN_RATES, ROCKET_SCALES, ROCKET_PLOTS, simulateRocket, sampleRocket, timeAtPropellantUsed, rocketIndex, newRocketSession, rocketAction,
  type RocketRun, type RocketSession, type RocketOptions, type RocketAction, type RocketQuantity, type RocketAxis, type RocketPlot, type RocketStage } from './rocket-model.ts';

const LOADING:RocketStage[]=['empty','payload','ready'];
const clamp=(n:number)=>Math.max(0,Math.min(1,n)),num=(n:number)=>n.toFixed(1);
const graph={left:58,top:30,width:784,height:162};
const options=(items:Record<string,{name:string}>,selected:string)=>Object.entries(items).map(([id,v])=>`<option value="${id}" ${id===selected?'selected':''}>${v.name}</option>`).join('');

export function rocketExhibitMarkup() {
  return `<section class="cannon-history" aria-label="A little rocket history"><p class="atlas-kicker">A LONG JOURNEY TO SPACE</p><h2>From fire-arrows to scientific spacecraft.</h2>
    <p>Rockets began centuries before spaceflight, in medieval China. Early examples used burning gunpowder. Much later, liquid-propellant engines became an important part of scientific spaceflight. Every rocket carries its means of propulsion along with it.</p>
    <ol><li><strong>Medieval China</strong><span>Early gunpowder rockets</span></li><li><strong>16 March 1926</strong><span>Goddard’s first liquid-propellant flight</span></li><li><strong>4 October 1957</strong><span>Sputnik 1, the first artificial satellite</span></li></ol>
    <p class="cannon-history-note">Rocket history includes warfare as well as discovery. This exhibit focuses on the science that lets us send instruments, telescopes and people into space. The cutaway below is a modern schematic, not Goddard’s original rocket.</p></section>
  <section class="cannon-exhibit rocket-exhibit" aria-label="Interactive rocket cutaway">
    <header><div><p class="atlas-kicker">THE ENGINE COMES ALONG</p><h2>A push that travels with you.</h2></div><button type="button" data-focus class="cannon-focus-button">${control('expand','Expand experiment')}</button></header>
    <p class="cannon-question"><span class="cannon-question-mark" aria-hidden="true">?</span><span><small>A QUESTION TO INVESTIGATE</small>Can a steady push produce more acceleration as the journey continues?</span></p>
    <div class="cannon-lab-grid"><div class="cannon-demo-panel"><div class="cannon-workbench"><div class="cannon-visual">
      <svg class="rocket-scene" viewBox="0 0 1100 390" role="img" aria-labelledby="rocket-scene-title rocket-scene-desc"><title id="rocket-scene-title">A liquid-propellant rocket in cutaway</title><desc id="rocket-scene-desc">Two tanks feed a chamber and nozzle. The payload travels in the nose.</desc>
      <defs><linearGradient id="rocket-shell" x2="0" y2="1"><stop stop-color="#faf4da"/><stop offset=".4" stop-color="#c5d6cd"/><stop offset="1" stop-color="#6e9295"/></linearGradient><linearGradient id="rocket-copper" x2="0" y2="1"><stop stop-color="#e7b274"/><stop offset=".5" stop-color="#b97751"/><stop offset="1" stop-color="#714a3d"/></linearGradient><linearGradient id="rocket-plume"><stop stop-color="#8acbd4" stop-opacity="0"/><stop offset=".55" stop-color="#f0bd7c" stop-opacity=".5"/><stop offset="1" stop-color="#fff5ca"/></linearGradient><clipPath id="rocket-fuel-clip"><rect x="374" y="145" width="282" height="53" rx="14"/></clipPath><clipPath id="rocket-oxidiser-clip"><rect x="374" y="231" width="282" height="53" rx="14"/></clipPath></defs>
      <g data-stars></g><text class="rocket-scene-note" x="25" y="28">FREE-SPACE EXPERIMENT · NO AIR · EXTERNAL GRAVITY OMITTED</text>
      <g data-rocket-rig><path d="M314 121L348 82H391L421 121M314 307L348 346H391L421 307" fill="url(#rocket-copper)" stroke="#cfac7c" stroke-width="3"/>
      <path d="M286 118H724Q826 130 891 214Q826 298 724 310H286Z" fill="url(#rocket-shell)" stroke="#b2cec5" stroke-width="4"/>
      <path d="M707 123V305M730 129V299" stroke="#b67651" stroke-width="7"/><path d="M317 127H661Q677 127 677 146V282Q677 301 661 301H317Z" fill="#17343d" stroke="#ebdfb6" stroke-width="3"/>
      <path d="M374 171H345V194H324M374 257H345V236H324" fill="none" stroke="#44616a" stroke-width="12"/><g data-rocket-flow></g>
      <rect x="374" y="145" width="282" height="53" rx="14" fill="#253e43" stroke="#d5aa72" stroke-width="3"/><rect x="374" y="231" width="282" height="53" rx="14" fill="#253e43" stroke="#8bc7c1" stroke-width="3"/>
      <g data-rocket-tanks></g><path d="M265 177H310Q332 177 332 198V230Q332 251 310 251H265Z" fill="url(#rocket-copper)" stroke="#e1bf8b" stroke-width="4"/>
      <path d="M272 185H308Q321 185 321 199V229Q321 243 308 243H272Z" fill="#162e38"/><g data-rocket-chamber></g>
      <path d="M271 193L245 204L217 194L178 172V256L217 234L245 224L271 235Z" fill="url(#rocket-copper)" stroke="#d4b283" stroke-width="3"/><path d="M269 202L245 211L215 205L178 184V244L215 224L245 217L269 226" fill="#223d49"/>
      <circle cx="771" cy="214" r="54" fill="#214650" stroke="#eee3bd" stroke-width="5"/><g data-rocket-payload></g>
      <g data-rocket-plume></g><g data-rocket-arrows></g></g>
      <g class="rocket-labels"><text x="251" y="71">Chamber</text><path d="M291 80L299 175"/><text x="477" y="92">Fuel</text><path d="M494 99V141"/><text x="462" y="349">Oxidiser</text><path d="M492 333V288"/><text x="780" y="92">Payload</text><path d="M807 100L793 157"/><text x="84" y="306">Nozzle</text><path d="M139 296L189 260"/></g>
      <text class="rocket-scene-note" x="25" y="382">Camera follows the vehicle · distances, tank sizes and colours are illustrative</text><g data-rocket-countdown></g></svg>
      <p class="cannon-stage-caption" data-rocket-caption role="status" aria-live="polite"></p>
      <div class="cannon-readouts"><div><span data-first-label>Pressure index</span><strong data-first>—</strong></div><div><span data-second-label>Speed index</span><strong data-second>—</strong></div><div><span>Propellant left</span><strong data-remaining>—</strong></div></div>
    </div><aside class="cannon-controls" aria-label="Rocket experiment choices">
      <label>Payload<select data-payload>${options(PAYLOADS,'medium')}</select></label><label>Propellant amount<select data-propellant>${options(PROPELLANT_LOADS,'medium')}</select></label><label class="rocket-burn-choice">Burn rate<select data-burn>${options(BURN_RATES,'steady')}</select></label><p>Fixed engine. Invented classroom presets.</p>
      <ol class="cannon-loading">${stepButton('data-rocket-action','payload',1,'Add payload')}${stepButton('data-rocket-action','fill',2,'Fill tanks')}${stepButton('data-rocket-action','ignite',3,'Ignite engine')}</ol>
      <button type="button" data-rocket-action="reset" class="cannon-new">${control('reset','Reset Experiment')}</button><div class="exhibit-sound-controls"><button type="button" data-rocket-sound class="cannon-sound" aria-pressed="false">${control('soundOff','Sound off')}</button><p data-audio-status role="status">Optional, quiet classroom sound effects.</p></div>
    </aside></div><div class="cannon-playback"><button type="button" data-rocket-play disabled>${control('play','Play')}</button><button type="button" data-rocket-action="replay" disabled>${control('replay','Replay')}</button><button type="button" data-rocket-next disabled>${control('next','Next moment')}</button><label class="cannon-scrubber">Inspect the burn<input type="range" min="0" max="1000" step="1" value="0" data-rocket-scrub disabled aria-label="Inspect rocket experiment"></label></div>
    </div><div class="cannon-plot"><div class="cannon-chart-heading"><div><h3>Thrust, mass and motion</h3><div class="cannon-chart-legend"><span><i></i><b data-first-legend>Pressure</b></span><span><i></i><b data-second-legend>Speed</b></span></div></div></div>
    <div class="rocket-plot-choices"><label>Curves<select data-rocket-plot>${options(ROCKET_PLOTS,'pressure-speed')}</select></label><label>Plot against<select data-rocket-axis><option value="time">Time</option><option value="used">Propellant used</option></select></label></div>
    <svg class="cannon-chart rocket-chart" viewBox="0 0 900 270" role="img" aria-labelledby="rocket-chart-title rocket-chart-desc"><title id="rocket-chart-title">The rocket’s changing pressure and motion</title><desc id="rocket-chart-desc">Fixed relative scales let you compare experiments.</desc><g data-rocket-chart-static></g><g data-rocket-chart-live></g></svg><p class="cannon-comparison" data-rocket-comparison></p>
    </div></div><p class="cannon-model-note">Slow-motion model · a free-space engine demonstration, not an Earth launch. Each quantity has its own fixed relative scale. Model time and presets are illustrative.</p>
    <details class="cannon-model-details"><summary>What does this model include?</summary><p>Mass leaves with a fixed effective exhaust speed. Thrust follows the outgoing mass flow, acceleration uses the remaining total mass, and speed follows the ideal rocket equation. Chamber pressure is a simplified proxy for flow through a fixed nozzle under fixed gas conditions. Startup and shutdown are smoothed.</p><p>Gravity, air resistance, steering, staging, detailed combustion and real engine data are omitted. Fuel and oxidiser are shown separately but their proportions and colours are illustrative. The camera follows the rocket; star drift is a visual cue, not a distance scale. Optional sound is an explanatory effect—sound cannot travel through a vacuum.</p></details>
    ${nozzleLabMarkup()}
  </section><aside class="cannon-space-note"><span aria-hidden="true">↗</span><div><p class="atlas-kicker">BEYOND THIS ONE ENGINE</p><h3>High up is not the same as in orbit.</h3><p>Orbit needs enough sideways speed for a spacecraft to keep falling around Earth. Real launch vehicles must also contend with gravity and air resistance. Many discard empty stages so later engines have less mass to accelerate. In this experiment we isolate one engine in free space, making its exchange of momentum easier to see.</p></div></aside>`;
}

function xAt(run:RocketRun,time:number,axis:RocketAxis){return graph.left+graph.width*(axis==='time'?time/ROCKET_SCALES.time:sampleRocket(run,time).used);}
function curve(run:RocketRun,axis:RocketAxis,quantity:RocketQuantity,until=run.endTime){
  const points=run.samples.filter((p,i)=>p.time<until&&(i%4===0||p===run.cutoff||p===run.peakAcceleration));points.push(sampleRocket(run,until));
  return points.map((p,i)=>`${i?'L':'M'}${num(graph.left+graph.width*(axis==='time'?p.time/ROCKET_SCALES.time:p.used))} ${num(graph.top+(1-rocketIndex(quantity,p[quantity])/100)*graph.height)}`).join('');
}
function chartMarkup(run:RocketRun,s:RocketSession,previous?:RocketRun){
  const plot=ROCKET_PLOTS[s.plot],cutoff=xAt(run,run.burnTime,s.axis);
  return `${[0,25,50,75,100].map(n=>{const y=graph.top+(1-n/100)*graph.height;return `<path d="M58 ${y}H842" class="cannon-grid"/><text x="45" y="${y+4}" text-anchor="end">${n}</text><text x="855" y="${y+4}">${n}</text>`;}).join('')}
    <text x="58" y="22" class="cannon-pressure-text">${plot.labels[0]} index</text><text x="842" y="22" text-anchor="end" class="cannon-speed-text">${plot.labels[1]} index</text>
    ${[0,.25,.5,.75,1].map(f=>`<text x="${58+f*784}" y="221" text-anchor="middle">${s.axis==='time'?f*ROCKET_SCALES.time:f*100+'%'}</text>`).join('')}<text x="450" y="260" text-anchor="middle">${s.axis==='time'?'Elapsed model time · illustrative units':'Proportion of loaded propellant used'}</text>
    ${previous?`<g class="cannon-previous">${plot.quantities.map((q,i)=>`<path d="${curve(previous,s.axis,q)}" class="cannon-${i?'speed':'pressure'}-curve"/>`).join('')}</g>`:''}
    <path data-rocket-curve="0" class="cannon-pressure-curve"/><path data-rocket-curve="1" class="cannon-speed-curve"/><g data-cutoff-marker visibility="hidden"><path d="M${cutoff} 30V192" class="cannon-event-line"/><text x="${cutoff-6}" y="179" text-anchor="end">Cutoff</text></g>`;
}

export function mountRocketExhibit(root:HTMLElement,saved?:RocketSession){
  let s=saved?{...saved,options:{...saved.options},playing:false}:newRocketSession();
  let run=simulateRocket(s.options),previous=s.previous?simulateRocket(s.previous):undefined;
  let frame=0,last=0,disposed=false,lastCaption='';
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches,abort=new AbortController(),signal=abort.signal;
  const find=<T extends Element=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  const audio=new ExhibitAudio(message=>{find('[data-audio-status]').textContent=message;});
  if(s.sound)find('[data-audio-status]').textContent='Sound selected. Press Play to activate audio again.';
  const nozzle=mountNozzleLab(find<HTMLDetailsElement>('.nozzle-lab'),s.nozzle);
  const focus=exhibitFocus(root,'Expanded rocket experiment',signal),scrub=find<HTMLInputElement>('[data-rocket-scrub]'),chart=find<SVGSVGElement>('.rocket-chart');
  const selectors={payload:find<HTMLSelectElement>('[data-payload]'),propellant:find<HTMLSelectElement>('[data-propellant]'),burn:find<HTMLSelectElement>('[data-burn]')};
  const steps=(['payload','fill','ignite'] as const).map(action=>find<HTMLButtonElement>(`[data-rocket-action="${action}"]`));
  function enableAudio(){if(s.sound)void audio.enable();}
  function caption(){
    if(s.stage==='empty')return 'Choose a payload, propellant amount and burn rate. There is no air to push against.';
    if(s.stage==='payload')return 'The science payload is aboard. Fuel and oxidiser will travel with it.';
    if(s.stage==='ready')return 'The selected propellant load is aboard. Predict which curve will change as the rocket gets lighter.';
    if(s.stage==='countdown')return s.playing?'A short countdown. The rocket and its exhaust will gain momentum in opposite directions.':'Countdown paused. Continue when you are ready.';
    if(s.time>=run.burnTime)return 'Engine off. Pressure, thrust and acceleration are zero; the rocket keeps coasting at the speed it has gained.';
    if(s.time<run.burnTime*.12)return 'Fuel and oxidiser feed the chamber. Hot gas accelerates through the nozzle and the rocket gains speed.';
    if(s.time>run.burnTime*.88)return 'The final propellant is leaving. Flow and thrust taper away, while speed still increases.';
    return 'Pressure and thrust are steady. As mass falls, the same push produces more acceleration.';
  }
  function prepareGraph(){find('[data-rocket-chart-static]').innerHTML=chartMarkup(run,s,previous);find<HTMLSelectElement>('[data-rocket-axis]').value=s.axis;find<HTMLSelectElement>('[data-rocket-plot]').value=s.plot;}
  function draw(){
    if(disposed)return;
    const flight=s.stage==='flight',p=sampleRocket(run,flight?s.time:0),lit=flight&&p.flow>1e-6,pressure=clamp(rocketIndex('pressure',p.pressure)/100),filled=['ready','countdown','flight'].includes(s.stage),loaded=s.stage!=='empty';
    const fill=filled?p.remaining/PROPELLANT_LOADS.large.mass:0,shift=!reduced&&flight?Math.min(24,p.distance*1.5):0;
    find('[data-rocket-rig]').setAttribute('transform',`translate(${num(shift)} 0)`);
    find('.rocket-labels').setAttribute('transform',`translate(${num(shift)} 0)`);
    find('[data-stars]').innerHTML=Array.from({length:24},(_,i)=>{const x=(i*173.3+1100-(!reduced?p.distance*12:0)%1100)%1100,y=45+(i*83.7)%280;return `<circle cx="${num(x)}" cy="${num(y)}" r="${i%3===0?1.6:.9}" fill="#adc9c4" opacity=".3"/>`;}).join('');
    find('[data-rocket-tanks]').innerHTML=`<rect x="374" y="145" width="${282*fill}" height="53" fill="#d6a26a" clip-path="url(#rocket-fuel-clip)"/><rect x="374" y="231" width="${282*fill}" height="53" fill="#75bbb8" clip-path="url(#rocket-oxidiser-clip)"/>`;
    find('[data-rocket-flow]').innerHTML=lit?`<path d="M374 171H345V194H324" stroke="#e4b375"/><path d="M374 257H345V236H324" stroke="#94d6cd"/>`:'';
    find<SVGGElement>('[data-rocket-flow]').style.strokeDashoffset=String(reduced?0:-p.time*35);
    find('[data-rocket-chamber]').innerHTML=lit?`<path d="M272 185H308Q321 185 321 199V229Q321 243 308 243H272Z" fill="#f7cd83" opacity="${.25+.7*pressure}"/><path d="M272 204H306V224H272Z" fill="#fff3c4"/>`:'';
    const payloadSize=17+PAYLOADS[s.options.payload].mass*12;
    find('[data-rocket-payload]').innerHTML=loaded?`<rect x="${771-payloadSize}" y="${214-payloadSize}" width="${payloadSize*2}" height="${payloadSize*2}" rx="6" fill="#c8ae73" stroke="#eee2b6" stroke-width="3"/><circle cx="771" cy="214" r="${payloadSize*.5}" fill="#3d7280" stroke="#f4ddb0" stroke-width="3"/><path d="M771 ${214-payloadSize}V${196-payloadSize}" stroke="#e1e1c1" stroke-width="3"/>`:'';
    find('[data-rocket-plume]').innerHTML=lit?`<path d="M269 202L245 211L215 205L178 184V244L215 224L245 217L269 226Z" fill="#f4cf8b" opacity="${.2+pressure*.55}"/><path d="M178 188Q${130-pressure*55} ${180-pressure*20} ${Math.max(0,110-pressure*125)} 214Q${130-pressure*55} ${248+pressure*20} 178 241Z" fill="url(#rocket-plume)"/><path d="M178 204L${147-pressure*42} 214L178 224Z" fill="#fff2c7"/>`:'';
    find('[data-rocket-arrows]').innerHTML=lit?`<g fill="none" stroke="#ebc785" stroke-width="3"><path d="M917 214H${940+pressure*95}l-10-6m10 6l-10 6"/><path d="M159 133H${150-pressure*100}l10-6m-10 6l10 6"/></g><text class="rocket-arrow-label" x="915" y="191">Thrust</text><text class="rocket-arrow-label" x="60" y="114">Exhaust</text>`:'';
    find('[data-rocket-countdown]').innerHTML=s.stage==='countdown'?`<circle cx="1015" cy="77" r="39" fill="#1a424c" stroke="#cebc87"/><text x="1015" y="90" text-anchor="middle" class="rocket-countdown-number">${Math.max(1,3-Math.floor(s.countdown*3))}</text>`:'';
    const text=caption();find('#rocket-scene-desc').textContent=text;if(text!==lastCaption){find('[data-rocket-caption]').textContent=text;lastCaption=text;}
    const plot=ROCKET_PLOTS[s.plot];plot.quantities.forEach((q,i)=>{find(`[data-${i?'second':'first'}-label]`).textContent=`${plot.labels[i]} index`;find(`[data-${i?'second':'first'}-legend]`).textContent=plot.labels[i];find(`[data-${i?'second':'first'}]`).textContent=flight?num(rocketIndex(q,p[q])):'—';find(`[data-rocket-curve="${i}"]`).setAttribute('d',flight?curve(run,s.axis,q,s.time):'');});
    find('[data-remaining]').textContent=filled?`${Math.round(p.remaining/run.propellant*100)}%`:'—';
    const x=xAt(run,p.time,s.axis);find('[data-rocket-chart-live]').innerHTML=flight?`<path d="M${x} 30V192" class="cannon-cursor"/>${plot.quantities.map((q,i)=>`<circle cx="${x}" cy="${graph.top+(1-rocketIndex(q,p[q])/100)*graph.height}" r="4" class="cannon-${i?'speed':'pressure'}-dot"/>`).join('')}`:'';
    find('[data-cutoff-marker]').setAttribute('visibility',flight&&s.time>=run.burnTime?'visible':'hidden');
    const complete=flight&&s.time>=run.burnTime;
    find('[data-rocket-comparison]').textContent=previous?`Dashed: ${PROPELLANT_LOADS[previous.options.propellant].name.toLowerCase()} load, ${PAYLOADS[previous.options.payload].name.toLowerCase()}, ${BURN_RATES[previous.options.burn].name.toLowerCase()} burn · final speed index ${num(rocketIndex('speed',previous.cutoff.speed))}.${complete?` Now: ${num(rocketIndex('speed',run.cutoff.speed))}.`:''}`:complete?`Final speed index: ${num(rocketIndex('speed',run.cutoff.speed))}. Reset Experiment keeps these curves for comparison.`:'Try changing only the burn rate. Will the final speed change, or just how quickly you reach it?';
    find('#rocket-chart-desc').textContent=flight?`${plot.labels[0]} index ${num(rocketIndex(plot.quantities[0],p[plot.quantities[0]]))}, ${plot.labels[1]} index ${num(rocketIndex(plot.quantities[1],p[plot.quantities[1]]))}. ${Math.round(p.used*100)} percent of loaded propellant used. Fixed comparison scales.`:'Ignite the virtual engine to reveal the curves. Each quantity has its own fixed relative scale.';
    for(const key of Object.keys(selectors) as (keyof RocketOptions)[]){selectors[key].value=s.options[key];selectors[key].disabled=key==='payload'?s.stage!=='empty':key==='propellant'?!['empty','payload'].includes(s.stage):!['empty','payload','ready'].includes(s.stage);}
    const step=LOADING.indexOf(s.stage);markSteps(steps,step<0?3:step);
    const active=flight||s.stage==='countdown',finished=flight&&s.time>=run.endTime,play=find<HTMLButtonElement>('[data-rocket-play]');
    play.disabled=!active;setControl(play,s.playing?'pause':'play',s.playing?'Pause':finished?'Play again':'Play');
    const cue=exhibitCue(step>=0,active,s.playing,finished);play.classList.toggle('is-next',cue==='play');find('[data-rocket-action="reset"]').classList.toggle('is-next',cue==='reset');
    find<HTMLButtonElement>('[data-rocket-action="replay"]').disabled=!flight;find<HTMLButtonElement>('[data-rocket-next]').disabled=!active||finished;
    scrub.disabled=!flight;scrub.value=String(Math.round(s.time/run.endTime*1000));scrub.setAttribute('aria-valuetext',flight?`${Math.round(p.used*100)} percent propellant used; speed index ${num(rocketIndex('speed',p.speed))}`:'Before ignition');
    const sound=find('[data-rocket-sound]');setControl(sound,s.sound?'soundOn':'soundOff',s.sound?'Sound on':'Sound off');sound.setAttribute('aria-pressed',String(s.sound));
    audio.setEngine(s.sound&&s.playing&&lit,pressure);
  }
  function stop(){s.playing=false;cancelAnimationFrame(frame);frame=0;last=0;audio.setEngine(false);}
  function animate(now:number){frame=0;if(!s.playing||disposed)return;const dt=last?Math.min(.06,(now-last)/1000):0;last=now;
    if(s.stage==='countdown'){s.countdown=Math.min(1,s.countdown+dt/1.5);if(s.countdown>=1){s.stage='flight';s.time=0;}}
    else if(s.stage==='flight'){s.time=Math.min(run.endTime,s.time+dt*.8);if(s.time>=run.endTime)stop();}draw();if(s.playing)frame=requestAnimationFrame(animate);
  }
  function schedule(){if(s.playing&&!frame&&!disposed){last=0;frame=requestAnimationFrame(animate);}}
  function refresh(){run=simulateRocket(s.options);previous=s.previous?simulateRocket(s.previous):undefined;prepareGraph();draw();}
  root.addEventListener('click',event=>{const b=(event.target as Element).closest<HTMLButtonElement>('button');if(!b||b.disabled)return;const action=b.dataset.rocketAction;
    if(action){stop();s=rocketAction(s,{type:action as RocketAction['type']});if(action==='ignite'||action==='replay'){enableAudio();if(reduced){s.stage='flight';s.countdown=1;s.playing=false;}}if(action==='reset')refresh();}
    else if(b.hasAttribute('data-rocket-play')){if(s.playing)stop();else{if(s.stage==='flight'&&s.time>=run.endTime)s=rocketAction(s,{type:'replay'});else s.playing=true;enableAudio();}}
    else if(b.hasAttribute('data-rocket-next')){stop();s.stage='flight';s.countdown=1;s.time=[run.burnTime*.12,run.burnTime/2,run.peakAcceleration.time,run.burnTime,run.endTime].find(t=>t>s.time+1e-5)??run.endTime;}
    else if(b.hasAttribute('data-focus'))focus.toggle();else if(b.hasAttribute('data-rocket-sound')){s.sound=!s.sound;if(s.sound)enableAudio();else audio.mute();}
    draw();schedule();
  },{signal});
  for(const key of Object.keys(selectors) as (keyof RocketOptions)[])selectors[key].addEventListener('change',()=>{if(!selectors[key].disabled){s.options={...s.options,[key]:selectors[key].value};refresh();}},{signal});
  find<HTMLSelectElement>('[data-rocket-axis]').addEventListener('change',event=>{s.axis=(event.target as HTMLSelectElement).value as RocketAxis;prepareGraph();draw();},{signal});
  find<HTMLSelectElement>('[data-rocket-plot]').addEventListener('change',event=>{s.plot=(event.target as HTMLSelectElement).value as RocketPlot;prepareGraph();draw();},{signal});
  scrub.addEventListener('input',()=>{stop();s.time=Number(scrub.value)/1000*run.endTime;draw();},{signal});
  function seek(event:PointerEvent){if(s.stage!=='flight')return;stop();const point=chart.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const local=point.matrixTransform(chart.getScreenCTM()!.inverse()),fraction=clamp((local.x-graph.left)/graph.width);s.time=s.axis==='time'?Math.min(run.endTime,fraction*ROCKET_SCALES.time):timeAtPropellantUsed(run,fraction);draw();}
  installChartScrubbing(chart, seek, signal);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();draw();}},{signal});prepareGraph();draw();
  return {dispose:()=>{stop();focus.close();disposed=true;abort.abort();audio.dispose();return {...s,options:{...s.options},playing:false,nozzle:nozzle.dispose()};}};
}
