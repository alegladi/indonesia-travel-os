const CACHE='alegladi-brain-shell-v1';
const SHELL=['/brain/','/brain/index.html','/brain/manifest.webmanifest'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  const url=new URL(req.url);
  if(req.method!=='GET') return;
  if(url.pathname.startsWith('/api/')) return; // Never cache private API responses.
  if(url.origin!==self.location.origin) return;
  event.respondWith(fetch(req).then(res=>{
    if(res.ok && (req.destination==='document'||req.destination==='style'||req.destination==='script')){
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(req,copy));
    }
    return res;
  }).catch(()=>caches.match(req).then(r=>r||caches.match('/brain/index.html'))));
});
