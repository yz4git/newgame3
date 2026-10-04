import {ATLAS_COLS,CHIP_SIZE,CHIP_TYPES,VARIANTS,noise,type Landmark} from './bg-map.ts';
type C=CanvasRenderingContext2D;
const palettes=[{base:'#172e3b',plate:'#60717b',light:'#d4d4c4',ink:'#111f2b',accent:'#86cbd1',water:'#163e4c'}, {base:'#131627',plate:'#57546c',light:'#b2b0be',ink:'#141626',accent:'#9db9ee',water:'#11162b'}, {base:'#292a2f',plate:'#736864',light:'#c8b7a0',ink:'#171b22',accent:'#f7a25f',water:'#204b52'}];
function canvas(w:number,h:number){const a=document.createElement('canvas');a.width=w;a.height=h;return a;}
function rect(c:C,x:number,y:number,w:number,h:number,color:string){c.fillStyle=color;c.fillRect(x,y,w,h);}
function line(c:C,pts:number[][],color:string,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function circle(c:C,x:number,y:number,r:number,color:string){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
function panel(c:C,x:number,y:number,w:number,h:number,color:string,depth=8){
  rect(c,x+depth,y+depth,w+depth*.5,h+depth*.6,'#02081270');
  rect(c,x,y,w,h,'#101b26');
  const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,color);g.addColorStop(.48,color);g.addColorStop(1,'#283845');c.fillStyle=g;c.fillRect(x+2,y+2,w-4,h-4);
  line(c,[[x+1,y+h],[x+1,y+1],[x+w,y+1]],'#d8e6de65',2);
  line(c,[[x+w,y+2],[x+w,y+h],[x+2,y+h]],'#050f21a0',3);
  for(let i=0;i<Math.floor(w*h/280);i++){const xx=x+3+noise(i,Math.round(x+y),2)*(w-7),yy=y+3+noise(i,Math.round(x-y),3)*(h-7);rect(c,xx,yy,2+noise(i,8)*5,.6,'#cfddcb19');}
  for(const xx of[x+5,x+w-6])for(const yy of[y+5,y+h-6]){circle(c,xx,yy,1.4,'#e0e5df70');}
}
function vent(c:C,x:number,y:number,w:number,h:number){panel(c,x,y,w,h,'#243842',3);for(let a=y+4;a<y+h-3;a+=5){rect(c,x+3,a,w-6,2,'#0a121a');rect(c,x+3,a+2,w-6,1,'#8ea8aa65');}}
function pipe(c:C,pts:number[][],color:string,width=10){line(c,pts.map(([x,y])=>[x+5,y+5]),'#050c1780',width+3);line(c,pts,'#101c26',width+3);line(c,pts,color,width);line(c,pts.map(([x,y])=>[x-2,y-2]),'#e7d9c54d',Math.max(1,width*.15));}
function ring(c:C,x:number,y:number,r:number,color:string,width=6){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();}
function fan(c:C,x:number,y:number,r:number,color:string){
  circle(c,x+6,y+7,r+5,'#03091270');
  const rim=c.createLinearGradient(x-r,y-r,x+r,y+r);rim.addColorStop(0,'#c1c6bd');rim.addColorStop(.20,color);rim.addColorStop(.48,'#89999b');rim.addColorStop(.51,'#25323d');rim.addColorStop(1,'#0d1b29');
  c.fillStyle=rim;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();ring(c,x,y,r-3,'#d5d8c452',1.5);circle(c,x,y,r*.82,'#111e29');
  for(let i=0;i<15;i++){c.save();c.translate(x,y);c.rotate(i*Math.PI*2/15);const g=c.createLinearGradient(0,0,r*.7,r*.2);g.addColorStop(0,'#263641');g.addColorStop(.55,'#8a999c');g.addColorStop(1,'#3c505c');c.fillStyle=g;c.beginPath();c.moveTo(r*.17,-r*.12);c.lineTo(r*.75,-r*.21);c.lineTo(r*.76,r*.02);c.lineTo(r*.24,r*.20);c.closePath();c.fill();line(c,[[r*.17,-r*.12],[r*.75,-r*.21]],'#d7e0cc60',1);c.restore();}
  const hub=c.createRadialGradient(x-r*.08,y-r*.1,1,x,y,r*.27);hub.addColorStop(0,'#b2c0bd');hub.addColorStop(.4,color);hub.addColorStop(1,'#162631');c.fillStyle=hub;c.beginPath();c.arc(x,y,r*.27,0,Math.PI*2);c.fill();
  for(let i=0;i<12;i++){const a=i*Math.PI/6;circle(c,x+Math.cos(a)*r*.92,y+Math.sin(a)*r*.92,Math.max(1,r*.018),'#bac8c277');}
}
function tower(c:C,x:number,y:number,w:number,h:number,p:typeof palettes[0],v:number){
  panel(c,x+8,y+8,w,h,p.ink,12);panel(c,x,y,w,h,p.plate,10);panel(c,x+6,y+6,w-12,h-12,p.light,3);
  const facade=c.createLinearGradient(x,y,x+w,y);facade.addColorStop(0,'#1a3e50');facade.addColorStop(.5,'#527482');facade.addColorStop(1,'#173045');c.fillStyle=facade;c.fillRect(x+10,y+10,w-20,Math.max(10,h*.25));
  for(let a=x+14;a<x+w-10;a+=8)rect(c,a,y+10,1,h*.25,'#b7ced45c');
  vent(c,x+10,y+h*.49,Math.max(12,w*.45),Math.max(12,h*.31));
  if(w>45)fan(c,x+w*.76,y+h*.69,Math.min(13,w*.17),p.plate);
  rect(c,x+8,y+h-5,w-16,2,p.accent);if(v%2)pipe(c,[[x+w-7,y+8],[x+w-7,y+h-10],[x+w*.55,y+h-10]],p.plate,4);
}
function chip(c:C,stage:number,kind:number,v:number){
  const p=palettes[stage];if(stage!==1)rect(c,0,0,256,256,p.base);
  // Stable fine-grain finish, shared tile-edge colour prevents seams.
  for(let i=0;i<620;i++){const x=noise(i,v,stage)*256,y=noise(i,v+12,stage)*256;rect(c,x,y,1+noise(i,2)*3,1,i%2?'#dae3d00a':'#00081116');}
  if(kind===0){
    if(stage!==1)rect(c,0,0,256,256,p.water);
    if(stage!==1){for(let i=0;i<85;i++){const x=noise(i,v,4)*256,y=noise(i,v,5)*256;line(c,[[x,y],[x+5+noise(i,v,6)*36,y-1]],stage===0?'#668e9a28':'#80bdc33b',1);}}
    else for(let i=0;i<28;i++)circle(c,noise(i,v,7)*256,noise(i,v,8)*256,noise(i,v,9)*1.1,'#b7c5e26b');
  }
  if([1,5,8,9,10,11].includes(kind)){
    for(let y=0;y<256;y+=64)for(let x=0;x<256;x+=64){rect(c,x+1,y+1,62,62,v%2?'#384751':'#34424b');line(c,[[x+2,y+62],[x+2,y+2],[x+62,y+2]],'#78918e28');rect(c,x+8,y+8,2,2,'#abbcb270');}
  }
  if(kind===2){
    rect(c,0,0,256,256,'#293b42');
    // Four architectural footprints, not four copies of one roof.
    const paint={...p,plate:['#83908c','#697c87','#8c8375','#687c7b'][v],light:['#b7b9aa','#a2b1b5','#b9afa1','#a8b9ae'][v]};
    if(v===0){tower(c,16,14,204,98,paint,v);tower(c,20,142,119,88,paint,v);vent(c,166,156,52,50);}
    if(v===1){tower(c,18,14,85,212,paint,v);tower(c,141,20,83,152,paint,v);panel(c,147,194,71,30,p.plate,6);}
    if(v===2){tower(c,22,18,205,201,paint,v);panel(c,70,93,105,91,p.ink,3);fan(c,122,138,34,p.plate);}
    if(v===3){tower(c,14,24,95,88,paint,v);tower(c,129,127,98,103,paint,v);rect(c,139,22,78,77,'#254548');for(let i=0;i<9;i++){circle(c,149+(i%3)*25,33+Math.floor(i/3)*25,9,'#507062');}panel(c,27,141,61,73,p.plate,4);}
    rect(c,0,0,256,5,'#aec4bd25');rect(c,0,0,5,256,'#aec4bd25');
  }
  if(kind===3||kind===4){
    const turn=kind===4;c.save();if(turn){c.translate(256,0);c.rotate(Math.PI/2);}rect(c,0,0,256,256,'#35444b');rect(c,25,0,206,256,'#182934');rect(c,36,0,184,256,'#22343e');
    for(const x of[31,222]){rect(c,x,0,2,256,'#adbaad');rect(c,x+4,0,1,256,'#111e29');}for(const x of[90,164])for(let y=0;y<256;y+=64)rect(c,x,y,2,31,'#b3b9a980');rect(c,126,0,4,256,'#bbad765e');
    if(v!==0){panel(c,50+v*34,26+v*31,13,29,v%2?'#8ea3a5':'#765b52',3);rect(c,53+v*34,29+v*31,7,5,'#182c39');}c.restore();
  }
  if(kind===5){
    if(stage===0){for(let y=15;y<235;y+=55)for(let x=10;x<230;x+=78){const color=['#7b6654','#547579','#8c8b77','#595e6e'][(x+y+v)%4];panel(c,x,y,65,42,color,4);for(let a=x+6;a<x+60;a+=7)line(c,[[a,y+4],[a,y+37]],'#16263388',2);}}
    else{tower(c,20,20,140,202,p,v);pipe(c,[[196,-10],[196,85],[230,85],[230,266]],p.plate,18);vent(c,183,130,44,76);}
  }
  if(kind===6){
    rect(c,0,0,256,256,'#244249');for(let i=0;i<42;i++){const x=15+noise(i,v,14)*220,y=15+noise(i,v,15)*220,r=6+noise(i,v,16)*12;circle(c,x+3,y+4,r,'#10272c');circle(c,x,y,r,['#47655d','#527367','#3c5a58'][i%3]);circle(c,x-2,y-3,r*.5,'#7e988040');}pipe(c,[[0,128],[256,128]],'#8c9b8b',12);pipe(c,[[128,0],[128,256]],'#8c9b8b',12);circle(c,128,128,28,'#8b9d91');circle(c,128,128,21,'#395b62');ring(c,128,128,16,'#a9b8a4',2);
  }
  if(kind===7||kind===11&&stage===1){
    if(stage!==1)rect(c,0,0,256,256,p.water);for(let i=0;i<5;i++){const x=35+noise(i,v,11)*186,y=28+noise(i,v,12)*186,r=15+noise(i,v,13)*34;c.save();c.translate(x,y);c.rotate(noise(i,v,14)*6);c.beginPath();c.moveTo(-r*.6,0);c.lineTo(0,-r*1.4);c.lineTo(r*.65,-r*.2);c.lineTo(r*.4,r);c.lineTo(-r*.6,r*.6);c.closePath();c.fillStyle=i%2?'#526880':'#545377';c.fill();line(c,[[-r*.6,0],[0,-r*1.4],[r*.65,-r*.2]],'#b2cbd199',2);line(c,[[0,-r*1.4],[r*.1,r*.4],[-r*.6,r*.6]],'#91a4d170',2);c.restore();}
  }
  if(kind===8){
    if(v===0){fan(c,128,128,94,p.plate);for(const x of[13,237])pipe(c,[[x,0],[x,256]],p.plate,13);for(const y of[16,226])vent(c,68,y,121,15);}
    if(v===1){panel(c,18,18,218,218,p.plate,7);for(let i=0;i<5;i++){panel(c,28+i*41,29,33,194,p.plate,3);vent(c,32+i*41,40,25,151);rect(c,36+i*41,203,16,3,p.accent);}}
    if(v===2){for(const y of[63,190])for(const x of[63,190]){fan(c,x,y,47,p.plate);}pipe(c,[[128,0],[128,256]],p.light,9);pipe(c,[[0,128],[256,128]],p.plate,9);}
    if(v===3){panel(c,24,15,204,227,p.plate,8);for(let i=0;i<4;i++){const y=34+i*51;pipe(c,[[15,y],[232,y]],p.light,22);for(const x of[52,187])panel(c,x,y-15,13,31,p.plate,3);}vent(c,85,89,75,69);}
  }
  if(kind===9){
    rect(c,0,0,256,256,'#34434b');for(const x of[10,240])rect(c,x,0,4,256,'#c0baa3');for(let y=0;y<256;y+=64){rect(c,124,y,8,36,'#bcbfaf');rect(c,22,y+10,30,5,'#97ada7');rect(c,205,y+10,30,5,'#97ada7');}if(v===1){c.font='bold 54px monospace';c.fillStyle='#bcc0ad';c.textAlign='center';c.fillText('07',128,190);}
  }
  if(kind===10){
    pipe(c,[[-12,40],[86,40],[86,215],[268,215]],p.plate,23);pipe(c,[[-12,80],[47,80],[47,170],[268,170]],'#7c8b86',11);vent(c,137,22,97,102);panel(c,10,217,45,26,p.plate,4);for(let i=0;i<8;i++)rect(c,145+i*10,33,4,8,p.accent);
  }
  if(kind===11&&stage!==1){
    panel(c,13,13,228,230,p.plate,4);panel(c,29,29,198,198,p.ink,3);for(let i=0;i<5;i++){pipe(c,[[36+i*37,29],[36+i*37,226]],p.plate,16);rect(c,34+i*37,64,4,24,p.accent);}for(const y of[40,205])panel(c,24,y,208,12,p.light,3);
  }
  if(kind===1){vent(c,16,16,70,38);pipe(c,[[252,24],[175,24],[175,224],[80,224]],p.plate,7);panel(c,28,84,93,84,p.plate,3);rect(c,45,101,47,30,'#1b3441');line(c,[[15,242],[53,242]],p.accent,3);}
}
export function makeAtlas(stage:number){const a=canvas(CHIP_SIZE*ATLAS_COLS,CHIP_SIZE*Math.ceil(CHIP_TYPES*VARIANTS/ATLAS_COLS));const c=a.getContext('2d')!;for(let k=0;k<CHIP_TYPES;k++)for(let v=0;v<VARIANTS;v++){const id=k*VARIANTS+v;c.save();c.translate(id%ATLAS_COLS*CHIP_SIZE,Math.floor(id/ATLAS_COLS)*CHIP_SIZE);c.beginPath();c.rect(0,0,256,256);c.clip();chip(c,stage,k,v);c.restore();}return a;}
export function makeLandmark(stage:number,kind:Landmark['kind'],variant=0){
  const a=canvas(768,1024),c=a.getContext('2d')!,p=palettes[stage];c.scale(2,2);
  if(kind==='port'){
    panel(c,44,66,283,359,p.ink,20);panel(c,36,46,280,355,p.plate,15);
    for(const x of[48,242]){tower(c,x,70,57,240,p,1);for(let i=0;i<10;i++)rect(c,x+5,86+i*20,46,2,p.accent+'80');}
    panel(c,118,81,108,238,p.ink,5);for(let i=0;i<9;i++)panel(c,124,87+i*24,96,20,i%2?p.plate:'#465761',2);
    tower(c,76,332,204,56,p,1);circle(c,173,188,33,p.ink);ring(c,173,188,28,p.light,2);c.font='22px monospace';c.fillStyle=p.light;c.textAlign='center';c.fillText(variant===0?'H':String(variant+1).padStart(2,'0'),173,196);
    for(let i=0;i<10;i++){line(c,[[38+i*27,46],[48+i*27,57]],'#dcc485',4);line(c,[[40+i*27,399],[50+i*27,388]],'#dcc485',4);}
    if(variant>0){tower(c,125,5,102,64,p,variant);vent(c,4,343,49,51);}
    for(const y of[65,313])pipe(c,[[15,y],[354,y]],p.plate,9);
    c.save();c.translate(308,125);c.rotate(.14);panel(c,-10,-22,22,90,p.light,4);panel(c,-22,13,46,16,p.plate,3);c.restore();
  }else if(kind==='garden'){
    if(stage===0){panel(c,28,60,316,356,p.light,12);panel(c,48,78,276,322,'#385d5b',6);for(let i=0;i<60;i++){const x=58+noise(i,1)*250,y=87+noise(i,2)*292;circle(c,x+5,y+5,10,'#203d40');circle(c,x,y,10+noise(i,3)*6,'#5b7a65');}pipe(c,[[185,80],[185,400]],p.light,15);pipe(c,[[50,244],[320,244]],p.light,15);circle(c,185,244,54,p.light);circle(c,185,244,43,'#456e7a');ring(c,185,244,29,'#bbcec5',3);}
    else{for(let i=0;i<18;i++){c.save();const x=50+noise(i,3)*275,y=80+noise(i,4)*335;c.translate(x,y);c.rotate(noise(i,5)*6);c.scale(.42+noise(i,6)*.5,.65+noise(i,7));const g=c.createLinearGradient(-60,-50,80,40);g.addColorStop(0,'#c9d8d9');g.addColorStop(.4,'#6a91a9');g.addColorStop(.42,'#383f75');g.addColorStop(1,'#252a46');c.fillStyle=g;c.beginPath();c.moveTo(-45,25);c.lineTo(-18,-90);c.lineTo(22,-128);c.lineTo(61,-25);c.lineTo(25,78);c.closePath();c.fill();line(c,[[-18,-90],[22,-128],[61,-25]],'#b4efff',2);c.restore();}}
  }else if(kind==='gate'){
    c.save();c.translate(192,245);c.scale(1,1.2);ring(c,10,15,145,'#050b1899',34);ring(c,0,0,144,p.ink,36);ring(c,0,0,144,p.plate,25);ring(c,0,0,156,p.light,2);ring(c,0,0,129,p.accent,3);
    for(let i=0;i<20;i++){c.save();c.rotate(i*Math.PI/10);panel(c,-12,-161,24,35,p.plate,3);rect(c,-6,-135,12,3,p.accent);c.restore();}c.restore();tower(c,18,215,54,89,p,1);tower(c,309,215,54,89,p,1);
  }else if(kind==='reactor'){
    panel(c,32,69,312,365,p.plate,15);for(const x of[48,324])pipe(c,[[x,0],[x,512]],p.plate,17);
    fan(c,192,247,141,p.plate);for(let i=0;i<12;i++){c.save();c.translate(192,247);c.rotate(i*Math.PI/6);panel(c,-12,-135,24,34,p.plate,3);rect(c,-8,-126,16,3,p.accent);c.restore();}ring(c,192,247,90,p.accent,7);circle(c,192,247,61,p.ink);const g=c.createRadialGradient(184,238,1,192,247,59);g.addColorStop(0,'#fff0c8');g.addColorStop(.28,p.accent);g.addColorStop(.7,stage===2?'#bf5729':'#526399');g.addColorStop(1,p.ink);c.fillStyle=g;c.beginPath();c.arc(192,247,58,0,Math.PI*2);c.fill();for(const y of[85,380]){vent(c,80,y,230,34);}
  }else{
    c.save();c.translate(200,248);c.rotate(-.37);panel(c,-70,-210,140,420,p.ink,19);panel(c,-60,-211,120,159,p.plate,12);panel(c,-62,10,124,187,p.plate,12);for(const s of[-1,1]){panel(c,s*116-38,-95,76,223,p.plate,8);pipe(c,[[s*104,-74],[s*104,86]],p.light,8);}for(let i=0;i<12;i++){const x=-50+noise(i,2)*100,y=-55+noise(i,3)*68;panel(c,x,y,13+noise(i,4)*16,10,p.plate,3);}vent(c,-39,26,78,124);c.restore();
  }
  return a;
}
export function makeCloud(){const a=canvas(512,512),c=a.getContext('2d')!;for(let i=0;i<36;i++){const x=118+noise(i,2)*276,y=156+noise(i,3)*200,r=42+noise(i,4)*95,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#c8dbe014');g.addColorStop(.4,'#9bbdc911');g.addColorStop(1,'#a4c4d000');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}return a;}
