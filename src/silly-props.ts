import { INK, PAPER, at, clamp, lerp, line, oval, roundBox, shape, smooth, type Ctx, type Point } from './toon.ts';
import type { SillyKind } from './character-business.ts';

const BRASS='#ddb067', TEAL='#416875';
const box=(ctx:Ctx,x:number,y:number,w:number,h:number,r:number,fill:string)=>shape(ctx,()=>roundBox(ctx,x,y,w,h,r),fill);

/** Props attach to the rig's actual hands; none modifies the world or physics. */
export function drawBusinessProp(ctx:Ctx,kind:SillyKind,t:number,near:Point,far:Point) {
  ctx.save();ctx.lineWidth=1.5;
  const mid=at((near.x+far.x)/2,(near.y+far.y)/2);
  if(kind==='umbrella'){
    const open=smooth((t-.5)/1.2)*(1-smooth((t-7.5)/1.1));
    ctx.translate(near.x,near.y);
    line(ctx,()=>{ctx.moveTo(0,-57);ctx.lineTo(0,8);ctx.quadraticCurveTo(0,17,-6,14);},INK,3.4);
    line(ctx,()=>{ctx.moveTo(0,-57);ctx.lineTo(0,8);},BRASS,1.4);
    const w=lerp(4,43,open), top=-63, rim=lerp(-20,-46,open);
    for(let i=0;i<3;i++){
      const x0=-w+i*w*2/3,x1=-w+(i+1)*w*2/3;
      shape(ctx,()=>{ctx.moveTo(0,top);ctx.quadraticCurveTo(x0*.85,top+4,x0,rim);ctx.quadraticCurveTo((x0+x1)/2,rim-7*open,x1,rim);ctx.quadraticCurveTo(x1*.85,top+4,0,top);},i===1?'#d2b971':'#648478');
    }
    oval(ctx,0,top,2,3,BRASS);
  }else if(kind==='book'||kind==='tablet'){
    ctx.translate(mid.x,mid.y-3);
    const open=.1+.9*smooth((t-.4)/1.1)*(1-smooth((t-7.6)/1));
    ctx.scale(open,1);
    if(kind==='book'){
      // We see the outside of the open cover; its pages face the reader.
      for(const side of [-1,1]){
        shape(ctx,()=>{ctx.moveTo(0,-10);ctx.lineTo(side*20,-14);ctx.lineTo(side*20,11);ctx.lineTo(0,14);},side<0?'#65422f':'#906046');
        shape(ctx,()=>{ctx.moveTo(0,-10);ctx.lineTo(side*18,-13);ctx.lineTo(side*18,-16);ctx.quadraticCurveTo(side*8,-14,0,-12);},PAPER);
      }
      line(ctx,()=>{ctx.moveTo(0,-10);ctx.lineTo(0,14);},'#d8b67e',1.6);
      box(ctx,3,-8,13,15,1,'#745039');
      ctx.fillStyle='#f2d596';ctx.font='bold 8px system-ui';ctx.textAlign='center';ctx.fillText('42',9.5,2);
      const page=(t%3)/3;
      if(t>2&&page>.72)line(ctx,()=>{ctx.moveTo(0,-12);ctx.quadraticCurveTo(15*Math.cos((page-.72)/.28*Math.PI),-21,0,-16);},PAPER,1.2);
    }else{
      box(ctx,-19,-15,38,30,3,INK);
      box(ctx,-16,-12,32,22,2,'#bed19c');
      ctx.fillStyle='#314f42';ctx.textAlign='center';ctx.font='bold 6px system-ui';ctx.fillText("DON'T",0,-4);ctx.fillText('PANIC',0,4);
      oval(ctx,0,12.5,1.4,1.4,BRASS,false);
      // A folding protective cover, opened beside the little screen.
      shape(ctx,()=>{ctx.moveTo(-19,-15);ctx.lineTo(-26,-12);ctx.lineTo(-26,13);ctx.lineTo(-19,15);},TEAL);
    }
  }else if(kind==='paper-plane'){
    const flight=clamp(t-2,0,2.65), landed=t>4.65;
    const x=near.x+flight*19,y=landed?-3:Math.min(-3,near.y-flight*5+flight*flight*11);
    ctx.translate(x,y);ctx.rotate(landed?1.1:flight*.27);
    const fold=landed?.7:1;ctx.scale(fold,1);
    shape(ctx,()=>{ctx.moveTo(-12,-5);ctx.lineTo(16,0);ctx.lineTo(-8,8);ctx.lineTo(-4,1);ctx.closePath();},PAPER);
    line(ctx,()=>{ctx.moveTo(-12,-5);ctx.lineTo(-4,1);ctx.lineTo(16,0);ctx.moveTo(-4,1);ctx.lineTo(-8,8);},'#9baeb1',1);
  }else if(kind==='blueprint'){
    const open=.15+.85*smooth((t-.4)/1.5)*(1-smooth((t-9.5)/1));
    ctx.translate(mid.x,mid.y-3);ctx.scale(open,1);
    box(ctx,-27,-20,54,36,1,'#628f9e');
    ctx.save();ctx.strokeStyle='#c2dfe0';ctx.globalAlpha=.25;ctx.lineWidth=.5;
    for(let x=-22;x<27;x+=6)line(ctx,()=>{ctx.moveTo(x,-18);ctx.lineTo(x,14);},'#c2dfe0',.5);
    for(let y=-16;y<16;y+=6)line(ctx,()=>{ctx.moveTo(-25,y);ctx.lineTo(25,y);},'#c2dfe0',.5);ctx.restore();
    // A friendly three-legged robot, with an engineering dimension line.
    oval(ctx,0,-10,8,5,'#a6c6cb');oval(ctx,-3,-10,1,1,INK,false);oval(ctx,3,-10,1,1,INK,false);
    line(ctx,()=>{ctx.moveTo(-2,-7);ctx.quadraticCurveTo(0,-5,2,-7);},'#e8f5eb',.9);
    for(const x of [-14,0,14]){line(ctx,()=>{ctx.moveTo(x/4,-4);ctx.lineTo(x*.7,2);ctx.lineTo(x,10);ctx.lineTo(x+4,10);},'#e8f5eb',1.3);}
    line(ctx,()=>{ctx.moveTo(-20,-14);ctx.lineTo(-20,10);ctx.moveTo(-22,-14);ctx.lineTo(-18,-14);ctx.moveTo(-22,10);ctx.lineTo(-18,10);},'#e8f5eb',.8);
    for(const x of [-27,27])box(ctx,x-2,-21,4,38,2,'#a8c8cb');
    ctx.fillStyle='#e8f5eb';ctx.font='4px monospace';ctx.fillText('MK III',12,-12);
  }
  ctx.restore();
}

export function drawIceCream(ctx:Ctx,grip:Point,t:number) {
  ctx.save();ctx.translate(grip.x,grip.y);
  shape(ctx,()=>{ctx.moveTo(-7,-5);ctx.lineTo(0,15);ctx.lineTo(7,-5);},'#dfad69');
  for(const y of [0,5])line(ctx,()=>{ctx.moveTo(-5+y*.25,y-2);ctx.lineTo(4-y*.25,y+2);ctx.moveTo(5-y*.25,y-2);ctx.lineTo(-4+y*.25,y+2);},'#af7a44',.8);
  oval(ctx,0,-8,9,8,'#f2d4ad');
  if(t<6)oval(ctx,0,-18,8,7,t<3?'#d6e4c3':'#f0c5cf');
  if(t<3)oval(ctx,0,-27,6.5,6,'#f0c5cf');
  ctx.restore();
}

export function drawPoliceHat(ctx:Ctx,x:number,y:number,t:number) {
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t*1.2)*.025);
  // A round-topped British constable's helmet, perched above both eyes.
  shape(ctx,()=>{ctx.moveTo(-17,0);ctx.bezierCurveTo(-16,-17,-9,-28,0,-28);ctx.bezierCurveTo(10,-28,17,-16,18,0);},'#253e56');
  line(ctx,()=>{ctx.moveTo(-11,-7);ctx.quadraticCurveTo(-10,-20,-2,-24);},'#536b7d',2.2);
  shape(ctx,()=>{ctx.moveTo(-20,-1);ctx.quadraticCurveTo(0,-5,22,0);ctx.quadraticCurveTo(25,5,7,5);ctx.quadraticCurveTo(-8,6,-20,3);},'#172f42');
  line(ctx,()=>{ctx.moveTo(-16,-2);ctx.quadraticCurveTo(0,-5,18,-1);},'#6f8390',1.3);
  shape(ctx,()=>{ctx.moveTo(3,-20);ctx.lineTo(9,-16);ctx.lineTo(8,-9);ctx.lineTo(3,-6);ctx.lineTo(-2,-10);ctx.lineTo(-3,-16);},'#c4ced0');
  oval(ctx,3,-13,2.5,3,'#e0b76f');
  oval(ctx,0,-28,3,1.6,'#536b7d');
  ctx.restore();
}
