import { build } from 'vite';
import { readFile, writeFile, readdir, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await build();
const assets=await readdir('dist/assets');
const version=createHash('sha256').update(assets.join('|')+await readFile('dist/index.html','utf8')).digest('hex').slice(0,12);
const urls=['./','./index.html','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png',...assets.map(f=>'./assets/'+f)];
const sw=`const CACHE='nova-${version}';const FILES=${JSON.stringify(urls)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('nova-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!u.href.startsWith(self.registration.scope))return;
if(e.request.mode==='navigate'){e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));}return r;}).catch(()=>caches.match('./index.html')));return;}
e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;})));});
`;
await writeFile('dist/sw.js',sw);await writeFile('dist/.nojekyll','');
await rm('assets',{recursive:true,force:true});
for(const file of await readdir('dist'))await cp('dist/'+file,file,{recursive:true});
console.log('GitHub Pages build ready:',version);
