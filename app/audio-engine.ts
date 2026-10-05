import type {GameEvent,State,Weapon} from './sim.ts';
import {effectSamples,effectDurations,soundDefaults,safeVolume,stereoPosition,type EffectName,type SoundBus} from './sound-design.ts';
import {scoreUrls,scoreNames,scoreFor} from './score.ts';
interface Voice {source:AudioBufferSourceNode;gain:GainNode;pan:StereoPannerNode;priority:number;}
interface PlayingScore {source:AudioBufferSourceNode;gain:GainNode;id:number;started:number;offset:number;}
/** Gesture-safe sampled stereo music, cached effects and a bounded voice mixer. */
export class AudioEngine {
 private ctx:AudioContext|null=null;private master:GainNode|null=null;private music:GainNode|null=null;private effects:GainNode|null=null;private duck:GainNode|null=null;private wet:GainNode|null=null;
 private samples=new Map<EffectName,AudioBuffer>();private scores=new Map<number,AudioBuffer>();private loading=new Map<number,Promise<void>>();private voices:Voice[]=[];
 private current:PlayingScore|null=null;private wanted=-1;private saved:{id:number;offset:number}|null=null;private paused=false;private sequence=0;
 private last:Record<string,number>={};private unavailable=new Set<number>();
 muted=false;volumes={...soundDefaults};
 constructor(){try{const settings=JSON.parse(localStorage.getItem('nova-strike-audio-v8')||'null');if(settings)for(const k of Object.keys(soundDefaults) as SoundBus[])if(typeof settings[k]==='number')this.volumes[k]=safeVolume(settings[k]);}catch{/* Sound works without storage. */}}
 async unlock(){
  if(!this.ctx){
   const c=this.ctx=new AudioContext();this.master=c.createGain();this.music=c.createGain();this.effects=c.createGain();this.duck=c.createGain();
   const limit=c.createDynamicsCompressor();limit.threshold.value=-13;limit.knee.value=8;limit.ratio.value=5;limit.attack.value=.003;limit.release.value=.14;
   this.music.connect(this.duck);this.duck.connect(this.master);this.effects.connect(this.master);this.master.connect(limit);limit.connect(c.destination);
   this.wet=c.createGain();this.wet.gain.value=.12;const reverb=c.createConvolver();reverb.buffer=c.createBuffer(2,Math.floor(c.sampleRate*.55),c.sampleRate);
   for(let ch=0;ch<2;ch++){const out=reverb.buffer.getChannelData(ch);let s=7331+ch;for(let i=0;i<out.length;i++){s=(Math.imul(s,1664525)+1013904223)|0;out[i]=((s>>>0)/2147483648-1)*Math.exp(-i/out.length*7)*.19;}}
   this.wet.connect(reverb);reverb.connect(this.master);
   for(const name of Object.keys(effectDurations) as EffectName[]){const data=effectSamples(name,c.sampleRate),b=c.createBuffer(1,data.length,c.sampleRate);b.copyToChannel(data,0);this.samples.set(name,b);}
   this.applyVolumes();
  }
  if(this.ctx.state==='suspended')await this.ctx.resume();
 }
 private applyVolumes(){if(!this.ctx)return;const t=this.ctx.currentTime;this.master!.gain.setTargetAtTime(this.muted?0:this.volumes.master*.70,t,.025);this.music!.gain.setTargetAtTime(this.volumes.music,t,.04);this.effects!.gain.setTargetAtTime(this.volumes.effects,t,.025);this.wet!.gain.setTargetAtTime(this.volumes.effects*.12,t,.025);}
 toggle(){this.muted=!this.muted;this.applyVolumes();return this.muted;}
 setVolume(bus:SoundBus,value:number){this.volumes[bus]=safeVolume(value);this.applyVolumes();try{localStorage.setItem('nova-strike-audio-v8',JSON.stringify(this.volumes));}catch{/* Optional storage. */}}
 private stopVoice(v:Voice){v.gain.gain.cancelScheduledValues(this.ctx!.currentTime);v.gain.gain.setTargetAtTime(0,this.ctx!.currentTime,.004);try{v.source.stop(this.ctx!.currentTime+.025);}catch{/* Already ended. */}this.voices=this.voices.filter(x=>x!==v);}
 private play(name:EffectName,volume:number,x=0,priority=2){
  if(!this.ctx||!this.effects||this.muted)return;
  if(this.voices.length>=24){const quiet=this.voices.reduce((a,b)=>a.priority<=b.priority?a:b);if(quiet.priority>priority)return;this.stopVoice(quiet);}
  const c=this.ctx,s=c.createBufferSource(),g=c.createGain(),pan=c.createStereoPanner();s.buffer=this.samples.get(name)!;s.playbackRate.value=priority<4?1+((this.sequence++%5)-2)*.014:1;g.gain.value=volume;pan.pan.value=stereoPosition(x);
  s.connect(g);g.connect(pan);pan.connect(this.effects);pan.connect(this.wet!);const v={source:s,gain:g,pan,priority};this.voices.push(v);
  s.onended=()=>{s.disconnect();g.disconnect();pan.disconnect();this.voices=this.voices.filter(x=>x!==v);};s.start(c.currentTime+.002);
 }
 preview(){this.play('wide',.30,-3);this.play('collect',.25,3);}
 private scoreOffset(p:PlayingScore){return this.scores.has(p.id)?(p.offset+this.ctx!.currentTime-p.started)%this.scores.get(p.id)!.duration:0;}
 private stopScore(p:PlayingScore,fade=.10){const t=this.ctx!.currentTime;p.gain.gain.cancelScheduledValues(t);p.gain.gain.setTargetAtTime(0,t,fade/4);try{p.source.stop(t+fade);}catch{/* Already ended. */}}
 private startScore(id:number){
  if(!this.ctx||this.paused||this.wanted!==id||!this.scores.has(id)||this.current?.id===id)return;
  const c=this.ctx,previous=this.current,buffer=this.scores.get(id)!,s=c.createBufferSource(),g=c.createGain();s.buffer=buffer;s.loop=true;s.connect(g);g.connect(this.music!);
  const offset=this.saved?.id===id?this.saved.offset:0;this.saved=null;const t=c.currentTime;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(1,t+(previous?1:.25));s.start(t,offset%buffer.duration);
  this.current={source:s,gain:g,id,started:t,offset};s.onended=()=>{s.disconnect();g.disconnect();};if(previous)this.stopScore(previous,1);
 }
 private loadScore(id:number){
  if(!this.ctx||this.loading.has(id)||this.unavailable.has(id))return;
  const c=this.ctx,p=fetch(scoreUrls[id]).then(r=>{if(!r.ok)throw Error('Soundtrack unavailable');return r.arrayBuffer();}).then(b=>c.decodeAudioData(b)).then(buffer=>{this.scores.set(id,buffer);if(this.wanted===id)this.startScore(id);}).catch(()=>{this.unavailable.add(id);}).finally(()=>{this.loading.delete(id);});this.loading.set(id,p);
 }
 update(state:State,stage:number,boss:boolean){
  if(!this.ctx)return;const id=scoreFor(state,stage,boss),paused=state==='paused';
  if(paused&&!this.paused){if(this.current){this.saved={id:this.current.id,offset:this.scoreOffset(this.current)};this.stopScore(this.current);this.current=null;}for(const v of [...this.voices])this.stopVoice(v);}
  this.paused=paused;if(paused)return;this.wanted=id;
  if(this.scores.has(id))this.startScore(id);else this.loadScore(id);
  for(const key of this.scores.keys())if(![stage,6,7,this.current?.id].includes(key))this.scores.delete(key);
  if(id<6&&!this.scores.has(7))this.loadScore(7);
 }
 event(e:GameEvent,weapon:Weapon='wide'){
  if(!this.ctx||this.muted)return;const now=this.ctx.currentTime,x=e.x??0;
  if(e.type==='shot'){if(now-(this.last.shot??-1)<.055)return;this.last.shot=now;this.play(weapon,.19,x,1);return;}
  if(e.type==='enemyshot'){if(now-(this.last.enemy??-1)<.105)return;this.last.enemy=now;this.play('enemy',.075,x,1);return;}
  if(e.type==='hit'){if(now-(this.last.hit??-1)<.040)return;this.last.hit=now;this.play('hit',.07,x,1);return;}
  const sounds:Record<string,[EffectName,number,number]>={radio:['radio',.17,2],stage:['phase',.22,4],explode:[(e.size??1)>1.5?'heavy':'explosion',Math.min(.42,.19+(e.size??1)*.065),3],damage:['damage',.46,6],nova:['nova',.55,6],bosskill:['collapse',.62,7],power:['collect',.32,4],repair:['collect',.32,4],formation:['collect',.26,4],extend:['finish',.32,5],relic:['collect',.32,4],lock:['lock',.14,2],resonance:['nova',.38,5],part:['heavy',.40,5],phase:['phase',.38,5],weapon:['menu',.26,3],warning:['warning',.34,6],beam:['warning',.25,6],finish:['finish',.32,5]};
  const s=e.type==='finish'&&e.text==='SIGNAL LOST'?['damage',.28,5] as [EffectName,number,number]:sounds[e.type];if(s)this.play(s[0],s[1],x,s[2]);
  if(['nova','bosskill','damage','resonance'].includes(e.type)){const g=this.duck!.gain;g.cancelScheduledValues(now);g.setTargetAtTime(e.type==='bosskill'?.48:.67,now,.015);g.setTargetAtTime(1,now+.22,.16);}
  if(e.type==='stage'){this.saved=null;this.last={};}
 }
 diagnostics(){return {unlocked:!!this.ctx,state:this.ctx?.state??'locked',muted:this.muted,volumes:{...this.volumes},track:this.current?scoreNames[this.current.id]:null,trackId:this.current?.id??this.saved?.id??-1,offset:this.current?this.scoreOffset(this.current):this.saved?.offset??0,decoded:this.scores.size,effectBuffers:this.samples.size,voices:this.voices.length,paused:this.paused,unavailable:[...this.unavailable]};}
}
