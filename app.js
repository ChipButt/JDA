(()=>{
'use strict';

const LEGACY_DOG_KEY='jda-dogs-v1';
const LEGACY_SETTINGS_KEY='jda-settings-v2';
const LEGACY_POSTCODE_CACHE_KEY='jda-postcode-cache-v1';
const DB_NAME='jda-dog-organiser-db';
const DB_VERSION=1;
const DOG_STORE='dogs';
const APP_STORE='app';
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const $=s=>document.querySelector(s);
const app=$('#app');
const pageTitle=$('#page-title');
const dogDlg=$('#dog-dialog');
const locationDlg=$('#location-dialog');
const detailDlg=$('#detail-dialog');
const dataDlg=$('#data-dialog');
const walkSlots=$('#walk-slots');
const sitSlots=$('#sit-slots');
const walkOn=$('#walking-enabled');
const sitOn=$('#sitting-enabled');
const walkEditor=$('#walking-editor');
const sitEditor=$('#sitting-editor');

let db;
let dogs=[];
let settings={start:null,destinations:[]};
let postcodeCache={};
let view='home';
let routeDraft=null;

function uid(){return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function cleanPostcode(v=''){return String(v).toUpperCase().replace(/\s+/g,' ').trim()}
function today(){return new Intl.DateTimeFormat('en-GB',{weekday:'long'}).format(new Date())}
function dateLabel(){return new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}
function minToTime(m){m=Math.max(0,Math.round(m));const h=Math.floor(m/60)%24;const mins=m%60;return `${String(h).padStart(2,'0')}:${String(mins).padStart(2,'0')}`}
function timeToMin(v){if(!v)return null;const [h,m]=String(v).split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null}
function clampNumber(v,min,max,fallback){const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback}

function migrateDog(d={}){
  return {
    id:d.id||uid(),
    photo:d.photo||'',
    name:d.name||'',
    breed:d.breed||'',
    age:d.age||'',
    owner:d.owner||'',
    addressLine1:d.addressLine1??d.address??'',
    addressTown:d.addressTown||'',
    addressCounty:d.addressCounty||'',
    addressPostcode:cleanPostcode(d.addressPostcode||''),
    keyInfo:d.keyInfo??(d.hasKey?'Key held':''),
    special:d.special||'',
    other:d.other||'',
    walking:!!d.walking,
    walkSchedule:Array.isArray(d.walkSchedule)?d.walkSchedule:[],
    sitting:!!d.sitting,
    sitSchedule:Array.isArray(d.sitSchedule)?d.sitSchedule:[]
  };
}
function normalizeLocation(loc={}){
  return {
    id:loc.id||uid(),
    name:loc.name||'',
    line1:loc.line1||loc.addressLine1||'',
    town:loc.town||loc.addressTown||'',
    county:loc.county||loc.addressCounty||'',
    postcode:cleanPostcode(loc.postcode||loc.addressPostcode||'')
  };
}
function normalizeSettings(raw={}){
  return {
    start:raw?.start?normalizeLocation(raw.start):null,
    destinations:Array.isArray(raw?.destinations)?raw.destinations.map(normalizeLocation):[]
  };
}
function addressParts(x){
  if(!x)return[];
  return [x.addressLine1??x.line1,x.addressTown??x.town,x.addressCounty??x.county,x.addressPostcode??x.postcode]
    .map(v=>(v||'').trim()).filter(Boolean);
}
function fullAddress(x){return addressParts(x).join(', ')}
function firstAddressLine(x){return (x?.addressLine1??x?.line1??'').trim()}
function postcodeOf(x){return cleanPostcode(x?.addressPostcode??x?.postcode??'')}
function hasAddress(x){return addressParts(x).length>0}
function avatar(d){return d.photo?`<img class="dog-avatar" src="${d.photo}" alt="${esc(d.name)}">`:`<div class="avatar-fallback">${esc((d.name||'?')[0].toUpperCase())}</div>`}

function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const database=req.result;
      if(!database.objectStoreNames.contains(DOG_STORE))database.createObjectStore(DOG_STORE,{keyPath:'id'});
      if(!database.objectStoreNames.contains(APP_STORE))database.createObjectStore(APP_STORE,{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Could not open database'));
  });
}
function tx(storeName,mode='readonly'){return db.transaction(storeName,mode).objectStore(storeName)}
function requestAsPromise(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function dbGet(storeName,key){return requestAsPromise(tx(storeName).get(key))}
async function dbGetAll(storeName){return requestAsPromise(tx(storeName).getAll())}
async function dbPut(storeName,value){return requestAsPromise(tx(storeName,'readwrite').put(value))}
async function dbDelete(storeName,key){return requestAsPromise(tx(storeName,'readwrite').delete(key))}
async function dbClear(storeName){return requestAsPromise(tx(storeName,'readwrite').clear())}

async function maybeImportLegacy(){
  const migrated=await dbGet(APP_STORE,'migratedLegacy');
  if(migrated?.value)return;
  let imported=false;
  try{
    const legacyDogs=JSON.parse(localStorage.getItem(LEGACY_DOG_KEY)||'[]');
    if(Array.isArray(legacyDogs)&&legacyDogs.length){
      for(const dog of legacyDogs){
        await dbPut(DOG_STORE,migrateDog(dog));
      }
      imported=true;
    }
  }catch{}
  try{
    const legacySettings=JSON.parse(localStorage.getItem(LEGACY_SETTINGS_KEY)||'{}');
    const legacyCache=JSON.parse(localStorage.getItem(LEGACY_POSTCODE_CACHE_KEY)||'{}');
    const nextSettings=normalizeSettings(legacySettings);
    if(nextSettings.start||nextSettings.destinations.length){
      await dbPut(APP_STORE,{key:'settings',value:nextSettings});
      imported=true;
    }
    if(legacyCache&&typeof legacyCache==='object'&&Object.keys(legacyCache).length){
      await dbPut(APP_STORE,{key:'postcodeCache',value:legacyCache});
      imported=true;
    }
  }catch{}
  await dbPut(APP_STORE,{key:'migratedLegacy',value:true});
  if(imported)toast('Previous app data was moved into the new IndexedDB storage');
}
async function loadState(){
  dogs=(await dbGetAll(DOG_STORE)).map(migrateDog);
  dogs.sort((a,b)=>a.name.localeCompare(b.name));
  settings=normalizeSettings((await dbGet(APP_STORE,'settings'))?.value||{});
  postcodeCache=(await dbGet(APP_STORE,'postcodeCache'))?.value||{};
}
async function saveDogRecord(dog){
  const clean=migrateDog(dog);
  await dbPut(DOG_STORE,clean);
  const i=dogs.findIndex(x=>x.id===clean.id);
  if(i<0)dogs.push(clean); else dogs[i]=clean;
  dogs.sort((a,b)=>a.name.localeCompare(b.name));
}
async function removeDogRecord(id){await dbDelete(DOG_STORE,id);dogs=dogs.filter(d=>d.id!==id)}
async function saveSettings(){await dbPut(APP_STORE,{key:'settings',value:settings})}
async function savePostcodeCache(){await dbPut(APP_STORE,{key:'postcodeCache',value:postcodeCache})}

function jobs(type,day=today()){
  return dogs.flatMap(d=>{
    const enabled=type==='walk'?d.walking:d.sitting;
    const schedule=type==='walk'?d.walkSchedule:d.sitSchedule;
    return enabled?(schedule||[]).filter(x=>x.day===day).map(slot=>({d,slot,type})):[];
  }).sort((a,b)=>(a.slot.time||'99:99').localeCompare(b.slot.time||'99:99'));
}
function pickupForDay(d,day){return (d.walkSchedule||[]).find(x=>x.day===day)?.time||''}
function tags(d){
  return `${d.walking?'<span class="tag">Walking</span>':''}${d.sitting?'<span class="tag sit">Sitting</span>':''}${d.keyInfo?'<span class="tag key">Entry info</span>':''}`;
}
function dogCard(d){
  return `<button class="dog-card" data-dog="${d.id}">${avatar(d)}<span class="card-main"><strong>${esc(d.name)}</strong><small>${esc([d.breed,d.owner&&`Owner: ${d.owner}`].filter(Boolean).join(' · ')||'No extra details yet')}</small><span class="tag-row">${tags(d)}</span></span><span class="card-chevron">›</span></button>`;
}
function jobCard(x){
  return `<button class="job-card" data-dog="${x.d.id}">${avatar(x.d)}<span class="card-main"><strong>${esc(x.d.name)}</strong><small>${x.type==='walk'?'Walk':'Sitting'}${hasAddress(x.d)?' · '+esc(firstAddressLine(x.d)||postcodeOf(x.d)):''}</small></span><strong>${esc(x.slot.time||'Any time')}</strong></button>`;
}
function empty(h,p,b='Add a dog'){
  return `<div class="empty-state"><div class="empty-icon">🐾</div><h3>${esc(h)}</h3><p>${esc(p)}</p><button class="primary-button" data-add>${esc(b)}</button></div>`;
}

function home(){
  pageTitle.textContent='Today';
  const w=jobs('walk'),s=jobs('sit'),all=[...w,...s].sort((a,b)=>(a.slot.time||'99:99').localeCompare(b.slot.time||'99:99'));
  const destinations=settings.destinations||[];
  app.innerHTML=`
    <section class="hero">
      <p class="date">${esc(dateLabel())}</p>
      <div class="hero-count"><strong>${all.length}</strong><span>${all.length===1?'job today':'jobs today'}</span></div>
      <p class="hero-sub">${dogs.length?`${dogs.length} ${dogs.length===1?'dog':'dogs'} saved and ready.`:'Add your first dog to get started.'}</p>
    </section>

    <section class="quick-grid">
      <button class="quick-card" data-go="dogs"><span class="quick-symbol">🐾</span><strong>${dogs.length}</strong><small>All dogs</small></button>
      <button class="quick-card" data-go="walks"><span class="quick-symbol">↗</span><strong>${w.length}</strong><small>Walks today</small></button>
      <button class="quick-card" data-go="sitting"><span class="quick-symbol">❤</span><strong>${s.length}</strong><small>Sitting today</small></button>
      <button class="quick-card" data-route><span class="quick-symbol">⌖</span><strong>${dogs.filter(d=>d.walking&&postcodeOf(d)).length}</strong><small>Route-ready</small></button>
    </section>

    <section class="section">
      <div class="section-title-row"><h2>Jess's starting point</h2>${settings.start?'<button class="text-button" data-edit-start>Edit</button>':'<button class="text-button" data-edit-start>Add</button>'}</div>
      <div class="info-card">
        ${settings.start?`<strong>${esc(settings.start.name||'Starting location')}</strong><p>${esc(fullAddress(settings.start)||'No address saved')}</p>`:`<p>Add Jess’s normal starting location so the route planner can work out when she needs to leave.</p><button class="primary-button" data-edit-start type="button">Add starting location</button>`}
      </div>
    </section>

    <section class="section">
      <div class="section-title-row"><h2>Walking fields & destinations</h2><button class="text-button" data-add-location type="button">+ Add field</button></div>
      ${destinations.length?`<div class="location-list">${destinations.map(l=>`<div class="location-card"><div class="location-card-top"><div><strong>${esc(l.name)}</strong><p>${esc(fullAddress(l))}</p></div><button class="text-button" data-edit-location="${l.id}" data-location-kind="destination">Edit</button></div><span class="location-chip">Destination field</span></div>`).join('')}</div>`:`<div class="info-card"><p>Save the walking fields or other destinations Jess uses, then pick one during route planning.</p></div>`}
    </section>

    <section class="section">
      <div class="section-title-row"><h2>Today's schedule</h2></div>
      <div class="list">${all.length?all.map(jobCard).join(''):empty('Nothing scheduled today',dogs.length?'There are no walks or sitting times saved for today.':'Add a dog and its schedule to see today’s jobs here.')}</div>
    </section>

    <section class="section">
      <div class="home-plan-card">
        <div class="section-title-row"><h2>Need a walking route?</h2><button class="text-button" data-route type="button">Open planner</button></div>
        <p>Pick the dogs, choose the field, set the arrival time, and the app will suggest the most logical order plus a leave-by time.</p>
      </div>
    </section>`;
}

function allDogs(q=''){
  pageTitle.textContent='All Dogs';
  const term=q.trim().toLowerCase();
  const filtered=dogs.filter(d=>[
    d.name,d.breed,d.owner,d.addressLine1,d.addressTown,d.addressCounty,d.addressPostcode,d.keyInfo
  ].some(v=>(v||'').toLowerCase().includes(term)));
  app.innerHTML=`<div class="search-wrap"><input id="dog-search" type="search" placeholder="Search dogs, owners or addresses" value="${esc(q)}"></div><div class="list">${filtered.length?filtered.map(dogCard).join(''):dogs.length?empty('No matches','Try a different search.','Clear search'):empty('No dogs yet','Add Jess’s first dog profile.')}</div>`;
  $('#dog-search').oninput=e=>allDogs(e.target.value);
  if(dogs.length&&!filtered.length)$('[data-add]').onclick=()=>allDogs('');
}

function schedule(type){
  const isWalk=type==='walk';
  const active=dogs.filter(d=>isWalk?d.walking:d.sitting);
  const slots=active.flatMap(d=>(isWalk?d.walkSchedule:d.sitSchedule||[]).map(slot=>({d,slot})));
  const groups=DAYS.map(day=>({day,list:slots.filter(x=>x.slot.day===day).sort((a,b)=>(a.slot.time||'99:99').localeCompare(b.slot.time||'99:99'))})).filter(g=>g.list.length);
  pageTitle.textContent=isWalk?'Walking':'Sitting';
  app.innerHTML=`${active.length?`<section class="section" style="margin-top:0"><div class="section-title-row"><h2>${active.length} ${active.length===1?'dog':'dogs'}</h2><span class="muted">Weekly schedule</span></div></section>`:''}${groups.length?groups.map(g=>`<section class="schedule-day"><h3>${g.day}</h3><div class="list">${g.list.map(x=>`<button class="schedule-card" data-dog="${x.d.id}"><span class="schedule-time">${esc(x.slot.time||'—')}</span>${avatar(x.d)}<span class="card-main"><strong>${esc(x.d.name)}</strong><small>${esc(hasAddress(x.d)?firstAddressLine(x.d)||postcodeOf(x.d):x.d.breed||'')}</small></span><span class="card-chevron">›</span></button>`).join('')}</div></section>`).join(''):empty(isWalk?'No walking schedule yet':'No sitting schedule yet',isWalk?'Turn on Walking in a dog profile and add the days and times.':'Turn on Sitting in a dog profile and add the days and times.')}${isWalk&&active.some(d=>postcodeOf(d))?'<section class="section"><button class="primary-button" style="width:100%" data-route>Plan a pickup route</button></section>':''}`;
}

function makeRouteDraft(day=today()){
  const selectedDogs=dogs.filter(d=>d.walking&&postcodeOf(d));
  const selected={};
  selectedDogs.slice(0,Math.min(3,selectedDogs.length)).forEach(d=>selected[d.id]=pickupForDay(d,day));
  return {
    day,
    destinationId:settings.destinations[0]?.id||'',
    arrival:'10:00',
    stopMinutes:5,
    tolerance:10,
    trafficBuffer:10,
    selected,
    result:null
  };
}

function route(){
  pageTitle.textContent='Pickup Route';
  if(!routeDraft)routeDraft=makeRouteDraft();
  const dayDogs=dogs.filter(d=>d.walking);
  const destinations=settings.destinations||[];
  app.innerHTML=`
    <button class="text-button" data-back>‹ Back</button>
    <div class="route-box">
      <div class="section-title-row"><h2>Walking route planner</h2></div>
      <p>Choose the dogs to collect, the field Jess needs to reach, and the time she needs to be there. The planner works backwards and tests different collection orders.</p>
      <div class="meta-grid two">
        <label><span>Walking day</span><select id="route-day">${DAYS.map(d=>`<option ${d===routeDraft.day?'selected':''}>${d}</option>`).join('')}</select></label>
        <label><span>Destination field</span><select id="route-destination"><option value="">Choose field</option>${destinations.map(d=>`<option value="${d.id}" ${d.id===routeDraft.destinationId?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label>
      </div>
      <div class="meta-grid two">
        <label><span>Need to arrive by</span><input id="field-arrival" type="time" value="${esc(routeDraft.arrival)}"></label>
        <label><span>Minutes spent at each house</span><input id="stop-minutes" type="number" min="0" max="30" step="1" value="${routeDraft.stopMinutes}"></label>
      </div>
      <div class="meta-grid two">
        <label><span>Allowed pickup lateness (mins)</span><input id="pickup-tolerance" type="number" min="0" max="60" step="1" value="${routeDraft.tolerance}"></label>
        <label><span>Traffic / parking buffer (mins)</span><input id="traffic-buffer" type="number" min="0" max="60" step="1" value="${routeDraft.trafficBuffer}"></label>
      </div>

      <div class="section" style="margin-top:16px">
        <div class="section-title-row"><h3>Dogs to collect</h3></div>
        <div class="route-picker">
          ${dayDogs.length?dayDogs.map(d=>{
            const pc=postcodeOf(d),checked=Object.prototype.hasOwnProperty.call(routeDraft.selected,d.id),t=routeDraft.selected[d.id]??pickupForDay(d,routeDraft.day);
            return `<label class="route-option"><input class="route-dog-check" type="checkbox" value="${d.id}" ${checked?'checked':''} ${pc?'':'disabled'}><span><strong>${esc(d.name)}</strong><small style="display:block;color:var(--muted);margin-top:2px">${pc?esc(fullAddress(d)):'Add a postcode to use in route planning'}</small></span><input class="pickup-time" data-pickup-id="${d.id}" type="time" value="${esc(t||'')}" ${pc?'':'disabled'} aria-label="${esc(d.name)} pickup time"></label>`;
          }).join(''):'<p class="muted">No walking dogs have been added yet.</p>'}
        </div>
      </div>

      <div class="planner-actions">
        ${destinations.length?'<button id="calculate-route" class="primary-button" type="button">Calculate best route</button>':'<button class="primary-button" data-add-location type="button">Add a destination field</button>'}
      </div>
      <p class="route-warning">Route calculations are estimates and do not include live traffic. Only postcodes are used to obtain coordinates; full client addresses are sent to Google Maps only when Jess chooses to open the finished route.</p>
      <div id="route-result">${routeDraft.result?routeResultHtml(routeDraft.result):''}</div>
    </div>`;
  $('#fab').hidden=true;
  bindRouteControls();
}

function bindRouteControls(){
  $('#route-day')?.addEventListener('change',e=>{routeDraft=makeRouteDraft(e.target.value);route()});
  $('#route-destination')?.addEventListener('change',e=>{routeDraft.destinationId=e.target.value;routeDraft.result=null});
  $('#field-arrival')?.addEventListener('change',e=>{routeDraft.arrival=e.target.value;routeDraft.result=null});
  $('#stop-minutes')?.addEventListener('change',e=>{routeDraft.stopMinutes=clampNumber(e.target.value,0,30,5);routeDraft.result=null});
  $('#pickup-tolerance')?.addEventListener('change',e=>{routeDraft.tolerance=clampNumber(e.target.value,0,60,10);routeDraft.result=null});
  $('#traffic-buffer')?.addEventListener('change',e=>{routeDraft.trafficBuffer=clampNumber(e.target.value,0,60,10);routeDraft.result=null});
  app.querySelectorAll('.route-dog-check').forEach(ch=>ch.onchange=()=>{
    const t=app.querySelector(`[data-pickup-id="${CSS.escape(ch.value)}"]`)?.value||'';
    if(ch.checked)routeDraft.selected[ch.value]=t; else delete routeDraft.selected[ch.value];
    routeDraft.result=null;
  });
  app.querySelectorAll('[data-pickup-id]').forEach(inp=>inp.onchange=()=>{
    const id=inp.dataset.pickupId;
    if(app.querySelector(`.route-dog-check[value="${CSS.escape(id)}"]`)?.checked)routeDraft.selected[id]=inp.value;
    routeDraft.result=null;
  });
  $('#calculate-route')?.addEventListener('click',calculateRoute);
  $('#open-optimized-route')?.addEventListener('click',openOptimizedRoute);
}

async function postcodeCoord(postcode){
  const pc=cleanPostcode(postcode);
  if(!pc)throw new Error('Missing postcode');
  if(postcodeCache[pc])return postcodeCache[pc];
  const res=await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`,{headers:{Accept:'application/json'}});
  if(!res.ok)throw new Error(`Postcode ${pc} was not found`);
  const data=await res.json();
  const lat=data?.result?.latitude,lon=data?.result?.longitude;
  if(!Number.isFinite(lat)||!Number.isFinite(lon))throw new Error(`Postcode ${pc} has no coordinates`);
  postcodeCache[pc]={lat,lon};
  await savePostcodeCache();
  return postcodeCache[pc];
}
async function roadMatrix(points){
  const coords=points.map(p=>`${p.lon},${p.lat}`).join(';');
  try{
    const res=await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?annotations=duration,distance`);
    if(!res.ok)throw new Error('Road service unavailable');
    const x=await res.json();
    if(x.code!=='Ok'||!Array.isArray(x.durations))throw new Error('Road service unavailable');
    return {durations:x.durations.map(r=>r.map(v=>v==null?Infinity:v/60)),distances:(x.distances||[]).map(r=>r.map(v=>v==null?Infinity:v/1000)),fallback:false};
  }catch{
    const n=points.length,durations=Array.from({length:n},()=>Array(n).fill(0)),distances=Array.from({length:n},()=>Array(n).fill(0));
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){
      const km=haversine(points[i],points[j]);
      distances[i][j]=km;
      durations[i][j]=i===j?0:(km/42*60)+2;
    }
    return {durations,distances,fallback:true};
  }
}
function haversine(a,b){const R=6371,toRad=x=>x*Math.PI/180,dLat=toRad(b.lat-a.lat),dLon=toRad(b.lon-a.lon),la1=toRad(a.lat),la2=toRad(b.lat);const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function permutations(items){const out=[];function walk(prefix,rest){if(!rest.length){out.push(prefix);return}for(let i=0;i<rest.length;i++)walk([...prefix,rest[i]],[...rest.slice(0,i),...rest.slice(i+1)])}walk([],items);return out}
function simulate(order,depart,matrix,targets,stopMinutes,tolerance,deadline){
  let t=depart,prev=0,drive=0,wait=0;const stops=[];
  for(const dogIndex of order){
    const pointIndex=dogIndex+1,leg=matrix.durations[prev][pointIndex]; if(!Number.isFinite(leg))return {feasible:false};
    t+=leg; drive+=leg;
    const arrival=t,target=targets[dogIndex];
    if(target!=null&&t<target){wait+=target-t;t=target}
    const pickup=t,late=target==null?0:pickup-target;
    if(target!=null&&late>tolerance+.01)return {feasible:false};
    stops.push({dogIndex,arrival,pickup,target,leg,late});
    t+=stopMinutes; prev=pointIndex;
  }
  const destIndex=matrix.durations.length-1,finalLeg=matrix.durations[prev][destIndex]; if(!Number.isFinite(finalLeg))return {feasible:false};
  t+=finalLeg; drive+=finalLeg;
  return {feasible:t<=deadline+.01,depart,stops,fieldArrival:t,finalLeg,drive,wait};
}
function latestFeasible(order,matrix,targets,stopMinutes,tolerance,deadline){
  const earliest=simulate(order,0,matrix,targets,stopMinutes,tolerance,deadline); if(!earliest.feasible)return null;
  let lo=0,hi=deadline;
  for(let i=0;i<28;i++){const mid=(lo+hi)/2,s=simulate(order,mid,matrix,targets,stopMinutes,tolerance,deadline); if(s.feasible)lo=mid; else hi=mid}
  return simulate(order,lo,matrix,targets,stopMinutes,tolerance,deadline);
}
function totalDistance(order,matrix){let prev=0,total=0;for(const d of order){total+=matrix.distances[prev][d+1]||0;prev=d+1}total+=matrix.distances[prev][matrix.distances.length-1]||0;return total}
function optimize(orderDogs,matrix,pickups,stopMinutes,tolerance,deadline){
  const targets=orderDogs.map(d=>timeToMin(pickups[d.id]));
  const indexes=orderDogs.map((_,i)=>i);
  const perms=permutations(indexes);
  let best=null;
  for(const order of perms){
    const sim=latestFeasible(order,matrix,targets,stopMinutes,tolerance,deadline); if(!sim)continue;
    const distance=totalDistance(order,matrix);
    if(!best||sim.drive<best.sim.drive-.1||(Math.abs(sim.drive-best.sim.drive)<.1&&distance<best.distance-.05)||(Math.abs(sim.drive-best.sim.drive)<.1&&Math.abs(distance-best.distance)<.05&&sim.depart>best.sim.depart))best={order,sim,distance};
  }
  return best;
}
async function calculateRoute(){
  syncRouteDraftFromForm();
  const resultBox=$('#route-result');
  const button=$('#calculate-route');
  const selectedIds=Object.keys(routeDraft.selected);
  if(!settings.start||!postcodeOf(settings.start))return showRouteError('Set Jess’s starting location and postcode on the Home page first.');
  const destination=settings.destinations.find(l=>l.id===routeDraft.destinationId);
  if(!destination||!postcodeOf(destination))return showRouteError('Choose a destination field with a postcode.');
  if(!selectedIds.length)return showRouteError('Select at least one dog to collect.');
  if(selectedIds.length>7)return showRouteError('Select up to 7 dogs at a time so the route can be optimised reliably on the phone.');
  const selectedDogs=selectedIds.map(id=>dogs.find(d=>d.id===id)).filter(Boolean);
  if(selectedDogs.some(d=>!postcodeOf(d)))return showRouteError('Every selected dog needs a postcode.');
  const arrival=timeToMin(routeDraft.arrival); if(arrival==null)return showRouteError('Add the time Jess needs to reach the field.');
  const deadline=arrival-routeDraft.trafficBuffer; if(deadline<=0)return showRouteError('The traffic buffer is larger than the available day.');
  button.disabled=true; button.textContent='Calculating…';
  resultBox.innerHTML='<div class="planner-status">Checking postcodes and road travel times…</div>';
  try{
    const pointRecords=[settings.start,...selectedDogs,destination];
    const points=[];
    for(const p of pointRecords)points.push(await postcodeCoord(postcodeOf(p)));
    const matrix=await roadMatrix(points);
    const best=optimize(selectedDogs,matrix,routeDraft.selected,routeDraft.stopMinutes,routeDraft.tolerance,deadline);
    if(!best){routeDraft.result=null;resultBox.innerHTML='<div class="planner-status error">No collection order can meet all of those pickup times and still reach the field on time. Try increasing the allowed pickup lateness, reducing time at each house, or changing one of the pickup times.</div>';return}
    const orderedDogs=best.order.map(i=>selectedDogs[i]);
    const stops=best.sim.stops.map(s=>({...s,dog:selectedDogs[s.dogIndex]}));
    routeDraft.result={orderedDogs,stops,depart:best.sim.depart,fieldArrival:best.sim.fieldArrival,finalLeg:best.sim.finalLeg,drive:best.sim.drive,distance:best.distance,destination,arrivalTarget:arrival,buffer:routeDraft.trafficBuffer,fallback:matrix.fallback,day:routeDraft.day};
    resultBox.innerHTML=routeResultHtml(routeDraft.result);
    $('#open-optimized-route')?.addEventListener('click',openOptimizedRoute);
  }catch(err){showRouteError(err?.message||'The route could not be calculated. Check the postcodes and internet connection.');}
  finally{button.disabled=false;button.textContent='Calculate best route';}
}
function syncRouteDraftFromForm(){
  routeDraft.arrival=$('#field-arrival')?.value||routeDraft.arrival;
  routeDraft.destinationId=$('#route-destination')?.value||routeDraft.destinationId;
  routeDraft.stopMinutes=clampNumber($('#stop-minutes')?.value,0,30,5);
  routeDraft.tolerance=clampNumber($('#pickup-tolerance')?.value,0,60,10);
  routeDraft.trafficBuffer=clampNumber($('#traffic-buffer')?.value,0,60,10);
  const selected={};
  app.querySelectorAll('.route-dog-check:checked').forEach(ch=>{selected[ch.value]=app.querySelector(`[data-pickup-id="${CSS.escape(ch.value)}"]`)?.value||''});
  routeDraft.selected=selected;
}
function showRouteError(message){const box=$('#route-result');if(box)box.innerHTML=`<div class="planner-status error">${esc(message)}</div>`}
function routeResultHtml(r){
  const plannedField=minToTime(r.fieldArrival),target=minToTime(r.arrivalTarget);
  let prevName='Start';
  const rows=r.stops.map(s=>{const scheduled=s.target==null?'No fixed pickup time':`Scheduled ${minToTime(s.target)}`;const drive=Math.max(1,Math.round(s.leg));const html=`<div class="timeline-row"><div class="timeline-time">${minToTime(s.pickup)}</div><div class="timeline-mark"></div><div class="timeline-copy"><strong>Collect ${esc(s.dog.name)}</strong><small>${drive} min drive from ${esc(prevName)} · ${scheduled}</small></div></div>`;prevName=s.dog.name;return html}).join('');
  return `<section class="route-result"><div class="leave-card"><small>LEAVE BY</small><strong>${minToTime(r.depart)}</strong><p>${r.day} · about ${Math.round(r.drive)} min driving · ${r.distance.toFixed(1)} km</p></div><div class="timeline"><div class="timeline-row"><div class="timeline-time">${minToTime(r.depart)}</div><div class="timeline-mark"></div><div class="timeline-copy"><strong>Leave starting location</strong><small>${esc(fullAddress(settings.start))}</small></div></div>${rows}<div class="timeline-row"><div class="timeline-time">${plannedField}</div><div class="timeline-mark"></div><div class="timeline-copy"><strong>Arrive at ${esc(r.destination.name)}</strong><small>${Math.max(1,Math.round(r.finalLeg))} min drive from ${esc(prevName)}${r.buffer?` · ${r.buffer} min before ${target} target`:''}</small></div></div></div>${r.fallback?'<div class="route-warning">The road-routing service was unavailable, so this result uses a rough straight-line driving estimate. Recalculate before relying on the times.</div>':'<div class="route-warning">Times are road estimates, not live traffic. The extra buffer is included in the leave-by time. Road data © OpenStreetMap contributors.</div>'}<button id="open-optimized-route" class="primary-button" type="button" style="width:100%;margin-top:12px">Open this order in Google Maps</button></section>`;
}
function openOptimizedRoute(){
  const r=routeDraft?.result; if(!r)return;
  if(r.orderedDogs.length>3)toast('Google Maps on some mobile browsers may limit routes to 3 intermediate stops');
  const origin=fullAddress(settings.start),destination=fullAddress(r.destination),waypoints=r.orderedDogs.map(fullAddress).filter(Boolean).join('|');
  const url=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypoints?`&waypoints=${encodeURIComponent(waypoints)}`:''}&travelmode=driving`;
  open(url,'_blank','noopener');
}

function setView(v){
  view=v;
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  $('#fab').hidden=false;
  if(v==='home')home();
  if(v==='dogs')allDogs();
  if(v==='walks')schedule('walk');
  if(v==='sitting')schedule('sit');
  if(v==='route')route();
  scrollTo(0,0);
}
function addSlot(box,x={day:'Monday',time:''}){const r=$('#schedule-row-template').content.firstElementChild.cloneNode(true);r.querySelector('.slot-day').value=x.day||'Monday';r.querySelector('.slot-time').value=x.time||'';r.querySelector('.remove-slot').onclick=()=>r.remove();box.append(r)}
function readSlots(box){return [...box.querySelectorAll('.schedule-row')].map(r=>({day:r.querySelector('.slot-day').value,time:r.querySelector('.slot-time').value})).filter(x=>x.day||x.time)}
function photo(src=''){const img=$('#photo-preview'),ph=$('#photo-placeholder');$('#photo-data').value=src;if(src){img.src=src;img.hidden=false;ph.hidden=true}else{img.hidden=true;ph.hidden=false;img.removeAttribute('src')}}
function editDog(d=null){
  $('#dog-form').reset(); walkSlots.innerHTML=''; sitSlots.innerHTML='';
  $('#dog-id').value=d?.id||'';
  $('#dog-form-title').textContent=d?'Edit dog':'Add dog';
  $('#delete-dog').hidden=!d;
  $('#name').value=d?.name||''; $('#breed').value=d?.breed||''; $('#age').value=d?.age||''; $('#owner').value=d?.owner||'';
  $('#address-line1').value=d?.addressLine1||''; $('#address-town').value=d?.addressTown||''; $('#address-county').value=d?.addressCounty||''; $('#address-postcode').value=d?.addressPostcode||'';
  $('#key-info').value=d?.keyInfo||''; $('#special').value=d?.special||''; $('#other').value=d?.other||'';
  walkOn.checked=!!d?.walking; sitOn.checked=!!d?.sitting;
  walkEditor.hidden=!walkOn.checked; sitEditor.hidden=!sitOn.checked;
  (d?.walkSchedule||[]).forEach(x=>addSlot(walkSlots,x)); (d?.sitSchedule||[]).forEach(x=>addSlot(sitSlots,x));
  if(walkOn.checked&&!walkSlots.children.length)addSlot(walkSlots); if(sitOn.checked&&!sitSlots.children.length)addSlot(sitSlots);
  photo(d?.photo||''); dogDlg.showModal();
}
async function saveDog(){
  const name=$('#name').value.trim(); if(!name){$('#name').focus(); return toast('Please add the dog’s name')}
  const id=$('#dog-id').value||uid();
  const dog={
    id,
    photo:$('#photo-data').value,
    name,
    breed:$('#breed').value.trim(),
    age:$('#age').value.trim(),
    owner:$('#owner').value.trim(),
    addressLine1:$('#address-line1').value.trim(),
    addressTown:$('#address-town').value.trim(),
    addressCounty:$('#address-county').value.trim(),
    addressPostcode:cleanPostcode($('#address-postcode').value),
    keyInfo:$('#key-info').value.trim(),
    special:$('#special').value.trim(),
    other:$('#other').value.trim(),
    walking:walkOn.checked,
    walkSchedule:walkOn.checked?readSlots(walkSlots):[],
    sitting:sitOn.checked,
    sitSchedule:sitOn.checked?readSlots(sitSlots):[]
  };
  const exists=dogs.some(x=>x.id===id);
  await saveDogRecord(dog);
  dogDlg.close();
  routeDraft=null;
  setView(view==='route'?'home':view);
  toast(exists?'Dog updated':'Dog added');
}
function detail(id){
  const d=dogs.find(x=>x.id===id); if(!d)return;
  const fmt=s=>s?.length?s.map(x=>`${x.day} · ${x.time||'Any time'}`).join('\n'):'No times saved';
  detailDlg.innerHTML=`<div class="sheet-head"><p class="eyebrow">DOG PROFILE</p><button class="close-button" data-close-detail>×</button></div><div class="detail-hero">${avatar(d)}<h2>${esc(d.name)}</h2><p>${esc([d.breed,d.age].filter(Boolean).join(' · ')||'Dog profile')}</p><div class="tag-row" style="justify-content:center">${tags(d)}</div></div><div class="detail-grid"><div class="info-box"><small>Owner</small><p>${esc(d.owner||'—')}</p></div><div class="info-box"><small>Entry instructions</small><p>${esc(d.keyInfo||'—')}</p></div><div class="info-box wide"><small>Address</small><p>${esc(fullAddress(d)||'—')}</p></div>${d.walking?`<div class="info-box wide"><small>Walk schedule</small><p>${esc(fmt(d.walkSchedule))}</p></div>`:''}${d.sitting?`<div class="info-box wide"><small>Sitting schedule</small><p>${esc(fmt(d.sitSchedule))}</p></div>`:''}<div class="info-box wide"><small>Special requirements</small><p>${esc(d.special||'—')}</p></div><div class="info-box wide"><small>Other info</small><p>${esc(d.other||'—')}</p></div></div><div class="detail-actions">${hasAddress(d)?'<button class="secondary-button" data-map>Open address</button>':''}<button class="primary-button ${hasAddress(d)?'':'full'}" data-edit>Edit dog</button></div>`;
  detailDlg.querySelector('[data-close-detail]').onclick=()=>detailDlg.close();
  detailDlg.querySelector('[data-edit]').onclick=()=>{detailDlg.close(); editDog(d)};
  detailDlg.querySelector('[data-map]')?.addEventListener('click',()=>map(fullAddress(d)));
  detailDlg.showModal();
}
function map(a){open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`,'_blank','noopener')}
function resetLocationForm(){ $('#location-form').reset(); $('#location-id').value=''; $('#location-mode').value=''; $('#delete-location').hidden=true; }
function editLocation(mode='destination',id=''){
  resetLocationForm();
  $('#location-mode').value=mode;
  if(mode==='start'){
    $('#location-form-title').textContent='Jess’s starting location';
    $('#location-name-label span').textContent='Location name';
    $('#location-name').placeholder='e.g. Home';
    const loc=settings.start||{};
    $('#delete-location').hidden=true;
    $('#location-id').value='start';
    $('#location-name').value=loc.name||''; $('#location-line1').value=loc.line1||''; $('#location-town').value=loc.town||''; $('#location-county').value=loc.county||''; $('#location-postcode').value=loc.postcode||'';
  }else{
    $('#location-form-title').textContent=id?'Edit walking location':'Add walking location';
    $('#location-name-label span').textContent='Location name *';
    $('#location-name').placeholder='e.g. Oakfield Dog Walking Field';
    const loc=settings.destinations.find(x=>x.id===id)||{};
    $('#delete-location').hidden=!id;
    $('#location-id').value=id||'';
    $('#location-name').value=loc.name||''; $('#location-line1').value=loc.line1||''; $('#location-town').value=loc.town||''; $('#location-county').value=loc.county||''; $('#location-postcode').value=loc.postcode||'';
  }
  locationDlg.showModal();
}
async function saveLocation(){
  const mode=$('#location-mode').value;
  const name=$('#location-name').value.trim();
  const postcode=cleanPostcode($('#location-postcode').value);
  if(mode!=='start'&&!name)return toast('Please add a location name');
  if(!postcode)return toast('Please add a postcode');
  const loc=normalizeLocation({
    id:mode==='start'?'start':($('#location-id').value||uid()),
    name:name||'Starting location',
    line1:$('#location-line1').value.trim(),
    town:$('#location-town').value.trim(),
    county:$('#location-county').value.trim(),
    postcode
  });
  if(mode==='start')settings.start=loc;
  else {
    const i=settings.destinations.findIndex(x=>x.id===loc.id);
    if(i<0)settings.destinations.push(loc); else settings.destinations[i]=loc;
    settings.destinations.sort((a,b)=>a.name.localeCompare(b.name));
  }
  await saveSettings();
  locationDlg.close();
  routeDraft=null;
  setView(view==='route'?'home':view);
  toast(mode==='start'?'Starting location saved':'Location saved');
}
async function deleteLocation(){
  const mode=$('#location-mode').value;
  if(mode!=='destination')return;
  const id=$('#location-id').value;
  const loc=settings.destinations.find(x=>x.id===id);
  if(!loc||!confirm(`Delete ${loc.name}?`))return;
  settings.destinations=settings.destinations.filter(x=>x.id!==id);
  await saveSettings();
  locationDlg.close();
  routeDraft=null;
  setView(view==='route'?'home':view);
  toast('Location deleted');
}
async function usePhotoFile(file){
  if(!file)return;
  try{photo(await shrink(file))}catch{toast('Could not use that photo')}
}
function shrink(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(reader.error);
    reader.onload=()=>{
      const image=new Image();
      image.onerror=()=>reject(new Error('Image load failed'));
      image.onload=()=>{
        const max=1200;
        const scale=Math.min(1,max/Math.max(image.width,image.height));
        const canvas=document.createElement('canvas');
        canvas.width=Math.round(image.width*scale);
        canvas.height=Math.round(image.height*scale);
        canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',0.82));
      };
      image.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
async function backup(){
  const payload={version:2,storage:'IndexedDB',exportedAt:new Date().toISOString(),settings,dogs};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`jess-dog-organiser-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast('Backup exported');
}
async function restore(file){
  if(!file)return;
  try{
    const parsed=JSON.parse(await file.text());
    const list=(Array.isArray(parsed)?parsed:parsed.dogs)||[];
    if(!Array.isArray(list))throw new Error('Bad file');
    const nextDogs=list.map(migrateDog);
    const nextSettings=normalizeSettings(parsed.settings||{});
    if(!confirm(`Restore ${nextDogs.length} dog profile${nextDogs.length===1?'':'s'}? This replaces the data on this device.`))return;
    await dbClear(DOG_STORE);
    for(const dog of nextDogs)await dbPut(DOG_STORE,dog);
    dogs=nextDogs.sort((a,b)=>a.name.localeCompare(b.name));
    settings=nextSettings;
    postcodeCache={};
    await saveSettings();
    await savePostcodeCache();
    routeDraft=null;
    dataDlg.close();
    setView(view);
    toast('Backup restored');
  }catch{toast('That backup file could not be read')}
}
async function del(){
  const id=$('#dog-id').value, d=dogs.find(x=>x.id===id);
  if(!d||!confirm(`Delete ${d.name}? This cannot be undone.`))return;
  await removeDogRecord(id);
  routeDraft=null;
  dogDlg.close();
  setView(view);
  toast('Dog deleted');
}
function toast(m){let t=$('.toast');if(!t){t=document.createElement('div');t.className='toast';document.body.append(t)}t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2200)}

document.addEventListener('click',e=>{
  const d=e.target.closest('[data-dog]'); if(d)return detail(d.dataset.dog);
  if(e.target.closest('[data-add]'))return editDog();
  const g=e.target.closest('[data-go]'); if(g)return setView(g.dataset.go);
  if(e.target.closest('[data-route]')){routeDraft=null; return setView('route')}
  if(e.target.closest('[data-back]'))return setView('home');
  if(e.target.closest('[data-add-location]'))return editLocation('destination');
  if(e.target.closest('[data-edit-start]'))return editLocation('start');
  const l=e.target.closest('[data-edit-location]'); if(l)return editLocation(l.dataset.locationKind==='start'?'start':'destination',l.dataset.editLocation==='start'?'':l.dataset.editLocation);
});

document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>{routeDraft=null; setView(b.dataset.view)});
$('#fab').onclick=()=>editDog();
$('#save-dog').onclick=()=>saveDog();
$('#delete-dog').onclick=()=>del();
$('#add-walk-slot').onclick=()=>addSlot(walkSlots);
$('#add-sit-slot').onclick=()=>addSlot(sitSlots);
walkOn.onchange=()=>{walkEditor.hidden=!walkOn.checked;if(walkOn.checked&&!walkSlots.children.length)addSlot(walkSlots)};
sitOn.onchange=()=>{sitEditor.hidden=!sitOn.checked;if(sitOn.checked&&!sitSlots.children.length)addSlot(sitSlots)};
$('#take-photo-button').onclick=()=>$('#camera-input').click();
$('#choose-photo-button').onclick=()=>$('#photo-input').click();
$('#camera-input').onchange=e=>usePhotoFile(e.target.files[0]);
$('#photo-input').onchange=e=>usePhotoFile(e.target.files[0]);
$('#save-location').onclick=()=>saveLocation();
$('#delete-location').onclick=()=>deleteLocation();
$('#backup-button').onclick=()=>dataDlg.showModal();
$('[data-close-dialog="data-dialog"]').onclick=()=>dataDlg.close();
$('#export-data').onclick=()=>backup();
$('#import-data').onchange=e=>restore(e.target.files[0]);

async function init(){
  try{
    db=await openDb();
    await maybeImportLegacy();
    await loadState();
    if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
    setView('home');
  }catch(err){
    console.error(err);
    app.innerHTML='<div class="planner-status error">The app could not open its local storage. Please try reloading the page.</div>';
  }
}

init();
})();
