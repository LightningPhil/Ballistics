/** A small, shared Canvas rig. All artwork uses a 100-unit foot anchor. */
export type CrewReaction = 'coast' | 'apex' | 'impact' | 'escape' | 'fizzle';

export interface CrewPose {
  type: string;
  state?: string;
  stateTimer?: number;
  direction?: number;
  reaction?: CrewReaction;
  reducedMotion?: boolean;
}

const INK = '#293b43';
const PAPER = '#fff3d9';
const GREEN = '#608167';
const GOLD = '#e8ae53';

/** Draw at (x, footY), height in CSS pixels. No state or physics mutation. */
export function drawCrew(ctx: CanvasRenderingContext2D, x: number, footY: number, height: number, pose: CrewPose) {
  const t = pose.reducedMotion ? 0 : (pose.stateTimer || 0);
  const state = pose.state || 'idle';
  const reaction = pose.reaction;
  const startled = state === 'startled' || state === 'rocket_startled';
  const walking = state === 'walking' || state === 'returning' || state === 'running_away';
  const stride = walking ? Math.sin(t * (state === 'running_away' ? 12 : 5)) * 7 : 0;
  const jump = startled ? Math.sin(Math.min(1, t / 0.65) * Math.PI) * 13 : 0;
  const squash = state === 'squashed';
  const dir = pose.direction === -1 ? -1 : 1;
  const astronaut = pose.type === 'spaceman';
  const alien = pose.type === 'alien';
  const robot = pose.type === 'robot' || pose.type === 'icerobot';
  const worker = pose.type === 'worker';
  const seated = reaction === 'coast' && !walking && !startled;
  let propHand = { x: 27, y: -36 };
  ctx.save();
  ctx.translate(x, footY);
  ctx.scale(height / 100, height / 100);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;

  function oval(cx: number, cy: number, rx: number, ry: number, fill: string, outline = true) {
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill(); if (outline) ctx.stroke();
  }
  function path(points: number[][], fill?: string) {
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    if (fill) { ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
    ctx.stroke();
  }
  function line(x1: number, y1: number, x2: number, y2: number, width: number, fill: string) {
    ctx.lineWidth = width + 3; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.lineWidth = width; ctx.strokeStyle = fill; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = INK;
  }
  function box(bx: number, by: number, w: number, h: number, r: number, fill: string) {
    ctx.beginPath(); ctx.roundRect(bx, by, w, h, r);
    ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
  }
  function eye(ex: number, ey: number, look = 0) {
    oval(ex + dir * 1.2, ey + look, 2.3, startled ? 4.1 : 3, INK, false);
    oval(ex + dir * 1.2 - 0.6, ey + look - 1.2, 0.7, 0.9, PAPER, false);
  }
  function smile(cx: number, cy: number) {
    if (startled) {
      oval(cx, cy, 4.5, 6, '#633d36');
      oval(cx, cy + 2.9, 2.8, 2, '#d98972', false);
    } else {
      ctx.beginPath(); ctx.moveTo(cx - 5, cy - 1);
      ctx.quadraticCurveTo(cx, cy + (reaction === 'fizzle' ? -4 : 5), cx + 5, cy - 1);
      ctx.stroke();
    }
  }

  oval(0, 0, 25, 4, 'rgba(35,48,43,0.16)', false);
  if (squash) {
    oval(0, -5, 28, 7, alien ? '#a6b954' : astronaut ? PAPER : GREEN);
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + i * Math.PI * 2 / 3;
      oval(Math.cos(a) * 24, -24 + Math.sin(a) * 4, 2.8, 2.8, GOLD, false);
    }
    ctx.restore(); return;
  }

  // A stool only arrives during an uneventful coast; it never holds up a launch.
  if (seated) {
    line(-19, -23, 15, -2, 2.3, '#b88858');
    line(18, -23, -14, -2, 2.3, '#b88858');
    box(-22, -29, 43, 8, 3, '#d8a956');
  }
  ctx.translate(0, -jump);
  // The pear-shaped alien has no long legs: lift its body onto the same seat.
  // Humanoid hips already meet the stool at -25; lowering them cut through it.
  if (seated && alien) ctx.translate(0, -22);

  if (alien) {
    // A pear silhouette, single large eye and small boots remain readable at 60px.
    oval(-12 - stride * 0.45, -4 - Math.max(0, stride * 0.2), 10, 5, '#879d43');
    oval(13 + stride * 0.45, -4 - Math.max(0, -stride * 0.2), 10, 5, '#a6b954');
    const leftAntenna = -18 + Math.sin(t * 2) * 1.5;
    const rightAntenna = 19 + Math.sin(t * 2 + 1) * 1.5;
    line(-13, -78, leftAntenna, -95, 3, '#a6b954');
    line(13, -78, rightAntenna, -95, 3, '#a6b954');
    oval(leftAntenna, -95, 4.8, 5, '#c2ce70'); oval(rightAntenna, -95, 4.8, 5, '#c2ce70');
    ctx.beginPath(); ctx.moveTo(0, -88);
    ctx.bezierCurveTo(-37, -88, -40, -49, -32, -24);
    ctx.bezierCurveTo(-26, -4, 24, -2, 33, -26);
    ctx.bezierCurveTo(43, -52, 31, -87, 0, -88);
    ctx.fillStyle = '#a5b954'; ctx.fill(); ctx.stroke();
    ctx.save(); ctx.globalAlpha = 0.52;
    [[-22,-66,3,5],[-27,-46,4,6],[-19,-25,3,3],[25,-33,4,5],[22,-66,3,3]].forEach(p => oval(p[0],p[1],p[2],p[3],'#718c43',false));
    ctx.restore();
    oval(7, -64, 18.5, 21, PAPER);
    oval(13 + dir * 2, -65 + (reaction === 'apex' ? -4 : 0), 9, 13, '#243943', false);
    oval(15 + dir * 2, -71, 3, 4, '#fffdf1', false);
    smile(3, -35);
    const handY = startled ? -67 : reaction === 'apex' ? -64 : reaction === 'escape' ? -57 : -36;
    line(-26,-45,-34,handY,7,'#a5b954'); line(26,-45,34,handY,7,'#a5b954');
    oval(-34,handY,6,6,'#a5b954'); oval(34,handY,6,6,'#a5b954');
    propHand = { x: 34, y: handY };
  } else if (robot) {
    const metal = pose.type === 'icerobot' ? '#adc8cc' : '#acb8ab';
    const footL = seated ? -23 : -13-stride, footR = seated ? 23 : 13+stride;
    if (seated) {
      line(-10,-27,-23,-22,8,metal); line(-23,-22,footL,-8,8,metal);
      line(10,-27,23,-22,8,metal); line(23,-22,footR,-8,8,metal);
    } else {
      line(-10,-27,footL,-8,8,metal); line(10,-27,footR,-8,8,metal);
    }
    box(footL-11,-10,20,10,4,INK); box(footR-8,-10,20,10,4,INK);
    box(-20,-56,40,33,8,metal);
    box(-24,-87,48,34,10,metal);
    box(-18,-81,36,19,5,'#263e46');
    oval(-8,-71,4,4,'#f0c76c',false); oval(9,-71,4,4,'#f0c76c',false);
    line(0,-89,0,-97,2,GOLD); oval(0,-99,3,3,GOLD);
    box(-10,-49,20,12,3,PAPER); line(-5,-43,5,-43,2,'#d77947');
    const handY = startled ? -74 : reaction === 'apex' ? -70 : reaction === 'escape' ? -58 : -31;
    line(-20,-48,-29,handY,7,metal);
    line(20,-48,29,handY,7,metal);
    propHand = { x: 29, y: handY };
  } else {
    const skin = astronaut ? '#b77c54' : '#edb982';
    const sleeve = astronaut ? PAPER : '#e8e7cb';
    const trousers = astronaut ? '#e9dfc9' : '#b99b6a';
    const feetY = -5;
    const footL = seated ? -23 : -12-stride, footR = seated ? 23 : 13+stride;
    if (seated) {
      line(-10,-30,-23,-24,11,trousers); line(-23,-24,footL,feetY,11,trousers);
      line(10,-30,23,-24,11,trousers); line(23,-24,footR,feetY,11,trousers);
    } else {
      line(-10,-30,footL,feetY,11,trousers);
      line(10,-30,footR,feetY,11,trousers);
    }
    oval(footL-3,feetY,11,5,astronaut?INK:PAPER);
    oval(footR+3,feetY,11,5,astronaut?INK:PAPER);
    if (astronaut) box(-25,-64,48,31,8,'#b7ab91'); // backpack
    box(-19,-60,39,35,11,astronaut?PAPER:GREEN);
    if (astronaut) {
      box(-11,-53,23,15,3,'#d6c6a5');
      box(-7,-49,6,6,1,'#698b98'); box(3,-49,6,6,1,'#698b98');
      line(-5,-40,6,-40,2,'#cf7c46');
    } else {
      path([[-12,-59],[0,-49],[13,-59],[7,-61],[0,-56],[-6,-61]],PAPER);
      ctx.save(); ctx.globalAlpha = .32; ctx.lineWidth = 1.1;
      path([[-14,-41],[-6,-51],[3,-41],[-6,-31],[-14,-41]]);
      path([[2,-41],[11,-51],[18,-41],[11,-31],[2,-41]]); ctx.restore();
    }
    const handY = state === 'carrying' ? -110 : startled || state === 'celebrating' ? -77 : reaction === 'apex' || reaction === 'escape' ? -66 : -36;
    line(-17,-52,-26,handY,9,sleeve); line(18,-52,27,handY,9,sleeve);
    if (astronaut) {
      line(-21,-49,-23,-53,5,'#d87c45'); line(22,-49,24,-53,5,'#d87c45');
      oval(-26,handY,6,7,INK); oval(27,handY,6,7,INK);
    } else {
      oval(-26,handY,5,6,skin); oval(27,handY,5,6,PAPER);
    }
    propHand = { x: 27, y: handY };
    if (astronaut) {
      box(-27,-96,55,42,15,PAPER);
      box(-21,-91,43,31,12,'#3b5366');
      oval(0,-76,17,15,skin,false);
      ctx.beginPath(); ctx.moveTo(-15,-79);
      ctx.bezierCurveTo(-14,-99,17,-94,17,-78);
      ctx.lineTo(8,-86);ctx.lineTo(1,-83);ctx.lineTo(-7,-87);ctx.closePath();
      ctx.fillStyle='#3c3c3b';ctx.fill();
      eye(-6,-77,reaction==='apex'?-2:0); eye(7,-77,reaction==='apex'?-2:0); smile(1,-68);
      line(-20,-83,-17,-88,2,'#d7e1da');
      box(-31,-83,7,18,3,'#96aab1'); box(25,-83,7,18,3,'#96aab1');
    } else {
      oval(-19,-75,5,7,skin); oval(1,-76,23,21,skin);
      ctx.beginPath();ctx.moveTo(-21,-73);ctx.lineTo(-23,-88);ctx.lineTo(-14,-95);
      ctx.lineTo(1,-97);ctx.lineTo(16,-91);ctx.lineTo(22,-80);ctx.lineTo(15,-85);
      ctx.lineTo(7,-83);ctx.lineTo(9,-88);ctx.lineTo(-6,-84);ctx.lineTo(-13,-87);ctx.closePath();
      ctx.fillStyle='#765139';ctx.fill();ctx.stroke();
      eye(-6,-76,reaction==='apex'?-3:0);eye(9,-76,reaction==='apex'?-3:0);
      oval(2,-69,3.5,2.5,'#d89767',false);smile(3,-64);
      oval(-13,-69,4,2,'#df9d79',false); oval(16,-68,4,2,'#df9d79',false);
      // The cap rises a little at ignition; it never flies off-screen.
      ctx.save();ctx.translate(0,startled?-Math.sin(Math.min(1,t/0.9)*Math.PI)*12:0);
      ctx.beginPath();ctx.moveTo(-23,-86);ctx.bezierCurveTo(-28,-111,12,-115,22,-91);
      ctx.quadraticCurveTo(0,-96,-23,-86);ctx.fillStyle=worker?GOLD:GREEN;ctx.fill();ctx.stroke();
      if (!worker) {
        path([[-10,-105],[1,-109],[14,-101],[13,-94],[-6,-94]],PAPER);
        path([[0,-103],[6,-101],[1,-97]]);
      }
      ctx.beginPath();ctx.moveTo(-4,-93);ctx.quadraticCurveTo(34,-106,30,-91);
      ctx.quadraticCurveTo(21,-84,13,-91);ctx.closePath();ctx.fillStyle=worker?'#cd984c':'#41644d';ctx.fill();ctx.stroke();
      ctx.restore();
    }
  }

  // A small physical prop makes each reaction legible without another speech bubble.
  if (reaction === 'apex') {
    box(propHand.x-13,propHand.y-6,23,11,4,'#496574');
    oval(propHand.x+8,propHand.y-1,5,7,'#7fabb5');oval(propHand.x-10,propHand.y-1,4,6,INK);
  } else if (reaction === 'escape') {
    ctx.save(); ctx.translate(propHand.x,propHand.y+9);ctx.rotate(-.2);
    box(-7,-12,17,23,2,PAPER);
    ctx.strokeStyle='#be7245';path([[-3,-4],[6,-4]]);path([[-3,1],[5,1]]);ctx.restore();
  } else if (reaction === 'impact') {
    box(propHand.x-4,propHand.y-2,13,12,4,GOLD);
    ctx.strokeStyle='#ddae56';ctx.lineWidth=3;path([[propHand.x+4,propHand.y+3],[propHand.x+25,propHand.y+3],[propHand.x+25,-2]]);
    ctx.lineWidth=1;ctx.strokeStyle=INK;
    for(let i=0;i<4;i++)path([[propHand.x+7+i*4,propHand.y+2],[propHand.x+7+i*4,propHand.y+6]]);
  } else if (reaction === 'fizzle') {
    box(propHand.x-3,propHand.y,13,14,3,PAPER);
    ctx.beginPath();ctx.arc(propHand.x+12,propHand.y+6,5,-Math.PI/2,Math.PI/2);ctx.stroke();
    ctx.strokeStyle='#87928a';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(propHand.x+2,propHand.y-6);ctx.quadraticCurveTo(propHand.x-1,propHand.y-10,propHand.x+3,propHand.y-13);ctx.stroke();
  } else if (pose.type === 'golfer' && !startled) {
    line(28,-34,44,-2,2,'#83949a');oval(46,-2,8,4,'#a5aaa2');
  }
  if (startled) {
    ctx.strokeStyle=GOLD;ctx.lineWidth=3;
    path([[31,-98],[35,-106]]);path([[38,-90],[45,-94]]);
  }
  ctx.restore();
}
