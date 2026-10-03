import * as THREE from 'three';
import { seeded, type World } from './orrery-model.ts';

// Original generated equirectangular illustrations, packaged at two resolutions.
// Full prompt set and native dimensions are documented in docs/orrery-textures.md.
const MAPS:Record<string,{overview:string;detail:string}>={
  'sun': { overview: new URL('./assets/orrery/sun-512.webp', import.meta.url).href, detail: new URL('./assets/orrery/sun-2048.webp', import.meta.url).href },
  'mercury': { overview: new URL('./assets/orrery/mercury-512.webp', import.meta.url).href, detail: new URL('./assets/orrery/mercury-2048.webp', import.meta.url).href },
  'venus': { overview: new URL('./assets/orrery/venus-512.webp', import.meta.url).href, detail: new URL('./assets/orrery/venus-2048.webp', import.meta.url).href },
  'earth': { overview: new URL('./assets/orrery/earth-512.webp', import.meta.url).href, detail: new URL('./assets/orrery/earth-2048.webp', import.meta.url).href },
  'mars': { overview: new URL('./assets/orrery/mars-512.webp', import.meta.url).href, detail: new URL('./assets/orrery/mars-2048.webp', import.meta.url).href },
  'jupiter': { overview: new URL('./assets/orrery/jupiter-512.webp', import.meta.url).href, detail: new URL('./assets/orrery/jupiter-2048.webp', import.meta.url).href },
  'saturn': { overview: new URL('./assets/orrery/saturn-512.webp', import.meta.url).href, detail: new URL('./assets/orrery/saturn-2048.webp', import.meta.url).href },
  'uranus': { overview: new URL('./assets/orrery/uranus-512.webp', import.meta.url).href, detail: new URL('./assets/orrery/uranus-2048.webp', import.meta.url).href },
  'neptune': { overview: new URL('./assets/orrery/neptune-512.webp', import.meta.url).href, detail: new URL('./assets/orrery/neptune-2048.webp', import.meta.url).href },
  'pluto': { overview: new URL('./assets/orrery/pluto-512.webp', import.meta.url).href, detail: new URL('./assets/orrery/pluto-2048.webp', import.meta.url).href },
  'moon': { overview: new URL('./assets/orrery/moon-512.webp', import.meta.url).href, detail: new URL('./assets/orrery/moon-2048.webp', import.meta.url).href },
  'ganymede': { overview: new URL('./assets/orrery/ganymede-512.webp', import.meta.url).href, detail: new URL('./assets/orrery/ganymede-2048.webp', import.meta.url).href },
  'charon': { overview: new URL('./assets/orrery/charon-512.webp', import.meta.url).href, detail: new URL('./assets/orrery/charon-2048.webp', import.meta.url).href },
};
type SurfaceMaterial = THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
const loader=new THREE.TextureLoader();
export class PlanetSurface {
  readonly material:SurfaceMaterial;
  private overview?:THREE.Texture;
  private detail?:THREE.Texture;
  private loading=false;
  private failed=false;
  private wantsDetail=false;
  private lastDetailUse=0;
  constructor(readonly world:World,private anisotropy:number){
    this.material=world.id==='sun'
      ?new THREE.MeshBasicMaterial({color:world.colour})
      :new THREE.MeshStandardMaterial({color:world.colour,roughness:world.id==='earth'?.68:.95,metalness:0});
    loader.load(MAPS[world.id].overview,texture=>{
      this.configure(texture);this.overview=texture;
      if(!this.detail||!this.wantsDetail)this.use(texture);
    },undefined,()=>{ /* Retain a coloured sphere if an asset cannot be loaded. */ });
  }
  private configure(texture:THREE.Texture){
    texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;
    texture.anisotropy=this.anisotropy;texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;
  }
  private use(texture:THREE.Texture){
    const needsCompile=!this.material.map;
    this.material.map=texture;this.material.color.set(0xffffff);
    if(needsCompile)this.material.needsUpdate=true;
  }
  /** Projected physical pixel diameter; off-screen objects use zero. */
  update(pixels:number,now:number){
    this.wantsDetail=pixels>(this.wantsDetail?64:96);
    if(this.wantsDetail){
      this.lastDetailUse=now;
      if(this.detail){this.use(this.detail);return;}
      if(!this.loading&&!this.failed){
        this.loading=true;
        loader.load(MAPS[this.world.id].detail,texture=>{
          this.configure(texture);this.detail=texture;this.loading=false;
          if(this.wantsDetail)this.use(texture);
        },undefined,()=>{this.loading=false;this.failed=true;});
      }
    }else{
      if(this.overview&&this.material.map!==this.overview)this.use(this.overview);
      // Release large GPU maps after leaving a close-up. Overview maps stay warm.
      if(this.detail&&now-this.lastDetailUse>15000&&this.overview){
        this.detail.dispose();this.detail=undefined;
      }
    }
  }
}

export function haloTexture():THREE.CanvasTexture {
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d')!;
  const grad=g.createRadialGradient(64,64,15,64,64,64);grad.addColorStop(0,'rgba(255,185,64,.35)');grad.addColorStop(.42,'rgba(255,146,24,.13)');grad.addColorStop(1,'rgba(255,100,10,0)');
  g.fillStyle=grad;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);
}
export function ringTexture():THREE.CanvasTexture {
  const c=document.createElement('canvas');c.width=2048;c.height=4;const g=c.getContext('2d')!;const r=seeded(34);
  for(let x=0;x<c.width;x++){
    const u=x/c.width,cassini=u>.57&&u<.635,encke=u>.905&&u<.915;
    const fine=.035*Math.sin(u*1800)+.05*Math.sin(u*490)+r()*.08;
    const alpha=cassini||encke?.015:u<.19?.19+fine:u<.57?.7+fine:.42+fine;
    const shade=Math.round(185+24*Math.sin(u*28)+r()*12);
    g.fillStyle=`rgba(${shade+20},${shade+9},${shade-16},${alpha})`;g.fillRect(x,0,1,4);
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearMipmapLinearFilter;return t;
}
