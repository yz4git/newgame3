"""Check encoded deliverables, stereo signal, headroom and loop boundaries."""
from pathlib import Path
import subprocess,json,hashlib
import numpy as np
root=Path(__file__).resolve().parents[1]
tracks=json.loads((root/'docs/soundtrack-v8.json').read_text());report=[]
for track in tracks:
 p=root/track['file'];assert p.stat().st_size==track['bytes'],f'Truncated score: {p.name}'
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-acodec','pcm_f32le','-ar','44100','-ac','2','pipe:1'])
 samples=np.frombuffer(raw,dtype='<f4').reshape(-1,2)
 assert np.isfinite(samples).all();duration=len(samples)/44100
 peak=float(np.max(np.abs(samples)));rms=float(np.sqrt(np.mean(samples**2)));jump=float(np.max(np.abs(samples[0]-samples[-1])))
 assert abs(duration-track['seconds'])<.06,(p.name,duration,track['seconds'])
 assert .001<rms<.3 and peak<.98,(p.name,rms,peak)
 assert jump<.12,(p.name,jump)
 assert np.mean(np.abs(samples[:,0]-samples[:,1]))>.001
 report.append({'file':track['file'],'seconds':duration,'peak':peak,'rms':rms,'loopBoundaryJump':jump,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 print(p.name,'stereo',round(duration,3),'seconds; peak',round(peak,4),'boundary',round(jump,4))
(root/'docs/audio-metrics-v8.json').write_text(json.dumps(report,indent=2)+'\n')
