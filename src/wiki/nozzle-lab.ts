import { NOZZLE_DEFAULTS, NOZZLE_PROPELLANTS, NOZZLE_LIMITS, nozzlePerformance, normaliseNozzle, optimiseNozzle, chamberPressureTip, nozzleMach, pressureRatio, type NozzleSettings } from './nozzle-model.ts';
import { NOZZLE_TOPICS, type NozzleTopic } from './nozzle-reading.ts';
import { control as button } from './exhibit-controls.ts';
import './nozzle-lab.css';

export interface NozzleSession {settings:NozzleSettings;open:boolean;tab:'experiment'|'info';topic:NozzleTopic;level:number}
const fresh=():NozzleSession=>({settings:{...NOZZLE_DEFAULTS},open:false,tab:'experiment',topic:'propellant',level:0});
const f=(n:number,d=1)=>n.toLocaleString('en-GB',{maximumFractionDigits:d,minimumFractionDigits:d});
const help=(topic:NozzleTopic)=>`<span class="nozzle-help"><button type="button" class="nozzle-help-button" aria-label="Help with ${NOZZLE_TOPICS[topic].name.toLowerCase()}" aria-describedby="nozzle-tip-${topic}">?</button><span role="tooltip" id="nozzle-tip-${topic}">${NOZZLE_TOPICS[topic].tip}</span></span>`;
const control=(key:'pressure'|'throat'|'expansion'|'mixture',name:string,unit:string)=>{
  const limits=key==='mixture'?[2,5]:NOZZLE_LIMITS[key],step=key==='mixture'?.05:key==='expansion'?.01:1;
  return `<div class="nozzle-control"><div class="nozzle-control-title"><label for="nozzle-${key}">${name}</label>${help(key)}</div><div class="nozzle-number"><input id="nozzle-${key}" data-nozzle-number="${key}" type="number" min="${limits[0]}" max="${limits[1]}" step="${step}" value="${NOZZLE_DEFAULTS[key]}"><span>${unit}</span></div><input type="range" data-nozzle-range="${key}" min="${limits[0]}" max="${limits[1]}" step="${step}" value="${NOZZLE_DEFAULTS[key]}" aria-label="${name}"></div>`;
};
export function nozzleLabMarkup(){return `<details class="nozzle-lab"><summary><span><small>GO A LITTLE FURTHER</small><strong>Advanced nozzle lab</strong></span><span class="nozzle-expand">Explore settings <span aria-hidden="true">＋</span></span></summary><div class="nozzle-body">
  <p class="nozzle-intro">Hold the engine still and explore the nozzle. These steady-state estimates use real units; the travelling rocket above remains a separate, simple momentum experiment.</p>
  <div class="nozzle-tabs" role="tablist" aria-label="Advanced nozzle lab"><button type="button" role="tab" id="nozzle-experiment-tab" aria-controls="nozzle-experiment-panel" aria-selected="true" data-nozzle-tab="experiment">Experiment</button><button type="button" role="tab" id="nozzle-info-tab" aria-controls="nozzle-info-panel" aria-selected="false" tabindex="-1" data-nozzle-tab="info">Advanced info</button></div>
  <div role="tabpanel" id="nozzle-experiment-panel" aria-labelledby="nozzle-experiment-tab"><div class="nozzle-settings">
    <div class="nozzle-control nozzle-pair"><div class="nozzle-control-title"><label for="nozzle-propellant">Propellant pair</label>${help('propellant')}</div><select id="nozzle-propellant">${Object.entries(NOZZLE_PROPELLANTS).map(([id,p])=>`<option value="${id}">${p.name}</option>`).join('')}</select><p data-nozzle-pair-note></p></div>
    ${control('pressure','Chamber pressure','bar')}${control('throat','Throat diameter','mm')}${control('expansion','Expansion ratio','area : 1')}${control('mixture','Oxidiser / fuel','mass : 1')}
  </div><div class="nozzle-auto"><label>Surroundings<select data-nozzle-ambient><option value="air">Sea-level air · 1.013 bar</option><option value="vacuum">Vacuum · 0 bar</option></select></label><button type="button" data-nozzle-auto="air">Auto for air <span>Match expansion & mixture</span></button><button type="button" data-nozzle-auto="vacuum">Auto for vacuum <span>Match expansion & mixture</span></button></div>
  <p class="nozzle-auto-result" data-nozzle-auto-result role="status" aria-live="polite">Auto adjusts expansion and mixture for the selected environment, keeping pressure and throat diameter.</p>
  <div class="nozzle-pressure-note"><strong data-nozzle-pressure-heading></strong><p data-nozzle-pressure-tip></p><div class="nozzle-pressure-scale" aria-label="Historical chamber pressures and the model limit"><span>F-1 ≈ 78 bar</span><span>Shuttle SSME ≈ 207 bar</span><span>Model upper limit: 350 bar</span></div></div>
  <div class="nozzle-results"><div class="nozzle-drawing"><svg data-nozzle-scene viewBox="0 0 760 315" role="img" aria-labelledby="nozzle-scene-title nozzle-scene-description"></svg><p data-nozzle-regime></p></div><dl class="nozzle-metrics"><div><dt>Thrust</dt><dd data-nozzle-result="thrust"></dd><small>The engine’s push</small></div><div><dt>Specific impulse</dt><dd data-nozzle-result="isp"></dd><small>More impulse per kilogram</small></div><div><dt>Propellant flow</dt><dd data-nozzle-result="flow"></dd><small>Fuel + oxidiser each second</small></div><div><dt>Exhaust speed</dt><dd data-nozzle-result="speed"></dd><small>At the useful nozzle exit</small></div></dl></div>
  <div class="nozzle-profile"><div><h3>From pressure to motion</h3><p><span class="nozzle-gold">● Pressure / chamber pressure</span><span class="nozzle-teal">● Gas speed / useful-exit speed</span></p></div><svg data-nozzle-profile viewBox="0 0 760 205" role="img" aria-label="Pressure falls and gas speed rises along the nozzle"></svg><p class="nozzle-profile-note">Position along the schematic, not time. Both curves have their own relative scale. The plot stops at the estimated separation point when flow detaches.</p></div>
  <p class="nozzle-limit">An ideal-gas nozzle with approximate gas properties and an <strong>illustrative mixture curve</strong>. Estimates omit cooling, pumps, nozzle weight and detailed chemistry. Auto maximises specific impulse within this model’s limits; it does not reproduce a particular engine.</p><button type="button" data-nozzle-reset class="nozzle-reset">${button('reset','Reset Advanced Settings')}</button>
  </div><div role="tabpanel" id="nozzle-info-panel" aria-labelledby="nozzle-info-tab" hidden><div class="nozzle-info-choices"><label>Explore a setting<select data-nozzle-topic>${Object.entries(NOZZLE_TOPICS).map(([id,t])=>`<option value="${id}">${t.name}</option>`).join('')}</select></label><div class="nozzle-depth" role="group" aria-label="Advanced information reading level">${['First look','Explore','A little deeper'].map((name,i)=>`<button type="button" data-nozzle-level="${i}" aria-pressed="${i===0}"><span>0${i+1}</span> ${name}</button>`).join('')}</div></div><section class="nozzle-reading" data-nozzle-reading aria-live="polite"></section><p class="nozzle-info-note">Start wherever you feel comfortable. First look is written for curious readers around 10–12; A little deeper builds towards pre-degree science.</p></div>
  <footer class="nozzle-sources"><span>Explore the evidence</span><a href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/nozzle-design/" target="_blank" rel="noopener noreferrer">NASA · Nozzle science ↗</a><a href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/" target="_blank" rel="noopener noreferrer">NASA · Specific impulse ↗</a><a href="https://www.nasa.gov/wp-content/uploads/2023/04/sp-4545.pdf#page=107" target="_blank" rel="noopener noreferrer">NASA · F-1 history & data ↗</a><a href="https://ntrs.nasa.gov/api/citations/19780003243/downloads/19780003243.pdf#page=29" target="_blank" rel="noopener noreferrer">NASA · Shuttle engine data ↗</a><a href="https://ntrs.nasa.gov/citations/19780022611" target="_blank" rel="noopener noreferrer">NASA · Nozzle separation research ↗</a></footer>
</div></details>`;}

export function mountNozzleLab(root:HTMLDetailsElement,saved?:NozzleSession){
  const s=saved?{...saved,settings:normaliseNozzle(saved.settings)}:fresh();
  const abort=new AbortController(),signal=abort.signal;
  const el=<T extends Element=HTMLElement>(q:string)=>root.querySelector<T>(q)!;
  function diagram(){
    const p=nozzlePerformance(s.settings),eps=s.settings.expansion;
    const rt=Math.min(12+s.settings.throat*.03,108/Math.sqrt(eps)),re=rt*Math.sqrt(eps),rc=Math.max(48,rt*3.4);
    const stations=[...Array.from({length:81},(_,i)=>70+i*7),320].sort((a,b)=>a-b).map(x=>{const frac=(x-320)/310;
      const r=x<=220?rc:x<320?rt+(rc-rt)*Math.cos((x-220)/100*Math.PI/2)**2:rt+(re-rt)*(Math.max(0,frac)**.72);
      const area=(r/rt)**2,mach=nozzleMach(area,p.gamma,x>=320);
      return {x,r,mach,pressure:pressureRatio(mach,p.gamma)};});
    const upper=stations.map((v,i)=>`${i?'L':'M'}${v.x} ${157-v.r}`).join(' '),lower=[...stations].reverse().map(v=>`L${v.x} ${157+v.r}`).join(' ');
    const useful=stations.filter(v=>v.x<320||v.mach<=p.mach+1e-7);
    const end=useful[useful.length-1],sepX=p.separated?end.x:630;
    const regime=p.separated?'Overexpanded · flow separation estimated':p.pa===0?'Vacuum · exhaust continues expanding':Math.abs(p.idealPe/p.pa-1)<.025?'Matched · exit pressure ≈ surrounding air':p.idealPe>p.pa?'Underexpanded · gas can expand further':'Overexpanded · air squeezes the exhaust';
    el('[data-nozzle-scene]').innerHTML=`<title id="nozzle-scene-title">${NOZZLE_PROPELLANTS[s.settings.propellant].short} engine nozzle in ${s.settings.ambient}</title><desc id="nozzle-scene-description">${regime}. Throat diameter ${f(s.settings.throat,0)} millimetres. Expansion ratio ${f(eps)}.</desc><defs><linearGradient id="nozzle-gas"><stop stop-color="#f6cb82"/><stop offset=".48" stop-color="#dfac68"/><stop offset="1" stop-color="#7dc4c2"/></linearGradient></defs><path d="${upper} ${lower} Z" fill="url(#nozzle-gas)" fill-opacity=".2" stroke="#d0ac77" stroke-width="7" stroke-linejoin="round"/><path d="M70 157H700m-13-7 13 7-13 7" stroke="#99d2ce" stroke-width="2" fill="none" stroke-dasharray="7 6"/>${[-.5,0,.5].map(v=>`<path d="M85 ${157+v*rc}Q250 ${157+v*rc} 320 ${157+v*rt}T630 ${157+v*re}" fill="none" stroke="url(#nozzle-gas)" stroke-width="2"/>`).join('')}
      <text x="80" y="28">CHAMBER</text><text x="320" y="28" text-anchor="middle">THROAT</text><text x="624" y="28" text-anchor="end">EXIT</text><path d="M320 42V${150-rt}" class="nozzle-guide"/><text x="100" y="151" class="nozzle-large">${f(s.settings.pressure,0)} bar</text><text x="320" y="272" text-anchor="middle">Mach 1</text><text x="624" y="272" text-anchor="end">${f(eps)} : 1 area</text><text x="80" y="302" class="nozzle-small">Schematic resizes to fit · shape illustrates area changes</text>${p.separated?`<path d="M${sepX} 53V252" stroke="#efb76e" stroke-dasharray="5 5"/><text x="${Math.min(sepX,510)}" y="290" class="nozzle-small">Estimated separation</text>`:''}`;
    const speed=(mach:number)=>mach/Math.sqrt(1+(p.gamma-1)/2*mach*mach),endSpeed=speed(p.mach);
    const path=(kind:'pressure'|'speed')=>useful.map((v,i)=>`${i?'L':'M'}${v.x} ${160-120*(kind==='pressure'?v.pressure:speed(v.mach)/endSpeed)}`).join(' ');
    el('[data-nozzle-profile]').innerHTML=`${[0,.5,1].map(v=>`<path d="M70 ${160-v*120}H630" class="nozzle-grid"/><text x="56" y="${165-v*120}" text-anchor="end">${v*100}%</text>`).join('')}<path d="M320 35V160" class="nozzle-guide"/><path d="${path('pressure')}" stroke="#edc885" class="nozzle-curve"/><path d="${path('speed')}" stroke="#83cecb" class="nozzle-curve"/><text x="70" y="193">Chamber</text><text x="320" y="193" text-anchor="middle">Throat</text><text x="630" y="193" text-anchor="end">Exit</text>${p.separated?`<path d="M${sepX} 35V160" class="nozzle-guide"/>`:''}`;
    el('[data-nozzle-regime]').textContent=`${regime}. ${p.separated?'Useful-flow':'Exit'} pressure ≈ ${f(p.pe/1e5,2)} bar.`;
    el('[data-nozzle-regime]').classList.toggle('is-warning',p.separated);
    for(const [key,value] of Object.entries({thrust:`${f(p.thrust/1000)} kN`,isp:`${f(p.isp,0)} s`,flow:`${f(p.flow)} kg/s`,speed:`${f(p.exhaustSpeed/1000,2)} km/s`}))el(`[data-nozzle-result="${key}"]`).textContent=value;
  }
  function draw(editing?:HTMLInputElement){
    const p=NOZZLE_PROPELLANTS[s.settings.propellant];
    el<HTMLSelectElement>('#nozzle-propellant').value=s.settings.propellant;el<HTMLSelectElement>('[data-nozzle-ambient]').value=s.settings.ambient;
    for(const key of ['pressure','throat','expansion','mixture'] as const)for(const kind of ['number','range']){const input=el<HTMLInputElement>(`[data-nozzle-${kind}="${key}"]`);if(key==='mixture'){input.min=String(p.min);input.max=String(p.max);}if(input!==editing)input.value=String(Number(s.settings[key].toFixed(2)));}
    el('[data-nozzle-pair-note]').textContent=p.note;el('[data-nozzle-pressure-heading]').textContent=`${f(s.settings.pressure,0)} bar · ${s.settings.pressure>=300?'an extreme comparison point':'put it in perspective'}`;el('[data-nozzle-pressure-tip]').textContent=chamberPressureTip(s.settings.pressure);
    diagram();
  }
  function reading(){const r=NOZZLE_TOPICS[s.topic].levels[s.level];el<HTMLSelectElement>('[data-nozzle-topic]').value=s.topic;el('[data-nozzle-reading]').innerHTML=`<h3>${r[0]}</h3>${r.slice(1).map(paragraph=>`<p>${paragraph}</p>`).join('')}`;root.querySelectorAll<HTMLButtonElement>('[data-nozzle-level]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.nozzleLevel)===s.level)));}
  function tab(){for(const name of ['experiment','info']){const active=name===s.tab,b=el<HTMLButtonElement>(`[data-nozzle-tab="${name}"]`);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;el<HTMLElement>(`#nozzle-${name}-panel`).hidden=!active;}}
  const clearAuto=()=>{el('[data-nozzle-auto-result]').textContent='Manual settings · Auto can match expansion and mixture again. Pressure and throat size stay as you set them.';};
  root.addEventListener('input',event=>{const input=event.target as HTMLInputElement,key=input.dataset.nozzleRange||input.dataset.nozzleNumber;if(!key)return;
    // Let a number be typed without replacing a partially entered value. Valid
    // values update immediately; a committed out-of-range value is clamped.
    if(input.value===''||!Number.isFinite(Number(input.value)))return;
    s.settings=normaliseNozzle({...s.settings,[key]:Number(input.value)});draw(input);clearAuto();},{signal});
  root.addEventListener('change',event=>{const input=event.target as HTMLInputElement,key=input.dataset.nozzleNumber;
    if(key){s.settings=normaliseNozzle({...s.settings,[key]:input.value===''?NaN:Number(input.value)});draw();clearAuto();}
    else if(input.id==='nozzle-propellant'){const propellant=input.value as NozzleSettings['propellant'];s.settings=normaliseNozzle({...s.settings,propellant,mixture:NOZZLE_PROPELLANTS[propellant].optimum});draw();clearAuto();}
    else if(input.hasAttribute('data-nozzle-ambient')){s.settings.ambient=input.value as NozzleSettings['ambient'];draw();clearAuto();}
    else if(input.hasAttribute('data-nozzle-topic')){s.topic=input.value as NozzleTopic;reading();}
  },{signal});
  root.addEventListener('click',event=>{const b=(event.target as Element).closest<HTMLButtonElement>('button');if(!b)return;
    if(b.dataset.nozzleAuto){s.settings=optimiseNozzle(s.settings,b.dataset.nozzleAuto as NozzleSettings['ambient']);draw();el('[data-nozzle-auto-result]').textContent=`${s.settings.ambient==='air'?'Sea-level pressure match':'Vacuum: maximum allowed expansion'} · area ratio ${f(s.settings.expansion)}, O/F ${f(s.settings.mixture,2)}. ${s.settings.ambient==='vacuum'?'Nozzle weight is omitted, so this ideal model favours the upper bound of 200. ':''}Mixture uses the peak of the illustrative curve; it is not a measured engine optimum.`;}
    else if(b.dataset.nozzleTab){s.tab=b.dataset.nozzleTab as NozzleSession['tab'];tab();}
    else if(b.dataset.nozzleLevel){s.level=Number(b.dataset.nozzleLevel);reading();}
    else if(b.hasAttribute('data-nozzle-reset')){s.settings={...NOZZLE_DEFAULTS};draw();el('[data-nozzle-auto-result]').textContent='Advanced settings reset. The travelling rocket experiment is unchanged.';}
    else if(b.classList.contains('nozzle-help-button'))b.parentElement!.classList.toggle('is-open');
  },{signal});
  root.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.querySelector('.nozzle-help:focus-within,.nozzle-help.is-open')){event.preventDefault();event.stopPropagation();root.querySelectorAll('.nozzle-help').forEach(e=>e.classList.remove('is-open'));(document.activeElement as HTMLElement)?.blur();}
    if((event.target as HTMLElement).hasAttribute('data-nozzle-tab')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();s.tab=event.key==='Home'?'experiment':event.key==='End'?'info':s.tab==='info'?'experiment':'info';tab();el<HTMLButtonElement>(`[data-nozzle-tab="${s.tab}"]`).focus();}
  },{signal});
  root.addEventListener('focusout',event=>{const target=event.target as HTMLInputElement,tip=target.closest('.nozzle-help');if(tip&&!tip.contains(event.relatedTarget as Node))tip.classList.remove('is-open');
    if(target.dataset.nozzleNumber){s.settings=normaliseNozzle({...s.settings,[target.dataset.nozzleNumber]:target.value===''?NaN:Number(target.value)});draw();}
  },{signal});
  root.open=s.open;root.addEventListener('toggle',()=>{s.open=root.open;},{signal});draw();tab();reading();
  return {dispose:()=>{s.open=root.open;abort.abort();return {...s,settings:{...s.settings}};}};
}
