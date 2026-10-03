import * as THREE from 'three';
import { seeded, type World } from './orrery-model.ts';

// Seamless, original surface maps in the illustrated atlas palette. GPU mipmaps
// supply every smaller resolution; no high-resolution downloads are needed.
export function planetTexture(world:World, anisotropy:number):THREE.CanvasTexture {
  const canvas=document.createElement('canvas'); canvas.width=2048;canvas.height=1024;
  const g=canvas.getContext('2d')!; const w=canvas.width,h=canvas.height;
  const random=seeded(world.id.split('').reduce((n,c)=>n*31+c.charCodeAt(0),17));
  const base:Record<string,string>={sun:'#ed9325',mercury:'#96887c',venus:'#dabb80',earth:'#246e9a',mars:'#b96843',jupiter:'#d0ac87',saturn:'#d3bc84',uranus:'#83c0c9',neptune:'#345eac',pluto:'#a79382'};
  g.fillStyle=base[world.id];g.fillRect(0,0,w,h);
  const gas=['venus','jupiter','saturn','uranus','neptune'].includes(world.id);
  if(gas) {
    const palettes:Record<string,string[]>={venus:['#ebd8a6','#b59660','#f1ddb0'],jupiter:['#a76d4d','#eedcbd','#bd8868','#f2dfc2','#996451'],saturn:['#e6d6af','#b69b67','#f4e7c4'],uranus:['#c1e8e2','#85bdc7','#94d2d4'],neptune:['#6187c1','#2c4d96','#7495ce']};
    const palette=palettes[world.id];
    for(let band=0;band<55;band++) {
      const y=band*h/55,thickness=8+random()*30,phase=random()*Math.PI*2;
      g.beginPath();
      for(let x=0;x<=w;x+=8){const p=y+Math.sin(x/w*Math.PI*8+phase)*6+Math.sin(x/w*Math.PI*18+phase)*2; if(x===0)g.moveTo(x,p);else g.lineTo(x,p);}
      for(let x=w;x>=0;x-=8)g.lineTo(x,y+thickness+Math.sin(x/w*Math.PI*8+phase)*5);
      g.closePath();g.fillStyle=palette[band%palette.length];g.globalAlpha=world.id==='uranus'?.12:.3+random()*.35;g.fill();
    }
    g.globalAlpha=1;
    if(world.id==='jupiter'||world.id==='neptune'){
      for(let i=9;i>0;i--){g.beginPath();g.ellipse(w*.69,h*.61,18+i*9,8+i*4,-.1,0,Math.PI*2);g.fillStyle=world.id==='jupiter'?(i%2?'#b26b47':'#d59a70'):(i%2?'#315493':'#4773b3');g.fill();}
    }
  }
  // Fine mottling provides surface detail at high zoom without harsh pixel noise.
  for(let i=0;i<18000;i++){
    const x=random()*w,y=random()*h,r=1+random()*(gas?11:20);
    g.globalAlpha=.015+random()*.045;g.fillStyle=i%2?'#fff1d5':'#30241f';
    g.beginPath();g.ellipse(x,y,r,r*(gas?.22:1),0,0,Math.PI*2);g.fill();
  }
  g.globalAlpha=1;
  if(['mercury','mars','pluto'].includes(world.id)) {
    for(let i=0;i<380;i++){
      const x=random()*w,y=random()*h,r=3+random()**3*42;
      for(const xx of [x-w,x,x+w]){
        g.beginPath();g.arc(xx,y,r,0,Math.PI*2);g.fillStyle='rgba(43,31,25,.13)';g.fill();
        g.beginPath();g.arc(xx,y,r,Math.PI*.2,Math.PI*1.2);g.strokeStyle='rgba(255,237,205,.22)';g.lineWidth=Math.max(1,r*.13);g.stroke();
      }
    }
    if(world.id==='mars'||world.id==='pluto'){
      g.fillStyle=world.id==='mars'?'#ded9c3':'#dfceba';g.globalAlpha=.8;
      g.beginPath();g.ellipse(w*.53,h*.12,w*.23,h*.09,0,0,Math.PI*2);g.fill();g.globalAlpha=1;
    }
  }
  if(world.id==='earth') {
    // Simplified longitude/latitude coastlines; the other map details are illustrative.
    const continents=[
      [[-168,66],[-140,70],[-125,60],[-110,70],[-80,62],[-54,50],[-66,44],[-82,25],[-98,16],[-106,24],[-123,40],[-136,55]],
      [[-81,12],[-62,9],[-50,0],[-35,-7],[-45,-24],[-57,-39],[-69,-55],[-76,-25]],
      [[-17,35],[7,37],[33,30],[43,12],[51,10],[39,-13],[31,-30],[19,-35],[11,-17],[-5,5],[-17,15]],
      [[-10,36],[-8,58],[10,70],[36,69],[60,73],[100,77],[145,65],[177,63],[163,50],[138,35],[120,20],[105,4],[79,8],[67,26],[43,13],[35,32],[18,40]],
      [[112,-12],[132,-10],[143,-16],[153,-27],[145,-39],[126,-35],[114,-25]],
      [[-53,59],[-25,72],[-35,82],[-60,81]], [[47,-13],[51,-16],[48,-26],[44,-22]],
    ];
    for(const coast of continents){g.beginPath();coast.forEach(([lon,lat],i)=>{const x=(lon+180)/360*w,y=(90-lat)/180*h;i?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();g.fillStyle='#7e9b59';g.strokeStyle='#b9bc7a';g.lineWidth=5;g.fill();g.stroke();}
    g.fillStyle='#e4ece2';g.fillRect(0,0,w,21);g.fillRect(0,h-45,w,45);
    for(let i=0;i<95;i++){
      const x=random()*w,y=random()*h;g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+25,y-14,x+45,y+12,x+80,y-9);
      g.strokeStyle='rgba(244,244,228,.6)';g.lineWidth=3+random()*10;g.lineCap='round';g.stroke();
    }
  }
  if(world.id==='sun'){
    for(let i=0;i<4500;i++){g.beginPath();g.arc(random()*w,random()*h,1+random()*9,0,Math.PI*2);g.fillStyle=i%3?'rgba(255,218,104,.25)':'rgba(171,75,12,.22)';g.fill();}
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;
  texture.anisotropy=anisotropy;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;
  return texture;
}

export function haloTexture():THREE.CanvasTexture {
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d')!;
  const grad=g.createRadialGradient(64,64,15,64,64,64);grad.addColorStop(0,'rgba(255,185,64,.35)');grad.addColorStop(.42,'rgba(255,146,24,.13)');grad.addColorStop(1,'rgba(255,100,10,0)');
  g.fillStyle=grad;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);
}
export function ringTexture():THREE.CanvasTexture {
  const c=document.createElement('canvas');c.width=512;c.height=4;const g=c.getContext('2d')!;const r=seeded(34);
  for(let x=0;x<512;x++){g.fillStyle=x>296&&x<322?'rgba(0,0,0,.03)':`rgba(212,192,146,${.25+r()*.55})`;g.fillRect(x,0,1,4);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
