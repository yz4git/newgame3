import type { GameEvent } from './sim.ts';
export class AudioEngine {
  private ctx:AudioContext|null=null;private master:GainNode|null=null;private music:GainNode|null=null;
  muted=false;private nextBeat=0;private beat=0;private noise:AudioBuffer|null=null;
  async unlock(){
    if(!this.ctx){
      this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=this.muted?0:.36;
      const compressor=this.ctx.createDynamicsCompressor();compressor.threshold.value=-14;compressor.ratio.value=6;
      this.master.connect(compressor);compressor.connect(this.ctx.destination);
      this.music=this.ctx.createGain();this.music.gain.value=.38;this.music.connect(this.master);
      this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      this.nextBeat=this.ctx.currentTime+.05;
    }if(this.ctx.state==='suspended')await this.ctx.resume();
  }
  toggle(){this.muted=!this.muted;if(this.ctx&&this.master)this.master.gain.setTargetAtTime(this.muted?0:.36,this.ctx.currentTime,.025);return this.muted;}
  private tone(freq:number,duration:number,type:OscillatorType='sine',volume=.1,when?:number,slide?:number,music=false){
    if(!this.ctx||!this.master)return;
    const t=when??this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);
    if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+duration);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.004);g.gain.exponentialRampToValueAtTime(.001,t+duration);
    o.connect(g);g.connect(music?this.music!:this.master);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  private hiss(duration:number,volume:number,frequency:number,when?:number){
    if(!this.ctx||!this.master||!this.noise)return;
    const t=when??this.ctx.currentTime,s=this.ctx.createBufferSource(),g=this.ctx.createGain(),f=this.ctx.createBiquadFilter();s.buffer=this.noise;
    f.type='lowpass';f.frequency.value=frequency;g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);
    s.connect(f);f.connect(g);g.connect(this.master);s.start(t);s.stop(t+duration);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};
  }
  update(active:boolean,stage:number,boss:boolean){
    if(!this.ctx||this.muted||!active){if(this.ctx)this.nextBeat=this.ctx.currentTime+.05;return;}
    const now=this.ctx.currentTime;if(this.nextBeat<now-.25)this.nextBeat=now+.03;
    const bpm=boss?150:136+stage*4,step=60/bpm/4;
    const root=[55,65.406,49][stage],chords=[0,0,5,7],notes=[0,12,7,15,0,19,7,12,5,12,10,17,7,14,10,19];
    while(this.nextBeat<now+.13){
      const t=this.nextBeat,b=this.beat,chord=chords[Math.floor(b/32)%4];
      if(b%4===0){this.tone(155,.19,'sine',.43,t,37,true);this.tone(root*2**(chord/12),.17,'sawtooth',.085,t,undefined,true);}
      if(b%8===4){this.hiss(.105,.10,5500,t);this.tone(180,.08,'triangle',.10,t,90,true);}
      if(b%2===0)this.hiss(.025,.025,9500,t);
      this.tone(root*4*2**((notes[b%16]+chord)/12),step*.72,'triangle',.065,t,undefined,true);
      if(b%16===0)for(const n of[0,7,12])this.tone(root*4*2**((chord+n)/12),step*7,'sine',.027,t,undefined,true);
      this.nextBeat+=step;this.beat++;
    }
  }
  event(e:GameEvent){
    if(this.muted)return;
    if(e.type==='shot')this.tone(940,.045,'triangle',.034,undefined,330);
    if(e.type==='explode'){this.hiss(.14+(e.size||1)*.025,.12,1800);this.tone(110,.10,'sine',.14,undefined,35);}
    if(e.type==='damage'){this.hiss(.28,.22,1900);this.tone(250,.24,'sawtooth',.08,undefined,50);}
    if(e.type==='nova'||e.type==='bosskill'){this.hiss(.8,.33,2800);this.tone(180,.7,'sine',.36,undefined,28);}
    if(['power','repair','formation','extend','relic'].includes(e.type)){
      const t=this.ctx?.currentTime||0;for(let i=0;i<4;i++)this.tone([523,659,784,1047][i],.12,'triangle',.12,t+i*.055);
    }
    if(e.type==='weapon')this.tone(680,.08,'sine',.12);
    if(e.type==='warning'||e.type==='beam'){const t=this.ctx?.currentTime||0;this.tone(440,.15,'square',.08,t);this.tone(660,.15,'square',.07,t+.2);}
  }
}
