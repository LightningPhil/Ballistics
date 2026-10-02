import './cannon-exhibit.css';
import { installChartScrubbing } from './chart-scrubbing.ts';
import { exhibitFocus } from './exhibit-focus.ts';
import { ExhibitAudio } from './exhibit-audio.ts';
import { control, setControl, stepButton, markSteps, exhibitCue } from './exhibit-controls.ts';
import { CHARGES, MATERIALS, CANNON_SCALES, simulateCannon, sampleCannon, timeAtTravel,
  pressureIndex, speedIndex, newCannonSession, cannonAction,
  type CannonSession, type CannonAction, type CannonRun, type CannonSample, type CannonStage, type Charge, type Material } from './cannon-model.ts';

const LOADING:CannonStage[]=['empty','powder','loaded'];
const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,v));
const num=(v:number)=>v.toFixed(1);
const graph={left:58,top:25,width:784,height:168};

export function cannonExhibitMarkup() {
  return `<section class="cannon-history" aria-label="A little history"><p class="atlas-kicker">BEFORE WE SLOW DOWN TIME</p><h2>When did cannon begin?</h2>
    <p>The story begins in medieval China. There is no single securely known “first cannon”; surviving metal examples take us back to the late 1200s.</p>
    <ol><li><strong>Late 1200s</strong><span>Small metal cannon in China</span></li><li><strong>1326</strong><span>Cannon recorded in Florence</span></li><li><strong>Later centuries</strong><span>Stone and iron shot; changing castles and ships</span></li></ol>
    <p class="cannon-history-note">These were weapons of war, with profound consequences for people and places. Here, a museum-style cutaway lets us examine the history and the physical process.</p></section>
  <section class="cannon-exhibit" aria-label="Interactive historical cannon cutaway">
    <header><div><p class="atlas-kicker">AN EVENT TOO QUICK TO SEE</p><h2>A brief push, revealed.</h2></div><button type="button" data-focus class="cannon-focus-button">${control('expand','Expand experiment')}</button></header>
    <p class="cannon-question"><span class="cannon-question-mark" aria-hidden="true">?</span><span><small>A QUESTION TO INVESTIGATE</small>Can the pressure be falling while the ball is still gaining speed?</span></p>
    <div class="cannon-lab-grid"><div class="cannon-demo-panel"><div class="cannon-workbench"><div class="cannon-visual"><svg class="cannon-scene" viewBox="40 95 1000 315" role="img" aria-labelledby="cannon-scene-title cannon-scene-desc">
      <title id="cannon-scene-title">A cutaway of an old cannon on a wooden carriage</title><desc id="cannon-scene-desc">An empty barrel, with a short fuse above its rear. Add an illustrative charge and a same-size ball to explore hot gas and motion.</desc>
      <defs><linearGradient id="cannon-bronze" x2="0" y2="1"><stop stop-color="#ddbc78"/><stop offset=".3" stop-color="#94744b"/><stop offset=".7" stop-color="#b5955c"/><stop offset="1" stop-color="#65563d"/></linearGradient><linearGradient id="cannon-bore" x2="0" y2="1"><stop stop-color="#101c21"/><stop offset="1" stop-color="#31424a"/></linearGradient><radialGradient id="cannon-ball-shade" cx="30%" cy="25%"><stop stop-color="#fff7d5" stop-opacity=".4"/><stop offset="1" stop-color="#10222c" stop-opacity=".55"/></radialGradient><linearGradient id="cannon-gas"><stop stop-color="#f1ad57"/><stop offset="1" stop-color="#eac57c" stop-opacity=".4"/></linearGradient><pattern id="cannon-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V8" stroke="#342f24" stroke-opacity=".2" stroke-width="2"/></pattern></defs>
      <path d="M42 368H1035" stroke="#bac4ae" stroke-opacity=".15"/><ellipse cx="455" cy="374" rx="300" ry="16" fill="#071c23" opacity=".7"/>
      <g data-cannon-rig>
        <path d="M244 281L656 301L700 341H227Z" fill="#8f5d3d" stroke="#382e29" stroke-width="5"/><path d="M265 288L645 308M262 301L637 320" stroke="#ba8656" stroke-width="4"/><path d="M277 283L295 333M609 299L625 335" stroke="#25393d" stroke-width="11"/>
        ${[330,614].map(x=>`<g transform="translate(${x} 330)"><circle r="47" fill="#5b4634" stroke="#22383d" stroke-width="9"/><circle r="36" fill="#9e774a" stroke="#d1ad6d" stroke-width="3"/>${[0,45,90,135].map(a=>`<path d="M-34 0H34" transform="rotate(${a})" stroke="#4b402f" stroke-width="8"/>`).join('')}<circle r="11" fill="#ccab6b" stroke="#34474a" stroke-width="5"/></g>`).join('')}
        <path d="M139 239H176V257H139Z" fill="url(#cannon-bronze)" stroke="#304143" stroke-width="3"/><ellipse cx="131" cy="247" rx="24" ry="22" fill="url(#cannon-bronze)" stroke="#304143" stroke-width="4"/>
        <path d="M160 195Q184 183 230 190L756 216L802 208L818 218V285L799 297L756 288L230 310Q184 316 160 293Z" fill="url(#cannon-bronze)" stroke="#263e40" stroke-width="5"/>
        <path d="M182 200V296M217 193V310M749 216V288M796 212V293" stroke="#e0c789" stroke-width="6" opacity=".6"/>
        <path d="M238 204L727 228M237 300L727 281" stroke="#f3d998" stroke-width="3" opacity=".45"/>
        <rect x="212" y="228" width="594" height="50" rx="3" fill="url(#cannon-bore)" stroke="#ebd79e" stroke-width="3"/>
        <rect x="178" y="226" width="34" height="56" fill="url(#cannon-hatch)"/>
        <path d="M234 228V184" stroke="#132d37" stroke-width="8"/>
        <path data-fuse d="M234 228V184Q218 153 248 143Q277 134 263 112" fill="none" stroke="#dbca9e" stroke-width="5" stroke-linecap="round"/>
        <g data-cannon-contents></g>
      </g>
      <g data-cannon-effects></g>
      <g class="cannon-drawing-labels"><text x="315" y="121">Fuse</text><path d="M302 126L276 139"/><text x="588" y="174">Cutaway barrel</text><path d="M621 183V207"/><text x="835" y="211">Muzzle</text><path d="M842 217L818 233"/></g>
      <text class="cannon-scene-note" x="43" y="405">Later muzzle-loading style · schematic proportions</text>
    </svg><p class="cannon-stage-caption" data-stage-caption role="status" aria-live="polite"></p>
    <div class="cannon-readouts"><div><span>Pressure index</span><strong data-pressure>—</strong></div><div><span>Speed index</span><strong data-speed>—</strong></div><div><span>Barrel travel</span><strong data-travel>—</strong></div></div></div>
    <aside class="cannon-controls" aria-label="Experiment choices"><label>Illustrative charge<select data-charge>${Object.entries(CHARGES).map(([id,c])=>`<option value="${id}" ${id==='medium'?'selected':''}>${c.name}</option>`).join('')}</select></label>
      <label>Ball material<select data-material>${Object.entries(MATERIALS).map(([id,m])=>`<option value="${id}" ${id==='iron'?'selected':''}>${m.name} · ${m.detail.toLowerCase()}</option>`).join('')}</select></label><p>Same size. Different mass.</p>
      <ol class="cannon-loading">${stepButton('data-action','charge',1,'Add charge')}${stepButton('data-action','ball',2,'Add ball')}${stepButton('data-action','light',3,'Light fuse')}</ol>
      <button type="button" data-action="reset" class="cannon-new">${control('reset','Reset Experiment')}</button><div class="exhibit-sound-controls"><button type="button" data-sound aria-pressed="false" class="cannon-sound">${control('soundOff','Sound off')}</button><p data-audio-status role="status">Optional, quiet classroom sound effects.</p></div></aside></div>
    <div class="cannon-playback"><button type="button" data-play disabled>${control('play','Play')}</button><button type="button" data-action="replay" disabled>${control('replay','Replay')}</button><button type="button" data-next disabled>${control('next','Next moment')}</button><label class="cannon-scrubber">Inspect the event<input data-scrub type="range" min="0" max="1000" step="1" value="0" disabled aria-label="Inspect cannon event"></label></div>
    </div><div class="cannon-plot"><div class="cannon-chart-heading"><div><h3>The push and the motion</h3><div class="cannon-chart-legend"><span><i></i>Pressure</span><span><i></i>Speed</span></div></div><label>Plot against<select data-axis><option value="time">Time</option><option value="travel">Barrel travel</option></select></label></div>
    <svg class="cannon-chart" viewBox="0 0 900 270" role="img" aria-labelledby="cannon-chart-title cannon-chart-desc"><title id="cannon-chart-title">Gas pressure and ball speed</title><desc id="cannon-chart-desc">Both curves use fixed relative scales across experiments. Fire a virtual shot to reveal the curves, then use the time slider or select a point on this chart.</desc><g data-chart-static></g><g data-chart-live></g></svg>
    <p class="cannon-comparison" data-comparison></p></div></div><p class="cannon-model-note">Slow motion · relative scales, not measurements of a real cannon. Charge sizes and model time are illustrative; the gas and moving ball are calculated together.</p>
    <details class="cannon-model-details"><summary>What does this model include?</summary><p>Heat release, an expanding gas reservoir, work on a moving mass, small resistance and heat losses. After muzzle clearance, the gas vents and the ball coasts at constant speed; gravity and air resistance are omitted in this short part of the model. A fixed scale for each quantity makes different experiments comparable; pressure and speed indices are different quantities.</p><p>It omits real powder data, dimensions, deformation, leakage and the brief external gas push. The fuse timing, smoke and carriage recoil are visual explanations. Stone and iron were historical shot materials; lead also appears among recovered Mary Rose shot, including composite pieces. Here all three balls are idealised, uniform and equally sized.</p></details>
  </section>
  <aside class="cannon-space-note"><span aria-hidden="true">↗</span><div><p class="atlas-kicker">A SMALL DETOUR TOWARDS SPACE</p><h3>The space gun</h3><p>Could a cannon launch scientific instruments upwards? In the 1960s, Project HARP did just that, using gun-launched probes to study the upper atmosphere. The enormous acceleration was a serious challenge for instruments—and rules out a comfortable passenger ride. Reaching a great height is also different from entering orbit, which needs enough sideways speed. Rockets can keep accelerating after launch.</p></div></aside>`;
}

function curve(run:CannonRun,axis:CannonSession['axis'],quantity:'pressure'|'speed',until=run.endTime) {
  // Include the exact inspected instant. On the travel axis all venting samples
  // share x=100%, so a horizontal reveal alone would expose the future tail.
  const points=run.samples.filter((p,i)=>p.time<until && (i%8===0 || p===run.peak || p===run.exit));
  points.push(sampleCannon(run,until));
  return points.map((p,i)=> {
    const x=graph.left+(axis==='time'?p.time/CANNON_SCALES.time:Math.min(1,p.travel))*graph.width;
    const value=quantity==='pressure'?pressureIndex(p.pressure):speedIndex(p.speed);
    return `${i?'L':'M'}${num(x)} ${num(graph.top+(1-value/100)*graph.height)}`;
  }).join('');
}
function chartMarkup(run:CannonRun,axis:CannonSession['axis'],previous?:CannonRun) {
  const x=(p:CannonSample)=>graph.left+(axis==='time'?p.time/CANNON_SCALES.time:Math.min(1,p.travel))*graph.width;
  const exit=x(run.exit), peak=x(run.peak);
  return `<defs><clipPath id="cannon-chart-reveal"><rect data-chart-clip x="${graph.left}" y="0" width="0" height="220"/></clipPath></defs>
    ${[0,25,50,75,100].map(n=>{const y=graph.top+(1-n/100)*graph.height;return `<path d="M${graph.left} ${y}H${graph.left+graph.width}" class="cannon-grid"/><text x="45" y="${y+4}" text-anchor="end">${n}</text><text x="855" y="${y+4}">${n}</text>`;}).join('')}
    <text x="58" y="22" class="cannon-pressure-text">Pressure index</text><text x="842" y="22" text-anchor="end" class="cannon-speed-text">Speed index</text>
    ${[0,.25,.5,.75,1].map(f=>`<text x="${graph.left+f*graph.width}" y="221" text-anchor="middle">${axis==='time' ? Number((f*CANNON_SCALES.time).toFixed(2)) : Math.round(f*100)+'%'}</text>`).join('')}
    <text x="450" y="260" text-anchor="middle">${axis==='time'?'Elapsed model time · illustrative units':'Ball travel through the barrel'}</text>
    ${previous ? `<g class="cannon-previous"><path d="${curve(previous,axis,'pressure')}" class="cannon-pressure-curve"/><path d="${curve(previous,axis,'speed')}" class="cannon-speed-curve"/></g>`:''}
    <g data-shot-curves clip-path="url(#cannon-chart-reveal)"><path data-pressure-curve d="${curve(run,axis,'pressure')}" class="cannon-pressure-curve"/><path data-speed-curve d="${curve(run,axis,'speed')}" class="cannon-speed-curve"/></g>
    <g data-muzzle-marker visibility="hidden"><path d="M${exit} 24V193" class="cannon-event-line"/><text x="${exit-6}" y="184" text-anchor="end">Muzzle</text></g>
    <g data-peak-marker visibility="hidden"><path d="M${peak} 24V193" class="cannon-event-line"/><text x="${peak+5}" y="40">Pressure peak</text></g>`;
}

export function mountCannonExhibit(root:HTMLElement,saved?:CannonSession) {
  let session=saved?{...saved,options:{...saved.options},playing:false}:newCannonSession();
  let run=simulateCannon(session.options), previous=session.previous?simulateCannon(session.previous):undefined;
  let frame=0,last=0,disposed=false,lastCaption='',playedBoom=false,playedWhoosh=false;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const find=<T extends Element=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  const audio=new ExhibitAudio(message=>{find('[data-audio-status]').textContent=message;});
  if(session.sound)find('[data-audio-status]').textContent='Sound selected. Press Play to activate audio again.';
  const charge=find<HTMLSelectElement>('[data-charge]'),material=find<HTMLSelectElement>('[data-material]');
  const scrub=find<HTMLInputElement>('[data-scrub]'),axis=find<HTMLSelectElement>('[data-axis]');
  const contents=find<SVGGElement>('[data-cannon-contents]'),effects=find<SVGGElement>('[data-cannon-effects]');
  const rig=find<SVGGElement>('[data-cannon-rig]'),fuse=find<SVGPathElement>('[data-fuse]');
  const fuseLength=fuse.getTotalLength();
  const chart=find<SVGSVGElement>('.cannon-chart');
  const steps=(['charge','ball','light'] as const).map(action=>find<HTMLButtonElement>(`[data-action="${action}"]`));
  const abort=new AbortController(),signal=abort.signal;
  const focus=exhibitFocus(root,'Expanded cannon experiment',signal);

  function sound(kind:'boom'|'whoosh') {
    if(session.sound)audio.effect(kind);
  }
  function enableAudio() {if(session.sound)void audio.enable();}
  function prepareGraph() {
    find('[data-chart-static]').innerHTML=chartMarkup(run,session.axis,previous);
    axis.value=session.axis;
  }
  function caption() {
    if(session.stage==='empty') return 'A quiet beginning. Choose a charge and a ball material.';
    if(session.stage==='powder') return 'The charge occupies a small space at the rear. A larger preset takes up a little more length.';
    if(session.stage==='loaded') return 'The ball is in place. Predict what the pressure and speed curves will do.';
    if(session.stage==='fuse') return session.playing?'The fuse burns towards the charge. The ball has not moved yet.':'Fuse paused. Continue whenever you are ready.';
    if(Math.abs(session.time-run.peak.time)<.005) return 'Pressure reaches its peak here. The ball has only just begun its journey along the barrel.';
    if(session.time<run.peak.time) return 'Fast burning releases heat and gas. Pressure rises, and the ball begins to accelerate.';
    if(session.time<run.exit.time) return 'Pressure is falling, but it still pushes forwards: the ball continues gaining speed.';
    if(session.time<run.exit.time+.3) return 'The ball clears the muzzle. Hot gas rushes out around it and pressure collapses.';
    return 'The push is over. Inspect the curves, or try a new comparison with a different material.';
  }
  function draw() {
    if(disposed) return;
    const shot=session.stage==='shot',p=sampleCannon(run,shot?session.time:0),q=CHARGES[session.options.charge];
    const hasPowder=session.stage!=='empty',hasBall=['loaded','fuse','shot'].includes(session.stage);
    const start=218+q.length+25,travel=829-start,ballX=start+travel*p.travel;
    const recoil=shot&&!reduced?-12*(1-Math.exp(-p.time*8))*Math.exp(-Math.max(0,p.time-run.exit.time)*5):0;
    rig.setAttribute('transform',`translate(${num(recoil)} 0)`);
    const powderWidth=q.length*(1-p.burned),pressure=clamp(pressureIndex(p.pressure)/100);
    const gasWidth=Math.max(0,Math.min(806,ballX-22)-214),colour=MATERIALS[session.options.material].colour;
    contents.innerHTML=`${shot?`<rect x="214" y="232" width="${num(gasWidth)}" height="42" fill="url(#cannon-gas)" opacity="${num(.12+pressure*.8)}"/>`:''}
      ${hasPowder&&powderWidth>.3?`<path d="M216 236H${216+powderWidth}V274H216Z" fill="#766b52"/>${Array.from({length:18},(_,i)=>`<circle cx="${218+(i*.618%1)*Math.max(0,powderWidth-3)}" cy="${240+i%5*7}" r="1.8" fill="#c1ad77"/>`).join('')}`:''}
      ${hasBall?`<g transform="translate(${num(ballX)} 253)"><circle r="22" fill="${colour}"/><circle r="22" fill="url(#cannon-ball-shade)" stroke="#dbe0ca" stroke-opacity=".45" stroke-width="1.5"/>${session.options.material==='stone'?'<path d="M-11-8L-3-3L-6 4M5 8L10 13" fill="none" stroke="#4e5b58" stroke-width="1.5"/>':''}</g>`:''}
      ${shot&&p.travel<1?`<path d="M${ballX-32} 253H${Math.max(217,ballX-32-80*pressure)}M${ballX-32} 253l-9-5m9 5l-9 5" fill="none" stroke="#fff0bc" stroke-width="3"/>`:''}`;
    fuse.style.strokeDasharray=`${fuseLength*(1-session.fuse)} ${fuseLength}`;
    let effect='';
    if(session.stage==='fuse') {
      const tip=fuse.getPointAtLength(fuseLength*(1-session.fuse));
      effect=`<g transform="translate(${tip.x+recoil} ${tip.y})"><path d="M0 5Q-14-4 1-23Q2-9 10-12Q17 3 0 5" fill="#e8a351"/><path d="M0 3Q-4-5 2-11Q10-3 0 3" fill="#fff4bb"/></g>`;
    }
    if(shot&&p.travel>=1) {
      const t=session.time-run.exit.time,k=clamp(t/.12),fade=Math.exp(-t*4);
      effect+=`<g opacity="${num(fade)}" transform="translate(${810+recoil} 253)"><path d="M0-19Q${55*k}-65 ${175*k}-34Q${115*k} 0 ${210*k} 30Q${50*k} 64 0 19Z" fill="#edc07b" opacity=".7"/>
        ${Array.from({length:9},(_,i)=>`<ellipse cx="${20+k*(40+i*15)}" cy="${Math.sin(i*2.4)*k*(15+i*3)}" rx="${(12+i*2)*(1+t)}" ry="${(9+i)*(1+t)}" fill="#f0e7ca" opacity=".2"/>`).join('')}</g>`;
      if(!reduced) effect+=`<text class="cannon-whoosh" x="870" y="164" opacity="${num(fade)}">whoosh</text>`;
    }
    effects.innerHTML=effect;
    find('#cannon-scene-desc').textContent=caption();
    const text=caption(); if(text!==lastCaption) {find('[data-stage-caption]').textContent=text;lastCaption=text;}
    find('[data-pressure]').textContent=shot?num(pressureIndex(p.pressure)):'—';
    find('[data-speed]').textContent=shot?num(speedIndex(p.speed)):'—';
    find('[data-travel]').textContent=shot?(p.travel>=1?'Outside':`${Math.round(p.travel*100)}%`):'—';
    charge.value=session.options.charge;material.value=session.options.material;
    charge.disabled=session.stage!=='empty';material.disabled=!['empty','powder'].includes(session.stage);
    const step=LOADING.indexOf(session.stage);
    markSteps(steps,step<0?3:step);
    const active=shot||session.stage==='fuse',finished=shot&&session.time>=run.endTime,play=find<HTMLButtonElement>('[data-play]');
    play.disabled=!active;
    setControl(play,session.playing?'pause':'play',session.playing?'Pause':finished?'Play again':'Play');
    const cue=exhibitCue(step>=0,active,session.playing,finished);
    play.classList.toggle('is-next',cue==='play');find('[data-action="reset"]').classList.toggle('is-next',cue==='reset');
    find<HTMLButtonElement>('[data-action="replay"]').disabled=!shot;
    find<HTMLButtonElement>('[data-next]').disabled=!active||finished;
    scrub.disabled=!shot;scrub.value=String(Math.round(session.time/run.endTime*1000));
    scrub.setAttribute('aria-valuetext',shot?`${Math.round(clamp(p.travel)*100)} percent of barrel travel; pressure index ${num(pressureIndex(p.pressure))}; speed index ${num(speedIndex(p.speed))}`:'Before ignition');
    const x=graph.left+(session.axis==='time'?p.time/CANNON_SCALES.time:Math.min(1,p.travel))*graph.width;
    if(session.axis==='travel') for(const k of ['pressure','speed'] as const) find(`[data-${k}-curve]`).setAttribute('d',curve(run,session.axis,k,p.time));
    find('[data-peak-marker]').setAttribute('visibility',shot&&session.time>=run.peak.time?'visible':'hidden');
    find('[data-muzzle-marker]').setAttribute('visibility',shot&&session.time>=run.exit.time?'visible':'hidden');
    find<SVGRectElement>('[data-chart-clip]').setAttribute('width',shot?String(Math.max(0,x-graph.left)+.5):'0');
    find('[data-chart-live]').innerHTML=shot?`<path d="M${x} 25V193" class="cannon-cursor"/>${(['pressure','speed'] as const).map(k=>`<circle cx="${x}" cy="${graph.top+(1-(k==='pressure'?pressureIndex(p.pressure):speedIndex(p.speed))/100)*graph.height}" r="4" class="cannon-${k}-dot"/>`).join('')}`:'';
    find('#cannon-chart-desc').textContent=shot?`Current pressure index ${num(pressureIndex(p.pressure))}, speed index ${num(speedIndex(p.speed))}. Peak pressure ${num(pressureIndex(run.peak.pressure))}; exit speed ${num(speedIndex(run.exit.speed))}. Both have fixed relative scales.`:'Pressure and speed appear after ignition. Both use fixed relative scales across experiments.';
    const cleared=shot&&p.travel>=1;
    find('[data-comparison]').textContent=previous?`Dashed: previous ${CHARGES[previous.options.charge].name.toLowerCase()} charge, ${MATERIALS[previous.options.material].name.toLowerCase()} ball · exit speed index ${num(speedIndex(previous.exit.speed))}.${cleared?` This experiment: ${num(speedIndex(run.exit.speed))}.`:''}`:cleared?`Exit speed index: ${num(speedIndex(run.exit.speed))}. Reset Experiment keeps these curves for comparison.`:'Try changing just the material between experiments. The previous curves will remain as faint dashed lines.';
    audio.setFuse(session.sound&&session.playing&&session.stage==='fuse',session.fuse);
    showSound();
  }
  function showSound() {
    const button=find('[data-sound]');
    setControl(button,session.sound?'soundOn':'soundOff',session.sound?'Sound on':'Sound off');button.setAttribute('aria-pressed',String(session.sound));
  }
  function stop() {audio.setFuse(false);session.playing=false;cancelAnimationFrame(frame);frame=0;last=0;}
  function animate(now:number) {
    frame=0;if(!session.playing||disposed) return;
    const dt=last?Math.min(.06,(now-last)/1000):0;last=now;
    if(session.stage==='fuse') {
      session.fuse=Math.min(1,session.fuse+dt/1.4);
      if(session.fuse>=1) {session.stage='shot';session.time=0;if(!playedBoom){sound('boom');playedBoom=true;}}
    } else if(session.stage==='shot') {
      const before=session.time;session.time=Math.min(run.endTime,session.time+dt*.32);
      if(before<run.exit.time&&session.time>=run.exit.time&&!playedWhoosh) {sound('whoosh');playedWhoosh=true;}
      if(session.time>=run.endTime) stop();
    }
    draw();if(session.playing) frame=requestAnimationFrame(animate);
  }
  function schedule() {if(session.playing&&!frame&&!disposed) {last=0;frame=requestAnimationFrame(animate);}}
  function refreshRun() {run=simulateCannon(session.options);previous=session.previous?simulateCannon(session.previous):undefined;prepareGraph();draw();}
  root.addEventListener('click',event=> {
    const button=(event.target as Element).closest<HTMLButtonElement>('button');if(!button||button.disabled) return;
    const action=button.dataset.action;
    if(action) {
      stop();session=cannonAction(session,{type:action as CannonAction['type']});
      if(action==='light'||action==='replay') {playedBoom=false;playedWhoosh=false;enableAudio();if(reduced){session.stage='shot';session.fuse=1;session.playing=false;}}
      if(action==='reset') refreshRun();
    } else if(button.hasAttribute('data-play')) {
      if(session.playing) stop();else {if(session.stage==='shot'&&session.time>=run.endTime){session=cannonAction(session,{type:'replay'});playedBoom=false;playedWhoosh=false;}else session.playing=true;enableAudio();}
    } else if(button.hasAttribute('data-next')) {
      stop();session.stage='shot';session.fuse=1;
      session.time=[run.peak.time,timeAtTravel(run,.5),run.exit.time,run.exit.time+.12,run.endTime].find(t=>t>session.time+1e-5)??run.endTime;
    } else if(button.hasAttribute('data-focus')) {
      focus.toggle();
    } else if(button.hasAttribute('data-sound')) {
      session.sound=!session.sound;
      if(session.sound)enableAudio();else audio.mute();
    }
    draw();schedule();
  },{signal});
  charge.addEventListener('change',()=>{if(session.stage==='empty'){session.options.charge=charge.value as Charge;refreshRun();}},{signal});
  material.addEventListener('change',()=>{if(['empty','powder'].includes(session.stage)){session.options.material=material.value as Material;refreshRun();}},{signal});
  axis.addEventListener('change',()=>{session.axis=axis.value as 'time'|'travel';prepareGraph();draw();},{signal});
  scrub.addEventListener('input',()=>{stop();session.time=Number(scrub.value)/1000*run.endTime;draw();},{signal});
  const seekChart=(event:PointerEvent)=> {
    if(session.stage!=='shot') return;
    stop();const point=chart.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
    const local=point.matrixTransform(chart.getScreenCTM()!.inverse()),fraction=clamp((local.x-graph.left)/graph.width);
    session.time=session.axis==='time'?Math.min(run.endTime,fraction*CANNON_SCALES.time):timeAtTravel(run,fraction);draw();
  };
  installChartScrubbing(chart, seekChart, signal);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();draw();}},{signal});
  showSound();
  prepareGraph();draw();
  return { dispose:()=> {stop();focus.close();disposed=true;abort.abort();audio.dispose();return {...session,options:{...session.options},playing:false};} };
}
