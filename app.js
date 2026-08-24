(()=>{
'use strict';

const DOG_KEY='jda-dogs-v1';
const SETTINGS_KEY='jda-settings-v2';
const POSTCODE_CACHE_KEY='jda-postcode-cache-v1';
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

let dogs=loadDogs();
let settings=loadSettings();
let view='home';
let routeDraft=null;
let postcodeCache=loadPostcodeCache();

function uid(){return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`}
function esc(v=''){return String(v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}
function cleanPostcode(v=''){return String(v).toUpperCase().replace(/\s+/g,' ').trim()}
function migrateDog(d={}){
  return {
    ...d,
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
function loadDogs(){try{let x=JSON.parse(localStorage.getItem(DOG_KEY)||'[]');return Array.isArray(x)?x.map(migrateDog):[]}catch{return[]}}
function loadSettings(){
  try{
    let x=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
    return {
      start:x.start||null,
      destinations:Array.isArray(x.destinations)?x.destinations:[]
    };
  }catch{return{start:null,destinations:[]}}
}
function saveDogs(){localStorage.setItem(DOG_KEY,JSON.stringify(dogs))}
function saveSettings(){localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}
function loadPostcodeCache(){try{return JSON.parse(localStorage.getItem(POSTCODE_CACHE_KEY)||'{}')||{}}catch{return{}}}
function savePostcodeCache(){localStorage.setItem(POSTCODE_CACHE_KEY,JSON.stringify(postcodeCache))}

function addressParts(x){
  if(!x)return[];
  return [x.addressLine1??x.line1,x.addressTown??x.town,x.addressCounty??x.county,x.addressPostcode??x.postcode].map(v=>(v||'').trim()).filter(Boolean);
}
function fullAddress(x){return addressParts(x).join(', ')}
function firstAddressLine(x){return (x?.addressLine1??x?.line1??'').trim()}
function postcodeOf(x){return cleanPostcode(x?.addressPostcode??x?.postcode??'')}
function hasAddress(x){return addressParts(x).length>0}
function avatar(d){return d.photo?`<img class="dog-avatar" src="${d.photo}" alt="${esc(d.name)}">`:`<div class="avatar-fallback">${esc((d.name||'?')[0].toUpperCase())}</div>`}
function today(){return new Intl.DateTimeFormat('en-GB',{weekday:'long'}).format(new Date())}
function dateLabel(){return new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}
function jobs(type,day=today()){
  return dogs.flatMap(d=>{
    const on=type==='walk'?d.walking:d.sitting;
    const schedule=type==='walk'?d.walkSchedule:d.sitSchedule;
    return on?(schedule||[]).filter(x=>x.day===day).map(slot=>({d,slot,type})):[];
  }).sort((a,b)=>(a.slot.time||'99:99').localeCompare(b.slot.time||'99:99'));
}
function tags(d){return`${d.walking?'<span class="tag">Walking</span>':''}${d.sitting?'<span class="tag sit">Sitting</span>':''}${d.keyInfo?.trim()?'<span class="tag key">Entry info</span>':''}`}
function dogCard(d){return`<button class="dog-card" data-dog="${d.id}">${avatar(d)}<span class="card-main"><strong>${esc(d.name)}</strong><small>${esc([d.breed,d.owner&&`Owner: ${d.owner}`].filter(Boolean).join(' · ')||'No extra details yet')}</small><span class="tag-row">${tags(d)}</span></span><span class="card-chevron">›</span></button>`}
function jobCard(x){return`<button class="job-card" data-dog="${x.d.id}">${avatar(x.d)}<span class="card-main"><strong>${esc(x.d.name)}</strong><small>${x.type==='walk'?'Walk':'Sitting'}${firstAddressLine(x.d)?' · '+esc(firstAddressLine(x.d)):''}</small></span><strong>${esc(x.slot.time||'Any time')}</strong></button>`}
function empty(h,p,b='Add a dog'){return`<div class="empty-state"><div class="empty-icon">●</div><h3>${esc(h)}</h3><p>${esc(p)}</p><button class="primary-button" data-add>${esc(b)}</button></div>`}
function locationCard(loc,kind='destination'){
  const title=kind==='start'?'Jess’s starting location':loc.name;
  return`<button class="location-card" data-edit-location="${kind==='start'?'start':loc.id}" data-location-kind="${kind}"><span class="location-icon">${kind==='start'?'⌂':'⌖'}</span><span class="card-main"><strong>${esc(title)}</strong><small>${esc(fullAddress(loc)||'Address not set')}</small></span><span class="card-chevron">›</span></button>`;
}

function home(){
  pageTitle.textContent='Today';
  const w=jobs('walk'),s=jobs('sit'),all=[...w,...s].sort((a,b)=>(a.slot.time||'99:99').localeCompare(b.slot.time||'99:99'));
  const destinations=settings.destinations||[];
  app.innerHTML=`
    <section class="hero"><p class="date">${esc(dateLabel())}</p><div class="hero-count"><strong>${all.length}</strong><span>${all.length===1?'job today':'jobs today'}</span></div><p class="hero-sub">${dogs.length?`${dogs.length} ${dogs.length===1?'dog':'dogs'} saved`:'Add your first dog to get started'}</p></section>
    <section class="quick-grid">
      <button class="quick-card" data-go="dogs"><span class="quick-symbol">●</span><strong>${dogs.length}</strong><small>All dogs</small></button>
      <button class="quick-card" data-go="walks"><span class="quick-symbol">↗</span><strong>${w.length}</strong><small>Walks today</small></button>
      <button class="quick-card" data-go="sitting"><span class="quick-symbol">⌂</span><strong>${s.length}</strong><small>Sitting today</small></button>
      <button class="quick-card" data-route><span class="quick-symbol">⌖</span><strong>${destinations.length}</strong><small>Plan route</small></button>
    </section>
    <section class="section"><div class="section-title-row"><h2>Today's schedule</h2></div><div class="list">${all.length?all.map(jobCard).join(''):empty('Nothing scheduled today',dogs.length?'There are no walks or sitting times saved for today.':'Add a dog and its schedule to see today’s jobs here.')}</div></section>
    <section class="section">
      <div class="section-title-row"><h2>Walking locations</h2><button class="text-button" data-add-location type="button">+ Add field</button></div>
      <div class="list">
        ${settings.start?locationCard(settings.start,'start'):`<button class="location-card" data-edit-start type="button"><span class="location-icon">⌂</span><span class="card-main"><strong>Set Jess’s starting location</strong><small>Needed to calculate when she should leave</small></span><span class="card-chevron">›</span></button>`}
        ${destinations.map(l=>locationCard(l,'destination')).join('')}
      </div>
    </section>`;
}

function allDogs(q=''){
  pageTitle.textContent='All Dogs';
  const needle=q.toLowerCase();
  const f=dogs.filter(d=>[d.name,d.breed,d.owner,...addressParts(d)].some(v=>(v||'').toLowerCase().includes(needle)));
  app.innerHTML=`<div class="search-wrap"><input id="dog-search" type="search" placeholder="Search dogs, owners or addresses" value="${esc(q)}"></div><div class="list">${f.length?f.map(dogCard).join(''):dogs.length?empty('No matches','Try a different search.','Clear search'):empty('No dogs yet','Add Jess’s first dog profile.')}</div>`;
  $('#dog-search').oninput=e=>allDogs(e.target.value);
  if(dogs.length&&!f.length)$('[data-add]').onclick=()=>allDogs('');
}

function schedule(type){
  const isWalk=type==='walk';
  const active=dogs.filter(d=>isWalk?d.walking:d.sitting);
  const slots=active.flatMap(d=>(isWalk?d.walkSchedule:d.sitSchedule||[]).map(slot=>({d,slot})));
  const groups=DAYS.map(day=>({day,list:slots.filter(x=>x.slot.day===day).sort((a,b)=>(a.slot.time||'99:99').localeCompare(b.slot.time||'99:99'))})).filter(g=>g.list.length);
  pageTitle.textContent=isWalk?'Walking':'Sitting';
  app.innerHTML=`${active.length?`<section class="section" style="margin-top:0"><div class="section-title-row"><h2>${active.length} ${active.length===1?'dog':'dogs'}</h2><span class="muted">Weekly schedule</span></div></section>`:''}${groups.length?groups.map(g=>`<section class="schedule-day"><h3>${g.day}</h3><div class="list">${g.list.map(x=>`<button class="schedule-card" data-dog="${x.d.id}"><span class="schedule-time">${esc(x.slot.time||'—')}</span>${avatar(x.d)}<span class="card-main"><strong>${esc(x.d.name)}</strong><small>${esc(firstAddressLine(x.d)||x.d.breed||'')}</small></span><span class="card-chevron">›</span></button>`).join('')}</div></section>`).join(''):empty(isWalk?'No walking schedule yet':'No sitting schedule yet',isWalk?'Turn on Walking in a dog profile and add the days and pickup times.':'Turn on Sitting in a dog profile and add the days and times.')}${isWalk?'<section class="section"><button class="secondary-button" style="width:100%" data-route>Plan a pickup route</button></section>':''}`;
}

function pickupForDay(d,day){
  return (d.walkSchedule||[]).filter(x=>x.day===day&&x.time).map(x=>x.time).sort()[0]||'';
}
function timeToMin(v){if(!/^\d{2}:\d{2}$/.test(v||''))return null;const [h,m]=v.split(':').map(Number);return h*60+m}
function minToTime(v){v=Math.max(0,Math.round(v));const h=Math.floor(v/60)%24,m=v%60;return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`}
function addMinutes(t,n){const m=timeToMin(t);return m==null?'':minToTime(m+n)}
function defaultArrival(day){
  const times=dogs.filter(d=>d.walking).map(d=>pickupForDay(d,day)).filter(Boolean).sort();
  if(times.length)return addMinutes(times[times.length-1],45);
  if(day===today()){
    const now=new Date(),m=now.getHours()*60+now.getMinutes()+90;
    return minToTime(Math.ceil(m/15)*15);
  }
  return'10:00';
}
function makeRouteDraft(day=today()){
  const selected={};
  dogs.filter(d=>d.walking).forEach(d=>{const t=pickupForDay(d,day);if(t&&postcodeOf(d))selected[d.id]=t});
  return{day,destinationId:settings.destinations[0]?.id||'',arrival:defaultArrival(day),stopMinutes:5,tolerance:5,trafficBuffer:10,selected,result:null};
}

function route(){
  view='route';
  pageTitle.textContent='Route Planner';
  if(!routeDraft)routeDraft=makeRouteDraft();
  const walkDogs=dogs.filter(d=>d.walking&&hasAddress(d));
  const destinations=settings.destinations||[];
  const startOk=!!postcodeOf(settings.start);
  app.innerHTML=`
    <button class="text-button" data-back>‹ Back</button>
    <div class="route-box">
      <h2>Walking pickup route</h2>
      <p>Choose the day, dogs and destination field. The planner uses road estimates between postcode centres, works out a sensible collection order, and calculates the latest time Jess should leave.</p>
      <div class="planner-grid">
        <label><span>Walking day</span><select id="route-day">${DAYS.map(d=>`<option ${d===routeDraft.day?'selected':''}>${d}</option>`).join('')}</select></label>
        <label><span>Arrive at field by</span><input id="field-arrival" type="time" value="${esc(routeDraft.arrival)}" /></label>
        <label><span>Destination field</span><select id="route-destination" ${destinations.length?'':'disabled'}>${destinations.length?destinations.map(l=>`<option value="${l.id}" ${l.id===routeDraft.destinationId?'selected':''}>${esc(l.name)}</option>`).join(''):'<option>No fields saved</option>'}</select></label>
        <label><span>Minutes at each house</span><input id="stop-minutes" type="number" min="0" max="30" step="1" value="${routeDraft.stopMinutes}" /></label>
        <label><span>Allowed pickup lateness</span><input id="pickup-tolerance" type="number" min="0" max="60" step="1" value="${routeDraft.tolerance}" /></label>
        <label><span>Traffic / parking buffer</span><input id="traffic-buffer" type="number" min="0" max="60" step="1" value="${routeDraft.trafficBuffer}" /></label>
      </div>
      <div class="planner-status ${startOk?'':'error'}">${settings.start?startOk?`Starting from <strong>${esc(fullAddress(settings.start))}</strong>.`:'Jess’s starting location needs a postcode before a route can be calculated.':'Set Jess’s starting location on the Home page first.'}</div>
      <div class="section-title-row" style="margin-top:17px"><h3>Dogs to collect</h3><small class="muted">Pickup times can be changed here</small></div>
      <div class="route-picker">
        ${walkDogs.length?walkDogs.map(d=>{
          const pc=postcodeOf(d),checked=Object.prototype.hasOwnProperty.call(routeDraft.selected,d.id),t=routeDraft.selected[d.id]??pickupForDay(d,routeDraft.day);
          return`<label class="route-option"><input class="route-dog-check" type="checkbox" value="${d.id}" ${checked?'checked':''} ${pc?'':'disabled'}><span><strong>${esc(d.name)}</strong><small style="display:block;color:var(--muted);margin-top:2px">${pc?esc(fullAddress(d)):'Add a postcode to use in route planning'}</small></span><input class="pickup-time" data-pickup-id="${d.id}" type="time" value="${esc(t||'')}" ${pc?'':'disabled'} aria-label="${esc(d.name)} pickup time"></label>`;
        }).join(''):'<p class="muted">No walking dogs with addresses have been added yet.</p>'}
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
  const day=$('#route-day');
  if(day)day.onchange=e=>{routeDraft=makeRouteDraft(e.target.value);route()};
  $('#route-destination')?.addEventListener('change',e=>{routeDraft.destinationId=e.target.value;routeDraft.result=null});
  $('#field-arrival')?.addEventListener('change',e=>{routeDraft.arrival=e.target.value;routeDraft.result=null});
  $('#stop-minutes')?.addEventListener('change',e=>{routeDraft.stopMinutes=clampNumber(e.target.value,0,30,5);routeDraft.result=null});
  $('#pickup-tolerance')?.addEventListener('change',e=>{routeDraft.tolerance=clampNumber(e.target.value,0,60,5);routeDraft.result=null});
  $('#traffic-buffer')?.addEventListener('change',e=>{routeDraft.trafficBuffer=clampNumber(e.target.value,0,60,10);routeDraft.result=null});
  app.querySelectorAll('.route-dog-check').forEach(ch=>ch.onchange=()=>{
    const t=app.querySelector(`[data-pickup-id="${CSS.escape(ch.value)}"]`)?.value||'';
    if(ch.checked)routeDraft.selected[ch.value]=t;else delete routeDraft.selected[ch.value];
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
function clampNumber(v,min,max,fallback){const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback}

async function postcodeCoord(postcode){
  const pc=cleanPostcode(postcode);
  if(!pc)throw new Error('Missing postcode');
  if(postcodeCache[pc])return postcodeCache[pc];
  const res=await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`,{headers:{Accept:'application/json'}});
  if(!res.ok)throw new Error(`Postcode ${pc} was not found`);
  const data=await res.json();
  const lat=data?.result?.latitude,lon=data?.result?.longitude;
  if(!Number.isFinite(lat)||!Number.isFinite(lon))throw new Error(`Postcode ${pc} has no coordinates`);
  postcodeCache[pc]={lat,lon};savePostcodeCache();return postcodeCache[pc];
}
async function roadMatrix(points){
  const coords=points.map(p=>`${p.lon},${p.lat}`).join(';');
  try{
    const res=await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?annotations=duration,distance`);
    if(!res.ok)throw new Error('Road service unavailable');
    const x=await res.json();
    if(x.code!=='Ok'||!Array.isArray(x.durations))throw new Error('Road service unavailable');
    return{durations:x.durations.map(r=>r.map(v=>v==null?Infinity:v/60)),distances:(x.distances||[]).map(r=>r.map(v=>v==null?Infinity:v/1000)),fallback:false};
  }catch{
    const n=points.length,durations=Array.from({length:n},()=>Array(n).fill(0)),distances=Array.from({length:n},()=>Array(n).fill(0));
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){
      const km=haversine(points[i],points[j]);distances[i][j]=km;durations[i][j]=i===j?0:(km/42*60)+2;
    }
    return{durations,distances,fallback:true};
  }
}
function haversine(a,b){const R=6371,toRad=x=>x*Math.PI/180,dLat=toRad(b.lat-a.lat),dLon=toRad(b.lon-a.lon),la1=toRad(a.lat),la2=toRad(b.lat);const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function permutations(items){
  const out=[];
  function walk(prefix,rest){if(!rest.length){out.push(prefix);return}for(let i=0;i<rest.length;i++)walk([...prefix,rest[i]],[...rest.slice(0,i),...rest.slice(i+1)])}
  walk([],items);return out;
}
function simulate(order,depart,matrix,targets,stopMinutes,tolerance,deadline){
  let t=depart,prev=0,drive=0,wait=0;const stops=[];
  for(const dogIndex of order){
    const pointIndex=dogIndex+1,leg=matrix.durations[prev][pointIndex];if(!Number.isFinite(leg))return{feasible:false};
    t+=leg;drive+=leg;const arrival=t,target=targets[dogIndex];
    if(target!=null&&t<target){wait+=target-t;t=target}
    const pickup=t,late=target==null?0:pickup-target;
    if(target!=null&&late>tolerance+.01)return{feasible:false};
    stops.push({dogIndex,arrival,pickup,target,leg,late});
    t+=stopMinutes;prev=pointIndex;
  }
  const destIndex=matrix.durations.length-1,finalLeg=matrix.durations[prev][destIndex];if(!Number.isFinite(finalLeg))return{feasible:false};
  t+=finalLeg;drive+=finalLeg;
  return{feasible:t<=deadline+.01,depart,stops,fieldArrival:t,finalLeg,drive,wait};
}
function latestFeasible(order,matrix,targets,stopMinutes,tolerance,deadline){
  const earliest=simulate(order,0,matrix,targets,stopMinutes,tolerance,deadline);if(!earliest.feasible)return null;
  let lo=0,hi=deadline;
  for(let i=0;i<28;i++){const mid=(lo+hi)/2,s=simulate(order,mid,matrix,targets,stopMinutes,tolerance,deadline);if(s.feasible)lo=mid;else hi=mid}
  return simulate(order,lo,matrix,targets,stopMinutes,tolerance,deadline);
}
function totalDistance(order,matrix){let prev=0,total=0;for(const d of order){total+=matrix.distances[prev][d+1]||0;prev=d+1}total+=matrix.distances[prev][matrix.distances.length-1]||0;return total}
function optimize(orderDogs,matrix,pickups,stopMinutes,tolerance,deadline){
  const targets=orderDogs.map(d=>timeToMin(pickups[d.id]));
  const indexes=orderDogs.map((_,i)=>i);
  const perms=permutations(indexes);
  let best=null;
  for(const order of perms){
    const sim=latestFeasible(order,matrix,targets,stopMinutes,tolerance,deadline);if(!sim)continue;
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
  const arrival=timeToMin(routeDraft.arrival);if(arrival==null)return showRouteError('Add the time Jess needs to reach the field.');
  const deadline=arrival-routeDraft.trafficBuffer;if(deadline<=0)return showRouteError('The traffic buffer is larger than the available day.');
  button.disabled=true;button.textContent='Calculating…';
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
  routeDraft.tolerance=clampNumber($('#pickup-tolerance')?.value,0,60,5);
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
  return`<section class="route-result"><div class="leave-card"><small>LEAVE BY</small><strong>${minToTime(r.depart)}</strong><p>${r.day} · about ${Math.round(r.drive)} min driving · ${r.distance.toFixed(1)} km</p></div><div class="timeline"><div class="timeline-row"><div class="timeline-time">${minToTime(r.depart)}</div><div class="timeline-mark"></div><div class="timeline-copy"><strong>Leave starting location</strong><small>${esc(fullAddress(settings.start))}</small></div></div>${rows}<div class="timeline-row"><div class="timeline-time">${plannedField}</div><div class="timeline-mark"></div><div class="timeline-copy"><strong>Arrive at ${esc(r.destination.name)}</strong><small>${Math.max(1,Math.round(r.finalLeg))} min drive from ${esc(prevName)}${r.buffer?` · ${r.buffer} min before ${target} target`:''}</small></div></div></div>${r.fallback?'<div class="route-warning">The road-routing service was unavailable, so this result uses a rough straight-line driving estimate. Recalculate before relying on the times.</div>':'<div class="route-warning">Times are road estimates, not live traffic. The extra buffer is included in the leave-by time. Road data © OpenStreetMap contributors.</div>'}<button id="open-optimized-route" class="primary-button" type="button" style="width:100%;margin-top:12px">Open this order in Google Maps</button></section>`;
}
function openOptimizedRoute(){
  const r=routeDraft?.result;if(!r)return;
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
function readSlots(box){return[...box.querySelectorAll('.schedule-row')].map(r=>({day:r.querySelector('.slot-day').value,time:r.querySelector('.slot-time').value}))}
function photo(src=''){const img=$('#photo-preview'),ph=$('#photo-placeholder');$('#photo-data').value=src;if(src){img.src=src;img.hidden=false;ph.hidden=true}else{img.hidden=true;ph.hidden=false;img.removeAttribute('src')}}

function editDog(d=null){
  $('#dog-form').reset();walkSlots.innerHTML=sitSlots.innerHTML='';
  $('#dog-id').value=d?.id||'';$('#dog-form-title').textContent=d?'Edit dog':'Add dog';$('#delete-dog').hidden=!d;
  $('#name').value=d?.name||'';$('#breed').value=d?.breed||'';$('#age').value=d?.age||'';$('#owner').value=d?.owner||'';
  $('#address-line1').value=d?.addressLine1||'';$('#address-town').value=d?.addressTown||'';$('#address-county').value=d?.addressCounty||'';$('#address-postcode').value=d?.addressPostcode||'';
  $('#key-info').value=d?.keyInfo||'';$('#special').value=d?.special||'';$('#other').value=d?.other||'';
  walkOn.checked=!!d?.walking;sitOn.checked=!!d?.sitting;walkEditor.hidden=!walkOn.checked;sitEditor.hidden=!sitOn.checked;
  (d?.walkSchedule||[]).forEach(x=>addSlot(walkSlots,x));(d?.sitSchedule||[]).forEach(x=>addSlot(sitSlots,x));
  if(walkOn.checked&&!walkSlots.children.length)addSlot(walkSlots);if(sitOn.checked&&!sitSlots.children.length)addSlot(sitSlots);
  photo(d?.photo||'');dogDlg.showModal();
}
function saveDog(){
  const name=$('#name').value.trim();if(!name){$('#name').focus();return toast('Please add the dog’s name')}
  const id=$('#dog-id').value||uid();
  const d={id,photo:$('#photo-data').value,name,breed:$('#breed').value.trim(),age:$('#age').value.trim(),owner:$('#owner').value.trim(),addressLine1:$('#address-line1').value.trim(),addressTown:$('#address-town').value.trim(),addressCounty:$('#address-county').value.trim(),addressPostcode:cleanPostcode($('#address-postcode').value),keyInfo:$('#key-info').value.trim(),special:$('#special').value.trim(),other:$('#other').value.trim(),walking:walkOn.checked,walkSchedule:walkOn.checked?readSlots(walkSlots):[],sitting:sitOn.checked,sitSchedule:sitOn.checked?readSlots(sitSlots):[]};
  const i=dogs.findIndex(x=>x.id===id);i<0?dogs.push(d):dogs[i]=d;saveDogs();routeDraft=null;dogDlg.close();setView(view==='route'?'home':view);toast(i<0?'Dog added':'Dog updated');
}
function detail(id){
  const d=dogs.find(x=>x.id===id);if(!d)return;
  const fmt=s=>s?.length?s.map(x=>`${x.day} · ${x.time||'Any time'}`).join('\n'):'No times saved';
  detailDlg.innerHTML=`<div class="sheet-head"><p class="eyebrow">DOG PROFILE</p><button class="close-button" data-close-detail>×</button></div><div class="detail-hero">${avatar(d)}<h2>${esc(d.name)}</h2><p>${esc([d.breed,d.age].filter(Boolean).join(' · ')||'Dog profile')}</p><div class="tag-row" style="justify-content:center">${tags(d)}</div></div><div class="detail-grid"><div class="info-box"><small>Owner</small><p>${esc(d.owner||'—')}</p></div><div class="info-box"><small>Postcode</small><p>${esc(d.addressPostcode||'—')}</p></div><div class="info-box wide"><small>Address</small><p>${esc(fullAddress(d)||'—')}</p></div><div class="info-box wide"><small>Key / entry instructions</small><p>${esc(d.keyInfo||'—')}</p></div>${d.walking?`<div class="info-box wide"><small>Walk pickup schedule</small><p>${esc(fmt(d.walkSchedule))}</p></div>`:''}${d.sitting?`<div class="info-box wide"><small>Sitting schedule</small><p>${esc(fmt(d.sitSchedule))}</p></div>`:''}<div class="info-box wide"><small>Special requirements</small><p>${esc(d.special||'—')}</p></div><div class="info-box wide"><small>Other info</small><p>${esc(d.other||'—')}</p></div></div><div class="detail-actions">${hasAddress(d)?'<button class="secondary-button" data-map>Open address</button>':''}<button class="primary-button ${hasAddress(d)?'':'full'}" data-edit>Edit dog</button></div>`;
  detailDlg.querySelector('[data-close-detail]').onclick=()=>detailDlg.close();
  detailDlg.querySelector('[data-edit]').onclick=()=>{detailDlg.close();editDog(d)};
  detailDlg.querySelector('[data-map]')?.addEventListener('click',()=>map(fullAddress(d)));
  detailDlg.showModal();
}
function map(a){open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`,'_blank','noopener')}

function editLocation(mode,id=''){
  $('#location-form').reset();$('#location-mode').value=mode;$('#location-id').value=id;
  const isStart=mode==='start';const loc=isStart?settings.start:settings.destinations.find(x=>x.id===id);
  $('#location-form-title').textContent=isStart?(loc?'Edit starting location':'Set starting location'):(loc?'Edit walking location':'Add walking location');
  $('#location-name-label').hidden=isStart;$('#location-name').value=isStart?'':loc?.name||'';
  $('#location-line1').value=loc?.line1||'';$('#location-town').value=loc?.town||'';$('#location-county').value=loc?.county||'';$('#location-postcode').value=loc?.postcode||'';
  $('#delete-location').hidden=!loc;locationDlg.showModal();
}
function saveLocation(){
  const mode=$('#location-mode').value,isStart=mode==='start',postcode=cleanPostcode($('#location-postcode').value);
  const name=isStart?'Jess’s starting location':$('#location-name').value.trim();
  if(!isStart&&!name){$('#location-name').focus();return toast('Add a name for the walking location')}
  if(!postcode){$('#location-postcode').focus();return toast('Add the postcode')}
  const loc={id:isStart?'start':($('#location-id').value||uid()),name,line1:$('#location-line1').value.trim(),town:$('#location-town').value.trim(),county:$('#location-county').value.trim(),postcode};
  if(isStart)settings.start=loc;else{const i=settings.destinations.findIndex(x=>x.id===loc.id);i<0?settings.destinations.push(loc):settings.destinations[i]=loc}
  saveSettings();routeDraft=null;locationDlg.close();setView(view==='route'?'home':view);toast(isStart?'Starting location saved':'Walking location saved');
}
function deleteLocation(){
  const mode=$('#location-mode').value,id=$('#location-id').value;
  if(mode==='start'){if(!settings.start||!confirm('Remove Jess’s starting location?'))return;settings.start=null}else{const loc=settings.destinations.find(x=>x.id===id);if(!loc||!confirm(`Delete ${loc.name}?`))return;settings.destinations=settings.destinations.filter(x=>x.id!==id)}
  saveSettings();routeDraft=null;locationDlg.close();setView(view==='route'?'home':view);toast('Location removed');
}

function shrink(file){return new Promise((res,rej)=>{if(!file)return rej(new Error('No file'));const r=new FileReader;r.onerror=rej;r.onload=()=>{const im=new Image;im.onerror=rej;im.onload=()=>{const max=1000,s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*s));c.height=Math.max(1,Math.round(im.height*s));c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.82))};im.src=r.result};r.readAsDataURL(file)})}
async function usePhotoFile(file){try{photo(await shrink(file))}catch{toast('Could not use that photo')}}
function backup(){
  const b=new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),dogs,settings},null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download=`jess-dog-organiser-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast('Backup exported');
}
async function restore(file){
  if(!file)return;
  try{
    const x=JSON.parse(await file.text()),list=Array.isArray(x)?x:x.dogs;if(!Array.isArray(list))throw 0;
    if(!confirm(`Restore ${list.length} dog profile${list.length===1?'':'s'}? This replaces the organiser data on this device.`))return;
    dogs=list.map(migrateDog);settings=x.settings&&typeof x.settings==='object'?{start:x.settings.start||null,destinations:Array.isArray(x.settings.destinations)?x.settings.destinations:[]}:{start:null,destinations:[]};
    saveDogs();saveSettings();routeDraft=null;dataDlg.close();setView(view);toast('Backup restored');
  }catch{toast('That backup file could not be read')}
}
function del(){const id=$('#dog-id').value,d=dogs.find(x=>x.id===id);if(!d||!confirm(`Delete ${d.name}? This cannot be undone.`))return;dogs=dogs.filter(x=>x.id!==id);saveDogs();routeDraft=null;dogDlg.close();setView(view);toast('Dog deleted')}
function toast(m){let t=$('.toast');if(!t){t=document.createElement('div');t.className='toast';document.body.append(t)}t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2200)}

// Global tap handling for rendered page controls.
document.addEventListener('click',e=>{
  const d=e.target.closest('[data-dog]');if(d)return detail(d.dataset.dog);
  if(e.target.closest('[data-add]'))return editDog();
  const g=e.target.closest('[data-go]');if(g)return setView(g.dataset.go);
  if(e.target.closest('[data-route]')){routeDraft=null;return setView('route')}
  if(e.target.closest('[data-back]'))return setView('home');
  if(e.target.closest('[data-add-location]'))return editLocation('destination');
  if(e.target.closest('[data-edit-start]'))return editLocation('start');
  const l=e.target.closest('[data-edit-location]');if(l)return editLocation(l.dataset.locationKind==='start'?'start':'destination',l.dataset.editLocation==='start'?'':l.dataset.editLocation);
});

document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>{routeDraft=null;setView(b.dataset.view)});
$('#fab').onclick=()=>editDog();
$('#save-dog').onclick=saveDog;
$('#delete-dog').onclick=del;
$('#add-walk-slot').onclick=()=>addSlot(walkSlots);
$('#add-sit-slot').onclick=()=>addSlot(sitSlots);
walkOn.onchange=()=>{walkEditor.hidden=!walkOn.checked;if(walkOn.checked&&!walkSlots.children.length)addSlot(walkSlots)};
sitOn.onchange=()=>{sitEditor.hidden=!sitOn.checked;if(sitOn.checked&&!sitSlots.children.length)addSlot(sitSlots)};
$('#take-photo-button').onclick=()=>$('#camera-input').click();
$('#choose-photo-button').onclick=()=>$('#photo-input').click();
$('#camera-input').onchange=e=>usePhotoFile(e.target.files[0]);
$('#photo-input').onchange=e=>usePhotoFile(e.target.files[0]);
$('#save-location').onclick=saveLocation;
$('#delete-location').onclick=deleteLocation;
$('#backup-button').onclick=()=>dataDlg.showModal();
$('[data-close-dialog="data-dialog"]').onclick=()=>dataDlg.close();
$('#export-data').onclick=backup;
$('#import-data').onchange=e=>restore(e.target.files[0]);

if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
setView('home');
})();
