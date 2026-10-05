"""Render NOVA STRIKE's original, seamless stereo score. Requires numpy/scipy and ffmpeg."""
from pathlib import Path
import json, subprocess, tempfile, wave, sys
import numpy as np
from scipy.signal import butter, sosfilt

RATE = 44100
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app' / 'soundtracks'
OUT.mkdir(exist_ok=True)
TRACKS = [
    ('asteroids', 'Orbital Pulse', 136, 45, 0),
    ('ocean', 'Blue Squadron', 142, 48, 1),
    ('fortress', 'Citadel Circuit', 144, 43, 2),
    ('ice', 'Prismatic Flight', 132, 50, 3),
    ('jungle', 'Emerald Mechanism', 140, 42, 4),
    ('lava', 'Foundry Pressure', 148, 38, 5),
    ('title', 'The Last Signal', 96, 45, 6),
    ('boss', 'Reactor Pursuit', 156, 40, 7),
]
MOTIFS = [
    [0,7,12,10,7,3,7,10,12,15,14,10,7,10,3,7],
    [7,12,14,15,14,12,7,10,12,19,17,15,14,10,7,12],
    [0,0,7,10,12,10,7,3,0,7,10,12,15,14,10,7],
    [12,19,15,14,10,7,12,14,15,19,22,19,17,15,14,7],
    [0,7,10,12,7,3,10,7,12,15,10,7,5,10,7,3],
    [0,3,7,0,10,7,3,7,12,10,7,3,0,7,10,12],
    [0,7,12,15,14,7,10,12,3,10,15,19,17,15,12,7],
    [0,12,10,7,0,3,7,10,12,15,14,10,7,3,10,7],
]

def filt(x, cutoff, kind='lowpass'):
    return sosfilt(butter(2, cutoff, btype=kind, fs=RATE, output='sos'), x)

def env(t, attack, release, power=1):
    return np.minimum(1,t/attack) * np.minimum(1,(t[-1]-t)/release) * np.exp(-t*power)

def instrument(note, duration, kind, seed):
    t=np.arange(max(32,round(duration*RATE)))/RATE
    f=440*2**((note-69)/12)
    p=t*2*np.pi*f
    if kind=='bass':
        y=np.sin(p)+.21*np.sin(p*2)+.10*np.sin(p*3)
        return np.tanh(y*1.15)*env(t,.005,.035,5)
    if kind=='pad':
        y=sum(np.sin(p*k+t*.35*k)/k**1.9 for k in range(1,7))
        y+=.25*np.sin(p*1.003)+.25*np.sin(p*.997)
        return y*env(t,.26,.50,.22)*.65
    if kind=='bell':
        y=np.sin(p+np.sin(p*2.002)*1.4*np.exp(-t*6))+.17*np.sin(p*3.01)*np.exp(-t*9)
        return y*env(t,.004,.08,2.6)
    if kind=='pluck':
        y=np.sin(p+np.sin(p*2)*.65*np.exp(-t*14))+.20*np.sin(p*3)*np.exp(-t*8)
        return y*env(t,.004,.04,7)
    y=np.sin(p)+.22*np.sin(p*2)+.12*np.sin(p*3)
    y+=.12*np.sin(p*1.003+t*.8)
    return y*env(t,.012,.09,2.5)

def drum(kind, seed):
    rng=np.random.default_rng(seed)
    duration={'kick':.34,'snare':.23,'hat':.075,'open':.18,'tom':.32,'shaker':.065}[kind]
    t=np.arange(round(duration*RATE))/RATE
    noise=rng.standard_normal(len(t))*.32
    if kind=='kick':
        f=45+130*np.exp(-t*42)
        return np.sin(np.cumsum(f)*2*np.pi/RATE)*np.exp(-t*15)+filt(noise,4000)*np.exp(-t*160)*.22
    if kind=='snare':
        y=filt(filt(noise,950,'highpass'),7200)*np.exp(-t*22)*1.1
        return y+np.sin(2*np.pi*185*t)*np.exp(-t*30)*.40
    if kind=='tom':
        return np.sin(2*np.pi*(105*t+1.2*(1-np.exp(-t*18))))*np.exp(-t*14)*.65
    return filt(noise,kind=='shaker' and 4300 or 6700,'highpass')*np.exp(-t*(kind=='open' and 21 or 48))*1.7

requested=set(sys.argv[1:]) or {x[0] for x in TRACKS}
if not requested.issubset({x[0] for x in TRACKS}):raise ValueError('Unknown track name')
manifest=ROOT/'docs'/'soundtrack-v8.json'
metadata=[x for x in json.loads(manifest.read_text()) if Path(x['file']).stem.removesuffix('-v8') not in requested] if manifest.exists() else []
for key,title,bpm,root,style in TRACKS:
    if key not in requested:continue
    beat=60/bpm;bars=8 if style==6 else 16
    length=round(beat*4*bars*RATE)
    mix=np.zeros((length,2),dtype=np.float64)
    def add(y,at,volume,pan=0):
        ids=(np.arange(len(y))+round(at*RATE))%length
        gains=np.array([np.cos((pan+1)*np.pi/4),np.sin((pan+1)*np.pi/4)])*volume
        np.add.at(mix,ids,y[:,None]*gains[None,:])
    chords=[0,5,8,7]
    for bar in range(bars):
        chord=chords[(bar//2)%4]
        for j,n in enumerate([0,3,7,10]):
            add(instrument(root+24+chord+n,beat*4+.65,'pad',bar*20+j),bar*4*beat,.050 if style!=7 else .040,[-.62,-.20,.20,.62][j])
        for step in range(8):
            at=(bar*4+step*.5)*beat
            octave=12 if step in [3,6] else 0
            if style!=6:add(instrument(root+chord+octave,beat*.40,'bass',bar*8+step),at,.22 if style in [2,5,7] else .18)
            if style==6 and step%2==0:add(instrument(root+chord+12,beat*.70,'pluck',step),at,.085,(-1 if step%4 else 1)*.3)
            melodic=MOTIFS[style][(bar%2)*8+step]
            if bar>=8 and step in [1,5,7]:melodic+=12
            kind='bell' if style in [3,6] else 'pluck' if style in [1,4] else 'lead'
            if (style!=6 or step%2==0) and (bar%4!=3 or step<6):
                add(instrument(root+24+chord+melodic,beat*(.9 if style in [3,6] else .50),kind,bar*8+step),at,.074 if style in [3,6] else .094,np.sin(bar+step*.47)*.23)
        if style!=6:
            for step in range(16):
                at=(bar*4+step*.25)*beat
                if step in [0,8] or style in [0,2,5,7] and step in [4,12] or style==1 and step==7:
                    add(drum('kick',bar*17+step),at,.48)
                if step in [4,12]:add(drum('snare',bar*19+step),at,.27)
                if step%2==0:add(drum('hat' if step!=14 else 'open',bar*31+step),at,.080 if style!=3 else .040,(-1 if step%4 else 1)*.36)
                if style in [1,4] and step%2:add(drum('shaker',bar*43+step),at,.070,np.sin(step)*.5)
                if bar%4==3 and step in [10,13,15]:add(drum('tom',bar*29+step),at,.12 if style!=7 else .20,(step-12)/8)
        if bar%4==2:
            for step in [0,3,5]:add(instrument(root+36+chord+[7,3,0][[0,3,5].index(step)],beat*.85,'bell',step), (bar*4+step*.5)*beat,.034,-.45)
    # Circular stereo delays include the preceding loop's tails at the beginning.
    dry=mix.copy()
    for seconds,gain in [(beat*.75,.16),(beat*1.5,.075),(.037,.055),(.071,.045)]:
        mix+=np.roll(dry[:,::-1],round(seconds*RATE),axis=0)*gain
    mix=np.tanh(mix*1.28)
    mix*=.80/max(.001,np.max(np.abs(mix)))
    pcm=np.round(mix*32767).astype('<i2')
    with tempfile.TemporaryDirectory() as tmp:
        wav=Path(tmp)/'score.wav'
        with wave.open(str(wav),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(RATE);w.writeframes(pcm.tobytes())
        out=OUT/(key+'-v8.mp3')
        subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(wav),'-af','loudnorm=I=-20:TP=-2:LRA=9','-ar','44100','-ac','2','-c:a','libmp3lame','-b:a','128k','-metadata','title='+title,str(out)],check=True)
    metadata.append({'file':'app/soundtracks/'+out.name,'title':title,'bpm':bpm,'bars':bars,'seconds':length/RATE,'composition':'Original synthesized score; no third-party samples','bytes':out.stat().st_size})
    print(key,round(length/RATE,2),'sec',out.stat().st_size,'bytes',flush=True)
(ROOT/'docs'/'soundtrack-v8.json').write_text(json.dumps(metadata,indent=2)+'\n')
