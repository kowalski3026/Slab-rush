// Slab Rush offline cache: the game page and three.js are cached on first load; music streams and is cached as it plays
const C='slabrush-v296';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png'])))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET')return;
  if(u.origin===location.origin&&(u.pathname.endsWith('/')||u.pathname.endsWith('.html'))){e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request)));return}
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok&&(u.origin===location.origin||u.hostname.endsWith('cdnjs.cloudflare.com')||u.hostname.endsWith('cloudfront.net'))){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp))}return r})))});
