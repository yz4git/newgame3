/** Visual browser audit of actual built 3D mode via Chrome DevTools. */
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
const root=join(process.cwd(),'dist'),port=4173;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
 const uri=decodeURIComponent((req.url||'/').split('?')[0]),file=join(root,normalize(uri).replace(/^\/+/,''));
 if(!file.startsWith(root)){res.writeHead(403).end();return;}
 try{const body=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(body);}
 catch{res.writeHead(404).end('not found');}
});
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
const chrome=spawn(process.env.CHROME_BIN||'google-chrome',[
 '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu-sandbox',
 '--remote-allow-origins=*','--remote-debugging-port=9222','--use-gl=angle','--use-angle=swiftshader',
 '--enable-webgl','--enable-unsafe-swiftshader','--window-size=1280,720','about:blank'
],{stdio:'ignore'});
let wsUrl;
for(let attempt=0;attempt<45;attempt++){
 try{const r=await fetch('http://127.0.0.1:9222/json/list');const tabs=await r.json();wsUrl=tabs.find(x=>x.type==='page')?.webSocketDebuggerUrl;if(wsUrl)break;}
 catch{}
 await sleep(350);
}
if(!wsUrl)throw Error('Chrome CDP endpoint unavailable');
const socket=new WebSocket(wsUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let id=0;const pending=new Map(),errors=[];
socket.addEventListener('message',e=>{
 const m=JSON.parse(e.data);
 if(m.id){
  const req=pending.get(m.id);if(!req)return;
  pending.delete(m.id);if(m.error)req.reject(Error(JSON.stringify(m.error)));else req.resolve(m.result||{});
 }else if(m.method==='Runtime.exceptionThrown'){
  errors.push(m.params?.exceptionDetails?.text||'Uncaught exception');
 }else if(m.method==='Runtime.consoleAPICalled'&&m.params?.type==='error'){
  errors.push((m.params.args||[]).map(x=>x.value||x.description).join(' '));
 }
});
function command(method,params={}){return new Promise((resolve,reject)=>{
 const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));
});}
async function evaluate(expression){
 const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
 return r.result?.value;
}
await command('Page.enable');await command('Runtime.enable');await command('Log.enable');
await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
await command('Page.navigate',{url:'http://127.0.0.1:'+port+'/flight3d.html?audit=1'});
await sleep(1700);
await mkdir('flight-audit',{recursive:true});
async function capture(name){
 const result=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
 await writeFile('flight-audit/'+name+'.png',Buffer.from(result.data,'base64'));
 const expression="JSON.stringify({state:window.__novaFlight3D?.snapshot?.(),headline:document.getElementById('overlay-title')?.textContent,error:document.getElementById('overlay-info')?.textContent,canvas:{width:document.getElementById('flight')?.width,height:document.getElementById('flight')?.height},screenshot:"+JSON.stringify(name)+",actionVisible:!document.getElementById('action')?.hidden})";
 const val=await evaluate(expression);
 await writeFile('flight-audit/'+name+'.json',val||'null');
 console.log('AUDIT_FRAME',name,val);
}
await capture('00-title');
await evaluate("document.getElementById('action').click()");
await sleep(1700);
await capture('01-start');
await command('Input.dispatchKeyEvent',{type:'keyDown',key:'d',code:'KeyD',windowsVirtualKeyCode:68});
await sleep(1900);
await command('Input.dispatchKeyEvent',{type:'keyUp',key:'d',code:'KeyD',windowsVirtualKeyCode:68});
await capture('02-move-right');
await command('Input.dispatchKeyEvent',{type:'keyDown',key:'f',code:'KeyF',windowsVirtualKeyCode:70});
await sleep(1400);
await command('Input.dispatchKeyEvent',{type:'keyUp',key:'f',code:'KeyF',windowsVirtualKeyCode:70});
await capture('03-charge');
await sleep(5800);
await capture('04-combat');
// Inspect later authored world segments without waiting several minutes for the
// software-rendered CI browser; this is a diagnostic seek, not simulated play.
for(const [seconds,label] of [[8,'04a-city'],[19,'04b-canyon'],[31,'04c-arches'],[41,'04d-waterfall-approach'],[43,'04e-waterfall-pass'],[49,'04f-finale']]){
 await evaluate('window.__novaFlight3D.auditSeek('+seconds+')');
 await sleep(800);
 await capture(label);
 if(label==='04b-canyon'){
  const state=JSON.parse(await evaluate('JSON.stringify(window.__novaFlight3D.snapshot())'));
  if(!state.checkpoint||state.rescueCount<1)throw Error('Stage order regression: escort encounter must follow checkpoint on canyon approach');
 }
}
// Verify that lateral input SCROLLS THE ACTUAL WORLD CAMERA instead of only
// shifting the aircraft across a fixed central view.
await evaluate("window.__novaFlight3D.auditSeek(11);window.__novaFlight3D.auditSetLane(0)");
await sleep(850);
await capture('04g-center-corridor');
const centered=JSON.parse(await evaluate("JSON.stringify(window.__novaFlight3D.snapshot())"));
await evaluate("window.__novaFlight3D.auditSetLane(43)");
await sleep(1400);
await capture('04h-far-right-world-pan');
const right=JSON.parse(await evaluate("JSON.stringify(window.__novaFlight3D.snapshot())"));
await evaluate("window.__novaFlight3D.auditSetLane(-43)");
await sleep(1400);
await capture('04i-far-left-world-pan');
const left=JSON.parse(await evaluate("JSON.stringify(window.__novaFlight3D.snapshot())"));
if(!(right.laneX>40&&left.laneX< -40))throw Error('Horizontal world flight range still too narrow');
if(!(right.cameraX-centered.cameraX>15&&centered.cameraX-left.cameraX>15))throw Error('Camera failed to scroll over distant lateral scenery');
if(!(right.shipNdcX<.96&&right.shipNdcX>0&&left.shipNdcX>-.96&&left.shipNdcX<0))throw Error('Arwing left visible safe area while panning');
if(right.cameraInsideSolid||left.cameraInsideSolid||centered.cameraInsideSolid)throw Error('Scrolling camera intersects buildings or the ground');
if(!right.shipVisible||!left.shipVisible)throw Error('Craft was invisible when documenting side scrolling');
console.log('AUDIT_LATERAL_SCROLL_OK',JSON.stringify({center:centered,right,left}));
await evaluate("window.__novaFlight3D.auditSetLane(0)");
await sleep(400);
await command('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:2,mobile:true,screenWidth:844,screenHeight:390});
await sleep(900);
await capture('05-iphone-landscape');
// Actual simultaneous multi-touch: drag the steering surface while holding FIRE.
// Detect stuck input, accidental scrolling/zoom and pointer capture failures.
await command('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
await command('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:330,y:200,id:1},{x:714,y:342,id:2}]});
await sleep(220);
await command('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:404,y:180,id:1},{x:714,y:342,id:2}]});
await sleep(500);
await capture('05a-multitouch-drag-fire');
await command('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await command('Emulation.setTouchEmulationEnabled',{enabled:false});
await sleep(950);
await capture('05b-boss-approach');
await evaluate("document.getElementById('pause').click()");
await sleep(300);
await capture('06-pause');
await writeFile('flight-audit/console-errors.json',JSON.stringify(errors,null,2));
console.log('AUDIT_ERRORS',JSON.stringify(errors));
chrome.kill('SIGTERM');socket.close();server.close();
if(errors.some(e=>/failed|uncaught|TypeError|WebGL/i.test(e)))process.exitCode=1;
