// Slab Rush service worker. v360: restored. This file had been empty since v335, so nothing was being kept on the phone between visits.
// Two caches. V holds the page itself and is replaced every release (bump it with the version). A holds models, photos, textures and
// engine files; it survives releases so they download once. Bump A only if a file's contents change under the same name
// (the safer habit: give a changed model or texture a new file name).
const V='slabrush-v369',A='slabrush-assets-1';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(V).then(c=>c.addAll(['./','./game.js','./manifest.json','./icon-192.png'])).catch(()=>{}))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!==A).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
const isAsset=u=>/^\/(models|paint|tex|lib|brand)\//.test(u.pathname)||u.pathname==='/_vercel/image'||/\.(glb|ktx2|hdr|wasm|png|jpg|webp)$/.test(u.pathname)||/\/three-r\d+\.min\.js$/.test(u.pathname);
self.addEventListener('fetch',e=>{const q=e.request;if(q.method!=='GET'||q.headers.has('range'))return;let u;try{u=new URL(q.url)}catch(_){return}
  if(u.origin!==location.origin)return;
  // the page: always the newest when online, the saved copy when offline
  if(q.mode==='navigate'||u.pathname.endsWith('/')||u.pathname.endsWith('.html')){
    e.respondWith(fetch(q).then(r=>{if(r.ok){const cp=r.clone();caches.open(V).then(c=>c.put(q,cp)).catch(()=>{})}return r}).catch(()=>caches.match(q,{ignoreSearch:true}).then(h=>h||caches.match('./',{ignoreSearch:true}))));return}
  // the game code (game.js): ask the server every launch, but while it is unchanged keep handing back the stored copy, so the browser can
  // reuse its compiled form instead of compiling 1.6 MB of script again. A changed file replaces the stored one at once; offline uses the stored one.
  if(u.pathname==='/game.js'){e.respondWith(caches.open(V).then(c=>c.match('./game.js').then(h=>fetch(q.url,{cache:'no-cache',credentials:'same-origin'}).then(r=>{
      if(!r||r.status!==200)return h||r;const a=h&&h.headers.get('etag'),b=r.headers.get('etag');if(h&&a&&b&&a===b)return h;c.put('./game.js',r.clone()).catch(()=>{});return r}).catch(()=>h||Response.error()))));return}
  if(!isAsset(u))return;
  // models, photos, textures: the saved copy if there is one, otherwise fetch it once and keep it
  e.respondWith(caches.open(A).then(c=>c.match(q,{ignoreVary:true}).then(h=>h||fetch(q).then(r=>{if(r.status===200)c.put(q,r.clone()).catch(()=>{});return r}))))});
