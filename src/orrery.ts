import './orrery.css';
import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { WORLDS, MOONS, moonOrbitRadius, BELTS, NORMAL_RADII, DAY_MS, YEAR_DAYS, MIN_DATE, MAX_DATE, TAU, mix, seeded,
  elementsAt, positionFromElements, positionAt, displayPosition, diameterAt, spinAt, outerRadius,
  daysSinceJ2000, advanceTime, type World } from './orrery-model.ts';
import { PlanetSurface, haloTexture, ringTexture } from './orrery-textures.ts';

const ALL_WORLDS=[...WORLDS,...MOONS];

let activeDialog:HTMLDialogElement|undefined;
export const isOrreryOpen=()=>!!activeDialog?.open;
const localInput=(ms:number)=>{const d=new Date(ms);return new Date(ms-d.getTimezoneOffset()*60000).toISOString().slice(0,19);};
const dateFormat=new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'2-digit'});
const timeFormat=new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
const circlePoints=(n:number)=>Array.from({length:n},(_,i)=>i/n*TAU);

export function installOrrery(onOpen:()=>void) {
  if(activeDialog)return;
  const opener=document.querySelector<HTMLButtonElement>('#open-orrery')!;
  const dialog=document.createElement('dialog');dialog.id='solar-orrery';dialog.className='orrery-dialog';dialog.setAttribute('aria-labelledby','orrery-title');
  dialog.innerHTML=`<header class="orrery-header"><div class="orrery-brand"><span class="orrery-emblem" aria-hidden="true">◎</span><div><p class="orrery-kicker">LAUNCH LAB / CELESTIAL MECHANICS</p><h1 id="orrery-title">The Orrery<span>A moving solar system.</span></h1></div></div><button type="button" class="orrery-close">↙ Back to the lab</button></header>
    <section class="orrery-stage" aria-label="Interactive three dimensional solar system">
      <div class="orrery-render"></div><canvas class="orrery-leaders" aria-hidden="true"></canvas><div class="orrery-labels"></div>
      <div class="orrery-view-tools" role="group" aria-label="View controls"><button type="button" class="orrery-home" data-view="home" title="Restore the original view" aria-label="Restore the original view"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/></svg></button><button type="button" data-view="fit" title="Re-centre and fit the complete solar system at the current angle">Fit system</button><button type="button" data-view="top">Top</button><button type="button" data-view="edge">Edge</button><span class="orrery-tool-divider"></span><label><input id="orrery-label-toggle" type="checkbox" checked> Labels</label><label><input id="orrery-orbit-toggle" type="checkbox" checked> Orbits</label></div>
      <aside class="orrery-info" hidden aria-label="Selected world"><button class="orrery-info-close" type="button" aria-label="Close world details">×</button><p class="orrery-kicker" id="orrery-kind"></p><h2></h2><dl></dl><p class="orrery-info-note"></p><button type="button" class="orrery-focus">View close-up</button></aside>
      <div class="orrery-stage-foot"><span>Drag to turn freely <b>·</b> Scroll to zoom <b>·</b> Right-drag to pan</span><span id="orrery-mode-note">Evenly spaced display</span></div>
      <p class="orrery-error" role="alert" hidden></p>
    </section>
    <footer class="orrery-controls">
      <div class="orrery-transport"><div class="orrery-time"><p class="orrery-kicker">SIMULATION TIME <span id="orrery-zone"></span></p><div><output id="orrery-live-date"></output><output id="orrery-live-time"></output></div></div>
      <div class="orrery-playback"><button type="button" id="orrery-play" class="orrery-primary">Ⅱ Pause</button><button type="button" id="orrery-direction" title="Reverse time" aria-pressed="false">Forward →</button><label class="orrery-speed-label">Speed<select id="orrery-speed" aria-label="Simulation speed"><option value="real">Real time</option><option value="0.002737850787">1 day / minute</option><option value="week">1 week / minute</option><option value="0.083333333333">1 month / minute</option><option value="1" selected>1 year / minute</option><option value="10">10 years / minute</option><option value="100">100 years / minute</option></select></label></div>
      <label class="orrery-inspect-label">Explore<select id="orrery-inspect" aria-label="Inspect a world"><option value="">Choose a world…</option>${ALL_WORLDS.map(w=>`<option value="${w.id}">${w.name}</option>`).join('')}${BELTS.map(b=>`<option value="${b.id}">${b.name}</option>`).join('')}</select></label></div>
      <div class="orrery-adjustments"><form class="orrery-date-form"><label for="orrery-date">Go to date & time <small>(local)</small></label><div><input type="datetime-local" step="1" id="orrery-date" required aria-describedby="orrery-date-note"><button type="submit" title="Jump to the selected date and pause">Set date</button><button type="button" id="orrery-now">Now</button></div><span id="orrery-date-note">Supported dates: 1000–3000</span></form>
      <div class="orrery-scale-control"><div><label for="orrery-scale">Distance & size</label><output for="orrery-scale" id="orrery-scale-value">Even spacing</output></div><input id="orrery-scale" type="range" min="0" max="100" value="100" step="1" aria-label="Solar system distance and planet size scale"><div class="orrery-scale-ends"><button type="button" data-scale="0">True scale</button><span>Same orbital clock. A different perspective.</span><button type="button" data-scale="100">Even spacing</button></div></div></div>
      <div class="orrery-bottom"><p id="orrery-status" role="status">Running · 1 Earth year every minute</p><details class="orrery-model-note"><summary>About the model</summary><div><strong>A date-driven Keplerian orrery</strong><p>Elliptical, inclined orbits use <a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noreferrer">JPL approximate orbital elements</a> for 1000–3000. Earth represents the Earth–Moon barycentre; Pluto uses the original JPL elements. UTC approximates dynamical time.</p><p>Even spacing preserves orbital angles and timing, while circularising distances into separated lanes. Sizes are enlarged: Sun 3× Earth; Jupiter 2×. Saturn’s rings and moon systems count towards the clear gaps.</p><p>Surface spins use <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/" target="_blank" rel="noreferrer">NASA rotation periods</a> and axial tilts; texture meridians and axial longitudes are illustrative. Belt particles are representative circular Kepler orbits, not individual tracked asteroids. The Moon, Ganymede and Charon use representative circular orbits with measured mean distances and periods; their phases and planes are illustrative. Surface maps are original illustrations, not measured cartography. Ambient studio lighting keeps every world visible.</p></div></details></div>
    </footer>`;
  document.body.append(dialog);
  const $=<T extends HTMLElement>(selector:string)=>dialog.querySelector<T>(selector)!;
  const mount=$<HTMLDivElement>('.orrery-render'), stage=$<HTMLElement>('.orrery-stage');
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(error){dialog.remove();throw error;}
  activeDialog=dialog;
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(1,1,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000);mount.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Animated solar system. Use the Explore menu for world information.');
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x000000);
  const camera=new THREE.OrthographicCamera(-60,60,40,-40,.01,2000);camera.position.set(0,100,90);camera.lookAt(0,0,0);scene.add(camera);
  // Stable illumination: neither brightness nor colour depends on solar distance.
  scene.add(new THREE.AmbientLight(0xffffff,2));
  const studio=new THREE.DirectionalLight(0xe8f2ff,1.05);studio.position.set(-40,60,80);camera.add(studio);
  const controls=new TrackballControls(camera,renderer.domElement);controls.rotateSpeed=2.6;controls.zoomSpeed=1.15;controls.noPan=true;controls.staticMoving=true;controls.minZoom=.35;controls.maxZoom=45;
  // CAD-style pan: a point in the scene follows the mouse pixel for pixel,
  // independent of zoom, viewport shape, camera roll or distance to the target.
  let pan:{pointerId:number;x:number;y:number}|undefined;
  let following='';
  const panRight=new THREE.Vector3(),panUp=new THREE.Vector3(),panDelta=new THREE.Vector3();
  const overViewUI=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('.orrery-view-tools, .orrery-info');
  stage.addEventListener('pointerdown',event=>{
    if(event.button!==2||overViewUI(event.target))return;
    event.preventDefault();event.stopPropagation();
    following='';
    pan={pointerId:event.pointerId,x:event.clientX,y:event.clientY};
    stage.setPointerCapture(event.pointerId);stage.classList.add('orrery-panning');
  },true);
  stage.addEventListener('pointermove',event=>{
    if(!pan||pan.pointerId!==event.pointerId)return;
    event.preventDefault();event.stopPropagation();
    const dx=event.clientX-pan.x,dy=event.clientY-pan.y;pan.x=event.clientX;pan.y=event.clientY;
    camera.updateMatrixWorld();
    panRight.setFromMatrixColumn(camera.matrixWorld,0);panUp.setFromMatrixColumn(camera.matrixWorld,1);
    panDelta.copy(panRight).multiplyScalar(-dx*(camera.right-camera.left)/(camera.zoom*stage.clientWidth));
    panDelta.addScaledVector(panUp,dy*(camera.top-camera.bottom)/(camera.zoom*stage.clientHeight));
    camera.position.add(panDelta);controls.target.add(panDelta);
  },true);
  function endPan(event?:PointerEvent){
    if(!pan||(event&&pan.pointerId!==event.pointerId))return;
    event?.stopPropagation();
    const pointerId=pan.pointerId;pan=undefined;stage.classList.remove('orrery-panning');
    if(stage.hasPointerCapture(pointerId))stage.releasePointerCapture(pointerId);
  }
  stage.addEventListener('pointerup',endPan,true);stage.addEventListener('pointercancel',endPan,true);stage.addEventListener('lostpointercapture',endPan,true);
  window.addEventListener('blur',()=>endPan());
  stage.addEventListener('contextmenu',event=>{if(!overViewUI(event.target))event.preventDefault();});
  // Capture above the canvas so hovering a clickable planet label cannot swallow
  // wheel events. Exponential zoom gives equal steps at every magnification.
  stage.addEventListener('wheel',event=>{
    if(event.target instanceof Element&&event.target.closest('.orrery-view-tools, .orrery-info'))return;
    event.preventDefault();event.stopPropagation();
    const unit=event.deltaMode===WheelEvent.DOM_DELTA_LINE?16:event.deltaMode===WheelEvent.DOM_DELTA_PAGE?stage.clientHeight:1;
    const delta=THREE.MathUtils.clamp(event.deltaY*unit,-500,500);
    camera.zoom=THREE.MathUtils.clamp(camera.zoom*Math.exp(-delta*.0025),controls.minZoom,controls.maxZoom);
    camera.updateProjectionMatrix();
  },{passive:false,capture:true});
  const labelCanvas=$<HTMLCanvasElement>('.orrery-leaders'), ink=labelCanvas.getContext('2d')!;
  const slider=$<HTMLInputElement>('#orrery-scale'),labelToggle=$<HTMLInputElement>('#orrery-label-toggle'),orbitToggle=$<HTMLInputElement>('#orrery-orbit-toggle');
  const dateInput=$<HTMLInputElement>('#orrery-date'),play=$<HTMLButtonElement>('#orrery-play'),status=$<HTMLElement>('#orrery-status');
  dateInput.min=localInput(MIN_DATE);dateInput.max=localInput(MAX_DATE);
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  $('#orrery-zone').textContent=` / ${timezone.replace(/_/g,' ')}`;
  let amount=1,simulation=Date.now(),running=true,rate=1,direction=1,dateDirty=false,selected='';
  let width=1,height=1,frame=0,last:number|undefined,lastUI=0,orbitEpoch=NaN,orbitScale=NaN;
  let renderedDate=NaN,renderedAmount=NaN;
  let labelsVisible=true,orbitsVisible=true,firstOpen=true;
  const pointsPerOrbit=256;
  const orbitAngles=circlePoints(pointsPerOrbit);
  const sphereGeometry=new THREE.SphereGeometry(.5,96,64);
  type Target={id:string;name:string;colour:string;position:THREE.Vector3;radius:number;label:HTMLButtonElement};
  type Planet={world:World;root:THREE.Group;tilt:THREE.Group;mesh:THREE.Mesh;surface:PlanetSurface;orbit?:THREE.LineLoop;target:Target;real:[number,number,number];halo?:THREE.Sprite};
  const targets:Target[]=[],planets:Planet[]=[];
  function makeTarget(id:string,name:string,colour:string):Target {
    const label=document.createElement('button');label.type='button';label.className='orrery-world-label';label.textContent=name;label.style.setProperty('--world-colour',colour);label.setAttribute('aria-label',`Explore ${name}`);label.onclick=()=>inspect(id);$('.orrery-labels').append(label);
    const target={id,name,colour,position:new THREE.Vector3(),radius:0,label};targets.push(target);return target;
  }
  for(const world of ALL_WORLDS){
    const root=new THREE.Group(),tilt=new THREE.Group();root.add(tilt);scene.add(root);tilt.rotation.z=world.tilt*Math.PI/180;
    const surface=new PlanetSurface(world,Math.min(8,renderer.capabilities.getMaxAnisotropy()));
    const mesh=new THREE.Mesh(sphereGeometry,surface.material);tilt.add(mesh);
    const target=makeTarget(world.id,world.name,world.colour),planet:Planet={world,root,tilt,mesh,surface,target,real:[0,0,0]};
    if(world.id==='saturn'){
      const geometry=new THREE.RingGeometry(.63,1.15,128),uv=geometry.getAttribute('uv'),pos=geometry.getAttribute('position');
      for(let i=0;i<uv.count;i++)uv.setXY(i,(Math.hypot(pos.getX(i),pos.getY(i))-.63)/.52,.5);
      const ring=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:ringTexture(),side:THREE.DoubleSide,transparent:true,depthWrite:false}));ring.rotation.x=-Math.PI/2;tilt.add(ring);
    }
    if(world.id==='sun'){
      const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTexture(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));root.add(halo);halo.scale.setScalar(2.15);planet.halo=halo;
    }else{
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pointsPerOrbit*3),3));
      planet.orbit=new THREE.LineLoop(geo,new THREE.LineBasicMaterial({color:world.colour,transparent:true,opacity:.23,depthWrite:false}));planet.orbit.frustumCulled=false;scene.add(planet.orbit);
      if(world.satellite){
        const attribute=geo.getAttribute('position');
        orbitAngles.forEach((angle,i)=>attribute.setXYZ(i,Math.cos(angle),0,-Math.sin(angle)));
        planet.orbit.rotation.z=world.satellite.inclination*Math.PI/180;
      }
    }
    planets.push(planet);
  }
  const beltObjects=BELTS.map((belt,index)=>{
    const random=seeded(801+index*211),data=Array.from({length:belt.count},()=>{
      const a=mix(belt.inner,belt.outer,random());
      return {a,phase:random()*TAU,node:random()*TAU,inclination:random()**2*(index?.19:.11),motion:TAU/(365.256*Math.pow(a,1.5)),fraction:(a-belt.inner)/(belt.outer-belt.inner)};
    });
    const array=new Float32Array(belt.count*3),colours=new Float32Array(belt.count*3),colour=new THREE.Color(belt.colour);
    for(let i=0;i<belt.count;i++){const shade=.38+random()*.62;colours[i*3]=colour.r*shade;colours[i*3+1]=colour.g*shade;colours[i*3+2]=colour.b*shade;}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(array,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('color',new THREE.BufferAttribute(colours,3));
    const points=new THREE.Points(geo,new THREE.PointsMaterial({size:index?1.15:1.45,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.85,depthWrite:false}));points.frustumCulled=false;scene.add(points);
    return {belt,data,array,points,target:makeTarget(belt.id,belt.name,belt.colour)};
  });
  // A restrained, fixed star field; its shell always lies beyond the model.
  const random=seeded(744),stars=new Float32Array(1100*3);
  for(let i=0;i<1100;i++){const z=random()*2-1,a=random()*TAU,r=Math.sqrt(1-z*z);stars[i*3]=r*Math.cos(a)*600;stars[i*3+1]=z*600;stars[i*3+2]=r*Math.sin(a)*600;}
  const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.BufferAttribute(stars,3));
  scene.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#a3b4cc',size:1,sizeAttenuation:false,transparent:true,opacity:.34,depthWrite:false})));

  function inspect(id:string){
    selected=id;$<HTMLSelectElement>('#orrery-inspect').value=id;const pane=$<HTMLElement>('.orrery-info');pane.hidden=!id;
    targets.forEach(t=>{t.label.classList.toggle('selected',t.id===id);t.label.setAttribute('aria-pressed',String(t.id===id));});
    planets.forEach(p=>{if(p.orbit)(p.orbit.material as THREE.LineBasicMaterial).opacity=id===p.world.id?.65:.23;});
    if(!id)return;
    const world=ALL_WORLDS.find(w=>w.id===id),belt=BELTS.find(b=>b.id===id);
    $('.orrery-focus').hidden=!world;
    $('.orrery-info h2').textContent=world?.name??belt!.name;
    $('#orrery-kind').textContent=belt?'SMALL-BODY REGION':world?.satellite?`MOON OF ${WORLDS.find(w=>w.id===world.satellite!.parent)!.name.toUpperCase()}`:id==='sun'?'OUR STAR':id==='pluto'?'DWARF PLANET':'PLANET';
    const year=world?.satellite?world.satellite.periodDays/YEAR_DAYS:world?.elements?360/world.rates![3]*36525/YEAR_DAYS:0;
    $('.orrery-info dl').innerHTML=belt?`<div><dt>Solar distance</dt><dd>${belt.inner}–${belt.outer} AU</dd></div><div><dt>Model particles</dt><dd>${belt.count.toLocaleString()}</dd></div>`:`<div><dt>Solar distance</dt><dd id="orrery-distance"></dd></div>${year?`<div><dt>Orbit</dt><dd>${year<2?(year*YEAR_DAYS).toFixed(1)+' days':year.toFixed(1)+' years'}</dd></div>`:''}<div><dt>Axial rotation</dt><dd>${world!.spinHours>48?(world!.spinHours/24).toFixed(2)+' days':world!.spinHours.toFixed(2)+' hours'}</dd></div>`;
    $('.orrery-info-note').textContent=belt?'Representative particles orbit the Sun at speeds set by their distance.':world!.tilt>90?'A retrograde spinner: its rotation axis leans beyond 90°.':id==='earth'?'Our home, with an axis tilted by 23.4°.':id==='sun'?'A rotating star. All worlds share steady ambient lighting.':`Axial tilt ${world!.tilt}°. Select another world to compare.`;
    if(world?.satellite){
      $('.orrery-info dl').innerHTML=`<div><dt>Parent distance</dt><dd>${world.satellite.distanceKm.toLocaleString()} km</dd></div><div><dt>Orbit / rotation</dt><dd>${world.satellite.periodDays.toFixed(3)} days</dd></div>`;
      $('.orrery-info-note').textContent='A synchronously rotating moon. This representative circular orbit uses its measured mean period; its phase and plane are illustrative.';
    }
    updateUI();
  }
  function updateUI(){
    const date=new Date(simulation);$('#orrery-live-date').textContent=dateFormat.format(date);$('#orrery-live-time').textContent=timeFormat.format(date);
    if(!dateDirty&&document.activeElement!==dateInput)dateInput.value=localInput(simulation);
    play.textContent=running?'Ⅱ Pause':'▶ Play';play.setAttribute('aria-label',running?'Pause orrery':'Play orrery');
    const distance=$<HTMLElement>('#orrery-distance');if(distance){const planet=planets.find(p=>p.world.id===selected);distance.textContent=planet?.world.id==='sun'?'Centre':`${Math.hypot(...positionAt(planet!.world,simulation)).toFixed(3)} AU`;}
  }
  function updateStatus(message?:string){status.textContent=message??`${running?'Running':'Paused'}${direction<0?' backwards':''} · ${$<HTMLSelectElement>('#orrery-speed').selectedOptions[0].text}`;}
  function updateOrbits(){
    if(Math.abs(simulation-orbitEpoch)<30*DAY_MS&&orbitScale===amount)return;
    orbitEpoch=simulation;orbitScale=amount;
    for(const p of planets){if(!p.orbit||p.world.satellite)continue;const e=elementsAt(p.world,simulation),attribute=p.orbit.geometry.getAttribute('position');
      orbitAngles.forEach((angle,i)=>{const v=displayPosition(positionFromElements(e,angle),p.world.id,amount);attribute.setXYZ(i,...v);});attribute.needsUpdate=true;
    }
  }
  function updateScene(){
    if(renderedDate===simulation&&renderedAmount===amount)return;
    renderedDate=simulation;renderedAmount=amount;
    for(const p of planets){
      const satellite=p.world.satellite;
      if(satellite){
        const parent=planets.find(parent=>parent.world.id===satellite.parent)!;
        const phase=spinAt(p.world,simulation)+satellite.phase,radius=moonOrbitRadius(p.world,amount),inc=satellite.inclination*Math.PI/180;
        p.root.position.set(Math.cos(phase)*radius*Math.cos(inc),Math.cos(phase)*radius*Math.sin(inc),-Math.sin(phase)*radius).add(parent.root.position);
        p.orbit!.position.copy(parent.root.position);p.orbit!.scale.setScalar(radius);
      }else{p.real=positionAt(p.world,simulation);p.root.position.set(...displayPosition(p.real,p.world.id,amount));}
      const diameter=diameterAt(p.world,amount);p.root.scale.setScalar(diameter);p.mesh.rotation.y=spinAt(p.world,simulation);
      if(satellite)p.mesh.rotation.y+=satellite.phase;
      p.target.position.copy(p.root.position);p.target.radius=diameter*.5*(p.world.id==='saturn'?2.3:1);
    }
    const days=daysSinceJ2000(simulation);
    for(const {belt,data,array,points,target} of beltObjects){
      for(let i=0;i<data.length;i++){
        const d=data[i],theta=d.phase+days*d.motion,r=mix(d.a,NORMAL_RADII[belt.id]+(d.fraction*2-1)*belt.halfWidth,amount);
        const inclination=mix(d.inclination,.012,amount),phase=theta-d.node;
        // Rotate a circular Kepler orbit through its own ascending node and inclination.
        const x=r*Math.cos(phase),z=r*Math.sin(phase),c=Math.cos(d.node),s=Math.sin(d.node);
        array[i*3]=x*c-z*Math.cos(inclination)*s;array[i*3+1]=z*Math.sin(inclination);array[i*3+2]=-(x*s+z*Math.cos(inclination)*c);
      }
      points.geometry.getAttribute('position').needsUpdate=true;
      const r=mix((belt.inner+belt.outer)/2,NORMAL_RADII[belt.id],amount),angle=belt.id==='kuiper'?2.35:.55;
      target.position.set(Math.cos(angle)*r,0,-Math.sin(angle)*r);target.radius=0;
    }
    updateOrbits();
    if(following){
      const focus=planets.find(p=>p.world.id===following)!;
      camera.position.add(focus.root.position.clone().sub(controls.target));controls.target.copy(focus.root.position);
    }
  }
  type Rect={x:number;y:number;w:number;h:number};
  const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.w+4&&a.x+a.w+4>b.x&&a.y<b.y+b.h+3&&a.y+a.h+3>b.y;
  function updateLabels(){
    ink.clearRect(0,0,width,height);if(!labelsVisible)return;
    const pxPerUnit=height/(camera.top-camera.bottom)*camera.zoom;
    const projected=targets.map(target=>{const p=target.position.clone().project(camera);return {target,x:(p.x+1)*width/2,y:(1-p.y)*height/2,z:p.z,r:target.radius*pxPerUnit};});
    const occupied:Rect[]=[{x:12,y:12,w:450,h:40},{x:0,y:height-35,w:width,h:35}];
    const pane=$<HTMLElement>('.orrery-info');if(!pane.hidden)occupied.push({x:pane.offsetLeft,y:pane.offsetTop,w:pane.offsetWidth,h:pane.offsetHeight});
    const bodyRects=projected.filter(p=>p.r>3).map(p=>({x:p.x-p.r,y:p.y-p.r,w:p.r*2,h:p.r*2}));
    projected.sort((a,b)=>Number(b.target.id===selected)-Number(a.target.id===selected)||b.r-a.r);
    for(const p of projected){
      const label=p.target.label;label.hidden=true;
      if(p.z< -1||p.z>1||p.x<0||p.x>width||p.y<0||p.y>height)continue;
      const w=p.target.name.length*6.6+18,h=23,gap=p.r+9;
      const candidates:Rect[]=[];
      for(const pad of [0,17,35])candidates.push({x:p.x+gap+pad,y:p.y-h/2,w,h},{x:p.x-w/2,y:p.y-gap-h-pad,w,h},{x:p.x-gap-w-pad,y:p.y-h/2,w,h},{x:p.x-w/2,y:p.y+gap+pad,w,h});
      const rect=candidates.find(r=>r.x>=10&&r.y>=10&&r.x+r.w<=width-10&&r.y+r.h<=height-12&&!occupied.some(o=>overlaps(r,o))&&!bodyRects.some(o=>overlaps(r,o)));
      if(!rect)continue;
      occupied.push(rect);label.hidden=false;label.style.transform=`translate(${Math.round(rect.x)}px,${Math.round(rect.y)}px)`;
      const endX=Math.max(rect.x,Math.min(p.x,rect.x+rect.w)),endY=Math.max(rect.y,Math.min(p.y,rect.y+rect.h));
      const dx=endX-p.x,dy=endY-p.y,length=Math.hypot(dx,dy)||1;
      ink.strokeStyle=p.target.id===selected?'#eac58aaa':'#7e91a44a';ink.lineWidth=1;ink.beginPath();ink.moveTo(p.x+dx/length*(p.r+3),p.y+dy/length*(p.r+3));ink.lineTo(endX,endY);ink.stroke();
      if(p.r<2){ink.fillStyle=p.target.colour;ink.beginPath();ink.arc(p.x,p.y,1.5,0,TAU);ink.fill();}
    }
  }
  function resize(){
    width=Math.max(1,mount.clientWidth);height=Math.max(1,mount.clientHeight);
    renderer.setSize(width,height,false);const extent=outerRadius(amount)*1.13,aspect=width/height;
    const halfHeight=extent/Math.min(1,aspect);camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
    const dpr=Math.min(devicePixelRatio,2);labelCanvas.width=Math.round(width*dpr);labelCanvas.height=Math.round(height*dpr);ink.setTransform(dpr,0,0,dpr,0,0);controls.handleResize();
  }
  function fit(view?:string){
    following='';
    const offset=camera.position.clone().sub(controls.target),up=camera.up.clone();
    controls.reset();controls.target.set(0,0,0);camera.zoom=1;camera.up.set(0,1,0);
    if(view==='fit'){camera.position.copy(offset).setLength(150);camera.up.copy(up);}
    else if(view==='top'){camera.position.set(0,150,0);camera.up.set(0,0,-1);}else if(view==='edge')camera.position.set(0,0,150);else camera.position.set(0,100,90);
    camera.lookAt(0,0,0);camera.updateProjectionMatrix();controls.update();resize();
  }
  const observer=new ResizeObserver(()=>{if(dialog.open)resize();});
  function draw(now:number){
    if(!dialog.open){frame=0;return;}
    if(!document.hidden&&last!==undefined&&running){
      const next=advanceTime(simulation,(now-last)/1000,rate*direction);simulation=next;
      if(next===MIN_DATE||next===MAX_DATE){running=false;updateStatus('Date limit reached · choose a date between 1000 and 3000, or reverse time.');}
    }
    last=document.hidden?undefined:now;controls.update();updateScene();renderer.render(scene,camera);updateLabels();
    if(now-lastUI>200){
      updateUI();lastUI=now;
      const pixelsPerUnit=height/(camera.top-camera.bottom)*camera.zoom*renderer.getPixelRatio();
      for(const p of planets){
        const position=p.root.position.clone().project(camera),radius=diameterAt(p.world,amount)*pixelsPerUnit/2;
        const visible=position.z>=-1&&position.z<=1&&Math.abs(position.x)<=1+radius/(width/2)&&Math.abs(position.y)<=1+radius/(height/2);
        p.surface.update(visible?radius*2:0,now);
      }
    }frame=requestAnimationFrame(draw);
  }
  function open(){
    if(dialog.open)return;dialog.showModal();document.body.classList.add('orrery-open');onOpen();
    if(firstOpen){simulation=Date.now();firstOpen=false;fit();}else resize();
    observer.observe(mount);last=undefined;updateUI();updateScene();if(!frame)frame=requestAnimationFrame(draw);
  }
  function close(){endPan();dialog.close();document.body.classList.remove('orrery-open');cancelAnimationFrame(frame);frame=0;last=undefined;observer.disconnect();opener.focus({preventScroll:true});}
  opener.onclick=open;$('.orrery-close').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  document.addEventListener('visibilitychange',()=>{last=undefined;});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();running=false;$('.orrery-error').hidden=false;$('.orrery-error').textContent='The graphics context was interrupted. Reload the app to restore the orrery.';updateUI();});
  slider.oninput=()=>{amount=Number(slider.value)/100;$('#orrery-scale-value').textContent=amount===1?'Even spacing':amount===0?'True scale':`${slider.value}% normalised`;$('#orrery-mode-note').textContent=amount===0?'True distances & diameters · labels mark tiny worlds':'Illustrated sizes & orbital spacing';resize();};
  dialog.querySelectorAll<HTMLButtonElement>('[data-scale]').forEach(button=>button.onclick=()=>{slider.value=button.dataset.scale!;slider.dispatchEvent(new Event('input'));});
  dialog.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.onclick=()=>fit(button.dataset.view));
  labelToggle.onchange=()=>{labelsVisible=labelToggle.checked;$('.orrery-labels').hidden=!labelsVisible;ink.clearRect(0,0,width,height);};
  orbitToggle.onchange=()=>{orbitsVisible=orbitToggle.checked;planets.forEach(p=>{if(p.orbit)p.orbit.visible=orbitsVisible;});};
  $<HTMLSelectElement>('#orrery-inspect').onchange=event=>inspect((event.target as HTMLSelectElement).value);
  $('.orrery-info-close').onclick=()=>inspect('');
  $('.orrery-focus').onclick=()=>{
    const p=planets.find(p=>p.world.id===selected);if(!p)return;
    const offset=camera.position.clone().sub(controls.target);
    controls.target.copy(p.root.position);camera.position.copy(p.root.position).add(offset);following=p.world.id;
    const diameter=diameterAt(p.world,amount)*(p.world.id==='saturn'?2.3:1);
    camera.zoom=THREE.MathUtils.clamp((camera.top-camera.bottom)/(diameter*2.8),controls.minZoom,controls.maxZoom);
    camera.updateProjectionMatrix();controls.update();
  };
  play.onclick=()=>{running=!running;last=undefined;updateUI();updateStatus();};
  $('#orrery-direction').onclick=()=>{direction*=-1;$('#orrery-direction').textContent=direction<0?'← Reverse':'Forward →';$('#orrery-direction').setAttribute('aria-pressed',String(direction<0));$('#orrery-direction').title=direction<0?'Run time forwards':'Reverse time';updateStatus();};
  $<HTMLSelectElement>('#orrery-speed').onchange=event=>{const value=(event.target as HTMLSelectElement).value;rate=value==='real'?60/(YEAR_DAYS*86400):value==='week'?7/YEAR_DAYS:Number(value);last=undefined;updateStatus();};
  dateInput.oninput=()=>{dateDirty=true;dateInput.setCustomValidity('');};
  $('.orrery-date-form').onsubmit=event=>{
    event.preventDefault();const ms=new Date(dateInput.value).getTime();
    if(!Number.isFinite(ms)||ms<MIN_DATE||ms>MAX_DATE){dateInput.setCustomValidity('Choose a valid local date between 1000 and 3000.');dateInput.reportValidity();return;}
    simulation=ms;running=false;dateDirty=false;last=undefined;updateUI();updateStatus('Paused at your selected date · press Play to continue.');
  };
  $('#orrery-now').onclick=()=>{simulation=Math.max(MIN_DATE,Math.min(MAX_DATE,Date.now()));dateDirty=false;dateInput.setCustomValidity('');last=undefined;updateUI();updateStatus('Returned to the current date and time.');};
  let pointerStart:{x:number;y:number}|undefined;
  renderer.domElement.addEventListener('pointerdown',event=>{if(event.button===0)pointerStart={x:event.clientX,y:event.clientY};});
  renderer.domElement.addEventListener('pointerup',event=>{
    if(!pointerStart||Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>5){pointerStart=undefined;return;}pointerStart=undefined;
    const rect=renderer.domElement.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top,pxPerUnit=height/(camera.top-camera.bottom)*camera.zoom;
    const candidates=planets.map(p=>{const v=p.root.position.clone().project(camera);return {id:p.world.id,z:v.z,d:Math.hypot((v.x+1)*width/2-x,(1-v.y)*height/2-y),r:Math.max(9,p.target.radius*pxPerUnit)};}).filter(p=>p.z>=-1&&p.z<=1&&p.d<=p.r).sort((a,b)=>a.z-b.z);
    if(candidates.length)inspect(candidates[0].id);
  });
  stage.addEventListener('keydown',event=>{if(event.target===renderer.domElement&&event.key==='Home')fit();});
  renderer.domElement.tabIndex=0;
}
